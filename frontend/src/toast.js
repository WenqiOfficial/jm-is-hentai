/**
 * Toast Notification System
 */

let toastContainer = null;

function initToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
}

const ICON_MAP = {
  'info': 'fa-solid fa-circle-info',
  'success': 'fa-solid fa-circle-check',
  'warning': 'fa-solid fa-triangle-exclamation',
  'error': 'fa-solid fa-circle-xmark'
};

const MAX_TOASTS = 5;

/**
 * Show a toast notification (XSS-safe: uses textContent, not innerHTML)
 * @param {string} message - The message to display
 * @param {string} type - 'info', 'success', 'warning', 'error'
 * @param {number} duration - Time in ms before auto-dismiss
 */
export function showToast(message, type = 'info', duration = 3000) {
  initToastContainer();

  // Enforce maximum toast count
  while (toastContainer.children.length >= MAX_TOASTS) {
    toastContainer.removeChild(toastContainer.firstChild);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';

  const icon = document.createElement('i');
  icon.className = `${ICON_MAP[type] || ICON_MAP.info} ${type}`;
  toast.appendChild(icon);

  const span = document.createElement('span');
  span.textContent = message;
  toast.appendChild(span);

  toastContainer.appendChild(toast);

  // Auto remove
  setTimeout(() => {
    toast.classList.add('hiding');
    // Wait for the slideOutRightToast animation to finish (300ms) before removing
    setTimeout(() => {
      if (toastContainer.contains(toast)) {
        toast.remove();
      }
    }, 300);
  }, duration);
}
