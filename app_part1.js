// ==========================================
// 1. DATA INITIALIZATION & CONSTANT STORE
// ==========================================
let db = JSON.parse(localStorage.getItem('appHubInvestDb')) || {};

if (!db.userProfile) db.userProfile = { salary: 0, regime: 'new', monthlyExpense: 0 };
if (!db.userProfile.monthlyExpense) db.userProfile.monthlyExpense = 0;
if (!db.settingsTable) db.settingsTable = { lastResetMonth: '' };
if (!db.investments) db.investments = [];
if (!db.goals) db.goals = [];
if (!db.recurring) db.recurring = [];
if (!db.milestones) db.milestones = [];
if (!db.projectionNextMonth) db.projectionNextMonth = 0;
if (!db.categoryDetails) db.categoryDetails = {};
if (!db.currentMarketValues) db.currentMarketValues = {};
if (!db.allocTargets) db.allocTargets = {};
if (!db.accounts) db.accounts = ['Main Portfolio'];
if (!db.fireTargetMonthly) db.fireTargetMonthly = 0;
if (!db.templates) db.templates = [];
if (typeof db.privacyMode === 'undefined') db.privacyMode = false;
if (!db.theme) db.theme = 'indigo';
if (!db.geminiKey) db.geminiKey = '';
if (!db.groqKey) db.groqKey = '';
if (!db.appPin) db.appPin = '';
if (!db.chatHistory) db.chatHistory = [];
if (!db.chatSessions) db.chatSessions = [];
if (!db.lastBackupPrompt) db.lastBackupPrompt = '';
if (!db.navCache) db.navCache = {};
if (typeof db.fyStartMonth === 'undefined') db.fyStartMonth = 3; // Default: April (month index 3) for India FY
if (typeof db.firstTimeTipsShown === 'undefined') db.firstTimeTipsShown = false;

const defaultCategories = ['FD', 'PPF', 'PF', 'SIP', 'Liquid', 'Home', 'Cash', 'Stocks'];

if (!db.categories || Object.keys(db.categories).length === 0) {
    db.categories = {
        'FD': { icon: 'account_balance', color: '#006874', is80c: false },
        'PPF': { icon: 'savings', color: '#B3261E', is80c: true },
        'PF': { icon: 'account_balance_wallet', color: '#D96200', is80c: true },
        'SIP': { icon: 'trending_up', color: '#6750A4', is80c: false },
        'Liquid': { icon: 'water_drop', color: '#0288D1', is80c: false },
        'Home': { icon: 'real_estate_agent', color: '#388E3C', is80c: false },
        'Cash': { icon: 'payments', color: '#795548', is80c: false },
        'Stocks': { icon: 'candlestick_chart', color: '#186D33', is80c: false }
    };
}

const milestoneThresholds = [
    { val: 100000, label: '₹1 Lakh' }, { val: 500000, label: '₹5 Lakh' }, { val: 1000000, label: '₹10 Lakh' },
    { val: 5000000, label: '₹50 Lakh' }, { val: 10000000, label: '₹1 Crore' }
];

let editInvId = null, editGoalId = null, currentInvType = Object.keys(db.categories)[0] || 'Cash';
// Default field configurations for standard categories if not exists
const standardFieldConfigs = {
    'FD': { interest: true, payout: true, maturity: true, broker: true, subcat: true },
    'PPF': { interest: true, maturity: true, monthly: true, subcat: true },
    'PF': { interest: true, monthly: true, subcat: true },
    'SIP': { mf: true, sipday: true, monthly: true, broker: true, subcat: true },
    'Stocks': { mf: true, qty: true, broker: true, subcat: true },
    'Gold': { growth: true },
    'Real Estate': { growth: true },
    'Cash': { simple: true },
    'Liquid': { simple: true }
};
Object.keys(db.categories).forEach(cat => {
    if (!db.categoryDetails[cat]) db.categoryDetails[cat] = {};
    if (!db.categoryDetails[cat].fields && standardFieldConfigs[cat]) {
        db.categoryDetails[cat].fields = standardFieldConfigs[cat];
    }
});
let activeCategory = null, activeAccountFilter = 'All';
let currentTotalNW = 0, currentAvgMonthly = 0, currentTypeTotals = {};
let currentTax80c = 0;
let chartMonthsRange = 3;
let chartDataPoints = [];
let portfolioChartInstance = null, rollingChartInstance = null, categoryChartInstance = null;
let aiReportCharts = { pie: null, bar: null };

// Chart data cache to prevent unnecessary re-renders
let chartDataCache = {
    donut: { key: null, data: null, labels: null, colors: null },
    rolling: { key: null, data: null, labels: null },
    category: { key: null, data: null, labels: null, category: null }
};

// Debounce utility for chart updates
let chartRenderDebounce = {};
function debouncedChartRender(chartType, renderFn, delay = 100) {
    if (chartRenderDebounce[chartType]) clearTimeout(chartRenderDebounce[chartType]);
    chartRenderDebounce[chartType] = setTimeout(renderFn, delay);
}

