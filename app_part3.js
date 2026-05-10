function renderAIReportCharts(typeTotals) {
    const pieCtx = document.getElementById('aiChartPie');
    const barCtx = document.getElementById('aiChartBar');
    if (!pieCtx || !barCtx) return;

    const labels = [], data = [], bgColors = [];
    Object.keys(typeTotals).forEach(t => {
        if (typeTotals[t] > 0) {
            labels.push(t);
            data.push(typeTotals[t]);
            bgColors.push(db.categories[t]?.color || '#ccc');
        }
    });

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        layout: { padding: 4 }
    };

    if (window.aiCharts) {
        window.aiCharts.pie?.destroy();
        window.aiCharts.bar?.destroy();
    } else {
        window.aiCharts = {};
    }

    window.aiCharts.pie = new Chart(pieCtx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: bgColors, borderWidth: 0, cutout: '70%' }] },
        options: chartOptions
    });

    window.aiCharts.bar = new Chart(barCtx, {
        type: 'bar',
        data: { labels, datasets: [{ data, backgroundColor: bgColors, borderRadius: 4 }] },
        options: { ...chartOptions, scales: { x: { display: false }, y: { display: false } } }
    });
}

async function downloadAIReport() {
    const element = document.getElementById('ai-sheet');

    // 1. Ensure the element exists and is visible
    if (!element || element.clientHeight === 0) {
        console.error("Target element is missing or has 0 height.");
        return;
    }

    const opt = {
        margin: 0.2,
        filename: 'Wealth_Strategic_Audit.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 1, // Lower this to 1 for testing to rule out memory issues
            useCORS: true,
            allowTaint: true,
            letterRendering: true
        },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    try {
        showSnackbar("Preparing Report...");
        // 2. Use the Worker API (This is the most stable way)
        await html2pdf().set(opt).from(element).toPdf().get('pdf').save().then(() => {
            showSnackbar("Exporting Premium Report...");
        });
        showSnackbar("Download Complete!");
    } catch (error) {
        console.error("PDF Generation failed:", error);
        showSnackbar("Export failed. Check console.");
    }
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
        let nextDate = parseDate(rec.nextRun); let maxSafety = 24;
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
    let dividendTotal = db.investments.filter(i => i.isDividend && !(db.categories[i.type]?.excludeDividend)).reduce((s, i) => s + i.amount, 0);
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
    let totalInterestEarnedAll = 0;
    Object.keys(db.categories).forEach(type => {
        let filteredInvs = db.investments.filter(inv => inv.type === type && (activeAccountFilter === 'All' || inv.account === activeAccountFilter));
        let invested = filteredInvs.filter(i => !i.isDividend).reduce((sum, inv) => sum + inv.amount, 0) + (db.categoryDetails[type]?.initialBal || 0);
        totalInvestedAll += invested;

        let valResult = calculateStrictValuation(type, invested, filteredInvs);
        typeTotals[type] = valResult.total;
        totalMarketValue += valResult.total;
        totalInterestEarnedAll += valResult.interest;
        totalNW += invested;
    });

    const pnlEl = document.getElementById('sc-pnl');
    if (pnlEl) {
        pnlEl.innerText = formatMoney(totalInterestEarnedAll);
        pnlEl.style.color = totalInterestEarnedAll >= 0 ? "var(--md-success)" : "var(--md-error)";
    }
    const investedEl = document.getElementById('sc-invested');
    if (investedEl) investedEl.innerText = formatMoney(totalInvestedAll);

    // Month Totals & Maturities Loop
    db.investments.forEach(inv => {
        if (activeAccountFilter !== 'All' && inv.account !== activeAccountFilter) return;
        let d = parseDate(inv.date);
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

    // checkMilestones handles confetti internally — no separate trigger needed
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
    updateAdvisorWidget();

    let activeTab = document.querySelector('.tab-content.active');
    if (activeTab && activeTab.id === 'tab-dashboard') { renderNWChart(); renderRollingChart(); }
    if (activeTab && activeTab.id === 'tab-portfolio') renderDonutChart(typeTotals, totalMarketValue);

    renderHeatmap(); fetchAIPrediction();
    updateStatChips(totalInvestedAll, totalMarketValue, yearTotal, thisMonthTotal);
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
    if (allocBar) {
        let allocHtml = "", legendHtml = "", rebalanceHtml = "", hasRebalanceTargets = false;
        let shortfalls = {}, totalShortfall = 0;

        const allCategoriesForRebalance = new Set([...Object.keys(typeTotals), ...Object.keys(db.allocTargets)]);

        allCategoriesForRebalance.forEach(t => {
            let value = typeTotals[t] || 0;
            if (value > 0) {
                let perc = (value / totalMarketValue) * 100;
                let color = db.categories[t]?.color || "#ccc";
                allocHtml += `<div class="alloc-segment" style="width:${perc}%;background:${color};"></div>`;
                legendHtml += `<span><span class="alloc-dot" style="background:${color}; display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:4px;"></span>${t} ${perc.toFixed(0)}%</span>`;
            }
            if (db.allocTargets[t]) {
                hasRebalanceTargets = true;
                let targetAmt = (db.allocTargets[t] / 100) * (totalMarketValue + (db.projectionNextMonth || 0));
                let diff = targetAmt - value;
                if (diff > 0) {
                    shortfalls[t] = diff;
                    totalShortfall += diff;
                }
            }
        });

        if (totalShortfall > 0 && db.projectionNextMonth > 0) {
            let remainingToInvest = db.projectionNextMonth;
            let allocatedSoFar = 0;

            rebalanceHtml += `<div style="font-size:11px; color:var(--md-on-surface-variant); margin-bottom:8px;">To reach targets using your ₹${db.projectionNextMonth} next investment:</div>`;

            // First pass: Fill shortfalls proportionally
            Object.keys(shortfalls).forEach(t => {
                let ratio = shortfalls[t] / totalShortfall;
                let investNext = Math.min(shortfalls[t], db.projectionNextMonth * ratio);

                if (investNext > 0) {
                    let curValue = typeTotals[t] || 0;
                    let curPerc = totalMarketValue > 0 ? (curValue / totalMarketValue * 100).toFixed(0) : 0;
                    let targetPerc = db.allocTargets[t];

                    rebalanceHtml += `<div class="reb-item" style="display:flex; flex-direction:column; margin-bottom:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span><span class="alloc-dot" style="background:${db.categories[t]?.color || '#ccc'}; display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px;"></span>${t}</span>
                            <span style="color:var(--md-primary); font-weight:600;">+${formatMoney(investNext)}</span>
                        </div>
                        <div style="font-size:10px; color:var(--md-outline); margin-left:14px;">Current: ${curPerc}% → Target: ${targetPerc}%</div>
                    </div>`;
                    allocatedSoFar += investNext;
                }
            });

            // Second pass: Leftover distribution
            remainingToInvest -= allocatedSoFar;
            if (remainingToInvest > 10) {
                rebalanceHtml += `<div style="font-size:11px; color:var(--md-primary); margin:8px 0 4px 0; border-top:1px dashed var(--md-outline-variant); padding-top:8px;">Maintain balance with remainder:</div>`;
                Object.keys(db.allocTargets).forEach(t => {
                    let weight = db.allocTargets[t] / 100;
                    let extra = remainingToInvest * weight;
                    if (extra > 1) {
                        rebalanceHtml += `<div class="reb-item" style="display:flex; justify-content:space-between; align-items:center; opacity:0.8; font-size:13px;">
                            <span style="margin-left:14px;">${t}</span>
                            <span>+${formatMoney(extra)}</span>
                        </div>`;
                    }
                });
            }
        } else if (hasRebalanceTargets && db.projectionNextMonth === 0) {
            rebalanceHtml = `<div style="font-size:12px; color:var(--md-outline); text-align:center; padding:12px;">Set 'Next Month Projection' in Dashboard to see rebalancing guide.</div>`;
        }

        allocBar.innerHTML = allocHtml;
        document.getElementById('alloc-legend').innerHTML = legendHtml;
        let rebSec = document.getElementById('rebalance-section');
        if (rebSec) {
            if (hasRebalanceTargets && rebalanceHtml !== "") {
                rebSec.innerHTML = `<div class="rebalance-card" style="background:var(--md-surface); border:1px solid var(--md-outline-variant); border-radius:16px; padding:16px;">
                    <div class="rebalance-title" style="font-weight:500; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
                        <span class="material-symbols-rounded" style="font-size:18px; color:var(--md-primary);">balance</span> Rebalance Guide
                    </div>
                    <div class="rebalance-list">${rebalanceHtml}</div>
                </div>`;
                rebSec.style.display = 'block';
            } else {
                rebSec.style.display = 'none';
            }
        }
    }

    let portGrid = document.getElementById('portfolio-grid');
    if (portGrid) { let activeCats = Object.keys(typeTotals).filter(t => typeTotals[t] > 0 || db.allocTargets[t]); portGrid.innerHTML = activeCats.length === 0 ? `<div class="empty-state-premium" style="grid-column:1 / -1;"><span class="material-symbols-rounded">pie_chart</span><div class="es-title">Empty Portfolio</div></div>` : activeCats.map(t => { let meta = db.categories[t]; let dObj = new Date(typeLastDate[t]); let dateStr = typeLastDate[t] ? `${dObj.getDate()} ${dObj.toLocaleString('default', { month: 'short' })}` : "No entries"; let cur = typeTotals[t]; let inv = db.investments.filter(i => i.type === t && !i.isDividend && (activeAccountFilter === 'All' || i.account === activeAccountFilter)).reduce((s, i) => s + i.amount, 0) + (db.categoryDetails[t]?.initialBal || 0); let prof = cur - inv; let roiHtml = prof !== 0 ? `<div class="roi-tag ${prof > 0 ? 'positive' : 'negative'}">${prof > 0 ? '+' : ''}${formatMoney(prof)}</div>` : ""; let intRate = db.categoryDetails[t]?.interestRate; let intRateHtml = intRate ? `<div style="font-size:10px;background:var(--md-surface-container-highest);padding:2px 6px;border-radius:4px;font-weight:700;color:var(--md-primary);">${intRate}% APY</div>` : ""; return `<div class="port-card" onclick="openCategoryDetails('${t}')"><div style="display:flex;justify-content:space-between;align-items:flex-start;"><div class="port-icon" style="background:${meta.color};"><span class="material-symbols-rounded" style="font-size:20px;">${meta.icon}</span></div>${intRateHtml}</div><div class="port-type">${t}</div><div class="port-amt">${formatMoney(cur)}</div>${roiHtml}<div class="port-date" style="font-size:11px; margin-top:4px; color:var(--md-outline);">Last: ${dateStr}</div></div>`; }).join(''); }

    let goalsList = document.getElementById('goals-list');
    if (goalsList) { goalsList.innerHTML = db.goals.length === 0 ? `<div class="empty-state-premium"><span class="material-symbols-rounded">flag</span><div class="es-title">No Goals Set</div></div>` : db.goals.map(g => { let savedAmt = g.saved, isLinked = false; let monthlyContrib = 0; if (g.linkedCategory) { if (typeTotals[g.linkedCategory] !== undefined) { savedAmt = typeTotals[g.linkedCategory]; isLinked = true; } monthlyContrib = db.recurring.filter(r => r.type === g.linkedCategory).reduce((s, r) => s + r.amount, 0); } let perc = Math.min(100, (savedAmt / g.target) * 100); let linkTag = isLinked ? `<span class="goal-linked-tag" style="font-size:10px; background:var(--md-surface-container-highest); padding:2px 6px; border-radius:4px; margin-left:6px;">Linked: ${g.linkedCategory}</span>` : ''; let forecastHtml = ''; if (savedAmt < g.target && monthlyContrib > 0) { let monthsLeft = Math.ceil((g.target - savedAmt) / monthlyContrib); let fDate = new Date(); fDate.setMonth(fDate.getMonth() + monthsLeft); forecastHtml = `<div style="font-size:11px;color:var(--md-primary);margin-top:8px;font-weight:500;">🎯 Expected hit: ${fDate.toLocaleString('default', { month: 'short' })} ${fDate.getFullYear()}</div>`; } return `<div class="goal-card" onclick="openGoalSheet(${g.id})"><div class="goal-header"><div class="goal-title">${g.name} ${linkTag}</div><div class="goal-amt" style="font-size:14px;">${formatMoney(savedAmt)} / ${formatMoney(g.target)}</div></div><div class="goal-track"><div class="goal-fill" style="width:${perc}%;"></div></div><div class="goal-footer" style="font-size:12px; color:var(--md-on-surface-variant);"><span>${perc.toFixed(1)}% Achieved</span>${forecastHtml}</div></div>`; }).join(''); }

    let sInv = db.investments.filter(i => activeAccountFilter === 'All' || i.account === activeAccountFilter).sort((a, b) => parseDate(b.date) - parseDate(a.date)).slice(0, 5);
    document.getElementById('dashboard-history-list').innerHTML = sInv.length === 0 ? `<div class="empty-state-premium"><span class="material-symbols-rounded">history</span><div class="es-title">No Recent Activity</div></div>` : sInv.map(buildUnifiedItemHTML).join('');

    renderHistory();

    let monthTarget = db.userProfile.monthlyExpense || 0; let pct = monthTarget > 0 ? Math.min(100, (thisMonthTotal / monthTarget) * 100) : 0;
    let mTargetDisplay = document.getElementById('monthly-target-display'); if (mTargetDisplay) mTargetDisplay.innerText = formatMoney(monthTarget);
    let pPercent = document.getElementById('progress-percent'); if (pPercent) pPercent.innerText = Math.round(pct) + '%';
    let pCircle = document.getElementById('progress-circle'); if (pCircle) pCircle.style.strokeDashoffset = 188.4 * (1 - pct / 100);

    renderQuickAddChips(); updateRebalanceBadge(); autoBackupReminder();
}
window.renderAll = renderAll;

// ==========================================
// 10. EVENT LISTENERS
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    const isUnlocked = await checkAppLock();
    initUI();
    processRecurring();
    renderAll();

    // Handle Nearby Sync Handshake
    if (window.location.hash) handleNearbyHash();

    // Listen for back button
    window.addEventListener('popstate', handlePopState);

    // Restore previous sheet if unlocked, without pushing new history
    if (isUnlocked) {
        const lastSheet = sessionStorage.getItem('currentSheet');
        if (lastSheet) openSheet(lastSheet, true);
    }
});

