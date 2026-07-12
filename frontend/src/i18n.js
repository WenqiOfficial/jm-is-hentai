import { showToast } from './toast.js';
import { loadTagTranslations } from './tag-translator.js';
import en from './i18n/en.json';
import zh from './i18n/zh.json';
import ja from './i18n/ja.json';

const translations = { en, zh, ja };

let currentLang = 'zh';
let isAuto = true;

/**
 * Initialize internationalization
 */
export function initI18n() {
  const savedLang = localStorage.getItem('app_lang');
  
  if (savedLang && savedLang !== 'auto') {
    isAuto = false;
    currentLang = savedLang;
  } else {
    isAuto = true;
    detectLanguage();
  }

  // Update UI radio buttons
  const radios = document.querySelectorAll('input[name="language"]');
  radios.forEach(radio => {
    if ((isAuto && radio.value === 'auto') || (!isAuto && radio.value === currentLang)) {
      radio.checked = true;
    }
    
    radio.addEventListener('change', (e) => {
      const val = e.target.value;
      setLanguage(val);
    });
  });

  applyTranslations();
}

/**
 * Set application language
 * @param {string} lang - 'auto', 'en', 'ja', 'zh' 
 */
export function setLanguage(lang) {
  if (lang === 'auto') {
    isAuto = true;
    localStorage.removeItem('app_lang');
    detectLanguage();
  } else {
    isAuto = false;
    currentLang = lang;
    localStorage.setItem('app_lang', lang);
  }
  
  applyTranslations();

  // If Chinese is selected (auto or manual), trigger tag DB download
  if (currentLang === 'zh') {
    loadTagTranslations();
  }

  // Dispatch event so other components can re-render if needed
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: currentLang } }));
}

export function getCurrentLang() {
  return currentLang;
}

function detectLanguage() {
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('zh')) {
    currentLang = 'zh';
  } else if (browserLang.startsWith('ja')) {
    currentLang = 'ja';
  } else {
    currentLang = 'en';
  }
}

/**
 * Get translated string
 * @param {string} key 
 * @returns {string}
 */
export function t(key) {
  return translations[currentLang]?.[key] || translations['en']?.[key] || key;
}

/**
 * Apply translations to DOM elements with data-i18n attributes
 */
export function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', t(key));
  });
}
