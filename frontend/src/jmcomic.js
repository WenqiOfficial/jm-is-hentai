import {
  FALLBACK_API_SOURCES,
  getTokenWithTokenparam,
  decodeJsonData,
} from '../../shared/crypto.js';

// Re-export for any consumers that import from here
export { FALLBACK_API_SOURCES };

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
      console.error('Proxy response parse error:', resText.substring(0, 100));
      throw new Error('代理返回了非 JSON 内容 (可能是被拦截或 Token 无效)');
    }
    
    if (resJson.code !== 200) throw new Error(`获取数据失败: ${resJson.message || resJson.code}`);
    return resJson.data; // Worker returns decrypted plain JSON data directly
  } else {
    // Direct frontend fetch (Requires CORS extension)
    const ts = Math.floor(Date.now() / 1000);
    const { token, tokenparam } = getTokenWithTokenparam(ts);
    
    let lastError = null;
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
            return decodeJsonData(resJson.data, ts);
          }
        }
      } catch (err) {
        lastError = err;
        continue;
      }
    }
    throw new Error(lastError ? `直连请求失败(请检查跨域): ${lastError.message}` : '所有备用域名均请求失败');
  }
}
