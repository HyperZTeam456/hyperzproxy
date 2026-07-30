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

export async function handleCloudMoonRequest(request) {
  const url = new URL(request.url);

  if (url.pathname === '/' || url.pathname === '') {
    return new Response(getMainHTML(), {
      headers: {
        'Content-Type': 'text/html',
        'Permissions-Policy': 'accelerometer=*, gyroscope=*, camera=*, microphone=*, geolocation=*, hid=*, midi=*, clipboard-read=*, clipboard-write=*, xr-spatial-tracking=*, gamepad=*'
      }
    });
  }

  if (url.pathname === '/manifest.json') {
    return new Response(getManifest(), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (url.pathname === '/sw.js') {
    return new Response(getServiceWorker(), {
      headers: {
        'Content-Type': 'application/javascript',
        'Service-Worker-Allowed': '/'
      }
    });
  }

  if (url.pathname === '/favicon.png') {
    const iconRes = await fetch('https://ssl.gstatic.com/classroom/favicon.png');
    const iconHeaders = new Headers(iconRes.headers);
    iconHeaders.set('Cache-Control', 'public, max-age=86400');
    return new Response(iconRes.body, {
      status: iconRes.status,
      headers: iconHeaders
    });
  }

  return proxyCloudMoon(request);
}

async function proxyCloudMoon(request) {
  const url = new URL(request.url);

  let targetURL;

  if (url.pathname.startsWith('/proxy/')) {
    const encodedURL = url.pathname.substring('/proxy/'.length);
    try {
      targetURL = decodeURIComponent(encodedURL);
      if (url.search) {
        targetURL += url.search;
      }
    } catch (e) {
      console.error('Failed to decode proxy URL:', encodedURL);
      return new Response('Invalid proxy URL', { status: 400 });
    }
  } else {
    targetURL = 'https://web.cloudmoonapp.com' + url.pathname + url.search;
  }

  if (isAdRequest(targetURL)) {
    console.log('Blocked ad request:', targetURL);
    return new Response('', { status: 204 });
  }

  console.log('Proxying:', targetURL);

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
    html = rewriteLinksToProxy(html, targetURL);

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
      }
      else if (styleAttr.indexOf("255, 255, 255") !== -1 || styleAttr.indexOf("#fff") !== -1 || styleAttr.indexOf("white") !== -1 || btn.querySelector("svg")) {
        btn.style.setProperty("display", "none", "important");
        btn.style.setProperty("visibility", "hidden", "important");
      }
    }
  }

  removeAds();

  fixButtons();
  stripPopupTargets();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      fixButtons();
      removeAds();
      stripPopupTargets();
      console.log('[CloudMoon] DOM ready - ads removed');
    });
  }

  window.addEventListener("load", function() {
    fixButtons();
    removeAds();
    stripPopupTargets();
    console.log('[CloudMoon] Window loaded - ads removed');
  });

  setInterval(function() {
    fixButtons();
    removeAds();
    stripPopupTargets();
  }, 200);

  var observer = new MutationObserver(function() {
    fixButtons();
    removeAds();
    stripPopupTargets();
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

  function toProxyPath(rawUrl) {
    try {
      var abs = new URL(rawUrl, window.location.href);
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return rawUrl;
      if (abs.origin === window.location.origin) return rawUrl;
      if (abs.hostname === 'web.cloudmoonapp.com') {
        if (abs.pathname === '/' || abs.pathname === '') {
          return '/web.cloudmoonapp.com/' + abs.search + abs.hash;
        }
        return abs.pathname + abs.search + abs.hash;
      }
      return '/' + abs.hostname + abs.pathname + abs.search + abs.hash;
    } catch (e) {
      return rawUrl;
    }
  }

  var origOpen = window.open;
  window.open = function(u, t, f) {
    if (u && u.indexOf("run-site") > -1) {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({type: "LOAD_GAME", url: u}, "*");
      } else {
        window.location.href = toProxyPath(u);
      }
      return {closed: false, close: function(){}, focus: function(){}};
    }
    if (u) {
      var proxied = toProxyPath(u);
      console.log('[Popup Intercepted -> redirecting current page]', proxied);
      window.location.href = proxied;
    }
    return {closed: false, close: function(){}, focus: function(){}, blur: function(){}};
  };

  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el !== document.body && el.tagName !== 'A') {
      el = el.parentElement;
    }
    if (el && el.tagName === 'A') {
      var target = el.getAttribute('target');
      var href = el.getAttribute('href') || el.href;
      if (target && target.toLowerCase() !== '_self' && target.toLowerCase() !== '_parent' && href) {
        e.preventDefault();
        e.stopPropagation();
        var proxied = toProxyPath(href);
        console.log('[Link Redirect Intercepted -> redirecting current page]', proxied);
        window.location.href = proxied;
      }
    }
  }, true);

  // Catch-all: click handlers on non-<a> elements (div onclick, button, etc.) that call
  // location.href/assign/replace directly with a raw external URL. Browsers don't allow
  // overriding the location.href setter, so this traps it right after the click instead:
  // location changes are queued as a task, so a 0ms timeout runs in the brief gap before
  // the new document actually loads, letting us abort with window.stop() and correct it.
  document.addEventListener('click', function() {
    var startHref = window.location.href;
    setTimeout(function() {
      var nowHref = window.location.href;
      if (nowHref !== startHref && nowHref.indexOf(window.location.origin) !== 0) {
        try { window.stop(); } catch (e) {}
        var proxied = toProxyPath(nowHref);
        console.log('[Non-link Redirect Trapped -> correcting]', proxied);
        window.location.href = proxied;
      }
    }, 0);
  }, true);

  var origAssign = Location.prototype.assign;
  var origReplace = Location.prototype.replace;
  try {
    Location.prototype.assign = function(u) {
      return origAssign.call(this, toProxyPath(u));
    };
    Location.prototype.replace = function(u) {
      return origReplace.call(this, toProxyPath(u));
    };
  } catch (e) {}

  document.addEventListener('submit', function(e) {
    var form = e.target;
    var target = form.getAttribute && form.getAttribute('target');
    if (target && target.toLowerCase() !== '_self' && target.toLowerCase() !== '_parent') {
      form.removeAttribute('target');
    }
  }, true);

  function stripPopupTargets() {
    document.querySelectorAll('a[target]').forEach(function(a) {
      var t = a.getAttribute('target');
      if (t && t.toLowerCase() !== '_self' && t.toLowerCase() !== '_parent') {
        a.removeAttribute('target');
      }
    });
    document.querySelectorAll('form[target]').forEach(function(f) {
      var t = f.getAttribute('target');
      if (t && t.toLowerCase() !== '_self' && t.toLowerCase() !== '_parent') {
        f.removeAttribute('target');
      }
    });
  }
  stripPopupTargets();

  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'REQUEST_FULLSCREEN') {
      var gameWrapper = document.querySelector('#gameWrapper');
      if (gameWrapper) {

        var inputDiv = document.querySelector('#input-div');
        var sidebar = document.querySelector('.sidebar.sidebar-open') || document.querySelector('.sidebar');
        var floatingBall = document.querySelector('#floating-ball');

        var elementsToRestore = [];

        function storeAndMoveElement(element) {
          if (!element) return;

          var originalParent = element.parentNode;
          var originalNextSibling = element.nextSibling;
          var originalStyle = element.getAttribute('style') || '';
          var computedStyle = window.getComputedStyle(element);
          var originalPosition = {
            position: computedStyle.position,
            top: computedStyle.top,
            left: computedStyle.left,
            right: computedStyle.right,
            bottom: computedStyle.bottom,
            zIndex: computedStyle.zIndex,
            transform: computedStyle.transform
          };

          elementsToRestore.push({
            element: element,
            parent: originalParent,
            nextSibling: originalNextSibling,
            styleAttr: originalStyle,
            position: originalPosition
          });

          gameWrapper.appendChild(element);
          element.style.position = 'fixed';
          element.style.zIndex = '999999';
          element.style.pointerEvents = 'auto';

          if (element.id === 'input-div') {
            element.style.bottom = '20px';
            element.style.left = '0px';
          } else if (element.id === 'floating-ball') {
            element.style.left = '0px';
            element.style.top = '50%';
            element.style.transform = 'translateY(-50%)';
          }
        }

        var originalWrapperPosition = gameWrapper.style.position;
        gameWrapper.style.position = 'relative';

        storeAndMoveElement(inputDiv);
        storeAndMoveElement(sidebar);
        storeAndMoveElement(floatingBall);

        var fullscreenPromise = null;
        if (gameWrapper.requestFullscreen) {
          fullscreenPromise = gameWrapper.requestFullscreen();
        } else if (gameWrapper.webkitRequestFullscreen) {
          fullscreenPromise = gameWrapper.webkitRequestFullscreen();
        } else if (gameWrapper.mozRequestFullScreen) {
          fullscreenPromise = gameWrapper.mozRequestFullScreen();
        } else if (gameWrapper.msRequestFullscreen) {
          fullscreenPromise = gameWrapper.msRequestFullscreen();
        }

        var fullscreenExitHandler = function() {
          if (document.fullscreenElement || document.webkitFullscreenElement ||
              document.mozFullScreenElement || document.msFullscreenElement) {
            return;
          }

          elementsToRestore.forEach(function(item) {
            if (item.element && item.parent) {
              if (item.nextSibling && item.nextSibling.parentNode === item.parent) {
                item.parent.insertBefore(item.element, item.nextSibling);
              } else {
                item.parent.appendChild(item.element);
              }

              if (item.styleAttr) {
                item.element.setAttribute('style', item.styleAttr);
              } else {
                item.element.removeAttribute('style');
              }
            }
          });

          if (originalWrapperPosition) {
            gameWrapper.style.position = originalWrapperPosition;
          } else {
            gameWrapper.style.position = '';
          }

          document.removeEventListener('fullscreenchange', fullscreenExitHandler);
          document.removeEventListener('webkitfullscreenchange', fullscreenExitHandler);
          document.removeEventListener('mozfullscreenchange', fullscreenExitHandler);
          document.removeEventListener('MSFullscreenChange', fullscreenExitHandler);

          console.log('[CloudMoon] Fullscreen exited, UI restored');
        };

        document.addEventListener('fullscreenchange', fullscreenExitHandler);
        document.addEventListener('webkitfullscreenchange', fullscreenExitHandler);
        document.addEventListener('mozfullscreenchange', fullscreenExitHandler);
        document.addEventListener('MSFullscreenChange', fullscreenExitHandler);

        console.log('[CloudMoon] Game container fullscreen requested with UI overlay');
      } else {
        console.log('[CloudMoon] Game container not found, using document fullscreen');
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
        }
      }
    }
  });

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

