const path = require('node:path');

function load(env = process.env) {
  const basePath = (env.BASE_PATH ?? '/teacher-bot').replace(/\/+$/, '');
  return {
    port: Number(env.PORT || 8791),
    host: env.HOST || '127.0.0.1',
    basePath, // '' hoặc '/teacher-bot'
    dataDir: env.DATA_DIR || path.join(__dirname, '..', 'data'),
    adminPassword: env.ADMIN_PASSWORD || '',
    cookieSecure: env.COOKIE_SECURE === '1',
  };
}

module.exports = { load };