window.addEventListener('hashchange', handleNearbyHash);

async function handleNearbyHash() {
    const hash = window.location.hash;
    if (!hash.startsWith('#sync:')) return;

    haptic(50);
    const nearbyUI = document.getElementById('nearby-sync-active');
    const modeSelector = document.getElementById('nearby-mode-selector');
    const statusText = document.getElementById('nearby-status-text');
    const statusBadge = document.getElementById('nearby-status-badge');

    // Switch UI to active sync mode
    if (nearbyUI) nearbyUI.style.display = 'flex';
    if (modeSelector) modeSelector.style.display = 'none';
    if (statusText) statusText.innerText = "Processing Handshake...";
    if (statusBadge) statusBadge.innerText = "Syncing";

    try {
        const payloadStr = hash.replace('#sync:', '');
        const payload = JSON.parse(decodeURIComponent(payloadStr));

        if (payload.type === 'offer') {
            console.log("Nearby: Received Offer, generating answer...");
            const pc = webrtcInit(true); // true means nearby mode
            await pc.setRemoteDescription(payload.sdp);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await waitForWebRTCIceComplete(pc);

            const confirmUrl = `${window.location.origin}${window.location.pathname}#sync:${encodeURIComponent(JSON.stringify({
                type: 'answer',
                sdp: pc.localDescription
            }))}`;

            if (statusText) statusText.innerText = "Handshake Ready. Confirming back...";

            // Share the answer back
            if (navigator.share) {
                await navigator.share({
                    title: 'Confirm Wealth Sync',
                    text: 'Tap to complete connection',
                    url: confirmUrl
                });
            } else {
                showSnackbar("Handshake ready. Please share the confirmation link.", "info");
            }
        } else if (payload.type === 'answer') {
            console.log("Nearby: Received Answer, finalizing...");
            if (!window.pc) {
                showSnackbar("Connection lost. Restart Sync.", "error");
                return;
            }
            await window.pc.setRemoteDescription(payload.sdp);
            if (statusText) statusText.innerText = "Connection Established. Preparing data...";
        }

        // Clean up URL
        window.history.replaceState(null, null, ' ');
    } catch (e) {
        console.error("Nearby Handshake Error:", e);
        if (statusText) statusText.innerText = "Sync Failed. Try again.";
        if (statusBadge) statusBadge.innerText = "Error";
    }
}

