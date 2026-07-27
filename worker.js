// Cloudflare Worker - Universal Proxy with Multi-Layer Shadow DOM Protection + Ad Blocking
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// Common ad domains and patterns to block
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

function isAdRequest(url) {
  const urlLower = url.toLowerCase();
  return AD_PATTERNS.some(pattern => urlLower.includes(pattern));
}

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // Serve the main HTML page
  if (url.pathname === '/' || url.pathname === '') {
    return new Response(getMainHTML(), {
      headers: {
        'Content-Type': 'text/html',
        'Permissions-Policy': 'accelerometer=*, gyroscope=*, camera=*, microphone=*, geolocation=*, hid=*, midi=*, clipboard-read=*, clipboard-write=*, xr-spatial-tracking=*, gamepad=*'
      }
    });
  }
  
  // Serve manifest.json for PWA
  if (url.pathname === '/manifest.json') {
    return new Response(getManifest(), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Serve service worker for PWA
  if (url.pathname === '/sw.js') {
    return new Response(getServiceWorker(), {
      headers: { 
        'Content-Type': 'application/javascript',
        'Service-Worker-Allowed': '/'
      }
    });
  }

  // Serve favicon.png from root — proxy Google Classroom's real icon
  if (url.pathname === '/favicon.png' || url.pathname === '/favicon.ico') {
    try {
      const iconRes = await fetch('https://ssl.gstatic.com/classroom/favicon.png');
      const iconHeaders = new Headers(iconRes.headers);
      iconHeaders.set('Cache-Control', 'public, max-age=86400');
      return new Response(iconRes.body, {
        status: iconRes.status,
        headers: iconHeaders
      });
    } catch (e) {
      return new Response('', { status: 404 });
    }
  }
  
  // Proxy everything else - universal reverse proxy
  return proxyUniversal(request);
}

async function proxyUniversal(request) {
  const url = new URL(request.url);
  const workerOrigin = url.origin;
  
  // Build the target URL from path
  // Format: /example.com/path or /https://example.com/path
  let targetPath = url.pathname.substring(1);
  if (!targetPath) {
    return new Response('No target specified', { status: 400 });
  }

  let targetURL;
  try {
    // Auto-apply HTTPS if no protocol specified
    if (targetPath.startsWith('http://') || targetPath.startsWith('https://')) {
      targetURL = new URL(targetPath);
    } else {
      targetURL = new URL('https://' + targetPath);
    }
  } catch (e) {
    return new Response(`Invalid URL: ${targetPath}`, { status: 400 });
  }
  
  // Add back query string if present
  targetURL.search = url.search;
  
  // Block ad requests
  if (isAdRequest(targetURL.href)) {
    return new Response('', { status: 204 });
  }
  
  // Build upstream request with proper header spoofing
  const headers = new Headers(request.headers);
  headers.set('Host', targetURL.host);
  headers.set('Origin', targetURL.origin);
  
  // Smart referer handling
  const referer = request.headers.get('Referer');
  if (referer) {
    try {
      const refURL = new URL(referer);
      if (refURL.origin === workerOrigin) {
        const refPath = refURL.pathname.substring(1);
        const refSeg = refPath.split('/')[0];
        if (refSeg && refSeg.includes('.')) {
          headers.set('Referer', 'https://' + refSeg + '/');
        } else {
          headers.set('Referer', targetURL.origin + '/');
        }
      } else {
        headers.set('Referer', referer);
      }
    } catch(e) {
      headers.set('Referer', targetURL.origin + '/');
    }
  } else {
    headers.set('Referer', targetURL.origin + '/');
  }

  // Add proper browser headers
  if (!headers.has('Accept-Language')) headers.set('Accept-Language', 'en-US,en;q=0.9');
  if (!headers.has('Sec-Fetch-Site')) headers.set('Sec-Fetch-Site', 'same-origin');
  if (!headers.has('Sec-Fetch-Mode')) headers.set('Sec-Fetch-Mode', 'navigate');
  if (!headers.has('Sec-Fetch-Dest')) headers.set('Sec-Fetch-Dest', 'document');
  if (!headers.has('Upgrade-Insecure-Requests')) headers.set('Upgrade-Insecure-Requests', '1');

  // Remove cloudflare headers
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ray');
  headers.delete('x-forwarded-proto');
  headers.delete('x-real-ip');
  headers.delete('x-forwarded-for');
  
  if (!headers.has('User-Agent') || headers.get('User-Agent').includes('Cloudflare')) {
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  }
  
  const proxyRequest = new Request(targetURL.href, {
    method: request.method,
    headers: headers,
    body: request.body,
    redirect: 'manual'
  });
  
  let response;
  try {
    response = await fetch(proxyRequest);
  } catch (error) {
    return new Response('Failed to fetch resource: ' + error.message, { status: 502 });
  }

  // Handle redirects - rewrite to stay in proxy
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const loc = response.headers.get('Location');
    if (loc) {
      try {
        const absLoc = new URL(loc, targetURL.href);
        const rewritten = `${workerOrigin}/${absLoc.host}${absLoc.pathname}${absLoc.search}`;
        return Response.redirect(rewritten, response.status);
      } catch (e) {
        return new Response('Redirect failed', { status: 502 });
      }
    }
  }
  
  // Strip security headers for compatibility
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Access-Control-Allow-Methods', '*');
  newHeaders.set('Access-Control-Allow-Headers', '*');
  newHeaders.set('Access-Control-Allow-Credentials', 'true');
  newHeaders.delete('Content-Security-Policy');
  newHeaders.delete('Content-Security-Policy-Report-Only');
  newHeaders.delete('X-Frame-Options');
  newHeaders.delete('Frame-Options');
  newHeaders.delete('Strict-Transport-Security');
  newHeaders.delete('Cross-Origin-Opener-Policy');
  newHeaders.delete('Cross-Origin-Embedder-Policy');
  newHeaders.delete('Cross-Origin-Resource-Policy');
  newHeaders.delete('X-XSS-Protection');
  newHeaders.delete('X-Content-Type-Options');
  newHeaders.delete('Referrer-Policy');
  newHeaders.delete('Permissions-Policy');
  newHeaders.delete('Refresh');
  
  // Fix cookies
  const setCookies = response.headers.getAll('Set-Cookie');
  newHeaders.delete('Set-Cookie');
  for (const cookie of setCookies) {
    let fixed = cookie
      .replace(/Path=([^;]+)/gi, (_, p) => `Path=/${targetURL.host}${p.startsWith('/') ? '' : '/'}${p}`)
      .replace(/Domain=[^;]+;?\s*/gi, '')
      .replace(/Secure;?\s*/gi, '');
    if (!fixed.includes('SameSite=')) fixed += '; SameSite=None';
    newHeaders.append('Set-Cookie', fixed);
  }
  
  const contentType = response.headers.get('Content-Type') || '';
  
  if (contentType.includes('text/html')) {
    let html = await response.text();
    
    // Remove ad-related elements and scripts
    html = blockAdsInHTML(html);
    
    // Inject navigation lockdown + ad blocking
    const injectionCode = getInjectionCode(workerOrigin, targetURL.origin);
    
    if (html.includes('</head>')) {
      html = html.replace('</head>', injectionCode + '</head>');
    } else {
      html = injectionCode + html;
    }
    
    // Rewrite URLs in HTML
    html = rewriteHtmlUrls(html, targetURL, workerOrigin);
    
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
  
  if (contentType.includes('text/css')) {
    let css = await response.text();
    css = rewriteCssUrls(css, targetURL, workerOrigin);
    return new Response(css, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
  
  // Block ads in JavaScript files
  if (contentType.includes('javascript') || contentType.includes('application/x-javascript')) {
    if (isAdRequest(targetURL.href)) {
      return new Response('// Ad script blocked', {
        status: 200,
        headers: { 'Content-Type': 'application/javascript' }
      });
    }
    let js = await response.text();
    js = rewriteJsUrls(js, targetURL, workerOrigin);
    return new Response(js, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
  
  if (contentType.includes('application/json')) {
    let json = await response.text();
    json = rewriteJsUrls(json, targetURL, workerOrigin);
    return new Response(json, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
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

function rewriteHtmlUrls(html, baseUrl, workerOrigin) {
  //
