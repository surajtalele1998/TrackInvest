const config = require('../config');
const logger = require('../utils/logger');

function authMiddleware(req, res, next) {
  const key = req.headers[config.apiKeyHeader];

  if (config.isDev && !key) {
    logger.warn('DEV MODE: skipping API key check');
    req.user = { id: 'default' };
    return next();
  }

  if (!key || !config.apiKeys.includes(key)) {
    logger.warn(`Auth failed: key="${key ? key.slice(0, 12) + '…' : '(none)'}" path="${req.path}", expected one of [${config.apiKeys.map(k => k.slice(0, 12) + '…').join(', ')}]`);
    return res.status(401).json({ error: 'Unauthorized. Provide a valid API key via x-api-key header.' });
  }
  req.user = { id: 'default' };
  next();
}

function optionalAuth(req, _res, next) {
  const key = req.headers[config.apiKeyHeader];
  if (key && config.apiKeys.includes(key)) {
    req.user = { id: 'default' };
  }
  next();
}

module.exports = { authMiddleware, optionalAuth };
