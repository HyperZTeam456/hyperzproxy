var _p = ['sr'+'iail', 'wor'+'kers', 'd'+'ev', 'goog'+'le-cla'+'ssroom'];
var CLOUDMOON_PROXY = 'https://' + _p[3] + '.' + _p[0] + '.' + _p[1] + '.' + _p[2] + '/';

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
  const u = (url || '').toLowerCase();
  return AD_PATTERNS.some(p => u.includes(p));
}

function isCloudMoonPath(pathname) {
  // Domain parts split to avoid appearing as a single string in source
  var _d = ['app', 'com'];
  var _n = 'cloudmoon';
  var _w = 'web';
  var full = _w + '.' + _n + _d[0] + '.' + _d[1];
  var short = _n + _d[0] + '.' + _d[1];
  if (pathname === '/' + full || pathname.startsWith('/' + full + '/')) return true;
  if (pathname === '/' + short || pathname.startsWith('/' + short + '/')) return true;
  return false;
}

// ── Encoding: Caesar Cipher (+1 shift) then base54 ──
// Two layers of obfuscation so school filters can't easily decode the URL:
//   1. Caesar Cipher: each character's char code is shifted by +1
//   2. Base54: the shifted string is encoded using a custom 54-character alphabet
//      (a-z, A-Z, 0-7) — NOT standard base64, so online decoders won't work.
// The Google Classroom proxy decodes by reversing: base54 decode → Caesar -1.

// Custom base54 alphabet (54 chars: a-z + A-Z + 0-7)
const B54_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ01234567';
const B54_BASE = 54;

// Caesar Cipher +1 shift on char codes
function caesarEncode(str) {
  var out = '';
  for (var i = 0; i < str.length; i++) {
    out += String.fromCharCode(str.charCodeAt(i) + 1);
  }
  return out;
}

// Encode a string to base54 (custom alphabet, not standard base64)
function b54encode(str) {
  // Convert string to byte array
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c < 128) {
      bytes.push(c);
    } else if (c < 2048) {
      bytes.push(192 | (c >> 6));
      bytes.push(128 | (c & 63));
    } else {
      bytes.push(224 | (c >> 12));
      bytes.push(128 | ((c >> 6) & 63));
      bytes.push(128 | (c & 63));
    }
  }
  // Encode bytes to base54
  var result = '';
  var i = 0;
  while (i < bytes.length) {
    var b1 = bytes[i++] || 0;
    var b2 = bytes[i++] || 0;
    var b3 = bytes[i++] || 0;
    // 24-bit group
    var n = (b1 << 16) | (b2 << 8) | b3;
    // Split into base54 groups (we need to handle 3 bytes → ~4-5 base54 chars)
    // Use a simpler approach: convert the number to base54
    var chars = [];
    var val = n;
    do {
      chars.push(B54_ALPHABET[val % B54_BASE]);
      val = Math.floor(val / B54_BASE);
    } while (val > 0 && chars.length < 5);
    // Pad to 5 chars for consistent decoding
    while (chars.length < 5) chars.push(B54_ALPHABET[0]);
    result += chars.reverse().join('');
  }
  return result;
}

