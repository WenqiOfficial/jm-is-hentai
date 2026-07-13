/**
 * utils.js — Global Utilities for robust state and DOM management
 */

/**
 * Two-way bind DOM elements (Radio, Checkbox, or Input) to localStorage.
 * @param {string} storageKey - The key used in localStorage
 * @param {NodeList|Array} elements - The DOM elements to bind
 * @param {any} defaultValue - Default value if storage is empty
 * @param {Function} [onChange] - Optional callback when value changes
 * @returns {any} The initial value
 */
export function bindStorage(storageKey, elements, defaultValue, onChange = null) {
  if (!elements || elements.length === 0) return defaultValue;
  
  let val = localStorage.getItem(storageKey);
  if (val === null) {
    val = defaultValue;
  } else {
    // Attempt parsing boolean if needed
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
  }

  // Hydrate DOM
  elements.forEach(el => {
    if (el.type === 'radio' || el.type === 'checkbox') {
      if (el.type === 'radio') {
        el.checked = (el.value === String(val));
      } else {
        el.checked = Boolean(val);
      }
      
      // Listen for changes
      el.addEventListener('change', (e) => {
        const newVal = el.type === 'checkbox' ? e.target.checked : e.target.value;
        localStorage.setItem(storageKey, String(newVal));
        if (onChange) onChange(newVal, e);
      });
    } else {
      // Text inputs
      el.value = val;
      el.addEventListener('input', (e) => {
        localStorage.setItem(storageKey, e.target.value);
        if (onChange) onChange(e.target.value, e);
      });
    }
  });

  return val;
}

/**
 * Robust Transition Manager that handles asynchronous CSS transitions.
 * Prevents race conditions by aborting any currently running transition on the same container.
 */
export class TransitionManager {
  constructor() {
    this.activeTransitions = new Map();
  }

  /**
   * Smoothly transitions container height while crossfading child elements.
   * If called again on the same container before finishing, the previous transition is aborted safely.
   */
  async smoothStateSwitch(container, outgoingElements, incomingElement, displayMode = 'block') {
    if (!container) return;

    // Abort previous transition if running on this container
    if (this.activeTransitions.has(container)) {
      const abortCtrl = this.activeTransitions.get(container);
      abortCtrl.abort();
    }

    const abortController = new AbortController();
    this.activeTransitions.set(container, abortController);
    const signal = abortController.signal;

    try {
      const currentHeight = container.offsetHeight;
      container.style.height = currentHeight + 'px';
      container.style.overflow = 'hidden';
      container.style.transition = 'height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';

      // 1. Fade out outgoing
      let hasOutgoing = false;
      outgoingElements.forEach(el => {
        if (el && el.style.display !== 'none' && el.classList.contains('fade-in')) {
          el.classList.remove('fade-in');
          hasOutgoing = true;
        }
      });

      if (hasOutgoing) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 200);
          signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      }

      outgoingElements.forEach(el => {
        if (el) el.style.display = 'none';
      });
      
      // 2. Measure incoming height
      let targetHeight = 0;
      if (incomingElement) {
        incomingElement.style.display = displayMode;
        incomingElement.style.opacity = '0';
        incomingElement.style.position = 'absolute';
        incomingElement.style.width = '100%';
        
        targetHeight = incomingElement.offsetHeight;
        
        incomingElement.style.position = '';
        incomingElement.style.opacity = '';
        incomingElement.style.width = '';
      }

      // 3. Animate height
      container.style.height = targetHeight + 'px';

      if (incomingElement) {
        void incomingElement.offsetWidth; // Force reflow
        incomingElement.classList.add('fade-in');
      }

      // Wait for height transition
      await new Promise((resolve, reject) => {
        const cleanup = () => {
          container.style.height = '';
          container.style.overflow = '';
          container.style.transition = '';
          resolve();
        };
        
        container.addEventListener('transitionend', (e) => {
          if (e.propertyName === 'height' && e.target === container) {
            cleanup();
          }
        }, { once: true });
        
        // Fallback timeout in case transitionend fails
        const timeoutId = setTimeout(cleanup, 500);

        signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          // If aborted, we leave cleanup to the next run, but resolve immediately
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });

    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Transition error:', e);
      }
      // If aborted, leave the DOM state to the new transition taking over
    } finally {
      if (this.activeTransitions.get(container) === abortController) {
        this.activeTransitions.delete(container);
      }
    }
  }
}

export const transitionManager = new TransitionManager();

/**
 * Setup a click-outside and escape-key listener to close a panel.
 * @param {HTMLElement} panel - The panel to hide
 * @param {HTMLElement} triggerBtn - The button that opens the panel
 * @param {Function} onHide - Callback executed when hiding
 */
export function setupClickOutside(panel, triggerBtn, onHide) {
  document.addEventListener('click', (e) => {
    if (!triggerBtn.contains(e.target) && !panel.contains(e.target) && !panel.classList.contains('is-hidden')) {
      onHide();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.classList.contains('is-hidden')) {
      onHide();
      triggerBtn.focus();
    }
  });
}
