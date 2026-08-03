/**
 * HyperZProxy — Universal reverse proxy with CloudMoon iframe + ad blocking
 * OPTIMIZED FOR GAMES - v3.0
 */

// Proxy target
var _p = ['sr'+'iail', 'wor'+'kers', 'd'+'ev', 'goog'+'le-cla'+'ssroom'];
var CLOUDMOON_PROXY = 'https://' + _p[3] + '.' + _p[0] + '.' + _p[1] + '.' + _p[2] + '/';

var AD_PATTERNS = [
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

// Game sites that need ultra-lightweight mode
var GAME_DOMAINS = [
  'crazygames.com', 'poki.com', 'miniclip.com', 'kongregate.com',
  'newgrounds.com', 'armorgames.com', 'y8.com', 'friv.com',
  'clickgames.com', 'gamepix.com', 'gamegarden.com'
];

function isAdRequest(u) {
  u = (u || '').toLowerCase();
  for (var i = 0; i < AD_PATTERNS.length; i++) { if (u.indexOf(AD_PATTERNS[i]) !== -1) return true; }
  return false;
}

function isCloudMoonPath(pathname) {
  var _d = ['app', 'com'], _n = 'cloudmoon', _w = 'web';
  var full = _w + '.' + _n + _d[0] + '.' + _d[1];
  var short = _n + _d[0] + '.' + _d[1];
  if (pathname === '/' + full || pathname.indexOf('/' + full + '/') === 0) return true;
  if (pathname === '/' + short || pathname.indexOf('/' + short + '/') === 0) return true;
  return false;
}

var B54_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ01234567';
var B54_BASE = 54;

function caesarEncode(str) {
  var out = '';
  for (var i = 0; i < str.length; i++) out += String.fromCharCode(str.charCodeAt(i) + 1);
  return out;
}

function b54encode(str) {
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c < 128) bytes.push(c);
    else if (c < 2048) { bytes.push(192 | (c >> 6)); bytes.push(128 | (c & 63)); }
    else { bytes.push(224 | (c >> 12)); bytes.push(128 | ((c >> 6) & 63)); bytes.push(128 | (c & 63)); }
  }
  var result = '';
  var i = 0;
  while (i < bytes.length) {
    var b1 = bytes[i++] || 0, b2 = bytes[i++] || 0, b3 = bytes[i++] || 0;
    var n = (b1 << 16) | (b2 << 8) | b3;
    var chars = [], val = n;
    do { chars.push(B54_ALPHABET[val % B54_BASE]); val = Math.floor(val / B54_BASE); } while (val > 0 && chars.length < 5);
    while (chars.length < 5) chars.push(B54_ALPHABET[0]);
    result += chars.reverse().join('');
  }
  return result;
}

function encodeUrl(url) { return b54encode(caesarEncode(url)); }

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
  var m = html.match(/<head[^>]*>/i);
  if (m) return html.replace(m[0], m[0] + content);
  if (html.indexOf('</head>') !== -1) return html.replace('</head>', content + '</head>');
  return content + html;
}

class SrcAttrRewriter {
  constructor(baseURL, workerOrigin, attr) {
    this.baseURL = baseURL;
    this.workerOrigin = workerOrigin;
    this.attr = attr;
  }
  element(el) {
    var src = el.getAttribute(this.attr);
    if (!src) return;
    if (src.indexOf('data:') === 0 || src.indexOf('blob:') === 0) return;
    if (src.indexOf('javascript:') === 0) return;
    if (src.indexOf('/proxy/') === 0) return;
    var abs;
    try { abs = new URL(src, this.baseURL); } catch(e) { return; }
    if (abs.protocol === 'data:' || abs.protocol === 'blob:') return;
    el.setAttribute(this.attr, this.workerOrigin + '/proxy/' + abs.host + abs.pathname + abs.search);
  }
}

