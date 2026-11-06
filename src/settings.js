const DEFAULTS = {
  provider: 'claude', // claude | codex | api
  concurrency: '2',
  claude_model: 'sonnet',
  codex_model: '',
  api_model: 'claude-sonnet-5-5',
  api_key: '',
};

function createSettings(db, env = process.env) {
  const get = (k) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(k);
    if (row) return row.value;
    if (k === 'api_key') return env.ANTHROPIC_API_KEY || '';
    return DEFAULTS[k] ?? '';
  };
  const set = (k, v) =>
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, String(v));
  return { get, set, keys: Object.keys(DEFAULTS) };
}

module.exports = { createSettings, DEFAULTS };