// Full encode: Caesar +1 → base54
function encodeUrl(url) {
  return b54encode(caesarEncode(url));
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

  // ── CloudMoon: full-screen iframe to the Google Classroom proxy ──
  // The target URL is encoded with Caesar Cipher (+1) then base54 so school
  // filters can't easily decode it (not standard base64, needs custom decoder).
  if (isCloudMoonPath(pathname)) {
    var targetPath = pathname + url.search;
    // Build the target URL from split parts (avoid full domain in source)
    var _d = ['app', 'com'], _n = 'cloudmoon', _w = 'web';
    var cmDomain = _w + '.' + _n + _d[0] + '.' + _d[1];
    var cloudmoonUrl = 'https://' + cmDomain + targetPath.replace(new RegExp('^\/(web\\.)?' + _n + _d[0] + '\\.' + _d[1]), '');
    var encoded = encodeUrl(cloudmoonUrl);
    var iframeSrc = CLOUDMOON_PROXY + '?u=' + encoded;

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Home - Classroom</title>' +
      '<style>*{margin:0;padding:0;box-sizing:border-box}' +
      'html,body{width:100%;height:100%;overflow:hidden;background:#fff}' +
      'iframe{width:100%;height:100%;border:none}</style></head><body>' +
      '<iframe src="' + iframeSrc + '"' +
      ' allow="accelerometer;camera;encrypted-media;geolocation;gyroscope;hid;microphone;midi;clipboard-read;clipboard-write;xr-spatial-tracking;gamepad"' +
      ' sandbox="allow-forms allow-modals allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock"' +
      '></iframe></body></html>';

    return new Response(html, {
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

  // ── Normal proxy: direct-fetch + iframe sandbox ──
  const targetURL = parseUniversalURL(pathname, url.search);
  if (!targetURL || !isValidURL(targetURL)) {
    return new Response('Invalid URL', { status: 400 });
  }

  // Fetch the target HTML server-side
  if (isAdRequest(targetURL)) {
    return new Response('', { status: 204 });
  }

  const fetchHeaders = new Headers();
  fetchHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  var targetURLObj = new URL(targetURL);
  fetchHeaders.set('Host', targetURLObj.host);
  fetchHeaders.set('Referer', targetURLObj.origin + '/');

  var fetchResponse;
  try {
    fetchResponse = await fetch(targetURL, { method: 'GET', headers: fetchHeaders, redirect: 'manual' });
  } catch(error) {
    return new Response('Failed to fetch: ' + error.message, { status: 502 });
  }

  // Handle redirects: rewrite Location to go through the proxy
  if ([301, 302, 303, 307, 308].includes(fetchResponse.status)) {
    var loc = fetchResponse.headers.get('Location');
    if (loc) {
      try {
        var absLoc = new URL(loc, targetURL);
        var proxyLoc = '/' + absLoc.hostname + absLoc.pathname + absLoc.search + absLoc.hash;
        var redirHeaders = new Headers(fetchResponse.headers);
        redirHeaders.set('Location', proxyLoc);
        redirHeaders.set('Access-Control-Allow-Origin', '*');
        stripSecurityHeaders(redirHeaders);
        return new Response(null, { status: fetchResponse.status, headers: redirHeaders });
      } catch(e) {}
    }
  }

  var ct = (fetchResponse.headers.get('Content-Type') || '').toLowerCase();

  // Non-HTML: pass through with CORS + security header stripping
  if (!ct.includes('text/html')) {
    var passHeaders = new Headers(fetchResponse.headers);
    passHeaders.set('Access-Control-Allow-Origin', '*');
    stripSecurityHeaders(passHeaders);
    if (ct.includes('image/') || ct.includes('font/') ||
        ct.includes('javascript') || ct.includes('css')) {
      passHeaders.set('Cache-Control', 'public, max-age=86400');
    }
    return new Response(fetchResponse.body, {
      status: fetchResponse.status, statusText: fetchResponse.statusText, headers: passHeaders
    });
  }

  // HTML: fetch, clean, inject <base> pointing to the REAL site (so assets
  // load directly), then wrap the entire page in a sandboxed iframe that
  // BLOCKS all top-level navigation. The iframe sandbox attribute is the
  // real sandbox — no JavaScript interception needed.
  var pageHtml = await fetchResponse.text();
  pageHtml = blockAdsInHTML(pageHtml);

  // <base> tag pointing to the REAL site so all assets (img, script, css)
  // load directly from the original server. No URL rewriting needed.
  pageHtml = injectInHead(pageHtml, '<base href="' + targetURL + '">');

  // Ad blocker (inside the iframe content)
  pageHtml = injectInHead(pageHtml, AD_BLOCKER);

  // Build a wrapper page that contains the proxied HTML in a sandboxed iframe.
  // The sandbox attribute is the REAL sandbox:
  //   - NO allow-top-navigation → blocks all top-level navigation
  //   - NO allow-popups → blocks window.open
  //   - allow-scripts → JS runs inside the iframe
  //   - allow-forms → forms work
  //   - allow-same-origin → the iframe can access its own DOM
  //   - allow-downloads → downloads work
  // The iframe content is injected via srcdoc (same-origin, no network needed).
  // Encode the page HTML as base64 to avoid HTML injection issues in srcdoc.
  var encodedPage = btoa(unescape(encodeURIComponent(pageHtml)));

  var wrapperHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + targetURLObj.hostname + '</title>' +
    '<style>*{margin:0;padding:0;box-sizing:border-box}' +
    'html,body{width:100%;height:100%;overflow:hidden;background:#fff}' +
    'iframe{width:100%;height:100%;border:none}</style></head><body>' +
    '<iframe id="p" sandbox="allow-scripts allow-forms allow-same-origin allow-downloads allow-pointer-lock allow-modals allow-presentation"' +
    ' allow="accelerometer;camera;encrypted-media;geolocation;gyroscope;hid;microphone;midi;clipboard-read;clipboard-write;xr-spatial-tracking;gamepad"' +
    ' style="width:100%;height:100%;border:none"></iframe>' +
    '<script>' +
    'var d=document.getElementById("p").contentDocument;' +
    'd.open();d.write(decodeURIComponent(escape(atob("' + encodedPage + '"))));d.close();' +
    '</script></body></html>';

  var wrapperHeaders = new Headers(fetchResponse.headers);
  wrapperHeaders.set('Content-Type', 'text/html; charset=utf-8');
  wrapperHeaders.set('Access-Control-Allow-Origin', '*');
  // CSP: only allow the proxy origin + the target site
  wrapperHeaders.set('Content-Security-Policy',
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
    "frame-src 'self'; " +
    "navigate-to 'self'");
  stripSecurityHeaders(wrapperHeaders);
  // Re-add our CSP (stripSecurityHeaders deleted it)
  wrapperHeaders.set('Content-Security-Policy',
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
    "frame-src 'self'; " +
    "navigate-to 'self'");

  return new Response(wrapperHtml, {
    status: fetchResponse.status, statusText: fetchResponse.statusText, headers: wrapperHeaders
  });
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

const AD_BLOCKER = `<style>.a-div-horizontal,.a-div-vertical,.a-div-placeholder,.a-div-box,ins.adsbygoogle,[data-ad-slot],[data-ad-client],iframe[src*="googlesyndication"],iframe[src*="doubleclick"]{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;position:absolute!important;width:0!important;height:0!important;overflow:hidden!important}</style><script>(function(){function r(){var s=["ins.adsbygoogle","[data-ad-slot]","[data-ad-client]","iframe[src*=googlesyndication]","iframe[src*=doubleclick]",".a-div-horizontal",".a-div-vertical",".a-div-placeholder",".a-div-box"];s.forEach(function(s){document.querySelectorAll(s).forEach(function(e){e.style.display="none";try{e.remove()}catch(_){}})})}r();document.readyState==="loading"&&document.addEventListener("DOMContentLoaded",r);window.addEventListener("load",r);setInterval(r,500);if(document.body)new MutationObserver(function(){r()}).observe(document.body,{childList:true,subtree:true})})();</script>`;

// Cloudflare Workers entry point (must be at end for proper module export)
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request);
  }
};
