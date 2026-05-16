const { format } = require('winston');
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, stack, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}${stack ? '\n' + stack : ''}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: format.combine(format.colorize(), format.timestamp({ format: 'HH:mm:ss' }), format.printf(({ timestamp, level, message, stack }) =>
        `${timestamp} ${level}: ${message}${stack ? '\n' + stack : ''}`
      ))
    }),
  ],
});

if (!process.env.LOG_LEVEL) {
  logger.exceptions.handle(new winston.transports.Console());
}

module.exports = logger;
