const logger = require('../utils/logger');

function analyzeTaxHarvesting(holdings) {
  const lots = holdings.map(h => {
    const costBasis = h.invested || 0;
    const currentValue = h.currentValue || 0;
    const gainLoss = currentValue - costBasis;
    const gainLossPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
    return {
      name: h.name, symbol: h.symbol, type: h.type,
      costBasis: Math.round(costBasis),
      currentValue: Math.round(currentValue),
      gainLoss: Math.round(gainLoss),
      gainLossPct: parseFloat(gainLossPct.toFixed(2)),
      status: gainLoss > 0 ? 'gain' : (gainLoss < 0 ? 'loss' : 'breakeven'),
      heldMoreThanYear: h.buyDate ? (new Date() - new Date(h.buyDate)) > 365 * 24 * 60 * 60 * 1000 : false,
      harvestable: gainLoss < 0 && Math.abs(gainLossPct) > 5,
    };
  });

  const totalGains = lots.filter(l => l.status === 'gain').reduce((s, l) => s + l.gainLoss, 0);
  const totalLosses = lots.filter(l => l.status === 'loss').reduce((s, l) => s + Math.abs(l.gainLoss), 0);
  const netGainLoss = totalGains - totalLosses;
  const harvestableLosses = lots.filter(l => l.harvestable).reduce((s, l) => s + Math.abs(l.gainLoss), 0);

  const suggestions = [];
  const harvestable = lots.filter(l => l.harvestable);
  for (const lot of harvestable) {
    suggestions.push({
      name: lot.name,
      symbol: lot.symbol,
      lossAmount: Math.abs(lot.gainLoss),
      lossPct: Math.abs(lot.gainLossPct),
      suggestion: `Consider selling ${lot.name} to book a loss of ₹${Math.abs(lot.gainLoss)} and offset gains. You can repurchase after 30 days to avoid wash sale rules.`,
      priority: Math.abs(lot.gainLossPct) > 20 ? 'high' : (Math.abs(lot.gainLossPct) > 10 ? 'medium' : 'low'),
    });
  }

  const shortTermLosses = lots.filter(l => l.status === 'loss' && !l.heldMoreThanYear).reduce((s, l) => s + Math.abs(l.gainLoss), 0);
  const longTermLosses = lots.filter(l => l.status === 'loss' && l.heldMoreThanYear).reduce((s, l) => s + Math.abs(l.gainLoss), 0);

  return {
    summary: {
      totalGains: Math.round(totalGains),
      totalLosses: Math.round(totalLosses),
      netGainLoss: Math.round(netGainLoss),
      harvestableLosses: Math.round(harvestableLosses),
      shortTermLosses: Math.round(shortTermLosses),
      longTermLosses: Math.round(longTermLosses),
      taxLiability: netGainLoss > 0 ? Math.round(netGainLoss * 0.15) : 0,
    },
    lots,
    suggestions: suggestions.sort((a, b) => b.lossAmount - a.lossAmount),
    harvestableCount: harvestable.length,
  };
}

function estimateCapitalGains(holdings, sellAmount) {
  const lots = holdings.filter(h => (h.currentValue || 0) > 0);
  let remainingToSell = sellAmount;
  let totalGain = 0;
  const soldLots = [];

  for (const lot of lots) {
    if (remainingToSell <= 0) break;
    const sellValue = Math.min(lot.currentValue || 0, remainingToSell);
    const buyRatio = lot.invested > 0 ? sellValue / (lot.currentValue || 1) : 0;
    const costOfSold = (lot.invested || 0) * buyRatio;
    const gain = sellValue - costOfSold;
    totalGain += gain;
    soldLots.push({ name: lot.name, symbol: lot.symbol, sold: Math.round(sellValue), cost: Math.round(costOfSold), gain: Math.round(gain) });
    remainingToSell -= sellValue;
  }

  return {
    totalSellAmount: sellAmount - remainingToSell,
    totalCostBasis: soldLots.reduce((s, l) => s + l.cost, 0),
    totalGain: Math.round(totalGain),
    estimatedTax: Math.round(Math.max(0, totalGain) * 0.15),
    soldLots,
    remainingToSell: Math.round(remainingToSell),
  };
}

module.exports = { analyzeTaxHarvesting, estimateCapitalGains };
