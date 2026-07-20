// 企工委官网 · 免费自托管表单后端（Cloudflare Worker + KV）
// 部署见 worker/wrangler.toml 与 SETUP.md「表单免费自托管」一节。
// 无任何第三方服务、无订阅费；数据存于你自己的 Cloudflare KV。

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
        return redirect(env.SITE_URL + '/thank-you?status=error');
      }

      // 蜜罐：机器人填了隐藏字段则静默丢弃
      if (form.get('_gotcha')) {
        return redirect(env.SITE_URL + '/thank-you?form=' + (form.get('_form') || '') + '&status=spam');
      }
      const formKey = form.get('_form');
      if (!['expert', 'member', 'project'].includes(formKey)) {
        return redirect(env.SITE_URL + '/thank-you?status=error');
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
        return redirect(env.SITE_URL + '/thank-you?form=' + formKey + '&status=error');
      }
      return redirect(env.SITE_URL + '/thank-you?form=' + formKey + '&status=ok');
    }

    return new Response('Not found', { status: 404 });
  },
};

function redirect(loc) {
  return new Response(null, { status: 302, headers: { Location: loc } });
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
