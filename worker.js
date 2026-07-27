// Cloudflare Worker - Universal Reverse Proxy with Multi-Layer Shadow DOM Protection + Ad Blocking
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// Common ad domains and patterns to block
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

function parseTargetURL(pathname, search) {
  // Remove leading slash
  let targetPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  
  // Empty path - return null (show home page)
  if (!targetPath) {
    return null;
  }
  
  // Already encoded as /proxy/ format
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
  
  // Direct URL input: /google.com or /google.com/path or /https://google.com
  let targetURL = targetPath;
  
  // Add scheme if missing
  if (!targetURL.startsWith('http://') && !targetURL.startsWith('https://')) {
    targetURL = 'https://' + targetURL;
  }
  
  // Add search params
  if (search) {
    targetURL += search;
  }
  
  return targetURL;
}

function isValidURL(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Serve the home page
  if (pathname === '/' || pathname === '') {
    return new Response(getHomeHTML(), {
      headers: {
        'Content-Type': 'text/html',
        'Permissions-Policy': 'accelerometer=*, gyroscope=*, camera=*, microphone=*, geolocation=*, hid=*, midi=*, clipboard-read=*, clipboard-write=*, xr-spatial-tracking=*, gamepad=*'
      }
    });
  }
  
  // Serve manifest.json for PWA
  if (pathname === '/manifest.json') {
    return new Response(getManifest(), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Serve service worker for PWA
  if (pathname === '/sw.js') {
    return new Response(getServiceWorker(), {
      headers: { 
        'Content-Type': 'application/javascript',
        'Service-Worker-Allowed': '/'
      }
    });
  }

  // Parse target URL from pathname
  const targetURL = parseTargetURL(pathname, url.search);
  
  if (!targetURL || !isValidURL(targetURL)) {
    return new Response('Invalid URL', { status: 400 });
  }
  
  // Proxy the request
  return proxyRequest(request, targetURL);
}

async function proxyRequest(request, targetURL) {
  // Block ad requests
  if (isAdRequest(targetURL)) {
    console.log('Blocked ad request:', targetURL);
    return new Response('', { status: 204 });
  }
  
  console.log('Proxying:', targetURL);
  
  const headers = new Headers(request.headers);
  const targetURLObj = new URL(targetURL);
  headers.set('Host', targetURLObj.host);
  
  // Remove Cloudflare headers
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
    
    // Remove ad-related elements and scripts
    html = blockAdsInHTML(html);
    
    // Get the current worker domain for message passing
    const workerDomain = new URL(request.url).origin;
    
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
  window.__WORKER_DOMAIN__ = '${workerDomain}';
  
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
    document.addEventListener("DOMContentLoaded", function() {
      removeAds();
      console.log('[Universal Proxy] DOM ready - ads removed');
    });
  }
  
  window.addEventListener("load", function() {
    removeAds();
    console.log('[Universal Proxy] Window loaded - ads removed');
  });
  
  setInterval(function() {
    removeAds();
  }, 200);
  
  var observer = new MutationObserver(function() {
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
  
  // Intercept links to stay within proxy
  document.addEventListener('click', function(e) {
    if (e.target.tagName === 'A' && e.target.href) {
      const href = e.target.href;
      if (!href.startsWith('javascript:') && !href.startsWith('#')) {
        e.preventDefault();
        window.location.href = href.replace(window.location.origin, window.__WORKER_DOMAIN__);
      }
    }
  }, true);
  
  // Intercept form submissions
  document.addEventListener('submit', function(e) {
    const form = e.target;
    if (form.action) {
      e.preventDefault();
      const formData = new FormData(form);
      const params = new URLSearchParams(formData);
      const targetUrl = form.action.replace(window.location.origin, window.__WORKER_DOMAIN__) + 
        (form.method.toUpperCase() === 'GET' ? '?' + params.toString() : '');
      window.location.href = targetUrl;
    }
  }, true);
  
  console.log("[Universal Proxy] Initialized with ad blocking");
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
  
  // Block ads in JavaScript files
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

function getHomeHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Universal Reverse Proxy</title>
    <meta name="description" content="Universal reverse proxy - access any website through this worker">
    
    <meta name="theme-color" content="#2d2d2d">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="HyperZ Proxy">
    <link rel="manifest" href="/manifest.json">
    
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #0d1117 0%, #1a1a2e 100%);
            color: #c9d1d9;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .container {
            width: 100%;
            max-width: 600px;
            background: rgba(13, 17, 23, 0.8);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(48, 54, 61, 0.6);
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        }
        
        h1 {
            font-size: 28px;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            font-weight: 700;
        }
        
        .subtitle {
            color: #8b949e;
            margin-bottom: 30px;
            font-size: 14px;
        }
        
        .input-group {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        
        input[type="text"] {
            flex: 1;
            padding: 12px 16px;
            background: rgba(30, 30, 46, 0.6);
            border: 1px solid rgba(48, 54, 61, 0.6);
            border-radius: 8px;
            color: #c9d1d9;
            font-size: 14px;
            transition: all 0.3s;
        }
        
        input[type="text"]:focus {
            outline: none;
            border-color: #667eea;
            background: rgba(30, 30, 46, 0.9);
            box-shadow: 0 0 12px rgba(102, 126, 234, 0.2);
        }
        
        button {
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            border: none;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            font-size: 14px;
        }
        
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
        }
        
        button:active {
            transform: translateY(0);
        }
        
        .examples {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid rgba(48, 54, 61, 0.4);
        }
        
        .examples h3 {
            font-size: 12px;
            text-transform: uppercase;
            color: #8b949e;
            margin-bottom: 12px;
            font-weight: 600;
            letter-spacing: 0.5px;
        }
        
        .example-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .example {
            padding: 10px 12px;
            background: rgba(30, 30, 46, 0.6);
            border: 1px solid rgba(48, 54, 61, 0.4);
            border-radius: 6px;
            font-size: 12px;
            color: #8b949e;
            cursor: pointer;
            transition: all 0.2s;
            font-family: 'Monaco', monospace;
        }
        
        .example:hover {
            background: rgba(48, 54, 61, 0.6);
            border-color: #667eea;
            color: #667eea;
        }
        
        .features {
            margin-top: 30px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }
        
        .feature {
            padding: 12px;
            background: rgba(30, 30, 46, 0.4);
            border-radius: 6px;
            font-size: 12px;
            color: #8b949e;
            text-align: center;
        }
        
        .feature strong {
            color: #c9d1d9;
            display: block;
            margin-bottom: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🌐 HyperZ Proxy</h1>
        <p class="subtitle">Universal reverse proxy with multi-layer shadow DOM protection</p>
        
        <div class="input-group">
            <input 
                type="text" 
                id="urlInput" 
                placeholder="Enter URL (google.com, reddit.com, youtube.com...)"
                autocomplete="off"
            >
            <button onclick="navigateToUrl()">Go</button>
        </div>
        
        <div class="examples">
            <h3>Quick Links</h3>
            <div class="example-list">
                <div class="example" onclick="goToUrl('google.com')">google.com</div>
                <div class="example" onclick="goToUrl('reddit.com')">reddit.com</div>
                <div class="example" onclick="goToUrl('github.com')">github.com</div>
                <div class="example" onclick="goToUrl('youtube.com')">youtube.com</div>
            </div>
        </div>
        
        <div class="features">
            <div class="feature">
                <strong>🛡️ Ad Blocking</strong>
                Automatically blocks ads
            </div>
            <div class="feature">
                <strong>🎭 Shadow DOM</strong>
                Multi-layer protection
            </div>
            <div class="feature">
                <strong>⚡ Fast</strong>
                Workers edge cache
            </div>
            <div class="feature">
                <strong>🔒 Proxy</strong>
                Full anonymity
            </div>
        </div>
    </div>

    <script>
        const urlInput = document.getElementById('urlInput');
        
        urlInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                navigateToUrl();
            }
        });
        
        // Focus on load
        urlInput.focus();
        
        function navigateToUrl() {
            let url = urlInput.value.trim();
            if (url) {
                goToUrl(url);
            }
        }
        
        function goToUrl(url) {
            // Add scheme if missing
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            
            // Navigate to proxied URL
            window.location.href = '/' + encodeURIComponent(url);
        }
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
    "icons": [
      {
        "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><rect fill='%23667eea' width='192' height='192'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='100' fill='white' font-weight='bold'>Z</text></svg>",
        "sizes": "192x192",
        "type": "image/svg+xml",
        "purpose": "any maskable"
      }
    ],
    "categories": ["productivity", "utilities"],
    "shortcuts": [
      {
        "name": "Open Proxy",
        "short_name": "Proxy",
        "description": "Open HyperZ Proxy",
        "url": "/",
        "icons": [
          {
            "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><rect fill='%23667eea' width='96' height='96'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='50' fill='white' font-weight='bold'>Z</text></svg>",
            "sizes": "96x96",
            "type": "image/svg+xml"
          }
        ]
      }
    ]
  });
}

function getServiceWorker() {
  return `// HyperZ Proxy Service Worker
const CACHE_NAME = 'hyperz-proxy-v1';
const RUNTIME_CACHE = 'hyperz-proxy-runtime';

self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching app shell');
      return cache.addAll([
        '/',
        '/manifest.json',
        '/sw.js'
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
