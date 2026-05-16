const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const logger = require('./utils/logger');
const { limiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes/index');
const { initSchema } = require('./services/supabase');
const { initDefaultJobs, startAll } = require('./services/jobScheduler');
const { warmOnStartup } = require('./services/cacheWarmer');
const { trackRequest } = require('./services/adminService');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.resolve(__dirname, 'views'));

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  res.on('finish', () => trackRequest(req));
  next();
});

app.use('/api', limiter, routes);

app.get('/', (_req, res) => {
  res.json({
    service: 'TrackInvest API',
    version: '2.1.0',
    docs: '/api/v1/docs',
    auth: config.supabase.url ? 'JWT + API Key' : 'API Key only',
    ai: config.ai.provider || 'not configured',
    endpoints: {
      health: 'GET /api/v1/health',
      docs: 'GET /api/v1/docs, /api/v1/docs/openapi.json',
      auth: 'POST /api/v1/auth/register, /login, /refresh, /profile, /devices',
      ai: 'POST /api/v1/ai/chat, /report',
      market: 'GET /api/v1/market/search, /quote/:symbol, /history/:symbol, /mf/:schemeCode',
      portfolio: 'POST /api/v1/portfolio/analyze, /xirr, /rebalance',
      goals: 'CRUD /api/v1/goals, POST /api/v1/goals/project',
      watchlist: 'CRUD /api/v1/watchlist, POST /:id/symbols, GET /prices',
      alerts: 'CRUD /api/v1/alerts (price alerts)',
      calculator: 'POST /api/v1/calculator/sip, /lumpsum, /emi, /retirement, /goal',
      tax: 'POST /api/v1/tax/analyze, /estimate-gains',
      dividends: 'CRUD /api/v1/dividends, GET /summary',
      notifications: 'POST /api/v1/notifications/subscribe, /send, /email, /telegram, /ntfy',
      sync: 'POST /api/v1/sync/backup, /sync, GET /backups, /backup/:id',
      backup: 'POST /api/v1/sync/gist-backup, GET /sync/gist-backups',
      export: 'POST /api/v1/export/csv, /excel, /pdf, /portfolio-report',
      import: 'POST /api/v1/import/upload, /csv, /json',
      webhooks: 'POST /api/v1/webhooks/register, /incoming/:event',
      news: 'GET /api/v1/news/financial, /headlines, /exchange-rate',
      views: 'GET /api/v1/views/portfolio/:userId, /report/:type',
      admin: 'GET /api/v1/admin/stats, /users, /apikeys, /requests, /audit',
    },
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found. See /api/v1/docs for available endpoints.' });
});

app.use(errorHandler);

if (config.apiKeys.length === 0) {
  logger.warn('No API keys configured! Set API_KEYS in .env');
}
if (!config.ai.provider) {
  logger.warn('No AI provider configured. Set GEMINI_API_KEY or GROQ_API_KEY or OPENAI_API_KEY.');
}
if (config.supabase.url) {
  initSchema().then(ok => {
    if (ok) {
      initDefaultJobs();
      startAll();
    }
  });
} else {
  logger.info('Supabase not configured — auth, multi-device, and cron jobs disabled');
}

app.listen(config.port, () => {
  logger.info(`╔════════════════════════════════════════════════════╗`);
  logger.info(`║        TrackInvest API Service v2.1              ║`);
  logger.info(`║  Port: ${String(config.port).padEnd(39)}║`);
  logger.info(`║  Env:  ${config.nodeEnv.padEnd(39)}║`);
  logger.info(`║  AI:   ${(config.ai.provider || 'not configured').padEnd(39)}║`);
  logger.info(`║  Auth: ${(config.supabase.url ? 'JWT + API Key' : 'API Key only').padEnd(39)}║`);
  logger.info(`║  Docs: http://localhost:${config.port}/api/v1/docs  ║`);
  logger.info(`╚════════════════════════════════════════════════════╝`);
  setTimeout(() => warmOnStartup(), 30000);
});

module.exports = app;
