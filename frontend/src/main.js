import { fetchAlbumInfo } from './jmcomic.js';
import { WebGLBackground } from './webgl-background.js';
import { getTransferTargets } from './transfer.js';

document.addEventListener('DOMContentLoaded', () => {
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

    const cdnDomain = album._source_domain || 'www.cdnaspa.vip';
    const rawImgUrl = `https://${cdnDomain}/media/albums/${album.id}_3x4.jpg`;
    const imgUrl = `https://img.wenqi.icu/?url=${encodeURIComponent(rawImgUrl)}`;

    const img = document.createElement('img');
    img.crossOrigin = 'Anonymous';
    img.src = imgUrl;
    img.alt = album.name;

    img.onload = () => {
      // Use node-vibrant if available
      if (typeof Vibrant !== 'undefined') {
        const vibrant = new Vibrant(img, { quality: 1 });
        vibrant.getPalette().then(palette => {
          let c1 = [160, 196, 255]; // fallback
          let c2 = [255, 198, 255];
          let c3 = [253, 255, 182];

          // We prioritize Vibrant and LightVibrant for healing, saturated colors
          if (palette.Vibrant) c1 = palette.Vibrant.rgb;
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

          // CSS @property transitions handle smooth interpolation for UI elements
          document.documentElement.style.setProperty('--primary-color', `rgb(${c1[0]}, ${c1[1]}, ${c1[2]})`);
          document.documentElement.style.setProperty('--secondary-color', `rgb(${c2[0]}, ${c2[1]}, ${c2[2]})`);
          document.documentElement.style.setProperty('--accent-color', `rgb(${c3[0]}, ${c3[1]}, ${c3[2]})`);

          // WebGL background uses internal lerp for smooth shader color transition
          if (webglBg) {
            webglBg.setColors(c1, c2, c3);
          }
        }).catch(err => {
          console.log('Vibrant extraction failed:', err);
        });
      }
    };

    img.onerror = () => {
      visualContent.innerHTML = '<span><i class="fa-solid fa-image-slash"></i> 暂无封面</span>';
      visualContent.classList.add('placeholder');
      // Reset colors to defaults
      document.documentElement.style.removeProperty('--primary-color');
      document.documentElement.style.removeProperty('--secondary-color');
      document.documentElement.style.removeProperty('--accent-color');
      if (webglBg) webglBg.resetColors();
    };

    visualContent.appendChild(img);
  };

  // ============================================
  //  Search Logic
  // ============================================

  const handleSearch = async () => {
    const jmId = input.value.trim().replace(/\D/g, '');

    if (!jmId) {
      showError('请输入有效的数字车牌号');
      return;
    }

    // Show result area & loading, hide previous results
    resultContainer.style.display = 'block';
    fadeIn(loadingIndicator, 'flex');
    fadeOut(errorMsg);
    fadeOut(comicInfo);

    try {
      const album = await fetchAlbumInfo(jmId, fetchMode);

      fadeOut(loadingIndicator);

      // Populate comic info
      comicTitle.textContent = album.name || `JMComic - ${jmId}`;
      comicAuthor.textContent = `作者: ${(album.author || []).join(', ') || '未知'}`;

      // Tags with stagger pop animation
      comicTags.innerHTML = '';
      (album.tags || []).forEach((tag, index) => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.setAttribute('role', 'listitem');
        span.textContent = tag;
        span.style.animation = `tagPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 0.05}s both`;
        comicTags.appendChild(span);
      });

      jmLink.href = `https://18comic.vip/album/${jmId}`;

      // Small delay lets loading fade out before comic info fades in
      setTimeout(() => {
        fadeIn(comicInfo, 'flex');
      }, 180);

      updateVisual(album);

      // Trigger transfer panel search
      const currentPlatform = document.querySelector('input[name="platform"]:checked')?.value || 'jm';
      triggerTransfer(album.name || '', currentPlatform);
    } catch (err) {
      fadeOut(loadingIndicator);
      setTimeout(() => {
        showError(err.message);
      }, 180);
    }
  };

  const showError = (msg) => {
    resultContainer.style.display = 'block';
    errorMsg.textContent = msg;
    fadeIn(errorMsg);
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

  let transferTargets = [];
  let activeTransferTab = null;
  // Cache: { tabId: results[] }
  let transferCache = {};

  async function triggerTransfer(comicTitle, sourcePlatform) {
    transferTargets = getTransferTargets(sourcePlatform);
    transferCache = {};
    activeTransferTab = null;

    if (transferTargets.length === 0) {
      transferArea.style.display = 'none';
      return;
    }

    // Build tabs
    transferTabs.innerHTML = '';
    transferTargets.forEach((target, idx) => {
      const btn = document.createElement('button');
      btn.className = 'transfer-tab' + (idx === 0 ? ' active' : '');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
      btn.innerHTML = `<i class="${target.icon}"></i> ${target.label}`;
      btn.addEventListener('click', () => switchTransferTab(target.id, comicTitle));
      transferTabs.appendChild(btn);
    });

    // Show the panel
    transferArea.style.display = 'flex';

    // Bind 3D tilt to the transfer card
    bindTilt(transferCard);

    // Auto-select first tab
    switchTransferTab(transferTargets[0].id, comicTitle);
  }

  async function switchTransferTab(tabId, comicTitle) {
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

    // Check if this is the placeholder (picacg)
    if (tabId === 'picacg') {
      hideAllTransferStates();
      fadeIn(transferComingSoon, 'flex');
      return;
    }

    // Check cache
    if (transferCache[tabId]) {
      renderTransferResults(transferCache[tabId], tabId);
      return;
    }

    // Show loading
    hideAllTransferStates();
    fadeIn(transferLoading, 'flex');

    try {
      const results = await target.searchFn(comicTitle);
      transferCache[tabId] = results;

      // Only render if this tab is still active
      if (activeTransferTab === tabId) {
        fadeOut(transferLoading);
        setTimeout(() => {
          renderTransferResults(results, tabId);
        }, 180);
      }
    } catch (err) {
      console.warn('Transfer search error:', err);
      if (activeTransferTab === tabId) {
        fadeOut(transferLoading);
        setTimeout(() => {
          hideAllTransferStates();
          fadeIn(transferEmpty, 'flex');
        }, 180);
      }
    }
  }

  function hideAllTransferStates() {
    fadeOut(transferLoading);
    fadeOut(transferEmpty);
    fadeOut(transferComingSoon);
    transferResults.innerHTML = '';
  }

  function renderTransferResults(results, tabId) {
    hideAllTransferStates();
    transferResults.innerHTML = '';

    if (!results || results.length === 0) {
      fadeIn(transferEmpty, 'flex');
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
  }

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

  // ============================================
  //  3D Tilt Helper (reusable)
  // ============================================

  function bindTilt(card) {
    if (!card || card._tiltBound) return;
    card._tiltBound = true;

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -8;
      const rotateY = ((x - centerX) / centerX) * 8;
      card.style.transition = 'transform 0.08s ease-out';
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    });
  }

  // Bind tilt to all existing interactive cards
  document.querySelectorAll('.interactive-card').forEach(bindTilt);

});
