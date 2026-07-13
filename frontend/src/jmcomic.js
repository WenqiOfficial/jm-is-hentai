import {
  FALLBACK_API_SOURCES,
  getTokenWithTokenparam,
  decodeJsonData,
  fetchLatestApiSources
} from '../../shared/crypto.js';
import { t, I18nError } from './i18n.js';

// Re-export for any consumers that import from here
export { FALLBACK_API_SOURCES };

/**
 * Fetch Album Info
 * mode: 'api' (use Worker Proxy) | 'frontend' (direct fetch)
 */
export async function fetchAlbumInfo(jmId, mode = 'api') {
  if (mode === 'api') {
    // Via Cloudflare Worker proxy
    const response = await fetch(`/api/jmcomic/${jmId}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    if (!response.ok) {
      throw new I18nError('error.proxy_failed', { status: response.status });
    }
    const resText = await response.text();
    let resJson;
    try {
      resJson = JSON.parse(resText);
    } catch (e) {
      console.error('Proxy response parse error:', resText.substring(0, 100));
      throw new I18nError('error.proxy_not_json');
    }
    
    if (resJson.code !== 200) throw new I18nError('error.fetch_failed', { message: resJson.message || resJson.code });
    return resJson.data; // Worker returns decrypted plain JSON data directly
  } else {
    // Direct frontend fetch (Requires CORS extension)
    const ts = Math.floor(Date.now() / 1000);
    const { token, tokenparam } = getTokenWithTokenparam(ts);
    
    let lastError = null;
    const sources = await fetchLatestApiSources() || FALLBACK_API_SOURCES;
    
    for (const domain of sources) {
      try {
        const response = await fetch(`https://${domain}/album?id=${jmId}`, {
          headers: {
            'token': token,
            'tokenparam': tokenparam,
            'Accept': 'application/json'
          }
        });
        if (response.ok) {
          const resJson = await response.json();
          if (resJson.code === 200 && resJson.data) {
            const decoded = decodeJsonData(resJson.data, ts);
            decoded._source_domain = domain;
            return decoded;
          }
        }
      } catch (err) {
        lastError = err;
        continue;
      }
    }
    if (lastError) throw new I18nError('error.direct_fetch_failed', { message: lastError.message });
    throw new I18nError('error.all_domains_failed');
  }
}
