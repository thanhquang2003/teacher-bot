const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, client } = require('./helpers');
const { AiError } = require('../src/ai/errors');

let s, used;
before(async () => {
  const ok = (name) => async (a) => { used = name; a.onDelta('ok'); return 'ok'; };
  s = await start({ adminPassword: 'mat-khau' }, { runners: { claude: ok('claude'), codex: ok('codex'), api: async (a) => { used = 'api:' + a.apiKey; a.onDelta('ok'); return 'ok'; } } });
});
after(() => s.close());

const adminLogin = async (pw = 'mat-khau') => { const c = client(s.base); const r = await c.call('/api/admin/login', { method: 'POST', body: { password: pw } }); return { c, r }; };
const put = (c, body) => c.call('/api/admin/settings', { method: 'PUT', body });

test('chưa đăng nhập admin thì bị chặn; học sinh thường không vào được', async () => {
  const c = client(s.base);
  assert.equal((await c.call('/api/admin/state')).status, 401);
  await c.call('/api/login', { method: 'POST', body: { name: 'HS', grade: '5' } });
  assert.equal((await c.call('/api/admin/state')).status, 401);
  assert.equal((await put(c, { provider: 'api' })).status, 401);
});

test('sai mật khẩu bị từ chối, cookie giả/hết hạn bị từ chối', async () => {
  assert.equal((await adminLogin('sai')).r.status, 401);
  const c = client(s.base);
  const r = await c.call('/api/admin/state', { headers: { cookie: 'tb_admin=9999999999.deadbeef' } });
  assert.equal(r.status, 401);
});

test('đăng nhập đúng, xem trạng thái, không lộ API key', async () => {
  const { c, r } = await adminLogin();
  assert.equal(r.status, 200);
  assert.match(r.headers.get('set-cookie'), /HttpOnly/);
  assert.equal((await put(c, { api_key: 'sk-secret-123' })).status, 200);
  const st = await c.json('/api/admin/state');
  assert.equal(st.settings.api_key_set, true);
  assert.doesNotMatch(JSON.stringify(st), /sk-secret-123/);
  assert.equal(st.settings.provider, 'claude');
});

test('đổi provider có hiệu lực ngay cho lượt hỏi kế tiếp', async () => {
  const { c } = await adminLogin();
  await put(c, { provider: 'codex' });
  const hs = client(s.base);
  await hs.call('/api/login', { method: 'POST', body: { name: 'Ng', grade: '6' } });
  const ss = (await hs.json('/api/sessions', { method: 'POST', body: {} })).session;
  await (await hs.call(`/api/sessions/${ss.id}/messages`, { method: 'POST', body: { text: 'hi' } })).text();
  assert.equal(used, 'codex');
  await put(c, { provider: 'api' });
  await (await hs.call(`/api/sessions/${ss.id}/messages`, { method: 'POST', body: { text: 'hi' } })).text();
  assert.equal(used, 'api:sk-secret-123');
  await put(c, { provider: 'claude' });
});

test('kiểm tra đầu vào cấu hình', async () => {
  const { c } = await adminLogin();
  assert.equal((await put(c, { provider: 'gpt' })).status, 400);
  assert.equal((await put(c, { concurrency: 0 })).status, 400);
  assert.equal((await put(c, { concurrency: 99 })).status, 400);
  assert.equal((await put(c, { claude_model: 'a; echo hi' })).status, 400);
  await put(c, { clear_api_key: true });
  assert.equal((await put(c, { provider: 'api' })).status, 400); // thiếu key
});

test('nút Hỏi thử trả về ok hoặc lỗi thật', async () => {
  const { c } = await adminLogin();
  const ok = await c.json('/api/admin/test', { method: 'POST' });
  assert.equal(ok.ok, true);
});

test('khoá sau nhiều lần đoán sai mật khẩu', async () => {
  const t = await start({ adminPassword: 'x1' });
  let last;
  for (let i = 0; i < 9; i++) last = (await client(t.base).call('/api/admin/login', { method: 'POST', body: { password: 'bad' + i } })).status;
  assert.equal(last, 429);
  assert.equal((await client(t.base).call('/api/admin/login', { method: 'POST', body: { password: 'x1' } })).status, 429);
  await t.close();
});

test('không đặt ADMIN_PASSWORD thì admin bị tắt', async () => {
  const t = await start({ adminPassword: '' });
  assert.equal((await client(t.base).call('/api/admin/login', { method: 'POST', body: { password: '' } })).status, 503);
  await t.close();
});

test('trang /admin phục vụ được không cần đuôi .html', async () => {
  const html = await (await fetch(s.base + '/admin')).text();
  assert.match(html, /Quản trị/);
});

test('lỗi hết limit hiện ở admin', async () => {
  const t = await start({ adminPassword: 'p' }, { runners: { claude: async () => { throw new AiError('limit', 'usage limit reached, resets at 5pm'); } } });
  const a = client(t.base);
  await a.call('/api/admin/login', { method: 'POST', body: { password: 'p' } });
  const r = await a.json('/api/admin/test', { method: 'POST' });
  assert.equal(r.ok, false); assert.equal(r.kind, 'limit');
  assert.match((await a.json('/api/admin/state')).lastError.detail, /resets at 5pm/);
  await t.close();
});
