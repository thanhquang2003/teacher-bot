const express = require('express');
const path = require('node:path');
const { open } = require('./db');
const { createAuth } = require('./auth');
const { GRADES } = require('./grades');
const { createSettings } = require('./settings');
const { createAi } = require('./ai');
const { createChat } = require('./chat');
const { createAdmin } = require('./admin');

function createApp(cfg, db = open(cfg.dataDir), { runners } = {}) {
  const app = express();
  app.set('trust proxy', 'loopback');
  const auth = createAuth(db, cfg);
  const router = express.Router();

  const settings = createSettings(db);
  const ai = createAi({ settings, cfg, runners });

  router.use(auth.attach);
  router.use('/api/me', express.json({ limit: '1mb' }));
  router.use('/api/login', express.json({ limit: '1mb' }));

  router.get('/api/me', (req, res) => res.json({ profile: req.profile, grades: GRADES }));
  router.post('/api/login', auth.login);
  router.post('/api/logout', auth.logout);

  router.use('/api/admin', createAdmin({ db, cfg, settings, ai, parseCookies: auth.parseCookies }));
  router.use('/api', createChat({ db, auth, ai }));

  router.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

  app.use(cfg.basePath || '/', router);
  app.locals.db = db;
  app.locals.settings = settings;
  app.locals.ai = ai;
  app.locals.auth = auth;
  app.locals.router = router;
  return app;
}

module.exports = { createApp };
