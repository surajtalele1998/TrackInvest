const config = require('../config');
const logger = require('../utils/logger');

class CacheService {
  constructor() {
    this._store = new Map();
    this._timers = new Map();
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this._store.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key, data, ttlMs = 300000) {
    this._store.set(key, { data, expires: Date.now() + ttlMs });
    if (this._timers.has(key)) clearTimeout(this._timers.get(key));
    this._timers.set(key, setTimeout(() => {
      this._store.delete(key);
      this._timers.delete(key);
    }, ttlMs));
  }

  del(key) {
    this._store.delete(key);
    if (this._timers.has(key)) {
      clearTimeout(this._timers.get(key));
      this._timers.delete(key);
    }
  }

  flush() {
    this._store.clear();
    for (const t of this._timers.values()) clearTimeout(t);
    this._timers.clear();
  }

  getOrFetch(key, fetchFn, ttlMs = 300000) {
    const cached = this.get(key);
    if (cached) return Promise.resolve(cached);
    return Promise.resolve(fetchFn()).then(data => {
      this.set(key, data, ttlMs);
      return data;
    });
  }

  _cleanExpired() {
    const now = Date.now();
    for (const [key, entry] of this._store) {
      if (now > entry.expires) {
        this._store.delete(key);
        this._timers.delete(key);
      }
    }
  }
}

const cache = new CacheService();
setInterval(() => cache._cleanExpired(), 60000);

module.exports = cache;
