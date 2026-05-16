const supabase = require('./supabase');
const cache = require('./cacheService');
const config = require('../config');
const logger = require('../utils/logger');

async function getUsageStats() {
  const client = supabase.getClient();
  const stats = { requests: 0, users: 0, portfolios: 0, goals: 0, alerts: 0 };

  if (config.supabase.url) {
    try {
      if (client) {
        const { count: users } = await client.from('users').select('*', { count: 'exact', head: true });
        stats.users = users || 0;
        const { count: portfolios } = await client.from('portfolios').select('*', { count: 'exact', head: true });
        stats.portfolios = portfolios || 0;
        const { count: goals } = await client.from('goals').select('*', { count: 'exact', head: true });
        stats.goals = goals || 0;
        const { count: alerts } = await client.from('price_alerts').select('*', { count: 'exact', head: true });
        stats.alerts = alerts || 0;
      }
    } catch (e) {
      logger.warn('Admin stats: ' + e.message);
    }
  }

  stats.requests = cache.get('request_count') || 0;
  return stats;
}

async function listUsers(page = 1, limit = 20) {
  const client = supabase.getClient();
  if (!client) return { users: [], total: 0 };
  const offset = (page - 1) * limit;
  const { data, count } = await client.from('users')
    .select('id, email, name, preferences, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  return { users: data || [], total: count || 0, page, limit };
}

async function getApiKeyInfo() {
  const keys = config.apiKeys.map(k => ({
    prefix: k.slice(0, 8) + '...',
    length: k.length,
    masked: k.slice(0, 4) + '*'.repeat(k.length - 8) + k.slice(-4),
  }));
  return { count: keys.length, keys };
}

async function trackRequest(req) {
  const current = cache.get('request_count') || 0;
  cache.set('request_count', current + 1, 86400000);
  const { getDb } = require('../models/database');
  try {
    const db = getDb();
    if (db) {
      db.prepare('INSERT INTO api_usage (endpoint, method, status, ip) VALUES (?, ?, ?, ?)').run(
        req.path, req.method, req.statusCode || 200, req.ip || 'unknown'
      );
    }
  } catch (_) {}
}

async function getRecentRequests(limit = 50) {
  const { getDb } = require('../models/database');
  try {
    const db = getDb();
    if (db) return db.prepare('SELECT * FROM api_usage ORDER BY timestamp DESC LIMIT ?').all(limit);
  } catch (_) {}
  return [];
}

module.exports = { getUsageStats, listUsers, getApiKeyInfo, trackRequest, getRecentRequests };
