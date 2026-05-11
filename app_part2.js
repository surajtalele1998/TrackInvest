function saveInvestment() {
    haptic(40);
    let date = document.getElementById('inv-date').value;
    let amt = parseFloat(document.getElementById('inv-amt').value);
    let note = document.getElementById('inv-note').value;
    let tags = document.getElementById('inv-tags').value.replace(/#/g, '');
    let subCat = document.getElementById('inv-subcat').value;
    let broker = document.getElementById('inv-broker').value;
    let growth = parseFloat(document.getElementById('inv-growth').value) || null;
    let isDiv = document.getElementById('inv-dividend').checked;
    let acc = document.getElementById('inv-account').value;
    let matDate = document.getElementById('inv-maturity-simple').value;
    let intRate = parseFloat(document.getElementById('inv-interest').value) || null;
    let initialPayment = parseFloat(document.getElementById('inv-initial-payment').value) || null;
    let isTemplate = document.getElementById('inv-template') ? document.getElementById('inv-template').checked : false;
    let isRecurring = document.getElementById('inv-recurring') ? document.getElementById('inv-recurring').checked : false;
    let units = parseFloat(document.getElementById('inv-units-hidden').value) || null;
    let mfCode = document.getElementById('inv-mf-code-hidden').value || null;
    let isMonthlyContrib = document.getElementById('inv-is-monthly').checked;
    let payoutType = document.getElementById('inv-payout').value;
    let investMode = document.getElementById('inv-mode').value;
    let sipDay = parseInt(document.getElementById('inv-sip-day').value) || null;

    // Validation with field-specific error messages
    if (!date || isNaN(amt)) {
        showSnackbar("Date and Amount required", "error");
        document.getElementById('inv-date')?.focus();
        return;
    }
    if (amt <= 0) {
        showSnackbar("Amount must be greater than zero", "error");
        document.getElementById('inv-amt')?.focus();
        return;
    }
    if (units !== null && units <= 0) {
        showSnackbar("Units must be greater than zero", "error");
        document.getElementById('inv-qty')?.focus();
        return;
    }
    if (intRate !== null && (intRate < 0 || intRate > 25)) {
        showSnackbar("Interest rate must be between 0% and 25%", "error");
        document.getElementById('inv-interest')?.focus();
        return;
    }
    if (matDate && date) {
        let matD = new Date(matDate);
        let invD = new Date(date);
        if (matD <= invD) {
            showSnackbar("Maturity date must be after investment date", "error");
            document.getElementById('inv-maturity-simple')?.focus();
            return;
        }
        // Check if maturity is unreasonably far (>50 years)
        let yearsDiff = (matD - invD) / (1000 * 60 * 60 * 24 * 365.25);
        if (yearsDiff > 50) {
            showSnackbar("Maturity cannot exceed 50 years from investment", "warning");
        }
    }
    if (initialPayment !== null && initialPayment <= 0) {
        showSnackbar("Initial payment must be greater than zero", "error");
        document.getElementById('inv-initial-payment')?.focus();
        return;
    }
    
    // Date range validation - prevent future dates more than 1 day ahead
    let investmentDate = new Date(date);
    let today = new Date();
    today.setHours(23, 59, 59, 999);
    if (investmentDate > today) {
        showSnackbar("Investment date cannot be in the future", "error");
        document.getElementById('inv-date')?.focus();
        return;
    }
    // Prevent very old dates (before 2000)
    let year2000 = new Date('2000-01-01');
    if (investmentDate < year2000) {
        showSnackbar("Investment date cannot be before year 2000", "error");
        document.getElementById('inv-date')?.focus();
        return;
    }
    
    // Duplicate detection within 1 hour for same date/type/amount
    if (!editInvId) {
        let oneHourAgo = Date.now() - (60 * 60 * 1000);
        let recentDuplicate = db.investments.find(i => 
            i.date === date && 
            i.type === currentInvType && 
            i.amount === amt && 
            db.lastUpdated > oneHourAgo
        );
        if (recentDuplicate) {
            showSnackbar("Similar entry added recently. Check for duplicates.", "warning");
        }
    }
    let newEntry = {
        id: editInvId || generateUniqueId(),
        date,
        type: currentInvType,
        amount: amt,
        note,
        tags,
        subCategory: subCat,
        broker: broker,
        growthRate: growth,
        isDividend: isDiv,
        account: acc,
        isMonthlyContrib: isMonthlyContrib,
        payoutType: payoutType,
        investMode: investMode,
        sipDay: sipDay
    };

    if (matDate) newEntry.maturityDate = matDate;
    if (intRate) newEntry.interestRate = intRate;
    if (units) newEntry.units = units;
    if (mfCode) newEntry.mfCode = mfCode;

    if (!editInvId && initialPayment > 0) {
        db.investments.push({
            id: generateUniqueId(),
            date,
            type: currentInvType,
            amount: initialPayment,
            note: (note ? note + ' ' : '') + 'Initial Balance',
            tags,
            subCategory: subCat,
            broker: broker,
            isDividend: false,
            account: acc,
            interestRate: intRate
        });
    }
    if (editInvId) { let idx = db.investments.findIndex(i => i.id === editInvId); if (idx > -1) db.investments[idx] = newEntry; } else { db.investments.push(newEntry); }

    if (!editInvId) {
        if (isTemplate) { db.templates.push({ type: currentInvType, amount: amt, note: note || currentInvType, tags: tags, account: acc }); }
        if (isRecurring) { let nextDate = new Date(date); nextDate.setMonth(nextDate.getMonth() + 1); db.recurring.push({ type: currentInvType, amount: amt, note, tags, account: acc, nextRun: getLocalYYYYMMDD(nextDate) }); }
        
        // Save smart defaults for next time
        saveSmartDefault('account_last', acc);
        saveSmartDefault(`account_${currentInvType}`, acc);
        saveSmartDefault('broker_last', broker);
        saveSmartDefault(`broker_${currentInvType}`, broker);
        saveSmartDefault('subcat_last', subCat);
        saveSmartDefault(`subcat_${currentInvType}`, subCat);
    }

    saveData(); renderAll(); closeOverlays(); clearFormDraft();
    
    // Show undo-capable toast for new entries
    if (!editInvId) {
        const lastEntryId = newEntry.id;
        showUndoSnackbar("Investment Logged!", () => {
            // Undo: remove the entry
            db.investments = db.investments.filter(i => i.id !== lastEntryId);
            saveData();
            renderAll();
            showSnackbar("Entry removed", 'undo');
        });
        checkDuplicates(newEntry);
    } else {
        showSnackbar("Entry Updated", "check_circle");
    }
}

// Enhanced snackbar with undo option
function showUndoSnackbar(message, undoCallback) {
    const sb = document.getElementById("snackbar");
    const undoId = 'undo-' + Date.now();
    
    sb.innerHTML = `
        <span class="material-symbols-rounded" style="font-size:20px;">check_circle</span>
        <span style="flex:1;">${message}</span>
        <button id="${undoId}" style="background:none;border:none;color:var(--md-primary);font-weight:600;cursor:pointer;padding:4px 8px;margin-left:8px;border-radius:4px;">
            UNDO
        </button>
    `;
    sb.classList.add("show");
    sb.style.display = 'flex';
    sb.style.alignItems = 'center';
    
    // Attach undo handler
    setTimeout(() => {
        const undoBtn = document.getElementById(undoId);
        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                undoCallback();
                sb.classList.remove("show");
            });
        }
    }, 50);
    
    // Auto-hide after 5 seconds (longer for undo)
    setTimeout(() => {
        sb.classList.remove("show");
    }, 5000);
}

