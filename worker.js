/**
 * HyperZProxy — Universal reverse proxy with CloudMoon iframe + ad blocking
 */

// Proxy target — split into fragments and assembled at runtime.
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

// Server-side HTML rewriter using Cloudflare's HTMLRewriter API.
// Rewrites iframe/src, script/src, img/src, link/href in the initial HTML
// to go through /proxy/ before the browser starts loading them. This catches
// assets present at initial load — the MutationObserver only catches ones
// injected later by JS.
class SrcAttrRewriter {
  constructor(baseURL, workerOrigin, attr) {
    this.baseURL = baseURL;
    this.workerOrigin = workerOrigin;
    this.attr = attr;
  }
  element(el) {
    var src = el.getAttribute(this.attr);
    if (!src) return;
    var abs;
    try { abs = new URL(src, this.baseURL); } catch(e) { return; }
    if (abs.protocol === 'data:' || abs.protocol === 'blob:') return;
    el.setAttribute(this.attr, this.workerOrigin + '/proxy/' + abs.host + abs.pathname + abs.search);
  }
}

function rewriteIframesAndAssets(html, baseURL, workerOrigin) {
  var rewriter = new HTMLRewriter()
    .on('iframe[src]', new SrcAttrRewriter(baseURL, workerOrigin, 'src'))
    .on('script[src]', new SrcAttrRewriter(baseURL, workerOrigin, 'src'))
    .on('img[src]', new SrcAttrRewriter(baseURL, workerOrigin, 'src'))
    .on('link[href]', new SrcAttrRewriter(baseURL, workerOrigin, 'href'));
  return rewriter.transform(new Response(html)).text();
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

var AD_BLOCKER = '<style>.a-div-horizontal,.a-div-vertical,.a-div-placeholder,.a-div-box,ins.adsbygoogle,[data-ad-slot],[data-ad-client],iframe[src*="googlesyndication"],iframe[src*="doubleclick"]{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;position:absolute!important;width:0!important;height:0!important;overflow:hidden!important}</style><script>(function(){function r(){var s=["ins.adsbygoogle","[data-ad-slot]","[data-ad-client]","iframe[src*=googlesyndication]","iframe[src*=doubleclick]",".a-div-horizontal",".a-div-vertical",".a-div-placeholder",".a-div-box"];s.forEach(function(s){document.querySelectorAll(s).forEach(function(e){e.style.display="none";try{e.remove()}catch(_){}})})}r();document.readyState==="loading"&&document.addEventListener("DOMContentLoaded",r);window.addEventListener("load",r);setInterval(r,500);if(document.body)new MutationObserver(function(){r()}).observe(document.body,{childList:true,subtree:true})})();</script>';

var SANDBOX_SCRIPT = '<script>(function(){' +
  'var SELF_ORIGIN=self.location.origin;' +
  'var RUN_HEAVY=true;' +
  'try{' +
    'if(window.self!==window.parent){' +
      'RUN_HEAVY=(window.parent.location.origin!==SELF_ORIGIN);' +
    '}' +
  '}catch(e){' +
    'RUN_HEAVY=true;' + // parent is cross-origin — we don't know who embedded us, stay safe and full-featured
  '}' +
  'function toProxy(u){' +
    'try{' +
      'var abs=new URL(u,document.baseURI);' +
      'return SELF_ORIGIN+"/proxy/"+abs.host+abs.pathname+abs.search;' +
    '}catch(e){return u;}' +
  '}' +

  // --- URL reporter: postMessage current URL to parent for URL bar tracking ---
  // Runs in EVERY frame. Only the direct child's message reaches HyperZWeb
  // (nested frames postMessage to their game-iframe parent, not HyperZWeb).
  'function reportUrl(){' +
    'try{' +
      'if(window.parent&&window.parent!==window.self){' +
        'window.parent.postMessage({type:"hzp-urlchange",url:self.location.href},"*");' +
      '}' +
    '}catch(e){}' +
  '}' +
  'reportUrl();' +
  'setInterval(reportUrl,500);' +

  // --- lightweight patches: run in EVERY frame, top and nested ---
  'try{' +
    'var _fetch=window.fetch;' +
    'window.fetch=function(input,init){' +
      'var url=(typeof input==="string")?input:(input&&input.url);' +
      'if(url&&/^https?:\\/\\//i.test(url)&&url.indexOf(SELF_ORIGIN)!==0){' +
        'var proxied=toProxy(url);' +
        'if(typeof input==="string"){input=proxied;}' +
        'else{input=new Request(proxied,input);}' +
      '}' +
      'return _fetch.call(window,input,init);' +
    '};' +
  '}catch(e){}' +
  'try{' +
    'var _xopen=XMLHttpRequest.prototype.open;' +
    'XMLHttpRequest.prototype.open=function(method,url){' +
      'if(url&&/^https?:\\/\\//i.test(url)&&url.indexOf(SELF_ORIGIN)!==0){' +
        'url=toProxy(url);' +
      '}' +
      'var args=[method,url];' +
      'for(var i=2;i<arguments.length;i++)args.push(arguments[i]);' +
      'return _xopen.apply(this,args);' +
    '};' +
  '}catch(e){}' +
  'try{' +
    'var _beacon=navigator.sendBeacon;' +
    'navigator.sendBeacon=function(url,data){' +
      'if(url&&/^https?:\\/\\//i.test(url)&&url.indexOf(SELF_ORIGIN)!==0){' +
        'url=toProxy(url);' +
      '}' +
      'return _beacon.call(navigator,url,data);' +
    '};' +
  '}catch(e){}' +
  'try{' +
    'if(navigator.serviceWorker){' +
      'navigator.serviceWorker.register=function(){' +
        'return Promise.reject(new Error("ServiceWorker registration blocked by sandbox"));' +
      '};' +
      'navigator.serviceWorker.getRegistrations&&navigator.serviceWorker.getRegistrations().then(function(regs){' +
        'regs.forEach(function(r){r.unregister();});' +
      '});' +
    '}' +
  '}catch(e){}' +
  'var lastGesture=0;' +
  'document.addEventListener("pointerdown",function(){lastGesture=Date.now();},true);' +
  'try{' +
    'var _open=window.open;' +
    'window.open=function(u,n,s){' +
      'if(Date.now()-lastGesture>1000){return null;}' +
      'return _open.call(window,u?toProxy(u):u,n,s);' +
    '};' +
  '}catch(e){}' +
  'document.addEventListener("click",function(e){' +
    'var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;' +
    'if(!a)return;var h=a.getAttribute("href")||"";' +
    'if(!/^https?:\\/\\//i.test(h))return;' +
    'e.preventDefault();' +
    'var dest=toProxy(h);' +
    'var tgt=a.getAttribute("target");' +
    'if(tgt&&tgt!=="_self"){window.open(dest,"_blank","noopener,noreferrer");}' +
    'else{window.location.href=dest;}' +
  '},true);' +
  'document.addEventListener("submit",function(e){' +
    'var f=e.target;if(!f||!f.action)return;' +
    'if(/^https?:\\/\\//i.test(f.action)&&f.action.indexOf(SELF_ORIGIN)!==0){' +
      'e.preventDefault();f.action=toProxy(f.action);f.submit();' +
    '}' +
  '},true);' +

  // --- heavy patches: skipped when the DIRECT PARENT is another HyperZProxy
  // frame (same-origin parent) to avoid doubling up inside the game iframe.
  // Full sandbox runs when we're top-level, OR when our parent is a different
  // origin (third-party embed), OR when the parent is cross-origin and throws
  // (unreadable — safe default). Each frame only checks its own parent, so this
  // is correct at any nesting depth.
  'if(RUN_HEAVY){' +
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
    'var lastHref=self.location.href;' +
    'setInterval(function(){' +
      'if(self.location.href!==lastHref){' +
        'var cur=self.location.href;' +
        'if(cur.indexOf(SELF_ORIGIN)!==0){self.location.href=toProxy(cur);}' +
        'lastHref=self.location.href;' +
        'reportUrl();' +
      '}' +
    '},150);' +
    'try{' +
      'if(window.navigation){' +
        'navigation.addEventListener("navigate",function(e){' +
          'var dest=e.destination&&e.destination.url;' +
          'if(!dest)return;' +
          'if(dest.indexOf(SELF_ORIGIN)!==0){e.preventDefault();window.location.href=toProxy(dest);}' +
        '});' +
      '}' +
    '}catch(e){}' +
    'try{' +
      'function patchSrcProp(proto,attr){' +
        'var desc=Object.getOwnPropertyDescriptor(proto,attr);' +
        'if(!desc||!desc.set)return;' +
        'Object.defineProperty(proto,attr,{' +
          'get:desc.get,' +
          'set:function(v){' +
            'try{' +
              'if(typeof v==="string"&&/^https?:\\/\\//i.test(v)&&v.indexOf(SELF_ORIGIN)!==0){' +
                'v=toProxy(v);' +
              '}' +
            '}catch(e){}' +
            'return desc.set.call(this,v);' +
          '},' +
          'configurable:true' +
        '});' +
      '}' +
      'patchSrcProp(HTMLScriptElement.prototype,"src");' +
      'patchSrcProp(HTMLImageElement.prototype,"src");' +
      'patchSrcProp(HTMLIFrameElement.prototype,"src");' +
      'patchSrcProp(HTMLLinkElement.prototype,"href");' +
    '}catch(e){}' +
    'try{' +
      'var seenEls=new WeakSet();' +
      'var pending=new Set();' +
      'var scheduled=false;' +
      'function rewriteEl(el){' +
        'if(!el||!el.getAttribute||seenEls.has(el))return;' +
        'seenEls.add(el);' +
        'var tag=el.tagName;' +
        'if(tag==="A"&&el.getAttribute("target")==="_blank"){' +
          'var style=el.style;' +
          'if(style&&(style.display==="none"||style.visibility==="hidden")){' +
            'el.removeAttribute("target");' +
          '}' +
          'return;' +
        '}' +
        'if(tag==="SCRIPT"||tag==="IMG"||tag==="IFRAME"){' +
          'var src=el.getAttribute("src");' +
          'if(src&&/^https?:\\/\\//i.test(src)&&src.indexOf(SELF_ORIGIN)!==0){' +
            'el.setAttribute("src",toProxy(src));' +
          '}' +
          'return;' +
        '}' +
        'if(tag==="LINK"){' +
          'var href=el.getAttribute("href");' +
          'if(href&&/^https?:\\/\\//i.test(href)&&href.indexOf(SELF_ORIGIN)!==0){' +
            'el.setAttribute("href",toProxy(href));' +
          '}' +
        '}' +
      '}' +
      'var flushBudgetMs=8;' +
      'var observerDisabled=false;' +
      'var mo;' +
      'function flush(){' +
        'scheduled=false;' +
        'var start=performance.now();' +
        'pending.forEach(function(n){' +
          'if(!n.isConnected)return;' +
          'rewriteEl(n);' +
          'if(n.querySelectorAll){' +
            'var found=n.querySelectorAll("script[src],img[src],iframe[src],link[href],a[target=_blank]");' +
            'for(var i=0;i<found.length;i++)rewriteEl(found[i]);' +
          '}' +
        '});' +
        'pending.clear();' +
        'if(performance.now()-start>flushBudgetMs*4&&mo){' +
          'observerDisabled=true;mo.disconnect();' +
          'console.warn("[sandbox] MutationObserver disabled \u2014 flush() exceeded budget");' +
        '}' +
      '}' +
      'function schedule(){' +
        'if(scheduled)return;scheduled=true;' +
        '(window.requestIdleCallback||window.requestAnimationFrame)(flush);' +
      '}' +
      'mo=new MutationObserver(function(muts){' +
        'if(observerDisabled)return;' +
        'for(var i=0;i<muts.length;i++){' +
          'var m=muts[i];' +
          'if(m.type==="attributes"){pending.add(m.target);continue;}' +
          'var added=m.addedNodes;' +
          'for(var j=0;j<added.length;j++){if(added[j].nodeType===1)pending.add(added[j]);}' +
        '}' +
        'if(pending.size)schedule();' +
      '});' +
      'mo.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["src","href"]});' +
    '}catch(e){}' +
  '}' +
'})();</script>';

// JS source rewriter: rewrites `location.href =`, `location =`, `document.location =`
// in JavaScript source to go through the proxy. This is the ONLY way to catch
// the non-configurable `location.href` setter — rewrite the source code itself.
// Applied to both inline <script> blocks in HTML and external .js responses.
function rewriteJsSource(js) {
  // Rewrite: location.href = "url" → location.href = "/proxy/encoded"
  // Rewrite: location = "url" → location.href = "/proxy/encoded"
  // Rewrite: document.location = "url" → document.location = "/proxy/encoded"
  // Rewrite: window.location = "url" → window.location = "/proxy/encoded"
  // We rewrite assignment targets, not reads, to avoid breaking code that
  // reads location.href for comparison.

  // Pattern: (location|location.href|document.location|window.location)\s*=\s*("..."|'...'|`...`)
  var assignPattern = /((?:window\.|document\.)?location(?:\.href)?)\s*=\s*(["'`])((?:https?:)?\/\/[^"'`\s]+)\2/gi;
  js = js.replace(assignPattern, function(match, target, quote, url) {
    // Only rewrite if it's an absolute URL (has ://)
    if (/^https?:\/\//i.test(url)) {
      return target + ' = ' + quote + '/proxy/' + encodeURIComponent(url) + quote;
    }
    // Protocol-relative URLs (//example.com)
    if (url.indexOf('//') === 0) {
      return target + ' = ' + quote + '/proxy/' + encodeURIComponent('https:' + url) + quote;
    }
    return match;
  });

  // Rewrite: location.assign("url") and location.replace("url")
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

  // Rewrite: window.open("url", ...)
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

  // Rewrite: top.location = "url" and parent.location = "url"
  var topPattern = /(top|parent)\.(location(?:\.href)?)\s*=\s*(["'`])((?:https?:)?\/\/[^"'`\s]+)\3/gi;
  js = js.replace(topPattern, function(match, scope, loc, quote, url) {
    if (/^https?:\/\//i.test(url)) {
      return scope + '.' + loc + ' = ' + quote + '/proxy/' + encodeURIComponent(url) + quote;
    }
    return match;
  });

  return js;
}

// Rewrite inline <script> blocks in HTML
function rewriteInlineScripts(html) {
  return html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, function(match, attrs, content) {
    // Skip scripts with src attribute (external scripts)
    if (/\bsrc\s*=/i.test(attrs)) return match;
    // Skip empty scripts
    if (!content.trim()) return match;
    // Rewrite the JS source
    var rewritten = rewriteJsSource(content);
    return '<script' + attrs + '>' + rewritten + '</script>';
  });
}

function parseUniversalURL(pathname, search) {
  var targetPath = pathname.charAt(0) === '/' ? pathname.slice(1) : pathname;
  if (!targetPath) return null;
  if (targetPath.indexOf('proxy/') === 0) {
    // Reconstruct from host+path (new style: /proxy/host/path?query) OR
    // from a fully-encoded blob (old style: /proxy/https%3A%2F%2F...).
    // Backward-compatible: old-style URLs still contain '://' after
    // decoding and pass through unchanged; new-style 'host/path' URLs get
    // 'https://' prepended.
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

async function handleRequest(request) {
  var url = new URL(request.url);
  var pathname = url.pathname;

  // CORS preflight
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

  // CloudMoon: full-screen iframe to the classroom proxy
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

  // Normal proxy: direct-fetch
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

  // Fetch the target — forward the original request's method, body, and headers
  // so POST/PUT requests (sign-up forms, API calls, etc.) work correctly.
  // Use redirect:'follow' so Workers follows redirects automatically.
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

  // Non-HTML: pass through with CORS + stripped security headers.
  // For JavaScript responses, also rewrite navigation calls in the source.
  if (contentType.indexOf('text/html') === -1) {
    var passH = new Headers(resp.headers);
    passH.set('Access-Control-Allow-Origin', '*');
    stripSecurityHeaders(passH);

    // Rewrite JS source for navigation calls
    if (contentType.indexOf('javascript') !== -1) {
      try {
        var jsSource = await resp.text();
        jsSource = rewriteJsSource(jsSource);
        passH.set('Cache-Control', 'public, max-age=86400');
        return new Response(jsSource, {
          status: resp.status, statusText: resp.statusText, headers: passH
        });
      } catch(e) {
        // If JS rewrite fails, pass through the original
      }
    }

    if (contentType.indexOf('image/') !== -1 || contentType.indexOf('font/') !== -1 || contentType.indexOf('css') !== -1) {
      passH.set('Cache-Control', 'public, max-age=86400');
    }
    return new Response(resp.body, {
      status: resp.status, statusText: resp.statusText, headers: passH
    });
  }

  // HTML: use HTMLRewriter to rewrite iframe/script/img/link src server-side
  // (catches assets in initial HTML before JS runs), then inject <base>,
  // strip headers, block ads, block nav, rewrite inline JS scripts.
  var pageHtml;
  try {
    pageHtml = await rewriteIframesAndAssets(await resp.clone().text(), resp.url, url.origin);
  } catch(err) {
    // Fallback to plain text() if HTMLRewriter fails
    try {
      pageHtml = await resp.text();
    } catch(err2) {
      return new Response('Failed to read response: ' + (err2.message || err2), { status: 502 });
    }
  }

  pageHtml = blockAdsInHTML(pageHtml);
  // Use resp.url (final URL after redirects) for <base> so assets resolve correctly
  pageHtml = injectInHead(pageHtml, '<base href="' + resp.url + '">');
  pageHtml = injectInHead(pageHtml, AD_BLOCKER);
  pageHtml = injectInHead(pageHtml, SANDBOX_SCRIPT);
  // Rewrite navigation calls in inline <script> blocks
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

// Cloudflare Workers entry point — wrapped in try/catch so any error
// returns a readable message instead of Error 1101.
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
