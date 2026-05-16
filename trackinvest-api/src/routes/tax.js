const express = require('express');
const { authMiddleware, optionalAuth } = require('../services/authService');
const { analyzeTaxHarvesting, estimateCapitalGains } = require('../services/taxHarvester');
const { portfolioSchema } = require('../utils/validators');

const router = express.Router();

router.post('/analyze', optionalAuth, (req, res, next) => {
  try {
    const { holdings } = portfolioSchema.parse(req.body);
    const result = analyzeTaxHarvesting(holdings);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation error', details: err.errors });
    next(err);
  }
});

router.post('/estimate-gains', optionalAuth, (req, res, next) => {
  try {
    const { holdings, sellAmount } = req.body;
    if (!holdings || !sellAmount) return res.status(400).json({ error: 'holdings and sellAmount required' });
    const result = estimateCapitalGains(holdings, sellAmount);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

module.exports = router;
