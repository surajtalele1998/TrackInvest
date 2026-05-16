const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const logger = require('./utils/logger');
const authMiddleware = require('./middleware/auth');
const { limiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes/index');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

app.use('/api', limiter, routes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found. Use /api/v1/health to verify the service is running.' });
});

app.use(errorHandler);

if (config.apiKeys.length === 0) {
  logger.warn('⚠ No API keys configured! Set API_KEYS in .env. Service will reject all requests (except health).');
}
if (!config.ai.provider) {
  logger.warn('⚠ No AI provider configured. AI features will return 503. Set GEMINI_API_KEY or OPENAI_API_KEY.');
}

app.listen(config.port, () => {
  logger.info(`╔══════════════════════════════════════════════╗`);
  logger.info(`║   TrackInvest API Service                  ║`);
  logger.info(`║   Port: ${String(config.port).padEnd(37)}║`);
  logger.info(`║   Env:  ${config.nodeEnv.padEnd(37)}║`);
  logger.info(`║   AI:   ${(config.ai.provider || 'not configured').padEnd(37)}║`);
  logger.info(`╚══════════════════════════════════════════════╝`);
  logger.info(`Health: http://localhost:${config.port}/api/v1/health`);
});

module.exports = app;
