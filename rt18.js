// ==UserScript==
// @name         18Comic 之路
// @namespace    https://github.com/zyf722
// @version      1.1
// @author       zyf722
// @description  JM / 18Comic 车牌号划词查询工具
// @license      MIT
// @icon         https://www.google.com/s2/favicons?sz=64&domain=18comic.vip
// @match        *://weibo.com/*
// @match        *://*.weibo.com/*
// @match        *://*.weibo.cn/*
// @match        *://tieba.baidu.com/*
// @match        *://*.bilibili.com/
// @match        *://*.bilibili.com/*
// @match        *://localhost/*
// @require      https://cdn.jsdelivr.net/npm/crypto-js@4.2.0/crypto-js.js
// @connect      *
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @downloadURL https://update.greasyfork.org/scripts/487982/18Comic%20%E4%B9%8B%E8%B7%AF.user.js
// @updateURL https://update.greasyfork.org/scripts/487982/18Comic%20%E4%B9%8B%E8%B7%AF.meta.js
// ==/UserScript==

(o=>{if(typeof GM_addStyle=="function"){GM_addStyle(o);return}const e=document.createElement("style");e.textContent=o,document.head.append(e)})(" .jm-select-none,.jm-select-none *{-webkit-touch-callout:none;-webkit-user-select:none;-khtml-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none}.jm-overflow{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#jm-popup{position:absolute;background-color:#fff;padding:10px;margin-top:10px;border:1px solid #ddd;box-shadow:0 4px 8px #0003;z-index:999999999999;display:none;max-width:25%;column-gap:10px;align-items:center}.jm-title{max-width:100%;font-size:14px;grid-column:1;grid-row:2}#jm-title-text{display:none}#jm-number-container{max-width:100%;grid-column:1;grid-row:1;display:flex;align-items:center}#jm-number{font-size:18px;font-weight:700}#jm-number-icon{width:16px;height:16px;margin-right:5px}#jm-copy{border:none;background-color:#fff;width:32px;height:32px;font-size:16px;cursor:pointer;grid-column:2;grid-row:1 / 3;transition:background-color .3s;display:flex;align-items:center;justify-content:center}#jm-copy:hover:not(:disabled){background-color:#f6f6f6}#jm-copy:active:not(:disabled){background-color:#e6e6e6}#jm-copy-icon{width:16px;height:16px;transition:opacity .25s}.jm-copy-icon-hide{opacity:0}#jm-details-container{grid-column:1 / span 2;grid-row:3;display:grid;gap:5px;font-size:12px;margin-top:10px;border-top:1px solid #eee;padding-top:10px}.jm-detail-row{display:contents}.jm-detail-row>span{padding:2px 0}.jm-detail-label{font-weight:700;color:#555;white-space:nowrap}.jm-detail-value{color:#333}.jm-tags-container{display:flex;flex-wrap:wrap;gap:4px}.jm-tag-item{vertical-align:middle;background:#00000012;color:#777;font-size:12px;line-height:16px;display:inline-block;padding:0 3px;margin:-2px 0 0 2px;border-radius:2px;letter-spacing:-.6px;bottom:0}#rt18-config-dialog-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background-color:#00000080;display:flex;justify-content:center;align-items:center;z-index:9999}#rt18-config-dialog{background-color:#fff;padding:20px;border-radius:8px;box-shadow:0 4px 12px #00000026;width:500px;max-width:90%;position:relative}.rt18-config-close-button{position:absolute;top:10px;right:10px;background:none;border:none;font-size:1.5em;cursor:pointer}.rt18-config-section{margin-top:10px;margin-bottom:10px;display:flex;flex-direction:column;gap:10px}#rt18-source-list{list-style:none;padding:0;max-height:200px;overflow-y:auto;border:1px solid #ddd;border-radius:4px}#rt18-source-list li{padding:8px 12px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center}.rt18-source-text{flex-grow:1;margin-right:10px}.rt18-source-text.success{color:green;font-weight:700}.rt18-source-text.failure{color:red;font-weight:700}.rt18-source-controls{display:flex;align-items:center}.rt18-source-actions{display:flex;gap:8px;align-items:center}.rt18-config-button{padding:4px 8px;font-size:.9em;cursor:pointer;border:1px solid #ccc;border-radius:3px;background-color:#f0f0f0;display:inline-flex;align-items:center;justify-content:center;min-width:20px;text-align:center;color:inherit}.rt18-config-button:hover:not(:disabled){background-color:#e0e0e0}.rt18-config-button:disabled{opacity:.6;cursor:not-allowed}.rt18-source-button{margin-left:5px}.rt18-source-button-delete{background-color:#f8d7da;color:#721c24;border-color:#f5c6cb}.rt18-source-button-delete:hover{background-color:#f1b0b7}.rt18-button-disabled{opacity:.5;cursor:not-allowed;background-color:#e9ecef}.rt18-button-disabled:hover{background-color:#e9ecef}.rt18-add-source-container{display:flex;margin-top:10px}#rt18-add-source-input{flex-grow:1;padding:8px;border:1px solid #ccc;border-radius:4px 0 0 4px}#rt18-add-source-btn{padding:8px 15px;border:1px solid #ccc;border-left:none;background-color:#007bff;color:#fff;cursor:pointer;border-radius:0 4px 4px 0;display:inline-flex;align-items:center;justify-content:center}#rt18-add-source-btn:hover{background-color:#0056b3}.rt18-config-input{width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box}.rt18-config-description{font-size:.9em;color:#666;margin-top:0} ");

