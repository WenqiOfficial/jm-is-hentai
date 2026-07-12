import { fetchAlbumInfo } from './jmcomic.js';
import { WebGLBackground } from './webgl-background.js';
import { getTransferTargets, searchEhentai, fetchEhentaiGallery } from './transfer.js';
import { initI18n, t, getCurrentLang } from './i18n.js';
import { translateTag, checkAndUpdateTags } from './tag-translator.js';
import { initLogoInteractivity } from './logo.js';
import no18Icon from '../image/no18.png';

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

  // === State Management for Reactive Re-rendering ===
  let currentAlbumData = null;
  let currentPlatformState = null;

  // ============================================
  //  Shared UI Helpers (DRY)
  // ============================================

  /**
   * Render tag cloud. Extracted to eliminate 3x duplication.
   * @param {string[]} tags - Raw tag strings
   * @param {string} lang - Current language code
   * @param {boolean} animate - Whether to apply stagger entrance animation
   */
  function renderTags(tags, lang, animate = true) {
    comicTags.innerHTML = '';
    (tags || []).forEach((tag, index) => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = translateTag(tag, lang);
      if (lang === 'zh') span.title = tag;
      if (animate) {
        span.style.animation = `tagPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 0.05}s both`;
      }
      comicTags.appendChild(span);
    });
  }

  /** Platform-specific display configuration */
  const PLATFORM_CONFIG = {
    jm: {
      getAuthor: (album) => `${t('comic.author')}: ${(album.author || []).join(', ') || t('comic.unknown', '未知')}`,
      getTitle: (album, query) => album.name || `JMComic - ${query}`,
      getLinkIcon: 'fa-solid fa-book-open',
      getLinkText: () => t('comic.read_jm'),
    },
    eh: {
      getAuthor: (album) => album.uploader ? `${t('comic.uploader')}: ${album.uploader}` : `${t('comic.source')}: E-Hentai`,
      getTitle: (album, query) => album.title_jpn || album.title || query,
      getLinkIcon: 'fa-solid fa-paw',
      getLinkText: () => t('comic.read_eh'),
    },
  };

  /**
   * Populate the comic info panel. Extracted to eliminate 2x duplication.
   * @param {string} platform - 'jm' or 'eh'
   * @param {Object} album - Album data object
   * @param {string} linkHref - URL for the read button
   * @param {string} query - Original search query (for title fallback)
   */
  function populateComicInfo(platform, album, linkHref, query) {
    const config = PLATFORM_CONFIG[platform];
    const lang = getCurrentLang();

    comicTitle.textContent = config.getTitle(album, query);
    comicAuthor.textContent = config.getAuthor(album);
    renderTags(album.tags || [], lang, true);
    jmLink.href = linkHref;
    jmLink.innerHTML = `<i class="${config.getLinkIcon}"></i> ${config.getLinkText()}`;
  }

  window.addEventListener('languageChanged', (e) => {
    if (!currentAlbumData || comicInfo.style.display === 'none') return;
    const config = PLATFORM_CONFIG[currentPlatformState];
    if (!config) return;

    comicAuthor.textContent = config.getAuthor(currentAlbumData);
    jmLink.innerHTML = `<i class="${config.getLinkIcon}"></i> ${config.getLinkText()}`;
    renderTags(currentAlbumData.tags || [], e.detail.lang, false);
  });

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

    // Use transitionend to sync with CSS instead of hardcoded timeout
    const onEnd = () => {
      el.removeEventListener('transitionend', onEnd);
      if (!el.classList.contains('fade-in')) {
        el.style.display = 'none';
      }
    };
    el.addEventListener('transitionend', onEnd, { once: true });

    // Safety fallback in case transitionend never fires (e.g., display:none race)
    el._fadeTimer = setTimeout(onEnd, 500);
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

    // 5. Cleanup after transition completes (use transitionend with safety fallback)
    const cleanup = () => {
      container.style.height = '';
      container.style.overflow = '';
      container.style.transition = '';
    };
    container.addEventListener('transitionend', (e) => {
      if (e.propertyName === 'height') cleanup();
    }, { once: true });
    setTimeout(cleanup, 500); // Safety fallback
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

  const nsfwBlurToggle = document.getElementById('nsfw-blur-toggle');
  let autoBlurNsfw = localStorage.getItem('auto_blur_nsfw') !== 'false'; // default true
  if (nsfwBlurToggle) {
    nsfwBlurToggle.checked = autoBlurNsfw;
    nsfwBlurToggle.addEventListener('change', (e) => {
      autoBlurNsfw = e.target.checked;
      localStorage.setItem('auto_blur_nsfw', autoBlurNsfw);
    });
  }

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
        visualContent.innerHTML = `<span><i class="fa-solid fa-image-slash"></i> ${t('comic.no_cover')}</span>`;
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

    // --- Auto-blur NSFW logic ---
    if (autoBlurNsfw) {
      let isNsfw = false;
      const tags = album.tags || [];
      if (album._source_domain === 'eh') {
        const cat = album.category || '';
        isNsfw = cat.toLowerCase() !== 'non-h';
      } else {
        isNsfw = !tags.includes('非工口') && !tags.includes('non-h');
      }

      if (isNsfw) {
        displayImg.classList.add('nsfw-blurred');
        
        const overlay = document.createElement('div');
        overlay.className = 'nsfw-overlay';
        
        const icon = document.createElement('img');
        icon.src = no18Icon;
        icon.className = 'nsfw-icon';
        icon.alt = '18+';
        
        const text = document.createElement('div');
        text.className = 'nsfw-text';
        text.textContent = t('nsfw.risky');
        text.setAttribute('data-i18n', 'nsfw.risky');
        
        const btn = document.createElement('button');
        btn.className = 'nsfw-btn';
        btn.textContent = t('nsfw.view');
        btn.setAttribute('data-i18n', 'nsfw.view');
        
        btn.onclick = () => {
          displayImg.classList.remove('nsfw-blurred');
          overlay.classList.add('hidden');
        };
        
        overlay.appendChild(icon);
        overlay.appendChild(text);
        overlay.appendChild(btn);
        
        visualContent.appendChild(overlay);
      }
    }
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

        currentAlbumData = album;
        currentPlatformState = 'jm';

        smoothStateSwitch(resultContainer.querySelector('.result-stack'), [loadingIndicator, errorMsg], comicInfo, 'flex');
        populateComicInfo('jm', album, `https://18comic.vip/album/${query}`, query);
        updateVisual(album);
        triggerTransfer(album.name || '', currentPlatform);

      } else if (currentPlatform === 'eh') {
        const results = await searchEhentai(query);
        if (!results || results.length === 0) {
          throw new Error(t('alert.no_eh_gallery'));
        }

        const baseAlbum = results[0];
        const galleryDetails = await fetchEhentaiGallery(baseAlbum.gid, baseAlbum.token);
        const album = galleryDetails || baseAlbum;
        const tags = album.tags || [];

        currentAlbumData = { ...album, tags };
        currentPlatformState = 'eh';

        smoothStateSwitch(resultContainer.querySelector('.result-stack'), [loadingIndicator, errorMsg], comicInfo, 'flex');
        populateComicInfo('eh', { ...album, tags }, baseAlbum.url || '#', query);

        updateVisual({
          id: query,
          name: comicTitle.textContent,
          _source_domain: 'eh',
          _thumbnail: album.thumb || baseAlbum.thumbnail,
          category: album.category,
          tags,
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
  const transferError = document.getElementById('transfer-error');
  const transferErrorMsg = document.getElementById('transfer-error-msg');
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

    const ALL_STATES = [transferLoading, transferEmpty, transferError, transferComingSoon, transferResults];

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
      let lastErrorStr = null;
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
        lastErrorStr = err.message || String(err);
      }

      // If we reach here, the search returned 0 results or errored
      if (i < candidates.length - 1) {
        // We have more candidates to try, show a brief message before continuing
        if (lastErrorStr) {
          transferErrorMsg.textContent = lastErrorStr;
          await smoothStateSwitch(transferContent, ALL_STATES, transferError, 'flex');
        } else {
          transferEmpty.querySelector('p').textContent = t('alert.auto_empty');
          await smoothStateSwitch(transferContent, ALL_STATES, transferEmpty, 'flex');
        }
        
        if (activeTransferTab !== tabId) return;
        
        // Let the user read the message for 1.2s before the next loop iteration starts
        await new Promise(r => setTimeout(r, 1200));
        
        if (activeTransferTab !== tabId) return;
      } else {
        // Last iteration
        if (lastErrorStr) {
          transferErrorMsg.textContent = lastErrorStr;
          await smoothStateSwitch(transferContent, ALL_STATES, transferError, 'flex');
          return; // Prevent showing empty
        }
      }
    }
    
    // If all candidates failed or returned 0 results (and no error on the last candidate)
    if (activeTransferTab === tabId) {
      transferEmpty.querySelector('p').textContent = t('transfer.empty');
      smoothStateSwitch(transferContent, ALL_STATES, transferEmpty, 'flex');
    }
  }

  async function renderTransferResults(results, tabId) {
    const ALL_STATES = [transferLoading, transferEmpty, transferError, transferComingSoon, transferResults];
    
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

  // Initialize interactive logo
  initLogoInteractivity();
});
