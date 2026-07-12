import { fetchAlbumInfo } from './jmcomic.js';
import { WebGLBackground } from './webgl-background.js';
import { getTransferTargets, searchEhentai, fetchEhentaiGallery } from './transfer.js';
import { initI18n, t, getCurrentLang } from './i18n.js';
import { translateTag, checkAndUpdateTags } from './tag-translator.js';

document.addEventListener('DOMContentLoaded', () => {
  initI18n();
  // === DOM References ===
  const input = document.getElementById('jm-id-input');
  const searchBtn = document.getElementById('search-btn');
  const visualContent = document.getElementById('visual-content');
  const resultContainer = document.getElementById('result-container');
  const loadingIndicator = document.getElementById('loading-indicator');
  const errorMsg = document.getElementById('error-msg');
  const comicInfo = document.getElementById('comic-info');

  const comicTitle = document.getElementById('comic-title');
  const comicAuthor = document.getElementById('comic-author');
  const comicTags = document.getElementById('comic-tags');
  const jmLink = document.getElementById('jm-link');

  // ============================================
  //  Fade Transition Helpers
  //  Replaces hard display:none switching with
  //  smooth opacity + translateY transitions.
  // ============================================

  /**
   * Smoothly show an element with fade + slide-up.
   * @param {HTMLElement} el  - The element to show
   * @param {string} display  - CSS display value (default 'block')
   */
  function fadeIn(el, display = 'block') {
    // Cancel any pending hide timeout
    if (el._fadeTimer) {
      clearTimeout(el._fadeTimer);
      el._fadeTimer = null;
    }
    el.style.display = display;
    // Force reflow so browser registers the display change
    void el.offsetHeight;
    el.classList.add('fade-in');
  }

  /**
   * Smoothly hide an element with fade + slide-down,
   * then set display:none after the transition completes.
   * @param {HTMLElement} el - The element to hide
   */
  function fadeOut(el) {
    if (el.style.display === 'none') return;
    el.classList.remove('fade-in');
    el._fadeTimer = setTimeout(() => {
      if (!el.classList.contains('fade-in')) {
        el.style.display = 'none';
      }
    }, 450);
  }

  /**
   * Smoothly transitions container height while crossfading child elements.
   * @param {HTMLElement} container - The wrapper element whose height will be morphed.
   * @param {HTMLElement[]} outgoingElements - Elements to fade out and hide.
   * @param {HTMLElement} incomingElement - The new element to show.
   * @param {string} displayMode - The display type for incoming element (default 'block').
   */
  async function smoothStateSwitch(container, outgoingElements, incomingElement, displayMode = 'block') {
    if (!container) return;
    
    // 1. Lock current height
    const currentHeight = container.offsetHeight;
    container.style.height = currentHeight + 'px';
    container.style.overflow = 'hidden';
    container.style.transition = 'height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';

    // 2. Fade out old elements
    let hasOutgoing = false;
    outgoingElements.forEach(el => {
      if (el && el.style.display !== 'none' && el.classList.contains('fade-in')) {
        el.classList.remove('fade-in');
        hasOutgoing = true;
      }
    });

    if (hasOutgoing) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 3. Hide old elements
    outgoingElements.forEach(el => {
      if (el) el.style.display = 'none';
    });
    
    let targetHeight = 0;
    if (incomingElement) {
      // Show incoming element invisibly to measure its height
      incomingElement.style.display = displayMode;
      incomingElement.style.opacity = '0';
      incomingElement.style.position = 'absolute';
      incomingElement.style.width = '100%';
      
      targetHeight = incomingElement.offsetHeight;
      
      incomingElement.style.position = '';
      incomingElement.style.opacity = '';
      incomingElement.style.width = '';
    }

    // 4. Animate container height to target
    container.style.height = targetHeight + 'px';

    if (incomingElement) {
      // Force reflow and fade in
      void incomingElement.offsetWidth;
      incomingElement.classList.add('fade-in');
    }

    // 5. Cleanup after transition completes
    setTimeout(() => {
      container.style.height = '';
      container.style.overflow = '';
      container.style.transition = '';
    }, 400);
  }

  // ============================================
  //  WebGL Background
  // ============================================

  const bgContainer = document.getElementById('bg-container');
  let webglBg = null;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!prefersReducedMotion) {
    webglBg = new WebGLBackground(bgContainer);
    if (!webglBg.initialized) {
      webglBg = null; // CSS fallback gradient stays visible
    }
  }

  // ============================================
  //  Settings Menu
  // ============================================

  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const dataSourceRadios = document.getElementsByName('datasource');

  let fetchMode = localStorage.getItem('datasource') || 'api';

  // Initialize radio state
  dataSourceRadios.forEach((radio) => {
    if (radio.value === fetchMode) radio.checked = true;
    radio.addEventListener('change', (e) => {
      fetchMode = e.target.value;
      localStorage.setItem('datasource', fetchMode);
    });
  });

  // Toggle with smooth CSS transition (opacity/visibility/transform)
  settingsBtn.addEventListener('click', () => {
    const isHidden = settingsPanel.classList.contains('is-hidden');
    settingsPanel.classList.toggle('is-hidden');
    settingsBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!settingsBtn.contains(e.target) && !settingsPanel.contains(e.target)) {
      settingsPanel.classList.add('is-hidden');
      settingsBtn.setAttribute('aria-expanded', 'false');
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !settingsPanel.classList.contains('is-hidden')) {
      settingsPanel.classList.add('is-hidden');
      settingsBtn.setAttribute('aria-expanded', 'false');
      settingsBtn.focus();
    }
  });

  // ============================================
  //  Vibrant.js Color Extraction
  // ============================================

  const updateVisual = (album) => {
    visualContent.innerHTML = '';
    visualContent.classList.remove('placeholder');

    let rawImgUrl;
    if (album._source_domain === 'eh') {
      rawImgUrl = album._thumbnail || 'https://ehgt.org/g/ehgt.png';
    } else {
      const cdnDomain = album._source_domain || 'www.cdnaspa.vip';
      rawImgUrl = `https://${cdnDomain}/media/albums/${album.id}_3x4.jpg`;
    }
    const proxyImgUrl = `https://img.1224630.xyz/?url=${encodeURIComponent(rawImgUrl)}`;

    // 1. Visible Display Image (Direct link, no proxy, no CORS, for fast loading)
    const displayImg = document.createElement('img');
    displayImg.src = rawImgUrl;
    displayImg.alt = album.name || 'Cover';
    
    displayImg.onerror = () => {
      // If direct link fails (e.g., E-Hentai hotlink protection), fallback to proxy for display too
      if (displayImg.src !== proxyImgUrl) {
        displayImg.src = proxyImgUrl;
      } else {
        visualContent.innerHTML = '<span><i class="fa-solid fa-image-slash"></i> 暂无封面</span>';
        visualContent.classList.add('placeholder');
        // Reset colors to defaults
        document.documentElement.style.removeProperty('--primary-color');
        document.documentElement.style.removeProperty('--primary-btn');
        document.documentElement.style.removeProperty('--secondary-color');
        document.documentElement.style.removeProperty('--accent-color');
        if (webglBg) webglBg.resetColors();
      }
    };

    visualContent.appendChild(displayImg);

    // 2. Hidden Proxy Image (CORS enabled, used ONLY for Vibrant.js color extraction)
    if (typeof Vibrant !== 'undefined') {
      const proxyImg = new Image();
      proxyImg.crossOrigin = 'Anonymous';
      proxyImg.src = proxyImgUrl;
      
      proxyImg.onload = () => {
        const vibrant = new Vibrant(proxyImg, { quality: 1 });
        vibrant.getPalette().then(palette => {
          let c1 = [160, 196, 255]; // fallback
          let c2 = [255, 198, 255];
          let c3 = [253, 255, 182];

          c1 = palette.Vibrant ? palette.Vibrant.rgb : c1;
          let btnColor = [...c1]; // Save un-pastelified color for high-contrast buttons

          if (palette.LightVibrant) c2 = palette.LightVibrant.rgb;
          if (palette.Muted) c3 = palette.Muted.rgb;
          else if (palette.DarkVibrant) c3 = palette.DarkVibrant.rgb;

          // Helper to ensure colors are soft and macaron-like (mix with warm white)
          const pastelify = (rgb) => [
            Math.round(rgb[0] * 0.6 + 255 * 0.4),
            Math.round(rgb[1] * 0.6 + 250 * 0.4),
            Math.round(rgb[2] * 0.6 + 240 * 0.4)
          ];

          c1 = pastelify(c1);
          c2 = pastelify(c2);
          c3 = pastelify(c3);

          document.documentElement.style.setProperty('--primary-color', `rgb(${c1.join(',')})`);
          document.documentElement.style.setProperty('--primary-btn', `rgb(${btnColor.join(',')})`);
          document.documentElement.style.setProperty('--secondary-color', `rgb(${c2.join(',')})`);
          document.documentElement.style.setProperty('--accent-color', `rgb(${c3.join(',')})`);

          // WebGL background uses internal lerp for smooth shader color transition
          if (webglBg) {
            webglBg.setColors(c1, c2, c3);
          }
        }).catch(err => {
          console.warn('Vibrant extraction failed:', err);
        });
      };
    }
  };

  // ============================================
  //  Search Logic
  // ============================================

  const handleSearch = async () => {
    const currentPlatform = document.querySelector('input[name="platform"]:checked')?.value || 'jm';
    let query = input.value.trim();

    if (currentPlatform === 'jm') {
      query = query.replace(/\D/g, '');
      if (!query) {
        showError(t('alert.empty_jm'));
        return;
      }
    } else {
      if (!query) {
        showError(t('alert.empty_eh'));
        return;
      }
    }

    // Show result area & loading, hide previous results
    resultContainer.style.display = 'block';
    smoothStateSwitch(resultContainer.querySelector('.result-stack'), [errorMsg, comicInfo], loadingIndicator, 'flex');

    try {
      if (currentPlatform === 'jm') {
        const album = await fetchAlbumInfo(query, fetchMode);

        // Smoothly transition from loading to comic info
        smoothStateSwitch(resultContainer.querySelector('.result-stack'), [loadingIndicator, errorMsg], comicInfo, 'flex');

        // Populate comic info
        comicTitle.textContent = album.name || `JMComic - ${query}`;
        comicAuthor.textContent = `${t('comic.author')}: ${(album.author || []).join(', ') || '未知'}`;

        // Tags with stagger pop animation
        comicTags.innerHTML = '';
        const currentLang = getCurrentLang();
        (album.tags || []).forEach((tag, index) => {
          const span = document.createElement('span');
          span.className = 'tag';
          span.textContent = translateTag(tag, currentLang);
          if (currentLang === 'zh') span.title = tag; // Show original on hover
          span.style.animation = `tagPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 0.05}s both`;
          comicTags.appendChild(span);
        });

        jmLink.href = `https://18comic.vip/album/${query}`;
        jmLink.innerHTML = `<i class="fa-solid fa-book-open"></i> ${t('comic.read_jm')}`;

        updateVisual(album);

        // Trigger transfer panel search
        triggerTransfer(album.name || '', currentPlatform);

      } else if (currentPlatform === 'eh') {
        const results = await searchEhentai(query);
        if (!results || results.length === 0) {
          throw new Error(t('alert.no_eh_gallery'));
        }

        const baseAlbum = results[0];
        
        // Fetch rich metadata using the new E-Hentai gdata API
        const galleryDetails = await fetchEhentaiGallery(baseAlbum.gid, baseAlbum.token);
        const album = galleryDetails || baseAlbum; // Fallback to base album if detail fetch fails
        const tags = album.tags || [];

        // Smoothly transition from loading to comic info
        smoothStateSwitch(resultContainer.querySelector('.result-stack'), [loadingIndicator, errorMsg], comicInfo, 'flex');

        const currentLang = getCurrentLang();
        
        // Extract title (English title is usually title, JPN title is title_jpn if exists)
        comicTitle.textContent = album.title_jpn || album.title || baseAlbum.title || query;
        comicAuthor.textContent = album.uploader ? `${t('comic.uploader')}: ${album.uploader}` : `${t('comic.source')}: E-Hentai`;
        
        // Tags with stagger pop animation
        comicTags.innerHTML = '';
        tags.forEach((tag, index) => {
          const span = document.createElement('span');
          span.className = 'tag';
          // E-Hentai tags often have a namespace prefix like 'artist:xxx'
          span.textContent = translateTag(tag, currentLang);
          if (currentLang === 'zh') span.title = tag; // Show original on hover
          span.style.animation = `tagPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 0.05}s both`;
          comicTags.appendChild(span);
        });

        jmLink.href = baseAlbum.url || '#';
        jmLink.innerHTML = `<i class="fa-solid fa-paw"></i> ${t('comic.read_eh')}`;

        updateVisual({
          id: query,
          name: comicTitle.textContent,
          _source_domain: 'eh',
          _thumbnail: album.thumb || baseAlbum.thumbnail
        });

        triggerTransfer(baseAlbum.title || query, currentPlatform);
      }
    } catch (err) {
      smoothStateSwitch(resultContainer.querySelector('.result-stack'), [loadingIndicator, comicInfo], errorMsg, 'block');
      errorMsg.textContent = err.message;
    }
  };

  const showError = (msg) => {
    resultContainer.style.display = 'block';
    errorMsg.textContent = msg;
    smoothStateSwitch(resultContainer.querySelector('.result-stack'), [loadingIndicator, comicInfo], errorMsg, 'block');
  };

  searchBtn.addEventListener('click', handleSearch);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  });

  // ============================================
  //  Transfer Panel (换乘)
  // ============================================

  const transferArea = document.getElementById('transfer-area');
  const transferTabs = document.getElementById('transfer-tabs');
  const transferResults = document.getElementById('transfer-results');
  const transferLoading = document.getElementById('transfer-loading');
  const transferEmpty = document.getElementById('transfer-empty');
  const transferComingSoon = document.getElementById('transfer-coming-soon');
  const transferCard = document.getElementById('transfer-card');
  const transferKeywordInput = document.getElementById('transfer-keyword-input');
  const transferSearchBtn = document.getElementById('transfer-search-btn');
  const transferContent = document.getElementById('transfer-content');

  let transferTargets = [];
  let activeTransferTab = null;
  // Cache: { tabId_keyword: results[] }
  let transferCache = {};

  /**
   * Splits a complex title into multiple candidate search keywords.
   * e.g., "中文标题 [社团] 日文原名 [翻译]" -> ["中文标题", "日文原名"]
   */
  function extractSearchCandidates(title) {
    if (!title) return [];
    // Accurately match matching bracket pairs to handle nested/adjacent brackets.
    const stripped = title.replace(/\[[^\]]*\]|\([^)]*\)|【[^】]*】|（[^）]*）|<[^>]*>/g, '|||');
    let candidates = stripped.split('|||')
      .map(s => s.replace(/^[\]\)】）>]+|[\[\(【（<]+$/g, '').trim()) // Clean lingering symbols
      .filter(s => s.length > 0);
    
    // Split by `|` (common in E-Hentai titles) and prioritize the right side (usually native/translated title)
    const finalCandidates = [];
    candidates.forEach(c => {
      if (c.includes('|')) {
        const parts = c.split('|').map(s => s.trim()).filter(s => s.length > 0);
        // Reverse so the translated/native title (often on the right) is searched first
        finalCandidates.push(...parts.reverse());
      } else {
        finalCandidates.push(c);
      }
    });

    // Fallback: if no candidates extracted, return the whole title
    return finalCandidates.length > 0 ? finalCandidates : [title];
  }

  async function triggerTransfer(rawTitle, sourcePlatform) {
    const candidates = extractSearchCandidates(rawTitle);
    transferTargets = getTransferTargets(sourcePlatform);
    transferCache = {};
    activeTransferTab = null;

    if (transferTargets.length === 0) {
      transferArea.style.display = 'none';
      return;
    }

    // Initialize search input with the first candidate
    transferKeywordInput.value = candidates[0] || rawTitle;

    // Build tabs
    transferTabs.innerHTML = '';
    transferTargets.forEach((target, idx) => {
      const btn = document.createElement('button');
      btn.className = 'transfer-tab' + (idx === 0 ? ' active' : '');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
      btn.innerHTML = `<i class="${target.icon}"></i> ${target.label}`;
      btn.addEventListener('click', () => switchTransferTab(target.id, candidates));
      transferTabs.appendChild(btn);
    });

    // Function to show the panel and select first tab
    const revealTransferPanel = () => {
      transferArea.style.display = 'flex';
      switchTransferTab(transferTargets[0].id, candidates);
    };

    // Use View Transitions API if supported for a buttery smooth layout reflow
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

  async function handleTransferSearch() {
    if (!activeTransferTab) return;
    const keyword = transferKeywordInput.value.trim();
    if (!keyword) return;
    
    // Force re-search on current tab with exactly the user's input (single candidate)
    const tabId = activeTransferTab;
    activeTransferTab = null; // reset to force re-render
    switchTransferTab(tabId, [keyword]);
  }

  transferSearchBtn.addEventListener('click', handleTransferSearch);
  transferKeywordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleTransferSearch();
  });

  async function switchTransferTab(tabId, candidatesOrKeyword) {
    // Normalize to array
    const candidates = Array.isArray(candidatesOrKeyword) ? [...candidatesOrKeyword] : [candidatesOrKeyword];
    if (candidates.length === 0) return;

    if (activeTransferTab === tabId) return;
    activeTransferTab = tabId;

    // Update tab active state
    transferTabs.querySelectorAll('.transfer-tab').forEach((btn, idx) => {
      const isActive = transferTargets[idx].id === tabId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    const target = transferTargets.find(t => t.id === tabId);
    if (!target) return;

    const ALL_STATES = [transferLoading, transferEmpty, transferComingSoon, transferResults];

    // Check if this is the placeholder (picacg)
    if (tabId === 'picacg') {
      smoothStateSwitch(transferContent, ALL_STATES, transferComingSoon, 'flex');
      return;
    }

    // Try candidates sequentially
    for (let i = 0; i < candidates.length; i++) {
      const comicTitle = candidates[i];
      // Update the input to show what we are currently searching
      transferKeywordInput.value = comicTitle;
      
      const cacheKey = `${tabId}_${comicTitle}`;

      // Check cache
      if (transferCache[cacheKey]) {
        const results = transferCache[cacheKey];
        if (results.length > 0 || i === candidates.length - 1) {
          renderTransferResults(results, tabId);
          return;
        }
        continue; // Try next candidate if cached result is 0
      }

      // Show loading
      await smoothStateSwitch(transferContent, ALL_STATES, transferLoading, 'flex');

      let found = false;
      try {
        const results = await target.searchFn(comicTitle);
        transferCache[cacheKey] = results;

        // If tab changed during async await, abort
        if (activeTransferTab !== tabId) return;

        if (results && results.length > 0) {
          renderTransferResults(results, tabId);
          return; // Success, stop trying candidates
        }
      } catch (err) {
        console.warn('Transfer search error:', err);
      }

      // If we reach here, the search returned 0 results or errored
      if (i < candidates.length - 1) {
        // We have more candidates to try, show a brief message before continuing
        transferEmpty.querySelector('p').textContent = t('alert.auto_empty');
        await smoothStateSwitch(transferContent, ALL_STATES, transferEmpty, 'flex');
        
        if (activeTransferTab !== tabId) return;
        
        // Let the user read the message for 1.2s before the next loop iteration starts
        await new Promise(r => setTimeout(r, 1200));
        
        if (activeTransferTab !== tabId) return;
      }
    }
    
    // If all candidates failed or returned 0 results
    if (activeTransferTab === tabId) {
      transferEmpty.querySelector('p').textContent = t('transfer.empty');
      await smoothStateSwitch(transferContent, ALL_STATES, transferEmpty, 'flex');
    }
  }

  async function renderTransferResults(results, tabId) {
    const ALL_STATES = [transferLoading, transferEmpty, transferComingSoon, transferResults];
    
    // If switching between cached result lists in the same container, fade out first
    if (transferResults.style.display !== 'none' && transferResults.classList.contains('fade-in')) {
      // Freeze the container height so it doesn't collapse to 0 when we clear innerHTML
      transferContent.style.height = transferContent.offsetHeight + 'px';
      transferContent.style.overflow = 'hidden';

      transferResults.classList.remove('fade-in');
      await new Promise(r => setTimeout(r, 200));
      // Abort if tab changed during fade out
      if (activeTransferTab !== tabId) {
        transferContent.style.height = '';
        transferContent.style.overflow = '';
        return;
      }
    }

    // Build DOM without showing it yet
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

      // Thumbnail (if available)
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

      // Info
      const info = document.createElement('div');
      info.className = 'transfer-result-info';
      const title = document.createElement('div');
      title.className = 'transfer-result-title';
      title.textContent = item.title || item.name || 'Untitled';
      info.appendChild(title);
      a.appendChild(info);

      // Arrow
      const arrow = document.createElement('i');
      arrow.className = 'fa-solid fa-chevron-right transfer-result-arrow';
      a.appendChild(arrow);

      transferResults.appendChild(a);
    });

    smoothStateSwitch(transferContent, ALL_STATES, transferResults, 'flex');
  }

  // ============================================
  //  Platform Toggle Sync
  // ============================================
  const platformRadios = document.querySelectorAll('.platform-toggle input[type="radio"]');
  platformRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.querySelectorAll('.platform-btn').forEach(btn => btn.classList.remove('active'));
      if (e.target.checked) {
        e.target.parentElement.classList.add('active');
        // Update input placeholder based on platform
        if (e.target.value === 'eh') {
          input.placeholder = t('search.input_eh');
          input.setAttribute('data-i18n-placeholder', 'search.input_eh');
        } else {
          input.placeholder = t('search.input_jm');
          input.setAttribute('data-i18n-placeholder', 'search.input_jm');
        }
      }
    });
  });

  // ============================================
  //  Jelly Bounce on All Buttons
  // ============================================

  document.querySelectorAll('.jelly-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.classList.remove('bounce');
      void btn.offsetHeight; // Force reflow to restart animation
      btn.classList.add('bounce');
      btn.addEventListener(
        'animationend',
        () => {
          btn.classList.remove('bounce');
        },
        { once: true }
      );
    });
  });

  // Bind Update Tags button
  const updateTagsBtn = document.getElementById('update-tags-btn');
  if (updateTagsBtn) {
    updateTagsBtn.addEventListener('click', () => {
      checkAndUpdateTags(true);
    });
  }
});
