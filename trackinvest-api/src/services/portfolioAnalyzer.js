const logger = require('../utils/logger');
const { formatCurrency } = require('../utils/helpers');

function calcXIRR(transactions, guess = 0.05) {
  if (!transactions || transactions.length < 2) return 0;
  const DAYS_IN_YEAR = 365;

  const sorted = [...transactions]
    .filter(t => t.amount !== 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (sorted.length < 2) return 0;

  const startDate = new Date(sorted[0].date);
  const days = sorted.map(t => (new Date(t.date) - startDate) / (1000 * 60 * 60 * 24));
  const amounts = sorted.map(t => -Math.abs(t.amount));

  function npv(rate) {
    return amounts.reduce((sum, amt, i) => sum + amt / Math.pow(1 + rate, days[i] / DAYS_IN_YEAR), 0);
  }

  let r = guess;
  for (let iter = 0; iter < 100; iter++) {
    const f = npv(r);
    if (Math.abs(f) < 1e-7) return r;
    const fPrime = amounts.reduce((sum, amt, i) =>
      sum - (days[i] / DAYS_IN_YEAR) * amt / Math.pow(1 + r, days[i] / DAYS_IN_YEAR + 1), 0);
    if (Math.abs(fPrime) < 1e-12) break;
    const rNew = r - f / fPrime;
    if (Math.abs(rNew - r) < 1e-7) return rNew;
    r = rNew;
  }
  return r;
}

function analyzePortfolio(holdings) {
  if (!holdings || holdings.length === 0) {
    return { totalInvested: 0, currentValue: 0, overallReturn: 0, overallReturnPercent: 0, assetAllocation: {}, topPerformers: [], laggards: [], diversificationScore: 0, riskLevel: 'Low' };
  }

  const totalInvested = holdings.reduce((s, h) => s + (h.invested || 0), 0);
  const currentValue = holdings.reduce((s, h) => s + (h.currentValue || 0), 0);
  const overallReturn = currentValue - totalInvested;
  const overallReturnPercent = totalInvested > 0 ? (overallReturn / totalInvested) * 100 : 0;

  const assetAllocation = {};
  for (const h of holdings) {
    const type = h.type || 'other';
    assetAllocation[type] = (assetAllocation[type] || 0) + (h.currentValue || 0);
  }
  for (const key of Object.keys(assetAllocation)) {
    assetAllocation[key] = { value: assetAllocation[key], percent: currentValue > 0 ? (assetAllocation[key] / currentValue) * 100 : 0 };
  }

  const withReturns = holdings.map(h => ({
    ...h,
    returnVal: (h.currentValue || 0) - (h.invested || 0),
    returnPercent: h.invested > 0 ? (((h.currentValue || 0) - (h.invested || 0)) / h.invested) * 100 : 0,
  })).sort((a, b) => b.returnPercent - a.returnPercent);

  const topPerformers = withReturns.slice(0, 3).map(h => ({
    name: h.name, symbol: h.symbol, returnPercent: h.returnPercent.toFixed(2),
  }));

  const laggards = withReturns.slice(-3).reverse().map(h => ({
    name: h.name, symbol: h.symbol, returnPercent: h.returnPercent.toFixed(2),
  }));

  const typeCount = Object.keys(assetAllocation).length;
  const diversificationScore = Math.min(10, Math.max(1, typeCount * 2.5 + (holdings.length > 10 ? 2 : 0) + (holdings.length > 20 ? 1 : 0)));

  let riskLevel = 'Low';
  const topType = Object.entries(assetAllocation).sort((a, b) => b[1].percent - a[1].percent)[0];
  if (topType) {
    if (topType[0] === 'crypto' && topType[1].percent > 10) riskLevel = 'Very High';
    else if (topType[0] === 'stock' && topType[1].percent > 60) riskLevel = 'High';
    else if (topType[0] === 'stock' && topType[1].percent > 40) riskLevel = 'Moderate';
  }

  return { totalInvested, currentValue, overallReturn, overallReturnPercent, assetAllocation, topPerformers, laggards, diversificationScore: diversificationScore.toFixed(1), riskLevel };
}

function rebalanceSuggestions(holdings, targetAllocation) {
  const analysis = analyzePortfolio(holdings);
  const suggestions = [];

  for (const [type, target] of Object.entries(targetAllocation)) {
    const current = analysis.assetAllocation[type];
    const currentPercent = current ? current.percent : 0;
    const diff = (target - currentPercent).toFixed(1);
    if (Math.abs(diff) > 5) {
      const action = diff > 0 ? 'Increase' : 'Reduce';
      const amount = Math.abs((analysis.currentValue * Math.abs(diff)) / 100);
      suggestions.push({
        type,
        action,
        currentPercent: currentPercent.toFixed(1),
        targetPercent: target,
        diff: parseFloat(diff),
        suggestedAmount: Math.round(amount),
        suggestion: `${action} ${type} by ${Math.abs(diff)}% (~${formatCurrency(amount)}) to reach ${target}% target.`,
      });
    }
  }
  return suggestions;
}

module.exports = { calcXIRR, analyzePortfolio, rebalanceSuggestions };
