import { handleCloudMoonRequest } from './cloudmoon.js';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const COOKIE_NAME = 'cm_mode';
const ENTER_PATH = '/web.cloudmoonapp.com';
const CLOUDMOON_DOMAIN = 'web.cloudmoonapp.com';
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

  // ── CORS preflight handling ──
  // Respond to OPTIONS requests so proxied sites' JS that sends preflight
  // requests (fetch with custom headers, non-simple content types, etc.)
  // doesn't fail with CORS errors.
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  // EXIT — clear CloudMoon cookie.
  if (pathname === EXIT_PATH) {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/',
        'Set-Cookie': `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=None; Secure`
      }
    });
  }

  // Helper: check if a path is a CloudMoon entry path.
  // Accepts both /web.cloudmoonapp.com and /cloudmoonapp.com (with or without
  // the web. prefix) since users may type either.
  function isCloudMoonEnter(path) {
    var cmPaths = [
      '/web.cloudmoonapp.com',
      '/cloudmoonapp.com'
    ];
    for (var i = 0; i < cmPaths.length; i++) {
      if (path === cmPaths[i] || path.startsWith(cmPaths[i] + '/')) return true;
    }
    return false;
  }

  // Helper: check if a /proxy/ request targets cloudmoonapp.com.
  function isProxyCloudMoon(path) {
    if (!path.startsWith('/proxy/')) return false;
    try {
      var decoded = decodeURIComponent(path.substring('/proxy/'.length));
      return decoded.indexOf('cloudmoonapp.com') !== -1;
    } catch(e) { return false; }
  }

  // Cookie check: if we have a CloudMoon cookie, route CloudMoon-internal paths
  // to CloudMoon. This includes /, /_app/, /manifest.json, /sw.js, the enter
  // path, and /proxy/ requests targeting cloudmoonapp.com. For everything else
  // (like /crazygames.com), ignore the cookie and use the normal proxy.
  if (hasCloudMoonCookie(request)) {
    var isCM =
      isCloudMoonEnter(pathname) ||
      pathname === '/' || pathname === '' ||
      pathname.startsWith('/_app/') ||
      pathname === '/manifest.json' || pathname === '/sw.js' ||
      isProxyCloudMoon(pathname);
    if (isCM) {
      return handleCloudMoonRequest(request);
    }
  }

  // ENTER: when visiting /web.cloudmoonapp.com (or /cloudmoonapp.com) without
  // a cookie, serve the CloudMoon shell HTML directly (the same HTML that / serves
  // when in CloudMoon mode). No redirect — the shell loads immediately. We set
  // a 60-second cookie so subsequent internal requests (/, /_app/, /proxy/) are
  // routed to CloudMoon.
  if (isCloudMoonEnter(pathname)) {
    // Get the CloudMoon shell HTML (same as handleCloudMoonRequest does for /)
    var shellRequest = new Request('https://' + request.headers.get('host') + '/', request);
    var cmResponse = await handleCloudMoonRequest(shellRequest);
    var cmBody = await cmResponse.text();
    var cmHeaders = new Headers(cmResponse.headers);
    cmHeaders.set('Set-Cookie', `${COOKIE_NAME}=1; Path=/; Max-Age=60; SameSite=None; Secure`);
    return new Response(cmBody, {
      status: cmResponse.status,
      statusText: cmResponse.statusText,
      headers: cmHeaders
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

  console.log('Proxying:', targetURL, '(', request.method, ')');

  const headers = new Headers(request.headers);
  const targetURLObj = new URL(targetURL);
  headers.set('Host', targetURLObj.host);
  headers.set('Origin', targetURLObj.origin);
  headers.set('Referer', targetURLObj.origin + '/');

  // Strip Cloudflare/proxy headers that shouldn't be forwarded
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ray');
  headers.delete('cf-visitor');
  headers.delete('x-forwarded-proto');
  headers.delete('x-forwarded-for');
  headers.delete('x-forwarded-host');
  headers.delete('x-real-ip');
  headers.delete('cf-worker');
  headers.delete('sec-fetch-site');
  headers.delete('sec-fetch-mode');
  headers.delete('sec-fetch-dest');
  headers.delete('sec-fetch-user');

  if (!headers.has('User-Agent')) {
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  }

  // Only include body for methods that have one (GET/HEAD don't)
  const hasBody = !['GET', 'HEAD'].includes(request.method);

  const proxyReq = new Request(targetURL, {
    method: request.method,
    headers: headers,
    body: hasBody ? request.body : undefined,
    redirect: 'manual' // Handle redirects manually so we can rewrite Location
  });

  let response;
  try {
    response = await fetch(proxyReq);
  } catch (error) {
    console.error('Proxy fetch failed:', error);
    // Retry once with a clean request (no body, GET only) as a fallback
    if (request.method !== 'GET') {
      try {
        response = await fetch(targetURL, {
          method: 'GET',
          headers: headers,
          redirect: 'manual'
        });
      } catch(e) {
        return new Response('Failed to fetch resource', { status: 502 });
      }
    } else {
      return new Response('Failed to fetch resource', { status: 502 });
    }
  }

  // ── Handle redirects (3xx) ──
  // Rewrite the Location header so the redirect goes through the proxy
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('Location');
    if (location) {
      try {
        const absLocation = new URL(location, targetURL);
        const proxyLocation = '/' + absLocation.hostname + absLocation.pathname + absLocation.search + absLocation.hash;
        const redirectHeaders = new Headers(response.headers);
        redirectHeaders.set('Location', proxyLocation);
        redirectHeaders.set('Access-Control-Allow-Origin', '*');
        redirectHeaders.delete('Content-Security-Policy');
        redirectHeaders.delete('X-Frame-Options');
        return new Response(null, {
          status: response.status,
          headers: redirectHeaders
        });
      } catch(e) {
        // Location wasn't a valid URL — pass through as-is
      }
    }
  }

  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
  newHeaders.set('Access-Control-Allow-Headers', '*');
  newHeaders.set('Access-Control-Allow-Credentials', 'true');
  newHeaders.delete('Content-Security-Policy');
  newHeaders.delete('Content-Security-Policy-Report-Only');
  newHeaders.delete('X-Frame-Options');
  newHeaders.delete('Frame-Options');
  newHeaders.delete('X-Content-Type-Options');
  newHeaders.delete('Strict-Transport-Security');
  newHeaders.delete('Cross-Origin-Embedder-Policy');
  newHeaders.delete('Cross-Origin-Opener-Policy');
  newHeaders.delete('Cross-Origin-Resource-Policy');
  newHeaders.delete('Permissions-Policy');

  const contentType = (response.headers.get('Content-Type') || '').toLowerCase();

  // ── HTML: rewrite all resource URLs + inject helpers ──
  if (contentType.includes('text/html')) {
    let html = await response.text();
    html = blockAdsInHTML(html);
    html = rewriteAllUrls(html, targetURL);

    const injectionCode = `
<style id="ad-blocker-css">
  .a-div-horizontal, .a-div-vertical, .a-div-placeholder, .a-div-box {
    display: none !important; visibility: hidden !important; opacity: 0 !important;
    pointer-events: none !important; position: absolute !important;
    width: 0 !important; height: 0 !important; overflow: hidden !important;
  }
</style>
<script id="proxy-fix-js">
(function(){
  // Patch fetch to rewrite URLs and block ads
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    if (typeof url === 'string' && isAdUrl(url)) return Promise.reject(new Error('Ad blocked'));
    // Rewrite relative URLs to go through the proxy
    if (typeof input === 'string' && !input.startsWith('http') && !input.startsWith('//') && !input.startsWith('data:') && !input.startsWith('blob:')) {
      input = location.origin + '/proxy/' + encodeURIComponent(new URL(input, document.baseURI).href);
    }
    return originalFetch.call(this, input, init);
  };
  // Patch XHR
  const originalXHROpen = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function(method, url) {
    if (typeof url === 'string' && isAdUrl(url)) return;
    if (typeof url === 'string' && !url.startsWith('http') && !url.startsWith('//') && !url.startsWith('data:') && !url.startsWith('blob:')) {
      try { url = location.origin + '/proxy/' + encodeURIComponent(new URL(url, document.baseURI).href); } catch(e) {}
    }
    return originalXHROpen.apply(this, arguments);
  };
  // Patch WebSocket
  const OriginalWebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    try {
      const wsUrl = new URL(url);
      const proxied = location.origin.replace(/^http/, 'ws') + '/proxy/' + encodeURIComponent(wsUrl.href);
      return new OriginalWebSocket(proxied, protocols);
    } catch(e) { return new OriginalWebSocket(url, protocols); }
  };
  window.WebSocket.prototype = OriginalWebSocket.prototype;
  // Patch EventSource
  if (window.EventSource) {
    const OriginalEventSource = window.EventSource;
    window.EventSource = function(url, config) {
      try {
        const esUrl = new URL(url);
        url = location.origin + '/proxy/' + encodeURIComponent(esUrl.href);
      } catch(e) {}
      return new OriginalEventSource(url, config);
    };
    window.EventSource.prototype = OriginalEventSource.prototype;
  }
  // Patch window.open
  const originalOpen = window.open;
  window.open = function(url, target, features) {
    if (url && typeof url === 'string') {
      try {
        const abs = new URL(url, document.baseURI);
        if (abs.protocol === 'http:' || abs.protocol === 'https:') {
          url = '/' + abs.hostname + abs.pathname + abs.search + abs.hash;
        }
      } catch(e) {}
    }
    return originalOpen.call(this, url, target, features);
  };
  // Patch history.pushState/replaceState to rewrite URLs
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  history.pushState = function(state, title, url) {
    if (url && typeof url === 'string' && !url.startsWith(location.origin)) {
      try {
        const abs = new URL(url, document.baseURI);
        if (abs.protocol === 'http:' || abs.protocol === 'https:') {
          url = '/' + abs.hostname + abs.pathname + abs.search + abs.hash;
        }
      } catch(e) {}
    }
    return originalPushState.apply(this, arguments);
  };
  history.replaceState = function(state, title, url) {
    if (url && typeof url === 'string' && !url.startsWith(location.origin)) {
      try {
        const abs = new URL(url, document.baseURI);
        if (abs.protocol === 'http:' || abs.protocol === 'https:') {
          url = '/' + abs.hostname + abs.pathname + abs.search + abs.hash;
        }
      } catch(e) {}
    }
    return originalReplaceState.apply(this, arguments);
  };
  function isAdUrl(url) {
    const adPatterns = ['googlesyndication','doubleclick','googleadservices','google-analytics','googletagmanager','googletagservices','/ads/','/ad/','/advert','adsense','analytics','facebook.com/ads','twitter.com/ads'];
    return adPatterns.some(p => url.toLowerCase().includes(p));
  }
  function removeAds() {
    const sels = ['iframe[src*="googlesyndication"]','iframe[src*="doubleclick"]','iframe[src*="google-analytics"]','div[id*="google_ads"]','div[class*="adsbygoogle"]','ins.adsbygoogle','[data-ad-slot]','[data-ad-client]','.a-div-horizontal','.a-div-vertical','.a-div-placeholder','.a-div-box'];
    sels.forEach(function(s){ document.querySelectorAll(s).forEach(function(el){ el.style.display='none'; try{el.remove();}catch(e){} }); });
  }
  removeAds();
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', removeAds);
  window.addEventListener('load', removeAds);
  setInterval(removeAds, 200);
  var obs = new MutationObserver(function(){ removeAds(); });
  function startObs(){ if(document.body) obs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["style","class"]}); else setTimeout(startObs,10); }
  startObs();
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

  // ── CSS: rewrite url() references ──
  if (contentType.includes('text/css')) {
    let css = await response.text();
    css = rewriteCSSUrls(css, targetURL);
    newHeaders.set('Content-Type', 'text/css');
    return new Response(css, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }

  // ── JavaScript: block ad scripts, pass through otherwise ──
  if (contentType.includes('javascript') || contentType.includes('application/x-javascript') || contentType.includes('text/javascript')) {
    if (isAdRequest(targetURL)) {
      return new Response('// Ad script blocked', {
        status: 200,
        headers: { 'Content-Type': 'application/javascript', 'Access-Control-Allow-Origin': '*' }
      });
    }
    // Add caching headers for JS assets
    newHeaders.set('Cache-Control', 'public, max-age=3600');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }

  // ── Static assets (images, fonts, etc.): add caching ──
  if (contentType.includes('image/') || contentType.includes('font/') || contentType.includes('application/font') || contentType.includes('application/octet-stream')) {
    newHeaders.set('Cache-Control', 'public, max-age=86400');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }

  // ── Everything else: pass through with CORS headers ──
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

// Rewrite ALL resource URLs in HTML (img, script, link, iframe, source, video,
// audio, form action, etc.) to go through the proxy. This is the key function
// for making sites with lots of assets work correctly.
function rewriteAllUrls(html, baseURL) {
  const baseURLObj = new URL(baseURL);

  // Helper: convert a relative/absolute URL to a proxy path
  function toProxyPath(rawUrl) {
    if (!rawUrl || rawUrl.startsWith('#') || rawUrl.startsWith('data:') ||
        rawUrl.startsWith('blob:') || rawUrl.startsWith('javascript:') ||
        rawUrl.startsWith('mailto:') || rawUrl.startsWith('tel:') ||
        rawUrl.startsWith('about:')) {
      return rawUrl;
    }
    try {
      const abs = new URL(rawUrl, baseURL);
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return rawUrl;
      return '/proxy/' + encodeURIComponent(abs.href);
    } catch(e) {
      return rawUrl;
    }
  }

  // Rewrite src, href, action, poster, srcset, data-src attributes on ALL elements
  const attrRegex = /\s(src|href|action|poster|data-src|data-href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
  html = html.replace(attrRegex, function(match, attr, value) {
    const quote = value[0];
    let raw;
    if (quote === '"' || quote === "'") {
      raw = value.slice(1, -1);
    } else {
      raw = value;
    }
    const proxied = toProxyPath(raw);
    if (proxied === raw) return match; // wasn't rewritable
    if (quote === '"' || quote === "'") {
      return ' ' + attr + '=' + quote + proxied + quote;
    }
    return ' ' + attr + '=' + proxied;
  });

  // Rewrite srcset attributes (responsive images)
  html = html.replace(/\ssrcset\s*=\s*("[^"]*"|'[^']*')/gi, function(match, quoted) {
    const quote = quoted[0];
    const raw = quoted.slice(1, -1);
    const parts = raw.split(',').map(function(part) {
      const trimmed = part.trim();
      const spaceIdx = trimmed.lastIndexOf(' ');
      let url, descriptor;
      if (spaceIdx !== -1) {
        url = trimmed.slice(0, spaceIdx);
        descriptor = trimmed.slice(spaceIdx + 1);
      } else {
        url = trimmed;
        descriptor = '';
      }
      const proxied = toProxyPath(url);
      return proxied + (descriptor ? ' ' + descriptor : '');
    });
    return ' srcset=' + quote + parts.join(', ') + quote;
  });

  // Rewrite CSS url() in inline styles
  html = html.replace(/style\s*=\s*("[^"]*"|'[^']*')/gi, function(match, quoted) {
    const quote = quoted[0];
    const raw = quoted.slice(1, -1);
    const rewritten = rewriteCSSUrls(raw, baseURL);
    return ' style=' + quote + rewritten + quote;
  });

  // Inject a <base> tag so relative URLs resolve correctly for any we missed
  if (!html.includes('<base ')) {
    const baseTag = '<base href="' + baseURL + '">';
    const headOpenMatch = html.match(/<head[^>]*>/i);
    if (headOpenMatch) {
      html = html.replace(headOpenMatch[0], headOpenMatch[0] + baseTag);
    } else {
      html = baseTag + html;
    }
  }

  return html;
}

// Rewrite url() references in CSS to go through the proxy
function rewriteCSSUrls(css, baseURL) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, function(match, quote, rawUrl) {
    if (!rawUrl || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:') ||
        rawUrl.startsWith('#') || rawUrl.startsWith('javascript:')) {
      return match;
    }
    try {
      const abs = new URL(rawUrl, baseURL);
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return match;
      return 'url(' + quote + '/proxy/' + encodeURIComponent(abs.href) + quote + ')';
    } catch(e) {
      return match;
    }
  });
}

// Rewrite @import in CSS
function rewriteCSSImports(css, baseURL) {
  return css.replace(/@import\s+(?:url\()?['"]([^'"]+)['"]\)?/gi, function(match, rawUrl) {
    try {
      const abs = new URL(rawUrl, baseURL);
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return match;
      return '@import url("/proxy/' + encodeURIComponent(abs.href) + '")';
    } catch(e) {
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
