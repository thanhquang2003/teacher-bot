const express = require('express');
const path = require('node:path');
const { open } = require('./db');
const { createAuth } = require('./auth');
const { GRADES } = require('./grades');

function createApp(cfg, db = open(cfg.dataDir)) {
  const app = express();
  app.set('trust proxy', 'loopback');
  const auth = createAuth(db, cfg);
  const router = express.Router();

  router.use(express.json({ limit: '1mb' }));
  router.use(auth.attach);

  router.get('/api/me', (req, res) => res.json({ profile: req.profile, grades: GRADES }));
  router.post('/api/login', auth.login);
  router.post('/api/logout', auth.logout);

  router.use(express.static(path.join(__dirname, '..', 'public')));

  app.use(cfg.basePath || '/', router);
  app.locals.db = db;
  app.locals.auth = auth;
  app.locals.router = router;
  return app;
}

module.exports = { createApp };
