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

    if (!date || isNaN(amt)) return showSnackbar("Date and Amount required", "error");
    let newEntry = {
        id: editInvId || Date.now(),
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
            id: Date.now() - 1,
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
    let dObj = parseDate(inv.date);
    let dateStr = `${dObj.getDate()} ${dObj.toLocaleString('default', { month: 'short' })} ${dObj.getFullYear()}`;
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
        html = Object.keys(groups).length === 0 ? `<div class="empty-state-premium"><span class="material-symbols-rounded">inbox</span><div class="es-title">No Entries</div></div>` : Object.keys(groups).map(m => `<div class="ledger-month-header">${m}</div>` + groups[m].map(buildUnifiedItemHTML).join('')).join('');
    } else {
        html = filtered.length === 0 ? `<div class="empty-state-premium"><span class="material-symbols-rounded">inbox</span><div class="es-title">No Entries</div></div>` : filtered.map(buildUnifiedItemHTML).join('');
    }
    let container = document.getElementById('ledger-history-list'); if (container) { container.innerHTML = html; attachSwipeListeners(container); }
}
window.renderHistory = renderHistory;
window.buildUnifiedItemHTML = buildUnifiedItemHTML;
window.attachSwipeListeners = attachSwipeListeners;

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
    // Comprehensive Data Audit for Passive Income
    let auditCount = 0;
    const passiveTerms = ['dividend', 'interest', 'payout', 'rent', 'income', 'cashback', 'yield', 'div', 'roi', 'passive'];

    db.investments.forEach(inv => {
        const text = ((inv.note || "") + " " + (inv.tags || "") + " " + (inv.type || "")).toLowerCase();
        const isPassiveCategory = (inv.type || "").toLowerCase().includes('dividend') || (inv.type || "").toLowerCase().includes('interest');
        const shouldBeDividend = passiveTerms.some(term => text.includes(term)) || isPassiveCategory || inv.isDividend;

        if (shouldBeDividend && !inv.isDividend) {
            inv.isDividend = true;
            auditCount++;
        }
    });

    if (auditCount > 0) {
        saveData();
    }

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
    renderListToContainer(filtered.sort((a, b) => parseDate(b.date) - parseDate(a.date)), 'cat-history-list');
    document.getElementById('scrim').classList.add('active'); document.getElementById('category-sheet').classList.add('active');

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

    // Save field configurations
    const fields = {};
    const fieldIds = ['interest', 'payout', 'maturity', 'sipday', 'mf', 'qty'];
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
        if (offset === 1) { m = m === 0 ? 11 : m - 1; y = m === 11 ? y - 1 : y; }
        let monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        document.getElementById('month-sheet-title').innerHTML = `<span class="material-symbols-rounded" style="color:var(--md-primary);">calendar_month</span> ${monthNames[m]} ${y}`;
        filtered = db.investments.filter(i => {
            let d = parseDate(i.date);
            return d.getMonth() === m && d.getFullYear() === y && (activeAccountFilter === 'All' || i.account === activeAccountFilter);
        });
    }
    renderListToContainer(filtered.sort((a, b) => parseDate(b.date) - parseDate(a.date)), 'month-history-list');
    document.getElementById('scrim').classList.add('active'); document.getElementById('month-sheet').classList.add('active');
}

function openSettings() {
    haptic(30);
    document.getElementById('settings-salary').value = db.userProfile.salary || '';
    document.getElementById('settings-regime').value = db.userProfile.regime || 'new';
    document.getElementById('settings-expenses').value = db.userProfile.monthlyExpense || '';
    document.getElementById('settings-pin').value = db.appPin || '';
    document.getElementById('gemini-api-key').value = db.geminiKey || '';
    document.getElementById('groq-api-key').value = db.groqKey || '';

    let accHtml = ""; db.accounts.forEach((a, idx) => { let delBtn = idx === 0 ? '' : `<span class="material-symbols-rounded" style="color:var(--md-error);font-size:16px;cursor:pointer;" onclick="deleteAccount('${a}')">delete</span>`; accHtml += `<div style="display:flex;justify-content:space-between;padding:12px;background:var(--md-surface-container-highest);border-radius:12px;"><span>${a}</span>${delBtn}</div>`; }); document.getElementById('account-list').innerHTML = accHtml;

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
    document.getElementById('category-crud-list').innerHTML = catHtml;

    let badgeHtml = ""; milestoneThresholds.forEach(t => { let unlocked = db.milestones.includes(t.val); if (unlocked) badgeHtml += `<div class="badge-item"><span class="material-symbols-rounded">workspace_premium</span> ${t.label}</div>`; else badgeHtml += `<div class="badge-item locked"><span class="material-symbols-rounded">lock</span> ${t.label}</div>`; }); document.getElementById('badge-grid').innerHTML = badgeHtml;
    document.getElementById('scrim').classList.add('active'); document.getElementById('settings-sheet').classList.add('active');
}
window.openSettings = openSettings;

