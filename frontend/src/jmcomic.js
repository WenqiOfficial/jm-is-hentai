import CryptoJS from 'crypto-js';

const APP_TOKEN_SECRET = '18comicAPP';
const APP_DATA_SECRET = '185Hcomic3PAPP7R';
const APP_VERSION = '1.8.0';

export const FALLBACK_API_SOURCES = [
  'www.cdnaspa.vip',
  'www.cdnaspa.club',
  'www.cdnplaystation6.cc',
  'www.cdnplaystation6.vip',
];

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
 * Fetch Album Info
 * mode: 'api' (use Worker Proxy) | 'frontend' (direct fetch)
 */
export async function fetchAlbumInfo(jmId, mode = 'api') {
  if (mode === 'api') {
    // Via Cloudflare Worker proxy
    const response = await fetch(`/api/jmcomic/${jmId}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    if (!response.ok) {
      throw new Error(`请求代理失败: ${response.status}`);
    }
    const resText = await response.text();
    let resJson;
    try {
      resJson = JSON.parse(resText);
    } catch (e) {
      throw new Error(`代理返回了非 JSON 内容 (可能是被拦截或 Token 无效): ${resText.substring(0, 50)}...`);
    }
    
    if (resJson.code !== 200) throw new Error(`获取数据失败: ${resJson.message || resJson.code}`);
    return resJson.data; // Note: Worker now returns decrypted plain JSON data directly
  } else {
    // Direct frontend fetch (Requires CORS extension)
    const ts = Math.floor(Date.now() / 1000);
    const { token, tokenparam } = getTokenWithTokenparam(ts);
    
    let rawData = null;
    let lastError = null;
    let success = false;
    for (const domain of FALLBACK_API_SOURCES) {
      try {
        const response = await fetch(`https://${domain}/album?id=${jmId}`, {
          headers: {
            'token': token,
            'tokenparam': tokenparam,
            'Accept': 'application/json'
          }
        });
        if (response.ok) {
          const resJson = await response.json();
          if (resJson.code === 200 && resJson.data) {
            rawData = resJson.data;
            success = true;
            break;
          }
        }
      } catch (err) {
        lastError = err;
        continue;
      }
    }
    if (!success) {
      throw new Error(lastError ? `直连请求失败(请检查跨域): ${lastError.message}` : '所有备用域名均请求失败');
    }

    // Decrypt data
    if (rawData) {
      return decodeJsonData(rawData, ts);
    } else {
      throw new Error('未获取到有效数据');
    }
  }
}
