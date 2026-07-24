addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// --- Configuration ---
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

// Attributes that commonly contain URLs
const URL_ATTRS = new Set([
  'src', 'href', 'action', 'data-src', 'data-href', 'data-url',
  'poster', 'background', 'cite', 'formaction', 'icon', 'manifest',
  'content', 'dynsrc', 'lowsrc', 'srcset', 'data-bg', 'data-image',
  'data-lazy-src', 'data-original', 'data-actualsrc', 'data-thumb'
]);

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
  headers.set('Referer', targetURL.href);
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
  respHeaders.delete('Cross-Origin-Opener-Policy');
  respHeaders.delete('Cross-Origin-Embedder-Policy');
  respHeaders.delete('Cross-Origin-Resource-Policy');
  respHeaders.set('Access-Control-Allow-Origin', '*');
  respHeaders.set('Access-Control-Allow-Methods', '*');
  respHeaders.set('Access-Control-Allow-Headers', '*');
  respHeaders.set('Access-Control-Allow-Credentials', 'true');

  // Fix cookie paths to scope per proxied domain
  const setCookies = response.headers.getAll('Set-Cookie');
  respHeaders.delete('Set-Cookie');
  setCookies.forEach(cookie => {
    // Rewrite Path
    let fixedCookie = cookie.replace(/Path=([^;]+)/gi, (match, path) => {
      const normalizedPath = path.startsWith('/') ? path : '/' + path;
      return `Path=/${targetURL.host}${normalizedPath}`;
    });
    // Rewrite Domain - remove it entirely so cookies are scoped to worker origin
    fixedCookie = fixedCookie.replace(/Domain=[^;]+;?\s*/gi, '');
    // Remove Secure flag since worker may serve over http in dev
    fixedCookie = fixedCookie.replace(/Secure;?\s*/gi, '');
    // Ensure SameSite=None for cross-origin proxying
    if (!fixedCookie.includes('SameSite=')) {
      fixedCookie += '; SameSite=None';
    }
    respHeaders.append('Set-Cookie', fixedCookie);
  });

  const contentType = respHeaders.get('Content-Type') || '';

  // Rewrite HTML content with deep parsing
  if (contentType.includes('text/html')) {
    let html = await response.text();
    html = blockAdsInHTML(html);
    html = deepRewriteHtml(html, targetURL, workerOrigin);

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

  // Rewrite JS string literals containing URLs
  if (contentType.includes('javascript') || contentType.includes('application/json')) {
    let body = await response.text();
    body = rewriteJsUrls(body, targetURL, workerOrigin);
    return new Response(body, { status: response.status, headers: respHeaders });
  }

  // Pass through all other content unchanged
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: respHeaders
  });
}

// --- Deep URL Rewriting Engine ---

function resolveUpstream(urlStr, baseUrl) {
  if (!urlStr || typeof urlStr !== 'string') return null;
  const trimmed = urlStr.trim();
  if (!trimmed) return null;

  // Skip non-URL values
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') ||
      trimmed.startsWith('mailto:') || trimmed.startsWith('tel:') ||
      trimmed.startsWith('#') || trimmed.startsWith('about:') ||
      trimmed.startsWith('javascript:')) {
    return null;
  }

  try {
    const absoluteUrl = new URL(trimmed, baseUrl.href);
    if (!['http:', 'https:'].includes(absoluteUrl.protocol)) return null;
    return absoluteUrl;
  } catch (e) {
    return null;
  }
}

function proxyUrl(upstreamUrl, workerOrigin) {
  if (!upstreamUrl) return null;
  return `${workerOrigin}/${upstreamUrl.host}${upstreamUrl.pathname}${upstreamUrl.search}`;
}

function rewriteUrl(urlStr, baseUrl, workerOrigin) {
  const resolved = resolveUpstream(urlStr, baseUrl);
  if (!resolved) return urlStr;
  return proxyUrl(resolved, workerOrigin) || urlStr;
}

/**
 * Deep HTML rewriter using tag-by-tag parsing instead of naive global regex.
 * Handles: attributes, inline styles, srcset, meta refresh, base tags, script/style content.
 */
function deepRewriteHtml(html, baseUrl, workerOrigin) {
  // 1. Inject <base> tag FIRST as fallback for anything we miss
  const baseTag = `<base href="${baseUrl.origin}/">`;
  html = html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);

  // 2. Rewrite attribute-based URLs using proper tag-aware regex
  // This matches opening tags and processes each attribute individually
  html = html.replace(/<([a-zA-Z][a-zA-Z0-9]*)\s([^>]*?)>/gs, (fullMatch, tagName, attrs) => {
    const rewrittenAttrs = rewriteTagAttributes(attrs, tagName.toLowerCase(), baseUrl, workerOrigin);
    return `<${tagName} ${rewrittenAttrs}>`;
  });

  // 3. Rewrite inline <style> blocks
  html = html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (match, open, content, close) => {
    return open + rewriteCssUrls(content, baseUrl, workerOrigin) + close;
  });

  // 4. Rewrite URLs inside <script> tags (JSON configs, embedded data)
  html = html.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/gi, (match, open, content, close) => {
    // Only rewrite if it looks like it contains URLs (avoid rewriting pure logic)
    if (content.includes('http://') || content.includes('https://') || content.includes('"/') || content.includes("'/")) {
      return open + rewriteJsUrls(content, baseUrl, workerOrigin) + close;
    }
    return match;
  });

  // 5. Handle meta refresh
  html = html.replace(/<meta([^>]*http-equiv\s*=\s*["']refresh["'][^>]*)>/gi, (match, attrs) => {
    const contentMatch = attrs.match(/content\s*=\s*["']([^"']+)["']/i);
    if (contentMatch) {
      const content = contentMatch[1];
      const urlPart = content.match(/;\s*url\s*=\s*(.+)/i);
      if (urlPart) {
        const rewritten = rewriteUrl(urlPart[1], baseUrl, workerOrigin);
        const newContent = content.replace(urlPart[1], rewritten);
        return `<meta${attrs.replace(contentMatch[0], `content="${newContent}"`)}>`;
      }
    }
    return match;
  });

  return html;
}