async function nearbyBroadcast() {
    haptic(40);
    const statusText = document.getElementById('nearby-status-text');
    const statusBadge = document.getElementById('nearby-status-badge');
    const nearbyUI = document.getElementById('nearby-sync-active');
    const modeSelector = document.getElementById('nearby-mode-selector');

    if (nearbyUI) nearbyUI.style.display = 'flex';
    if (modeSelector) modeSelector.style.display = 'none';

    try {
        if (statusText) statusText.innerText = "Initializing Secure Pipe...";
        if (statusBadge) statusBadge.innerText = "Broadcasting";

        const pc = webrtcInit(true);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await waitForWebRTCIceComplete(pc);

        const syncUrl = `${window.location.origin}${window.location.pathname}#sync:${encodeURIComponent(JSON.stringify({
            type: 'offer',
            sdp: pc.localDescription
        }))}`;

        if (navigator.share) {
            await navigator.share({
                title: 'Broadcast Wealth Data',
                text: 'Sync your portfolio securely over P2P',
                url: syncUrl
            });
            if (statusText) statusText.innerText = "Waiting for Receiver to tune in...";
        } else {
            // Show QR fallback
            const qrFallback = document.getElementById('nearby-qr-fallback');
            if (qrFallback) qrFallback.style.display = 'flex';
            document.getElementById('webrtc-qr-display').style.display = 'block';
            document.getElementById('webrtc-code-output').value = JSON.stringify(pc.localDescription);
            webrtcShowQR();
            if (statusText) statusText.innerText = "Share not supported. Scan this QR.";
        }
    } catch (e) {
        console.error("Broadcast error:", e);
        showSnackbar("Broadcast failed.", "error");
    }
}

