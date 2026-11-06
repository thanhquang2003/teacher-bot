const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, client } = require('./helpers');
const { AiError } = require('../src/ai/errors');
const { systemPrompt } = require('../src/tutor');

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]).toString('base64');
const calls = [];
let mode = 'ok';
const fake = async (args) => {
  calls.push(args);
  if (mode === 'limit') throw new AiError('limit', 'You have hit your usage limit');
  args.onDelta('Xin '); args.onDelta('chào');
  return 'Xin chào';
};
const runners = { claude: fake, codex: fake, api: fake };

let s;
before(async () => { s = await start({}, { runners }); });
after(() => s.close());

async function login(name = 'Bi', grade = '5') {
  const c = client(s.base);
  await c.call('/api/login', { method: 'POST', body: { name, grade } });
  return c;
}
function parseSse(t) {
  return t.split('\n\n').filter(Boolean).map((b) => {
    const ev = /event: (.*)/.exec(b)[1]; const data = JSON.parse(/data: (.*)/.exec(b)[1]); return { ev, data };
  });
}
const send = (c, id, body) => c.call(`/api/sessions/${id}/messages`, { method: 'POST', body });

test('cần đăng nhập để dùng phiên học', async () => {
  const r = await client(s.base).call('/api/sessions');
  assert.equal(r.status, 401);
});

test('tạo phiên, hỏi bằng chữ, nhận stream, lưu lịch sử và tự đặt tên', async () => {
  const c = await login();
  const { session } = await c.json('/api/sessions', { method: 'POST', body: {} });
  const r = await send(c, session.id, { text: 'Tính 3/4 + 1/8' });
  const evs = parseSse(await r.text());
  assert.deepEqual(evs.map((e) => e.ev), ['start', 'delta', 'delta', 'done']);
  const { messages } = await c.json(`/api/sessions/${session.id}/messages`);
  assert.deepEqual(messages.map((m) => [m.role, m.content]), [['user', 'Tính 3/4 + 1/8'], ['assistant', 'Xin chào']]);
  const { sessions } = await c.json('/api/sessions');
  assert.equal(sessions[0].title, 'Tính 3/4 + 1/8');
  const last = calls.at(-1);
  assert.match(last.system, /Lớp|lớp 5/);
  assert.match(last.system, /KHÔNG đưa đáp án cuối cùng/);
});

test('lượt sau gửi kèm lịch sử hội thoại', async () => {
  const c = await login('Hoa', '6');
  const { session } = await c.json('/api/sessions', { method: 'POST', body: {} });
  await (await send(c, session.id, { text: 'câu một' })).text();
  await (await send(c, session.id, { text: 'câu hai' })).text();
  assert.match(calls.at(-1).prompt, /HỌC SINH: câu một/);
  assert.match(calls.at(-1).prompt, /GIA SƯ: Xin chào/);
});

test('gửi ảnh: lưu, truyền đường dẫn cho AI, chỉ chủ hồ sơ xem được', async () => {
  const c = await login('An', '9');
  const { session } = await c.json('/api/sessions', { method: 'POST', body: {} });
  const evs = parseSse(await (await send(c, session.id, { text: 'bài này', images: [{ data: PNG }] })).text());
  const name = evs[0].data.images[0];
  assert.match(name, /\.png$/);
  assert.equal(calls.at(-1).imagePaths.length, 1);
  assert.equal((await c.call(`/api/images/${name}`)).status, 200);
  const other = await login('Khác', '9');
  assert.equal((await other.call(`/api/images/${name}`)).status, 404);
  assert.equal((await other.call(`/api/images/..%2F..%2Fetc%2Fpasswd`)).status, 404);
});

test('từ chối tệp không phải ảnh, quá nhiều ảnh, tin rỗng, quá dài', async () => {
  const c = await login('Lỗi', '5');
  const { session } = await c.json('/api/sessions', { method: 'POST', body: {} });
  const fake = Buffer.from('<?php echo 1;').toString('base64');
  assert.equal((await send(c, session.id, { text: 'x', images: [{ data: fake, mime: 'image/png' }] })).status, 400);
  assert.equal((await send(c, session.id, { text: 'x', images: [1, 2, 3, 4].map(() => ({ data: PNG })) })).status, 400);
  assert.equal((await send(c, session.id, { text: '  ' })).status, 400);
  assert.equal((await send(c, session.id, { text: 'a'.repeat(4001) })).status, 400);
});

test('không xem/xoá/hỏi trong phiên của người khác', async () => {
  const a = await login('Chủ', '6'), b = await login('Lạ', '6');
  const { session } = await a.json('/api/sessions', { method: 'POST', body: {} });
  assert.equal((await b.call(`/api/sessions/${session.id}/messages`)).status, 404);
  assert.equal((await b.call(`/api/sessions/${session.id}`, { method: 'DELETE' })).status, 404);
  assert.equal((await send(b, session.id, { text: 'hi' })).status, 404);
});

test('đổi tên và xoá phiên', async () => {
  const c = await login('Đổi', '5');
  const { session } = await c.json('/api/sessions', { method: 'POST', body: {} });
  await c.call(`/api/sessions/${session.id}`, { method: 'PATCH', body: { title: 'Toán' } });
  assert.equal((await c.json('/api/sessions')).sessions[0].title, 'Toán');
  await c.call(`/api/sessions/${session.id}`, { method: 'DELETE' });
  assert.equal((await c.json('/api/sessions')).sessions.length, 0);
});

test('hết limit: học sinh thấy thông báo thân thiện, admin lưu được lỗi thật', async () => {
  const c = await login('Limit', '5');
  const { session } = await c.json('/api/sessions', { method: 'POST', body: {} });
  mode = 'limit';
  const evs = parseSse(await (await send(c, session.id, { text: 'hi' })).text());
  mode = 'ok';
  const err = evs.find((e) => e.ev === 'error').data;
  assert.equal(err.kind, 'limit');
  assert.doesNotMatch(err.message, /usage limit/i);
  const saved = JSON.parse(s.app.locals.settings.get('last_error'));
  assert.match(saved.detail, /usage limit/);
});

test('provider được chọn theo cấu hình', async () => {
  const c = await login('Prov', '5');
  const { session } = await c.json('/api/sessions', { method: 'POST', body: {} });
  let used = '';
  const t = await start({}, { runners: { claude: async () => 'c', codex: async (a) => { used = 'codex'; a.onDelta('x'); return 'x'; }, api: async () => 'a' } });
  t.app.locals.settings.set('provider', 'codex');
  const c2 = client(t.base);
  await c2.call('/api/login', { method: 'POST', body: { name: 'P', grade: '5' } });
  const ss = (await c2.json('/api/sessions', { method: 'POST', body: {} })).session;
  await (await c2.call(`/api/sessions/${ss.id}/messages`, { method: 'POST', body: { text: 'hi' } })).text();
  assert.equal(used, 'codex');
  await t.close();
  void session;
});

test('prompt gia sư khác nhau theo lớp, có lớp 2', () => {
  assert.match(systemPrompt('2', 'Bé'), /lớp 2/);
  assert.notEqual(systemPrompt('2', 'A'), systemPrompt('5', 'A'));
  assert.notEqual(systemPrompt('5', 'A'), systemPrompt('dai-hoc', 'A'));
  assert.match(systemPrompt('dai-hoc', 'A'), /đại học/);
});
