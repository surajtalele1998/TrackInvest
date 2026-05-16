const ExcelJS = require('exceljs');
const config = require('../config');
const logger = require('../utils/logger');

function exportToCsv(data, columns) {
  const headers = columns.map(c => `"${c}"`).join(',');
  const rows = data.map(row =>
    columns.map(col => {
      const val = row[col] ?? '';
      return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(',')
  );
  return '\uFEFF' + [headers, ...rows].join('\n');
}

async function exportToExcel(data, columns, sheetName = 'TrackInvest') {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TrackInvest API';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map(col => ({
    header: col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    key: col,
    width: 20,
  }));

  data.forEach(row => sheet.addRow(row));

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6C63FF' } };

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

async function exportToPdf(htmlContent) {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    return { error: true, html: htmlContent, message: 'Puppeteer not available. Render HTML client-side.' };
  }
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <style>body{font-family:Segoe UI,sans-serif;padding:40px;color:#1a1a2e;line-height:1.6}
      h1{color:#6c63ff;border-bottom:2px solid #6c63ff;padding-bottom:8px}
      table{width:100%;border-collapse:collapse;margin:12px 0}
      th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #eee;font-size:13px}
      th{background:#f5f3ff;color:#6c63ff;font-weight:600}
      .footer{text-align:center;margin-top:40px;padding-top:15px;border-top:1px solid #ddd;font-size:11px;color:#aaa}
      </style></head><body>${htmlContent}<div class="footer"><p>TrackInvest — Generated ${new Date().toLocaleDateString()}</p></div></body></html>`;
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({ format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' }, printBackground: true });
    return buffer;
  } finally {
    await browser.close();
  }
}

module.exports = { exportToCsv, exportToExcel, exportToPdf };
