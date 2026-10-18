

var HZP = {
  AD_BLOCK: true,
  WEB_SOCKET: true,
  CACHE_ASSETS: true,
  COOKIE_ISOLATION: true,
  CROSS_ORIGIN_ISOLATION: true,
  UA: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
};

var SJ_PREFIX = '/sj';

var HIDDEN_ATTR = 'hz-attr-';

var CLOUDMOON_ORIGIN = (function () {
  var _p = ['sr' + 'iail', 'wor' + 'kers', 'd' + 'ev', 'goog' + 'le-cla' + 'ssroom'];
  return 'https://' + _p[3] + '.' + _p[0] + '.' + _p[1] + '.' + _p[2] + '/';
})();
function isCloudMoonPath(pathname) {
  var _d = ['app', 'com'], _n = 'cloudmoon', _w = 'web';
  var full = _w + '.' + _n + _d[0] + '.' + _d[1];
  var short = _n + _d[0] + '.' + _d[1];
  if (pathname === '/' + full || pathname.indexOf('/' + full + '/') === 0) return true;
  if (pathname === '/' + short || pathname.indexOf('/' + short + '/') === 0) return true;
  return false;
}


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
var AD_RE = new RegExp(AD_PATTERNS.map(function (s) {
  return s.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&');
}).join('|'), 'i');
function isAdRequest(u) { return AD_RE.test(u || ''); }

function heavyAdCss() {
  return [
    '.a-div-horizontal,.a-div-vertical,.a-div-placeholder,.a-div-box,',
    'ins.adsbygoogle,[data-ad-slot],[data-ad-client],',
    'iframe[src*="googlesyndication"],iframe[src*="doubleclick"]',
    '{display:none!important;visibility:hidden!important;opacity:0!important;',
    'pointer-events:none!important;position:absolute!important;width:0!important;',
    'height:0!important;overflow:hidden!important}'
  ].join('');
}

var AD_BLOCK_CLIENT = '<style>' + heavyAdCss() + '</style>' +
  '<script>(function(){function r(){var s=["ins.adsbygoogle","[data-ad-slot]","[data-ad-client]","iframe[src*=googlesyndication]","iframe[src*=doubleclick]",".a-div-horizontal",".a-div-vertical",".a-div-placeholder",".a-div-box"];s.forEach(function(s){document.querySelectorAll(s).forEach(function(e){e.style.display="none";try{e.remove()}catch(_){}})})}r();document.readyState==="loading"&&document.addEventListener("DOMContentLoaded",r);window.addEventListener("load",r);setInterval(r,500);if(document.body)new MutationObserver(function(){r()}).observe(document.body,{childList:true,subtree:true})})();<' + '/script>';


