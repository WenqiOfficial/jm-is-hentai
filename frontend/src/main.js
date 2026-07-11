import { fetchAlbumInfo } from './jmcomic.js';
import { WebGLBackground } from './webgl-background.js';

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
    // Set display:none after transition finishes (matches 0.4s CSS duration)
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
  //  ColorThief
  // ============================================

  let colorThief = null;
  if (typeof ColorThief !== 'undefined') {
    colorThief = new ColorThief();
  }

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
      if (colorThief) {
        try {
          const color = colorThief.getColor(img);
          const palette = colorThief.getPalette(img, 3);

          // Helper to make extracted colors soft and pastel (mix with warm white)
          const pastelify = (rgb) => [
            Math.round(rgb[0] * 0.4 + 255 * 0.6),
            Math.round(rgb[1] * 0.4 + 250 * 0.6),
            Math.round(rgb[2] * 0.4 + 240 * 0.6)
          ];

          const c1 = color ? pastelify(color) : [160, 196, 255];
          const c2 = (palette && palette[0]) ? pastelify(palette[0]) : [255, 198, 255];
          const c3 = (palette && palette[1]) ? pastelify(palette[1]) : [253, 255, 182];

          // CSS @property transitions handle smooth interpolation for UI elements
          document.documentElement.style.setProperty(
            '--primary-color',
            `rgb(${c1[0]}, ${c1[1]}, ${c1[2]})`
          );
          document.documentElement.style.setProperty(
            '--secondary-color',
            `rgb(${c2[0]}, ${c2[1]}, ${c2[2]})`
          );
          document.documentElement.style.setProperty(
            '--accent-color',
            `rgb(${c3[0]}, ${c3[1]}, ${c3[2]})`
          );

          // WebGL background uses internal lerp for smooth shader color transition
          if (webglBg) {
            webglBg.setColors(c1, c2, c3);
          }
        } catch (e) {
          console.log('Could not extract color (likely CORS issue on image)', e);
        }
      }
    };

    img.onerror = () => {
      visualContent.innerHTML =
        '<span><i class="fa-solid fa-image-slash"></i> 暂无封面</span>';
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
  //  Smooth Hover Glare Effect (Hardware Accelerated)
  // ============================================

  const interactiveCards = document.querySelectorAll('.interactive-card');
  interactiveCards.forEach((card) => {
    const glare = card.querySelector('.glare');
    if (!glare) return;

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Translate the glare. The glare is 200% width/height and centered at -50% -50%.
      // We want its center to follow the mouse.
      const translateX = x - rect.width / 2;
      const translateY = y - rect.height / 2;

      // Use requestAnimationFrame for buttery smooth 60fps tracking without layout thrashing
      requestAnimationFrame(() => {
        glare.style.transform = `translate(${translateX}px, ${translateY}px)`;
      });
    });

    card.addEventListener('mouseleave', () => {
      // Glare opacity fade out is handled purely by CSS :hover
      // No need to reset position, it just fades out.
    });
  });
});
