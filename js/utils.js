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
    a.click();
}