function rewriteTagAttributes(attrs, tagName, baseUrl, workerOrigin) {
  // Match individual attributes: name="value", name='value', name=value
  return attrs.replace(/([a-zA-Z_][\w\-\.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g,
    (fullMatch, attrName, dqVal, sqVal, uqVal) => {
      const lowerAttr = attrName.toLowerCase();
      const value = dqVal ?? sqVal ?? uqVal;
      const quote = dqVal !== undefined ? '"' : sqVal !== undefined ? "'" : '';

      // Standard URL attributes
      if (URL_ATTRS.has(lowerAttr)) {
        // Special handling for srcset (comma-separated list of URLs with descriptors)
        if (lowerAttr === 'srcset') {
          const rewrittenSrcset = value.split(',').map(entry => {
            const parts = entry.trim().split(/\s+/);
            if (parts.length >= 1 && parts[0]) {
              parts[0] = rewriteUrl(parts[0], baseUrl, workerOrigin);
            }
            return parts.join(' ');
          }).join(', ');
          return `${attrName}=${quote}${rewrittenSrcset}${quote}`;
        }

        const rewritten = rewriteUrl(value, baseUrl, workerOrigin);
        return `${attrName}=${quote}${rewritten}${quote}`;
      }

      // Inline style attribute
      if (lowerAttr === 'style') {
        const rewritten = rewriteCssUrls(value, baseUrl, workerOrigin);
        return `${attrName}=${quote}${rewritten}${quote}`;
      }

      // Meta content with URL (e.g., og:image, twitter:image)
      if (lowerAttr === 'content' && ['meta'].includes(tagName)) {
        // Check if the value looks like a URL
        if (value.match(/^https?:\/\//i) || value.match(/^\/\//)) {
          const rewritten = rewriteUrl(value, baseUrl, workerOrigin);
          return `${attrName}=${quote}${rewritten}${quote}`;
        }
      }

      // Data attributes that might contain URLs (catch-all for custom attrs)
      if (lowerAttr.startsWith('data-') && value.match(/^https?:\/\//i)) {
        const rewritten = rewriteUrl(value, baseUrl, workerOrigin);
        return `${attrName}=${quote}${rewritten}${quote}`;
      }

      return fullMatch;
    }
  );
}

function rewriteCssUrls(css, baseUrl, workerOrigin) {
  // Rewrite url() references
  css = css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, url) => {
    const rewritten = rewriteUrl(url.trim(), baseUrl, workerOrigin);
    return `url(${quote}${rewritten}${quote})`;
  });

  // Rewrite @import statements
  css = css.replace(/@import\s+(['"])([^'"]+)\1/gi, (match, quote, url) => {
    const rewritten = rewriteUrl(url, baseUrl, workerOrigin);
    return `@import ${quote}${rewritten}${quote}`;
  });

  return css;
}

function rewriteJsUrls(js, baseUrl, workerOrigin) {
  // Rewrite quoted URL strings in JS/JSON without breaking code structure
  // Matches both single and double quoted strings that look like URLs
  js = js.replace(/(["'])(https?:\/\/[^"'\\]+)\1/g, (match, quote, url) => {
    const rewritten = rewriteUrl(url, baseUrl, workerOrigin);
    return `${quote}${rewritten}${quote}`;
  });

  // Rewrite protocol-relative URLs in JS strings
  js = js.replace(/(["'])(\/\/[^"'\\]+\.[^"'\\]+)\1/g, (match, quote, url) => {
    const rewritten = rewriteUrl(url, baseUrl, workerOrigin);
    return `${quote}${rewritten}${quote}`;
  });

  // Rewrite root-relative paths in JS strings (e.g., "/api/v1/data")
  // Only match paths that start with / followed by a letter (avoid regex paths like /\d+/)
  js = js.replace(/(["'])(\/[a-zA-Z][^"'\\]{1,200})\1/g, (match, quote, path) => {
    // Verify it resolves to a valid URL against the base
    const resolved = resolveUpstream(path, baseUrl);
    if (resolved) {
      const rewritten = proxyUrl(resolved, workerOrigin);
      return `${quote}${rewritten}${quote}`;
    }
    return match;
  });

  return js;
}

// --- Ad Blocking ---

function isAdRequest(url) {
  const lower = url.toLowerCase();
  return AD_PATTERNS.some(p => lower.includes(p));
}

function blockAdsInHTML(html) {
  html = html.replace(/<script[^>]*(?:googlesyndication|adsbygoogle|doubleclick|google-analytics|googletagmanager)[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<iframe[^>]*(?:googlesyndication|doubleclick|google-analytics)[^>]*>[\s\S]*?<\/iframe>/gi, '');
  html = html.replace(/<ins[^>]*adsbygoogle[^>]*>[\s\S]*?<\/ins>/gi, '');
  html = html.replace(/<div[^>]*(?:id|class)\s*=\s*["'][^"']*(?:ad-banner|ad-container|ad-wrapper|adsbygoogle)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');
  return html;
}
