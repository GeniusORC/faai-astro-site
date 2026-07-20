/**
 * Decap CMS GitHub OAuth 登录入口
 * 生成随机 state，写入 HttpOnly cookie，然后跳转到 GitHub authorize 页面。
 */
export async function onRequestGet(context: any) {
  const SITE_URL = 'https://faai-astro-site.450311590.workers.dev';
  const CLIENT_ID = 'Ov23liigaiBfdCk6thtu';
  const REDIRECT_URI = `${SITE_URL}/api/callback`;

  // 生成随机 state（Cloudflare Workers 运行时支持 crypto.randomUUID）
  const state = crypto.randomUUID();

  const githubUrl = new URL('https://github.com/login/oauth/authorize');
  githubUrl.searchParams.set('client_id', CLIENT_ID);
  githubUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  githubUrl.searchParams.set('scope', 'repo');
  githubUrl.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: {
      'Location': githubUrl.toString(),
      'Set-Cookie': `decap_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/api/callback; Max-Age=600`,
      'Cache-Control': 'no-store',
    },
  });
}
