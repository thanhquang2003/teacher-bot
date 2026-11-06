const crypto = require('node:crypto');
const { isGrade } = require('./grades');

const COOKIE = 'tb_device';
const YEAR = 365 * 24 * 3600;
const MAX_PROFILES = 100;

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function normalizeName(raw) {
  if (typeof raw !== 'string') return '';
  return raw.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, 40);
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function createAuth(db, cfg) {
  const cookiePath = cfg.basePath || '/';

  function setCookie(res, token, maxAge) {
    const flags = [`${COOKIE}=${token}`, `Path=${cookiePath}`, `Max-Age=${maxAge}`, 'HttpOnly', 'SameSite=Lax'];
    if (cfg.cookieSecure) flags.push('Secure');
    res.setHeader('Set-Cookie', flags.join('; '));
  }

  function profileFor(req) {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    if (!token) return null;
    const row = db
      .prepare(
        `SELECT p.id, p.name, p.grade FROM devices d JOIN profiles p ON p.id = d.profile_id WHERE d.token_hash = ?`
      )
      .get(sha(token));
    if (row) db.prepare(`UPDATE devices SET last_seen = datetime('now') WHERE token_hash = ?`).run(sha(token));
    return row || null;
  }

  function attach(req, _res, next) {
    req.profile = profileFor(req);
    next();
  }

  function require_(req, res, next) {
    if (!req.profile) return res.status(401).json({ error: 'not_logged_in' });
    next();
  }

  function login(req, res) {
    const name = normalizeName(req.body?.name);
    const grade = req.body?.grade;
    if (!name) return res.status(400).json({ error: 'Bạn nhập tên giúp mình nhé.' });
    if (!isGrade(grade)) return res.status(400).json({ error: 'Bạn chọn lớp giúp mình nhé.' });
    const key = name.toLowerCase();
    let p = db.prepare('SELECT id, name, grade FROM profiles WHERE name_key = ? AND grade = ?').get(key, grade);
    if (!p) {
      const { n } = db.prepare('SELECT COUNT(*) AS n FROM profiles').get();
      if (n >= MAX_PROFILES) return res.status(429).json({ error: 'Hệ thống đã đủ số hồ sơ.' });
      const r = db.prepare('INSERT INTO profiles (name, name_key, grade) VALUES (?, ?, ?)').run(name, key, grade);
      p = { id: Number(r.lastInsertRowid), name, grade };
    }
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO devices (token_hash, profile_id) VALUES (?, ?)').run(sha(token), p.id);
    setCookie(res, token, YEAR);
    res.json({ profile: p });
  }

  function logout(req, res) {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    if (token) db.prepare('DELETE FROM devices WHERE token_hash = ?').run(sha(token));
    setCookie(res, '', 0);
    res.json({ ok: true });
  }

  return { attach, require: require_, login, logout, parseCookies };
}

module.exports = { createAuth, normalizeName };
