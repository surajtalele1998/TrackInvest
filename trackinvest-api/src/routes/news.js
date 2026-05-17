const express = require('express');
const { getFinancialNews, getTopHeadlines, getExchangeRate } = require('../services/newsService');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/financial', optionalAuth, async (req, res, next) => {
  try {
    const { query, pageSize } = req.query;
    const result = await getFinancialNews(query || 'stock market india', parseInt(pageSize) || 10);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

router.get('/headlines', optionalAuth, async (req, res, next) => {
  try {
    const { country, category, pageSize } = req.query;
    const result = await getTopHeadlines(country || 'in', category || 'business', parseInt(pageSize) || 10);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

router.get('/exchange-rate', optionalAuth, async (req, res, next) => {
  try {
    const { base, target } = req.query;
    const result = await getExchangeRate((base || 'INR').toUpperCase(), (target || 'USD').toUpperCase());
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

module.exports = router;