// Loading state management
function setLoading(elementId, isLoading, message = '') {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    if (isLoading) {
        el.dataset.originalContent = el.innerHTML;
        el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:16px;color:var(--md-outline);">
            <span class="material-symbols-rounded" style="animation:spin 1s linear infinite;">progress_activity</span>
            ${message || 'Loading...'}
        </div>`;
        el.disabled = true;
    } else {
        if (el.dataset.originalContent) {
            el.innerHTML = el.dataset.originalContent;
            delete el.dataset.originalContent;
        }
        el.disabled = false;
    }
}

function setButtonLoading(buttonId, isLoading) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    
    if (isLoading) {
        btn.dataset.originalText = btn.innerHTML;
        btn.innerHTML = `<span class="material-symbols-rounded" style="animation:spin 1s linear infinite;font-size:18px;">progress_activity</span>`;
        btn.disabled = true;
        btn.style.opacity = '0.7';
    } else {
        if (btn.dataset.originalText) {
            btn.innerHTML = btn.dataset.originalText;
            delete btn.dataset.originalText;
        }
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

// Add CSS animation for spinner
const style = document.createElement('style');
style.textContent = `
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .loading-overlay {
        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(var(--md-surface-rgb, 255,255,255), 0.8);
        display: flex; align-items: center; justify-content: center;
        z-index: 100; border-radius: inherit;
    }
`;
document.head.appendChild(style);

// Generate cache key from relevant data
function generateChartCacheKey(type) {
    if (type === 'donut') {
        return `${activeAccountFilter}|${currentTotalNW}|${Object.entries(currentTypeTotals).sort().map(([k,v])=>k+':'+v.toFixed(0)).join(',')}|${db.privacyMode}`;
    } else if (type === 'rolling') {
        let now = new Date();
        let currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
        return `${activeAccountFilter}|${currentMonthKey}|${db.privacyMode}|${db.investments.length}`;
    } else if (type === 'category') {
        return `${activeCategory}|${db.investments.filter(i=>i.type===activeCategory).length}|${db.privacyMode}`;
    }
    return Date.now().toString();
}

Chart.defaults.font.family = "'Roboto', sans-serif";
Chart.defaults.color = "#767680";
Chart.defaults.plugins.tooltip.backgroundColor = "#1B1B1F";
Chart.defaults.plugins.tooltip.titleFont = { size: 13, weight: 'bold' };
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.callbacks.label = function (c) { return '₹' + Number(c.raw).toLocaleString('en-IN'); };
Chart.defaults.animation = { duration: 1500, easing: 'easeOutQuart' };

// ==========================================
// 2. GLOBAL HELPER FUNCTIONS
// ==========================================
function haptic(ms = 30) {
    if (!window.userInteracted) return;
    try {
        if (typeof navigator !== 'undefined' && navigator.vibrate && ms > 0) {
            navigator.vibrate(ms);
        }
    } catch (e) { }
}
document.addEventListener('mousedown', () => window.userInteracted = true, { once: true });
document.addEventListener('touchstart', () => window.userInteracted = true, { once: true });

// ── UNIQUE ID GENERATOR ────────────────────────
let _idCounter = 0;
function generateUniqueId() {
    const ts = Date.now();
    const counter = ++_idCounter % 10000;
    const random = Math.floor(Math.random() * 1000);
    return `${ts}${counter}${random}`;
}

// ── HISTORY & SESSION HELPERS ──────────────────
function pushSheetState(sheetId) {
    history.pushState({ sheetId: sheetId }, "");
}

function handlePopState(event) {
    const state = event.state;
    // Specifically target sub-sheets vs main sheets
    const activeSub = document.querySelector('.sheet.sub-sheet.active');
    const activeMain = document.querySelector('.sheet.active:not(.sub-sheet)');

    if (activeSub) {
        closeSubSheet(true);
    } else if (activeMain) {
        closeOverlays(true);
    } else if (state && state.tabId) {
        performTabSwitch(state.tabId, true);
    } else if (!state) {
        // If we hit a null state (e.g. back to start), ensure everything is closed
        closeOverlays(true);
    }
}

function getLocalYYYYMMDD(d) {
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
}

function parseDate(dateStr) {
    if (!dateStr) return new Date();
    const p = dateStr.split('-');
    if (p.length !== 3 || isNaN(p[0]) || isNaN(p[1]) || isNaN(p[2])) return new Date();
    const d = new Date(p[0], p[1] - 1, p[2]);
    return isNaN(d.getTime()) ? new Date() : d;
}

function formatInr(num) { return Number(num).toLocaleString('en-IN'); }
function formatMoney(num) { return db.privacyMode ? '••••••' : '₹' + formatInr(num); }

function showSnackbar(msg, icon = "info") {
    const sb = document.getElementById("snackbar");
    sb.innerHTML = `<span class="material-symbols-rounded" style="font-size:20px;">${icon}</span> ${msg}`;
    sb.classList.add("show");
    setTimeout(() => sb.classList.remove("show"), 3000);
}

function closeOverlays(fromPopState = false) {
    document.querySelectorAll('.scrim, .scrim-sub, .sheet').forEach(el => el.classList.remove('active'));
    editInvId = null; editGoalId = null;
    sessionStorage.removeItem('currentSheet');
    if (!fromPopState && history.state && history.state.sheetId) {
        history.back();
    }
}

// Sub-sheets open ON TOP of an existing sheet (e.g. calculators from Settings)
const SUB_SHEET_IDS = ['xirr-sheet', 'sip-calc-sheet', 'emi-calc-sheet', 'inflation-sheet', 'ai-predict-sheet', 'history-sync-sheet', 'webrtc-sync-sheet', 'chat-history-sheet', 'dividend-sheet', 'wealth-blueprint-sheet', 'ai-sheet', 'maturity-calendar-sheet', 'ai-chat-sheet', 'monthly-target-sheet', 'projection-sheet', 'month-sheet'];

function openSubSheet(sheetId) {
    if (!SUB_SHEET_IDS.includes(sheetId)) {
        SUB_SHEET_IDS.push(sheetId);
    }
    openSheet(sheetId);
}
window.openSubSheet = openSubSheet;

function openSheet(sheetId, fromRestore = false) {
    haptic(20);
    const isSubSheet = SUB_SHEET_IDS.includes(sheetId);
    if (isSubSheet) {
        // Clear previous sub-sheets to prevent stacking
        document.querySelectorAll('.sheet.sub-sheet').forEach(el => el.classList.remove('active'));
        document.getElementById('scrim-sub')?.classList.add('active');
        document.getElementById(sheetId)?.classList.add('active');
        activeSub = sheetId;
    } else {
        // If opening a main sheet, close EVERYTHING first (including sub-sheets)
        document.querySelectorAll('.scrim, .scrim-sub, .sheet').forEach(el => el.classList.remove('active'));
        document.getElementById('scrim')?.classList.add('active');
        document.getElementById(sheetId)?.classList.add('active');
        activeMain = sheetId;
        activeSub = null;
    }
    sessionStorage.setItem('currentSheet', sheetId);
    if (sheetId === 'history-sync-sheet') populateSyncDropdown();
    if (!fromRestore) pushSheetState(sheetId);
}

function closeSubSheet(fromPopState = false) {
    document.getElementById('scrim-sub').classList.remove('active');
    document.querySelectorAll('.sheet.sub-sheet').forEach(el => el.classList.remove('active'));
    activeSub = null;
    // Restore parent sheet in storage if any
    if (activeMain) sessionStorage.setItem('currentSheet', activeMain);
    else sessionStorage.removeItem('currentSheet');

    if (!fromPopState && history.state && history.state.sheetId) {
        history.back();
    }
}

// ── COPY NET WORTH ──────────────────────────────
function copyNetWorth() {
    const text = `Net Worth: ₹${formatInr(currentTotalNW)} (as of ${new Date().toLocaleDateString('en-IN')})`;
    navigator.clipboard.writeText(text).then(() => showSnackbar('Copied to clipboard', 'content_copy'));
}

// ── CSV EXPORT ──────────────────────────────────
function exportToCSV() {
    haptic(30);
    let rows = [['Date', 'Type', 'Amount', 'Account', 'Note', 'Tags', 'Dividend']];
    db.investments.sort((a, b) => parseDate(b.date) - parseDate(a.date)).forEach(inv => {
        rows.push([inv.date, inv.type, inv.amount, inv.account || '', inv.note || '', inv.tags || '', inv.isDividend ? 'Yes' : 'No']);
    });
    let csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    let blob = new Blob([csv], { type: 'text/csv' });
    let a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `InvestPro_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showSnackbar('CSV exported!', 'download');
}

// ── LEDGER SORT & FILTER ────────────────────────
window.ledgerSort = 'date'; window.ledgerAsc = false;
function setLedgerSort(field, btn) {
    window.ledgerSort = field;
    document.querySelectorAll('.sort-chip[id^="sort-"]').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    if (window.renderHistory) renderHistory();
}
function toggleLedgerOrder(btn) {
    window.ledgerAsc = !window.ledgerAsc;
    document.getElementById('sort-order-icon').textContent = window.ledgerAsc ? 'arrow_upward' : 'arrow_downward';
    if (window.renderHistory) renderHistory();
}
function clearLedgerDates() {
    document.getElementById('ledger-date-from').value = '';
    document.getElementById('ledger-date-to').value = '';
    renderHistory();
}

// ── RECURRING SIP MANAGER ───────────────────────
function renderRecurringSheet() {
    let total = db.recurring.reduce((s, r) => s + r.amount, 0);
    let totalEl = document.getElementById('recurring-total-val');
    if (totalEl) totalEl.textContent = formatMoney(total);
    let list = document.getElementById('recurring-list');
    if (!list) return;
    if (db.recurring.length === 0) {
        // Use context-aware empty state or fallback to local implementation
        if (typeof getEmptyStateHTML === 'function') {
            list.innerHTML = getEmptyStateHTML('recurring');
        } else {
            list.innerHTML = `<div class="empty-state-premium" style="padding:40px 24px; text-align:center;">
                <span class="material-symbols-rounded" style="font-size:48px; color:var(--md-outline); margin-bottom:16px;">autorenew</span>
                <div style="font-size:18px; font-weight:600; margin-bottom:8px;">No Recurring SIPs</div>
                <div style="font-size:14px; color:var(--md-on-surface-variant); margin-bottom:24px;">Set up automatic monthly investments to build wealth consistently</div>
                <button class="btn-primary" style="display:inline-flex; align-items:center; gap:8px;" onclick="openRecurringSheet(); setTimeout(()=>{document.getElementById('inv-is-monthly').checked=true;}, 200)">
                    <span class="material-symbols-rounded">schedule</span> Add SIP
                </button>
            </div>`;
        }
        return;
    }
    list.innerHTML = db.recurring.map((r, idx) => {
        let meta = db.categories[r.type] || { color: '#8D6E63', icon: 'savings' };
        let next = new Date(r.nextRun).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        return `<div class="sip-item">
                    <div class="sip-item-icon" style="background:${meta.color};"><span class="material-symbols-rounded" style="font-size:18px;">${meta.icon}</span></div>
                    <div class="sip-item-info">
                        <div class="sip-item-name">${r.note || r.type}</div>
                        <div class="sip-item-meta">${r.type} · Next: ${next} · ${r.account || 'Default'}</div>
                    </div>
                    <div class="sip-item-amt">${formatMoney(r.amount)}</div>
                    <button class="icon-btn" onclick="deleteRecurring(${idx})" style="width:36px;height:36px;color:var(--md-error);"><span class="material-symbols-rounded" style="font-size:18px;">delete</span></button>
                </div>`;
    }).join('');
}

function openRecurringSheet() {
    haptic(30);
    renderRecurringSheet();
    openSheet('recurring-sheet');
}
window.openRecurringSheet = openRecurringSheet;
function deleteRecurring(idx) {
    haptic(30);
    Swal.fire({ title: 'Delete SIP?', text: `Remove "${db.recurring[idx].note || db.recurring[idx].type}"?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete', customClass: { popup: 'swal2-popup', confirmButton: 'swal2-confirm', cancelButton: 'swal2-cancel' } }).then(r => {
        if (r.isConfirmed) { db.recurring.splice(idx, 1); saveData(); renderRecurringSheet(); showSnackbar('SIP removed', 'check_circle'); }
    });
}

// ── STAT CHIPS UPDATE ───────────────────────────
function updateStatChips(totalInvested, totalMarketValue, yearTotal, thisMonthTotal) {
    let sal = db.userProfile.salary || 0;
    let pnl = totalMarketValue - totalInvested;
    let roi = totalInvested > 0 ? ((pnl / totalInvested) * 100) : 0;

    // Savings rate: use this month's total if it's the current performance we are tracking
    let savRate = sal > 0 ? Math.round((thisMonthTotal / (sal / 12)) * 100) : 0;

    // Best month
    let monthMap = {};
    db.investments.filter(i => !i.isDividend).forEach(i => {
        let k = i.date.substring(0, 7);
        monthMap[k] = (monthMap[k] || 0) + i.amount;
    });
    let bestMonth = '—'; let bestAmt = 0;
    Object.entries(monthMap).forEach(([k, v]) => { if (v > bestAmt) { bestAmt = v; bestMonth = k; } });
    if (bestMonth !== '—') { let d = parseDate(bestMonth + '-01'); bestMonth = d.toLocaleString('default', { month: 'short', year: '2-digit' }); }

    // Investment streak (consecutive months)
    let now = new Date(); let streak = 0;
    let startOffset = 0;
    let currentK = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (!(monthMap[currentK] > 0)) {
        startOffset = 1;
    }
    for (let i = startOffset; i < 24 + startOffset; i++) {
        let m = now.getMonth() - i; let y = now.getFullYear();
        while (m < 0) { m += 12; y--; }
        let k = `${y}-${String(m + 1).padStart(2, '0')}`;
        if (monthMap[k] > 0) streak++; else break;
    }

    let invested = document.getElementById('sc-invested'); if (invested) invested.textContent = formatMoney(totalInvested);
    let pnlEl = document.getElementById('sc-pnl'); if (pnlEl) { pnlEl.textContent = (pnl >= 0 ? '+' : '') + formatMoney(pnl); pnlEl.style.color = pnl >= 0 ? '#00c853' : '#ff5252'; }
    let srEl = document.getElementById('sc-savings-rate'); if (srEl) { srEl.textContent = savRate + '%'; srEl.style.color = savRate >= 20 ? '#00c853' : savRate >= 10 ? 'var(--md-on-surface)' : '#ff5252'; }
    let bmEl = document.getElementById('sc-best-month'); if (bmEl) bmEl.textContent = bestMonth;
    let stEl = document.getElementById('sc-streak'); if (stEl) stEl.textContent = streak + ' mo';

    // Hero ROI badge
    let badge = document.getElementById('hero-roi-badge');
    if (badge) {
        let sign = roi >= 0 ? '+' : '';
        badge.textContent = `${sign}${roi.toFixed(1)}% ROI`;
        badge.className = `badge-pill ${roi >= 0 ? 'badge-positive' : 'badge-negative'}`;
    }
}

// ── KEYBOARD SHORTCUTS ──────────────────────────
document.addEventListener('keydown', e => {
    // Allow ? to show shortcuts help from anywhere
    if (e.key === '?' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        showShortcutsHelp();
        return;
    }
    
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openInvestSheet(); }
    if (e.key === 'Escape') { e.preventDefault(); closeOverlays(); closeSubSheet(); }
    if (e.key === '1') { e.preventDefault(); switchTab('dashboard'); }
    if (e.key === '2') { e.preventDefault(); switchTab('portfolio'); }
    if (e.key === '3') { e.preventDefault(); switchTab('ledger'); }
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePrivacy(); }
    if (e.key === 's' || e.key === 'S') { e.preventDefault(); openSettings(); }
    if (e.key === 'g' || e.key === 'G') { e.preventDefault(); if (db.goals.length > 0) openGoalSheet(db.goals[0].id); }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); renderAll(); showSnackbar('Refreshed', 'refresh'); }
    if (e.key === 'a' || e.key === 'A') { e.preventDefault(); toggleAIBubble(); }
});

function showShortcutsHelp() {
    const shortcuts = [
        { key: 'N', action: 'New Investment' },
        { key: 'A', action: 'AI Chat' },
        { key: '1', action: 'Dashboard Tab' },
        { key: '2', action: 'Portfolio Tab' },
        { key: '3', action: 'Ledger Tab' },
        { key: 'P', action: 'Toggle Privacy' },
        { key: 'S', action: 'Settings' },
        { key: 'G', action: 'Edit First Goal' },
        { key: 'R', action: 'Refresh Data' },
        { key: 'Esc', action: 'Close/Go Back' },
        { key: '?', action: 'Show This Help' }
    ];
    
    let html = `<div style="display:grid; grid-template-columns: auto 1fr; gap: 12px 24px; max-width: 300px;">`;
    shortcuts.forEach(s => {
        html += `<div style="font-family: monospace; background: var(--md-surface-container-highest); padding: 4px 12px; border-radius: 6px; text-align: center; font-weight: 600;">${s.key}</div>
                  <div style="padding: 4px 0;">${s.action}</div>`;
    });
    html += `</div>
    <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--md-outline-variant); font-size: 12px; color: var(--md-outline); text-align: center;">
        Press any key to close
    </div>`;
    
    Swal.fire({
        title: 'Keyboard Shortcuts',
        html: html,
        showConfirmButton: false,
        showCloseButton: true,
        width: 'auto',
        customClass: { popup: 'shortcuts-popup' }
    });
    
    // Close on any key press
    const closeOnKey = () => {
        Swal.close();
        document.removeEventListener('keydown', closeOnKey);
    };
    setTimeout(() => document.addEventListener('keydown', closeOnKey), 100);
}
window.showShortcutsHelp = showShortcutsHelp;

// First-time user tips system
function showFirstTimeTips() {
    if (db.firstTimeTipsShown) return;
    
    const tips = [
        {
            title: 'Welcome to TrackInvest! 👋',
            text: 'TrackInvest helps you build wealth by tracking investments across multiple categories.',
            icon: 'account_balance'
        },
        {
            title: 'Quick Start',
            text: 'Press <kbd style="background:var(--md-primary);color:var(--md-on-primary);padding:2px 8px;border-radius:4px;">N</kbd> anytime to quickly add an investment.',
            icon: 'bolt'
        },
        {
            title: 'Categories',
            text: 'Organize investments by type: SIP, FD, PPF, Stocks, and more. Each category can have its own settings.',
            icon: 'category'
        },
        {
            title: 'Keyboard Shortcuts',
            text: 'Press <kbd style="background:var(--md-primary);color:var(--md-on-primary);padding:2px 8px;border-radius:4px;">?</kbd> anytime to see all keyboard shortcuts.',
            icon: 'keyboard'
        }
    ];
    
    let currentTip = 0;
    
    function showTip(index) {
        if (index >= tips.length) {
            db.firstTimeTipsShown = true;
            saveData();
            return;
        }
        
        const tip = tips[index];
        Swal.fire({
            title: tip.title,
            html: `<div style="display:flex; flex-direction:column; align-items:center; gap:16px; padding:8px;">
                <span class="material-symbols-rounded" style="font-size:48px; color:var(--md-primary);">${tip.icon}</span>
                <div style="font-size:15px; line-height:1.5;">${tip.text}</div>
                <div style="font-size:12px; color:var(--md-outline);">Tip ${index + 1} of ${tips.length}</div>
            </div>`,
            showConfirmButton: true,
            showCancelButton: index > 0,
            confirmButtonText: index < tips.length - 1 ? 'Next' : 'Get Started',
            cancelButtonText: 'Previous',
            allowOutsideClick: false,
            customClass: { popup: 'tip-popup' }
        }).then((result) => {
            if (result.isConfirmed) {
                showTip(index + 1);
            } else if (result.dismiss === Swal.DismissReason.cancel) {
                showTip(index - 1);
            }
        });
    }
    
    showTip(0);
}
window.showFirstTimeTips = showFirstTimeTips;

function saveData() {
    db.lastUpdated = Date.now();
    try { localStorage.setItem('appHubInvestDb', JSON.stringify(db)); }
    catch (e) { showSnackbar("Storage Full! Please backup and clean data.", "warning"); }
}

function isCurrentFY(dateStr) {
    let d = new Date(dateStr); let now = new Date(); let curYear = now.getFullYear(); let curMonth = now.getMonth();
    let fyStartMonth = db.fyStartMonth !== undefined ? db.fyStartMonth : 3; // Default April
    let fyEndMonth = (fyStartMonth + 11) % 12; // FY ends 11 months after start
    let fyStartYear = curMonth >= fyStartMonth ? curYear : curYear - 1;
    let fyStart = new Date(fyStartYear, fyStartMonth, 1);
    // FY ends in the month before the start month of the next FY
    // If FY starts in April (3), it ends in March (2) of next year
    // If FY starts in January (0), it ends in December (11) of same year
    let fyEndYear = fyEndMonth < fyStartMonth ? fyStartYear + 1 : fyStartYear;
    let fyEnd = new Date(fyEndYear, fyEndMonth + 1, 0, 23, 59, 59); // Last day of end month
    return d >= fyStart && d <= fyEnd;
}

// App Lock functions managed in Section 9

function savePin() {
    let p = document.getElementById('settings-pin').value;
    if (p.length === 4) { db.appPin = p; saveData(); showSnackbar("App Lock Enabled", "lock"); }
    else if (p.length === 0) { db.appPin = ''; saveData(); showSnackbar("App Lock Disabled", "lock_open"); }
    else { showSnackbar("PIN must be 4 digits", "error"); }
}

function switchTab(tabId) {
    haptic(20);
    if (!document.startViewTransition) {
        performTabSwitch(tabId);
        return;
    }
    document.startViewTransition(() => performTabSwitch(tabId));
}

function performTabSwitch(tabId, fromPopState = false) {
    const currentTab = document.querySelector('.tab-content.active')?.id?.replace('tab-', '');
    if (currentTab === tabId) return;

    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    const targetTab = document.getElementById('tab-' + tabId);
    if (targetTab) targetTab.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const targetNav = document.getElementById('nav-' + tabId);
    if (targetNav) targetNav.classList.add('active');

    window.scrollTo(0, 0);
    sessionStorage.setItem('activeTab', tabId);

    if (!fromPopState) {
        history.pushState({ tabId: tabId }, "");
    }

    if (tabId === 'portfolio') renderDonutChart(currentTypeTotals, currentTotalNW);
    if (tabId === 'dashboard') renderRollingChart();
}

function togglePrivacy() {
    haptic(40); db.privacyMode = !db.privacyMode; saveData();
    document.getElementById('privacy-icon').innerText = db.privacyMode ? 'visibility_off' : 'visibility'; renderAll();
}

function setTheme(themeName) {
    haptic(40); db.theme = themeName; saveData(); document.body.className = '';
    if (themeName !== 'indigo') document.body.classList.add('theme-' + themeName);
    document.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('active'));
    let activeSwatch = document.querySelector('.ts-' + themeName);
    if (activeSwatch) activeSwatch.classList.add('active');
    renderAll();
}

function setChartRange(months, el) {
    haptic(20);
    document.querySelectorAll('.chart-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    chartMonthsRange = months;
    renderNWChart();
}

function updateProjectionSlider() {
    let slider = document.getElementById('proj-slider'); if (!slider) return;
    let months = parseInt(slider.value) || 12; document.getElementById('proj-month-label').innerText = months;
    let projected = currentTotalNW + (currentAvgMonthly * months); document.getElementById('projected-eoy').innerText = formatMoney(projected);
}

window.fireMilestoneConfetti = function () {
    haptic([50, 100, 50, 100]);
    if (typeof confetti !== 'undefined') {
        confetti({ zIndex: 99999, particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#4559A4', '#186D33', '#BF360C', '#FFD700'] });
    }
};

function getThemeColor() {
    const root = getComputedStyle(document.body);
    return root.getPropertyValue('--md-primary').trim() || '#4559A4';
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function checkMilestones(nw) {
    let unlocked = false;
    milestoneThresholds.forEach(t => {
        if (nw >= t.val && !db.milestones.includes(t.val)) { db.milestones.push(t.val); unlocked = true; showSnackbar(`Milestone Unlocked: ${t.label}! 🎉`, "workspace_premium"); }
    });
    if (unlocked) { saveData(); window.fireMilestoneConfetti(); }
}

window.openMonthlyTargetSheet = function () {
    haptic(30);
    openSubSheet('monthly-target-sheet');
};

window.saveMonthlyTarget = function () {
    // Redundant monthlyTargetRef removed
    saveData(); closeOverlays(); renderAll(); showSnackbar("Monthly Target Saved");
};

window.openProjectionSheet = function () {
    haptic(30);
    document.getElementById('proj-amt').value = db.projectionNextMonth || 0;
    openSubSheet('projection-sheet');
};

window.saveProjection = function () {
    haptic(40);
    db.projectionNextMonth = parseFloat(document.getElementById('proj-amt').value) || 0;
    saveData(); closeOverlays(); renderAll(); showSnackbar("Target Updated");
};

function initUI() {
    // Initialize base history state if missing
    const savedTab = sessionStorage.getItem('activeTab') || 'dashboard';
    if (!history.state) {
        history.replaceState({ tabId: savedTab }, "");
    }
    document.getElementById('privacy-icon').innerText = db.privacyMode ? 'visibility_off' : 'visibility';
    setTheme(db.theme || 'indigo');

    let sel = document.getElementById('account-filter'); sel.innerHTML = `<option value="All">All Accounts</option>`;
    db.accounts.forEach(a => sel.innerHTML += `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`);

    let formSel = document.getElementById('inv-account'); formSel.innerHTML = "";
    db.accounts.forEach(a => formSel.innerHTML += `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`);

    let chips = document.getElementById('type-chips'); chips.innerHTML = "";
    let filterType = document.getElementById('ledger-filter-type'); if (filterType) filterType.innerHTML = `<option value="All">All Assets</option>`;
    Object.keys(db.categories).forEach(c => {
        let safeC = escapeHtml(c);
        chips.innerHTML += `<div class="quick-chip" onclick="setInvestType('${safeC}')">${safeC}</div>`;
        if (filterType) filterType.innerHTML += `<option value="${safeC}">${safeC}</option>`;
    });
    currentInvType = Object.keys(db.categories)[0];

    let gl = document.getElementById('goal-link'); gl.innerHTML = `<option value="">None (Manual Tracking)</option>`;
    Object.keys(db.categories).forEach(c => { gl.innerHTML += `<option value="${escapeHtml(c)}">Link to ${escapeHtml(c)}</option>`; });
    document.getElementById('xirr-category').innerHTML = Object.keys(db.categories).map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

    initChartInteractivity();

    // Restore active tab and sheet
    if (savedTab) performTabSwitch(savedTab, true);

    const savedSheet = sessionStorage.getItem('currentSheet');
    if (savedSheet) {
        // Delay slightly to ensure DOM is ready and charts rendered
        setTimeout(() => {
            if (sessionStorage.getItem('appUnlocked') === 'true' || !db.appPin) {
                openSheet(savedSheet, true);
            }
        }, 100);
    }
}

// getThemeColor defined above (removed duplicate)

// --- Mobile Swipe to Close Sheets ---
let touchStartY = 0;
document.addEventListener('touchstart', e => {
    touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchmove', e => {
    const touchY = e.touches[0].clientY;
    const diff = touchY - touchStartY;
    const activeSheet = document.querySelector('.sheet.active');

    if (activeSheet && diff > 100 && activeSheet.scrollTop <= 0) {
        // Drag down to close
        if (activeSheet.classList.contains('sub-sheet')) {
            closeSubSheet();
        } else {
            closeOverlays();
        }
    }
}, { passive: true });

// --- Scroll to Top Button ---
let scrollToTopBtn = null;

function initScrollToTop() {
    scrollToTopBtn = document.createElement('button');
    scrollToTopBtn.id = 'scroll-to-top';
    scrollToTopBtn.innerHTML = '<span class="material-symbols-rounded">arrow_upward</span>';
    scrollToTopBtn.style.cssText = `
        position: fixed; bottom: 80px; right: 16px;
        width: 48px; height: 48px; border-radius: 50%;
        background: var(--md-primary); color: var(--md-on-primary);
        border: none; cursor: pointer; z-index: 1000;
        display: none; align-items: center; justify-content: center;
        box-shadow: var(--md-elevation-2);
        transition: transform 0.2s, opacity 0.2s;
    `;
    scrollToTopBtn.onclick = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (document.querySelector('.sheet.active')) {
            document.querySelector('.sheet.active').scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
    document.body.appendChild(scrollToTopBtn);
    
    // Show/hide based on scroll
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const showBtn = window.scrollY > 300 || 
                (document.querySelector('.sheet.active')?.scrollTop > 300);
            scrollToTopBtn.style.display = showBtn ? 'flex' : 'none';
            scrollToTopBtn.style.opacity = showBtn ? '1' : '0';
        }, 100);
    }, { passive: true });
}

// Initialize after DOM load
document.addEventListener('DOMContentLoaded', initScrollToTop, { once: true });

// ==========================================
// 3. STRICT CALCULATORS & VALUATION ENGINE
// ==========================================
function calculateStrictTax(tax80c = null) {
    let sal = parseFloat(db.userProfile.salary) || 0;
    // Validate salary is non-negative
    if (sal < 0) sal = 0;
    if (sal === 0) return { liability: 0, str: "Setup Income in Settings" };

    let regime = db.userProfile.regime || 'new';
    let tax = 0;

    // Use passed tax80c, fallback to global currentTax80c, then 0
    let deduction80c = tax80c !== null ? tax80c : (typeof currentTax80c !== 'undefined' ? currentTax80c : 0);

    if (regime === 'new') {
        // New Regime 2024-25 (with 75k std deduction)
        let taxable = Math.max(0, sal - 75000);
        if (taxable <= 1200000) return { liability: 0, str: "Tax Free (Rebate Limit)" };

        if (taxable > 300000) tax += Math.min(taxable - 300000, 400000) * 0.05; // 3-7L
        if (taxable > 700000) tax += Math.min(taxable - 700000, 300000) * 0.10; // 7-10L
        if (taxable > 1000000) tax += Math.min(taxable - 1000000, 200000) * 0.15; // 10-12L
        if (taxable > 1200000) tax += Math.min(taxable - 1200000, 300000) * 0.20; // 12-15L
        if (taxable > 1500000) tax += (taxable - 1500000) * 0.30; // >15L
    } else {
        // Old Regime
        let taxable = Math.max(0, sal - 50000 - Math.min(deduction80c, 150000));
        if (taxable <= 500000) return { liability: 0, str: "Tax Free (Rebate 87A)" };

        if (taxable > 250000) tax += Math.min(taxable - 250000, 250000) * 0.05; // 2.5-5L
        if (taxable > 500000) tax += Math.min(taxable - 500000, 500000) * 0.20; // 5-10L
        if (taxable > 1000000) tax += (taxable - 1000000) * 0.30; // >10L
    }

    tax = tax * 1.04; // 4% Health & Education Cess
    return { liability: tax, str: `₹${formatInr(tax)}` };
}

function calculateStrictValuation(type, totalInvested, rawInvs) {
    const govRates = { 'PPF': 7.1, 'PF': 8.15 };
    const defaultRate = db.categoryDetails[type]?.interestRate || govRates[type] || 0;
    let interestEarned = 0;

    // Helper to get virtual investments including initial balance
    const getEffectiveInvs = () => {
        let invs = rawInvs.filter(i => !i.isDividend);
        let initialBal = db.categoryDetails[type]?.initialBal || 0;
        if (initialBal > 0) {
            // Use a date BEFORE the earliest investment so initial balance accrues interest from the start
            let earliest = invs.reduce((min, i) => i.date < min ? i.date : min, invs[0]?.date || '2023-01-01');
            let earlyDate = new Date(earliest);
            earlyDate.setDate(earlyDate.getDate() - 1);
            let earlyStr = earlyDate.getFullYear() + '-' + String(earlyDate.getMonth() + 1).padStart(2, '0') + '-' + String(earlyDate.getDate()).padStart(2, '0');
            invs.push({ date: earlyStr, amount: initialBal, note: 'Initial Balance' });
        }
        return invs;
    };

    if (type === 'FD') {
        let val = 0;
        getEffectiveInvs().forEach(inv => {
            let rate = inv.interestRate || defaultRate;
            let payout = inv.payoutType || 'quarterly';
            let years = Math.max(0, (new Date() - parseDate(inv.date)) / (1000 * 60 * 60 * 24 * 365.25));
            let principal = inv.amount;
            let futureVal = principal;

            if (payout === 'quarterly') {
                futureVal = principal * Math.pow(1 + (rate / 100) / 4, 4 * years);
            } else if (payout === 'monthly') {
                futureVal = principal * Math.pow(1 + (rate / 100) / 12, 12 * years);
            } else {
                futureVal = principal * (1 + (rate / 100) * years);
            }
            val += futureVal;
            interestEarned += (futureVal - principal);
        });
        return { total: val, interest: interestEarned };
    }

    if (type === 'PF' || type === 'PPF') {
        let val = 0;
        getEffectiveInvs().forEach(inv => {
            // PPF/PF: Interest calculated monthly, credited annually
            // Using monthly compounding for accurate valuation
            let years = Math.max(0, (new Date() - parseDate(inv.date)) / (1000 * 60 * 60 * 24 * 365.25));
            let monthlyRate = (defaultRate / 100) / 12;
            let months = years * 12;
            let futureVal = inv.amount * Math.pow(1 + monthlyRate, months);
            val += futureVal;
            interestEarned += (futureVal - inv.amount);
        });
        return { total: val, interest: interestEarned };
    }

    if ((type === 'SIP' || type === 'Stocks') && db.navCache) {
        let val = 0; let hasUnits = false; let staleNavCount = 0;
        const oneDayMs = 24 * 60 * 60 * 1000;
        const today = new Date();
        rawInvs.forEach(inv => {
            if (!inv.isDividend && inv.units && inv.mfCode && db.navCache[inv.mfCode]) {
                let navData = db.navCache[inv.mfCode];
                // Check if NAV is stale (> 1 day old)
                let navDate = navData.lastFetched ? new Date(navData.lastFetched) : new Date(navData.date);
                let isStale = (today - navDate) > oneDayMs;
                if (isStale) staleNavCount++;

                let currentVal = inv.units * navData.nav;
                val += currentVal;
                interestEarned += (currentVal - inv.amount);
                hasUnits = true;
            } else if (!inv.isDividend) {
                val += inv.amount;
            }
        });
        // Add initial balance to value if units are not being used for it
        val += (db.categoryDetails[type]?.initialBal || 0);
        // Warn about stale NAV data
        if (staleNavCount > 0 && !window.navStaleWarningShown) {
            window.navStaleWarningShown = true;
            setTimeout(() => { window.navStaleWarningShown = false; }, 60000); // Reset after 1 minute
            showSnackbar(`${staleNavCount} NAV values may be outdated. Refresh for latest.`, 'warning');
        }
        return { total: val, interest: interestEarned };
    }

    let customRate = db.categoryDetails[type]?.interestRate || 0;
    if (customRate > 0) {
        let val = 0;
        getEffectiveInvs().forEach(inv => {
            let rate = inv.interestRate || customRate;
            let years = Math.max(0, (new Date() - parseDate(inv.date)) / (1000 * 60 * 60 * 24 * 365.25));
            let futureVal = inv.amount * Math.pow(1 + (rate / 100) / 12, 12 * years);
            val += futureVal;
            interestEarned += (futureVal - inv.amount);
        });
        return { total: val, interest: interestEarned };
    }

    return { total: totalInvested, interest: 0 };
}

// ==========================================
// 4. CHARTS AND VISUALIZATIONS
// ==========================================
function initChartInteractivity() {
    let container = document.getElementById('nw-chart-container');
    let tooltip = document.getElementById('chart-tooltip');
    let point = document.getElementById('chart-point');
    if (!container) return;

    function handleMove(e) {
        if (chartDataPoints.length === 0 || db.privacyMode) return;
        let rect = container.getBoundingClientRect();
        let clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let x = clientX - rect.left;
        let perc = Math.max(0, Math.min(100, (x / rect.width) * 100));

        let closest = chartDataPoints[0];
        let minDiff = Infinity;
        chartDataPoints.forEach(p => {
            let diff = Math.abs(p.x - perc);
            if (diff < minDiff) { minDiff = diff; closest = p; }
        });

        tooltip.innerText = closest.label + ": " + formatMoney(closest.val);
        tooltip.style.display = 'block';
        tooltip.style.left = closest.x + '%';

        point.style.display = 'block';
        point.style.left = closest.x + '%';
        point.style.top = closest.y + 'px';

        if (container.dataset.lastIdx != closest.idx) { haptic(10); container.dataset.lastIdx = closest.idx; }
    }
    container.addEventListener('touchstart', handleMove, { passive: true });
    container.addEventListener('touchmove', handleMove, { passive: true });
    container.addEventListener('touchend', () => { tooltip.style.display = 'none'; point.style.display = 'none'; });
}

function getBezierPath(points) {
    if (points.length === 0) return "";
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        let xMid = (points[i].x + points[i + 1].x) / 2;
        path += ` C ${xMid} ${points[i].y}, ${xMid} ${points[i + 1].y}, ${points[i + 1].x} ${points[i + 1].y}`;
    }
    return path;
}

function renderNWChart() {
    try {
        let now = new Date(); chartDataPoints = []; let maxVal = 0; let minVal = Infinity;
        let currentTempNW = currentTotalNW; let monthsToIterate = chartMonthsRange === 99 ? 24 : chartMonthsRange;
        let monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        let chartLine = document.getElementById('chart-line-path');
        let chartFill = document.getElementById('chart-fill-path');
        if (!chartLine || !chartFill) return;

        chartLine.classList.remove('chart-animate'); void chartLine.offsetWidth; chartLine.classList.add('chart-animate');

        for (let i = 0; i < monthsToIterate; i++) {
            let m = now.getMonth() - i; let y = now.getFullYear();
            while (m < 0) { m += 12; y -= 1; }

            let monthInv = db.investments.filter(inv => {
                let d = new Date(inv.date);
                return d.getMonth() === m && d.getFullYear() === y && (activeAccountFilter === 'All' || inv.account === activeAccountFilter);
            }).reduce((sum, inv) => sum + inv.amount, 0);

            chartDataPoints.unshift({ val: currentTempNW, label: `${monthNames[m]} ${y}`, idx: i });
            if (currentTempNW > maxVal) maxVal = currentTempNW;
            if (currentTempNW < minVal) minVal = currentTempNW;
            currentTempNW -= monthInv;
        }

        let width = 100; let height = 40; if (maxVal === minVal) maxVal += 1;
        chartDataPoints.forEach((p, idx) => {
            let divisor = Math.max(1, monthsToIterate - 1);
            p.x = (idx / divisor) * width;
            p.y = height - (((p.val - minVal) / (maxVal - minVal)) * (height - 5)) - 5;
        });

        let bezierPath = getBezierPath(chartDataPoints);
        let fillPath = `${bezierPath} L100 ${height} L0 ${height} Z`;
        chartFill.setAttribute('d', fillPath); chartLine.setAttribute('d', bezierPath);
    } catch (e) { }
}

function renderDonutChart(typeTotals, totalMarketValue) {
    let canvas = document.getElementById('portfolioChart');
    if (!canvas) return;

    let ctx = canvas.getContext('2d');
    let labels = []; let data = []; let bgColors = [];

    Object.keys(typeTotals).forEach(t => {
        let value = db.currentMarketValues[t] && db.currentMarketValues[t] > 0 ? db.currentMarketValues[t] : typeTotals[t];
        if (value > 0) { labels.push(t); data.push(value); bgColors.push(db.categories[t]?.color || '#ccc'); }
    });

    if (labels.length === 0) { labels = ["Empty"]; data = [1]; bgColors = ["var(--md-surface-container-highest)"]; }
    const displayData = db.privacyMode ? data.map(() => 1) : data;

    // Check if we can reuse the existing chart
    let cacheKey = generateChartCacheKey('donut');
    let canUpdate = portfolioChartInstance && 
                    chartDataCache.donut.key === cacheKey &&
                    portfolioChartInstance.data.labels.length === labels.length;

    if (canUpdate) {
        // Smooth update existing chart data
        portfolioChartInstance.data.datasets[0].data = displayData;
        portfolioChartInstance.update('none'); // 'none' mode for smooth transition
    } else {
        // Create new chart only when necessary
        if (portfolioChartInstance) portfolioChartInstance.destroy();
        portfolioChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: labels, datasets: [{ data: displayData, backgroundColor: bgColors, borderWidth: 0, hoverOffset: 6 }] },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                cutout: '75%', 
                animation: { duration: 800 },
                plugins: { 
                    legend: { display: false }, 
                    tooltip: { callbacks: { label: function (c) { return db.privacyMode ? '••••••' : '₹' + Number(c.raw).toLocaleString('en-IN'); } } } 
                } 
            }
        });
        // Update cache
        chartDataCache.donut = { key: cacheKey, data: displayData, labels: labels, colors: bgColors };
    }
    
    document.getElementById('donut-val').innerText = formatMoney(totalMarketValue);
}

function renderRollingChart() {
    let canvas = document.getElementById('rollingChart');
    if (!canvas) return;

    let ctx = canvas.getContext('2d');
    let now = new Date(); let chartLabels = []; let chartData = [];
    for (let i = 11; i >= 0; i--) {
        let m = now.getMonth() - i; let y = now.getFullYear(); while (m < 0) { m += 12; y -= 1; }
        let monthInv = db.investments.filter(inv => { let d = new Date(inv.date); return d.getMonth() === m && d.getFullYear() === y && (activeAccountFilter === 'All' || inv.account === activeAccountFilter) && !inv.isDividend; }).reduce((sum, inv) => sum + inv.amount, 0);
        chartLabels.push(`${new Date(y, m).toLocaleString('default', { month: 'short' })} ${y}`); chartData.push(monthInv);
    }

    const displayData = db.privacyMode ? chartData.map(() => 1) : chartData;
    
    // Check cache
    let cacheKey = generateChartCacheKey('rolling');
    let canUpdate = rollingChartInstance && chartDataCache.rolling.key === cacheKey;

    if (canUpdate) {
        // Update existing chart
        rollingChartInstance.data.datasets[0].data = displayData;
        rollingChartInstance.options.scales.y.display = !db.privacyMode;
        rollingChartInstance.update('none');
    } else {
        // Create new chart
        if (rollingChartInstance) rollingChartInstance.destroy();
        rollingChartInstance = new Chart(ctx, {
            type: 'bar',
            data: { labels: chartLabels, datasets: [{ label: 'Monthly Investment', data: displayData, backgroundColor: getThemeColor() + '80', borderRadius: 8 }] },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                animation: { duration: 600 },
                plugins: { 
                    legend: { display: false }, 
                    tooltip: { callbacks: { label: function (c) { return db.privacyMode ? '••••••' : '₹' + Number(c.raw).toLocaleString('en-IN'); } } } 
                }, 
                scales: { x: { display: true, ticks: { font: { size: 10 }, maxRotation: 90 } }, y: { display: !db.privacyMode, ticks: { callback: (v) => formatMoney(v) } } } 
            }
        });
        chartDataCache.rolling = { key: cacheKey, data: displayData, labels: chartLabels };
    }
}

function renderCategoryChart(category) {
    let canvas = document.getElementById('categoryHistoryChart');
    if (!canvas) return;
    let ctx = canvas.getContext('2d');

    let now = new Date(); let chartLabels = []; let chartData = [];
    for (let i = 5; i >= 0; i--) {
        let m = now.getMonth() - i; let y = now.getFullYear(); while (m < 0) { m += 12; y -= 1; }
        let monthInv = db.investments.filter(inv => { let d = new Date(inv.date); return inv.type === category && d.getMonth() === m && d.getFullYear() === y && !inv.isDividend; }).reduce((sum, inv) => sum + inv.amount, 0);
        chartLabels.push(`${new Date(y, m).toLocaleString('default', { month: 'short' })}`); chartData.push(monthInv);
    }

    const displayData = db.privacyMode ? chartData.map(() => 1) : chartData;
    let color = db.categories[category]?.color || getThemeColor();
    
    // Check cache
    let cacheKey = generateChartCacheKey('category');
    let canUpdate = categoryChartInstance && 
                    chartDataCache.category.key === cacheKey &&
                    chartDataCache.category.category === category;

    if (canUpdate) {
        // Smooth update
        categoryChartInstance.data.datasets[0].data = displayData;
        categoryChartInstance.update('none');
    } else {
        // Create new chart
        if (categoryChartInstance) categoryChartInstance.destroy();
        categoryChartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels: chartLabels, datasets: [{ label: category, data: displayData, borderColor: color, backgroundColor: color + '33', fill: true, tension: 0.4 }] },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                animation: { duration: 500 },
                plugins: { legend: { display: false } }, 
                scales: { x: { display: true, ticks: { font: { size: 10 } } }, y: { display: false } } 
            }
        });
        chartDataCache.category = { key: cacheKey, data: displayData, labels: chartLabels, category: category };
    }
}

function renderHeatmap() {
    let heatmapGrid = document.getElementById('heatmap-grid');
    if (!heatmapGrid) return;

    let now = new Date(); let year = now.getFullYear(); let month = now.getMonth();
    let firstDay = new Date(year, month, 1).getDay(); let daysInMonth = new Date(year, month + 1, 0).getDate();

    let titleEl = document.getElementById('heatmap-month-title');
    if (titleEl) titleEl.innerText = `Activity Calendar (${now.toLocaleString('default', { month: 'long' })})`;

    let pastMap = {};
    db.investments.forEach(inv => {
        if (activeAccountFilter === 'All' || inv.account === activeAccountFilter) {
            pastMap[inv.date] = (pastMap[inv.date] || 0) + inv.amount;
        }
    });

    let futureMap = {};
    db.recurring.forEach(rec => {
        let nextD = new Date(rec.nextRun);
        if (nextD.getMonth() === month && nextD.getFullYear() === year) {
            let dStr = getLocalYYYYMMDD(nextD);
            futureMap[dStr] = (futureMap[dStr] || 0) + rec.amount;
        }
    });

    let html = `
            <div class="heatmap-header">
                <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
            </div>
            <div class="heatmap-body">`;

    for (let i = 0; i < firstDay; i++) { html += `<div></div>`; }

    for (let d = 1; d <= daysInMonth; d++) {
        let cellDate = new Date(year, month, d);
        let dStr = getLocalYYYYMMDD(cellDate);

        let pastAmt = pastMap[dStr] || 0;
        let futAmt = futureMap[dStr] || 0;

        let cls = 'heatmap-cell-cal';
        let hasData = false;

        if (pastAmt > 0 && futAmt > 0) { cls += ' active-both'; hasData = true; }
        else if (pastAmt > 0) { cls += ' active-past'; hasData = true; }
        else if (futAmt > 0) { cls += ' active-future'; hasData = true; }

        if (d === now.getDate()) cls += ' today-border';

        let onclick = hasData ? `onclick="showDayDetails('${dStr}')"` : '';
        html += `<div class="${cls}" ${onclick}>${d}</div>`;
    }
    html += `</div>`;

    html += `
            <div style="display:flex; gap:12px; margin-top:12px; font-size:10px; justify-content:center; color:var(--md-on-surface-variant);">
                <div style="display:flex; align-items:center; gap:4px;"><div style="width:8px;height:8px;border-radius:2px;background:var(--md-primary);"></div> Past</div>
                <div style="display:flex; align-items:center; gap:4px;"><div style="width:8px;height:8px;border-radius:2px;background:#D96200;"></div> Upcoming SIP</div>
            </div>`;

    heatmapGrid.innerHTML = html;
}

function showDayDetails(dateStr) {
    haptic(20);
    let pastInvs = db.investments.filter(inv => inv.date === dateStr && (activeAccountFilter === 'All' || inv.account === activeAccountFilter));
    let futSips = db.recurring.filter(rec => {
        let nextD = new Date(rec.nextRun);
        return getLocalYYYYMMDD(nextD) === dateStr && (activeAccountFilter === 'All' || rec.account === activeAccountFilter);
    });

    let dObj = new Date(dateStr);
    let displayDate = `${dObj.getDate()} ${dObj.toLocaleString('default', { month: 'short' })} ${dObj.getFullYear()}`;

    let html = `<div style="text-align:left;">`;
    if (pastInvs.length > 0) {
        html += `<div style="font-size:13px; font-weight:700; color:var(--md-primary); margin-bottom:8px; text-transform:uppercase;">Invested</div>`;
        pastInvs.forEach(i => {
            html += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--md-surface-container-highest);">
                        <div><div style="font-weight:500;">${i.type}</div><div style="font-size:12px; color:var(--md-outline);">${i.note || ''}</div></div>
                        <div style="font-weight:600; color:var(--md-on-surface);">+${formatMoney(i.amount)}</div>
                    </div>`;
        });
    }

    if (futSips.length > 0) {
        if (pastInvs.length > 0) html += `<br>`;
        html += `<div style="font-size:13px; font-weight:700; color:#D96200; margin-bottom:8px; text-transform:uppercase;">Scheduled Auto-SIPs</div>`;
        futSips.forEach(r => {
            html += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; padding-bottom:8px; border-bottom:1px dashed var(--md-surface-container-highest);">
                        <div><div style="font-weight:500;">${r.type}</div><div style="font-size:12px; color:var(--md-outline);">${r.note || ''}</div></div>
                        <div style="font-weight:600; color:var(--md-on-surface);">+${formatMoney(r.amount)}</div>
                    </div>`;
        });
    }
    html += `</div>`;
    Swal.fire({ title: displayDate, html: html, showConfirmButton: true, confirmButtonText: 'Close' });
}

// ==========================================
// 5. INPUT FORMS & DATA OPERATIONS
// ==========================================

function setInvestType(type) {
    haptic(20); currentInvType = type;
    document.querySelectorAll('#type-chips .quick-chip').forEach(el => {
        if (el.innerText === type) el.classList.add('active');
        else el.classList.remove('active');
    });

    const config = db.categoryDetails[type]?.fields || {};

    // Default hiding
    const sections = [
        'dynamic-fd-fields', 'dynamic-sip-fields', 'dynamic-qty-price',
        'dynamic-mf-search', 'dynamic-growth-fields', 'dynamic-sip-day-field',
        'maturity-box-simple', 'invest-smart-preview'
    ];
    sections.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.style.display = 'none';
    });

    // Show monthly contribution wrapper for SIP, PF, PPF or if configured
    const isMonthlyAsset = ['SIP', 'PF', 'PPF'].includes(type) || config.monthly;
    const monthlyWrap = document.getElementById('monthly-contrib-wrapper');
    if (monthlyWrap) monthlyWrap.style.display = isMonthlyAsset ? 'flex' : 'none';

    const isMonthlyCheck = document.getElementById('inv-is-monthly');
    if (isMonthlyCheck && !editInvId) isMonthlyCheck.checked = isMonthlyAsset;

    // Core Logic mapping
    const showIfExist = (id, cond) => { const el = document.getElementById(id); if (el) el.style.display = cond ? 'flex' : 'none'; };
    const showBlockIfExist = (id, cond) => { const el = document.getElementById(id); if (el) el.style.display = cond ? 'block' : 'none'; };

    if (config.interest) showIfExist('dynamic-fd-fields', true);
    if (config.maturity) showBlockIfExist('maturity-box-simple', true);
    if (config.sipday) showIfExist('dynamic-sip-day-field', true);
    if (config.mf) showIfExist('dynamic-mf-search', true);
    if (config.qty) showIfExist('dynamic-qty-price', true);
    if (config.growth) showIfExist('dynamic-growth-fields', true);

    // Dynamic visibility for Sub-Category and Broker based on config
    const isSimple = config.simple || ['Cash', 'Liquid'].includes(type);
    const hasBroker = config.broker !== undefined ? config.broker : !isSimple;
    const hasSubcat = config.subcat !== undefined ? config.subcat : !isSimple;
    const subcatWrapper = document.getElementById('inv-subcat')?.parentElement;
    const brokerWrapper = document.getElementById('inv-broker')?.parentElement;
    if (subcatWrapper) subcatWrapper.style.display = hasSubcat ? 'flex' : 'none';
    if (brokerWrapper) brokerWrapper.style.display = hasBroker ? 'flex' : 'none';
    // If hidden, clear the row margin
    const row = subcatWrapper?.parentElement;
    if (row && row.classList.contains('input-row')) {
        row.style.display = (hasSubcat || hasBroker) ? 'flex' : 'none';
    }

    // Safe DOM access for labels and inputs
    const amtEl = document.getElementById('inv-amt');
    const amtLabel = document.getElementById('inv-amt-label');
    const intEl = document.getElementById('inv-interest');

    if (amtEl) amtEl.readOnly = (type === 'Stocks');
    if (amtLabel) amtLabel.innerText = type === 'SIP' ? "Monthly SIP Amount (₹)" : "Amount (₹)";

    // Set Gov rates if not specified
    if (type === 'PPF' && intEl && !intEl.value) intEl.value = 7.1;
    if (type === 'PF' && intEl && !intEl.value) intEl.value = 8.15;

    // Attach listeners for smart preview

    const inputIds = ['inv-amt', 'inv-date', 'inv-interest', 'inv-payout', 'inv-growth', 'inv-qty', 'inv-price', 'inv-sip-day', 'inv-mode'];
    inputIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.oninput = updateSmartPreview;
    });
    updateSmartPreview();
}

function updateSmartPreview() {
    const preview = document.getElementById('invest-smart-preview');
    const content = document.getElementById('smart-preview-content');
    if (!preview || !content) return;

    const amt = parseFloat(document.getElementById('inv-amt').value) || 0;
    const dateValue = document.getElementById('inv-date').value;
    const date = new Date(dateValue);
    const type = currentInvType;

    if (amt <= 0 || isNaN(date.getTime())) {
        preview.style.display = 'none';
        return;
    }
    preview.style.display = 'block';

    let html = "";
    const now = new Date();
    const years = Math.max(0, (now - date) / (1000 * 60 * 60 * 24 * 365.25));
    const months = Math.max(0, Math.floor((now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth())));

    if (type === 'FD' || type === 'Fixed Deposit') {
        const rate = parseFloat(document.getElementById('inv-interest').value) || 0;
        const payout = document.getElementById('inv-payout').value;
        const maturityDate = new Date(document.getElementById('inv-maturity-simple').value);

        let currentVal = amt;
        if (rate > 0) {
            if (payout === 'quarterly') currentVal = amt * Math.pow(1 + (rate / 100) / 4, 4 * years);
            else if (payout === 'monthly') currentVal = amt * Math.pow(1 + (rate / 100) / 12, 12 * years);
            else currentVal = amt * (1 + (rate / 100) * years);
        }

        html = `<div style="padding:12px; border-radius:12px; background:var(--md-primary-container); color:var(--md-on-primary-container);">
            <div style="font-size:11px; opacity:0.8; margin-bottom:4px;">Accrued Value (${years.toFixed(1)}Y)</div>
            <div style="font-size:20px; font-weight:600;">₹${formatInr(currentVal.toFixed(0))}</div>
            <div style="font-size:11px; margin-top:4px;">Interest: <span style="color:var(--md-success);">+₹${formatInr((currentVal - amt).toFixed(0))}</span></div>
        </div>`;
    } else if (type === 'SIP') {
        const isMonthly = document.getElementById('inv-is-monthly').checked;
        const rate = parseFloat(document.getElementById('inv-growth').value) || 12;
        if (isMonthly) {
            const totalInvested = amt * (months + 1);
            const r = rate / (100 * 12);
            const futureVal = amt * ((Math.pow(1 + r, months + 1) - 1) / r) * (1 + r);
            html = `<div style="padding:12px; border-radius:12px; background:var(--md-secondary-container); color:var(--md-on-secondary-container);">
                <div style="font-size:11px; opacity:0.8; margin-bottom:4px;">SIP Valuation (${months + 1} Months)</div>
                <div style="font-size:20px; font-weight:600;">₹${formatInr(futureVal.toFixed(0))}</div>
                <div style="font-size:11px; margin-top:4px;">Invested: ₹${formatInr(totalInvested)} | P&L: <span style="color:var(--md-success);">+₹${formatInr((futureVal - totalInvested).toFixed(0))}</span></div>
            </div>`;
        } else {
            const currentVal = amt * Math.pow(1 + (rate / 100), years);
            html = `<div style="padding:12px; border-radius:12px; background:var(--md-secondary-container); color:var(--md-on-secondary-container);">
                <div style="font-size:11px; opacity:0.8; margin-bottom:4px;">Growth Forecast (${years.toFixed(1)}Y @ ${rate}%)</div>
                <div style="font-size:20px; font-weight:600;">₹${formatInr(currentVal.toFixed(0))}</div>
                <div style="font-size:11px; margin-top:4px;">Gain: <span style="color:var(--md-success);">+₹${formatInr((currentVal - amt).toFixed(0))}</span></div>
            </div>`;
        }
    } else if (type === 'PF' || type === 'PPF') {
        const rate = type === 'PF' ? 8.15 : 7.1;
        const currentVal = amt * Math.pow(1 + (rate / 100), years);
        html = `<div style="padding:12px; border-radius:12px; background:var(--md-tertiary-container); color:var(--md-on-tertiary-container);">
            <div style="font-size:11px; opacity:0.8; margin-bottom:4px;">Govt Compound Interest (${rate}%)</div>
            <div style="font-size:20px; font-weight:600;">₹${formatInr(currentVal.toFixed(0))}</div>
            <div style="font-size:11px; margin-top:4px;">Interest: <span style="color:var(--md-success);">+₹${formatInr((currentVal - amt).toFixed(0))}</span></div>
        </div>`;
    } else {
        // Default generic growth
        const rate = parseFloat(document.getElementById('inv-growth').value) || 0;
        const currentVal = amt * Math.pow(1 + (rate / 100), years);
        if (rate > 0) {
            html = `<div style="padding:12px; border-radius:12px; border:1px solid var(--md-outline-variant);">
                <div style="font-size:11px; opacity:0.8; margin-bottom:4px;">Forecasted Value (${rate}%)</div>
                <div style="font-size:18px; font-weight:600;">₹${formatInr(currentVal.toFixed(0))}</div>
            </div>`;
        }
    }
    content.innerHTML = html;

    if (html) {
        content.innerHTML = html;
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }
}

function calculateDynamicTotal() {
    let qty = parseFloat(document.getElementById('inv-qty').value) || 0;
    let price = parseFloat(document.getElementById('inv-price').value) || 0;
    if (qty > 0 && price > 0) document.getElementById('inv-amt').value = (qty * price).toFixed(2);
    document.getElementById('inv-units-hidden').value = qty;
}

function reverseCalculateUnits() {
    let amt = parseFloat(document.getElementById('inv-amt').value) || 0;
    let price = parseFloat(document.getElementById('inv-price').value) || 0;
    if (amt > 0 && price > 0) {
        let units = amt / price;
        document.getElementById('inv-qty').value = units.toFixed(4);
        document.getElementById('inv-units-hidden').value = units;
    }
}

async function searchMFForLog() {
    let q = document.getElementById('inv-mf-query').value.trim();
    if (!q) return showSnackbar("Enter fund name to search", "warning");

    // Show loading state
    let searchBtn = document.querySelector('#dynamic-mf-search button');
    if (searchBtn) setButtonLoading(searchBtn.id || 'mf-search-btn', true);
    let sel = document.getElementById('inv-mf-select');
    if (sel) {
        sel.innerHTML = '<option>Searching...</option>';
        sel.style.display = 'block';
    }
    
    try {
        let res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(q)}`);
        let data = await res.json();
        
        if (searchBtn) setButtonLoading(searchBtn.id || 'mf-search-btn', false);
        
        if (data.length === 0) {
            if (sel) sel.innerHTML = '<option>No funds found</option>';
            return showSnackbar("No funds found", "error");
        }

        sel.innerHTML = `<option value="">Select a fund (${data.length} found)...</option>` + data.map(f => `<option value="${escapeHtml(f.schemeCode)}" data-name="${escapeHtml(f.schemeName)}">${escapeHtml(f.schemeName.substring(0, 60))}${f.schemeName.length > 60 ? '...' : ''}</option>`).join('');
        sel.style.display = 'block';
        showSnackbar(`${data.length} funds found`, "check_circle");
        
        // Auto-focus the select for faster UX
        setTimeout(() => sel.focus(), 100);
    } catch (e) { 
        if (searchBtn) setButtonLoading(searchBtn.id || 'mf-search-btn', false);
        if (sel) sel.innerHTML = '<option>Search failed</option>';
        showSnackbar("Search failed - check connection", "error"); 
    }
}

