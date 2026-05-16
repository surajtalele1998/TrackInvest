const express = require('express');
const { analyzePortfolio, calcXIRR, rebalanceSuggestions } = require('../services/portfolioAnalyzer');
const { portfolioSchema } = require('../utils/validators');

const router = express.Router();

router.post('/analyze', (req, res, next) => {
  try {
    const { holdings } = portfolioSchema.parse(req.body);
    const analysis = analyzePortfolio(holdings);
    res.json({ success: true, ...analysis });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation error', details: err.errors });
    next(err);
  }
});

router.post('/xirr', (req, res, next) => {
  try {
    const { transactions } = req.body;
    if (!transactions || transactions.length < 2) {
      return res.status(400).json({ error: 'At least 2 transactions required' });
    }
    const rate = calcXIRR(transactions);
    res.json({ success: true, xirr: parseFloat((rate * 100).toFixed(4)), xirrDisplay: `${(rate * 100).toFixed(2)}%` });
  } catch (err) {
    next(err);
  }
});

router.post('/rebalance', (req, res, next) => {
  try {
    const { holdings, targetAllocation } = req.body;
    if (!holdings || !targetAllocation) {
      return res.status(400).json({ error: 'holdings and targetAllocation required' });
    }
    const analysis = analyzePortfolio(holdings);
    const suggestions = rebalanceSuggestions(holdings, targetAllocation);
    res.json({ success: true, currentAllocation: analysis.assetAllocation, suggestions });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
