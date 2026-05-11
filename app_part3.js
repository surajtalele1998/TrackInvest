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

    // 1. Ensure the element exists
    if (!element) {
        console.error("Target element 'ai-sheet' is missing.");
        showSnackbar("Report element not found", "error");
        return;
    }

    // 2. Temporarily make element visible for capture if hidden
    const wasHidden = element.style.display === 'none';
    const originalStyles = {
        display: element.style.display,
        position: element.style.position,
        visibility: element.style.visibility,
        zIndex: element.style.zIndex
    };
    
    if (wasHidden) {
        element.style.display = 'block';
        element.style.position = 'fixed';
        element.style.visibility = 'hidden';
        element.style.zIndex = '-9999';
        element.style.left = '0';
        element.style.top = '0';
        // Force layout calculation
        element.offsetHeight;
    }

    // 3. Wait for charts to render
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check dimensions
    if (element.clientHeight === 0 || element.clientWidth === 0) {
        console.error("Target element has 0 dimensions.", {
            height: element.clientHeight,
            width: element.clientWidth,
            scrollHeight: element.scrollHeight
        });
        // Restore styles
        Object.assign(element.style, originalStyles);
        showSnackbar("Report content not ready", "error");
        return;
    }

    const opt = {
        margin: [0.3, 0.3, 0.3, 0.3],
        filename: `Wealth_Report_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.95, compression: 'FAST' },
        html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            letterRendering: true,
            logging: false,
            windowWidth: 800,
            windowHeight: element.scrollHeight + 100
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true }
    };

    try {
        showSnackbar("Generating PDF...", "hourglass_empty");
        
        // Make visible for capture
        element.style.visibility = 'visible';
        
        // Generate PDF
        const pdf = await html2pdf().set(opt).from(element).toPdf().get('pdf');
        
        // Add metadata
        pdf.setProperties({
            title: 'Wealth Strategic Report',
            subject: 'Portfolio Analysis',
            author: 'TrackInvest',
            keywords: 'finance, investment, portfolio',
            creator: 'TrackInvest AI'
        });
        
        pdf.save(opt.filename);
        
        // Restore original styles
        Object.assign(element.style, originalStyles);
        
        showSnackbar("PDF Downloaded!", "check_circle");
    } catch (error) {
        console.error("PDF Generation failed:", error);
        // Restore styles on error
        Object.assign(element.style, originalStyles);
        showSnackbar("Export failed. Try again.", "error");
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
    let today = new Date(); let updated = false; let processedCount = 0;
    db.recurring.forEach(rec => {
        let nextDate = parseDate(rec.nextRun); let maxSafety = 24;
        let missedMonths = 0;
        while (nextDate <= today && maxSafety > 0) {
            db.investments.push({
                id: generateUniqueId(), date: getLocalYYYYMMDD(nextDate), type: rec.type, amount: rec.amount, note: rec.note + ' (Auto)', tags: rec.tags || '', isDividend: false, account: rec.account || db.accounts[0]
            });
            nextDate.setMonth(nextDate.getMonth() + 1); rec.nextRun = getLocalYYYYMMDD(nextDate); updated = true; maxSafety--; processedCount++; missedMonths++;
        }
        // Warn user if multiple months were processed at once
        if (missedMonths > 1) {
            console.warn(`Recurring ${rec.note}: processed ${missedMonths} missed months`);
        }
    });
    if (updated) { 
        saveData(); 
        showSnackbar(`Auto‑SIPs Processed: ${processedCount} entries`, 'check_circle'); 
    }
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

    // Update Dashboard Tax Liability - pass computed 80c value explicitly
    let taxObj = calculateStrictTax(tax80cTotal);
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

    let tplHtml = ""; db.templates.forEach((tpl, idx) => { 
        let meta = db.categories[tpl.type] || { icon: 'bolt' }; 
        let safeNote = escapeHtml(tpl.note);
        let safeIcon = escapeHtml(meta.icon);
        tplHtml += `<div class="quick-template-card" onclick="executeQuickLog(${idx})">
            <span class="material-symbols-rounded qt-icon">${safeIcon}</span>
            <div class="qt-text">${safeNote} ${formatMoney(tpl.amount)}</div>
            <span class="material-symbols-rounded" style="font-size:16px;opacity:0.5;margin-left:4px;" onclick="deleteQuickLog(event,${idx})">close</span>
        </div>`; 
    });
    let qtWrapper = document.getElementById('quick-templates-list'); if (qtWrapper) { qtWrapper.innerHTML = tplHtml; qtWrapper.style.display = tplHtml ? 'flex' : 'none'; }

    let fireFill = document.getElementById('fire-fill');
    if (fireFill && db.fireTargetMonthly > 0) {
        let t = db.fireTargetMonthly * 300;
        fireFill.style.width = Math.min(100, (currentTotalNW / t) * 100) + '%';
        document.getElementById('fire-saved').innerText = formatMoney(currentTotalNW);
        document.getElementById('fire-target').innerText = `Target: ${formatMoney(t)}`;
        let remaining = t - currentTotalNW;
        let fireEtaEl = document.getElementById('fire-eta');
        if (remaining <= 0) {
            // Target already achieved
            fireEtaEl.innerText = `🔥 FIRE ACHIEVED!`;
        } else if (currentAvgMonthly <= 0) {
            // No monthly savings rate set
            fireEtaEl.innerText = `Set monthly target to see ETA`;
        } else {
            // Calculate ETA based on current savings rate
            let monthsLeft = Math.ceil(remaining / currentAvgMonthly);
            if (monthsLeft > 600) {
                // More than 50 years - probably unrealistic
                fireEtaEl.innerText = `ETA: 50+ years`;
            } else {
                let fireDate = new Date();
                fireDate.setMonth(fireDate.getMonth() + monthsLeft);
                fireEtaEl.innerText = `FIRE Year: ${fireDate.getFullYear()}`;
            }
        }
    }

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
            if (value > 0 && totalMarketValue > 0) {
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

        // Check for over-allocated categories (>50% or >20% above target)
        let overAllocated = {};
        Object.keys(typeTotals).forEach(t => {
            if (db.allocTargets[t] && totalMarketValue > 0) {
                let currentPerc = (typeTotals[t] / totalMarketValue) * 100;
                let targetPerc = db.allocTargets[t];
                if (currentPerc > targetPerc * 1.2 || currentPerc > 50) {
                    let excess = typeTotals[t] - (targetPerc / 100 * totalMarketValue);
                    if (excess > 0) overAllocated[t] = excess;
                }
            }
        });

        // Build rebalancing suggestions
        if ((totalShortfall > 0 || Object.keys(overAllocated).length > 0) && db.projectionNextMonth > 0) {
            let remainingToInvest = db.projectionNextMonth;
            let allocatedSoFar = 0;

            // Show over-allocation warnings first
            if (Object.keys(overAllocated).length > 0) {
                rebalanceHtml += `<div style="font-size:11px; color:var(--md-error); margin-bottom:8px; font-weight:500;">⚠️ Consider reducing:</div>`;
                Object.keys(overAllocated).forEach(t => {
                    let excess = overAllocated[t];
                    let curPerc = ((typeTotals[t] / totalMarketValue) * 100).toFixed(0);
                    let targetPerc = db.allocTargets[t];
                    
                    // Estimate tax implication (simplified)
                    let invs = db.investments.filter(i => i.type === t && !i.isDividend && (activeAccountFilter === 'All' || i.account === activeAccountFilter));
                    let stcg = 0, ltcg = 0;
                    let now = new Date();
                    invs.forEach(i => {
                        let days = (now - new Date(i.date)) / (1000 * 60 * 60 * 24);
                        if (days <= 365) stcg += i.amount;
                        else ltcg += i.amount;
                    });
                    let taxHint = stcg > 0 ? `<span style="color:var(--md-error); font-size:9px;">(${formatMoney(stcg)} STCG taxable)</span>` : 
                                  ltcg > 0 ? `<span style="color:var(--md-success); font-size:9px;">(LTCG - check exemption)</span>` : '';
                    
                    rebalanceHtml += `<div class="reb-item" style="display:flex; flex-direction:column; margin-bottom:10px; padding:8px; background:var(--md-error-container); border-radius:8px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span><span class="alloc-dot" style="background:${db.categories[t]?.color || '#ccc'}; display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px;"></span>${t}</span>
                            <span style="color:var(--md-error); font-weight:600;">-${formatMoney(Math.min(excess, db.projectionNextMonth * 0.5))}</span>
                        </div>
                        <div style="font-size:10px; color:var(--md-on-error-container); margin-left:14px;">${curPerc}% allocated (Target: ${targetPerc}%) ${taxHint}</div>
                    </div>`;
                });
                rebalanceHtml += `<div style="margin:12px 0; border-top:1px solid var(--md-outline-variant);"></div>`;
            }

            if (totalShortfall > 0) {
                rebalanceHtml += `<div style="font-size:11px; color:var(--md-on-surface-variant); margin-bottom:8px;">Invest ₹${db.projectionNextMonth} in under-allocated categories:</div>`;

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
                    rebalanceHtml += `<div style="font-size:11px; color:var(--md-primary); margin:8px 0 4px 0; border-top:1px dashed var(--md-outline-variant); padding-top:8px;">Distribute remaining ₹${formatMoney(remainingToInvest)}:</div>`;
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
            }
        } else if (Object.keys(overAllocated).length > 0 && db.projectionNextMonth === 0) {
            // Only showing reduction suggestions, no new investment
            rebalanceHtml += `<div style="font-size:11px; color:var(--md-error); margin-bottom:8px; font-weight:500;">⚠️ Portfolio Over-Concentrated:</div>`;
            Object.keys(overAllocated).forEach(t => {
                let curPerc = ((typeTotals[t] / totalMarketValue) * 100).toFixed(0);
                let targetPerc = db.allocTargets[t];
                rebalanceHtml += `<div class="reb-item" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:8px; background:var(--md-error-container); border-radius:8px;">
                    <span><span class="alloc-dot" style="background:${db.categories[t]?.color || '#ccc'}; display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px;"></span>${t}</span>
                    <span style="color:var(--md-error);">${curPerc}% (Target: ${targetPerc}%)</span>
                </div>`;
            });
            rebalanceHtml += `<div style="font-size:11px; color:var(--md-outline); text-align:center; margin-top:12px;">Consider rebalancing by pausing new investments in over-allocated categories.</div>`;
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
    if (goalsList) {
        goalsList.innerHTML = db.goals.length === 0 ? `<div class="empty-state-premium"><span class="material-symbols-rounded">flag</span><div class="es-title">No Goals Set</div></div>` : db.goals.map(g => {
            let savedAmt = g.saved, isLinked = false; let monthlyContrib = 0;
            if (g.linkedCategory) {
                // Calculate invested principal (excluding appreciation) for linked category
                let investedPrincipal = db.investments.filter(i => i.type === g.linkedCategory && !i.isDividend && (activeAccountFilter === 'All' || i.account === activeAccountFilter)).reduce((s, i) => s + i.amount, 0) + (db.categoryDetails[g.linkedCategory]?.initialBal || 0);
                savedAmt = investedPrincipal;
                isLinked = true;
                monthlyContrib = db.recurring.filter(r => r.type === g.linkedCategory).reduce((s, r) => s + r.amount, 0);
            }
            let perc = Math.min(100, (savedAmt / g.target) * 100);
            let linkTag = isLinked ? `<span class="goal-linked-tag" style="font-size:10px; background:var(--md-surface-container-highest); padding:2px 6px; border-radius:4px; margin-left:6px;">Linked: ${escapeHtml(g.linkedCategory)}</span>` : '';
            let forecastHtml = '';
            let shortfall = g.target - savedAmt;
            
            if (shortfall > 0) {
                if (monthlyContrib > 0) {
                    // Enhanced forecast with growth consideration
                    let growthRate = 0;
                    if (g.linkedCategory) {
                        // Estimate growth based on category type
                        const catGrowthRates = { 'SIP': 0.12, 'Stocks': 0.12, 'PPF': 0.071, 'PF': 0.0815, 'FD': 0.07, 'Cash': 0, 'Liquid': 0.06 };
                        growthRate = catGrowthRates[g.linkedCategory] || 0.08;
                    }
                    
                    // Calculate months needed considering growth
                    let monthsLeft;
                    if (growthRate > 0 && savedAmt > 0) {
                        // Compound growth formula: FV = PV*(1+r)^n + PMT*(((1+r)^n - 1)/r)
                        let r = growthRate / 12;
                        let n = Math.log((g.target * r + monthlyContrib) / (savedAmt * r + monthlyContrib)) / Math.log(1 + r);
                        monthsLeft = Math.ceil(n);
                    } else {
                        monthsLeft = Math.ceil(shortfall / monthlyContrib);
                    }
                    
                    if (monthsLeft <= 600 && monthsLeft > 0) {
                        let fDate = new Date();
                        fDate.setMonth(fDate.getMonth() + monthsLeft);
                        let fDateStr = `${fDate.toLocaleString('default', { month: 'short' })} ${fDate.getFullYear()}`;
                        
                        // Confidence range (±20% variation in returns)
                        let pessimisticMonths = growthRate > 0 ? Math.ceil(monthsLeft * 1.3) : monthsLeft;
                        let optimisticMonths = growthRate > 0 ? Math.ceil(monthsLeft * 0.8) : monthsLeft;
                        let pDate = new Date(); pDate.setMonth(pDate.getMonth() + pessimisticMonths);
                        let oDate = new Date(); oDate.setMonth(oDate.getMonth() + optimisticMonths);
                        
                        forecastHtml = `<div style="font-size:11px;color:var(--md-primary);margin-top:8px;font-weight:500;">🎯 ${fDateStr}`;
                        if (growthRate > 0) {
                            forecastHtml += ` <span style="opacity:0.7;">(${oDate.toLocaleString('default', { month: 'short' })}-${pDate.toLocaleString('default', { month: 'short' })})</span>`;
                        }
                        forecastHtml += `</div>`;
                    } else if (monthsLeft > 600) {
                        forecastHtml = `<div style="font-size:11px;color:var(--md-outline);margin-top:8px;">⏳ 50+ years to reach</div>`;
                    }
                } else if (savedAmt > 0 && g.linkedCategory) {
                    // No monthly contribution but has existing value with growth
                    let growthRate = 0.08; // Default 8%
                    const catGrowthRates = { 'SIP': 0.12, 'Stocks': 0.12, 'PPF': 0.071, 'PF': 0.0815, 'FD': 0.07 };
                    growthRate = catGrowthRates[g.linkedCategory] || 0.08;
                    
                    let yearsToTarget = Math.log(g.target / savedAmt) / Math.log(1 + growthRate);
                    if (yearsToTarget > 0 && yearsToTarget <= 50) {
                        let fDate = new Date();
                        fDate.setFullYear(fDate.getFullYear() + Math.ceil(yearsToTarget));
                        forecastHtml = `<div style="font-size:11px;color:var(--md-primary);margin-top:8px;font-weight:500;">📈 Growth only: ${fDate.getFullYear()} @ ${(growthRate * 100).toFixed(1)}%</div>`;
                    }
                } else {
                    forecastHtml = `<div style="font-size:11px;color:var(--md-outline);margin-top:8px;">⚠️ Add SIP to reach goal</div>`;
                }
            } else {
                forecastHtml = `<div style="font-size:11px;color:var(--md-success);margin-top:8px;font-weight:500;">✅ Goal Achieved!</div>`;
            }
            return `<div class="goal-card" onclick="openGoalSheet(${g.id})"><div class="goal-header"><div class="goal-title">${escapeHtml(g.name)} ${linkTag}</div><div class="goal-amt" style="font-size:14px;">${formatMoney(savedAmt)} / ${formatMoney(g.target)}</div></div><div class="goal-track"><div class="goal-fill" style="width:${perc}%;"></div></div><div class="goal-footer" style="font-size:12px; color:var(--md-on-surface-variant);"><span>${perc.toFixed(1)}% Achieved</span>${forecastHtml}</div></div>`;
        }).join('');
    }

    // Recent activity with context-aware empty state
    let sInv = db.investments.filter(i => activeAccountFilter === 'All' || i.account === activeAccountFilter).sort((a, b) => parseDate(b.date) - parseDate(a.date)).slice(0, 5);
    let dashboardList = document.getElementById('dashboard-history-list');
    if (dashboardList) {
        if (sInv.length === 0) {
            dashboardList.innerHTML = getEmptyStateHTML('dashboard');
        } else {
            dashboardList.innerHTML = sInv.map(buildUnifiedItemHTML).join('');
            attachSwipeListeners(dashboardList);
        }
    }

    // Add Frequent Actions section for quick navigation
    renderFrequentActions();

    renderHistory();

    let monthTarget = db.userProfile.monthlyExpense || 0; let pct = monthTarget > 0 ? Math.min(100, (thisMonthTotal / monthTarget) * 100) : 0;
    let mTargetDisplay = document.getElementById('monthly-target-display'); if (mTargetDisplay) mTargetDisplay.innerText = formatMoney(monthTarget);
    let pPercent = document.getElementById('progress-percent'); if (pPercent) pPercent.innerText = Math.round(pct) + '%';
    let pCircle = document.getElementById('progress-circle'); if (pCircle) pCircle.style.strokeDashoffset = 188.4 * (1 - pct / 100);

    renderQuickAddChips(); updateRebalanceBadge(); autoBackupReminder();
}
window.renderAll = renderAll;
window.getEmptyStateHTML = getEmptyStateHTML;

// Frequent Actions Quick Navigation
function renderFrequentActions() {
    let container = document.getElementById('frequent-actions');
    if (!container) return;
    
    // Determine most relevant actions based on user state
    let actions = [];
    let totalInvestments = db.investments.length;
    let hasGoals = db.goals.length > 0;
    let hasRecurring = db.recurring.length > 0;
    let categoriesUsed = Object.keys(currentTypeTotals).filter(k => currentTypeTotals[k] > 0);
    
    // Always show Add Investment
    actions.push({ icon: 'add_circle', label: 'Invest', action: 'openInvestSheet()', color: 'var(--md-primary)' });
    
    // Show Set Goal for new users or if no goals
    if (!hasGoals || totalInvestments < 5) {
        actions.push({ icon: 'flag', label: 'Set Goal', action: 'openGoalSheet()', color: 'var(--md-success)' });
    }
    
    // Show Add SIP if user has investments but no recurring
    if (totalInvestments > 0 && !hasRecurring) {
        actions.push({ icon: 'autorenew', label: 'Auto-SIP', action: 'openRecurringSheet()', color: 'var(--md-tertiary)' });
    }
    
    // Show most used category for quick add
    if (categoriesUsed.length > 0) {
        let topCategory = categoriesUsed.sort((a, b) => currentTypeTotals[b] - currentTypeTotals[a])[0];
        let catMeta = db.categories[topCategory] || { icon: 'savings', color: '#8D6E63' };
        actions.push({ 
            icon: catMeta.icon, 
            label: topCategory, 
            action: `openInvestSheet(null, 1000); setInvestType('${topCategory}')`, 
            color: catMeta.color 
        });
    }
    
    // Show Settings for configuration
    actions.push({ icon: 'settings', label: 'Settings', action: 'openSettings()', color: 'var(--md-outline)' });
    
    // Build HTML
    let html = `<div style="display:flex; gap:12px; overflow-x:auto; padding: 4px 0; scrollbar-width:none;">`;
    actions.forEach(a => {
        html += `<button onclick="${a.action}" style="flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:4px; padding: 12px 16px; background:var(--md-surface-container-low); border:none; border-radius:16px; cursor:pointer; min-width:72px; transition:transform 0.2s, background 0.2s;" onmouseover="this.style.transform='scale(1.05)';this.style.background='var(--md-surface-container)'" onmouseout="this.style.transform='scale(1)';this.style.background='var(--md-surface-container-low)'">
            <span class="material-symbols-rounded" style="font-size:24px; color:${a.color};">${a.icon}</span>
            <span style="font-size:11px; color:var(--md-on-surface-variant); font-weight:500;">${a.label}</span>
        </button>`;
    });
    html += `</div>`;
    
    container.innerHTML = html;
}

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
    
    // Show first-time tips for new users (after a short delay)
    setTimeout(() => {
        if (!db.firstTimeTipsShown && db.investments.length === 0) {
            showFirstTimeTips();
        }
    }, 1000);
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
    let quickWins = [];
    let trend = 'stable'; // improving, stable, declining

    // Calculate trend based on recent investment activity
    let now = new Date();
    let lastMonth = new Date(); lastMonth.setMonth(lastMonth.getMonth() - 1);
    let threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    let recentInvestments = db.investments.filter(i => 
        !i.isDividend && 
        (activeAccountFilter === 'All' || i.account === activeAccountFilter) &&
        new Date(i.date) >= lastMonth
    ).reduce((s, i) => s + i.amount, 0);
    
    let previousInvestments = db.investments.filter(i => 
        !i.isDividend && 
        (activeAccountFilter === 'All' || i.account === activeAccountFilter) &&
        new Date(i.date) >= threeMonthsAgo &&
        new Date(i.date) < lastMonth
    ).reduce((s, i) => s + i.amount, 0);
    
    if (recentInvestments > previousInvestments * 1.2) {
        trend = 'improving';
    } else if (recentInvestments < previousInvestments * 0.8) {
        trend = 'declining';
    }

    let categoriesCount = Object.keys(currentTypeTotals).filter(k => currentTypeTotals[k] > 0).length;
    if (categoriesCount < 3) {
        score -= 20;
        issues.push("Low diversification");
        let neededCats = 3 - categoriesCount;
        suggestions.push({
            text: `Add ${neededCats} more investment type${neededCats > 1 ? 's' : ''} (SIP, FD, or Cash)`,
            impact: 'high',
            priority: 1
        });
        quickWins.push({
            text: `Start a ₹1000 SIP in a new category`,
            action: `onclick="openInvestSheet(null, 1000); setInvestType('SIP');"`
        });
    } else {
        quickWins.push({
            text: `✅ Well diversified across ${categoriesCount} categories`,
            action: null
        });
    }

    let cash = (currentTypeTotals['Cash'] || 0) + (currentTypeTotals['Liquid'] || 0);
    let annualSal = db.userProfile.salary || 0;
    let monthlyExp = db.userProfile.monthlyExpense || (annualSal > 0 ? (annualSal / 12 * 0.6) : 30000);
    let safetyGap = (monthlyExp * 6) - cash;

    if (cash < monthlyExp * 3) {
        score -= 15;
        issues.push("Low liquidity buffer");
        suggestions.push({
            text: `Build emergency fund: Save ₹${formatInr(Math.ceil(safetyGap))} to reach 6-month buffer (₹${formatInr(monthlyExp * 6)})`,
            impact: 'high',
            priority: 1
        });
        quickWins.push({
            text: `Move ₹${formatInr(Math.min(5000, Math.ceil(safetyGap / 3)))} to Liquid fund this month`,
            action: `onclick="openInvestSheet(null, ${Math.min(5000, Math.ceil(safetyGap / 3))}); setInvestType('Liquid');"`
        });
    } else if (cash >= monthlyExp * 6) {
        suggestions.push({
            text: `✅ Emergency Fund Secured (6+ months)`,
            impact: 'positive',
            priority: 0
        });
    }

    // Goals analysis with specific amounts
    let underfundedGoals = db.goals.filter(g => {
        let saved = g.saved || 0;
        if (g.linkedCategory && currentTypeTotals[g.linkedCategory]) saved += currentTypeTotals[g.linkedCategory];
        return saved < (g.target * 0.1);
    });
    
    if (db.goals.length > 0 && underfundedGoals.length > 0) {
        score -= 10;
        issues.push("Goals underfunded");
        let topGoal = underfundedGoals[0];
        let gap = topGoal.target * 0.1 - (topGoal.saved || 0);
        suggestions.push({
            text: `"${topGoal.name}" needs ₹${formatInr(Math.ceil(gap))} more to be on track`,
            impact: 'medium',
            priority: 2
        });
        if (topGoal.linkedCategory) {
            quickWins.push({
                text: `Add SIP to "${topGoal.name}" linked to ${topGoal.linkedCategory}`,
                action: `onclick="openInvestSheet(); setInvestType('${topGoal.linkedCategory}'); document.getElementById('inv-is-monthly').checked = true;"`
            });
        }
    }

    // Allocation check with specific rebalancing amounts
    let equity = (currentTypeTotals['SIP'] || 0) + (currentTypeTotals['Stocks'] || 0);
    let safe = (currentTypeTotals['FD'] || 0) + (currentTypeTotals['PPF'] || 0) + (currentTypeTotals['PF'] || 0) + cash;
    let total = equity + safe;
    
    if (equity > safe * 2 && total > 0) {
        issues.push("Aggressive equity exposure");
        let rebalanceAmt = Math.floor((equity - safe * 2) / 3);
        suggestions.push({
            text: `Rebalance: Move ₹${formatInr(rebalanceAmt)} from equity to FD/Debt for stability`,
            impact: 'high',
            priority: 1
        });
    } else if (safe > equity * 3 && annualSal > 0 && total > 50000) {
        issues.push("Conservative growth");
        let investMore = Math.floor(safe * 0.1);
        suggestions.push({
            text: `Increase equity exposure: Add ₹${formatInr(investMore)} to SIPs to beat inflation`,
            impact: 'medium',
            priority: 2
        });
        quickWins.push({
            text: `Start ₹${formatInr(Math.min(1000, investMore))} monthly SIP in index fund`,
            action: `onclick="openInvestSheet(null, ${Math.min(1000, investMore)}); setInvestType('SIP'); document.getElementById('inv-is-monthly').checked = true;"`
        });
    }

    // Category Target Multipliers with specific gaps
    Object.keys(db.categories).forEach(cat => {
        let meta = db.categories[cat];
        if (meta.targetMultiplier > 0 && db.userProfile.monthlyExpense > 0) {
            let target = db.userProfile.monthlyExpense * meta.targetMultiplier;
            let current = currentTypeTotals[cat] || 0;
            if (current < target) {
                let gap = target - current;
                suggestions.push({
                    text: `${cat}: ₹${formatInr(current)}/₹${formatInr(target)} (gap: ₹${formatInr(Math.ceil(gap))})`,
                    impact: gap > target * 0.5 ? 'high' : 'medium',
                    priority: gap > target * 0.5 ? 2 : 3
                });
            }
        }
    });

    // Sort suggestions by priority
    suggestions.sort((a, b) => a.priority - b.priority);

    return {
        score: Math.max(0, Math.min(100, score)),
        status: score > 80 ? "Excellent" : score > 60 ? "Good" : "Needs Attention",
        statusColor: score > 80 ? 'var(--md-success)' : score > 60 ? 'var(--md-primary)' : 'var(--md-error)',
        issues: issues,
        suggestions: suggestions,
        quickWins: quickWins,
        trend: trend,
        trendIcon: trend === 'improving' ? 'trending_up' : trend === 'declining' ? 'trending_down' : 'trending_flat'
    };
}

function updateAdvisorWidget() {
    const health = calculatePortfolioHealth();
    const advisorText = document.getElementById('advisor-text');
    const advisorCard = document.getElementById('advisor-card');
    if (!advisorText || !advisorCard) return;

    // Always show the advisor card now with the enhanced health display
    advisorCard.style.display = 'block';
    
    let html = `<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <div style="font-weight:600; color:var(--md-primary); display:flex; align-items:center; gap:8px;">
            <span class="material-symbols-rounded" style="font-size:18px;">health_and_safety</span>
            Portfolio Health
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
            <div style="display:flex; align-items:center; gap:4px; font-size:12px; color:var(--md-outline);">
                <span class="material-symbols-rounded" style="font-size:16px;">${health.trendIcon}</span>
                ${health.trend === 'improving' ? 'Improving' : health.trend === 'declining' ? 'Declining' : 'Stable'}
            </div>
            <div style="font-size:24px; font-weight:700; color:${health.statusColor};">${health.score}</div>
        </div>
    </div>`;
    
    // Status badge
    html += `<div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
        <span style="font-size:11px; padding:4px 12px; border-radius:12px; background:${health.statusColor}20; color:${health.statusColor}; font-weight:500;">${health.status}</span>`;
    
    if (health.issues.length > 0) {
        html += `<span style="font-size:11px; padding:4px 12px; border-radius:12px; background:var(--md-error-container); color:var(--md-error);">${health.issues.length} issue${health.issues.length > 1 ? 's' : ''}</span>`;
    }
    html += `</div>`;
    
    // Quick Wins section (actionable items)
    if (health.quickWins.length > 0) {
        html += `<div style="margin-bottom:16px;">
            <div style="font-size:12px; font-weight:600; color:var(--md-on-surface-variant); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">Quick Wins</div>
            <div style="display:flex; flex-direction:column; gap:6px;">`;
        health.quickWins.slice(0, 2).forEach(qw => {
            if (qw.action) {
                html += `<div ${qw.action} style="font-size:13px; padding:10px 12px; background:var(--md-primary-container); color:var(--md-on-primary-container); border-radius:10px; cursor:pointer; display:flex; align-items:center; gap:8px; transition:opacity 0.2s;">
                    <span class="material-symbols-rounded" style="font-size:16px;">flash_on</span>
                    ${escapeHtml(qw.text)}
                </div>`;
            } else {
                html += `<div style="font-size:13px; padding:10px 12px; background:var(--md-surface-container-highest); color:var(--md-on-surface-variant); border-radius:10px; display:flex; align-items:center; gap:8px;">
                    <span class="material-symbols-rounded" style="font-size:16px; color:var(--md-success);">check_circle</span>
                    ${escapeHtml(qw.text)}
                </div>`;
            }
        });
        html += `</div></div>`;
    }
    
    // Priority suggestions
    if (health.suggestions.length > 0) {
        html += `<div>
            <div style="font-size:12px; font-weight:600; color:var(--md-on-surface-variant); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">Recommendations</div>
            <div style="display:flex; flex-direction:column; gap:6px;">`;
        
        health.suggestions.filter(s => s.impact !== 'positive').slice(0, 3).forEach(s => {
            let icon = s.impact === 'high' ? 'priority_high' : s.impact === 'medium' ? 'flag' : 'info';
            let color = s.impact === 'high' ? 'var(--md-error)' : s.impact === 'medium' ? 'var(--md-warning)' : 'var(--md-primary)';
            html += `<div style="font-size:13px; display:flex; gap:8px; line-height:1.4; padding:8px; background:var(--md-surface-container-highest); border-radius:8px;">
                <span class="material-symbols-rounded" style="font-size:16px; color:${color}; flex-shrink:0;">${icon}</span>
                <span>${escapeHtml(s.text)}</span>
            </div>`;
        });
        html += `</div></div>`;
    }
    
    advisorText.innerHTML = html;
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
