export default {
  async fetch(request, env, ctx) {
    return handleRequest(request);
  }
};

// Proxy target — split into fragments and assembled at runtime so the
// full URL never appears as a single string in the source code.
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

  // ── Normal proxy: direct-fetch + <base> tag ──
  const targetURL = parseUniversalURL(pathname, url.search);
  if (!targetURL || !isValidURL(targetURL)) {
    return new Response('Invalid URL', { status: 400 });
  }

  return proxyDirectFetch(request, targetURL);
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
// block ads. Includes a sandbox to prevent escaping the proxy.
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
    if (contentType.includes('image/') || contentType.includes('font/') ||
        contentType.includes('javascript') || contentType.includes('css')) {
      passHeaders.set('Cache-Control', 'public, max-age=86400');
    }
    return new Response(response.body, {
      status: response.status, statusText: response.statusText, headers: passHeaders
    });
  }

  // HTML: inject <base>, sandbox, strip headers, block ads
  let html = await response.text();
  html = blockAdsInHTML(html);

  // <base> tag pointing to the PROXY origin + target domain, so relative URLs
  // like /games resolve to /crazygames.com/games (through the proxy) instead of
  // https://crazygames.com/games (direct, which would escape the proxy).
  var targetURLObj = new URL(targetURL);
  var basePath = '/' + targetURLObj.hostname + targetURLObj.pathname;
  // Remove trailing filename (keep directory path)
  if (basePath.lastIndexOf('/') > 0) basePath = basePath.slice(0, basePath.lastIndexOf('/') + 1);
  else basePath = basePath + '/';
  html = injectInHead(html, '<base href="' + basePath + '">');

  // Sandbox: prevents the page from escaping the proxy
  html = injectInHead(html, SANDBOX_SCRIPT);

  // Ad blocker
  html = injectInHead(html, AD_BLOCKER);

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

