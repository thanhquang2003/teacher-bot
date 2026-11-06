(() => {
  const $ = (id) => document.getElementById(id);
  const api = (p, o = {}) => fetch('api/admin/' + p, { method: o.method || 'GET', headers: o.body ? { 'content-type': 'application/json' } : {}, body: o.body ? JSON.stringify(o.body) : undefined });

  async function load() {
    const r = await api('state');
    if (r.status === 401 || r.status === 503) { $('main').hidden = true; $('login').hidden = false; if (r.status === 503) $('le').textContent = (await r.json()).error; return; }
    const d = await r.json(); $('login').hidden = true; $('main').hidden = false;
    const s = d.settings;
    $('provider').value = s.provider; $('concurrency').value = s.concurrency;
    $('claude_model').value = s.claude_model; $('codex_model').value = s.codex_model; $('api_model').value = s.api_model;
    $('keystate').textContent = s.api_key_set ? '(đã cài)' : '(chưa có)'; $('api_key').value = '';
    const e = d.lastError;
    $('le2').textContent = e ? `${e.at}\nnguồn: ${e.provider} · loại: ${e.kind}\n${e.detail}` : 'Chưa có lỗi.';
    $('q').textContent = `${d.queue.running} đang chạy, ${d.queue.waiting} đang chờ`;
    $('st').textContent = `${d.stats.profiles} hồ sơ, ${d.stats.sessions} phiên, ${d.stats.messages} tin`;
  }
  $('lf').addEventListener('submit', async (e) => {
    e.preventDefault(); $('le').textContent = '';
    const r = await api('login', { method: 'POST', body: { password: $('pw').value } });
    if (!r.ok) { $('le').textContent = (await r.json()).error; return; }
    $('pw').value = ''; load();
  });
  $('sf').addEventListener('submit', async (e) => {
    e.preventDefault(); $('se').textContent = '';
    const body = { provider: $('provider').value, concurrency: Number($('concurrency').value), claude_model: $('claude_model').value.trim(), codex_model: $('codex_model').value.trim(), api_model: $('api_model').value.trim() };
    if ($('api_key').value.trim()) body.api_key = $('api_key').value.trim();
    const r = await api('settings', { method: 'PUT', body });
    if (!r.ok) { $('se').textContent = (await r.json()).error; return; }
    $('se').textContent = ''; load();
  });
  $('clearkey').addEventListener('click', async () => { if (confirm('Xoá API key đã lưu?')) { await api('settings', { method: 'PUT', body: { clear_api_key: true, provider: $('provider').value === 'api' ? 'claude' : $('provider').value } }); load(); } });
  $('test').addEventListener('click', async () => {
    const tr = $('tr'); tr.hidden = false; tr.textContent = 'Đang thử… (có thể mất 10–20 giây)';
    const d = await (await api('test', { method: 'POST' })).json();
    tr.textContent = d.ok ? `OK sau ${d.ms}ms — trả lời: ${d.reply}` : `LỖI (${d.kind}) sau ${d.ms}ms\n${d.detail}`;
    load();
  });
  $('out').addEventListener('click', async () => { await api('logout', { method: 'POST' }); load(); });
  load();
})();
