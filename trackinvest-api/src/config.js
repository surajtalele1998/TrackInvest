const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',

  apiKeys: (process.env.API_KEYS || '').split(',').map(s => s.trim()).filter(Boolean),
  apiKeyHeader: 'x-api-key',

  ai: {
    geminiKey: process.env.GEMINI_API_KEY || '',
    groqKey: process.env.GROQ_API_KEY || '',
    openaiKey: process.env.OPENAI_API_KEY || '',
    provider: process.env.GEMINI_API_KEY ? 'gemini' : (process.env.GROQ_API_KEY ? 'groq' : (process.env.OPENAI_API_KEY ? 'openai' : null)),
  },

  market: {
    alphaVantageKey: process.env.ALPHA_VANTAGE_API_KEY || '',
  },

  notifications: {
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
    vapidSubject: process.env.VAPID_SUBJECT || 'mailto:admin@trackinvest.app',
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },

  backup: {
    provider: process.env.BACKUP_PROVIDER || 'local',
    s3Bucket: process.env.BACKUP_S3_BUCKET || '',
    s3Region: process.env.BACKUP_S3_REGION || '',
    s3AccessKey: process.env.BACKUP_S3_ACCESS_KEY || '',
    s3SecretKey: process.env.BACKUP_S3_SECRET_KEY || '',
  },

  redisUrl: process.env.REDIS_URL || '',

  dataDir: path.resolve(__dirname, '..', 'data'),
  dbPath: path.resolve(__dirname, '..', 'data', 'trackinvest.db'),
};

module.exports = config;