function deleteInvestment() {
    haptic(50); Swal.fire({ title: 'Delete Entry?', text: "This cannot be undone.", icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete' }).then((r) => { if (r.isConfirmed) { db.investments = db.investments.filter(i => i.id !== editInvId); saveData(); renderAll(); closeOverlays(); showSnackbar("Entry Deleted"); } });
}

function executeQuickLog(idx) { haptic(40); let tpl = db.templates[idx]; db.investments.push({ id: generateUniqueId(), date: getLocalYYYYMMDD(new Date()), type: tpl.type, amount: tpl.amount, note: tpl.note, tags: tpl.tags, isDividend: false, account: tpl.account }); saveData(); renderAll(); showSnackbar(`Quick Logged ${formatMoney(tpl.amount)}`); }
function deleteQuickLog(event, idx) { event.stopPropagation(); haptic(40); Swal.fire({ title: 'Delete Template?', showCancelButton: true }).then((res) => { if (res.isConfirmed) { db.templates.splice(idx, 1); saveData(); renderAll(); } }); }

// ==========================================
// 6. LIST BUILDING & SWIPE LOGIC
// ==========================================
function buildUnifiedItemHTML(inv) {
    let meta = db.categories[inv.type] || { icon: 'savings', color: '#8D6E63' };
    let dObj = parseDate(inv.date);
    let dateStr = `${dObj.getDate()} ${dObj.toLocaleString('default', { month: 'short' })} ${dObj.getFullYear()}`;
    let safeNote = escapeHtml(inv.note || inv.type);
    let safeType = escapeHtml(inv.type);
    let tagsHtml = ""; if (inv.tags) { inv.tags.split(',').forEach(t => { if (t.trim()) tagsHtml += `<span class="roi-tag" style="background:var(--md-surface-container-highest);color:var(--md-on-surface-variant);">#${escapeHtml(t.trim())}</span> `; }); }
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
                            <span class="title-text">${safeNote}</span> 
                            <span class="${pClass}">+${formatMoney(inv.amount)}</span>
                        </div>
                        <span class="unified-subtitle">${dateStr} • ${safeType} ${intHtml}</span>
                        ${tagsHtml ? `<div style="margin-top:2px;">${tagsHtml}</div>` : ''}
                    </div>
                </div>
            </div>`;
}

function getEmptyStateHTML(context = 'default') {
    const emptyStates = {
        default: {
            icon: 'inbox',
            title: 'No Entries Yet',
            subtitle: 'Start tracking your wealth journey',
            action: { text: 'Add First Entry', icon: 'add', onclick: 'openInvestSheet()' }
        },
        dashboard: {
            icon: 'account_balance_wallet',
            title: 'Welcome to TrackInvest',
            subtitle: 'Your financial journey starts here. Add your first investment to see your portfolio grow.',
            action: { text: 'Add Investment', icon: 'add_circle', onclick: 'openInvestSheet()' }
        },
        history: {
            icon: 'history',
            title: 'No Transaction History',
            subtitle: 'Your investment history will appear here',
            action: { text: 'Log Investment', icon: 'edit_note', onclick: 'openInvestSheet()' }
        },
        portfolio: {
            icon: 'pie_chart',
            title: 'Portfolio is Empty',
            subtitle: 'Add investments across different categories to build a diversified portfolio',
            action: { text: 'Start Investing', icon: 'trending_up', onclick: 'openInvestSheet()' }
        },
        goals: {
            icon: 'flag',
            title: 'No Goals Set',
            subtitle: 'Set financial goals to track your progress towards financial freedom',
            action: { text: 'Create Goal', icon: 'target', onclick: 'openGoalSheet()' }
        },
        recurring: {
            icon: 'autorenew',
            title: 'No Recurring SIPs',
            subtitle: 'Set up automatic monthly investments to build wealth consistently',
            action: { text: 'Add SIP', icon: 'schedule', onclick: 'openInvestSheet(); setTimeout(()=>document.getElementById(\'inv-is-monthly\').checked=true, 100)' }
        },
        dividend: {
            icon: 'payments',
            title: 'No Passive Income Yet',
            subtitle: 'Mark investments as dividends to track your passive income stream',
            action: { text: 'Add Dividend', icon: 'payments', onclick: 'openInvestSheet(); setTimeout(()=>document.getElementById(\'inv-dividend\').checked=true, 100)' }
        }
    };
    
    const state = emptyStates[context] || emptyStates.default;
    return `<div class="empty-state-premium" style="padding: 40px 24px; text-align: center;">
        <span class="material-symbols-rounded" style="font-size: 48px; color: var(--md-outline); margin-bottom: 16px;">${state.icon}</span>
        <div class="es-title" style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: var(--md-on-surface);">${state.title}</div>
        <div style="font-size: 14px; color: var(--md-on-surface-variant); margin-bottom: 24px; max-width: 280px; margin-left: auto; margin-right: auto;">${state.subtitle}</div>
        <button class="btn-primary" style="display: inline-flex; align-items: center; gap: 8px;" onclick="${state.action.onclick}">
            <span class="material-symbols-rounded" style="font-size: 18px;">${state.action.icon}</span>
            ${state.action.text}
        </button>
    </div>`;
}

function renderListToContainer(arr, containerId, context = 'default') { 
    let html = arr.length === 0 ? getEmptyStateHTML(context) : arr.map(buildUnifiedItemHTML).join(''); 
    let container = document.getElementById(containerId); 
    if (container) { 
        container.innerHTML = html; 
        attachSwipeListeners(container); 
    } 
}

const SEARCH_HISTORY_KEY = 'ledgerSearchHistory';
const MAX_RECENT_SEARCHES = 5;

function getSearchHistory() {
    try {
        return JSON.parse(sessionStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
    } catch (e) {
        return [];
    }
}

function addSearchHistory(term) {
    if (!term || term.length < 2) return; // Don't save very short terms
    let history = getSearchHistory();
    history = history.filter(h => h.toLowerCase() !== term.toLowerCase()); // Remove duplicates
    history.unshift(term);
    history = history.slice(0, MAX_RECENT_SEARCHES);
    sessionStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

function clearSearchHistory() {
    sessionStorage.removeItem(SEARCH_HISTORY_KEY);
    renderSearchHistory();
}

function renderSearchHistory() {
    const container = document.getElementById('search-history-container');
    if (!container) return;
    
    const history = getSearchHistory();
    if (history.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }
    
    container.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center;">
            <span style="font-size:11px;color:var(--md-outline);">Recent:</span>
            ${history.map(term => `
                <button onclick="applySearchTerm('${escapeHtml(term)}')" 
                    style="padding:4px 10px;background:var(--md-surface-container-highest);border:none;border-radius:12px;font-size:12px;color:var(--md-on-surface-variant);cursor:pointer;">
                    ${escapeHtml(term)}
                </button>
            `).join('')}
            <button onclick="clearSearchHistory()" style="padding:4px;background:none;border:none;color:var(--md-outline);cursor:pointer;font-size:11px;">
                Clear
            </button>
        </div>
    `;
    container.style.display = 'block';
}

window.applySearchTerm = function(term) {
    const searchInput = document.getElementById('search-history');
    if (searchInput) {
        searchInput.value = term;
        searchInput.focus();
        renderHistory();
    }
};

function renderHistory() {
    let searchEl = document.getElementById("search-history"), filterEl = document.getElementById("ledger-filter-type"); if (!searchEl || !filterEl) return;
    let term = searchEl.value.toLowerCase(), filterType = filterEl.value;
    let dateFrom = document.getElementById('ledger-date-from')?.value;
    let dateTo = document.getElementById('ledger-date-to')?.value;
    
    // Save search term to history if user has typed something
    if (term && term.length >= 2) {
        addSearchHistory(searchEl.value.trim());
    }
    // Render recent searches
    renderSearchHistory();

    let filtered = db.investments.filter(i => activeAccountFilter === 'All' || i.account === activeAccountFilter);
    if (filterType !== 'All') filtered = filtered.filter(i => i.type === filterType);
    if (term) filtered = filtered.filter(i => i.type.toLowerCase().includes(term) || (i.note && i.note.toLowerCase().includes(term)) || (i.tags && i.tags.toLowerCase().includes(term)) || i.date.includes(term));
    if (dateFrom) filtered = filtered.filter(i => i.date >= dateFrom);
    if (dateTo) filtered = filtered.filter(i => i.date <= dateTo);

    // Sort
    filtered.sort((a, b) => {
        let va, vb;
        if (window.ledgerSort === 'amount') { va = a.amount; vb = b.amount; }
        else if (window.ledgerSort === 'type') { va = a.type; vb = b.type; return window.ledgerAsc ? va.localeCompare(vb) : vb.localeCompare(va); }
        else { va = parseDate(a.date); vb = parseDate(b.date); }
        return window.ledgerAsc ? va - vb : vb - va;
    });

    // Update insights bar
    let liCount = document.getElementById('li-count'); if (liCount) liCount.textContent = filtered.filter(i => !i.isDividend).length;
    let liTotal = filtered.filter(i => !i.isDividend).reduce((s, i) => s + i.amount, 0);
    let liTotalEl = document.getElementById('li-total'); if (liTotalEl) liTotalEl.textContent = formatMoney(liTotal);
    let liAvgEl = document.getElementById('li-avg'); if (liAvgEl) liAvgEl.textContent = filtered.filter(i => !i.isDividend).length > 0 ? formatMoney(Math.round(liTotal / filtered.filter(i => !i.isDividend).length)) : '₹0';

    // Group by month only if sorting by date
    let html = '';
    if (window.ledgerSort === 'date') {
        let groups = {}; filtered.forEach(inv => { let dStr = new Date(inv.date).toLocaleString('default', { month: 'long', year: 'numeric' }); if (!groups[dStr]) groups[dStr] = []; groups[dStr].push(inv); });
        html = Object.keys(groups).length === 0 ? getEmptyStateHTML('history') : Object.keys(groups).map(m => `<div class="ledger-month-header">${m}</div>` + groups[m].map(buildUnifiedItemHTML).join('')).join('');
    } else {
        html = filtered.length === 0 ? getEmptyStateHTML('history') : filtered.map(buildUnifiedItemHTML).join('');
    }
    let container = document.getElementById('ledger-history-list'); if (container) { container.innerHTML = html; attachSwipeListeners(container); }
}
window.renderHistory = renderHistory;
window.buildUnifiedItemHTML = buildUnifiedItemHTML;
window.attachSwipeListeners = attachSwipeListeners;
window.getEmptyStateHTML = getEmptyStateHTML;

function attachSwipeListeners(cE) {
    if (!cE) return; let sX = 0, sY = 0, cX = 0, aI = null, isSw = false, hapticTriggered = false;
    cE.addEventListener('touchstart', e => { let w = e.target.closest('.swipe-wrapper'); if (!w) return; aI = w.querySelector('.front'); if (!aI || !aI.hasAttribute('onclick')) { aI = null; return; } sX = e.touches[0].clientX; sY = e.touches[0].clientY; isSw = false; hapticTriggered = false; aI.classList.add('swiping'); }, { passive: true });
    cE.addEventListener('touchmove', e => { if (!aI) return; cX = e.touches[0].clientX; let cY = e.touches[0].clientY; let dX = cX - sX; let dY = Math.abs(cY - sY); if (!isSw && dY > 10) { aI.classList.remove('swiping'); aI = null; return; } if (Math.abs(dX) > 10) isSw = true; if (isSw) { if (dX > 80) dX = 80; if (dX < -80) dX = -80; aI.style.transform = `translateX(${dX}px)`; 
            // Haptic feedback when crossing swipe thresholds
            if (!hapticTriggered && Math.abs(dX) > 50) {
                haptic(dX < 0 ? [30, 30] : 20); // Different feedback for delete vs edit
                hapticTriggered = true;
            }
        } }, { passive: true });
    cE.addEventListener('touchend', e => { if (!aI) return; aI.classList.remove('swiping'); let dX = cX - sX; let w = aI.closest('.swipe-wrapper'); if (!w) { aI = null; return; } let id = parseFloat(w.getAttribute('data-id')); if (isSw && dX < -50) { haptic(50); aI.style.transform = `translateX(-100%)`; setTimeout(() => { editInvId = id; deleteInvestment(); }, 250); } else if (isSw && dX > 50) { haptic(30); aI.style.transform = `translateX(0px)`; openInvestSheet(id); } else { aI.style.transform = `translateX(0px)`; } aI = null; });
}

// ==========================================
// 7. MODULES (GOALS, FIRE, CATS, SETTINGS)
// ==========================================
function openGoalSheet(id = null) {
    haptic(30);
    editGoalId = id;
    if (id) {
        let g = db.goals.find(g => g.id === id);
        if (!g) return;
        document.getElementById('goal-name').value = g.name;
        document.getElementById('goal-target').value = g.target;
        document.getElementById('goal-saved').value = g.saved;
        document.getElementById('goal-link').value = g.linkedCategory || '';
    } else {
        document.getElementById('goal-name').value = '';
        document.getElementById('goal-target').value = '';
        document.getElementById('goal-saved').value = '';
        document.getElementById('goal-link').value = '';
    }
    openSheet('goal-sheet');
}
function saveGoal() { haptic(40); let name = document.getElementById('goal-name').value; let target = parseFloat(document.getElementById('goal-target').value); let saved = parseFloat(document.getElementById('goal-saved').value) || 0; let link = document.getElementById('goal-link').value; if (!name || isNaN(target)) return showSnackbar("Name and Target required", "error"); let newGoal = { id: editGoalId || Date.now(), name, target, saved, linkedCategory: link }; if (editGoalId) { let idx = db.goals.findIndex(g => g.id === editGoalId); if (idx > -1) db.goals[idx] = newGoal; } else { db.goals.push(newGoal); } saveData(); closeOverlays(); renderAll(); showSnackbar("Goal Saved!", "flag"); }
function openFIRESheet() {
    haptic(30);
    document.getElementById('fire-expenses').value = db.fireTargetMonthly || '';
    openSheet('fire-sheet');
}
function saveFIRE() { haptic(40); db.fireTargetMonthly = parseFloat(document.getElementById('fire-expenses').value) || 0; saveData(); closeOverlays(); renderAll(); showSnackbar("FIRE Target Updated"); }

function openDividendSheet() {
    haptic(30);
    // Audit logic: Only suggest or mark if it's a high-confidence match and NOT already explicitly false
    // But to respect user choice, we only do this once or if requested.
    // For now, let's just use the existing isDividend flag and only highlight potential misses in UI if needed.
    
    const dividends = db.investments.filter(i => i.isDividend).sort((a, b) => parseDate(b.date) - parseDate(a.date));
    const total = dividends.reduce((s, i) => s + i.amount, 0);

    const totalEl = document.getElementById('dividend-sheet-total');
    if (totalEl) totalEl.innerText = formatMoney(total);

    let html = dividends.length === 0 ? 
        `<div class="empty-state-premium" style="margin-top:40px;"><span class="material-symbols-rounded">payments</span><div class="es-title">No Passive Income Recorded</div><div class="es-subtitle">Add investments and mark them as 'Dividend' or use keywords like 'dividend', 'interest' in notes.</div></div>` :
        dividends.map(buildUnifiedItemHTML).join('');

    const listEl = document.getElementById('dividend-list');
    if (listEl) {
        listEl.innerHTML = html;
        if (typeof attachSwipeListeners === 'function') attachSwipeListeners(listEl);
    }

    openSubSheet('dividend-sheet');
}

function openCategoryDetails(type) {
    haptic(30); activeCategory = type; let meta = db.categories[type] || { icon: 'savings', color: '#8D6E63' };
    document.getElementById('cat-sheet-title').innerHTML = `<span class="material-symbols-rounded" style="color:${escapeHtml(meta.color)};">${escapeHtml(meta.icon)}</span> ${escapeHtml(type)} Portfolio`;
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
        assetHtml += `<div class="unified-item"><div class="unified-title" style="flex:1;"><span class="title-text">${escapeHtml(k)}</span> <span style="font-size:11px;color:var(--md-outline);margin-left:6px;flex-shrink:0;">${perc}%</span></div><div class="price">${formatMoney(assets[k])}</div></div>`;
    });
    document.getElementById('cat-asset-list').innerHTML = assetHtml || '<div style="color:var(--md-outline);font-size:14px;text-align:center;padding:16px;">No assets found.</div>';
    renderListToContainer(filtered.sort((a, b) => parseDate(b.date) - parseDate(a.date)), 'cat-history-list');
    
    // Load field configuration checkboxes
    const fieldConfig = db.categoryDetails[type]?.fields || {};
    const allFieldIds = ['interest', 'payout', 'maturity', 'sipday', 'mf', 'qty', 'broker', 'subcat', 'monthly', 'simple', 'growth'];
    allFieldIds.forEach(fid => {
        const el = document.getElementById('cfg-' + fid);
        if (el) el.checked = !!fieldConfig[fid];
    });
    
    openSheet('category-sheet');

    setTimeout(() => { renderCategoryChart(type); }, 300);
}

function saveCatSettings() {
    haptic(40);
    let cmv = parseFloat(document.getElementById('cat-cmv-input').value);
    let alloc = parseFloat(document.getElementById('cat-target-alloc').value);
    let initialBal = parseFloat(document.getElementById('cat-initial-bal').value);
    let intRate = parseFloat(document.getElementById('cat-interest-rate').value);

    if (!db.categoryDetails[activeCategory]) db.categoryDetails[activeCategory] = {};
    if (!isNaN(cmv)) db.currentMarketValues[activeCategory] = cmv; else delete db.currentMarketValues[activeCategory];
    if (!isNaN(alloc)) db.allocTargets[activeCategory] = alloc; else delete db.allocTargets[activeCategory];

    db.categoryDetails[activeCategory].initialBal = !isNaN(initialBal) ? initialBal : 0;
    db.categoryDetails[activeCategory].interestRate = !isNaN(intRate) ? intRate : 0;

    // Save field configurations - preserve all fields including those not in UI yet
    const fields = {};
    const fieldIds = ['interest', 'payout', 'maturity', 'sipday', 'mf', 'qty', 'broker', 'subcat', 'monthly', 'simple', 'growth'];
    fieldIds.forEach(fid => {
        const el = document.getElementById('cfg-' + fid);
        if (el) fields[fid] = el.checked;
    });
    db.categoryDetails[activeCategory].fields = fields;

    saveData(); renderAll(); showSnackbar("Settings Saved", "check_circle"); closeOverlays();
}

