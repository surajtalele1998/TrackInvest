/**
 * ui.js - View & Interaction Controller
 * Manages the dashboard, lists, and form logic.
 */
import { formatMoney, formatInr, haptic, showSnackbar, closeOverlays, formatDate } from './utils.js';
import { calculateTax, calculateValuation } from './engine.js';
import { db, getSetting, setSetting } from './db.js';
import { renderPortfolioChart } from './charts.js';

/**
 * Main render function - refreshes everything
 */
export async function renderAll() {
    console.log("[UI] Refreshing View...");
    const investments = await db.investments.toArray();
    const profile = await getSetting('userProfile', { salary: 0 });
    const privacyMode = await getSetting('privacyMode', false);
    const categoryDetails = await getSetting('categoryDetails', {});
    const activeAccount = await getSetting('activeAccount', 'All');

    // 1. Calculate Totals
    let filtered = investments;
    if (activeAccount !== 'All') {
        filtered = investments.filter(i => i.account === activeAccount);
    }
    
    const totalNW = filtered.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    
    // 2. Update Balance Cards
    const nwEl = document.getElementById('total-nw');
    if (nwEl) nwEl.innerText = formatMoney(totalNW, privacyMode);

    // 3. Render Dashboard Components
    renderInvestmentList(filtered.sort((a, b) => new Date(b.date) - new Date(a.date)).reverse(), privacyMode);
    renderCategoryChips(filtered);
    renderSummaryStats(filtered, profile);
    renderGoals();
    renderActivityCalendar(filtered);

    // 4. Update Charts
    const typeTotals = filtered.reduce((acc, inv) => {
        acc[inv.type] = (acc[inv.type] || 0) + inv.amount;
        return acc;
    }, {});
    
    renderPortfolioChart('portfolioChart', {
        labels: Object.keys(typeTotals),
        values: Object.values(typeTotals)
    });

    // 5. Update Tax Card
    const taxInfo = calculateTax(profile, 0); // Simplified tax call
    const taxEl = document.getElementById('tax-liability');
    if (taxEl) taxEl.innerText = taxInfo.str;
    
    // Initialize Lucide Icons
    if (window.lucide) lucide.createIcons();
}

/**
 * Category Chips Rendering
 */
function renderCategoryChips(investments) {
    const container = document.getElementById('category-chips');
    if (!container) return;
    
    const typeTotals = investments.reduce((acc, inv) => {
        acc[inv.type] = (acc[inv.type] || 0) + inv.amount;
        return acc;
    }, {});

    const cats = Object.keys(typeTotals).sort((a,b) => typeTotals[b] - typeTotals[a]);
    container.innerHTML = cats.map(cat => `
        <div class="cat-chip" onclick="ui.openCategoryDetails('${cat}')">
            <span class="cat-name">${cat}</span>
            <span class="cat-val">${formatInr(typeTotals[cat])}</span>
        </div>
    `).join('');
}

/**
 * Summary Stats Rendering
 */
function renderSummaryStats(investments, profile) {
    const investedEl = document.getElementById('total-invested');
    const gainEl = document.getElementById('total-gain');
    if (!investedEl) return;

    const totalInvested = investments.filter(i => !i.isDividend).reduce((s, i) => s + i.amount, 0);
    investedEl.innerText = formatInr(totalInvested);
    
    // Mock gain for now or calculate if current market values exist
    gainEl.innerText = "+₹12,450 (Est.)";
}

/**
 * Goals Rendering
 */
