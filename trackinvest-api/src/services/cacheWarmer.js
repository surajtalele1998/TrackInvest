const cache = require('./cacheService');
const marketProvider = require('./marketProvider');
const logger = require('../utils/logger');

const POPULAR_SYMBOLS = [
  'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS',
  'HINDUNILVR.NS', 'ITC.NS', 'SBIN.NS', 'BHARTIARTL.NS', 'KOTAKBANK.NS',
  'BAJFINANCE.NS', 'LT.NS', 'WIPRO.NS', 'AXISBANK.NS', 'TITAN.NS',
  'NIFTY_50', 'SENSEX',
];

async function warmCache() {
  logger.info('Cache warming started');
  let warmed = 0;
  for (const symbol of POPULAR_SYMBOLS) {
    try {
      const cached = cache.get(`quote:${symbol}`);
      if (!cached) {
        const quote = await marketProvider.getQuote(symbol);
        if (quote) warmed++;
      }
    } catch {
      // silently skip unavailable symbols
    }
  }
  logger.info(`Cache warming complete: ${warmed} symbols cached`);
  return { warmed, total: POPULAR_SYMBOLS.length };
}

async function warmOnStartup() {
  try {
    await warmCache();
  } catch (e) {
    logger.warn('Initial cache warm skipped: ' + e.message);
  }
}

module.exports = { warmCache, warmOnStartup, POPULAR_SYMBOLS };
