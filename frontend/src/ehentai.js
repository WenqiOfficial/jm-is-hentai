import { I18nError } from './i18n.js';

/**
 * Search E-Hentai via Worker proxy.
 * @param {string} query - Search keyword (comic title)
 * @returns {Promise<Array<{title: string, url: string, thumbnail: string}>>}
 */
export async function searchEhentai(query) {
  if (!query) return [];
  try {
    const res = await fetch(`/api/ehentai/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).slice(0, 8);
  } catch (err) {
    console.warn('E-Hentai search failed:', err);
    return [];
  }
}

/**
 * Fetch detailed gallery info from E-Hentai.
 * @param {string} gid 
 * @param {string} token 
 * @returns {Promise<Object>}
 */
export async function fetchEhentaiGallery(gid, token) {
  if (!gid || !token) return null;
  try {
    const res = await fetch(`/api/ehentai/gallery?gid=${gid}&token=${token}`);
    if (!res.ok) throw new I18nError('error.gallery_api');
    const data = await res.json();
    return data.gallery || null;
  } catch (err) {
    console.warn('E-Hentai gallery fetch failed:', err);
    return null;
  }
}
