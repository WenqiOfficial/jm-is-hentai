import {
  FALLBACK_API_SOURCES,
  getTokenWithTokenparam,
  decodeJsonData,
  fetchLatestApiSources
} from '../shared/crypto.js';

const buildJMHeaders = (token, tokenparam) => {
  const headers = new Headers();
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
  headers.set('Accept', 'application/json');
  headers.set('token', token);
  headers.set('tokenparam', tokenparam);
  headers.set('Accept-Encoding', 'gzip, deflate');
  return headers;
};

export async function searchJmcomic(q) {
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

          return results;
        } catch (e) {
          lastError = e;
        }
      }
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error('All domains failed');
}

export async function fetchJmcomicSources() {
  return await fetchLatestApiSources() || FALLBACK_API_SOURCES;
}

export async function fetchJmcomicAlbum(jmId) {
  const sources = await fetchLatestApiSources() || FALLBACK_API_SOURCES;
  const timestamp = Math.floor(Date.now() / 1000);
  const { token, tokenparam } = getTokenWithTokenparam(timestamp);
  const jmHeaders = buildJMHeaders(token, tokenparam);

  let lastError = null;

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
            album._source_domain = domain;
            return album;
          }
        } catch(e) {
            lastError = e;
        }
      }
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error('All domains failed');
}
