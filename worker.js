addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// Pre-compiled regexes at module scope for V8 isolate reuse
const RE_SCRIPT_AD = /<script[^>]*(?:googlesyndication|adsbygoogle|doubleclick|google-analytics|googletagmanager)[^>]*>[\s\S]*?<\/script>/gi;
const RE_IFRAME_AD = /<iframe[^>]*(?:googlesyndication|doubleclick|google-analytics)[^>]*>[\s\S]*?<\/iframe>/gi;
const RE_INS_AD = /<ins[^>]*adsbygoogle[^>]*>[\s\S]*?<\/ins>/gi;
const RE_HTML_TAG = /<([a-zA-Z][a-zA-Z0-9]*)\s([^>]*?)>/gs;
const RE_ATTR = /([a-zA-Z_][\w\-\.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
const RE_CSS_URL = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
const RE_CSS_IMPORT = /@import\s+(['"])([^'"]+)\1/gi;
const RE_JS_HTTP_URL = /(["'])(https?:\/\/[^"'\\]+)\1/g;
const RE_JS_PROTO_REL = /(["'])(\/\/[^"'\\]+\.[^"'\\]+)\1/g;
const RE_META_REFRESH = /<meta([^>]*http-equiv\s*=\s*["']refresh["'][^>]*)>/gi;
const RE_META_CONTENT = /content\s*=\s*["']([^"']+)["']/i;
const RE_HEAD = /<head([^>]*)>/i;

const URL_ATTRS = new Set([
  'src', 'href', 'action', 'data-src', 'data-href', 'data-url',
  'poster', 'background', 'cite', 'formaction', 'icon', 'manifest',
  'dynsrc', 'lowsrc', 'srcset', 'data-bg', 'data-image',
  'data-lazy-src', 'data-original', 'data-actualsrc', 'data-thumb'
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

// ✅ FIXED: Plain string placeholders instead of ${} template expressions
const NAV_INTERCEPTOR = `<script id="__proxy_nav_interceptor__">
(function(){
  var WO = "WORKER_ORIGIN_PLACEHOLDER";
  var BO = "BASE_ORIGIN_PLACEHOLDER";

  function toProxy(url) {
    if (!url || typeof url !== 'string') return url;
    var t = url.trim();
    if (!t || t.startsWith('data:') || t.startsWith('blob:') ||
        t.startsWith('mailto:') || t.startsWith('tel:') ||
        t.startsWith('#') || t.startsWith('javascript:') ||
        t.startsWith('about:')) return url;
    try {
      var abs = new URL(t, BO + '/');
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return url;
      if (abs.origin === location.origin && abs.pathname.startsWith('/' + abs.host)) return url;
      return WO + '/' + abs.host + abs.pathname + abs.search;
    } catch(e) { return url; }
  }

  // 1. Intercept <a> clicks (capture phase beats site handlers)
  document.addEventListener('click', function(e) {
    var el = e.target.closest ? e.target.closest('a[href]') : null;
    if (!el) return;
    var href = el.getAttribute('href');
    if (!href) return;
    var proxied = toProxy(href);
    if (proxied !== href) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (el.target === '_blank') {
        window.open(proxied, '_blank');
      } else {
        location.href = proxied;
      }
    }
  }, true);

  // 2. Intercept form submissions
  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (form && form.tagName === 'FORM') {
      var action = form.getAttribute('action') || '';
      var proxied = toProxy(action);
      if (proxied !== action) {
        form.setAttribute('action', proxied);
      }
    }
  }, true);

  // 3. Monkey-patch window.location.href setter
  var origLocationDesc = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
  if (origLocationDesc && origLocationDesc.set) {
    Object.defineProperty(location, 'href', {
      get: function() { return origLocationDesc.get.call(location); },
      set: function(v) { origLocationDesc.set.call(location, toProxy(v)); },
      configurable: true
    });
  }

  // 4. Monkey-patch window.open
  var origOpen = window.open;
  window.open = function(u, n, f) {
    return origOpen.call(window, u ? toProxy(u) : u, n, f);
  };

  // 5. Monkey-patch history.pushState / replaceState (SPA router fix)
  var origPush = history.pushState;
  var origReplace = history.replaceState;
  history.pushState = function(s, t, u) {
    return origPush.call(history, s, t, u ? toProxy(u) : u);
  };
  history.replaceState = function(s, t, u) {
    return origReplace.call(history, s, t, u ? toProxy(u) : u);
  };

  // 6. Intercept fetch/XHR
  var origFetch = window.fetch;
  window.fetch = function(input, init) {
    if (typeof input === 'string') input = toProxy(input);
    else if (input instanceof Request) input = new Request(toProxy(input.url), input);
    return origFetch.call(window, input, init);
  };

  var origXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, u) {
    arguments[1] = toProxy(u);
    return origXHROpen.apply(this, arguments);
  };

  // 7. MutationObserver for dynamically injected links
  var obs = new MutationObserver(function(muts) {
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      if (m.type === 'childList') {
        m.addedNodes.forEach(function(n) {
          if (n.nodeType === 1) {
            if (n.tagName === 'A' && n.hasAttribute('href')) {
              var h = n.getAttribute('href');
              var p = toProxy(h);
              if (p !== h) n.setAttribute('href', p);
            }
            var links = n.querySelectorAll ? n.querySelectorAll('a[href]') : [];
            links.forEach(function(a) {
              var h = a.getAttribute('href');
              var p = toProxy(h);
              if (p !== h) a.setAttribute('href', p);
            });
          }
        });
      }
      if (m.type === 'attributes' && m.attributeName === 'href') {
        var el = m.target;
        if (el.tagName === 'A') {
          var h = el.getAttribute('href');
          var p = toProxy(h);
          if (p !== h) el.setAttribute('href', p);
        }
      }
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'action'] });
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

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const loc = response.headers.get('Location');
    if (loc) {
      urlCache.clear();
      return Response.redirect(rewriteUrl(loc, targetURL, workerOrigin), response.status);
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

    // ✅ Inject navigation interceptor with origins baked in via .replace()
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

// --- Optimized Rewriting Engine ---

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
      urlCache.set(cacheKey, null);
      return null;
    }
    const result = `${workerOrigin}/${absolute.host}${absolute.pathname}${absolute.search}`;
    urlCache.set(cacheKey, result);
    return result;
  } catch (e) {
    urlCache.set(cacheKey, null);
    return null;
  }
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

  html = html.replace(RE_HTML_TAG, (fullMatch, tagName, attrs) => {
    const rewrittenAttrs = attrs.replace(RE_ATTR, (attrMatch, attrName, dqVal, sqVal, uqVal) => {
      const lowerAttr = attrName.toLowerCase();
      const value = dqVal ?? sqVal ?? uqVal;
      const quote = dqVal !== undefined ? '"' : sqVal !== undefined ? "'" : '';

      if (lowerAttr === 'srcset') {
        const rewrittenSrcset = value.split(',').map(entry => {
          const parts = entry.trim().split(/\s+/);
          if (parts[0]) {
            const rw = resolveAndProxy(parts[0], baseUrl, workerOrigin);
            if (rw !== null) parts[0] = rw;
          }
          return parts.join(' ');
        }).join(', ');
        return `${attrName}=${quote}${rewrittenSrcset}${quote}`;
      }

      if (URL_ATTRS.has(lowerAttr)) {
        const rw = resolveAndProxy(value, baseUrl, workerOrigin);
        return rw !== null ? `${attrName}=${quote}${rw}${quote}` : attrMatch;
      }

      if (lowerAttr === 'style') {
        return `${attrName}=${quote}${rewriteCssUrls(value, baseUrl, workerOrigin)}${quote}`;
      }

      if (lowerAttr === 'content' && tagName.toLowerCase() === 'meta') {
        if (value.match(/^https?:\/\//i) || value.startsWith('//')) {
          const rw = resolveAndProxy(value, baseUrl, workerOrigin);
          return rw !== null ? `${attrName}=${quote}${rw}${quote}` : attrMatch;
        }
      }

      if (lowerAttr.startsWith('data-') && (value.startsWith('http://') || value.startsWith('https://'))) {
        const rw = resolveAndProxy(value, baseUrl, workerOrigin);
        return rw !== null ? `${attrName}=${quote}${rw}${quote}` : attrMatch;
      }

      return attrMatch;
    });
    return `<${tagName} ${rewrittenAttrs}>`;
  });

  html = html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, open, content, close) => {
    return open + rewriteCssUrls(content, baseUrl, workerOrigin) + close;
  });

  html = html.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, open, content, close) => {
    if (content.includes('http://') || content.includes('https://') || content.includes('"/') || content.includes("'/")) {
      return open + rewriteJsUrls(content, baseUrl, workerOrigin) + close;
    }
    return m;
  });

  html = html.replace(RE_META_REFRESH, (match, attrs) => {
    const contentMatch = attrs.match(RE_META_CONTENT);
    if (contentMatch) {
      const content = contentMatch[1];
      const urlPart = content.match(/;\s*url\s*=\s*(.+)/i);
      if (urlPart) {
        const rw = resolveAndProxy(urlPart[1], baseUrl, workerOrigin);
        if (rw !== null) {
          const newContent = content.replace(urlPart[1], rw);
          return `<meta${attrs.replace(contentMatch[0], `content="${newContent}"`)}>`;
        }
      }
    }
    return match;
  });

  return html;
}

function rewriteCssUrls(css, baseUrl, workerOrigin) {
  css = css.replace(RE_CSS_URL, (m, quote, urlVal) => {
    const rw = resolveAndProxy(urlVal.trim(), baseUrl, workerOrigin);
    return rw !== null ? `url(${quote}${rw}${quote})` : m;
  });
  css = css.replace(RE_CSS_IMPORT, (m, quote, urlVal) => {
    const rw = resolveAndProxy(urlVal, baseUrl, workerOrigin);
    return rw !== null ? `@import ${quote}${rw}${quote}` : m;
  });
  return css;
}

function rewriteJsUrls(js, baseUrl, workerOrigin) {
  js = js.replace(RE_JS_HTTP_URL, (m, quote, urlVal) => {
    const rw = resolveAndProxy(urlVal, baseUrl, workerOrigin);
    return rw !== null ? `${quote}${rw}${quote}` : m;
  });
  js = js.replace(RE_JS_PROTO_REL, (m, quote, urlVal) => {
    const rw = resolveAndProxy(urlVal, baseUrl, workerOrigin);
    return rw !== null ? `${quote}${rw}${quote}` : m;
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
