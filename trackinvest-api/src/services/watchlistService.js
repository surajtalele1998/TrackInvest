const supabase = require('./supabase');
const cache = require('./cacheService');
const marketProvider = require('./marketProvider');
const logger = require('../utils/logger');

async function createWatchlist(userId, name = 'Default') {
  const client = supabase.getClient();
  if (!client) throw Object.assign(new Error('Supabase not configured'), { status: 503, expose: true });
  const { data, error } = await client.from('watchlists').insert({
    user_id: userId, name, symbols: [],
  }).select('*').single();
  if (error) {
    if (error.message.includes('relation') || error.message.includes('does not exist')) {
      await createWatchlistTable();
      const retry = await client.from('watchlists').insert({ user_id: userId, name, symbols: [] }).select('*').single();
      if (retry.error) throw Object.assign(new Error(retry.error.message), { status: 400, expose: true });
      return retry.data;
    }
    throw Object.assign(new Error(error.message), { status: 400, expose: true });
  }
  return data;
}

async function getWatchlists(userId) {
  const client = supabase.getClient();
  if (!client) return [];
  const { data } = await client.from('watchlists').select('*').eq('user_id', userId).order('created_at');
  return data || [];
}

async function addSymbol(watchlistId, userId, symbol) {
  const client = supabase.getClient();
  const { data: wl } = await client.from('watchlists').select('*').eq('id', watchlistId).eq('user_id', userId).single();
  if (!wl) throw Object.assign(new Error('Watchlist not found'), { status: 404, expose: true });
  const symbols = wl.symbols || [];
  if (!symbols.includes(symbol)) symbols.push(symbol);
  const { data } = await client.from('watchlists').update({ symbols }).eq('id', watchlistId).select('*').single();
  return data;
}

async function removeSymbol(watchlistId, userId, symbol) {
  const client = supabase.getClient();
  const { data: wl } = await client.from('watchlists').select('*').eq('id', watchlistId).eq('user_id', userId).single();
  if (!wl) throw Object.assign(new Error('Watchlist not found'), { status: 404, expose: true });
  const symbols = (wl.symbols || []).filter(s => s !== symbol);
  const { data } = await client.from('watchlists').update({ symbols }).eq('id', watchlistId).select('*').single();
  return data;
}

async function deleteWatchlist(id, userId) {
  const client = supabase.getClient();
  await client.from('watchlists').delete().eq('id', id).eq('user_id', userId);
}

async function getWatchlistPrices(symbols) {
  const results = [];
  for (const symbol of symbols.slice(0, 20)) {
    try {
      const quote = await marketProvider.getQuote(symbol);
      results.push(quote);
    } catch {
      results.push({ symbol, price: null, error: 'Not found' });
    }
  }
  return results;
}

async function createWatchlistTable() {
  const client = supabase.getClient();
  if (!client) return;
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.watchlists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'Default',
      symbols TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

module.exports = { createWatchlist, getWatchlists, addSymbol, removeSymbol, deleteWatchlist, getWatchlistPrices };
