import CryptoJS from 'crypto-js';

const APP_TOKEN_SECRET = '18comicAPP';
const APP_DATA_SECRET = '185Hcomic3PAPP7R';
const APP_VERSION = '1.8.0';

/**
 * Generate Token and Tokenparam for JMComic API
 */
export function getTokenWithTokenparam(ts, ver = APP_VERSION, secret = APP_TOKEN_SECRET) {
  const tokenparam = `${ts},${ver}`;
  const token = CryptoJS.MD5(`${ts}${secret}`).toString();
  return {
    token,
    tokenparam,
  };
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

export function decodeJsonData(data, ts) {
  const decodedString = decodeDataText(data, ts);
  return JSON.parse(decodedString);
}

/**
 * Fetch Album Info directly via our Worker proxy
 */
export async function fetchAlbumInfo(jmId) {
  const ts = Math.floor(Date.now() / 1000);
  const { token, tokenparam } = getTokenWithTokenparam(ts);
  
  // Note: we fetch through our proxy. The proxy forwards the request to the target domain.
  // We can pass token headers to our proxy, and the proxy will forward them.
  const response = await fetch(`/api/jmcomic/${jmId}`, {
    headers: {
      'token': token,
      'tokenparam': tokenparam
    }
  });

  if (!response.ok) {
    throw new Error(`请求失败: ${response.status}`);
  }

  const resJson = await response.json();
  
  // Decrypt data
  if (resJson.code === 200 && resJson.data) {
    return decodeJsonData(resJson.data, ts);
  } else {
    throw new Error(`获取数据失败, Code: ${resJson.code}`);
  }
}
