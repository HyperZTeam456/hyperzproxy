import { handleCloudMoonRequest } from './cloudmoon.js';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const COOKIE_NAME = 'cm_mode';
const ENTER_PATH = '/web.cloudmoonapp.com';
const EXIT_PATH = '/__leave-cloudmoon';

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

function hasCloudMoonCookie(request) {
  const cookie = request.headers.get('Cookie') || '';
  return cookie.split(';').some(c => c.trim().startsWith(`${COOKIE_NAME}=1`));
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // EXIT must be checked before the cookie check — its whole job is to escape
  // CloudMoon mode, so it can't be swallowed by the "cookie set -> go to CloudMoon" rule.
  if (pathname === EXIT_PATH) {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/',
        'Set-Cookie': `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=None; Secure`
      }
    });
  }

  // Cookie check: the CloudMoon cookie ONLY applies to CloudMoon's own
  // paths: /web.cloudmoonapp.com, /, /_app/, /manifest.json, /sw.js.
  // For ANY other path (including /proxy/ which is used by the universal
  // wrapper for ALL sites), ignore the cookie and fall through to the normal
  // proxy. This prevents the CloudMoon cookie from hijacking non-CloudMoon
  // sites AND prevents /proxy/ requests from being misrouted to CloudMoon.
  if (hasCloudMoonCookie(request) &&
      (pathname === ENTER_PATH || pathname.startsWith(ENTER_PATH + '/') ||
       pathname === '/' || pathname === '' ||
       pathname.startsWith('/_app/') ||
       pathname === '/manifest.json' || pathname === '/sw.js')) {
    return handleCloudMoonRequest(request);
  }

  // ENTER only matters when there's no cookie yet — genuinely entering CloudMoon
  // mode for the first time (or after a fresh browser/no cookies).
  if (pathname === ENTER_PATH || pathname.startsWith(ENTER_PATH + '/')) {
    const afterPath = pathname.slice(ENTER_PATH.length) || '/';
    return new Response(null, {
      status: 302,
      headers: {
        'Location': afterPath + url.search,
        'Set-Cookie': `${COOKIE_NAME}=1; Path=/; Max-Age=5; SameSite=None; Secure`
      }
    });
  }

  if (pathname === '/' || pathname === '') {
    return new Response('url not specified', {
      headers: {
        'Content-Type': 'text/plain',
        'Permissions-Policy': 'accelerometer=*, gyroscope=*, camera=*, microphone=*, geolocation=*, hid=*, midi=*, clipboard-read=*, clipboard-write=*, xr-spatial-tracking=*, gamepad=*'
      }
    });
  }

  if (pathname === '/manifest.json') {
    return new Response(getManifest(), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (pathname === '/sw.js') {
    return new Response(getServiceWorker(), {
      headers: {
        'Content-Type': 'application/javascript',
        'Service-Worker-Allowed': '/'
      }
    });
  }

  const targetURL = parseUniversalURL(pathname, url.search);

  if (!targetURL || !isValidURL(targetURL)) {
    return new Response('Invalid URL', { status: 400 });
  }

  const fetchDest = request.headers.get('Sec-Fetch-Dest');
  if (fetchDest === 'iframe') {
    return proxyRequest(request, targetURL);
  }

  return new Response(getUniversalWrapper(targetURL), {
    headers: {
      'Content-Type': 'text/html',
      'Permissions-Policy': 'accelerometer=*, gyroscope=*, camera=*, microphone=*, geolocation=*, hid=*, midi=*, clipboard-read=*, clipboard-write=*, xr-spatial-tracking=*, gamepad=*'
    }
  });
}

function parseUniversalURL(pathname, search) {
  let targetPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;

  if (!targetPath) return null;

  if (targetPath.startsWith('proxy/')) {
    const encodedURL = targetPath.substring('proxy/'.length);
    try {
      let decoded = decodeURIComponent(encodedURL);
      if (search) decoded += search;
      return decoded;
    } catch (e) {
      return null;
    }
  }

  let targetURL = targetPath;
  try {
    const decoded = decodeURIComponent(targetPath);
    if (decoded.includes('://')) {
      targetURL = decoded;
      if (search) targetURL += search;
      return targetURL;
    }
    targetURL = decoded;
  } catch (e) {
  }

  if (targetURL.startsWith('http://') || targetURL.startsWith('https://')) {
    if (search) targetURL += search;
    return targetURL;
  }

  return search ? 'https://' + targetURL + search : 'https://' + targetURL;
}

function isValidURL(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

async function proxyRequest(request, targetURL) {
  if (isAdRequest(targetURL)) {
    console.log('Blocked ad request:', targetURL);
    return new Response('', { status: 204 });
  }

  console.log('Proxying:', targetURL);

  const headers = new Headers(request.headers);
  const targetURLObj = new URL(targetURL);
  headers.set('Host', targetURLObj.host);

  headers.delete('cf-connecting-ip');
  headers.delete('cf-ray');
  headers.delete('x-forwarded-proto');
  headers.delete('x-real-ip');

  if (!headers.has('User-Agent')) {
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  }

  const proxyReq = new Request(targetURL, {
    method: request.method,
    headers: headers,
    body: request.body,
    redirect: 'follow'
  });

  let response;
  try {
    response = await fetch(proxyReq);
  } catch (error) {
    console.error('Proxy fetch failed:', error);
    return new Response('Failed to fetch resource', { status: 502 });
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
<style id="ad-blocker-css">
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
<script id="proxy-fix-js">
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

  removeAds();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() { removeAds(); });
  }
  window.addEventListener("load", function() { removeAds(); });
  setInterval(function() { removeAds(); }, 200);

  var observer = new MutationObserver(function() { removeAds(); });
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
})();
</script>`;

    const headOpenMatch = html.match(/<head[^>]*>/i);
    if (headOpenMatch) {
      html = html.replace(headOpenMatch[0], headOpenMatch[0] + injectionCode);
    } else if (html.includes('</head>')) {
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
        proxyPath = '/web.cloudmoonapp.com' + abs.pathname + abs.search + abs.hash;
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

function getUniversalWrapper(targetURL) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loading...</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { width: 100vw; height: 100vh; background: #0d1117; overflow: hidden; }
        #frame-container { width: 100%; height: 100%; }
    </style>
</head>
<body>
    <div id="frame-container"></div>
    <script>
        const targetURL = '${targetURL.replace(/'/g, "\\'")}';
        const SHADOW_LAYERS = 4;
        const SANDBOX_ATTRS = 'allow-forms allow-modals allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock';
        const ALLOW_PERMISSIONS = 'accelerometer; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; clipboard-read; clipboard-write; xr-spatial-tracking; gamepad';

        function createMultiLayerShadowFrame(url) {
            const frameContainer = document.getElementById('frame-container');
            frameContainer.innerHTML = '';

            let currentHost = document.createElement('div');
            currentHost.style.cssText = 'width:100%;height:100%;margin:0;padding:0;border:none;display:block;overflow:hidden;';
            frameContainer.appendChild(currentHost);

            for (let i = 0; i < SHADOW_LAYERS; i++) {
                const shadowRoot = currentHost.attachShadow({ mode: 'closed' });

                if (i < SHADOW_LAYERS - 1) {
                    const nextHost = document.createElement('div');
                    nextHost.style.cssText = 'width:100%;height:100%;margin:0;padding:0;border:none;display:block;overflow:hidden;';
                    shadowRoot.appendChild(nextHost);
                    currentHost = nextHost;
                } else {
                    const iframe = document.createElement('iframe');
                    iframe.style.cssText = 'width:100%;height:100%;border:none;margin:0;padding:0;display:block;overflow:hidden;';
                    iframe.setAttribute('sandbox', SANDBOX_ATTRS);
                    iframe.setAttribute('allow', ALLOW_PERMISSIONS);
                    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
                    iframe.setAttribute('importance', 'high');
                    iframe.setAttribute('loading', 'eager');
                    iframe.src = '/proxy/' + encodeURIComponent(url);
                    shadowRoot.appendChild(iframe);
                }
            }
        }

        createMultiLayerShadowFrame(targetURL);
    </script>
</body>
</html>`;
}

function getManifest() {
  return JSON.stringify({
    "name": "HyperZ Proxy",
    "short_name": "HyperZ Proxy",
    "description": "Universal reverse proxy with multi-layer shadow DOM protection and ad blocking",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#0d1117",
    "theme_color": "#667eea",
    "orientation": "any",
    "scope": "/",
    "icons": [{
      "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><rect fill='%23667eea' width='192' height='192'/></svg>",
      "sizes": "192x192",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }],
    "categories": ["productivity"]
  });
}

function getServiceWorker() {
  return `const CACHE_NAME = 'hyperz-proxy-v1';
const RUNTIME_CACHE = 'hyperz-proxy-runtime';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/', '/manifest.json', '/sw.js']);
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
      .catch(() => {
        return caches.match(event.request).then((response) => {
          if (response) return response;
          if (event.request.mode === 'navigate') return caches.match('/');
          return new Response('', {
            status: 200,
            statusText: 'OK',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        });
      })
  );
});`;
}
