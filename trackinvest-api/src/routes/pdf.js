const express = require('express');
const { generatePdfFromHtml, generatePdfFromReportType } = require('../services/pdfGenerator');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/from-html', async (req, res, next) => {
  try {
    const { html, filename } = req.body;
    if (!html) return res.status(400).json({ error: 'html content required' });
    const buffer = await generatePdfFromHtml(html);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename || 'report.pdf'}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.post('/report/:type', async (req, res, next) => {
  try {
    const { type } = req.params;
    if (!['full_report', 'blueprint', 'ledger', 'forecast'].includes(type)) {
      return res.status(400).json({ error: `Unknown report type: ${type}` });
    }
    const portfolioData = req.body || {};
    const buffer = await generatePdfFromReportType(type, portfolioData);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${type}-${Date.now()}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
