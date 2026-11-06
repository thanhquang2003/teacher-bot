const { createApp } = require('../src/app');

async function start(overrides = {}, opts = {}) {
  const cfg = { port: 0, host: '127.0.0.1', basePath: '/teacher-bot', dataDir: ':memory:', adminPassword: 'secret', cookieSecure: false, ...overrides };
  const app = createApp(cfg, undefined, opts);
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}${cfg.basePath}`;
  return { app, server, base, cfg, close: () => new Promise((r) => server.close(r)) };
}

// "Trình duyệt" giả: giữ cookie giữa các lần gọi.
function client(base) {
  let cookie = '';
  async function call(path, { method = 'GET', body, headers = {} } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) { const pair = set.split(';')[0]; cookie = pair.endsWith('=') ? '' : pair; }
    return res;
  }
  return { call, json: async (p, o) => (await call(p, o)).json(), get cookie() { return cookie; } };
}

module.exports = { start, client };
