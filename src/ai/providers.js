const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { AiError, classify } = require('./errors');

const TIMEOUT_MS = 180_000;

function runProcess(cmd, args, { input, cwd, signal, onStdoutLine, env }) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env: env || process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', buf = '', done = false;
    const finish = (fn, v) => { if (!done) { done = true; clearTimeout(timer); signal?.removeEventListener('abort', onAbort); fn(v); } };
    const onAbort = () => { child.kill('SIGTERM'); finish(reject, new AiError('aborted')); };
    const timer = setTimeout(() => { child.kill('SIGKILL'); finish(reject, new AiError('error', 'Hết thời gian chờ AI')); }, TIMEOUT_MS);
    signal?.addEventListener('abort', onAbort, { once: true });
    child.stdout.on('data', (d) => {
      stdout += d;
      if (!onStdoutLine) return;
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) { onStdoutLine(buf.slice(0, i)); buf = buf.slice(i + 1); }
    });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (e) => finish(reject, new AiError('unavailable', `Không chạy được ${cmd}: ${e.message}`)));
    child.on('close', (code) => { if (buf && onStdoutLine) onStdoutLine(buf); finish(resolve, { code, stdout, stderr }); });
    child.stdin.on('error', () => {});
    child.stdin.end(input ?? '');
  });
}

// --- Claude Code (subscription) ---
async function claude({ system, prompt, imagePaths, uploadsDir, workDir, model, signal, onDelta }) {
  fs.mkdirSync(workDir, { recursive: true });
  const args = [
    '-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    '--setting-sources', '', '--settings', '{"disableAllHooks":true}',
    '--disable-slash-commands', '--strict-mcp-config', '--no-session-persistence',
    '--tools', imagePaths.length ? 'Read' : '', '--system-prompt', system,
  ];
  if (imagePaths.length) args.push('--allowedTools', 'Read', '--add-dir', uploadsDir);
  if (model) args.push('--model', model);

  let text = '', resultErr = null, finalText = '';
  const handle = (line) => {
    let ev; try { ev = JSON.parse(line); } catch { return; }
    if (ev.type === 'stream_event' && ev.event?.type === 'content_block_delta' && ev.event.delta?.type === 'text_delta') {
      text += ev.event.delta.text; onDelta(ev.event.delta.text);
    } else if (ev.type === 'result') {
      if (ev.is_error) resultErr = String(ev.result || ev.subtype || 'error');
      else finalText = String(ev.result || '');
    }
  };
  const r = await runProcess('claude', args, { input: prompt, cwd: workDir, signal, onStdoutLine: handle });
  if (resultErr) throw new AiError(classify(resultErr), resultErr);
  if (r.code !== 0 && !text) { const d = (r.stderr || r.stdout).slice(-500); throw new AiError(classify(d), d || `claude thoát mã ${r.code}`); }
  if (!text && finalText) { text = finalText; onDelta(finalText); }
  if (!text.trim()) throw new AiError('error', 'AI trả về nội dung rỗng');
  return text;
}

// --- Codex CLI ---
async function codex({ system, prompt, imagePaths, workDir, model, signal, onDelta }) {
  fs.mkdirSync(workDir, { recursive: true });
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tb-codex-')), 'last.txt');
  const args = ['exec', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only', '--color', 'never', '-o', out];
  if (model) args.push('-m', model);
  for (const p of imagePaths) args.push('-i', p);
  args.push('-');
  const r = await runProcess('codex', args, { input: `${system}\n\n---\n\n${prompt}`, cwd: workDir, signal });
  let text = '';
  try { text = fs.readFileSync(out, 'utf8').trim(); } catch { /* không có tệp kết quả */ }
  if (!text) { const d = (r.stderr || r.stdout).slice(-500); throw new AiError(classify(d), d || 'codex không trả kết quả'); }
  onDelta(text);
  return text;
}

// --- Anthropic API key ---
async function api({ system, prompt, images, apiKey, model, signal, onDelta }) {
  if (!apiKey) throw new AiError('unavailable', 'Chưa cấu hình API key');
  const content = [];
  for (const im of images) content.push({ type: 'image', source: { type: 'base64', media_type: im.mime, data: im.data } });
  content.push({ type: 'text', text: prompt });
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 2048, stream: true, system, messages: [{ role: 'user', content }] }),
  }).catch((e) => { throw e.name === 'AbortError' ? new AiError('aborted') : new AiError('unavailable', e.message); });
  if (!res.ok) {
    const d = `HTTP ${res.status} ${(await res.text()).slice(0, 300)}`;
    throw new AiError(res.status === 429 || res.status === 529 || res.status === 402 ? 'limit' : classify(d), d);
  }
  let text = '', buf = '';
  const dec = new TextDecoder();
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      try {
        const ev = JSON.parse(line.slice(5));
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') { text += ev.delta.text; onDelta(ev.delta.text); }
      } catch { /* bỏ qua dòng lỗi */ }
    }
  }
  if (!text.trim()) throw new AiError('error', 'AI trả về nội dung rỗng');
  return text;
}

module.exports = { claude, codex, api };
