addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// Pre-compiled regexes for performance
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
  'adservice.google.com', 'pagead2.googlesyndication.com',
  'ads.google.com', 'static.ads-twitter.com', 'ads.facebook.com',
  'adnxs.com', 'advertising.com', 'outbrain.com', 'taboola.com',
  'criteo.com', 'pubmatic.com', 'rubiconproject.com', 'openx.net',
  '/ads/', '/ad/', '/advert/', '/analytics/', 'prebid', 'banner'
];

// Comprehensive navigation interceptor
const NAV_INTERCEPTOR = `<script id="__proxy_nav__">
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
      if (/^(https?:)?\/\//i.test(t)) {
        abs = new URL(t, BO + '/');
      } else {
        abs = new URL(t, location.href);
      }
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return null;
      if (abs.origin === WO) {
        var seg = abs.pathname.split('/')[1];
        if (seg && seg.includes('.')) return abs.href;
      }
      return WO + '/' + abs.host + abs.pathname + abs.search + abs.hash;
    } catch(e) { return null; }
  }

  // Rewrite all links immediately and on load
  function rewriteAll() {
    document.querySelectorAll('a[href],[data-href],[data-link]').forEach(function(el) {
      ['href','data-href','data-link'].forEach(function(a){
        var v = el.getAttribute(a);
        if (v) { var p = toProxy(v); if (p) el.setAttribute(a, p); }
      });
    });
    document.querySelectorAll('form[action]').forEach(function(el) {
      var v = el.getAttribute('action');
      if (v) { var p = toProxy(v); if (p) el.setAttribute('action', p); }
    });
  }

  rewriteAll();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', rewriteAll);
  }
  window.addEventListener('load', rewriteAll);

  // Capture clicks
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el !== document) {
      if (el.tagName === 'A') break;
      el = el.parentElement || el.parentNode;
    }
    if (!el || el.tagName !== 'A') return;
    var href = el.getAttribute('href') || el.getAttribute('data-href');
    if (!href) return;
    var p = toProxy(href);
    if (!p) return;
    el.setAttribute('href', p);
    e.preventDefault();
    e.stopPropagation();
    if (el.target === '_blank' || e.metaKey || e.ctrlKey) {
      window.open(p, '_blank');
    } else {
      location.href = p;
    }
  }, true);

  // Intercept forms
  document.addEventListener('submit', function(e) {
    var f = e.target;
    if (f && f.tagName === 'FORM') {
      var v = f.getAttribute('action') || '';
      var p = toProxy(v);
      if (p) f.setAttribute('action', p);
    }
  }, true);

  // Patch location.href
  try {
    var lp = Object.getPrototypeOf(location);
    var od = Object.getOwnPropertyDescriptor(lp, 'href');
    if (od && od.set) {
      Object.defineProperty(lp, 'href', {
        get: od.get,
        set: function(v) { var p = toProxy(v); od.set.call(this, p || v); },
        configurable: true, enumerable: true
      });
    }
  } catch(e) {}

  // Patch window.open
  var oo = window.open;
  window.open = function(u, n, f) {
    if (u) { var p = toProxy(u); if (p) u = p; }
    return oo.call(window, u, n, f);
  };

  // Patch history
  var op = history.pushState, or = history.replaceState;
  history.pushState = function(s, t, u) {
    if (u) { var p = toProxy(u); if (p) u = p; }
    return op.call(history, s, t, u);
  };
  history.replaceState = function(s, t, u) {
    if (u) { var p = toProxy(u); if (p) u = p; }
    return or.call(history, s, t, u);
  };

  // Patch fetch/XHR
  var of = window.fetch;
  window.fetch = function(i, init) {
    if (typeof i === 'string') { var p = toProxy(i); if (p) i = p; }
    else if (i instanceof Request) { var p = toProxy(i.url); if (p) i = new Request(p, i); }
    return of.call(window, i, init);
  };

  var ox = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, u) {
    var p = toProxy(u);
    if (p) arguments[1] = p;
    return ox.apply(this, arguments);
  };

  // Watch for dynamic links
  var mo = new MutationObserver(function(muts) {
    muts.forEach(function(m) {
      if (m.type === 'childList') {
        m.addedNodes.forEach(function(n) {
          if (n.nodeType !== 1) return;
          if (n.tagName === 'A') {
            ['href','data-href','data-link'].forEach(function(a){
              var v = n.getAttribute(a);
              if (v) { var p = toProxy(v); if (p) n.setAttribute(a, p); }
            });
          }
          if (n.querySelectorAll) {
            n.querySelectorAll('a[href],[data-href]').forEach(function(el) {
              ['href','data-href','data-link'].forEach(function(a){
                var v = el.getAttribute(a);
                if (v) { var p = toProxy(v); if (p) el.setAttribute(a, p); }
              });
            });
          }
        });
      }
    });
  });

  if (document.documentElement) {
    mo.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['href', 'action', 'data-href', 'data-link']
    });
  }
})();
</script>`;