(function (CryptoJS) {
  'use strict';

  const loadingIcon = "data:image/svg+xml,%3csvg%20viewBox='0%200%201024%201024'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M512%20170.666667a341.333333%20341.333333%200%201%200%200%20682.666666%20341.333333%20341.333333%200%200%200%200-682.666666zM85.333333%20512C85.333333%20276.352%20276.352%2085.333333%20512%2085.333333s426.666667%20191.018667%20426.666667%20426.666667-191.018667%20426.666667-426.666667%20426.666667S85.333333%20747.648%2085.333333%20512z%20m426.666667-256a42.666667%2042.666667%200%200%201%2042.666667%2042.666667v195.669333l115.498666%20115.498667a42.666667%2042.666667%200%200%201-60.330666%2060.330666l-128-128A42.666667%2042.666667%200%200%201%20469.333333%20512V298.666667a42.666667%2042.666667%200%200%201%2042.666667-42.666667z'%20fill='currentColor'/%3e%3c/svg%3e";
  const failIcon = "data:image/svg+xml,%3csvg%20viewBox='0%200%201024%201024'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M512%2097.52381c228.912762%200%20414.47619%20185.563429%20414.47619%20414.47619s-185.563429%20414.47619-414.47619%20414.47619S97.52381%20740.912762%2097.52381%20512%20283.087238%2097.52381%20512%2097.52381z%20m0%2073.142857C323.486476%20170.666667%20170.666667%20323.486476%20170.666667%20512s152.81981%20341.333333%20341.333333%20341.333333%20341.333333-152.81981%20341.333333-341.333333S700.513524%20170.666667%20512%20170.666667z%20m129.29219%20160.304762l51.736381%2051.736381L563.687619%20512l129.316571%20129.29219-51.73638%2051.736381L512%20563.687619l-129.29219%20129.316571-51.736381-51.73638L460.312381%20512l-129.316571-129.26781%2051.73638-51.73638L512%20460.263619l129.26781-129.29219z'%20fill='currentColor'/%3e%3c/svg%3e";
  const successIcon = "data:image/svg+xml,%3csvg%20viewBox='0%200%201024%201024'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M512%2097.52381c228.912762%200%20414.47619%20185.563429%20414.47619%20414.47619s-185.563429%20414.47619-414.47619%20414.47619S97.52381%20740.912762%2097.52381%20512%20283.087238%2097.52381%20512%2097.52381z%20m0%2073.142857C323.486476%20170.666667%20170.666667%20323.486476%20170.666667%20512s152.81981%20341.333333%20341.333333%20341.333333%20341.333333-152.81981%20341.333333-341.333333S700.513524%20170.666667%20512%20170.666667z%20m193.194667%20145.188571l52.467809%2050.956191-310.662095%20319.683047-156.379429-162.230857%2052.662858-50.761143%20103.936%20107.812572%20257.974857-265.45981z'%20fill='currentColor'/%3e%3c/svg%3e";
  const warningIcon = "data:image/svg+xml,%3csvg%20viewBox='0%200%201024%201024'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M545.718857%20130.608762c11.337143%206.265905%2020.699429%2015.555048%2026.989714%2026.819048l345.014858%20617.667047a68.87619%2068.87619%200%200%201-26.989715%2093.915429c-10.313143%205.705143-21.942857%208.704-33.718857%208.704H166.985143A69.266286%2069.266286%200%200%201%2097.52381%20808.643048c0-11.751619%202.998857-23.28381%208.752761-33.548191l344.990477-617.642667a69.656381%2069.656381%200%200%201%2094.451809-26.819047zM512%20191.000381L166.985143%20808.643048H856.990476L512%20191.000381zM546.718476%20670.47619v69.071239h-69.461333V670.47619h69.485714z%20m0-298.374095v252.318476h-69.461333V372.102095h69.485714z'%20fill='currentColor'/%3e%3c/svg%3e";
  const doneIcon = "data:image/svg+xml,%3csvg%20viewBox='0%200%201024%201024'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M512%2016C238.066%2016%2016%20238.066%2016%20512s222.066%20496%20496%20496%20496-222.066%20496-496S785.934%2016%20512%2016z%20m0%2096c221.064%200%20400%20178.902%20400%20400%200%20221.064-178.902%20400-400%20400-221.064%200-400-178.902-400-400%200-221.064%20178.902-400%20400-400m280.408%20260.534l-45.072-45.436c-9.334-9.41-24.53-9.472-33.94-0.136L430.692%20607.394l-119.584-120.554c-9.334-9.41-24.53-9.472-33.94-0.138l-45.438%2045.072c-9.41%209.334-9.472%2024.53-0.136%2033.942l181.562%20183.032c9.334%209.41%2024.53%209.472%2033.94%200.136l345.178-342.408c9.408-9.336%209.468-24.532%200.134-33.942z'%20fill='currentColor'/%3e%3c/svg%3e";
  const copyIcon = "data:image/svg+xml,%3csvg%20viewBox='0%200%201024%201024'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M931.882%20131.882l-103.764-103.764A96%2096%200%200%200%20760.236%200H416c-53.02%200-96%2042.98-96%2096v96H160c-53.02%200-96%2042.98-96%2096v640c0%2053.02%2042.98%2096%2096%2096h448c53.02%200%2096-42.98%2096-96v-96h160c53.02%200%2096-42.98%2096-96V199.764a96%2096%200%200%200-28.118-67.882zM596%20928H172a12%2012%200%200%201-12-12V300a12%2012%200%200%201%2012-12h148v448c0%2053.02%2042.98%2096%2096%2096h192v84a12%2012%200%200%201-12%2012z%20m256-192H428a12%2012%200%200%201-12-12V108a12%2012%200%200%201%2012-12h212v176c0%2026.51%2021.49%2048%2048%2048h176v404a12%2012%200%200%201-12%2012z%20m12-512h-128V96h19.264c3.182%200%206.234%201.264%208.486%203.514l96.736%2096.736a12%2012%200%200%201%203.514%208.486V224z'%20fill='currentColor'/%3e%3c/svg%3e";
  const uiHtml = '<div id="jm-popup" class="jm-select-none" style="display: none;">\r\n  <div id="jm-number-container">\r\n    <div id="jm-number-icon"></div>\r\n    <div id="jm-number" class="jm-overflow"></div>\r\n  </div>\r\n  <a id="jm-title-text" class="jm-overflow jm-title" target="_blank" rel="noopener noreferrer" style="display: none;"></a>\r\n  <div id="jm-title-loading" class="jm-title">加载中...</div>\r\n  <div id="jm-details-container" style="display: none;"></div>\r\n  <button id="jm-copy" title="复制漫画名" disabled>\r\n    <div id="jm-copy-icon"></div>\r\n  </button>\r\n</div>\r\n';
  var _GM_registerMenuCommand = /* @__PURE__ */ (() => typeof GM_registerMenuCommand != "undefined" ? GM_registerMenuCommand : void 0)();
  var _GM_setClipboard = /* @__PURE__ */ (() => typeof GM_setClipboard != "undefined" ? GM_setClipboard : void 0)();
  var _GM_xmlhttpRequest = /* @__PURE__ */ (() => typeof GM_xmlhttpRequest != "undefined" ? GM_xmlhttpRequest : void 0)();
  const APP_TOKEN_SECRET = "18comicAPP";
  const APP_DATA_SECRET = "185Hcomic3PAPP7R";
  const APP_VERSION = "1.8.0";
  const API_DOMAIN_SERVER_SECRET = "diosfjckwpqpdfjkvnqQjsik";
  const API_DOMAIN_SERVER_URLS = [
    "https://rup4a04-c01.tos-ap-southeast-1.bytepluses.com/newsvr-2025.txt",
    "https://rup4a04-c02.tos-cn-hongkong.bytepluses.com/newsvr-2025.txt",
    "https://rup4a04-c03.tos-cn-beijing.bytepluses.com.cn/newsvr-2025.txt",
    "https://jmappc01-1308024008.cos.ap-guangzhou.myqcloud.com/server-2024.txt"
  ];
  const FALLBACK_API_SOURCES = [
    "www.cdnaspa.club",
    "www.cdnaspa.vip",
    "www.cdnplaystation6.cc",
    "www.cdnplaystation6.vip"
  ];
  const LEGACY_DEFAULT_API_SOURCE_SETS = [
    FALLBACK_API_SOURCES,
    ["www.cdnmhwscc.vip", "www.cdnblackmyth.club", "www.cdnmhws.cc", "www.cdnuc.vip"],
    [
      "www.cdnmhwscc.vip",
      "www.cdnplaystation6.club",
      "www.cdnplaystation6.org",
      "www.cdnuc.vip",
      "www.cdn-mspjmapiproxy.xyz"
    ]
  ];
  const getTokenWithTokenparam = (ts, ver = APP_VERSION, secret = APP_TOKEN_SECRET) => {
    const tokenparam = `${ts},${ver}`;
    const token = CryptoJS.MD5(`${ts}${secret}`).toString();
    return {
      token,
      tokenparam
    };
  };
  const decodeDataText = (data, ts, secret = APP_DATA_SECRET) => {
    const dataWordArray = CryptoJS.enc.Base64.parse(data);
    const token = CryptoJS.MD5(`${ts}${secret}`).toString();
    const tokenWordArray = CryptoJS.enc.Utf8.parse(token);
    const encrypted = CryptoJS.lib.CipherParams.create({
      ciphertext: dataWordArray
    });
    const decrypted = CryptoJS.AES.decrypt(encrypted, tokenWordArray, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
  };
  const decodeJsonData = (data, ts, secret) => {
    return JSON.parse(decodeDataText(data, ts, secret));
  };
  const requestText = (url, timeout, headers) => {
    return new Promise((resolve, reject) => {
      _GM_xmlhttpRequest({
        method: "GET",
        url,
        timeout,
        headers,
        onload: (gmResponse) => {
          if (gmResponse.status && gmResponse.status >= 400) {
            reject(new Error(`HTTP ${gmResponse.status}`));
            return;
          }
          resolve(gmResponse.responseText);
        },
        onerror: () => reject(new Error("request failed")),
        ontimeout: () => reject(new Error("request timeout"))
      });
    });
  };
  const stripNonAsciiPrefix = (text) => {
    let result = text;
    while (result && result.charCodeAt(0) > 127) {
      result = result.slice(1);
    }
    return result;
  };
  const normalizeApiSource = (source) => {
    const trimmed = source.trim();
    if (!trimmed) return "";
    try {
      return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).host;
    } catch {
      return trimmed.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    }
  };
  const normalizeApiSources = (sources) => {
    return Array.from(new Set(sources.map(normalizeApiSource).filter(Boolean)));
  };
  const isDefaultApiSources = (sources) => {
    const normalized = normalizeApiSources(sources).sort();
    return LEGACY_DEFAULT_API_SOURCE_SETS.some((defaults) => {
      const normalizedDefaults = normalizeApiSources(defaults).sort();
      return normalized.length === normalizedDefaults.length && normalized.every((source, index) => source === normalizedDefaults[index]);
    });
  };
  const fetchLatestApiSources = async (timeout = 1e4) => {
    for (const url of API_DOMAIN_SERVER_URLS) {
      try {
        const encryptedText = stripNonAsciiPrefix(await requestText(url, timeout));
        const decodedText = decodeDataText(encryptedText, "", API_DOMAIN_SERVER_SECRET);
        const data = JSON.parse(decodedText);
        const sources = normalizeApiSources(data.Server ?? []);
        if (sources.length > 0) {
          return sources;
        }
      } catch {
      }
    }
    return null;
  };
  const JMFetchAlbumInfo = (jmSite, jmId, callback, options = {}) => {
    const timestamp = Math.floor(Date.now() / 1e3);
    _GM_xmlhttpRequest({
      method: "GET",
      url: `https://${normalizeApiSource(jmSite)}/album?id=${jmId}`,
      timeout: options.timeout ?? 5e3,
      headers: {
        ...getTokenWithTokenparam(timestamp),
        "Accept-Encoding": "gzip, deflate",
        "User-Agent": navigator.userAgent
      },
      onload: (gmResponse) => {
        try {
          const resp = JSON.parse(gmResponse.responseText);
          const album = decodeJsonData(resp.data, timestamp);
          callback(album);
        } catch {
          callback(null);
        }
      },
      onerror: () => callback(null),
      ontimeout: () => callback(null)
    });
  };
  const configHtml = '<div id="rt18-config-dialog-overlay">\n  <div id="rt18-config-dialog">\n    <h2>18Comic 之路配置</h2>\n    <button id="rt18-config-close-btn" class="rt18-config-close-button">×</button>\n    <div class="rt18-config-section">\n      <h3>API 线路配置</h3>\n      <ul id="rt18-source-list"></ul>\n      <div class="rt18-add-source-container">\n        <input type="text" id="rt18-add-source-input" placeholder="输入新线路域名" />\n        <div id="rt18-add-source-btn">添加线路</div>\n      </div>\n      <div class="rt18-source-actions">\n        <button type="button" id="rt18-refresh-sources-btn" class="rt18-config-button">\n          刷新最新线路\n        </button>\n        <button type="button" id="rt18-test-sources-btn" class="rt18-config-button">\n          测试所有源\n        </button>\n      </div>\n      <p class="rt18-config-description">\n        脚本运行时将按照配置的 API 线路顺序获取车牌对应信息，直到成功获取为止。\n      </p>\n    </div>\n    <div class="rt18-config-section">\n      <h3>API 请求超时配置</h3>\n      <input\n        type="number"\n        id="rt18-config-timeout-input"\n        class="rt18-config-input"\n        min="1000"\n        step="1000"\n      />\n      <p class="rt18-config-description">网络请求的超时时间，单位为毫秒。</p>\n    </div>\n    <div class="rt18-config-section">\n      <h3>JM 网站线路</h3>\n      <input\n        type="url"\n        id="rt18-config-jm-url-input"\n        class="rt18-config-input"\n        placeholder="例如: https://18comic.vip"\n      />\n      <p class="rt18-config-description">\n        用于拼接最终跳转的 18Comic / JM 网站地址。可访问\n        <a href="https://jmcomic-fb.vip" target="_blank" rel="noopener noreferrer"\n          >jmcomic-fb.vip</a\n        >\n        获取最新线路。\n      </p>\n    </div>\n    <div class="rt18-config-section">\n      <h3>布局选择</h3>\n      <select id="rt18-config-layout-select" class="rt18-config-input">\n        <option value="details">详细布局（显示漫画详细信息）</option>\n        <option value="compact">紧凑布局（旧版布局，仅显示漫画名称）</option>\n      </select>\n      <p class="rt18-config-description">漫画浮窗窗口的布局样式。</p>\n    </div>\n  </div>\n</div>\n';
  const CONFIG_STORAGE_KEY = "rt18_config";
  const defaultConfig = {
    sources: [...FALLBACK_API_SOURCES],
    timeout: 5e3,
    jmWebsiteUrl: "https://18comic.vip",
    layout: "details"
  };
  let hasTriedAutoRefreshSources = false;
  let autoRefreshSourcesPromise = null;
  const normalizeConfig = (candidate) => {
    const timeout = typeof candidate.timeout === "number" && candidate.timeout > 0 ? candidate.timeout : defaultConfig.timeout;
    return {
      sources: Array.isArray(candidate.sources) ? normalizeApiSources(candidate.sources) : [...defaultConfig.sources],
      timeout,
      jmWebsiteUrl: typeof candidate.jmWebsiteUrl === "string" && candidate.jmWebsiteUrl.trim() ? candidate.jmWebsiteUrl : defaultConfig.jmWebsiteUrl,
      layout: candidate.layout === "compact" || candidate.layout === "details" ? candidate.layout : defaultConfig.layout
    };
  };
  const loadConfig = () => {
    try {
      const configString = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (configString) {
        return normalizeConfig(JSON.parse(configString));
      }
    } catch {
      localStorage.removeItem(CONFIG_STORAGE_KEY);
    }
    return { ...defaultConfig, sources: [...defaultConfig.sources] };
  };
  const config = loadConfig();
  let isConfigDialogOpen = false;
  const saveConfig = () => {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  };
  const getSourceRefreshTimeout = () => Math.min(Math.max(config.timeout, 3e3), 1e4);
  const refreshLatestApiSources = async () => {
    if (!autoRefreshSourcesPromise) {
      autoRefreshSourcesPromise = fetchLatestApiSources(getSourceRefreshTimeout()).finally(() => {
        autoRefreshSourcesPromise = null;
      });
    }
    return autoRefreshSourcesPromise;
  };
  const resolveApiSources = async (forceRefresh = false) => {
    const shouldRefresh = forceRefresh || !hasTriedAutoRefreshSources && (config.sources.length === 0 || isDefaultApiSources(config.sources));
    if (shouldRefresh) {
      hasTriedAutoRefreshSources = true;
      const latestSources = await refreshLatestApiSources();
      if (latestSources && latestSources.length > 0) {
        config.sources = latestSources;
        saveConfig();
        return latestSources;
      }
    }
    if (config.sources.length > 0) {
      return config.sources;
    }
    return [...FALLBACK_API_SOURCES];
  };
  const resetConfig = () => {
    if (confirm("确定要重置所有配置吗？")) {
      localStorage.removeItem(CONFIG_STORAGE_KEY);
      alert("配置已重置为默认值，请刷新页面以应用更改。");
    }
  };
  const openConfigDialog$1 = () => {
    const dialogContainerId = "rt18-config-dialog-container";
    let dialogContainer = document.getElementById(dialogContainerId);
    if (dialogContainer) {
      dialogContainer.style.display = "flex";
      isConfigDialogOpen = true;
      return;
    }
    dialogContainer = document.createElement("div");
    dialogContainer.id = dialogContainerId;
    dialogContainer.innerHTML = configHtml;
    document.body.appendChild(dialogContainer);
    isConfigDialogOpen = true;
    const closeButton = document.getElementById("rt18-config-close-btn");
    const sourceList = document.getElementById("rt18-source-list");
    const addSourceInput = document.getElementById("rt18-add-source-input");
    const addSourceButton = document.getElementById("rt18-add-source-btn");
    const timeoutInput = document.getElementById("rt18-config-timeout-input");
    const jmWebsiteUrlInput = document.getElementById("rt18-config-jm-url-input");
    const layoutSelect = document.getElementById("rt18-config-layout-select");
    const refreshSourcesButton = document.getElementById(
      "rt18-refresh-sources-btn"
    );
    const testSourcesButton = document.getElementById("rt18-test-sources-btn");
    if (timeoutInput) {
      timeoutInput.value = String(config.timeout);
      timeoutInput.addEventListener("change", () => {
        const newTimeout = parseInt(timeoutInput.value, 10);
        if (!isNaN(newTimeout) && newTimeout > 0) {
          config.timeout = newTimeout;
          saveConfig();
        } else {
          timeoutInput.value = String(config.timeout);
          alert("请输入有效的超时毫秒数。");
        }
      });
    }
    if (jmWebsiteUrlInput) {
      jmWebsiteUrlInput.value = config.jmWebsiteUrl;
      jmWebsiteUrlInput.addEventListener("change", () => {
        const newUrl = jmWebsiteUrlInput.value.trim();
        if (!newUrl) {
          jmWebsiteUrlInput.value = config.jmWebsiteUrl;
          alert("URL 不能为空。");
          return;
        }
        try {
          new URL(newUrl);
          config.jmWebsiteUrl = newUrl;
          saveConfig();
        } catch {
          jmWebsiteUrlInput.value = config.jmWebsiteUrl;
          alert("请输入有效的 URL。");
        }
      });
    }
    if (layoutSelect) {
      layoutSelect.value = config.layout;
      layoutSelect.addEventListener("change", () => {
        const newLayout = layoutSelect.value;
        if (newLayout === "compact" || newLayout === "details") {
          config.layout = newLayout;
          saveConfig();
        } else {
          layoutSelect.value = config.layout;
        }
      });
    }
    const renderSourceList = () => {
      sourceList.innerHTML = "";
      config.sources.forEach((source, index) => {
        const listItem = document.createElement("li");
        listItem.className = "rt18-source-list-item";
        const sourceText = document.createElement("span");
        sourceText.className = "rt18-source-text";
        sourceText.textContent = source;
        listItem.appendChild(sourceText);
        const controlsContainer = document.createElement("div");
        controlsContainer.className = "rt18-source-controls";
        const upButton = document.createElement("button");
        upButton.type = "button";
        upButton.className = "rt18-config-button rt18-source-button";
        upButton.textContent = "↑";
        if (index === 0) {
          upButton.disabled = true;
        } else {
          upButton.addEventListener("click", () => {
            const temp = config.sources[index];
            config.sources[index] = config.sources[index - 1];
            config.sources[index - 1] = temp;
            saveConfig();
            renderSourceList();
          });
        }
        const downButton = document.createElement("button");
        downButton.type = "button";
        downButton.className = "rt18-config-button rt18-source-button";
        downButton.textContent = "↓";
        if (index === config.sources.length - 1) {
          downButton.disabled = true;
        } else {
          downButton.addEventListener("click", () => {
            const temp = config.sources[index];
            config.sources[index] = config.sources[index + 1];
            config.sources[index + 1] = temp;
            saveConfig();
            renderSourceList();
          });
        }
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "rt18-config-button rt18-source-button rt18-source-button-delete";
        deleteButton.textContent = "删除";
        deleteButton.addEventListener("click", () => {
          if (confirm(`确定删除源 "${source}" 吗？`)) {
            config.sources.splice(index, 1);
            saveConfig();
            renderSourceList();
          }
        });
        controlsContainer.appendChild(upButton);
        controlsContainer.appendChild(downButton);
        controlsContainer.appendChild(deleteButton);
        listItem.appendChild(controlsContainer);
        sourceList.appendChild(listItem);
      });
    };
    addSourceButton.addEventListener("click", () => {
      const newSources = normalizeApiSources([addSourceInput.value]);
      const newSource = newSources[0];
      if (newSource && !config.sources.includes(newSource)) {
        config.sources.push(newSource);
        saveConfig();
        renderSourceList();
        addSourceInput.value = "";
      }
    });
    refreshSourcesButton.addEventListener("click", async () => {
      refreshSourcesButton.disabled = true;
      refreshSourcesButton.textContent = "刷新中...";
      const latestSources = await fetchLatestApiSources(getSourceRefreshTimeout());
      if (latestSources && latestSources.length > 0) {
        config.sources = latestSources;
        saveConfig();
        renderSourceList();
        alert("已刷新为最新线路。");
      } else {
        alert("获取最新线路失败，保留当前配置。");
      }
      refreshSourcesButton.textContent = "刷新最新线路";
      refreshSourcesButton.disabled = false;
    });
    testSourcesButton.addEventListener("click", async () => {
      testSourcesButton.textContent = "测试中...";
      testSourcesButton.disabled = true;
      const failedSourceUrls = [];
      const listItems = sourceList.children;
      for (let i = 0; i < listItems.length; i++) {
        const listItem = listItems[i];
        const sourceTextSpan = listItem.querySelector(".rt18-source-text");
        sourceTextSpan == null ? void 0 : sourceTextSpan.classList.remove("success", "failure");
      }
      const testPromises = config.sources.map(async (sourceUrl, index) => {
        let attempts = 0;
        let success = false;
        const listItem = listItems[index];
        const sourceTextSpan = listItem == null ? void 0 : listItem.querySelector(".rt18-source-text");
        while (attempts < 3 && !success) {
          attempts++;
          const album = await new Promise((resolve) => {
            JMFetchAlbumInfo(sourceUrl, "83981", resolve, { timeout: 5e3 });
          });
          success = Boolean(album && album.id && album.id.toString() === "83981");
        }
        if (sourceTextSpan) {
          sourceTextSpan.classList.add(success ? "success" : "failure");
        }
        if (!success) {
          failedSourceUrls.push(sourceUrl);
        }
      });
      await Promise.all(testPromises);
      testSourcesButton.textContent = "测试所有源";
      testSourcesButton.disabled = false;
      if (failedSourceUrls.length > 0) {
        const confirmRemove = confirm(
          `以下源似乎已失效或无法访问，是否要移除它们？

${failedSourceUrls.join("\n")}`
        );
        if (confirmRemove) {
          config.sources = config.sources.filter((source) => !failedSourceUrls.includes(source));
          saveConfig();
          renderSourceList();
          alert("已移除失效的源。");
        } else {
          alert("未移除任何源。失效的源仍标记为红色。");
        }
      } else {
        alert("所有源均测试通过！");
      }
    });
    renderSourceList();
    closeButton.addEventListener("click", () => {
      if (dialogContainer) {
        dialogContainer.style.display = "none";
        dialogContainer.remove();
        isConfigDialogOpen = false;
      }
    });
  };
  const openConfigDialog = () => {
    const selection = window.getSelection();
    selection == null ? void 0 : selection.removeAllRanges();
    if (popupWindow.style.display !== "none") {
      popupWindow.style.display = "none";
    }
    openConfigDialog$1();
  };
  _GM_registerMenuCommand("⚙ 打开配置菜单", openConfigDialog);
  _GM_registerMenuCommand("⚠ 重置配置", resetConfig);
  void resolveApiSources();
  const setSVGWithColor = (wrapper, svgUrl, color) => {
    wrapper.style.backgroundColor = color;
    wrapper.style.mask = `url("${svgUrl}") no-repeat center`;
    wrapper.style.webkitMask = `url("${svgUrl}") no-repeat center`;
  };
  const uiContainer = document.createElement("div");
  uiContainer.innerHTML = uiHtml;
  document.body.appendChild(uiContainer);
  const popupWindow = document.getElementById("jm-popup");
  const numberIcon = document.getElementById("jm-number-icon");
  const numberText = document.getElementById("jm-number");
  const titleText = document.getElementById("jm-title-text");
  const titleLoadingText = document.getElementById("jm-title-loading");
  const copyBtn = document.getElementById("jm-copy");
  const copyBtnIcon = document.getElementById("jm-copy-icon");
  const detailsContainer = document.getElementById("jm-details-container");
  setSVGWithColor(numberIcon, loadingIcon, "black");
  const populateDetails = (album) => {
    detailsContainer.innerHTML = "";
    const createDetailRow = (field, value) => {
      const isValueArray = Array.isArray(value);
      if (!value || isValueArray && value.length === 0) return;
      const row = document.createElement("div");
      row.className = "jm-detail-row";
      const labelSpan = document.createElement("span");
      labelSpan.className = "jm-detail-label";
      labelSpan.textContent = `${field}:`;
      row.appendChild(labelSpan);
      const valueSpan = document.createElement("span");
      valueSpan.className = "jm-detail-value";
      valueSpan.textContent = isValueArray ? value.join(", ") : value;
      if (isValueArray) {
        valueSpan.classList.add("jm-tags-container");
        valueSpan.innerHTML = "";
        value.forEach((tag) => {
          const tagSpan = document.createElement("span");
          tagSpan.className = "jm-tag-item";
          tagSpan.textContent = tag;
          valueSpan.appendChild(tagSpan);
        });
      }
      row.appendChild(valueSpan);
      detailsContainer.appendChild(row);
    };
    if (config.layout === "details") {
      createDetailRow("作者", album.author);
      createDetailRow("标签", album.tags);
      createDetailRow("系列", album.works);
      createDetailRow("角色", album.actors);
      createDetailRow(
        "统计",
        `浏览: ${album.total_views || 0} / 喜欢: ${album.likes || 0} / 评论: ${album.comment_total || 0}`
      );
      if (album.addtime) {
        const date = new Date(parseInt(album.addtime) * 1e3);
        createDetailRow("上传于", date.toLocaleString());
      }
      detailsContainer.style.display = "grid";
    } else {
      detailsContainer.style.display = "none";
    }
  };
  const toggleLoading = async (status, albumOrMessage, link) => {
    let numberIconUrl = loadingIcon;
    let numberTextColor = "black";
    let titleTextColor = "gray";
    detailsContainer.style.display = "none";
    if (status === "fail") {
      numberIconUrl = failIcon;
      numberTextColor = "red";
      titleText.textContent = titleText.title = typeof albumOrMessage === "string" ? albumOrMessage : "获取信息失败";
    } else if (status === "done" && albumOrMessage && typeof albumOrMessage !== "string") {
      const album = albumOrMessage;
      numberIconUrl = successIcon;
      numberTextColor = "green";
      titleTextColor = null;
      titleText.textContent = titleText.title = album.name;
      populateDetails(album);
    } else if (status === "warning") {
      numberIconUrl = warningIcon;
      numberTextColor = "orange";
      titleText.textContent = titleText.title = typeof albumOrMessage === "string" ? albumOrMessage : "发生错误";
    } else if (status === "loading") {
      titleText.textContent = titleText.title = "加载中...";
    }
    setSVGWithColor(numberIcon, numberIconUrl, numberTextColor);
    numberText.style.color = numberTextColor;
    const isLoading = status === "loading";
    titleLoadingText.style.display = isLoading ? "inline" : "none";
    titleText.style.display = !isLoading ? "inline" : "none";
    titleText.style.color = titleTextColor || "";
    if (link) {
      titleText.href = link;
    } else {
      titleText.removeAttribute("href");
    }
  };
  setSVGWithColor(copyBtnIcon, copyIcon, "dodgerblue");
  const disableCopyBtn = (status) => {
    copyBtn.disabled = status;
    copyBtn.style.pointerEvents = status ? "none" : "auto";
    copyBtnIcon.style.backgroundColor = status ? "gray" : "dodgerblue";
  };
  disableCopyBtn(true);
  const copyToClipboard = async () => {
    var _a;
    const textToCopy = titleText.innerText;
    try {
      _GM_setClipboard(textToCopy, "text");
    } catch {
      await ((_a = navigator.clipboard) == null ? void 0 : _a.writeText(textToCopy));
    }
    copyBtn.style.pointerEvents = "none";
    copyBtnIcon.classList.toggle("jm-copy-icon-hide");
    setTimeout(() => {
      copyBtnIcon.classList.toggle("jm-copy-icon-hide");
      setSVGWithColor(copyBtnIcon, doneIcon, "dodgerblue");
    }, 250);
    setTimeout(() => {
      copyBtnIcon.classList.toggle("jm-copy-icon-hide");
      setTimeout(() => {
        setSVGWithColor(copyBtnIcon, copyIcon, "dodgerblue");
        copyBtnIcon.classList.toggle("jm-copy-icon-hide");
        copyBtn.style.pointerEvents = "auto";
      }, 250);
    }, 1500);
  };
  copyBtn.addEventListener("click", copyToClipboard);
  const showPopup = async (event) => {
    const selectedText = window.getSelection();
    if (!event.target || !event.target.closest("#jm-popup")) {
      popupWindow.style.display = "none";
      disableCopyBtn(true);
    }
    if (!isConfigDialogOpen && selectedText && selectedText.toString().trim() !== "") {
      const number = parseInt(selectedText.toString().replace(/\D/g, ""));
      if (popupWindow.style.display !== "grid" && !Number.isNaN(number)) {
        if (selectedText.rangeCount === 0) return;
        const range = selectedText.getRangeAt(0);
        const activeEl = document.activeElement;
        const rect = (activeEl == null ? void 0 : activeEl.tagName) === "TEXTAREA" || (activeEl == null ? void 0 : activeEl.tagName) === "INPUT" ? activeEl.getBoundingClientRect() : range.getBoundingClientRect();
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        let top = Math.floor(scrollTop + rect.top + rect.height);
        const left = Math.floor(rect.left);
        if (top === 0 && left === 0 && rect.width === 0 && rect.height === 0) return;
        popupWindow.style.left = `${left}px`;
        popupWindow.style.top = `${top}px`;
        numberText.textContent = number.toString();
        numberText.style.color = "";
        popupWindow.style.display = "grid";
        const nbnhhsh = document.getElementsByClassName("nbnhhsh-box nbnhhsh-box-pop")[0];
        const originalNbnhhshTop = nbnhhsh ? parseInt(nbnhhsh.style.top) : NaN;
        const nbnhhshAdjust = () => {
          if (nbnhhsh) {
            const popupHeight = popupWindow.offsetHeight;
            const offset = popupHeight > 80 ? popupHeight + 10 : 80;
            if (!isNaN(originalNbnhhshTop)) {
              nbnhhsh.style.top = `${originalNbnhhshTop + offset}px`;
            } else {
              const rectNbnhhsh = nbnhhsh.getBoundingClientRect();
              const scrollTopNbnhhsh = document.documentElement.scrollTop || document.body.scrollTop;
              nbnhhsh.style.top = `${scrollTopNbnhhsh + rectNbnhhsh.top + offset}px`;
            }
          }
        };
        toggleLoading("loading");
        nbnhhshAdjust();
        const configuredSources = await resolveApiSources();
        if (!configuredSources || configuredSources.length === 0) {
          toggleLoading("warning", "无可用线路，请先配置");
          disableCopyBtn(true);
          nbnhhshAdjust();
          return;
        }
        let sourceIndex = 0;
        const tryNextSource = () => {
          if (sourceIndex >= configuredSources.length) {
            toggleLoading("fail", "获取信息失败或未找到车牌");
            disableCopyBtn(true);
            nbnhhshAdjust();
            return;
          }
          const currentSite = configuredSources[sourceIndex];
          JMFetchAlbumInfo(
            currentSite,
            number,
            (albumData) => {
              if (!albumData || albumData.id === 0 || !albumData.name) {
                sourceIndex++;
                tryNextSource();
                return;
              }
              toggleLoading("done", albumData, `${config.jmWebsiteUrl}/album/${albumData.id}`);
              disableCopyBtn(false);
              nbnhhshAdjust();
            },
            { timeout: config.timeout }
          );
        };
        tryNextSource();
      }
    }
  };
  const _showPopup = (event) => {
    setTimeout(() => {
      void showPopup(event);
    }, 1);
  };
  document.addEventListener("mouseup", _showPopup);
  document.addEventListener("keyup", _showPopup);

})(CryptoJS);