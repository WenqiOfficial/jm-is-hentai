<div align="center">
  <img src="assets/readme_banner.jpg" alt="Hentai Station Banner" width="100%" style="border-radius: 12px; margin-bottom: 20px;">

  # 🚉 Hentai Station
  
  **A cross-platform manga proxy and conversion platform built with Vite and Cloudflare Workers**
  
  <p align="center">
    <img src="https://img.shields.io/badge/Vite-8.1.4-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/Cloudflare_Workers-Proxy-F38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare Workers" />
    <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License" />
  </p>

  <p>
    Provides fast metadata retrieval and one-click transfer between JMComic IDs and other major galleries like E-Hentai, PicACG, and nHentai.
  </p>

  <p align="center">
    <b>English</b> | <a href="README.md">简体中文</a>
  </p>
</div>

---

## ✨ Features

- 🔍 **Smart Search**: Input a JMComic ID or E-Hentai keyword to parse and retrieve manga metadata (cover, author, and full tag lists) in one click.
- 🚄 **Cross-Platform Transfer**: Integrated cross-station search matching manga across E-Hentai, PicACG, and nHentai for seamless transitions.
- 🌍 **Automated Tag Translation**: Powered by the `EhTagTranslation` engine, supporting translation between Chinese, English, and Japanese, with local IndexedDB caching and silent hot updates.
- 🛡️ **Stateless Proxy**: Utilizes Cloudflare Workers as an API proxy layer to bypass CORS restrictions, perform on-the-fly AES decryption, and guarantee privacy without caching user search logs.
- 🎨 **Modern UI**: Fluid glassmorphism UI with responsive layouts, incorporating performance fallbacks via `prefers-reduced-motion` and smart NSFW blur protection.

---

## 📸 Screenshots

<div align="center">
  <img src="assets/ui_mockup.jpeg" alt="UI Mockup" width="85%" style="border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
</div>

---

## 🚀 Deployment & Usage

The project is split into the frontend (`frontend`) and the backend proxy (`worker`).

### ☁️ One-Click Deployment (Recommended)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/WenqiOfficial/jm-is-hentai)

### 💻 Local Development & Manual Deployment

If you want to perform secondary development or manually deploy the project, follow these steps:

#### 1. Install Dependencies

```bash
git clone https://github.com/WenqiOfficial/jm-is-hentai.git
cd jm-is-hentai
npm install
```

#### 2. Frontend Deployment

You can host the `frontend` folder using any static hosting service (e.g., Cloudflare Pages, Vercel, Netlify).

```bash
# Start local development server
npm run dev

# Build production distribution
npm run build
```

#### 3. Backend Proxy Deployment (Worker)

Manually deploy the Worker to Cloudflare using Wrangler:

```bash
# Test the Worker locally
npm run worker:dev

# Deploy the Worker to Cloudflare
npm run worker:deploy
```

> **💡 KV Cache Optimization**:
> Before deploying the Worker, it is highly recommended to bind a `JM_CACHE` namespace in `wrangler.toml` to enable Cloudflare KV caching. This significantly reduces requests sent to upstream APIs.

---

## 🔌 Core API Endpoints

Through your deployed Worker proxy, you can call the following APIs (see `START.md` for details):

- `GET /api/jmcomic/:id` - Resolve a JMComic ID (with automated AES decryption)
- `GET /api/jmcomic/search?q={keyword}` - Search for JMComic galleries
- `GET /api/ehentai/search?q={keyword}` - Search for E-Hentai listings
- `GET /api/ehentai/gallery?gid={gid}&token={token}` - Fetch E-Hentai gallery metadata

---

## 🌟 Star History

<div align="center">
  <a href="https://star-history.com/#WenqiOfficial/jm-is-hentai&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=WenqiOfficial/jm-is-hentai&type=Date&theme=dark" />
      <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=WenqiOfficial/jm-is-hentai&type=Date" />
      <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=WenqiOfficial/jm-is-hentai&type=Date" />
    </picture>
  </a>
</div>

---

## 💖 Contributors

Thanks to everyone who contributed to this project!

<div align="center">
  <a href="https://github.com/WenqiOfficial/jm-is-hentai/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=WenqiOfficial/jm-is-hentai" alt="Contributors" />
  </a>
</div>

---

## 🤝 Contribution & Support

Issues and Pull Requests are welcome to help improve features and fix bugs.

This project is licensed under the [MIT License](LICENSE).

<p align="right">
  <i>✨ Developed with the assistance of Gemini</i>
</p>
