const logger = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  logger.error(`${req.method} ${req.path} — ${err.message}`, { stack: err.stack });
  const status = err.status || 500;
  res.status(status).json({
    error: err.expose ? err.message : 'Internal server error',
    ...(err.details && { details: err.details }),
  });
}

module.exports = errorHandler;
