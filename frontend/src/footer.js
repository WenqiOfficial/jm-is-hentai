import { t } from './i18n.js';

const messages = [
  'footer.made_with_love',
  'footer.no_tracking'
];

let currentIndex = 0;
let rotationTimer = null;

function initFooter() {
  const container = document.getElementById('footer-text-container');
  if (!container) return;

  // Render initial message
  updateFooterText();

  // Listen for language changes
  window.addEventListener('languageChanged', () => {
    updateFooterText(false); // Update without animating out
  });
}

function getDurationForText(htmlText) {
  // Strip HTML tags to get actual text length
  const text = htmlText.replace(/<[^>]*>/g, '').trim();
  
  // "Made with ❤️" length is roughly 12 chars, which serves as our 7-second baseline.
  // 7000ms / 12 chars ≈ 583ms per character.
  // We apply a minimum duration of 4s just to be safe for very short strings.
  const msPerChar = 7000 / 12;
  return Math.max(4000, text.length * msPerChar);
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
      scheduleNextRotation(container.innerHTML);
    }, 400); // Wait for fade out
  } else {
    renderContent();
    scheduleNextRotation(container.innerHTML);
  }
}

function scheduleNextRotation(currentHtml) {
  if (rotationTimer) {
    clearTimeout(rotationTimer);
  }
  const duration = getDurationForText(currentHtml);
  rotationTimer = setTimeout(rotateMessages, duration);
}

function rotateMessages() {
  currentIndex = (currentIndex + 1) % messages.length;
  updateFooterText();
}

document.addEventListener('DOMContentLoaded', initFooter);
