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

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.resolve(__dirname, 'views'));

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

app.use('/api', limiter, routes);

app.get('/', (_req, res) => {
  res.json({
    service: 'TrackInvest API',
    version: '2.0.0',
    docs: '/api/v1/health',
    auth: config.supabase.url ? 'JWT + API Key' : 'API Key only',
    ai: config.ai.provider || 'not configured',
    endpoints: {
      health: 'GET /api/v1/health',
      auth: 'POST /api/v1/auth/register, /login, /profile, /devices',
      ai: 'POST /api/v1/ai/chat, /report',
      market: 'GET /api/v1/market/search, /quote/:symbol, /history/:symbol, /mf/:schemeCode',
      portfolio: 'POST /api/v1/portfolio/analyze, /xirr, /rebalance',
      notifications: 'POST /api/v1/notifications/subscribe, /send, /email',
      sync: 'POST /api/v1/sync/backup, /sync, GET /backups, /backup/:id',
      pdf: 'POST /api/v1/pdf/from-html, /report/:type',
      export: 'POST /api/v1/export/csv, /excel, /pdf, /portfolio-report',
      news: 'GET /api/v1/news/financial, /headlines, /exchange-rate',
      views: 'GET /api/v1/views/portfolio/:userId, /report/:type',
    },
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found. Use /api/v1/health to verify the service is running.' });
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
  logger.info(`╔══════════════════════════════════════════════╗`);
  logger.info(`║   TrackInvest API Service v2.0             ║`);
  logger.info(`║   Port: ${String(config.port).padEnd(37)}║`);
  logger.info(`║   Env:  ${config.nodeEnv.padEnd(37)}║`);
  logger.info(`║   AI:   ${(config.ai.provider || 'not configured').padEnd(37)}║`);
  logger.info(`║   Auth: ${(config.supabase.url ? 'JWT + API Key' : 'API Key only').padEnd(37)}║`);
  logger.info(`╚══════════════════════════════════════════════╝`);
  logger.info(`Health: http://localhost:${config.port}/api/v1/health`);
});

module.exports = app;
