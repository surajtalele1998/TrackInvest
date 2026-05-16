const supabase = require('./supabase');
const config = require('../config');
const logger = require('../utils/logger');

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  }).filter(r => Object.values(r).some(v => v));
  return { headers, rows };
}

function parseJSON(text) {
  const data = JSON.parse(text);
  if (Array.isArray(data)) return { headers: Object.keys(data[0] || {}), rows: data };
  if (data.data && Array.isArray(data.data)) return { headers: Object.keys(data.data[0] || {}), rows: data.data };
  if (data.holdings && Array.isArray(data.holdings)) return { headers: Object.keys(data.holdings[0] || {}), rows: data.holdings };
  if (data.transactions && Array.isArray(data.transactions)) return { headers: Object.keys(data.transactions[0] || {}), rows: data.transactions };
  return { headers: Object.keys(data), rows: [data] };
}

function detectType(headers) {
  const h = headers.map(h => h.toLowerCase());
  if (h.some(x => ['symbol', 'ticker', 'scrip'].includes(x))) return 'holdings';
  if (h.some(x => ['date', 'amount', 'type'].includes(x)) && h.some(x => ['description', 'remarks', 'note'].includes(x))) return 'transactions';
  if (h.some(x => ['goal', 'target'].includes(x))) return 'goals';
  return 'generic';
}

async function importData(userId, format, text, type) {
  try {
    const parsed = format === 'csv' ? parseCSV(text) : parseJSON(text);
    if (parsed.rows.length === 0) throw Object.assign(new Error('No data found in import'), { status: 400, expose: true });

    const detectedType = type || detectType(parsed.headers);
    let imported = 0;
    const client = supabase.getClient();

    if (detectedType === 'holdings') {
      const holdings = parsed.rows.map(r => ({
        name: r.name || r.Name || r.symbol || r.Symbol || 'Unknown',
        symbol: r.symbol || r.Symbol || '',
        type: r.type || r.Type || r.asset_type || 'stock',
        invested: parseFloat(r.invested || r.Invested || r.buy_price || r.BuyPrice || r.cost || 0),
        currentValue: parseFloat(r.currentValue || r.CurrentValue || r.value || r.Value || r.ltp || 0),
        quantity: parseFloat(r.quantity || r.Quantity || r.qty || 0),
        buyDate: r.date || r.Date || r.buy_date || r.BuyDate || null,
      }));
      if (client) {
        const { error } = await client.from('portfolios').insert({
          user_id: userId, name: 'Imported Portfolio', data: holdings,
        });
        if (error && error.message.includes('relation')) {
          logger.warn('Import: portfolio table not available');
        }
      }
      imported = holdings.length;
    } else if (detectedType === 'transactions') {
      const transactions = parsed.rows.map(r => ({
        user_id: userId, type: r.type || r.Type || 'buy',
        asset_name: r.name || r.Name || r.symbol || r.Symbol || r.description || r.Description || 'Unknown',
        asset_type: r.asset_type || r.AssetType || 'stock',
        amount: parseFloat(r.amount || r.Amount || r.value || r.Value || 0),
        quantity: parseFloat(r.quantity || r.Quantity || 0),
        price: parseFloat(r.price || r.Price || r.nav || 0),
        date: r.date || r.Date || r.transaction_date || new Date().toISOString().slice(0, 10),
        notes: r.notes || r.Notes || r.remarks || '',
      }));
      if (client) {
        const { error } = await client.from('transactions').insert(transactions);
        if (error && error.message.includes('relation')) {
          logger.warn('Import: transactions table not available');
        }
      }
      imported = transactions.length;
    }

    return { type: detectedType, headers: parsed.headers, imported, total: parsed.rows.length };
  } catch (err) {
    if (err.expose) throw err;
    throw Object.assign(new Error('Import failed: ' + err.message), { status: 400, expose: true });
  }
}

module.exports = { importData, parseCSV, parseJSON, detectType };
