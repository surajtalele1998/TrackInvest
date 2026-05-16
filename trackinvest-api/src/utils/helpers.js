const { v4: uuidv4 } = require('uuid');

function generateId() {
  return uuidv4().slice(0, 8);
}

function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '').trim();
}

function paginate(page = 1, limit = 20) {
  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  return { offset: (page - 1) * limit, limit, page };
}

function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount || 0);
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

module.exports = { generateId, sanitizeInput, paginate, formatCurrency, deepClone };
