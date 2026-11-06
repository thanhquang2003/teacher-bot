const path = require('node:path');
const providers = require('./providers');
const { Gate } = require('./queue');
const { AiError } = require('./errors');

const FRIENDLY = {
  limit: 'Thầy/cô đang bận quá, bạn thử lại sau ít phút nhé.',
  unavailable: 'Thầy/cô tạm thời chưa trả lời được, bạn thử lại sau nhé.',
  error: 'Có lỗi xảy ra, bạn thử gửi lại câu hỏi nhé.',
};

// runners: cho phép thay thế khi test.
function createAi({ settings, cfg, runners = providers }) {
  const gate = new Gate(Number(settings.get('concurrency')));
  const uploadsDir = path.join(cfg.dataDir === ':memory:' ? require('node:os').tmpdir() : cfg.dataDir, 'uploads');
  const workDir = path.join(cfg.dataDir === ':memory:' ? require('node:os').tmpdir() : cfg.dataDir, 'work');

  function recordError(provider, err) {
    settings.set('last_error', JSON.stringify({ at: new Date().toISOString(), provider, kind: err.kind, detail: err.detail.slice(0, 500) }));
  }

  // images: [{path, mime, data(base64)}]
  async function ask({ system, prompt, images, signal, onDelta, onQueued }) {
    gate.setMax(Number(settings.get('concurrency')));
    let release;
    try { release = await gate.acquire(onQueued, signal); }
    catch { throw new AiError('aborted'); }
    const provider = settings.get('provider');
    try {
      const common = { system, prompt, signal, onDelta, uploadsDir, workDir };
      if (provider === 'codex') return await runners.codex({ ...common, imagePaths: images.map((i) => i.path), model: settings.get('codex_model') });
      if (provider === 'api') return await runners.api({ ...common, images, apiKey: settings.get('api_key'), model: settings.get('api_model') });
      return await runners.claude({ ...common, imagePaths: images.map((i) => i.path), model: settings.get('claude_model') });
    } catch (e) {
      const err = e instanceof AiError ? e : new AiError('error', e.message);
      if (err.kind !== 'aborted') recordError(provider, err);
      throw err;
    } finally {
      release();
    }
  }

  return { ask, gate, uploadsDir, friendly: (kind) => FRIENDLY[kind] || FRIENDLY.error };
}

module.exports = { createAi, FRIENDLY };
