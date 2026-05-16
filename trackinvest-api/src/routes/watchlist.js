const express = require('express');
const { authMiddleware, optionalAuth } = require('../services/authService');
const { createWatchlist, getWatchlists, addSymbol, removeSymbol, deleteWatchlist, getWatchlistPrices } = require('../services/watchlistService');

const router = express.Router();

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const wl = await createWatchlist(req.user.id, req.body.name);
    res.status(201).json({ success: true, watchlist: wl });
  } catch (err) { next(err); }
});

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const lists = await getWatchlists(req.user.id);
    res.json({ success: true, count: lists.length, watchlists: lists });
  } catch (err) { next(err); }
});

router.post('/:id/symbols', authMiddleware, async (req, res, next) => {
  try {
    const { symbol } = req.body;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    const wl = await addSymbol(req.params.id, req.user.id, symbol.toUpperCase());
    res.json({ success: true, watchlist: wl });
  } catch (err) { next(err); }
});

router.delete('/:id/symbols/:symbol', authMiddleware, async (req, res, next) => {
  try {
    const wl = await removeSymbol(req.params.id, req.user.id, req.params.symbol.toUpperCase());
    res.json({ success: true, watchlist: wl });
  } catch (err) { next(err); }
});

router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    await deleteWatchlist(req.params.id, req.user.id);
    res.json({ success: true, message: 'Watchlist deleted' });
  } catch (err) { next(err); }
});

router.get('/prices', optionalAuth, async (req, res, next) => {
  try {
    const symbols = req.query.symbols ? req.query.symbols.split(',') : [];
    if (symbols.length === 0) return res.status(400).json({ error: 'symbols query param required (comma-separated)' });
    const prices = await getWatchlistPrices(symbols);
    res.json({ success: true, count: prices.length, prices });
  } catch (err) { next(err); }
});

module.exports = router;
