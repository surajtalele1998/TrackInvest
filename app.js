// ==========================================
// 1. DATA INITIALIZATION & CONSTANT STORE
// ==========================================
let db = JSON.parse(localStorage.getItem('appHubInvestDb')) || {};

if (!db.userProfile) db.userProfile = { salary: 0, regime: 'new' };
if (!db.settingsTable) db.settingsTable = { lastResetMonth: '', monthlyTargetRef: 0 };
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
let activeCategory = null, activeAccountFilter = 'All';
let currentTotalNW = 0, currentAvgMonthly = 0, currentTypeTotals = {};
let currentTax80c = 0;
let chartMonthsRange = 3;
let chartDataPoints = [];
let portfolioChartInstance = null, rollingChartInstance = null, categoryChartInstance = null;
let aiReportCharts = { pie: null, bar: null };

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
function haptic(ms = 30) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { } }

function getLocalYYYYMMDD(d) {
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
}

function formatInr(num) { return Number(num).toLocaleString('en-IN'); }
function formatMoney(num) { return db.privacyMode ? '••••••' : '₹' + formatInr(num); }

function showSnackbar(msg, icon = "info") {
    const sb = document.getElementById("snackbar");
    sb.innerHTML = `<span class="material-symbols-rounded" style="font-size:20px;">${icon}</span> ${msg}`;
    sb.classList.add("show");
    setTimeout(() => sb.classList.remove("show"), 3000);
}

function closeOverlays() {
    document.querySelectorAll('.scrim, .scrim-sub, .sheet').forEach(el => el.classList.remove('active'));
    editInvId = null; editGoalId = null;
}

// Sub-sheets open ON TOP of an existing sheet (e.g. calculators from Settings)
const SUB_SHEET_IDS = ['xirr-sheet', 'sip-calc-sheet', 'emi-calc-sheet', 'inflation-sheet', 'ai-predict-sheet', 'history-sync-sheet', 'webrtc-sync-sheet', 'chat-history-sheet', 'dividend-sheet'];

function openSheet(sheetId) {
    haptic(20);
    const isSubSheet = SUB_SHEET_IDS.includes(sheetId);
    if (isSubSheet) {
        // Don't close existing sheets; open on top with sub-scrim
        document.getElementById('scrim-sub').classList.add('active');
        document.getElementById(sheetId).classList.add('active');
    } else {
        closeOverlays();
        document.getElementById('scrim').classList.add('active');
        document.getElementById(sheetId).classList.add('active');
    }
    if (sheetId === 'history-sync-sheet') populateSyncDropdown();
}

