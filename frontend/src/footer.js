import { t } from './i18n.js';

const messages = [
  'footer.made_with_love',
  'footer.no_tracking'
];

let currentIndex = 0;

function initFooter() {
  const container = document.getElementById('footer-text-container');
  if (!container) return;

  // Render initial message
  updateFooterText();

  // Start rotation
  setInterval(rotateMessages, 4000);

  // Listen for language changes
  window.addEventListener('languageChanged', () => {
    updateFooterText(false); // Update without animating out
  });
}

function updateFooterText(animate = true) {
  const container = document.getElementById('footer-text-container');
  if (!container) return;

  const renderContent = () => {
    const key = messages[currentIndex];
    const text = t(key);
    
    if (key === 'footer.made_with_love') {
      // Restore the red heart icon for the original style
      container.innerHTML = `<i class="fa-solid fa-heart"></i> ${text.replace('❤️', '').trim()}`;
    } else {
      container.innerHTML = text;
    }
  };

  if (animate) {
    container.classList.remove('fade-in-up');
    container.classList.add('fade-out-up');
    
    setTimeout(() => {
      renderContent();
      container.classList.remove('fade-out-up');
      container.classList.add('fade-in-up');
    }, 400); // Wait for fade out
  } else {
    renderContent();
  }
}

function rotateMessages() {
  currentIndex = (currentIndex + 1) % messages.length;
  updateFooterText();
}

document.addEventListener('DOMContentLoaded', initFooter);
