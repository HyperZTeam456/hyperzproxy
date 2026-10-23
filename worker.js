var HZP = {
  AD_BLOCK: true,
  WEB_SOCKET: true,
  CACHE_ASSETS: true,
  COOKIE_ISOLATION: true,
  CROSS_ORIGIN_ISOLATION: true,
  CLIENT_VERSION: 27,
  UA: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
};

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
  '/adserver/', '/analytics/', 'prebid'
];
var AD_RE = new RegExp(AD_PATTERNS.map(function (s) {
  return s.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&');
}).join('|'), 'i');
function isAdRequest(u) { return AD_RE.test(u || ''); }

var AD_NAV_HOSTS = ['googlesyndication.com', 'doubleclick.net', 'googleadservices.com',
  'adnxs.com', 'pubmatic.com', 'rubiconproject.com', 'openx.net', 'criteo.com',
  'taboola.com', 'outbrain.com', 'adsafeprotected.com', 'moatads.com',
  'advertising.com', 'scorecardresearch.com', 'amazon-adsystem.com'];
function isAdNavHost(h) {
  for (var i = 0; i < AD_NAV_HOSTS.length; i++) {
    var d = AD_NAV_HOSTS[i];
    if (h === d || h.slice(-(d.length + 1)) === '.' + d) return true;
  }
  return false;
}

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
function isProxiedPath(p) {
  p = String(p == null ? '' : p);
  return p.indexOf('/proxy/') === 0 || p.indexOf('/http://') === 0 || p.indexOf('/https://') === 0 || p.indexOf('/ws/') === 0 || p.indexOf('/wss/') === 0;
}
function refererRecovery(request) {
  try {
    var m = request.method;
    if (m !== 'GET' && m !== 'HEAD') return null;
    var ref = request.headers.get('Referer');
    if (!ref) return null;
    var own = new URL(request.url);
    var ru;
    try { ru = new URL(ref); } catch (e) { return null; }
    if (ru.origin !== own.origin) return null;
    var refPath = ru.pathname || '';
    var refDecoded = refPath;
    try { refDecoded = decodeURIComponent(refPath); } catch (e) {}
    if (refDecoded.indexOf('://') === -1) return null;
    var realRef = parseUniversalURL(refPath, ru.search, '');
    if (!realRef) return null;
    if (!/^https?:\/\//i.test(realRef)) return null;
    var target;
    try { target = new URL(own.pathname + own.search, realRef); } catch (e) { return null; }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') return null;
    if (target.origin === own.origin) return null;
    return new Response(null, {
      status: 302,
      headers: {
        'Location': own.origin + '/' + target.href,
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) { return null; }
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
function isCssContentType(ct) {
  if (!ct) return false;
  var e = ct.toLowerCase().split(';')[0].trim();
  return e === 'text/css' || /\+css$/.test(e);
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
function rewriteSetCookie(c, host, secureAttr) {
  if (!c || !host) return c;
  var eq = c.indexOf('=');
  if (eq === -1) return c;
  var name = c.slice(0, eq);
  var rest = c.slice(eq);
  var prefixed = 'hz-' + host + ':' + name + rest;
  prefixed = prefixed.replace(/;\s*[Dd]omain\s*=[^;]*/g, '');
  if (/;\s*[Pp]ath\s*=/.test(prefixed)) prefixed = prefixed.replace(/;\s*[Pp]ath\s*=[^;]*/g, '; Path=/');
  else prefixed += '; Path=/';
  if (secureAttr) {
    prefixed = prefixed.replace(/;\s*[Ss]ameSite\s*=[^;]*/g, '');
    prefixed += '; SameSite=None; Secure';
  } else if (!/;\s*[Ss]ameSite\s*=/i.test(prefixed)) {
    prefixed += '; SameSite=Lax';
  }
  return prefixed;
}


var CSS_URL_RE = /url\((?:\s*"((?:\\.|[^"])+)"\s*|\s*'((?:\\.|[^'])+)'\s*|((?!\s*['"])(?!\s*\))(?:\\.|[^)])+?))\)/g;
function stripEntityQuotes(u) {
  var lead = '';
  var trail = '';
  var m1 = /^&(?:quot|#0*34|#x0*22);/i.exec(u);
  if (m1) { lead = m1[0]; u = u.slice(lead.length); }
  var m2 = /&(?:quot|#0*34|#x0*22);$/i.exec(u);
  if (m2) { trail = m2[0]; u = u.slice(0, u.length - trail.length); }
  return { u: u, lead: lead, trail: trail };
}
function cssProxyUrl(url, realBase, proxyOrigin) {
  try {
    if (url.charAt(0) === '#') return url;
    var abs = new URL(url, realBase);
    var p = abs.protocol;
    if (p === 'data:' || p === 'blob:' || p === 'javascript:' || p === 'about:' || p === 'mailto:') return url;
    if (p !== 'http:' && p !== 'https:') return url;
    if (isProxiedPath(abs.pathname)) return url;
    return proxyOrigin + '/' + abs.href;
  } catch (e) { return url; }
}
function rewriteCssUrls(css, realBase, proxyOrigin) {
  css = String(css);
  var out = css.replace(CSS_URL_RE, function (m, dq, sq, unq) {
    var u = dq || sq || unq;
    if (!u) return m;
    var e = stripEntityQuotes(u.trim());
    if (!e.u) return m;
    var oldFull = (e.lead || e.trail) ? (e.lead + e.u + e.trail) : u.trim();
    var k = m.indexOf(oldFull);
    if (k < 0) return m;
    var proxied = e.lead + cssProxyUrl(e.u.trim(), realBase, proxyOrigin) + e.trail;
    return m.slice(0, k) + proxied + m.slice(k + oldFull.length);
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
        if (isProxiedPath(abs.pathname)) return m;
        return '<' + proxyOrigin + '/' + abs.href + '>';
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
      if (isProxiedPath(abs.pathname)) { headers.delete(name); return; }
      headers.set(name, proxyOrigin + '/' + abs.href);
    } catch (e) { headers.delete(name); }
  });
  var link = headers.get('link');
  if (link) headers.set('link', rewriteResponseLinkHeader(link, realUrl, proxyOrigin));
}


var JS_KEYWORDS = { return: 1, typeof: 1, instanceof: 1, in: 1, of: 1, new: 1, delete: 1, void: 1, throw: 1, case: 1, do: 1, else: 1, yield: 1, await: 1, default: 1, extends: 1 };
var JS_REGEX_PRE = '(,=:[!&|?{};+-*%~^<>';
function jsIsSpace(c) { return c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '\v'; }
function jsIsIdent(c) {
  var k = c.charCodeAt(0);
  return (k >= 97 && k <= 122) || (k >= 65 && k <= 90) || (k >= 48 && k <= 57) || c === '_' || c === '$';
}
function computeCodeRanges(js) {
  var n = js.length;
  var ranges = [];
  var codeStart = -1;
  var stack = ['code'];
  var brace = [0];
  var i = 0;
  var TOKEN_RE = /['"`\/]/g;
  var sig = '';
  var lastWord = '';
  function close(at) { if (codeStart !== -1) { if (at > codeStart) ranges.push([codeStart, at]); codeStart = -1; } }
  function open(at) { if (codeStart === -1) codeStart = at; }
  function noteRun(endPos) {
    var k = endPos - 1;
    while (k >= 0 && jsIsSpace(js[k])) k--;
    if (k < 0) return;
    sig = js[k];
    if (jsIsIdent(sig)) {
      var e = k;
      while (k >= 0 && jsIsIdent(js[k])) k--;
      lastWord = js.slice(k + 1, e + 1);
    } else {
      lastWord = '';
    }
  }
  function canStartRegex() {
    if (sig === '') return true;
    if (JS_REGEX_PRE.indexOf(sig) !== -1) return true;
    if (lastWord && JS_KEYWORDS[lastWord]) return true;
    return false;
  }
  function scanString(q) {
    close(i);
    i++;
    while (i < n) {
      var j = js.indexOf(q, i);
      if (j === -1) { i = n; break; }
      var k = j - 1, esc = 0;
      while (k >= 0 && js[k] === '\\') { esc++; k--; }
      if (esc % 2 === 1) { i = j + 1; continue; }
      i = j + 1;
      break;
    }
    open(i);
    sig = ')'; lastWord = '';
  }
  function scanRegex() {
    close(i);
    i++;
    var inClass = false;
    while (i < n) {
      var c = js[i];
      if (c === '\\') { i += 2; continue; }
      if (inClass) { if (c === ']') inClass = false; i++; continue; }
      if (c === '[') { inClass = true; i++; continue; }
      if (c === '/') { i++; break; }
      if (c === '\n' || c === '\r') break;
      i++;
    }
    while (i < n && /[a-z]/i.test(js[i])) i++;
    open(i);
    sig = ')'; lastWord = '';
  }
  while (i < n) {
    var top = stack[stack.length - 1];
    if (top === 'tpl') {
      var bt = js.indexOf('`', i);
      var itp = js.indexOf('${', i);
      var bsl = js.indexOf('\\', i);
      var next = n;
      if (bt !== -1 && bt < next) next = bt;
      if (itp !== -1 && itp < next) next = itp;
      if (bsl !== -1 && bsl < next) next = bsl;
      if (next >= n) { i = n; break; }
      var ch = js[next];
      if (ch === '\\') { i = next + 2; continue; }
      if (ch === '`') { stack.pop(); brace.pop(); i = next + 1; sig = ')'; lastWord = ''; if (stack[stack.length - 1] === 'code') open(i); continue; }
      i = next + 2;
      stack.push('code');
      brace.push(0);
      open(i);
      sig = '{'; lastWord = '';
      continue;
    }
    open(i);
    TOKEN_RE.lastIndex = i;
    var mm = TOKEN_RE.exec(js);
    var nx = mm ? mm.index : n;
    if (nx >= n) { i = n; break; }
    if (nx > i) noteRun(nx);
    if (stack.length > 1 && nx > i) {
      var run = js.slice(i, nx);
      var opens = 0, closes = 0, p2 = 0;
      while ((p2 = run.indexOf('{', p2)) !== -1) { opens++; p2++; }
      p2 = 0;
      while ((p2 = run.indexOf('}', p2)) !== -1) { closes++; p2++; }
      if (closes > opens + brace[brace.length - 1]) {
        var need = brace[brace.length - 1] + opens + 1;
        var pos = -1, seen = 0, q = i;
        while (q < nx) { if (js[q] === '}') { seen++; if (seen === need) { pos = q; break; } } q++; }
        if (pos !== -1) {
          close(pos);
          stack.pop(); brace.pop();
          i = pos + 1;
          continue;
        }
      }
      brace[brace.length - 1] = brace[brace.length - 1] + opens - closes;
    }
    var c2 = js[nx];
    if (c2 === "'" || c2 === '"') { i = nx; scanString(c2); continue; }
    if (c2 === '`') { close(nx); stack.push('tpl'); brace.push(0); i = nx + 1; continue; }
    var c3 = js[nx + 1];
    if (c3 === '/') {
      close(nx);
      var nl = js.indexOf('\n', nx + 2);
      i = nl === -1 ? n : nl;
      open(i);
      continue;
    }
    if (c3 === '*') {
      close(nx);
      var bc = js.indexOf('*/', nx + 2);
      i = bc === -1 ? n : bc + 2;
      open(i);
      continue;
    }
    if (canStartRegex()) { i = nx; scanRegex(); continue; }
    i = nx + 1;
  }
  close(n);
  return ranges;
}
function makeInCode(ranges) {
  return function (pos) {
    var lo = 0, hi = ranges.length - 1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      var r = ranges[mid];
      if (pos < r[0]) hi = mid - 1;
      else if (pos >= r[1]) lo = mid + 1;
      else return true;
    }
    return false;
  };
}
var REWRITE_GUARD = "(function(g){if(!g)return;if(typeof g.__hzpLoc!=='function'){g.__hzpLoc=function(p){try{var l=g.location;var v=l&&l[p];return v==null?'':String(v)}catch(e){return ''}}}if(typeof g.__hzpLocObj==='undefined'){g.__hzpLocObj=g.location}if(typeof g.__hzpPMW!=='function'){g.__hzpPMW=function(w){return w}}})(typeof globalThis!=='undefined'?globalThis:(typeof self!=='undefined'?self:null));\n";
function withRewriteGuard(js) {
  var at = 0, pos = 0;
  for (;;) {
    var ws = /^(?:\s+|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*/.exec(js.slice(pos));
    if (!ws || !ws[0]) break;
    pos += ws[0].length;
    var dm = /^(["'])(?:[^"'\\]|\\.)*\1\s*;?/.exec(js.slice(pos));
    if (!dm) break;
    pos += dm[0].length;
    at = pos;
  }
  return js.slice(0, at) + REWRITE_GUARD + js.slice(at);
}

function addQueryParam(href, kv) {
  var i = href.indexOf('#');
  var head = i === -1 ? href : href.slice(0, i);
  var tail = i === -1 ? '' : href.slice(i);
  var lastCh = head.slice(-1);
  var sep = lastCh === '?' || lastCh === '&' ? '' : head.indexOf('?') === -1 ? '?' : '&';
  return head + sep + kv + tail;
}
function delQueryParam(href, name) {
  var i = href.indexOf('#');
  var head = i === -1 ? href : href.slice(0, i);
  var tail = i === -1 ? '' : href.slice(i);
  var q = head.indexOf('?');
  if (q === -1) return href;
  var parts = head.slice(q + 1).split('&');
  var out = [];
  for (var j = 0; j < parts.length; j++) {
    if (parts[j] === name || parts[j].indexOf(name + '=') === 0) continue;
    out.push(parts[j]);
  }
  return head.slice(0, q) + (out.length ? '?' + out.join('&') : '') + tail;
}
function verHref(href) {
  try {
    if (!HZP.CLIENT_VERSION) return href;
    var u = new URL(href);
    if (!/\.m?js$/i.test(u.pathname) && !/\.cjs$/i.test(u.pathname)) return href;
    if (/[?&]__hzpv=/.test(href)) return href;
    return addQueryParam(href, '__hzpv=' + String(HZP.CLIENT_VERSION));
  } catch (e) { return href; }
}
function jsProxyUrl(url, quote, realBase, proxyOrigin) {
  try {
    var u = String(url);
    if (/^(javascript|mailto|tel|about|data|blob):/i.test(u)) return quote + u + quote;
    var abs = u.indexOf('//') === 0 ? new URL('https:' + u) : new URL(u, realBase);
    if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return quote + u + quote;
    return quote + proxyOrigin + '/' + verHref(abs.href) + quote;
  } catch (e) { return quote + url + quote; }
}
function jsWsProxyUrl(url, quote, proxyOrigin, realBase) {
  try {
    var abs = new URL(url);
    var p = abs.protocol === 'wss:' || abs.protocol === 'https:' ? 'wss' : 'ws';
    var href = proxyOrigin + '/' + p + '/' + abs.host + abs.pathname + abs.search;
    try {
      var ro = new URL(realBase).origin;
      if (ro) href = addQueryParam(href, '__hzpo=' + encodeURIComponent(ro));
    } catch (e) {}
    return quote + href + quote;
  } catch (e) { return quote + url + quote; }
}

var JS_PATTERNS = [
  {
    pre: true,
    re: /(^|[^\w$.#])((?:(?:window|self|document|top|parent)\??\.)?\blocation\??\.(pathname|href|search|hash|hostname|host|origin|port|protocol))(?![\w$])(?!\s*(?:=[^=]|[+\-\*/%]=|\+\+|--))/g,
    make: function (m, pre, expr, prop) { return pre + 'globalThis.__hzpLoc("' + prop + '")'; }
  },
  {
    pre: true,
    re: /(^|[^\w$.#])((?:[\w$]+\.)+document)\??\.location\??\.(pathname|href|search|hash|hostname|host|origin|port|protocol)(?![\w$])(?!\s*(?:=[^=]|[+\-\*/%]=|\+\+|--))/g,
    make: function (m, pre, chain, prop) { return pre + 'globalThis.__hzpLoc("' + prop + '")'; }
  },
  {
    pre: true,
    re: /(^|[^\w$.#])((?:window|self|document|top|parent)\.location)(?![\w$])/g,
    make: function (m, pre, expr) { return pre + 'globalThis.__hzpLocObj'; }
  },
  {
    pre: true,
    re: /(^|[^\w$.#])(?<!\b(?:var|let|const)[ \t\r\n]+)(location)(?=[.\[]|\s*=(?!=|>))/g,
    make: function (m, pre, expr) { return pre + 'globalThis.__hzpLocObj'; }
  },
  {
    pre: true,
    re: /(^|[^\w$.#])([\w$]+)\.location(?![\w$])(?=$|\s*[;,)\]}\[?]|\s*[+\-*\/%]|\s*(?:==|!=|<=|>=|\?\.?|&&|\|\||\?\?)|\s*\.(?:pathname|href|search|hash|hostname|host|origin|port|protocol|assign|replace|reload|toString|valueOf)\b)/g,
    make: function (m, pre, ident) { return pre + '(' + ident + '===globalThis||(typeof Window!=="undefined"&&' + ident + ' instanceof Window)?globalThis.__hzpLocObj:(' + ident + ').location)'; }
  },
  {
    pre: false,
    re: /((?:window\.|document\.|self\.|top\.|parent\.)?(?:location|documentURL)\.?(?:href)?)\s*=\s*(["'])([^"'\s]+)\2/g,
    make: function (m, lhs, q, u, rb, po) { return lhs + ' = ' + jsProxyUrl(u, q, rb, po); }
  },
  {
    pre: true,
    re: /(^|[^\w$.#])((?:(?:window|self|document|top|parent)\.)?location)\.(assign|replace)\s*\(\s*(["'])([^"'\s]+)\4/g,
    make: function (m, pre, loc, method, q, u, rb, po) { return pre + loc + '.' + method + '(' + jsProxyUrl(u, q, rb, po); }
  },
  {
    pre: true,
    re: /(^|[^\w.$#])(?:window\.)?open\s*\(\s*(["'])([^"'\s]+)\2/g,
    make: function (m, pre, q, u, rb, po) { return pre + 'open(' + jsProxyUrl(u, q, rb, po); }
  },
  {
    pre: false,
    re: /new\s+(?:Worker|SharedWorker)\s*\(\s*(["'])([^"'\s]+)\1/g,
    make: function (m, q, u, rb, po) { return 'new Worker(' + jsProxyUrl(u, q, rb, po); }
  },
  {
    pre: false,
    re: /new\s+WebSocket\s*\(\s*(["'])((?:wss?|https?):\/\/[^"'\s]+)\1/g,
    make: function (m, q, u, rb, po) { return 'new WebSocket(' + jsWsProxyUrl(u, q, po, rb); }
  },
  {
    pre: false,
    re: /importScripts\s*\(\s*(["'])([^"'\s]+)\1/g,
    make: function (m, q, u, rb, po) { return 'importScripts(' + jsProxyUrl(u, q, rb, po); }
  },
  {
    pre: false,
    re: /(?:navigator\.)?sendBeacon\s*\(\s*(["'])([^"'\s]+)\1/g,
    make: function (m, q, u, rb, po) { return 'sendBeacon(' + jsProxyUrl(u, q, rb, po); }
  },
  {
    pre: false,
    re: /new\s+Request\s*\(\s*(["'])([^"'\s]+)\1/g,
    make: function (m, q, u, rb, po) { return 'new Request(' + jsProxyUrl(u, q, rb, po); }
  },
  {
    pre: true,
    re: /(^|[^\w$."'`#])((?!super\b)[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.postMessage(\s*\()/g,
    make: function (m, pre, obj, paren) { return pre + 'globalThis.__hzpPMW(' + obj + ').postMessage' + paren; }
  },
  {
    pre: true,
    re: /(^|[^\w$."'`#])((?!super\b)[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\?\.postMessage(\s*\()/g,
    make: function (m, pre, obj, paren) { return pre + 'globalThis.__hzpPMW(' + obj + ').postMessage' + paren; }
  }
];

function rewriteJsSource(js, realBase, proxyOrigin) {
  var rb = realBase || '', po = proxyOrigin || '';
  var edits = [];
  for (var p = 0; p < JS_PATTERNS.length; p++) {
    var pat = JS_PATTERNS[p];
    var re = new RegExp(pat.re.source, pat.re.flags);
    var m;
    while ((m = re.exec(js)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      var rep = pat.make.apply(null, [m[0]].concat(Array.prototype.slice.call(m, 1)).concat([rb, po]));
      if (rep === m[0]) continue;
      var coreStart = pat.pre ? m.index + String(m[1] || '').length : m.index;
      edits.push({ start: m.index, end: m.index + m[0].length, core: coreStart, rep: rep, pat: p });
    }
  }
  if (!edits.length) return js;
  edits.sort(function (a, b) { return a.start - b.start || a.end - b.end || a.pat - b.pat; });
  var ranges = computeCodeRanges(js);
  var inCode = makeInCode(ranges);
  var out = '';
  var pos = 0;
  for (var e = 0; e < edits.length; e++) {
    var ed = edits[e];
    if (ed.start < pos) continue;
    if (!inCode(ed.core)) continue;
    out += js.slice(pos, ed.start) + ed.rep;
    pos = ed.end;
  }
  out += js.slice(pos);
  return out;
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
  var proxied = proxyOrigin + '/' + abs.href;
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
  h.delete('Referrer-Policy');
  h.delete('Referrer-Policy-Report-Only');
  h.delete('X-Frame-Options');
  h.delete('Frame-Options');
  h.delete('X-Content-Type-Options');
  h.delete('Strict-Transport-Security');
  h.delete('Cross-Origin-Embedder-Policy');
  h.delete('Cross-Origin-Embedder-Policy-Report-Only');
  h.delete('Cross-Origin-Opener-Policy');
  h.delete('Cross-Origin-Opener-Policy-Report-Only');
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
function forceFullReferrer(html) {
  try {
    html = html.replace(/<meta\b[^>]*\bname\s*=\s*(?:"referrer"|'referrer'|referrer)[^>]*>/gi, '');
    html = html.replace(/\breferrerpolicy\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, 'referrerpolicy="unsafe-url"');
  } catch (e) {}
  return html;
}


function normalizeWrappedUrl(target) {
  try {
    var tu = new URL(target);
    var p = tu.pathname || '';
    if (p.charAt(0) === '/') p = p.slice(1);
    if (p.indexOf('proxy/') === 0) p = p.slice(6);
    var fixed = p.replace(/^(https?):\/(?!\/)/, '$1://');
    if (fixed.indexOf('://') !== -1) {
      var nu = new URL(fixed);
      var href = nu.href;
      if (tu.search && href.indexOf('?') === -1) href += tu.search;
      if (tu.hash && href.indexOf('#') === -1) href += tu.hash;
      return href;
    }
  } catch (e) {}
  return null;
}

var HZP_CLIENT_SRC = `(function(){
"use strict";
if (self.__hzpClient) return;
self.__hzpClient = 1;

var HIDDEN = 'hz-attr-';
var REAL_BASE = %__HZP_REAL_BASE__%;
var REAL_ORIGIN = %__HZP_REAL_ORIGIN__%;
var PROXY_ORIGIN = self.__hzpOriginOverride || self.location.origin;
var HZP_VER = '%__HZP_VER__%';
function hzpAddQuery(href, kv) {
  var i = href.indexOf('#');
  var head = i === -1 ? href : href.slice(0, i);
  var tail = i === -1 ? '' : href.slice(i);
  var lastCh = head.slice(-1);
  var sep = lastCh === '?' || lastCh === '&' ? '' : head.indexOf('?') === -1 ? '?' : '&';
  return head + sep + kv + tail;
}
function hzpDelQuery(href, name) {
  var i = href.indexOf('#');
  var head = i === -1 ? href : href.slice(0, i);
  var tail = i === -1 ? '' : href.slice(i);
  var q = head.indexOf('?');
  if (q === -1) return href;
  var parts = head.slice(q + 1).split('&');
  var out = [];
  for (var j = 0; j < parts.length; j++) {
    if (parts[j] === name || parts[j].indexOf(name + '=') === 0) continue;
    out.push(parts[j]);
  }
  return head.slice(0, q) + (out.length ? '?' + out.join('&') : '') + tail;
}
function verUrl(h) {
  try {
    if (!HZP_VER) return h;
    var s = String(h);
    var u = new SN.URL(s);
    if (!/\\.m?js$/i.test(u.pathname) && !/\\.cjs$/i.test(u.pathname)) return h;
    if (/[?&]__hzpv=/.test(s)) return h;
    return hzpAddQuery(s, '__hzpv=' + HZP_VER);
  } catch (e) { return h; }
}
function deVerUrl(sv) {
  try {
    if (String(sv).indexOf('__hzpv=') === -1) return sv;
    return hzpDelQuery(String(sv), '__hzpv');
  } catch (e) {}
  return sv;
}

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

function unproxyInput(v) {
  try {
    var s = String(v == null ? '' : v);
    if (!s) return s;
    if (s.charAt(0) === '/') {
      var r0 = realFrom(PROXY_ORIGIN + s);
      if (r0) return r0;
    }
    if (s.indexOf(PROXY_ORIGIN) === 0) {
      var r1 = realFrom(s);
      if (r1) return r1;
    }
    var si = s.indexOf('/proxy/');
    if (si >= 0) {
      var cand = s.slice(si);
      if (cand.indexOf('/proxy/') === 0) {
        var r2 = realFrom(PROXY_ORIGIN + cand);
        if (r2) return r2;
      }
    }
    var hi = s.indexOf('/http');
    if (hi >= 0) {
      var cand2 = s.slice(hi);
      if (cand2.indexOf('/http') === 0) {
        var r3 = realFrom(PROXY_ORIGIN + cand2);
        if (r3) return r3;
      }
    }
  } catch (e) {}
  return String(v == null ? '' : v);
}
function resolveUrl(v, base) {
  try { return new SN.URL(unproxyInput(v), base || REAL_BASE || PROXY_ORIGIN); }
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
    if (p.indexOf('/proxy/') !== 0) {
      var dws = /^\\/(wss?)\\/([a-z0-9.\\-\\[\\]:]+)(\\/.*)?$/.exec(p);
      if (dws) return dws[1] + '://' + dws[2] + (dws[3] || '') + (u.search || '') + (u.hash || '');
      if (p.indexOf('/http') === 0) {
        var dform = p.slice(1);
        var ddec;
        try { ddec = decodeURIComponent(dform); } catch (e) { ddec = dform; }
        ddec = ddec.replace(/^(https?):\\/(?!\\/)/i, '$1://');
        if (ddec.indexOf('://') !== -1) return deVerUrl(ddec + (u.search || '') + (u.hash || ''));
      }
      return null;
    }
    var rest = p.slice('/proxy/'.length);
    var ws = /^(wss?)\\/([a-z0-9.\\-\\[\\]:]+)(\\/.*)$/.exec(rest);
    if (ws) return ws[1] + '://' + ws[2] + (ws[3] || '') + (u.search || '') + (u.hash || '');
    var decoded;
    try { decoded = decodeURIComponent(rest); } catch (e) { decoded = rest; }
    if (decoded.indexOf('://') !== -1) return deVerUrl(decoded + (u.search || '') + (u.hash || ''));
    var firstSlash = decoded.indexOf('/');
    if (firstSlash === -1) {
      return 'https://' + decoded + '/' + (u.search || '') + (u.hash || '');
    }
    var host = decoded.slice(0, firstSlash);
    if (!host) return null;
    return deVerUrl('https://' + host + decoded.slice(firstSlash) + (u.search || '') + (u.hash || ''));
  } catch (e) { return null; }
}
function isProxiedPath(p) {
  p = String(p == null ? '' : p);
  return p.indexOf('/proxy/') === 0 || p.indexOf('/http://') === 0 || p.indexOf('/https://') === 0 || p.indexOf('/ws/') === 0 || p.indexOf('/wss/') === 0;
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
    if (s.indexOf('/proxy/') === 0) return PROXY_ORIGIN + s;
    if (/^(mailto:|tel:|sms:|about:|blob:|data:|javascript:)/i.test(s)) return s;
        if (/^https?:\\/\\//i.test(s)) {
      try {
        var snp = new SN.URL(s).pathname;
        if (isProxiedPath(snp)) return s;
      } catch (e) {}
    }
    var abs = resolveUrl(s);
    if (!abs) return s;
    var p = abs.protocol;
    if (p === 'javascript:' || p === 'about:' || p === 'data:' || p === 'blob:' || p === 'mailto:' || p === 'tel:') return s;
    if (p !== 'http:' && p !== 'https:' && p !== 'ws:' && p !== 'wss:') return s;
    if (abs.origin === PROXY_ORIGIN) return abs.href;
    if (p === 'ws:' || p === 'wss:') {
      var wsProxied = PROXY_ORIGIN + '/' + (p === 'wss:' ? 'wss' : 'ws') + '/' + abs.host + abs.pathname + abs.search;
      if (REAL_ORIGIN) wsProxied = hzpAddQuery(wsProxied, '__hzpo=' + encodeURIComponent(REAL_ORIGIN));
      return wsProxied;
    }
        return PROXY_ORIGIN + '/' + verUrl(abs.href);
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
    if (s.indexOf('/proxy/') === 0) return PROXY_ORIGIN + s;
    var abs = resolveUrl(s);
    if (!abs) return s;
    var p = abs.protocol;
    if (p === 'data:' || p === 'blob:' || p === 'javascript:' || p === 'about:' || p === 'mailto:') return s;
    if (p !== 'http:' && p !== 'https:') return s;
    if (abs.origin === PROXY_ORIGIN && isProxiedPath(abs.pathname)) return s;
        if (abs.origin === PROXY_ORIGIN) return abs.href;
    return PROXY_ORIGIN + '/' + verUrl(abs.href);
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
  ['assign', 'replace', 'reload', 'toString'].forEach(function (m) {
    try {
      var o = NATIVE_LOC;
      while (o) {
        var d = getPd(o, m);
        if (d && typeof d.value === 'function') { PRISTINE_PROTO_METHODS[m] = d.value; return; }
        o = SN.Object.getPrototypeOf(o);
      }
      if (self.Location && self.Location.prototype && typeof self.Location.prototype[m] === 'function') PRISTINE_PROTO_METHODS[m] = self.Location.prototype[m];
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
    if (!abs) {
      try {
        var hs = PRISTINE_LOC.href;
        if (hs && hs.set) return SN.oreflect.call(hs.set, NATIVE_LOC, [String(rawUrl == null ? '' : rawUrl)]);
      } catch (e0) {}
      return;
    }
    var proxied = toProxy(abs.href);
    var pristineMethod = replace ? PRISTINE_PROTO_METHODS.replace : PRISTINE_PROTO_METHODS.assign;
    if (typeof pristineMethod !== 'function') {
      try { pristineMethod = NATIVE_LOC[replace ? 'replace' : 'assign']; } catch (e1) {}
    }
    if (typeof pristineMethod === 'function') {
      SN.oreflect.call(pristineMethod, NATIVE_LOC, [proxied]);
      fireNav(abs.href);
    }
  } catch (e) {}
}
function buildLocObj() {
  var fake = {};
  var getReal = function (p) {
    try {
      var u = realUrlObj();
      if (!u) return '';
      var v = u[p];
      return v == null ? '' : String(v);
    } catch (e) { return ''; }
  };
  var setProp = function (p, v) {
    try {
      if (p === 'hash') {
        var hs = PRISTINE_LOC.hash;
        if (hs && hs.set) return SN.oreflect.call(hs.set, NATIVE_LOC, [String(v == null ? '' : v)]);
      }
      var u = realUrlObj();
      if (!u) return;
      try { u[p] = String(v == null ? '' : v); } catch (e) { return; }
      navigate(u.href, true);
    } catch (e) {}
  };
  ['protocol', 'hash', 'host', 'hostname', 'origin', 'port', 'pathname', 'search'].forEach(function (p) {
    var d = { enumerable: true, configurable: true };
    d.get = function () { return getReal(p); };
    if (p !== 'origin') d.set = function (v) { setProp(p, v); };
    def(fake, p, d);
  });
  def(fake, 'href', {
    enumerable: true, configurable: true,
    get: function () { return getReal('href'); },
    set: function (v) { try { navigate(String(v == null ? '' : v), false); } catch (e) {} }
  });
  fake.assign = function (v) { try { navigate(String(v == null ? '' : v), false); } catch (e) {} };
  fake.replace = function (v) { try { navigate(String(v == null ? '' : v), true); } catch (e) {} };
  fake.reload = function () {
    try {
      var rm = PRISTINE_PROTO_METHODS.reload;
      if (typeof rm === 'function') return SN.oreflect.call(rm, NATIVE_LOC, []);
    } catch (e) {}
    try { NATIVE_LOC.reload(); } catch (e2) {}
  };
  fake.toString = function () { return getReal('href'); };
  fake.valueOf = function () { return getReal('href'); };
  try { def(fake, Symbol.toPrimitive, { value: function () { return getReal('href'); }, configurable: true }); } catch (e) {}
  return fake;
}
(function () {
  try {
    var exLoc = getPd(self, '__hzpLocObj');
    if (exLoc && exLoc.get) return;
    var locObj = buildLocObj();
    def(self, '__hzpLocObj', {
      get: function () { return locObj; },
      set: function (v) { try { navigate(String(v == null ? '' : v), false); } catch (e) {} },
      configurable: false, enumerable: false
    });
  } catch (e) {}
})();
function hardenGlobals() {
  ['__hzpLoc', '__hzpLocObj', '__hzpPMW', '__hzpClient'].forEach(function (name) {
    try {
      var d = getPd(self, name);
      if (!d || d.configurable === false) return;
      var nd = { configurable: false, enumerable: false };
      if (d.get) { nd.get = d.get; try { nd.set = d.set; } catch (e0) {} }
      else { nd.value = d.value; nd.writable = false; }
      SN.od(self, name, nd);
    } catch (e) {}
  });
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

function hookHistoryFor(w) {
  var proto = w && w.History && w.History.prototype;
  if (!proto || proto.__hzpHist) return;
  def(proto, '__hzpHist', { value: true, writable: false, configurable: true, enumerable: false });
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

function hookHistory() { hookHistoryFor(self); }

function hookLocationFor(w) {
  var proto = w && w.Location && w.Location.prototype;
  if (!proto || proto.__hzpLocP) return;
  def(proto, '__hzpLocP', { value: true, writable: false, configurable: true, enumerable: false });
  ['assign', 'replace'].forEach(function (m) {
    var orig = proto[m];
    if (typeof orig !== 'function') return;
    def(proto, m, {
      value: function (v) {
        try {
          var abs = resolveUrl(String(v), currentRealUrl());
          var proxied = abs ? toProxy(abs.href) : String(v);
          return SN.oreflect.call(orig, this, proxied);
        } catch (e) { try { return SN.oreflect.call(orig, this, v); } catch (e2) { return undefined; } }
      },
      writable: true, configurable: true
    });
  });
}

var frameWatched = new SN.WeakSet();

function installFrameWindow(w) {
  try {
    if (!w || w === self) return;
    if (w.HZP) return;
    hookHistoryFor(w);
    hookLocationFor(w);
  } catch (e) {}
}

function attachFrameWatch(f) {
  try {
    installFrameWindow(f.contentWindow);
    if (frameWatched.has(f)) return;
    frameWatched.add(f);
    f.addEventListener('load', function () {
      try { installFrameWindow(f.contentWindow); } catch (e) {}
    });
  } catch (e) {}
}

function hookFrameWindowAccess() {
  try {
    var IFP = self.HTMLIFrameElement && self.HTMLIFrameElement.prototype;
    if (IFP) {
      var cw = SN.oget(IFP, 'contentWindow');
      if (cw && cw.get && !IFP.__hzpCW) {
        def(IFP, '__hzpCW', { value: true, writable: false, configurable: true, enumerable: false });
        def(IFP, 'contentWindow', {
          get: function () {
            var w = cw.get.call(this);
            try { installFrameWindow(w); } catch (e) {}
            return w;
          },
          configurable: true, enumerable: cw.enumerable !== false
        });
      }
    }
    var DP = self.Document && self.Document.prototype;
    if (DP) {
      var dv = SN.oget(DP, 'defaultView');
      if (dv && dv.get && !DP.__hzpDV) {
        def(DP, '__hzpDV', { value: true, writable: false, configurable: true, enumerable: false });
        def(DP, 'defaultView', {
          get: function () {
            var w = dv.get.call(this);
            try { if (w !== self) installFrameWindow(w); } catch (e) {}
            return w;
          },
          configurable: true, enumerable: dv.enumerable !== false
        });
      }
    }
  } catch (e) {}
}

function scanFrames() {
  try {
    var c = document.querySelectorAll('iframe, frame');
    for (var i = 0; i < c.length; i++) attachFrameWatch(c[i]);
  } catch (e) {}
  try {
    var fw = self.frames;
    for (var j = 0; j < fw.length; j++) installFrameWindow(fw[j]);
  } catch (e) {}
}

function hookFrames() {
  try { hookFrameWindowAccess(); } catch (e) {}
  try { scanFrames(); } catch (e) {}
  try {
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (!n || n.nodeType !== 1) continue;
          try {
            var tag = String(n.tagName || '').toLowerCase();
            if (tag === 'iframe' || tag === 'frame') attachFrameWatch(n);
            else if (n.querySelectorAll) {
              var inner = n.querySelectorAll('iframe, frame');
              for (var k = 0; k < inner.length; k++) attachFrameWatch(inner[k]);
            }
          } catch (e) {}
        }
      }
    });
    if (document.documentElement) obs.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
}

var HIDDEN_SCRIPT_SRC = HIDDEN + 'script-source-src';

function hookElementAttrs() {
  if (!self.Element) return;
  var E = self.Element.prototype;
    var NAT_GET = E.getAttribute, NAT_SET = E.setAttribute, NAT_HAS = E.hasAttribute,
      NAT_REMOVE = E.removeAttribute, NAT_NAMES = E.getAttributeNames, NAT_SETNS = E.setAttributeNS;
  SN.rawGetAttr = function (el, name) { try { return SN.oreflect.call(NAT_GET, el, [String(name)]); } catch (e) { return null; } };
  SN.rawSetAttr = function (el, name, v) { try { SN.oreflect.call(NAT_SET, el, [String(name), String(v)]); return true; } catch (e) { return false; } };

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
            ctx.earlyReturn = undefined;
            return;
          }
          ctx.args[1] = String(out);
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

var HTML_URL_ATTR_RE = /(\\s(?:xlink:href|src|href|poster|action|formaction|data|imagesrcset|srcset)\\s*=\\s*)(?:"([^"]*)"|'([^']*)')/gi;
var HTML_STYLE_ATTR_RE = /(\\sstyle\\s*=\\s*)(?:"([^"]*)"|'([^']*)')/gi;
function rewriteHtmlString(html) {
  try {
    var s = String(html == null ? '' : html);
    if (!s || s.indexOf('<') === -1) return s;
    if (s.indexOf('src=') === -1 && s.indexOf('href=') === -1 && s.indexOf('srcset') === -1 && s.indexOf('url(') === -1) return s;
    s = s.replace(HTML_URL_ATTR_RE, function (m, pre, dq, sq) {
      var v = dq != null ? dq : sq;
      if (!v) return m;
      var t = v.replace(/\\s+/g, '');
      if (!t || t.charAt(0) === '#' || /^(javascript|data|blob|about|mailto|tel|sms):/i.test(t)) return m;
      var name = pre.replace(/[\\s=]/g, '');
      var proxied;
      try {
        if (name.indexOf('srcset') !== -1) proxied = srcsetValue(v);
        else if (realFrom(v)) proxied = v;
        else proxied = toProxy(v);
      } catch (e) { return m; }
      if (proxied == null || proxied === v) return m;
      var q = dq != null ? '"' : "'";
      return pre + q + proxied + q + ' ' + HIDDEN + name + '=' + q + v + q;
    });
    if (s.indexOf('url(') !== -1) {
      s = s.replace(HTML_STYLE_ATTR_RE, function (m, pre, dq, sq) {
        var v = dq != null ? dq : sq;
        if (!v || v.indexOf('url(') === -1) return m;
        var out = rewriteCssStr(v);
        if (out === v) return m;
        var q = dq != null ? '"' : "'";
        return pre + q + out + q + ' ' + HIDDEN + 'style=' + q + v + q;
      });
    }
    return s;
  } catch (e) { return html; }
}
function hookHtmlStrings() {
  try {
    if (self.Element) {
      var ip = getPd(self.Element.prototype, 'innerHTML');
      if (ip && ip.set) {
        def(self.Element.prototype, 'innerHTML', {
          get: ip.get ? function () { try { return ip.get.call(this); } catch (e) { return ''; } } : undefined,
          set: function (v) { return ip.set.call(this, rewriteHtmlString(v)); },
          configurable: true,
          enumerable: ip.enumerable !== false
        });
        var op = getPd(self.Element.prototype, 'outerHTML');
        if (op && op.set) {
          def(self.Element.prototype, 'outerHTML', {
            get: op.get ? function () { try { return op.get.call(this); } catch (e) { return ''; } } : undefined,
            set: function (v) { return op.set.call(this, rewriteHtmlString(v)); },
            configurable: true,
            enumerable: op.enumerable !== false
          });
        }
      }
    }
  } catch (e) {}
  try {
    if (self.ShadowRoot) {
      var sp = getPd(self.ShadowRoot.prototype, 'innerHTML');
      if (sp && sp.set) {
        def(self.ShadowRoot.prototype, 'innerHTML', {
          get: sp.get ? function () { try { return sp.get.call(this); } catch (e) { return ''; } } : undefined,
          set: function (v) { return sp.set.call(this, rewriteHtmlString(v)); },
          configurable: true,
          enumerable: sp.enumerable !== false
        });
      }
    }
  } catch (e) {}
  try {
    makeProxy('Element.prototype.insertAdjacentHTML', function (ctx) {
      try { if (ctx.args.length > 1) ctx.args[1] = rewriteHtmlString(ctx.args[1]); } catch (e) {}
    });
  } catch (e) {}
  try {
    makeProxy('Range.prototype.createContextualFragment', function (ctx) {
      try { if (ctx.args.length > 0) ctx.args[0] = rewriteHtmlString(ctx.args[0]); } catch (e) {}
    });
  } catch (e) {}
  try {
    if (self.DOMParser) {
      makeProxy('DOMParser.prototype.parseFromString', function (ctx) {
        try {
          if (ctx.args.length > 1 && /html/i.test(String(ctx.args[1]))) ctx.args[0] = rewriteHtmlString(ctx.args[0]);
        } catch (e) {}
      });
    }
  } catch (e) {}
  try {
    makeProxy('Audio', function (ctx) {
      try {
        if (ctx.args.length > 0 && ctx.args[0]) {
          var s = String(ctx.args[0]);
          if (!realFrom(s)) ctx.args[0] = toProxy(s);
        }
      } catch (e) {}
    });
  } catch (e) {}
}

var HZ_BLOB_WRAP = null;
var HZ_BLOB_REV = null;
var HZ_BLOB_DEC = null;
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
            else if (attr === 'srcdoc') out = rewriteHtmlString(s);
            else if (HZ_BLOB_DEC && HZ_BLOB_DEC.has(s)) out = (HZ_BLOB_REV && HZ_BLOB_REV.get(s)) || s;
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
      get: function (c) { try { return REAL_BASE || currentRealUrl(); } catch (e) { return currentRealUrl(); } }
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
  try {
    if (data && typeof data === 'object' && data.$hzp$messagetype === 'window') return data;
  } catch (e0) {}
  var u = null;
  try { u = realUrlObj(); } catch (e) {}
  var origin = (u && u.origin) || REAL_ORIGIN || PROXY_ORIGIN;
  return { $hzp$messagetype: 'window', $hzp$origin: String(origin), $hzp$data: data };
}
function isWinLike(o) {
  if (!o) return false;
  try { if (o === self || o === self.window) return true; } catch (e0) {}
  try { if (typeof o.postMessage !== 'function') return false; } catch (e1) { return false; }
  try { if (o.self === o) return true; } catch (e2) {}
  try { if (o.location !== undefined) return true; } catch (e3) { return true; }
  return false;
}
function hookPostMessage() {
  try {
    self.__hzpPMW = function (w) {
      return {
        postMessage: function (a, b, c) {
          if (!w) return undefined;
          var isWin = false;
          try { isWin = isWinLike(w); } catch (e0) { isWin = false; }
          if (!isWin) {
            try { return w.postMessage(a, b, c); } catch (e3) { return undefined; }
          }
          var payload = a;
          try { payload = wrapMessageData(a); } catch (e4) {}
          if (w === self || w === self.window) {
            try { return SN.oreflect.call(SN.rawPost, self, [payload, '*', c]); } catch (e5) {}
            try { return self.postMessage(payload, '*', c); } catch (e6) {}
            return undefined;
          }
          try { return SN.oreflect.call(SN.rawPost, w, [payload, '*', c]); } catch (e7) {}
          try { return SN.oreflect.call(self.postMessage, w, [payload, '*', c]); } catch (e8) {}
          try { return w.postMessage(payload, '*', c); } catch (e9) {}
          return undefined;
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
          try {
            var nat = c.get();
            if (nat === PROXY_ORIGIN) {
              var src = c.self ? c.self.source : null;
              if (src) {
                var href = null;
                try { href = src.location.href; } catch (e1) { href = null; }
                var real = href ? realFrom(href) : null;
                if (real) {
                  var ro = null;
                  try { ro = new SN.URL(real).origin; } catch (e4) { ro = null; }
                  if (ro) return ro;
                }
              }
            }
            return nat;
          } catch (e2) {}
          return c.get();
        }
      });
    }
  } catch (e) {}
}
function hookUserAgent() {
  var ua = '';
  try { ua = String((self.navigator && self.navigator.userAgent) || ''); } catch (e) { return; }
  if (ua.indexOf('HeadlessChrome') === -1) return;
  var uaFixed = ua.replace(/HeadlessChrome\\/(\\d+)[\\d.]*/, 'Chrome/$1.0.0.0');
  try {
    makeTrap('Navigator.prototype.userAgent', {
      get: function (c) { try { return uaFixed; } catch (e) {} return c.get(); }
    });
  } catch (e) {}
  try {
    var uad = self.navigator && self.navigator.userAgentData;
    if (uad) {
      var fixBrands = function (list) {
        if (!list || typeof list.length !== 'number') return list;
        var out = [];
        for (var i = 0; i < list.length; i++) {
          var b = list[i] || {};
          out.push(b.brand === 'HeadlessChrome' ? { brand: 'Google Chrome', version: String(b.version || '') } : b);
        }
        return out;
      };
      makeTrap('Navigator.prototype.userAgentData', {
        get: function (c) {
          var real = null;
          try { real = c.get(); } catch (e) {}
          if (!real) return real;
          var brands = fixBrands(real.brands);
          return {
            brands: brands,
            mobile: real.mobile,
            platform: real.platform,
            getHighEntropyValues: function (hints) {
              var pr = real.getHighEntropyValues(hints);
              return pr && pr.then ? pr.then(function (v) {
                try {
                  if (v && v.brands) v.brands = fixBrands(v.brands);
                  if (v && v.fullVersionList) v.fullVersionList = fixBrands(v.fullVersionList);
                } catch (e) {}
                return v;
              }) : pr;
            },
            toJSON: function () { return { brands: brands, mobile: real.mobile, platform: real.platform }; }
          };
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
        var cleaned = v.replace(/;\\s*domain=[^;]*/gi, '');
        var eq = cleaned.indexOf('=');
        if (eq > 0) {
          var name = cleaned.slice(0, eq);
          if (name.indexOf('hz-') !== 0) return c.set('hz-' + realHost + ':' + cleaned);
        }
        return c.set(cleaned);
      } catch (e) { try { c.set(String(c.value || '').replace(/;\\s*domain=[^;]*/gi, '')); } catch (e2) {} }
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
  var NATIVE_COU = null;
  var NATIVE_ROU = null;
  try {
    if (self.URL && typeof self.URL.createObjectURL === 'function' && typeof self.Blob === 'function') {
      NATIVE_COU = self.URL.createObjectURL;
      NATIVE_ROU = self.URL.revokeObjectURL;
      HZ_BLOB_WRAP = new Map();
      HZ_BLOB_REV = new Map();
      HZ_BLOB_DEC = new Set();
      try { self.__hzpNCOU = function (b) { return NATIVE_COU.call(self.URL, b); }; } catch (e) {}
      try {
        self.URL.createObjectURL = function (blob) {
          try {
            var bt = String((blob && blob.type) || '').toLowerCase();
            if (bt.indexOf('javascript') !== -1 || bt.indexOf('ecmascript') !== -1 || bt.indexOf('module') !== -1) {
              var rurl = NATIVE_COU.call(self.URL, blob);
              var durl = NATIVE_COU.call(self.URL, new Blob([hzModuleBlobDecider(rurl)], { type: 'text/javascript' }));
              HZ_BLOB_WRAP.set(rurl, durl);
              HZ_BLOB_REV.set(durl, rurl);
              HZ_BLOB_DEC.add(durl);
              return durl;
            }
          } catch (e) {}
          return NATIVE_COU.apply(self.URL, arguments);
        };
      } catch (e) {}
      try {
        self.URL.revokeObjectURL = function (u) {
          try {
            var s = String(u);
            if (HZ_BLOB_WRAP.has(s) || HZ_BLOB_REV.has(s)) {
              setTimeout(function () { try { NATIVE_ROU.call(self.URL, s); } catch (e) {} }, 60000);
              return;
            }
          } catch (e) {}
          return NATIVE_ROU.apply(self.URL, arguments);
        };
      } catch (e) {}
    }
  } catch (e) {}

  function hzPxSrc() {
    return 'function px(v){try{var s=String(v==null?"":v);if(!s)return v;if(s.indexOf(PO)===0)return v;' +
      'if(/^(mailto:|tel:|sms:|about:|blob:|data:|javascript:)/i.test(s))return v;' +
      'var a=new URL(s,self.location.href);' +
      'if(a.protocol==="http:"||a.protocol==="https:"){if(a.origin===PO)return v;return PO+"/"+a.href;}' +
      'if(a.protocol==="ws:"||a.protocol==="wss:")return PO+"/"+(a.protocol==="wss:"?"wss":"ws")+"/"+a.host+a.pathname+a.search;' +
      'return v;}catch(e){return v;}}';
  }

  function hzModuleBlobDecider(realUrl) {
    return 'var PO=' + JSON.stringify(PROXY_ORIGIN) + ';var R=' + JSON.stringify(realUrl) + ';' +
      hzPxSrc() +
      'self.__hzd=1;' +
      'try{if(typeof self.__hzpClient==="undefined"){' +
      'try{var f=self.fetch;if(f)self.fetch=function(i,o){try{if(typeof i==="string")i=px(i);else if(i&&typeof i.url==="string"){var p2=px(i.url);if(p2!==i.url)i=new Request(p2,i);}}catch(e){}return f.call(self,i,o);};}catch(e){}' +
      'try{if(self.XMLHttpRequest){var oo=self.XMLHttpRequest.prototype.open;self.XMLHttpRequest.prototype.open=function(m,u){try{arguments[1]=px(u);}catch(e){}return oo.apply(this,arguments);};}}catch(e){}' +
      'try{if(self.WebSocket){var OW=self.WebSocket;var NW=function W(u,p){return new OW(px(u),p);};NW.prototype=OW.prototype;self.WebSocket=NW;}}catch(e){}' +
      '}}catch(e){}' +
      'var __hzd;' +
      'export{__hzd as default};' +
      'try{var t=await (await fetch(R)).text();' +
      'var BAD="0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$."+String.fromCharCode(39)+String.fromCharCode(34);' +
      'var out="",i2=0;' +
      'while(true){var j=t.indexOf("import",i2);if(j<0){out+=t.slice(i2);break;}var ok=true;var c0=j>0?t.charAt(j-1):"";if(c0!==""&&BAD.indexOf(c0)>=0)ok=false;var k2=j+6;while(t.charAt(k2)===" ")k2++;if(t.charAt(k2)!=="(")ok=false;if(ok){out+=t.slice(i2,j)+"__hzpi";i2=k2;}else{out+=t.slice(i2,j+6);i2=j+6;}}' +
      'var pre=out.indexOf("__hzpi")>=0?("var PO="+JSON.stringify(PO)+";function __hzpi(u){return import(__hzpx(u));}var __hzpx="+px.toString()+";"):"";' +
      'var COU=self.__hzpNCOU;' +
      'var u2=COU?COU(new Blob([pre+out],{type:"text/javascript"})):URL.createObjectURL(new Blob([pre+out],{type:"text/javascript"}));' +
      'var m=await import(u2);__hzd=m.default;' +
      '}catch(e){try{var m2=await import(R);__hzd=m2.default;}catch(e2){}}';
  }

  function hzWorkerPatchBody() {
    return '(function(){var PO=' + JSON.stringify(PROXY_ORIGIN) + ';' +
      hzPxSrc() +
      'try{var f=self.fetch;if(f)self.fetch=function(i,o){try{if(typeof i==="string")i=px(i);else if(i&&typeof i.url==="string"){var p2=px(i.url);if(p2!==i.url)i=new Request(p2,i);}}catch(e){}return f.call(self,i,o);};}catch(e){}' +
      'try{if(self.XMLHttpRequest){var oo=self.XMLHttpRequest.prototype.open;self.XMLHttpRequest.prototype.open=function(m,u){try{arguments[1]=px(u);}catch(e){}return oo.apply(this,arguments);};}}catch(e){}' +
      'try{if(self.WebSocket){var OW=self.WebSocket;var NW=function W(u,p){return new OW(px(u),p);};NW.prototype=OW.prototype;self.WebSocket=NW;}}catch(e){}' +
      'try{if(self.EventSource){var OE=self.EventSource;var NE=function E(u,p){return new OE(px(u),p);};NE.prototype=OE.prototype;self.EventSource=NE;}}catch(e){}' +
      'function hzc(a){try{var s=String(a);if(s.indexOf("blob:")!==0)return px(a);var x=new XMLHttpRequest();x.open("GET",s,false);x.send();var t=String(x.responseText||"");var Q=String.fromCharCode(34);var k=t.indexOf("var R="+Q);if(k>=0&&t.indexOf("__hzd")>=0){var q=t.indexOf(Q,k+7);if(q>k)return t.slice(k+7,q);}}catch(e){}return px(a);}' +
      'try{var ois=self.importScripts;if(ois)self.importScripts=function(){var a=[];for(var i=0;i<arguments.length;i++)a.push(hzc(arguments[i]));return ois.apply(self,a);};}catch(e){}' +
      'self.__hzpWorkerProxy=px;})()';
  }

  function hzWrapBlobWorker(realUrl, isModule) {
    try {
      if (!NATIVE_COU || !HZ_BLOB_WRAP) return realUrl;
      var src = hzWorkerPatchBody() + (isModule
        ? ';await import(' + JSON.stringify(realUrl) + ');'
        : ';self.importScripts(' + JSON.stringify(realUrl) + ');');
      var wurl = NATIVE_COU.call(self.URL, new Blob([src], { type: 'text/javascript' }));
      HZ_BLOB_WRAP.set(realUrl, wurl);
      setTimeout(function () { try { NATIVE_ROU.call(self.URL, wurl); } catch (e) {} }, 120000);
      return wurl;
    } catch (e) { return realUrl; }
  }

  try {
    if (self.Worker) {
      makeProxy('Worker', function (ctx) {
        try {
          if (ctx.args[0]) {
            var ws0 = String(ctx.args[0]);
            if (ws0.indexOf('blob:') === 0) {
              var wm0 = !!(ctx.args[1] && ctx.args[1].type === 'module');
              if (HZ_BLOB_DEC && HZ_BLOB_DEC.has(ws0)) ctx.args[0] = hzWrapBlobWorker(wm0 ? ws0 : ((HZ_BLOB_REV && HZ_BLOB_REV.get(ws0)) || ws0), wm0);
              else ctx.args[0] = hzWrapBlobWorker(ws0, wm0);
            } else ctx.args[0] = toProxy(ws0);
          }
        } catch (e) {}
      });
    }
    if (self.SharedWorker) {
      makeProxy('SharedWorker', function (ctx) {
        try {
          if (ctx.args[0]) {
            var ss0 = String(ctx.args[0]);
            if (ss0.indexOf('blob:') === 0) {
              var sm0 = !!(ctx.args[1] && ctx.args[1].type === 'module');
              if (HZ_BLOB_DEC && HZ_BLOB_DEC.has(ss0)) ctx.args[0] = hzWrapBlobWorker(sm0 ? ss0 : ((HZ_BLOB_REV && HZ_BLOB_REV.get(ss0)) || ss0), sm0);
              else ctx.args[0] = hzWrapBlobWorker(ss0, sm0);
            } else ctx.args[0] = toProxy(ss0);
          }
        } catch (e) {}
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
        if (e.defaultPrevented) return;
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
    }, false);
    doc.addEventListener('submit', function (e) {
      try {
        if (e.defaultPrevented) return;
        var f = e.target;
        if (!f || !f.action) return;
        var abs = String(f.action || '');
        if (abs.indexOf(PROXY_ORIGIN) === 0) return;
        e.preventDefault();
        var a = f.getAttribute('action') || '';
        f.setAttribute(HIDDEN + 'action', a);
        f.setAttribute('action', toProxy(a));
        f.submit();
      } catch (err) {}
    }, false);
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
        if (SN.rawGetAttr) {
          var cur = SN.rawGetAttr(el, attr);
          if (cur === proxied) {
            if (SN.rawGetAttr(el, HIDDEN + attr) !== raw && SN.rawSetAttr) SN.rawSetAttr(el, HIDDEN + attr, raw);
            return;
          }
        }
        el.setAttribute(HIDDEN + attr, raw);
        el.setAttribute(attr, proxied);
      });
    } catch (e) {}
    if (tag === 'IMG' || tag === 'SOURCE') {
      try {
        var ss = el.getAttribute('srcset');
        if (ss) {
          var proxied2 = srcsetValue(ss);
          if (proxied2 !== ss) {
            var cur2 = SN.rawGetAttr ? SN.rawGetAttr(el, 'srcset') : null;
            if (cur2 !== proxied2) {
              if (SN.rawSetAttr) SN.rawSetAttr(el, HIDDEN + 'srcset', ss); else el.setAttribute(HIDDEN + 'srcset', ss);
              el.setAttribute('srcset', proxied2);
            }
          }
        }
      } catch (e) {}
    }
    if (tag === 'LINK') {
      try {
        var iss = el.getAttribute('imagesrcset');
        if (iss) {
          var proxied3 = srcsetValue(iss);
          if (proxied3 !== iss) {
            var cur3 = SN.rawGetAttr ? SN.rawGetAttr(el, 'imagesrcset') : null;
            if (cur3 !== proxied3) {
              if (SN.rawSetAttr) SN.rawSetAttr(el, HIDDEN + 'imagesrcset', iss); else el.setAttribute(HIDDEN + 'imagesrcset', iss);
              el.setAttribute('imagesrcset', proxied3);
            }
          }
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
          if (SN.rawPost) SN.oreflect.call(SN.rawPost, e.source, [{ type: 'hzp-subscribed' }, '*']);
          else e.source.postMessage({ type: 'hzp-subscribed' }, '*');
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
  try { hookHtmlStrings(); } catch (e) {}
  try { hookDocument(); } catch (e) {}
  try { hookDocumentWrite(); } catch (e) {}
  try { hookPostMessage(); } catch (e) {}
  try { hookUserAgent(); } catch (e) {}
  try { hookCookies(); } catch (e) {}
  try { isolateStorages(); } catch (e) {}
  try { hookCss(); } catch (e) {}
  try { hookRequests(); } catch (e) {}
  try { hookWindow(); } catch (e) {}
  try { hookDomEvents(); } catch (e) {}
  try { hookFrames(); } catch (e) {}
  try { bootObserver(); } catch (e) {}
  try { styleElementWatcher(); } catch (e) {}
  try { bootUrlSync(); } catch (e) {}
  try { hardenGlobals(); } catch (e) {}
}

installAllWindows();
try { self.HZP = { href: function () { return currentRealUrl(); }, proxy: toProxy, unproxy: realFrom, loc: function (p) { try { return self.__hzpLoc(String(p)); } catch (e) { return ''; } } }; } catch (e) {}
})();
`;

function buildClientScript(realBase, realOrigin) {
  return '<script>' + HZP_CLIENT_SRC
    .replace('%__HZP_REAL_BASE__%', jsonSafeScript(realBase))
    .replace('%__HZP_REAL_ORIGIN__%', jsonSafeScript(realOrigin))
    .replace('%__HZP_VER__%', String(HZP.CLIENT_VERSION).replace(/[^0-9A-Za-z._-]/g, ''))
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
        if (isProxiedPath(ap)) return v;
      } catch (e) {}
    }
    var abs = new URL(v, realBase);
    var p = abs.protocol;
    if (p !== 'http:' && p !== 'https:') return v;
    if (isProxiedPath(abs.pathname)) return v;
    return proxyOrigin + '/' + verHref(abs.href);
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
  ['a[href]', 'href'], ['area[href]', 'href'], ['link[href]', 'href'], ['image[href]', 'href'],
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
    r.on('meta[http-equiv]', { element: function (el) {
    try {
      var hv = String(el.getAttribute('http-equiv') || '').toLowerCase();
      if (hv === 'content-security-policy' || hv === 'content-security-policy-report-only' || hv === 'x-content-security-policy' || hv === 'x-webkit-csp') el.remove();
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
    var wsOriginHint = '';
    try { wsOriginHint = url.searchParams.get('__hzpo') || ''; } catch (e) {}
    var wsTarget = parseUniversalURL(pathname, url.search);
    if (wsTarget) wsTarget = delQueryParam(wsTarget, '__hzpo');
    wsTarget = wsTarget ? wsTarget.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:') : null;
    if (wsTarget && (wsTarget.indexOf('ws://') === 0 || wsTarget.indexOf('wss://') === 0)) {
      return handleWebSocketProxy(request, wsTarget, wsOriginHint);
    }
  }

  var targetURL = parseUniversalURL(pathname, url.search, url.hash);
  if (!targetURL) return new Response('Invalid URL', { status: 400 });
  if (targetURL.indexOf('__hzpv=') !== -1) targetURL = delQueryParam(targetURL, '__hzpv');
  var wrappedFix = normalizeWrappedUrl(targetURL);
  if (wrappedFix) return Response.redirect(new URL('/' + wrappedFix, url.origin).href, 302);
  var targetURLObject;
  try { targetURLObject = new URL(targetURL); }
  catch (e) { return new Response('Invalid URL', { status: 400 }); }
  var navDest = String(request.headers.get('sec-fetch-dest') || '').toLowerCase();
  if (navDest === 'document' || navDest === 'iframe') {
    var navHost = '';
    try { navHost = String(targetURLObject.hostname || '').toLowerCase(); } catch (e) {}
    if (navHost && isAdNavHost(navHost)) return new Response(null, { status: 204 });
  } else if (isAdRequest(targetURL)) return new Response(null, { status: 204 });

  var fwdHeaders = new Headers(request.headers);
  var uaRaw = fwdHeaders.get('User-Agent');
  if (!uaRaw || uaRaw.indexOf('Mozilla/5.0') === -1) {
    fwdHeaders.set('User-Agent', HZP.UA);
  } else if (uaRaw.indexOf('HeadlessChrome') !== -1) {
    fwdHeaders.set('User-Agent', uaRaw.replace(/HeadlessChrome\/(\d+)[\d.]*/, 'Chrome/$1.0.0.0'));
  }
  var deHeadless = function (h, brand) {
    if (!h || h.indexOf('HeadlessChrome') === -1) return h;
    return h.replace(/HeadlessChrome/g, brand);
  };
  var chUa = fwdHeaders.get('sec-ch-ua');
  if (chUa) fwdHeaders.set('sec-ch-ua', deHeadless(chUa, 'Google Chrome'));
  var chUaFull = fwdHeaders.get('sec-ch-ua-full-version-list');
  if (chUaFull) fwdHeaders.set('sec-ch-ua-full-version-list', deHeadless(chUaFull, 'Google Chrome'));
  [].concat(Array.from(fwdHeaders.keys())).forEach(function (n) {
    if (n.indexOf('sec-ch-ua-') !== 0) return;
    var hv = (fwdHeaders.get(n) || '').trim();
    if (hv === '' || /^"+$/.test(hv)) fwdHeaders.delete(n);
  });
  ['Host', 'cf-connecting-ip', 'cf-ray', 'cf-visitor', 'cf-worker',
   'x-forwarded-proto', 'x-forwarded-for', 'x-forwarded-host', 'x-real-ip'].forEach(function (n) { fwdHeaders.delete(n); });

  var refRaw = fwdHeaders.get('Referer');
  var refReal = null;
  if (refRaw) {
    try {
      var refU = new URL(refRaw);
      if (refU.origin === url.origin) refReal = parseUniversalURL(refU.pathname, refU.search, refU.hash);
    } catch (e) { refReal = null; }
    if (refReal) fwdHeaders.set('Referer', refReal);
    else fwdHeaders.delete('Referer');
  }

  try {
    if (request.headers.has('sec-fetch-dest')) {
      var tgtOrigin = targetURLObject.origin;
      var initOrigin = null;
      if (refReal) { try { initOrigin = new URL(refReal).origin; } catch (e) { initOrigin = null; } }
      var siteKey = function (origin) {
        var h = new URL(origin).hostname;
        var parts = h.split('.');
        return parts.length > 2 ? parts.slice(-2).join('.') : h;
      };
      var sfSite;
      if (!initOrigin) sfSite = request.headers.get('sec-fetch-dest') === 'document' ? 'none' : 'cross-site';
      else if (initOrigin === tgtOrigin) sfSite = 'same-origin';
      else if (siteKey(initOrigin) === siteKey(tgtOrigin)) sfSite = 'same-site';
      else sfSite = 'cross-site';
      fwdHeaders.set('sec-fetch-site', sfSite);
    }
  } catch (e) {}
  var originRaw = fwdHeaders.get('Origin');
  if (originRaw) {
    var originReal = null;
    try {
      if (originRaw === url.origin) {
        if (refReal) originReal = new URL(refReal).origin;
      } else {
        var oU = new URL(originRaw);
        if (oU.origin === url.origin) {
          var oTarget = parseUniversalURL(oU.pathname, oU.search, oU.hash);
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

  var secureCk = url.protocol === 'https:' || url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
  var fetchOpts = { method: request.method, headers: fwdHeaders, redirect: 'manual' };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    var bodyBytes = null;
    try { bodyBytes = await request.arrayBuffer(); }
    catch (e) { return new Response('Failed to read request body: ' + (e.message || e), { status: 400 }); }
    if (bodyBytes && bodyBytes.byteLength > 0) {
      fwdHeaders.delete('Content-Length');
      fwdHeaders.delete('Transfer-Encoding');
      fetchOpts.body = bodyBytes;
    }
  }
  var resp;
  try { resp = await fetch(targetURL, fetchOpts); }
  catch (err) { return new Response('Failed to fetch: ' + (err.message || err), { status: 502 }); }

  if (resp.status >= 300 && resp.status < 400) {
    var redirH = passThroughHeaders(resp, host, url.origin, secureCk);
    return new Response(null, { status: resp.status, statusText: resp.statusText, headers: redirH });
  }

  if (request.method === 'GET' && resp.status === 200 && isHtmlContentType(resp.headers.get('Content-Type') || '')) {
    var wantJson = false;
    try {
      var accH = String(request.headers.get('accept') || '').toLowerCase();
      var xrwH = String(request.headers.get('x-requested-with') || '').toLowerCase();
      if (accH.indexOf('application/json') !== -1 || xrwH === 'xmlhttprequest') {
        wantJson = true;
      } else if (accH.indexOf('*/*') !== -1) {
        wantJson = /\/api\//i.test(targetURLObject.pathname) || /(^|\.)api\./i.test(targetURLObject.hostname);
      }
    } catch (e) {}
    if (wantJson) {
      for (var rtry = 0; rtry < 2; rtry++) {
        try {
          var scv = resp.headers.getSetCookie ? resp.headers.getSetCookie() : [];
          if (scv && scv.length) {
            var extra = [];
            for (var ci = 0; ci < scv.length; ci++) {
              var pair = String(scv[ci]).split(';')[0];
              if (pair.indexOf('=') > 0 && pair.length < 4000) extra.push(pair);
            }
            if (extra.length) {
              var curCk = fetchOpts.headers.get('Cookie') || '';
              fetchOpts.headers.set('Cookie', curCk ? (curCk + '; ' + extra.join('; ')) : extra.join('; '));
            }
          }
        } catch (e) {}
        var resp2;
        try { resp2 = await fetch(targetURL, fetchOpts); }
        catch (e2) { break; }
        resp = resp2;
        if (resp2.status < 400 && !isHtmlContentType(resp2.headers.get('Content-Type') || '')) break;
      }
    }
  }

  var contentType = resp.headers.get('Content-Type') || '';

    if (isHtmlContentType(contentType)) {
    var challengePage = false;
    try { challengePage = targetURLObject.pathname.indexOf('/cdn-cgi/challenge-platform/') === 0; } catch (e) {}
    if (String(resp.headers.get('cf-mitigated') || '') === 'challenge') challengePage = true;
    var html;
    try { html = await resp.text(); }
    catch (e) { return new Response('Failed to read response: ' + (e.message || e), { status: 502 }); }
    html = forceFullReferrer(html);

    var realBase, realOrigin;
    try { var ru = new URL(resp.url); realBase = ru.href; realOrigin = ru.origin; }
    catch (e) { realBase = ''; realOrigin = ''; }
    var proxyOrigin = url.origin;

    if (realBase) {
      try {
        var bm = /<base\b[^>]*>/i.exec(html);
        if (bm) {
          var hm = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(bm[0]);
          var bh = hm ? String(hm[2] !== undefined ? hm[2] : (hm[3] !== undefined ? hm[3] : (hm[4] || ''))) : '';
          if (bh) {
            var absBase = new URL(bh, realBase);
            if (absBase.protocol === 'http:' || absBase.protocol === 'https:') realBase = absBase.href;
          }
        }
      } catch (e) {}
    }

    html = rewriteInlineScripts(html, realBase, proxyOrigin);
    var head = '';
    if (realBase) head += '<base href="' + escapeHtmlAttr(realBase) + '">';
    if (HZP.AD_BLOCK && !challengePage) head += '<style>' + heavyAdCss() + '</style>' + AD_BLOCK_CLIENT;
    head += buildClientScript(realBase, realOrigin);
    html = injectInHead(html, head);

    var outHeaders = new Headers(resp.headers);
    outHeaders.set('Content-Type', 'text/html; charset=utf-8');
    outHeaders.set('Access-Control-Allow-Origin', '*');
    stripSecurityHeaders(outHeaders);
    outHeaders.set('Referrer-Policy', 'unsafe-url');
    if ((navDest === 'iframe' || navDest === 'frame') && !challengePage) {
      outHeaders.set('Content-Security-Policy', 'sandbox allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-pointer-lock allow-presentation allow-orientation-lock allow-storage-access-by-user-activation allow-top-navigation-by-user-activation; frame-ancestors *');
    }
    if (HZP.CROSS_ORIGIN_ISOLATION) {
      outHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
      outHeaders.set('Cross-Origin-Embedder-Policy', 'credentialless');
    }
    outHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin');
    outHeaders.delete('Content-Length');
    outHeaders.delete('Content-Encoding');
    outHeaders.delete('Transfer-Encoding');
    if (HZP.COOKIE_ISOLATION) rewriteSetCookieOnHeaders(resp, outHeaders, host, secureCk);
    rewriteResponseUrlHeaders(outHeaders, resp.url || targetURL, url.origin);

        var transformed = buildHtmlRewriter(realBase, proxyOrigin)
      .transform(new Response(html, { status: resp.status, statusText: resp.statusText, headers: outHeaders }));
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(Promise.resolve());
    }
    return transformed;
  }

  if (isCssContentType(contentType)) {
    var cssH = passThroughHeaders(resp, host, url.origin, secureCk);
    try {
      var css = await resp.text();
      css = rewriteCssUrls(css, resp.url || targetURL, url.origin);
      cssH.set('Content-Type', contentType);
      cssH.set('Cache-Control', 'public, max-age=86400');
      return new Response(css, { status: resp.status, statusText: resp.statusText, headers: cssH });
    } catch (e) {
      return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: cssH });
    }
  }

    if (isJsContentType(contentType)) {
    var passH = passThroughHeaders(resp, host, url.origin, secureCk);
    try {
      var js = await resp.text();
      try { js = rewriteJsSource(js, new URL(resp.url).href, url.origin); }
      catch (e) { js = rewriteJsSource(js, resp.url, url.origin); }
      if (js.indexOf('__hzpLoc(') !== -1 || js.indexOf('__hzpLocObj') !== -1 || js.indexOf('__hzpPMW(') !== -1) js = withRewriteGuard(js);
      passH.set('Cache-Control', 'public, max-age=86400');
      return new Response(js, { status: resp.status, statusText: resp.statusText, headers: passH });
    } catch (e) {
      return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: passH });
    }
  }

    if (contentType.indexOf('manifest') !== -1 || /\b(?:web)?manifest\.json(?:$|[?#])/i.test(targetURL) || /\.webmanifest(?:$|[?#])/i.test(targetURL)) {
    var manH = passThroughHeaders(resp, host, url.origin, secureCk);
    try {
      var mtxt = await resp.text();
      var mj = JSON.parse(mtxt);
      var mbase = resp.url || targetURL;
      var rwU = function (v) { try { return cssProxyUrl(String(v), mbase, url.origin); } catch (e) { return v; } };
      ['start_url', 'scope', 'id'].forEach(function (k) { if (typeof mj[k] === 'string') mj[k] = rwU(mj[k]); });
      if (Array.isArray(mj.icons)) mj.icons.forEach(function (ic) { if (ic && typeof ic.src === 'string') ic.src = rwU(ic.src); });
      if (Array.isArray(mj.screenshots)) mj.screenshots.forEach(function (ic) { if (ic && typeof ic.src === 'string') ic.src = rwU(ic.src); });
      if (Array.isArray(mj.shortcuts)) mj.shortcuts.forEach(function (sc) {
        if (!sc) return;
        if (typeof sc.url === 'string') sc.url = rwU(sc.url);
        if (Array.isArray(sc.icons)) sc.icons.forEach(function (ic) { if (ic && typeof ic.src === 'string') ic.src = rwU(ic.src); });
      });
      if (mj.share_target && typeof mj.share_target.action === 'string') mj.share_target.action = rwU(mj.share_target.action);
      manH.set('Content-Type', contentType.indexOf('manifest') !== -1 ? contentType : 'application/manifest+json');
      return new Response(JSON.stringify(mj), { status: resp.status, statusText: resp.statusText, headers: manH });
    } catch (e) {
      return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: manH });
    }
  }

    var streamH = passThroughHeaders(resp, host, url.origin, secureCk);
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

function rewriteSetCookieOnHeaders(resp, h, host, secureAttr) {
  if (typeof resp.headers.getSetCookie !== 'function') return;
  var cookies = resp.headers.getSetCookie();
  if (!cookies || !cookies.length) return;
  h.delete('Set-Cookie');
  cookies.forEach(function (c) { h.append('Set-Cookie', rewriteSetCookie(c, host, secureAttr)); });
}

function passThroughHeaders(resp, host, proxyOrigin, secureAttr) {
  var h = new Headers(resp.headers);
  h.set('Access-Control-Allow-Origin', '*');
  stripSecurityHeaders(h);
  h.set('Cross-Origin-Resource-Policy', 'cross-origin');
  if (HZP.CROSS_ORIGIN_ISOLATION) {
    h.set('Cross-Origin-Embedder-Policy', 'credentialless');
    h.set('Cross-Origin-Opener-Policy', 'same-origin');
  }
  h.delete('Content-Length');
  h.delete('Content-Encoding');
  h.delete('Transfer-Encoding');
  if (HZP.COOKIE_ISOLATION) rewriteSetCookieOnHeaders(resp, h, host, secureAttr);
  rewriteResponseUrlHeaders(h, resp.url, proxyOrigin);
  return h;
}

async function handleWebSocketProxy(request, targetURL, originHint) {
  var protocol = request.headers.get('sec-websocket-protocol') || '';
  var pair = new WebSocketPair();
  var clientSock = pair[0], serverSock = pair[1];
  var upstream = null;
  var negotiated = protocol;
  var realOrigin = '';
  try { realOrigin = String(originHint || ''); } catch (e) { realOrigin = ''; }
  if (!realOrigin) {
    try {
      var ref = request.headers.get('referer') || '';
      if (ref) {
        var refU = new URL(ref);
        var ownU = new URL(request.url);
        if (refU.origin === ownU.origin) {
          var realRef = parseUniversalURL(refU.pathname, refU.search, refU.hash);
          if (realRef) realOrigin = new URL(realRef).origin;
        } else if (refU.protocol === 'http:' || refU.protocol === 'https:') {
          realOrigin = refU.origin;
        }
      }
    } catch (e) { realOrigin = ''; }
  }
  if (!realOrigin) {
    try {
      var tu = new URL(targetURL);
      realOrigin = (tu.protocol === 'wss:' ? 'https:' : 'http:') + '//' + tu.host;
    } catch (e) {}
  }
  var upUrl = targetURL.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
  var upHeaders = new Headers();
  upHeaders.set('Upgrade', 'websocket');
  upHeaders.set('Connection', 'Upgrade');
  upHeaders.set('Sec-WebSocket-Version', '13');
  try {
    var keyBytes = new Uint8Array(16);
    crypto.getRandomValues(keyBytes);
    var keyStr = '';
    for (var ki = 0; ki < keyBytes.length; ki++) keyStr += String.fromCharCode(keyBytes[ki]);
    upHeaders.set('Sec-WebSocket-Key', btoa(keyStr));
  } catch (e) {
    upHeaders.set('Sec-WebSocket-Key', 'dGhlIHNhbXBsZSBub25jZQ==');
  }
  if (protocol) upHeaders.set('Sec-WebSocket-Protocol', protocol);
  if (realOrigin) upHeaders.set('Origin', realOrigin);
  var ua = request.headers.get('user-agent');
  if (ua) upHeaders.set('User-Agent', ua);
  try {
    var upResp = await fetch(upUrl, { method: 'GET', headers: upHeaders });
    if (upResp.status === 101 && upResp.webSocket) {
      upstream = upResp.webSocket;
      negotiated = upResp.headers.get('sec-websocket-protocol') || protocol;
    }
  } catch (e) {}
  if (!upstream) {
    try { upstream = new WebSocket(targetURL, protocol || undefined); }
    catch (e) { return new Response('WebSocket upstream failed: ' + (e.message || e), { status: 502 }); }
    upstream.addEventListener('open', function () { try { serverSock.accept(); } catch (e) {} });
  } else {
    try { upstream.accept(); } catch (e) {}
    try { serverSock.accept(); } catch (e) {}
  }
  try { upstream.binaryType = 'arraybuffer'; } catch (e) {}
  try { serverSock.binaryType = 'arraybuffer'; } catch (e) {}
  upstream.addEventListener('message', function (ev) { try { serverSock.send(ev.data); } catch (e) {} });
  upstream.addEventListener('close', function (ev) { try { serverSock.close(ev.code || 1000, ev.reason || ''); } catch (e) {} });
  upstream.addEventListener('error', function () { try { serverSock.close(1011, 'upstream error'); } catch (e) {} });
  serverSock.addEventListener('message', function (ev) { try { upstream.send(ev.data); } catch (e) {} });
  serverSock.addEventListener('close', function (ev) { try { upstream.close(ev.code || 1000, ev.reason || ''); } catch (e) {} });
  var h = new Headers();
  if (negotiated) h.set('Sec-WebSocket-Protocol', negotiated);
  return new Response(null, { status: 101, webSocket: clientSock, headers: h });
}


export default {
  async fetch(request, env, ctx) {
    try {
      var res = await handleRequest(request, env, ctx);
      if (res && res.status === 502) {
        var rec = refererRecovery(request);
        if (rec) return rec;
      }
      return res;
    } catch (e) {
      return new Response('Proxy error: ' + (e.message || e), {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  }
};

