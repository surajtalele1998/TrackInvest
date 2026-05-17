const express = require('express');
const crypto = require('crypto');
const { authMiddleware } = require('../middleware/auth');
const { registerWebhook, getWebhooks, deleteWebhook, getWebhookLogs, WEBHOOK_EVENTS } = require('../services/webhookService');
const auditService = require('../services/auditService');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/register', authMiddleware, async (req, res, next) => {
  try {
    const wh = await registerWebhook(req.user.id, req.body);
    auditService.log('webhook.register', req.user.id, { name: wh.name, event: wh.event });
    res.status(201).json({ success: true, webhook: wh });
  } catch (err) { next(err); }
});

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const webhooks = await getWebhooks(req.user.id);
    res.json({ success: true, count: webhooks.length, webhooks });
  } catch (err) { next(err); }
});

router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    await deleteWebhook(req.params.id, req.user.id);
    auditService.log('webhook.delete', req.user.id, { id: req.params.id });
    res.json({ success: true, message: 'Webhook deleted' });
  } catch (err) { next(err); }
});

router.get('/logs/:webhookId', authMiddleware, async (req, res, next) => {
  try {
    const logs = await getWebhookLogs(req.params.webhookId);
    res.json({ success: true, count: logs.length, logs });
  } catch (err) { next(err); }
});

router.get('/events', (_req, res) => {
  res.json({ success: true, events: WEBHOOK_EVENTS });
});

router.post('/incoming/:event', async (req, res, next) => {
  try {
    const { event } = req.params;
    const payload = req.body;
    const signature = req.headers['x-webhook-signature'] || '';
    logger.info(`Webhook received: ${event}`);
    auditService.log('webhook.received', 'external', { event, payload: JSON.stringify(payload).slice(0, 200) });
    res.json({ success: true, event, received: true });
  } catch (err) { next(err); }
});

module.exports = router;
