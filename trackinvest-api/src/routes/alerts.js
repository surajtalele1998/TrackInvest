const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { createAlert, getAlerts, updateAlert, deleteAlert } = require('../services/priceAlertService');

const router = express.Router();

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { symbol, targetPrice, direction, note } = req.body;
    if (!symbol || !targetPrice) return res.status(400).json({ error: 'symbol and targetPrice required' });
    const alert = await createAlert(req.user.id, { symbol, targetPrice, direction, note });
    res.status(201).json({ success: true, alert });
  } catch (err) { next(err); }
});

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const alerts = await getAlerts(req.user.id);
    res.json({ success: true, count: alerts.length, alerts });
  } catch (err) { next(err); }
});

router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const alert = await updateAlert(req.params.id, req.user.id, req.body);
    res.json({ success: true, alert });
  } catch (err) { next(err); }
});

router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    await deleteAlert(req.params.id, req.user.id);
    res.json({ success: true, message: 'Alert deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
