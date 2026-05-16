const express = require('express');
const { getDb } = require('../models/database');
const config = require('../config');

const router = express.Router();

router.get('/health', (req, res) => {
  let dbOk = false;
  try {
    const db = getDb();
    db.prepare('SELECT 1').get();
    dbOk = true;
  } catch (_) { /* */ }

  const aiConfigured = !!config.ai.provider;

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    checks: {
      database: dbOk ? 'ok' : 'error',
      ai_provider: aiConfigured ? config.ai.provider : 'not configured',
      api_keys: config.apiKeys.length,
    },
  });
});

module.exports = router;
