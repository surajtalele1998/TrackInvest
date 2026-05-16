const logger = require('../utils/logger');

let auditLog = [];

function log(action, userId, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    userId: userId || 'anonymous',
    details: typeof details === 'string' ? { message: details } : details,
  };
  auditLog.push(entry);
  if (auditLog.length > 10000) auditLog.shift();
  logger.debug(`AUDIT [${action}] user=${entry.userId} ${JSON.stringify(entry.details).slice(0, 200)}`);
  return entry;
}

function getLogs(filter = {}, limit = 100) {
  let logs = [...auditLog];
  if (filter.action) logs = logs.filter(l => l.action === filter.action);
  if (filter.userId) logs = logs.filter(l => l.userId === filter.userId);
  if (filter.since) logs = logs.filter(l => new Date(l.timestamp) >= new Date(filter.since));
  return logs.slice(-limit).reverse();
}

function getStats() {
  const counts = {};
  for (const entry of auditLog) {
    counts[entry.action] = (counts[entry.action] || 0) + 1;
  }
  return {
    total: auditLog.length,
    uniqueUsers: [...new Set(auditLog.map(l => l.userId))].length,
    byAction: counts,
  };
}

module.exports = { log, getLogs, getStats };
