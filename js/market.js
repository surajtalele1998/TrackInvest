/**
 * market.js - Real-time Market Data Engine
 * Fetches Mutual Fund NAVs and Stock prices.
 */
import { showSnackbar } from './utils.js';
import { db, setSetting, getSetting } from './db.js';

const MF_API_BASE = 'https://api.mfapi.in/mf';

/**
 * Searches for Mutual Funds via mfapi.in
 */
export async function searchMutualFunds(query) {
    if (query.length < 3) return [];
    try {
        const response = await fetch(`${MF_API_BASE}/search?q=${query}`);
        if (!response.ok) throw new Error("Search failed");
        return await response.json();
    } catch (err) {
        console.error("MF Search Error:", err);
        return [];
    }
}

/**
 * Fetches latest NAV for a specific fund
 */
export async function fetchNAV(schemeCode) {
    try {
        const response = await fetch(`${MF_API_BASE}/${schemeCode}`);
        if (!response.ok) throw new Error("Fetch failed");
        const data = await response.json();
        if (data && data.data && data.data[0]) {
            return {
                nav: parseFloat(data.data[0].nav),
                date: data.data[0].date,
                schemeName: data.meta.scheme_name
            };
        }
        return null;
    } catch (err) {
        console.error("NAV Fetch Error:", err);
        return null;
    }
}

/**
 * Bulk updates NAVs for all tracked funds in the portfolio
 */
export async function syncPortfolioNAVs() {
    const investments = await db.investments.toArray();
    const codes = [...new Set(investments.filter(i => i.mfCode).map(i => i.mfCode))];
    
    if (codes.length === 0) return;
    
    showSnackbar(`Updating ${codes.length} funds...`, "sync");
    const navCache = await getSetting('navCache', {});
    
    for (const code of codes) {
        const data = await fetchNAV(code);
        if (data) {
            navCache[code] = {
                nav: data.nav,
                date: data.date,
                updatedAt: Date.now()
            };
        }
    }
    
    await setSetting('navCache', navCache);
    showSnackbar("Portfolio Values Updated", "check_circle");
}