function nearbyTuneIn() {
    haptic(40);
    const statusText = document.getElementById('nearby-status-text');
    const statusBadge = document.getElementById('nearby-status-badge');
    const nearbyUI = document.getElementById('nearby-sync-active');
    const modeSelector = document.getElementById('nearby-mode-selector');
    const qrFallback = document.getElementById('nearby-qr-fallback');

    if (nearbyUI) nearbyUI.style.display = 'flex';
    if (modeSelector) modeSelector.style.display = 'none';

    if (statusText) statusText.innerText = "Waiting for broadcast link or QR scan...";
    if (statusBadge) statusBadge.innerText = "Listening";
    if (qrFallback) {
        qrFallback.style.display = 'flex';
        // Hide the QR display since we are listening, but show the "Open Scanner" button
        document.getElementById('webrtc-qr-display').style.display = 'none';
    }

    showSnackbar("Please open the shared link OR tap 'Open Scanner' to scan a QR.", "info");
}

function closeNearbySync() {
    document.getElementById('nearby-sync-active').style.display = 'none';
    document.getElementById('nearby-mode-selector').style.display = 'flex';
    if (window.pc) {
        window.pc.close();
        window.pc = null;
    }
}

function nearbyStartScanner() {
    document.getElementById('nearby-qr-fallback').style.display = 'none';
    document.getElementById('webrtc-scanner-ui').style.display = 'flex';
    webrtcStartScanner();
}

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

