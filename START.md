 # JMComic 工具网站项目

 ## 项目概述

 本项目是一个基于 Cloudflare Workers 构建的工具型网站，旨在为用户提供 JMComic 漫画编号与多个漫画平台之间的快速检索和跳转服务。

 ## 核心功能

 1. **漫画信息查询**：用户输入 JMComic 的漫画编号，系统自动获取该漫画的标题、封面、作者、标签等基本信息
 2. **跨平台检索**：根据获取的信息，在 Ehentai 和哔咔漫画等平台上搜索相似内容
 3. **快捷跳转**：为用户提供直接跳转到其他平台对应内容的链接
 4. **反向查询**：支持从其他平台的内容出发，寻找对应的 JMComic 编号

 ## 技术架构

 - **后端**：Cloudflare Workers + Workers KV（用于缓存）
 - **前端**：静态 HTML + JavaScript，部署在 Cloudflare Pages
 - **API**：通过 Workers 提供 RESTful API 接口
 - **数据源**：JMComic、Ehentai、哔咔漫画等平台的公开数据

 ## 项目结构

 ```
 jm-is-hentai/
 ├── api/                    # API 端点
 │   ├── jmcomic/
 │   │   └── get-info.js     # 获取 JMComic 信息
 │   ├── ehentai/
 │   │   └── search.js       # 在 Ehentai 搜索
 │   └── pikabu/
 │       └── search.js       # 在 哔咔漫画 搜索
 ├── frontend/              # 前端页面
 │   ├── index.html         # 主页
 │   ├── styles.css         # 样式表
 │   └── scripts.js         # 前端逻辑
 ├── utils/                 # 工具函数
 │   ├── scraper.js         # 数据抓取工具
 │   ├── cache.js           # 缓存管理
 │   └── formatter.js       # 数据格式化
 ├── wrangler.toml          # Cloudflare Workers 配置
 ├── package.json           # 依赖管理
 ├── START.md               # 项目说明文档
 └── DESIGN.md              # 设计规范文档
 ```

 ## API 设计

 ### 获取 JMComic 信息
 ```
 GET /api/jmcomic/:id
 Response:
 {
   "id": "数字编号",
   "title": "漫画标题",
   "cover_url": "封面图片地址",
   "author": "作者",
   "tags": ["标签"],
   "series": "系列",
   "release_date": "发布日期",
   "pages_count": "页数",
   "related_comics": ["相关漫画ID"]
 }
 ```

 ### 搜索 Ehentai
 ```
 GET /api/ehentai/search?title={title}&author={author}
 Response:
 {
   "results": [
     {
       "id": "gid",
       "title": "漫画标题",
       "url": "Ehentai 地址",
       "thumbnail": "缩略图地址",
       "tags": ["标签"]
     }
   ]
 }
 ```

 ### 搜索哔咔漫画
 ```
 GET /api/pikabu/search?title={title}&author={author}
 Response:
 {
   "results": [
     {
       "id": "漫画ID",
       "title": "漫画标题",
       "url": "哔咔漫画地址",
       "cover": "封面图片地址",
       "author": "作者"
     }
   ]
 }
 ```

 ## 数据处理流程

 1. 用户在前端输入 JMComic 编号
 2. 前端请求 `/api/jmcomic/{id}` 获取漫画信息
 3. 后端通过爬虫或 API 获取漫画详细信息
 4. 将获取的信息缓存至 Workers KV
 5. 使用漫画标题、作者等信息在其他平台进行搜索
 6. 整合搜索结果并返回给前端
 7. 前端展示漫画信息及各平台跳转链接

 ## 部署方式

 1. 使用 Wrangler CLI 部署 Cloudflare Workers
 2. 前端页面部署至 Cloudflare Pages
 3. 配置自定义域名（可选）

 ## 注意事项

 - 遵守各平台的 robots.txt 和使用条款
 - 实现适当的请求频率限制，避免对目标网站造成压力
 - 考虑数据缓存策略以减少重复请求
 - 处理可能的反爬虫机制

 ## 开发计划

 1. 第一阶段：基础 JMComic 信息获取功能
 2. 第二阶段：Ehentai 平台集成
 3. 第三阶段：哔咔漫画平台集成
 4. 第四阶段：反向查询功能
 5. 第五阶段：UI 优化和性能提升

 ## 安全考虑

 - 对用户输入进行验证和清理
 - 实现适当的错误处理机制
 - 防止注入攻击和其他常见安全漏洞
 - 隐私保护：不存储用户的查询记录

 ---

 该项目将遵循开源协议，并严格遵守各漫画平台的服务条款和版权规定。
