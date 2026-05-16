const express = require('express');
const { getDb, isEnabled } = require('../models/database');
const supabase = require('../services/supabase');
const config = require('../config');

const router = express.Router();

router.get('/health', (req, res) => {
  let sqliteOk = false;
  try {
    const db = getDb();
    sqliteOk = db ? db.prepare('SELECT 1 as ok').get()?.ok === 1 : false;
  } catch (_) { /* */ }

  const supabaseClient = supabase.getClient();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    uptime: process.uptime(),
    checks: {
      sqlite: sqliteOk ? 'ok' : (isEnabled() ? 'error' : 'disabled'),
      supabase: supabaseClient ? 'ok' : 'not configured',
      ai_provider: config.ai.provider || 'not configured',
      api_keys: config.apiKeys.length,
    },
  });
});

module.exports = router;