function saveProfileSettings() {
    haptic(40);
    db.userProfile.salary = parseFloat(document.getElementById('settings-salary').value) || 0;
    db.userProfile.regime = document.getElementById('settings-regime').value;
    db.userProfile.monthlyExpense = parseFloat(document.getElementById('settings-expenses').value) || 0;
    saveData(); renderAll(); showSnackbar("Profile Updated", "check_circle");
}

function openMonthDetails(offset) {
    haptic(30); let now = new Date(); let m = now.getMonth(); let y = now.getFullYear(); let filtered = [];
    if (offset === 'tax') {
        document.getElementById('month-sheet-title').innerHTML = `<span class="material-symbols-rounded" style="color:var(--md-success);">receipt_long</span> 80C Tax Savings`;
        filtered = db.investments.filter(i => db.categories[i.type] && db.categories[i.type].is80c && isCurrentFY(i.date) && (activeAccountFilter === 'All' || i.account === activeAccountFilter));
    } else {
        if (offset === 1) { if (m === 0) { m = 11; y = y - 1; } else { m = m - 1; } }
        let monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        document.getElementById('month-sheet-title').innerHTML = `<span class="material-symbols-rounded" style="color:var(--md-primary);">calendar_month</span> ${monthNames[m]} ${y}`;
        filtered = db.investments.filter(i => {
            let d = parseDate(i.date);
            return d.getMonth() === m && d.getFullYear() === y && (activeAccountFilter === 'All' || i.account === activeAccountFilter);
        });
    }
    renderListToContainer(filtered.sort((a, b) => parseDate(b.date) - parseDate(a.date)), 'month-history-list');
    openSheet('month-sheet');
}

function openSettings() {
    haptic(30);
    
    // Group settings into organized sections
    const settingsData = {
        profile: {
            salary: db.userProfile.salary || '',
            regime: db.userProfile.regime || 'new',
            expenses: db.userProfile.monthlyExpense || ''
        },
        security: {
            pin: db.appPin || '',
            useBiometric: db.useBiometric || false
        },
        ai: {
            geminiKey: db.geminiKey || '',
            groqKey: db.groqKey || ''
        }
    };
    
    // Populate form fields
    const salaryEl = document.getElementById('settings-salary');
    const regimeEl = document.getElementById('settings-regime');
    const expensesEl = document.getElementById('settings-expenses');
    const pinEl = document.getElementById('settings-pin');
    const geminiEl = document.getElementById('gemini-api-key');
    const groqEl = document.getElementById('groq-api-key');
    const biometricEl = document.getElementById('use-biometric-toggle');
    
    if (salaryEl) salaryEl.value = settingsData.profile.salary;
    if (regimeEl) regimeEl.value = settingsData.profile.regime;
    if (expensesEl) expensesEl.value = settingsData.profile.expenses;
    if (pinEl) pinEl.value = settingsData.security.pin;
    if (geminiEl) geminiEl.value = settingsData.ai.geminiKey;
    if (groqEl) groqEl.value = settingsData.ai.groqKey;
    if (biometricEl) biometricEl.checked = settingsData.security.useBiometric;
    
    // Update settings UI with helpful tips
    updateSettingsHelpText();
    
    openSheet('settings-sheet');
}

function updateSettingsHelpText() {
    // Add/Update help text for various settings
    const helpTexts = [
        { id: 'salary-help', text: 'Used to calculate savings rate and tax estimates', after: 'settings-salary' },
        { id: 'pin-help', text: '4-digit PIN for app lock. Leave empty to disable.', after: 'settings-pin' },
        { id: 'api-help', text: 'Get keys from: Groq (groq.com) or Gemini (makersuite.google.com)', after: 'gemini-api-key' }
    ];
    
    helpTexts.forEach(help => {
        let el = document.getElementById(help.id);
        const target = document.getElementById(help.after);
        if (target && !el) {
            el = document.createElement('div');
            el.id = help.id;
            el.style.cssText = 'font-size:11px;color:var(--md-outline);margin-top:4px;margin-bottom:12px;';
            el.textContent = help.text;
            target.parentNode.insertBefore(el, target.nextSibling);
        }
    });
}

function renderSettingsSections() {
    // Accounts section
    let accHtml = "";
    db.accounts.forEach((a, idx) => {
        let delBtn = idx === 0 ? '' : `<span class="material-symbols-rounded" style="color:var(--md-error);font-size:16px;cursor:pointer;" onclick="deleteAccount('${a}')">delete</span>`;
        accHtml += `<div style="display:flex;justify-content:space-between;padding:12px;background:var(--md-surface-container-highest);border-radius:12px;"><span>${a}</span>${delBtn}</div>`;
    });
    let accList = document.getElementById('account-list');
    if (accList) accList.innerHTML = accHtml;

    // Categories section
    let catHtml = "";
    Object.keys(db.categories).forEach(c => {
        let isDefault = defaultCategories.includes(c);
        let cat = db.categories[c];
        if (!cat.targetMultiplier) cat.targetMultiplier = 0;
        if (typeof cat.excludeDividend === 'undefined') cat.excludeDividend = false;

        let delBtn = isDefault ? '<span style="font-size:10px;color:var(--md-outline);">Default</span>' : `<span class="material-symbols-rounded" style="color:var(--md-error);font-size:16px;cursor:pointer;" onclick="deleteCustomCategory('${c}')">delete</span>`;

        catHtml += `
        <div style="padding:12px;background:var(--md-surface-container-highest);border-radius:12px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span><span class="material-symbols-rounded" style="font-size:16px;color:${cat.color};vertical-align:text-bottom;margin-right:6px;">${cat.icon}</span>${c}</span>
                ${delBtn}
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                <div class="input-container" style="margin-bottom:0;">
                    <label style="font-size:10px;">Target (x Expense)</label>
                    <input type="number" step="0.1" value="${cat.targetMultiplier || ''}" placeholder="e.g. 6" class="md-input" style="padding:4px 8px;font-size:12px;" onchange="updateCategorySetting('${c}', 'targetMultiplier', this.value)">
                </div>
                <div style="display:flex;align-items:center;gap:4px;">
                    <input type="checkbox" ${cat.excludeDividend ? 'checked' : ''} onchange="updateCategorySetting('${c}', 'excludeDividend', this.checked)">
                    <label style="font-size:10px;">No Dividend</label>
                </div>
            </div>
        </div>`;
    });
    let catList = document.getElementById('category-crud-list');
    if (catList) catList.innerHTML = catHtml;

    // Badges section
    let badgeHtml = "";
    milestoneThresholds.forEach(t => {
        let unlocked = db.milestones.includes(t.val);
        if (unlocked) badgeHtml += `<div class="badge-item"><span class="material-symbols-rounded">workspace_premium</span> ${t.label}</div>`;
        else badgeHtml += `<div class="badge-item locked"><span class="material-symbols-rounded">lock</span> ${t.label}</div>`;
    });
    let badgeGrid = document.getElementById('badge-grid');
    if (badgeGrid) badgeGrid.innerHTML = badgeHtml;
}

// Call renderSettingsSections after opening settings
const originalOpenSettings = openSettings;
openSettings = function() {
    originalOpenSettings();
    renderSettingsSections();
};
window.openSettings = openSettings;

function updateCategorySetting(cat, key, val) {
    if (!db.categories[cat]) return;
    if (key === 'targetMultiplier') db.categories[cat][key] = parseFloat(val) || 0;
    else if (key === 'excludeDividend') db.categories[cat][key] = (val === true || val === 'true');
    else db.categories[cat][key] = val;
    saveData();
    // No full re-render here to avoid losing focus on input
}

function saveApiKeys() { db.geminiKey = document.getElementById('gemini-api-key').value.trim(); db.groqKey = document.getElementById('groq-api-key').value.trim(); saveData(); showSnackbar("API Keys Saved", "key"); }
function addAccount() { haptic(40); let name = document.getElementById('new-acc-name').value.trim(); if (name && !db.accounts.includes(name)) { db.accounts.push(name); document.getElementById('new-acc-name').value = ''; saveData(); initUI(); openSettings(); showSnackbar("Account Added"); } }
function deleteAccount(name) { haptic(40); Swal.fire({ title: `Delete Account '${name}'?`, text: "Entries will remain but lose association.", showCancelButton: true }).then(r => { if (r.isConfirmed) { db.accounts = db.accounts.filter(a => a !== name); saveData(); initUI(); openSettings(); renderAll(); } }); }
function addCustomCategory() {
    haptic(40);
    const nameInput = document.getElementById('new-cat-name');
    const name = nameInput.value.trim();
    const template = document.getElementById('new-cat-template').value;
    if (!name) return;

    const color = ['#6750A4', '#B3261E', '#D96200', '#0288D1', '#388E3C'][Object.keys(db.categories).length % 5];

    // Add to categories
    db.categories[name] = {
        icon: template === 'stock' ? 'trending_up' : (template === 'fd' ? 'account_balance' : 'category'),
        color: color,
        is80c: false
    };

    // Add field configuration based on template
    if (!db.categoryDetails[name]) db.categoryDetails[name] = {};

    const fields = {
        flat: { simple: true },
        fd: { interest: true, payout: true, maturity: true, broker: true, subcat: true },
        sip: { mf: true, sipday: true, monthly: true, broker: true, subcat: true },
        stock: { mf: true, qty: true, broker: true, subcat: true },
        growth: { growth: true }
    };

    db.categoryDetails[name].fields = fields[template] || {};

    nameInput.value = '';
    saveData();
    initUI();
    openSettings();
    showSnackbar(`Added Category: ${name} with ${template} template`);
}
function deleteCustomCategory(name) { haptic(40); Swal.fire({ title: `Delete Category '${name}'?`, text: "Existing entries will default to Cash.", showCancelButton: true }).then(r => { if (r.isConfirmed) { db.investments.forEach(i => { if (i.type === name) i.type = 'Cash'; }); delete db.categories[name]; saveData(); initUI(); openSettings(); renderAll(); } }); }

// savePin() defined in app_part1.js (removed weaker duplicate)
function toggleBiometric() {
    db.useBiometric = document.getElementById('use-biometric-toggle').checked;
    saveData();
    showSnackbar(db.useBiometric ? "Biometric Enabled" : "Biometric Disabled");
}
// App Lock System with Biometric, PIN fallback, rate limiting, and auto-lock
let appLockState = {
    failedAttempts: 0,
    lockoutEndTime: null,
    lastActivity: Date.now(),
    autoLockTimer: null
};

const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;
const AUTO_LOCK_DELAY = 5 * 60 * 1000; // 5 minutes of inactivity

async function checkAppLock() {
    if (!db.appPin) {
        hideLockScreen();
        return true;
    }
    
    // Check if already unlocked in this session
    if (sessionStorage.getItem('appUnlocked') === 'true') {
        hideLockScreen();
        startAutoLockTimer();
        return true;
    }
    
    // Check lockout
    if (appLockState.lockoutEndTime && Date.now() < appLockState.lockoutEndTime) {
        const remaining = Math.ceil((appLockState.lockoutEndTime - Date.now()) / 1000);
        updateLockScreenMessage(`Too many attempts. Try again in ${remaining}s`);
        showLockScreen();
        return false;
    }
    
    showLockScreen();
    
    // Try biometric first if enabled
    if (db.useBiometric && window.PublicKeyCredential) {
        try {
            const result = await attemptBiometricAuth();
            if (result) {
                unlockSuccess();
                return true;
            }
        } catch (e) {
            console.log("Biometric auth failed, falling back to PIN", e);
        }
    }
    
    // Focus PIN input for manual entry
    setTimeout(() => {
        const pinInput = document.getElementById('pin-input-auth');
        if (pinInput) pinInput.focus();
    }, 300);
    
    return false;
}
window.checkAppLock = checkAppLock;

async function attemptBiometricAuth() {
    try {
        const cred = await navigator.credentials.get({
            publicKey: { 
                challenge: new Uint8Array(32),
                timeout: 30000,
                allowCredentials: [],
                userVerification: 'required'
            }
        });
        return !!cred;
    } catch (e) {
        return false;
    }
}