function updateCategorySetting(cat, key, val) {
    if (!db.categories[cat]) return;
    if (key === 'targetMultiplier') db.categories[cat][key] = parseFloat(val) || 0;
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
        flat: {},
        fd: { interest: true, payout: true, maturity: true },
        sip: { mf: true, sipday: true, monthly: true },
        stock: { mf: true, qty: true },
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
        if (sessionStorage.getItem('appUnlocked') === 'true') {
            const lockScreen = document.getElementById('app-lock-screen');
            if (lockScreen) lockScreen.style.display = 'none';
            return true;
        }
        const lockScreen = document.getElementById('app-lock-screen');
        if (lockScreen) lockScreen.style.display = 'flex';

        if (db.useBiometric && window.PublicKeyCredential) {
            try {
                const cred = await navigator.credentials.get({
                    publicKey: { challenge: new Uint8Array(16), timeout: 60000, allowCredentials: [] }
                }).catch(() => null);

                if (cred) {
                    sessionStorage.setItem('appUnlocked', 'true');
                    if (lockScreen) lockScreen.style.display = 'none';
                    return true;
                }
            } catch (e) {
                console.log("Biometric auth failed or cancelled", e);
            }
        }
        return false;
    } else {
        const lockScreen = document.getElementById('app-lock-screen');
        if (lockScreen) lockScreen.style.display = 'none';
        return true;
    }
}
function unlockApp() {
    let pin = document.getElementById('pin-input-auth').value;
    if (pin === db.appPin) {
        haptic(50);
        sessionStorage.setItem('appUnlocked', 'true');
        document.getElementById('app-lock-screen').style.display = 'none';
        document.getElementById('pin-input-auth').value = '';

        // Restore last active sheet if any
        let lastSheet = sessionStorage.getItem('currentSheet');
        if (lastSheet) {
            openSheet(lastSheet);
        }
    } else {
        haptic([50, 50]);
        showSnackbar("Incorrect PIN", "error");
        document.getElementById('pin-input-auth').value = '';
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
            if (!db.settingsTable) db.settingsTable = { lastResetMonth: '' };
            saveData(); initUI(); renderAll(); closeOverlays(); showSnackbar("Data Restored Instantly", "check_circle"); e.target.value = '';
        } catch (err) { showSnackbar("Invalid or Corrupted Backup", "error"); }
    }; reader.readAsText(file);
}

let webrtcScanner;
async function webrtcStartAsReceiver() {
    haptic(40);
    document.getElementById('webrtc-mode-selector').style.display = 'none';
    document.getElementById('webrtc-active-ui').style.display = 'flex';
    document.getElementById('webrtc-qr-display').style.display = 'block';
    document.getElementById('webrtc-status').innerText = 'Status: Generating Receive Code...';

    initWebRTC();
    // In receiver mode, we create the offer
    webrtcChannel = webrtcConn.createDataChannel('sync');
    setupDataChannel();

    let offer = await webrtcConn.createOffer();
    await webrtcConn.setLocalDescription(offer);

    // The ICE candidates will trigger onicecandidate, which will update the QR
    // But we might need to wait for candidates if we want a "full" offer QR
}

async function webrtcStartAsSender() {
    haptic(40);
    document.getElementById('webrtc-mode-selector').style.display = 'none';
    document.getElementById('webrtc-active-ui').style.display = 'flex';
    document.getElementById('webrtc-scanner-ui').style.display = 'flex';
    document.getElementById('webrtc-status').innerText = 'Status: Scan Receiver QR...';

    webrtcScanner = new Html5Qrcode("webrtc-reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    webrtcScanner.start({ facingMode: "environment" }, config, async (decodedText) => {
        await webrtcStopScanner();
        haptic([50, 50]);
        document.getElementById('webrtc-code-input').value = decodedText;
        await webrtcProcessInput();
    });
}

async function webrtcStopScanner() {
    if (webrtcScanner) {
        await webrtcScanner.stop();
        webrtcScanner = null;
    }
    document.getElementById('webrtc-scanner-ui').style.display = 'none';
}

