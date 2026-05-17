const express = require('express');
const { searchMarkets, getQuote, getHistoricalData, getIndianMutualFundNav } = require('../services/marketProvider');
const { marketSearchSchema } = require('../utils/validators');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/search', async (req, res, next) => {
  try {
    const { query } = marketSearchSchema.parse(req.query);
    const results = await searchMarkets(query);
    // Return both formats for compatibility
    const quotes = results.map(r => ({
      symbol: r.symbol, shortname: r.name, longname: r.name,
      exchange: r.exchange, quoteType: r.type, score: r.score,
    }));
    res.json({ success: true, count: results.length, results, quotes });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation error', details: err.errors });
    next(err);
  }
});

router.get('/quote/:symbol', async (req, res, next) => {
  try {
    const quote = await getQuote(req.params.symbol);
    // Return both formats for compatibility
    res.json({
      success: true, data: quote,
      marketData: {
        regularMarketPrice: quote.price,
        previousClose: quote.previousClose,
        regularMarketChange: quote.change,
        regularMarketChangePercent: quote.changePercent,
      },
      symbol: quote.symbol,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/history/:symbol', async (req, res, next) => {
  try {
    const { range, interval } = req.query;
    const data = await getHistoricalData(req.params.symbol, range || '1mo', interval || '1d');
    // Embed raw Yahoo chart format for frontend compatibility
    const rawResult = {
      meta: data.length > 0 ? {
        symbol: req.params.symbol, regularMarketPrice: data[data.length-1]?.close,
        previousClose: data[0]?.close, currency: 'INR',
      } : { symbol: req.params.symbol },
      timestamp: data.map(d => new Date(d.date).getTime() / 1000),
      indicators: { quote: [{
        open: data.map(d => d.open), high: data.map(d => d.high),
        low: data.map(d => d.low), close: data.map(d => d.close),
        volume: data.map(d => d.volume),
      }]},
    };
    res.json({
      success: true, symbol: req.params.symbol, range: range || '1mo',
      count: data.length, data,
      chart: { result: [rawResult] },
    });
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
