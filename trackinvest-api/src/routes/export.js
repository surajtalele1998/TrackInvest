const express = require('express');
const { exportToCsv, exportToExcel, exportToPdf } = require('../services/exportService');
const { analyzePortfolio } = require('../services/portfolioAnalyzer');
const { authMiddleware, optionalAuth } = require('../services/authService');
const supabase = require('../services/supabase');

const router = express.Router();

router.post('/csv', optionalAuth, async (req, res, next) => {
  try {
    const { data, columns, filename } = req.body;
    if (!data || !columns) return res.status(400).json({ error: 'data and columns required' });
    const csv = exportToCsv(data, columns);
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename || 'export.csv'}"` });
    res.send(csv);
  } catch (err) { next(err); }
});

router.post('/excel', optionalAuth, async (req, res, next) => {
  try {
    const { data, columns, filename, sheetName } = req.body;
    if (!data || !columns) return res.status(400).json({ error: 'data and columns required' });
    const buffer = await exportToExcel(data, columns, sheetName);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${filename || 'export.xlsx'}"` });
    res.send(buffer);
  } catch (err) { next(err); }
});

router.post('/pdf', optionalAuth, async (req, res, next) => {
  try {
    const { html, filename } = req.body;
    if (!html) return res.status(400).json({ error: 'html content required' });
    const result = await exportToPdf(html);
    if (result && result.error) return res.status(200).json({ error: result.message, html: result.html });
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename || 'report.pdf'}"` });
    res.send(result);
  } catch (err) { next(err); }
});

router.post('/portfolio-report', optionalAuth, async (req, res, next) => {
  try {
    const { holdings, format } = req.body;
    if (!holdings) return res.status(400).json({ error: 'holdings required' });
    const analysis = analyzePortfolio(holdings);
    const columns = ['name', 'type', 'invested', 'currentValue', 'returnVal', 'returnPercent'];
    const rows = holdings.map(h => ({
      name: h.name, type: h.type,
      invested: h.invested || 0, currentValue: h.currentValue || 0,
      returnVal: (h.currentValue || 0) - (h.invested || 0),
      returnPercent: h.invested > 0 ? ((((h.currentValue || 0) - (h.invested || 0)) / h.invested) * 100).toFixed(2) : '0.00',
    }));

    if (format === 'xlsx') {
      const buffer = await exportToExcel(rows, columns, 'Portfolio');
      res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="portfolio-report.xlsx"' });
      return res.send(buffer);
    }

    const csv = exportToCsv(rows, columns);
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="portfolio-report.csv"' });
    res.send(csv);
  } catch (err) { next(err); }
});

module.exports = router;
