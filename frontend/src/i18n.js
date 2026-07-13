import { showToast } from './toast.js';
import { loadTagTranslations } from './tag-translator.js';
import { bindStorage } from './utils.js';
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
  const radios = document.querySelectorAll('input[name="language"]');
  const savedLang = bindStorage('app_lang', radios, 'auto', (val) => {
    const isRealChange = (val === 'auto' && !isAuto) || (val !== 'auto' && val !== currentLang);
    
    if (isRealChange) {
      window.dispatchEvent(new Event('showLoading'));
      setTimeout(() => {
        setLanguage(val);
        window.dispatchEvent(new Event('hideLoading'));
      }, 600);
    } else {
      setLanguage(val);
    }
  });

  if (savedLang && savedLang !== 'auto') {
    isAuto = false;
    currentLang = savedLang;
  } else {
    isAuto = true;
    detectLanguage();
  }

  applyTranslations();
  
  // Always load tag translations regardless of language
  loadTagTranslations();
}

/**
 * Set application language
 * @param {string} lang - 'auto', 'en', 'ja', 'zh' 
 */
export function setLanguage(lang) {
  if (lang === 'auto') {
    isAuto = true;
    detectLanguage();
  } else {
    isAuto = false;
    currentLang = lang;
  }
  
  applyTranslations();

  // Trigger tag DB download (needed for all languages due to bidirectional mapping)
  loadTagTranslations();

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
 * Get translated string with optional placeholder interpolation
 * @param {string} key - The translation key
 * @param {Object} [params] - Key-value pairs for `{placeholder}` replacement
 * @returns {string}
 */
export function t(key, params) {
  let text = translations[currentLang]?.[key] || translations['en']?.[key] || key;
  if (params && typeof text === 'string') {
    Object.keys(params).forEach(p => {
      text = text.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
    });
  }
  return text;
}

/**
 * Apply translations to DOM elements with data-i18n attributes.
 * Uses text-node replacement to preserve child elements (e.g. <i> icons).
 */
export function applyTranslations() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const paramsStr = el.getAttribute('data-i18n-params');
    let params = undefined;
    if (paramsStr) {
      try { params = JSON.parse(paramsStr); } catch(e) {}
    }
    const translated = t(key, params);

    // If the element has child elements (e.g., <i> icon + text),
    // only update the last text node to preserve the icon.
    if (el.children.length > 0) {
      const lastChild = el.lastChild;
      if (lastChild && lastChild.nodeType === Node.TEXT_NODE) {
        lastChild.textContent = ' ' + translated;
      } else {
        // Append a new text node if none exists
        el.appendChild(document.createTextNode(' ' + translated));
      }
    } else {
      el.textContent = translated;
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', t(key));
  });

    // Update titles for copy tooltips
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const paramsStr = el.getAttribute('data-i18n-title-params');
    let params = undefined;
    if (paramsStr) {
      try { params = JSON.parse(paramsStr); } catch(e) {}
    }
    el.setAttribute('title', t(key, params));
  });

  document.title = t('app.title');
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute('content', t('app.description'));
  }
}

/**
 * Helper to dynamically bind a translation key and params to a DOM element.
 * It sets the data attributes so i18n can automatically track it, and updates the text immediately.
 * @param {HTMLElement} el 
 * @param {string} key 
 * @param {Object} [params] 
 */
export function setI18nText(el, key, params) {
  el.setAttribute('data-i18n', key);
  if (params) {
    el.setAttribute('data-i18n-params', JSON.stringify(params));
  } else {
    el.removeAttribute('data-i18n-params');
  }
  
  const translated = t(key, params);
  if (el.children.length > 0) {
    const lastChild = el.lastChild;
    if (lastChild && lastChild.nodeType === Node.TEXT_NODE) {
      lastChild.textContent = ' ' + translated;
    } else {
      el.appendChild(document.createTextNode(' ' + translated));
    }
  } else {
    el.textContent = translated;
  }
}

/**
 * Helper to dynamically set a placeholder translation
 * @param {HTMLInputElement} el 
 * @param {string} key 
 */
export function setI18nPlaceholder(el, key) {
  el.setAttribute('data-i18n-placeholder', key);
  el.setAttribute('placeholder', t(key));
}

/**
 * Helper to dynamically bind a translation key and params to a DOM element's title attribute.
 * @param {HTMLElement} el 
 * @param {string} key 
 * @param {Object} [params] 
 */
export function setI18nTitle(el, key, params) {
  el.setAttribute('data-i18n-title', key);
  if (params) {
    el.setAttribute('data-i18n-title-params', JSON.stringify(params));
  } else {
    el.removeAttribute('data-i18n-title-params');
  }
  el.setAttribute('title', t(key, params));
}

/**
 * Standardized I18n Error for decoupled error throwing
 */
export class I18nError extends Error {
  constructor(key, params) {
    super(t(key, params)); // Maintain standard message for debugging/fallback
    this.name = 'I18nError';
    this.i18nKey = key;
    this.i18nParams = params;
  }
}
