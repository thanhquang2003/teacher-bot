const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, client } = require('./helpers');

let s;
before(async () => { s = await start(); });
after(() => s.close());

test('chưa đăng nhập thì /api/me trả profile null', async () => {
  const c = client(s.base);
  const me = await c.json('/api/me');
  assert.equal(me.profile, null);
  assert.equal(me.grades['5'], 'Lớp 5');
  assert.deepEqual(Object.keys(me.grades), ['2', '5', '6', '9', '12', 'dai-hoc']);
});

test('đăng nhập lần đầu tạo hồ sơ, lần sau tự nhận diện qua cookie', async () => {
  const c = client(s.base);
  const r = await c.call('/api/login', { method: 'POST', body: { name: '  Minh   An ', grade: '5' } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('set-cookie'), /HttpOnly/);
  assert.match(r.headers.get('set-cookie'), /Path=\/teacher-bot/);
  const me = await c.json('/api/me');
  assert.deepEqual({ name: me.profile.name, grade: me.profile.grade }, { name: 'Minh An', grade: '5' });
});

test('đăng xuất xoá nhận diện; vào lại bằng tên+lớp trúng đúng hồ sơ cũ', async () => {
  const c = client(s.base);
  const a = await c.json('/api/login', { method: 'POST', body: { name: 'Lan', grade: '9' } });
  await c.call('/api/logout', { method: 'POST' });
  assert.equal((await c.json('/api/me')).profile, null);
  const b = await c.json('/api/login', { method: 'POST', body: { name: 'lan', grade: '9' } });
  assert.equal(b.profile.id, a.profile.id);
});

test('người khác đăng nhập trên cùng máy sau khi đăng xuất', async () => {
  const c = client(s.base);
  await c.call('/api/login', { method: 'POST', body: { name: 'Bố', grade: 'dai-hoc' } });
  await c.call('/api/logout', { method: 'POST' });
  await c.call('/api/login', { method: 'POST', body: { name: 'Hà', grade: '6' } });
  assert.equal((await c.json('/api/me')).profile.name, 'Hà');
});

test('đăng xuất ở máy này không đăng xuất máy khác của cùng hồ sơ', async () => {
  const a = client(s.base), b = client(s.base);
  await a.call('/api/login', { method: 'POST', body: { name: 'Nam', grade: '6' } });
  await b.call('/api/login', { method: 'POST', body: { name: 'Nam', grade: '6' } });
  await a.call('/api/logout', { method: 'POST' });
  assert.equal((await b.json('/api/me')).profile.name, 'Nam');
});

test('từ chối tên rỗng, lớp sai, cookie giả', async () => {
  const c = client(s.base);
  assert.equal((await c.call('/api/login', { method: 'POST', body: { name: '  ', grade: '5' } })).status, 400);
  assert.equal((await c.call('/api/login', { method: 'POST', body: { name: 'A', grade: '7' } })).status, 400);
  assert.equal((await c.call('/api/login', { method: 'POST', body: { name: 'A', grade: '__proto__' } })).status, 400);
  const bad = await c.json('/api/me', { headers: { cookie: 'tb_device=khonghople' } });
  assert.equal(bad.profile, null);
});

test('cờ Secure khi bật COOKIE_SECURE', async () => {
  const t = await start({ cookieSecure: true });
  const r = await client(t.base).call('/api/login', { method: 'POST', body: { name: 'X', grade: '5' } });
  assert.match(r.headers.get('set-cookie'), /Secure/);
  await t.close();
});