function showLockScreen() {
    const lockScreen = document.getElementById('app-lock-screen');
    if (!lockScreen) return;
    
    // Update lock screen UI with biometric option if available
    const biometricBtn = document.getElementById('biometric-auth-btn') || createBiometricButton();
    
    lockScreen.style.display = 'flex';
    lockScreen.classList.add('active');
    
    // Update message based on state
    updateLockScreenMessage('Enter your 4-digit PIN');
}

function hideLockScreen() {
    const lockScreen = document.getElementById('app-lock-screen');
    if (lockScreen) {
        lockScreen.style.display = 'none';
        lockScreen.classList.remove('active');
    }
}

function createBiometricButton() {
    const btn = document.createElement('button');
    btn.id = 'biometric-auth-btn';
    btn.className = 'icon-btn';
    btn.style.cssText = 'width:56px;height:56px;border-radius:50%;background:var(--md-primary-container);margin-top:16px;';
    btn.innerHTML = '<span class="material-symbols-rounded" style="font-size:28px;color:var(--md-primary);">fingerprint</span>';
    btn.onclick = async () => {
        const result = await attemptBiometricAuth();
        if (result) {
            unlockSuccess();
        } else {
            showSnackbar('Biometric authentication failed', 'error');
        }
    };
    
    const lockScreen = document.getElementById('app-lock-screen');
    if (lockScreen) {
        const pinSection = lockScreen.querySelector('div') || lockScreen;
        pinSection.appendChild(btn);
    }
    return btn;
}

function updateLockScreenMessage(msg) {
    const msgEl = document.getElementById('lock-screen-message');
    if (msgEl) {
        msgEl.textContent = msg;
    } else {
        const lockScreen = document.getElementById('app-lock-screen');
        if (lockScreen) {
            const h2 = lockScreen.querySelector('h2');
            const newMsg = document.createElement('div');
            newMsg.id = 'lock-screen-message';
            newMsg.style.cssText = 'font-size:14px;color:var(--md-error);margin:8px 0;text-align:center;';
            newMsg.textContent = msg;
            if (h2) h2.after(newMsg);
        }
    }
}

function unlockApp() {
    // Check lockout
    if (appLockState.lockoutEndTime && Date.now() < appLockState.lockoutEndTime) {
        const remaining = Math.ceil((appLockState.lockoutEndTime - Date.now()) / 1000);
        updateLockScreenMessage(`Locked. Try again in ${remaining}s`);
        haptic([100, 100, 100]);
        return;
    }
    
    let pin = document.getElementById('pin-input-auth').value;
    
    // Validate PIN format
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        updateLockScreenMessage('Enter a valid 4-digit PIN');
        haptic([50, 50]);
        return;
    }
    
    if (pin === db.appPin) {
        unlockSuccess();
    } else {
        handleFailedAttempt();
    }
}

function unlockSuccess() {
    haptic(50);
    appLockState.failedAttempts = 0;
    appLockState.lockoutEndTime = null;
    sessionStorage.setItem('appUnlocked', 'true');
    hideLockScreen();
    
    const pinInput = document.getElementById('pin-input-auth');
    if (pinInput) pinInput.value = '';
    
    updateLockScreenMessage('Enter your 4-digit PIN');
    
    // Restore last active sheet if any
    let lastSheet = sessionStorage.getItem('currentSheet');
    if (lastSheet) {
        setTimeout(() => openSheet(lastSheet), 100);
    }
    
    startAutoLockTimer();
    showSnackbar('Welcome back!', 'check_circle');
}

function handleFailedAttempt() {
    appLockState.failedAttempts++;
    const remaining = MAX_ATTEMPTS - appLockState.failedAttempts;
    
    haptic([100, 50, 100]);
    
    if (remaining <= 0) {
        appLockState.lockoutEndTime = Date.now() + LOCKOUT_DURATION;
        updateLockScreenMessage(`Too many attempts. Locked for 5 minutes.`);
        showSnackbar('Too many failed attempts. App locked for 5 minutes.', 'error');
    } else {
        updateLockScreenMessage(`Incorrect PIN. ${remaining} attempts remaining.`);
        showSnackbar(`Incorrect PIN. ${remaining} attempts remaining.`, 'warning');
    }
    
    const pinInput = document.getElementById('pin-input-auth');
    if (pinInput) {
        pinInput.value = '';
        pinInput.classList.add('shake');
        setTimeout(() => pinInput.classList.remove('shake'), 500);
    }
}

function startAutoLockTimer() {
    if (appLockState.autoLockTimer) {
        clearTimeout(appLockState.autoLockTimer);
    }
    
    appLockState.lastActivity = Date.now();
    
    appLockState.autoLockTimer = setInterval(() => {
        if (Date.now() - appLockState.lastActivity > AUTO_LOCK_DELAY) {
            lockApp();
        }
    }, 30000); // Check every 30 seconds
}

function updateActivity() {
    appLockState.lastActivity = Date.now();
}

function lockApp() {
    sessionStorage.removeItem('appUnlocked');
    checkAppLock();
    showSnackbar('App locked due to inactivity', 'info');
}

// Track user activity
['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(event => {
    document.addEventListener(event, updateActivity, { passive: true });
});

window.checkAppLock = checkAppLock;
window.unlockApp = unlockApp;
window.lockApp = lockApp;
async function encryptData(jsonStr, pin) {
    if (!pin) return btoa(encodeURIComponent(jsonStr));
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(jsonStr));
    const buf = new Uint8Array(salt.length + iv.length + ct.byteLength);
    buf.set(salt, 0); buf.set(iv, salt.length); buf.set(new Uint8Array(ct), salt.length + iv.length);
    return 'ENC2:' + btoa(String.fromCharCode(...buf));
}
async function decryptData(encStr, pin) {
    if (encStr.startsWith('ENC2:')) {
        if (!pin) throw new Error('PIN required for decryption');
        const raw = Uint8Array.from(atob(encStr.substring(5)), c => c.charCodeAt(0));
        const salt = raw.slice(0, 16); const iv = raw.slice(16, 28); const ct = raw.slice(28);
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
        const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
        return new TextDecoder().decode(pt);
    }
    if (encStr.startsWith('ENC:')) {
        if (!pin) throw new Error('PIN required for decryption');
        let enc = atob(encStr.substring(4)); let dec = '';
        for (let i = 0; i < enc.length; i++) dec += String.fromCharCode(enc.charCodeAt(i) ^ pin.charCodeAt(i % pin.length));
        return decodeURIComponent(atob(dec));
    }
    return decodeURIComponent(atob(encStr));
}

