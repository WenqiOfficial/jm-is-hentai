/**
 * transfer.js — Cross-platform fuzzy search module (换乘模块)
 * 
 * Searches sibling platforms based on a comic's title/author.
 */

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
      { id: 'eh', label: 'E-Hentai', icon: 'fa-solid fa-paw', searchFn: searchEhentai },
      { id: 'picacg', label: '哔咔漫画', icon: 'fa-solid fa-pepper-hot', searchFn: searchPicacg },
    ];
  } else if (sourcePlatform === 'eh') {
    return [
      { id: 'jm', label: 'JMComic', icon: 'fa-solid fa-book-open', searchFn: searchJmcomic },
      { id: 'picacg', label: '哔咔漫画', icon: 'fa-solid fa-pepper-hot', searchFn: searchPicacg },
    ];
  }
  return [];
}
