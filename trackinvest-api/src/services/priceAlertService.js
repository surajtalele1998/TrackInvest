const supabase = require('./supabase');
const telegram = require('./telegramBot');
const ntfy = require('./ntfyService');
const logger = require('../utils/logger');

async function createAlert(userId, data) {
  const client = supabase.getClient();
  if (!client) throw Object.assign(new Error('Supabase not configured'), { status: 503, expose: true });
  const { data: alert, error } = await client.from('price_alerts').insert({
    user_id: userId, symbol: data.symbol.toUpperCase(),
    target_price: data.targetPrice, direction: data.direction || 'above',
    note: data.note || '', active: true,
  }).select('*').single();
  if (error) {
    if (error.message.includes('relation') || error.message.includes('does not exist')) {
      await createAlertsTable();
      const retry = await client.from('price_alerts').insert({
        user_id: userId, symbol: data.symbol.toUpperCase(), target_price: data.targetPrice,
        direction: data.direction || 'above', note: data.note || '', active: true,
      }).select('*').single();
      return retry.data;
    }
    throw Object.assign(new Error(error.message), { status: 400, expose: true });
  }
  return alert;
}

async function getAlerts(userId) {
  const client = supabase.getClient();
  if (!client) return [];
  const { data } = await client.from('price_alerts').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  return data || [];
}

async function updateAlert(id, userId, updates) {
  const client = supabase.getClient();
  const allowed = {};
  if (updates.targetPrice) allowed.target_price = updates.targetPrice;
  if (updates.direction) allowed.direction = updates.direction;
  if (updates.note !== undefined) allowed.note = updates.note;
  if (updates.active !== undefined) allowed.active = updates.active;
  const { data } = await client.from('price_alerts').update(allowed).eq('id', id).eq('user_id', userId).select('*').single();
  return data;
}

async function deleteAlert(id, userId) {
  const client = supabase.getClient();
  await client.from('price_alerts').delete().eq('id', id).eq('user_id', userId);
}

async function checkAlerts(symbol, currentPrice) {
  const client = supabase.getClient();
  if (!client) return;
  const { data: alerts } = await client.from('price_alerts')
    .select('*, users!inner(id, email)')
    .eq('symbol', symbol)
    .eq('active', true);
  if (!alerts) return;
  for (const alert of alerts) {
    let triggered = false;
    if (alert.direction === 'above' && currentPrice >= alert.target_price) triggered = true;
    if (alert.direction === 'below' && currentPrice <= alert.target_price) triggered = true;
    if (triggered) {
      const title = `🔔 Price Alert: ${symbol}`;
      const body = `${symbol} is now ${currentPrice >= alert.target_price ? 'above' : 'below'} ₹${alert.target_price}\nCurrent: ₹${currentPrice}`;
      await telegram.sendNotification(title, body);
      await ntfy.sendNtfy(title, body);
      await client.from('price_alerts').update({ active: false, triggered_at: new Date().toISOString() }).eq('id', alert.id);
      logger.info(`Price alert triggered: ${symbol} @ ${currentPrice}`);
    }
  }
}

async function createAlertsTable() {
  const client = supabase.getClient();
  if (!client) return;
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.price_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      symbol TEXT NOT NULL, target_price NUMERIC NOT NULL,
      direction TEXT NOT NULL DEFAULT 'above', note TEXT DEFAULT '',
      active BOOLEAN DEFAULT true, triggered_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

module.exports = { createAlert, getAlerts, updateAlert, deleteAlert, checkAlerts };
