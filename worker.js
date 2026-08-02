import cmWorker from './cloudmoon-inplay.js';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const AD_PATTERNS = [
  'googlesyndication.com', 'doubleclick.net', 'googleadservices.com',
  'google-analytics.com', 'googletagmanager.com', 'googletagservices.com',
  'adservice.google.com', 'pagead2.googlesyndication.com',
  'tpc.googlesyndication.com', 'video-ad-stats.googlesyndication.com',
  'ads.google.com', 'adssettings.google.com', 'static.ads-twitter.com',
  'ads-api.twitter.com', 'ads.facebook.com', 'an.facebook.com',
  'adnxs.com', 'advertising.com', 'outbrain.com', 'taboola.com',
  'criteo.com', 'pubmatic.com', 'rubiconproject.com', 'openx.net',
  'adsafeprotected.com', 'moatads.com', 'scorecardresearch.com',
  '/ads/', '/ad/', '/advert/', '/advertisement/', '/adsense/',
  '/adserver/', '/analytics/', 'prebid', 'advertis', 'banner', 'popup'
];

function isAdRequest(url) {
  const u = url.toLowerCase();
  return AD_PATTERNS.some(p => u.includes(p));
}

// Check if a path is a CloudMoon entry path.
// Accepts /web.cloudmoonapp.com and /cloudmoonapp.com (with or without web.)
function isCloudMoonPath(pathname) {
  var cm = ['web.cloudmoonapp.com', 'cloudmoonapp.com'];
  for (var i = 0; i < cm.length; i++) {
    if (pathname === '/' + cm[i] || pathname.startsWith('/' + cm[i] + '/')) return true;
  }
  return false;
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // ── CORS preflight ──
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  // ── CloudMoon URLs: use the Cloudmoon-InPlay worker directly ──
  // When the path is /web.cloudmoonapp.com (or /cloudmoonapp.com), we delegate
  // to the imported Cloudmoon-InPlay worker which handles the shell, assets,
  // and game proxying. The request is rewritten to path "/" so the worker
  // serves the CloudMoon shell HTML. Sub-requests (/, /_app/, /proxy/, etc.)
  // are also delegated to the worker.
  if (isCloudMoonPath(pathname)) {
    // Rewrite the request to "/" so the CloudMoon worker serves the shell
    var cmRequest = new Request('https://' + url.host + '/', {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'manual'
    });
    var cmResponse = await cmWorker.fetch(cmRequest);
    // Add sandbox header to prevent the iframe from escaping the proxy
    var cmHeaders = new Headers(cmResponse.headers);
    cmHeaders.set('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; frame-src *;");
    cmHeaders.delete('X-Frame-Options');
    cmHeaders.delete('Frame-Options');
    var cmBody = await cmResponse.text();
    return new Response(cmBody, {
      status: cmResponse.status,
      statusText: cmResponse.statusText,
      headers: cmHeaders
    });
  }

  // ── CloudMoon internal paths (/, /_app/, /proxy/, /favicon.png, etc.) ──
  // These are sub-resource requests from the CloudMoon shell. Delegate to the
  // CloudMoon worker. We detect them by checking if the path doesn't look like
  // a domain (no dot in the first segment) or is a known internal path.
  if (isCloudMoonInternalPath(pathname)) {
    var intRequest = new Request('https://' + url.host + pathname + url.search, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'manual'
    });
    var intResponse = await cmWorker.fetch(intRequest);
    var intHeaders = new Headers(intResponse.headers);
    intHeaders.set('Access-Control-Allow-Origin', '*');
    intHeaders.delete('X-Frame-Options');
    intHeaders.delete('Frame-Options');
    intHeaders.delete('Content-Security-Policy');
    // Return the response body directly (don't .text() for non-HTML like images)
    return new Response(intResponse.body, {
      status: intResponse.status,
      statusText: intResponse.statusText,
      headers: intHeaders
    });
  }

  if (pathname === '/' || pathname === '') {
    return new Response('url not specified', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // ── Normal proxy: direct-fetch + <base> tag ──
  const targetURL = parseUniversalURL(pathname, url.search);
  if (!targetURL || !isValidURL(targetURL)) {
    return new Response('Invalid URL', { status: 400 });
  }

  return proxyDirectFetch(request, targetURL);
}

// Check if a path is a CloudMoon internal path (not a domain-like proxy path).
// CloudMoon internal paths: /, /_app/, /proxy/, /manifest.json, /sw.js,
// /favicon.png, /favicon.ico, /icon.svg, /icon-192.png, /icon-512.png
function isCloudMoonInternalPath(pathname) {
  if (pathname === '/' || pathname === '') return true;
  var known = ['/manifest.json', '/sw.js', '/favicon.png', '/favicon.ico',
               '/icon.svg', '/icon-192.png', '/icon-512.png'];
  if (known.indexOf(pathname) !== -1) return true;
  var firstSeg = pathname.slice(1).split('/')[0];
  if (firstSeg === '_app' || firstSeg === 'proxy') return true;
  // Check if the path starts with /proxy/ and targets cloudmoonapp.com
  if (pathname.startsWith('/proxy/')) {
    try {
      var decoded = decodeURIComponent(pathname.substring('/proxy/'.length));
      if (decoded.indexOf('cloudmoonapp.com') !== -1) return true;
    } catch(e) {}
  }
  return false;
}

function parseUniversalURL(pathname, search) {
  let targetPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  if (!targetPath) return null;

  if (targetPath.startsWith('proxy/')) {
    try {
      let decoded = decodeURIComponent(targetPath.substring('proxy/'.length));
      if (search) decoded += search;
      return decoded;
    } catch(e) { return null; }
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
  } catch(e) {}

  if (targetURL.startsWith('http://') || targetURL.startsWith('https://')) {
    if (search) targetURL += search;
    return targetURL;
  }

  return search ? 'https://' + targetURL + search : 'https://' + targetURL;
}

function isValidURL(url) {
  try { new URL(url); return true; } catch(e) { return false; }
}

// Direct-fetch proxy: fetch HTML, inject <base> tag, strip security headers,
// block ads. Assets load directly from the original site.
// Includes a sandbox to prevent the proxied page from escaping the proxy
// (blocking top-level redirects, preventing navigation away from the proxy).
async function proxyDirectFetch(request, targetURL) {
  if (isAdRequest(targetURL)) {
    return new Response('', { status: 204 });
  }

  const headers = new Headers();
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  const targetURLObj = new URL(targetURL);
  headers.set('Host', targetURLObj.host);
  headers.set('Referer', targetURLObj.origin + '/');

  let response;
  try {
    response = await fetch(targetURL, { method: 'GET', headers, redirect: 'manual' });
  } catch(error) {
    return new Response('Failed to fetch: ' + error.message, { status: 502 });
  }

  // Handle redirects: rewrite Location to go through the proxy
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('Location');
    if (location) {
      try {
        const absLocation = new URL(location, targetURL);
        const proxyLocation = '/' + absLocation.hostname + absLocation.pathname + absLocation.search + absLocation.hash;
        const redirectHeaders = new Headers(response.headers);
        redirectHeaders.set('Location', proxyLocation);
        redirectHeaders.set('Access-Control-Allow-Origin', '*');
        stripSecurityHeaders(redirectHeaders);
        return new Response(null, { status: response.status, headers: redirectHeaders });
      } catch(e) {}
    }
  }

  const contentType = (response.headers.get('Content-Type') || '').toLowerCase();

  // Non-HTML: pass through with CORS + security header stripping
  if (!contentType.includes('text/html')) {
    const passHeaders = new Headers(response.headers);
    passHeaders.set('Access-Control-Allow-Origin', '*');
    stripSecurityHeaders(passHeaders);
    // Add caching for static assets
    if (contentType.includes('image/') || contentType.includes('font/') ||
        contentType.includes('javascript') || contentType.includes('css')) {
      passHeaders.set('Cache-Control', 'public, max-age=86400');
    }
    return new Response(response.body, {
      status: response.status, statusText: response.statusText, headers: passHeaders
    });
  }

  // HTML: inject <base>, strip headers, block ads, add sandbox
  let html = await response.text();
  html = blockAdsInHTML(html);

  // <base> tag so relative URLs resolve against the original site
  const baseTag = '<base href="' + targetURL + '">';
  html = injectInHead(html, baseTag);

  // Sandbox script: prevents the page from escaping the proxy.
  // - Blocks top-level navigation (window.top, window.parent, location.href)
  // - Rewrites window.open to stay in the proxy
  // - Blocks history navigation away from the proxy
  // - Intercepts form submissions to keep them proxied
  const sandboxScript = `<script>
(function(){
  // Block top-level navigation
  try { Object.defineProperty(window.top, 'location', { get: function(){ return window.location; }, set: function(){}, configurable: false }); } catch(e) {}
  // Intercept window.open — keep it inside the iframe
  var origOpen = window.open;
  window.open = function(url, target, features) {
    if (url && typeof url === 'string') {
      try {
        var abs = new URL(url, document.baseURI);
        if (abs.protocol === 'http:' || abs.protocol === 'https:') {
          url = '/' + abs.hostname + abs.pathname + abs.search + abs.hash;
        }
      } catch(e) {}
    }
    return origOpen.call(this, url, '_self', features);
  };
  // Intercept location assignments that would escape the proxy
  var origAssign = window.location.assign.bind(window.location);
  window.location.assign = function(url) {
    if (url && typeof url === 'string' && !url.startsWith(location.origin) && !url.startsWith('/')) {
      try {
        var abs = new URL(url, document.baseURI);
        if (abs.protocol === 'http:' || abs.protocol === 'https:') {
          url = '/' + abs.hostname + abs.pathname + abs.search + abs.hash;
        }
      } catch(e) {}
    }
    return origAssign(url);
  };
  var origReplace = window.location.replace.bind(window.location);
  window.location.replace = function(url) {
    if (url && typeof url === 'string' && !url.startsWith(location.origin) && !url.startsWith('/')) {
      try {
        var abs = new URL(url, document.baseURI);
        if (abs.protocol === 'http:' || abs.protocol === 'https:') {
          url = '/' + abs.hostname + abs.pathname + abs.search + abs.hash;
        }
      } catch(e) {}
    }
    return origReplace(url);
  };
  // Intercept history.pushState/replaceState
  var origPush = history.pushState;
  history.pushState = function(state, title, url) {
    if (url && typeof url === 'string' && !url.startsWith(location.origin) && !url.startsWith('/') && !url.startsWith('#')) {
      try {
        var abs = new URL(url, document.baseURI);
        if (abs.protocol === 'http:' || abs.protocol === 'https:') {
          url = '/' + abs.hostname + abs.pathname + abs.search + abs.hash;
        }
      } catch(e) {}
    }
    return origPush.apply(this, arguments);
  };
  var origReplaceState = history.replaceState;
  history.replaceState = function(state, title, url) {
    if (url && typeof url === 'string' && !url.startsWith(location.origin) && !url.startsWith('/') && !url.startsWith('#')) {
      try {
        var abs = new URL(url, document.baseURI);
        if (abs.protocol === 'http:' || abs.protocol === 'https:') {
          url = '/' + abs.hostname + abs.pathname + abs.search + abs.hash;
        }
      } catch(e) {}
    }
    return origReplaceState.apply(this, arguments);
  };
  // Block escape via meta refresh
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (node.tagName === 'META' && (node.httpEquiv === 'refresh' || node.getAttribute('http-equiv') === 'refresh')) {
          node.remove();
        }
      });
    });
  });
  if (document.head) observer.observe(document.head, { childList: true });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
})();
</script>`;

  // Ad blocker
  const adBlock = `<style>.a-div-horizontal,.a-div-vertical,.a-div-placeholder,.a-div-box,ins.adsbygoogle,[data-ad-slot],[data-ad-client],iframe[src*="googlesyndication"],iframe[src*="doubleclick"]{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;position:absolute!important;width:0!important;height:0!important;overflow:hidden!important}</style><script>(function(){function r(){var s=["ins.adsbygoogle","[data-ad-slot]","[data-ad-client]","iframe[src*=googlesyndication]","iframe[src*=doubleclick]",".a-div-horizontal",".a-div-vertical",".a-div-placeholder",".a-div-box"];s.forEach(function(s){document.querySelectorAll(s).forEach(function(e){e.style.display="none";try{e.remove()}catch(_){}})})}r();document.readyState==="loading"&&document.addEventListener("DOMContentLoaded",r);window.addEventListener("load",r);setInterval(r,500);if(document.body)new MutationObserver(function(){r()}).observe(document.body,{childList:true,subtree:true})})();</script>`;

  html = injectInHead(html, sandboxScript);
  html = injectInHead(html, adBlock);

  const newHeaders = new Headers(response.headers);
  newHeaders.set('Content-Type', 'text/html; charset=utf-8');
  newHeaders.set('Access-Control-Allow-Origin', '*');
  stripSecurityHeaders(newHeaders);

  return new Response(html, {
    status: response.status, statusText: response.statusText, headers: newHeaders
  });
}

function stripSecurityHeaders(h) {
  h.delete('Content-Security-Policy');
  h.delete('Content-Security-Policy-Report-Only');
  h.delete('X-Frame-Options');
  h.delete('Frame-Options');
  h.delete('X-Content-Type-Options');
  h.delete('Strict-Transport-Security');
  h.delete('Cross-Origin-Embedder-Policy');
  h.delete('Cross-Origin-Opener-Policy');
  h.delete('Cross-Origin-Resource-Policy');
  h.delete('Permissions-Policy');
}

function injectInHead(html, content) {
  var headMatch = html.match(/<head[^>]*>/i);
  if (headMatch) return html.replace(headMatch[0], headMatch[0] + content);
  if (html.includes('</head>')) return html.replace('</head>', content + '</head>');
  return content + html;
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