async function exportData() {
    haptic(40);
    let encrypt = document.getElementById('encrypt-backup-toggle') ? document.getElementById('encrypt-backup-toggle').checked : false;
    if (encrypt && !db.appPin) { showSnackbar("Please set a PIN first to encrypt", "warning"); return; }
    
    let dataStr = JSON.stringify(db, null, 2);
    let finalData = encrypt ? await encryptData(dataStr, db.appPin) : dataStr;
    let ext = encrypt ? '.enc' : '.json';
    
    const blob = new Blob([finalData], { type: encrypt ? 'text/plain' : 'application/json' });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Invest_Backup_${new Date().toISOString().split('T')[0]}${ext}`;
    a.click();
    closeOverlays();
    showSnackbar(encrypt ? "Encrypted Backup Downloaded" : "Backup Downloaded");
}

function restoreData(e) {
    const file = e.target.files[0]; if (!file) return; 
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            let content = event.target.result;
            let parsedStr = content;
            
            if (content.startsWith('ENC:') || content.startsWith('ENC2:')) {
                let pin = prompt("Enter PIN to decrypt backup:");
                if (!pin) { showSnackbar("Decryption cancelled", "error"); e.target.value = ''; return; }
                try {
                    parsedStr = await decryptData(content, pin);
                } catch (decErr) {
                    showSnackbar("Incorrect PIN or Corrupted Data", "error");
                    e.target.value = '';
                    return;
                }
            }
            
            let parsed = JSON.parse(parsedStr);
            if (!parsed.userProfile) parsed.userProfile = { salary: 0, regime: 'new' };
            // Deep merge/update db
            db.userProfile = parsed.userProfile;
            db.investments = parsed.investments || []; 
            db.goals = parsed.goals || []; 
            db.recurring = parsed.recurring || []; 
            db.milestones = parsed.milestones || []; 
            db.projectionNextMonth = parsed.projectionNextMonth || 0; 
            db.categoryDetails = parsed.categoryDetails || parsed.categoryGoals || {}; 
            db.currentMarketValues = parsed.currentMarketValues || {}; 
            db.allocTargets = parsed.allocTargets || {}; 
            db.accounts = parsed.accounts && parsed.accounts.length > 0 ? parsed.accounts : ['Main Portfolio']; 
            db.fireTargetMonthly = parsed.fireTargetMonthly || 0; 
            db.templates = parsed.templates || []; 
            db.privacyMode = typeof parsed.privacyMode !== 'undefined' ? parsed.privacyMode : false; 
            db.theme = parsed.theme || 'indigo'; 
            db.geminiKey = parsed.geminiKey || ''; 
            db.groqKey = parsed.groqKey || ''; 
            db.appPin = parsed.appPin || ''; 
            db.useBiometric = parsed.useBiometric || false; 
            db.chatHistory = parsed.chatHistory || []; 
            db.chatSessions = parsed.chatSessions || []; 
            db.lastBackupPrompt = parsed.lastBackupPrompt || ''; 
            db.navCache = parsed.navCache || {};
            
            if (parsed.categories && Object.keys(parsed.categories).length > 0) { db.categories = parsed.categories; }
            if (!db.settingsTable) db.settingsTable = { lastResetMonth: '' };
            
            saveData(); initUI(); renderAll(); closeOverlays(); 
            showSnackbar("Data Restored Successfully", "check_circle"); 
            e.target.value = '';
        } catch (err) { 
            console.error(err);
            showSnackbar("Invalid or Corrupted Backup", "error"); 
        }
    }; 
    reader.readAsText(file);
}

// Legacy WebRTC functions removed — canonical implementation in app_part3.js

function importCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            let text = e.target.result;
            let rows = text.split('\n'); let added = 0;
            for (let i = 1; i < rows.length; i++) {
                let cols = rows[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
                cols = cols.map(c => c.replace(/^"|"$/g, ''));
                if (cols.length >= 3 && cols[0] && !isNaN(parseFloat(cols[2]))) {
                    db.investments.push({ id: generateUniqueId(), date: cols[0].trim(), type: cols[1].trim() || 'Cash', amount: parseFloat(cols[2]), note: cols[3] ? cols[3].trim() : '', tags: cols[4] ? cols[4].trim() : '', isDividend: false, account: activeAccountFilter === 'All' ? db.accounts[0] : activeAccountFilter });
                    added++;
                }
            }
            if (added > 0) {
                saveData(); renderAll(); closeOverlays();
                showSnackbar(`${added} Entries Imported!`, "check_circle");
            }
            else { showSnackbar("No valid rows found in CSV", "warning"); }
        }
        catch (err) { showSnackbar("Failed to parse CSV", "error"); }
    };
    reader.readAsText(file);
}
function exportTaxPDF() {
    if (!window.jspdf)
        return showSnackbar("PDF Library loading...", "hourglass_empty");
    haptic(40);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("80C Tax Savings Report (FY)", 14, 22);
    let fyInv = db.investments.filter(i => db.categories[i.type] && db.categories[i.type].is80c && isCurrentFY(i.date)).sort((a, b) => parseDate(b.date) - parseDate(a.date));
    let tableData = fyInv.map(i => [i.date, i.type, i.note || '-', formatInr(i.amount)]);
    let total = fyInv.reduce((sum, i) => sum + i.amount, 0);
    tableData.push(['', '', 'TOTAL:', formatInr(total)]);
    doc.autoTable({ startY: 30, head: [['Date', 'Asset', 'Note', 'Amount (Rs)']], body: tableData, theme: 'striped', headStyles: { fillColor: [69, 89, 164] } });
    doc.save('InvestPro_Tax_Report.pdf');
    showSnackbar("PDF Downloaded", "picture_as_pdf");
}

function calculateXIRR() {
    let category = document.getElementById('xirr-category').value;
    let filteredInvs = db.investments.filter(i => i.type === category && (activeAccountFilter === 'All' || i.account === activeAccountFilter));

    if (filteredInvs.length === 0) {
        document.getElementById('xirr-result').innerHTML = `<div style="color:var(--md-outline); text-align:center; padding:20px;"><span class="material-symbols-rounded" style="font-size:32px; display:block; margin-bottom:8px;">inbox</span>No investments in this category.</div>`;
        return;
    }

    // Check for all-dividend case (no actual investments)
    let hasInvestments = filteredInvs.some(i => !i.isDividend);
    let allDividends = filteredInvs.every(i => i.isDividend);
    
    if (allDividends) {
        let totalDividends = filteredInvs.reduce((s, i) => s + i.amount, 0);
        document.getElementById('xirr-result').innerHTML = `
            <div style="text-align:center; padding:16px;">
                <div style="font-size:14px; color:var(--md-outline); margin-bottom:8px;">📥 Dividend/Income Category</div>
                <div style="font-size:28px; font-weight:600; color:var(--md-success);">${formatMoney(totalDividends)}</div>
                <div style="font-size:12px; color:var(--md-outline); margin-top:8px;">Total passive income received</div>
            </div>`;
        return;
    }

    // Cash flows: Investments are OUTFLOWS (Negative), Dividends/CurrentValue are INFLOWS (Positive)
    let cashFlows = filteredInvs.map(i => ({
        amount: i.isDividend ? i.amount : -i.amount,
        date: parseDate(i.date)
    }));

    // Include initial balance as an outflow at the date of the first investment
    let initialBal = db.categoryDetails[category]?.initialBal || 0;
    if (initialBal > 0) {
        let earliestDate = cashFlows.reduce((min, cf) => cf.date < min ? cf.date : min, cashFlows[0].date);
        cashFlows.push({ amount: -initialBal, date: earliestDate });
    }

    // Include terminal current market value as an inflow today
    let currentValue = currentTypeTotals[category] || 0;
    if (currentValue > 0) {
        cashFlows.push({ amount: currentValue, date: new Date() });
    }

    // Filter out zero amounts
    cashFlows = cashFlows.filter(cf => cf.amount !== 0);

    // Check for single transaction case
    let nonDividendFlows = cashFlows.filter(cf => cf.amount < 0);
    if (nonDividendFlows.length === 1 && cashFlows.length < 2) {
        let holdingDays = (new Date() - nonDividendFlows[0].date) / (1000 * 60 * 60 * 24);
        let invested = Math.abs(nonDividendFlows[0].amount);
        let current = currentValue || invested;
        let simpleReturn = ((current - invested) / invested) * 100;
        
        document.getElementById('xirr-result').innerHTML = `
            <div style="text-align:center; padding:16px;">
                <div style="font-size:12px; color:var(--md-outline); margin-bottom:8px;">📊 Single Investment (XIRR not applicable)</div>
                <div style="font-size:24px; font-weight:600; color:var(--md-primary);">${simpleReturn.toFixed(2)}%</div>
                <div style="font-size:12px; color:var(--md-outline); margin-top:8px;">${holdingDays.toFixed(0)} days • Simple Return</div>
                <div style="font-size:11px; color:var(--md-primary); margin-top:12px; padding:8px; background:var(--md-primary-container); border-radius:8px;">Add more transactions to see XIRR</div>
            </div>`;
        return;
    }

    if (cashFlows.length < 2) {
        document.getElementById('xirr-result').innerHTML = `<div style="color:var(--md-outline); text-align:center; padding:20px;">Need at least one investment and current value to calculate returns.</div>`;
        return;
    }

    // Check holding period - warn if very short
    let firstInvestmentDate = cashFlows.filter(cf => cf.amount < 0).reduce((min, cf) => cf.date < min ? cf.date : min, new Date());
    let holdingDays = (new Date() - firstInvestmentDate) / (1000 * 60 * 60 * 24);
    let shortPeriodWarning = holdingDays < 30 ? `<div style="font-size:11px; color:var(--md-warning); margin-top:8px;">⚠️ Short holding period (${holdingDays.toFixed(0)} days) - returns may be volatile</div>` : '';

    // Sort flows by date
    cashFlows.sort((a, b) => a.date - b.date);
    let d0 = cashFlows[0].date;

    const npv = (flows, rate) => {
        return flows.reduce((sum, flow) => {
            let t = (flow.date - d0) / (365.25 * 24 * 60 * 60 * 1000);
            return sum + flow.amount / Math.pow(1 + rate, t);
        }, 0);
    };

    // Newton-Raphson with binary search fallback
    const irr = (flows) => {
        let guess = 0.1;
        const maxIter = 100;
        const precision = 0.0001;

        // Try Newton-Raphson first
        for (let i = 0; i < maxIter; i++) {
            let f = 0, df = 0;
            for (let j = 0; j < flows.length; j++) {
                let t = (flows[j].date - d0) / (365.25 * 24 * 60 * 60 * 1000);
                let discountFactor = Math.pow(1 + guess, t);
                f += flows[j].amount / discountFactor;
                df += -t * flows[j].amount / Math.pow(1 + guess, t + 1);
            }

            if (Math.abs(f) < precision) return guess;
            if (Math.abs(df) < 1e-10) break;

            let nextGuess = guess - f / df;
            if (isNaN(nextGuess) || !isFinite(nextGuess)) break;

            guess = nextGuess;
        }

        // Binary search fallback for robust convergence
        let low = -0.9999, high = 10;
        let bestGuess = guess;
        let bestError = Math.abs(npv(flows, guess));

        for (let i = 0; i < 50; i++) {
            let mid = (low + high) / 2;
            let midVal = npv(flows, mid);
            let lowVal = npv(flows, low);

            if (Math.abs(midVal) < bestError) {
                bestError = Math.abs(midVal);
                bestGuess = mid;
            }

            if (Math.abs(midVal) < precision) return mid;

            if (midVal * lowVal < 0) {
                high = mid;
            } else {
                low = mid;
            }
        }

        return bestGuess;
    };

    let result = irr(cashFlows);
    
    // Handle different return scenarios with better messaging
    let resultText, colorClass, message;
    if (result <= -0.99) {
        resultText = '-99.99%';
        colorClass = 'var(--md-error)';
        message = 'Significant loss - review investment';
    } else if (result < -0.5) {
        resultText = (result * 100).toFixed(2) + '%';
        colorClass = 'var(--md-error)';
        message = 'Major decline - assess strategy';
    } else if (result < 0) {
        resultText = (result * 100).toFixed(2) + '%';
        colorClass = 'var(--md-error)';
        message = 'Temporary dip';
    } else if (result === 0) {
        resultText = '0.00%';
        colorClass = 'var(--md-on-surface-variant)';
        message = 'Break-even';
    } else if (result < 0.08) {
        resultText = (result * 100).toFixed(2) + '%';
        colorClass = 'var(--md-success)';
        message = 'Moderate returns';
    } else if (result < 0.15) {
        resultText = (result * 100).toFixed(2) + '%';
        colorClass = 'var(--md-success)';
        message = 'Strong performance';
    } else {
        resultText = (result * 100).toFixed(2) + '%';
        colorClass = 'var(--md-success)';
        message = 'Exceptional returns!';
    }
    
    // Calculate annualized for multi-year
    let years = holdingDays / 365.25;
    let annualizedNote = years >= 1 ? `<div style="font-size:11px; color:var(--md-outline); margin-top:4px;">Annualized over ${years.toFixed(1)} years</div>` : '';
    
    document.getElementById('xirr-result').innerHTML = `
        <div style="text-align:center; padding:16px;">
            <div style="font-size:14px; color:var(--md-outline); margin-bottom:8px;">XIRR</div>
            <div style="font-size:32px; font-weight:600; color:${colorClass};">${resultText}</div>
            <div style="font-size:12px; color:var(--md-outline); margin-top:8px;">${message}</div>
            ${annualizedNote}
            ${shortPeriodWarning}
        </div>`;
}
function calculateMonthlySIP() { 
    let target = parseFloat(document.getElementById('sip-target').value); 
    let years = parseFloat(document.getElementById('sip-years').value); 
    let rate = parseFloat(document.getElementById('sip-return').value) / 100 / 12; 
    let months = years * 12; 
    if (rate === 0) {
        document.getElementById('sip-result').innerHTML = `Monthly SIP needed: <strong>${formatMoney(target / months)}</strong>`;
        return;
    }
    // SIP at start of period
    let monthly = target * rate / ((Math.pow(1 + rate, months) - 1) * (1 + rate)); 
    document.getElementById('sip-result').innerHTML = `Monthly SIP needed: <strong>${formatMoney(monthly)}</strong>`; 
}
function calculateEMI() { let P = parseFloat(document.getElementById('emi-principal').value); let years = parseFloat(document.getElementById('emi-tenure').value); let rate = parseFloat(document.getElementById('emi-rate').value) / 12 / 100; let n = years * 12; if (rate === 0) { document.getElementById('emi-result').innerHTML = `Monthly EMI: <strong>${formatMoney(P / n)}</strong>`; return; } let emi = P * rate * Math.pow(1 + rate, n) / (Math.pow(1 + rate, n) - 1); document.getElementById('emi-result').innerHTML = `Monthly EMI: <strong>${formatMoney(emi)}</strong>`; }
function calculateInflation() { let pv = parseFloat(document.getElementById('inf-present').value); let years = parseFloat(document.getElementById('inf-years').value); let rate = parseFloat(document.getElementById('inf-rate').value) / 100; let fv = pv * Math.pow(1 + rate, years); document.getElementById('inf-result').innerHTML = `Future Value: <strong>${formatMoney(fv)}</strong>`; }

// === Standalone calculator functions (required by tests) ===
function calculateMonthlySIPValue(target, years, rate) {
    if (!target || target <= 0) return null;
    if (!years || years <= 0) return null;
    let r = rate / 100 / 12; let n = years * 12;
    if (r === 0) return target / n;
    // SIP at start of period: FV = P * [((1+r)^n - 1)/r] * (1+r)
    return target * r / ((Math.pow(1 + r, n) - 1) * (1 + r));
}
function calculateEMIValue(principal, years, rate) {
    if (!principal || principal <= 0) return null;
    if (!years || years <= 0) return null;
    let r = rate / 100 / 12; let n = years * 12;
    if (r === 0) return principal / n;
    return principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
}
function calculateInflationValue(pv, years, rate) {
    if (!pv || pv <= 0) return null;
    if (years === undefined || years < 0) return null;
    if (rate === undefined || rate < 0) return null;
    return pv * Math.pow(1 + rate / 100, years);
}
function checkDuplicates(newEntry) { let dups = db.investments.filter(i => i.date === newEntry.date && i.type === newEntry.type && i.amount === newEntry.amount && i.id !== newEntry.id); if (dups.length > 0) { showSnackbar("Possible duplicate entry detected!", "warning"); } }
function autoBackupReminder() { let now = new Date().toDateString(); if (db.lastBackupPrompt !== now && (new Date() - new Date(db.lastBackupPrompt || 0)) > 7 * 24 * 60 * 60 * 1000) { showSnackbar("Remember to backup your data! (Settings > Backup)", "cloud_download"); db.lastBackupPrompt = now; saveData(); } }
function dataCleanup() { Swal.fire({ title: 'Cleanup Old Entries', text: 'Enter cutoff date (YYYY-MM-DD) to remove entries older than that date.', input: 'text', showCancelButton: true }).then(res => { if (res.isConfirmed && res.value) { let cutoff = parseDate(res.value); let before = db.investments.length; db.investments = db.investments.filter(i => parseDate(i.date) >= cutoff); saveData(); renderAll(); showSnackbar(`Removed ${before - db.investments.length} entries.`); } }); }

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

function openAIChat() {
    const log = document.getElementById('ai-chat-log');
    if (!log) return;
    
    log.innerHTML = db.chatHistory.map(m => {
        const content = m.role === 'ai' ? formatAIResponse(m.content) : m.content;
        return `<div class="chat-bubble ${m.role}">${content}</div>`;
    }).join('');
    
    openSheet('ai-chat-sheet');
    
    setTimeout(() => {
        log.scrollTop = log.scrollHeight;
    }, 100);
}
// saveChatSession() — simple version removed, better version below (with title/unshift)
function viewChatHistory() {
    haptic(30);
    let html = db.chatSessions.length === 0 ? `<div class="empty-state-premium"><span class="material-symbols-rounded">forum</span><div class="es-title">No past sessions</div></div>` : "";
    db.chatSessions.slice().reverse().forEach((sess, idxOriginal) => {
        let idx = db.chatSessions.length - 1 - idxOriginal;
        let dStr = new Date(sess.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        let preview = sess.messages[0] ? sess.messages[0].content.substring(0, 40) + '...' : 'Empty session';
        html += `<div class="md-card" style="padding:12px; margin-bottom:8px; cursor:pointer; background:var(--md-surface-container-low); border-radius:12px;" onclick="loadChatSession(${idx})"><div style="font-size:12px;color:var(--md-primary);font-weight:500;">${dStr}</div><div style="font-size:14px;margin-top:4px;opacity:0.8;">${preview}</div></div>`;
    });
    const list = document.getElementById('chat-history-list');
    if (list) list.innerHTML = html;
    openSubSheet('chat-history-sheet');
}
function loadChatSession(idx) {
    haptic(40);
    const sess = db.chatSessions[idx];
    if (!sess) return;
    db.chatHistory = [...sess.messages];
    saveData();
    closeSubSheet(true); // Close history sheet without going back in history
    openAIChat();
    showSnackbar("Session restored");
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
        let parsedReply = formatAIResponse(reply);
        document.getElementById('typing').remove(); db.chatHistory.push({ role: 'ai', content: reply }); log.innerHTML += `<div class="chat-bubble ai">${parsedReply}</div>`; saveData(); log.scrollTop = log.scrollHeight; haptic([30, 50]);
    } catch (e) { document.getElementById('typing').remove(); log.innerHTML += `<div class="chat-bubble ai" style="color:var(--md-error);">Connection failed. Check API Keys in settings.</div>`; }
}

function formatAIResponse(text) {
    if (!text) return '<p style="padding:20px; opacity:0.6;">No data received...</p>';

    // 1. Initial Clean: Remove AI code fences if present
    let formatted = text.replace(/```(html|markdown)?|```/gi, '').trim();

    // 2. Process TABLES - Markdown table format | Col1 | Col2 |
    formatted = processAITables(formatted);
    
    // 3. Process CHARTS - Special [CHART: type data] format
    formatted = processAICharts(formatted);
    
    // 4. Process PROGRESS BARS - [PROGRESS: value% label]
    formatted = processAIProgress(formatted);
    
    // 5. Process CALLOUTS - [!INFO], [!WARNING], [!TIP]
    formatted = processAICallouts(formatted);

    // 6. ESCAPE raw HTML to prevent XSS
    formatted = escapeHtml(formatted);

    // 7. Strip dangerous patterns
    formatted = formatted.replace(/\bon\w+\s*=/gi, '').replace(/javascript\s*:/gi, '');

    // 8. Process MARKDOWN on escaped text
    formatted = formatted
        .replace(/^### (.*$)/gim, '<h3 style="margin:16px 0 8px;color:var(--md-on-surface-variant);font-size:16px;">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 style="margin:20px 0 10px;color:var(--md-on-surface);font-size:18px;font-weight:600;">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 style="margin:24px 0 12px;color:var(--md-primary);font-size:20px;font-weight:700;">$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--md-on-surface);font-weight:600;">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em style="color:var(--md-on-surface-variant);">$1</em>')
        .replace(/^&gt; (.*$)/gim, '<blockquote style="border-left:3px solid var(--md-primary);padding-left:12px;margin:12px 0;color:var(--md-on-surface-variant);font-style:italic;">$1</blockquote>')
        .replace(/^\* (.*$)/gim, '<li style="margin:4px 0;padding-left:8px;">$1</li>')
        .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul style="margin:12px 0;padding-left:20px;list-style-type:disc;">$&</ul>')
        .replace(/<\/ul>\s*<ul[^>]*>/g, '')
        .replace(/\[(.*?)\]\((https?:\/\/.*?)\)/g, '<a href="$2" target="_blank" style="color:var(--md-primary);text-decoration:underline;">$1</a>');

    // 9. Process inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code style="background:var(--md-surface-container-highest);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:90%;">$1</code>');

    // 10. PRESERVE SPACING
    return formatted.split('\n').map(line => {
        if (line.trim().startsWith('<') || line.trim().endsWith('>')) return line;
        if (line.trim() === '') return '<div style="height:8px;"></div>';
        return `<p style="margin:8px 0;line-height:1.5;">${line}</p>`;
    }).join('');
}

// Process AI-generated tables
function processAITables(text) {
    // Match markdown tables: | Header1 | Header2 | ...\n|-------|-------|...\n| Data | Data |
    const tableRegex = /\|(.+)\|\n\|[-\s|]+\|\n((?:\|.+\|\n?)+)/g;
    return text.replace(tableRegex, (match, headers, rows) => {
        const headerCells = headers.split('|').map(h => h.trim()).filter(h => h);
        const rowLines = rows.trim().split('\n');
        
        let tableHtml = '<div style="overflow-x:auto;margin:16px 0;border-radius:12px;border:1px solid var(--md-outline-variant);"><table style="width:100%;border-collapse:collapse;font-size:13px;">';
        
        // Headers
        tableHtml += '<thead><tr style="background:var(--md-primary-container);">';
        headerCells.forEach(h => {
            tableHtml += `<th style="padding:12px;text-align:left;color:var(--md-on-primary-container);font-weight:600;border-bottom:2px solid var(--md-outline-variant);">${h}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';
        
        // Rows
        rowLines.forEach((line, idx) => {
            const cells = line.split('|').map(c => c.trim()).filter(c => c);
            const bg = idx % 2 === 0 ? 'var(--md-surface)' : 'var(--md-surface-container-low)';
            tableHtml += `<tr style="background:${bg};">`;
            cells.forEach(c => {
                tableHtml += `<td style="padding:10px 12px;border-bottom:1px solid var(--md-outline-variant);color:var(--md-on-surface);">${c}</td>`;
            });
            tableHtml += '</tr>';
        });
        
        tableHtml += '</tbody></table></div>';
        return tableHtml;
    });
}

