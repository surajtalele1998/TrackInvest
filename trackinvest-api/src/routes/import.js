const express = require('express');
const multer = require('multer');
const { authMiddleware } = require('../middleware/auth');
const { importData } = require('../services/dataImportService');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = express.Router();

router.post('/upload', authMiddleware, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file required' });
    const text = req.file.buffer.toString('utf8');
    const format = req.file.originalname.endsWith('.csv') ? 'csv' : 'json';
    const type = req.body.type || '';
    const result = await importData(req.user.id, format, text, type);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

router.post('/csv', authMiddleware, async (req, res, next) => {
  try {
    const { data, type } = req.body;
    if (!data) return res.status(400).json({ error: 'data (CSV text) required' });
    const result = await importData(req.user.id, 'csv', data, type || '');
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

router.post('/json', authMiddleware, async (req, res, next) => {
  try {
    const { data, type } = req.body;
    if (!data) return res.status(400).json({ error: 'data (JSON) required' });
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    const result = await importData(req.user.id, 'json', text, type || '');
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

module.exports = router;
