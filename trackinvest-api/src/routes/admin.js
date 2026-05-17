const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getUsageStats, listUsers, getApiKeyInfo, getRecentRequests } = require('../services/adminService');
const auditService = require('../services/auditService');

const router = express.Router();

router.get('/stats', authMiddleware, async (req, res, next) => {
  try {
    const stats = await getUsageStats();
    const auditStats = auditService.getStats();
    const apiKeyInfo = await getApiKeyInfo();
    res.json({ success: true, stats: { ...stats, audit: auditStats, apiKeys: apiKeyInfo } });
  } catch (err) { next(err); }
});

router.get('/users', authMiddleware, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const result = await listUsers(page, limit);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

router.get('/apikeys', authMiddleware, async (req, res, next) => {
  try {
    const info = await getApiKeyInfo();
    res.json({ success: true, ...info });
  } catch (err) { next(err); }
});

router.get('/requests', authMiddleware, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const requests = await getRecentRequests(limit);
    res.json({ success: true, count: requests.length, requests });
  } catch (err) { next(err); }
});

router.get('/audit', authMiddleware, async (req, res, next) => {
  try {
    const { action, userId, since, limit } = req.query;
    const logs = auditService.getLogs({ action, userId, since }, parseInt(limit) || 100);
    res.json({ success: true, count: logs.length, logs });
  } catch (err) { next(err); }
});

const crypto = require('crypto');

// Public config status (no auth required) for debugging
router.get('/config-status', (req, res) => {
  const cfg = require('../config');
  res.json({
    success: true,
    keyCount: cfg.apiKeys.length,
    keyPrefixes: cfg.apiKeys.map(k => k.slice(0, 12) + '…'),
    isDev: cfg.isDev,
    supabaseConfigured: !!(cfg.supabase.url && cfg.supabase.key),
  });
});

router.post('/generate-key', async (req, res) => {
  const cfg = require('../config');

  const prefix = 'sk-' + crypto.randomBytes(8).toString('hex');
  const suffix = crypto.randomBytes(16).toString('hex');
  const newKey = `${prefix}${suffix}`;

  // Add to runtime config immediately so it works without redeploy
  if (!cfg.apiKeys.includes(newKey)) {
    cfg.apiKeys.push(newKey);
  }

  res.json({
    success: true,
    key: newKey,
    note: 'Key is active now. To persist across restarts, add it to your API_KEYS environment variable on Render.',
  });
});

module.exports = router;