function calculatePortfolioHealth() {
    let score = 100;
    let issues = [];
    let suggestions = [];

    let categoriesCount = Object.keys(currentTypeTotals).filter(k => currentTypeTotals[k] > 0).length;
    if (categoriesCount < 3) {
        score -= 20;
        issues.push("Low diversification");
        suggestions.push("Invest in at least 3 categories (e.g. SIP, FD, Cash)");
    }

    let cash = (currentTypeTotals['Cash'] || 0) + (currentTypeTotals['Liquid'] || 0);
    let annualSal = db.userProfile.salary || 0;
    let monthlyExp = db.userProfile.monthlyExpense || (annualSal > 0 ? (annualSal / 12 * 0.6) : 30000);

    if (cash < monthlyExp * 3) {
        score -= 15;
        issues.push("Low liquidity buffer");
        suggestions.push(`Save ₹${formatInr(Math.ceil((monthlyExp * 6) - cash))} more to reach 6-month Safety Net (₹${formatInr(monthlyExp * 6)})`);
    } else if (cash >= monthlyExp * 6) {
        suggestions.push("✅ Emergency Fund Secured (6+ months)");
    }

    let onTrackGoals = db.goals.filter(g => {
        let saved = g.saved || 0;
        if (g.link && currentTypeTotals[g.link]) saved += currentTypeTotals[g.link];
        return saved >= (g.target * 0.1);
    }).length;
    if (db.goals.length > 0 && onTrackGoals === 0) {
        score -= 10;
        issues.push("Goals underfunded");
        suggestions.push("Direct more SIPs towards your primary Financial Goals");
    }

    // Allocation check
    let equity = (currentTypeTotals['SIP'] || 0) + (currentTypeTotals['Stocks'] || 0);
    let safe = (currentTypeTotals['FD'] || 0) + (currentTypeTotals['PPF'] || 0) + (currentTypeTotals['PF'] || 0) + cash;
    if (equity > safe * 2) {
        issues.push("Aggressive equity exposure");
        suggestions.push("Rebalance: Move some gains to FD or Debt funds");
    } else if (safe > equity * 3 && annualSal > 0) {
        issues.push("Conservative growth");
        suggestions.push("Increase SIPs to beat inflation over the long term");
    }

    // Category Target Multipliers
    Object.keys(db.categories).forEach(cat => {
        let meta = db.categories[cat];
        if (meta.targetMultiplier > 0 && db.userProfile.monthlyExpense > 0) {
            let target = db.userProfile.monthlyExpense * meta.targetMultiplier;
            let current = currentTypeTotals[cat] || 0;
            if (current < target) {
                suggestions.push(`${cat} Target: Reach ₹${formatInr(target)} (Currently ₹${formatInr(current)})`);
            }
        }
    });

    return {
        score: Math.max(0, score),
        status: score > 80 ? "Excellent" : score > 60 ? "Good" : "Needs Attention",
        issues: issues,
        suggestions: suggestions
    };
}