var B54_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ01234567';
var B54_BASE = 54;
function caesarEncode(str) {
  var out = '';
  for (var i = 0; i < str.length; i++) out += String.fromCharCode(str.charCodeAt(i) + 1);
  return out;
}
function caesarDecode(str) {
  var out = '';
  for (var i = 0; i < str.length; i++) out += String.fromCharCode(str.charCodeAt(i) - 1);
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
function b54decode(s) {
  var bytes = [], i = 0;
  while (i + 5 <= s.length) {
    var n = 0;
    for (var j = 0; j < 5; j++) {
      var idx = B54_ALPHABET.indexOf(s.charAt(i + j));
      if (idx < 0) return '';
      n = n * B54_BASE + idx;
    }
    bytes.push((n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
    i += 5;
  }
  var out = '';
  for (var k = 0; k < bytes.length; k++) out += String.fromCharCode(bytes[k]);
  return out;
}
function encodeUrl(url) { return b54encode(caesarEncode(url)); }
function decodeUrl(enc) {
  var raw = b54decode(String(enc || ''));
  if (!raw) return null;
  return caesarDecode(raw);
}


function parseUniversalURL(pathname, search, hash) {
  search = search || ''; hash = hash || '';
  var targetPath = pathname && pathname.charAt(0) === '/' ? pathname.slice(1) : (pathname || '');
  if (!targetPath) return null;

  if (targetPath.indexOf('proxy/') === 0) {
    var rest = targetPath.substring(6);
        var wsm = /^(wss?)\/([a-z0-9.\-\[\]]+:?\d*)/i.exec(rest);
    if (wsm) return wsm[1] + '://' + wsm[2] + rest.slice(wsm[0].length) + search + hash;
    var d;
    try { d = decodeURIComponent(rest); } catch (e) { d = rest; }
    if (d.indexOf('://') === -1) {
            var legacy = decodeUrl(d);
      d = (legacy && (legacy.indexOf('http://') === 0 || legacy.indexOf('https://') === 0))
        ? legacy
        : 'https://' + d;
    }
    return d + search + hash;
  }
  var ws = /^(wss?)\/([a-z0-9.\-\[\]]+:?\d*)/i.exec(targetPath);
  if (ws) return ws[1] + '://' + ws[2] + targetPath.slice(ws[0].length) + search + hash;

  var url;
  try {
    var decoded = decodeURIComponent(targetPath);
    if (decoded.indexOf('://') !== -1) return decoded + search + hash;
    url = decoded;
  } catch (e) { url = targetPath; }
  if (url.indexOf('http://') === 0 || url.indexOf('https://') === 0) return url + search + hash;
  return 'https://' + url + search + hash;
}
function parseProxiedPath(pathname, search, hash) {
  var p = pathname || '';
  if (p === SJ_PREFIX) p = '/';
  else if (p.indexOf(SJ_PREFIX + '/') === 0) p = p.slice(SJ_PREFIX.length);
  return parseUniversalURL(p, search, hash);
}


function isJsContentType(ct) {
  if (!ct) return false;
  var essence = ct.toLowerCase().split(';')[0].trim();
  return /ecmascript|jscript|livescript|javascript/.test(essence);
}
function isHtmlContentType(ct) {
  if (!ct) return false;
  var e = ct.toLowerCase().split(';')[0].trim();
  return e === 'text/html' || e === 'application/xhtml+xml' || e === '';
}


function encodeRequestCookie(cookieHeader, host) {
  if (!cookieHeader || !host) return null;
  var out = [], parts = cookieHeader.split(';');
  var prefix = 'hz-' + host + ':';
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i].trim();
    if (!p) continue;
    var eq = p.indexOf('=');
    var name = eq === -1 ? p : p.slice(0, eq);
    if (name.indexOf(prefix) !== 0) continue;
    out.push(name.slice(prefix.length) + (eq === -1 ? '' : '=' + p.slice(eq + 1)));
  }
  return out.length ? out.join('; ') : null;
}
function rewriteSetCookie(c, host) {
  if (!c || !host) return c;
  var eq = c.indexOf('=');
  if (eq === -1) return c;
  var name = c.slice(0, eq);
  var rest = c.slice(eq);
  var prefixed = 'hz-' + host + ':' + name + rest;
  prefixed = prefixed.replace(/;\s*[Dd]omain\s*=[^;]*/g, '');
  if (/;\s*[Pp]ath\s*=/.test(prefixed)) prefixed = prefixed.replace(/;\s*[Pp]ath\s*=[^;]*/g, '; Path=/');
  else prefixed += '; Path=/';
  if (!/;\s*[Ss]ameSite\s*=/i.test(prefixed)) prefixed += '; SameSite=Lax';
  return prefixed;
}


var CSS_URL_RE = /url\((?:\s*"((?:\\.|[^"])+)"\s*|\s*'((?:\\.|[^'])+)'\s*|((?!\s*['"])(?!\s*\))(?:\\.|[^)])+?))\)/g;
function cssProxyUrl(url, realBase, proxyOrigin) {
  try {
    var abs = new URL(url, realBase);
    var p = abs.protocol;
    if (p === 'data:' || p === 'blob:' || p === 'javascript:' || p === 'about:' || p === 'mailto:') return url;
    if (p !== 'http:' && p !== 'https:') return url;
    if (abs.pathname.indexOf('/proxy/') === 0 || abs.pathname.indexOf(SJ_PREFIX + '/proxy/') === 0) return url;
    return proxyOrigin + SJ_PREFIX + '/proxy/' + abs.href;
  } catch (e) { return url; }
}
function rewriteCssUrls(css, realBase, proxyOrigin) {
  css = String(css);
  var out = css.replace(CSS_URL_RE, function (m, dq, sq, unq) {
    var u = dq || sq || unq;
    if (!u) return m;
    return m.replace(u, cssProxyUrl(u.trim(), realBase, proxyOrigin));
  });
    out = out.replace(/@import\s+(['"])([^'"]+)\1/g, function (m, q, u) {
    if (!u) return m;
    return '@import ' + q + cssProxyUrl(u.trim(), realBase, proxyOrigin) + q;
  });
  return out;
}

function rewriteResponseLinkHeader(value, realBase, proxyOrigin) {
  try {
    return String(value).replace(/<([^>]+)>/g, function (m, target) {
      try {
        var abs = new URL(target, realBase);
        if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return m;
        if (abs.pathname.indexOf('/proxy/') === 0 || abs.pathname.indexOf(SJ_PREFIX + '/proxy/') === 0) return m;
        return '<' + proxyOrigin + SJ_PREFIX + '/proxy/' + abs.href + '>';
      } catch (e) { return m; }
    });
  } catch (e) { return value; }
}
function rewriteResponseUrlHeaders(headers, realUrl, proxyOrigin) {
  ['location', 'content-location', 'referer'].forEach(function (name) {
    var v = headers.get(name);
    if (!v) return;
    try {
      var abs = new URL(v, realUrl || undefined);
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') { headers.delete(name); return; }
      if (abs.pathname.indexOf('/proxy/') === 0 || abs.pathname.indexOf(SJ_PREFIX + '/proxy/') === 0) { headers.delete(name); return; }
      headers.set(name, proxyOrigin + SJ_PREFIX + '/proxy/' + abs.href);
    } catch (e) { headers.delete(name); }
  });
  var link = headers.get('link');
  if (link) headers.set('link', rewriteResponseLinkHeader(link, realUrl, proxyOrigin));
}


var JS_ASSIGN_RE    = /((?:window\.|document\.|self\.|top\.|parent\.)?(?:location|documentURL)\.?(?:href)?)\s*=\s*(["'])([^"'\s]+)\2/g;
var JS_METHOD_RE    = /((?:window\.|document\.|self\.)?location)\.(assign|replace)\s*\(\s*(["'])([^"'\s]+)\3/g;
var JS_OPEN_RE      = /(^|[^\w.$])(?:window\.)?open\s*\(\s*(["'])([^"'\s]+)\2/g;
var JS_WORKER_RE    = /new\s+(?:Worker|SharedWorker)\s*\(\s*(["'])([^"'\s]+)\1/g;
var JS_WS_RE        = /new\s+WebSocket\s*\(\s*(["'])((?:wss?|https?):\/\/[^"'\s]+)\1/g;
var JS_IMPORT_RE    = /importScripts\s*\(\s*(["'])([^"'\s]+)\1/g;
var JS_BEACON_RE    = /(?:navigator\.)?sendBeacon\s*\(\s*(["'])([^"'\s]+)\1/g;
var JS_REQUEST_RE   = /new\s+Request\s*\(\s*(["'])([^"'\s]+)\1/g;
var JS_POSTMSG_RE   = /(^|[^\w$."'`])((?!super\b)[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.postMessage(\s*\()/g;
var JS_LOC_PROP_RE  = /(?:\b(?:window|self|document|top|parent)\.)?\blocation\.(pathname|href|search|hash|hostname|host|origin|port|protocol)(?!\s*(?:=[^=]|[+\-\*/%]=))/g;
var REWRITE_GUARD = "if(typeof self.__hzpLoc!=='function'){self.__hzpLoc=function(p){try{var l=self.location;var v=l&&l[p];return v==null?'':String(v)}catch(e){return ''}}}\n" +
  "if(typeof self.__hzpPMW!=='function'){self.__hzpPMW=function(w){return w}}\n";

function jsProxyUrl(url, quote, realBase, proxyOrigin) {
  try {
    var u = String(url);
    if (/^(javascript|mailto|tel|about|data|blob):/i.test(u)) return quote + u + quote;
    var abs = u.indexOf('//') === 0 ? new URL('https:' + u) : new URL(u, realBase);
    if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return quote + u + quote;
    return quote + proxyOrigin + SJ_PREFIX + '/proxy/' + abs.href + quote;
  } catch (e) { return quote + url + quote; }
}
function jsWsProxyUrl(url, quote, proxyOrigin) {
  try {
    var abs = new URL(url);
    var p = abs.protocol === 'wss:' || abs.protocol === 'https:' ? 'wss' : 'ws';
    return quote + proxyOrigin + SJ_PREFIX + '/proxy/' + p + '/' + abs.host + abs.pathname + abs.search + quote;
  } catch (e) { return quote + url + quote; }
}

function rewriteJsSource(js, realBase, proxyOrigin) {
  var rb = realBase || '', po = proxyOrigin || '';
  js = js.replace(JS_LOC_PROP_RE, function (m, prop) { return 'self.__hzpLoc("' + prop + '")'; });
  js = js.replace(JS_ASSIGN_RE,   function (m, lhs, q, u) { return lhs + ' = ' + jsProxyUrl(u, q, rb, po); });
  js = js.replace(JS_METHOD_RE,   function (m, loc, method, q, u) { return loc + '.' + method + '(' + jsProxyUrl(u, q, rb, po) + ')'; });
  js = js.replace(JS_OPEN_RE,     function (m, pre, q, u) { return pre + 'open(' + jsProxyUrl(u, q, rb, po); });
  js = js.replace(JS_WORKER_RE,   function (m, q, u) { return 'new Worker(' + jsProxyUrl(u, q, rb, po); });
  js = js.replace(JS_WS_RE,       function (m, q, u) { return 'new WebSocket(' + jsWsProxyUrl(u, q, po); });
  js = js.replace(JS_IMPORT_RE,   function (m, q, u) { return 'importScripts(' + jsProxyUrl(u, q, rb, po); });
  js = js.replace(JS_BEACON_RE,   function (m, q, u) { return 'sendBeacon(' + jsProxyUrl(u, q, rb, po); });
  js = js.replace(JS_REQUEST_RE,  function (m, q, u) { return 'new Request(' + jsProxyUrl(u, q, rb, po); });
  js = js.replace(JS_POSTMSG_RE,  function (m, pre, obj, paren) { return pre + 'self.__hzpPMW(' + obj + ').postMessage' + paren; });
  return js;
}

function scriptNeedsRewrite(src) {
  if (src.indexOf('location') !== -1) return true;
  if (src.indexOf('postMessage') !== -1) return true;
  if (src.indexOf('//') === -1) return false;
  return (
    src.indexOf('http:') !== -1 || src.indexOf('https:') !== -1 || src.indexOf('wss:') !== -1 ||
    src.indexOf('Worker') !== -1 || src.indexOf('importScripts') !== -1 ||
    src.indexOf('WebSocket') !== -1 || src.indexOf('sendBeacon') !== -1
  );
}
function rewriteInlineScripts(html, realBase, proxyOrigin) {
  return html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, function (match, attrs, content) {
    if (/\bsrc\s*=/i.test(attrs)) return match;
    if (!content.trim() || !scriptNeedsRewrite(content)) return match;
    return '<script' + attrs + '>' + rewriteJsSource(content, realBase, proxyOrigin) + '</script>';
  });
}


function parseDeclarativeRefresh(input) {
  if (!input) return null;
  var wsRe = /\s/;
  var s = 0, n = input.length;
  while (s < n && wsRe.test(input.charAt(s))) s++;
  var t0 = s;
  while (s < n && input.charCodeAt(s) >= 0x30 && input.charCodeAt(s) <= 0x39) s++;
  var timeStr = input.slice(t0, s);
  var time = timeStr.length ? parseInt(timeStr, 10) : 0;
  while (s < n) {
    var cp = input.charCodeAt(s);
    if ((cp >= 0x30 && cp <= 0x39) || cp === 0x2e) { s++; continue; }
    break;
  }
  if (s >= n) return null;
  var sep = input.charCodeAt(s);
  if (sep !== 0x3b && sep !== 0x2c && !wsRe.test(input.charAt(s))) return null;
  while (s < n && wsRe.test(input.charAt(s))) s++;
  if (s < n && (input.charCodeAt(s) === 0x3b || input.charCodeAt(s) === 0x2c)) s++;
  while (s < n && wsRe.test(input.charAt(s))) s++;
  if (s >= n) return null;
  var urlStart = s;
  var label = input.slice(s, s + 3).toLowerCase();
  if (label === 'url') {
    var nx = s + 3;
    while (nx < n && wsRe.test(input.charAt(nx))) nx++;
    if (input.charAt(nx) === '=') { nx++; while (nx < n && wsRe.test(input.charAt(nx))) nx++; urlStart = nx; }
  }
  var quote = '', urlEnd = n;
  if (urlStart < n) {
    var qc = input.charAt(urlStart);
    if (qc === '"' || qc === "'") { quote = qc; urlStart++; }
  }
  if (quote) {
    var closeAt = input.indexOf(quote, urlStart);
    if (closeAt !== -1) urlEnd = closeAt;
  }
  return { time: time, url: input.slice(urlStart, urlEnd) };
}
function rewriteMetaRefresh(content, realBase, proxyOrigin) {
  var parsed = parseDeclarativeRefresh(content);
  if (!parsed || !parsed.url) return null;
  var abs;
  try { abs = new URL(parsed.url, realBase); } catch (e) { return null; }
  if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return null;
  var proxied = proxyOrigin + SJ_PREFIX + '/proxy/' + abs.href;
  return parsed.time + '; URL=' + proxied;
}


function injectInHead(html, content) {
  var m = html.match(/<head[^>]*>/i);
  if (m) return html.replace(m[0], m[0] + content);
  if (html.indexOf('</head>') !== -1) return html.replace('</head>', content + '</head>');
  return content + html;
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
  h.delete('Expect-CT');
  h.delete('Feature-Policy');
  h.delete('Origin-Isolation');
  h.delete('Upgrade-Insecure-Requests');
  h.delete('X-Download-Options');
  h.delete('X-Permitted-Cross-Domain-Policies');
  h.delete('X-Powered-By');
  h.delete('X-XSS-Protection');
  h.delete('Clear-Site-Data');
}

function escapeHtmlAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}


var HZP_CLIENT_SRC = `(function(){
"use strict";
if (self.__hzpClient) return;
self.__hzpClient = 1;

var HIDDEN = 'hz-attr-';
var REAL_BASE = %__HZP_REAL_BASE__%;
var REAL_ORIGIN = %__HZP_REAL_ORIGIN__%;
var PROXY_ORIGIN = self.__hzpOriginOverride || self.location.origin;
var SJ_PREFIX = '/sj';

var SN = {};
(function(){
  var S = self;
  SN.Object = S.Object;
  SN.oreflect = S.Reflect;
    if (SN.oreflect && typeof SN.oreflect.call !== 'function') {
    SN.oreflect = {
      call: function (f, t, a) { return f.apply(t, a || []); },
      apply: typeof SN.oreflect.apply === 'function' ? SN.oreflect.apply : function (f, t, a) { return f.apply(t, a || []); },
      get: typeof SN.oreflect.get === 'function' ? SN.oreflect.get : function (t, p) { return t[p]; },
      set: typeof SN.oreflect.set === 'function' ? SN.oreflect.set : function (t, p, v) { t[p] = v; return true; },
      has: typeof SN.oreflect.has === 'function' ? SN.oreflect.has : function (t, p) { return p in t; }
    };
  }
  SN.oget = S.Object.getOwnPropertyDescriptor;
  SN.od = S.Object.defineProperty;
  SN.URL = S.URL;
  SN.Proxy = S.Proxy;
  SN.Set = S.Set;
  SN.WeakSet = S.WeakSet;
  SN.now = S.Date.now;
  SN.setTimeout = S.setTimeout && S.setTimeout.bind ? S.setTimeout.bind(S) : S.setTimeout;
  SN.rawPost = S.postMessage;
})();

function resolveUrl(v, base) {
  try { return new SN.URL(String(v), base || REAL_BASE || PROXY_ORIGIN); }
  catch (e) { return null; }
}

function realFrom(v) {
  try {
    if (v == null) return null;
    var s = String(v);
    var u;
    try { u = new SN.URL(s, PROXY_ORIGIN); } catch (e) { return null; }
    if (u.origin !== PROXY_ORIGIN) return null;
    var p = u.pathname;
    if (p.indexOf(SJ_PREFIX + '/proxy/') === 0) p = p.slice(SJ_PREFIX.length);
    if (p.indexOf('/proxy/') !== 0) return null;
    var rest = p.slice('/proxy/'.length);
    var ws = /^(wss?)\\/([a-z0-9.\\-\\[\\]:]+)(\\/.*)$/.exec(rest);
    if (ws) return ws[1] + '://' + ws[2] + (ws[3] || '') + (u.search || '') + (u.hash || '');
    var decoded;
    try { decoded = decodeURIComponent(rest); } catch (e) { decoded = rest; }
    if (decoded.indexOf('://') !== -1) return decoded + (u.search || '') + (u.hash || '');
    var firstSlash = decoded.indexOf('/');
    if (firstSlash === -1) {
      return 'https://' + decoded + '/' + (u.search || '') + (u.hash || '');
    }
    var host = decoded.slice(0, firstSlash);
    if (!host) return null;
    return 'https://' + host + decoded.slice(firstSlash) + (u.search || '') + (u.hash || '');
  } catch (e) { return null; }
}

function unrewriteLinkHeader(value) {
  try {
    return String(value).replace(/<([^>]+)>/g, function (m, u) {
      var r = realFrom(u);
      return '<' + (r || u) + '>';
    });
  } catch (e) { return value; }
}

function toProxy(v) {
  try {
    if (v == null) return v;
    var s = String(v);
    if (!s) return v;
        if (s.indexOf(PROXY_ORIGIN) === 0) return s;
    if (s.indexOf('/proxy/') === 0) return s;
    if (s.indexOf(SJ_PREFIX + '/proxy/') === 0) return s;
    if (/^(mailto:|tel:|sms:|about:|blob:|data:|javascript:)/i.test(s)) return s;
        if (/^https?:\\/\\//i.test(s)) {
      try {
        var snp = new SN.URL(s).pathname;
        if (snp.indexOf('/proxy/') === 0 || snp.indexOf(SJ_PREFIX + '/proxy/') === 0) return s;
      } catch (e) {}
    }
    var abs = resolveUrl(s);
    if (!abs) return s;
    var p = abs.protocol;
    if (p === 'javascript:' || p === 'about:' || p === 'data:' || p === 'blob:' || p === 'mailto:' || p === 'tel:') return s;
    if (p !== 'http:' && p !== 'https:' && p !== 'ws:' && p !== 'wss:') return s;
    if (abs.origin === PROXY_ORIGIN) return abs.href;
    if (p === 'ws:' || p === 'wss:') {
      return PROXY_ORIGIN + SJ_PREFIX + '/proxy/' + (p === 'wss:' ? 'wss' : 'ws') + '/' + abs.host + abs.pathname + abs.search;
    }
        return PROXY_ORIGIN + SJ_PREFIX + '/proxy/' + abs.href;
  } catch (e) { return v; }
}

function shouldProxyRef(v) {
  var s = String(v == null ? '' : v);
  if (!s || s.charAt(0) === '#') return false;
  var m = /^([a-z][a-z0-9+.-]*):/i.exec(s);
  if (m) { var p = m[1].toLowerCase(); return p === 'http' || p === 'https'; }
  return true;
}

var RULES = [
  { a: 'src',        tags: ['embed', 'img', 'frame', 'input', 'track'],  t: 'url' },
  { a: 'href',       tags: ['a', 'area', 'image'],                      t: 'url' },
  { a: 'data',       tags: ['object'],                                  t: 'url' },
  { a: 'action',     tags: ['form'],                                    t: 'url' },
  { a: 'formaction', tags: ['button', 'input', 'textarea'],             t: 'url' },
  { a: 'poster',     tags: ['video'],                                   t: 'url' },
  { a: 'xlink:href', tags: ['image'],                                   t: 'url' },
  { a: 'src',        tags: ['script'],                                  t: 'url' },
  { a: 'href',       tags: ['link'],                                    t: 'url' },
  { a: 'src',        tags: ['iframe'],                                  t: 'url' },
  { a: 'src',        tags: ['video', 'audio', 'source'],                t: 'url' },
  { a: 'sandbox',    tags: ['iframe'],                                  t: 'remove' },
  { a: 'integrity',  tags: ['script', 'link'],                          t: 'remove' },
  { a: 'nonce',      tags: null,                                        t: 'removeAll' },
  { a: 'csp',        tags: ['iframe'],                                  t: 'remove' },
  { a: 'credentialless', tags: ['iframe'],                              t: 'remove' },
  { a: 'srcset',     tags: ['img', 'source'],                           t: 'srcset' },
  { a: 'imagesrcset', tags: ['link'],                                   t: 'srcset' },
  { a: 'style',      tags: null,                                        t: 'css' },
  { a: 'target',     tags: ['a', 'base'],                               t: 'target' },
  { a: 'href',       tags: ['use', 'textPath', 'mpath', 'feImage', 'animate', 'animateMotion', 'animateTransform', 'set', 'discard', 'linearGradient', 'radialGradient', 'pattern', 'filter'], t: 'url' }
];

function findRule(attrName, tagName) {
  attrName = String(attrName).toLowerCase();
  tagName = String(tagName || '').toLowerCase();
  for (var i = 0; i < RULES.length; i++) {
    var r = RULES[i];
    if (r.a !== attrName) continue;
    if (r.t === 'removeAll' || r.tags === null) return r;
    if (r.tags.indexOf(tagName) !== -1) return r;
  }
  return null;
}
function srcsetValue(value) {
  return String(value).split(',').map(function (part) {
    var bits = part.trim().split(/\\s+/);
    var url = bits.shift() || '';
    var desc = bits.join(' ');
    if (!url) return desc;
    return toProxy(url) + (desc ? ' ' + desc : '');
  }).join(', ');
}
function srcsetUnrewrite(value) {
  return String(value).split(',').map(function (part) {
    var bits = part.trim().split(/\\s+/);
    var url = bits.shift() || '';
    var desc = bits.join(' ');
    if (!url) return desc;
    var r = realFrom(url);
    return (r || url) + (desc ? ' ' + desc : '');
  }).join(', ');
}

function pickProxied(value, tagName, attrName) {
  var rule = findRule(attrName, tagName);
  if (!rule) return value;
  var s = String(value == null ? '' : value);
  switch (rule.t) {
    case 'remove':
    case 'removeAll': return null;
    case 'css':       return rewriteCssStr(s);
    case 'srcset':    return srcsetValue(s);
    case 'target':    return s;
    case 'url':
    default:          return toProxy(s);
  }
}

var CSS_URL_RE = /url\\((?:\\s*"((?:\\\\.|[^"])+)"\\s*|\\s*'((?:\\\\.|[^'])+)'\\s*|((?!\\s*['"])(?!\\s*\\))(?:\\\\.|[^)])+?))\\)/g;

function cssProxyUrl(u) {
  try {
    var s = String(u);
        if (s.indexOf(PROXY_ORIGIN) === 0) return s;
    if (s.indexOf('/proxy/') === 0) return s;
    if (s.indexOf(SJ_PREFIX + '/proxy/') === 0) return s;
    var abs = resolveUrl(s);
    if (!abs) return s;
    var p = abs.protocol;
    if (p === 'data:' || p === 'blob:' || p === 'javascript:' || p === 'about:' || p === 'mailto:') return s;
    if (p !== 'http:' && p !== 'https:') return s;
    if (abs.origin === PROXY_ORIGIN && (abs.pathname.indexOf('/proxy/') === 0 || abs.pathname.indexOf(SJ_PREFIX + '/proxy/') === 0)) return s;
        if (abs.origin === PROXY_ORIGIN) return abs.href;
    return PROXY_ORIGIN + SJ_PREFIX + '/proxy/' + abs.href;
  } catch (e) { return s; }
}
function rewriteCssStr(css) {
  css = String(css);
  return css.replace(CSS_URL_RE, function (m, dq, sq, unq) {
    var u = dq || sq || unq;
    if (!u) return m;
    return m.replace(u, cssProxyUrl(u.trim()));
  });
}
function unrewriteCssStr(css) {
  css = String(css);
  return css.replace(CSS_URL_RE, function (m, dq, sq, unq) {
    var u = dq || sq || unq;
    if (!u) return m;
    return m.replace(u, realFrom(u.trim()) || u.trim());
  });
}

function resolvePath(name) {
  var dot = name.lastIndexOf('.');
  var base, prop;
  if (dot === -1) { base = name; prop = name; return { target: self, prop: prop }; }
  base = name.slice(0, dot); prop = name.slice(dot + 1);
  var target;
  try { target = base.split('.').reduce(function (a, b) { return a ? a[b] : null; }, self); }
  catch (e) { target = null; }
  return { target: target, prop: prop };
}
function getPd(target, prop) {
  try { return SN.oget(target, prop); } catch (e) { return null; }
}
function def(target, prop, desc) {
  try { SN.od(target, prop, desc); } catch (e) {}
}

function makeTrap(name, handler) {
  var r = resolvePath(name);
  if (!r.target || !r.prop) return;
  var orig = getPd(r.target, r.prop);
  if (!orig || (!orig.get && !orig.set)) return;
  var desc = {};
  if (handler.get && orig.get) {
    desc.get = function () {
      var selfRef = this;
      var ctx = { get: function () { return orig.get.call(selfRef); }, set: null, self: selfRef };
      try { ctx.set = function (x) { return orig.set.call(selfRef, x); }; } catch (e) { ctx.set = null; }
      return handler.get.call(null, ctx);
    };
  } else if (orig.get) desc.get = orig.get;
  if (handler.set && orig.set) {
    desc.set = function (v) {
      var selfRef = this;
      var ctx = { set: function (x) { return orig.set.call(selfRef, x); }, get: null, self: selfRef, value: v };
      try { ctx.get = function () { return orig.get.call(selfRef); }; } catch (e) { ctx.get = null; }
      return handler.set.call(null, ctx, v);
    };
  } else if (orig.set) desc.set = orig.set;
  desc.configurable = true;
  desc.enumerable = orig.enumerable !== false;
  def(r.target, r.prop, desc);
}
function multiTrap(names, handler) { names.forEach(function (n) { makeTrap(n, handler); }); }

function makeProxy(name, handler) {
  var r = resolvePath(name);
  if (!r.target || !r.prop) return;
  var orig = null;
  try { orig = r.target[r.prop]; } catch (e) { orig = null; }
  if (typeof orig !== 'function') return;
  if (orig && orig.__hzpProxy) return;
  var proxied = new SN.Proxy(orig, {
    apply: function (target, that, args) {
      var ctx = { fn: target, that: that, args: args, earlyReturn: null };
      try { handler.call(null, ctx); } catch (e) {}
      if (ctx.earlyReturn !== null) return ctx.earlyReturn;
      return SN.oreflect.apply(target, that, args);
    },
    construct: function (target, args, newTarget) {
      var ctx = { fn: target, that: null, args: args, earlyReturn: null };
      try { handler.call(null, ctx); } catch (e) {}
      if (ctx.earlyReturn !== null) return ctx.earlyReturn;
      return new (Function.prototype.bind.apply(target, [null].concat(args)))();
    }
  });
  try { proxied.__hzpProxy = 1; } catch (e) {}
  try {
    var d = getPd(r.target, r.prop);
    def(r.target, r.prop, {
      value: proxied,
      writable: d ? d.writable !== false : true,
      configurable: true,
      enumerable: d ? d.enumerable !== false : false
    });
  } catch (e) {}
}
function multiProxy(names, handler) { names.forEach(function (n) { makeProxy(n, handler); }); }

var NATIVE_LOC = self.location;
var LOC_PROPS = ['protocol', 'hash', 'host', 'hostname', 'origin', 'pathname', 'port', 'search', 'href'];
var PRISTINE_LOC = {};
LOC_PROPS.forEach(function (p) {
  var d = getPd(NATIVE_LOC, p) || (self.Location && getPd(self.Location.prototype, p));
  if (d && d.get) PRISTINE_LOC[p] = d;
});
var PRISTINE_PROTO_METHODS = {};
(function () {
  if (!self.Location) return;
  ['assign', 'replace', 'reload', 'toString'].forEach(function (m) {
    try {
      var f = self.Location.prototype[m];
      if (typeof f === 'function') PRISTINE_PROTO_METHODS[m] = f;
    } catch (e) {}
  });
})();

function currentRealUrl() {
  try {
    var proxied = PRISTINE_LOC.href.get.call(NATIVE_LOC);
    return realFrom(proxied) || REAL_BASE || PROXY_ORIGIN;
  } catch (e) { return REAL_BASE || PROXY_ORIGIN; }
}
function realUrlObj() {
  try { return new SN.URL(currentRealUrl()); } catch (e) { return null; }
}

self.__hzpLoc = function (p) {
  try {
    var u = realUrlObj();
    if (!u) return '';
    var v = u[String(p)];
    return v == null ? '' : String(v);
  } catch (e) { return ''; }
};

function navigate(rawUrl, replace) {
  try {
    var abs = resolveUrl(rawUrl, currentRealUrl());
    if (!abs) return;
    var proxied = toProxy(abs.href);
    var pristineMethod = replace ? PRISTINE_PROTO_METHODS.replace : PRISTINE_PROTO_METHODS.assign;
    if (typeof pristineMethod === 'function') {
      SN.oreflect.call(pristineMethod, NATIVE_LOC, [proxied]);
      fireNav(abs.href);
    }
  } catch (e) {}
}
var navHandlers = [];
function addNavHandler(fn) { try { navHandlers.push(fn); } catch (e) {} }
function fireNav(realHref) {
  for (var i = 0; i < navHandlers.length; i++) { try { navHandlers[i](realHref); } catch (_) {} }
  try { reportUrlSoon(); } catch (_) {}
}

function overlayLocation() {
  LOC_PROPS.forEach(function (prop) {
    var pristine = PRISTINE_LOC[prop];
    if (!pristine) return;
    var d = { configurable: true, enumerable: pristine.enumerable !== false };
    if (prop === 'href') {
      d.get = function () {
        try {
          var proxied = pristine.get.call(NATIVE_LOC);
          return realFrom(proxied) || proxied;
        } catch (e) { return ''; }
      };
      if (pristine.set) d.set = function (v) { try { navigate(String(v == null ? '' : v), false); } catch (e) {} };
      def(NATIVE_LOC, prop, d);
      return;
    }
    d.get = function () {
      try {
        var u = realUrlObj();
        if (!u) return '';
        return u[prop];
      } catch (e) { return ''; }
    };
    if (prop === 'origin') return def(NATIVE_LOC, prop, d);    
    if (pristine.set) {
      d.set = function (v) {
        try {
          var u = realUrlObj();
          if (!u) return;
          try { u[prop] = String(v == null ? '' : v); } catch (e) { return; }
          navigate(u.href, true);
        } catch (e) {}
      };
      def(NATIVE_LOC, prop, d);
    }
  });

    ['assign', 'replace'].forEach(function (m) {
    var orig = PRISTINE_PROTO_METHODS[m];
    if (typeof orig !== 'function') return;
    def(self.Location.prototype, m, {
      value: function (v) {
        try {
          var abs = resolveUrl(String(v), currentRealUrl());
          var proxied = abs ? toProxy(abs.href) : String(v);
          return SN.oreflect.call(orig, this, proxied);
        } catch (e) { return SN.oreflect.call(orig, this, v); }
      },
      writable: true, configurable: true
    });
  });
    var tos = PRISTINE_PROTO_METHODS.toString;
  if (typeof tos === 'function') {
    def(self.Location.prototype, 'toString', {
      value: function () {
        try {
          var real = realFrom(tos.call(this));
          return real || tos.call(this);
        } catch (e) { try { return tos.call(this); } catch (e2) { return ''; } }
      },
      writable: true, configurable: true
    });
  }
}

function hookHistory() {
  var proto = self.History && self.History.prototype;
  if (!proto) return;
  ['pushState', 'replaceState'].forEach(function (m) {
    var orig = proto[m];
    if (typeof orig !== 'function') return;
    def(proto, m, {
      value: function (state, title, url) {
        try {
          if (url != null) {
            var rawUrl = String(url);
            var abs = resolveUrl(rawUrl, currentRealUrl());
            var realOrigin = (function () {
              try { return new SN.URL(REAL_BASE || currentRealUrl()).origin; } catch (e) { return PROXY_ORIGIN; }
            })();
            if (abs && abs.origin !== realOrigin) return undefined;   
            if (abs) url = toProxy(abs.href);
          }
          var args = ([state, title, url]).filter(function (x) { return x !== undefined; });
          var ret = SN.oreflect.apply(orig, this, args);
          try { reportUrlSoon(); } catch (e) {}
          return ret;
        } catch (e) { try { return SN.oreflect.apply(orig, this, [state, title, url]); } catch (e2) { return undefined; } }
      },
      writable: true, configurable: true
    });
  });
}

var HIDDEN_SCRIPT_SRC = HIDDEN + 'script-source-src';

function hookElementAttrs() {
  if (!self.Element) return;
  var E = self.Element.prototype;
    var NAT_GET = E.getAttribute, NAT_SET = E.setAttribute, NAT_HAS = E.hasAttribute,
      NAT_REMOVE = E.removeAttribute, NAT_NAMES = E.getAttributeNames, NAT_SETNS = E.setAttributeNS;

  makeProxy('Element.prototype.setAttribute', function (ctx) {
    try {
      var name = ctx.args[0], value = ctx.args[1];
      if (name == null) return;
      name = String(name);
      if (name.indexOf(HIDDEN) === 0) return;
      if (ctx.that && ctx.that.tagName && value != null) {
        var out = pickProxied(value, ctx.that.tagName, name);
        if (out !== value) {
          try { SN.oreflect.call(NAT_SET, ctx.that, [HIDDEN + name, String(value)]); } catch (e) {}
          if (out === null) {
            try { SN.oreflect.call(NAT_REMOVE, ctx.that, [name]); } catch (e) {}
            ctx.args[0] = HIDDEN + name;
          }
          ctx.args[1] = String(out == null ? '' : out);
        }
      }
    } catch (e) {}
  });

  makeProxy('Element.prototype.getAttribute', function (ctx) {
    try {
      var name = ctx.args[0];
      if (name == null) return;
      if (String(name).indexOf(HIDDEN) === 0) { ctx.earlyReturn = ''; return; }
      var shadow = SN.oreflect.call(NAT_GET, ctx.that, [HIDDEN + String(name)]);
      if (shadow != null) { ctx.earlyReturn = shadow; return; }
      var raw = SN.oreflect.call(NAT_GET, ctx.that, [String(name)]);
      if (raw) {
        var tag = ctx.that.tagName;
        var rule = findRule(String(name), tag);
        if (rule && (rule.t === 'url' || rule.t === 'srcset')) {
          var real = rule.t === 'srcset' ? srcsetUnrewrite(raw) : (realFrom(raw) || raw);
          if (real !== raw) ctx.earlyReturn = real;
        }
      }
    } catch (e) {}
  });

  makeProxy('Element.prototype.getAttributeNames', function (ctx) {
    try {
      var names = SN.oreflect.call(NAT_NAMES, ctx.that, []);
      var out = [];
      for (var i = 0; i < names.length; i++) {
        if (String(names[i]).indexOf(HIDDEN) === 0) continue;
        out.push(names[i]);
      }
      ctx.earlyReturn = out;
    } catch (e) {}
  });

  makeTrap('Element.prototype.attributes', {
    get: function (c) {
      var map = c.get();
      if (!map) return map;
      function visibleNames() {
        var out = [];
        try {
          var len = map.length >>> 0;
          for (var i = 0; i < len; i++) {
            var a = map.item(i);
            var n = a && a.name;
            if (n != null && String(n).indexOf(HIDDEN) !== 0) out.push(String(n));
          }
        } catch (e) {}
        return out;
      }
      var iterSym = typeof Symbol !== 'undefined' ? Symbol.iterator : null;
      return new SN.Proxy(map, {
        get: function (target, prop) {
          var value = SN.oreflect.get(target, prop);
          if (prop === 'length') return visibleNames().length;
          if (iterSym && prop === iterSym) {
            return function () {
              var names = visibleNames();
              var i = 0;
              var iter = {};
              iter.next = function () {
                return i < names.length
                  ? { value: target.getNamedItem(names[i++]), done: false }
                  : { value: undefined, done: true };
              };
              iter[iterSym] = function () { return iter; };
              return iter;
            };
          }
          if (prop === 'item') {
            return function (idx) {
              var names = visibleNames();
              idx = Number(idx) >>> 0;
              return idx < names.length ? target.getNamedItem(names[idx]) : null;
            };
          }
          if (prop === 'getNamedItem') {
            return function (name) {
              return String(name).indexOf(HIDDEN) === 0 ? null : value.call(target, name);
            };
          }
          if (typeof value === 'function') return value.bind(target);
          if (typeof prop === 'string' && prop !== '' && String(Number(prop)) === prop) {
            var names = visibleNames();
            var idx = Number(prop) >>> 0;
            return idx < names.length ? target.getNamedItem(names[idx]) : undefined;
          }
          if (typeof prop === 'string' && prop.indexOf(HIDDEN) === 0) return undefined;
          return value;
        },
        has: function (target, prop) {
          if (typeof prop === 'string' && prop.indexOf(HIDDEN) === 0) return false;
          return SN.oreflect.has(target, prop);
        },
        ownKeys: function (target) {
          var keys = [];
          var names = visibleNames();
          for (var i = 0; i < names.length; i++) keys.push(String(i));
          return keys;
        },
        getOwnPropertyDescriptor: function (target, prop) {
          try {
            if (typeof prop === 'string' && prop !== '' && String(Number(prop)) === prop) {
              var d = SN.oget(target, prop);
              if (d && d.value && d.value.name && String(d.value.name).indexOf(HIDDEN) === 0) return undefined;
              return d;
            }
            return SN.oget(target, prop);
          } catch (e) { return undefined; }
        }
      });
    }
  });

  makeProxy('Element.prototype.hasAttribute', function (ctx) {
    try {
      if (String(ctx.args[0]).indexOf(HIDDEN) === 0) { ctx.earlyReturn = false; return; }
      var shadow = SN.oreflect.call(NAT_HAS, ctx.that, [HIDDEN + String(ctx.args[0])]);
      if (shadow) ctx.earlyReturn = false;
    } catch (e) {}
  });

  makeProxy('Element.prototype.removeAttribute', function (ctx) {
    try {
      var name = String(ctx.args[0]);
      if (name.indexOf(HIDDEN) === 0) return;
      if (SN.oreflect.call(NAT_HAS, ctx.that, [HIDDEN + name])) {
        SN.oreflect.call(NAT_REMOVE, ctx.that, [HIDDEN + name]);
      }
    } catch (e) {}
  });

  makeProxy('Element.prototype.toggleAttribute', function (ctx) {
    try {
      var name = String(ctx.args[0]);
      if (name.indexOf(HIDDEN) === 0) { ctx.earlyReturn = false; return; }
      if (ctx.args.length < 2 || !ctx.args[1]) {
        if (SN.oreflect.call(NAT_HAS, ctx.that, [HIDDEN + name])) {
          SN.oreflect.call(NAT_REMOVE, ctx.that, [HIDDEN + name]);
        }
      }
    } catch (e) {}
  });

  makeProxy('Element.prototype.setAttributeNS', function (ctx) {
    try {
      var name = String(ctx.args[1] || '');
      var value = ctx.args[2];
      if (ctx.that && ctx.that.tagName && value != null) {
        var out = pickProxied(value, ctx.that.tagName, name);
        if (out !== value) {
          try { SN.oreflect.call(NAT_SET, ctx.that, [HIDDEN + name, String(value)]); } catch (e) {}
          ctx.args[2] = String(out == null ? '' : out);
        }
      }
    } catch (e) {}
  });

    try {
    var NN = self.NamedNodeMap && self.NamedNodeMap.prototype;
    if (NN) {
      ['getNamedItem', 'item'].forEach(function (m) {
        var orig = NN[m];
        if (typeof orig !== 'function') return;
        def(NN, m, {
          value: function () {
            var v = SN.oreflect.apply(orig, this, arguments);
            try {
              if (v && v.name && String(v.name).indexOf(HIDDEN) === 0) return null;
            } catch (e) {}
            return v;
          },
          writable: true, configurable: true
        });
      });
    }
  } catch (e) {}

    try {
    var A = self.Attr;
    if (A) {
      ['value', 'nodeValue'].forEach(function (prop) {
        makeTrap('Attr.prototype.' + prop, {
          get: function (c) {
            try {
              var owner = c.self && c.self.ownerElement;
              if (owner && c.self.name) {
                var shadow = SN.oreflect.call(NAT_GET, owner, [HIDDEN + String(c.self.name)]);
                if (shadow != null) return shadow;
                return SN.oreflect.call(NAT_GET, owner, [String(c.self.name)]);
              }
            } catch (e) {}
            return c.get();
          },
          set: function (c, v) {
            try {
              var owner = c.self && c.self.ownerElement;
              if (owner && c.self.name) {
                return SN.oreflect.call(NAT_SET, owner, [String(c.self.name), v]);
              }
            } catch (e) {}
            return c.set(v);
          }
        });
      });
    }
  } catch (e) {}
}

var ATTR_OBJECT = {
  src:         ['HTMLImageElement', 'HTMLMediaElement', 'HTMLIFrameElement', 'HTMLFrameElement', 'HTMLEmbedElement', 'HTMLScriptElement', 'HTMLSourceElement', 'HTMLTrackElement', 'HTMLInputElement'],
  href:        ['HTMLAnchorElement', 'HTMLLinkElement'],
  data:        ['HTMLObjectElement'],
  action:      ['HTMLFormElement'],
  formaction:  ['HTMLButtonElement', 'HTMLInputElement'],
  srcdoc:      ['HTMLIFrameElement'],
  poster:      ['HTMLVideoElement'],
  imagesrcset: ['HTMLLinkElement'],
  srcset:      ['HTMLImageElement', 'HTMLSourceElement'],
  csp:         ['HTMLIFrameElement'],
  credentialless: ['HTMLIFrameElement'],
  nonce:       ['HTMLElement'],
  integrity:   ['HTMLScriptElement', 'HTMLLinkElement']
};
var STRIP_VALUE_ATTRS = { nonce: 1, integrity: 1, csp: 1, credentialless: 1 };

function hookUrlProperties() {
  Object.keys(ATTR_OBJECT).forEach(function (attr) {
    ATTR_OBJECT[attr].forEach(function (className) {
      var ctor = self[className];
      if (!ctor || !ctor.prototype) return;
      var proto = ctor.prototype;
      var desc = getPd(proto, attr);
      if (!desc || !desc.get) return;
      var isSrcset = attr === 'srcset' || attr === 'imagesrcset';
      if (STRIP_VALUE_ATTRS[attr]) {
        def(proto, attr, {
          get: function () { return ''; },
          set: function () { return true; },
          configurable: true,
          enumerable: desc.enumerable !== false
        });
        return;
      }
      var unproxyRaw = isSrcset ? srcsetUnrewrite : function (raw) {
        if (!raw) return raw;
        return realFrom(raw) || raw;
      };
      def(proto, attr, {
        get: function () {
          try { return unproxyRaw(desc.get.call(this)); } catch (e) { try { return desc.get.call(this); } catch (e2) { return ''; } }
        },
        set: function (v) {
          try {
            var s = String(v == null ? '' : v);
            var out;
            if (isSrcset) out = srcsetValue(s);
            else if (attr === 'srcdoc') out = toProxy(s);
            else out = (realFrom(s) ? s : toProxy(s));
            return desc.set.call(this, out == null ? '' : out);
          } catch (e) { try { return desc.set.call(this, v); } catch (e2) {} }
        },
        configurable: true,
        enumerable: desc.enumerable !== false
      });
    });
  });

    try {
    ['HTMLAnchorElement', 'HTMLAreaElement'].forEach(function (cls) {
      var proto = self[cls] && self[cls].prototype;
      if (!proto) return;
      var hrefDesc = getPd(proto, 'href');
      if (!hrefDesc || !hrefDesc.get) return;
      ['protocol', 'hash', 'host', 'hostname', 'origin', 'pathname', 'port', 'search'].forEach(function (p) {
        def(proto, p, {
          get: function () {
            try {
              var raw = hrefDesc.get.call(this);
              var real = realFrom(raw) || raw;
              var u = new SN.URL(real);
              return u[p];
            } catch (e) { try { return ''; } catch (e2) { return ''; } }
          }
        });
      });
      try {
        var ts = proto.toString;
        if (typeof ts === 'function') {
          def(proto, 'toString', {
            value: function () {
              try {
                var raw = ts.call(this);
                return realFrom(raw) || raw;
              } catch (e) { try { return ts.call(this); } catch (e2) { return ''; } }
            },
            writable: true, configurable: true
          });
        }
      } catch (e) {}
    });
  } catch (e) {}

    try {
    if (self.HTMLImageElement) {
      makeTrap('HTMLImageElement.prototype.currentSrc', {
        get: function (c) {
          try {
            var raw = c.get();
            return raw ? (realFrom(raw) || raw) : raw;
          } catch (e) { return c.get(); }
        }
      });
    }
  } catch (e) {}

    try {
    if (self.SVGAnimatedString) {
      multiTrap(['SVGAnimatedString.prototype.baseVal', 'SVGAnimatedString.prototype.animVal'], {
        get: function (c) {
          try {
            var raw = c.get();
            return raw ? (realFrom(raw) || raw) : raw;
          } catch (e) { return c.get(); }
        }
      });
    }
  } catch (e) {}

    try {
    makeTrap('Node.prototype.baseURI', {
      get: function (c) { return currentRealUrl(); }
    });
  } catch (e) {}
}

function hookDocument() {
  if (!self.Document) return;
  try {
    makeTrap('Document.prototype.domain', {
      get: function (c) { try { var u = realUrlObj(); return u ? u.hostname : ''; } catch (e) { return ''; } },
      set: function (c, v) { return false; }
    });
    makeTrap('Document.prototype.documentURI', { get: function (c) { return currentRealUrl(); } });
    makeTrap('Document.prototype.URL', { get: function (c) { return currentRealUrl(); } });
    makeTrap('Document.prototype.referrer', {
      get: function (c) {
        try {
          var raw = c.get();
          return raw ? (realFrom(raw) || raw) : raw;
        } catch (e) { return ''; }
      }
    });
    multiProxy(['Document.prototype.querySelector', 'Document.prototype.querySelectorAll'], function (ctx) {
      try {
        ctx.args[0] = String(ctx.args[0]).replace(/((?:^|\\s)\\b\\w+\\[(?:src|href|data-href))[\\^]?(=['"]?(?:https?[:])?\\/\\/)/, '$1*$2');
      } catch (e) {}
    });
  } catch (e) {}
  try {
    if (self.PerformanceEntry) {
      makeTrap('PerformanceEntry.prototype.name', {
        get: function (c) {
          try {
            var raw = c.get();
            if (typeof raw === 'string' && raw.indexOf('/proxy/') !== -1) return realFrom(raw) || raw;
            return raw;
          } catch (e) { return c.get(); }
        }
      });
    }
  } catch (e) {}
}

function rewriteHtmlChunk(html) {
  try {
    if (typeof html !== 'string' || html.indexOf('<') === -1) return html;
    return html.replace(/<[a-zA-Z][^<>]*>/g, function (tag) {
      return tag.replace(/(\\s)(src|href|action|formaction|poster|data|srcset|imagesrcset|style)(\\s*=\\s*)("[^"]*"|'[^']*'|[^\\s>]+)/gi, function (m, sp, attr, eq, raw) {
        try {
          var q = '';
          var v = raw;
          var c0 = v.charAt(0);
          if (c0 === '"' || c0 === "'") { q = c0; v = v.slice(1, -1); }
          if (!v || v.charAt(0) === '#') return m;
          var lower = attr.toLowerCase();
          var out = v;
          if (lower === 'style') out = rewriteCssStr(v);
          else if (lower === 'srcset' || lower === 'imagesrcset') out = srcsetValue(v);
          else if (!/^(javascript|mailto|tel|data|blob|about):/i.test(v)) out = toProxy(v);
          if (out === v || out == null) return m;
          return sp + attr + eq + q + out + q;
        } catch (e) { return m; }
      });
    });
  } catch (e) { return html; }
}
function hookDocumentWrite() {
  try {
    var dp = self.Document && self.Document.prototype;
    if (!dp) return;
    ['write', 'writeln'].forEach(function (m) {
      var orig = dp[m];
      if (typeof orig !== 'function') return;
      def(dp, m, {
        value: function () {
          var args = [];
          for (var i = 0; i < arguments.length; i++) args.push(rewriteHtmlChunk(String(arguments[i] == null ? '' : arguments[i])));
          return SN.oreflect.apply(orig, this, args);
        },
        writable: true, configurable: true
      });
    });
  } catch (e) {}
}
function wrapMessageData(data) {
  var u = null;
  try { u = realUrlObj(); } catch (e) {}
  var origin = (u && u.origin) || REAL_ORIGIN || PROXY_ORIGIN;
  return { $hzp$messagetype: 'window', $hzp$origin: String(origin), $hzp$data: data };
}
function hookPostMessage() {
  try {
    makeProxy('window.postMessage', function (ctx) {
      try {
        ctx.args[0] = wrapMessageData(ctx.args[0]);
        if (typeof ctx.args[1] === 'string') ctx.args[1] = '*';
        else if (ctx.args[1] && typeof ctx.args[1] === 'object') {
          try { ctx.args[1].targetOrigin = '*'; } catch (e) {}
        }
      } catch (e) {}
    });
  } catch (e) {}
  try {
    self.__hzpPMW = function (w) {
      return {
        postMessage: function (a, b, c) {
          try { return SN.oreflect.call(self.postMessage, w, [a, b, c]); }
          catch (e) { try { return SN.oreflect.call(SN.rawPost, w, [a, b, c]); } catch (e2) { return undefined; } }
        }
      };
    };
  } catch (e) {}
  try {
    if (self.MessageEvent && self.MessageEvent.prototype) {
      var mp = self.MessageEvent.prototype;
      var rawData = getPd(mp, 'data');
      var rawDataGet = rawData && rawData.get;
      makeTrap('MessageEvent.prototype.data', {
        get: function (c) {
          try {
            var d = c.get();
            if (d && typeof d === 'object' && d.$hzp$messagetype === 'window' && ('$hzp$data' in d)) return d.$hzp$data;
          } catch (e) {}
          return c.get();
        }
      });
      makeTrap('MessageEvent.prototype.origin', {
        get: function (c) {
          try {
            var d = rawDataGet ? SN.oreflect.call(rawDataGet, c.self, []) : null;
            if (d && typeof d === 'object' && d.$hzp$messagetype === 'window' && typeof d.$hzp$origin === 'string') return d.$hzp$origin;
          } catch (e) {}
          return c.get();
        }
      });
    }
  } catch (e) {}
}
function hookCookies() {
  if (!self.Document) return;
  makeTrap('Document.prototype.cookie', {
    get: function (c) {
      try {
        var raw = c.get() || '';
        var realHost = '';
        try { realHost = realUrlObj().hostname; } catch (e) {}
        if (!realHost) return raw;
        var prefix = 'hz-' + realHost + ':';
        var items = raw.split('; ').filter(Boolean);
        var out = [];
        for (var i = 0; i < items.length; i++) {
          var eq = items[i].indexOf('=');
          var name = eq === -1 ? items[i] : items[i].slice(0, eq);
          if (name.indexOf('hz-') === 0 && name.indexOf(':', 3) !== -1) {
            var host = name.slice(3, name.indexOf(':', 3));
            if (host !== realHost) continue;                
            out.push(name.slice(prefix.length) + (eq === -1 ? '' : '=' + items[i].slice(eq + 1)));
          } else {
            out.push(items[i]);
          }
        }
        return out.join('; ');
      } catch (e) { return c.get(); }
    },
    set: function (c) {
      try {
        var v = String(c.value || '');
        var realHost = '';
        try { realHost = realUrlObj().hostname; } catch (e) {}
        if (!realHost) return c.set(v);
        var eq = v.indexOf('=');
        if (eq > 0) {
          var name = v.slice(0, eq);
                    if (name.indexOf('hz-') !== 0) return c.set('hz-' + realHost + ':' + v);
        }
        return c.set(v);
      } catch (e) { try { c.set(c.value); } catch (e2) {} }
    }
  });
  try { delete self.cookieStore; } catch (e) {}
  try { if (self.CookieChangeEvent) delete self.CookieChangeEvent; } catch (e) {}
}

function isolateStorages() {
  function hostPrefix() {
    try { var u = realUrlObj(); return (u ? u.hostname : '') + '@'; } catch (e) { return '@'; }
  }
  function storageProxy(storage) {
    return new SN.Proxy(storage, {
      get: function (target, prop) {
        switch (prop) {
          case 'getItem':     return function (k) { return target.getItem(hostPrefix() + k); };
          case 'setItem':     return function (k, v) { return target.setItem(hostPrefix() + k, v); };
          case 'removeItem':  return function (k) { return target.removeItem(hostPrefix() + k); };
          case 'clear':       return function () {
            var keys = [];
            try {
              for (var i = 0; i < target.length; i++) { var k = target.key(i); if (k && k.indexOf(hostPrefix()) === 0) keys.push(k); }
            } catch (e) {}
            keys.forEach(function (k) { target.removeItem(k); });
          };
          case 'key':         return function (i) {
            var keys = [];
            try {
              for (var n = 0; n < target.length; n++) { var k = target.key(n); if (k && k.indexOf(hostPrefix()) === 0) keys.push(k); }
            } catch (e) {}
            return target.getItem(keys[i]);
          };
          case 'length':      return (function () {
            var n2 = 0;
            try {
              for (var j = 0; j < target.length; j++) { if (String(target.key(j) || '').indexOf(hostPrefix()) === 0) n2++; }
            } catch (e) {}
            return n2;
          })();
          default:
            if (prop in Object.prototype || typeof prop === 'symbol') {
              return SN.oreflect.get(target, prop);
            }
            return target.getItem(hostPrefix() + String(prop));
        }
      },
      set: function (target, prop, value) {
        try { target.setItem(hostPrefix() + String(prop), value); } catch (e) {}
        return true;
      },
      has: function (target, prop) {
        return target.getItem(hostPrefix() + String(prop)) !== null;
      },
      ownKeys: function (target) {
        var keys = [];
        try {
          for (var i = 0; i < target.length; i++) {
            var k = target.key(i);
            if (k && k.indexOf(hostPrefix()) === 0) keys.push(k.slice(hostPrefix().length));
          }
        } catch (e) {}
        return keys;
      },
      getOwnPropertyDescriptor: function (target, property) {
        var v = target.getItem(hostPrefix() + String(property));
        if (v === null) return undefined;
        return { value: v, enumerable: true, configurable: true, writable: true };
      },
      defineProperty: function (target, property, attrs) {
        try { target.setItem(hostPrefix() + String(property), attrs.value); } catch (e) {}
        return true;
      }
    });
  }
  try {
    var ls = null, ss = null;
    try { ls = self.localStorage; } catch (e) {}
    try { ss = self.sessionStorage; } catch (e) {}
    if (ls) SN.od(self, 'localStorage', { value: storageProxy(ls), configurable: true });
    if (ss) SN.od(self, 'sessionStorage', { value: storageProxy(ss), configurable: true });
  } catch (e) {}
}

function hookCss() {
  try {
    if (self.CSSStyleDeclaration) {
      var proto = self.CSSStyleDeclaration.prototype;
      makeProxy('CSSStyleDeclaration.prototype.setProperty', function (ctx) {
        try { if (ctx.args[1]) ctx.args[1] = rewriteCssStr(ctx.args[1]); } catch (e) {}
      });
      makeProxy('CSSStyleDeclaration.prototype.getPropertyValue', function (ctx) {
        try {
          var v = SN.oreflect.call(proto.getPropertyValue, ctx.that, ctx.args);
          if (v) ctx.earlyReturn = unrewriteCssStr(v);
        } catch (e) {}
      });
      makeTrap('CSSStyleDeclaration.prototype.cssText', {
        set: function (c) { try { c.set(rewriteCssStr(c.value)); } catch (e) { c.set(c.value); } },
        get: function (c) { try { return unrewriteCssStr(c.get()); } catch (e) { return c.get(); } }
      });
    }
    if (self.CSSStyleSheet) {
      makeProxy('CSSStyleSheet.prototype.insertRule', function (ctx) {
        try { ctx.args[0] = rewriteCssStr(ctx.args[0]); } catch (e) {}
      });
      makeProxy('CSSStyleSheet.prototype.replace', function (ctx) {
        try { if (typeof ctx.args[0] === 'string') ctx.args[0] = rewriteCssStr(ctx.args[0]); } catch (e) {}
      });
      makeProxy('CSSStyleSheet.prototype.replaceSync', function (ctx) {
        try { ctx.args[0] = rewriteCssStr(ctx.args[0]); } catch (e) {}
      });
    }
    if (self.CSSRule) {
      makeTrap('CSSRule.prototype.cssText', {
        set: function (c) { try { c.set(rewriteCssStr(c.value)); } catch (e) { c.set(c.value); } },
        get: function (c) { try { return unrewriteCssStr(c.get()); } catch (e) { return c.get(); } }
      });
    }
  } catch (e) {}
  try {
    if (self.HTMLElement && self.CSSStyleDeclaration) {
      var styleProxyCache = typeof WeakMap === 'function' ? new WeakMap() : null;
      makeTrap('HTMLElement.prototype.style', {
        get: function (c) {
          var st = c.get();
          if (!st || !styleProxyCache) return st;
          var w = styleProxyCache.get(st);
          if (w) return w;
          var bound = typeof WeakMap === 'function' ? new WeakMap() : null;
          w = new SN.Proxy(st, {
            get: function (target, prop) {
              var v = SN.oreflect.get(target, prop);
              if (typeof v === 'function') {
                if (bound) {
                  var b = bound.get(v);
                  if (!b) { b = v.bind(target); bound.set(v, b); }
                  return b;
                }
                return v.bind(target);
              }
              if (typeof v === 'string' && v.indexOf('/') !== -1) return unrewriteCssStr(v);
              return v;
            },
            set: function (target, prop, value) {
              if (prop === 'cssText' || value === '' || typeof value !== 'string') return SN.oreflect.set(target, prop, value);
              return SN.oreflect.set(target, prop, rewriteCssStr(value));
            }
          });
          styleProxyCache.set(st, w);
          return w;
        }
      });
    }
  } catch (e) {}
  try {
    if (self.FontFace) {
      makeProxy('FontFace', function (ctx) {
        try {
          if (ctx.args[1] && typeof ctx.args[1] === 'string') ctx.args[1] = rewriteCssStr(ctx.args[1]);
        } catch (e) {}
      });
    }
  } catch (e) {}
}

function hookRequests() {
  try {
    if (self.fetch) {
      var origFetch = self.fetch;
      if (origFetch.__hzpProxy) return;
      var wrappedFetch = function wrappedFetch(input, init) {
        try {
          if (input && typeof input === 'object' && self.Request && input instanceof self.Request) {
            return SN.oreflect.call(origFetch, self, [input, init]);
          }
          var url;
          if (input && typeof input === 'object') {
            if (typeof input.url === 'string') url = input.url;           
            else if (typeof input.href === 'string') url = input.href;    
            else url = null;
          } else { url = input; }
          if (typeof url === 'string' && !/^(data|blob|file):/i.test(url)) {
            var proxied = toProxy(url);
            if (proxied !== url) {
              if (typeof input === 'string') input = proxied;
              else if (self.Request && input instanceof self.Request) input = new self.Request(proxied, input);
              else input = proxied;
            }
          }
        } catch (e) {}
        return SN.oreflect.call(origFetch, self, [input, init]);
      };
      wrappedFetch.__hzpProxy = 1;
      defWithoutError(self, 'fetch', wrappedFetch);
    }
  } catch (e) {}
  try {
    if (self.Request) {
      makeProxy('Request', function (ctx) {
        try {
          var target = ctx.args[0];
          var url = (target && typeof target === 'object' && target.url) ? target.url : target;
          if (typeof url === 'string') ctx.args[0] = toProxy(url);
        } catch (e) {}
      });
    }
  } catch (e) {}
  try {
    multiTrap(['Request.prototype.url', 'Response.prototype.url'], {
      get: function (c) {
        try {
          var raw = c.get();
          return raw ? (realFrom(raw) || raw) : raw;
        } catch (e) { return c.get(); }
      }
    });
    if (self.Response && self.Headers) {
      var headersProxyCache = typeof WeakMap === 'function' ? new WeakMap() : null;
      makeTrap('Response.prototype.headers', {
        get: function (c) {
          var h = c.get();
          if (!h || !headersProxyCache) return h;
          var hasLink = false;
          try { hasLink = h.has && h.has('link'); } catch (e) {}
          if (!hasLink) return h;
          var w = headersProxyCache.get(h);
          if (w) return w;
          w = new SN.Proxy(h, {
            get: function (target, prop) {
              var v = SN.oreflect.get(target, prop);
              if (typeof v === 'function') {
                if (prop === 'get') {
                  return function (name) {
                    var out = target.get(name);
                    if (out && String(name).toLowerCase() === 'link') return unrewriteLinkHeader(out);
                    return out;
                  };
                }
                return v.bind(target);
              }
              return v;
            }
          });
          headersProxyCache.set(h, w);
          return w;
        }
      });
    }
  } catch (e) {}
  try {
    if (self.XMLHttpRequest) {
      makeProxy('XMLHttpRequest.prototype.open', function (ctx) {
        try {
          if (ctx.args[1]) ctx.args[1] = toProxy(String(ctx.args[1]));
          if (ctx.args[2] === undefined) ctx.args[2] = true;
        } catch (e) {}
      });
      makeTrap('XMLHttpRequest.prototype.responseURL', {
        get: function (c) {
          try {
            var raw = c.get();
            return raw ? (realFrom(raw) || raw) : raw;
          } catch (e) { return c.get(); }
        }
      });
      makeProxy('XMLHttpRequest.prototype.getAllResponseHeaders', function (ctx) {
        try {
          var raw = SN.oreflect.apply(ctx.fn, ctx.that, ctx.args);
          if (typeof raw === 'string' && raw && raw.toLowerCase().indexOf('link') !== -1) {
            ctx.earlyReturn = raw.split('\\r\\n').map(function (line) {
              var m = /^([^:]+):\\s?([\\s\\S]*)$/.exec(line);
              if (m && m[1].toLowerCase() === 'link') return m[1] + ': ' + unrewriteLinkHeader(m[2]);
              return line;
            }).join('\\r\\n');
          }
        } catch (e) {}
      });
      makeProxy('XMLHttpRequest.prototype.getResponseHeader', function (ctx) {
        try {
          if (String(ctx.args[0] || '').toLowerCase() !== 'link') return;
          var raw = SN.oreflect.apply(ctx.fn, ctx.that, ctx.args);
          if (typeof raw === 'string' && raw) ctx.earlyReturn = unrewriteLinkHeader(raw);
        } catch (e) {}
      });
    }
  } catch (e) {}
  try {
    if (self.EventSource) {
      makeProxy('EventSource', function (ctx) {
        try { if (ctx.args[0]) ctx.args[0] = toProxy(String(ctx.args[0])); } catch (e) {}
      });
      makeTrap('EventSource.prototype.url', {
        get: function (c) {
          try {
            var raw = c.get();
            return raw ? (realFrom(raw) || raw) : raw;
          } catch (e) { return c.get(); }
        }
      });
    }
  } catch (e) {}
  try {
    if (self.WebSocket) {
      makeProxy('WebSocket', function (ctx) {
        try { if (ctx.args[0]) ctx.args[0] = toProxy(String(ctx.args[0])); } catch (e) {}
      });
    }
  } catch (e) {}
  try {
    if (self.Worker) {
      makeProxy('Worker', function (ctx) {
        try { if (ctx.args[0]) ctx.args[0] = toProxy(String(ctx.args[0])); } catch (e) {}
      });
    }
    if (self.SharedWorker) {
      makeProxy('SharedWorker', function (ctx) {
        try { if (ctx.args[0]) ctx.args[0] = toProxy(String(ctx.args[0])); } catch (e) {}
      });
    }
    if (self.Worklet && self.Worklet.prototype.addModule) {
      makeProxy('Worklet.prototype.addModule', function (ctx) {
        try { if (ctx.args[0]) ctx.args[0] = toProxy(String(ctx.args[0])); } catch (e) {}
      });
    }
  } catch (e) {}
  try {
    if (self.Audio) {
      makeProxy('Audio', function (ctx) {
        try { if (ctx.args[0] != null) ctx.args[0] = toProxy(String(ctx.args[0])); } catch (e) {}
      });
    }
  } catch (e) {}
  try {
    if (self.navigator && typeof self.navigator.sendBeacon === 'function') {
      makeProxy('Navigator.prototype.sendBeacon', function (ctx) {
        try { if (ctx.args[0]) ctx.args[0] = toProxy(String(ctx.args[0])); } catch (e) {}
      });
    }
  } catch (e) {}
    try {
    if (self.navigator && 'serviceWorker' in self.navigator) {
            var swRemoved = false;
      try { if (self.Navigator && self.Navigator.prototype) swRemoved = delete self.Navigator.prototype.serviceWorker; } catch (e) {}
      if (!swRemoved) {
        try { delete self.navigator.serviceWorker; } catch (e) {}
        try { if (self.Navigator && self.Navigator.prototype) SN.od(self.Navigator.prototype, 'serviceWorker', { value: undefined, configurable: true }); } catch (e) {}
      }
    }
  } catch (e) {}
}
function defWithoutError(obj, name, value) {
  try { SN.od(obj, name, { value: value, writable: true, configurable: true, enumerable: true }); } catch (e) {}
}

var SELF_SRC = (function () {
  try {
    return (self.document && self.document.currentScript && self.document.currentScript.textContent) || '';
  } catch (e) { return ''; }
})();

function injectSubframeClient(win) {
  try {
    if (!win || !win.document) return;
    var d = win.document;
    if (!d.documentElement) return;
    if (d.documentElement.__hzpInstalled) return;
    try { d.documentElement.__hzpInstalled = 1; } catch (e) {}
    if (!SELF_SRC) return;
    try { if (typeof win.__hzpOriginOverride !== 'string') win.__hzpOriginOverride = PROXY_ORIGIN; } catch (e) {}
    var s = d.createElement('script');
    s.textContent = SELF_SRC;
    d.head.appendChild(s);
  } catch (e) {}
}

function hookWindow() {
  try {
    if (typeof self.open === 'function' && !self.open.__hzpProxy) {
      var origOpen = self.open;
      var wrappedOpen = function open(url, target, features) {
        try {
          if (url != null && url !== '') url = toProxy(String(url));
          if (target != null) {
            var tgt = String(target);
            if (tgt === '_top' || tgt === '_unfencedTop' || tgt === '_parent') tgt = '_self';
            target = tgt;
          }
        } catch (e) {}
        var win = SN.oreflect.call(origOpen, self, [url, target, features]);
        if (win) { try { injectSubframeClient(win); } catch (e) {} }
        return win;
      };
      wrappedOpen.__hzpProxy = 1;
      defWithoutError(self, 'open', wrappedOpen);
    }
  } catch (e) {}

  try {
    makeTrap('window.frameElement', {
      get: function (c) {
        var f = c.get();
        if (!f) return f;
        try {
          var w = f.ownerDocument && f.ownerDocument.defaultView;
          if (w && w.__hzpClient) return f;
        } catch (e) {}
        return null;
      }
    });
  } catch (e) {}
  try {
    if (self.HashChangeEvent) {
      ['oldURL', 'newURL'].forEach(function (p) {
        makeTrap('HashChangeEvent.prototype.' + p, {
          get: function (c) {
            try {
              var raw = c.get();
              return raw ? (realFrom(raw) || raw) : raw;
            } catch (e) { return c.get(); }
          }
        });
      });
    }
  } catch (e) {}
  try {
    if (self.StorageEvent) {
      makeTrap('StorageEvent.prototype.key', {
        get: function (c) {
          try {
            var k = c.get();
            var u = realUrlObj();
            var pre = u ? u.hostname + '@' : '';
            if (pre && k && String(k).indexOf(pre) === 0) return String(k).slice(pre.length);
          } catch (e) {}
          return c.get();
        }
      });
      makeTrap('StorageEvent.prototype.url', {
        get: function (c) {
          try {
            var raw = c.get();
            return raw ? (realFrom(raw) || raw) : raw;
          } catch (e) { return c.get(); }
        }
      });
    }
  } catch (e) {}

  try {
        var crossTop = false;
    try {
      if (self.top !== self) {
        try { if (self.parent.location.origin !== PROXY_ORIGIN) crossTop = true; }
        catch (e) { crossTop = true; }
      }
    } catch (e) { crossTop = true; }
    if (crossTop) {
      try { SN.od(self, 'top', { get: function () { return self; }, configurable: true }); } catch (e) {}
      try { SN.od(self, 'parent', { get: function () { return self; }, configurable: true }); } catch (e) {}
    }
  } catch (e) {}

  try {
    if ('origin' in self) {
      SN.od(self, 'origin', {
        get: function () {
          try { var u = realUrlObj(); return u ? u.origin : (REAL_ORIGIN || PROXY_ORIGIN); }
          catch (e) { return REAL_ORIGIN || PROXY_ORIGIN; }
        },
        configurable: true
      });
    }
    if (self.document && 'origin' in self.document) {
      SN.od(self.document, 'origin', {
        get: function () {
          try { var u = realUrlObj(); return u ? u.origin : (REAL_ORIGIN || PROXY_ORIGIN); }
          catch (e) { return REAL_ORIGIN || PROXY_ORIGIN; }
        },
        configurable: true
      });
    }
  } catch (e) {}

    try {
    var delGlobal = function (name) {
      try {
        var split = name.split('.');
        var prop = split.pop();
        var target = split.reduce(function (a, b) { return a ? a[b] : null; }, self);
        if (!target) return;
        try { delete target[prop]; } catch (e) { try { SN.od(target, prop, { value: undefined, configurable: true }); } catch (e2) {} }
      } catch (e) {}
    };
    ['BarcodeDetector', 'FaceDetector', 'TextDetector'].forEach(delGlobal);
    try { if (self.ServiceWorkerRegistration) try { delete self.ServiceWorkerRegistration.prototype.sync; } catch (e) {} } catch (e) {}
    ['IdleDetector', 'Presentation', 'PresentationReceiver', 'Bluetooth', 'BluetoothDevice', 'ContactAddress', 'NavigateEvent', 'NavigationActivation'].forEach(delGlobal);
    ['presentation', 'hid', 'bluetooth', 'contacts', 'windowControlsOverlay', 'joinAdInterestGroup'].forEach(function (p) {
      try { if (self.Navigator && self.Navigator.prototype) try { delete self.Navigator.prototype[p]; } catch (e) {} } catch (e) {}
    });
  } catch (e) {}

    try {
    var NP = self.Navigator && self.Navigator.prototype;
    if (NP && typeof NP.registerProtocolHandler === 'function') {
      def(NP, 'registerProtocolHandler', { value: function () { return undefined; }, writable: true, configurable: true });
      if (typeof NP.unregisterProtocolHandler === 'function') {
        def(NP, 'unregisterProtocolHandler', { value: function () { return undefined; }, writable: true, configurable: true });
      }
    }
  } catch (e) {}

    try {
    if (self.navigation && typeof self.navigation.addEventListener === 'function') {
      self.navigation.addEventListener('navigate', function (e) {
        try {
          var dest = e.destination && e.destination.url;
          if (!dest) return;
          if (dest.indexOf(PROXY_ORIGIN) === 0) return;
          e.preventDefault();
          self.location.assign(toProxy(dest));
        } catch (err) {}
      });
    }
  } catch (e) {}
}

function hookDomEvents() {
  try {
    var doc = self.document;
    if (!doc) return;
    var lastGesture = 0;
    doc.addEventListener('pointerdown', function () { try { lastGesture = SN.now(); } catch (e) {} }, true);
    self.addEventListener('popstate', function () { try { reportUrlSoon(); } catch (e) {} });
    doc.addEventListener('click', function (e) {
      try {
        var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
        if (!a) return;
        var h = a.getAttribute('href') || '';
        if (!h || h.charAt(0) === '#') return;
        if (/^(javascript|mailto|tel|data):/i.test(h)) return;
        e.preventDefault();
        var dest = toProxy(h);
        var tgt = a.getAttribute('target');
        if (tgt && tgt !== '_self') { self.open(dest, tgt, 'noopener,noreferrer'); }
        else { self.location.assign(dest); }
      } catch (err) {}
    }, true);
    doc.addEventListener('submit', function (e) {
      try {
        var f = e.target;
        if (!f || !f.action) return;
        e.preventDefault();
        var a = f.getAttribute('action') || '';
        var proxied = toProxy(a);
        f.setAttribute(HIDDEN + 'action', a);
        f.setAttribute('action', proxied);
        f.submit();
      } catch (err) {}
    }, true);
  } catch (e) {}
}

var mo = null;
var observerDisabled = false;
var pendingSet = null;
var scheduled = false;
var FLUSH_BUDGET_MS = 8;
var flushStrikes = 0;

var MO_SELECTOR = 'script[src],img[src],iframe[src],link[href],a[href],form[action],' +
  'object[data],embed[src],button[formaction],input[formaction],textarea[formaction],input[src],track[src],frame[src],' +
  'video[src],video[poster],audio[src],source[src],source[srcset],img[srcset],link[imagesrcset]';

function rewriteOneElement(el) {
  if (!el || !el.tagName || !el.getAttribute) return;
  try {
    var tag = el.tagName.toUpperCase();
    try {
      ['src', 'href', 'data', 'action', 'formaction', 'poster'].forEach(function (attr) {
        var raw = el.getAttribute(attr);
        if (!raw) return;
        if (realFrom(raw)) return;
        if (!shouldProxyRef(raw)) return;
        var proxied = toProxy(raw);
        if (proxied === raw) return;
        el.setAttribute(HIDDEN + attr, raw);
        el.setAttribute(attr, proxied);
      });
    } catch (e) {}
    if (tag === 'IMG' || tag === 'SOURCE') {
      try {
        var ss = el.getAttribute('srcset');
        if (ss) {
          var proxied2 = srcsetValue(ss);
          if (proxied2 !== ss) { el.setAttribute(HIDDEN + 'srcset', ss); el.setAttribute('srcset', proxied2); }
        }
      } catch (e) {}
    }
    if (tag === 'LINK') {
      try {
        var iss = el.getAttribute('imagesrcset');
        if (iss) {
          var proxied3 = srcsetValue(iss);
          if (proxied3 !== iss) { el.setAttribute(HIDDEN + 'imagesrcset', iss); el.setAttribute('imagesrcset', proxied3); }
        }
      } catch (e) {}
    }
    if (tag === 'STYLE') {
      try {
        var css = el.textContent;
        if (css && css.indexOf('url(') !== -1) {
          var rewritten = rewriteCssStr(css);
          if (rewritten !== css) el.textContent = rewritten;
        }
      } catch (e) {}
    }
  } catch (e) {}
}

function flushObserver() {
  scheduled = false;
  var start = SN.now();
  pendingSet.forEach(function (n) {
    try {
      if (!n || n.nodeType !== 1 || !n.isConnected) return;
      rewriteOneElement(n);
      var q = n.querySelectorAll(MO_SELECTOR);
      if (q) { for (var i = 0; i < q.length; i++) rewriteOneElement(q[i]); }
    } catch (e) {}
  });
  pendingSet.clear();
  var used = SN.now() - start;
  var loading = false;
  try { loading = !!(self.document && self.document.readyState === 'loading'); } catch (e) {}
  if (!loading && used > FLUSH_BUDGET_MS * 4) {
    flushStrikes++;
    if (flushStrikes >= 4) {
      observerDisabled = true;
      try { if (mo) mo.disconnect(); } catch (e) {}
    }
  } else {
    flushStrikes = 0;
  }
}
function scheduleFlush() {
  if (scheduled || observerDisabled) return;
  scheduled = true;
  var sched = self.requestIdleCallback || self.requestAnimationFrame;
  if (typeof sched !== 'function') sched = function (fn) { return SN.setTimeout(fn, 0); };
  sched(function () { flushObserver(); });
}
function bootObserver() {
  try {
    pendingSet = new SN.Set();
    mo = new MutationObserver(function (muts) {
      if (observerDisabled) return;
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'attributes') {
          try { if (m.target) pendingSet.add(m.target); } catch (e) {}
          continue;
        }
        var added = m.addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n && n.nodeType === 1) { try { pendingSet.add(n); } catch (e) {} }
        }
      }
      if (pendingSet.size) scheduleFlush();
    });
    if (self.document && self.document.documentElement) {
      mo.observe(document.documentElement, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ['src', 'href', 'action', 'data', 'formaction', 'poster', 'srcset', 'imagesrcset']
      });
    }
  } catch (e) { mo = null; }
}
function styleElementWatcher() {
  try {
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var nodes = muts[i].addedNodes;
        for (var j = 0; j < nodes.length; j++) {
          var n = nodes[j];
          if (!n || n.nodeType !== 1) continue;
          if (n.tagName === 'STYLE') {
            try { if (n.textContent && n.textContent.indexOf('url(') !== -1) n.textContent = rewriteCssStr(n.textContent); } catch (e) {}
          } else if (n.tagName === 'LINK' && n.getAttribute('rel') === 'stylesheet') {
            try {
              var h = n.getAttribute('href');
              if (h && !realFrom(h) && shouldProxyRef(h)) n.setAttribute('href', toProxy(h));
            } catch (e) {}
          }
        }
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
}

var subscribedOrigins = new SN.Set();
var reportTimer = null;
var lastReportedHref = '';

function reportUrlNow() {
  try {
    if (self.parent === self) return;
    var proxiedHref = '';
    try { if (PRISTINE_LOC.href) proxiedHref = PRISTINE_LOC.href.get.call(NATIVE_LOC); } catch (e) { try { proxiedHref = self.location.href; } catch (e2) {} }
    var real = realFrom(proxiedHref) || '';
    lastReportedHref = real;
    var msg = { type: 'hzp-urlchange', url: proxiedHref, real: real };
    var pOrigin = null;
    try { pOrigin = self.parent.location.origin; } catch (e) { pOrigin = null; }
    try {
      if (SN.rawPost) {
        if (pOrigin === PROXY_ORIGIN) SN.oreflect.call(SN.rawPost, self.parent, [msg, pOrigin]);
        subscribedOrigins.forEach(function (o) { SN.oreflect.call(SN.rawPost, self.parent, [msg, o]); });
      } else {
        if (pOrigin === PROXY_ORIGIN) self.parent.postMessage(msg, pOrigin);
        subscribedOrigins.forEach(function (o) { self.parent.postMessage(msg, o); });
      }
    } catch (e) {}
  } catch (e) {}
}
function reportUrlSoon() {
  if (reportTimer) return;
  reportTimer = SN.setTimeout(function () {
    reportTimer = null;
    reportUrlNow();
  }, 100);
}
function bootUrlSync() {
  try {
    self.addEventListener('message', function (e) {
      var d = e && e.data;
      if (d && d.type === 'hzp-subscribe') {
        subscribedOrigins.add(e.origin);
        try {
          if (SN.rawPost) SN.oreflect.call(SN.rawPost, e.source, [{ type: 'hzp-subscribed' }, e.origin]);
          else e.source.postMessage({ type: 'hzp-subscribed' }, e.origin);
        } catch (_) {}
        reportUrlNow();
      }
    });
    if (self.parent && self.parent !== self) {
      try { self.setTimeout(reportUrlNow, 0); } catch (e) {}
      setInterval(function () {
        try {
          var href = PRISTINE_LOC.href.get.call(NATIVE_LOC);
          var r = realFrom(href);
          if (r !== lastReportedHref) reportUrlNow();
        } catch (e) {}
      }, 500);
    }
  } catch (e) {}
}

function installAllWindows() {
  try { overlayLocation(); } catch (e) {}
  try { hookHistory(); } catch (e) {}
  try { hookElementAttrs(); } catch (e) {}
  try { hookUrlProperties(); } catch (e) {}
  try { hookDocument(); } catch (e) {}
  try { hookDocumentWrite(); } catch (e) {}
  try { hookPostMessage(); } catch (e) {}
  try { hookCookies(); } catch (e) {}
  try { isolateStorages(); } catch (e) {}
  try { hookCss(); } catch (e) {}
  try { hookRequests(); } catch (e) {}
  try { hookWindow(); } catch (e) {}
  try { hookDomEvents(); } catch (e) {}
  try { bootObserver(); } catch (e) {}
  try { styleElementWatcher(); } catch (e) {}
  try { bootUrlSync(); } catch (e) {}
}

installAllWindows();
try { self.HZP = { href: function () { return currentRealUrl(); }, proxy: toProxy, unproxy: realFrom, loc: function (p) { try { return self.__hzpLoc(String(p)); } catch (e) { return ''; } } }; } catch (e) {}
})();
`;

function buildClientScript(realBase, realOrigin) {
  return '<script>' + HZP_CLIENT_SRC
    .replace('%__HZP_REAL_BASE__%', jsonSafeScript(realBase))
    .replace('%__HZP_REAL_ORIGIN__%', jsonSafeScript(realOrigin))
    + '<' + '/script>';
}
function jsonSafeScript(v) {
  return JSON.stringify(String(v || '')).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}


function attrProxyUrl(v, realBase, proxyOrigin) {
  try {
    if (/^(javascript|data|blob|mailto|tel|about):/i.test(v)) return v;
    if (v.charAt(0) === '#' || v.charAt(0) === '?') return v;
        if (/^https?:\/\//i.test(v)) {
      try {
        var ap = new URL(v).pathname;
        if (ap.indexOf('/proxy/') === 0 || ap.indexOf(SJ_PREFIX + '/proxy/') === 0) return v;
      } catch (e) {}
    }
    var abs = new URL(v, realBase);
    var p = abs.protocol;
    if (p !== 'http:' && p !== 'https:') return v;
    if (abs.pathname.indexOf('/proxy/') === 0 || abs.pathname.indexOf(SJ_PREFIX + '/proxy/') === 0) return v;
    return proxyOrigin + SJ_PREFIX + '/proxy/' + abs.href;
  } catch (e) { return v; }
}
function srcSetProxy(value, realBase, proxyOrigin) {
  return String(value).split(',').map(function (part) {
    var bits = part.trim().split(/\s+/);
    var url = bits.shift() || '';
    var desc = bits.join(' ');
    if (!url) return desc;
    return attrProxyUrl(url, realBase, proxyOrigin) + (desc ? ' ' + desc : '');
  }).join(', ');
}

var HR_URL_RULES = [
  ['a[href]', 'href'], ['area[href]', 'href'], ['image[href]', 'href'],
  ['use[href]', 'href'], ['textPath[href]', 'href'], ['mpath[href]', 'href'],
  ['feImage[href]', 'href'], ['animate[href]', 'href'], ['animateMotion[href]', 'href'],
  ['animateTransform[href]', 'href'], ['set[href]', 'href'], ['discard[href]', 'href'],
  ['linearGradient[href]', 'href'], ['radialGradient[href]', 'href'],
  ['pattern[href]', 'href'], ['filter[href]', 'href'],
  ['embed[src]', 'src'], ['img[src]', 'src'], ['frame[src]', 'src'], ['input[src]', 'src'],
  ['track[src]', 'src'], ['script[src]', 'src'], ['iframe[src]', 'src'],
  ['video[src]', 'src'], ['audio[src]', 'src'], ['source[src]', 'src'],
  ['object[data]', 'data'],
  ['form[action]', 'action'],
  ['button[formaction]', 'formaction'], ['input[formaction]', 'formaction'], ['textarea[formaction]', 'formaction']
];

function buildHtmlRewriter(realBase, proxyOrigin) {
  var r = new HTMLRewriter();
    HR_URL_RULES.forEach(function (rule) {
    var sel = rule[0], attr = rule[1];
    r.on(sel, {
      element: function (el) {
        try {
          var v = el.getAttribute(attr);
          if (!v) return;
          var proxied = attrProxyUrl(v, realBase, proxyOrigin);
          if (proxied === v) return;
          el.setAttribute(attr, proxied);
                    var tn = String(el.tagName || '').toLowerCase();
          if (tn === 'script' || tn === 'link') {
            try { el.removeAttribute('integrity'); el.removeAttribute('nonce'); } catch (e) {}
          }
        } catch (e) {}
      }
    });
  });
    r.on('img[srcset]', { element: function (el) { try { var v = el.getAttribute('srcset'); if (v) el.setAttribute('srcset', srcSetProxy(v, realBase, proxyOrigin)); } catch (e) {} } });
  r.on('source[srcset]', { element: function (el) { try { var v = el.getAttribute('srcset'); if (v) el.setAttribute('srcset', srcSetProxy(v, realBase, proxyOrigin)); } catch (e) {} } });
  r.on('link[imagesrcset]', { element: function (el) { try { var v = el.getAttribute('imagesrcset'); if (v) el.setAttribute('imagesrcset', srcSetProxy(v, realBase, proxyOrigin)); } catch (e) {} } });
    r.on('meta[http-equiv=refresh]', { element: function (el) {
    try {
      var c = el.getAttribute('content') || '';
      var v = rewriteMetaRefresh(c, realBase, proxyOrigin);
      if (v) el.setAttribute('content', v);
    } catch (e) {}
  } });
    r.on('a[target]', { element: function (el) {
    try {
      var t = (el.getAttribute('target') || '').trim();
      if (t === '_top' || t === '_unfencedTop' || t === '_parent') el.setAttribute('target', '_self');
    } catch (e) {}
  } });
    r.on('style', {
    text: function (t) { try { t.replace(rewriteCssUrls(t.text, realBase, proxyOrigin), { html: false }); } catch (e) {} }
  });
    r.on('[style]', { element: function (el) {
    try {
      var s = el.getAttribute('style');
      if (s && s.indexOf('url(') !== -1) el.setAttribute('style', rewriteCssUrls(s, realBase, proxyOrigin));
    } catch (e) {}
  } });
    r.on('[integrity]', { element: function (el) { try { el.removeAttribute('integrity'); } catch (e) {} } });
  r.on('[nonce]', { element: function (el) { try { el.removeAttribute('nonce'); } catch (e) {} } });
  r.on('iframe[csp]', { element: function (el) { try { el.removeAttribute('csp'); el.removeAttribute('credentialless'); } catch (e) {} } });
  r.on('iframe[sandbox]', { element: function (el) { try { el.removeAttribute('sandbox'); } catch (e) {} } });
  return r;
}


async function handleRequest(request, env, ctx, pathOverride) {
  var url = new URL(request.url);
  var pathname = pathOverride != null ? pathOverride : url.pathname;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Expose-Headers': '*',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  if (isCloudMoonPath(pathname)) {
    var targetPath = pathname + url.search;
    var cmDomain = 'web.cloudmoonapp.com';
    var cloudmoonUrl = 'https://' + cmDomain + targetPath.replace(new RegExp('^/(web\\.)?cloudmoonapp\\.com'), '');
    var encoded = encodeUrl(cloudmoonUrl);
    var iframeSrc = CLOUDMOON_ORIGIN + '?u=' + encoded;
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
    return new Response('url not specified', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

    var upgrade = (request.headers.get('upgrade') || '').toLowerCase();
  if (upgrade === 'websocket' && request.method === 'GET' && HZP.WEB_SOCKET) {
    var wsTarget = parseUniversalURL(pathname, url.search);
    wsTarget = wsTarget ? wsTarget.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:') : null;
    if (wsTarget && (wsTarget.indexOf('ws://') === 0 || wsTarget.indexOf('wss://') === 0)) {
      return handleWebSocketProxy(request, wsTarget);
    }
  }

  var targetURL = parseUniversalURL(pathname, url.search, url.hash);
  if (!targetURL) return new Response('Invalid URL', { status: 400 });
  var targetURLObject;
  try { targetURLObject = new URL(targetURL); }
  catch (e) { return new Response('Invalid URL', { status: 400 }); }
  if (isAdRequest(targetURL)) return new Response(null, { status: 204 });

  var fwdHeaders = new Headers(request.headers);
  fwdHeaders.set('User-Agent', HZP.UA);
  ['Host', 'cf-connecting-ip', 'cf-ray', 'cf-visitor', 'cf-worker',
   'x-forwarded-proto', 'x-forwarded-for', 'x-forwarded-host', 'x-real-ip',
   'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest', 'sec-fetch-user'].forEach(function (n) { fwdHeaders.delete(n); });

  var refRaw = fwdHeaders.get('Referer');
  var refReal = null;
  if (refRaw) {
    try {
      var refU = new URL(refRaw);
      if (refU.origin === url.origin) refReal = parseProxiedPath(refU.pathname, refU.search, refU.hash);
    } catch (e) { refReal = null; }
    if (refReal) fwdHeaders.set('Referer', refReal);
    else fwdHeaders.delete('Referer');
  }
  var originRaw = fwdHeaders.get('Origin');
  if (originRaw) {
    var originReal = null;
    try {
      if (originRaw === url.origin) {
        if (refReal) originReal = new URL(refReal).origin;
      } else {
        var oU = new URL(originRaw);
        if (oU.origin === url.origin) {
          var oTarget = parseProxiedPath(oU.pathname, oU.search, oU.hash);
          if (oTarget) originReal = new URL(oTarget).origin;
        } else {
          originReal = oU.origin;
        }
      }
    } catch (e) { originReal = null; }
    if (originReal) fwdHeaders.set('Origin', originReal);
    else fwdHeaders.delete('Origin');
  }

  var host = targetURLObject.hostname;
  if (HZP.COOKIE_ISOLATION) {
    var upstreamCookie = encodeRequestCookie(request.headers.get('cookie'), host);
    if (upstreamCookie) fwdHeaders.set('Cookie', upstreamCookie);
    else fwdHeaders.delete('Cookie');
  }

  var fetchOpts = { method: request.method, headers: fwdHeaders, redirect: 'follow' };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    fetchOpts.body = request.body;
  }
  var resp;
  try { resp = await fetch(targetURL, fetchOpts); }
  catch (err) { return new Response('Failed to fetch: ' + (err.message || err), { status: 502 }); }

  var contentType = resp.headers.get('Content-Type') || '';

    if (isHtmlContentType(contentType)) {
    var html;
    try { html = await resp.text(); }
    catch (e) { return new Response('Failed to read response: ' + (e.message || e), { status: 502 }); }

    var realBase, realOrigin;
    try { var ru = new URL(resp.url); realBase = ru.href; realOrigin = ru.origin; }
    catch (e) { realBase = ''; realOrigin = ''; }
    var proxyOrigin = url.origin;

    html = rewriteInlineScripts(html, realBase, proxyOrigin);
    var head = '';
    if (realBase) head += '<base href="' + escapeHtmlAttr(realBase) + '">';
    if (HZP.AD_BLOCK) head += '<style>' + heavyAdCss() + '</style>' + AD_BLOCK_CLIENT;
    head += buildClientScript(realBase, realOrigin);
    html = injectInHead(html, head);

    var outHeaders = new Headers(resp.headers);
    outHeaders.set('Content-Type', 'text/html; charset=utf-8');
    outHeaders.set('Access-Control-Allow-Origin', '*');
    stripSecurityHeaders(outHeaders);
    if (HZP.CROSS_ORIGIN_ISOLATION) {
      outHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
      outHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
    }
    outHeaders.delete('Content-Length');
    outHeaders.delete('Content-Encoding');
    outHeaders.delete('Transfer-Encoding');
    if (HZP.COOKIE_ISOLATION) rewriteSetCookieOnHeaders(resp, outHeaders, host);
    rewriteResponseUrlHeaders(outHeaders, resp.url || targetURL, url.origin);

        var transformed = buildHtmlRewriter(realBase, proxyOrigin)
      .transform(new Response(html, { status: resp.status, statusText: resp.statusText, headers: outHeaders }));
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(Promise.resolve());
    }
    return transformed;
  }

    if (isJsContentType(contentType)) {
    var passH = passThroughHeaders(resp, host, url.origin);
    try {
      var js = await resp.text();
      try { js = rewriteJsSource(js, new URL(resp.url).href, url.origin); }
      catch (e) { js = rewriteJsSource(js, resp.url, url.origin); }
      if (js.indexOf('__hzpLoc(') !== -1 || js.indexOf('__hzpPMW(') !== -1) js = REWRITE_GUARD + js;
      passH.set('Cache-Control', 'public, max-age=86400');
      return new Response(js, { status: resp.status, statusText: resp.statusText, headers: passH });
    } catch (e) {
      return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: passH });
    }
  }

    var streamH = passThroughHeaders(resp, host, url.origin);
  var isCacheable = false;
  if (HZP.CACHE_ASSETS && request.method === 'GET' && resp.status === 200 && !streamH.has('Set-Cookie')) {
    var ct = contentType.toLowerCase().split(';')[0].trim();
    isCacheable = /image\/|font\/|css|javascript|application\/json|application\/xml|\+xml|video\/|audio\//.test(ct) && ct !== '';
  }
  if (isCacheable) {
    try {
      streamH.set('Cache-Control', 'public, max-age=86400');
      var cacheable = new Response(resp.clone().body, { status: resp.status, statusText: resp.statusText, headers: streamH });
      if (typeof caches !== 'undefined' && caches && caches.default && ctx && typeof ctx.waitUntil === 'function') {
        ctx.waitUntil(caches.default.put(request, cacheable));
      }
      return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: streamH });
    } catch (e) {   }
  }
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: streamH });
}

function rewriteSetCookieOnHeaders(resp, h, host) {
  if (typeof resp.headers.getSetCookie !== 'function') return;
  var cookies = resp.headers.getSetCookie();
  if (!cookies || !cookies.length) return;
  h.delete('Set-Cookie');
  cookies.forEach(function (c) { h.append('Set-Cookie', rewriteSetCookie(c, host)); });
}

function passThroughHeaders(resp, host, proxyOrigin) {
  var h = new Headers(resp.headers);
  h.set('Access-Control-Allow-Origin', '*');
  stripSecurityHeaders(h);
  if (HZP.COOKIE_ISOLATION) rewriteSetCookieOnHeaders(resp, h, host);
  rewriteResponseUrlHeaders(h, resp.url, proxyOrigin);
  return h;
}

function handleWebSocketProxy(request, targetURL) {
  var protocol = request.headers.get('sec-websocket-protocol') || '';
  var upstream;
  try {
    upstream = new WebSocket(targetURL, protocol || undefined);
  } catch (e) {
    return new Response('WebSocket upstream failed: ' + (e.message || e), { status: 502 });
  }
  var pair = new WebSocketPair();
  var clientSock = pair[0], serverSock = pair[1];
  upstream.addEventListener('open', function () { try { serverSock.accept(); } catch (e) {} });
  upstream.addEventListener('message', function (ev) { try { serverSock.send(ev.data); } catch (e) {} });
  upstream.addEventListener('close', function (ev) { try { serverSock.close(ev.code || 1000, ev.reason || ''); } catch (e) {} });
  upstream.addEventListener('error', function () { try { serverSock.close(1011, 'upstream error'); } catch (e) {} });
  serverSock.addEventListener('message', function (ev) { try { upstream.send(ev.data); } catch (e) {} });
  serverSock.addEventListener('close', function (ev) { try { upstream.close(ev.code || 1000, ev.reason || ''); } catch (e) {} });
  var h = new Headers();
  if (protocol) h.set('Sec-WebSocket-Protocol', protocol);
  return new Response(null, { status: 101, webSocket: clientSock, headers: h });
}


var HZP_OLD = (function () {
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
    'RUN_HEAVY=true;' +
  '}' +
  'var REAL_BASE="__REAL_BASE__";' +
  'var REAL_ORIGIN="__REAL_ORIGIN__";' +
  'function toProxy(u){' +
    'try{' +
      'if(!u)return u;' +
      'if(/^(about|blob|data|javascript|mailto|tel):/i.test(u))return u;' +
      'var abs=new URL(u,REAL_BASE||document.baseURI);' +
      'if(abs.protocol!=="http:"&&abs.protocol!=="https:")return u;' +
      'return SELF_ORIGIN+"/proxy/"+abs.host+abs.pathname+abs.search;' +
    '}catch(e){return u;}' +
  '}' +
  'window.addEventListener("error",function(e){' +
    'if(e.error&&e.error.name==="SecurityError"&&/replaceState|pushState/.test(e.message||"")){' +
      'e.preventDefault();' +
      'e.stopImmediatePropagation();' +
      'return true;' +
    '}' +
  '},true);' +
  'var subscribedOrigins=new Set();' +
  'window.addEventListener("message",function(e){' +
    'if(e.data&&e.data.type==="hzp-subscribe"){' +
      'subscribedOrigins.add(e.origin);' +
      'try{e.source.postMessage({type:"hzp-subscribed"},e.origin);}catch(_){}' +
    '}' +
  '});' +
  'function reportUrl(){' +
    'try{' +
      'if(window.parent&&window.parent!==window.self){' +
        'var parentOrigin;' +
        'try{' +
          'parentOrigin=window.parent.location.origin;' +
        '}catch(e){' +
          'parentOrigin=null;' +
        '}' +
        'if(parentOrigin===SELF_ORIGIN){' +
          'window.parent.postMessage({type:"hzp-urlchange",url:self.location.href},parentOrigin);' +
        '}else if(subscribedOrigins.size){' +
          'subscribedOrigins.forEach(function(origin){' +
            'window.parent.postMessage({type:"hzp-urlchange",url:self.location.href},origin);' +
          '});' +
        '}' +
      '}' +
    '}catch(e){}' +
  '}' +
  'reportUrl();' +
  'setInterval(reportUrl,500);' +
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
    'if(!h||h.charAt(0)==="#"||/^(javascript|mailto|tel):/i.test(h))return;' +
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
    if (resp.headers.has('Content-Range')) passH.set('Content-Range', resp.headers.get('Content-Range'));
    if (resp.headers.has('Accept-Ranges')) passH.set('Accept-Ranges', resp.headers.get('Accept-Ranges'));
    if (typeof resp.headers.getSetCookie === 'function') {
      var cookies1 = resp.headers.getSetCookie();
      if (cookies1.length) {
        passH.delete('Set-Cookie');
        cookies1.forEach(function(c) {
          var rewritten = c.replace(/;\s*[Dd]omain=[^;]+/i, '').replace(/;\s*[Ss]ecure/gi, '');
          passH.append('Set-Cookie', rewritten);
        });
      }
    }
    return new Response(resp.body, {
      status: resp.status, statusText: resp.statusText, headers: passH
    });
  }
  var pageHtml;
  try {
    pageHtml = await rewriteIframesAndAssets(await resp.clone().text(), resp.url, url.origin);
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
  var realBase, realOrigin;
  try { var _u = new URL(resp.url); realBase = _u.href; realOrigin = _u.origin; } catch(e) { realBase = ''; realOrigin = ''; }
  pageHtml = injectInHead(pageHtml, SANDBOX_SCRIPT
    .replace('__REAL_BASE__', realBase)
    .replace('__REAL_ORIGIN__', realOrigin));
  pageHtml = rewriteInlineScripts(pageHtml);
  var htmlH = new Headers(resp.headers);
  htmlH.set('Content-Type', 'text/html; charset=utf-8');
  htmlH.set('Access-Control-Allow-Origin', '*');
  stripSecurityHeaders(htmlH);
  htmlH.set('Content-Security-Policy',
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; frame-ancestors *");
  if (typeof resp.headers.getSetCookie === 'function') {
    var cookies2 = resp.headers.getSetCookie();
    if (cookies2.length) {
      htmlH.delete('Set-Cookie');
      cookies2.forEach(function(c) {
        var rewritten = c.replace(/;\s*[Dd]omain=[^;]+/i, '').replace(/;\s*[Ss]ecure/gi, '');
        htmlH.append('Set-Cookie', rewritten);
      });
    }
  }
  return new Response(pageHtml, {
    status: resp.status, statusText: resp.statusText, headers: htmlH
  });
}
return {
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
})();

export default {
  async fetch(request, env, ctx) {
    try {
      var u = new URL(request.url);
      var p = u.pathname;
      if (p === SJ_PREFIX || p.indexOf(SJ_PREFIX + '/') === 0) {
        var rest = p.slice(SJ_PREFIX.length);
        if (rest === '' || rest.charAt(0) !== '/') rest = '/' + rest;
        return await handleRequest(request, env, ctx, rest);
      }
      return await HZP_OLD.fetch(request, env, ctx);
    } catch (e) {
      return new Response('Proxy error: ' + (e.message || e), {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }
};

