addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// Pre-compiled regexes at module scope
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

// ✅ FIXED NAV INTERCEPTOR - No double-path, proper redirect capture
const NAV_INTERCEPTOR = `<script id="__proxy_nav_interceptor__">
(function(){
  var WO = "WORKER_ORIGIN_PLACEHOLDER";
  var BO = "BASE_ORIGIN_PLACEHOLDER";
  var BH = "BASE_HOST_PLACEHOLDER";

  // Resolve any URL to its proxied form
  function toProxy(url) {
    if (!url || typeof url !== 'string') return null;
    var t = url.trim();
    if (!t) return null;
    // Skip non-navigable schemes
    if (/^(data:|blob:|mailto:|tel:|#|javascript:|about:)/i.test(t)) return null;

    try {
      var abs;
      // If it looks absolute or protocol-relative, resolve against base origin
      if (/^(https?:)?\/\//i.test(t)) {
        abs = new URL(t, BO + '/');
      } else {
        // Relative URL - resolve against CURRENT proxied location
        // This prevents double-host prefixing
        abs = new URL(t, location.href);
      }

      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return null;

      // Already proxied? Return as-is
      if (abs.origin === location.origin) {
        // Check if path already starts with /host/
        var pathParts = abs.pathname.split('/');
        if (pathParts[1] && pathParts[1].includes('.')) {
          return abs.href;
        }
      }

      return WO + '/' + abs.host + abs.pathname + abs.search + abs.hash;
    } catch(e) {
      return null;
    }
  }

  // 1. Capture-phase click handler on document (beats all site handlers)
  document.addEventListener('click', function(e) {
    // Walk up to find nearest <a> (works even with shadow DOM boundary crossing)
    var el = e.target;
    while (el && el !== document) {
      if (el.tagName === 'A' && el.hasAttribute('href')) break;
      el = el.parentElement || el.parentNode;
    }
    if (!el || el.tagName !== 'A') return;

    var href = el.getAttribute('href');
    if (!href) return;

    var proxied = toProxy(href);
    if (proxied && proxied !== href) {
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
      if (el.target === '_blank' || e.metaKey || e.ctrlKey) {
        window.open(proxied, '_blank');
      } else {
        history.pushState(null, '', proxied);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    }
  }, true);

  // 2. Form submission interception
  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (form && form.tagName === 'FORM') {
      var action = form.getAttribute('action') || '';
      var proxied = toProxy(action);
      if (proxied) form.setAttribute('action', proxied);
    }
  }, true);

  // 3. Monkey-patch Location.prototype.href (catches ALL location assignments)
  try {
    var locProto = Object.getPrototypeOf(location);
    var origHrefDesc = Object.getOwnPropertyDescriptor(locProto, 'href');
    if (origHrefDesc && origHrefDesc.set) {
      Object.defineProperty(locProto, 'href', {
        get: origHrefDesc.get,
        set: function(v) {
          var p = toProxy(v);
          origHrefDesc.set.call(this, p || v);
        },
        configurable: true,
        enumerable: true
      });
    }
  } catch(e) {}

  // 4. Monkey-patch window.open
  var origOpen = window.open;
  window.open = function(u, n, f) {
    var p = u ? toProxy(u) : null;
    return origOpen.call(window, p || u, n, f);
  };

  // 5. Monkey-patch history methods
  var origPush = history.pushState;
  var origReplace = history.replaceState;
  history.pushState = function(s, t, u) {
    var p = u ? toProxy(u) : null;
    return origPush.call(history, s, t, p || u);
  };
  history.replaceState = function(s, t, u) {
    var p = u ? toProxy(u) : null;
    return origReplace.call(history, s, t, p || u);
  };

  // 6. Intercept popstate (back/forward buttons)
  window.addEventListener('popstate', function() {
    // After popstate, check if current path escaped the proxy
    var parts = location.pathname.split('/');
    if (parts[1] && !parts[1].includes('.') && parts[1] !== '') {
      // Path doesn't start with a domain - we escaped, fix it
      var fixed = toProxy(location.pathname + location.search + location.hash);
      if (fixed) history.replaceState(null, '', fixed);
    }
  });

  // 7. Monkey-patch fetch/XHR
  var origFetch = window.fetch;
  window.fetch = function(input, init) {
    if (typeof input === 'string') {
      var p = toProxy(input);
      if (p) input = p;
    } else if (input instanceof Request) {
      var p = toProxy(input.url);
      if (p) input = new Request(p, input);
    }
    return origFetch.call(window, input, init);
  };

  var origXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, u) {
    var p = toProxy(u);
    arguments[1] = p || u;
    return origXHROpen.apply(this, arguments);
  };

  // 8. MutationObserver for dynamic content
  var obs = new MutationObserver(function(muts) {
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      if (m.type === 'childList') {
        m.addedNodes.forEach(function(n) {
          if (n.nodeType !== 1) return;
          // Rewrite links
          if (n.tagName === 'A' && n.hasAttribute('href')) {
            var h = n.getAttribute('href');
            var p = toProxy(h);
            if (p) n.setAttribute('href', p);
          }
          // Rewrite child links
          if (n.querySelectorAll) {
            n.querySelectorAll('a[href]').forEach(function(a) {
              var h = a.getAttribute('href');
              var p = toProxy(h);
              if (p) a.setAttribute('href', p);
            });
          }
        });
      }
      if (m.type === 'attributes') {
        var el = m.target;
        var attr = m.attributeName;
        if ((attr === 'href' || attr === 'action' || attr === 'src') && el.nodeType === 1) {
          var val = el.getAttribute(attr);
          var p = toProxy(val);
          if (p && p !== val) el.setAttribute(attr, p);
        }
      }
    }
  });

  if (document.documentElement) {
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'action', 'src']
    });
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      obs.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['href', 'action', 'src']
      });
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

    // ✅ Inject with all three placeholders replaced
    const interceptor = NAV_INTERCEPTOR
      .replace('WORKER_ORIGIN_PLACEHOLDER', workerOrigin)
      .replace('BASE_ORIGIN_PLACEHOLDER', targetURL.origin)
      .replace('BASE_HOST_PLACEHOLDER', targetURL.host);

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
