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
