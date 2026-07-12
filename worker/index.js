import CryptoJS from 'crypto-js';

const APP_TOKEN_SECRET = "18comicAPP";
const APP_DATA_SECRET = "185Hcomic3PAPP7R";
const APP_VERSION = "1.8.0";
const API_DOMAIN_SERVER_SECRET = "diosfjckwpqpdfjkvnqQjsik";

const API_DOMAIN_SERVER_URLS = [
  "https://rup4a04-c01.tos-ap-southeast-1.bytepluses.com/newsvr-2025.txt",
  "https://rup4a04-c02.tos-cn-hongkong.bytepluses.com/newsvr-2025.txt",
  "https://rup4a04-c03.tos-cn-beijing.bytepluses.com.cn/newsvr-2025.txt",
  "https://jmappc01-1308024008.cos.ap-guangzhou.myqcloud.com/server-2024.txt"
];

const FALLBACK_API_SOURCES = [
  "www.cdnaspa.club",
  "www.cdnaspa.vip",
  "www.cdnplaystation6.cc",
  "www.cdnplaystation6.vip"
];

const getTokenWithTokenparam = (ts, ver = APP_VERSION, secret = APP_TOKEN_SECRET) => {
  const tokenparam = `${ts},${ver}`;
  const token = CryptoJS.MD5(`${ts}${secret}`).toString();
  return { token, tokenparam };
};

const decodeDataText = (data, ts, secret = APP_DATA_SECRET) => {
  const dataWordArray = CryptoJS.enc.Base64.parse(data);
  const token = CryptoJS.MD5(`${ts}${secret}`).toString();
  const tokenWordArray = CryptoJS.enc.Utf8.parse(token);
  const encrypted = CryptoJS.lib.CipherParams.create({
    ciphertext: dataWordArray
  });
  const decrypted = CryptoJS.AES.decrypt(encrypted, tokenWordArray, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
};

const decodeJsonData = (data, ts, secret) => {
  return JSON.parse(decodeDataText(data, ts, secret));
};

const stripNonAsciiPrefix = (text) => {
  let result = text;
  while (result && result.charCodeAt(0) > 127) {
    result = result.slice(1);
  }
  return result;
};

const normalizeApiSource = (source) => {
  const trimmed = source.trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).host;
  } catch {
    return trimmed.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
};

const normalizeApiSources = (sources) => {
  return Array.from(new Set(sources.map(normalizeApiSource).filter(Boolean)));
};

let cachedApiSources = null;
let lastSourceFetchTime = 0;

const fetchLatestApiSources = async () => {
  const now = Date.now();
  if (cachedApiSources && now - lastSourceFetchTime < 3600000) { // cache for 1 hour
    return cachedApiSources;
  }

  for (const url of API_DOMAIN_SERVER_URLS) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) continue;
      const encryptedText = stripNonAsciiPrefix(await response.text());
      const decodedText = decodeDataText(encryptedText, "", API_DOMAIN_SERVER_SECRET);
      const data = JSON.parse(decodedText);
      const sources = normalizeApiSources(data.Server ?? []);
      if (sources.length > 0) {
        cachedApiSources = sources;
        lastSourceFetchTime = now;
        return sources;
      }
    } catch (e) {
      // ignore error and try next
    }
  }
  return null;
};

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

    // --- E-Hentai Search ---
    if (url.pathname === '/api/ehentai/search') {
      const q = url.searchParams.get('q');
      if (!q) {
        return new Response(JSON.stringify({ results: [] }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
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

        return new Response(JSON.stringify({ results }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ results: [], error: e.message }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    // --- E-Hentai Gallery Details ---
    if (url.pathname === '/api/ehentai/gallery') {
      const gid = url.searchParams.get('gid');
      const token = url.searchParams.get('token');
      
      if (!gid || !token) {
        return new Response(JSON.stringify({ error: "Missing gid or token" }), { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
      }

      try {
        const payload = {
          method: "gdata",
          gidlist: [[parseInt(gid), token]],
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
          return new Response(JSON.stringify({ gallery: meta }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        } else {
          throw new Error('Gallery not found in API response');
        }
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
    }
    // --- JMComic Search ---
    if (url.pathname === '/api/jmcomic/search') {
      const q = url.searchParams.get('q');
      if (!q) {
        return new Response(JSON.stringify({ results: [] }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      try {
        const sources = await fetchLatestApiSources() || FALLBACK_API_SOURCES;
        const timestamp = Math.floor(Date.now() / 1000);
        const { token, tokenparam } = getTokenWithTokenparam(timestamp);

        const searchHeaders = new Headers();
        searchHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
        searchHeaders.set('Accept', 'application/json');
        searchHeaders.set('token', token);
        searchHeaders.set('tokenparam', tokenparam);
        searchHeaders.set('Accept-Encoding', 'gzip, deflate');

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

                return new Response(JSON.stringify({ results }), {
                  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                });
              } catch (e) {
                lastError = e;
              }
            }
          } catch (e) {
            lastError = e;
          }
        }

        return new Response(JSON.stringify({
          results: [],
          error: lastError ? lastError.message : 'All domains failed'
        }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ results: [], error: e.message }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    if (url.pathname === '/api/jmcomic/sources') {
      const sources = await fetchLatestApiSources() || FALLBACK_API_SOURCES;
      return new Response(JSON.stringify({ sources }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
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

      const sources = await fetchLatestApiSources() || FALLBACK_API_SOURCES;
      const timestamp = Math.floor(Date.now() / 1000);
      const { token, tokenparam } = getTokenWithTokenparam(timestamp);

      const newHeaders = new Headers();
      newHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
      newHeaders.set('Accept', 'application/json');
      newHeaders.set('token', token);
      newHeaders.set('tokenparam', tokenparam);
      newHeaders.set('Accept-Encoding', 'gzip, deflate');

      let lastError = null;
      let rawData = null;
      let success = false;

      for (const domain of sources) {
        const targetUrl = `https://${domain}/album?id=${jmId}`;
        try {
          const jmResponse = await fetch(targetUrl, {
            method: 'GET',
            headers: newHeaders,
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

        return new Response(rawData, {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      } else {
        return new Response(JSON.stringify({
            code: 502,
            message: `Fetch Error: ${lastError ? lastError.message : 'All domains failed'}`
        }), { 
          status: 502, 
          headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*" 
          } 
        });
      }
    }

    return new Response("Not Found", { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
  }
};
