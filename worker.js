addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// Pre-compiled regexes for content rewriting (still needed inside iframe)
const RE_SCRIPT_AD = /<script[^>]*(?:googlesyndication|adsbygoogle|doubleclick|google-analytics|googletagmanager)[^>]*>[\s\S]*?<\/script>/gi;
const RE_IFRAME_AD = /<iframe[^>]*(?:googlesyndication|doubleclick|google-analytics)[^>]*>[\s\S]*?<\/iframe>/gi;
const RE_INS_AD = /<ins[^>]*adsbygoogle[^>]*>[\s\S]*?<\/ins>/gi;
const RE_HTML_TAG = /<([a-zA-Z][a-zA-Z0-9]*)\s([^>]*?)>/gs;
const RE_ATTR = /([a-zA-Z_][\w\-\.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
const RE_CSS_URL = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
const RE_CSS_IMPORT = /@import\s+(['"])([^'"]+)\1/gi;
const RE_JS_HTTP_URL = /(["'])(https?:\/\/[^"'\\]+)\1/g;
const RE_JS_PROTO_REL = /(["'])(\/\/[^"'\\]+\.[^"'\\]+)\1/g;
const RE_HEAD = /<head([^>]*)>/i;

const URL_ATTRS = new Set([
  'src', 'href', 'action', 'data-src', 'data-href', 'data-url',
  'poster', 'background', 'cite', 'formaction', 'icon', 'manifest',
  'dynsrc', 'lowsrc', 'srcset', 'data-bg', 'data-image',
  'data-lazy-src', 'data-original', 'data-actualsrc', 'data-thumb',
  'data-link', 'data-target', 'data-redirect', 'data-navigate'
]);

const AD_PATTERNS = [
  'googlesyndication.com', 'doubleclick.net', 'googleadservices.com',
  'google-analytics.com', 'googletagmanager.com', 'googletagservices.com',
  'adservice.google.com', 'pagead2.googlesyndication.com', 'tpc.googlesyndication.com',
  'video-ad-stats.googlesyndication.com', 'ads.google.com', 'adssettings.google.com',
  'static.ads-twitter.com', 'ads-api.twitter.com', 'ads.facebook.com', 'an.facebook.com',
  'adnxs.com', 'advertising.com', 'outbrain.com', 'taboola.com', 'criteo.com',
  'pubmatic.com', 'rubiconproject.com', 'openx.net', 'adsafeprotected.com',
  'moatads.com', 'scorecardresearch.com', '/ads/', '/ad/', '/advert/',
  '/advertisement/', '/adsense/', '/adserver/', '/analytics/', 'prebid',
  'advertis', 'banner', 'popup'
];

// 🔒 IFRAME SHELL TEMPLATE - Served instead of raw proxied HTML
function getShellHTML(workerOrigin, targetURL) {
  const proxySrc = `${workerOrigin}/${targetURL.host}${targetURL.pathname}${targetURL.search}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${targetURL.host} - HyperZ Proxy</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#0d1117}
#proxy-frame{width:100%;height:100%;border:none;display:block}
</style>
</head>
<body>
<iframe id="proxy-frame" src="${proxySrc}" sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock" allow="accelerometer;camera;encrypted-media;geolocation;gyroscope;hid;microphone;midi;clipboard-read;clipboard-write;xr-spatial-tracking;gamepad" referrerpolicy="no-referrer-when-downgrade"></iframe>
<script>
(function(){
  var WO = "${workerOrigin}";
  var BH = "${targetURL.host}";
  var frame = document.getElementById('proxy-frame');
  var lastValidSrc = frame.src;

  // Extract the proxied path from an iframe src and validate it
  function isValidProxyUrl(url) {
    try {
      var u = new URL(url);
      // Must be same origin as worker
      if (u.origin !== WO) return false;
      // First path segment must look like a domain (contains a dot)
      var seg = u.pathname.split('/')[1];
      if (!seg || !seg.includes('.')) return false;
      return true;
    } catch(e) { return false; }
  }

  // Convert any URL back to its proxied form
  function toProxy(url) {
    try {
      var u = new URL(url, WO + '/' + BH + '/');
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      if (u.origin === WO) {
        var seg = u.pathname.split('/')[1];
        if (seg && seg.includes('.')) return u.href;
      }
      return WO + '/' + u.host + u.pathname + u.search + u.hash;
    } catch(e) { return null; }
  }

  // 🔒 CONSTANT POLLING CHECKER - Runs every 50ms
  setInterval(function() {
    try {
      var currentSrc = frame.src;
      // If src changed and is no longer a valid proxy URL, fix it
      if (currentSrc !== lastValidSrc) {
        if (!isValidProxyUrl(currentSrc)) {
          var fixed = toProxy(currentSrc);
          if (fixed && isValidProxyUrl(fixed)) {
            frame.src = fixed;
            lastValidSrc = fixed;
          } else {
            // Can't fix it - restore last known good URL
            frame.src = lastValidSrc;
          }
        } else {
          lastValidSrc = currentSrc;
        }
      }
    } catch(e) {
      // Cross-origin access denied means iframe navigated outside proxy
      // Force it back to last valid URL
      frame.src = lastValidSrc;
    }
  }, 50);

  // 🔒 ALSO CHECK ON LOAD EVENTS
  frame.addEventListener('load', function() {
    try {
      var currentSrc = frame.src;
      if (!isValidProxyUrl(currentSrc)) {
        var fixed = toProxy(currentSrc);
        if (fixed && isValidProxyUrl(fixed)) {
          frame.src = fixed;
          lastValidSrc = fixed;
        } else {
          frame.src = lastValidSrc;
        }
      } else {
        lastValidSrc = currentSrc;
      }
    } catch(e) {
      frame.src = lastValidSrc;
    }
  });

  // 🔒 BLOCK PARENT FRAME NAVIGATION ATTEMPTS
  window.addEventListener('message', function(e) {
    // Ignore all messages that try to trigger navigation
    if (e.data && typeof e.data === 'object') {
      if (e.data.type === 'navigate' || e.data.type === 'redirect' || e.data.url) {
        e.stopPropagation();
      }
    }
  }, true);

  // 🔒 OVERRIDE window.open IN SHELL TO PREVENT ESCAPE
  window.open = function(u, n, f) {
    var p = toProxy(u);
    if (p && isValidProxyUrl(p)) {
      // Open inside the iframe instead of new tab
      frame.src = p;
      lastValidSrc = p;
      return null;
    }
    return null;
  };

  // 🔒 LOCK DOWN PARENT LOCATION
  try {
    var lp = Object.getPrototypeOf(location);
    var od = Object.getOwnPropertyDescriptor(lp, 'href');
    if (od && od.set) {
      Object.defineProperty(lp, 'href', {
        get: od.get,
        set: function(v) { /* SILENTLY BLOCK ALL PARENT NAVIGATION */ },
        configurable: true, enumerable: true
      });
    }
  } catch(e) {}
})();
</script>
</body>
</html>`;
}

// Inner content rewriter script (injected INTO the proxied page inside iframe)
const INNER_REWRITER = `<script id="__inner_proxy_rewriter__">
(function(){
  var WO = "WORKER_ORIGIN_PLACEHOLDER";
  var BO = "BASE_ORIGIN_PLACEHOLDER";

  function toProxy(url) {
    if (!url || typeof url !== 'string') return null;
    var t = url.trim();
    if (!t) return null;
    if (/^(data:|blob:|mailto:|tel:|#|javascript:|about:)/i.test(t)) return null;
    try {
      var abs;
      if (/^(https?:)?\/\//i.test(t)) abs = new URL(t, BO + '/');
      else abs = new URL(t, location.href);
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return null;
      if (abs.origin === WO) {
        var seg = abs.pathname.split('/')[1];
        if (seg && seg.includes('.')) return abs.href;
      }
      var p = WO + '/' + abs.host + abs.pathname + abs.search + abs.hash;
      if (!p.startsWith(WO + '/')) return null;
      return p;
    } catch(e) { return null; }
  }

  function rewriteAll() {
    document.querySelectorAll('a[href],[data-href],[data-link],[data-redirect]').forEach(function(el) {
      ['href','data-href','data-link','data-redirect'].forEach(function(a){
        var v=el.getAttribute(a);if(v){var p=toProxy(v);if(p)el.setAttribute(a,p);else if(a==='href')el.removeAttribute('href');}
      });
    });
    document.querySelectorAll('form[action]').forEach(function(el) {
      var v=el.getAttribute('action');if(v){var p=toProxy(v);if(p)el.setAttribute('action',p);}
    });
  }

  rewriteAll();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',rewriteAll);
  window.addEventListener('load',rewriteAll);

  document.addEventListener('click',function(e){
    var el=e.target;while(el&&el!==document){if(el.tagName==='A')break;el=el.parentElement||el.parentNode;}
    if(!el||el.tagName!=='A')return;
    var href=el.getAttribute('href')||el.getAttribute('data-href')||el.getAttribute('data-link');
    if(!href)return;var p=toProxy(href);
    if(!p){e.preventDefault();e.stopImmediatePropagation();return;}
    el.setAttribute('href',p);e.preventDefault();e.stopImmediatePropagation();
    if(el.target==='_blank'||e.metaKey||e.ctrlKey){window.open(p,'_blank');}
    else{history.pushState(null,'',p);window.dispatchEvent(new PopStateEvent('popstate'));}
  },true);

  document.addEventListener('submit',function(e){
    var f=e.target;if(f&&f.tagName==='FORM'){var v=f.getAttribute('action')||'';var p=toProxy(v);
    if(!p){e.preventDefault();e.stopImmediatePropagation();return;}f.setAttribute('action',p);}
  },true);

  try{var lp=Object.getPrototypeOf(location);var od=Object.getOwnPropertyDescriptor(lp,'href');
  if(od&&od.set){Object.defineProperty(lp,'href',{get:od.get,set:function(v){var p=toProxy(v);if(!p)return;od.set.call(this,p);},configurable:true,enumerable:true});}}catch(e){}

  var oo=window.open;window.open=function(u,n,f){if(u){var p=toProxy(u);if(!p)return null;u=p;}return oo.call(window,u,n,f);};
  var op=history.pushState,or=history.replaceState;
  history.pushState=function(s,t,u){if(u){var p=toProxy(u);if(!p)return;u=p;}return op.call(history,s,t,u);};
  history.replaceState=function(s,t,u){if(u){var p=toProxy(u);if(!p)return;u=p;}return or.call(history,s,t,u);};

  var mo=new MutationObserver(function(muts){muts.forEach(function(m){
    if(m.type==='childList'){m.addedNodes.forEach(function(n){if(n.nodeType!==1)return;
    if(n.tagName==='A'){['href','data-href','data-link','data-redirect'].forEach(function(a){var v=n.getAttribute(a);if(v){var p=toProxy(v);if(p)n.setAttribute(a,p);else if(a==='href')n.removeAttribute('href');}});}
    if(n.querySelectorAll){n.querySelectorAll('a[href],[data-href],[data-link]').forEach(function(el){['href','data-href','data-link','data-redirect'].forEach(function(a){var v=el.getAttribute(a);if(v){var p=toProxy(v);if(p)el.setAttribute(a,p);else if(a==='href')el.removeAttribute('href');}});}}
    });}
    if(m.type==='attributes'){var el=m.target,a=m.attributeName;
    if(['href','action','src','data-href','data-link','data-redirect'].indexOf(a)>-1&&el.nodeType===1){var v=el.getAttribute(a);var p=toProxy(v);if(p)el.setAttribute(a,p);else if(a==='href')el.removeAttribute('href');}}
  });});
  function startMo(){if(document.documentElement)mo.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['href','action','src','data-href','data-link','data-redirect']});else setTimeout(startMo,10);}
  startMo();
})();
</script>`;

let urlCache = new Map();

async function handleRequest(request) {
  const url = new URL(request.url);
  const workerOrigin = url.origin;

  let targetPath = url.pathname.substring(1);
  if (!targetPath) {
    return new Response('No target specified. Use: /example.com', {
      status: 400, headers: { 'Content-Type': 'text/plain' }
    });
  }

  let targetURL;
  try {
    targetURL = (targetPath.startsWith('http://') || targetPath.startsWith('https://'))
      ? new URL(targetPath)
      : new URL('https://' + targetPath);
  } catch (e) {
    return new Response(`Invalid URL: ${targetPath}`, { status: 400 });
  }
  targetURL.search = url.search;

  if (isAdRequest(targetURL.href)) return new Response('', { status: 204 });

  // 🔒 Determine if this is a SHELL request or INNER CONTENT request
  // Shell = direct browser navigation (Accept: text/html, no X-PJAX header)
  // Inner = subresource or iframe src load
  const accept = request.headers.get('Accept') || '';
  const isPJAX = request.headers.has('X-PJAX');
  const isInnerLoad = request.headers.has('X-Proxy-Inner');

  // Serve SHELL for top-level HTML navigation
  if (!isInnerLoad && !isPJAX && accept.includes('text/html') && !accept.includes('application/json')) {
    // Check if this looks like a proxied path (has domain in first segment)
    const firstSeg = targetPath.split('/')[0];
    if (firstSeg && firstSeg.includes('.') && !firstSeg.startsWith('http')) {
      // This is a proxied site request - serve the iframe shell
      const shell = getShellHTML(workerOrigin, targetURL);
      return new Response(shell, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Frame-Options': 'DENY',
          'Content-Security-Policy': "frame-ancestors 'none'"
        }
      });
    }
  }

  // All other requests: proxy the actual content (loaded inside iframe)
  const headers = new Headers(request.headers);
  headers.set('Host', targetURL.host);
  headers.set('Origin', targetURL.origin);
  headers.set('Referer', targetURL.href);
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ray');
  headers.delete('x-forwarded-for');
  headers.delete('x-forwarded-proto');
  headers.delete('x-real-ip');

  if (!headers.has('User-Agent')) {
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36');
  }

  let response;
  try {
    response = await fetch(new Request(targetURL.href, {
      method: request.method, headers, body: request.body, redirect: 'manual'
    }));
  } catch (err) {
    return new Response(`Proxy Error: ${err.message}`, { status: 502 });
  }

  // Block external redirects
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const loc = response.headers.get('Location');
    if (loc) {
      urlCache.clear();
      const rewritten = rewriteUrl(loc, targetURL, workerOrigin);
      if (rewritten && rewritten.startsWith(workerOrigin + '/')) {
        return Response.redirect(rewritten, response.status);
      }
      return new Response('Blocked external redirect', { status: 403 });
    }
  }

  const respHeaders = new Headers(response.headers);
  respHeaders.delete('Content-Security-Policy');
  respHeaders.delete('X-Content-Security-Policy');
  respHeaders.delete('X-Frame-Options');
  respHeaders.delete('Frame-Options');
  respHeaders.delete('Strict-Transport-Security');
  respHeaders.delete('Cross-Origin-Opener-Policy');
  respHeaders.delete('Cross-Origin-Embedder-Policy');
  respHeaders.delete('Cross-Origin-Resource-Policy');
  respHeaders.delete('Refresh');
  respHeaders.set('Access-Control-Allow-Origin', '*');
  respHeaders.set('Access-Control-Allow-Methods', '*');
  respHeaders.set('Access-Control-Allow-Headers', '*');
  respHeaders.set('Access-Control-Allow-Credentials', 'true');

  const setCookies = response.headers.getAll('Set-Cookie');
  respHeaders.delete('Set-Cookie');
  for (const cookie of setCookies) {
    let fixed = cookie
      .replace(/Path=([^;]+)/gi, (_, p) => `Path=/${targetURL.host}${p.startsWith('/') ? '' : '/'}${p}`)
      .replace(/Domain=[^;]+;?\s*/gi, '')
      .replace(/Secure;?\s*/gi, '');
    if (!fixed.includes('SameSite=')) fixed += '; SameSite=None';
    respHeaders.append('Set-Cookie', fixed);
  }

  const ct = respHeaders.get('Content-Type') || '';

  if (ct.includes('text/html')) {
    let html = await response.text();
    urlCache.clear();
    html = blockAdsInHTML(html);
    html = deepRewriteHtml(html, targetURL, workerOrigin);

    // Inject INNER rewriter (not the shell interceptor)
    const innerScript = INNER_REWRITER
      .replace('WORKER_ORIGIN_PLACEHOLDER', workerOrigin)
      .replace('BASE_ORIGIN_PLACEHOLDER', targetURL.origin);

    if (html.match(RE_HEAD)) {
      html = html.replace(RE_HEAD, `$&${innerScript}`);
    } else {
      html = innerScript + html;
    }

    return new Response(html, { status: response.status, statusText: response.statusText, headers: respHeaders });
  }

  if (ct.includes('text/css')) {
    let css = await response.text();
    urlCache.clear();
    css = rewriteCssUrls(css, targetURL, workerOrigin);
    return new Response(css, { status: response.status, headers: respHeaders });
  }

  if (ct.includes('javascript') || ct.includes('application/json')) {
    let body = await response.text();
    urlCache.clear();
    body = rewriteJsUrls(body, targetURL, workerOrigin);
    return new Response(body, { status: response.status, headers: respHeaders });
  }

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: respHeaders });
}

function resolveAndProxy(urlStr, baseUrl, workerOrigin) {
  if (!urlStr || typeof urlStr !== 'string') return null;
  const trimmed = urlStr.trim();
  if (!trimmed) return null;
  const firstChar = trimmed.charCodeAt(0);
  if (firstChar === 35 || firstChar === 106) return null;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') ||
      trimmed.startsWith('mailto:') || trimmed.startsWith('tel:') ||
      trimmed.startsWith('about:')) return null;
  const cacheKey = trimmed;
  if (urlCache.has(cacheKey)) return urlCache.get(cacheKey);
  try {
    const absolute = new URL(trimmed, baseUrl.href);
    if (absolute.protocol !== 'http:' && absolute.protocol !== 'https:') {
      urlCache.set(cacheKey, null); return null;
    }
    const result = `${workerOrigin}/${absolute.host}${absolute.pathname}${absolute.search}`;
    urlCache.set(cacheKey, result); return result;
  } catch (e) { urlCache.set(cacheKey, null); return null; }
}

