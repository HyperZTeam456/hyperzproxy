// Cloudflare Worker - Universal Reverse Proxy with Multi-Layer Shadow DOM Protection
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
  let targetPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  
  if (!targetPath) {
    return null;
  }
  
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
    // Continue with original targetPath
  }
  
  if (targetURL.startsWith('http://') || targetURL.startsWith('https://')) {
    if (search) targetURL += search;
    return targetURL;
  }
  
  if (search) {
    return 'https://' + targetURL + search;
  }
  return 'https://' + targetURL;
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
  
  // Root path - no URL specified
  if (pathname === '/' || pathname === '') {
    return new Response('url not specified', {
      headers: {
        'Content-Type': 'text/plain',
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

  // Check if this is CloudMoon-specific request (web.cloudmoonapp.com)
  if (pathname.startsWith('/web.cloudmoonapp.com') || pathname === '/web.cloudmoonapp.com/') {
    return new Response(getCloudMoonHTML(), {
      headers: {
        'Content-Type': 'text/html',
        'Permissions-Policy': 'accelerometer=*, gyroscope=*, camera=*, microphone=*, geolocation=*, hid=*, midi=*, clipboard-read=*, clipboard-write=*, xr-spatial-tracking=*, gamepad=*'
      }
    });
  }

  // Parse target URL from pathname
  const targetURL = parseTargetURL(pathname, url.search);
  
  if (!targetURL || !isValidURL(targetURL)) {
    return new Response('Invalid URL', { status: 400 });
  }
  
  // Check if this is a CloudMoon iframe request
  if (targetURL.includes('web.cloudmoonapp.com')) {
    return proxyCloudMoon(request);
  }
  
  // Check if this is an iframe request - if so, directly proxy
  const fetchDest = request.headers.get('Sec-Fetch-Dest');
  if (fetchDest === 'iframe') {
    return proxyRequest(request, targetURL);
  }
  
  // Browser navigation - return frame wrapper with multi-layer shadow DOM
  return new Response(getFrameWrapper(targetURL), {
    headers: {
      'Content-Type': 'text/html',
      'Permissions-Policy': 'accelerometer=*, gyroscope=*, camera=*, microphone=*, geolocation=*, hid=*, midi=*, clipboard-read=*, clipboard-write=*, xr-spatial-tracking=*, gamepad=*'
    }
  });
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
    html = blockAdsInHTML(html);
    
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
    document.addEventListener("DOMContentLoaded", function() {
      removeAds();
    });
  }
  
  window.addEventListener("load", function() {
    removeAds();
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

// Native CloudMoon proxy handler
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
  
  removeAds();
  
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      removeAds();
    });
  }
  
  window.addEventListener("load", function() {
    removeAds();
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
  // Block ad requests
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
    document.addEventListener("DOMContentLoaded", function() {
      removeAds();
    });
  }
  
  window.addEventListener("load", function() {
    removeAds();
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

function getCloudMoonHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CloudMoon</title>
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
        <button class="dock-btn" id="home-btn" onclick="goBack()" title="Home"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6"/></svg></button>
        <button class="dock-btn" id="fullscreen-btn" onclick="enterFullscreen()" title="Fullscreen"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg></button>
    </div>
    <script>
        const frameContainer = document.getElementById('frame-container');
        const homeBtn = document.getElementById('home-btn');
        const btnDock = document.getElementById('btn-dock');
        let isShowingGame = false;
        let mainURL = '/web.cloudmoonapp.com/';
        let currentIframe = null;
        const SANDBOX_HOME = 'allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock allow-top-navigation-by-user-activation';
        const SANDBOX_GAME = 'allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock allow-top-navigation-by-user-activation';
        const ALLOW_PERMISSIONS = 'accelerometer; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; clipboard-read; clipboard-write; xr-spatial-tracking; gamepad';
        const SHADOW_LAYERS = 4;
        function createMultiLayerShadowFrame(url, isGame = false) {
            frameContainer.innerHTML = '';
            let currentHost = document.createElement('div');
            currentHost.style.cssText = 'width:100%;height:100%;margin:0;padding:0;border:none;display:block;overflow:hidden;';
            currentHost.setAttribute('data-component', 'container');
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
                    iframe.setAttribute('sandbox', isGame ? SANDBOX_GAME : SANDBOX_HOME);
                    iframe.setAttribute('allow', ALLOW_PERMISSIONS);
                    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
                    iframe.setAttribute('importance', 'high');
                    iframe.setAttribute('loading', 'eager');
                    iframe.src = url;
                    shadowRoot.appendChild(iframe);
                    currentIframe = iframe;
                    iframe.addEventListener('load', () => { if(currentIframe) currentIframe.focus(); });
                }
            }
        }
        createMultiLayerShadowFrame(mainURL, false);
        document.addEventListener('click', (e) => { if (currentIframe && e.target !== currentIframe) currentIframe.focus(); });
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'LOAD_GAME') loadGame(event.data.url);
        });
        function loadGame(url) {
            let fixedURL = url;
            const workerDomain = window.location.origin;
            if (url.includes(workerDomain)) { fixedURL = url; }
            else if (url.includes('://')) { fixedURL = workerDomain + '/proxy/' + encodeURIComponent(url); }
            else if (url.startsWith('/')) { fixedURL = url; }
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
                try { currentIframe.contentWindow.postMessage({type: 'REQUEST_FULLSCREEN'}, '*'); }
                catch (e) { document.documentElement.requestFullscreen(); }
            } else { document.documentElement.requestFullscreen(); }
            btnDock.classList.add('hidden');
        }
        document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) btnDock.classList.remove('hidden'); });
    </script>