function handleMFSelectForLog(sel) {
    let code = sel.value; if (!code) return;
    let opt = sel.options[sel.selectedIndex];
    document.getElementById('inv-note').value = opt.getAttribute('data-name');
    document.getElementById('inv-mf-code-hidden').value = code;
    fetchLiveNAV(code);
}

async function fetchLiveNAV(code) {
    if (!code) return;
    
    // Show loading on price field
    let priceInput = document.getElementById('inv-price');
    let originalPrice = priceInput.value;
    priceInput.value = 'Loading...';
    priceInput.disabled = true;
    
    try {
        let res = await fetch(`https://api.mfapi.in/mf/${code}`);
        let data = await res.json();
        if (data.status !== "SUCCESS") throw new Error("Invalid Code");

        let latestNav = parseFloat(data.data[0].nav);
        priceInput.value = latestNav.toFixed(4);
        priceInput.disabled = false;
        db.navCache[code] = { nav: latestNav, date: data.data[0].date, lastFetched: new Date().toISOString() };
        reverseCalculateUnits();
        showSnackbar(`NAV: ₹${latestNav} (${data.data[0].date})`, "check_circle");
        
        // Auto-calculate and move focus to amount for faster entry
        setTimeout(() => {
            let qtyInput = document.getElementById('inv-qty');
            let amtInput = document.getElementById('inv-amt');
            if (qtyInput && qtyInput.value && amtInput && !amtInput.value) {
                calculateDynamicTotal();
                updateSmartPreview();
            }
            // Focus amount field if empty
            if (amtInput && !amtInput.value) {
                amtInput.focus();
            }
        }, 100);
    } catch (e) { 
        priceInput.value = originalPrice;
        priceInput.disabled = false;
        showSnackbar("Failed to fetch NAV", "error"); 
    }
}

