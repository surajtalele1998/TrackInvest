const config = require('../config');
const logger = require('../utils/logger');

function authMiddleware(req, res, next) {
  if (config.isDev && !req.headers[config.apiKeyHeader]) {
    logger.warn('DEV MODE: skipping API key check');
    return next();
  }

  const key = req.headers[config.apiKeyHeader];
  if (!key || !config.apiKeys.includes(key)) {
    return res.status(401).json({ error: 'Unauthorized. Provide a valid API key via x-api-key header.' });
  }
  next();
}

module.exports = authMiddleware;