async function renderGoals() {
    const container = document.getElementById('goals-container');
    if (!container) return;
    const goals = await db.goals.toArray();
    
    if (goals.length === 0) {
        container.innerHTML = `<div class="empty-state">No active goals.</div>`;
        return;
    }

    container.innerHTML = goals.map(g => {
        const perc = Math.min(100, (g.saved / g.target) * 100);
        return `
            <div class="md-card" onclick="ui.openGoalSheet(${g.id})">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                    <span style="font-weight:600;">${g.name}</span>
                    <span style="color:var(--md-primary);">${perc.toFixed(0)}%</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width:${perc}%"></div></div>
                <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;opacity:0.7;">
                    <span>${formatInr(g.saved)}</span>
                    <span>Target: ${formatInr(g.target)}</span>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Activity Heatmap Rendering
 */
function renderActivityCalendar(investments) {
    const container = document.getElementById('activity-calendar');
    if (!container) return;
    
    const activity = {};
    investments.forEach(i => {
        activity[i.date] = (activity[i.date] || 0) + 1;
    });

    // Minimal grid for 30 days
    let html = "";
    for(let i=30; i>=0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        const count = activity[ds] || 0;
        const opacity = Math.min(1, count * 0.3);
        html += `<div class="calendar-cell" style="background:rgba(var(--md-primary-rgb), ${opacity})" title="${ds}: ${count} entries"></div>`;
    }
    container.innerHTML = html;
}

/**
 * Renders the primary investment list
 */
function renderInvestmentList(investments, privacyMode) {
    const container = document.getElementById('recent-list');
    if (!container) return;

    if (investments.length === 0) {
        container.innerHTML = `
            <div class="empty-state-premium">
                <i data-lucide="inbox" style="width:48px;height:48px;opacity:0.2;"></i>
                <div class="es-title">No Investments Logged</div>
            </div>`;
        return;
    }

    container.innerHTML = investments.slice(0, 10).map(inv => `
        <div class="unified-item" onclick="ui.openInvestSheet(${inv.id})">
            <div class="unified-icon" style="background:var(--md-primary-container); color:var(--md-on-primary-container);">
                <i data-lucide="trending-up"></i>
            </div>
            <div class="unified-content">
                <div class="unified-title">
                    <span class="title-text">${inv.note || inv.type}</span>
                    <span class="price">${formatMoney(inv.amount, privacyMode)}</span>
                </div>
                <div class="unified-subtitle">${formatDate(inv.date)} • ${inv.type}</div>
            </div>
        </div>
    `).join('');
}

/**
 * Tab Switching Logic
 */
export function switchTab(tabId) {
    haptic(20);
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById(tabId + '-tab').classList.add('active');
    document.getElementById('nav-' + tabId).classList.add('active');
    
    setSetting('lastTab', tabId);
}

/**
 * Sub-sheet Closer
 */
export function closeSubSheet() {
    document.querySelectorAll('.sheet.active').forEach((s, idx, arr) => {
        if(idx === arr.length - 1) s.classList.remove('active');
    });
    if(document.querySelectorAll('.sheet.active').length === 0) {
        document.getElementById('scrim').classList.remove('active');
    }
    document.getElementById('scrim-sub').classList.remove('active');
}

/**
 * Populates Investment Type Chips
 */
function renderTypeChips(selectedType) {
    const container = document.getElementById('type-chips');
    if (!container) return;
    
    const types = ["Mutual Fund", "Stock", "Gold", "Fixed Deposit", "Cash", "Real Estate", "PPF", "EPF"];
    container.innerHTML = types.map(t => `
        <div class="quick-chip ${t === selectedType ? 'active' : ''}" onclick="ui.setInvestType('${t}')">
            ${t}
        </div>
    `).join('');
}

export function setInvestType(type) {
    haptic(20);
    renderTypeChips(type);
    document.getElementById('invest-sheet').dataset.currentType = type;
    
    // Show/Hide MF Specific Fields
    const isMF = type === "Mutual Fund" || type === "Stock";
    document.getElementById('dynamic-mf-search').style.display = isMF ? 'flex' : 'none';
    document.getElementById('dynamic-qty-price').style.display = isMF ? 'flex' : 'none';
    
    // Show/Hide FD fields
    const isFD = type === "Fixed Deposit" || type === "PPF";
    document.getElementById('dynamic-fd-fields').style.display = isFD ? 'flex' : 'none';
}

/**
 * Mutual Fund Search Handler
 */
export async function searchMFForLog() {
    const query = document.getElementById('inv-mf-query').value.trim();
    if (query.length < 3) return showSnackbar("Type at least 3 chars", "warning");
    
    const select = document.getElementById('inv-mf-select');
    select.innerHTML = '<option>Searching...</option>';
    select.style.display = 'block';
    
    import('./market.js').then(async m => {
        const results = await m.searchMutualFunds(query);
        if (results.length === 0) {
            select.innerHTML = '<option>No funds found</option>';
            return;
        }
        select.innerHTML = '<option value="">Select a Fund...</option>' + 
            results.map(r => `<option value="${r.schemeCode}">${r.schemeName}</option>`).join('');
    });
}

/**
 * Handle Fund Selection
 */
export async function handleMFSelectForLog(el) {
    const code = el.value;
    if (!code) return;
    
    showSnackbar("Fetching latest NAV...", "sync");
    import('./market.js').then(async m => {
        const data = await m.fetchNAV(code);
        if (data) {
            document.getElementById('inv-price').value = data.nav;
            document.getElementById('inv-note').value = data.schemeName;
            document.getElementById('inv-mf-code-hidden').value = code;
            calculateDynamicTotal();
        }
    });
}

/**
 * Dynamic Calculations for Units/NAV
 */
export function calculateDynamicTotal() {
    const qty = parseFloat(document.getElementById('inv-qty').value) || 0;
    const price = parseFloat(document.getElementById('inv-price').value) || 0;
    const amt = qty * price;
    if (amt > 0) {
        document.getElementById('inv-amt').value = amt.toFixed(2);
    }
}

export function reverseCalculateUnits() {
    const amt = parseFloat(document.getElementById('inv-amt').value) || 0;
    const price = parseFloat(document.getElementById('inv-price').value) || 0;
    if (price > 0 && amt > 0) {
        document.getElementById('inv-qty').value = (amt / price).toFixed(4);
    }
}

/**
 * Handles Investment Sheet
 */
export async function openInvestSheet(id = null) {
    haptic(30);
    const sheet = document.getElementById('invest-sheet');
    const scrim = document.getElementById('scrim');
    const accounts = await db.accounts.toArray();
    
    // Populate Accounts
    const accSelect = document.getElementById('inv-account');
    if (accSelect) {
        accSelect.innerHTML = accounts.map(a => `<option value="${a.name}">${a.name}</option>`).join('');
    }

    if (id) {
        const inv = await db.investments.get(id);
        if (inv) {
            document.getElementById('inv-amt').value = inv.amount;
            document.getElementById('inv-note').value = inv.note || '';
            document.getElementById('inv-date').value = inv.date;
            document.getElementById('del-inv-btn').style.display = 'block';
            renderTypeChips(inv.type);
            sheet.dataset.editId = id;
            sheet.dataset.currentType = inv.type;
        }
    } else {
        document.getElementById('inv-amt').value = '';
        document.getElementById('inv-note').value = '';
        document.getElementById('inv-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('del-inv-btn').style.display = 'none';
        renderTypeChips("Mutual Fund");
        sheet.dataset.editId = '';
        sheet.dataset.currentType = "Mutual Fund";
    }

    scrim.classList.add('active');
    sheet.classList.add('active');
}

/**
 * Saves Investment to Dexie
 */
export async function saveInvestment() {
    const sheet = document.getElementById('invest-sheet');
    const amt = parseFloat(document.getElementById('inv-amt').value);
    const note = document.getElementById('inv-note').value;
    const date = document.getElementById('inv-date').value;
    const account = document.getElementById('inv-account').value;
    const type = sheet.dataset.currentType;
    const editId = sheet.dataset.editId;
    
    // MF specific metadata
    const mfCode = document.getElementById('inv-mf-code-hidden').value;
    const units = parseFloat(document.getElementById('inv-qty').value) || 0;
    const price = parseFloat(document.getElementById('inv-price').value) || 0;

    if (!amt || !date) {
        showSnackbar("Please enter amount and date", "error");
        return;
    }

    const entry = {
        amount: amt,
        note,
        date,
        account: account || 'Main Portfolio',
        type, 
        mfCode,
        units,
        price,
        timestamp: Date.now()
    };

    if (editId) {
        await db.investments.update(parseInt(editId), entry);
        showSnackbar("Entry Updated");
    } else {
        await db.investments.add(entry);
        showSnackbar("Investment Logged", "check_circle");
    }

    closeOverlays();
    renderAll();
    haptic(40);
}

/**
 * Deletes Investment
 */
export async function deleteInvestment() {
    const sheet = document.getElementById('invest-sheet');
    const editId = sheet.dataset.editId;
    if (!editId) return;

    if (confirm("Are you sure you want to delete this entry?")) {
        await db.investments.delete(parseInt(editId));
        showSnackbar("Entry Deleted");
        closeOverlays();
        renderAll();
        haptic(50);
    }
}

/**
 * Privacy Toggle
 */
export async function togglePrivacy() {
    const current = await getSetting('privacyMode', false);
    await setSetting('privacyMode', !current);
    renderAll();
    haptic(30);
    showSnackbar(!current ? "Privacy Enabled" : "Privacy Disabled", "visibility_off");
}

/**
 * Goal Sheet
 */
export async function openGoalSheet(id = null) {
    haptic(30);
    const sheet = document.getElementById('goal-sheet');
    if (id) {
        const goal = await db.goals.get(id);
        if (goal) {
            document.getElementById('goal-name').value = goal.name;
            document.getElementById('goal-target').value = goal.target;
            document.getElementById('goal-saved').value = goal.saved;
            sheet.dataset.editId = id;
        }
    } else {
        document.getElementById('goal-name').value = '';
        document.getElementById('goal-target').value = '';
        document.getElementById('goal-saved').value = '';
        sheet.dataset.editId = '';
    }
    document.getElementById('scrim').classList.add('active');
    sheet.classList.add('active');
}

/**
 * Save Goal
 */
export async function saveGoal() {
    const name = document.getElementById('goal-name').value;
    const target = parseFloat(document.getElementById('goal-target').value);
    const saved = parseFloat(document.getElementById('goal-saved').value) || 0;
    const editId = document.getElementById('goal-sheet').dataset.editId;

    if (!name || !target) return showSnackbar("Name and Target required", "error");

    const entry = { name, target, saved };
    if (editId) {
        await db.goals.update(parseInt(editId), entry);
    } else {
        await db.goals.add(entry);
    }
    
    closeOverlays();
    renderAll();
    showSnackbar("Goal Saved", "flag");
}

/**
 * Category Details Sheet
 */
export async function openCategoryDetails(type) {
    haptic(30);
    const investments = await db.investments.where('type').equals(type).toArray();
    const privacyMode = await getSetting('privacyMode', false);
    
    document.getElementById('cat-sheet-title').innerText = `${type} Portfolio`;
    
    const total = investments.reduce((s, i) => s + i.amount, 0);
    const container = document.getElementById('cat-history-list');
    if (container) {
        container.innerHTML = investments.map(inv => `
            <div class="unified-item">
                <div class="unified-content">
                    <div class="unified-title">
                        <span>${inv.note || inv.type}</span>
                        <span>${formatMoney(inv.amount, privacyMode)}</span>
                    </div>
                    <div class="unified-subtitle">${inv.date}</div>
                </div>
            </div>
        `).join('');
    }

    document.getElementById('scrim').classList.add('active');
    document.getElementById('category-sheet').classList.add('active');
}

/**
 * Monthly Target Sheet
 */
export async function openMonthlyTargetSheet() {
    haptic(30);
    const target = await getSetting('monthlyTarget', 50000);
    const val = prompt("Set Monthly Investment Target:", target);
    if (val !== null && !isNaN(parseFloat(val))) {
        await setSetting('monthlyTarget', parseFloat(val));
        renderAll();
        showSnackbar("Target Updated", "check_circle");
    }
}

/**
 * Month Details
 */
export function openMonthDetails(mode = 0) {
    haptic(20);
    if (mode === 'tax') {
        showSnackbar("Filtering 80C Tax Savings...", "account_balance");
    } else {
        showSnackbar("Filtering month details...", "calendar_month");
    }
}

/**
 * Projection Sheet
 */
export async function openProjectionSheet() {
    haptic(30);
    const current = await getSetting('monthlyGoal', 0);
    const target = prompt("Enter your monthly investment goal (₹):", current);
    if (target !== null && !isNaN(parseFloat(target))) {
        await setSetting('monthlyGoal', parseFloat(target));
        renderAll();
        showSnackbar("Monthly goal updated!", "check_circle");
    }
}

/**
 * AI Predict Sheet
 */
export async function openAIPredictSheet() {
    haptic(30);
    document.getElementById('scrim-sub').classList.add('active');
    document.getElementById('ai-predict-sheet').classList.add('active');
    // We'll call the ai logic here
    import('./ai.js').then(ai => ai.generateAIForecast());
}

/**
 * Projection Slider
 */
export async function updateProjectionSlider() {
    const months = parseInt(document.getElementById('proj-slider').value) || 12;
    const label = document.getElementById('proj-month-label');
    if (label) label.innerText = months;
    
    try {
        const investments = await db.investments.toArray();
        const settings = await db.settings.get('navCache') || { value: {} };
        const navCache = settings.value || {};
        const monthlySIP = await getSetting('monthlyTarget', 50000);
        
        let currentNW = 0;
        const allocation = {};
        
        investments.forEach(inv => {
            let val = parseFloat(inv.amount) || 0;
            if (inv.mfCode && navCache[inv.mfCode]) {
                val = (parseFloat(inv.units) || 0) * (parseFloat(navCache[inv.mfCode].nav) || 0);
            }
            allocation[inv.type] = (allocation[inv.type] || 0) + val;
            currentNW += val;
        });

        const importEngine = await import('./engine.js');
        const projection = importEngine.calculateNWProjection(currentNW, allocation, monthlySIP, months);
        
        const display = document.getElementById('projected-eoy');
        if (display) {
            display.innerText = `₹${numeral(projection.projectedNW).format('0.00a')}`;
            display.title = `Est. Return: ${projection.weightedReturn.toFixed(1)}% | Real: ${projection.realReturn.toFixed(1)}%`;
        }
    } catch (e) {
        console.error("Projection Update Error:", e);
    }
}

/**
 * Wealth Blueprint Sheet
 */
export async function openWealthBlueprint() {
    haptic(40);
    document.getElementById('scrim-sub').classList.add('active');
    document.getElementById('wealth-blueprint-sheet').classList.add('active');
    import('./ai.js').then(ai => ai.generateWealthBlueprint());
}

/**
 * Rebalance Audit Sheet
 */
export async function openRebalanceSheet() {
    haptic(40);
    document.getElementById('scrim-sub').classList.add('active');
    document.getElementById('rebalance-sheet').classList.add('active');
    import('./ai.js').then(ai => ai.generateRebalanceAudit());
}
