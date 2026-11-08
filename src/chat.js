const express = require('express');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { systemPrompt } = require('./tutor');
const { AiError } = require('./ai/errors');

const MAX_TEXT = 4000;
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const HISTORY = 20;
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

// Chỉ nhận ảnh thật: kiểm tra chữ ký đầu tệp thay vì tin mime do client gửi.
function sniff(buf) {
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.length > 6 && /^GIF8[79]a/.test(buf.toString('ascii', 0, 6))) return 'image/gif';
  return null;
}

function createChat({ db, auth, ai }) {
  const r = express.Router();
  r.use(auth.require);

  const ownSession = (req, res) => {
    const s = db.prepare('SELECT * FROM sessions WHERE id = ? AND profile_id = ?').get(Number(req.params.id), req.profile.id);
    if (!s) res.status(404).json({ error: 'Không tìm thấy phiên học.' });
    return s;
  };

  r.get('/sessions', (req, res) => {
    res.json({ sessions: db.prepare('SELECT id, title, updated_at FROM sessions WHERE profile_id = ? ORDER BY updated_at DESC, id DESC').all(req.profile.id) });
  });

  r.post('/sessions', express.json({ limit: '1mb' }), (req, res) => {
    const x = db.prepare('INSERT INTO sessions (profile_id) VALUES (?)').run(req.profile.id);
    res.status(201).json({ session: db.prepare('SELECT id, title, updated_at FROM sessions WHERE id = ?').get(Number(x.lastInsertRowid)) });
  });

  r.patch('/sessions/:id', express.json({ limit: '1mb' }), (req, res) => {
    const s = ownSession(req, res); if (!s) return;
    const title = String(req.body?.title ?? '').trim().slice(0, 60);
    if (!title) return res.status(400).json({ error: 'Tên phiên không được để trống.' });
    db.prepare('UPDATE sessions SET title = ? WHERE id = ?').run(title, s.id);
    res.json({ ok: true });
  });

  r.delete('/sessions/:id', (req, res) => {
    const s = ownSession(req, res); if (!s) return;
    db.prepare('DELETE FROM sessions WHERE id = ?').run(s.id);
    res.json({ ok: true });
  });

  r.get('/sessions/:id/messages', (req, res) => {
    const s = ownSession(req, res); if (!s) return;
    const rows = db.prepare('SELECT id, role, content, images, created_at FROM messages WHERE session_id = ? ORDER BY id').all(s.id);
    res.json({ messages: rows.map((m) => ({ ...m, images: JSON.parse(m.images) })) });
  });

  // Ảnh chỉ chủ hồ sơ xem được.
  r.get('/images/:file', (req, res) => {
    const file = path.basename(req.params.file);
    const full = path.join(ai.uploadsDir, String(req.profile.id), file);
    if (!fs.existsSync(full)) return res.status(404).end();
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.sendFile(full);
  });

  r.post('/sessions/:id/messages', express.json({ limit: '30mb' }), async (req, res) => {
    const s = ownSession(req, res); if (!s) return;
    const text = String(req.body?.text ?? '').trim();
    const rawImgs = Array.isArray(req.body?.images) ? req.body.images : [];
    if (!text && !rawImgs.length) return res.status(400).json({ error: 'Bạn nhập câu hỏi hoặc gửi ảnh nhé.' });
    if (text.length > MAX_TEXT) return res.status(400).json({ error: `Tin nhắn quá dài (tối đa ${MAX_TEXT} ký tự).` });
    if (rawImgs.length > MAX_IMAGES) return res.status(400).json({ error: `Chỉ gửi tối đa ${MAX_IMAGES} ảnh một lần.` });

    const images = [];
    for (const im of rawImgs) {
      const buf = Buffer.from(String(im?.data ?? ''), 'base64');
      const mime = sniff(buf);
      if (!mime) return res.status(400).json({ error: 'Chỉ nhận ảnh PNG, JPG, WEBP hoặc GIF.' });
      if (buf.length > MAX_IMAGE_BYTES) return res.status(400).json({ error: 'Ảnh quá lớn (tối đa 6MB).' });
      images.push({ buf, mime });
    }

    const dir = path.join(ai.uploadsDir, String(req.profile.id));
    fs.mkdirSync(dir, { recursive: true });
    const saved = images.map(({ buf, mime }) => {
      const name = `${crypto.randomUUID()}.${EXT[mime]}`;
      fs.writeFileSync(path.join(dir, name), buf);
      return { name, path: path.join(dir, name), mime, data: buf.toString('base64') };
    });

    // Lịch sử trước tin nhắn này.
    const history = db.prepare('SELECT role, content, images FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT ?').all(s.id, HISTORY).reverse();
    const isFirst = history.length === 0;
    const um = db.prepare('INSERT INTO messages (session_id, role, content, images) VALUES (?, ?, ?, ?)').run(s.id, 'user', text, JSON.stringify(saved.map((i) => i.name)));
    if (isFirst) db.prepare('UPDATE sessions SET title = ? WHERE id = ?').run((text || 'Bài có ảnh').slice(0, 40), s.id);

    const lines = history.map((m) => {
      const imgs = JSON.parse(m.images).map((n) => path.join(dir, n));
      const tag = imgs.length ? `\n[ảnh đã gửi trước đó: ${imgs.join(', ')}]` : '';
      return `${m.role === 'user' ? 'HỌC SINH' : 'GIA SƯ'}: ${m.content}${tag}`;
    });
    const attach = saved.length ? `\n[ảnh đính kèm lượt này, hãy xem ảnh: ${saved.map((i) => i.path).join(', ')}]` : '';
    const prompt = `${lines.length ? `Hội thoại trước đó:\n${lines.join('\n')}\n\n` : ''}Tin nhắn mới của HỌC SINH: ${text || '(chỉ gửi ảnh)'}${attach}\n\nHãy trả lời với vai trò GIA SƯ.`;

    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send('start', { userMessageId: Number(um.lastInsertRowid), images: saved.map((i) => i.name) });

    const ctrl = new AbortController();
    res.on('close', () => { if (!res.writableEnded) ctrl.abort(); });
    try {
      const full = await ai.ask({
        system: systemPrompt(req.profile.grade, req.profile.name, req.profile.role),
        prompt, images: saved, signal: ctrl.signal,
        onDelta: (t) => send('delta', { text: t }),
        onQueued: (pos) => send('queued', { position: pos }),
      });
      const am = db.prepare('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)').run(s.id, 'assistant', full);
      db.prepare(`UPDATE sessions SET updated_at = datetime('now') WHERE id = ?`).run(s.id);
      send('done', { id: Number(am.lastInsertRowid) });
    } catch (e) {
      if (!(e instanceof AiError) || e.kind !== 'aborted') {
        const kind = e instanceof AiError ? e.kind : 'error';
        send('error', { kind, message: ai.friendly(kind) });
      }
    }
    res.end();
  });

  return r;
}

module.exports = { createChat, sniff };
