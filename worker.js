addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const CLOUDMOON_PROXY = 'https://google-classroom.sriail.workers.dev/';

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

  // ── CloudMoon: return an HTML page that IFRAMES the google-classroom proxy ──
  // When the user visits /web.cloudmoonapp.com (or /cloudmoonapp.com), we return
  // a full-screen iframe pointing to https://google-classroom.sriail.workers.dev/
  // which is the actual CloudMoon proxy. No redirect — the iframe loads inline.
  if (isCloudMoonPath(pathname)) {
    var cmHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CloudMoon</title><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:#0d1117}iframe{width:100%;height:100%;border:none}</style></head><body><iframe src="' + CLOUDMOON_PROXY + '" allow="accelerometer;camera;encrypted-media;geolocation;gyroscope;hid;microphone;midi;clipboard-read;clipboard-write;xr-spatial-tracking;gamepad" sandbox="allow-forms allow-modals allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock"></iframe></body></html>';
    return new Response(cmHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Permissions-Policy': 'accelerometer=*, gyroscope=*, camera=*, microphone=*, geolocation=*, hid=*, midi=*, clipboard-read=*, clipboard-write=*, xr-spatial-tracking=*, gamepad=*'
      }
    });
  }

  if (pathname === '/' || pathname === '') {
    return new Response('url not specified', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // ── Normal proxy: direct-fetch + <base> tag (like HyperZWeb semi-proxy) ──
  const targetURL = parseUniversalURL(pathname, url.search);
  if (!targetURL || !isValidURL(targetURL)) {
    return new Response('Invalid URL', { status: 400 });
  }

  return proxyDirectFetch(request, targetURL);
}

function parseUniversalURL(pathname, search) {
  let targetPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  if (!targetPath) return null;

  // /proxy/encodedURL format
  if (targetPath.startsWith('proxy/')) {
    try {
      let decoded = decodeURIComponent(targetPath.substring('proxy/'.length));
      if (search) decoded += search;
      return decoded;
    } catch(e) { return null; }
  }

  // Direct domain format: /example.com/path
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
// block ads. Assets load directly from the original site (no per-asset proxy).
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
    response = await fetch(targetURL, { method: 'GET', headers, redirect: 'follow' });
  } catch(error) {
    return new Response('Failed to fetch: ' + error.message, { status: 502 });
  }

  const contentType = (response.headers.get('Content-Type') || '').toLowerCase();

  // Non-HTML: pass through with CORS + security header stripping
  if (!contentType.includes('text/html')) {
    const passHeaders = new Headers(response.headers);
    passHeaders.set('Access-Control-Allow-Origin', '*');
    stripSecurityHeaders(passHeaders);
    return new Response(response.body, {
      status: response.status, statusText: response.statusText, headers: passHeaders
    });
  }

  // HTML: inject <base>, strip headers, block ads
  let html = await response.text();
  html = blockAdsInHTML(html);

  // <base> tag so relative URLs resolve against the original site
  const baseTag = '<base href="' + targetURL + '">';
  html = injectInHead(html, baseTag);

  // Ad blocker
  const adBlock = '<style>.a-div-horizontal,.a-div-vertical,.a-div-placeholder,.a-div-box,ins.adsbygoogle,[data-ad-slot],[data-ad-client],iframe[src*="googlesyndication"],iframe[src*="doubleclick"]{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;position:absolute!important;width:0!important;height:0!important;overflow:hidden!important}</style><script>(function(){function r(){var s=["ins.adsbygoogle","[data-ad-slot]","[data-ad-client]","iframe[src*=googlesyndication]","iframe[src*=doubleclick]",".a-div-horizontal",".a-div-vertical",".a-div-placeholder",".a-div-box"];s.forEach(function(s){document.querySelectorAll(s).forEach(function(e){e.style.display="none";try{e.remove()}catch(_){}})})}r();document.readyState==="loading"&&document.addEventListener("DOMContentLoaded",r);window.addEventListener("load",r);setInterval(r,500);if(document.body)new MutationObserver(function(){r()}).observe(document.body,{childList:true,subtree:true})})();</script>';
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
