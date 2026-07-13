import { setI18nText, t } from '../i18n.js';

export function initUniversalMobileInput() {
  const modal = document.getElementById('mobile-input-modal');
  if (!modal) return;

  // Ensure initialization happens only once
  if (modal.dataset.initialized === 'true') return;
  modal.dataset.initialized = 'true';

  const modalInput = document.getElementById('mobile-search-input');
  const closeBtn = document.getElementById('mobile-input-close');
  const clearBtn = document.getElementById('mobile-input-clear');
  const submitBtn = document.getElementById('mobile-input-submit');

  const isMobile = () => window.matchMedia('(max-width: 768px)').matches && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  let activeTargetInput = null;

  // Helper to sync attributes from target to modal input
  const syncAttributes = (source, target) => {
    const attrsToSync = ['type', 'inputmode', 'maxlength', 'pattern', 'autocomplete'];
    attrsToSync.forEach(attr => {
      if (source.hasAttribute(attr)) {
        target.setAttribute(attr, source.getAttribute(attr));
      } else {
        target.removeAttribute(attr);
      }
    });
    
    // Always copy placeholder, fallback if missing
    target.placeholder = source.placeholder || "...";
  };

  // --- Fix: Primitive Obsession ---
  // Use the declarative `data-input-context` attribute instead of matching IDs/classNames.
  const isSearchInput = (source) => {
    return source.type === 'search' || source.dataset.inputContext === 'search';
  };

  // Helper to dynamically update submit button and title
  const updateModalUI = (source) => {
    const titleEl = modal.querySelector('.mobile-input-title');

    if (isSearchInput(source)) {
      if (titleEl) {
        titleEl.setAttribute('data-i18n', 'search.mobile_input');
        titleEl.innerText = t('search.mobile_input') || 'Search';
      }
      submitBtn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> <span data-i18n="search.button">${t('search.button')}</span>`;
      setI18nText(submitBtn.querySelector('span'), 'search.button');
    } else {
      if (titleEl) {
        titleEl.setAttribute('data-i18n', 'action.input');
        titleEl.innerText = t('action.input') || 'Text Input';
      }
      submitBtn.innerHTML = `<i class="fa-solid fa-check"></i> <span data-i18n="action.confirm">${t('action.confirm') || 'Confirm'}</span>`;
      setI18nText(submitBtn.querySelector('span'), 'action.confirm');
    }
  };

  // Helper to validate and extract input target
  const getValidTargetInput = (e) => {
    let target = e.target;
    if (!target) return null;
    
    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
      target = target.closest('input, textarea');
    }
    
    if (!target) return null;
    if (target.id === 'mobile-search-input') return null; // Ignore our own modal input
    
    if (target.tagName === 'INPUT') {
      const validTypes = ['text', 'search', 'number', 'email', 'password', 'tel', 'url'];
      if (!validTypes.includes(target.type)) return null;
    }
    
    return target;
  };

  // --- Fix: Tap detection with coordinate threshold ---
  // A bare touchmove boolean causes false positives due to natural finger jitter.
  // Track start coordinates and require a 10px movement delta before marking as scroll.
  let touchStartX = 0;
  let touchStartY = 0;
  let isScrolling = false;
  const SCROLL_THRESHOLD = 10; // px
  
  document.addEventListener('touchstart', (e) => {
    isScrolling = false;
    if (e.touches.length > 0) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });
  
  document.addEventListener('touchmove', (e) => {
    if (!isScrolling && e.touches.length > 0) {
      const dx = Math.abs(e.touches[0].clientX - touchStartX);
      const dy = Math.abs(e.touches[0].clientY - touchStartY);
      if (dx > SCROLL_THRESHOLD || dy > SCROLL_THRESHOLD) {
        isScrolling = true;
      }
    }
  }, { passive: true });

  // --- Fix: Duplicated Code ---
  // Extracted helper to sync a value from the modal input to the active target.
  const syncToTarget = (value) => {
    if (activeTargetInput) {
      activeTargetInput.value = value;
      activeTargetInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  const handleInteraction = (e) => {
    if (!isMobile()) return;
    if (e.type === 'touchend' && isScrolling) return; // Prevent trigger on scroll
    
    const target = getValidTargetInput(e);
    if (target) {
      e.preventDefault();
      target.blur(); // Ensure original input doesn't keep focus
      
      activeTargetInput = target;

      modal.classList.remove('is-hidden');
      modalInput.value = target.value;
      
      syncAttributes(target, modalInput);
      updateModalUI(target);
      updateClearBtn();
      
      // Slight delay to allow CSS transition before focusing, ensures keyboard pops up smoothly
      setTimeout(() => {
        modalInput.focus();
        modalInput.setSelectionRange(modalInput.value.length, modalInput.value.length);
      }, 100);
    }
  };

  // Smart tap detection
  document.addEventListener('touchend', handleInteraction, { passive: false });
  document.addEventListener('click', (e) => {
    if (isMobile()) {
      const target = getValidTargetInput(e);
      if (target) {
        e.preventDefault();
        if (!activeTargetInput) {
          handleInteraction(e);
        }
      }
    }
  });

  const updateClearBtn = () => {
    clearBtn.style.display = modalInput.value.length > 0 ? 'flex' : 'none';
  };

  const closeModal = () => {
    modal.classList.add('is-hidden');
    modalInput.blur();
    activeTargetInput = null;
  };

  const syncValueAndClose = () => {
    syncToTarget(modalInput.value);
    closeModal();
  };

  // Click outside to close (clicking the backdrop)
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      syncValueAndClose();
    }
  });

  closeBtn.addEventListener('click', syncValueAndClose);
  
  clearBtn.addEventListener('click', () => {
    modalInput.value = '';
    updateClearBtn();
    modalInput.focus();
    
    // Real-time sync even on clear
    syncToTarget('');
  });

  // Real-time synchronization
  modalInput.addEventListener('input', () => {
    updateClearBtn();
    syncToTarget(modalInput.value);
  });

  // --- Fix: Submit race condition ---
  // Close the modal first, then dispatch Enter on the (now-restored) target.
  // This avoids the awkward state where Enter fires while the modal is still visible.
  const submitAction = () => {
    const target = activeTargetInput;
    syncValueAndClose(); // closes modal, clears activeTargetInput

    if (target) {
      const enterEvent = new KeyboardEvent('keypress', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      });
      target.dispatchEvent(enterEvent);
    }
  };

  modalInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitAction();
    }
  });

  submitBtn.addEventListener('click', submitAction);
}
