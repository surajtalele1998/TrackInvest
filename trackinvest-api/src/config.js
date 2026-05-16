const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',

  apiKeys: (process.env.API_KEYS || '').split(',').map(s => s.trim()).filter(Boolean),
  apiKeyHeader: 'x-api-key',

  jwt: {
    secret: process.env.JWT_SECRET || (config?.isDev ? 'dev-secret-change-in-prod' : ''),
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  },

  ai: {
    geminiKey: process.env.GEMINI_API_KEY || '',
    groqKey: process.env.GROQ_API_KEY || '',
    openaiKey: process.env.OPENAI_API_KEY || '',
    provider: process.env.GEMINI_API_KEY ? 'gemini' : (process.env.GROQ_API_KEY ? 'groq' : (process.env.OPENAI_API_KEY ? 'openai' : null)),
  },

  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_KEY || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  },

  github: {
    token: process.env.GITHUB_TOKEN || '',
    gistId: process.env.GITHUB_GIST_ID || '',
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },

  ntfy: {
    topic: process.env.NTFY_TOPIC || '',
  },

  news: {
    apiKey: process.env.NEWSAPI_KEY || '',
  },

  exchangeRate: {
    apiKey: process.env.EXCHANGERATE_API_KEY || '',
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
