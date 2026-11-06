const { load } = require('./config');
const { createApp } = require('./app');

const cfg = load();
const app = createApp(cfg);
app.listen(cfg.port, cfg.host, () => {
  console.log(`teacher-bot nghe tại http://${cfg.host}:${cfg.port}${cfg.basePath}/`);
});