// --- UNIVERSAL HISTORICAL BACKFILL WIZARD ---
function populateSyncDropdown() {
    let sel = document.getElementById('sync-asset-type');
    sel.innerHTML = Object.keys(db.categories).map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    toggleSyncFields();
}

function toggleSyncFields() {
    let type = document.getElementById('sync-asset-type').value;
    if (type === 'SIP' || type === 'Stocks') {
        document.getElementById('sync-mf-block').style.display = 'flex';
    } else {
        document.getElementById('sync-mf-block').style.display = 'none';
    }
}

async function searchMFForSync() {
    let q = document.getElementById('sync-search').value.trim();
    if (!q) return showSnackbar("Enter fund name to search", "warning");

    showSnackbar("Searching...", "hourglass_empty");
    try {
        let res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(q)}`);
        let data = await res.json();
        if (data.length === 0) return showSnackbar("No funds found", "error");

        let sel = document.getElementById('sync-mf-select');
        sel.innerHTML = `<option value="">Select a fund...</option>` + data.map(f => `<option value="${escapeHtml(f.schemeCode)}">${escapeHtml(f.schemeName)}</option>`).join('');
        sel.style.display = 'block';
        showSnackbar(`Found ${data.length} funds`, "check_circle");
    } catch (e) { showSnackbar("Search failed", "error"); }
}

function handleMFSelectForSync(sel) {
    let code = sel.value; if (!code) return;
    document.getElementById('sync-code').value = code;
}

async function syncHistoricalSIP() {
    let type = document.getElementById('sync-asset-type').value;
    let amt = parseFloat(document.getElementById('sync-amt').value);
    let start = new Date(document.getElementById('sync-start').value);
    let day = parseInt(document.getElementById('sync-day').value);

    if (isNaN(amt) || isNaN(start.getTime()) || isNaN(day)) return showSnackbar("Fill all fields", "error");

    if (type === 'SIP' || type === 'Stocks') {
        let code = document.getElementById('sync-code').value.trim();
        if (!code) return showSnackbar("Select MF Code", "error");
        showSnackbar("Fetching Historical Data...", "hourglass_empty");
        try {
            let res = await fetch(`https://api.mfapi.in/mf/${code}`);
            let data = await res.json();
            if (data.status !== "SUCCESS") throw new Error("Invalid Code");

            let navMap = {};
            data.data.forEach(d => {
                let parts = d.date.split('-');
                navMap[`${parts[2]}-${parts[1]}-${parts[0]}`] = parseFloat(d.nav);
            });

            let schemeName = data.meta.scheme_name;
            let currentDate = new Date(start); let today = new Date(); let added = 0;

            while (currentDate <= today) {
                currentDate.setDate(day);
                if (currentDate > today) break;

                let dStr = getLocalYYYYMMDD(currentDate);
                let checkDate = new Date(currentDate); let foundNav = null;
                for (let i = 0; i < 7; i++) {
                    let checkStr = getLocalYYYYMMDD(checkDate);
                    if (navMap[checkStr]) { foundNav = navMap[checkStr]; break; }
                    checkDate.setDate(checkDate.getDate() - 1);
                }

                let units = foundNav ? amt / foundNav : 0;
                db.investments.push({ id: generateUniqueId(), date: dStr, type: type, amount: amt, units: units, mfCode: code, note: schemeName, tags: "backfill", isDividend: false, account: activeAccountFilter === 'All' ? db.accounts[0] : activeAccountFilter });
                added++; currentDate.setMonth(currentDate.getMonth() + 1);
            }

            saveData(); renderAll(); closeOverlays(); showSnackbar(`Generated ${added} past SIP entries!`, "check_circle");
        } catch (e) { showSnackbar("Failed to fetch MF data", "error"); }
    } else {
        // Fixed income or custom backfill
        let currentDate = new Date(start); let today = new Date(); let added = 0;
        while (currentDate <= today) {
            currentDate.setDate(day);
            if (currentDate > today) break;
            let dStr = getLocalYYYYMMDD(currentDate);

            db.investments.push({ id: generateUniqueId(), date: dStr, type: type, amount: amt, note: `${type} (Backfill)`, tags: "backfill", isDividend: false, account: activeAccountFilter === 'All' ? db.accounts[0] : activeAccountFilter });
            added++; currentDate.setMonth(currentDate.getMonth() + 1);
        }
        saveData(); renderAll(); closeOverlays(); showSnackbar(`Generated ${added} deposits for ${type}!`, "check_circle");
    }
}

