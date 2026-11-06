class AiError extends Error {
  constructor(kind, detail) {
    super(detail || kind);
    this.kind = kind; // 'limit' | 'unavailable' | 'error' | 'aborted'
    this.detail = detail || '';
  }
}

const LIMIT_RE = /usage limit|rate.?limit|limit (reached|exceeded)|quota|insufficient (credit|funds)|credit balance|overloaded|too many requests|\b429\b|resets? (at|in)/i;

const classify = (text) => (LIMIT_RE.test(text || '') ? 'limit' : 'error');

module.exports = { AiError, classify };