let urlCache = new Map();

async function handleRequest(request) {
  const url = new URL(request.url);
  const workerOrigin = url.origin;

  let targetPath = url.pathname.substring(1);
  if (!targetPath) {
    return new Response('Usage: /example.com or /https://example.com', {
      status: 200, headers: { 'Content-Type': 'text/plain' }
    });
  }

  // ✅ AUTO-APPLY HTTPS: Always use https unless explicitly http://
  let targetURL;
  try {
    if (targetPath.startsWith('http://')) {
      targetURL = new URL(targetPath);
    } else if (targetPath.startsWith('https://')) {
      targetURL = new URL(targetPath);
    } else {
      // Default to HTTPS
      targetURL = new URL('https://' + targetPath);
    }
  } catch (e) {
    return new Response(`Invalid URL: ${targetPath}`, { status: 400 });
  }
  targetURL.search = url.search;

  if (isAdRequest(targetURL.href)) return new Response('', { status: 204 });

  // ✅ COMPREHENSIVE HEADER SPOOFING
  const headers = new Headers(request.headers);
  headers.set('Host', targetURL.host);
  headers.set('Origin', targetURL.origin);
  
  // ✅ FIX: Set referer to the ACTUAL referrer, not the target URL
  // This prevents referer mismatch that breaks many sites
  const referer = request.headers.get('Referer');
  if (referer) {
    try {
      const refURL = new URL(referer);
      // If referer is from our proxy, extract the upstream referer
      if (refURL.origin === workerOrigin) {
        const refPath = refURL.pathname.substring(1);
        const refSeg = refPath.split('/')[0];
        if (refSeg && refSeg.includes('.')) {
          headers.set('Referer', 'https://' + refSeg + '/');
        } else {
          headers.set('Referer', targetURL.origin + '/');
        }
      } else {
        headers.set('Referer', referer);
      }
    } catch(e) {
      headers.set('Referer', targetURL.origin + '/');
    }
  } else {
    // No referer - set to target origin (looks like direct navigation)
    headers.set('Referer', targetURL.origin + '/');
  }

  // ✅ Add proper browser headers that sites expect
  if (!headers.has('Accept-Language')) {
    headers.set('Accept-Language', 'en-US,en;q=0.9');
  }
  if (!headers.has('Accept-Encoding')) {
    headers.set('Accept-Encoding', 'gzip, deflate, br');
  }
  if (!headers.has('Sec-Fetch-Site')) {
    headers.set('Sec-Fetch-Site', 'same-origin');
  }
  if (!headers.has('Sec-Fetch-Mode')) {
    headers.set('Sec-Fetch-Mode', 'navigate');
  }
  if (!headers.has('Sec-Fetch-Dest')) {
    headers.set('Sec-Fetch-Dest', 'document');
  }
  if (!headers.has('Upgrade-Insecure-Requests')) {
    headers.set('Upgrade-Insecure-Requests', '1');
  }

  // Remove Cloudflare-specific headers
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ray');
  headers.delete('x-forwarded-for');
  headers.delete('x-forwarded-proto');
  headers.delete('x-real-ip');

  // ✅ Use a more common User-Agent
  if (!headers.has('User-Agent') || headers.get('User-Agent').includes('Cloudflare')) {
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  }

  let response;
  try {
    response = await fetch(new Request(targetURL.href, {
      method: request.method, headers, body: request.body, redirect: 'manual'
    }));
  } catch (err) {
    return new Response(`Proxy Error: ${err.message}`, { status: 502 });
  }

  // Handle redirects
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const loc = response.headers.get('Location');
    if (loc) {
      urlCache.clear();
      const rewritten = rewriteUrl(loc, targetURL, workerOrigin);
      if (rewritten && rewritten.startsWith(workerOrigin + '/')) {
        return Response.redirect(rewritten, response.status);
      }
      // For external redirects, follow them but rewrite
      return Response.redirect(rewriteUrl(loc, targetURL, workerOrigin), response.status);
    }
  }

  // ✅ STRIP ALL SECURITY HEADERS for maximum compatibility
  const respHeaders = new Headers(response.headers);
  respHeaders.delete('Content-Security-Policy');
  respHeaders.delete('Content-Security-Policy-Report-Only');
  respHeaders.delete('X-Content-Security-Policy');
  respHeaders.delete('X-Frame-Options');
  respHeaders.delete('Frame-Options');
  respHeaders.delete('Strict-Transport-Security');
  respHeaders.delete('Cross-Origin-Opener-Policy');
  respHeaders.delete('Cross-Origin-Embedder-Policy');
  respHeaders.delete('Cross-Origin-Resource-Policy');
  respHeaders.delete('X-XSS-Protection');
  respHeaders.delete('X-Content-Type-Options');
  respHeaders.delete('Referrer-Policy');
  respHeaders.delete('Permissions-Policy');
  respHeaders.delete('Refresh');
  
  // ✅ Allow everything
  respHeaders.set('Access-Control-Allow-Origin', '*');
  respHeaders.set('Access-Control-Allow-Methods', '*');
  respHeaders.set('Access-Control-Allow-Headers', '*');
  respHeaders.set('Access-Control-Allow-Credentials', 'true');

  // ✅ Fix cookies aggressively
  const setCookies = response.headers.getAll('Set-Cookie');
  respHeaders.delete('Set-Cookie');
  for (const cookie of setCookies) {
    let fixed = cookie
      .replace(/Path=([^;]+)/gi, (_, p) => `Path=/${targetURL.host}${p.startsWith('/') ? '' : '/'}${p}`)
      .replace(/Domain=[^;]+;?\s*/gi, '')
      .replace(/Secure;?\s*/gi, '')
      .replace(/HttpOnly;?\s*/gi, '');
    if (!fixed.includes('SameSite=')) fixed += '; SameSite=None';
    respHeaders.append('Set-Cookie', fixed);
  }

  const ct = respHeaders.get('Content-Type') || '';

  if (ct.includes('text/html')) {
    let html = await response.text();
    urlCache.clear();
    html = blockAdsInHTML(html);
    html = deepRewriteHtml(html, targetURL, workerOrigin);

    const interceptor = NAV_INTERCEPTOR
      .replace('WORKER_ORIGIN_PLACEHOLDER', workerOrigin)
      .replace('BASE_ORIGIN_PLACEHOLDER', targetURL.origin);

    if (html.match(RE_HEAD)) {
      html = html.replace(RE_HEAD, `$&${interceptor}`);
    } else {
      html = interceptor + html;
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
    if (c.includes('http://') || c.includes('https://') || c.includes('"/') || c.includes("'/")) {
      return o + rewriteJsUrls(c, baseUrl, workerOrigin) + cl;
    }
    return m;
  });
  
  return html;
}

