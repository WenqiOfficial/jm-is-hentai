# JMComic 工具网站项目

Hentai车站 — 神秘数字转换器

## 项目概述

本项目是一个基于 Vite (前端) 和 Cloudflare Workers (后端) 构建的工具型网站，旨在为用户提供 JMComic 漫画编号与多个漫画平台之间的快速检索和跨站换乘服务。

## 核心功能

1. **漫画信息查询**：用户输入 JMComic 的车牌号或 E-Hentai 检索词，系统自动解析并获取该漫画的封面、作者、标签等核心元数据。
2. **跨平台换乘 (Transfer)**：基于第一步获取的漫画标题，自动在备用平台（如 nHentai、E-Hentai、哔咔漫画）进行模糊搜索并提供直达跳转。
3. **标签翻译系统**：内置 EhTagTranslation 标签库引擎，支持自动中/英/日多语言转换，提供本地 IndexedDB 缓存和自动热更新机制。
4. **纯净环境**：本项目属于纯前端/无状态代理架构，不在任何地方存储用户的查询记录，确保用户隐私。

## 架构演进

当前项目采用混合架构：
- **前端 (Vite)**：负责玻璃拟态UI、响应式交互、WebGL 动画以及多语言翻译渲染。部署于 Cloudflare Pages。
- **后端 (Cloudflare Worker)**：作为安全的 API 代理层，负责处理跨域请求并封装 JMComic 与 E-Hentai 的原始 API。

## 项目结构

```text
jm-is-hentai/
├── frontend/                 # Vite 前端项目
│   ├── index.html            # 主入口
│   ├── styles.css            # 全局样式系统
│   └── src/                  # 核心源码
│       ├── main.js           # 核心控制器与 DOM 编排
│       ├── jmcomic.js        # JMComic 请求调度
│       ├── i18n.js           # 多语言基础支持
│       ├── tag-translator.js # EhTagTranslation 本地化数据库支持
│       ├── transfer.js       # 跨平台模糊换乘逻辑
│       ├── webgl-background.js # GPU 加速背景特效
│       ├── toast.js          # 通知组件
│       └── i18n/             # 多语言 JSON 字典
├── worker/                   # Cloudflare Worker 代理层
│   └── index.js              # 后端请求中转与 API 封装
├── shared/                   # 前后端共享模块
│   └── crypto.js             # 加密常量与解密算法（DRY）
├── START.md                  # 本文档
├── DESIGN.md                 # UI/UX 设计规范
└── REVIEW.md                 # 架构审查规范指南
```

## API 端点文档 (由 Cloudflare Worker 提供)

### 1. JMComic 车牌解析
```http
GET /api/jmcomic/:id
```
**说明**: 输入 JMComic 数字车牌，代理层将自动构造 Token 请求源站，并进行 AES ECB 解密后返回明文 JSON 数据。若配置了 `JM_CACHE` 环境变量 (KV)，则命中 KV 缓存。

### 2. JMComic 后端搜索
```http
GET /api/jmcomic/search?q={keyword}
```
**说明**: 使用关键词在 JMComic 平台搜索。

### 3. JMComic 可用图源获取
```http
GET /api/jmcomic/sources
```
**说明**: 动态抓取当前未被墙的最新 API 域名列表。

### 4. E-Hentai 搜索
```http
GET /api/ehentai/search?q={keyword}
```
**说明**: 在 E-Hentai 进行模糊搜索。返回精简的列表，包含标题、封面和图库 token。

### 5. E-Hentai 画廊详细信息
```http
GET /api/ehentai/gallery?gid={gid}&token={token}
```
**说明**: 调用 E-Hentai `gdata` 接口获取指定画廊的详细元数据（用于填充标签、作者等高级字段）。

## Worker 部署与配置

在使用 `npm run worker:deploy` 部署前，可以在 `wrangler.toml` 中配置 Workers KV 缓存以降低上游压力：

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "JM_CACHE"
id = "YOUR_KV_NAMESPACE_ID"
```
代码已内置对 `env.JM_CACHE` 绑定的检查，绑定后自动开启缓存。

## 性能优化与兼容性

本项目全面践行 **优雅降级 (Progressive Enhancement)**：
1. **WebGL 动画降级**: 在低端设备或检测到降低动态效果 (prefers-reduced-motion) 的设备上，自动回退到纯 CSS 方案，保障低功耗。
2. **直连容灾**: 默认使用 API 代理，若代理失效，前端仍支持直接在浏览器内（需跨域插件配合）构造请求。
3. **安全拦截**: UI 中所有不可控外部输入均通过 `textContent` 构建，消除 XSS 注入风险。
