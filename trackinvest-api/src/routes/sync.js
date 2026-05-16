const express = require('express');
const { createBackup, restoreBackup, listBackups, deleteBackup } = require('../services/syncService');
const { backupSchema } = require('../utils/validators');
const { paginate } = require('../utils/helpers');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/backup', async (req, res, next) => {
  try {
    const { data, label, version } = backupSchema.parse(req.body);
    const result = await createBackup(data, label, version || '1.0.0');
    res.status(201).json({ success: true, backup: result });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation error', details: err.errors });
    next(err);
  }
});

router.get('/backups', (req, res) => {
  const { page, limit } = paginate(req.query.page, req.query.limit);
  const result = listBackups(page, limit);
  res.json({ success: true, ...result });
});

router.get('/backup/:id', async (req, res, next) => {
  try {
    const data = await restoreBackup(req.params.id);
    res.json({ success: true, backupId: req.params.id, data });
  } catch (err) {
    next(err);
  }
});

router.delete('/backup/:id', (req, res, next) => {
  try {
    deleteBackup(req.params.id);
    res.json({ success: true, message: 'Backup deleted' });
  } catch (err) {
    next(err);
  }
});

router.post('/sync', async (req, res, next) => {
  try {
    const data = req.body;
    const result = await createBackup(data, 'sync', '1.0.0');
    res.json({ success: true, backup: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
