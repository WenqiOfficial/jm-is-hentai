/**
 * transfer.js — Cross-platform fuzzy search module (换乘模块)
 * 
 * Searches sibling platforms based on a comic's title/author.
 */
import { t, I18nError } from './i18n.js';

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

/**
 * Search JMComic via Worker proxy (for reverse lookup from E-Hentai).
 * @param {string} query - Search keyword (comic title)
 * @returns {Promise<Array<{id: number, title: string, author: string, url: string}>>}
 */
export async function searchJmcomic(query) {
  if (!query) return [];
  try {
    const res = await fetch(`/api/jmcomic/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).slice(0, 8);
  } catch (err) {
    console.warn('JMComic search failed:', err);
    return [];
  }
}

/**
 * Direct link fallback for nHentai search due to strict Cloudflare protection.
 * @param {string} query 
 * @returns {Promise<Array>}
 */
export async function searchNhentai(query) {
  if (!query) return [];
  // Return a synthetic result that acts as a direct link button
  return [
    {
      id: query,
      title: t('transfer.search_in_nhentai', { query }),
      author: 'nHentai',
      url: `https://nhentai.net/search/?q=${encodeURIComponent(query)}`,
      thumbnail: ''
    }
  ];
}

/**
 * Placeholder for PicACG (哔咔漫画) search — not yet implemented.
 * @returns {Promise<Array>}
 */
export async function searchPicacg(_query) {
  // Placeholder — 即将支持
  return [];
}

/**
 * Get available transfer targets based on the source platform.
 * @param {'jm'|'eh'} sourcePlatform
 * @returns {Array<{id: string, label: string, icon: string, searchFn: Function}>}
 */
export function getTransferTargets(sourcePlatform) {
  if (sourcePlatform === 'jm') {
    return [
      { id: 'eh', labelKey: 'platform.eh', icon: 'fa-solid fa-paw', searchFn: searchEhentai },
      { id: 'nhentai', labelKey: 'platform.nhentai', icon: 'fa-solid fa-n', searchFn: searchNhentai },
      { id: 'picacg', labelKey: 'platform.picacg', icon: 'fa-solid fa-pepper-hot', searchFn: searchPicacg },
    ];
  } else if (sourcePlatform === 'eh') {
    return [
      { id: 'jm', labelKey: 'platform.jm', icon: 'fa-solid fa-book-open', searchFn: searchJmcomic },
      { id: 'nhentai', labelKey: 'platform.nhentai', icon: 'fa-solid fa-n', searchFn: searchNhentai },
      { id: 'picacg', labelKey: 'platform.picacg', icon: 'fa-solid fa-pepper-hot', searchFn: searchPicacg },
    ];
  }
  return [];
}
