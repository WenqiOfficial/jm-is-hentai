import { t, I18nError, setI18nText } from './i18n.js';
import { getTransferTargets } from './transfer.js';
import { transitionManager } from './utils.js';
import { jellyObserver, syncJellyTracker } from './ui/jelly-tracker.js';

export function initTransferPanel() {
  const smoothStateSwitch = transitionManager.smoothStateSwitch.bind(transitionManager);

  const transferArea = document.getElementById('transfer-area');
  const transferTabs = document.getElementById('transfer-tabs');
  const transferResults = document.getElementById('transfer-results');
  const transferLoading = document.getElementById('transfer-loading');
  const transferEmpty = document.getElementById('transfer-empty');
  const transferError = document.getElementById('transfer-error');
  const transferErrorMsg = document.getElementById('transfer-error-msg');
  const transferComingSoon = document.getElementById('transfer-coming-soon');
  const transferCard = document.getElementById('transfer-card');
  const transferKeywordInput = document.getElementById('transfer-keyword-input');
  const transferSearchBtn = document.getElementById('transfer-search-btn');
  const transferContent = document.getElementById('transfer-content');

  let transferTargets = [];
  let activeTransferTab = null;
  let transferCache = {};

  function extractSearchCandidates(title) {
    if (!title) return [];
    const stripped = title.replace(/\[[^\]]*\]|\([^)]*\)|【[^】]*】|（[^）]*）|<[^>]*>/g, '|||');
    let candidates = stripped.split('|||')
      .map(s => s.replace(/^[\]\)】）>]+|[\[\(【（<]+$/g, '').trim())
      .filter(s => s.length > 0);
    
    const finalCandidates = [];
    candidates.forEach(c => {
      if (c.includes('|')) {
        const parts = c.split('|').map(s => s.trim()).filter(s => s.length > 0);
        finalCandidates.push(...parts.reverse());
      } else {
        finalCandidates.push(c);
      }
    });

    return finalCandidates.length > 0 ? finalCandidates : [title];
  }

  async function triggerTransfer(album, sourcePlatform) {
    transferTargets = getTransferTargets(sourcePlatform);
    transferCache = {};
    activeTransferTab = null;

    if (transferTargets.length === 0) {
      transferArea.style.display = 'none';
      return;
    }

    let candidatesMap = {};
    let fallbackTitle = '';

    if (sourcePlatform === 'eh') {
      const jmCandidates = extractSearchCandidates(album.title_jpn || album.title);
      const nhentaiCandidates = extractSearchCandidates(album.title || album.title_jpn);
      candidatesMap = {
        'jm': jmCandidates,
        'nhentai': nhentaiCandidates,
        'picacg': jmCandidates
      };
      fallbackTitle = album.title_jpn || album.title || '';
    } else {
      const defaultCandidates = extractSearchCandidates(album.name || '');
      candidatesMap = {
        'eh': defaultCandidates,
        'nhentai': defaultCandidates,
        'picacg': defaultCandidates
      };
      fallbackTitle = album.name || '';
    }

    const firstTargetCandidates = candidatesMap[transferTargets[0].id] || [];
    transferKeywordInput.value = firstTargetCandidates[0] || fallbackTitle;

    transferTabs.innerHTML = '<div class="jelly-tracker"></div>';
    transferTargets.forEach((target, idx) => {
      const btn = document.createElement('button');
      const targetCandidates = candidatesMap[target.id] || [];
      btn.className = 'transfer-tab' + (idx === 0 ? ' active' : '');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
      btn.innerHTML = `<i class="${target.icon}"></i> <span data-i18n="${target.labelKey}">${t(target.labelKey)}</span>`;
      btn.addEventListener('click', () => switchTransferTab(target.id, targetCandidates));
      transferTabs.appendChild(btn);
    });
    
    jellyObserver.observe(transferTabs);
    requestAnimationFrame(() => requestAnimationFrame(() => syncJellyTracker(transferTabs)));

    const revealTransferPanel = () => {
      transferArea.style.display = 'flex';
      switchTransferTab(transferTargets[0].id, firstTargetCandidates);
    };

    if (transferArea.style.display === 'none') {
      if (document.startViewTransition) {
        document.startViewTransition(() => revealTransferPanel());
      } else {
        revealTransferPanel();
      }
    } else {
      revealTransferPanel();
    }
  }

  let currentTransferSearchId = 0;
  async function handleTransferSearch() {
    if (!activeTransferTab) return;
    const keyword = transferKeywordInput.value.trim();
    if (!keyword) return;
    
    const searchId = ++currentTransferSearchId;

    try {
      const tabId = activeTransferTab;
      activeTransferTab = null;
      await switchTransferTab(tabId, [keyword]);
    } catch (err) {
      if (searchId !== currentTransferSearchId) return;
      console.error(err);
    }
  }

  transferSearchBtn.addEventListener('click', handleTransferSearch);
  transferKeywordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleTransferSearch();
  });

  async function switchTransferTab(tabId, candidatesOrKeyword) {
    const candidates = Array.isArray(candidatesOrKeyword) ? [...candidatesOrKeyword] : [candidatesOrKeyword];
    if (candidates.length === 0) return;

    if (activeTransferTab === tabId) return;
    activeTransferTab = tabId;

    let activeBtn = null;
    transferTabs.querySelectorAll('.transfer-tab').forEach((btn, idx) => {
      const isActive = transferTargets[idx].id === tabId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (isActive) activeBtn = btn;
    });

    if (activeBtn) {
      syncJellyTracker(transferTabs);
    }

    const target = transferTargets.find(t => t.id === tabId);
    if (!target) return;

    const ALL_STATES = [transferLoading, transferEmpty, transferError, transferComingSoon, transferResults];

    if (tabId === 'picacg') {
      smoothStateSwitch(transferContent, ALL_STATES, transferComingSoon, 'flex');
      return;
    }

    for (let i = 0; i < candidates.length; i++) {
      const comicTitle = candidates[i];
      transferKeywordInput.value = comicTitle;
      
      const cacheKey = `${tabId}_${comicTitle}`;

      if (transferCache[cacheKey]) {
        const results = transferCache[cacheKey];
        if (results.length > 0 || i === candidates.length - 1) {
          renderTransferResults(results, tabId);
          return;
        }
        continue;
      }

      await smoothStateSwitch(transferContent, ALL_STATES, transferLoading, 'flex');

      let lastError = null;
      try {
        const results = await target.searchFn(comicTitle);
        transferCache[cacheKey] = results;

        if (activeTransferTab !== tabId) return;

        if (results && results.length > 0) {
          renderTransferResults(results, tabId);
          return;
        }
      } catch (err) {
        console.warn('Transfer search error:', err);
        lastError = err;
      }

      if (i < candidates.length - 1) {
        if (lastError) {
          if (lastError instanceof I18nError) {
            setI18nText(transferErrorMsg, lastError.i18nKey, lastError.i18nParams);
          } else {
            transferErrorMsg.removeAttribute('data-i18n');
            transferErrorMsg.removeAttribute('data-i18n-params');
            transferErrorMsg.textContent = lastError.message || lastError;
          }
          await smoothStateSwitch(transferContent, ALL_STATES, transferError, 'flex');
        } else {
          setI18nText(transferEmpty.querySelector('p'), 'alert.auto_empty');
          await smoothStateSwitch(transferContent, ALL_STATES, transferEmpty, 'flex');
        }
        
        if (activeTransferTab !== tabId) return;
        
        await new Promise(r => setTimeout(r, 1200));
        
        if (activeTransferTab !== tabId) return;
      } else {
        if (lastError) {
          if (lastError instanceof I18nError) {
            setI18nText(transferErrorMsg, lastError.i18nKey, lastError.i18nParams);
          } else {
            transferErrorMsg.removeAttribute('data-i18n');
            transferErrorMsg.removeAttribute('data-i18n-params');
            transferErrorMsg.textContent = lastError.message || lastError;
          }
          await smoothStateSwitch(transferContent, ALL_STATES, transferError, 'flex');
          return;
        }
      }
    }
    
    if (activeTransferTab === tabId) {
      setI18nText(transferEmpty.querySelector('p'), 'transfer.empty');
      smoothStateSwitch(transferContent, ALL_STATES, transferEmpty, 'flex');
    }
  }

  async function renderTransferResults(results, tabId) {
    const ALL_STATES = [transferLoading, transferEmpty, transferError, transferComingSoon, transferResults];
    
    if (transferResults.style.display !== 'none' && transferResults.classList.contains('fade-in')) {
      transferContent.style.height = transferContent.offsetHeight + 'px';
      transferContent.style.overflow = 'hidden';

      transferResults.classList.remove('fade-in');
      await new Promise(r => setTimeout(r, 200));
      if (activeTransferTab !== tabId) {
        transferContent.style.height = '';
        transferContent.style.overflow = '';
        return;
      }
    }

    transferResults.innerHTML = '';

    if (!results || results.length === 0) {
      smoothStateSwitch(transferContent, ALL_STATES, transferEmpty, 'flex');
      return;
    }

    results.forEach((item, index) => {
      const a = document.createElement('a');
      a.className = 'transfer-result-item';
      a.href = item.url || '#';
      a.target = '_blank';
      a.rel = 'noopener';
      a.style.animationDelay = `${index * 0.06}s`;

      if (item.thumbnail) {
        const thumb = document.createElement('img');
        thumb.className = 'transfer-result-thumb';
        thumb.src = item.thumbnail;
        const proxyUrl = `https://img.1224630.xyz/?url=${encodeURIComponent(item.thumbnail)}`;
        thumb.onerror = () => {
          if (thumb.src !== proxyUrl) {
            thumb.src = proxyUrl;
          }
        };
        thumb.alt = '';
        thumb.loading = 'lazy';
        a.appendChild(thumb);
      }

      const info = document.createElement('div');
      info.className = 'transfer-result-info';
      const title = document.createElement('div');
      title.className = 'transfer-result-title';
      if (item._i18nKey) {
        setI18nText(title, item._i18nKey, item._i18nParams);
      } else if (item.title || item.name) {
        title.textContent = item.title || item.name;
        title.removeAttribute('data-i18n');
        title.removeAttribute('data-i18n-params');
      } else {
        setI18nText(title, 'comic.untitled');
      }
      info.appendChild(title);
      a.appendChild(info);

      const arrow = document.createElement('i');
      arrow.className = 'fa-solid fa-chevron-right transfer-result-arrow';
      a.appendChild(arrow);

      transferResults.appendChild(a);
    });

    smoothStateSwitch(transferContent, ALL_STATES, transferResults, 'flex');
  }

  // Allow clearing cache on language change
  window.addEventListener('languageChanged', () => {
    transferCache = {};
  });

  return { triggerTransfer };
}
