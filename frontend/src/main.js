import { fetchAlbumInfo } from './jmcomic.js';
import { WebGLBackground } from './webgl-background.js';
import { searchEhentai, fetchEhentaiGallery } from './ehentai.js';
import { initI18n, t, getCurrentLang, setI18nText, setI18nPlaceholder, setI18nTitle, I18nError } from './i18n.js';
import { translateTag, checkAndUpdateTags } from './tag-translator.js';
import { initLogoInteractivity, setLogoCentered } from './logo.js';
import { showToast } from './toast.js';
import { bindStorage, transitionManager, setupClickOutside } from './utils.js';
import { initJellyTrackers } from './ui/jelly-tracker.js';
import { initUniversalMobileInput } from './ui/mobile-input.js';
import { initTransferPanel } from './transfer-panel.js';
import { initPwaVersioning } from './pwa-update.js';
import no18Icon from '../image/no18.png';

let settingsPanelWasOpen = false;

// --- Global Loading Mask Manager ---
window.addEventListener('showLoading', () => {
  document.body.classList.add('mask-active');
  setLogoCentered(true);
  
  // Plan 2: Hide settings panel while mask is active to avoid WebKit blur conflicts
  const settingsPanel = document.getElementById('settings-panel');
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsPanel && !settingsPanel.classList.contains('is-hidden')) {
    settingsPanelWasOpen = true;
    settingsPanel.classList.add('is-hidden');
    if (settingsBtn) settingsBtn.setAttribute('aria-expanded', 'false');
  } else {
    settingsPanelWasOpen = false;
  }
});

window.addEventListener('hideLoading', () => {
  document.body.classList.remove('mask-active');
  setLogoCentered(false);
  
  // Restore settings panel AFTER the mask has fully faded out (0.4s)
  if (settingsPanelWasOpen) {
    settingsPanelWasOpen = false;
    setTimeout(() => {
      const settingsPanel = document.getElementById('settings-panel');
      const settingsBtn = document.getElementById('settings-btn');
      if (settingsPanel) {
        settingsPanel.classList.remove('is-hidden');
        if (settingsBtn) settingsBtn.setAttribute('aria-expanded', 'true');
      }
    }, 400);
  }
});

function hideInitialLoading() {
  setTimeout(() => {
    window.dispatchEvent(new Event('hideLoading'));
  }, 400);
}

if (document.readyState === 'complete') {
  hideInitialLoading();
} else {
  window.addEventListener('load', hideInitialLoading);
}