function closeSubSheet() {
    document.getElementById('scrim-sub').classList.remove('active');
    document.querySelectorAll('.sheet.sub-sheet').forEach(el => el.classList.remove('active'));
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
    db.investments.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(inv => {
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
let ledgerSort = 'date'; let ledgerAsc = false;
function setLedgerSort(field, btn) {
    ledgerSort = field;
    document.querySelectorAll('.sort-chip[id^="sort-"]').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    renderHistory();
}
function toggleLedgerOrder(btn) {
    ledgerAsc = !ledgerAsc;
    document.getElementById('sort-order-icon').textContent = ledgerAsc ? 'arrow_upward' : 'arrow_downward';
    renderHistory();
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
        list.innerHTML = `<div class="empty-state-premium"><span class="material-symbols-rounded">autorenew</span><div class="es-title">No Recurring SIPs</div><div>Add an entry with "Recurring" toggle enabled</div></div>`;
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
function deleteRecurring(idx) {
    haptic(30);
    Swal.fire({ title: 'Delete SIP?', text: `Remove "${db.recurring[idx].note || db.recurring[idx].type}"?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete', customClass: { popup: 'swal2-popup', confirmButton: 'swal2-confirm', cancelButton: 'swal2-cancel' } }).then(r => {
        if (r.isConfirmed) { db.recurring.splice(idx, 1); saveData(); renderRecurringSheet(); showSnackbar('SIP removed', 'check_circle'); }
    });
}

// ── STAT CHIPS UPDATE ───────────────────────────
function updateStatChips(totalInvested, totalMarketValue, yearTotal) {
    let sal = db.userProfile.salary || 0;
    let pnl = totalMarketValue - totalInvested;
    let roi = totalInvested > 0 ? ((pnl / totalInvested) * 100) : 0;
    let savRate = sal > 0 ? Math.round((currentAvgMonthly / (sal / 12)) * 100) : 0;

    // Best month
    let monthMap = {};
    db.investments.filter(i => !i.isDividend).forEach(i => {
        let k = i.date.substring(0, 7);
        monthMap[k] = (monthMap[k] || 0) + i.amount;
    });
    let bestMonth = '—'; let bestAmt = 0;
    Object.entries(monthMap).forEach(([k, v]) => { if (v > bestAmt) { bestAmt = v; bestMonth = k; } });
    if (bestMonth !== '—') { let d = new Date(bestMonth + '-01'); bestMonth = d.toLocaleString('default', { month: 'short', year: '2-digit' }); }

    // Investment streak (consecutive months)
    let now = new Date(); let streak = 0;
    for (let i = 0; i < 24; i++) {
        let m = now.getMonth() - i; let y = now.getFullYear();
        if (m < 0) { m += 12; y--; }
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
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.key === 'n' || e.key === 'N') openInvestSheet();
    if (e.key === 'Escape') { closeOverlays(); closeSubSheet(); }
    if (e.key === '1') switchTab('dashboard');
    if (e.key === '2') switchTab('portfolio');
    if (e.key === '3') switchTab('ledger');
});

function saveData() {
    try { localStorage.setItem('appHubInvestDb', JSON.stringify(db)); }
    catch (e) { showSnackbar("Storage Full! Please backup and clean data.", "warning"); }
}

function isCurrentFY(dateStr) {
    let d = new Date(dateStr); let now = new Date(); let curYear = now.getFullYear(); let curMonth = now.getMonth();
    let fyStartYear = curMonth >= 3 ? curYear : curYear - 1; let fyStart = new Date(fyStartYear, 3, 1);
    let fyEnd = new Date(fyStartYear + 1, 2, 31, 23, 59, 59); return d >= fyStart && d <= fyEnd;
}

function checkAppLock() { if (db.appPin) { document.getElementById('app-lock-screen').style.display = 'flex'; } }

function unlockApp() {
    let val = document.getElementById('pin-input-auth').value;
    if (val === db.appPin) { document.getElementById('app-lock-screen').style.display = 'none'; document.getElementById('pin-input-auth').value = ''; }
    else { haptic([50, 50, 50]); showSnackbar("Incorrect PIN", "error"); document.getElementById('pin-input-auth').value = ''; }
}

function savePin() {
    let p = document.getElementById('settings-pin').value;
    if (p.length === 4) { db.appPin = p; saveData(); showSnackbar("App Lock Enabled", "lock"); }
    else if (p.length === 0) { db.appPin = ''; saveData(); showSnackbar("App Lock Disabled", "lock_open"); }
    else { showSnackbar("PIN must be 4 digits", "error"); }
}

function switchTab(tabId) {
    haptic(20);
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('nav-' + tabId).classList.add('active');
    window.scrollTo(0, 0);

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

function checkMilestones(nw) {
    let unlocked = false;
    milestoneThresholds.forEach(t => {
        if (nw >= t.val && !db.milestones.includes(t.val)) { db.milestones.push(t.val); unlocked = true; showSnackbar(`Milestone Unlocked: ${t.label}! 🎉`, "workspace_premium"); }
    });
    if (unlocked) { saveData(); window.fireMilestoneConfetti(); }
}

window.openMonthlyTargetSheet = function () {
    document.getElementById('monthly-target-amt').value = db.settingsTable.monthlyTargetRef || '';
    document.getElementById('scrim').classList.add('active');
    document.getElementById('monthly-target-sheet').classList.add('active');
};

window.saveMonthlyTarget = function () {
    db.settingsTable.monthlyTargetRef = parseFloat(document.getElementById('monthly-target-amt').value) || 0;
    saveData(); closeOverlays(); renderAll(); showSnackbar("Monthly Target Saved");
};

window.openProjectionSheet = function () {
    haptic(30);
    document.getElementById('proj-amt').value = db.projectionNextMonth || 0;
    document.getElementById('scrim').classList.add('active');
    document.getElementById('projection-sheet').classList.add('active');
};

window.saveProjection = function () {
    haptic(40);
    db.projectionNextMonth = parseFloat(document.getElementById('proj-amt').value) || 0;
    saveData(); closeOverlays(); renderAll(); showSnackbar("Target Updated");
};

function initUI() {
    document.getElementById('privacy-icon').innerText = db.privacyMode ? 'visibility_off' : 'visibility';
    setTheme(db.theme || 'indigo');

    let sel = document.getElementById('account-filter'); sel.innerHTML = `<option value="All">All Accounts</option>`;
    db.accounts.forEach(a => sel.innerHTML += `<option value="${a}">${a}</option>`);

    let formSel = document.getElementById('inv-account'); formSel.innerHTML = "";
    db.accounts.forEach(a => formSel.innerHTML += `<option value="${a}">${a}</option>`);

    let chips = document.getElementById('type-chips'); chips.innerHTML = "";
    let filterType = document.getElementById('ledger-filter-type'); if (filterType) filterType.innerHTML = `<option value="All">All Assets</option>`;
    Object.keys(db.categories).forEach(c => { chips.innerHTML += `<div class="quick-chip" onclick="setInvestType('${c}')">${c}</div>`; if (filterType) filterType.innerHTML += `<option value="${c}">${c}</option>`; });
    currentInvType = Object.keys(db.categories)[0];

    let gl = document.getElementById('goal-link'); gl.innerHTML = `<option value="">None (Manual Tracking)</option>`;
    Object.keys(db.categories).forEach(c => { gl.innerHTML += `<option value="${c}">Link to ${c}</option>`; });
    document.getElementById('xirr-category').innerHTML = Object.keys(db.categories).map(c => `<option value="${c}">${c}</option>`).join('');

    initChartInteractivity();
}

function getThemeColor() { return getComputedStyle(document.documentElement).getPropertyValue('--md-primary').trim() || '#4559A4'; }

// ==========================================
// 3. STRICT CALCULATORS & VALUATION ENGINE
// ==========================================
function calculateStrictTax() {
    let sal = parseFloat(db.userProfile.salary) || 0;
    if (sal === 0) return { liability: 0, str: "Setup Income in Settings" };

    let regime = db.userProfile.regime || 'new';
    let tax = 0;

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
        let taxable = Math.max(0, sal - 50000 - Math.min(currentTax80c, 150000));
        if (taxable <= 500000) return { liability: 0, str: "Tax Free (Rebate 87A)" };

        if (taxable > 250000) tax += Math.min(taxable - 250000, 250000) * 0.05; // 2.5-5L
        if (taxable > 500000) tax += Math.min(taxable - 500000, 500000) * 0.20; // 5-10L
        if (taxable > 1000000) tax += (taxable - 1000000) * 0.30; // >10L
    }

    tax = tax * 1.04; // 4% Health & Education Cess
    return { liability: tax, str: `₹${formatInr(tax)}` };
}

function calculateStrictValuation(type, totalInvested, rawInvs) {
    if (type === 'FD') {
        let val = 0;
        rawInvs.forEach(inv => {
            if (inv.isDividend) return;
            let rate = inv.interestRate || db.categoryDetails[type]?.interestRate || 0;
            let years = (new Date() - new Date(inv.date)) / (1000 * 60 * 60 * 24 * 365);
            val += inv.amount * Math.pow(1 + (rate / 100) / 4, 4 * years);
        });
        return val;
    }
    if (type === 'PF') {
        let val = 0;
        let sorted = rawInvs.filter(i => !i.isDividend).sort((a, b) => new Date(a.date) - new Date(b.date));
        sorted.forEach(inv => {
            let months = (new Date() - new Date(inv.date)) / (1000 * 60 * 60 * 24 * 30.44);
            val += inv.amount * (1 + (0.0825 / 12) * Math.max(0, months));
        });
        return val;
    }
    if (type === 'PPF') {
        let val = 0;
        let sorted = rawInvs.filter(i => !i.isDividend).sort((a, b) => new Date(a.date) - new Date(b.date));
        sorted.forEach(inv => {
            let years = (new Date() - new Date(inv.date)) / (1000 * 60 * 60 * 24 * 365);
            val += inv.amount * Math.pow(1.071, years);
        });
        return val;
    }
    if ((type === 'SIP' || type === 'Stocks') && db.navCache) {
        let val = 0; let hasUnits = false;
        rawInvs.forEach(inv => {
            if (!inv.isDividend && inv.units && inv.mfCode && db.navCache[inv.mfCode]) {
                val += inv.units * db.navCache[inv.mfCode].nav;
                hasUnits = true;
            } else if (!inv.isDividend) {
                val += inv.amount;
            }
        });
        if (hasUnits) return val;
    }

    // Custom types handle their own interest rate if set
    let customRate = db.categoryDetails[type]?.interestRate || 0;
    if (customRate > 0) {
        let val = 0;
        rawInvs.forEach(inv => {
            if (inv.isDividend) return;
            let rate = inv.interestRate || customRate;
            let years = (new Date() - new Date(inv.date)) / (1000 * 60 * 60 * 24 * 365);
            val += inv.amount * Math.pow(1 + (rate / 100) / 12, 12 * years); // Monthly compound custom
        });
        return val;
    }

    return totalInvested;
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
        if (value > 0) { labels.push(t); data.push(value); bgColors.push(db.categories[t].color); }
    });

    if (portfolioChartInstance) portfolioChartInstance.destroy();
    if (labels.length === 0) { labels = ["Empty"]; data = [1]; bgColors = ["var(--md-surface-container-highest)"]; }
    const displayData = db.privacyMode ? data.map(() => 1) : data;

    portfolioChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: displayData, backgroundColor: bgColors, borderWidth: 0, hoverOffset: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return db.privacyMode ? '••••••' : '₹' + Number(c.raw).toLocaleString('en-IN'); } } } } }
    });
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

    if (rollingChartInstance) rollingChartInstance.destroy();
    const displayData = db.privacyMode ? chartData.map(() => 1) : chartData;

    rollingChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: chartLabels, datasets: [{ label: 'Monthly Investment', data: displayData, backgroundColor: getThemeColor() + '80', borderRadius: 8 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return db.privacyMode ? '••••••' : '₹' + Number(c.raw).toLocaleString('en-IN'); } } } }, scales: { x: { display: true, ticks: { font: { size: 10 }, maxRotation: 90 } }, y: { display: !db.privacyMode, ticks: { callback: (v) => formatMoney(v) } } } }
    });
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

    if (categoryChartInstance) categoryChartInstance.destroy();
    const displayData = db.privacyMode ? chartData.map(() => 1) : chartData;
    let color = db.categories[category].color || getThemeColor();

    categoryChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: chartLabels, datasets: [{ label: category, data: displayData, borderColor: color, backgroundColor: color + '33', fill: true, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: true, ticks: { font: { size: 10 } } }, y: { display: false } } }
    });
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

    document.getElementById('dynamic-fd-fields').style.display = 'none';
    document.getElementById('dynamic-sip-fields').style.display = 'none';
    document.getElementById('dynamic-qty-price').style.display = 'none';
    document.getElementById('dynamic-mf-search').style.display = 'none';

    document.getElementById('recurring-switch-wrapper').style.display = 'flex';
    document.getElementById('recurring-label-text').innerText = "Auto‑SIP (Recurring)";

    // By default, amount is editable for ALL types (including Custom)
    document.getElementById('inv-amt').readOnly = false;
    document.getElementById('inv-amt-label').innerText = "Amount (₹)";

    if (type === 'FD' || type === 'PPF' || type === 'PF') {
        document.getElementById('dynamic-fd-fields').style.display = 'flex';
        document.getElementById('recurring-label-text').innerText = `Monthly ${type} Contribution`;
    }
    else if (type === 'SIP') {
        document.getElementById('dynamic-sip-fields').style.display = 'block';
        document.getElementById('dynamic-mf-search').style.display = 'flex';
        document.getElementById('inv-amt-label').innerText = "Monthly SIP Amount (₹)";
    }
    else if (type === 'Stocks') {
        document.getElementById('dynamic-qty-price').style.display = 'flex';
        document.getElementById('dynamic-mf-search').style.display = 'flex';
        document.getElementById('inv-amt').readOnly = true;
        document.getElementById('inv-amt-label').innerText = "Total Computed Amount (₹)";
        document.getElementById('recurring-switch-wrapper').style.display = 'none';
    }
    else {
        // IT IS A CUSTOM CATEGORY (like Emergency Fund)
        // Show FD fields for interest/maturity in case they want to track it
        document.getElementById('dynamic-fd-fields').style.display = 'flex';
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

    showSnackbar("Searching...", "hourglass_empty");
    try {
        let res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(q)}`);
        let data = await res.json();
        if (data.length === 0) return showSnackbar("No funds found", "error");

        let sel = document.getElementById('inv-mf-select');
        sel.innerHTML = `<option value="">Select a fund...</option>` + data.map(f => `<option value="${f.schemeCode}" data-name="${f.schemeName}">${f.schemeName}</option>`).join('');
        sel.style.display = 'block';
        showSnackbar(`Found ${data.length} funds`, "check_circle");
    } catch (e) { showSnackbar("Search failed", "error"); }
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
    showSnackbar("Fetching NAV...", "hourglass_empty");
    try {
        let res = await fetch(`https://api.mfapi.in/mf/${code}`);
        let data = await res.json();
        if (data.status !== "SUCCESS") throw new Error("Invalid Code");

        let latestNav = parseFloat(data.data[0].nav);
        document.getElementById('inv-price').value = latestNav.toFixed(4);
        db.navCache[code] = { nav: latestNav, date: data.data[0].date };
        reverseCalculateUnits();
        showSnackbar(`Live NAV: ₹${latestNav}`, "check_circle");
    } catch (e) { showSnackbar("Failed to fetch NAV", "error"); }
}

// --- UNIVERSAL HISTORICAL BACKFILL WIZARD ---
function populateSyncDropdown() {
    let sel = document.getElementById('sync-asset-type');
    sel.innerHTML = Object.keys(db.categories).map(c => `<option value="${c}">${c}</option>`).join('');
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
        sel.innerHTML = `<option value="">Select a fund...</option>` + data.map(f => `<option value="${f.schemeCode}">${f.schemeName}</option>`).join('');
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
                db.investments.push({ id: Date.now() + Math.random(), date: dStr, type: type, amount: amt, units: units, mfCode: code, note: schemeName, tags: "backfill", isDividend: false, account: activeAccountFilter === 'All' ? db.accounts[0] : activeAccountFilter });
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

            db.investments.push({ id: Date.now() + Math.random(), date: dStr, type: type, amount: amt, note: `${type} (Backfill)`, tags: "backfill", isDividend: false, account: activeAccountFilter === 'All' ? db.accounts[0] : activeAccountFilter });
            added++; currentDate.setMonth(currentDate.getMonth() + 1);
        }
        saveData(); renderAll(); closeOverlays(); showSnackbar(`Generated ${added} deposits for ${type}!`, "check_circle");
    }
}

function openInvestSheet(id = null, presetAmt = null) {
    haptic(30); editInvId = id;
    document.getElementById('invest-sheet-title').innerText = id ? `Edit Entry` : `Log Investment`;
    document.getElementById('del-inv-btn').style.display = id ? 'block' : 'none';

    if (id) {
        let inv = db.investments.find(i => i.id === id); if (!inv) return;
        setInvestType(inv.type);

        document.getElementById('inv-date').value = inv.date;
        document.getElementById('inv-amt').value = inv.amount;
        document.getElementById('inv-note').value = inv.note || '';
        document.getElementById('inv-tags').value = inv.tags || '';
        document.getElementById('inv-maturity').value = inv.maturityDate || '';
        document.getElementById('inv-maturity-simple').value = inv.maturityDate || '';
        document.getElementById('inv-interest').value = inv.interestRate || '';
        document.getElementById('inv-dividend').checked = !!inv.isDividend;
        document.getElementById('inv-account').value = inv.account || db.accounts[0];
        document.getElementById('inv-units-hidden').value = inv.units || '';
        document.getElementById('inv-mf-code-hidden').value = inv.mfCode || '';

        let tplCheck = document.getElementById('tpl-switch-wrap'); if (tplCheck) tplCheck.style.display = 'none';
    } else {
        document.getElementById('inv-date').value = getLocalYYYYMMDD(new Date());
        document.getElementById('inv-amt').value = presetAmt !== null ? presetAmt : '';
        document.getElementById('inv-note').value = '';
        document.getElementById('inv-tags').value = '';
        document.getElementById('inv-maturity').value = '';
        document.getElementById('inv-maturity-simple').value = '';
        document.getElementById('inv-interest').value = '';
        document.getElementById('inv-initial-payment').value = '';
        document.getElementById('inv-qty').value = '';
        document.getElementById('inv-price').value = '';
        document.getElementById('inv-dividend').checked = false;
        document.getElementById('inv-account').value = activeAccountFilter !== 'All' ? activeAccountFilter : db.accounts[0];
        document.getElementById('inv-units-hidden').value = '';
        document.getElementById('inv-mf-code-hidden').value = '';

        let tplCheck = document.getElementById('tpl-switch-wrap'); if (tplCheck) tplCheck.style.display = 'flex';
        document.getElementById('inv-template').checked = false; let recCheck = document.getElementById('inv-recurring'); if (recCheck) recCheck.checked = false;
        if (activeCategory) { setInvestType(activeCategory); } else { setInvestType(Object.keys(db.categories)[0]); }
    }
    document.getElementById('scrim').classList.add('active'); document.getElementById('invest-sheet').classList.add('active');
}

function saveInvestment() {
    haptic(40);
    let date = document.getElementById('inv-date').value;
    let amt = parseFloat(document.getElementById('inv-amt').value);
    let note = document.getElementById('inv-note').value;
    let tags = document.getElementById('inv-tags').value.replace(/#/g, '');
    let isDiv = document.getElementById('inv-dividend').checked;
    let acc = document.getElementById('inv-account').value;
    let matDate = document.getElementById('inv-maturity').value || document.getElementById('inv-maturity-simple').value;
    let intRate = parseFloat(document.getElementById('inv-interest').value) || null;
    let initialPayment = parseFloat(document.getElementById('inv-initial-payment').value) || null;
    let isTemplate = document.getElementById('inv-template') ? document.getElementById('inv-template').checked : false;
    let isRecurring = document.getElementById('inv-recurring') ? document.getElementById('inv-recurring').checked : false;
    let units = parseFloat(document.getElementById('inv-units-hidden').value) || null;
    let mfCode = document.getElementById('inv-mf-code-hidden').value || null;

    if (!date || isNaN(amt)) return showSnackbar("Date and Amount required", "error");
    let newEntry = { id: editInvId || Date.now(), date, type: currentInvType, amount: amt, note, tags, isDividend: isDiv, account: acc };

    if (matDate) newEntry.maturityDate = matDate;
    if (intRate) newEntry.interestRate = intRate;
    if (units) newEntry.units = units;
    if (mfCode) newEntry.mfCode = mfCode;

    if (!editInvId && initialPayment > 0) { db.investments.push({ id: Date.now() - 1, date, type: currentInvType, amount: initialPayment, note: (note ? note + ' ' : '') + 'Initial Balance', tags, isDividend: false, account: acc, interestRate: intRate }); }
    if (editInvId) { let idx = db.investments.findIndex(i => i.id === editInvId); if (idx > -1) db.investments[idx] = newEntry; } else { db.investments.push(newEntry); }

    if (!editInvId) {
        if (isTemplate) { db.templates.push({ type: currentInvType, amount: amt, note: note || currentInvType, tags: tags, account: acc }); }
        if (isRecurring) { let nextDate = new Date(date); nextDate.setMonth(nextDate.getMonth() + 1); db.recurring.push({ type: currentInvType, amount: amt, note, tags, account: acc, nextRun: getLocalYYYYMMDD(nextDate) }); }
    }

    saveData(); renderAll(); closeOverlays(); showSnackbar(editInvId ? "Entry Updated" : "Investment Logged!", "check_circle"); if (!editInvId) checkDuplicates(newEntry);
}

function deleteInvestment() {
    haptic(50); Swal.fire({ title: 'Delete Entry?', text: "This cannot be undone.", icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete' }).then((r) => { if (r.isConfirmed) { db.investments = db.investments.filter(i => i.id !== editInvId); saveData(); renderAll(); closeOverlays(); showSnackbar("Entry Deleted"); } });
}

function executeQuickLog(idx) { haptic(40); let tpl = db.templates[idx]; db.investments.push({ id: Date.now(), date: getLocalYYYYMMDD(new Date()), type: tpl.type, amount: tpl.amount, note: tpl.note, tags: tpl.tags, isDividend: false, account: tpl.account }); saveData(); renderAll(); showSnackbar(`Quick Logged ${formatMoney(tpl.amount)}`); }
function deleteQuickLog(event, idx) { event.stopPropagation(); haptic(40); Swal.fire({ title: 'Delete Template?', showCancelButton: true }).then((res) => { if (res.isConfirmed) { db.templates.splice(idx, 1); saveData(); renderAll(); } }); }

// ==========================================
// 6. LIST BUILDING & SWIPE LOGIC
// ==========================================
function buildUnifiedItemHTML(inv) {
    let meta = db.categories[inv.type] || { icon: 'savings', color: '#8D6E63' };
    let dObj = new Date(inv.date); let dateStr = `${dObj.getDate()} ${dObj.toLocaleString('default', { month: 'short' })} ${dObj.getFullYear()}`;
    let tagsHtml = ""; if (inv.tags) { inv.tags.split(',').forEach(t => { if (t.trim()) tagsHtml += `<span class="roi-tag" style="background:var(--md-surface-container-highest);color:var(--md-on-surface-variant);">#${t.trim()}</span> `; }); }
    let intHtml = inv.interestRate ? `<span class="unified-detail-tag" style="font-size:10px; background:var(--md-surface-container-highest); padding:2px 4px; border-radius:4px; font-weight:700;">${inv.interestRate}% APY</span>` : '';
    let pClass = inv.isDividend ? "price dividend" : "price";

    return `
            <div class="swipe-wrapper" data-id="${inv.id}">
                <div class="swipe-bg">
                    <div class="left-action"><span class="material-symbols-rounded">edit</span> Edit</div>
                    <div class="right-action">Delete <span class="material-symbols-rounded">delete</span></div>
                </div>
                <div class="unified-item front" onclick="openInvestSheet(${inv.id})">
                    <div class="unified-icon" style="background:${meta.color};"><span class="material-symbols-rounded">${meta.icon}</span></div>
                    <div class="unified-content">
                        <div class="unified-title">
                            <span class="title-text">${inv.note || inv.type}</span> 
                            <span class="${pClass}">+${formatMoney(inv.amount)}</span>
                        </div>
                        <span class="unified-subtitle">${dateStr} • ${inv.type} ${intHtml}</span>
                        ${tagsHtml ? `<div style="margin-top:2px;">${tagsHtml}</div>` : ''}
                    </div>
                </div>
            </div>`;
}

function renderListToContainer(arr, containerId) { let html = arr.length === 0 ? `<div class="empty-state-premium"><span class="material-symbols-rounded">inbox</span><div class="es-title">No Entries</div></div>` : arr.map(buildUnifiedItemHTML).join(''); let container = document.getElementById(containerId); if (container) { container.innerHTML = html; attachSwipeListeners(container); } }

function renderHistory() {
    let searchEl = document.getElementById("search-history"), filterEl = document.getElementById("ledger-filter-type"); if (!searchEl || !filterEl) return;
    let term = searchEl.value.toLowerCase(), filterType = filterEl.value;
    let dateFrom = document.getElementById('ledger-date-from')?.value;
    let dateTo = document.getElementById('ledger-date-to')?.value;

    let filtered = db.investments.filter(i => activeAccountFilter === 'All' || i.account === activeAccountFilter);
    if (filterType !== 'All') filtered = filtered.filter(i => i.type === filterType);
    if (term) filtered = filtered.filter(i => i.type.toLowerCase().includes(term) || (i.note && i.note.toLowerCase().includes(term)) || (i.tags && i.tags.toLowerCase().includes(term)) || i.date.includes(term));
    if (dateFrom) filtered = filtered.filter(i => i.date >= dateFrom);
    if (dateTo) filtered = filtered.filter(i => i.date <= dateTo);

    // Sort
    filtered.sort((a, b) => {
        let va, vb;
        if (ledgerSort === 'amount') { va = a.amount; vb = b.amount; }
        else if (ledgerSort === 'type') { va = a.type; vb = b.type; return ledgerAsc ? va.localeCompare(vb) : vb.localeCompare(va); }
        else { va = new Date(a.date); vb = new Date(b.date); }
        return ledgerAsc ? va - vb : vb - va;
    });

    // Update insights bar
    let liCount = document.getElementById('li-count'); if (liCount) liCount.textContent = filtered.filter(i => !i.isDividend).length;
    let liTotal = filtered.filter(i => !i.isDividend).reduce((s, i) => s + i.amount, 0);
    let liTotalEl = document.getElementById('li-total'); if (liTotalEl) liTotalEl.textContent = formatMoney(liTotal);
    let liAvgEl = document.getElementById('li-avg'); if (liAvgEl) liAvgEl.textContent = filtered.filter(i => !i.isDividend).length > 0 ? formatMoney(Math.round(liTotal / filtered.filter(i => !i.isDividend).length)) : '₹0';

    // Group by month only if sorting by date
    let html = '';
    if (ledgerSort === 'date') {
        let groups = {}; filtered.forEach(inv => { let dStr = new Date(inv.date).toLocaleString('default', { month: 'long', year: 'numeric' }); if (!groups[dStr]) groups[dStr] = []; groups[dStr].push(inv); });
        html = Object.keys(groups).length === 0 ? `<div class="empty-state-premium"><span class="material-symbols-rounded">inbox</span><div class="es-title">No Entries</div></div>` : Object.keys(groups).map(m => `<div class="ledger-month-header">${m}</div>` + groups[m].map(buildUnifiedItemHTML).join('')).join('');
    } else {
        html = filtered.length === 0 ? `<div class="empty-state-premium"><span class="material-symbols-rounded">inbox</span><div class="es-title">No Entries</div></div>` : filtered.map(buildUnifiedItemHTML).join('');
    }
    let container = document.getElementById('ledger-history-list'); if (container) { container.innerHTML = html; attachSwipeListeners(container); }
}

function attachSwipeListeners(cE) {
    if (!cE) return; let sX = 0, sY = 0, cX = 0, aI = null, isSw = false;
    cE.addEventListener('touchstart', e => { let w = e.target.closest('.swipe-wrapper'); if (!w) return; aI = w.querySelector('.front'); if (!aI || !aI.hasAttribute('onclick')) { aI = null; return; } sX = e.touches[0].clientX; sY = e.touches[0].clientY; isSw = false; aI.classList.add('swiping'); }, { passive: true });
    cE.addEventListener('touchmove', e => { if (!aI) return; cX = e.touches[0].clientX; let cY = e.touches[0].clientY; let dX = cX - sX; let dY = Math.abs(cY - sY); if (!isSw && dY > 10) { aI.classList.remove('swiping'); aI = null; return; } if (Math.abs(dX) > 10) isSw = true; if (isSw) { if (dX > 80) dX = 80; if (dX < -80) dX = -80; aI.style.transform = `translateX(${dX}px)`; } }, { passive: true });
    cE.addEventListener('touchend', e => { if (!aI) return; aI.classList.remove('swiping'); let dX = cX - sX; let w = aI.closest('.swipe-wrapper'); if (!w) { aI = null; return; } let id = parseFloat(w.getAttribute('data-id')); if (isSw && dX < -50) { haptic(50); aI.style.transform = `translateX(-100%)`; setTimeout(() => { editInvId = id; deleteInvestment(); }, 250); } else if (isSw && dX > 50) { haptic(30); aI.style.transform = `translateX(0px)`; openInvestSheet(id); } else { aI.style.transform = `translateX(0px)`; } aI = null; });
}

// ==========================================
// 7. MODULES (GOALS, FIRE, CATS, SETTINGS)
// ==========================================
function openGoalSheet(id = null) { haptic(30); editGoalId = id; if (id) { let g = db.goals.find(g => g.id === id); if (!g) return; document.getElementById('goal-name').value = g.name; document.getElementById('goal-target').value = g.target; document.getElementById('goal-saved').value = g.saved; document.getElementById('goal-link').value = g.linkedCategory || ''; } else { document.getElementById('goal-name').value = ''; document.getElementById('goal-target').value = ''; document.getElementById('goal-saved').value = ''; document.getElementById('goal-link').value = ''; } document.getElementById('scrim').classList.add('active'); document.getElementById('goal-sheet').classList.add('active'); }
function saveGoal() { haptic(40); let name = document.getElementById('goal-name').value; let target = parseFloat(document.getElementById('goal-target').value); let saved = parseFloat(document.getElementById('goal-saved').value) || 0; let link = document.getElementById('goal-link').value; if (!name || isNaN(target)) return showSnackbar("Name and Target required", "error"); let newGoal = { id: editGoalId || Date.now(), name, target, saved, linkedCategory: link }; if (editGoalId) { let idx = db.goals.findIndex(g => g.id === editGoalId); if (idx > -1) db.goals[idx] = newGoal; } else { db.goals.push(newGoal); } saveData(); closeOverlays(); renderAll(); showSnackbar("Goal Saved!", "flag"); }
function openFIRESheet() { haptic(30); document.getElementById('fire-expenses').value = db.fireTargetMonthly || ''; document.getElementById('scrim').classList.add('active'); document.getElementById('fire-sheet').classList.add('active'); }
function saveFIRE() { haptic(40); db.fireTargetMonthly = parseFloat(document.getElementById('fire-expenses').value) || 0; saveData(); closeOverlays(); renderAll(); showSnackbar("FIRE Target Updated"); }

function openDividendSheet() {
    haptic(30);
    document.getElementById('scrim-sub').classList.add('active');
    document.getElementById('dividend-sheet').classList.add('active');
    let dividends = db.investments.filter(i => i.isDividend).sort((a, b) => new Date(b.date) - new Date(a.date));
    let html = dividends.length === 0 ? `<div class="empty-state-premium"><span class="material-symbols-rounded">payments</span><div class="es-title">No Passive Income</div></div>` : dividends.map(buildUnifiedItemHTML).join('');
    document.getElementById('dividend-list').innerHTML = html;
}

function openCategoryDetails(type) {
    haptic(30); activeCategory = type; let meta = db.categories[type] || { icon: 'savings', color: '#8D6E63' };
    document.getElementById('cat-sheet-title').innerHTML = `<span class="material-symbols-rounded" style="color:${meta.color};">${meta.icon}</span> ${type} Portfolio`;
    document.getElementById('cat-target-alloc').value = db.allocTargets[type] || ''; document.getElementById('cat-cmv-input').value = db.currentMarketValues[type] || ''; document.getElementById('cat-initial-bal').value = db.categoryDetails[type]?.initialBal || ''; document.getElementById('cat-interest-rate').value = db.categoryDetails[type]?.interestRate || '';

    let filtered = db.investments.filter(i => i.type === type && (activeAccountFilter === 'All' || i.account === activeAccountFilter));
    let now = new Date(); let stcgTotal = 0, ltcgTotal = 0, assets = {}, totalInvested = 0;

    if (db.categoryDetails[type]?.initialBal) { totalInvested += db.categoryDetails[type].initialBal; ltcgTotal += db.categoryDetails[type].initialBal; assets["Earlier Balance (Initial)"] = db.categoryDetails[type].initialBal; }

    filtered.forEach(i => {
        let key = i.note || "General"; if (!assets[key]) assets[key] = 0;
        if (!i.isDividend) { assets[key] += i.amount; totalInvested += i.amount; let days = (now - new Date(i.date)) / (1000 * 60 * 60 * 24); if (days <= 365) stcgTotal += i.amount; else ltcgTotal += i.amount; }
    });

    let totalTaxBase = stcgTotal + ltcgTotal;
    if (totalTaxBase > 0) { document.getElementById('tax-lt-fill').style.width = (ltcgTotal / totalTaxBase * 100) + '%'; document.getElementById('tax-st-fill').style.width = (stcgTotal / totalTaxBase * 100) + '%'; document.getElementById('tax-lt-label').innerText = `LTCG (>1Y): ${formatMoney(ltcgTotal)}`; document.getElementById('tax-st-label').innerText = `STCG (<1Y): ${formatMoney(stcgTotal)}`; }
    else { document.getElementById('tax-lt-fill').style.width = '0%'; document.getElementById('tax-st-fill').style.width = '0%'; }

    let assetHtml = "";
    Object.keys(assets).sort((a, b) => assets[b] - assets[a]).forEach(k => {
        let perc = totalInvested > 0 ? ((assets[k] / totalInvested) * 100).toFixed(1) : 0;
        assetHtml += `<div class="unified-item"><div class="unified-title" style="flex:1;"><span class="title-text">${k}</span> <span style="font-size:11px;color:var(--md-outline);margin-left:6px;flex-shrink:0;">${perc}%</span></div><div class="price">${formatMoney(assets[k])}</div></div>`;
    });
    document.getElementById('cat-asset-list').innerHTML = assetHtml || '<div style="color:var(--md-outline);font-size:14px;text-align:center;padding:16px;">No assets found.</div>';
    renderListToContainer(filtered.sort((a, b) => new Date(b.date) - new Date(a.date)), 'cat-history-list');
    document.getElementById('scrim').classList.add('active'); document.getElementById('category-sheet').classList.add('active');

    setTimeout(() => { renderCategoryChart(type); }, 300);
}

function saveCatSettings() {
    haptic(40); let cmv = parseFloat(document.getElementById('cat-cmv-input').value); let alloc = parseFloat(document.getElementById('cat-target-alloc').value); let initialBal = parseFloat(document.getElementById('cat-initial-bal').value); let intRate = parseFloat(document.getElementById('cat-interest-rate').value);
    if (!db.categoryDetails[activeCategory]) db.categoryDetails[activeCategory] = {};
    if (!isNaN(cmv)) db.currentMarketValues[activeCategory] = cmv; else delete db.currentMarketValues[activeCategory];
    if (!isNaN(alloc)) db.allocTargets[activeCategory] = alloc; else delete db.allocTargets[activeCategory];
    if (!isNaN(initialBal)) db.categoryDetails[activeCategory].initialBal = initialBal; else db.categoryDetails[activeCategory].initialBal = 0;
    if (!isNaN(intRate)) db.categoryDetails[activeCategory].interestRate = intRate; else db.categoryDetails[activeCategory].interestRate = 0;
    saveData(); renderAll(); showSnackbar("Settings Saved", "check_circle"); closeOverlays();
}

function saveProfileSettings() {
    haptic(40);
    db.userProfile.salary = parseFloat(document.getElementById('settings-salary').value) || 0;
    db.userProfile.regime = document.getElementById('settings-regime').value;
    saveData(); renderAll(); showSnackbar("Profile Updated", "check_circle");
}

function openMonthDetails(offset) {
    haptic(30); let now = new Date(); let m = now.getMonth(); let y = now.getFullYear(); let filtered = [];
    if (offset === 'tax') {
        document.getElementById('month-sheet-title').innerHTML = `<span class="material-symbols-rounded" style="color:var(--md-success);">receipt_long</span> 80C Tax Savings`;
        filtered = db.investments.filter(i => db.categories[i.type] && db.categories[i.type].is80c && isCurrentFY(i.date) && (activeAccountFilter === 'All' || i.account === activeAccountFilter));
    } else {
        if (offset === 1) { m = m === 0 ? 11 : m - 1; y = m === 11 ? y - 1 : y; }
        let monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        document.getElementById('month-sheet-title').innerHTML = `<span class="material-symbols-rounded" style="color:var(--md-primary);">calendar_month</span> ${monthNames[m]} ${y}`;
        filtered = db.investments.filter(i => { let d = new Date(i.date); return d.getMonth() === m && d.getFullYear() === y && (activeAccountFilter === 'All' || i.account === activeAccountFilter); });
    }
    renderListToContainer(filtered.sort((a, b) => new Date(b.date) - new Date(a.date)), 'month-history-list');
    document.getElementById('scrim').classList.add('active'); document.getElementById('month-sheet').classList.add('active');
}

function openSettings() {
    haptic(30);
    document.getElementById('settings-salary').value = db.userProfile.salary || '';
    document.getElementById('settings-regime').value = db.userProfile.regime || 'new';
    document.getElementById('settings-pin').value = db.appPin || '';
    document.getElementById('gemini-api-key').value = db.geminiKey || '';
    document.getElementById('groq-api-key').value = db.groqKey || '';

    let accHtml = ""; db.accounts.forEach((a, idx) => { let delBtn = idx === 0 ? '' : `<span class="material-symbols-rounded" style="color:var(--md-error);font-size:16px;cursor:pointer;" onclick="deleteAccount('${a}')">delete</span>`; accHtml += `<div style="display:flex;justify-content:space-between;padding:12px;background:var(--md-surface-container-highest);border-radius:12px;"><span>${a}</span>${delBtn}</div>`; }); document.getElementById('account-list').innerHTML = accHtml;
    let catHtml = ""; Object.keys(db.categories).forEach(c => { let isDefault = defaultCategories.includes(c); let delBtn = isDefault ? '<span style="font-size:10px;color:var(--md-outline);">Default</span>' : `<span class="material-symbols-rounded" style="color:var(--md-error);font-size:16px;cursor:pointer;" onclick="deleteCustomCategory('${c}')">delete</span>`; catHtml += `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--md-surface-container-highest);border-radius:12px;"><span><span class="material-symbols-rounded" style="font-size:16px;color:${db.categories[c].color};vertical-align:text-bottom;margin-right:6px;">${db.categories[c].icon}</span>${c}</span>${delBtn}</div>`; }); document.getElementById('category-crud-list').innerHTML = catHtml;
    let badgeHtml = ""; milestoneThresholds.forEach(t => { let unlocked = db.milestones.includes(t.val); if (unlocked) badgeHtml += `<div class="badge-item"><span class="material-symbols-rounded">workspace_premium</span> ${t.label}</div>`; else badgeHtml += `<div class="badge-item locked"><span class="material-symbols-rounded">lock</span> ${t.label}</div>`; }); document.getElementById('badge-grid').innerHTML = badgeHtml;
    document.getElementById('scrim').classList.add('active'); document.getElementById('settings-sheet').classList.add('active');
}

function saveApiKeys() { db.geminiKey = document.getElementById('gemini-api-key').value.trim(); db.groqKey = document.getElementById('groq-api-key').value.trim(); saveData(); showSnackbar("API Keys Saved", "key"); }
function addAccount() { haptic(40); let name = document.getElementById('new-acc-name').value.trim(); if (name && !db.accounts.includes(name)) { db.accounts.push(name); document.getElementById('new-acc-name').value = ''; saveData(); initUI(); openSettings(); showSnackbar("Account Added"); } }
function deleteAccount(name) { haptic(40); Swal.fire({ title: `Delete Account '${name}'?`, text: "Entries will remain but lose association.", showCancelButton: true }).then(r => { if (r.isConfirmed) { db.accounts = db.accounts.filter(a => a !== name); saveData(); initUI(); openSettings(); renderAll(); } }); }
function addCustomCategory() { haptic(40); let name = document.getElementById('new-cat-name').value.trim(); if (!name) return; let color = ['#6750A4', '#B3261E', '#D96200', '#0288D1', '#388E3C'][Object.keys(db.categories).length % 5]; db.categories[name] = { icon: 'category', color: color, is80c: false }; document.getElementById('new-cat-name').value = ''; saveData(); initUI(); openSettings(); showSnackbar(`Added Category: ${name}`); }
function deleteCustomCategory(name) { haptic(40); Swal.fire({ title: `Delete Category '${name}'?`, text: "Existing entries will default to Cash.", showCancelButton: true }).then(r => { if (r.isConfirmed) { db.investments.forEach(i => { if (i.type === name) i.type = 'Cash'; }); delete db.categories[name]; saveData(); initUI(); openSettings(); renderAll(); } }); }

function savePin() {
    let pin = document.getElementById('settings-pin').value;
    db.appPin = pin;
    saveData();
    showSnackbar(pin ? "PIN Set Successfully" : "PIN Removed");
}
function toggleBiometric() {
    db.useBiometric = document.getElementById('use-biometric-toggle').checked;
    saveData();
    showSnackbar(db.useBiometric ? "Biometric Enabled" : "Biometric Disabled");
}
async function checkAppLock() {
    if (db.appPin) {
        document.getElementById('app-lock-screen').style.display = 'flex';
        if (db.useBiometric && window.PublicKeyCredential) {
            try {
                await navigator.credentials.create({
                    publicKey: {
                        challenge: new Uint8Array(16),
                        rp: { name: "TrackInvest" },
                        user: { id: new Uint8Array(16), name: "user", displayName: "User" },
                        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
                        authenticatorSelection: { userVerification: "required" },
                        timeout: 60000
                    }
                });
                document.getElementById('app-lock-screen').style.display = 'none';
            } catch (e) {
                console.log("Biometric auth failed or cancelled", e);
            }
        }
    } else {
        document.getElementById('app-lock-screen').style.display = 'none';
    }
}
function unlockApp() {
    let pin = document.getElementById('pin-input-auth').value;
    if (pin === db.appPin) {
        document.getElementById('app-lock-screen').style.display = 'none';
        document.getElementById('pin-input-auth').value = '';
    } else {
        showSnackbar("Incorrect PIN", "error");
    }
}
function encryptData(jsonStr, pin) {
    if (!pin) return btoa(encodeURIComponent(jsonStr));
    let b64 = btoa(encodeURIComponent(jsonStr));
    let enc = '';
    for (let i = 0; i < b64.length; i++) enc += String.fromCharCode(b64.charCodeAt(i) ^ pin.charCodeAt(i % pin.length));
    return 'ENC:' + btoa(enc);
}
function decryptData(encStr, pin) {
    if (!encStr.startsWith('ENC:')) return decodeURIComponent(atob(encStr));
    if (!pin) throw new Error("PIN required for decryption");
    let enc = atob(encStr.substring(4));
    let dec = '';
    for (let i = 0; i < enc.length; i++) dec += String.fromCharCode(enc.charCodeAt(i) ^ pin.charCodeAt(i % pin.length));
    return decodeURIComponent(atob(dec));
}

function exportData() {
    haptic(40);
    let encrypt = document.getElementById('encrypt-backup-toggle') ? document.getElementById('encrypt-backup-toggle').checked : false;
    if (encrypt && !db.appPin) { showSnackbar("Please set a PIN first to encrypt", "warning"); return; }
    let dataStr = JSON.stringify(db, null, 2);
    let finalData = encrypt ? encryptData(dataStr, db.appPin) : dataStr;
    let ext = encrypt ? '.enc' : '.json';
    const blob = new Blob([finalData], { type: encrypt ? 'text/plain' : 'application/json' });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Invest_Backup${ext}`;
    a.click();
    closeOverlays();
    showSnackbar(encrypt ? "Encrypted Backup Downloaded" : "Backup Downloaded");
}

function restoreData(e) {
    const file = e.target.files[0]; if (!file) return; const reader = new FileReader();
    reader.onload = (event) => {
        try {
            let content = event.target.result;
            let parsedStr = content;
            if (content.startsWith('ENC:')) {
                let pin = prompt("Enter PIN to decrypt backup:");
                if (!pin) { showSnackbar("Decryption cancelled", "error"); e.target.value = ''; return; }
                parsedStr = decryptData(content, pin);
            }
            let parsed = JSON.parse(parsedStr);
            if (!parsed.userProfile) parsed.userProfile = { salary: 0, regime: 'new' };
            db.userProfile = parsed.userProfile;
            db.investments = parsed.investments || []; db.goals = parsed.goals || []; db.recurring = parsed.recurring || []; db.milestones = parsed.milestones || []; db.projectionNextMonth = parsed.projectionNextMonth || 0; db.categoryDetails = parsed.categoryDetails || parsed.categoryGoals || {}; db.currentMarketValues = parsed.currentMarketValues || {}; db.allocTargets = parsed.allocTargets || {}; db.accounts = parsed.accounts && parsed.accounts.length > 0 ? parsed.accounts : ['Main Portfolio']; db.fireTargetMonthly = parsed.fireTargetMonthly || 0; db.templates = parsed.templates || []; db.privacyMode = typeof parsed.privacyMode !== 'undefined' ? parsed.privacyMode : false; db.theme = parsed.theme || 'indigo'; db.geminiKey = parsed.geminiKey || ''; db.groqKey = parsed.groqKey || ''; db.appPin = parsed.appPin || ''; db.useBiometric = parsed.useBiometric || false; db.chatHistory = parsed.chatHistory || []; db.chatSessions = parsed.chatSessions || []; db.lastBackupPrompt = parsed.lastBackupPrompt || ''; db.navCache = parsed.navCache || {};
            if (parsed.categories && Object.keys(parsed.categories).length > 0) { db.categories = parsed.categories; }
            if (!db.settingsTable) db.settingsTable = { lastResetMonth: '', monthlyTargetRef: parsed.monthlyTarget || 0 };
            saveData(); initUI(); renderAll(); closeOverlays(); showSnackbar("Data Restored Instantly", "check_circle"); e.target.value = '';
        } catch (err) { showSnackbar("Invalid or Corrupted Backup", "error"); }
    }; reader.readAsText(file);
}

let webrtcConn, webrtcChannel;
function initWebRTC() {
    webrtcConn = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    webrtcConn.onicecandidate = e => {
        if (!e.candidate) {
            document.getElementById('webrtc-code-output').value = btoa(JSON.stringify(webrtcConn.localDescription));
            document.getElementById('webrtc-code-area').style.display = 'flex';
        }
    };
    webrtcConn.ondatachannel = e => {
        webrtcChannel = e.channel;
        setupDataChannel();
    };
}
function setupDataChannel() {
    webrtcChannel.onopen = () => {
        document.getElementById('webrtc-status').innerText = 'Status: Connected! 🚀';
        document.getElementById('webrtc-sync-btn').style.display = 'block';
    };
    webrtcChannel.onmessage = e => {
        if (e.data.startsWith('SYNC:')) {
            try {
                let parsed = JSON.parse(e.data.substring(5));
                Object.assign(db, parsed);
                saveData(); initUI(); renderAll(); showSnackbar("Data Synced via WebRTC!", "sync");
            } catch (err) { showSnackbar("Sync Failed", "error"); }
        }
    };
}
async function webrtcGenerateOffer() {
    initWebRTC();
    webrtcChannel = webrtcConn.createDataChannel('sync');
    setupDataChannel();
    let offer = await webrtcConn.createOffer();
    await webrtcConn.setLocalDescription(offer);
    document.getElementById('webrtc-status').innerText = 'Status: Generating Offer...';
}
async function webrtcProcessInput() {
    let input = document.getElementById('webrtc-code-input').value.trim();
    if (!input) return;
    try {
        let desc = JSON.parse(atob(input));
        if (desc.type === 'offer') {
            initWebRTC();
            await webrtcConn.setRemoteDescription(desc);
            let answer = await webrtcConn.createAnswer();
            await webrtcConn.setLocalDescription(answer);
            document.getElementById('webrtc-status').innerText = 'Status: Answer generated. Pass it back.';
        } else if (desc.type === 'answer') {
            await webrtcConn.setRemoteDescription(desc);
            document.getElementById('webrtc-status').innerText = 'Status: Connecting...';
        }
    } catch (e) { showSnackbar("Invalid Code", "error"); }
}
function webrtcSendSync() {
    if (webrtcChannel && webrtcChannel.readyState === 'open') {
        webrtcChannel.send('SYNC:' + JSON.stringify(db));
        showSnackbar("Data sent securely!");
    } else {
        showSnackbar("Not connected!");
    }
}

function importCSV(e) { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { try { let text = e.target.result; let rows = text.split('\n'); let added = 0; for (let i = 1; i < rows.length; i++) { let cols = rows[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || []; cols = cols.map(c => c.replace(/^"|"$/g, '')); if (cols.length >= 3 && cols[0] && !isNaN(parseFloat(cols[2]))) { db.investments.push({ id: Date.now() + Math.random(), date: cols[0].trim(), type: cols[1].trim() || 'Cash', amount: parseFloat(cols[2]), note: cols[3] ? cols[3].trim() : '', tags: cols[4] ? cols[4].trim() : '', isDividend: false, account: activeAccountFilter === 'All' ? db.accounts[0] : activeAccountFilter }); added++; } } if (added > 0) { saveData(); renderAll(); closeOverlays(); showSnackbar(`${added} Entries Imported!`, "check_circle"); } else { showSnackbar("No valid rows found in CSV", "warning"); } } catch (err) { showSnackbar("Failed to parse CSV", "error"); } }; reader.readAsText(file); }
function exportTaxPDF() { if (!window.jspdf) return showSnackbar("PDF Library loading...", "hourglass_empty"); haptic(40); const { jsPDF } = window.jspdf; const doc = new jsPDF(); doc.setFontSize(18); doc.text("80C Tax Savings Report (FY)", 14, 22); let fyInv = db.investments.filter(i => db.categories[i.type] && db.categories[i.type].is80c && isCurrentFY(i.date)).sort((a, b) => new Date(b.date) - new Date(a.date)); let tableData = fyInv.map(i => [i.date, i.type, i.note || '-', formatInr(i.amount)]); let total = fyInv.reduce((sum, i) => sum + i.amount, 0); tableData.push(['', '', 'TOTAL:', formatInr(total)]); doc.autoTable({ startY: 30, head: [['Date', 'Asset', 'Note', 'Amount (Rs)']], body: tableData, theme: 'striped', headStyles: { fillColor: [69, 89, 164] } }); doc.save('InvestPro_Tax_Report.pdf'); showSnackbar("PDF Downloaded", "picture_as_pdf"); }

function calculateXIRR() { let category = document.getElementById('xirr-category').value; let invs = db.investments.filter(i => i.type === category && (activeAccountFilter === 'All' || i.account === activeAccountFilter) && !i.isDividend); if (invs.length === 0) { document.getElementById('xirr-result').innerText = "No investments."; return; } let guess = 0.1; for (let iter = 0; iter < 1000; iter++) { let f = 0, df = 0; invs.forEach(inv => { let t = (new Date() - new Date(inv.date)) / (365.25 * 24 * 60 * 60 * 1000); f += inv.amount * Math.pow(1 + guess, -t); df += -t * inv.amount * Math.pow(1 + guess, -t - 1); }); f -= (currentTypeTotals[category] || 0); if (Math.abs(f) < 0.01) break; guess -= f / df; if (guess < -0.99) { guess = -0.99; break; } if (guess > 1000) { guess = 1000; break; } } document.getElementById('xirr-result').innerText = `XIRR ≈ ${(guess * 100).toFixed(2)}%`; }
function calculateMonthlySIP() { let target = parseFloat(document.getElementById('sip-target').value); let years = parseFloat(document.getElementById('sip-years').value); let rate = parseFloat(document.getElementById('sip-return').value) / 100 / 12; let months = years * 12; let monthly = target * rate / (Math.pow(1 + rate, months) - 1); document.getElementById('sip-result').innerHTML = `Monthly SIP needed: <strong>${formatMoney(monthly)}</strong>`; }
function calculateEMI() { let P = parseFloat(document.getElementById('emi-principal').value); let years = parseFloat(document.getElementById('emi-tenure').value); let rate = parseFloat(document.getElementById('emi-rate').value) / 12 / 100; let n = years * 12; let emi = P * rate * Math.pow(1 + rate, n) / (Math.pow(1 + rate, n) - 1); document.getElementById('emi-result').innerHTML = `Monthly EMI: <strong>${formatMoney(emi)}</strong>`; }
function calculateInflation() { let pv = parseFloat(document.getElementById('inf-present').value); let years = parseFloat(document.getElementById('inf-years').value); let rate = parseFloat(document.getElementById('inf-rate').value) / 100; let fv = pv * Math.pow(1 + rate, years); document.getElementById('inf-result').innerHTML = `Future Value: <strong>${formatMoney(fv)}</strong>`; }
function checkDuplicates(newEntry) { let dups = db.investments.filter(i => i.date === newEntry.date && i.type === newEntry.type && i.amount === newEntry.amount && i.id !== newEntry.id); if (dups.length > 0) { showSnackbar("Possible duplicate entry detected!", "warning"); } }
function autoBackupReminder() { let now = new Date().toDateString(); if (db.lastBackupPrompt !== now && (new Date() - new Date(db.lastBackupPrompt || 0)) > 7 * 24 * 60 * 60 * 1000) { showSnackbar("Remember to backup your data! (Settings > Backup)", "cloud_download"); db.lastBackupPrompt = now; saveData(); } }
function dataCleanup() { Swal.fire({ title: 'Cleanup Old Entries', text: 'Enter cutoff date (YYYY-MM-DD) to remove entries older than that date.', input: 'text', showCancelButton: true }).then(res => { if (res.isConfirmed && res.value) { let cutoff = new Date(res.value); let before = db.investments.length; db.investments = db.investments.filter(i => new Date(i.date) >= cutoff); saveData(); renderAll(); showSnackbar(`Removed ${before - db.investments.length} entries.`); } }); }

function renderQuickAddChips() { let chips = document.getElementById('quick-add-chips'); let presetAmounts = [500, 1000, 2000, 5000, 10000]; chips.innerHTML = presetAmounts.map(a => `<div class="quick-chip" onclick="quickAddAmount(${a})">+₹${a}</div>`).join(''); }
function quickAddAmount(amt) { openInvestSheet(null, amt); }
function updateRebalanceBadge() { let badge = document.getElementById('rebalance-badge'); let rebalanceSec = document.getElementById('rebalance-section'); badge.style.display = rebalanceSec && rebalanceSec.style.display !== 'none' ? 'block' : 'none'; }

// ==========================================
// 8. AI INTEGRATION (GROQ + GEMINI ROUTER)
// ==========================================
async function callAIApi(promptText, systemPrompt = "Act as an elite financial wealth manager.") {
    let hasGroq = !!db.groqKey; let hasGemini = !!db.geminiKey;
    if (!hasGroq && !hasGemini) {
        showSnackbar("Configure API Keys in Settings", "key");
        throw new Error("No API keys found.");
    }
    let responseText = null;
    if (hasGroq) {
        try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Authorization': `Bearer ${db.groqKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: promptText }] }) });
            if (res.ok) { const data = await res.json(); responseText = data.choices[0].message.content; }
        } catch (e) { console.warn("Groq request failed, preparing fallback...", e); }
    }
    if (!responseText && hasGemini) {
        try {
            let combinedPrompt = `${systemPrompt}\n\n${promptText}`;
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${db.geminiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: combinedPrompt }] }] }) });
            if (res.ok) { const data = await res.json(); responseText = data.candidates[0].content.parts[0].text; }
        } catch (e) { console.warn("Gemini fallback failed", e); }
    }
    if (!responseText) throw new Error("Both AI engines failed to respond.");
    return responseText.replace(/```html/g, '').replace(/```/g, '').trim();
}

