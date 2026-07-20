# 企工委官网 · Decap 后台接入与上线步骤

技术栈：Astro（前端，MIT）+ Decap CMS（后台，MIT，自托管，免费）+ Cloudflare Pages / 腾讯云 EdgeOne（免费档托管）。
全部开源、自托管，**无任何 SaaS 订阅费**。唯一硬成本：一个域名（约 ¥50/年，可选）。

> 说明：本文件里的 `REPO_OWNER`、`REPO_NAME` 指你的 GitHub 用户名和仓库名。
> 你的 GitHub 账号邮箱：`450311590@qq.com`（用它登录 github.com）。

---

## 一、你要在网页上点几下的事（我无法代登你的私人账号）

### 1. 建 GitHub 仓库（你已完成）
- 仓库已建好：`https://github.com/GeniusORC/faai-astro-site.git`（Public）

### 2. 建 GitHub OAuth App（Decap 登录用）
- GitHub → 右上角头像 → **Settings** → 左侧 **Developer settings** → **OAuth Apps** → **New OAuth App**
- Application name：`faai-cms`（随意）
- Homepage URL：你的上线域名，例如 `https://faai.pages.dev`
- Authorization callback URL：**`https://你的域名/admin/`**（结尾斜杠不能少）
- 点 **Register application**
- 记下 **Client ID** → 打开 `public/admin/config.yml`，把 `client_id: 你的OAuthApp_ClientID` 改成真实的 Client ID
- （pkce 模式不需要 Client Secret，无需填写）

### 3. 连托管平台（Cloudflare Pages 为例）
- 登录 https://pages.cloudflare.com → **Connect to Git** → 选刚建的仓库
- Build command：`npm run build`
- Build output directory：`dist`
- Node.js version：20
- 部署完成后得到域名（如 `faai.pages.dev`）

---

## 二、改一处配置（本地改完提交即可）

打开 `public/admin/config.yml`，确认仓库已是 `repo: GeniusORC/faai-astro-site`，并把 `client_id` 改成你刚建的 OAuth App 的 Client ID：

```yaml
backend:
  repo: GeniusORC/faai-astro-site
  client_id: 你的OAuthApp_ClientID   # 改成真实的 Client ID
```

然后回到上面「步骤 2」把 OAuth App 的 Homepage / Callback 改成你最终域名。

---

## 三、本地推送到 GitHub（在 astro-site 目录执行）

代码已 `git init` 并提交了初始版本，你只需加远程并推送：

```bash
cd astro-site
git remote add origin https://github.com/GeniusORC/faai-astro-site.git
git branch -M main
git push -u origin main
```

推送后 Cloudflare Pages 会自动构建并上线。

---

## 四、使用后台发通知

浏览器打开 `https://你的域名/admin/` → 用 GitHub 登录 → 左侧「活动通知」→ **New** 填写标题/日期/正文 → **Publish**。
Decap 会把 Markdown 写回仓库，Cloudflare 自动重新构建，**几分钟内前台就更新**。

---

## 五、表单免费自托管（Cloudflare Worker + KV，推荐）

已默认接好：三个申请表单 POST 到 `src/site.ts` 的 `formEndpoint`（你的 Cloudflare Worker），由 Worker 把数据存进你自己的 Cloudflare KV，**无任何第三方、无订阅费**。查看记录：`https://<worker>.workers.dev/submissions?admin=<ADMIN_TOKEN>`。

部署步骤（在 astro-site 目录）：

1. 安装并登录 wrangler：`npm i -g wrangler` → `wrangler login`
2. 建 KV 命名空间：`wrangler kv namespace create FORM_SUBMISSIONS`，把返回的 id 填进 `worker/wrangler.toml` 的 `id`
3. 改 `worker/wrangler.toml`：`SITE_URL` 改成你的 `https://<project>.pages.dev`；`ADMIN_TOKEN` 改成强口令（或 `wrangler secret put ADMIN_TOKEN`）
4. 部署：`cd worker && wrangler deploy`
5. 把 `src/site.ts` 的 `formEndpoint` 改成 `https://<worker>.workers.dev/submit`（`<worker>` 即部署后的子域）

### 零代码备选：腾讯问卷免费档

若不想部署 Worker，在 wj.qq.com 建 3 份问卷（专家登记 / 入会申请 / 课题申请），复制链接，然后在对应页面给 `<Form>` 加 `surveyUrl="https://wj.qq.com/..."`（如 `src/pages/zhuan-jia.astro` 的 `<Form ... surveyUrl="..." />`）。页面会自动显示「点击前往填写」按钮，数据存于你的腾讯问卷后台。

> 表单目标由代码管理（`src/site.ts` / 页面 `surveyUrl`），Decap 目前不编辑表单目标。

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
