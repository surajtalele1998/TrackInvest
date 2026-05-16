const path = require('path');
const fs = require('fs');
const express = require('express');

const router = express.Router();

function loadRoutes(paths) {
  const groups = {};
  for (const [prefix, filePath] of paths) {
    try {
      const route = require(filePath);
      let methods = [];
      if (route.stack) {
        for (const layer of route.stack) {
          if (layer.route) {
            for (const method in layer.route.methods) {
              if (layer.route.methods[method]) {
                methods.push({ method: method.toUpperCase(), path: layer.route.path });
              }
            }
          }
        }
      }
      groups[prefix] = { file: filePath, methods };
    } catch (e) {
      groups[prefix] = { file: filePath, error: e.message };
    }
  }
  return groups;
}

router.get('/openapi.json', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'TrackInvest API',
      version: '2.0.0',
      description: 'Background API service for TrackInvest — AI insights, market data, portfolio analytics, notifications, auth, backup, export, and more.',
      contact: { url: 'https://github.com/skcode98/TrackInvest' },
    },
    servers: [{ url: baseUrl, description: 'Current' }],
    paths: {
      '/api/v1/health': { get: { summary: 'Service health check', tags: ['Health'], responses: { '200': { description: 'OK' } } } },
      '/api/v1/auth/register': { post: { summary: 'Register new user', tags: ['Auth'], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' }, name: { type: 'string' } }, required: ['email', 'password'] } } } }, responses: { '201': { description: 'User created' } } } },
      '/api/v1/auth/login': { post: { summary: 'Login', tags: ['Auth'], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' }, deviceName: { type: 'string' }, deviceId: { type: 'string' } }, required: ['email', 'password'] } } } }, responses: { '200': { description: 'OK' } } } },
      '/api/v1/auth/profile': { get: { summary: 'Get user profile', tags: ['Auth'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'OK' } } }, put: { summary: 'Update profile', tags: ['Auth'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'OK' } } } },
      '/api/v1/auth/devices': { get: { summary: 'List devices', tags: ['Auth'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'OK' } } } },
      '/api/v1/auth/devices/{id}': { delete: { summary: 'Remove device', tags: ['Auth'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } } },
      '/api/v1/ai/chat': { post: { summary: 'Chat with AI advisor', tags: ['AI'], security: [{ apiKey: [] }], responses: { '200': { description: 'AI response' } } } },
      '/api/v1/ai/report': { post: { summary: 'Generate AI report', tags: ['AI'], security: [{ apiKey: [] }], responses: { '200': { description: 'Report text' } } } },
      '/api/v1/market/search': { get: { summary: 'Search markets', tags: ['Market'], security: [{ apiKey: [] }], parameters: [{ name: 'query', in: 'query', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Search results' } } } },
      '/api/v1/market/quote/{symbol}': { get: { summary: 'Get quote', tags: ['Market'], security: [{ apiKey: [] }], parameters: [{ name: 'symbol', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Quote data' } } } },
      '/api/v1/market/history/{symbol}': { get: { summary: 'Get history', tags: ['Market'], security: [{ apiKey: [] }], parameters: [{ name: 'symbol', in: 'path', required: true, schema: { type: 'string' } }, { name: 'range', in: 'query', schema: { type: 'string' } }, { name: 'interval', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'Historical data' } } } },
      '/api/v1/market/mf/{schemeCode}': { get: { summary: 'Get MF NAV', tags: ['Market'], security: [{ apiKey: [] }], parameters: [{ name: 'schemeCode', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'NAV data' } } } },
      '/api/v1/portfolio/analyze': { post: { summary: 'Analyze portfolio', tags: ['Portfolio'], security: [{ apiKey: [] }], responses: { '200': { description: 'Analysis' } } } },
      '/api/v1/portfolio/xirr': { post: { summary: 'Calculate XIRR', tags: ['Portfolio'], security: [{ apiKey: [] }], responses: { '200': { description: 'XIRR' } } } },
      '/api/v1/portfolio/rebalance': { post: { summary: 'Rebalance suggestions', tags: ['Portfolio'], security: [{ apiKey: [] }], responses: { '200': { description: 'Suggestions' } } } },
      '/api/v1/goals': { get: { summary: 'List goals', tags: ['Goals'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Goals list' } } }, post: { summary: 'Create goal', tags: ['Goals'], security: [{ bearerAuth: [] }], responses: { '201': { description: 'Goal created' } } } },
      '/api/v1/goals/{id}': { get: { summary: 'Get goal', tags: ['Goals'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Goal' } } }, put: { summary: 'Update goal', tags: ['Goals'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Updated' } } }, delete: { summary: 'Delete goal', tags: ['Goals'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Deleted' } } } },
      '/api/v1/watchlist': { get: { summary: 'List watchlists', tags: ['Watchlist'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Watchlists' } } }, post: { summary: 'Create watchlist', tags: ['Watchlist'], security: [{ bearerAuth: [] }], responses: { '201': { description: 'Created' } } } },
      '/api/v1/watchlist/{id}/symbols': { post: { summary: 'Add symbol', tags: ['Watchlist'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Added' } } } },
      '/api/v1/alerts': { get: { summary: 'List alerts', tags: ['Alerts'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Alerts' } } }, post: { summary: 'Create alert', tags: ['Alerts'], security: [{ bearerAuth: [] }], responses: { '201': { description: 'Created' } } } },
      '/api/v1/calculator/sip': { post: { summary: 'SIP calculator', tags: ['Calculator'], responses: { '200': { description: 'Result' } } } },
      '/api/v1/calculator/lumpsum': { post: { summary: 'Lumpsum calculator', tags: ['Calculator'], responses: { '200': { description: 'Result' } } } },
      '/api/v1/calculator/emi': { post: { summary: 'EMI calculator', tags: ['Calculator'], responses: { '200': { description: 'Result' } } } },
      '/api/v1/calculator/retirement': { post: { summary: 'Retirement calculator', tags: ['Calculator'], responses: { '200': { description: 'Result' } } } },
      '/api/v1/tax/analyze': { post: { summary: 'Tax harvesting analysis', tags: ['Tax'], responses: { '200': { description: 'Analysis' } } } },
      '/api/v1/tax/estimate-gains': { post: { summary: 'Estimate capital gains', tags: ['Tax'], responses: { '200': { description: 'Estimate' } } } },
      '/api/v1/dividends': { get: { summary: 'List dividends', tags: ['Dividends'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Dividends' } } }, post: { summary: 'Add dividend', tags: ['Dividends'], security: [{ bearerAuth: [] }], responses: { '201': { description: 'Created' } } } },
      '/api/v1/dividends/summary': { get: { summary: 'Dividend summary', tags: ['Dividends'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Summary' } } } },
      '/api/v1/webhooks/register': { post: { summary: 'Register webhook', tags: ['Webhooks'], security: [{ bearerAuth: [] }], responses: { '201': { description: 'Created' } } } },
      '/api/v1/webhooks/incoming/{event}': { post: { summary: 'Receive webhook', tags: ['Webhooks'], responses: { '200': { description: 'Received' } } } },
      '/api/v1/export/csv': { post: { summary: 'Export CSV', tags: ['Export'], responses: { '200': { description: 'CSV file' } } } },
      '/api/v1/export/excel': { post: { summary: 'Export Excel', tags: ['Export'], responses: { '200': { description: 'XLSX file' } } } },
      '/api/v1/export/portfolio-report': { post: { summary: 'Export portfolio report', tags: ['Export'], responses: { '200': { description: 'CSV/XLSX' } } } },
      '/api/v1/news/financial': { get: { summary: 'Financial news', tags: ['News'], parameters: [{ name: 'query', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'News' } } } },
      '/api/v1/news/headlines': { get: { summary: 'Top headlines', tags: ['News'], responses: { '200': { description: 'Headlines' } } } },
      '/api/v1/news/exchange-rate': { get: { summary: 'Exchange rate', tags: ['News'], responses: { '200': { description: 'Rate' } } } },
      '/api/v1/import/upload': { post: { summary: 'Upload file import', tags: ['Import'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Import result' } } } },
      '/api/v1/import/csv': { post: { summary: 'Import CSV text', tags: ['Import'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Import result' } } } },
      '/api/v1/import/json': { post: { summary: 'Import JSON', tags: ['Import'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Import result' } } } },
      '/api/v1/admin/stats': { get: { summary: 'Admin stats', tags: ['Admin'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Stats' } } } },
      '/api/v1/admin/users': { get: { summary: 'List users', tags: ['Admin'], security: [{ bearerAuth: [] }], responses: { '200': { description: 'Users' } } } },
      '/api/v1/views/portfolio/{userId}': { get: { summary: 'Portfolio report view', tags: ['Views'], responses: { '200': { description: 'HTML/PDF' } } } },
      '/api/v1/views/report/{type}': { get: { summary: 'AI report view', tags: ['Views'], responses: { '200': { description: 'HTML/PDF' } } } },
    },
    components: {
      securitySchemes: {
        apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key', description: 'API Key authentication' },
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'JWT token from /auth/login' },
      },
    },
    security: [{ apiKey: [] }],
  };
  res.json(spec);
});

router.get('/docs', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><title>TrackInvest API Docs</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
  </head><body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>SwaggerUIBundle({ url: '/api/v1/docs/openapi.json', dom_id: '#swagger-ui' })</script>
  </body></html>`);
});

module.exports = router;
