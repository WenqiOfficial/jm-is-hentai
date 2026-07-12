import {
  FALLBACK_API_SOURCES,
  getTokenWithTokenparam,
  decodeJsonData,
  fetchLatestApiSources
} from '../shared/crypto.js';

/**
 * Build standard JMComic API request headers.
 */
const buildJMHeaders = (token, tokenparam) => {
  const headers = new Headers();
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
  headers.set('Accept', 'application/json');
  headers.set('token', token);
  headers.set('tokenparam', tokenparam);
  headers.set('Accept-Encoding', 'gzip, deflate');
  return headers;
};

/**
 * Get CORS headers securely
 */
const getCorsHeaders = (request) => {
  const origin = request.headers.get("Origin");
  if (!origin) return {};

  const allowedKeywords = [
    'localhost',
    '127.0.0.1',
    'wenqi.icu',
    '1224630.xyz',
    'zeroarea.top'
  ];

  if (allowedKeywords.some(keyword => origin.includes(keyword))) {
    return { "Access-Control-Allow-Origin": origin };
  }
  
  return {};
};

const createResponse = (body, request, init = {}) => {
  const headers = { ...init.headers, ...getCorsHeaders(request) };
  return new Response(body, { ...init, headers });
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return createResponse(null, request, {
        headers: {
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    // --- E-Hentai Search ---
    if (url.pathname === '/api/ehentai/search') {
      const q = url.searchParams.get('q');
      if (!q) {
        return createResponse(JSON.stringify({ results: [] }), request, {
          headers: { "Content-Type": "application/json" }
        });
      }

      try {
        const searchUrl = `https://e-hentai.org/?f_search=${encodeURIComponent(q)}`;
        const resp = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
          signal: AbortSignal.timeout(15000),
        });

        const html = await resp.text();
        const results = [];

        // Match each table row in the search results
        const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
        const rows = html.match(rowRegex) || [];

        for (const row of rows) {
          if (results.length >= 10) break;

          // Extract gallery URL (gid and token)
          const urlMatch = row.match(/\/g\/(\d+)\/([a-f0-9]+)\//);
          if (!urlMatch) continue;

          const gid = urlMatch[1];
          const token = urlMatch[2];
          const galleryUrl = `https://e-hentai.org/g/${gid}/${token}/`;

          // Extract title
          const titleMatch = row.match(/<div class="glink">([^<]+)<\/div>/);
          const title = titleMatch ? titleMatch[1].trim() : '';
          if (!title) continue;

          // Extract thumbnail
          const thumbMatch = row.match(/<img[^>]*(?:data-src|src)="(https?:\/\/[^"]+)"/);
          const thumbnail = thumbMatch ? thumbMatch[1] : '';

          results.push({ title, url: galleryUrl, thumbnail, gid, token });
        }

        return createResponse(JSON.stringify({ results }), request, {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return createResponse(JSON.stringify({ results: [], error: e.message }), request, {
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // --- E-Hentai Gallery Details ---
    if (url.pathname === '/api/ehentai/gallery') {
      const gid = parseInt(url.searchParams.get('gid'), 10);
      const token = url.searchParams.get('token');

      if (isNaN(gid)) {
        return createResponse(JSON.stringify({ error: "Invalid gid" }), request, { status: 400, headers: { "Content-Type": "application/json" } });
      }
      
      if (!gid || !token) {
        return createResponse(JSON.stringify({ error: "Missing gid or token" }), request, { status: 400, headers: { "Content-Type": "application/json" } });
      }

      try {
        const payload = {
          method: "gdata",
          gidlist: [[gid, token]],
          namespace: 1
        };

        const resp = await fetch('https://api.e-hentai.org/api.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000)
        });

        const data = await resp.json();
        if (data.gmetadata && data.gmetadata.length > 0) {
          const meta = data.gmetadata[0];
          return createResponse(JSON.stringify({ gallery: meta }), request, {
            headers: { "Content-Type": "application/json" }
          });
        } else {
          throw new Error('Gallery not found in API response');
        }
      } catch (e) {
        return createResponse(JSON.stringify({ error: e.message }), request, {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    // --- JMComic Search ---
    if (url.pathname === '/api/jmcomic/search') {
      const q = url.searchParams.get('q');
      if (!q) {
        return createResponse(JSON.stringify({ results: [] }), request, {
          headers: { "Content-Type": "application/json" }
        });
      }

      try {
        const sources = await fetchLatestApiSources() || FALLBACK_API_SOURCES;
        const timestamp = Math.floor(Date.now() / 1000);
        const { token, tokenparam } = getTokenWithTokenparam(timestamp);

        const searchHeaders = buildJMHeaders(token, tokenparam);

        let lastError = null;

        for (const domain of sources) {
          const searchUrl = `https://${domain}/search?search_query=${encodeURIComponent(q)}&main_tag=0&o=mr`;
          try {
            const jmResp = await fetch(searchUrl, {
              method: 'GET',
              headers: searchHeaders,
              signal: AbortSignal.timeout(10000),
            });

            if (jmResp.ok) {
              const respJson = await jmResp.json();
              try {
                const decoded = decodeJsonData(respJson.data, timestamp);
                const content = (decoded.content || []).slice(0, 10);
                const results = content.map(item => ({
                  id: item.id,
                  title: item.name,
                  author: item.author || '',
                  url: `https://18comic.vip/album/${item.id}`,
                  thumbnail: `https://${domain}/media/albums/${item.id}_3x4.jpg`
                }));

                return createResponse(JSON.stringify({ results }), request, {
                  headers: { "Content-Type": "application/json" }
                });
              } catch (e) {
                lastError = e;
              }
            }
          } catch (e) {
            lastError = e;
          }
        }

        return createResponse(JSON.stringify({
          results: [],
          error: lastError ? lastError.message : 'All domains failed'
        }), request, {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return createResponse(JSON.stringify({ results: [], error: e.message }), request, {
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    if (url.pathname === '/api/jmcomic/sources') {
      const sources = await fetchLatestApiSources() || FALLBACK_API_SOURCES;
      return createResponse(JSON.stringify({ sources }), request, {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }

    if (url.pathname.startsWith('/api/jmcomic/')) {
      const jmId = url.pathname.split('/').filter(Boolean).pop();
      if (!jmId || !/^\d+$/.test(jmId)) return createResponse('Bad Request', request, { status: 400 });

      // Check cache if KV is configured
      const cacheKey = `jmcomic_${jmId}`;
      if (env.JM_CACHE) {
        const cached = await env.JM_CACHE.get(cacheKey);
        if (cached) {
          return createResponse(cached, request, {
            headers: {
              "Content-Type": "application/json"
            }
          });
        }
      }

      const sources = await fetchLatestApiSources() || FALLBACK_API_SOURCES;
      const timestamp = Math.floor(Date.now() / 1000);
      const { token, tokenparam } = getTokenWithTokenparam(timestamp);

      const jmHeaders = buildJMHeaders(token, tokenparam);

      let lastError = null;
      let rawData = null;
      let success = false;

      for (const domain of sources) {
        const targetUrl = `https://${domain}/album?id=${jmId}`;
        try {
          const jmResponse = await fetch(targetUrl, {
            method: 'GET',
            headers: jmHeaders,
            signal: AbortSignal.timeout(10000)
          });

          if (jmResponse.ok) {
            const respJson = await jmResponse.json();
            try {
              const album = decodeJsonData(respJson.data, timestamp);
              if (album && album.id) {
                // Add the successful domain to the payload for frontend to use as image CDN
                album._source_domain = domain;
                rawData = JSON.stringify({ code: 200, data: album });
                success = true;
                break;
              }
            } catch(e) {
                lastError = e;
            }
          }
        } catch (e) {
          lastError = e;
        }
      }

      if (success && rawData) {
        // Save to cache in background
        if (env.JM_CACHE) {
          ctx.waitUntil(env.JM_CACHE.put(cacheKey, rawData, { expirationTtl: 86400 * 7 })); // Cache for 7 days
        }

        return createResponse(rawData, request, {
          headers: {
            "Content-Type": "application/json"
          }
        });
      } else {
        return createResponse(JSON.stringify({
            code: 502,
            message: `Fetch Error: ${lastError ? lastError.message : 'All domains failed'}`
        }), request, { 
          status: 502, 
          headers: { 
              "Content-Type": "application/json"
          } 
        });
      }
    }

    return createResponse("Not Found", request, { status: 404, headers: { "Content-Type": "text/plain" } });
  }
};