function openAIChat() { document.getElementById('ai-chat-log').innerHTML = db.chatHistory.map(m => `<div class="chat-bubble ${m.role}">${m.content}</div>`).join(''); document.getElementById('scrim').classList.add('active'); document.getElementById('ai-chat-sheet').classList.add('active'); setTimeout(() => { let log = document.getElementById('ai-chat-log'); log.scrollTop = log.scrollHeight; }, 100); }
function saveChatSession() { haptic(40); if (db.chatHistory.length > 0) { db.chatSessions.push({ date: new Date().toISOString(), messages: [...db.chatHistory] }); db.chatHistory = []; saveData(); document.getElementById('ai-chat-log').innerHTML = ''; showSnackbar("Chat saved. Started new session."); } else { showSnackbar("Already in a new session."); } }
function viewChatHistory() {
    haptic(30);
    let html = db.chatSessions.length === 0 ? `<div class="empty-state-premium"><span class="material-symbols-rounded">forum</span><div class="es-title">No past sessions</div></div>` : "";
    db.chatSessions.slice().reverse().forEach((sess) => {
        let dStr = new Date(sess.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        let preview = sess.messages[0] ? sess.messages[0].content.substring(0, 40) + '...' : 'Empty session';
        html += `<div class="md-card" style="padding:12px; margin-bottom:8px;"><div style="font-size:12px;color:var(--md-primary);font-weight:500;">${dStr}</div><div style="font-size:14px;margin-top:4px;">${preview}</div></div>`;
    });
    document.getElementById('chat-history-list').innerHTML = html;
    // Open as sub-sheet on top of AI chat sheet
    document.getElementById('scrim-sub').classList.add('active');
    document.getElementById('chat-history-sheet').classList.add('active');
}

async function sendAIChat() {
    if (!db.geminiKey && !db.groqKey) { showSnackbar("API key required", "key"); return; }
    let input = document.getElementById('ai-chat-input'); let msg = input.value.trim(); if (!msg) return;
    db.chatHistory.push({ role: 'user', content: msg }); openAIChat(); input.value = '';
    let log = document.getElementById('ai-chat-log'); log.innerHTML += `<div class="chat-bubble user">${msg}</div><div class="chat-bubble ai" id="typing">Thinking...</div>`; log.scrollTop = log.scrollHeight;
    let historyStr = db.chatHistory.slice(-10).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    let sipData = JSON.stringify(db.recurring.map(r => ({ t: r.type, a: r.amount })));
    let goalData = JSON.stringify(db.goals.map(g => ({ n: g.name, s: g.saved, t: g.target })));
    let promptBase = `User's Net Worth: ${currentTotalNW}. Salary: ${db.userProfile.salary}. Monthly Savings: ${currentAvgMonthly}. Portfolio Allocation: ${JSON.stringify(currentTypeTotals)}.\nSIPs: ${sipData}\nGoals: ${goalData}\n\nConversation History:\n${historyStr}\n\nUSER MESSAGE: ${msg}\n\nProvide a concise, helpful response based on their financial data. You may use basic markdown like **bold**, *italic*, or \n for newlines.`;
    try {
        let reply = await callAIApi(promptBase, "You are a highly capable and friendly personal financial advisor. Format output cleanly.");
        let parsedReply = reply.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');
        document.getElementById('typing').remove(); db.chatHistory.push({ role: 'ai', content: reply }); log.innerHTML += `<div class="chat-bubble ai">${parsedReply}</div>`; saveData(); log.scrollTop = log.scrollHeight; haptic([30, 50]);
    } catch (e) { document.getElementById('typing').remove(); log.innerHTML += `<div class="chat-bubble ai" style="color:var(--md-error);">Connection failed. Check API Keys in settings.</div>`; }
}

async function fetchAIPrediction() {
    if (!db.geminiKey && !db.groqKey) return;
    let predictEl = document.getElementById('ai-predict-text');
    let now = new Date(); let mSums = [];
    for (let i = 3; i >= 0; i--) {
        let m = now.getMonth() - i; let y = now.getFullYear();
        if (m < 0) { m += 12; y -= 1; }
        let monthInv = db.investments.filter(inv => { let d = new Date(inv.date); return d.getMonth() === m && d.getFullYear() === y && !inv.isDividend; }).reduce((sum, inv) => sum + inv.amount, 0);
        mSums.push(monthInv);
    }
    let autoSipTotal = db.recurring.reduce((s, r) => s + r.amount, 0);
    let prompt = `User past 4 months totals: ${mSums.join(', ')}. Net worth: ${currentTotalNW}. Auto-SIPs: ${autoSipTotal}. Output ONLY: forecasted amount in <strong> tags, then one short encouraging sentence (max 10 words). Raw HTML, no codeblocks.`;
    try {
        let htmlResp = await callAIApi(prompt, "You are a financial projection engine. Return raw HTML only.");
        predictEl.innerHTML = htmlResp + ` <span style="font-size:11px;color:var(--md-primary);cursor:pointer;" onclick="openAIPredictSheet()">Details →</span>`;
    } catch (e) { predictEl.innerHTML = `<span style="font-size:12px;">Add API key in Settings for AI forecasts.</span>`; }
}

async function openAIPredictSheet() {
    haptic(30);
    if (!db.geminiKey && !db.groqKey) { showSnackbar('Add API Key in Settings', 'key'); return; }
    document.getElementById('scrim-sub').classList.add('active');
    document.getElementById('ai-predict-sheet').classList.add('active');
    let content = document.getElementById('ai-predict-sheet-content');
    content.innerHTML = `<div style="padding:24px;text-align:center;color:var(--md-primary);"><span class="material-symbols-rounded ai-loading-icon" style="font-size:32px;">autorenew</span><div style="margin-top:12px;font-size:14px;">Generating category-wise forecast...</div></div>`;

    // Build category monthly data (last 3 months per category)
    let now = new Date(); let catMonthly = {};
    Object.keys(db.categories).forEach(cat => { catMonthly[cat] = []; });
    for (let i = 2; i >= 0; i--) {
        let m = now.getMonth() - i; let y = now.getFullYear();
        if (m < 0) { m += 12; y -= 1; }
        Object.keys(db.categories).forEach(cat => {
            let sum = db.investments.filter(inv => { let d = new Date(inv.date); return inv.type === cat && d.getMonth() === m && d.getFullYear() === y && !inv.isDividend; }).reduce((s, i) => s + i.amount, 0);
            catMonthly[cat].push(sum);
        });
    }
    let autoSips = {};
    db.recurring.forEach(r => { autoSips[r.type] = (autoSips[r.type] || 0) + r.amount; });

    let prompt = `You are a financial AI. Given this user data, predict next month investment for each category. Return ONLY a JSON array: [{"category":"X","predicted":N,"trend":"up|down|stable","reason":"short reason"}]. Categories data (last 3 months each): ${JSON.stringify(catMonthly)}. Auto-SIPs per category: ${JSON.stringify(autoSips)}. Net worth: ${currentTotalNW}. Salary: ${db.userProfile.salary}. Only include categories with investments. No markdown.`;

    try {
        let raw = await callAIApi(prompt, "You return only valid JSON arrays. No markdown.");
        raw = raw.replace(/```json|```/g, '').trim();
        let predictions = JSON.parse(raw);
        let total = predictions.reduce((s, p) => s + p.predicted, 0);
        let html = `<div style="background:var(--md-primary-container);color:var(--md-on-primary-container);border-radius:24px;padding:24px;margin-bottom:24px;text-align:center;">
                    <div style="font-size:14px;font-weight:500;opacity:0.8;margin-bottom:4px;">Predicted Total Next Month</div>
                    <div style="font-size:36px;font-weight:600;">₹${formatInr(total)}</div>
                </div><div style="display:flex;flex-direction:column;gap:12px;">`;
        predictions.forEach(p => {
            let meta = db.categories[p.category] || { color: '#8D6E63', icon: 'savings' };
            let trendIcon = p.trend === 'up' ? 'trending_up' : p.trend === 'down' ? 'trending_down' : 'trending_flat';
            let trendColor = p.trend === 'up' ? 'var(--md-success)' : p.trend === 'down' ? 'var(--md-error)' : 'var(--md-outline)';
            let trendBg = p.trend === 'up' ? 'var(--md-success-container)' : p.trend === 'down' ? 'var(--md-error-container)' : 'var(--md-surface-container-highest)';
            html += `<div class="md-card" style="margin-bottom:0;display:flex;align-items:center;gap:16px;padding:16px;border-left:4px solid ${meta.color};">
                        <div style="width:48px;height:48px;border-radius:16px;background:${meta.color}20;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                            <span class="material-symbols-rounded" style="color:${meta.color};font-size:24px;">${meta.icon}</span>
                        </div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:16px;font-weight:600;color:var(--md-on-surface);">${p.category}</div>
                            <div style="font-size:13px;color:var(--md-on-surface-variant);margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${p.reason}</div>
                        </div>
                        <div style="text-align:right;flex-shrink:0;">
                            <div style="font-size:18px;font-weight:600;color:var(--md-on-surface);">₹${formatInr(p.predicted)}</div>
                            <div style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;background:${trendBg};padding:4px 8px;border-radius:8px;">
                                <span class="material-symbols-rounded" style="font-size:14px;color:${trendColor};">${trendIcon}</span>
                                <span style="font-size:12px;font-weight:600;color:${trendColor};text-transform:capitalize;">${p.trend}</span>
                            </div>
                        </div>
                    </div>`;
        });
        html += `</div>`;
        content.innerHTML = html;
    } catch (e) {
        content.innerHTML = `<div style="padding:16px;color:var(--md-error);text-align:center;">Failed to generate prediction. Check API keys.</div>`;
    }
}

async function autoSetGoalsViaAI() {
    haptic(40);
    if (!db.geminiKey && !db.groqKey) { showSnackbar("API Key Required", "key"); return; }
    showSnackbar("AI calculating optimal goals...", "auto_awesome");
    let sal = db.userProfile.salary || 0;
    if (sal === 0) return showSnackbar("Please set Salary in Settings first.", "error");

    let prompt = `User earns ₹${sal} annually. Return ONLY valid JSON: {"Emergency Fund": <suggested_target_6x_monthly_expenses>, "Liquid Cash": <suggested_1x_monthly_expenses>}. No other text.`;
    try {
        let res = await callAIApi(prompt, "You return only JSON.");
        let data = JSON.parse(res);

        let ef = db.goals.find(g => g.name === "Emergency Fund");
        if (ef) ef.target = data["Emergency Fund"]; else db.goals.push({ id: Date.now(), name: "Emergency Fund", target: data["Emergency Fund"], saved: 0, linkedCategory: "Liquid" });

        let lc = db.goals.find(g => g.name === "Liquid Cash");
        if (lc) lc.target = data["Liquid Cash"]; else db.goals.push({ id: Date.now() + 1, name: "Liquid Cash", target: data["Liquid Cash"], saved: 0, linkedCategory: "Cash" });

        saveData(); renderAll(); showSnackbar("Goals Auto-Synced!", "check_circle");
    } catch (e) { showSnackbar("AI Sync Failed", "error"); }
}

async function askAIEngine(context) {
    haptic(40);
    if (!db.geminiKey && !db.groqKey) {
        showSnackbar("Save Groq or Gemini Key First", "key");
        setTimeout(openSettings, 1000);
        return;
    }
    let aiContainer = document.getElementById('ai-response-container');
    aiContainer.innerHTML = `<div style="padding:24px;text-align:center;color:var(--md-primary);"><span class="material-symbols-rounded ai-loading-icon" style="font-size:32px;">autorenew</span><br><br>Generating structured AI analysis...</div>`;
    document.getElementById('ai-report-charts').style.display = 'none';
    document.getElementById('scrim').classList.add('active'); document.getElementById('ai-sheet').classList.add('active');

    let payload = {}; let promptBase = "";
    if (context === 'full_report') {
        payload = { netWorth: currentTotalNW, salary: db.userProfile.salary, activeSips: db.recurring, tax80c: currentTax80c, taxLiability: calculateStrictTax().liability, allocation: currentTypeTotals, goals: db.goals };
        promptBase = `Based on this exact user data: ${JSON.stringify(payload)}, generate a gorgeous HTML report using inline CSS matching a light theme (like #F9F9FF background, #415F91 primary). You MUST output ONLY raw HTML without markdown block indicators. Include sections: 1. Executive Summary, 2. Asset Allocation Breakdown (as an HTML table with solid background headers and borders), 3. Trajectory & Goals, and 4. Strategic Recommendations. Make it look exactly like a premium financial matrix insight report with clear padding, border-radius, and modern fonts.`;
    }
    else if (context === 'allocation') { payload = { allocation: currentTypeTotals, targets: db.allocTargets }; promptBase = `Review allocation vs targets: ${JSON.stringify(payload)}. Note concentration risks. Provide ONLY valid HTML snippet (using <h3>, <p>, <ul>).`; }
    else if (context === 'ledger') { payload = { recent: db.investments.slice(-20) }; promptBase = `Review the user's last 20 transactions: ${JSON.stringify(payload)}. Analyze habits and spot anomalies. Provide ONLY valid HTML snippet (using <h3>, <p>, <ul>).`; }

    try {
        let rawHtml = await callAIApi(promptBase, "You are an elite wealth manager that speaks exclusively in beautifully formatted HTML.");
        aiContainer.innerHTML = rawHtml;

        if (context === 'full_report') {
            document.getElementById('ai-report-charts').style.display = 'flex';
            renderAIReportCharts(currentTypeTotals);
        }
        haptic([30, 50]);
    } catch (error) { aiContainer.innerHTML = `<p style="color:var(--md-error);">Failed. Check your internet connection and API keys.</p>`; showSnackbar("API Failed", "error"); }
}

function renderAIReportCharts(typeTotals) {
    let pieCtx = document.getElementById('aiChartPie');
    let barCtx = document.getElementById('aiChartBar');
    if (!pieCtx || !barCtx) return;

    let labels = []; let data = []; let bgColors = [];
    Object.keys(typeTotals).forEach(t => { if (typeTotals[t] > 0) { labels.push(t); data.push(typeTotals[t]); bgColors.push(db.categories[t].color); } });

    if (aiReportCharts.pie) aiReportCharts.pie.destroy();
    aiReportCharts.pie = new Chart(pieCtx, { type: 'doughnut', data: { labels: labels, datasets: [{ data: data, backgroundColor: bgColors }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });

    if (aiReportCharts.bar) aiReportCharts.bar.destroy();
    aiReportCharts.bar = new Chart(barCtx, { type: 'bar', data: { labels: labels, datasets: [{ data: data, backgroundColor: bgColors }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } } });
}

function downloadAIReport() {
    let element = document.getElementById('ai-sheet');
    let opt = { margin: 0.5, filename: 'Wealth_Matrix_Report.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
    html2pdf().set(opt).from(element).save();
    showSnackbar("Downloading PDF...");
}

async function generateAITags() {
    haptic(40);
    if (!db.geminiKey && !db.groqKey) return showSnackbar("Please add API Key in Settings.", "key");
    let note = document.getElementById('inv-note').value; if (!note) return showSnackbar("Enter an Asset Note first.", "edit");
    let tagInput = document.getElementById('inv-tags'); tagInput.value = "Generating...";
    let prompt = `Provide exactly 3 comma‑separated short tags (no hashtags) for a financial asset of type '${currentInvType}' with note '${note}'. Examples: tax, equity, longterm.`;
    try { let tags = await callAIApi(prompt, "You return comma-separated lists of tags only."); tagInput.value = tags; haptic([30, 50]); } catch (e) { tagInput.value = ""; showSnackbar("AI Tag generation failed.", "error"); }
}

// ==========================================
function processRecurring() {
    let today = new Date(); let updated = false;
    db.recurring.forEach(rec => {
        let nextDate = new Date(rec.nextRun); let maxSafety = 24;
        while (nextDate <= today && maxSafety > 0) {
            db.investments.push({
                id: Date.now() + Math.random(), date: getLocalYYYYMMDD(nextDate), type: rec.type, amount: rec.amount, note: rec.note + ' (Auto)', tags: rec.tags || '', isDividend: false, account: rec.account || db.accounts[0]
            });
            nextDate.setMonth(nextDate.getMonth() + 1); rec.nextRun = getLocalYYYYMMDD(nextDate); updated = true; maxSafety--;
        }
    });
    if (updated) { saveData(); showSnackbar("Auto‑SIPs Processed"); }
}


// ==========================================
// 9. MASTER RENDER ENGINE
// ==========================================
function renderAll() {
    let dividendTotal = db.investments.filter(i => i.isDividend).reduce((s, i) => s + i.amount, 0);
    let dtEl = document.getElementById('dashboard-dividend-total'); if (dtEl) dtEl.innerText = formatMoney(dividendTotal);
    let dsEl = document.getElementById('dividend-sheet-total'); if (dsEl) dsEl.innerText = formatMoney(dividendTotal);

    activeAccountFilter = document.getElementById('account-filter').value;
    document.getElementById('active-acc-label').innerText = activeAccountFilter;

    let now = new Date(); let currentM = now.getMonth(); let currentY = now.getFullYear();
    let lastM = currentM === 0 ? 11 : currentM - 1; let lastMY = currentM === 0 ? currentY - 1 : currentY;

    let totalNW = 0, totalMarketValue = 0, thisMonthTotal = 0, lastMonthTotal = 0, yearTotal = 0;
    let typeTotals = {}, typeLastDate = {}, maturities = [], tax80cTotal = 0, totalInvestedAll = 0;

    Object.keys(db.categories).forEach(t => {
        typeTotals[t] = 0;
        typeLastDate[t] = null;
    });

    // STRICT VALUATION LOGIC
    Object.keys(db.categories).forEach(type => {
        let filteredInvs = db.investments.filter(inv => inv.type === type && (activeAccountFilter === 'All' || inv.account === activeAccountFilter));
        let totalInvested = filteredInvs.filter(i => !i.isDividend).reduce((sum, inv) => sum + inv.amount, 0) + (db.categoryDetails[type]?.initialBal || 0);
        totalInvestedAll += totalInvested;

        let exactValuation = calculateStrictValuation(type, totalInvested, filteredInvs);
        typeTotals[type] = exactValuation;
        totalMarketValue += exactValuation;
        totalNW += totalInvested;
    });

    // Month Totals & Maturities Loop
    db.investments.forEach(inv => {
        if (activeAccountFilter !== 'All' && inv.account !== activeAccountFilter) return;
        let d = new Date(inv.date);
        if (inv.maturityDate) { let mDate = new Date(inv.maturityDate); let diffDays = Math.ceil((mDate - now) / (1000 * 60 * 60 * 24)); if (diffDays >= 0 && diffDays <= 90) { maturities.push({ ...inv, days: diffDays, dateObj: mDate }); } }
        if (!inv.isDividend) {
            if (d.getFullYear() === currentY && d.getMonth() === currentM) thisMonthTotal += inv.amount;
            if (d.getFullYear() === lastMY && d.getMonth() === lastM) lastMonthTotal += inv.amount;
            if (d.getFullYear() === currentY) yearTotal += inv.amount;
            if (db.categories[inv.type] && db.categories[inv.type].is80c && isCurrentFY(inv.date)) tax80cTotal += inv.amount;
        }
        if (!typeLastDate[inv.type] || d > new Date(typeLastDate[inv.type])) { typeLastDate[inv.type] = inv.date; }
    });

    currentTax80c = tax80cTotal;
    let wasBelowMilestone = Math.floor(currentTotalNW / 100000);
    currentTotalNW = totalMarketValue;
    currentTypeTotals = typeTotals;
    currentAvgMonthly = (currentM + 1) > 0 ? (yearTotal / (currentM + 1)) : 0;

    let isNowAboveMilestone = Math.floor(currentTotalNW / 100000);
    if (isNowAboveMilestone > wasBelowMilestone && isNowAboveMilestone >= 1) window.fireMilestoneConfetti();
    checkMilestones(currentTotalNW);

    document.getElementById('networth-val').innerText = formatMoney(totalMarketValue);
    document.getElementById('last-month-val').innerText = formatMoney(lastMonthTotal);
    document.getElementById('next-month-val').innerText = formatMoney(db.projectionNextMonth);

    // Update Dashboard Tax Liability
    let taxObj = calculateStrictTax();
    let dashTax = document.getElementById('dash-tax-liab');
    if (dashTax) { dashTax.innerText = taxObj.str; dashTax.style.color = taxObj.liability === 0 ? "var(--md-success)" : "var(--md-error)"; }

    let monthInvestedEl = document.getElementById('monthly-invested-display'); if (monthInvestedEl) monthInvestedEl.innerText = formatMoney(thisMonthTotal);

    updateProjectionSlider();

    let activeTab = document.querySelector('.tab-content.active');
    if (activeTab && activeTab.id === 'tab-dashboard') { renderNWChart(); renderRollingChart(); }
    if (activeTab && activeTab.id === 'tab-portfolio') renderDonutChart(typeTotals, totalMarketValue);

    renderHeatmap(); fetchAIPrediction();
    updateStatChips(totalInvestedAll, totalMarketValue, yearTotal);
    renderRecurringSheet();
    // Entry count badge
    let badgeEl = document.getElementById('ledger-entry-badge');
    if (badgeEl) { let cnt = db.investments.length; badgeEl.style.display = cnt > 0 ? 'block' : 'none'; badgeEl.textContent = cnt > 99 ? '99+' : cnt; }

    let tplHtml = ""; db.templates.forEach((tpl, idx) => { let meta = db.categories[tpl.type] || { icon: 'bolt' }; tplHtml += `<div class="quick-template-card" onclick="executeQuickLog(${idx})"><span class="material-symbols-rounded qt-icon">${meta.icon}</span><div class="qt-text">${tpl.note} ${formatMoney(tpl.amount)}</div><span class="material-symbols-rounded" style="font-size:16px;opacity:0.5;margin-left:4px;" onclick="deleteQuickLog(event,${idx})">close</span></div>`; });
    let qtWrapper = document.getElementById('quick-templates-list'); if (qtWrapper) { qtWrapper.innerHTML = tplHtml; qtWrapper.style.display = tplHtml ? 'flex' : 'none'; }

    let fireFill = document.getElementById('fire-fill');
    if (fireFill && db.fireTargetMonthly > 0) { let t = db.fireTargetMonthly * 300; fireFill.style.width = Math.min(100, (currentTotalNW / t) * 100) + '%'; document.getElementById('fire-saved').innerText = formatMoney(currentTotalNW); document.getElementById('fire-target').innerText = `Target: ${formatMoney(t)}`; let remaining = t - currentTotalNW; if (remaining > 0 && currentAvgMonthly > 0) { let monthsLeft = Math.ceil(remaining / currentAvgMonthly); let fireDate = new Date(); fireDate.setMonth(fireDate.getMonth() + monthsLeft); document.getElementById('fire-eta').innerText = `FIRE Year: ${fireDate.getFullYear()}`; } else { document.getElementById('fire-eta').innerText = `🔥 FIRE ACHIEVED!`; } }

    let taxValEl = document.getElementById('tax-val');
    if (taxValEl) { taxValEl.innerText = `${formatMoney(tax80cTotal)} / 1.5L`; document.getElementById('tax-fill').style.width = Math.min(100, (tax80cTotal / 150000) * 100) + '%'; let taxAlert = document.getElementById('tax-rollover-alert'); if (taxAlert) { taxAlert.style.display = tax80cTotal >= 150000 ? 'block' : 'none'; } }

    let matSection = document.getElementById('maturity-section');
    if (matSection) { if (maturities.length > 0) { maturities.sort((a, b) => a.days - b.days); document.getElementById('maturity-list').innerHTML = maturities.map(m => `<div class="maturity-card md-card" style="margin-bottom:0; flex-shrink:0; padding:12px; min-width:120px;" onclick="openInvestSheet(${m.id})"><div class="mat-title" style="font-size:14px; font-weight:500;">${m.note || m.type}</div><div class="mat-days" style="color:var(--md-primary); font-size:22px; margin-top:4px;">${m.days} <span style="font-size:12px;">Days</span></div></div>`).join(''); matSection.style.display = 'block'; } else { matSection.style.display = 'none'; } }

    let allocBar = document.getElementById('alloc-bar');
    if (allocBar) { let allocHtml = "", legendHtml = "", rebalanceHtml = "", hasRebalanceTargets = false; Object.keys(typeTotals).forEach(t => { let value = typeTotals[t]; if (value > 0) { let perc = (value / totalMarketValue) * 100; let color = db.categories[t].color; allocHtml += `<div class="alloc-segment" style="width:${perc}%;background:${color};"></div>`; legendHtml += `<span><span class="alloc-dot" style="background:${color}; display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:4px;"></span>${t} ${perc.toFixed(0)}%</span>`; } if (db.allocTargets[t]) { hasRebalanceTargets = true; let targetAmt = (db.allocTargets[t] / 100) * (totalMarketValue + db.projectionNextMonth); let diff = targetAmt - value; if (diff > 0 && db.projectionNextMonth > 0) { let investNext = Math.min(diff, db.projectionNextMonth); rebalanceHtml += `<div class="reb-item" style="display:flex; justify-content:space-between; margin-bottom:6px;"><span><span class="alloc-dot" style="background:${db.categories[t].color}; display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px;"></span>${t}</span> <span style="color:var(--md-primary);">+${formatMoney(investNext)}</span></div>`; } } }); allocBar.innerHTML = allocHtml; document.getElementById('alloc-legend').innerHTML = legendHtml; let rebSec = document.getElementById('rebalance-section'); if (hasRebalanceTargets && db.projectionNextMonth > 0 && rebalanceHtml !== "") { rebSec.innerHTML = `<div class="rebalance-card" style="background:var(--md-surface); border:1px solid var(--md-outline-variant); border-radius:16px; padding:16px;"><div class="rebalance-title" style="font-weight:500; margin-bottom:4px; display:flex; align-items:center; gap:6px;"><span class="material-symbols-rounded" style="font-size:18px; color:var(--md-primary);">balance</span> Rebalance Guide</div><div style="font-size:12px;color:var(--md-on-surface-variant);margin-bottom:12px;">Suggested split for your ${formatMoney(db.projectionNextMonth)} target:</div><div class="rebalance-list">${rebalanceHtml}</div></div>`; rebSec.style.display = 'block'; } else { rebSec.style.display = 'none'; } }

    let portGrid = document.getElementById('portfolio-grid');
    if (portGrid) { let activeCats = Object.keys(typeTotals).filter(t => typeTotals[t] > 0 || db.allocTargets[t]); portGrid.innerHTML = activeCats.length === 0 ? `<div class="empty-state-premium" style="grid-column:1 / -1;"><span class="material-symbols-rounded">pie_chart</span><div class="es-title">Empty Portfolio</div></div>` : activeCats.map(t => { let meta = db.categories[t]; let dObj = new Date(typeLastDate[t]); let dateStr = typeLastDate[t] ? `${dObj.getDate()} ${dObj.toLocaleString('default', { month: 'short' })}` : "No entries"; let cur = typeTotals[t]; let inv = db.investments.filter(i => i.type === t && !i.isDividend && (activeAccountFilter === 'All' || i.account === activeAccountFilter)).reduce((s, i) => s + i.amount, 0) + (db.categoryDetails[t]?.initialBal || 0); let prof = cur - inv; let roiHtml = prof !== 0 ? `<div class="roi-tag ${prof > 0 ? 'positive' : 'negative'}">${prof > 0 ? '+' : ''}${formatMoney(prof)}</div>` : ""; let intRate = db.categoryDetails[t]?.interestRate; let intRateHtml = intRate ? `<div style="font-size:10px;background:var(--md-surface-container-highest);padding:2px 6px;border-radius:4px;font-weight:700;color:var(--md-primary);">${intRate}% APY</div>` : ""; return `<div class="port-card" onclick="openCategoryDetails('${t}')"><div style="display:flex;justify-content:space-between;align-items:flex-start;"><div class="port-icon" style="background:${meta.color};"><span class="material-symbols-rounded" style="font-size:20px;">${meta.icon}</span></div>${intRateHtml}</div><div class="port-type">${t}</div><div class="port-amt">${formatMoney(cur)}</div>${roiHtml}<div class="port-date" style="font-size:11px; margin-top:4px; color:var(--md-outline);">Last: ${dateStr}</div></div>`; }).join(''); }

    let goalsList = document.getElementById('goals-list');
    if (goalsList) { goalsList.innerHTML = db.goals.length === 0 ? `<div class="empty-state-premium"><span class="material-symbols-rounded">flag</span><div class="es-title">No Goals Set</div></div>` : db.goals.map(g => { let savedAmt = g.saved, isLinked = false; let monthlyContrib = 0; if (g.linkedCategory) { if (typeTotals[g.linkedCategory] !== undefined) { savedAmt = typeTotals[g.linkedCategory]; isLinked = true; } monthlyContrib = db.recurring.filter(r => r.type === g.linkedCategory).reduce((s, r) => s + r.amount, 0); } let perc = Math.min(100, (savedAmt / g.target) * 100); let linkTag = isLinked ? `<span class="goal-linked-tag" style="font-size:10px; background:var(--md-surface-container-highest); padding:2px 6px; border-radius:4px; margin-left:6px;">Linked: ${g.linkedCategory}</span>` : ''; let forecastHtml = ''; if (savedAmt < g.target && monthlyContrib > 0) { let monthsLeft = Math.ceil((g.target - savedAmt) / monthlyContrib); let fDate = new Date(); fDate.setMonth(fDate.getMonth() + monthsLeft); forecastHtml = `<div style="font-size:11px;color:var(--md-primary);margin-top:8px;font-weight:500;">🎯 Expected hit: ${fDate.toLocaleString('default', { month: 'short' })} ${fDate.getFullYear()}</div>`; } return `<div class="goal-card" onclick="openGoalSheet(${g.id})"><div class="goal-header"><div class="goal-title">${g.name} ${linkTag}</div><div class="goal-amt" style="font-size:14px;">${formatMoney(savedAmt)} / ${formatMoney(g.target)}</div></div><div class="goal-track"><div class="goal-fill" style="width:${perc}%;"></div></div><div class="goal-footer" style="font-size:12px; color:var(--md-on-surface-variant);"><span>${perc.toFixed(1)}% Achieved</span>${forecastHtml}</div></div>`; }).join(''); }

    let sInv = db.investments.filter(i => activeAccountFilter === 'All' || i.account === activeAccountFilter).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    document.getElementById('dashboard-history-list').innerHTML = sInv.length === 0 ? `<div class="empty-state-premium"><span class="material-symbols-rounded">history</span><div class="es-title">No Recent Activity</div></div>` : sInv.map(buildUnifiedItemHTML).join('');

    renderHistory();

    let monthTarget = db.settingsTable.monthlyTargetRef || 0; let pct = monthTarget > 0 ? Math.min(100, (thisMonthTotal / monthTarget) * 100) : 0;
    let mTargetDisplay = document.getElementById('monthly-target-display'); if (mTargetDisplay) mTargetDisplay.innerText = formatMoney(monthTarget);
    let pPercent = document.getElementById('progress-percent'); if (pPercent) pPercent.innerText = Math.round(pct) + '%';
    let pCircle = document.getElementById('progress-circle'); if (pCircle) pCircle.style.strokeDashoffset = 188.4 * (1 - pct / 100);

    renderQuickAddChips(); updateRebalanceBadge(); autoBackupReminder();
}

// ==========================================
// 10. EVENT LISTENERS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    initUI();
    processRecurring();
    renderAll();
    checkAppLock();
});

// ==========================================
// PWA: SERVICE WORKER + INSTALL
// ==========================================
let deferredInstallPrompt = null;

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { scope: './' })
            .then(reg => {
                console.log('[PWA] SW registered, scope:', reg.scope);
                // Check for SW updates
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                            showSnackbar('App updated! Refresh for latest version.', 'system_update');
                        }
                    });
                });
            })
            .catch(err => console.error('[PWA] SW registration failed:', err));
    });
}

// Capture the install prompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    console.log('[PWA] Install prompt captured');
    // Show install button
    let installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) installBtn.style.display = 'flex';
});

// Handle app installed
window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    console.log('[PWA] App installed');
    showSnackbar('App installed successfully! 🎉', 'install_mobile');
    let installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) installBtn.style.display = 'none';
});

// Trigger install from button
function triggerPWAInstall() {
    if (!deferredInstallPrompt) {
        showSnackbar('Already installed or not supported in this browser', 'info');
        return;
    }
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(result => {
        console.log('[PWA] User choice:', result.outcome);
        if (result.outcome === 'accepted') {
            showSnackbar('Installing...', 'download');
        }
        deferredInstallPrompt = null;
    });
}

// Detect if running as installed PWA
function isInstalledPWA() {
    return window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
}