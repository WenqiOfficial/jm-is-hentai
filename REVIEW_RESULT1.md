# 🔬 阶段 1 — 全量深度代码审查报告

> 审查范围：`frontend/` 全部 HTML/CSS/JS、`worker/index.js`、`vite.config.js`、根目录残留文件、全部 `.md` 文档
> 审查标准：[REVIEW.md](file:///d:/Archives/jm-is-hentai/REVIEW.md)
> 审查日期：2026-07-12

---

## 📊 全局健康度评估

### 架构缺陷与技术债（高优先级）

> [!CAUTION]
> **[S-01] `main.js` 单文件 God Object — 802 行巨石模块**
> 全部 UI 逻辑、状态管理、DOM 操作、颜色提取、换乘面板逻辑均堆叠在一个 `DOMContentLoaded` 回调中。违反单一职责原则，难以测试和维护。

> [!CAUTION]
> **[S-02] 前端-后端密钥/逻辑重复（DRY 严重违反）**
> `jmcomic.js`（前端）和 `worker/index.js`（后端）包含**完全相同**的加密常量（`APP_TOKEN_SECRET`、`APP_DATA_SECRET`、`APP_VERSION`）和函数（`getTokenWithTokenparam`、`decodeDataText`、`decodeJsonData`）。同一份逻辑维护两份代码。

> [!WARNING]
> **[S-03] 根目录遗留文件 `rt18.js`（675 行）和 `eh.py`（1028 行）**
> 这两个文件是第三方油猴脚本和独立 Flask 服务端，与当前 Vite + Workers 架构**完全无关**，未被任何模块引用。它们的存在混淆项目边界，增加仓库体积约 89 KB。

> [!WARNING]
> **[S-04] `FALLBACK_API_SOURCES` 列表在三处重复定义**
> 分别位于 [jmcomic.js:L7-12](file:///d:/Archives/jm-is-hentai/frontend/src/jmcomic.js#L7-L12)、[worker/index.js:L15-20](file:///d:/Archives/jm-is-hentai/worker/index.js#L15-L20)、以及 `rt18.js` 内部。顺序和内容还存在差异（前端把 `club` 放第一，Worker 把它也放第一但顺序不同）。域名变更时极易遗漏。

> [!WARNING]
> **[S-05] Toast 组件存在 XSS 注入风险**
> [toast.js:L36](file:///d:/Archives/jm-is-hentai/frontend/src/toast.js#L36) 使用 `innerHTML` 插入 `message` 参数。虽然当前调用方都传入 i18n 静态文本，但 [tag-translator.js:L112](file:///d:/Archives/jm-is-hentai/frontend/src/tag-translator.js#L112) 将 `err.message`（外部异常信息）拼入消息字符串后传给 `showToast`，存在用户可控内容被注入的隐患。

### 冗余度分析（可直接删除的模块/文件）

| 文件 | 大小 | 删除理由 |
|---|---|---|
| [rt18.js](file:///d:/Archives/jm-is-hentai/rt18.js) | 39 KB | 第三方油猴脚本，与本项目架构无关 |
| [eh.py](file:///d:/Archives/jm-is-hentai/eh.py) | 49 KB | 独立 Flask 服务端，与 Workers 架构无关 |
| `dist/` 目录 | ~407 KB | 构建产物，应在 `.gitignore` 中排除（当前未排除） |

### 文档缺失列表

| 文档 | 问题 |
|---|---|
| [START.md](file:///d:/Archives/jm-is-hentai/START.md) | 项目结构树严重过期：列出的 `api/`、`utils/` 目录不存在；`scripts.js` 应为 `src/main.js`；未反映实际的 `frontend/src/` 模块拆分 |
| [START.md](file:///d:/Archives/jm-is-hentai/START.md) | API 设计章节与实际不符：文档写 `GET /api/ehentai/search?title=&author=`，实际为 `?q=`；缺少 `/api/ehentai/gallery`、`/api/jmcomic/search`、`/api/jmcomic/sources` 端点文档 |
| [DESIGN.md](file:///d:/Archives/jm-is-hentai/DESIGN.md) | 换乘模块描述缺少 `nHentai` 平台（实际已实现）；未提及 NSFW 自动模糊功能；未提及 i18n 多语言支持 |
| [STYLE.md](file:///d:/Archives/jm-is-hentai/STYLE.md) | 提及的 "3D 物理倾斜" 鼠标交互在当前代码中**未实现**（已被移除或从未实现），文档与代码不同步 |
| [package.json](file:///d:/Archives/jm-is-hentai/package.json) | `description`、`author`、`keywords` 字段全部为空 |

---

## 🎯 模块级详细诊断

### HTML — [index.html](file:///d:/Archives/jm-is-hentai/frontend/index.html)

| 问题分类 | 具体问题 | 优化建议 |
|---|---|---|
| 安全 | L5: `user-scalable=no` 禁止用户缩放，违反无障碍标准（WCAG 1.4.4）| 移除 `maximum-scale=1.0, user-scalable=no` |
| 性能 | L197-199: 3 个外部 CDN 脚本（Vibrant、OpenCC、FontAwesome CSS）均为渲染阻塞加载，无 `async`/`defer` | Vibrant 和 OpenCC 添加 `defer`；FontAwesome CSS 可改用 `preload` |
| 冗余 | L9: Google Fonts `Varela+Round` 仅加载了一个字重，但 CSS 里对 `.logo` 用了 `font-weight: bold`，该字体不含 bold 字重，浏览器会合成加粗 | 加载 `wght@400;700` 或改用 CSS `font-weight: normal` |
| 语义/A11y | L102: E-Hentai 平台选项文本 `E-Hentai` 未包裹在 `<span data-i18n>` 中，切换语言时不会被翻译系统更新 | 与 L98 保持一致，加 `<span>` 并添加 i18n key |
| 冗余 | L117: `style="display: none;"` 行内样式与 fade-element 过渡系统冲突，代码里又通过 JS 设置 `display`，两套显隐机制并存 | 统一使用 CSS class 控制显隐 |

### CSS — [styles.css](file:///d:/Archives/jm-is-hentai/frontend/styles.css)

| 问题分类 | 具体问题 | 优化建议 |
|---|---|---|
| **冗余/DRY** | `@keyframes moveFluid` 在 L91-95 和 L956-960 **定义了两次**，内容完全相同 | 删除 L956-960 的重复定义 |
| **冗余/DRY** | `.transfer-tab` 样式在 L469-498（与 `.platform-btn` 合并选择器）和 L708-733（独立定义）**大量重复**：`background`、`border`、`cursor`、`display`、`align-items`、`gap`、`user-select`、`color`、`:hover` 和 `.active` 状态全部重写 | 删除 L708-733 的重复块，仅保留与 `.platform-btn` 的差异化样式 |
| **冗余** | L682-684: `.transfer-area {}` 空规则块，仅含注释 | 删除空规则 |
| **冗余** | L848-857: `@keyframes slideInRight` 已无任何元素引用（注释说已改用 View Transitions API） | 删除该废弃动画 |
| 性能 | `.fluid-gradient` 使用 `filter: blur(80px)` 作用于 200vw×200vh 元素，在低端设备上会产生严重重绘开销 | WebGL 启动后已隐藏此元素，但 CSS fallback 场景需考虑降低 blur 值 |
| 冗余 | L362-370: `.visual-content img.nsfw-icon` 使用 4 个 `!important` 覆盖通用 img 样式 | 改用更高优先级的选择器代替 `!important` |

### CSS — [footer.css](file:///d:/Archives/jm-is-hentai/frontend/src/footer.css)

| 问题分类 | 具体问题 | 优化建议 |
|---|---|---|
| **冗余/DRY** | `.footer` 样式同时定义于此文件（L2-14）和 [styles.css:L860-870](file:///d:/Archives/jm-is-hentai/frontend/styles.css#L860-L870)，属性有冲突：`footer.css` 设置 `padding: 20px`，`styles.css` 设置 `padding: 16px`；`footer.css` 用 `display: flex`，`styles.css` 无此属性；`footer.css` 引用未定义的 `--text-muted` 变量 | 合并为单一定义，`--text-muted` 改为已定义的 `--text-light` |
| 冗余 | `.fade-in-up` / `.fade-out-up` 类名与全局 `styles.css` 的 `.fade-element` 过渡系统语义重复，但实现机制不同 | 统一到全局过渡系统或明确隔离命名空间 |

### CSS — [toast.css](file:///d:/Archives/jm-is-hentai/frontend/src/toast.css)

| 问题分类 | 具体问题 | 优化建议 |
|---|---|---|
| 健全性 | 无明显问题，结构清晰 | — |

### JS — [main.js](file:///d:/Archives/jm-is-hentai/frontend/src/main.js)

| 问题分类 | 具体问题 | 优化建议 |
|---|---|---|
| **冗余/DRY** | L400-408 和 L446-455: 标签渲染逻辑（`createElement → className → textContent → animation → appendChild`）在 JM 和 EH 分支中**几乎完全相同**，再加上 L44-52 的 `languageChanged` handler 又重复一遍 | 抽离为 `renderTags(tags, lang, animate)` 通用函数 |
| **冗余/DRY** | L396-412 和 L438-458: JM / EH 两个分支的"填充 comic info"逻辑高度重叠（设 title → author → tags → link） | 抽离为 `populateComicInfo(album, platform)` |
| **冗余** | L684: `renderTransferResults` 内再次定义 `const ALL_STATES = [...]`，与 L616 完全相同 | 提升为模块级常量或闭包内单次定义 |
| 鲁棒性 | L364: `document.querySelector('input[name="platform"]:checked')?.value` 使用可选链但未对 `null` 路径做防御——如果所有 radio 都被 JS 取消勾选，`currentPlatform` 为 `undefined`，后续分支将静默跳过 | 添加 fallback 并 `showError` |
| 鲁棒性 | L232-357 `updateVisual`: 若 `Vibrant` 全局变量未加载（CDN 挂掉），颜色提取整块被跳过但无任何日志或用户反馈 | 添加 `console.warn` 或 Toast 提示 |
| 鲁棒性 | L86-90 `fadeOut`: `setTimeout` 固定 450ms，但 CSS `transition-duration` 为 400ms。如果 CSS 被修改而 JS 未同步，会出现闪烁 | 使用 `transitionend` 事件代替硬编码延时 |
| 鲁棒性 | L152-156 `smoothStateSwitch` cleanup: 同样用硬编码 400ms `setTimeout` 清理过渡样式 | 同上，改为 `transitionend` |
| 性能 | L626 `switchTransferTab` 变量 `comicTitle` 与外部作用域的 DOM `comicTitle` 同名遮蔽（L19），虽不影响运行但增加阅读困惑 | 重命名为 `searchKeyword` 或 `candidateTitle` |
| 鲁棒性 | L255: 封面加载失败的兜底文案 `'暂无封面'` 是硬编码中文，未走 i18n 系统 | 改用 `t('comic.no_cover')` |

### JS — [jmcomic.js](file:///d:/Archives/jm-is-hentai/frontend/src/jmcomic.js)

| 问题分类 | 具体问题 | 优化建议 |
|---|---|---|
| **冗余/DRY** | 与 `worker/index.js` 重复的 3 个常量 + 3 个函数（已在全局评估中标注） | 抽离为共享模块 `shared/crypto.js`；Worker 和前端 build 共用 |
| 鲁棒性 | L48: `JSON.parse(decodedString)` 无 try/catch，若解密结果不是合法 JSON 会抛出裸异常 | 包裹 try/catch 并给出明确错误描述 |
| 鲁棒性 | L64-72: API 模式下先 `response.text()` 再 `JSON.parse()`，但错误信息 `resText.substring(0, 50)` 可能暴露敏感服务端信息 | 仅展示通用错误，将详细信息 `console.error` |

### JS — [transfer.js](file:///d:/Archives/jm-is-hentai/frontend/src/transfer.js)

| 问题分类 | 具体问题 | 优化建议 |
|---|---|---|
| 冗余/YAGNI | L67-79 `searchNhentai`: 函数声称是搜索，实际只构造一条静态跳转链接，不进行任何网络请求 | 明确标注为 `buildNhentaiLink` 或直接内联到 `getTransferTargets` |
| 冗余/YAGNI | L85-88 `searchPicacg`: 空 placeholder 函数，仅 `return []`，永远不执行任何有意义操作 | 在 `getTransferTargets` 中用内联注释标记 `coming soon`，删除独立函数 |
| 鲁棒性 | L15, L34, L52: 三个 fetch 函数在 `!res.ok` 时静默返回空数组/null，没有区分 4xx 和 5xx，调用方无法知道是"确实无结果"还是"服务挂了" | 至少 console.warn 状态码 |

### JS — [i18n.js](file:///d:/Archives/jm-is-hentai/frontend/src/i18n.js)

| 问题分类 | 具体问题 | 优化建议 |
|---|---|---|
| 鲁棒性 | L97-100 `applyTranslations`: 对含有子元素的 DOM（如 L35 `<h4><i>...</i> 文本</h4>`）使用 `el.textContent = t(key)` 会**销毁子元素**（`<i>` 图标被覆盖） | 改为仅替换文本节点，或使用 `el.lastChild.textContent` 保留图标 |
| 设计 | `setLanguage` 每次切换语言都调用 `loadTagTranslations()`，但后者内部有 `if (tagCache) return` 的短路。这意味着首次加载后的所有语言切换调用都是无效的 | 将 tag 加载从语言切换流程中移除，仅在初始化时调用一次 |

### JS — [tag-translator.js](file:///d:/Archives/jm-is-hentai/frontend/src/tag-translator.js)

| 问题分类 | 具体问题 | 优化建议 |
|---|---|---|
| 性能 | L33-41 `getDBItem` 和 L47-55 `setDBItem`: 每次调用都 `openDB()` 创建新的 IndexedDB 连接，连接没有被缓存或复用 | 单例化 DB 连接，`openDB` 改为 `getDB` 带内存缓存 |
| 冗余/DRY | L217-225 和 L235-243: OpenCC 转换器初始化逻辑（`if (!t2sConverter) { try { ... } catch {} }`）**重复了两次** | 抽离为 `getT2SConverter()` 函数 |
| 鲁棒性 | L219, L237: `catch (e) {}` 空 catch，吞掉 OpenCC 初始化错误，调试时完全无迹可循 | 至少 `console.warn` |

### JS — [footer.js](file:///d:/Archives/jm-is-hentai/frontend/src/footer.js)

| 问题分类 | 具体问题 | 优化建议 |
|---|---|---|
| 鲁棒性 | L45: `text.replace('❤️', '').trim()` 对 emoji 的替换在部分旧浏览器上可能因 Unicode 编码差异失败 | 使用 regex 或直接在 i18n JSON 中不包含 emoji |
| 冗余 | 整个模块仅管理 2 条轮播消息，引入了 `getDurationForText` 按字符数动态计算时长，工程复杂度与实际收益不匹配 | 简化为固定间隔轮播 |

### JS — [toast.js](file:///d:/Archives/jm-is-hentai/frontend/src/toast.js)

| 问题分类 | 具体问题 | 优化建议 |
|---|---|---|
| **安全** | L36: `innerHTML` 注入（已在全局评估中标注） | 改用 `textContent` + `createElement('i')` 手动构建 |
| 鲁棒性 | 多个 Toast 同时触发时无堆叠上限，理论上可无限叠加 | 添加最大同时显示数量限制（如 5 条） |

### JS — [webgl-background.js](file:///d:/Archives/jm-is-hentai/frontend/src/webgl-background.js)

| 问题分类 | 具体问题 | 优化建议 |
|---|---|---|
| 性能 | L230-233: `resize` 事件使用 100ms debounce `setTimeout`，但未在 `_resize` 内做 dirty check 以外的优化 | 当前实现已有 width/height dirty check，可接受 |
| 资源泄露 | `_bindEvents` 中注册的 `resize`、`mousemove`、`visibilitychange` 事件监听器**永远不会被移除**，`WebGLBackground` 无 `destroy()` 方法 | 添加 `destroy()` 方法清理事件和 GL 资源 |
| 健全性 | 整体实现质量高，shader 逻辑干净 | — |

### JS — [worker/index.js](file:///d:/Archives/jm-is-hentai/worker/index.js)

| 问题分类 | 具体问题 | 优化建议 |
|---|---|---|
| **冗余/DRY** | L1-44: 与前端 `jmcomic.js` 重复的加密模块（已在全局评估标注） | 共享模块化 |
| **安全** | L105: CORS `Access-Control-Allow-Origin: *` 无限制开放，所有端点均如此 | 生产环境应限制为实际前端域名 |
| 冗余/DRY | L313-318 和 L225-230: 构建 `newHeaders` / `searchHeaders` 的逻辑**几乎完全相同** | 抽离为 `buildJMHeaders(token, tokenparam)` |
| 鲁棒性 | L136: 用正则 `/<tr[^>]*>[\s\S]*?<\/tr>/gi` 解析 E-Hentai HTML，极其脆弱——如果 E-Hentai 改版或返回非标准 HTML，正则静默返回空结果 | 已是 Worker 环境的最优解（无 DOM），但应添加 fallback 日志 |
| 鲁棒性 | L292: `url.pathname.split('/').pop()` 提取 jmId，如果路径末尾有尾随斜杠则返回空字符串 | 添加 `.filter(Boolean).pop()` |
| 鲁棒性 | L184: `parseInt(gid)` 未校验 NaN | 添加 `if (isNaN(...))` 检查 |

### 配置文件

| 文件 | 问题 | 优化建议 |
|---|---|---|
| [wrangler.toml](file:///d:/Archives/jm-is-hentai/wrangler.toml) | KV 配置被注释掉，但代码中 `env.JM_CACHE` 已在使用（条件检查），缺少文档说明 | 在 `START.md` 中补充 KV 配置说明 |
| [.gitignore](file:///d:/Archives/jm-is-hentai/.gitignore) | `dist/` 目录未被忽略，构建产物被提交到仓库 | 添加 `dist/` 到 `.gitignore` |
| [package.json](file:///d:/Archives/jm-is-hentai/package.json) | `"main": "index.js"` 指向不存在的根目录 `index.js` | 移除或修改为正确入口 |

### I18n JSON

| 问题 | 详情 |
|---|---|
| Key 覆盖不完整 | HTML 中 `data-i18n="settings.auto_blur"` 用于 `<h4>` 标题和 `<span>` 标签，但翻译 key 一样，导致标题和 checkbox 文本完全相同 |
| 硬编码遗漏 | `main.js:L255` 的 `'暂无封面'`、`main.js:L397` 的 `'未知'` 未走 i18n |
| 一致性 | `zh.json` 的 `"footer.made_with_love"` 值为英文 "Made with love❤️"，不是中文翻译 |

---

## 🚀 下一步修改路线图

- [ ] **阶段 2.1: 全局清理与废弃代码删除**
  - 删除 `rt18.js`、`eh.py`
  - 删除 `dist/` 并加入 `.gitignore`
  - 删除 `styles.css` 中重复的 `@keyframes moveFluid` 和废弃的 `@keyframes slideInRight`
  - 删除 `.transfer-tab` 重复样式块和 `.transfer-area` 空规则
  - 合并 `footer.css` 与 `styles.css` 中的 `.footer` 样式冲突

- [ ] **阶段 2.2: DRY 重构与逻辑复用**
  - 抽离 `shared/crypto.js` 消除前后端加密代码重复
  - 抽离 `renderTags()` / `populateComicInfo()` 消除 `main.js` JM/EH 分支重复
  - 抽离 `buildJMHeaders()` 消除 Worker 中 header 构建重复
  - 抽离 `getT2SConverter()` 消除 `tag-translator.js` OpenCC 初始化重复
  - 单例化 IndexedDB 连接

- [ ] **阶段 2.3: 安全加固与鲁棒性修复**
  - `toast.js` 的 `innerHTML` 改为安全 DOM 构建
  - Worker CORS 收紧
  - 修复 `applyTranslations` 会销毁子元素的 bug
  - 补全空 `catch` 块的日志
  - 硬编码超时替换为 `transitionend` 事件
  - 输入校验兜底（`jmId` 尾随斜杠、`parseInt` NaN、`currentPlatform` undefined）

- [ ] **阶段 2.4: 文档与配置对齐**
  - 重写 `START.md` 项目结构和 API 文档
  - 更新 `DESIGN.md` 补充 nHentai、NSFW 模糊、i18n 功能描述
  - 修正 `STYLE.md` 移除已删特性的描述
  - 补全 `package.json` 元数据
  - `wrangler.toml` KV 配置文档化
