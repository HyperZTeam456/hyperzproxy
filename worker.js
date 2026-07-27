addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// Common ad domains and patterns to block
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

function isAdRequest(url) {
  const urlLower = url.toLowerCase();
  return AD_PATTERNS.some(pattern => urlLower.includes(pattern));
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const workerOrigin = url.origin;

  // Serve the main HTML page (cloaked as google classroom)
  if (url.pathname === '/' || url.pathname === '') {
    return new Response(getMainHTML(workerOrigin), {
      headers: {
        'Content-Type': 'text/html',
        'Permissions-Policy': 'accelerometer=*, gyroscope=*, camera=*, microphone=*, geolocation=*, hid=*, midi=*, clipboard-read=*, clipboard-write=*, xr-spatial-tracking=*, gamepad=*'
      }
    });
  }

  // Serve manifest.json for PWA
  if (url.pathname === '/manifest.json') {
    return new Response(getManifest(), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Serve service worker for PWA
  if (url.pathname === '/sw.js') {
    return new Response(getServiceWorker(), {
      headers: {
        'Content-Type': 'application/javascript',
        'Service-Worker-Allowed': '/'
      }
    });
  }

  // Serve favicon - classroom icon for cloaking
  if (url.pathname === '/favicon.png' || url.pathname === '/favicon.ico') {
    try {
      const iconRes = await fetch('https://ssl.gstatic.com/classroom/favicon.png');
      const iconHeaders = new Headers(iconRes.headers);
      iconHeaders.set('Cache-Control', 'public, max-age=86400');
      return new Response(iconRes.body, {
        status: iconRes.status,
        headers: iconHeaders
      });
    } catch (e) {
      return new Response('', { status: 404 });
    }
  }

  // ✅ UNIVERSAL PROXY: Extract target URL from path
  // Format: /example.com/path or /https://example.com/path
  let targetPath = url.pathname.substring(1);
  if (!targetPath) {
    return new Response('No target specified', { status: 400 });
  }

  let targetURL;
  try {
    if (targetPath.startsWith('http://') || targetPath.startsWith('https://')) {
      targetURL = new URL(targetPath);
    } else {
      targetURL = new URL('https://' + targetPath);
    }
  } catch (e) {
    return new Response(`Invalid URL: ${targetPath}`, { status: 400 });
  }
  targetURL.search = url.search;

  // Block ad requests
  if (isAdRequest(targetURL.href)) {
    return new Response('', { status: 204 });
  }

  // Build upstream request with proper header spoofing
  const headers = new Headers(request.headers);
  headers.set('Host', targetURL.host);
  headers.set('Origin', targetURL.origin);

  // Smart referer handling
  const referer = request.headers.get('Referer');
  if (referer) {
    try {
      const refURL = new URL(referer);
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
    headers.set('Referer', targetURL.origin + '/');
  }

  // Add proper browser headers
  if (!headers.has('Accept-Language')) headers.set('Accept-Language', 'en-US,en;q=0.9');
  if (!headers.has('Accept-Encoding')) headers.set('Accept-Encoding', 'gzip, deflate, br');
  if (!headers.has('Sec-Fetch-Site')) headers.set('Sec-Fetch-Site', 'same-origin');
  if (!headers.has('Sec-Fetch-Mode')) headers.set('Sec-Fetch-Mode', 'navigate');
  if (!headers.has('Sec-Fetch-Dest')) headers.set('Sec-Fetch-Dest', 'document');
  if (!headers.has('Upgrade-Insecure-Requests')) headers.set('Upgrade-Insecure-Requests', '1');

  // Remove cloudflare headers
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ray');
  headers.delete('x-forwarded-for');
  headers.delete('x-forwarded-proto');
  headers.delete('x-real-ip');

  if (!headers.has('User-Agent') || headers.get('User-Agent').includes('Cloudflare')) {
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  }

  let response;
  try {
    response = await fetch(new Request(targetURL.href, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'manual'
    }));
  } catch (error) {
    return new Response('Failed to fetch resource: ' + error.message, { status: 502 });
  }

  // Handle redirects - rewrite to stay in proxy
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const loc = response.headers.get('Location');
    if (loc) {
      try {
        const absLoc = new URL(loc, targetURL.href);
        const rewritten = `${workerOrigin}/${absLoc.host}${absLoc.pathname}${absLoc.search}`;
        return Response.redirect(rewritten, response.status);
      } catch (e) {
        return new Response('Redirect failed', { status: 502 });
      }
    }
  }

  // Strip security headers for compatibility
  const newHeaders = new Headers(response.headers);
  newHeaders.delete('Content-Security-Policy');
  newHeaders.delete('Content-Security-Policy-Report-Only');
  newHeaders.delete('X-Frame-Options');
  newHeaders.delete('Frame-Options');
  newHeaders.delete('Strict-Transport-Security');
  newHeaders.delete('Cross-Origin-Opener-Policy');
  newHeaders.delete('Cross-Origin-Embedder-Policy');
  newHeaders.delete('Cross-Origin-Resource-Policy');
  newHeaders.delete('X-XSS-Protection');
  newHeaders.delete('X-Content-Type-Options');
  newHeaders.delete('Referrer-Policy');
  newHeaders.delete('Permissions-Policy');

  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Access-Control-Allow-Methods', '*');
  newHeaders.set('Access-Control-Allow-Headers', '*');
  newHeaders.set('Access-Control-Allow-Credentials', 'true');

  // Fix cookies
  const setCookies = response.headers.getAll('Set-Cookie');
  newHeaders.delete('Set-Cookie');
  for (const cookie of setCookies) {
    let fixed = cookie
      .replace(/Path=([^;]+)/gi, (_, p) => `Path=/${targetURL.host}${p.startsWith('/') ? '' : '/'}${p}`)
      .replace(/Domain=[^;]+;?\s*/gi, '')
      .replace(/Secure;?\s*/gi, '');
    if (!fixed.includes('SameSite=')) fixed += '; SameSite=None';
    newHeaders.append('Set-Cookie', fixed);
  }

  const contentType = response.headers.get('Content-Type') || '';

  if (contentType.includes('text/html')) {
    let html = await response.text();

    // Remove ad-related elements
    html = blockAdsInHTML(html);

    // Inject navigation lockdown script + url rewriter
    const injectionCode = getInjectionCode(workerOrigin, targetURL.origin);

    if (html.includes('</head>')) {
      html = html.replace('</head>', injectionCode + '</head>');
    } else {
      html = injectionCode + html;
    }

    // Rewrite URLs in HTML
    html = rewriteHtmlUrls(html, targetURL, workerOrigin);

    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }

  if (contentType.includes('text/css')) {
    let css = await response.text();
    css = rewriteCssUrls(css, targetURL, workerOrigin);
    return new Response(css, { status: response.status, headers: newHeaders });
  }

  if (contentType.includes('javascript') || contentType.includes('application/json')) {
    let body = await response.text();
    body = rewriteJsUrls(body, targetURL, workerOrigin);
    return new Response(body, { status: response.status, headers: newHeaders });
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

function blockAdsInHTML(html) {
  html = html.replace(/<script[^>]*googlesyndication[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<script[^>]*adsbygoogle[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<script[^>]*google-analytics[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<script[^>]*googletagmanager[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<script[^>]*doubleclick[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<iframe[^>]*googlesyndication[^>]*>[\s\S]*?<\/iframe>/gi, '');
  html = html.replace(/<iframe[^>]*doubleclick[^>]*>[\s\S]*?<\/iframe>/gi, '');
  html = html.replace(/<ins[^>]*adsbygoogle[^>]*>[\s\S]*?<\/ins>/gi, '');
  html = html.replace(/<div[^>]*id="google_ads[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  return html;
}

function rewriteHtmlUrls(html, baseUrl, workerOrigin) {
  // Rewrite src, href, action, etc.
  html = html.replace(/(src|href|action|data-src|poster)\s*=\s*["']([^"']+)["']/gi, (match, attr, val) => {
    try {
      const abs = new URL(val, baseUrl.href);
      if (abs.protocol === 'http:' || abs.protocol === 'https:') {
        return `${attr}="${workerOrigin}/${abs.host}${abs.pathname}${abs.search}"`;
      }
    } catch (e) {}
    return match;
  });
  // Rewrite url() in inline styles
  html = html.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi, (match, url) => {
    try {
      const abs = new URL(url, baseUrl.href);
      if (abs.protocol === 'http:' || abs.protocol === 'https:') {
        return `url('${workerOrigin}/${abs.host}${abs.pathname}${abs.search}')`;
      }
    } catch (e) {}
    return match;
  });
  return html;
}

function rewriteCssUrls(css, baseUrl, workerOrigin) {
  return css.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi, (match, url) => {
    try {
      const abs = new URL(url, baseUrl.href);
      if (abs.protocol === 'http:' || abs.protocol === 'https:') {
        return `url('${workerOrigin}/${abs.host}${abs.pathname}${abs.search}')`;
      }
    } catch (e) {}
    return match;
  });
}

function rewriteJsUrls(js, baseUrl, workerOrigin) {
  js = js.replace(/(["'])(https?:\/\/[^"'\\]+)\1/g, (match, quote, url) => {
    try {
      const abs = new URL(url);
      return `${quote}${workerOrigin}/${abs.host}${abs.pathname}${abs.search}${quote}`;
    } catch (e) {}
    return match;
  });
  return js;
}

function getInjectionCode(workerOrigin, baseOrigin) {
  return `<style id="cm-ad-blocker-css">
  .a-div-horizontal, .a-div-vertical, .a-div-placeholder, .a-div-box {
    display: none !important; visibility: hidden !important; opacity: 0 !important;
    pointer-events: none !important; position: absolute !important;
    width: 0 !important; height: 0 !important; overflow: hidden !important;
  }
</style>
<script id="cm-fix-js">
(function(){
  var WO = "${workerOrigin}";
  var BO = "${baseOrigin}";

  function toProxy(url) {
    if (!url || typeof url !== 'string') return null;
    var t = url.trim();
    if (!t) return null;
    if (/^(data:|blob:|mailto:|tel:|#|javascript:|about:)/i.test(t)) return null;
    try {
      var abs = new URL(t, location.href);
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return null;
      if (abs.origin === WO) return abs.href;
      return WO + '/' + abs.host + abs.pathname + abs.search + abs.hash;
    } catch(e) { return null; }
  }

  // Block ad network requests at runtime
  var originalFetch = window.fetch;
  window.fetch = function() {
    var url = arguments[0];
    if (typeof url === 'string' && isAdUrl(url)) return Promise.reject(new Error('Ad blocked'));
    return originalFetch.apply(this, arguments);
  };

  var originalXHR = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function(method, url) {
    if (isAdUrl(url)) return;
    return originalXHR.apply(this, arguments);
  };

  function isAdUrl(url) {
    var adPatterns = [
      'googlesyndication', 'doubleclick', 'googleadservices',
      'google-analytics', 'googletagmanager', 'googletagservices',
      '/ads/', '/ad/', '/advert', 'adsense', 'analytics',
      'facebook.com/ads', 'twitter.com/ads', 'adnxs.com',
      'advertising.com', 'outbrain.com', 'taboola.com'
    ];
    return adPatterns.some(function(p) { return url.toLowerCase().indexOf(p) > -1; });
  }

  function removeAds() {
    var selectors = [
      'iframe[src*="googlesyndication"]', 'iframe[src*="doubleclick"]',
      'iframe[src*="google-analytics"]', 'div[id*="google_ads"]',
      'div[class*="adsbygoogle"]', 'ins.adsbygoogle',
      '[data-ad-slot]', '[data-ad-client]',
      '.a-div-horizontal', '.a-div-vertical', '.a-div-placeholder', '.a-div-box'
    ];
    selectors.forEach(function(sel) {
      document.querySelectorAll(sel).forEach(function(el) {
        try { el.remove(); } catch(e) { el.style.display = 'none'; }
      });
    });
  }

  removeAds();
  setInterval(removeAds, 200);

  var observer = new MutationObserver(removeAds);
  function startObserver() {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      setTimeout(startObserver, 10);
    }
  }
  startObserver();

  // 🔒 LOCK DOWN NAVIGATION - keep everything in proxy
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el !== document) {
      if (el.tagName === 'A') break;
      el = el.parentElement || el.parentNode;
    }
    if (!el || el.tagName !== 'A') return;
    var href = el.getAttribute('href');
    if (!href) return;
    var p = toProxy(href);
    if (!p) return;
    e.preventDefault();
    e.stopPropagation();
    if (el.target === '_blank' || e.metaKey || e.ctrlKey) {
      // Send to parent to load in same proxy frame
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({type: 'LOAD_URL', url: p}, '*');
      } else {
        window.open(p, '_blank');
      }
    } else {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({type: 'LOAD_URL', url: p}, '*');
      } else {
        location.href = p;
      }
    }
  }, true);

  document.addEventListener('submit', function(e) {
    var f = e.target;
    if (f && f.tagName === 'FORM') {
      var action = f.getAttribute('action') || '';
      var p = toProxy(action);
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
        set: function(v) {
          var p = toProxy(v);
          if (p) {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({type: 'LOAD_URL', url: p}, '*');
            } else {
              od.set.call(this, p);
            }
          }
        },
        configurable: true, enumerable: true
      });
    }
  } catch(e) {}

  // Patch window.open
  var origOpen = window.open;
  window.open = function(u, n, f) {
    if (u) {
      var p = toProxy(u);
      if (p) {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({type: 'LOAD_URL', url: p}, '*');
          return null;
        }
        u = p;
      }
    }
    return origOpen.call(window, u, n, f);
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

  // Intercept fullscreen requests from games
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'REQUEST_FULLSCREEN') {
      var gameWrapper = document.querySelector('#gameWrapper') || document.documentElement;
      if (gameWrapper.requestFullscreen) gameWrapper.requestFullscreen();
      else if (gameWrapper.webkitRequestFullscreen) gameWrapper.webkitRequestFullscreen();
    }
  });

  console.log("[HyperZ Proxy] Initialized with ad blocking and nav lockdown");
})();
</script>`;
}

function getMainHTML(workerOrigin) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Home - Classroom</title>
    <meta name="description" content="Google Classroom">

    <!-- PWA Meta Tags -->
    <meta name="theme-color" content="#2d2d2d">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Classroom">
    <link rel="manifest" href="/manifest.json">
    <link rel="apple-touch-icon" href="/favicon.png">
    <link rel="icon" id="favicon" type="image/png" href="/favicon.png">

    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: #0d1117;
            color: #c9d1d9;
            overflow: hidden;
        }
        #container { width: 100vw; height: 100vh; display: flex; flex-direction: column; }
        #frame-container { flex: 1; width: 100%; height: 100%; background: white; position: relative; }

        /* Floating button dock */
        #btn-dock {
            position: fixed; bottom: 18px; left: 18px;
            display: flex; flex-direction: column; gap: 10px;
            z-index: 999999; transition: opacity 0.3s;
        }
        #btn-dock.hidden { opacity: 0; pointer-events: none; }
        .dock-btn {
            width: 44px; height: 44px; border-radius: 50%; border: none;
            background: rgba(45, 45, 45, 0.85); backdrop-filter: blur(6px);
            color: #e0e0e0; cursor: pointer; display: flex;
            align-items: center; justify-content: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.4);
            transition: background 0.2s, transform 0.15s;
        }
        .dock-btn:hover { background: rgba(74, 74, 74, 0.95); }
        .dock-btn:active { transform: scale(0.93); }
        #home-btn { display: none; }

        /* URL bar */
        #url-bar {
            position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
            z-index: 999999; display: flex; gap: 5px;
            background: rgba(22, 27, 34, 0.95); padding: 5px; border-radius: 25px;
            backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1);
        }
        #url-input {
            background: transparent; border: none; outline: none;
            color: white; padding: 8px 15px; font-size: 14px;
            width: 300px; border-radius: 20px;
        }
        #url-go {
            background: #58a6ff; color: white; border: none;
            padding: 8px 20px; border-radius: 20px; cursor: pointer;
            font-weight: 600;
        }
        #url-go:hover { background: #4293e6; }
    </style>
</head>
<body>
    <div id="container">
        <div id="frame-container"></div>
    </div>

    <!-- URL Bar -->
    <div id="url-bar">
        <input type="text" id="url-input" placeholder="Enter URL (e.g. example.com)" autocomplete="off" />
        <button id="url-go">Go</button>
    </div>

    <!-- Floating controls -->
    <div id="btn-dock">
        <button class="dock-btn" id="home-btn" onclick="goHome()" title="Home">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6"/>
            </svg>
        </button>
        <button class="dock-btn" id="fullscreen-btn" onclick="enterFullscreen()" title="Fullscreen">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
            </svg>
        </button>
    </div>

    <script>
        var frameContainer = document.getElementById('frame-container');
        var homeBtn = document.getElementById('home-btn');
        var urlInput = document.getElementById('url-input');
        var urlGo = document.getElementById('url-go');
        var SHADOW_LAYERS = 4;
        var currentIframe = null;
        var workerOrigin = window.location.origin;

        function generateRandomId() {
            return 'x' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        }

        function createMultiLayerShadowFrame(url) {
            frameContainer.innerHTML = '';

            var currentHost = document.createElement('div');
            currentHost.style.width = '100%';
            currentHost.style.height = '100%';
            currentHost.style.margin = '0';
            currentHost.style.padding = '0';
            currentHost.style.border = 'none';
            currentHost.style.display = 'block';
            currentHost.style.overflow = 'hidden';
            currentHost.setAttribute('data-id', generateRandomId());
            currentHost.setAttribute('data-component', 'container');

            frameContainer.appendChild(currentHost);

            for (var i = 0; i < SHADOW_LAYERS; i++) {
                var shadowRoot = currentHost.attachShadow({ mode: 'closed' });

                if (i < SHADOW_LAYERS - 1) {
                    var nextHost = document.createElement('div');
                    nextHost.style.width = '100%';
                    nextHost.style.height = '100%';
                    nextHost.style.margin = '0';
                    nextHost.style.padding = '0';
                    nextHost.style.border = 'none';
                    nextHost.style.display = 'block';
                    nextHost.style.overflow = 'hidden';
                    nextHost.setAttribute('data-layer', i.toString());
                    nextHost.setAttribute('data-id', generateRandomId());

                    shadowRoot.appendChild(nextHost);
                    currentHost = nextHost;
                } else {
                    var iframe = document.createElement('iframe');
                    iframe.style.width = '100%';
                    iframe.style.height = '100%';
                    iframe.style.border = 'none';
                    iframe.style.margin = '0';
                    iframe.style.padding = '0';
                    iframe.style.display = 'block';
                    iframe.style.overflow = 'hidden';
                    iframe.setAttribute('allow', 'accelerometer; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; clipboard-read; clipboard-write; xr-spatial-tracking; gamepad; fullscreen; picture-in-picture');
                    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
                    iframe.setAttribute('data-frame-id', generateRandomId());
                    iframe.src = url;

                    shadowRoot.appendChild(iframe);
                    currentIframe = iframe;

                    iframe.addEventListener('load', function() {
                        setTimeout(function() {
                            try { iframe.contentWindow.focus(); } catch(e) {}
                        }, 100);
                    });
                }
            }
        }

        function loadUrl(url) {
            if (!url) return;
            // Add https:// if no protocol
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            try {
                var u = new URL(url);
                var proxyUrl = workerOrigin + '/' + u.host + u.pathname + u.search;
                createMultiLayerShadowFrame(proxyUrl);
                homeBtn.style.display = 'flex';
                urlInput.value = u.host + u.pathname;
            } catch(e) {
                alert('Invalid URL');
            }
        }

        function goHome() {
            urlInput.value = '';
            homeBtn.style.display = 'none';
            if (document.fullscreenElement) document.exitFullscreen();
            // Show landing or just clear
            frameContainer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;">Enter a URL above to start</div>';
        }

        function enterFullscreen() {
            if (currentIframe) {
                try {
                    currentIframe.contentWindow.postMessage({type: 'REQUEST_FULLSCREEN'}, '*');
                } catch(e) {
                    document.documentElement.requestFullscreen();
                }
            } else {
                document.documentElement.requestFullscreen();
            }
        }

        // Listen for navigation messages from iframe
        window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'LOAD_URL') {
                loadUrl(event.data.url);
            }
        });

        // URL bar handlers
        urlGo.addEventListener('click', function() {
            loadUrl(urlInput.value);
        });
        urlInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') loadUrl(urlInput.value);
        });

        // Load default site
        loadUrl('web.cloudmoonapp.com');

        // Register Service Worker for PWA
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js');
            });
        }
    </script>
</body>
</html>`;
}

function getManifest() {
  return JSON.stringify({
    "name": "Google Classroom",
    "short_name": "Classroom",
    "description": "Google Classroom is a free, secure, and easy-to-use blended learning platform.",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#0d1117",
    "theme_color": "#2d2d2d",
    "orientation": "any",
    "scope": "/",
    "icons": [
      {
        "src": "/favicon.png",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "any maskable"
      }
    ],
    "categories": ["education", "learning"]
  });
}

function getServiceWorker() {
  return `// HyperZ Proxy Service Worker
const CACHE_NAME = 'hyperz-proxy-v1';
const RUNTIME_CACHE = 'hyperz-runtime';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/', '/manifest.json', '/sw.js', '/favicon.png']);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});`;
}
