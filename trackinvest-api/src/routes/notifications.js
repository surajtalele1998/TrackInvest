const express = require('express');
const { addSubscription, removeSubscription, sendPushNotification, sendEmail, getNotificationLog } = require('../services/notificationService');
const { notificationSchema } = require('../utils/validators');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/subscribe', (req, res, next) => {
  try {
    const { subscription } = notificationSchema.parse(req.body);
    addSubscription(subscription);
    res.json({ success: true, message: 'Subscribed' });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation error', details: err.errors });
    next(err);
  }
});

router.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  removeSubscription(endpoint);
  res.json({ success: true });
});

router.post('/send', async (req, res, next) => {
  try {
    const { title, body, tag } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'title and body required' });
    const result = await sendPushNotification(title, body, tag);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.post('/email', async (req, res, next) => {
  try {
    const { to, subject, html } = req.body;
    if (!to || !subject || !html) return res.status(400).json({ error: 'to, subject, html required' });
    const result = await sendEmail(to, subject, html);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.get('/log', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const log = getNotificationLog(limit);
  res.json({ success: true, count: log.length, log });
});

module.exports = router;