function initWebRTC() {
    webrtcConn = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    webrtcConn.onicecandidate = e => {
        if (!e.candidate) {
            let code = btoa(JSON.stringify(webrtcConn.localDescription));
            document.getElementById('webrtc-code-output').value = code;

            // Generate QR
            const qrDiv = document.getElementById('webrtc-qr');
            qrDiv.innerHTML = '';
            new QRCode(qrDiv, {
                text: code,
                width: 200,
                height: 200,
                colorDark: "#4559A4",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.L
            });

            document.getElementById('webrtc-status').innerText = 'Status: QR Ready! Scan now.';

            // Add a "Scan Answer QR" button for the receiver
            if (!document.getElementById('webrtc-scan-answer-btn')) {
                const btn = document.createElement('button');
                btn.id = 'webrtc-scan-answer-btn';
                btn.className = 'btn-secondary';
                btn.style.marginTop = '12px';
                btn.style.width = '100%';
                btn.innerText = 'Step 2: Scan Answer QR';
                btn.onclick = () => webrtcStartAsSender(); // Reuse sender logic to scan
                document.getElementById('webrtc-qr-display').appendChild(btn);
            }
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
                saveData(); initUI(); renderAll();
                showSnackbar("Data Synced via WebRTC!", "sync");
                haptic([100, 50, 100]);
            } catch (err) { showSnackbar("Sync Failed", "error"); }
        }
    };
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
            document.getElementById('webrtc-status').innerText = 'Status: Answer generated. Show this QR to Receiver.';
            document.getElementById('webrtc-qr-display').style.display = 'block';
            // QR will be updated via onicecandidate for the answer
        } else if (desc.type === 'answer') {
            await webrtcConn.setRemoteDescription(desc);
            document.getElementById('webrtc-status').innerText = 'Status: Connecting...';
            document.getElementById('webrtc-qr-display').style.display = 'none';
            document.getElementById('webrtc-manual-area').style.display = 'none';
        }
    } catch (e) {
        showSnackbar("Invalid QR/Code", "error");
        console.error(e);
    }
}

function webrtcSendSync() {
    if (webrtcChannel && webrtcChannel.readyState === 'open') {
        webrtcChannel.send('SYNC:' + JSON.stringify(db));
        showSnackbar("Data synced successfully!", "check_circle");
        haptic([100, 50, 100]);
        setTimeout(() => location.reload(), 2000);
    } else {
        showSnackbar("Not connected yet!", "warning");
    }
}

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
                    db.investments.push({ id: Date.now() + Math.random(), date: cols[0].trim(), type: cols[1].trim() || 'Cash', amount: parseFloat(cols[2]), note: cols[3] ? cols[3].trim() : '', tags: cols[4] ? cols[4].trim() : '', isDividend: false, account: activeAccountFilter === 'All' ? db.accounts[0] : activeAccountFilter });
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
        document.getElementById('xirr-result').innerText = "No investments in this category.";
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

    if (cashFlows.length < 2) {
        document.getElementById('xirr-result').innerText = "Need at least two data points (e.g., investment and current value).";
        return;
    }

    // Sort flows by date
    cashFlows.sort((a, b) => a.date - b.date);
    let d0 = cashFlows[0].date;

    const irr = (flows) => {
        let guess = 0.1;
        const maxIter = 100;
        const precision = 0.0001;

        for (let i = 0; i < maxIter; i++) {
            let f = 0, df = 0;
            for (let j = 0; j < flows.length; j++) {
                let t = (flows[j].date - d0) / (365.25 * 24 * 60 * 60 * 1000);
                let discountFactor = Math.pow(1 + guess, t);

                f += flows[j].amount / discountFactor;
                df += -t * flows[j].amount / Math.pow(1 + guess, t + 1);
            }

            if (Math.abs(f) < precision) return guess;

            let nextGuess = guess - f / df;
            if (isNaN(nextGuess) || !isFinite(nextGuess)) break;

            guess = nextGuess;
            if (guess <= -1) guess = -0.999; // Cap at near -100% loss
        }
        return guess;
    };

    let result = irr(cashFlows);
    let resultText = (result * 100).toFixed(2) + '%';
    document.getElementById('xirr-result').innerHTML = `XIRR: <strong style="color:var(--md-primary); font-size:24px;">${resultText}</strong>`;
}
function calculateMonthlySIP() { let target = parseFloat(document.getElementById('sip-target').value); let years = parseFloat(document.getElementById('sip-years').value); let rate = parseFloat(document.getElementById('sip-return').value) / 100 / 12; let months = years * 12; let monthly = target * rate / (Math.pow(1 + rate, months) - 1); document.getElementById('sip-result').innerHTML = `Monthly SIP needed: <strong>${formatMoney(monthly)}</strong>`; }
function calculateEMI() { let P = parseFloat(document.getElementById('emi-principal').value); let years = parseFloat(document.getElementById('emi-tenure').value); let rate = parseFloat(document.getElementById('emi-rate').value) / 12 / 100; let n = years * 12; let emi = P * rate * Math.pow(1 + rate, n) / (Math.pow(1 + rate, n) - 1); document.getElementById('emi-result').innerHTML = `Monthly EMI: <strong>${formatMoney(emi)}</strong>`; }
function calculateInflation() { let pv = parseFloat(document.getElementById('inf-present').value); let years = parseFloat(document.getElementById('inf-years').value); let rate = parseFloat(document.getElementById('inf-rate').value) / 100; let fv = pv * Math.pow(1 + rate, years); document.getElementById('inf-result').innerHTML = `Future Value: <strong>${formatMoney(fv)}</strong>`; }
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
function saveChatSession() { haptic(40); if (db.chatHistory.length > 0) { db.chatSessions.push({ date: new Date().toISOString(), messages: [...db.chatHistory] }); db.chatHistory = []; saveData(); document.getElementById('ai-chat-log').innerHTML = ''; showSnackbar("Chat saved. Started new session."); } else { showSnackbar("Already in a new session."); } }
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

    // 2. PROTECT TABLES: Process tables first while newlines still exist
    const tableRegex = /((?:\|.*\|(?:\n|\r|\r\n))+)/g;
    formatted = formatted.replace(tableRegex, (match) => {
        // Only process if it looks like a real table (contains a separator row)
        if (match.includes('| ---') || match.includes('|---')) {
            const lines = match.trim().split(/\n|\r/);
            let htmlTable = '<div class="table-container"><table><thead>';

            let bodyStarted = false;

            lines.forEach((line) => {
                if (line.includes('---')) {
                    htmlTable += '</thead><tbody>';
                    bodyStarted = true;
                    return;
                }

                const cells = line.split('|').filter(c => c.trim() !== '');
                if (cells.length === 0) return;

                htmlTable += '<tr>';
                cells.forEach(cell => {
                    const tag = bodyStarted ? 'td' : 'th';
                    htmlTable += `<${tag}>${cell.trim()}</${tag}>`;
                });
                htmlTable += '</tr>';
            });

            htmlTable += '</tbody></table></div>';
            return htmlTable;
        }
        return match;
    });

    // 3. PROCESS MARKDOWN (Headers, Lists, Blockquotes)
    formatted = formatted
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
        // Process Lists
        .replace(/^\* (.*$)/gim, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
        .replace(/<\/ul>\s*<ul>/g, '')
        // Links
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');

    // 4. PRESERVE SPACING (Only for non-HTML elements)
    return formatted.split('\n').map(line => {
        if (line.startsWith('<') || line.endsWith('>')) return line;
        return line.trim() === '' ? '<br>' : `<p>${line}</p>`;
    }).join('');
}

