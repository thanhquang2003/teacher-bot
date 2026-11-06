const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Gate } = require('../src/ai/queue');

test('giới hạn đồng thời và xếp hàng theo thứ tự', async () => {
  const g = new Gate(1);
  const order = [];
  const r1 = await g.acquire();
  const p2 = g.acquire(() => order.push('wait2')).then((r) => { order.push('got2'); return r; });
  const p3 = g.acquire(() => order.push('wait3')).then((r) => { order.push('got3'); return r; });
  assert.equal(g.position, 2);
  r1();
  (await p2)();
  (await p3)();
  assert.deepEqual(order, ['wait2', 'wait3', 'got2', 'got3']);
  assert.equal(g.running, 0);
});

test('huỷ khi đang chờ thì rời hàng', async () => {
  const g = new Gate(1);
  const r1 = await g.acquire();
  const ac = new AbortController();
  const p = g.acquire(null, ac.signal);
  ac.abort();
  await assert.rejects(p);
  assert.equal(g.position, 0);
  r1();
});