async function rewriteIframesAndAssets(resp, baseURL, workerOrigin) {
  var rewriter = new HTMLRewriter()
    .on('iframe[src]', new SrcAttrRewriter(baseURL, workerOrigin, 'src'))
    .on('script[src]', new SrcAttrRewriter(baseURL, workerOrigin, 'src'))
    .on('img[src]', new SrcAttrRewriter(baseURL, workerOrigin, 'src'))
    .on('link[href]', new SrcAttrRewriter(baseURL, workerOrigin, 'href'))
    .on('source[src]', new SrcAttrRewriter(baseURL, workerOrigin, 'src'))
    .on('video[src]', new SrcAttrRewriter(baseURL, workerOrigin, 'src'))
    .on('audio[src]', new SrcAttrRewriter(baseURL, workerOrigin, 'src'));
  var transformed = rewriter.transform(resp);
  return await transformed.text();
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

var AD_BLOCKER = '<style>.a-div-horizontal,.a-div-vertical,.a-div-placeholder,.a-div-box,ins.adsbygoogle,[data-ad-slot],[data-ad-client],iframe[src*="googlesyndication"],iframe[src*="doubleclick"]{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;position:absolute!important;width:0!important;height:0!important;overflow:hidden!important}</style>';

// ULTRA LIGHTWEIGHT for games - minimal overhead
var NAV_BLOCKER_LIGHT = '<script>(function(){' +
  'var ORIGIN=self.location.origin;' +
  'function toProxy(u){' +
    'try{' +
      'var abs=new URL(u,document.baseURI);' +
      'if(abs.origin===ORIGIN)return abs.href;' +
      'return ORIGIN+"/proxy/"+abs.host+abs.pathname+abs.search;' +
    '}catch(e){return u;}' +
  '}' +
  
  // Only essential patches - no DOM manipulation
  'try{' +
    'if(window.top!==window.self){' +
      'Object.defineProperty(window,"top",{get:function(){return window.self;}});' +
      'Object.defineProperty(window,"parent",{get:function(){return window.self;}});' +
    '}' +
  '}catch(e){}' +
  
  'try{' +
    'var _assign=Location.prototype.assign,_replace=Location.prototype.replace;' +
    'Location.prototype.assign=function(u){return _assign.call(this,toProxy(u));};' +
    'Location.prototype.replace=function(u){return _replace.call(this,toProxy(u));};' +
  '}catch(e){}' +
  
  'try{' +
    'var _push=History.prototype.pushState,_rep=History.prototype.replaceState;' +
    'History.prototype.pushState=function(s,t,u){return _push.call(this,s,t,u?toProxy(u):u);};' +
    'History.prototype.replaceState=function(s,t,u){return _rep.call(this,s,t,u?toProxy(u):u);};' +
  '}catch(e){}' +
  
  // Click handler - use passive where possible
  'document.addEventListener("click",function(e){' +
    'var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;' +
    'if(!a)return;' +
    'var h=a.getAttribute("href")||"";' +
    'if(!/^https?:\\/\\//i.test(h))return;' +
    'e.preventDefault();' +
    'var dest=toProxy(h);' +
    'var tgt=a.getAttribute("target");' +
    'if(tgt&&tgt!=="_self"){window.open(dest,"_blank","noopener,noreferrer");}' +
    'else{window.location.href=dest;}' +
  '},true);' +
'})();</script>';

// Full version for non-game sites
var NAV_BLOCKER_FULL = '<script>(function(){' +
  'var ORIGIN=self.location.origin;' +
  'function toProxy(u){' +
    'try{' +
      'var abs=new URL(u,document.baseURI);' +
      'if(abs.origin===ORIGIN)return abs.href;' +
      'return ORIGIN+"/proxy/"+abs.host+abs.pathname+abs.search;' +
    '}catch(e){return u;}' +
  '}' +
  
  'try{' +
    'if(navigator.serviceWorker){' +
      'navigator.serviceWorker.register=function(){' +
        'return Promise.reject(new Error("blocked"));' +
      '};' +
    '}' +
  '}catch(e){}' +
  
  'try{' +
    'if(window.top!==window.self){' +
      'Object.defineProperty(window,"top",{get:function(){return window.self;}});' +
      'Object.defineProperty(window,"parent",{get:function(){return window.self;}});' +
    '}' +
  '}catch(e){}' +
  
  'try{' +
    'var _assign=Location.prototype.assign,_replace=Location.prototype.replace;' +
    'Location.prototype.assign=function(u){return _assign.call(this,toProxy(u));};' +
    'Location.prototype.replace=function(u){return _replace.call(this,toProxy(u));};' +
  '}catch(e){}' +
  
  'try{' +
    'var _open=window.open;' +
    'var lastGesture=0;' +
    'document.addEventListener("pointerdown",function(){lastGesture=Date.now();},true);' +
    'window.open=function(u,n,s){' +
      'var sinceGesture=Date.now()-lastGesture;' +
      'if(sinceGesture>1000){return null;}' +
      'return _open.call(window,u?toProxy(u):u,n,s);' +
    '};' +
  '}catch(e){}' +
  
  'try{' +
    'var _push=History.prototype.pushState,_rep=History.prototype.replaceState;' +
    'History.prototype.pushState=function(s,t,u){return _push.call(this,s,t,u?toProxy(u):u);};' +
    'History.prototype.replaceState=function(s,t,u){return _rep.call(this,s,t,u?toProxy(u):u);};' +
  '}catch(e){}' +
  
  'try{' +
    'var _fetch=window.fetch;' +
    'window.fetch=function(input,init){' +
      'var url=(typeof input==="string")?input:(input&&input.url);' +
      'if(url&&/^https?:\\/\\//i.test(url)&&url.indexOf(ORIGIN)!==0){' +
        'var proxied=toProxy(url);' +
        'if(typeof input==="string"){input=proxied;}' +
        'else{input=new Request(proxied,input);}' +
      '}' +
      'return _fetch.call(window,input,init);' +
    '};' +
  '}catch(e){}' +
  
  'try{' +
    'var _xhrOpen=XMLHttpRequest.prototype.open;' +
    'XMLHttpRequest.prototype.open=function(method,url){' +
      'if(url&&/^https?:\\/\\//i.test(url)&&url.indexOf(ORIGIN)!==0){' +
        'url=toProxy(url);' +
      '}' +
      'var args=[method,url];' +
      'for(var i=2;i<arguments.length;i++)args.push(arguments[i]);' +
      'return _xhrOpen.apply(this,args);' +
    '};' +
  '}catch(e){}' +
  
  'document.addEventListener("click",function(e){' +
    'var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;' +
    'if(!a)return;' +
    'var h=a.getAttribute("href")||"";' +
    'if(!/^https?:\\/\\//i.test(h))return;' +
    'e.preventDefault();' +
    'var dest=toProxy(h);' +
    'var tgt=a.getAttribute("target");' +
    'if(tgt&&tgt!=="_self"){window.open(dest,"_blank","noopener,noreferrer");}' +
    'else{window.location.href=dest;}' +
  '},true);' +
'})();</script>';

function rewriteJsSource(js) {
  var assignPattern = /((?:window\.|document\.)?location(?:\.href)?)\s*=\s*(["'`])((?:https?:)?\/\/[^"'`\s]+)\2/gi;
  js = js.replace(assignPattern, function(match, target, quote, url) {
    if (/^https?:\/\//i.test(url)) {
      return target + ' = ' + quote + '/proxy/' + encodeURIComponent(url) + quote;
    }
    if (url.indexOf('//') === 0) {
      return target + ' = ' + quote + '/proxy/' + encodeURIComponent('https:' + url) + quote;
    }
    return match;
  });

  var methodPattern = /((?:window\.|document\.)?location)\.(assign|replace)\s*\(\s*(["'`])((?:https?:)?\/\/[^"'`\s]+)\3\s*\)/gi;
  js = js.replace(methodPattern, function(match, loc, method, quote, url) {
    if (/^https?:\/\//i.test(url)) {
      return loc + '.' + method + '(' + quote + '/proxy/' + encodeURIComponent(url) + quote + ')';
    }
    if (url.indexOf('//') === 0) {
      return loc + '.' + method + '(' + quote + '/proxy/' + encodeURIComponent('https:' + url) + quote + ')';
    }
    return match;
  });

  var openPattern = /window\.open\s*\(\s*(["'`])((?:https?:)?\/\/[^"'`\s]+)\1/gi;
  js = js.replace(openPattern, function(match, quote, url) {
    if (/^https?:\/\//i.test(url)) {
      return 'window.open(' + quote + '/proxy/' + encodeURIComponent(url) + quote;
    }
    if (url.indexOf('//') === 0) {
      return 'window.open(' + quote + '/proxy/' + encodeURIComponent('https:' + url) + quote;
    }
    return match;
  });

  var topPattern = /(top|parent)\.(location(?:\.href)?)\s*=\s*(["'`])((?:https?:)?\/\/[^"'`\s]+)\3/gi;
  js = js.replace(topPattern, function(match, scope, loc, quote, url) {
    if (/^https?:\/\//i.test(url)) {
      return scope + '.' + loc + ' = ' + quote + '/proxy/' + encodeURIComponent(url) + quote;
    }
    return match;
  });

  return js;
}

function rewriteInlineScripts(html) {
  return html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, function(match, attrs, content) {
    if (/\bsrc\s*=/i.test(attrs)) return match;
    if (!content.trim()) return match;
    var rewritten = rewriteJsSource(content);
    return '<script' + attrs + '>' + rewritten + '</script>';
  });
}

function parseUniversalURL(pathname, search) {
  var targetPath = pathname.charAt(0) === '/' ? pathname.slice(1) : pathname;
  if (!targetPath) return null;
  if (targetPath.indexOf('proxy/') === 0) {
    var rest = targetPath.substring(6);
    var d;
    try { d = decodeURIComponent(rest); } catch(e) { d = rest; }
    if (d.indexOf('://') === -1) {
      d = 'https://' + d;
    }
    if (search) d += search;
    return d;
  }
  var targetURL = targetPath;
  try {
    var decoded = decodeURIComponent(targetPath);
    if (decoded.indexOf('://') !== -1) {
      targetURL = decoded;
      if (search) targetURL += search;
      return targetURL;
    }
    targetURL = decoded;
  } catch(e) {}
  if (targetURL.indexOf('http://') === 0 || targetURL.indexOf('https://') === 0) {
    if (search) targetURL += search;
    return targetURL;
  }
  return search ? 'https://' + targetURL + search : 'https://' + targetURL;
}

function isGameSite(url) {
  var hostname = (url.hostname || '').toLowerCase();
  for (var i = 0; i < GAME_DOMAINS.length; i++) {
    if (hostname.indexOf(GAME_DOMAINS[i]) !== -1) return true;
  }
  return false;
}

async function handleRequest(request) {
  var url = new URL(request.url);
  var pathname = url.pathname;

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

  if (isCloudMoonPath(pathname)) {
    var targetPath = pathname + url.search;
    var _d = ['app', 'com'], _n = 'cloudmoon', _w = 'web';
    var cmDomain = _w + '.' + _n + _d[0] + '.' + _d[1];
    var cloudmoonUrl = 'https://' + cmDomain + targetPath.replace(new RegExp('^\/(web\\.)?' + _n + _d[0] + '\\.' + _d[1]), '');
    var encoded = encodeUrl(cloudmoonUrl);
    var iframeSrc = CLOUDMOON_PROXY + '?u=' + encoded;

    var cmHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Home - Classroom</title>' +
      '<style>*{margin:0;padding:0;box-sizing:border-box}' +
      'html,body{width:100%;height:100%;overflow:hidden;background:#fff}' +
      'iframe{width:100%;height:100%;border:none}</style></head><body>' +
      '<iframe src="' + iframeSrc + '"' +
      ' allow="accelerometer;camera;encrypted-media;geolocation;gyroscope;hid;microphone;midi;clipboard-read;clipboard-write;xr-spatial-tracking;gamepad"' +
      ' sandbox="allow-forms allow-modals allow-presentation allow-same-origin allow-scripts allow-downloads allow-pointer-lock"' +
      '></iframe></body></html>';

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

  var targetURL = parseUniversalURL(pathname, url.search);
  if (!targetURL) {
    return new Response('Invalid URL', { status: 400 });
  }
  try { new URL(targetURL); } catch(e) {
    return new Response('Invalid URL', { status: 400 });
  }

  if (isAdRequest(targetURL)) {
    return new Response('', { status: 204 });
  }

  var fwdHeaders = new Headers(request.headers);
  fwdHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  fwdHeaders.delete('Host');
  fwdHeaders.delete('Origin');
  fwdHeaders.delete('Referer');
  fwdHeaders.delete('cf-connecting-ip');
  fwdHeaders.delete('cf-ray');
  fwdHeaders.delete('cf-visitor');
  fwdHeaders.delete('cf-worker');
  fwdHeaders.delete('x-forwarded-proto');
  fwdHeaders.delete('x-forwarded-for');
  fwdHeaders.delete('x-forwarded-host');
  fwdHeaders.delete('x-real-ip');
  fwdHeaders.delete('sec-fetch-site');
  fwdHeaders.delete('sec-fetch-mode');
  fwdHeaders.delete('sec-fetch-dest');
  fwdHeaders.delete('sec-fetch-user');

  var fetchOpts = {
    method: request.method,
    headers: fwdHeaders,
    redirect: 'follow'
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    fetchOpts.body = request.body;
  }

  var resp;
  try {
    resp = await fetch(targetURL, fetchOpts);
  } catch(err) {
    return new Response('Failed to fetch: ' + (err.message || err), { status: 502 });
  }

  var contentType = (resp.headers.get('Content-Type') || '').toLowerCase();
  var targetUrlObj = new URL(targetURL);
  var isGame = isGameSite(targetUrlObj);

  if (contentType.indexOf('text/html') === -1) {
    var passH = new Headers(resp.headers);
    passH.set('Access-Control-Allow-Origin', '*');
    stripSecurityHeaders(passH);

    if (contentType.indexOf('javascript') !== -1) {
      try {
        var jsSource = await resp.text();
        jsSource = rewriteJsSource(jsSource);
        passH.set('Cache-Control', 'public, max-age=86400');
        return new Response(jsSource, {
          status: resp.status, statusText: resp.statusText, headers: passH
        });
      } catch(e) {
      }
    }

    if (contentType.indexOf('image/') !== -1 || contentType.indexOf('font/') !== -1 || contentType.indexOf('css') !== -1) {
      passH.set('Cache-Control', 'public, max-age=86400');
    }
    return new Response(resp.body, {
      status: resp.status, statusText: resp.statusText, headers: passH
    });
  }

  var pageHtml;
  try {
    pageHtml = await rewriteIframesAndAssets(resp, resp.url, url.origin);
  } catch(err) {
    try {
      pageHtml = await resp.text();
    } catch(err2) {
      return new Response('Failed to read response: ' + (err2.message || err2), { status: 502 });
    }
  }

  pageHtml = blockAdsInHTML(pageHtml);
  pageHtml = injectInHead(pageHtml, '<base href="' + resp.url + '">');
  pageHtml = injectInHead(pageHtml, AD_BLOCKER);
  
  // Use lightweight blocker for game sites
  if (isGame) {
    pageHtml = injectInHead(pageHtml, NAV_BLOCKER_LIGHT);
  } else {
    pageHtml = injectInHead(pageHtml, NAV_BLOCKER_FULL);
  }
  
  pageHtml = rewriteInlineScripts(pageHtml);

  var htmlH = new Headers(resp.headers);
  htmlH.set('Content-Type', 'text/html; charset=utf-8');
  htmlH.set('Access-Control-Allow-Origin', '*');
  stripSecurityHeaders(htmlH);
  htmlH.set('Content-Security-Policy',
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; frame-ancestors *");

  return new Response(pageHtml, {
    status: resp.status, statusText: resp.statusText, headers: htmlH
  });
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request);
    } catch(e) {
      return new Response('Proxy error: ' + (e.message || e), {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }
};