</body>
</html>\`;
}

function getFrameWrapper(targetURL) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loading...</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            width: 100vw;
            height: 100vh;
            background: #0d1117;
            overflow: hidden;
        }
        
        #frame-container {
            width: 100%;
            height: 100%;
        }
    </style>
</head>
<body>
    <div id="frame-container"></div>

    <script>
        const targetURL = '${targetURL.replace(/'/g, "\\'")}';
        const SHADOW_LAYERS = 4;
        const SANDBOX_ATTRS = 'allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock allow-top-navigation-by-user-activation';
        const ALLOW_PERMISSIONS = 'accelerometer; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; clipboard-read; clipboard-write; xr-spatial-tracking; gamepad';
        
        function generateRandomId() {
            return 'x' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        }
        
        function createMultiLayerShadowFrame(url) {
            const frameContainer = document.getElementById('frame-container');
            frameContainer.innerHTML = '';
            
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
                    
                    console.log(\`Shadow Layer \${i + 1} created\`);
                } else {
                    const iframe = document.createElement('iframe');
                    iframe.style.width = '100%';
                    iframe.style.height = '100%';
                    iframe.style.border = 'none';
                    iframe.style.margin = '0';
                    iframe.style.padding = '0';
                    iframe.style.display = 'block';
                    iframe.style.overflow = 'hidden';
                    
                    iframe.setAttribute('sandbox', SANDBOX_ATTRS);
                    iframe.setAttribute('allow', ALLOW_PERMISSIONS);
                    iframe.setAttribute('title', 'Proxied Content');
                    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
                    iframe.setAttribute('importance', 'high');
                    iframe.setAttribute('loading', 'eager');
                    iframe.setAttribute('data-frame-id', generateRandomId());
                    
                    iframe.src = '/proxy/' + encodeURIComponent(url);
                    
                    shadowRoot.appendChild(iframe);
                    
                    console.log(\`Final Shadow Layer \${SHADOW_LAYERS} with iframe created\`);
                }
            }
            
            console.log(\`\${SHADOW_LAYERS}-Layer Shadow DOM Protection Active\`);
        }
        
        createMultiLayerShadowFrame(targetURL);
        console.log('HyperZ Universal Proxy Loaded');
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
    "categories": ["productivity"]
  });
}

function getServiceWorker() {
  return `const CACHE_NAME = 'hyperz-proxy-v1';
const RUNTIME_CACHE = 'hyperz-proxy-runtime';

self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
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
          });
        }
        return response;
      })
      .catch((error) => {
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
});`;
}
