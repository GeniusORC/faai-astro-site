/**
 * Decap CMS GitHub OAuth 回调
 * 用 code + CLIENT_SECRET 向 GitHub 换 access_token，然后通过 postMessage 回传给 Decap。
 * CLIENT_SECRET 必须配置在 Cloudflare Pages 环境变量 GITHUB_CLIENT_SECRET 中，不可明文入仓。
 */
export async function onRequestGet(context: any) {
  const { request, env } = context;
  const SITE_URL = 'https://faai-astro-site.450311590.workers.dev';
  const CLIENT_ID = 'Ov23liigaiBfdCk6thtu';
  const REDIRECT_URI = `${SITE_URL}/api/callback`;

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return new Response('Missing authorization code', { status: 400 });
  }

  // 简单的 state 校验（防 CSRF）
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookieState = cookieHeader.match(/decap_state=([^;]+)/)?.[1];
  if (state && cookieState && state !== cookieState) {
    return new Response('Invalid state parameter', { status: 403 });
  }

  const clientSecret = env.GITHUB_CLIENT_SECRET;
  if (!clientSecret) {
    return new Response(
      'Server misconfiguration: GITHUB_CLIENT_SECRET not set. Please add it in Cloudflare Pages environment variables.',
      { status: 500 }
    );
  }

  // 向 GitHub 换 token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: clientSecret,
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const tokenData = await tokenRes.json();
  if (tokenData.error) {
    return new Response(
      `GitHub OAuth error: ${tokenData.error_description || tokenData.error}`,
      { status: 400 }
    );
  }

  const token = tokenData.access_token;
  const content = JSON.stringify({ token, provider: 'github' });
  const message = JSON.stringify(`authorization:github:success:${content}`);

  // 通过 postMessage 把 token 交给 Decap CMS 父窗口
  return new Response(
    `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>GitHub 授权回调</title>
</head>
<body>
  <p>授权完成，正在关闭窗口…</p>
  <script>
    (function() {
      function receiveMessage(e) {
        if (e.data === 'authorizing:github') {
          window.opener.postMessage(${message}, e.origin);
        }
      }
      window.addEventListener('message', receiveMessage, false);
      if (window.opener) {
        window.opener.postMessage('authorizing:github', '*');
      }
    })();
  </script>
</body>
</html>`,
    {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  );
}
