/**
 * utils.js - Global Helpers & Formatting
 * Uses Numeral.js and Day.js for premium formatting.
 */

/**
 * Haptic feedback helper
 */
export function haptic(ms = 30) {
    try {
        if (typeof navigator !== 'undefined' && navigator.vibrate && ms > 0) {
            navigator.vibrate(ms);
        }
    } catch (e) {}
}

/**
 * Premium currency formatting (₹ 1,23,456.78)
 */
export function formatInr(num) {
    return numeral(num).format('0,0.[00]');
}

/**
 * Formatted money with privacy mask support
 */
export function formatMoney(num, privacyMode = false) {
    if (privacyMode) return '••••••';
    return '₹' + formatInr(num);
}

/**
 * Date formatting using Day.js
 */
export function formatDate(date, format = 'DD MMM YYYY') {
    return dayjs(date).format(format);
}

/**
 * UI SnackBar
 */
export function showSnackbar(msg, icon = "info") {
    const sb = document.getElementById("snackbar");
    if (!sb) return;
    sb.innerHTML = `<span class="material-symbols-rounded" style="font-size:20px;">${icon}</span> ${msg}`;
    sb.classList.add("show");
    setTimeout(() => sb.classList.remove("show"), 3000);
}

/**
 * Close all active overlays/sheets
 */
export function closeOverlays() {
    document.querySelectorAll('.scrim, .scrim-sub, .sheet').forEach(el => el.classList.remove('active'));
}

/**
 * Deep clone helper
 */
export function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Copy Net Worth to Clipboard
 */
export function copyNetWorth(total) {
    const text = `My Net Worth: ${formatMoney(total)} (TrackInvest)`;
    navigator.clipboard.writeText(text).then(() => showSnackbar('Copied to clipboard', 'content_copy'));
}

/**
 * Export Database to CSV
 */
export async function exportToCSV(db) {
    haptic(30);
    const investments = await db.investments.toArray();
    let rows = [['Date', 'Type', 'Amount', 'Note']];
    investments.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(inv => {
        rows.push([inv.date, inv.type, inv.amount, inv.note || '']);
    });
    let csv = rows.map(r => r.join(',')).join('\n');
    let blob = new Blob([csv], { type: 'text/csv' });
    let url = window.URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = `TrackInvest_Backup_${new Date().toISOString().split('T')[0]}.csv`;
}

/**
 * Export Database to JSON (with optional encryption)
 */
export async function exportData(db, getSetting) {
    haptic(30);
    const encrypt = document.getElementById('encrypt-backup-toggle')?.checked;
    const investments = await db.investments.toArray();
    const settings = await db.settings.toArray();
    const categories = await db.categories.toArray();
    const accounts = await db.accounts.toArray();
    const goals = await db.goals.toArray();
    
    const data = { investments, settings, categories, accounts, goals, timestamp: new Date().toISOString() };
    let finalData = JSON.stringify(data);
    let fileName = `TrackInvest_Backup_${new Date().toISOString().split('T')[0]}.json`;
    
    if (encrypt) {
        const pin = await getSetting('appPin');
        if (!pin) {
            alert("Please set an App PIN in settings before using encrypted backup.");
            return;
        }
        // Simplified encryption for this logic, usually we'd use SubtleCrypto
        finalData = btoa(unescape(encodeURIComponent(finalData))); // Dummy "encryption" for now
        fileName += ".enc";
    }

    const blob = new Blob([finalData], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    showSnackbar("Backup created successfully", "cloud_download");
}

/**
 * Restore Database from JSON
 */
export async function restoreData(event, db) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            let content = e.target.result;
            if (file.name.endsWith('.enc')) {
                // Dummy decryption
                content = decodeURIComponent(escape(atob(content)));
            }
            const data = JSON.parse(content);
            
            if (confirm("Restore will overwrite current data. Continue?")) {
                await db.investments.clear();
                await db.settings.clear();
                await db.categories.clear();
                await db.accounts.clear();
                await db.goals.clear();
                
                if (data.investments) await db.investments.bulkAdd(data.investments);
                if (data.settings) await db.settings.bulkAdd(data.settings);
                if (data.categories) await db.categories.bulkAdd(data.categories);
                if (data.accounts) await db.accounts.bulkAdd(data.accounts);
                if (data.goals) await db.goals.bulkAdd(data.goals);
                
                showSnackbar("Restore complete! Reloading...", "done_all");
                setTimeout(() => location.reload(), 1500);
            }
        } catch (err) {
            alert("Error restoring data: " + err.message);
        }
    };
    reader.readAsText(file);
}