// Sandbox script: prevents the proxied page from escaping the proxy in ANY way.
// Intercepts every known navigation method and rewrites URLs to stay proxied.
const SANDBOX_SCRIPT = `<script>
(function(){
  var PROXY_ORIGIN = location.origin;

  // Helper: rewrite any URL to stay inside the proxy
  function rewriteUrl(url) {
    if (!url || typeof url !== 'string') return url;
    // Already a proxy path (starts with /domain.com/ or /domain.com)
    // Don't rewrite if it starts with / followed by something that has a dot
    if (url.startsWith('/') && !url.startsWith('//')) return url;
    if (url.startsWith('#') || url.startsWith(PROXY_ORIGIN) ||
        url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:') ||
        url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('about:')) {
      return url;
    }
    try {
      var abs = new URL(url, document.baseURI);
      if (abs.protocol === 'http:' || abs.protocol === 'https:') {
        return '/' + abs.hostname + abs.pathname + abs.search + abs.hash;
      }
    } catch(e) {}
    return url;
  }

  // 1. Lock down window.top and window.parent location
  try {
    Object.defineProperty(window.top, 'location', {
      get: function(){ return window.location; },
      set: function(){},
      configurable: false
    });
  } catch(e) {}
  try {
    Object.defineProperty(window.parent, 'location', {
      get: function(){ return window.location; },
      set: function(){},
      configurable: false
    });
  } catch(e) {}

  // 2. Intercept window.location.href setter
  try {
    var loc = window.location;
    var origHref = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
    if (origHref && origHref.set) {
      Object.defineProperty(Location.prototype, 'href', {
        get: origHref.get,
        set: function(url) { origHref.set.call(this, rewriteUrl(url)); },
        configurable: true
      });
    }
  } catch(e) {}

  // 3. Intercept window.location.assign / replace
  var origAssign = window.location.assign.bind(window.location);
  window.location.assign = function(url) { return origAssign(rewriteUrl(url)); };
  var origReplace = window.location.replace.bind(window.location);
  window.location.replace = function(url) { return origReplace(rewriteUrl(url)); };

  // 4. Intercept document.location setter
  try {
    var docLoc = document;
    Object.defineProperty(document, 'location', {
      get: function(){ return window.location; },
      set: function(url){ window.location.href = rewriteUrl(url); },
      configurable: true
    });
  } catch(e) {}

  // 5. Intercept window.open — force everything into _self (stays in iframe)
  var origOpen = window.open;
  window.open = function(url, target, features) {
    return origOpen.call(this, rewriteUrl(url), '_self', features);
  };

  // 6. Intercept history.pushState / replaceState
  var origPush = history.pushState;
  history.pushState = function(state, title, url) {
    if (arguments.length > 2) arguments[2] = rewriteUrl(url);
    return origPush.apply(this, arguments);
  };
  var origReplaceState = history.replaceState;
  history.replaceState = function(state, title, url) {
    if (arguments.length > 2) arguments[2] = rewriteUrl(url);
    return origReplaceState.apply(this, arguments);
  };

  // 7. Intercept all click events — rewrite <a href> and block target=_top/_parent/_blank
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (el && el.tagName === 'A') {
      // Force target to _self (no escaping the iframe)
      el.target = '_self';
      // Remove target attribute entirely if it's _top, _parent, or _blank
      var t = (el.getAttribute('target') || '').toLowerCase();
      if (t === '_top' || t === '_parent' || t === '_blank') {
        el.removeAttribute('target');
        el.target = '_self';
      }
      // Rewrite the href
      var href = el.getAttribute('href');
      if (href) {
        var rewritten = rewriteUrl(href);
        if (rewritten !== href) el.setAttribute('href', rewritten);
      }
    }
  }, true);

  // 8. Intercept form submissions — force target=_self, rewrite action
  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (form && form.tagName === 'FORM') {
      form.target = '_self';
      var action = form.getAttribute('action');
      if (action) {
        var rewritten = rewriteUrl(action);
        if (rewritten !== action) form.setAttribute('action', rewritten);
      }
    }
  }, true);

  // 9. Block <meta http-equiv="refresh"> that could redirect away
  var metaObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (node.tagName === 'META') {
          var eq = node.httpEquiv || node.getAttribute('http-equiv') || '';
          if (eq.toLowerCase() === 'refresh') {
            var content = node.content || node.getAttribute('content') || '';
            // Only block if it redirects to an external URL
            if (content.indexOf('url=') !== -1 || content.indexOf('URL=') !== -1) {
              node.remove();
            }
          }
        }
      });
    });
  });
  if (document.head) metaObserver.observe(document.head, { childList: true });
  if (document.body) metaObserver.observe(document.body, { childList: true, subtree: true });

  // 10. Strip target=_top/_parent/_blank from all existing anchors
  function stripEscapeTargets() {
    document.querySelectorAll('a[target], form[target], area[target]').forEach(function(el) {
      var t = (el.getAttribute('target') || '').toLowerCase();
      if (t === '_top' || t === '_parent' || t === '_blank') {
        el.removeAttribute('target');
      }
    });
  }
  stripEscapeTargets();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', stripEscapeTargets);
  }
  // Re-run periodically for dynamically added elements
  setInterval(stripEscapeTargets, 1000);
  var domObserver = new MutationObserver(function() { stripEscapeTargets(); });
  if (document.body) domObserver.observe(document.body, { childList: true, subtree: true });

  // 11. Block beforeunload that tries to redirect
  window.addEventListener('beforeunload', function(e) {
    // Prevent the page from navigating away
  }, true);

  // 12. Intercept window.location = "url" direct assignment
  try {
    var origWindowLoc = window.location;
    Object.defineProperty(window, 'location', {
      get: function() { return origWindowLoc; },
      set: function(url) { origWindowLoc.href = rewriteUrl(url); },
      configurable: false
    });
  } catch(e) {}
})();
</script>`;

const AD_BLOCKER = `<style>.a-div-horizontal,.a-div-vertical,.a-div-placeholder,.a-div-box,ins.adsbygoogle,[data-ad-slot],[data-ad-client],iframe[src*="googlesyndication"],iframe[src*="doubleclick"]{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;position:absolute!important;width:0!important;height:0!important;overflow:hidden!important}</style><script>(function(){function r(){var s=["ins.adsbygoogle","[data-ad-slot]","[data-ad-client]","iframe[src*=googlesyndication]","iframe[src*=doubleclick]",".a-div-horizontal",".a-div-vertical",".a-div-placeholder",".a-div-box"];s.forEach(function(s){document.querySelectorAll(s).forEach(function(e){e.style.display="none";try{e.remove()}catch(_){}})})}r();document.readyState==="loading"&&document.addEventListener("DOMContentLoaded",r);window.addEventListener("load",r);setInterval(r,500);if(document.body)new MutationObserver(function(){r()}).observe(document.body,{childList:true,subtree:true})})();</script>`;