function updateAdvisorWidget() {
    const health = calculatePortfolioHealth();
    const advisorText = document.getElementById('advisor-text');
    const advisorCard = document.getElementById('advisor-card');
    if (!advisorText || !advisorCard) return;

    if (health.suggestions.length > 0) {
        advisorCard.style.display = 'block';
        let html = `<div style="font-weight:600; margin-bottom:8px; color:var(--md-primary); display:flex; align-items:center; gap:8px;">
            <span class="material-symbols-rounded" style="font-size:18px;">tips_and_updates</span> Smart Recommendations
        </div>`;
        html += `<div style="display:flex; flex-direction:column; gap:8px;">`;
        health.suggestions.slice(0, 2).forEach(s => {
            html += `<div style="font-size:13px; display:flex; gap:8px; line-height:1.4;">
                <span class="material-symbols-rounded" style="font-size:16px; color:var(--md-primary);">check_circle</span>
                <span>${s}</span>
            </div>`;
        });
        html += `</div>`;
        advisorText.innerHTML = html;
    } else {
        advisorCard.style.display = 'none';
    }
}



const WEBRTC_QR_FRAME_LIMIT = 320;
const WEBRTC_QR_PREFIX = 'TIQR2';
const WEBRTC_QR_SIZE = 300;
let qrScanner = null;
let webrtcQRFrameTimer = null;
let webrtcScanChunks = {};

