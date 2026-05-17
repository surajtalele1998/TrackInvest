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
router.post('/generate-key', async (req, res) => {
  const cfg = require('../config');
  const masterKey = req.headers['x-admin-key'] || req.headers['x-api-key'];
  const validMaster = cfg.apiKeys;

  // If no API keys configured yet, allow first-key creation without auth
  if (validMaster.length > 0) {
    if (!masterKey || !validMaster.includes(masterKey)) {
      return res.status(401).json({ error: 'Unauthorized. Provide an existing API key in x-api-key header.' });
    }
  }

  const prefix = 'sk-' + crypto.randomBytes(8).toString('hex');
  const suffix = crypto.randomBytes(16).toString('hex');
  const newKey = `${prefix}${suffix}`;

  // Add to runtime config immediately so it works without redeploy
  if (!cfg.apiKeys.includes(newKey)) {
    cfg.apiKeys.push(newKey);
  }

  const note = validMaster.length === 0
    ? 'First key created and activated. You can now use this key in the frontend.'
    : 'Add this key to your API_KEYS environment variable on Render to make it permanent.';
  auditService.log('apikey.generate', 'admin', { prefix: prefix });
  res.json({ success: true, key: newKey, note });
});

module.exports = router;
