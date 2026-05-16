const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const logger = require('../utils/logger');

let supabase = null;
let enabled = false;

function getClient() {
  if (!config.supabase.url || !config.supabase.key) {
    return null;
  }
  if (!supabase) {
    supabase = createClient(config.supabase.url, config.supabase.key);
    enabled = true;
    logger.info('Supabase client initialized');
  }
  return supabase;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT NOT NULL,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name TEXT,
  device_id TEXT,
  refresh_token TEXT,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Main Portfolio',
  data JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  asset_type TEXT,
  amount NUMERIC NOT NULL,
  quantity NUMERIC,
  price NUMERIC,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  current_amount NUMERIC DEFAULT 0,
  target_date DATE,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT,
  data JSONB NOT NULL,
  size_bytes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

async function initSchema() {
  const client = getClient();
  if (!client) {
    logger.warn('Supabase not configured — schema init skipped');
    return false;
  }
  try {
    const statements = SCHEMA.split(';').filter(s => s.trim().length > 5);
    for (const stmt of statements) {
      const { error } = await client.rpc('exec_sql', { query: stmt + ';' }).single();
      if (error && !error.message.includes('already exists')) {
        logger.warn('Supabase schema init (non-fatal): ' + error.message);
      }
    }
    logger.info('Supabase schema initialized');
    return true;
  } catch (e) {
    logger.warn('Supabase schema init failed (run SQL manually): ' + e.message);
    logger.info('Execute the CREATE TABLE statements in Supabase SQL Editor');
    return false;
  }
}

module.exports = { getClient, initSchema, enabled: () => enabled };
