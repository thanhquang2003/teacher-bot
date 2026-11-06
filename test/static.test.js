const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helpers');

let s;
before(async () => { s = await start(); });
after(() => s.close());

test('phục vụ giao diện tại base path với tài nguyên tương đối', async () => {
  const html = await (await fetch(s.base + '/')).text();
  assert.match(html, /<title>Gia sư của em<\/title>/);
  assert.match(html, /href="style\.css"/);
  assert.match(html, /src="app\.js"/);
  assert.equal((await fetch(s.base + '/app.js')).status, 200);
  assert.equal((await fetch(s.base + '/style.css')).status, 200);
});

test('truy cập không dấu / được chuyển hướng về có dấu /', async () => {
  const r = await fetch(s.base, { redirect: 'manual' });
  assert.ok([301, 302, 308].includes(r.status));
  assert.match(r.headers.get('location'), /\/teacher-bot\/$/);
});