// Process AI-generated charts using simple HTML/CSS
function processAICharts(text) {
    // Match [CHART: bar data="10,20,30" labels="A,B,C" colors="#ff0000,#00ff00,#0000ff"]
    const chartRegex = /\[CHART:\s*(\w+)\s+data="([^"]+)"(?:\s+labels="([^"]*)")?(?:\s+colors="([^"]*)")?\]/g;
    
    return text.replace(chartRegex, (match, type, dataStr, labelsStr, colorsStr) => {
        const data = dataStr.split(',').map(v => parseFloat(v.trim()) || 0);
        const labels = labelsStr ? labelsStr.split(',').map(l => l.trim()) : data.map((_, i) => i + 1);
        const colors = colorsStr ? colorsStr.split(',').map(c => c.trim()) : generateChartColors(data.length);
        
        const max = Math.max(...data, 1);
        const total = data.reduce((a, b) => a + b, 0);
        
        if (type === 'bar' || type === 'column') {
            return renderAIBarChart(data, labels, colors, max);
        } else if (type === 'pie' || type === 'donut') {
            return renderAIPieChart(data, labels, colors, total);
        } else if (type === 'progress') {
            return renderAIProgressChart(data, labels, colors);
        }
        return match;
    });
}

function renderAIBarChart(data, labels, colors, max) {
    let bars = '';
    data.forEach((val, i) => {
        const pct = (val / max) * 100;
        bars += `
            <div style="display:flex;align-items:center;margin:6px 0;">
                <div style="width:60px;font-size:11px;color:var(--md-on-surface-variant);text-align:right;padding-right:8px;flex-shrink:0;">${labels[i]}</div>
                <div style="flex:1;background:var(--md-surface-container-highest);border-radius:4px;height:24px;position:relative;overflow:hidden;">
                    <div style="width:${pct}%;background:${colors[i % colors.length]};height:100%;border-radius:4px;transition:width 0.5s;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;">
                        <span style="font-size:10px;color:white;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,0.3);">${val}</span>
                    </div>
                </div>
            </div>`;
    });
    return `<div style="margin:16px 0;padding:16px;background:var(--md-surface-container-low);border-radius:12px;">${bars}</div>`;
}

function renderAIPieChart(data, labels, colors, total) {
    let slices = [];
    let currentAngle = 0;
    
    data.forEach((val, i) => {
        const pct = (val / total) * 100;
        const angle = (val / total) * 360;
        slices.push({ val, pct, angle, color: colors[i % colors.length], label: labels[i] });
    });
    
    // Create simple legend-based visualization
    let legend = '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(120px, 1fr));gap:8px;margin-top:12px;">';
    slices.forEach(s => {
        legend += `
            <div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--md-surface);border-radius:8px;">
                <div style="width:12px;height:12px;border-radius:50%;background:${s.color};flex-shrink:0;"></div>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:11px;color:var(--md-on-surface);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.label}</div>
                    <div style="font-size:10px;color:var(--md-on-surface-variant);">${s.pct.toFixed(1)}% (${s.val})</div>
                </div>
            </div>`;
    });
    legend += '</div>';
    
    return `<div style="margin:16px 0;padding:16px;background:var(--md-surface-container-low);border-radius:12px;">
        <div style="font-size:14px;font-weight:600;color:var(--md-on-surface);margin-bottom:12px;text-align:center;">Total: ${total}</div>
        ${legend}
    </div>`;
}

function generateChartColors(count) {
    const base = ['#6750A4', '#006874', '#B3261E', '#D96200', '#0288D1', '#4CAF50', '#FF9800', '#9C27B0'];
    const colors = [];
    for (let i = 0; i < count; i++) {
        colors.push(base[i % base.length]);
    }
    return colors;
}

// Process progress indicators
function processAIProgress(text) {
    const progressRegex = /\[PROGRESS:\s*(\d+(?:\.\d+)?)%\s*([^\]]*)\]/g;
    return text.replace(progressRegex, (match, value, label) => {
        const num = parseFloat(value);
        const color = num >= 80 ? 'var(--md-success)' : num >= 50 ? 'var(--md-primary)' : num >= 25 ? 'var(--md-warning)' : 'var(--md-error)';
        return `<div style="margin:12px 0;">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;color:var(--md-on-surface-variant);">
                <span>${label.trim()}</span>
                <span style="font-weight:600;color:${color};">${num}%</span>
            </div>
            <div style="height:8px;background:var(--md-surface-container-highest);border-radius:4px;overflow:hidden;">
                <div style="width:${num}%;height:100%;background:${color};border-radius:4px;transition:width 0.5s;"></div>
            </div>
        </div>`;
    });
}

// Process callout boxes
function processAICallouts(text) {
    const callouts = {
        'INFO': { icon: 'info', color: 'var(--md-primary)', bg: 'var(--md-primary-container)' },
        'WARNING': { icon: 'warning', color: 'var(--md-warning)', bg: 'var(--md-warning-container)' },
        'TIP': { icon: 'lightbulb', color: 'var(--md-success)', bg: 'var(--md-success-container)' },
        'ERROR': { icon: 'error', color: 'var(--md-error)', bg: 'var(--md-error-container)' }
    };
    
    let result = text;
    Object.entries(callouts).forEach(([type, config]) => {
        const regex = new RegExp(`\\[!${type}\\]([^\\n]*(?:\\n(?!!|\\[|$)[^\\n]*)*)`, 'g');
        result = result.replace(regex, (match, content) => {
            return `<div style="margin:16px 0;padding:16px;background:${config.bg};border-radius:12px;border-left:4px solid ${config.color};">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                    <span class="material-symbols-rounded" style="color:${config.color};font-size:20px;">${config.icon}</span>
                    <span style="font-weight:600;color:${config.color};font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">${type}</span>
                </div>
                <div style="color:var(--md-on-surface);line-height:1.5;">${content.trim()}</div>
            </div>`;
        });
    });
    return result;
}

function saveChatSession() {
    if (db.chatHistory.length === 0) {
        showSnackbar("No messages to save", "error");
        return;
    }
    haptic(40);
    const title = db.chatHistory[0].content.substring(0, 30) + "...";
    db.chatSessions.unshift({
        id: generateUniqueId(),
        date: new Date().toISOString(),
        title: title,
        messages: [...db.chatHistory]
    });
    db.chatHistory = []; // Clear current for new session
    saveData();
    updateChatHistoryUI();
    openAIChat();
    showSnackbar("Session saved to history");
}

// ==========================================
// 8.1 FLOATING AI CHAT BUBBLE
// ==========================================
let aiBubbleInitialized = false;
let aiBubbleExpanded = false;

