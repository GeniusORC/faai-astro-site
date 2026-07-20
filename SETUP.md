# 企工委官网 · Decap 后台接入与上线步骤

技术栈：Astro（前端，MIT）+ Decap CMS（后台，MIT，自托管，免费）+ Cloudflare Pages / 腾讯云 EdgeOne（免费档托管）。
全部开源、自托管，**无任何 SaaS 订阅费**。唯一硬成本：一个域名（约 ¥50/年，可选）。

> 说明：本文件里的 `REPO_OWNER`、`REPO_NAME` 指你的 GitHub 用户名和仓库名。
> 你的 GitHub 账号邮箱：`450311590@qq.com`（用它登录 github.com）。

---

## 一、你要在网页上点几下的事（我无法代登你的私人账号）

### 1. 建 GitHub 仓库
- 用 `450311590@qq.com` 登录 https://github.com → 右上角 **New repository**
- Repository name：`faai-astro-site`（随意）
- 选 **Public**（Decap 用 pkce 可免密，公开仓库即可）
- 不要勾选 "Add a README"（本地已有代码）
- 点 **Create repository**

### 2. 建 GitHub OAuth App（Decap 登录用）
- GitHub → 右上角头像 → **Settings** → 左侧 **Developer settings** → **OAuth Apps** → **New OAuth App**
- Application name：`faai-cms`（随意）
- Homepage URL：你的上线域名，例如 `https://faai.pages.dev`
- Authorization callback URL：**`https://你的域名/admin/`**（结尾斜杠不能少）
- 点 **Register application**
- 记下 **Client ID**（pkce 模式不需要 Client Secret）

### 3. 连托管平台（Cloudflare Pages 为例）
- 登录 https://pages.cloudflare.com → **Connect to Git** → 选刚建的仓库
- Build command：`npm run build`
- Build output directory：`dist`
- Node.js version：20
- 部署完成后得到域名（如 `faai.pages.dev`）

---

## 二、改一处配置（本地改完提交即可）

打开 `public/admin/config.yml`，把第一行仓库改成真实值：

```yaml
backend:
  repo: REPO_OWNER/REPO_NAME   # 改成例如 chenjianbo/faai-astro-site
```

然后回到上面「步骤 2」把 OAuth App 的 Homepage / Callback 改成你最终域名。

---

## 三、本地推送到 GitHub（在 astro-site 目录执行）

代码已 `git init` 并提交了初始版本，你只需加远程并推送：

```bash
cd astro-site
git remote add origin https://github.com/REPO_OWNER/REPO_NAME.git
git branch -M main
git push -u origin main
```

推送后 Cloudflare Pages 会自动构建并上线。

---

## 四、使用后台发通知

浏览器打开 `https://你的域名/admin/` → 用 GitHub 登录 → 左侧「活动通知」→ **New** 填写标题/日期/正文 → **Publish**。
Decap 会把 Markdown 写回仓库，Cloudflare 自动重新构建，**几分钟内前台就更新**。

---

## 五、表单免费方案（避免 Formspree 付费）

三个申请表单目前 POST 到占位地址（`src/site.ts` 的 `formEndpoint`）。免费替代：

1. **腾讯问卷（免费档）**：建好问卷 → 复制链接 → 把对应页面里 `<Form>` 换成链接按钮（最简单，零代码）。
2. **Cloudflare Worker + KV（免费）**：写一个接收 POST 的 Worker，把 `formEndpoint` 指向它（适合想保留站内表单样式）。
3. 接好后，**非技术委员在 Decap 里改不了表单地址**——表单地址仍由代码（`src/site.ts`）管理，或由你用 AI 改。

---

## 六、本地预览后台（可选）

```bash
npx decap-server        # 终端 A：起本地 Git 后端
npm run dev             # 终端 B：起站点，开 http://localhost:4321/admin/
```
`public/admin/config.yml` 里取消 `local_backend: true` 注释即可本地登录（无需 OAuth）。

---

## 七、后续可增强

- 把「工委简介 / 企业需求库」等页面正文抽成 Markdown，交给 Decap 编辑（目前页面是 `.astro` 代码，需小重构）。
- 企业需求库检索：用 Pagefind / Fuse.js 做纯前端搜索。
- 停掉本地 Halo 容器（`docker stop halo halodb`）以省资源——Halo 方案已弃用。
