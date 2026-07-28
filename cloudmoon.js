// cloudmoon.js - Native CloudMoon Proxy Handler with Multi-Layer Shadow DOM Protection + Ad Blocking

const AD_PATTERNS = [
  'googlesyndication.com',
  'doubleclick.net',
  'googleadservices.com',
  'google-analytics.com',
  'googletagmanager.com',
  'googletagservices.com',
  'adservice.google.com',
  'pagead2.googlesyndication.com',
  'tpc.googlesyndication.com',
  'video-ad-stats.googlesyndication.com',
  'ads.google.com',
  'adssettings.google.com',
  'static.ads-twitter.com',
  'ads-api.twitter.com',
  'ads.facebook.com',
  'an.facebook.com',
  'adnxs.com',
  'advertising.com',
  'outbrain.com',
  'taboola.com',
  'criteo.com',
  'pubmatic.com',
  'rubiconproject.com',
  'openx.net',
  'adsafeprotected.com',
  'moatads.com',
  'scorecardresearch.com',
  '/ads/',
  '/ad/',
  '/advert/',
  '/advertisement/',
  '/adsense/',
  '/adserver/',
  '/analytics/',
  'prebid',
  'advertis',
  'banner',
  'popup'
];

function isAdRequest(url) {
  const urlLower = url.toLowerCase();
  return AD_PATTERNS.some(pattern => urlLower.includes(pattern));
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

// Serves the CloudMoon shell page (button dock + multi-layer shadow DOM iframe)
export function getCloudMoonShellHTML(workerOrigin) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CloudMoon</title>
    <meta name="description" content="Play games in your browser">
    <meta name="theme-color" content="#2d2d2d">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="CloudMoon">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #0d1117; color: #c9d1d9; overflow: hidden; }
        #container { width: 100vw; height: 100vh; display: flex; flex-direction: column; }
        #frame-container { flex: 1; width: 100%; height: 100%; background: white; position: relative; }
        #btn-dock { position: fixed; bottom: 18px; left: 18px; display: flex; flex-direction: column; gap: 10px; z-index: 9999; transition: opacity 0.3s; }
        #btn-dock.hidden { opacity: 0; pointer-events: none; }
        .dock-btn { width: 44px; height: 44px; border-radius: 50%; border: none; background: rgba(45, 45, 45, 0.85); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); color: #e0e0e0; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 10px rgba(0,0,0,0.4); transition: background 0.2s, transform 0.15s; }
        .dock-btn:hover { background: rgba(74, 74, 74, 0.95); }
        .dock-btn:active { transform: scale(0.93); }
        #home-btn { display: none; }
    </style>
</head>
<body>
    <div id="container"><div id="frame-container"></div></div>
    <div id="btn-dock">
        <button class="dock-btn" id="home-btn" onclick="goBack()" title="Home">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6"/></svg>
        </button>
        <button class="dock-btn" id="fullscreen-btn" onclick="enterFullscreen()" title="Fullscreen">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
        </button>
    </div>
    <script>
        const frameContainer = document.getElementById('frame-container');
        const homeBtn = document.getElementById('home-btn');
        const btnDock = document.getElementById('btn-dock');

        let isShowingGame = false;
        // IMPORTANT: this points at the /web.cloudmoonapp.com/ route, which cloudmoon.js handles natively
        let mainURL = '/web.cloudmoonapp.com/';
        let currentIframe = null;

        const SANDBOX_HOME = 'allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock allow-top-navigation-by-user-activation';
        const SANDBOX_GAME = 'allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock allow-top-navigation-by-user-activation';
        const ALLOW_PERMISSIONS = 'accelerometer; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; clipboard-read; clipboard-write; xr-spatial-tracking; gamepad';
        const SHADOW_LAYERS = 4;

        function generateRandomId() {
            return 'x' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        }

        function createMultiLayerShadowFrame(url, isGame = false) {
            frameContainer.innerHTML = '';

            let currentHost = document.createElement('div');
            currentHost.style.cssText = 'width:100%;height:100%;margin:0;padding:0;border:none;display:block;overflow:hidden;';
            currentHost.setAttribute('data-id', generateRandomId());
            currentHost.setAttribute('data-component', 'container');
            frameContainer.appendChild(currentHost);

            for (let i = 0; i < SHADOW_LAYERS; i++) {
                const shadowRoot = currentHost.attachShadow({ mode: 'closed' });

                if (i < SHADOW_LAYERS - 1) {
                    const nextHost = document.createElement('div');
                    nextHost.style.cssText = 'width:100%;height:100%;margin:0;padding:0;border:none;display:block;overflow:hidden;';
                    nextHost.setAttribute('data-layer', i.toString());
                    nextHost.setAttribute('data-id', generateRandomId());
                    shadowRoot.appendChild(nextHost);
                    currentHost = nextHost;
                    console.log(\`Shadow Layer \${i + 1} created\`);
                } else {
                    const iframe = document.createElement('iframe');
                    iframe.style.cssText = 'width:100%;height:100%;border:none;margin:0;padding:0;display:block;overflow:hidden;';
                    const sandboxAttr = isGame ? SANDBOX_GAME : SANDBOX_HOME;
                    iframe.setAttribute('sandbox', sandboxAttr);
                    iframe.setAttribute('allow', ALLOW_PERMISSIONS);
                    iframe.setAttribute('title', isGame ? 'Game Preview' : 'CloudMoon Preview');
                    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
                    iframe.setAttribute('importance', 'high');
                    iframe.setAttribute('loading', 'eager');
                    iframe.setAttribute('data-frame-id', generateRandomId());
                    iframe.setAttribute('data-secure', 'true');

                    iframe.src = url;
                    shadowRoot.appendChild(iframe);
                    currentIframe = iframe;

                    iframe.addEventListener('load', () => { focusIframe(); });
                    iframe.addEventListener('error', (e) => { console.error('Iframe error:', e); });

                    console.log(\`Final Shadow Layer \${SHADOW_LAYERS} with iframe created\`);
                }
            }

            console.log(\`\${SHADOW_LAYERS}-Layer Shadow DOM Protection Active\`);
        }

        function focusIframe() {
            setTimeout(() => {
                if (currentIframe) {
                    currentIframe.focus();
                    try { currentIframe.contentWindow.focus(); } catch (e) {}
                }
            }, 100);
        }

        createMultiLayerShadowFrame(mainURL, false);

        document.addEventListener('click', (e) => {
            if (currentIframe && e.target !== currentIframe) focusIframe();
        });

        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'LOAD_GAME') {
                console.log('Game URL received:', event.data.url);
                loadGame(event.data.url);
            }
            if (event.data && event.data.type === 'REQUEST_FULLSCREEN') {
                enterFullscreen();
            }
        });

        function loadGame(url) {
            let fixedURL = url;
            const workerDomain = window.location.origin;

            if (url.includes(workerDomain)) {
                fixedURL = url;
                console.log('Game URL already on worker domain, using directly');
            } else if (url.includes('web.cloudmoonapp.com')) {
                // Route back through the native CloudMoon path so it uses proxyCloudMoon, not the universal proxy
                const u = new URL(url);
                fixedURL = workerDomain + '/web.cloudmoonapp.com' + u.pathname + u.search;
                console.log('CloudMoon game URL, routed through native handler');
            } else if (url.includes('://')) {
                fixedURL = workerDomain + '/proxy/' + encodeURIComponent(url);
                console.log('External game URL, proxying through universal proxy');
            } else if (url.startsWith('/')) {
                fixedURL = url;
                console.log('Relative game URL, using as-is');
            }

            console.log('Final game URL:', fixedURL);
            createMultiLayerShadowFrame(fixedURL, true);
            isShowingGame = true;
            homeBtn.style.display = 'flex';
        }

        function goBack() {
            createMultiLayerShadowFrame(mainURL, false);
            isShowingGame = false;
            homeBtn.style.display = 'none';
            if (document.fullscreenElement) document.exitFullscreen();
        }

        function enterFullscreen() {
            if (currentIframe) {
                try {
                    currentIframe.contentWindow.postMessage({type: 'REQUEST_FULLSCREEN'}, '*');
                    console.log('Sent fullscreen request to game container');
                } catch (e) {
                    console.log('Cannot send message to iframe (cross-origin), using fallback');
                    document.documentElement.requestFullscreen();
                }
            } else {
                document.documentElement.requestFullscreen();
            }
            btnDock.classList.add('hidden');
        }

        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) btnDock.classList.remove('hidden');
        });

        console.log('CloudMoon Native Proxy Active with Ad Blocking');
        console.log(\`Multi-Layer Shadow DOM Protection: \${SHADOW_LAYERS} Layers\`);
    </script>
</body>
</html>`;
}

// Main native CloudMoon proxy handler.
// `request` is the incoming Request. `routePrefix` is the pathname prefix used to
// dispatch to this file (e.g. '/web.cloudmoonapp.com') — it gets stripped before
// the real CloudMoon target URL is built, which is the fix for the whitescreen bug
// (previously the prefix was left in and got glued onto the target host).
export async function handleCloudMoon(request, routePrefix) {
  const url = new URL(request.url);

  // Serve the shell (button dock + shadow DOM) on the bare route
  if (url.pathname === routePrefix || url.pathname === routePrefix + '/') {
    return new Response(getCloudMoonShellHTML(url.origin), {
      headers: {
        'Content-Type': 'text/html',
        'Permissions-Policy': 'accelerometer=*, gyroscope=*, camera=*, microphone=*, geolocation=*, hid=*, midi=*, clipboard-read=*, clipboard-write=*, xr-spatial-tracking=*, gamepad=*'
      }
    });
  }

  let targetURL;

  if (url.pathname.startsWith('/proxy/')) {
    // Explicit encoded proxy target (used by loadGame for external, non-CloudMoon URLs
    // that still got routed here, or by legacy links)
    const encodedURL = url.pathname.substring('/proxy/'.length);
    try {
      targetURL = decodeURIComponent(encodedURL);
      if (url.search) targetURL += url.search;
    } catch (e) {
      console.error('Failed to decode proxy URL:', encodedURL);
      return new Response('Invalid proxy URL', { status: 400 });
    }
  } else {
    // Strip the routing prefix (e.g. "/web.cloudmoonapp.com") before rebuilding
    // the real CloudMoon path. THIS is the fix — previously the prefix was left
    // in place and got concatenated onto the host, producing
    // "https://web.cloudmoonapp.comweb.cloudmoonapp.com/..." which fails to fetch.
    let remainingPath = url.pathname.slice(routePrefix.length);
    if (!remainingPath.startsWith('/')) remainingPath = '/' + remainingPath;
    targetURL = 'https://web.cloudmoonapp.com' + remainingPath + url.search;
  }

  if (isAdRequest(targetURL)) {
    console.log('Blocked ad request:', targetURL);
    return new Response('', { status: 204 });
  }

  console.log('Proxying CloudMoon:', targetURL);

  const headers = new Headers(request.headers);
  headers.set('Host', new URL(targetURL).host);
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ray');
  headers.delete('x-forwarded-proto');
  headers.delete('x-real-ip');

  if (!headers.has('User-Agent')) {
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  }

  const proxyRequest = new Request(targetURL, {
    method: request.method,
    headers: headers,
    body: request.body,
    redirect: 'follow'
  });

  let response;
  try {
    response = await fetch(proxyRequest);
  } catch (error) {
    console.error('Proxy fetch failed:', error);
    return new Response('Failed to fetch resource', { status: 502 });
  }

  if (response.status === 404) {
    console.log('Resource not found (404):', targetURL);
  }

  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Access-Control-Allow-Methods', '*');
  newHeaders.set('Access-Control-Allow-Headers', '*');
  newHeaders.set('Access-Control-Allow-Credentials', 'true');
  newHeaders.delete('Content-Security-Policy');
  newHeaders.delete('X-Frame-Options');
  newHeaders.delete('Frame-Options');

  const contentType = response.headers.get('Content-Type') || '';

  if (contentType.includes('text/html')) {
    let html = await response.text();
    html = blockAdsInHTML(html);

    const injectionCode = `
<style id="cm-ad-blocker-css">
  .a-div-horizontal,
  .a-div-vertical,
  .a-div-placeholder,
  .a-div-box {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
    position: absolute !important;
    width: 0 !important;
    height: 0 !important;
    overflow: hidden !important;
  }
</style>
<script id="cm-fix-js">
(function(){
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    if (typeof url === 'string' && isAdUrl(url)) {
      console.log('[Ad Blocked]', url);
      return Promise.reject(new Error('Ad blocked'));
    }
    return originalFetch.apply(this, args);
  };

  const originalXHR = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function(method, url) {
    if (isAdUrl(url)) {
      console.log('[Ad Blocked]', url);
      return;
    }
    return originalXHR.apply(this, arguments);
  };

  function isAdUrl(url) {
    const adPatterns = [
      'googlesyndication', 'doubleclick', 'googleadservices',
      'google-analytics', 'googletagmanager', 'googletagservices',
      '/ads/', '/ad/', '/advert', 'adsense', 'analytics',
      'facebook.com/ads', 'twitter.com/ads'
    ];
    return adPatterns.some(pattern => url.toLowerCase().includes(pattern));
  }

  function removeAds() {
    const googleAdSelectors = [
      'iframe[src*="googlesyndication"]',
      'iframe[src*="doubleclick"]',
      'iframe[src*="google-analytics"]',
      'div[id*="google_ads"]',
      'div[class*="adsbygoogle"]',
      'ins.adsbygoogle',
      '[data-ad-slot]',
      '[data-ad-client]'
    ];

    googleAdSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        el.style.display = 'none';
        try { el.remove(); } catch (e) {}
      });
    });

    const adDivs = document.querySelectorAll('.a-div-horizontal, .a-div-vertical, .a-div-placeholder, .a-div-box');
    adDivs.forEach(el => {
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      el.style.position = 'absolute';
      el.style.width = '0';
      el.style.height = '0';
      el.style.overflow = 'hidden';
      try { el.remove(); } catch (e) {}
    });
  }

  function fixButtons() {
    var allBtns = document.querySelectorAll("button.google-button");
    for (var i = 0; i < allBtns.length; i++) {
      var btn = allBtns[i];
      var styleAttr = btn.getAttribute("style") || "";
      if (styleAttr.indexOf("123, 108, 196") !== -1 || styleAttr.indexOf("123,108,196") !== -1) {
        btn.style.setProperty("display", "flex", "important");
        btn.style.setProperty("visibility", "visible", "important");
        btn.style.setProperty("opacity", "1", "important");
        btn.style.setProperty("pointer-events", "auto", "important");
        btn.style.setProperty("flex-direction", "row", "important");
        btn.style.setProperty("justify-content", "center", "important");
        btn.style.setProperty("align-items", "center", "important");
        btn.style.setProperty("gap", "1rem", "important");
        btn.style.setProperty("width", "min(350px, 100%)", "important");
        btn.style.setProperty("height", "45px", "important");
        btn.style.setProperty("border-radius", "5rem", "important");
        btn.style.setProperty("cursor", "pointer", "important");
        btn.style.setProperty("font-size", "1rem", "important");
      } else if (styleAttr.indexOf("255, 255, 255") !== -1 || styleAttr.indexOf("#fff") !== -1 || styleAttr.indexOf("white") !== -1 || btn.querySelector("svg")) {
        btn.style.setProperty("display", "none", "important");
        btn.style.setProperty("visibility", "hidden", "important");
      }
    }
  }

  removeAds();
  fixButtons();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      fixButtons();
      removeAds();
      console.log('[CloudMoon] DOM ready - ads removed');
    });
  }

  window.addEventListener("load", function() {
    fixButtons();
    removeAds();
    console.log('[CloudMoon] Window loaded - ads removed');
  });

  setInterval(function() {
    fixButtons();
    removeAds();
  }, 200);

  var observer = new MutationObserver(function() {
    fixButtons();
    removeAds();
  });

  function startObserver() {
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"]
      });
    } else {
      setTimeout(startObserver, 10);
    }
  }
  startObserver();

  var origOpen = window.open;
  window.open = function(u, t, f) {
    if (u && u.indexOf("run-site") > -1) {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({type: "LOAD_GAME", url: u}, "*");
      } else {
        window.location.href = u;
      }
      return {closed: false, close: function(){}, focus: function(){}};
    }
    return origOpen.call(this, u, t, f);
  };

  console.log("[CloudMoon Fix] Initialized with ad blocking");
})();
</script>`;

    if (html.includes('</head>')) {
      html = html.replace('</head>', injectionCode + '</head>');
    } else {
      html = injectionCode + html;
    }

    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }

  if (contentType.includes('javascript') || contentType.includes('application/x-javascript')) {
    if (isAdRequest(targetURL)) {
      console.log('Blocked ad script:', targetURL);
      return new Response('// Ad script blocked', {
        status: 200,
        headers: { 'Content-Type': 'application/javascript' }
      });
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}