function rewriteLinksToProxy(html, baseURL) {
  return html.replace(/(<a\b[^>]*\shref)=("[^"]*"|'[^']*')/gi, function(match, prefix, quoted) {
    const quote = quoted[0];
    const raw = quoted.slice(1, -1);
    if (!raw || raw.startsWith('#') || /^(javascript|mailto|tel|data):/i.test(raw)) {
      return match;
    }
    try {
      const abs = new URL(raw, baseURL);
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') {
        return match;
      }
      let proxyPath;
      if (abs.hostname === 'web.cloudmoonapp.com') {
        proxyPath = (abs.pathname === '/' || abs.pathname === '')
          ? '/web.cloudmoonapp.com/' + abs.search + abs.hash
          : abs.pathname + abs.search + abs.hash;
      } else {
        proxyPath = '/' + abs.hostname + abs.pathname + abs.search + abs.hash;
      }
      return prefix + '=' + quote + proxyPath + quote;
    } catch (e) {
      return match;
    }
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

function getMainHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Home - Classroom</title>
    <meta name="description" content="Play Roblox, Fortnite, Call of Duty Mobile, Delta Force, and more in your browser">

    <!-- PWA Meta Tags -->
    <meta name="theme-color" content="#2d2d2d">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="CloudMoon">
    <link rel="manifest" href="/manifest.json">
    <link rel="apple-touch-icon" href="/favicon.png">

    <link rel="icon" id="favicon" type="image/png" href="/favicon.png">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: #0d1117;
            color: #c9d1d9;
            overflow: hidden;
        }

        #container {
            width: 100vw;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        #frame-container {
            flex: 1;
            width: 100%;
            height: 100%;
            background: white;
            position: relative;
        }

        iframe {
            width: 100%;
            height: 100%;
            border: none;
            background: white;
            outline: none;
        }

        iframe:focus {
            outline: none;
        }

        #btn-dock {
            position: fixed;
            bottom: 18px;
            left: 18px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 9999;
            transition: opacity 0.3s;
        }

        #btn-dock.hidden {
            opacity: 0;
            pointer-events: none;
        }

        .dock-btn {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            border: none;
            background: rgba(45, 45, 45, 0.85);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            color: #e0e0e0;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.4);
            transition: background 0.2s, transform 0.15s;
        }

        .dock-btn:hover {
            background: rgba(74, 74, 74, 0.95);
        }

        .dock-btn:active {
            transform: scale(0.93);
        }

        #home-btn {
            display: none;
        }
    </style>
