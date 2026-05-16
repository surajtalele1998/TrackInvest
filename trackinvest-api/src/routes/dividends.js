const express = require('express');
const { authMiddleware } = require('../services/authService');
const { addDividend, getDividends, getDividendSummary } = require('../services/dividendService');

const router = express.Router();

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { symbol, amount, exDate, payDate, type, notes } = req.body;
    if (!symbol || !amount || !exDate) return res.status(400).json({ error: 'symbol, amount, and exDate required' });
    const div = await addDividend(req.user.id, { symbol, amount, exDate, payDate, type, notes });
    res.status(201).json({ success: true, dividend: div });
  } catch (err) { next(err); }
});

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { symbol } = req.query;
    const dividends = await getDividends(req.user.id, symbol || null);
    res.json({ success: true, count: dividends.length, dividends });
  } catch (err) { next(err); }
});

router.get('/summary', authMiddleware, async (req, res, next) => {
  try {
    const summary = await getDividendSummary(req.user.id);
    res.json({ success: true, summary });
  } catch (err) { next(err); }
});

module.exports = router;
