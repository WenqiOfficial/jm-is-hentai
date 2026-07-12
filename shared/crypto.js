/**
 * shared/crypto.js — Shared JMComic cryptographic utilities
 * 
 * Used by both frontend (jmcomic.js) and backend (worker/index.js).
 * Single source of truth for API secrets, token generation, and data decryption.
 */
import CryptoJS from 'crypto-js';

export const APP_TOKEN_SECRET = '18comicAPP';
export const APP_DATA_SECRET = '185Hcomic3PAPP7R';
export const APP_VERSION = '1.8.0';

export const API_DOMAIN_SERVER_SECRET = "diosfjckwpqpdfjkvnqQjsik";
export const API_DOMAIN_SERVER_URLS = [
  "https://rup4a04-c01.tos-ap-southeast-1.bytepluses.com/newsvr-2025.txt",
  "https://rup4a04-c02.tos-cn-hongkong.bytepluses.com/newsvr-2025.txt",
  "https://rup4a04-c03.tos-cn-beijing.bytepluses.com.cn/newsvr-2025.txt",
  "https://jmappc01-1308024008.cos.ap-guangzhou.myqcloud.com/server-2024.txt"
];

export const FALLBACK_API_SOURCES = [
  'www.cdnaspa.club',
  'www.cdnaspa.vip',
  'www.cdnplaystation6.cc',
  'www.cdnplaystation6.vip',
];

/**
 * Generate Token and Tokenparam for JMComic API
 */
export function getTokenWithTokenparam(ts, ver = APP_VERSION, secret = APP_TOKEN_SECRET) {
  const tokenparam = `${ts},${ver}`;
  const token = CryptoJS.MD5(`${ts}${secret}`).toString();
  return { token, tokenparam };
}

/**
 * Decrypt the AES ECB payload from JMComic
 */
export function decodeDataText(data, ts, secret = APP_DATA_SECRET) {
  const dataWordArray = CryptoJS.enc.Base64.parse(data);
  const token = CryptoJS.MD5(`${ts}${secret}`).toString();
  const tokenWordArray = CryptoJS.enc.Utf8.parse(token);

  const encrypted = CryptoJS.lib.CipherParams.create({
    ciphertext: dataWordArray,
  });

  const decrypted = CryptoJS.AES.decrypt(encrypted, tokenWordArray, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });

  return decrypted.toString(CryptoJS.enc.Utf8);
}

/**
 * Decrypt and parse JSON data from JMComic API response.
 * @throws {Error} If decryption or JSON parsing fails
 */
export function decodeJsonData(data, ts, secret) {
  const decodedString = decodeDataText(data, ts, secret);
  try {
    return JSON.parse(decodedString);
  } catch (e) {
    throw new Error(`解密数据 JSON 解析失败: ${e.message}`);
  }
}

/**
 * Strip non-ASCII prefixes from encrypted texts
 */
export const stripNonAsciiPrefix = (text) => {
  let result = text;
  while (result && result.charCodeAt(0) > 127) {
    result = result.slice(1);
  }
  return result;
};

/**
 * Normalize an API source domain
 */
export const normalizeApiSource = (source) => {
  const trimmed = source.trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).host;
  } catch {
    return trimmed.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
};

export const normalizeApiSources = (sources) => {
  return Array.from(new Set(sources.map(normalizeApiSource).filter(Boolean)));
};

let memoryCachedSources = null;
let lastMemoryFetchTime = 0;

/**
 * Fetch the latest API sources from the domain server texts.
 * Uses localStorage (in browser) or memory cache (in worker) for 1 hour.
 */
export const fetchLatestApiSources = async (timeout = 5000) => {
  const now = Date.now();
  const cacheKey = 'jmcomic_api_sources';
  const cacheTTL = 3600000; // 1 hour

  // Check memory cache first
  if (memoryCachedSources && now - lastMemoryFetchTime < cacheTTL) {
    return memoryCachedSources;
  }

  // Check localStorage (Browser only)
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = JSON.parse(localStorage.getItem(cacheKey));
      if (stored && stored.timestamp && now - stored.timestamp < cacheTTL) {
        memoryCachedSources = stored.sources;
        lastMemoryFetchTime = stored.timestamp;
        return stored.sources;
      }
    } catch (e) {
      // ignore localStorage errors
    }
  }

  for (const url of API_DOMAIN_SERVER_URLS) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
      if (!response.ok) continue;
      const encryptedText = stripNonAsciiPrefix(await response.text());
      const decodedText = decodeDataText(encryptedText, "", API_DOMAIN_SERVER_SECRET);
      const data = JSON.parse(decodedText);
      const sources = normalizeApiSources(data.Server ?? []);
      
      if (sources.length > 0) {
        memoryCachedSources = sources;
        lastMemoryFetchTime = now;
        
        // Save to localStorage if in browser
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(cacheKey, JSON.stringify({
            timestamp: now,
            sources: sources
          }));
        }
        return sources;
      }
    } catch (e) {
      // ignore error and try next URL
    }
  }
  
  return null;
};
