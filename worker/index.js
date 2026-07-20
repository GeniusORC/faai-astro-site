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

    // 审核后台（需 admin token）：列表 / 详情 / 通过 / 拒绝
    if (url.pathname === '/review' && request.method === 'GET') {
      const admin = url.searchParams.get('admin');
      if (admin !== env.ADMIN_TOKEN) return new Response('Forbidden', { status: 403 });
      const key = url.searchParams.get('key');
      if (key) return handleReviewItem(env, key, admin);
      return handleReviewList(env, admin, url.searchParams.get('msg'));
    }
    if ((url.pathname === '/review/approve' || url.pathname === '/review/reject') && request.method === 'POST') {
      const admin = (await request.formData()).get('admin');
      if (admin !== env.ADMIN_TOKEN) return new Response('Forbidden', { status: 403 });
      const status = url.pathname.endsWith('/approve') ? 'approved' : 'rejected';
      return handleReviewAction(request, env, status);
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

// ---------- 审核后台辅助 ----------

function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function fmEscape(s) {
  return String(s == null ? '' : s).replace(/"/g, '\\"');
}

function buildMarkdown(formKey, d) {
  const line = (k, v) => `${k}: "${fmEscape(v)}"`;
  if (formKey === 'expert') {
    const fm = [
      line('name', d.name),
      line('title', d.title),
      line('org', d.org),
      line('field', d.field),
      line('email', d.email || ''),
      'order: 0',
    ].join('\n');
    return `---\n${fm}\n---\n\n${d.achievement || ''}\n`;
  }
  if (formKey === 'member') {
    const fm = [
      line('org', d.org),
      line('type', d.type || '企业会员'),
      line('contact', d.contact || ''),
      line('phone', d.phone || ''),
      line('email', d.email || ''),
      'order: 0',
    ].join('\n');
    return `---\n${fm}\n---\n\n${d.business || ''}\n`;
  }
  if (formKey === 'project') {
    const fm = [
      line('title', d.title),
      line('lead', d.lead),
      line('type', d.type || '联合攻关'),
      line('phone', d.phone || ''),
      line('email', d.email || ''),
      'order: 0',
    ].join('\n');
    return `---\n${fm}\n---\n\n${d.abstract || ''}\n`;
  }
  return '';
}

async function githubPut(env, path, content, message) {
  if (!env.GITHUB_API_TOKEN) return { ok: false, err: 'GITHUB_API_TOKEN 未配置' };
  const repo = 'GeniusORC/faai-astro-site';
  const url = `https://api.github.com/repos/${repo}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${env.GITHUB_API_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'faai-review',
    'Content-Type': 'application/json',
  };
  let sha;
  const getRes = await fetch(url, { headers });
  if (getRes.ok) sha = (await getRes.json()).sha;
  const body = { message, content: b64encode(content) };
  if (sha) body.sha = sha;
  const putRes = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
  return { ok: putRes.ok, status: putRes.status };
}

function redirectReview(admin, msg) {
  const loc = `/review?admin=${encodeURIComponent(admin)}` + (msg ? `&msg=${encodeURIComponent(msg)}` : '');
  return new Response(null, { status: 302, headers: { Location: loc, 'Cache-Control': 'no-store' } });
}

const TYPE_LABEL = { expert: '专家登记', member: '入会申请', project: '课题申请' };
const FOLDER = { expert: 'experts', member: 'members', project: 'projects' };

function reviewShell(admin, inner, msg) {
  const banner = msg ? `<div class="banner">${esc(msg)}</div>` : '';
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>申请审核后台</title>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;' +
    'margin:0;background:#f4f7fb;color:#1f2430;padding:24px}' +
    '.wrap{max-width:960px;margin:0 auto}' +
    'h1{font-size:20px;color:#1a3a6e;margin:0 0 4px}' +
    '.sub{color:#5b6577;font-size:13px;margin-bottom:18px}' +
    '.banner{background:#e6f4ea;color:#1a7f37;border:1px solid #b7e0c2;padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:14px}' +
    '.cols{display:grid;grid-template-columns:1fr;gap:18px}' +
    '@media(min-width:720px){.cols{grid-template-columns:1fr 1fr 1fr}}' +
    '.col{background:#fff;border:1px solid #e7ebf1;border-radius:10px;padding:14px}' +
    '.col h2{font-size:15px;margin:0 0 10px;color:#1a3a6e;border-bottom:3px solid #c8102e;padding-bottom:8px;display:inline-block}' +
    '.item{border-top:1px solid #eef1f5;padding:10px 0}' +
    '.item:first-of-type{border-top:0}' +
    '.item .t{font-weight:600;font-size:14px}' +
    '.item .m{color:#5b6577;font-size:12px;margin:2px 0 6px}' +
    'a.btn{display:inline-block;font-size:13px;color:#1a3a6e;font-weight:600;text-decoration:none}' +
    '.empty{color:#9aa3b2;font-size:13px}' +
    'table{width:100%;border-collapse:collapse;background:#fff}' +
    'th,td{border:1px solid #e7ebf1;padding:9px 11px;text-align:left;vertical-align:top;font-size:13px}' +
    'th{background:#1a3a6e;color:#fff;width:120px}' +
    '.acts{margin-top:18px;display:flex;gap:12px}' +
    '.acts button{padding:11px 22px;border:0;border-radius:8px;font-size:15px;cursor:pointer;font-weight:600}' +
    '.ok{background:#1a7f37;color:#fff}' +
    '.no{background:#c8102e;color:#fff}' +
    'a.back{display:inline-block;margin-bottom:14px;color:#1a3a6e;font-size:13px;text-decoration:none}</style>' +
    '</head><body><div class="wrap">' + banner + inner + '</div></body></html>';
}

async function handleReviewList(env, admin, msg) {
  const list = await env.FORM_SUBMISSIONS.list();
  const all = [];
  for (const k of list.keys) {
    const raw = await env.FORM_SUBMISSIONS.get(k.name);
    try { const d = JSON.parse(raw); d.__key = k.name; all.push(d); } catch {}
  }
  const pending = all.filter((d) => d.status !== 'approved' && d.status !== 'rejected');
  const groups = { expert: [], member: [], project: [] };
  for (const d of pending) if (groups[d._form]) groups[d._form].push(d);

  const col = (key) => {
    const items = groups[key];
    const body = items.length
      ? items.map((d) => {
          const title = d.name || d.org || d.title || '(未命名)';
          const meta = (d._submittedAt || '').slice(0, 16).replace('T', ' ');
          return `<div class="item"><div class="t">${esc(title)}</div>` +
            `<div class="m">${esc(meta)}</div>` +
            `<a class="btn" href="/review?admin=${encodeURIComponent(admin)}&key=${encodeURIComponent(d.__key)}">查看 / 审核 ›</a></div>`;
        }).join('')
      : '<div class="empty">暂无待审</div>';
    return `<div class="col"><h2>${TYPE_LABEL[key]}</h2>${body}</div>`;
  };

  const inner = `<h1>申请审核后台</h1><div class="sub">企工委官网 · 待审申请（通过后将自动发布到对应名录）</div>` +
    `<div class="cols">${col('expert')}${col('member')}${col('project')}</div>`;
  return new Response(reviewShell(admin, inner, msg), { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

async function handleReviewItem(env, key, admin) {
  const raw = await env.FORM_SUBMISSIONS.get(key);
  if (!raw) return new Response(reviewShell(admin, '<h1>申请审核后台</h1><div class="sub">记录不存在</div>'), { headers: { 'content-type': 'text/html; charset=utf-8' } });
  const d = JSON.parse(raw);
  const rows = Object.entries(d)
    .filter(([k]) => !k.startsWith('_') && k !== '__key')
    .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`)
    .join('');
  const inner = `<a class="back" href="/review?admin=${encodeURIComponent(admin)}">‹ 返回列表</a>` +
    `<h1>${TYPE_LABEL[d._form] || '申请'} · 详情</h1>` +
    `<div class="sub">提交时间：${esc((d._submittedAt || '').replace('T', ' '))}</div>` +
    `<table>${rows}</table>` +
    `<div class="acts">` +
    `<form method="POST" action="/review/approve"><input type="hidden" name="key" value="${esc(key)}"><input type="hidden" name="admin" value="${esc(admin)}"><button class="ok" type="submit">通过并发布</button></form>` +
    `<form method="POST" action="/review/reject"><input type="hidden" name="key" value="${esc(key)}"><input type="hidden" name="admin" value="${esc(admin)}"><button class="no" type="submit">拒绝</button></form>` +
    `</div>`;
  return new Response(reviewShell(admin, inner, ''), { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

async function handleReviewAction(request, env, status) {
  const form = await request.formData();
  const key = form.get('key');
  const admin = form.get('admin');
  const raw = await env.FORM_SUBMISSIONS.get(key);
  if (!raw) return redirectReview(admin, '记录不存在');
  const d = JSON.parse(raw);
  if (status === 'approved') {
    const md = buildMarkdown(d._form, d);
    if (!md) return redirectReview(admin, '未知申请类型');
    const slug = `${d._form}-${Date.now()}`;
    const path = `src/content/${FOLDER[d._form]}/${slug}.md`;
    const gh = await githubPut(env, path, md, `审核通过：${TYPE_LABEL[d._form] || d._form} ${key}`);
    if (!gh.ok) return redirectReview(admin, 'GitHub 写入失败：' + (gh.err || ('HTTP ' + gh.status)));
  }
  d.status = status;
  d._reviewedAt = new Date().toISOString();
  await env.FORM_SUBMISSIONS.put(key, JSON.stringify(d, null, 2));
  return redirectReview(admin, status === 'approved' ? '已通过并发布到官网' : '已拒绝（保留备查）');
}
