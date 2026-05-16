const supabase = require('./supabase');
const logger = require('../utils/logger');

async function addDividend(userId, data) {
  const client = supabase.getClient();
  if (!client) throw Object.assign(new Error('Supabase not configured'), { status: 503, expose: true });
  const { data: div, error } = await client.from('dividends').insert({
    user_id: userId, symbol: data.symbol.toUpperCase(),
    amount: data.amount, ex_date: data.exDate,
    pay_date: data.payDate || data.exDate, type: data.type || 'cash',
    notes: data.notes || '',
  }).select('*').single();
  if (error) {
    if (error.message.includes('relation') || error.message.includes('does not exist')) {
      await createDividendTable();
      const retry = await client.from('dividends').insert({
        user_id: userId, symbol: data.symbol.toUpperCase(), amount: data.amount,
        ex_date: data.exDate, pay_date: data.payDate || data.exDate,
        type: data.type || 'cash', notes: data.notes || '',
      }).select('*').single();
      return retry.data;
    }
    throw Object.assign(new Error(error.message), { status: 400, expose: true });
  }
  return div;
}

async function getDividends(userId, symbol = null) {
  const client = supabase.getClient();
  if (!client) return [];
  let query = client.from('dividends').select('*').eq('user_id', userId).order('ex_date', { ascending: false });
  if (symbol) query = query.eq('symbol', symbol.toUpperCase());
  const { data } = await query;
  return data || [];
}

async function getDividendSummary(userId) {
  const client = supabase.getClient();
  if (!client) return {};
  const { data } = await client.from('dividends').select('*').eq('user_id', userId);
  if (!data || data.length === 0) return { total: 0, bySymbol: {}, totalThisYear: 0, totalLastYear: 0 };

  const thisYear = new Date().getFullYear();
  const lastYear = thisYear - 1;
  let total = 0, thisYearTotal = 0, lastYearTotal = 0;
  const bySymbol = {};

  for (const d of data) {
    const amt = parseFloat(d.amount) || 0;
    total += amt;
    bySymbol[d.symbol] = (bySymbol[d.symbol] || 0) + amt;
    const year = new Date(d.ex_date).getFullYear();
    if (year === thisYear) thisYearTotal += amt;
    if (year === lastYear) lastYearTotal += amt;
  }

  const top = Object.entries(bySymbol).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([symbol, amount]) => ({ symbol, amount: Math.round(amount) }));

  return {
    totalDividends: Math.round(total),
    totalThisYear: Math.round(thisYearTotal),
    totalLastYear: Math.round(lastYearTotal),
    bySymbol: top,
    count: data.length,
  };
}

async function createDividendTable() {
  const client = supabase.getClient();
  if (!client) return;
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.dividends (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      symbol TEXT NOT NULL, amount NUMERIC NOT NULL,
      ex_date DATE NOT NULL, pay_date DATE, type TEXT DEFAULT 'cash',
      notes TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

module.exports = { addDividend, getDividends, getDividendSummary };