</head>
<body>
    <div id="container">
        <div id="frame-container"></div>
    </div>

    <!-- Floating bottom-left controls -->
    <div id="btn-dock">
        <button class="dock-btn" id="home-btn" onclick="goBack()" title="Home">
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
        const frameContainer = document.getElementById('frame-container');
        const homeBtn = document.getElementById('home-btn');
        const btnDock = document.getElementById('btn-dock');

        let isShowingGame = false;
        let mainURL = '/web.cloudmoonapp.com/';
        let shadowRoots = [];
        let currentIframe = null;

        const SANDBOX_HOME = 'allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock';
        const SANDBOX_GAME = 'allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock';
        const ALLOW_PERMISSIONS = 'accelerometer; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; clipboard-read; clipboard-write; xr-spatial-tracking; gamepad';

        const SHADOW_LAYERS = 4;

        function createMultiLayerShadowFrame(url, isGame = false) {
            frameContainer.innerHTML = '';
            shadowRoots = [];

            let currentHost = document.createElement('div');
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

            for (let i = 0; i < SHADOW_LAYERS; i++) {
                const shadowRoot = currentHost.attachShadow({ mode: 'closed' });
                shadowRoots.push(shadowRoot);

                if (i < SHADOW_LAYERS - 1) {
                    const nextHost = document.createElement('div');
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

                    console.log(\`%c Shadow Layer \${i + 1} created\`, 'color: #667eea; font-weight: bold;');
                } else {
                    const iframe = document.createElement('iframe');
                    iframe.style.width = '100%';
                    iframe.style.height = '100%';
                    iframe.style.border = 'none';
                    iframe.style.margin = '0';
                    iframe.style.padding = '0';
                    iframe.style.display = 'block';
                    iframe.style.overflow = 'hidden';

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
                    lastGoodSrc = url;

                    shadowRoot.appendChild(iframe);
                    currentIframe = iframe;

                    iframe.addEventListener('load', () => {
                        focusIframe();
                    });

                    iframe.addEventListener('error', (e) => {
                        console.error('Iframe error:', e);
                    });

                    startWatchdog();

                    console.log(\`%c Final Shadow Layer \${SHADOW_LAYERS} with iframe created\`, 'color: #10b981; font-weight: bold;');
                }
            }

            console.log(\`%c \${SHADOW_LAYERS}-Layer Shadow DOM Protection Active\`, 'color: #667eea; font-size: 14px; font-weight: bold;');
        }

        let lastGoodSrc = mainURL;
        let watchdogInterval = null;
        let blankSinceMs = null;
        const BLANK_GRACE_MS = 600;

        function startWatchdog() {
            blankSinceMs = null;
            if (watchdogInterval) return;
            watchdogInterval = setInterval(() => {
                if (!currentIframe) return;
                let loc;
                try {
                    loc = currentIframe.contentWindow.location.href;
                } catch (e) {
                    console.warn('[Watchdog] iframe escaped to a non-hyperzproxy origin, resetting');
                    currentIframe.src = lastGoodSrc;
                    blankSinceMs = null;
                    return;
                }
                if (loc === 'about:blank') {
                    if (blankSinceMs === null) {
                        blankSinceMs = Date.now();
                    } else if (Date.now() - blankSinceMs > BLANK_GRACE_MS) {
                        console.warn('[Watchdog] iframe stuck on about:blank (likely a blocked/refused load), resetting');
                        currentIframe.src = lastGoodSrc;
                        blankSinceMs = null;
                    }
                    return;
                }
                blankSinceMs = null;
                if (loc.indexOf(window.location.origin) === 0) {
                    lastGoodSrc = loc.slice(window.location.origin.length) || '/';
                } else {
                    console.warn('[Watchdog] iframe on a non-hyperzproxy URL, resetting:', loc);
                    currentIframe.src = lastGoodSrc;
                }
            }, 50);
        }

        function generateRandomId() {
            return 'x' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        }

        function createShadowFrame(url, isGame = false) {
            createMultiLayerShadowFrame(url, isGame);
        }

        function focusIframe() {
            setTimeout(() => {
                if (currentIframe) {
                    currentIframe.focus();
                    try {
                        currentIframe.contentWindow.focus();
                    } catch (e) {
                    }
                }
            }, 100);
        }

        createMultiLayerShadowFrame(mainURL, false);

        document.addEventListener('click', (e) => {
            if (currentIframe && e.target !== currentIframe) {
                focusIframe();
            }
        });

        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'LOAD_GAME') {
                const gameUrl = event.data.url;
                console.log('Game URL received:', gameUrl);
                loadGame(gameUrl);
            }
        });

        function loadGame(url) {
            let fixedURL = url;
            const workerDomain = window.location.origin;

            if (url.includes(workerDomain)) {
                fixedURL = url;
                console.log('Game URL already on worker domain, using directly');
            } else if (url.includes('://')) {
                fixedURL = workerDomain + '/proxy/' + encodeURIComponent(url);
                console.log('External game URL, proxying through worker');
            } else if (url.startsWith('/')) {
                fixedURL = url;
                console.log('Relative game URL, using as-is');
            }

            console.log(\`%c Loading game with \${SHADOW_LAYERS}-layer Shadow DOM protection\`, 'color: #667eea; font-weight: bold;');
            console.log('Final game URL:', fixedURL);

            createMultiLayerShadowFrame(fixedURL, true);

            isShowingGame = true;
            homeBtn.style.display = 'flex';
        }

        function goBack() {
            createMultiLayerShadowFrame(mainURL, false);
            isShowingGame = false;
            homeBtn.style.display = 'none';

            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
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
            if (!document.fullscreenElement) {
                btnDock.classList.remove('hidden');
            }
        });

        console.log('%c CloudMoon Proxy Active with Ad Blocking', 'color: #667eea; font-size: 18px; font-weight: bold;');
        console.log(\`%c Multi-Layer Shadow DOM Protection: \${SHADOW_LAYERS} Layers\`, 'color: #10b981; font-size: 14px; font-weight: bold;');

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then((registration) => {
                        console.log('%c PWA Service Worker registered', 'color: #667eea; font-weight: bold;');

                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    console.log('%c New version available!', 'color: #10b981; font-weight: bold;');
                                }
                            });
                        });
                    })
                    .catch((error) => {
                        console.log('Service Worker registration failed:', error);
                    });
            });
        }

        let deferredPrompt;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
        });

        window.addEventListener('appinstalled', () => {
            deferredPrompt = null;
        });
    </script>
</body>
</html>`;
}

function getManifest() {
  return JSON.stringify({
    "name": "Google Classroom",
    "short_name": "Google Classroom",
    "description": "Google Classroom is a free, secure, and easy-to-use blended learning platform within Google Workspace for Education that allows educators to create, distribute, and grade assignments in one place.",
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
    "categories": ["education", "learning"],
    "screenshots": [],
    "shortcuts": [
      {
        "name": "Open Classroom",
        "short_name": "Open Classroom",
        "description": "Open Google Classroom",
        "url": "/",
        "icons": [
          {
            "src": "/favicon.png",
            "sizes": "96x96",
            "type": "image/png"
          }
        ]
      }
    ]
  });
}

function getServiceWorker() {
  return `const CACHE_NAME = 'cloudmoon-v1';
const RUNTIME_CACHE = 'cloudmoon-runtime';

self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching app shell');
      return cache.addAll([
        '/',
        '/manifest.json',
        '/sw.js',
        '/favicon.png'
      ]);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('[ServiceWorker] Removing old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, responseToCache);
          }).catch((error) => {
            console.error('[ServiceWorker] Cache put error:', error);
          });
        }
        return response;
      })
      .catch((error) => {
        console.log('[ServiceWorker] Fetch failed, trying cache:', event.request.url);
        return caches.match(event.request).then((response) => {
          if (response) {
            return response;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('', {
            status: 200,
            statusText: 'OK',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        });
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});`;
}
