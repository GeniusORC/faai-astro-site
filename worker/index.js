// 企工委官网 · 免费自托管表单后端（Cloudflare Worker + KV）
// 部署见 worker/wrangler.toml 与 SETUP.md「表单免费自托管」一节。
// 无任何第三方服务、无订阅费；数据存于你自己的 Cloudflare KV。

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Decap CMS GitHub OAuth 登录入口
    if (url.pathname === '/auth' && request.method === 'GET') {
      return handleAuth(request);
    }

    // Decap CMS GitHub OAuth 回调
    if (url.pathname === '/callback' && request.method === 'GET') {
      return handleCallback(request, env);
    }

    // 查看提交记录（需 admin token）
    if (url.pathname === '/submissions' && request.method === 'GET') {
      if (url.searchParams.get('admin') !== env.ADMIN_TOKEN) {
        return new Response('Forbidden', { status: 403 });
      }
      const list = await env.FORM_SUBMISSIONS.list();
      const rows = [];
      for (const k of list.keys) {
        const raw = await env.FORM_SUBMISSIONS.get(k.name);
        try {
          rows.push(JSON.parse(raw));
        } catch {
          rows.push({ raw });
        }
      }
      rows.reverse();
      return new Response(renderTable(rows), {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    // 接收表单提交（原生 form POST，无需 JS，微信友好）
    if (url.pathname === '/submit' && request.method === 'POST') {
      let form;
      try {
        form = await request.formData();
      } catch {
        return resultPage('error', '', env.SITE_URL);
      }

      // 蜜罐：机器人填了隐藏字段则静默丢弃
      if (form.get('_gotcha')) {
        return resultPage('spam', form.get('_form') || '', env.SITE_URL);
      }
      const formKey = form.get('_form');
      if (!['expert', 'member', 'project'].includes(formKey)) {
        return resultPage('error', '', env.SITE_URL);
      }

      const data = {};
      for (const [k, v] of form.entries()) {
        if (!k.startsWith('_')) data[k] = typeof v === 'string' ? v : '';
      }
      data._submittedAt = new Date().toISOString();

      const key = formKey + '-' + Date.now();
      try {
        await env.FORM_SUBMISSIONS.put(key, JSON.stringify(data, null, 2));
      } catch {
        return resultPage('error', formKey, env.SITE_URL);
      }
      return resultPage('ok', formKey, env.SITE_URL);
    }

    return new Response('Not found', { status: 404 });
  },
};

// 同域结果页：避免跨域 302 被浏览器/微信拦截，先在本域渲染结果，再自动跳回官网
function resultPage(status, formKey, siteUrl) {
  const ok = status === 'ok';
  const map = { expert: '专家登记', member: '入会申请', project: '课题申请' };
  const name = (formKey && map[formKey]) || '申请';
  const title = ok ? '提交成功' : '提交未成功';
  const msg = ok
    ? `您的${name}已收到，企工委工作人员将尽快与您联系。`
    : '提交未成功，请返回重试，或直接联系企工委工作人员。';
  const target = `${siteUrl}/thank-you?form=${encodeURIComponent(formKey)}&status=${status}`;
  return new Response(
    `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${title}</title>` +
      `<meta http-equiv="refresh" content="2;url=${target}">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<style>body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;` +
      `background:#f4f7fb;color:#1f2430;display:flex;min-height:100vh;align-items:center;justify-content:center;` +
      `text-align:center;margin:0;padding:24px}` +
      `.box{max-width:420px}.ic{width:56px;height:56px;border-radius:50%;display:inline-grid;place-items:center;` +
      `font-size:28px;margin-bottom:14px;${ok ? 'background:#e6f4ea;color:#1a7f37' : 'background:#fdecef;color:#c8102e'}}` +
      `h1{font-size:22px;color:#1a3a6e;margin:0 0 10px}` +
      `p{margin:6px 0;font-size:15px;line-height:1.7;color:#5b6577}` +
      `a{display:inline-block;margin-top:16px;color:#1a3a6e;font-weight:600;text-decoration:none}` +
      `.tip{font-size:13px;margin-top:14px}</style></head><body><div class="box">` +
      `<div class="ic">${ok ? '✓' : '!'}</div>` +
      `<h1>${title}</h1><p>${msg}</p>` +
      `<p class="tip">正在返回官网…</p>` +
      `<a href="${target}">如未自动跳转，点此返回 ›</a></div></body></html>`,
    {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    }
  );
}

// --- Decap CMS GitHub OAuth 代理 ---
// 因 faai-astro-site 是 Cloudflare Workers 项目（非 Pages），functions/ 目录不生效，
// 所以把 OAuth 代理放在本 Worker（faai-forms）里，供 Decap 的 base_url 使用。

const OAUTH_CLIENT_ID = 'Ov23liigaiBfdCk6thtu';
const OAUTH_REDIRECT_URI = 'https://faai-forms.450311590.workers.dev/callback';

function handleAuth(request) {
  const state = crypto.randomUUID();
  const githubUrl = new URL('https://github.com/login/oauth/authorize');
  githubUrl.searchParams.set('client_id', OAUTH_CLIENT_ID);
  githubUrl.searchParams.set('redirect_uri', OAUTH_REDIRECT_URI);
  githubUrl.searchParams.set('scope', 'repo');
  githubUrl.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: {
      'Location': githubUrl.toString(),
      'Set-Cookie': `decap_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/callback; Max-Age=600`,
      'Cache-Control': 'no-store',
    },
  });
}

async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return new Response('Missing authorization code', { status: 400 });
  }

  const cookieHeader = request.headers.get('Cookie') || '';
  const cookieState = cookieHeader.match(/decap_state=([^;]+)/)?.[1];
  if (state && cookieState && state !== cookieState) {
    return new Response('Invalid state parameter', { status: 403 });
  }

  const clientSecret = env.GITHUB_CLIENT_SECRET;
  if (!clientSecret) {
    return new Response(
      'Server misconfiguration: GITHUB_CLIENT_SECRET not set.',
      { status: 500 }
    );
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: OAUTH_CLIENT_ID,
      client_secret: clientSecret,
      code,
      redirect_uri: OAUTH_REDIRECT_URI,
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

  return new Response(
    `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8" /><title>GitHub 授权回调</title></head>
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
      if (window.opener) window.opener.postMessage('authorizing:github', '*');
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

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function renderTable(rows) {
  const head = ['时间', '类型', '内容'];
  let body = rows
    .map((r) => {
      const t = esc(r._submittedAt || '');
      const type = esc(r._form || '');
      const det = Object.entries(r)
        .filter(([k]) => !k.startsWith('_'))
        .map(([k, v]) => '<b>' + esc(k) + '</b>: ' + esc(v))
        .join('<br>');
      return '<tr><td>' + t + '</td><td>' + type + '</td><td>' + det + '</td></tr>';
    })
    .join('');
  if (!body) body = '<tr><td colspan="3">暂无提交记录</td></tr>';
  return (
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>表单提交记录</title>' +
    '<style>body{font-family:sans-serif;padding:24px;background:#f7f7f7;color:#222}' +
    'h1{font-size:18px}table{width:100%;border-collapse:collapse;background:#fff}' +
    'th,td{border:1px solid #ddd;padding:8px 10px;text-align:left;vertical-align:top;font-size:13px}' +
    'th{background:#1a3a6e;color:#fff}</style></head><body>' +
    '<h1>表单提交记录（企工委）</h1>' +
    '<table><thead><tr>' +
    head.map((h) => '<th>' + h + '</th>').join('') +
    '</tr></thead><tbody>' +
    body +
    '</tbody></table></body></html>'
  );
}
