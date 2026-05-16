const express = require('express');
const { generateChat, generateReport } = require('../services/aiEngine');
const { chatSchema, reportSchema } = require('../utils/validators');
const logger = require('../utils/logger');
const { aiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/chat', aiLimiter, async (req, res, next) => {
  try {
    const { message, history } = chatSchema.parse(req.body);
    const text = await generateChat(message, history || []);
    res.json({ success: true, text });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation error', details: err.errors });
    next(err);
  }
});

router.post('/report', aiLimiter, async (req, res, next) => {
  try {
    const { type, portfolioData } = reportSchema.parse(req.body);
    const text = await generateReport(type, portfolioData || {});
    res.json({ success: true, type, text });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation error', details: err.errors });
    next(err);
  }
});

module.exports = router;
