const fs = require('fs');
const path = require('path');
const config = require('../config');
const { getDb } = require('../models/database');
const { generateId } = require('../utils/helpers');
const logger = require('../utils/logger');

async function createBackup(data, label = '', version = '1.0.0') {
  const db = getDb();
  const id = generateId();
  const timestamp = new Date().toISOString();

  const collections = Object.entries(data);
  let totalRecords = 0;

  const insertEntry = db.prepare(`INSERT INTO backup_entries (backup_id, collection, record_id, data) VALUES (?, ?, ?, ?)`);

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO backups (id, label, version, size_bytes, record_count, created_at) VALUES (?, ?, ?, ?, 0, ?)`)
      .run(id, label || `Backup ${timestamp.slice(0, 10)}`, version, 0, timestamp);

    for (const [collection, records] of collections) {
      const arr = Array.isArray(records) ? records : [records];
      for (const record of arr) {
        const recordId = record.id || record._id || generateId();
        insertEntry.run(id, collection, recordId, JSON.stringify(record));
        totalRecords++;
      }
    }

    const dataStr = JSON.stringify(data);
    db.prepare('UPDATE backups SET size_bytes = ?, record_count = ? WHERE id = ?')
      .run(Buffer.byteLength(dataStr, 'utf8'), totalRecords, id);
  });

  tx();

  if (config.backup.provider === 'local') {
    const backupDir = path.join(config.dataDir, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const filePath = path.join(backupDir, `backup-${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    logger.info(`Backup saved locally: ${filePath}`);
  }

  logger.info(`Backup ${id} created — ${totalRecords} records, label="${label}"`);
  return { id, label: label || `Backup ${timestamp.slice(0, 10)}`, version, totalRecords, createdAt: timestamp };
}

async function restoreBackup(backupId) {
  const db = getDb();
  const backup = db.prepare('SELECT * FROM backups WHERE id = ?').get(backupId);
  if (!backup) throw Object.assign(new Error(`Backup ${backupId} not found`), { status: 404, expose: true });

  const entries = db.prepare('SELECT * FROM backup_entries WHERE backup_id = ?').all(backupId);
  const data = {};
  for (const entry of entries) {
    if (!data[entry.collection]) data[entry.collection] = [];
    data[entry.collection].push(JSON.parse(entry.data));
  }

  logger.info(`Backup ${backupId} restored — ${entries.length} entries`);
  return data;
}

function listBackups(page = 1, limit = 20) {
  const db = getDb();
  const offset = (page - 1) * limit;
  const backups = db.prepare('SELECT id, label, version, size_bytes, record_count, created_at FROM backups ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
  const total = db.prepare('SELECT COUNT(*) as count FROM backups').get().count;
  return { backups, total, page, limit, totalPages: Math.ceil(total / limit) };
}

function deleteBackup(backupId) {
  const db = getDb();
  const result = db.prepare('DELETE FROM backups WHERE id = ?').run(backupId);
  if (result.changes === 0) throw Object.assign(new Error(`Backup ${backupId} not found`), { status: 404, expose: true });
  db.prepare('DELETE FROM backup_entries WHERE backup_id = ?').run(backupId);

  if (config.backup.provider === 'local') {
    const filePath = path.join(config.dataDir, 'backups', `backup-${backupId}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  logger.info(`Backup ${backupId} deleted`);
}

module.exports = { createBackup, restoreBackup, listBackups, deleteBackup };