function rewriteCssUrls(css, baseUrl, workerOrigin) {
  css = css.replace(RE_CSS_URL, (m, q, u) => {
    const rw = resolveAndProxy(u.trim(), baseUrl, workerOrigin);
    return rw !== null ? `url(${q}${rw}${q})` : m;
  });
  css = css.replace(RE_CSS_IMPORT, (m, q, u) => {
    const rw = resolveAndProxy(u, baseUrl, workerOrigin);
    return rw !== null ? `@import ${q}${rw}${q}` : m;
  });
  return css;
}

function rewriteJsUrls(js, baseUrl, workerOrigin) {
  js = js.replace(RE_JS_HTTP_URL, (m, q, u) => {
    const rw = resolveAndProxy(u, baseUrl, workerOrigin);
    return rw !== null ? `${q}${rw}${q}` : m;
  });
  js = js.replace(RE_JS_PROTO_REL, (m, q, u) => {
    const rw = resolveAndProxy(u, baseUrl, workerOrigin);
    return rw !== null ? `${q}${rw}${q}` : m;
  });
  return js;
}

function isAdRequest(url) {
  const l = url.toLowerCase();
  for (let i = 0; i < AD_PATTERNS.length; i++) {
    if (l.includes(AD_PATTERNS[i])) return true;
  }
  return false;
}
