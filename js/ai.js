/**
 * ai.js - Neural Wealth Engine
 * Deep integration with Google Gemini for financial intelligence.
 */
import { getSetting, db } from './db.js';
import { showSnackbar } from './utils.js';

/**
 * Generates a contextual prompt with current portfolio data.
 */
async function buildContextualPrompt(userQuery) {
    const investments = await db.investments.toArray();
    const settings = await db.settings.toArray();
    const profile = await getSetting('userProfile', {});
    
    // Summarize data for AI (keep it concise but informative)
    const summary = investments.reduce((acc, inv) => {
        acc[inv.type] = (acc[inv.type] || 0) + inv.amount;
        return acc;
    }, {});

    return `
    System: You are TrackInvest AI, a premium financial strategist.
    User Profile: Salary ₹${profile.salary}, Regime: ${profile.regime}.
    Current Portfolio Summary: ${JSON.stringify(summary)}
    
    User Request: ${userQuery}
    
    Provide actionable, professional advice. Focus on risk management, diversification, and wealth growth. Use clean formatting.
    `;
}

/**
 * Fetches response from Gemini API.
 */
export async function askTrackInvestAI(query) {
    const apiKey = await getSetting('geminiKey');
    if (!apiKey) {
        showSnackbar("Please add Gemini API Key in Settings", "key");
        return "Missing API Key.";
    }

    const prompt = await buildContextualPrompt(query);

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't process that. Please try again.";
        
        // Save to history
        await db.chatHistory.add({ 
            query, 
            response: text, 
            timestamp: new Date().toISOString() 
        });

        return text;
    } catch (err) {
        console.error("AI Error:", err);
        return "Connection failed. Check your API key or network.";
    }
}

/**
 * Deep Portfolio Audit
 */
export async function performDeepAudit() {
    const query = "Analyze my entire portfolio for risk and diversification. Provide a detailed wealth blueprint.";
    return await askTrackInvestAI(query);
}

/**
 * AI Forecast Generation
 */
export async function generateAIForecast() {
    const content = document.getElementById('ai-predict-sheet-content');
    if (!content) return;

    content.innerHTML = `<div style="padding:24px;text-align:center;color:var(--md-primary);">
        <span class="material-symbols-rounded ai-loading-icon" style="font-size:32px;">autorenew</span>
        <div style="margin-top:12px;font-size:14px;">Generating AI Forecast...</div>
    </div>`;

    const query = "Based on my current portfolio and historical logs, predict my next month's investment totals per category and provide a brief rationale. Format as a clean summary.";
    const response = await askTrackInvestAI(query);
    
    content.innerHTML = `<div class="ai-report-body" style="padding:16px; line-height:1.6; color:var(--md-on-surface-variant);">${response.replace(/\n/g, '<br>')}</div>`;
}

/**
 * Full Wealth Blueprint
 */
export async function generateWealthBlueprint() {
    const container = document.getElementById('wealth-blueprint-content');
    if (!container) return;

    container.innerHTML = `<div style="padding:40px; text-align:center;">
        <span class="material-symbols-rounded ai-loading-icon" style="font-size:48px; color:var(--md-primary);">psychology</span>
        <div style="margin-top:16px; font-weight:500;">Drafting your personalized wealth strategy...</div>
    </div>`;

    const query = "Act as an elite Wealth Manager. Perform a Full Wealth Audit. Analyze net worth distribution, suggest actions for next 12 months, and provide a 5-year projection.";
    const report = await askTrackInvestAI(query);
    container.innerHTML = `<div class="ai-report-body" style="padding:20px;">${report.replace(/\n/g, '<br>')}</div>`;
}

/**
 * AI Rebalance Audit - Identifies over-concentration and suggests strategies
 */
export async function generateRebalanceAudit() {
    const container = document.getElementById('ai-rebalance-content');
    if (!container) return;
    
    container.innerHTML = `<div style="padding:40px; text-align:center;">
        <span class="material-symbols-rounded ai-loading-icon" style="font-size:48px; color:var(--md-primary);">balance</span>
        <div style="margin-top:16px; font-weight:500;">Auditing your risk exposure...</div>
    </div>`;
    
    try {
        const investments = await window.db.investments.toArray();
        const settings = await window.db.settings.get('navCache') || { value: {} };
        const navCache = settings.value || {};
        
        // Calculate current allocation
        let total = 0;
        const allocation = {};
        
        investments.forEach(inv => {
            let val = parseFloat(inv.amount) || 0;
            if (inv.mfCode && navCache[inv.mfCode]) {
                val = (parseFloat(inv.units) || 0) * (parseFloat(navCache[inv.mfCode].nav) || 0);
            }
            allocation[inv.type] = (allocation[inv.type] || 0) + val;
            total += val;
        });
        
        const allocStr = Object.entries(allocation)
            .filter(([_, v]) => v > 0)
            .map(([k, v]) => `${k}: ${((v/total)*100).toFixed(1)}%`)
            .join(', ');

        const prompt = `Act as a Financial Risk Manager. 
        Current Portfolio Allocation: ${allocStr}. 
        Net Worth: ${total.toFixed(2)}.
        Identify if the portfolio is over-concentrated in any asset class.
        Suggest a rebalancing strategy for a 'Moderate' risk profile (Target: 60% Equity, 30% Debt, 10% Cash/Gold).
        Keep it concise in 4-5 bullet points.`;

        const response = await askTrackInvestAI(prompt);
        container.innerHTML = `<div class="ai-report-body" style="padding:20px;">${response.replace(/\n/g, '<br>')}</div>`;
    } catch (error) {
        console.error("Audit Error:", error);
        container.innerHTML = `<div class="error-msg" style="padding:20px; color:var(--md-error);">Audit failed. Check connection.</div>`;
    }
}