function rewriteUrl(urlStr, baseUrl, workerOrigin) {
  const result = resolveAndProxy(urlStr, baseUrl, workerOrigin);
  return result !== null ? result : urlStr;
}

function blockAdsInHTML(html) {
  html = html.replace(RE_SCRIPT_AD, '');
  html = html.replace(RE_IFRAME_AD, '');
  html = html.replace(RE_INS_AD, '');
  return html;
}

function deepRewriteHtml(html, baseUrl, workerOrigin) {
  html = html.replace(RE_HEAD, `<head$1><base href="${baseUrl.origin}/">`);
  html = html.replace(/<meta[^>]*http-equiv\s*=\s*["']refresh["'][^>]*>/gi, '');
  html = html.replace(RE_HTML_TAG, (fullMatch, tagName, attrs) => {
    const rewrittenAttrs = attrs.replace(RE_ATTR, (attrMatch, attrName, dqVal, sqVal, uqVal) => {
      const lowerAttr = attrName.toLowerCase();
      const value = dqVal ?? sqVal ?? uqVal;
      const quote = dqVal !== undefined ? '"' : sqVal !== undefined ? "'" : '';
      if (lowerAttr === 'srcset') {
        const rs = value.split(',').map(entry => {
          const parts = entry.trim().split(/\s+/);
          if (parts[0]) { const rw = resolveAndProxy(parts[0], baseUrl, workerOrigin); if (rw !== null) parts[0] = rw; }
          return parts.join(' ');
        }).join(', ');
        return `${attrName}=${quote}${rs}${quote}`;
      }
      if (URL_ATTRS.has(lowerAttr)) {
        const rw = resolveAndProxy(value, baseUrl, workerOrigin);
        return rw !== null ? `${attrName}=${quote}${rw}${quote}` : attrMatch;
      }
      if (lowerAttr === 'style') return `${attrName}=${quote}${rewriteCssUrls(value, baseUrl, workerOrigin)}${quote}`;
      if (lowerAttr === 'content' && tagName.toLowerCase() === 'meta') {
        if (value.match(/^https?:\/\//i) || value.startsWith('//')) {
          const rw = resolveAndProxy(value, baseUrl, workerOrigin);
          return rw !== null ? `${attrName}=${quote}${rw}${quote}` : attrMatch;
        }
      }
      if (lowerAttr.startsWith('data-') && (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('//'))) {
        const rw = resolveAndProxy(value, baseUrl, workerOrigin);
        return rw !== null ? `${attrName}=${quote}${rw}${quote}` : attrMatch;
      }
      return attrMatch;
    });
    return `<${tagName} ${rewrittenAttrs}>`;
  });
  html = html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, o, c, cl) => o + rewriteCssUrls(c, baseUrl, workerOrigin) + cl);
  html = html.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, o, c, cl) => {
    if (c.includes('http://') || c.includes('https://') || c.includes('"/') || c.includes("'/")) return o + rewriteJsUrls(c, baseUrl, workerOrigin) + cl;
    return m;
  });
  return html;
}

function rewriteCssUrls(css, baseUrl, workerOrigin) {
  css = css.replace(RE_CSS_URL, (m, q, u) => { const rw = resolveAndProxy(u.trim(), baseUrl, workerOrigin); return rw !== null ? `url(${q}${rw}${q})` : m; });
  css = css.replace(RE_CSS_IMPORT, (m, q, u) => { const rw = resolveAndProxy(u, baseUrl, workerOrigin); return rw !== null ? `@import ${q}${rw}${q}` : m; });
  return css;
}

function rewriteJsUrls(js, baseUrl, workerOrigin) {
  js = js.replace(RE_JS_HTTP_URL, (m, q, u) => { const rw = resolveAndProxy(u, baseUrl, workerOrigin); return rw !== null ? `${q}${rw}${q}` : m; });
  js = js.replace(RE_JS_PROTO_REL, (m, q, u) => { const rw = resolveAndProxy(u, baseUrl, workerOrigin); return rw !== null ? `${q}${rw}${q}` : m; });
  return js;
}

function isAdRequest(url) {
  const l = url.toLowerCase();
  for (let i = 0; i < AD_PATTERNS.length; i++) { if (l.includes(AD_PATTERNS[i])) return true; }
  return false;
}
