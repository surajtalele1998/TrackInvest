const supabase = require('./supabase');
const logger = require('../utils/logger');

const WEBHOOK_EVENTS = ['portfolio.sync', 'transaction.new', 'goal.update', 'alert.trigger', 'backup.complete'];

async function registerWebhook(userId, data) {
  const client = supabase.getClient();
  if (!client) throw Object.assign(new Error('Supabase not configured'), { status: 503, expose: true });
  if (!WEBHOOK_EVENTS.includes(data.event)) {
    throw Object.assign(new Error(`Invalid event. Allowed: ${WEBHOOK_EVENTS.join(', ')}`), { status: 400, expose: true });
  }
  const { data: wh, error } = await client.from('webhooks').insert({
    user_id: userId, name: data.name || data.event,
    url: data.url, event: data.event, secret: data.secret || null,
    active: true,
  }).select('*').single();
  if (error) {
    if (error.message.includes('relation') || error.message.includes('does not exist')) {
      await createWebhookTable();
      const retry = await client.from('webhooks').insert({
        user_id: userId, name: data.name || data.event, url: data.url,
        event: data.event, secret: data.secret || null, active: true,
      }).select('*').single();
      return retry.data;
    }
    throw Object.assign(new Error(error.message), { status: 400, expose: true });
  }
  return wh;
}

async function getWebhooks(userId) {
  const client = supabase.getClient();
  if (!client) return [];
  const { data } = await client.from('webhooks').select('*').eq('user_id', userId).order('created_at');
  return data || [];
}

async function deleteWebhook(id, userId) {
  const client = supabase.getClient();
  await client.from('webhooks').delete().eq('id', id).eq('user_id', userId);
}

async function getWebhookLogs(webhookId, limit = 20) {
  const client = supabase.getClient();
  if (!client) return [];
  const { data } = await client.from('webhook_logs').select('*').eq('webhook_id', webhookId).order('created_at', { ascending: false }).limit(limit);
  return data || [];
}

async function createWebhookTable() {
  const client = supabase.getClient();
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.webhooks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL, url TEXT NOT NULL, event TEXT NOT NULL,
      secret TEXT, active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.webhook_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
      event TEXT NOT NULL, payload JSONB, status TEXT,
      response TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

module.exports = { registerWebhook, getWebhooks, deleteWebhook, getWebhookLogs, WEBHOOK_EVENTS };
