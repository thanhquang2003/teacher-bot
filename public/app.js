(() => {
  const $ = (id) => document.getElementById(id);
  const state = { profile: null, grades: {}, sessions: [], current: null, busy: false, images: [] };

  async function api(path, opts = {}) {
    const res = await fetch('api/' + path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'content-type': 'application/json' } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 401 && state.profile) { location.reload(); }
    return res;
  }

  // ---- hiển thị văn bản: escape rồi mới biến đổi, nên không chèn được HTML ----
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function inline(s) {
    return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  }
  function render(md) {
    const out = []; let list = null; let code = null;
    const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
    for (const line of md.split('\n')) {
      if (/^```/.test(line)) { if (code === null) { close(); code = []; } else { out.push(`<pre>${esc(code.join('\n'))}</pre>`); code = null; } continue; }
      if (code) { code.push(line); continue; }
      let m;
      if ((m = /^\s*[-*•]\s+(.*)/.exec(line))) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); }
      else if ((m = /^\s*\d+[.)]\s+(.*)/.exec(line))) { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); }
      else if (!line.trim()) close();
      else { close(); out.push(`<p>${inline(line.replace(/^#{1,6}\s+/, ''))}</p>`); }
    }
    if (code) out.push(`<pre>${esc(code.join('\n'))}</pre>`);
    close();
    return out.join('');
  }

  // ---- đăng nhập ----
  function showLogin() {
    $('app').hidden = true; $('login').hidden = false;
    $('grades').innerHTML = Object.entries(state.grades).map(([k, v]) => `<label><input type="radio" name="grade" value="${k}"><span>${esc(v)}</span></label>`).join('');
  }
  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const grade = document.querySelector('input[name=grade]:checked')?.value;
    $('login-err').textContent = '';
    const res = await api('login', { method: 'POST', body: { name: $('name').value, grade } });
    const data = await res.json();
    if (!res.ok) { $('login-err').textContent = data.error || 'Có lỗi, bạn thử lại nhé.'; return; }
    state.profile = data.profile; await enter();
  });
  $('logout').addEventListener('click', async () => { await api('logout', { method: 'POST' }); location.reload(); });

  // ---- phiên học ----
  async function enter() {
    $('login').hidden = true; $('app').hidden = false;
    $('who').textContent = `${state.profile.name} · ${state.grades[state.profile.grade]}`;
    await loadSessions();
    if (state.sessions.length) await open(state.sessions[0].id); else await newSession();
  }
  async function loadSessions() {
    state.sessions = (await (await api('sessions')).json()).sessions;
    const ul = $('sessions'); ul.innerHTML = '';
    for (const s of state.sessions) {
      const li = document.createElement('li'); if (s.id === state.current) li.className = 'on';
      li.innerHTML = `<button class="t"></button><button class="x" title="Đổi tên">✎</button><button class="x" title="Xoá">🗑</button>`;
      const [t, ren, del] = li.querySelectorAll('button');
      t.textContent = s.title; t.onclick = () => { document.body.classList.remove('open'); open(s.id); };
      ren.onclick = async () => { const n = prompt('Tên phiên học:', s.title); if (n && n.trim()) { await api('sessions/' + s.id, { method: 'PATCH', body: { title: n } }); await loadSessions(); if (s.id === state.current) $('title').textContent = n.trim(); } };
      del.onclick = async () => { if (!confirm('Xoá phiên học này?')) return; await api('sessions/' + s.id, { method: 'DELETE' }); if (s.id === state.current) { state.current = null; await loadSessions(); state.sessions.length ? open(state.sessions[0].id) : newSession(); } else loadSessions(); };
      ul.appendChild(li);
    }
  }
  async function newSession() {
    if (state.busy) return;
    const { session } = await (await api('sessions', { method: 'POST', body: {} })).json();
    await loadSessions(); await open(session.id);
  }
  $('new').addEventListener('click', () => { document.body.classList.remove('open'); newSession(); });

  function bubble(role, html) {
    const d = document.createElement('div'); d.className = 'msg ' + role; d.innerHTML = html; $('msgs').appendChild(d); scroll(); return d;
  }
  const scroll = () => { const m = $('msgs'); m.scrollTop = m.scrollHeight; };
  const imgs = (names) => names.map((n) => `<a href="api/images/${n}" target="_blank"><img src="api/images/${n}" alt="ảnh bài tập"></a>`).join('');

  async function open(id) {
    if (state.busy) return;
    state.current = id;
    const { messages } = await (await api(`sessions/${id}/messages`)).json();
    $('msgs').innerHTML = '';
    const s = state.sessions.find((x) => x.id === id);
    $('title').textContent = s ? s.title : 'Phiên học';
    if (!messages.length) $('msgs').innerHTML = `<div class="empty"><h3>Xin chào ${esc(state.profile.name)}!</h3><p>Hỏi mình bất kỳ điều gì, hoặc chụp ảnh bài tập gửi lên. Mình sẽ cùng bạn tìm cách giải, để bạn tự làm được nhé.</p></div>`;
    for (const m of messages) bubble(m.role === 'user' ? 'user' : 'bot', m.role === 'user' ? imgs(m.images) + render(m.content) : render(m.content));
    document.querySelectorAll('#sessions li').forEach((li, i) => li.classList.toggle('on', state.sessions[i]?.id === id));
    scroll();
  }

  // ---- ảnh: thu nhỏ trước khi gửi cho nhẹ ----
  async function shrink(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.85);
    } finally { URL.revokeObjectURL(url); }
  }
  async function addFiles(files) {
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      if (state.images.length >= 3) { alert('Mỗi lần gửi tối đa 3 ảnh nhé.'); break; }
      try { state.images.push(await shrink(f)); } catch { alert('Không đọc được ảnh này.'); }
    }
    thumbs();
  }
  function thumbs() {
    $('thumbs').innerHTML = '';
    state.images.forEach((src, i) => {
      const d = document.createElement('div'); d.innerHTML = `<img src="${src}" alt=""><button type="button" aria-label="Bỏ ảnh">×</button>`;
      d.querySelector('button').onclick = () => { state.images.splice(i, 1); thumbs(); };
      $('thumbs').appendChild(d);
    });
  }
  $('file').addEventListener('change', (e) => { addFiles([...e.target.files]); e.target.value = ''; });
  $('text').addEventListener('paste', (e) => { const f = [...(e.clipboardData?.files || [])]; if (f.length) { e.preventDefault(); addFiles(f); } });

  // ---- gửi tin nhắn (SSE qua fetch) ----
  function setBusy(b) { state.busy = b; $('send').disabled = b; $('text').disabled = b; if (!b) $('text').focus(); }
  const grow = () => { const t = $('text'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 160) + 'px'; };
  $('text').addEventListener('input', grow);
  $('text').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('composer').requestSubmit(); } });

  $('composer').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = $('text').value.trim();
    if (state.busy || (!text && !state.images.length) || !state.current) return;
    const images = state.images.map((d) => ({ data: d.split(',')[1] }));
    const previews = state.images.map((d) => `<img src="${d}" alt="ảnh bài tập">`).join('');
    $('msgs').querySelector('.empty')?.remove();
    bubble('user', previews + render(text));
    $('text').value = ''; state.images = []; thumbs(); grow(); setBusy(true);
    const bot = bubble('bot', '<span class="dots">Gia sư đang suy nghĩ</span>');
    let acc = '', failed = false;
    try {
      const res = await api(`sessions/${state.current}/messages`, { method: 'POST', body: { text, images } });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Không gửi được, bạn thử lại nhé.'); }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = /event: (.*)/.exec(block)?.[1]; const data = JSON.parse(/data: (.*)/s.exec(block)?.[1] || '{}');
          if (ev === 'queued') bot.innerHTML = `<span class="dots">Đang chờ đến lượt (còn ${data.position} bạn trước)</span>`;
          else if (ev === 'delta') { acc += data.text; bot.innerHTML = render(acc); scroll(); }
          else if (ev === 'error') { failed = true; bot.remove(); bubble('note', esc(data.message)); }
        }
      }
      if (!failed && !acc) bot.remove();
    } catch (err) { bot.remove(); bubble('note', esc(err.message)); }
    setBusy(false);
    await loadSessions();
    $('title').textContent = state.sessions.find((s) => s.id === state.current)?.title || $('title').textContent;
  });

  $('menu').addEventListener('click', () => document.body.classList.add('open'));
  $('scrim').addEventListener('click', () => document.body.classList.remove('open'));

  (async () => {
    const me = await (await api('me')).json();
    state.grades = me.grades; state.profile = me.profile;
    if (me.profile) await enter(); else showLogin();
  })();
})();