function hashWebRTCQRPayload(payload) {
    let hash = 2166136261;
    for (let i = 0; i < payload.length; i++) {
        hash ^= payload.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function createWebRTCQRFrames(code, frameLimit = WEBRTC_QR_FRAME_LIMIT) {
    const payload = String(code || '');
    if (payload.length <= frameLimit) return [payload];

    const id = hashWebRTCQRPayload(payload);
    let total = 1;
    let chunkSize = frameLimit;

    for (let i = 0; i < 6; i++) {
        const headerLength = `${WEBRTC_QR_PREFIX}|${id}|${total}|${total}|`.length;
        const nextChunkSize = Math.max(1, frameLimit - headerLength);
        const nextTotal = Math.ceil(payload.length / nextChunkSize);
        if (nextChunkSize === chunkSize && nextTotal === total) break;
        chunkSize = nextChunkSize;
        total = nextTotal;
    }

    const frames = [];
    for (let i = 0; i < total; i++) {
        const chunk = payload.slice(i * chunkSize, (i + 1) * chunkSize);
        frames.push(`${WEBRTC_QR_PREFIX}|${id}|${i + 1}|${total}|${chunk}`);
    }
    return frames;
}

function parseWebRTCQRFrame(input) {
    const match = String(input || '').match(/^TIQR2\|([a-z0-9]+)\|(\d+)\|(\d+)\|([\s\S]*)$/);
    if (!match) return null;

    const index = Number(match[2]);
    const total = Number(match[3]);
    if (!Number.isInteger(index) || !Number.isInteger(total) || total < 2 || index < 1 || index > total) {
        return null;
    }

    return { id: match[1], index, total, payload: match[4] };
}

function decodeWebRTCQRInput(input, store = webrtcScanChunks) {
    const frame = parseWebRTCQRFrame(input);
    if (!frame) return { complete: true, code: input, received: 1, total: 1 };

    if (!store[frame.id] || store[frame.id].total !== frame.total) {
        store[frame.id] = { total: frame.total, parts: new Array(frame.total) };
    }

    store[frame.id].parts[frame.index - 1] = frame.payload;
    const received = store[frame.id].parts.filter(Boolean).length;

    if (received !== frame.total) {
        return { complete: false, received, total: frame.total };
    }

    const code = store[frame.id].parts.join('');
    delete store[frame.id];
    return { complete: true, code, received, total: frame.total };
}

function stopWebRTCQRRotation() {
    if (webrtcQRFrameTimer) {
        clearInterval(webrtcQRFrameTimer);
        webrtcQRFrameTimer = null;
    }
}

function parseWebRTCDescriptionCode(code) {
    try {
        return JSON.parse(code);
    } catch (jsonError) {
        try {
            return JSON.parse(atob(code));
        } catch (base64Error) {
            throw jsonError;
        }
    }
}

function waitForWebRTCIceComplete(pc) {
    return new Promise(resolve => {
        if (pc.iceGatheringState === 'complete') {
            resolve();
            return;
        }
        pc.addEventListener('icegatheringstatechange', () => {
            if (pc.iceGatheringState === 'complete') resolve();
        });
        pc.onicecandidate = event => {
            if (!event.candidate) resolve();
        };
    });
}

function webrtcStartAsReceiver() {
    haptic(40);
    stopWebRTCQRRotation();
    webrtcScanChunks = {};
    document.getElementById('webrtc-mode-selector').style.display = 'none';
    document.getElementById('webrtc-active-ui').style.display = 'flex';
    document.getElementById('webrtc-status').innerText = "Status: Creating Offer...";

    webrtcGenerateOffer().then(() => {
        document.getElementById('webrtc-status').innerText = "Status: Waiting for Sender...";
        document.getElementById('webrtc-qr-display').style.display = 'block';
        webrtcShowQR();

        // Receiver also needs to be ready to scan the answer
        setTimeout(() => {
            document.getElementById('webrtc-manual-area').style.display = 'flex';
            showSnackbar("Show this QR to the Sender device", "info");
        }, 1000);
    });
}

function webrtcStartAsSender() {
    haptic(40);
    document.getElementById('webrtc-mode-selector').style.display = 'none';
    document.getElementById('webrtc-active-ui').style.display = 'flex';
    document.getElementById('webrtc-status').innerText = "Status: Scanning Receiver's QR...";
    document.getElementById('webrtc-scanner-ui').style.display = 'flex';

    webrtcStartScanner();
}

async function webrtcGenerateOffer() {
    const pc = webrtcInit();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForWebRTCIceComplete(pc);
    document.getElementById('webrtc-code-output').value = JSON.stringify(pc.localDescription);
}

function webrtcShowQR() {
    const code = document.getElementById('webrtc-code-output').value;
    if (!code) return;
    stopWebRTCQRRotation();

    const frames = createWebRTCQRFrames(code);
    const qrDiv = document.getElementById('webrtc-qr');
    const indicator = document.getElementById('webrtc-qr-page-indicator');
    let frameIndex = 0;

    const renderFrame = () => {
        qrDiv.innerHTML = "";
        new QRCode(qrDiv, {
            text: frames[frameIndex],
            width: WEBRTC_QR_SIZE,
            height: WEBRTC_QR_SIZE,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.L
        });

        if (indicator) {
            indicator.innerText = frames.length > 1
                ? `QR ${frameIndex + 1}/${frames.length} - keep scanning until complete`
                : 'Single QR code';
        }
        frameIndex = (frameIndex + 1) % frames.length;
    };

    renderFrame();
    if (frames.length > 1) {
        webrtcQRFrameTimer = setInterval(renderFrame, 2200); // Slower rotation for better focus
        document.getElementById('webrtc-status').innerText = `Status: Scan ${frames.length} parts (Rotating...)`;
    }
}

function webrtcStartScanner() {
    if (qrScanner) qrScanner.clear();
    webrtcScanChunks = {};
    qrScanner = new Html5Qrcode("webrtc-reader");
    qrScanner.start(
        { facingMode: "environment" },
        { fps: 15, qrbox: { width: 280, height: 280 } },
        (decodedText) => {
            const decoded = decodeWebRTCQRInput(decodedText, webrtcScanChunks);
            if (!decoded.complete) {
                document.getElementById('webrtc-status').innerText = `Status: Part ${decoded.received}/${decoded.total} captured...`;
                document.getElementById('webrtc-status').style.background = "var(--md-primary-container)";
                haptic(25);
                return;
            }

            haptic(50);
            document.getElementById('webrtc-code-input').value = decoded.code;
            webrtcStopScanner();
            webrtcProcessInput();
        }
    ).catch(err => {
        showSnackbar("Camera Error", "error");
        document.getElementById('webrtc-manual-area').style.display = 'flex';
    });
}

function webrtcStopScanner() {
    if (qrScanner) {
        qrScanner.stop().then(() => {
            qrScanner.clear();
            document.getElementById('webrtc-scanner-ui').style.display = 'none';
            document.getElementById('webrtc-manual-area').style.display = 'flex';
            qrScanner = null;
        });
    }
}

function webrtcInit(isNearby = false) {
    if (window.pc) window.pc.close();
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    window.pc = pc;

    pc.onconnectionstatechange = () => {
        const status = document.getElementById('webrtc-status');
        const nearbyStatus = document.getElementById('nearby-status-text');
        const nearbyBadge = document.getElementById('nearby-status-badge');
        const nearbyProgress = document.getElementById('nearby-sync-progress');

        const stateMsg = `Status: ${pc.connectionState}`;
        if (status) status.innerText = stateMsg;
        if (nearbyStatus) nearbyStatus.innerText = pc.connectionState === 'connected' ? "Connection Secure. Transferring..." : stateMsg;

        if (pc.connectionState === 'connected') {
            stopWebRTCQRRotation();
            if (status) {
                status.style.background = "var(--md-success-container)";
                status.style.color = "var(--md-on-success-container)";
            }
            if (nearbyBadge) {
                nearbyBadge.innerText = "Connected";
                nearbyBadge.style.background = "var(--md-success-container)";
            }
            if (nearbyProgress) {
                nearbyProgress.style.width = '30%';
                const progressWrap = document.getElementById('nearby-sync-progress-wrap');
                if (progressWrap) progressWrap.style.display = 'flex';
            }

            if (isNearby) {
                // Sender will have dc.readyState === 'open' soon
            } else {
                const syncBtn = document.getElementById('webrtc-sync-btn');
                if (syncBtn) syncBtn.style.display = 'block';
                const qrDisplay = document.getElementById('webrtc-qr-display');
                if (qrDisplay) qrDisplay.style.display = 'none';
                const manualArea = document.getElementById('webrtc-manual-area');
                if (manualArea) manualArea.style.display = 'none';
            }
        }
    };

    const dc = pc.createDataChannel("sync");
    window.dc = dc;
    setupDataChannel(dc, isNearby);

    pc.ondatachannel = (event) => {
        setupDataChannel(event.channel, isNearby);
    };

    return pc;
}

function setupDataChannel(channel, isNearby = false) {
    channel.onopen = () => {
        console.log("DC Open");
        if (isNearby) {
            webrtcSendSync();
        }
    };
    channel.onmessage = (e) => {
        const nearbyProgress = document.getElementById('nearby-sync-progress');
        const nearbyStatus = document.getElementById('nearby-status-text');
        if (nearbyProgress) nearbyProgress.style.width = '70%';

        try {
            const remoteDb = JSON.parse(e.data);
            if (remoteDb && remoteDb.investments) {
                if (nearbyProgress) nearbyProgress.style.width = '100%';
                if (nearbyStatus) nearbyStatus.innerText = "Data Payload Received!";

                Swal.fire({
                    title: 'Wealth Data Received!',
                    text: `Merge ${remoteDb.investments.length} entries from the other device?`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Merge Now',
                    confirmButtonColor: 'var(--md-primary)',
                    background: 'var(--md-surface)',
                    color: 'var(--md-on-surface)'
                }).then(res => {
                    if (res.isConfirmed) {
                        const existingIds = new Set(db.investments.map(i => i.id));
                        const newEntries = remoteDb.investments.filter(ri => !existingIds.has(ri.id));

                        db.investments = [...db.investments, ...newEntries];
                        saveData();
                        renderAll();
                        showSnackbar(`Success! Merged ${newEntries.length} new entries.`);
                        if (isNearby) setTimeout(closeNearbySync, 2000);
                    }
                });
            }
        } catch (err) {
            console.error("Sync parse error", err);
            if (nearbyStatus) nearbyStatus.innerText = "Transfer Error.";
        }
    };
}

async function webrtcProcessInput() {
    const inputEl = document.getElementById('webrtc-code-input');
    const status = document.getElementById('webrtc-status');
    if (!inputEl || !inputEl.value) return;

    try {
        status.innerText = "Status: Processing Code...";
        const decoded = decodeWebRTCQRInput(inputEl.value.trim(), webrtcScanChunks);

        if (!decoded.complete) {
            status.innerText = `Status: Part ${decoded.received}/${decoded.total} captured...`;
            return;
        }

        const sdp = parseWebRTCDescriptionCode(decoded.code);
        if (!sdp || !sdp.type) throw new Error("Invalid SDP format");

        if (sdp.type === 'offer') {
            const pc = webrtcInit();
            await pc.setRemoteDescription(sdp);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await waitForWebRTCIceComplete(pc);

            // Show the answer as QR for the Receiver to scan back
            status.innerText = "Status: Offer Processed. Show Answer to Receiver.";
            status.style.background = "var(--md-primary-container)";
            document.getElementById('webrtc-code-output').value = JSON.stringify(pc.localDescription);
            document.getElementById('webrtc-qr-display').style.display = 'block';
            webrtcShowQR();
        } else if (sdp.type === 'answer') {
            if (!window.pc) {
                showSnackbar("Error: Receiver state lost. Restart connection.", "error");
                return;
            }
            await window.pc.setRemoteDescription(sdp);
            status.innerText = "Status: Answer Accepted. Finalizing...";
        }
    } catch (e) {
        console.error("WebRTC Process Error:", e);
        status.innerText = "Status: Error - Code Processing Failed";
        status.style.background = "var(--md-error-container)";
        status.style.color = "var(--md-on-error-container)";
        showSnackbar("Process failed. Please try again.", "error");
    }
}

function webrtcSendSync() {
    if (window.dc && window.dc.readyState === 'open') {
        window.dc.send(JSON.stringify(db));
        showSnackbar("Data Sent Successfully!");
    } else {
        showSnackbar("Not connected. Ensure connection status is 'connected'.", "error");
    }
}
