const express = require('express');
const ejs = require('ejs');
const path = require('path');
const supabase = require('../services/supabase');
const { authMiddleware } = require('../services/authService');
const { analyzePortfolio } = require('../services/portfolioAnalyzer');
const { generateReport } = require('../services/aiEngine');
const { exportToPdf } = require('../services/exportService');
const logger = require('../utils/logger');

const router = express.Router();

const viewsDir = path.resolve(__dirname, '..', 'views');

router.get('/portfolio/:userId', async (req, res, next) => {
  try {
    const client = supabase.getClient();
    if (!client) return res.status(503).json({ error: 'Supabase not configured' });
    const { data: portfolios } = await client.from('portfolios').select('*').eq('user_id', req.params.userId);
    if (!portfolios || portfolios.length === 0) return res.status(404).json({ error: 'No portfolio found' });

    const allHoldings = portfolios.flatMap(p => p.data || []);
    const analysis = analyzePortfolio(allHoldings);
    const date = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

    let rowsHtml = '';
    for (const h of allHoldings) {
      const ret = ((h.currentValue || 0) - (h.invested || 0));
      const cls = ret >= 0 ? 'badge-up' : 'badge-down';
      rowsHtml += `<tr><td>${h.name}</td><td>${h.type}</td><td>₹${(h.invested || 0).toLocaleString('en-IN')}</td><td>₹${(h.currentValue || 0).toLocaleString('en-IN')}</td><td><span class="${cls}">${ret >= 0 ? '+' : ''}₹${ret.toLocaleString('en-IN')}</span></td></tr>`;
    }

    const content = `
      <div class="stat-grid">
        <div class="stat-card"><div class="value">₹${analysis.totalInvested.toLocaleString('en-IN')}</div><div class="label">Total Invested</div></div>
        <div class="stat-card"><div class="value">₹${analysis.currentValue.toLocaleString('en-IN')}</div><div class="label">Current Value</div></div>
        <div class="stat-card"><div class="value">${analysis.overallReturnPercent.toFixed(2)}%</div><div class="label">Return</div></div>
        <div class="stat-card"><div class="value">${analysis.diversificationScore}/10</div><div class="label">Diversification</div></div>
      </div>
      <h2>Holdings (${allHoldings.length})</h2>
      <table><tr><th>Name</th><th>Type</th><th>Invested</th><th>Current</th><th>Return</th></tr>${rowsHtml}</table>
    `;

    const html = await ejs.renderFile(path.join(viewsDir, 'report.ejs'), {
      title: 'Portfolio Report',
      date,
      content,
      version: 'TrackInvest API v2.0',
    });

    if (req.query.format === 'pdf') {
      const pdf = await exportToPdf(html);
      if (pdf && pdf.error) return res.send(html);
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="portfolio-report.pdf"' });
      return res.send(pdf);
    }
    res.send(html);
  } catch (err) { next(err); }
});

router.get('/report/:type', async (req, res, next) => {
  try {
    const { type } = req.params;
    const { userId } = req.query;
    if (!['full_report', 'blueprint', 'ledger', 'forecast'].includes(type)) {
      return res.status(400).json({ error: `Unknown type: ${type}` });
    }

    let portfolioData = {};
    if (userId) {
      const client = supabase.getClient();
      if (client) {
        const { data: portfolios } = await client.from('portfolios').select('*').eq('user_id', userId);
        if (portfolios) portfolioData = { holdings: portfolios.flatMap(p => p.data || []) };
      }
    }

    const reportText = await generateReport(type, portfolioData);
    const content = `<pre style="white-space:pre-wrap;font-family:Segoe UI,sans-serif;font-size:14px;line-height:1.8;">${reportText}</pre>`;
    const date = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

    const html = await ejs.renderFile(path.join(viewsDir, 'report.ejs'), {
      title: `AI ${type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
      date,
      content,
      version: 'TrackInvest API v2.0',
    });

    if (req.query.format === 'pdf') {
      const pdf = await exportToPdf(html);
      if (pdf && pdf.error) return res.send(html);
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${type}.pdf"` });
      return res.send(pdf);
    }
    res.send(html);
  } catch (err) { next(err); }
});

module.exports = router;
