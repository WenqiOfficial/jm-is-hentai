import { showToast } from './toast.js';
import { t } from './i18n.js';

const DB_URL = 'https://cdn.jsdelivr.net/gh/EhTagTranslation/DatabaseReleases/db.text.json';
const GITHUB_API = 'https://api.github.com/repos/EhTagTranslation/Database/releases/latest';
const CACHE_VERSION_KEY = 'ehtt_version';

// In-memory flattened cache: {'artist:mizuryu kei': '水龙敬'}
let tagCache = null; 
let isDownloading = false;

/**
 * Open or create IndexedDB
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('EhTagDB', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('tags')) {
        db.createObjectStore('tags');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get item from IndexedDB
 */
async function getDBItem(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tags', 'readonly');
    const store = tx.objectStore('tags');
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Set item in IndexedDB
 */
async function setDBItem(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tags', 'readwrite');
    const store = tx.objectStore('tags');
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
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
    
    // Flatten the database
    const flatDict = {};
    if (json && json.data) {
      for (const nsObj of json.data) {
        const namespace = nsObj.namespace;
        for (const [tagKey, tagVal] of Object.entries(nsObj.data)) {
          // Format: 'namespace:tagname' (e.g. 'artist:mizuryu kei')
          flatDict[`${namespace}:${tagKey}`] = tagVal.name;
          if (!flatDict[tagKey]) {
            flatDict[tagKey] = tagVal.name;
          }
        }
      }
    }

    // Save to IndexedDB
    await setDBItem('flattened_tags', flatDict);
    await setDBItem('last_update', Date.now());
    await setDBItem('version', targetVersion || json.version || Date.now());
    
    tagCache = flatDict;
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
    const cachedData = await getDBItem('flattened_tags');
    if (cachedData) {
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
  const query = tag.toLowerCase().trim();
  const bareTag = query.includes(':') ? query.split(':').slice(1).join(':').trim() : query;

  if (lang !== 'zh' || !tagCache) {
    return bareTag; // Return original English/Romaji stripped of namespace
  }
  
  // Direct match
  if (tagCache[query]) {
    return tagCache[query];
  }

  // If the query contains a namespace but the exact match failed, try stripping namespace
  if (tagCache[bareTag]) {
    return tagCache[bareTag];
  }

  return bareTag;
}