function initAIFloatingBubble() {
    if (aiBubbleInitialized) return;
    
    // Create floating bubble container
    const bubble = document.createElement('div');
    bubble.id = 'ai-floating-bubble';
    bubble.innerHTML = `
        <div id="ai-bubble-button" onclick="toggleAIBubble()">
            <span class="material-symbols-rounded" id="ai-bubble-icon">smart_toy</span>
            <span id="ai-bubble-badge" style="display:none;"></span>
        </div>
        <div id="ai-bubble-chat" style="display:none;">
            <div id="ai-bubble-header">
                <span class="material-symbols-rounded" style="color:var(--md-primary);">smart_toy</span>
                <span>AI Assistant</span>
                <div style="flex:1;"></div>
                <button class="icon-btn" onclick="viewChatHistoryFromBubble()" title="History">
                    <span class="material-symbols-rounded">history</span>
                </button>
                <button class="icon-btn" onclick="toggleAIBubble()" title="Close">
                    <span class="material-symbols-rounded">close</span>
                </button>
            </div>
            <div id="ai-bubble-messages"></div>
            <div id="ai-bubble-input-area">
                <input type="text" id="ai-bubble-input" placeholder="Ask about your portfolio..." 
                    onkeydown="if(event.key==='Enter')sendAIBubbleMessage()">
                <button onclick="sendAIBubbleMessage()" id="ai-bubble-send">
                    <span class="material-symbols-rounded">send</span>
                </button>
            </div>
            <div id="ai-bubble-quick-actions">
                <button onclick="sendBubbleQuick('How am I doing?')">Portfolio health</button>
                <button onclick="sendBubbleQuick('What should I invest in?')">Invest tips</button>
                <button onclick="sendBubbleQuick('Analyze my goals')">Goal check</button>
            </div>
        </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        #ai-floating-bubble {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 9999;
            font-family: 'Roboto', sans-serif;
        }
        #ai-bubble-button {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: var(--md-primary);
            color: var(--md-on-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: var(--md-elevation-3);
            transition: transform 0.2s, box-shadow 0.2s;
            position: relative;
        }
        #ai-bubble-button:hover {
            transform: scale(1.05);
            box-shadow: var(--md-elevation-4);
        }
        #ai-bubble-button:active {
            transform: scale(0.95);
        }
        #ai-bubble-icon {
            font-size: 28px;
        }
        #ai-bubble-badge {
            position: absolute;
            top: -2px;
            right: -2px;
            width: 20px;
            height: 20px;
            background: var(--md-error);
            border-radius: 50%;
            border: 2px solid var(--md-surface);
        }
        #ai-bubble-chat {
            position: absolute;
            bottom: 70px;
            right: 0;
            width: 360px;
            max-width: calc(100vw - 48px);
            height: 480px;
            max-height: calc(100vh - 120px);
            background: var(--md-surface);
            border-radius: 20px;
            box-shadow: var(--md-elevation-4);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            animation: aiBubbleSlideIn 0.3s ease-out;
        }
        @keyframes aiBubbleSlideIn {
            from { opacity: 0; transform: translateY(20px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        #ai-bubble-header {
            padding: 16px;
            border-bottom: 1px solid var(--md-outline-variant);
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            color: var(--md-on-surface);
        }
        #ai-bubble-messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        #ai-bubble-messages .user-msg {
            align-self: flex-end;
            background: var(--md-primary);
            color: var(--md-on-primary);
            padding: 12px 16px;
            border-radius: 16px 16px 4px 16px;
            max-width: 85%;
            font-size: 14px;
            line-height: 1.4;
        }
        #ai-bubble-messages .ai-msg {
            align-self: flex-start;
            background: var(--md-surface-container-highest);
            color: var(--md-on-surface);
            padding: 12px 16px;
            border-radius: 16px 16px 16px 4px;
            max-width: 95%;
            font-size: 14px;
            line-height: 1.5;
        }
        #ai-bubble-messages .ai-msg table {
            font-size: 12px;
            margin: 8px 0;
        }
        #ai-bubble-messages .ai-msg h1, 
        #ai-bubble-messages .ai-msg h2,
        #ai-bubble-messages .ai-msg h3 {
            margin: 8px 0;
        }
        #ai-bubble-input-area {
            padding: 12px 16px;
            border-top: 1px solid var(--md-outline-variant);
            display: flex;
            gap: 8px;
        }
        #ai-bubble-input {
            flex: 1;
            border: none;
            background: var(--md-surface-container-highest);
            padding: 12px 16px;
            border-radius: 24px;
            font-size: 14px;
            outline: none;
            color: var(--md-on-surface);
        }
        #ai-bubble-input::placeholder {
            color: var(--md-on-surface-variant);
        }
        #ai-bubble-send {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: var(--md-primary);
            color: var(--md-on-primary);
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: transform 0.2s;
        }
        #ai-bubble-send:hover {
            transform: scale(1.05);
        }
        #ai-bubble-send:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        #ai-bubble-quick-actions {
            display: flex;
            gap: 8px;
            padding: 8px 16px;
            overflow-x: auto;
            border-top: 1px solid var(--md-outline-variant);
        }
        #ai-bubble-quick-actions button {
            white-space: nowrap;
            padding: 8px 14px;
            background: var(--md-surface-container-highest);
            border: none;
            border-radius: 16px;
            font-size: 12px;
            color: var(--md-primary);
            cursor: pointer;
            transition: background 0.2s;
        }
        #ai-bubble-quick-actions button:hover {
            background: var(--md-primary-container);
        }
        #ai-bubble-typing {
            display: flex;
            gap: 4px;
            padding: 12px;
        }
        #ai-bubble-typing span {
            width: 8px;
            height: 8px;
            background: var(--md-outline);
            border-radius: 50%;
            animation: typingBounce 1.4s ease-in-out infinite;
        }
        #ai-bubble-typing span:nth-child(2) { animation-delay: 0.2s; }
        #ai-bubble-typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typingBounce {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-10px); }
        }
        @media (max-width: 480px) {
            #ai-floating-bubble {
                bottom: 16px;
                right: 16px;
            }
            #ai-bubble-chat {
                width: calc(100vw - 32px);
                right: -8px;
            }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(bubble);
    
    aiBubbleInitialized = true;
}

function toggleAIBubble() {
    if (!aiBubbleInitialized) initAIFloatingBubble();
    
    const chat = document.getElementById('ai-bubble-chat');
    const button = document.getElementById('ai-bubble-button');
    
    if (aiBubbleExpanded) {
        chat.style.display = 'none';
        button.style.display = 'flex';
        aiBubbleExpanded = false;
    } else {
        haptic(30);
        chat.style.display = 'flex';
        renderAIBubbleMessages();
        setTimeout(() => {
            const input = document.getElementById('ai-bubble-input');
            if (input) input.focus();
        }, 100);
        aiBubbleExpanded = true;
    }
}

function renderAIBubbleMessages() {
    const container = document.getElementById('ai-bubble-messages');
    if (!container) return;
    
    if (db.chatHistory.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:40px 20px;color:var(--md-outline);">
                <span class="material-symbols-rounded" style="font-size:48px;margin-bottom:16px;display:block;">smart_toy</span>
                <div style="font-size:16px;font-weight:500;margin-bottom:8px;">Hi! I'm your AI Assistant</div>
                <div style="font-size:13px;">Ask me about your portfolio, goals, or investment strategies.</div>
            </div>`;
        return;
    }
    
    container.innerHTML = db.chatHistory.map(m => {
        const content = m.role === 'ai' ? formatAIResponse(m.content) : escapeHtml(m.content);
        const className = m.role === 'ai' ? 'ai-msg' : 'user-msg';
        return `<div class="${className}">${content}</div>`;
    }).join('');
    
    container.scrollTop = container.scrollHeight;
}

async function sendAIBubbleMessage() {
    const input = document.getElementById('ai-bubble-input');
    const msg = input.value.trim();
    if (!msg) return;
    
    if (!db.geminiKey && !db.groqKey) {
        showSnackbar("Add API key in Settings → AI", "key");
        return;
    }
    
    // Add user message
    db.chatHistory.push({ role: 'user', content: msg });
    input.value = '';
    renderAIBubbleMessages();
    
    // Show typing
    const container = document.getElementById('ai-bubble-messages');
    const typingId = 'typing-' + Date.now();
    container.innerHTML += `<div class="ai-msg" id="${typingId}">
        <div id="ai-bubble-typing"><span></span><span></span><span></span></div>
    </div>`;
    container.scrollTop = container.scrollHeight;
    
    // Build context-rich prompt
    const historyStr = db.chatHistory.slice(-6).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const portfolioData = JSON.stringify(currentTypeTotals);
    const goalsData = JSON.stringify(db.goals.map(g => ({ name: g.name, target: g.target, saved: g.saved })));
    const sipData = JSON.stringify(db.recurring.map(r => ({ type: r.type, amount: r.amount })));
    
    const prompt = `You are a personal financial advisor analyzing this user's portfolio.

USER FINANCIAL DATA:
- Net Worth: ₹${formatInr(currentTotalNW)}
- Monthly Investment: ₹${formatInr(currentAvgMonthly)}
- Portfolio Breakdown: ${portfolioData}
- Financial Goals: ${goalsData}
- Active SIPs: ${sipData}

Recent conversation:
${historyStr}

User's new question: "${msg}"

Provide a helpful, specific response using their actual financial data. 
You can use these special formats:
- Tables: | Header | Header | with | separators
- Progress: [PROGRESS: 75% Goal Progress]
- Charts: [CHART: bar data="10000,20000,30000" labels="Jan,Feb,Mar"]
- Callouts: [!TIP] for tips, [!WARNING] for warnings, [!INFO] for info

Keep it concise (2-3 paragraphs max) and actionable.`;

    try {
        const reply = await callAIApi(prompt, "You are a concise financial advisor. Use visual elements when helpful.");
        document.getElementById(typingId).remove();
        db.chatHistory.push({ role: 'ai', content: reply });
        saveData();
        renderAIBubbleMessages();
        haptic([30, 50]);
    } catch (e) {
        document.getElementById(typingId).innerHTML = 'Sorry, I had trouble connecting. Check your API keys in Settings.';
    }
}

function sendBubbleQuick(text) {
    const input = document.getElementById('ai-bubble-input');
    input.value = text;
    sendAIBubbleMessage();
}

function viewChatHistoryFromBubble() {
    toggleAIBubble(); // Close bubble
    viewChatHistory(); // Open history sheet
}

// Initialize bubble on app load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initAIFloatingBubble, 2000);
}, { once: true });

window.toggleAIBubble = toggleAIBubble;
window.sendAIBubbleMessage = sendAIBubbleMessage;
window.sendBubbleQuick = sendBubbleQuick;
window.viewChatHistoryFromBubble = viewChatHistoryFromBubble;

function updateChatHistoryUI() {
    let html = "";
    db.chatSessions.forEach((sess, idx) => {
        const date = new Date(sess.date).toLocaleDateString();
        html += `<div class="list-item" onclick="loadChatSession(${idx})">
            <div style="flex:1;">
                <div style="font-weight:500;">${escapeHtml(sess.title)}</div>
                <div style="font-size:11px;opacity:0.6;">${date} • ${sess.messages.length} messages</div>
            </div>
            <span class="material-symbols-rounded" style="opacity:0.3;">chevron_right</span>
        </div>`;
    });
    if (!html) html = '<div style="padding:40px;text-align:center;opacity:0.5;">No saved sessions</div>';
    document.getElementById('chat-history-list').innerHTML = html;
}

async function fetchAIPrediction() {
    if (!db.geminiKey && !db.groqKey) return;
    let predictEl = document.getElementById('ai-predict-text-dashboard');
    if (!predictEl) return;

    let now = new Date(); let mSums = [];
    for (let i = 3; i >= 0; i--) {
        let m = now.getMonth() - i; let y = now.getFullYear();
        if (m < 0) { m += 12; y -= 1; }
        let monthInv = db.investments.filter(inv => {
            let d = parseDate(inv.date);
            return d.getMonth() === m && d.getFullYear() === y && !inv.isDividend;
        }).reduce((sum, inv) => sum + inv.amount, 0);
        mSums.push(monthInv);
    }
    let autoSipTotal = db.recurring.reduce((s, r) => s + r.amount, 0);
    let prompt = `User past 4 months totals: ${mSums.join(', ')}. Net worth: ${currentTotalNW}. Auto-SIPs: ${autoSipTotal}. Output ONLY: forecasted amount in <strong> tags, then one short encouraging sentence (max 10 words). Raw HTML, no codeblocks.`;
    try {
        let htmlResp = await callAIApi(prompt, "You are a financial projection engine. Return raw HTML only.");
        predictEl.innerHTML = formatAIResponse(htmlResp) + ` <span style="font-size:11px;color:var(--md-primary);cursor:pointer;" onclick="openAIPredictSheet()">Details →</span>`;
    } catch (e) {
        predictEl.innerHTML = `<span style="font-size:12px;">Add API key in Settings for AI forecasts.</span>`;
    }
}

function openAIPredictSheet() {
    generateAIForecast();
}

// openProjectionSheet() defined in app_part1.js (removed weaker duplicate that uses prompt())

