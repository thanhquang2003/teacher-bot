const express = require('express');
const crypto = require('node:crypto');

const COOKIE = 'tb_admin';
const TTL = 12 * 3600; // giây
const PROVIDERS = ['claude', 'codex', 'api'];

function createAdmin({ db, cfg, settings, ai, parseCookies }) {
  const r = express.Router();
  r.use(express.json({ limit: '1mb' }));

  const key = () => crypto.createHash('sha256').update('tb-admin:' + cfg.adminPassword).digest();
  const sign = (exp) => crypto.createHmac('sha256', key()).update(String(exp)).digest('hex');
  const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

  // chống dò mật khẩu: 8 lần sai / 10 phút / IP
  const fails = new Map();
  const blocked = (ip) => { const f = (fails.get(ip) || []).filter((t) => Date.now() - t < 600_000); fails.set(ip, f); return f.length >= 8; };

  const enabled = (_req, res, next) => (cfg.adminPassword ? next() : res.status(503).json({ error: 'Chưa đặt ADMIN_PASSWORD trên máy chủ.' }));

  function isAdmin(req) {
    const tok = parseCookies(req.headers.cookie)[COOKIE] || '';
    const [exp, sig] = tok.split('.');
    return !!(exp && sig && Number(exp) > Date.now() / 1000 && safeEq(sig, sign(exp)));
  }
  const guard = (req, res, next) => (isAdmin(req) ? next() : res.status(401).json({ error: 'not_admin' }));

  r.post('/login', enabled, (req, res) => {
    if (blocked(req.ip)) return res.status(429).json({ error: 'Thử sai quá nhiều lần, đợi vài phút nhé.' });
    if (!safeEq(req.body?.password ?? '', cfg.adminPassword)) {
      fails.get(req.ip).push(Date.now());
      return res.status(401).json({ error: 'Sai mật khẩu.' });
    }
    const exp = Math.floor(Date.now() / 1000) + TTL;
    const flags = [`${COOKIE}=${exp}.${sign(exp)}`, `Path=${cfg.basePath || '/'}`, `Max-Age=${TTL}`, 'HttpOnly', 'SameSite=Strict'];
    if (cfg.cookieSecure) flags.push('Secure');
    res.setHeader('Set-Cookie', flags.join('; '));
    res.json({ ok: true });
  });

  r.post('/logout', (req, res) => {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=${cfg.basePath || '/'}; Max-Age=0; HttpOnly; SameSite=Strict`);
    res.json({ ok: true });
  });

  r.get('/state', enabled, guard, (_req, res) => {
    let lastError = null;
    try { lastError = JSON.parse(settings.get('last_error') || 'null'); } catch { /* bỏ */ }
    res.json({
      settings: {
        provider: settings.get('provider'),
        concurrency: Number(settings.get('concurrency')),
        claude_model: settings.get('claude_model'),
        codex_model: settings.get('codex_model'),
        api_model: settings.get('api_model'),
        api_key_set: !!settings.get('api_key'), // không bao giờ trả key ra ngoài
      },
      lastError,
      queue: { running: ai.gate.running, waiting: ai.gate.position },
      stats: {
        profiles: db.prepare('SELECT COUNT(*) AS n FROM profiles').get().n,
        sessions: db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,
        messages: db.prepare('SELECT COUNT(*) AS n FROM messages').get().n,
      },
      providers: PROVIDERS,
    });
  });

  r.put('/settings', enabled, guard, (req, res) => {
    const b = req.body || {};
    const errors = [];
    if (b.provider !== undefined && !PROVIDERS.includes(b.provider)) errors.push('Nguồn AI không hợp lệ.');
    if (b.concurrency !== undefined && !(Number.isInteger(b.concurrency) && b.concurrency >= 1 && b.concurrency <= 6)) errors.push('Số lượt đồng thời phải từ 1 đến 6.');
    for (const k of ['claude_model', 'codex_model', 'api_model']) {
      if (b[k] !== undefined && !(typeof b[k] === 'string' && /^[\w.:\-/]{0,80}$/.test(b[k]))) errors.push(`Tên model (${k}) không hợp lệ.`);
    }
    if (b.api_key !== undefined && typeof b.api_key !== 'string') errors.push('API key không hợp lệ.');
    const nextProvider = b.provider ?? settings.get('provider');
    const nextKey = b.api_key ? b.api_key : settings.get('api_key');
    if (nextProvider === 'api' && !nextKey) errors.push('Chọn "api" thì cần nhập API key.');
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    for (const k of ['provider', 'concurrency', 'claude_model', 'codex_model', 'api_model']) if (b[k] !== undefined) settings.set(k, b[k]);
    if (b.api_key) settings.set('api_key', b.api_key.trim());
    if (b.clear_api_key === true) settings.set('api_key', '');
    ai.gate.setMax(Number(settings.get('concurrency')));
    res.json({ ok: true });
  });

  // Hỏi thử một câu qua nguồn đang chọn để biết còn dùng được không.
  r.post('/test', enabled, guard, async (_req, res) => {
    const t0 = Date.now();
    try {
      const text = await ai.ask({ system: 'Bạn là trợ lý kiểm tra kết nối.', prompt: 'Trả lời đúng một từ: ok', images: [], onDelta() {} });
      res.json({ ok: true, ms: Date.now() - t0, reply: text.slice(0, 80) });
    } catch (e) {
      res.json({ ok: false, ms: Date.now() - t0, kind: e.kind || 'error', detail: String(e.detail || e.message).slice(0, 500) });
    }
  });

  return r;
}

module.exports = { createAdmin };
