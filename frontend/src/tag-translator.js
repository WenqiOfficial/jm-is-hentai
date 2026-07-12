import { showToast } from './toast.js';
import { t } from './i18n.js';

const DB_URL = 'https://cdn.jsdelivr.net/gh/EhTagTranslation/DatabaseReleases/db.text.json';
const GITHUB_API = 'https://api.github.com/repos/EhTagTranslation/Database/releases/latest';

// In-memory flattened cache: {'artist:mizuryu kei': '水龙敬'}
let tagCache = null; 
let isDownloading = false;
let t2sConverter = null;
let dbInstance = null;

/**
 * Get or create singleton IndexedDB connection.
 */
function getDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('EhTagDB', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('tags')) {
        db.createObjectStore('tags');
      }
    };
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
    request.onerror = () => reject(request.error);
  });
}

async function getDBItem(key) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tags', 'readonly');
    const store = tx.objectStore('tags');
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function setDBItem(key, value) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tags', 'readwrite');
    const store = tx.objectStore('tags');
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get or lazily initialize the OpenCC Traditional-to-Simplified converter.
 * Extracted to eliminate duplicated initialization logic.
 * @returns {Function|null}
 */
function getT2SConverter() {
  if (t2sConverter) return t2sConverter;
  if (!window.OpenCC) return null;
  try {
    t2sConverter = window.OpenCC.Converter({ from: 'tw', to: 'cn' });
    return t2sConverter;
  } catch (e) {
    console.warn('OpenCC converter init failed:', e);
    return null;
  }
}

/**
 * Core function to download, parse, and save the database.
 * @param {boolean} isBackground - If true, it updates silently without blocking UI toasts.
 * @param {string} targetVersion - The github release version tag to persist.
 */
async function fetchAndCacheDB(isBackground = false, targetVersion = null) {
  if (isDownloading) return;
  isDownloading = true;

  try {
    if (!isBackground) {
      showToast(t('toast.updating'), 'info', 5000);
    }
    
    const response = await fetch(DB_URL);
    if (!response.ok) throw new Error('Failed to fetch tag database');
    
    const json = await response.json();
    
    // Flatten the database bidirectionally
    const en2zh = {};
    const zh2en = {};
    if (json && json.data) {
      for (const nsObj of json.data) {
        const namespace = nsObj.namespace;
        for (const [tagKey, tagVal] of Object.entries(nsObj.data)) {
          // English -> Chinese
          en2zh[`${namespace}:${tagKey}`] = tagVal.name;
          if (!en2zh[tagKey]) {
            en2zh[tagKey] = tagVal.name;
          }
          // Chinese -> English (Reverse mapping)
          if (!zh2en[tagVal.name]) {
            zh2en[tagVal.name] = tagKey;
          }
        }
      }
    }

    const combinedCache = { en2zh, zh2en };

    // Save to IndexedDB
    await setDBItem('flattened_tags_v2', combinedCache);
    await setDBItem('last_update', Date.now());
    await setDBItem('version', targetVersion || json.version || Date.now());
    
    tagCache = combinedCache;
    if (!isBackground) {
      showToast(t('toast.update_success'), 'success');
    }

  } catch (err) {
    console.error('EhTagTranslation load error:', err);
    if (!isBackground) {
      showToast(t('toast.update_fail') + ': ' + err.message, 'error');
    }
  } finally {
    isDownloading = false;
  }
}

/**
 * Loads the EhTagTranslation Database from cache or network.
 */
export async function loadTagTranslations() {
  // If already loaded in memory
  if (tagCache) return;
  
  // Check if we have it in IndexedDB
  try {
    const cachedData = await getDBItem('flattened_tags_v2');
    if (cachedData && cachedData.en2zh && cachedData.zh2en) {
      tagCache = cachedData;
      
      // Check for updates in background (older than 3 days)
      const lastUpdate = await getDBItem('last_update');
      const now = Date.now();
      const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
      
      if (!lastUpdate || (now - lastUpdate) > THREE_DAYS) {
        // Trigger background update silently
        checkAndUpdateTags(false);
      }
      return;
    }
  } catch (err) {
    console.warn('IndexedDB read error, falling back to network', err);
  }

  // Need to download initially
  await checkAndUpdateTags(false);
}

/**
 * Checks GitHub for the latest tag translation database version and updates if needed.
 * @param {boolean} manual - Whether the check was triggered manually by the user
 */
export async function checkAndUpdateTags(manual = false) {
  if (isDownloading) return;
  
  if (manual) {
    showToast(t('toast.checking_update'), 'info');
  }

  try {
    const res = await fetch(GITHUB_API);
    if (!res.ok) throw new Error('Failed to fetch GitHub version');
    const data = await res.json();
    const latestVersion = data.tag_name;

    const currentVersion = await getDBItem('version');

    if (currentVersion === latestVersion) {
      if (manual) {
        showToast(t('toast.up_to_date'), 'success');
      }
      // Still update the last_update time so it doesn't check every refresh
      await setDBItem('last_update', Date.now());
      return;
    }

    // Needs update
    await fetchAndCacheDB(!manual, latestVersion);

  } catch (err) {
    console.error('Update check failed:', err);
    if (manual) {
      showToast(t('toast.update_fail'), 'error');
    }
  }
}

/**
 * Translate a tag. Returns the stripped original tag if translation is not found or language is not 'zh'.
 * @param {string} tag - The original tag (can include namespace e.g. "artist:mizuryu kei")
 * @param {string} lang - The current language ('zh', 'en', 'ja')
 */
export function translateTag(tag, lang) {
  if (!tag) return tag;
  const query = tag.toLowerCase().trim();
  const bareTag = query.includes(':') ? query.split(':').slice(1).join(':').trim() : query;

  if (!tagCache) {
    return bareTag;
  }
  
  if (lang === 'zh') {
    // English -> Chinese
    const dict = tagCache.en2zh;
    if (dict) {
      if (dict[query]) return dict[query];
      if (dict[bareTag]) return dict[bareTag];
    }
    // If it's already Chinese (exists in zh2en keys), keep it
    if (tagCache.zh2en && tagCache.zh2en[tag.trim()]) {
      return tag.trim();
    }
    
    // Attempt Traditional to Simplified conversion for lookup
    const converter = getT2SConverter();
    if (converter && tagCache.zh2en) {
      const simplifiedTag = converter(tag.trim());
      if (tagCache.zh2en[simplifiedTag]) return tag.trim();
    }
    
    return bareTag;
  } else {
    // Chinese -> English (or Japanese fallback to English)
    const dict = tagCache.zh2en;
    if (dict) {
      if (dict[tag.trim()]) return dict[tag.trim()];
      
      // Attempt Traditional to Simplified conversion for lookup
      const converter = getT2SConverter();
      if (converter) {
        const simplifiedTag = converter(tag.trim());
        if (dict[simplifiedTag]) return dict[simplifiedTag];
      }
    }
    // If it's already English (exists in en2zh keys), return stripped
    if (tagCache.en2zh && tagCache.en2zh[bareTag]) {
      return bareTag;
    }
    return bareTag;
  }
}
