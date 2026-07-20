# 企工委官网（Astro 版）部署说明

静态站点，无后台、无数据库，部署到任意静态托管即可。

## 本地运行
```bash
npm install          # 已安装可跳过
npm run dev          # 开发预览 http://localhost:4321
npm run build        # 构建到 dist/
npm run preview      # 预览 dist/ 产物
```

## 上线前必改
1. `src/site.ts` 中的 `formEndpoint`：替换为例真实表单接收端
   - 国内：腾讯问卷 / 金数据（生成表单后取其提交地址）
   - 国际：Formspree / Getform（免费额度可用）
   - 自建：Cloudflare Worker + KV，或 FastAPI 接收后写库/发邮件
2. `astro.config.mjs` 中的 `site`：改为正式域名（用于 OG / sitemap / 绝对链接）
3. 如部署到子路径（GitHub Pages 项目页等），设置 `base: '/repo'`

## 部署平台（任选）
- **腾讯云 EdgeOne / 静态托管**：上传 `dist/` 即可，国内访问快，配 HTTPS 域名后微信分享体验好。
- **Cloudflare Pages**：连接 Git 仓库，构建命令 `npm run build`，输出目录 `dist`。
- **Vercel / Netlify**：同上，构建 `npm run build`，输出 `dist`。

## 内容维护
- 活动通知：在 `src/content/notices/` 新增 `.md` 文件（frontmatter: title/date/category），重新构建即上线。
- 页面文案：编辑 `src/pages/` 下对应 `.astro` 文件。
- 非技术委员发通知：可接入轻量 Headless CMS（如 Decap CMS 连 Git），或继续用 Markdown 工作流。

## 待办（下一阶段）
- 企业需求库"在线提交 + 结构化检索"：检索可用 Pagefind / Fuse.js（纯前端）；提交复用上面的表单后端。
- 三个申请表单目前 POST 到占位地址，需配置真实接收端后才生效。
- 如需"委员会成员浏览器后台发内容"，接 Decap CMS 或保留 Halo 仅作内容后台。
