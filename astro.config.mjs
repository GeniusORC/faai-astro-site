// @ts-check
import { defineConfig } from 'astro/config';

// 静态站点（SSG）。部署到 EdgeOne / Cloudflare Pages / Vercel 等任意静态托管。
// 若部署到子路径（如 GitHub Pages 项目页），把 base 设为对应前缀，例如 '/repo'。
export default defineConfig({
  site: 'https://qigongwei.faai.org',
  // base: '/',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
  // 国内访问友好：默认输出纯静态 HTML，无需服务端。
});