function openInvestSheet(id = null, presetAmt = null) {
    haptic(30); editInvId = id;
    const sheetTitle = document.getElementById('invest-sheet-title');
    const delBtn = document.getElementById('del-inv-btn');
    if (sheetTitle) sheetTitle.innerText = id ? `Edit Entry` : `Log Investment`;
    if (delBtn) delBtn.style.display = id ? 'block' : 'none';
    
    // Auto-focus management for faster entry flow
    setTimeout(() => {
        if (id) {
            // Editing - focus on amount for quick changes
            let amtField = document.getElementById('inv-amt');
            if (amtField) amtField.focus();
        } else {
            // New entry - smart focus based on category type
            let type = currentInvType;
            let focusField = 'inv-amt'; // default
            
            // For SIP/Stocks with MF search enabled, focus the search first
            let config = db.categoryDetails[type]?.fields || {};
            if ((type === 'SIP' || type === 'Stocks') && config.mf) {
                let mfQuery = document.getElementById('inv-mf-query');
                if (mfQuery && !mfQuery.value) {
                    focusField = 'inv-mf-query';
                }
            }
            // For FD with interest, focus interest rate
            else if (type === 'FD' && config.interest) {
                let intField = document.getElementById('inv-interest');
                if (intField && !intField.value) {
                    focusField = 'inv-interest';
                }
            }
            
            let field = document.getElementById(focusField);
            if (field) field.focus();
        }
    }, 150);

    const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const safeCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

    if (id) {
        let inv = db.investments.find(i => i.id === id); if (!inv) return;
        setInvestType(inv.type);

        safeSet('inv-date', inv.date);
        safeSet('inv-amt', inv.amount);
        safeSet('inv-note', inv.note || '');
        safeSet('inv-tags', inv.tags || '');
        safeSet('inv-subcat', inv.subCategory || '');
        safeSet('inv-broker', inv.broker || '');
        safeSet('inv-growth', inv.growthRate || '');
        safeSet('inv-maturity-simple', inv.maturityDate || '');
        safeSet('inv-interest', inv.interestRate || '');
        safeCheck('inv-dividend', inv.isDividend);
        safeSet('inv-account', inv.account || db.accounts[0]);
        safeSet('inv-units-hidden', inv.units || '');
        safeSet('inv-mf-code-hidden', inv.mfCode || '');
        safeCheck('inv-is-monthly', inv.isMonthlyContrib);
        if (inv.payoutType) safeSet('inv-payout', inv.payoutType);
        if (inv.investMode) safeSet('inv-mode', inv.investMode);
        if (inv.sipDay) safeSet('inv-sip-day', inv.sipDay);

        let tplCheck = document.getElementById('tpl-switch-wrap'); if (tplCheck) tplCheck.style.display = 'none';
    } else {
        safeSet('inv-date', getLocalYYYYMMDD(new Date()));
        safeSet('inv-amt', presetAmt !== null ? presetAmt : '');
        safeSet('inv-note', '');
        safeSet('inv-tags', '');
        safeSet('inv-subcat', '');
        safeSet('inv-broker', '');
        safeSet('inv-growth', '');
        safeSet('inv-maturity-simple', '');
        safeSet('inv-interest', '');
        safeSet('inv-initial-payment', '');
        safeSet('inv-qty', '');
        safeSet('inv-price', '');
        safeCheck('inv-dividend', false);
        safeSet('inv-account', activeAccountFilter !== 'All' ? activeAccountFilter : db.accounts[0]);
        safeSet('inv-units-hidden', '');
        safeSet('inv-mf-code-hidden', '');
        safeCheck('inv-is-monthly', false);
        safeSet('inv-payout', 'quarterly');
        safeSet('inv-mode', 'monthly');
        safeSet('inv-sip-day', '');

        let tplCheck = document.getElementById('tpl-switch-wrap'); if (tplCheck) tplCheck.style.display = 'flex';
        let tplToggle = document.getElementById('inv-template'); if (tplToggle) tplToggle.checked = false;
        let recCheck = document.getElementById('inv-recurring'); if (recCheck) recCheck.checked = false;
        if (activeCategory) { setInvestType(activeCategory); } else { setInvestType(Object.keys(db.categories)[0]); }
    }
    openSheet('invest-sheet');
}

