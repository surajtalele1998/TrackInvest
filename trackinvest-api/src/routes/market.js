const express = require('express');
const { searchMarkets, getQuote, getHistoricalData, getIndianMutualFundNav } = require('../services/marketProvider');
const { marketSearchSchema } = require('../utils/validators');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/search', async (req, res, next) => {
  try {
    const { query } = marketSearchSchema.parse(req.query);
    const results = await searchMarkets(query);
    res.json({ success: true, count: results.length, results });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation error', details: err.errors });
    next(err);
  }
});

router.get('/quote/:symbol', async (req, res, next) => {
  try {
    const quote = await getQuote(req.params.symbol);
    res.json({ success: true, data: quote });
  } catch (err) {
    next(err);
  }
});

router.get('/history/:symbol', async (req, res, next) => {
  try {
    const { range, interval } = req.query;
    const data = await getHistoricalData(req.params.symbol, range || '1mo', interval || '1d');
    res.json({ success: true, symbol: req.params.symbol, range: range || '1mo', count: data.length, data });
  } catch (err) {
    next(err);
  }
});

router.get('/mf/:schemeCode', async (req, res, next) => {
  try {
    const data = await getIndianMutualFundNav(req.params.schemeCode);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
