export function initUniversalMobileInput() {
  const modal = document.getElementById('mobile-input-modal');
  if (!modal) return;

  // Ensure initialization happens only once
  if (modal.dataset.initialized === 'true') return;
  modal.dataset.initialized = 'true';

  const modalInput = document.getElementById('mobile-id-input');
  const closeBtn = document.getElementById('mobile-input-close');
  const clearBtn = document.getElementById('mobile-input-clear');
  const submitBtn = document.getElementById('mobile-input-submit');

  const isMobile = () => window.matchMedia('(max-width: 768px)').matches && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  let activeTargetInput = null;

  const handleInteraction = (e) => {
    if (!isMobile()) return;
    
    // Check if the interaction is on an input or label pointing to an input
    // The closest label might have an input inside it, but for our case, search boxes are direct inputs
    let target = e.target;

    if (target.tagName !== 'INPUT') {
      // Allow label clicks to focus inputs, but we're mostly concerned with direct input taps here
      target = target.closest('input');
    }

    if (target && target.tagName === 'INPUT' && (target.type === 'text' || target.type === 'search') && target.id !== 'mobile-id-input') {
      e.preventDefault();
      target.blur(); // Ensure original input doesn't keep focus
      
      activeTargetInput = target;

      modal.classList.remove('is-hidden');
      modalInput.value = target.value;
      
      if (target.placeholder) {
        modalInput.placeholder = target.placeholder;
      } else {
        modalInput.placeholder = "...";
      }
      
      updateClearBtn();
      
      // Slight delay to allow CSS transition before focusing, ensures keyboard pops up smoothly
      setTimeout(() => {
        modalInput.focus();
        modalInput.setSelectionRange(modalInput.value.length, modalInput.value.length);
      }, 100);
    }
  };

  // Global event delegation
  document.addEventListener('touchstart', handleInteraction, { passive: false });
  document.addEventListener('mousedown', (e) => {
    if (isMobile()) {
      let target = e.target;
      if (target.tagName !== 'INPUT') target = target.closest('input');
      
      if (target && target.tagName === 'INPUT' && (target.type === 'text' || target.type === 'search') && target.id !== 'mobile-id-input') {
        e.preventDefault();
        handleInteraction(e);
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

  // Click outside to close (clicking the backdrop)
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (activeTargetInput) {
        activeTargetInput.value = modalInput.value.trim();
        activeTargetInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      closeModal();
    }
  });

  closeBtn.addEventListener('click', () => {
    if (activeTargetInput) {
      activeTargetInput.value = modalInput.value.trim();
      activeTargetInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    closeModal();
  });
  
  clearBtn.addEventListener('click', () => {
    modalInput.value = '';
    updateClearBtn();
    modalInput.focus();
  });

  modalInput.addEventListener('input', updateClearBtn);

  const submitAction = () => {
    if (activeTargetInput) {
      const val = modalInput.value.trim();
      activeTargetInput.value = val;
      
      // Dispatch input event to notify any listeners
      activeTargetInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Simulate "Enter" keypress on the target input to trigger its native search handler
      const enterEvent = new KeyboardEvent('keypress', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      });
      activeTargetInput.dispatchEvent(enterEvent);
    }
    closeModal();
  };

  modalInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitAction();
    }
  });

  submitBtn.addEventListener('click', submitAction);
}
