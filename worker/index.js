const FALLBACK_API_SOURCES = [
  'www.cdnaspa.vip',
  'www.cdnaspa.club',
  'www.cdnplaystation6.cc',
  'www.cdnplaystation6.vip',
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    if (url.pathname.startsWith('/api/jmcomic/')) {
      const jmId = url.pathname.split('/').pop();
      if (!jmId) return new Response('Bad Request', { status: 400 });

      // Check cache if KV is configured
      const cacheKey = `jmcomic_${jmId}`;
      if (env.JM_CACHE) {
        const cached = await env.JM_CACHE.get(cacheKey);
        if (cached) {
          return new Response(cached, {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          });
        }
      }

      const newHeaders = new Headers(request.headers);
      newHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
      newHeaders.set('Accept', 'application/json');

      let lastError = null;
      let rawData = null;
      let success = false;

      // Try fallback domains
      for (const domain of FALLBACK_API_SOURCES) {
        const targetUrl = `https://${domain}/album?id=${jmId}`;
        try {
          const jmResponse = await fetch(targetUrl, {
            method: 'GET',
            headers: newHeaders,
          });

          if (jmResponse.ok) {
            rawData = await jmResponse.text();
            success = true;
            break;
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

        return new Response(rawData, {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      } else {
        return new Response(`Fetch Error: ${lastError ? lastError.message : 'All domains failed'}`, { 
          status: 502, 
          headers: { "Access-Control-Allow-Origin": "*" } 
        });
      }
    }

    return new Response("Not Found", { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
  }
};
