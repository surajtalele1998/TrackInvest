const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const config = require('../config');
const logger = require('../utils/logger');

async function generatePdfFromHtml(htmlContent, options = {}) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });

  try {
    const page = await browser.newPage();
    const fullHtml = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a2e; line-height: 1.6; }
        h1 { color: #6c63ff; border-bottom: 2px solid #6c63ff; padding-bottom: 8px; }
        h2 { color: #333; margin-top: 24px; }
        h3 { color: #555; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { border-bottom: none; font-size: 26px; }
        .header p { color: #888; font-size: 13px; }
        .footer { text-align: center; margin-top: 40px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 11px; color: #aaa; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
        th { background: #f5f3ff; color: #6c63ff; font-weight: 600; }
        .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
        .badge-green { background: #e8f5e9; color: #2e7d32; }
        .badge-red { background: #fce4ec; color: #c62828; }
        .badge-blue { background: #e3f2fd; color: #1565c0; }
        ul { padding-left: 20px; }
        li { margin-bottom: 4px; font-size: 13px; }
        .section { page-break-inside: avoid; }
      </style>
    </head><body>
      <div class="header">
        <h1>TrackInvest Report</h1>
        <p>Generated on ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      ${htmlContent}
      <div class="footer">
        <p>TrackInvest — AI-Powered Wealth Management</p>
      </div>
    </body></html>`;

    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      printBackground: true,
      displayHeaderFooter: false,
      ...options,
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

async function generatePdfFromReportType(type, portfolioData) {
  let html = '';

  if (type === 'full_report') {
    html = `<div class="section">
      <h2>Portfolio Summary</h2>
      <p>Total Invested: <strong>₹${(portfolioData.totalInvested || 0).toLocaleString('en-IN')}</strong></p>
      <p>Current Value: <strong>₹${(portfolioData.currentValue || 0).toLocaleString('en-IN')}</strong></p>
      <p>Overall Return: <strong>₹${(portfolioData.overallReturn || 0).toLocaleString('en-IN')}</strong> (${(portfolioData.overallReturnPercent || 0).toFixed(2)}%)</p>
      <p>Diversification Score: <strong>${portfolioData.diversificationScore || 'N/A'}/10</strong></p>
      <p>Risk Level: <strong>${portfolioData.riskLevel || 'N/A'}</strong></p>
    </div>`;

    if (portfolioData.holdings?.length) {
      html += `<div class="section"><h2>Holdings (${portfolioData.holdings.length})</h2><table>
        <tr><th>Name</th><th>Type</th><th>Invested</th><th>Current</th><th>Return</th></tr>`;
      for (const h of portfolioData.holdings) {
        const ret = ((h.currentValue || 0) - (h.invested || 0));
        const cls = ret >= 0 ? 'badge-green' : 'badge-red';
        html += `<tr><td>${h.name}</td><td>${h.type}</td><td>₹${(h.invested || 0).toLocaleString('en-IN')}</td><td>₹${(h.currentValue || 0).toLocaleString('en-IN')}</td><td><span class="badge ${cls}">${ret >= 0 ? '+' : ''}₹${ret.toLocaleString('en-IN')}</span></td></tr>`;
      }
      html += `</table></div>`;
    }
  } else if (type === 'blueprint') {
    html = `<div class="section">
      <h2>Wealth Blueprint</h2>
      <p>Current Net Worth: <strong>₹${(portfolioData.currentValue || 0).toLocaleString('en-IN')}</strong></p>
      <p>1-Year Target: <strong>₹${(Math.round((portfolioData.currentValue || 0) * 1.12)).toLocaleString('en-IN')}</strong></p>
      <p>5-Year Projection: <strong>₹${(Math.round((portfolioData.currentValue || 0) * 1.76)).toLocaleString('en-IN')}</strong></p>
      <p>Recommended Monthly Investment: <strong>₹${(Math.round((portfolioData.currentValue || 0) * 0.015)).toLocaleString('en-IN')}</strong></p>
    </div>`;
  } else {
    html = `<p>Report content for "${type}" goes here.</p>`;
  }

  return generatePdfFromHtml(html);
}

module.exports = { generatePdfFromHtml, generatePdfFromReportType };
