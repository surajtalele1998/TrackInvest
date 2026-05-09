/**
 * engine.js - Financial Calculation Engine
 * Handles tax, valuations, and portfolio math.
 */
import { formatInr } from './utils.js';

/**
 * Calculates tax liability based on regime and income.
 */
export function calculateTax(userProfile, currentTax80c) {
    let sal = parseFloat(userProfile.salary) || 0;
    if (sal === 0) return { liability: 0, str: "Setup Income in Settings" };

    let regime = userProfile.regime || 'new';
    let tax = 0;

    if (regime === 'new') {
        let taxable = Math.max(0, sal - 75000); // Standard deduction 2024
        if (taxable <= 1200000) return { liability: 0, str: "Tax Free (Rebate Limit)" };
        if (taxable > 300000) tax += Math.min(taxable - 300000, 400000) * 0.05;
        if (taxable > 700000) tax += Math.min(taxable - 700000, 300000) * 0.10;
        if (taxable > 1000000) tax += Math.min(taxable - 1000000, 200000) * 0.15;
        if (taxable > 1200000) tax += Math.min(taxable - 1200000, 300000) * 0.20;
        if (taxable > 1500000) tax += (taxable - 1500000) * 0.30;
    } else {
        let taxable = Math.max(0, sal - 50000 - Math.min(currentTax80c, 150000));
        if (taxable <= 500000) return { liability: 0, str: "Tax Free (Rebate 87A)" };
        if (taxable > 250000) tax += Math.min(taxable - 250000, 250000) * 0.05;
        if (taxable > 500000) tax += Math.min(taxable - 500000, 500000) * 0.20;
        if (taxable > 1000000) tax += (taxable - 1000000) * 0.30;
    }

    tax = tax * 1.04; // Cess
    return { liability: tax, str: `₹${formatInr(tax)}` };
}

/**
 * Calculates current market value for different investment types.
 */
export function calculateValuation(type, totalInvested, rawInvs, categoryDetails = {}, navCache = {}) {
    const govRates = { 'PPF': 7.1, 'PF': 8.15 };
    const defaultRate = categoryDetails[type]?.interestRate || govRates[type] || 0;
    let interestEarned = 0;

    if (type === 'FD') {
        let val = 0;
        rawInvs.forEach(inv => {
            if (inv.isDividend) return;
            let rate = inv.interestRate || defaultRate;
            let payout = inv.payoutType || 'quarterly';
            let years = (new Date() - new Date(inv.date)) / (1000 * 60 * 60 * 24 * 365);
            let principal = inv.amount;
            let futureVal = principal;
            if (payout === 'quarterly') futureVal = principal * Math.pow(1 + (rate / 100) / 4, 4 * years);
            else if (payout === 'monthly') futureVal = principal * Math.pow(1 + (rate / 100) / 12, 12 * years);
            else futureVal = principal * (1 + (rate / 100) * years);
            val += futureVal;
            interestEarned += (futureVal - principal);
        });
        return { total: val, interest: interestEarned };
    }

    if (type === 'PF' || type === 'PPF') {
        let val = 0;
        let sorted = rawInvs.filter(i => !i.isDividend).sort((a, b) => new Date(a.date) - new Date(b.date));
        sorted.forEach(inv => {
            let years = (new Date() - new Date(inv.date)) / (1000 * 60 * 60 * 24 * 365);
            let futureVal = inv.amount * Math.pow(1 + (defaultRate / 100), years);
            val += futureVal;
            interestEarned += (futureVal - inv.amount);
        });
        return { total: val, interest: interestEarned };
    }

    if ((type === 'SIP' || type === 'Stocks') && navCache) {
        let val = 0; let hasUnits = false;
        rawInvs.forEach(inv => {
            if (!inv.isDividend && inv.units && inv.mfCode && navCache[inv.mfCode]) {
                let currentVal = inv.units * navCache[inv.mfCode].nav;
                val += currentVal;
                interestEarned += (currentVal - inv.amount);
                hasUnits = true;
            } else if (!inv.isDividend) {
                val += inv.amount;
            }
        });
        if (hasUnits) return { total: val, interest: interestEarned };
    }

    return { total: totalInvested, interest: 0 };
}

/**
 * Smart NW Projection v2
 * Predicts Net Worth based on current allocation and inflation.
 */
export function calculateNWProjection(currentNW, allocation, monthlySIP, months, inflation = 6) {
    const assetReturns = {
        "Mutual Fund": 12,
        "Stock": 15,
        "Fixed Deposit": 7,
        "PPF": 7.1,
        "PF": 8.15,
        "Gold": 8,
        "Cash": 3,
        "Other": 5
    };

    // Calculate weighted expected return
    let totalValue = Object.values(allocation).reduce((a, b) => a + b, 0);
    let weightedReturn = 0;
    
    if (totalValue > 0) {
        Object.entries(allocation).forEach(([type, val]) => {
            const r = assetReturns[type] || assetReturns["Other"];
            weightedReturn += (val / totalValue) * r;
        });
    } else {
        weightedReturn = 8; // Default to 8% if no data
    }

    // Real Return = (1 + Nominal) / (1 + Inflation) - 1
    const monthlyRealReturn = Math.pow((1 + weightedReturn/100) / (1 + inflation/100), 1/12) - 1;
    
    // FV of current wealth + FV of SIP
    const years = months / 12;
    const fvWealth = currentNW * Math.pow(1 + monthlyRealReturn, months);
    const fvSIP = monthlySIP * (Math.pow(1 + monthlyRealReturn, months) - 1) / monthlyRealReturn;
    
    return {
        projectedNW: fvWealth + fvSIP,
        weightedReturn,
        realReturn: (Math.pow(1 + monthlyRealReturn, 12) - 1) * 100
    };
}
