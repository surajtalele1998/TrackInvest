const TrackInvestAPI = (() => {
  let baseUrl = '';
  let apiKey = '';
  let enabled = false;
  let jwtToken = '';

  function loadConfig() {
    const cfg = db.apiConfig || {};
    baseUrl = cfg.baseUrl || '';
    apiKey = cfg.apiKey || '';
    enabled = cfg.enabled || false;
    jwtToken = cfg.jwtToken || '';
  }

  function refreshConfig() {
    loadConfig();
  }

  function isReady() {
    loadConfig();
    return enabled && !!baseUrl && !!apiKey;
  }

  function url(path) {
    return `${baseUrl.replace(/\/+$/, '')}/api/v1${path}`;
  }

  async function request(method, path, body = null, opts = {}) {
    if (!isReady()) throw new Error('API not configured. Enable in Settings → Cloud Services.');
    const headers = { 'x-api-key': apiKey, 'Content-Type': 'application/json' };
    if (jwtToken) headers['Authorization'] = 'Bearer ' + jwtToken;
    if (opts.headers) Object.assign(headers, opts.headers);

    const res = await fetch(url(path), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: opts.signal || undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      const msg = err.error || `HTTP ${res.status}`;
      if (res.status === 401) throw new Error('Invalid API key — generate a new one in Dev Portal or check your server configuration');
      throw new Error(msg);
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    if (ct.includes('text/csv') || ct.includes('application/vnd.openxmlformats')) return res;
    return res.json();
  }

  function get(path, opts) { return request('GET', path, null, opts); }
  function post(path, body, opts) { return request('POST', path, body, opts); }
  function put(path, body, opts) { return request('PUT', path, body, opts); }
  function del(path, opts) { return request('DELETE', path, null, opts); }

  // ── Auth ──
  const auth = {
    register: (email, password, name) => post('/auth/register', { email, password, name }),
    login: (email, password, deviceName, deviceId) => post('/auth/login', { email, password, deviceName, deviceId }),
    getProfile: () => get('/auth/profile'),
    updateProfile: (data) => put('/auth/profile', data),
    getDevices: () => get('/auth/devices'),
    removeDevice: (id) => del(`/auth/devices/${id}`),
  };

  // ── AI ──
  const ai = {
    chat: (message, history) => post('/ai/chat', { message, history }),
    report: (type, portfolioData) => post('/ai/report', { type, portfolioData }),
  };

  // ── Market ──
  const market = {
    search: (query) => get(`/market/search?query=${encodeURIComponent(query)}`),
    quote: (symbol) => get(`/market/quote/${encodeURIComponent(symbol)}`),
    history: (symbol, range, interval) => get(`/market/history/${encodeURIComponent(symbol)}?range=${range || '1mo'}&interval=${interval || '1d'}`),
    mfNav: (schemeCode) => get(`/market/mf/${schemeCode}`),
  };

  // ── Portfolio ──
  const portfolio = {
    analyze: (holdings) => post('/portfolio/analyze', { holdings }),
    xirr: (transactions) => post('/portfolio/xirr', { transactions }),
    rebalance: (holdings, targetAllocation) => post('/portfolio/rebalance', { holdings, targetAllocation }),
  };

  // ── Goals ──
  const goals = {
    list: () => get('/goals'),
    get: (id) => get(`/goals/${id}`),
    create: (data) => post('/goals', data),
    update: (id, data) => put(`/goals/${id}`, data),
    delete: (id) => del(`/goals/${id}`),
    project: (data) => post('/goals/project', data),
  };

  // ── Watchlist ──
  const watchlist = {
    list: () => get('/watchlist'),
    create: (name) => post('/watchlist', { name }),
    addSymbol: (id, symbol) => post(`/watchlist/${id}/symbols`, { symbol }),
    removeSymbol: (id, symbol) => del(`/watchlist/${id}/symbols/${encodeURIComponent(symbol)}`),
    delete: (id) => del(`/watchlist/${id}`),
    prices: (symbols) => get(`/watchlist/prices?symbols=${symbols.join(',')}`),
  };

  // ── Alerts ──
  const alerts = {
    list: () => get('/alerts'),
    create: (data) => post('/alerts', data),
    update: (id, data) => put(`/alerts/${id}`, data),
    delete: (id) => del(`/alerts/${id}`),
  };

  // ── Calculators ──
  const calculator = {
    sip: (data) => post('/calculator/sip', data),
    lumpsum: (data) => post('/calculator/lumpsum', data),
    emi: (data) => post('/calculator/emi', data),
    retirement: (data) => post('/calculator/retirement', data),
    goal: (data) => post('/calculator/goal', data),
  };

  // ── Tax ──
  const tax = {
    analyze: (holdings) => post('/tax/analyze', { holdings }),
    estimateGains: (holdings, sellAmount) => post('/tax/estimate-gains', { holdings, sellAmount }),
  };

  // ── Dividends ──
  const dividends = {
    list: (symbol) => get(`/dividends${symbol ? '?symbol=' + encodeURIComponent(symbol) : ''}`),
    summary: () => get('/dividends/summary'),
    add: (data) => post('/dividends', data),
  };

  // ── Notifications ──
  const notifications = {
    subscribe: (subscription) => post('/notifications/subscribe', { subscription }),
    send: (title, body, tag) => post('/notifications/send', { title, body, tag }),
    sendEmail: (to, subject, html) => post('/notifications/email', { to, subject, html }),
    log: (limit) => get(`/notifications/log${limit ? '?limit=' + limit : ''}`),
  };

  // ── Sync / Backup ──
  const sync = {
    backup: (data, label, version) => post('/sync/backup', { data, label, version }),
    list: (page, limit) => get(`/sync/backups?page=${page || 1}&limit=${limit || 20}`),
    get: (id) => get(`/sync/backup/${id}`),
    delete: (id) => del(`/sync/backup/${id}`),
    syncNow: (data) => post('/sync/sync', data),
    gistBackup: (data) => post('/sync/gist-backup', data),
    gistList: () => get('/sync/gist-backups'),
  };

  // ── Export ──
  const exportApi = {
    csv: (data, columns, filename) => post('/export/csv', { data, columns, filename }),
    excel: (data, columns, filename, sheetName) => post('/export/excel', { data, columns, filename, sheetName }),
    portfolioReport: (holdings, format) => post('/export/portfolio-report', { holdings, format }),
  };

  // ── Import ──
  const importApi = {
    csv: (data, type) => post('/import/csv', { data, type }),
    json: (data, type) => post('/import/json', { data, type }),
  };

  // ── News ──
  const news = {
    financial: (query, pageSize) => get(`/news/financial?query=${encodeURIComponent(query || 'stock market india')}&pageSize=${pageSize || 10}`),
    headlines: (country, category, pageSize) => get(`/news/headlines?country=${country || 'in'}&category=${category || 'business'}&pageSize=${pageSize || 10}`),
    exchangeRate: (base, target) => get(`/news/exchange-rate?base=${base || 'INR'}&target=${target || 'USD'}`),
  };

  // ── Health ──
  const health = () => get('/health');

  // ── Cloud backup: push local db to API ──
  async function backupLocalDb(label) {
    const data = safeLocalStorageGet('appHubInvestDb', {});
    const result = await sync.backup(data, label || 'manual-' + new Date().toISOString().slice(0, 10), '1.0.0');
    return result;
  }

  async function restoreFromBackup(backupId) {
    const result = await sync.get(backupId);
    if (result?.data) {
      safeLocalStorageSet('appHubInvestDb', result.data);
      location.reload();
    }
    return result;
  }

  // ── Login / Register user ──
  async function loginUser(email, password) {
    const result = await auth.login(email, password, 'TrackInvest Web', 'web-' + Date.now());
    if (result?.accessToken) {
      db.apiConfig = db.apiConfig || {};
      db.apiConfig.jwtToken = result.accessToken;
      db.apiConfig.refreshToken = result.refreshToken;
      db.apiConfig.userEmail = email;
      saveData();
      jwtToken = result.accessToken;
    }
    return result;
  }

  async function registerUser(email, password, name) {
    const result = await auth.register(email, password, name);
    if (result?.accessToken) {
      db.apiConfig = db.apiConfig || {};
      db.apiConfig.jwtToken = result.accessToken;
      db.apiConfig.refreshToken = result.refreshToken;
      db.apiConfig.userEmail = email;
      saveData();
      jwtToken = result.accessToken;
    }
    return result;
  }

  // ── Sync all local data to cloud ──
  async function fullSync() {
    const data = safeLocalStorageGet('appHubInvestDb', {});
    const result = await sync.syncNow(data);
    if (result?.backup) {
      db.lastCloudSync = new Date().toISOString();
      saveData();
    }
    return result;
  }

  // ── Generate new API key via backend ──
  async function generateApiKey() {
    return post('/admin/generate-key');
  }

  return {
    loadConfig, refreshConfig, isReady, health,
    auth, ai, market, portfolio, goals, watchlist, alerts, calculator,
    tax, dividends, notifications, sync, export: exportApi, import: importApi, news,
    backupLocalDb, restoreFromBackup, loginUser, registerUser, fullSync, generateApiKey,
  };
})();
