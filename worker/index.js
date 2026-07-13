import { searchEhentai, fetchEhentaiGallery } from './ehentai.js';
import { searchJmcomic, fetchJmcomicSources, fetchJmcomicAlbum } from './jmcomic.js';

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

    if (request.method === "OPTIONS") {
      return createResponse(null, request, {
        headers: {
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    // --- E-Hentai ---
    if (url.pathname === '/api/ehentai/search') {
      const q = url.searchParams.get('q');
      if (!q) {
        return createResponse(JSON.stringify({ results: [] }), request, {
          headers: { "Content-Type": "application/json" }
        });
      }
      try {
        const results = await searchEhentai(q);
        return createResponse(JSON.stringify({ results }), request, {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return createResponse(JSON.stringify({ results: [], error: e.message }), request, {
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    if (url.pathname === '/api/ehentai/gallery') {
      const gid = parseInt(url.searchParams.get('gid'), 10);
      const token = url.searchParams.get('token');

      if (isNaN(gid) || !gid || !token) {
        return createResponse(JSON.stringify({ error: "Invalid or missing gid/token" }), request, { status: 400, headers: { "Content-Type": "application/json" } });
      }

      try {
        const gallery = await fetchEhentaiGallery(gid, token);
        return createResponse(JSON.stringify({ gallery }), request, {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return createResponse(JSON.stringify({ error: e.message }), request, {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // --- JMComic ---
    if (url.pathname === '/api/jmcomic/search') {
      const q = url.searchParams.get('q');
      if (!q) {
        return createResponse(JSON.stringify({ results: [] }), request, {
          headers: { "Content-Type": "application/json" }
        });
      }
      try {
        const results = await searchJmcomic(q);
        return createResponse(JSON.stringify({ results }), request, {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return createResponse(JSON.stringify({ results: [], error: e.message }), request, {
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    if (url.pathname === '/api/jmcomic/sources') {
      try {
        const sources = await fetchJmcomicSources();
        return createResponse(JSON.stringify({ sources }), request, {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return createResponse(JSON.stringify({ error: e.message }), request, {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    if (url.pathname.startsWith('/api/jmcomic/')) {
      const jmId = url.pathname.split('/').filter(Boolean).pop();
      if (!jmId || !/^\d+$/.test(jmId)) return createResponse('Bad Request', request, { status: 400 });

      try {
        const album = await fetchJmcomicAlbum(jmId);
        return createResponse(JSON.stringify({ code: 200, data: album }), request, {
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return createResponse(JSON.stringify({
          code: 502,
          message: `Fetch Error: ${e.message}`
        }), request, { 
          status: 502, 
          headers: { "Content-Type": "application/json" } 
        });
      }
    }

    return createResponse("Not Found", request, { status: 404, headers: { "Content-Type": "text/plain" } });
  }
};
