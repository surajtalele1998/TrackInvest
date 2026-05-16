const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

let db = null;
let enabled = false;

function getDb() {
  if (db) return db;
  if (enabled === false && db === null) {
    try {
      const Database = require('better-sqlite3');
      db = new Database(config.dbPath);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      initSchema();
      enabled = true;
      logger.info(`SQLite ready at ${config.dbPath}`);
    } catch (err) {
      logger.warn('SQLite not available: ' + err.message + ' — using Supabase as primary DB');
      enabled = false;
    }
  }
  return db;
}

function initSchema() {
  if (!db) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS backups (
      id TEXT PRIMARY KEY, label TEXT, version TEXT, size_bytes INTEGER,
      record_count INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS backup_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT, backup_id TEXT NOT NULL REFERENCES backups(id) ON DELETE CASCADE,
      collection TEXT NOT NULL, record_id TEXT, data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notification_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body TEXT NOT NULL,
      tag TEXT, status TEXT NOT NULL DEFAULT 'sent', sent_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS market_cache (
      key TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY, label TEXT, messages TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS api_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT, endpoint TEXT NOT NULL, method TEXT NOT NULL,
      status INTEGER, ip TEXT, timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function isEnabled() { return enabled; }

module.exports = { getDb, isEnabled };
