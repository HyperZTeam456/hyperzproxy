addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const AD_PATTERNS = [
  'googlesyndication.com', 'doubleclick.net', 'googleadservices.com',
  'google-analytics.com', 'googletagmanager.com', 'googletagservices.com',
  'adservice.google.com', 'pagead2.googlesyndication.com', 'tpc.googlesyndication.com',
  'video-ad-stats.googlesyndication.com', 'ads.google.com', 'adssettings.google.com',
  'static.ads-twitter.com', 'ads-api.twitter.com', 'ads.facebook.com', 'an.facebook.com',
  'adnxs.com', 'advertising.com', 'outbrain.com', 'taboola.com', 'criteo.com',
  'pubmatic.com', 'rubiconproject.com', 'openx.net', 'adsafeprotected.com',
  'moatads.com', 'scorecardresearch.com', '/ads/', '/ad/', '/advert/',
  '/advertisement/', '/adsense/', '/adserver/', '/analytics/', 'prebid',
  'advertis', 'banner', 'popup'
];

async function handleRequest(request) {
  const url = new URL(request.url);
  const workerOrigin = url.origin;

  // Extract target from path: /example.com/path -> example.com/path
  let targetPath = url.pathname.substring(1);
  
  if (!targetPath) {
    return new Response('No target specified. Use: /example.com', { 
      status: 400,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // Resolve protocol
  let targetURL;
  try {
    if (targetPath.startsWith('http://') || targetPath.startsWith('https://')) {
      targetURL = new URL(targetPath);
    } else {
      targetURL = new URL('https://' + targetPath);
    }
  } catch (e) {
    return new Response(`Invalid URL: ${targetPath}`, { status: 400 });
  }

  targetURL.search = url.search;

  // Block ads before fetching
  if (isAdRequest(targetURL.href)) {
    return new Response('', { status: 204 });
  }

  // Build upstream request
  const headers = new Headers(request.headers);
  headers.set('Host', targetURL.host);
  headers.set('Origin', targetURL.origin);
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ray');
  headers.delete('x-forwarded-for');
  headers.delete('x-forwarded-proto');
  headers.delete('x-real-ip');

  if (!headers.has('User-Agent')) {
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  }

  const proxyReq = new Request(targetURL.href, {
    method: request.method,
    headers: headers,
    body: request.body,
    redirect: 'manual'
  });

  let response;
  try {
    response = await fetch(proxyReq);
  } catch (err) {
    return new Response(`Proxy Error: ${err.message}`, { status: 502 });
  }

  // Rewrite redirects
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('Location');
    if (location) {
      const newLoc = rewriteUrl(location, targetURL, workerOrigin);
      return Response.redirect(newLoc, response.status);
    }
  }

  // Sanitize response headers
  const respHeaders = new Headers(response.headers);
  respHeaders.delete('Content-Security-Policy');
  respHeaders.delete('X-Content-Security-Policy');
  respHeaders.delete('X-Frame-Options');
  respHeaders.delete('Frame-Options');
  respHeaders.delete('Strict-Transport-Security');
  respHeaders.set('Access-Control-Allow-Origin', '*');
  respHeaders.set('Access-Control-Allow-Methods', '*');
  respHeaders.set('Access-Control-Allow-Headers', '*');
  respHeaders.set('Access-Control-Allow-Credentials', 'true');

  // Fix cookie paths to scope per proxied domain
  const setCookies = response.headers.getAll('Set-Cookie');
  respHeaders.delete('Set-Cookie');
  setCookies.forEach(cookie => {
    const fixedCookie = cookie.replace(/Path=([^;]+)/gi, (match, path) => {
      return `Path=/${targetURL.host}${path}`;
    });
    respHeaders.append('Set-Cookie', fixedCookie);
  });

  const contentType = respHeaders.get('Content-Type') || '';

  // Rewrite HTML content
  if (contentType.includes('text/html')) {
    let html = await response.text();
    html = blockAdsInHTML(html);
    html = rewriteHtmlUrls(html, targetURL, workerOrigin);
    
    // Inject base tag for relative URL resolution
    const baseTag = `<base href="${targetURL.origin}/">`;
    if (html.match(/<head[^>]*>/i)) {
      html = html.replace(/<head[^>]*>/i, match => match + baseTag);
    } else {
      html = baseTag + html;
    }

    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders
    });
  }

  // Rewrite CSS urls
  if (contentType.includes('text/css')) {
    let css = await response.text();
    css = rewriteCssUrls(css, targetURL, workerOrigin);
    return new Response(css, { status: response.status, headers: respHeaders });
  }

  // Pass through all other content unchanged
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: respHeaders
  });
}

function rewriteUrl(urlStr, baseUrl, workerOrigin) {
  if (!urlStr) return urlStr;
  try {
    const absoluteUrl = new URL(urlStr, baseUrl.href);
    if (!['http:', 'https:'].includes(absoluteUrl.protocol)) return urlStr;
    return `${workerOrigin}/${absoluteUrl.host}${absoluteUrl.pathname}${absoluteUrl.search}`;
  } catch (e) {
    return urlStr;
  }
}

function rewriteHtmlUrls(html, baseUrl, workerOrigin) {
  const attrRegex = /(src|href|action|data-src|poster)\s*=\s*["']([^"']+)["']/gi;
  html = html.replace(attrRegex, (match, attr, val) => {
    return `${attr}="${rewriteUrl(val, baseUrl, workerOrigin)}"`;
  });
  html = html.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi, (match, url) => {
    return `url('${rewriteUrl(url, baseUrl, workerOrigin)}')`;
  });
  return html;
}

function rewriteCssUrls(css, baseUrl, workerOrigin) {
  return css.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi, (match, url) => {
    return `url('${rewriteUrl(url, baseUrl, workerOrigin)}')`;
  });
}

function isAdRequest(url) {
  const lower = url.toLowerCase();
  return AD_PATTERNS.some(p => lower.includes(p));
}

function blockAdsInHTML(html) {
  html = html.replace(/<script[^>]*(?:googlesyndication|adsbygoogle|doubleclick|google-analytics)[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<iframe[^>]*(?:googlesyndication|doubleclick)[^>]*>[\s\S]*?<\/iframe>/gi, '');
  html = html.replace(/<ins[^>]*adsbygoogle[^>]*>[\s\S]*?<\/ins>/gi, '');
  return html;
}
