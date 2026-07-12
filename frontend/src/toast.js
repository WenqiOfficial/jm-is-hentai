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

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - 'info', 'success', 'warning', 'error'
 * @param {number} duration - Time in ms before auto-dismiss
 */
export function showToast(message, type = 'info', duration = 3000) {
  initToastContainer();

  const toast = document.createElement('div');
  toast.className = 'toast';

  const iconMap = {
    'info': 'fa-solid fa-circle-info',
    'success': 'fa-solid fa-circle-check',
    'warning': 'fa-solid fa-triangle-exclamation',
    'error': 'fa-solid fa-circle-xmark'
  };

  toast.innerHTML = `
    <i class="${iconMap[type]} ${type}"></i>
    <span>${message}</span>
  `;

  toastContainer.appendChild(toast);

  // Auto remove
  setTimeout(() => {
    toast.classList.add('hiding');
    // Wait for the slideOutRightToast animation to finish (600ms) before removing
    setTimeout(() => {
      if (toastContainer.contains(toast)) {
        toast.remove();
      }
    }, 600);
  }, duration);
}