async function generateAIForecast() {
    haptic(30);
    if (!db.geminiKey && !db.groqKey) { showSnackbar('Add API Key in Settings', 'key'); return; }
    openSubSheet('ai-predict-sheet');
    let content = document.getElementById('ai-predict-sheet-content');
    content.innerHTML = `<div style="padding:24px;text-align:center;color:var(--md-primary);"><span class="material-symbols-rounded ai-loading-icon" style="font-size:32px;">autorenew</span><div style="margin-top:12px;font-size:14px;">Generating category-wise forecast...</div></div>`;

    // Build category monthly data (last 3 months per category)
    let now = new Date(); let catMonthly = {};
    Object.keys(db.categories).forEach(cat => { catMonthly[cat] = []; });
    for (let i = 2; i >= 0; i--) {
        let m = now.getMonth() - i; let y = now.getFullYear();
        if (m < 0) { m += 12; y -= 1; }
        Object.keys(db.categories).forEach(cat => {
            let sum = db.investments.filter(inv => { let d = parseDate(inv.date); return inv.type === cat && d.getMonth() === m && d.getFullYear() === y && !inv.isDividend; }).reduce((s, i) => s + i.amount, 0);
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

async function openWealthBlueprint() {
    haptic(40);
    openSubSheet('wealth-blueprint-sheet');
    generateWealthBlueprint();
}

async function generateWealthBlueprint() {
    if (!db.geminiKey && !db.groqKey) {
        document.getElementById('wealth-blueprint-content').innerHTML = `<div style="padding:40px;text-align:center;color:var(--md-error);">Add API Key in Settings to generate Wealth Blueprint.</div>`;
        return;
    }

    let container = document.getElementById('wealth-blueprint-content');
    container.innerHTML = `<div style="padding:40px; text-align:center;">
        <span class="material-symbols-rounded ai-loading-icon" style="font-size:48px; color:var(--md-primary);">psychology</span>
        <div style="margin-top:16px; font-weight:500;">Drafting your personalized wealth strategy...</div>
    </div>`;

    let portfolioData = {
        totalNetWorth: currentTotalNW,
        categoryBreakdown: currentTypeTotals,
        monthlyIncome: db.userProfile.salary / 12,
        monthlyExpenses: db.userProfile.monthlyExpense || 0,
        recurringSips: db.recurring,
        taxSavings80C: db.investments.filter(i => db.categories[i.type] && db.categories[i.type].is80c && isCurrentFY(i.date)).reduce((s, i) => s + i.amount, 0),
        goals: db.goals
    };

    let prompt = `Act as an elite Wealth Manager. Perform a Full Wealth Audit.
    User Data: ${JSON.stringify(portfolioData)}.
    Current State: Analyze net worth vs monthly expenses (${portfolioData.monthlyExpenses}).
    Future Planning: Suggest actions for next 12 months.
    Safety Net: Evaluate if Emergency Fund covers 6-12 months of expenses.
    80C Status: User has saved ₹${portfolioData.taxSavings80C} out of ₹1.5L limit.
    Requirements:
    1. Provide a "Portfolio Health Score" (0-100).
    2. Identify top 3 strengths and top 3 weaknesses.
    3. Suggest specific asset rebalancing.
    4. Provide a "Wealth Projection" for 5, 10, and 20 years.
    5. Action Plan: 3 immediate steps.
    
    Output Format: HTML with MD3 styling. Use cards, progress bars, and tables. No markdown code blocks. Keep it premium and visual.`;

    try {
        let report = await callAIApi(prompt, "You are a master of financial aesthetics. Use clean HTML/CSS.");
        container.innerHTML = report;
    } catch (e) {
        container.innerHTML = `<div style="padding:40px;text-align:center;color:var(--md-error);">Failed to generate blueprint. Check connection.</div>`;
    }
}

async function autoSetGoalsViaAI() {
    haptic(40);
    if (!db.geminiKey && !db.groqKey) { showSnackbar("API Key Required", "key"); return; }
    showSnackbar("AI calculating optimal goals...", "auto_awesome");
    let sal = db.userProfile.salary || 0;
    let exp = db.userProfile.monthlyExpense || 0;

    if (sal === 0) return showSnackbar("Please set Salary in Settings first.", "error");

    let prompt = `User earns ₹${sal} annually. Monthly expenses are ₹${exp}.
    Calculate targets:
    1. Emergency Fund: 6x Monthly Expenses.
    2. Liquid Cash: 1.5x Monthly Expenses.
    3. Annual Tax Goal: If regime is 'old', suggested is 1.5L for 80C.
    Return ONLY valid JSON: {"Emergency Fund": <value>, "Liquid Cash": <value>, "Tax Savings": <value>}. No other text.`;

    try {
        let res = await callAIApi(prompt, "You return only JSON.");
        let data = JSON.parse(res);

        const syncGoal = (name, target, cat) => {
            let g = db.goals.find(x => x.name === name);
            if (g) g.target = target;
            else db.goals.push({ id: generateUniqueId(), name: name, target: target, saved: 0, linkedCategory: cat });
        };

        syncGoal("Emergency Fund", data["Emergency Fund"], "Liquid");
        syncGoal("Liquid Cash", data["Liquid Cash"], "Cash");
        syncGoal("Tax Savings", data["Tax Savings"], "PF");

        saveData(); renderAll(); showSnackbar("Goals Auto-Synced!", "check_circle");
    } catch (e) { showSnackbar("AI Sync Failed", "error"); }
}

async function askAIEngine(context) {
    haptic(40);
    if (!db.geminiKey && !db.groqKey) {
        showSnackbar("Save API Key First", "key");
        setTimeout(openSettings, 1000);
        return;
    }

    const aiContainer = document.getElementById('ai-response-container');
    const chartSection = document.getElementById('ai-report-charts');

    // UI Loading State with contextual labels
    let loadingLabel = "Analyzing Data...";
    if (context === 'full_report') loadingLabel = "Conducting Strategic Wealth Audit...";
    if (context === 'allocation') loadingLabel = "Analyzing Asset Distribution & Risk...";
    if (context === 'ledger') loadingLabel = "Auditing Behavioral Spending Habits...";

    aiContainer.innerHTML = `
        <div style="padding:40px 24px; text-align:center; color:var(--md-primary);">
            <span class="material-symbols-rounded ai-loading-icon" style="font-size:48px;">cognition</span>
            <div style="margin-top:16px; font-weight:500; font-family:'Google Sans';">${loadingLabel}</div>
            <div style="font-size:12px; opacity:0.7; margin-top:8px;">Deep-diving into your financial telemetry.</div>
        </div>`;

    chartSection.style.display = 'none';
    openSubSheet('ai-sheet');

    // 1. DATA PREP (Shared Context)
    const now = new Date();
    const payload = {
        netWorth: currentTotalNW,
        burnRate: db.userProfile.monthlyExpense || 0,
        salary: db.userProfile.salary,
        allocation: currentTypeTotals,
        targets: db.allocTargets,
        recentHistory: db.investments.slice(-40), // More context for deeper analysis
        taxSaved: db.investments.filter(i => db.categories[i.type]?.is80c && isCurrentFY(i.date)).reduce((s, i) => s + i.amount, 0),
        goals: db.goals
    };

    let catMonthly = {};
    Object.keys(db.categories).forEach(cat => { catMonthly[cat] = []; });
    for (let i = 2; i >= 0; i--) {
        let m = now.getMonth() - i; let y = now.getFullYear();
        if (m < 0) { m += 12; y -= 1; }
        Object.keys(db.categories).forEach(cat => {
            let sum = db.investments.filter(inv => { let d = parseDate(inv.date); return inv.type === cat && d.getMonth() === m && d.getFullYear() === y && !inv.isDividend; }).reduce((s, i) => s + i.amount, 0);
            catMonthly[cat].push(sum);
        });
    }
    let autoSips = {};
    db.recurring.forEach(r => { autoSips[r.type] = (autoSips[r.type] || 0) + r.amount; });

    let promptBase = "";

    // 2. CONTEXT-SPECIFIC STRATEGIC PROMPTS
    if (context === 'full_report') {
        promptBase = `You are an Elite Financial Strategist. Your goal is to provide a "Brutal & Brilliant" wealth audit. Do not sugarcoat. Analyze the provided telemetry and deliver a masterclass in wealth management.
        GIVE AN INDIAN FORMAYED MIDDLE CLASS USERS CAN UNDERSTAND THAT SIMPLE AND EASY LANGUAGE REPSONSES
        <CONTEXT_TELEMETRY>
        - Comprehensive Portfolio: ${JSON.stringify(payload)}
        - Monthly Investment Velocity: ${JSON.stringify(catMonthly)}
        - Recurring Commitments (SIPs): ${JSON.stringify(autoSips)}
        - Target Allocations: ${JSON.stringify(db.allocTargets)}
        </CONTEXT_TELEMETRY>

        <STRATEGIC_MANDATE>
        Execute a 4-dimensional analysis:
        1. THE CURRENT REALITY: Analyze the delta between Salary, Expenses, and Net Worth. Is the user actually building wealth or just moving money? Evaluate the Emergency Fund safety (6-12 month runway).
        2. THE BEHAVIORAL AUDIT: Based on the last 20 transactions, identify "Discipline Hits" (Wins) and "Leaks" (Losses). What habits are invisible to the user but visible in the data?
        3. THE 5-YEAR PROJECTION (THE "CHANGE" BENEFIT): Calculate the compound impact of current changes. Contrast the "As-Is" trajectory with the "Optimized" trajectory if they fix their current mistakes today.
        4. TACTICAL BLUEPRINT: What exactly must happen in the next 90 days to secure the next 5 years?
        </STRATEGIC_MANDATE>

        <OUTPUT_SCHEMA_RULES>
        Format using MD3 (Material Design 3) logic: Use bold headers, No markdown and emphasized blockquotes.
        Output Format: HTML with MD3 styling. Use cards, progress bars, and tables. No markdown code blocks. Keep it premium and visual.
        Make sure table are designed for mobile UI, AND gaps between the topics are correct.

        # Wealth Intelligence & Strategic Audit
        > **Executive Summary:** A 5-10 sentence high-level verdict on the user's current financial trajectory.

        ## 1. The Reality Check: Current State in table html designed for mobile and dynamcially update for laptop
        **Portfolio Health Score: [X/100]**
        | Metric | Value | Verdict |
        | :--- | :--- | :--- |
        | Net Worth | ₹${formatInr(payload.netWorth)} | [Analysis] |
        | Savings Rate | [Calculated %] | [Efficient/Inefficient] |
        | Tax Efficiency | ₹${payload.taxSavings80C}/1.5L | [Warning/Good] |

        ## 2. The Mirror: What You're Doing Right & Wrong
        ### 🟢 Winning Habits (The Green List)
        - [Identify specific patterns from the last 20 transactions and SIPs that are building wealth]
        ### 🔴 Current Friction Points (The Red List)
        - [Identify specific mistakes: Over-concentration, inconsistent SIPs, or high expense ratios]

        ## 3. The 5-Year Vision: The Cost of Inaction vs. Action
        - **The "As-Is" Path:** If habits don't change, where will the user be in 2031?
        - **The "Optimized" Path:** If the user implements your suggestions today, what is the ₹[Amount] difference in 5 years?
        - **Strategic Benefit:** How current changes in allocation will bulletproof them against market volatility.

        ## 4. The 90-Day Tactical Blueprint
        ### Phase 1: Immediate Stabilization (Next 30 Days)
        - [3 specific tasks: e.g., "Top up 80C by ₹X", "Rebalance Category Y"]
        ### Phase 2: Growth Acceleration (Next 60-90 Days)
        - [Strategic moves for future planning and goal hitting]

        ## 5. Next-Month Predictive Forecast
        | Category | Predicted Action | Rationale | Trend |
        | :--- | :--- | :--- | :--- |
        [Populate from catMonthly velocity]


        ##6. overall feels about user profile
        </OUTPUT_SCHEMA_RULES>
        `;
    }
    else if (context === 'allocation') {
        promptBase = `Act as a Risk & Portfolio Manager. DATA: ${JSON.stringify({ current: payload.allocation, targets: payload.targets })}.
        Analyze current distribution vs targets. 
        1. Identify Concentration Risks (where user is over-exposed).
        2. Identify Opportunity Gaps (where user is under-invested).
        3. Strategic Rebalancing: Provide a step-by-step plan to reach target parity.
        4. How these changes bulletproof the portfolio for the next 5 years.
        Format: Direct, analytical, using MD3 cards/tables.`;
    }
    else if (context === 'ledger') {
        promptBase = `Act as a Forensic Financial Auditor. DATA: ${JSON.stringify(payload.recentHistory)}.
        Deep-dive into the last 40 transactions.
        1. Behavioral Patterns: Is the user impulsive or disciplined? 
        2. Hidden Leaks: Identify recurring friction or spending "clutter".
        3. Winning Streaks: Highlight the best financial decisions seen in the ledger.
        4. Habit Shift: Suggest 3 psychological shifts to improve cash flow next month.
        Format: Professional and investigative.`;
    }

    try {
        const response = await callAIApi(promptBase, "You are a top-tier Financial AI. Your responses are deep, informative, and strategically superior.");
        aiContainer.innerHTML = formatAIResponse(response);

        // Show charts only for relevant contexts
        if (context === 'full_report' || context === 'allocation') {
            chartSection.style.display = 'flex';
            renderAIReportCharts(currentTypeTotals);
        }
        haptic([30, 50]);
    } catch (e) {
        aiContainer.innerHTML = `<div style="color:var(--md-error); padding:20px;">Analysis failed. Check your connection or API keys.</div>`;
    }
}

