/**
 * transfer.js — Cross-platform fuzzy search module (换乘模块)
 * 
 * Searches sibling platforms based on a comic's title/author.
 */
import { searchEhentai } from './ehentai.js';

const genericSearch = async (endpoint, query) => {
  if (!query) return [];
  try {
    const res = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).slice(0, 8);
  } catch (err) {
    console.warn(`Search failed on ${endpoint}:`, err);
    return [];
  }
};

const searchNhentai = async (query) => {
  if (!query) return [];
  return [{
    id: query,
    _i18nKey: 'transfer.search_in_nhentai',
    _i18nParams: { query },
    title: query,
    author: 'nHentai',
    url: `https://nhentai.net/search/?q=${encodeURIComponent(query)}`,
    thumbnail: ''
  }];
};

/**
 * Get available transfer targets based on the source platform.
 * @param {'jm'|'eh'} sourcePlatform
 * @returns {Array<{id: string, labelKey: string, icon: string, searchFn: Function}>}
 */
export function getTransferTargets(sourcePlatform) {
  if (sourcePlatform === 'jm') {
    return [
      { id: 'eh', labelKey: 'platform.eh', icon: 'fa-solid fa-paw', searchFn: searchEhentai },
      { id: 'nhentai', labelKey: 'platform.nhentai', icon: 'fa-solid fa-n', searchFn: searchNhentai },
      { id: 'picacg', labelKey: 'platform.picacg', icon: 'fa-solid fa-pepper-hot', searchFn: async () => [] },
    ];
  } else if (sourcePlatform === 'eh') {
    return [
      { id: 'jm', labelKey: 'platform.jm', icon: 'fa-solid fa-book-open', searchFn: (q) => genericSearch('/api/jmcomic/search', q) },
      { id: 'nhentai', labelKey: 'platform.nhentai', icon: 'fa-solid fa-n', searchFn: searchNhentai },
      { id: 'picacg', labelKey: 'platform.picacg', icon: 'fa-solid fa-pepper-hot', searchFn: async () => [] },
    ];
  }
  return [];
}
