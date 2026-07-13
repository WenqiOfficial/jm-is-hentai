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

  // Helper to dynamically update submit button and title
  const updateModalUI = (source) => {
    // Rely on structural attributes instead of translated strings
    const isSearchContext = source.type === 'search' || 
                            (source.id && source.id.toLowerCase().includes('search')) || 
                            (source.className && typeof source.className === 'string' && source.className.toLowerCase().includes('search')) ||
                            source.id === 'jm-id-input' || 
                            source.id === 'transfer-keyword-input';
    
    const titleEl = modal.querySelector('.mobile-input-title');

    if (isSearchContext) {
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

  let isScrolling = false;
  
  document.addEventListener('touchstart', () => {
    isScrolling = false;
  }, { passive: true });
  
  document.addEventListener('touchmove', () => {
    isScrolling = true;
  }, { passive: true });

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
    if (activeTargetInput) {
      activeTargetInput.value = modalInput.value;
      activeTargetInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
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
    if (activeTargetInput) {
      activeTargetInput.value = '';
      activeTargetInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  // Real-time synchronization
  modalInput.addEventListener('input', () => {
    updateClearBtn();
    if (activeTargetInput) {
      activeTargetInput.value = modalInput.value;
      activeTargetInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  const submitAction = () => {
    if (activeTargetInput) {
      // Value is already synced in real-time, just simulate Enter keypress
      const enterEvent = new KeyboardEvent('keypress', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      });
      activeTargetInput.dispatchEvent(enterEvent);
    }
    syncValueAndClose(); // close modal
  };

  modalInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitAction();
    }
  });

  submitBtn.addEventListener('click', submitAction);
}