/**
 * Import CSV Data
 */
export async function importCSV(event, db) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        const csv = e.target.result;
        const lines = csv.split('\n');
        const headers = lines[0].split(',');
        
        const newEntries = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const cols = lines[i].split(',');
            newEntries.push({
                date: cols[0],
                type: cols[1],
                amount: parseFloat(cols[2]),
                note: cols[3] || '',
                timestamp: Date.now()
            });
        }
        
        if (newEntries.length > 0) {
            await db.investments.bulkAdd(newEntries);
            showSnackbar(`Imported ${newEntries.length} entries`, "csv");
            location.reload();
        }
    };
    reader.readAsText(file);
}

/**
 * Cleanup old entries
 */
export async function dataCleanup(db) {
    if (confirm("This will remove duplicate entries (same date, amount, and note). Continue?")) {
        const investments = await db.investments.toArray();
        const seen = new Set();
        const toDelete = [];
        
        investments.forEach(inv => {
            const key = `${inv.date}-${inv.amount}-${inv.note}`;
            if (seen.has(key)) {
                toDelete.push(inv.id);
            } else {
                seen.add(key);
            }
        });
        
        if (toDelete.length > 0) {
            await db.investments.bulkDelete(toDelete);
            showSnackbar(`Removed ${toDelete.length} duplicates`, "delete");
            location.reload();
        } else {
            showSnackbar("No duplicates found", "info");
        }
    }
}

/**
 * Export Tax Report PDF
 */
export async function exportTaxPDF(db) {
    showSnackbar("Generating Tax Report PDF...", "picture_as_pdf");
    const investments = await db.investments.where('tags').equals('#Tax').toArray();
    
    const element = document.createElement('div');
    element.innerHTML = `
        <div style="padding:40px; font-family: Roboto, sans-serif;">
            <h1 style="color:#1a73e8;">TrackInvest 80C Tax Report</h1>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
            <table style="width:100%; border-collapse: collapse; margin-top:20px;">
                <thead>
                    <tr style="background:#f1f3f4;">
                        <th style="padding:10px; border:1px solid #ddd; text-align:left;">Date</th>
                        <th style="padding:10px; border:1px solid #ddd; text-align:left;">Asset</th>
                        <th style="padding:10px; border:1px solid #ddd; text-align:right;">Amount (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    ${investments.map(inv => `
                        <tr>
                            <td style="padding:10px; border:1px solid #ddd;">${inv.date}</td>
                            <td style="padding:10px; border:1px solid #ddd;">${inv.note || inv.type}</td>
                            <td style="padding:10px; border:1px solid #ddd; text-align:right;">${inv.amount.toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="font-weight:bold; background:#e8f0fe;">
                        <td colspan="2" style="padding:10px; border:1px solid #ddd; text-align:right;">Total Savings</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:right;">₹${investments.reduce((s, i) => s + i.amount, 0).toLocaleString()}</td>
                    </tr>
                </tfoot>
            </table>
            <div style="margin-top:40px; font-size:12px; color:#666;">
                * This report is generated automatically by TrackInvest based on user-tagged data.
            </div>
        </div>
    `;
    
    const opt = {
        margin: 1,
        filename: 'TrackInvest_Tax_Report.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save();
}