function saveChatSession() {
    if (db.chatHistory.length === 0) {
        showSnackbar("No messages to save", "error");
        return;
    }
    haptic(40);
    const title = db.chatHistory[0].content.substring(0, 30) + "...";
    db.chatSessions.unshift({
        id: Date.now(),
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

function updateChatHistoryUI() {
    let html = "";
    db.chatSessions.forEach((sess, idx) => {
        const date = new Date(sess.date).toLocaleDateString();
        html += `<div class="list-item" onclick="loadChatSession(${idx})">
            <div style="flex:1;">
                <div style="font-weight:500;">${sess.title}</div>
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
        predictEl.innerHTML = htmlResp + ` <span style="font-size:11px;color:var(--md-primary);cursor:pointer;" onclick="openAIPredictSheet()">Details →</span>`;
    } catch (e) {
        predictEl.innerHTML = `<span style="font-size:12px;">Add API key in Settings for AI forecasts.</span>`;
    }
}

function openAIPredictSheet() {
    haptic(30);
    const scrim = document.getElementById('scrim-sub');
    const sheet = document.getElementById('ai-predict-sheet');
    if (scrim) scrim.classList.add('active');
    if (sheet) sheet.classList.add('active');
    generateAIForecast();
}

function openProjectionSheet() {
    haptic(30);
    const target = prompt("Enter your monthly investment goal (₹):", db.settingsTable.monthlyTargetRef || 0);
    if (target !== null && !isNaN(parseFloat(target))) {
        db.settingsTable.monthlyTargetRef = parseFloat(target);
        saveData(); renderAll();
        showSnackbar("Monthly goal updated!", "check_circle");
    }
}

async function generateAIForecast() {
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
    document.getElementById('scrim-sub').classList.add('active');
    document.getElementById('wealth-blueprint-sheet').classList.add('active');
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
            else db.goals.push({ id: Date.now() + Math.random(), name: name, target: target, saved: 0, linkedCategory: cat });
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
    document.getElementById('scrim').classList.add('active');
    document.getElementById('ai-sheet').classList.add('active');

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