function initApp() {
  initI18n();
  // === DOM References ===
  const input = document.getElementById('jm-id-input');
  const searchBtn = document.getElementById('search-btn');
  const visualContent = document.getElementById('visual-content');
  const resultContainer = document.getElementById('result-container');
  const loadingIndicator = document.getElementById('loading-indicator');
  const errorMsg = document.getElementById('error-msg');
  const comicInfo = document.getElementById('comic-info');

  // Initialize new modules
  initUniversalMobileInput();
  const { triggerTransfer } = initTransferPanel();

  // Add specific listener for input placeholder side-effect
  document.querySelectorAll('.platform-toggle').forEach(el => {
    el.addEventListener('change', (e) => {
      if (e.target.name === 'platform') {
        if (e.target.value === 'eh') {
          setI18nPlaceholder(input, 'search.input_eh');
        } else {
          setI18nPlaceholder(input, 'search.input_jm');
        }
      }
    });
  });

  const comicTitle = document.getElementById('comic-title');
  const comicAuthor = document.getElementById('comic-author');
  const comicTags = document.getElementById('comic-tags');
  const jmLink = document.getElementById('jm-link');

  // Initialize one-time copy listeners on persistent DOM elements
  setupCopyOnClick(comicTitle, () => comicTitle.textContent);
  setupCopyOnClick(comicAuthor, () => comicAuthor.textContent);

  // === State Management for Reactive Re-rendering ===
  let currentAlbumData = null;
  let currentPlatformState = null;

  // === Search Memory Restore ===
  const lastPlatform = bindStorage('last_platform', document.querySelectorAll('input[name="platform"]'), 'jm');
  const lastKeyword = bindStorage('last_keyword', [input], '');
  
  if (lastPlatform === 'eh') {
    setI18nPlaceholder(input, 'search.input_eh');
  } else {
    setI18nPlaceholder(input, 'search.input_jm');
  }

  initJellyTrackers();

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
      
      setupCopyOnClick(span, span.textContent);

      if (lang === 'zh') span.title = tag;
      if (animate) {
        span.style.animation = `tagPop 0.35s var(--spring-easing) ${index * 0.05}s backwards`;
      }
      comicTags.appendChild(span);
    });
  }

  /** Platform-specific display configuration */
  const PLATFORM_CONFIG = {
    jm: {
      getAuthor: (album) => `${t('comic.author')}: ${(album.author || []).join(', ') || t('comic.unknown')}`,
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
   * Utility: Add one-click copy functionality to an element without breaking text selection.
   */
  function setupCopyOnClick(element, textToCopy) {
    element.classList.add('copyable');
    setI18nTitle(element, 'action.click_to_copy');
    element.addEventListener('click', () => {
      // Don't trigger copy if the user is highlighting text
      if (window.getSelection().toString().trim() !== '') return;
      
      const text = typeof textToCopy === 'function' ? textToCopy() : textToCopy;
      if (!text) return;
      
      navigator.clipboard.writeText(text).then(() => {
        showToast(t('alert.copy_success', { text }), 'success');
      }).catch(err => {
        showToast(t('alert.copy_failed'), 'error');
      });
    });
  }

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
    // Clear cache so that dynamically translated synthetic search results (e.g., nHentai) are regenerated
    transferCache = {};

    if (!currentAlbumData || comicInfo.style.display === 'none') return;
    const config = PLATFORM_CONFIG[currentPlatformState];
    if (!config) return;

    comicAuthor.textContent = config.getAuthor(currentAlbumData);
    jmLink.innerHTML = `<i class="${config.getLinkIcon}"></i> ${config.getLinkText()}`;
    renderTags(currentAlbumData.tags || [], e.detail.lang, false);
  });

  // ============================================
  //  Fade Transition Helpers
  // ============================================

  const smoothStateSwitch = transitionManager.smoothStateSwitch.bind(transitionManager);

  // ============================================
  //  WebGL Background
  // ============================================

  const bgContainer = document.getElementById('bg-container');
  let webglBg = null;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!prefersReducedMotion) {
    webglBg = new WebGLBackground(bgContainer);
    if (!webglBg.initialized) {
      webglBg = null;
    }
  }

  // ============================================
  //  Settings Menu
  // ============================================

  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  
  // --- Search Engine Selection ---
  const dataSourceRadios = document.getElementsByName('datasource');
  let fetchMode = bindStorage('datasource', dataSourceRadios, 'api', (val) => fetchMode = val);

  const nsfwBlurToggle = document.getElementById('nsfw-blur-toggle');
  let autoBlurNsfw = true;
  if (nsfwBlurToggle) {
    autoBlurNsfw = bindStorage('auto_blur_nsfw', [nsfwBlurToggle], true, (val) => autoBlurNsfw = val);
  }

  settingsBtn.addEventListener('click', () => {
    const isHidden = settingsPanel.classList.contains('is-hidden');
    settingsPanel.classList.toggle('is-hidden');
    settingsBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
  });

  setupClickOutside(settingsPanel, settingsBtn, () => {
    settingsPanel.classList.add('is-hidden');
    settingsBtn.setAttribute('aria-expanded', 'false');
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

    const displayImg = document.createElement('img');
    displayImg.src = rawImgUrl;
    displayImg.alt = album.name || 'Cover';
    
    displayImg.onerror = () => {
      if (displayImg.src !== proxyImgUrl) {
        displayImg.src = proxyImgUrl;
      } else {
        visualContent.innerHTML = `<span><i class="fa-solid fa-image-slash"></i> <span data-i18n="comic.no_cover">${t('comic.no_cover')}</span></span>`;
        visualContent.classList.add('placeholder');
        document.documentElement.style.removeProperty('--primary-color');
        document.documentElement.style.removeProperty('--primary-btn');
        document.documentElement.style.removeProperty('--secondary-color');
        document.documentElement.style.removeProperty('--accent-color');
        if (webglBg) webglBg.resetColors();
      }
    };

    visualContent.appendChild(displayImg);

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
        setI18nText(text, 'nsfw.risky');
        
        const btn = document.createElement('button');
        btn.className = 'nsfw-btn';
        setI18nText(btn, 'nsfw.view');
        
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
    if (typeof Vibrant !== 'undefined') {
      const proxyImg = new Image();
      proxyImg.crossOrigin = 'Anonymous';
      proxyImg.src = proxyImgUrl;
      
      proxyImg.onload = () => {
        const vibrant = new Vibrant(proxyImg, { quality: 1 });
        vibrant.getPalette().then(palette => {
          let c1 = [160, 196, 255]; 
          let c2 = [255, 198, 255];
          let c3 = [253, 255, 182];

          c1 = palette.Vibrant ? palette.Vibrant.rgb : c1;
          let btnColor = [...c1];

          if (palette.LightVibrant) c2 = palette.LightVibrant.rgb;
          if (palette.Muted) c3 = palette.Muted.rgb;
          else if (palette.DarkVibrant) c3 = palette.DarkVibrant.rgb;

          const pastelify = (rgb) => [
            Math.round(rgb[0] * 0.6 + 255 * 0.4),
            Math.round(rgb[1] * 0.6 + 250 * 0.4),
            Math.round(rgb[2] * 0.6 + 240 * 0.4)
          ];

          c1 = pastelify(c1);
          c2 = pastelify(c2);
          c3 = pastelify(c3);

          const lumaPrimary = 0.299 * btnColor[0] + 0.587 * btnColor[1] + 0.114 * btnColor[2];
          const textOnPrimary = lumaPrimary > 160 ? '#1E293B' : '#FFFFFF';
          
          const lumaSecondary = 0.299 * c2[0] + 0.587 * c2[1] + 0.114 * c2[2];
          const textOnSecondary = lumaSecondary > 160 ? '#1E293B' : '#FFFFFF';

          document.documentElement.style.setProperty('--primary-color', `rgb(${c1.join(',')})`);
          document.documentElement.style.setProperty('--primary-btn', `rgb(${btnColor.join(',')})`);
          document.documentElement.style.setProperty('--secondary-color', `rgb(${c2.join(',')})`);
          document.documentElement.style.setProperty('--accent-color', `rgb(${c3.join(',')})`);
          document.documentElement.style.setProperty('--btn-text-color', textOnPrimary);
          document.documentElement.style.setProperty('--btn-text-color-alt', textOnSecondary);

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

  let currentSearchId = 0;

  const handleSearch = async () => {
    const searchId = ++currentSearchId;
    
    const currentPlatform = document.querySelector('input[name="platform"]:checked')?.value || 'jm';
    let query = input.value.trim();

      if (currentPlatform === 'jm') {
      query = query.replace(/\D/g, '');
      if (!query) {
        showError(new I18nError('alert.empty_jm'));
        return;
      }
    } else {
      if (!query) {
        showError(new I18nError('alert.empty_eh'));
        return;
      }
    }

    // Show result area & loading, hide previous results
    resultContainer.style.display = 'block';
    smoothStateSwitch(resultContainer.querySelector('.result-stack'), [errorMsg, comicInfo], loadingIndicator, 'flex');

    try {
      if (currentPlatform === 'jm') {
        const album = await fetchAlbumInfo(query, fetchMode);
        
        if (searchId !== currentSearchId) return; // Discard if overridden

        currentAlbumData = album;
        currentPlatformState = 'jm';

        smoothStateSwitch(resultContainer.querySelector('.result-stack'), [loadingIndicator, errorMsg], comicInfo, 'flex');
        populateComicInfo('jm', album, `https://18comic.vip/album/${query}`, query);
        updateVisual(album);

        // Trigger transfer panel search
        triggerTransfer(album, currentPlatform);
      } else if (currentPlatform === 'eh') {
        const results = await searchEhentai(query);
        if (searchId !== currentSearchId) return; // Discard if overridden

        if (!results || results.length === 0) {
          throw new I18nError('alert.no_eh_gallery');
        }

        const baseAlbum = results[0];
        const galleryDetails = await fetchEhentaiGallery(baseAlbum.gid, baseAlbum.token);
        if (searchId !== currentSearchId) return; // Discard if overridden

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

        triggerTransfer(album, currentPlatform);
      }
    } catch (err) {
      if (searchId !== currentSearchId) return; // Discard if overridden
      showError(err);
    }
  };

  const showError = (err) => {
    resultContainer.style.display = 'block';
    if (err instanceof I18nError) {
      setI18nText(errorMsg, err.i18nKey, err.i18nParams);
    } else {
      errorMsg.removeAttribute('data-i18n');
      errorMsg.removeAttribute('data-i18n-params');
      errorMsg.textContent = err.message || err;
    }
    smoothStateSwitch(resultContainer.querySelector('.result-stack'), [loadingIndicator, comicInfo], errorMsg, 'block');
  };

  searchBtn.addEventListener('click', handleSearch);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
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
  let isUpdatingTags = false;
  if (updateTagsBtn) {
    updateTagsBtn.addEventListener('click', async () => {
      if (isUpdatingTags) return;
      isUpdatingTags = true;
      try {
        await checkAndUpdateTags(true);
      } finally {
        isUpdatingTags = false;
      }
    });
  }

  // Initialize interactive logo
  initLogoInteractivity();
  
  // Sync logo state with HTML initial mask-active class
  if (document.body.classList.contains('mask-active')) {
    setLogoCentered(true);
  }

  void initPwaVersioning();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

