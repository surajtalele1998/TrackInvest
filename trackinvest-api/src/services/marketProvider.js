const axios = require('axios');
const config = require('../config');
const cache = require('./cacheService');
const logger = require('../utils/logger');

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const ALPHA_BASE = 'https://www.alphavantage.co/query';

function searchYahoo(query) {
  return axios.get(`https://query1.finance.yahoo.com/v1/finance/search`, {
    params: { q: query, quotesCount: 10, newsCount: 0, lang: 'en-US', region: 'IN' },
  }).then(r => r.data.quotes.map(q => ({
    symbol: q.symbol,
    name: q.longname || q.shortname || q.symbol,
    exchange: q.exchange,
    type: q.quoteType,
    score: q.score,
  })));
}

async function getQuote(symbol) {
  const cacheKey = `quote:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const { data } = await axios.get(`${YAHOO_BASE}/${encodeURIComponent(symbol)}`, {
    params: { range: '1d', interval: '1d' },
    timeout: 10000,
  });

  const result = data.chart?.result?.[0];
  if (!result) throw Object.assign(new Error(`No quote data for ${symbol}`), { status: 404, expose: true });

  const meta = result.meta;
  const quote = {
    symbol: meta.symbol,
    name: meta.shortName || meta.symbol,
    currency: meta.currency,
    price: meta.regularMarketPrice,
    previousClose: meta.previousClose || meta.chartPreviousClose,
    change: meta.regularMarketPrice - (meta.previousClose || meta.chartPreviousClose || meta.regularMarketPrice),
    dayHigh: result.indicators?.quote?.[0]?.high?.slice(-1)[0],
    dayLow: result.indicators?.quote?.[0]?.low?.slice(-1)[0],
    volume: result.indicators?.quote?.[0]?.volume?.slice(-1)[0],
    timestamp: result.timestamp?.slice(-1)[0],
  };
  quote.changePercent = quote.previousClose ? ((quote.change / quote.previousClose) * 100).toFixed(2) : '0.00';

  cache.set(cacheKey, quote, 120000);
  return quote;
}

async function getHistoricalData(symbol, range = '1mo', interval = '1d') {
  const cacheKey = `history:${symbol}:${range}:${interval}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const { data } = await axios.get(`${YAHOO_BASE}/${encodeURIComponent(symbol)}`, {
    params: { range, interval },
    timeout: 15000,
  });

  const result = data.chart?.result?.[0];
  if (!result) throw Object.assign(new Error(`No historical data for ${symbol}`), { status: 404, expose: true });

  const timestamps = result.timestamp || [];
  const quotes = result.indicators?.quote?.[0] || {};
  const series = timestamps.map((t, i) => ({
    date: new Date(t * 1000).toISOString().slice(0, 10),
    open: quotes.open?.[i],
    high: quotes.high?.[i],
    low: quotes.low?.[i],
    close: quotes.close?.[i],
    volume: quotes.volume?.[i],
  })).filter(s => s.close != null);

  cache.set(cacheKey, series, 600000);
  return series;
}

async function getIndianMutualFundNav(schemeCode) {
  const url = `https://api.mfapi.in/mf/${schemeCode}`;
  const cacheKey = `mf:${schemeCode}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const { data } = await axios.get(url, { timeout: 10000 });
  const result = {
    schemeName: data.meta?.scheme_name || `Scheme ${schemeCode}`,
    fundHouse: data.meta?.fund_house || '',
    schemeType: data.meta?.scheme_type || '',
    nav: parseFloat(data.data?.[0]?.nav || 0),
    date: data.data?.[0]?.date || '',
    navHistory: data.data?.slice(0, 30).map(d => ({ date: d.date, nav: parseFloat(d.nav) })) || [],
  };
  cache.set(cacheKey, result, 3600000);
  return result;
}

async function searchAlphaVantage(query) {
  if (!config.market.alphaVantageKey) return [];
  const { data } = await axios.get(ALPHA_BASE, {
    params: { function: 'SYMBOL_SEARCH', keywords: query, apikey: config.market.alphaVantageKey },
  });
  return (data.bestMatches || []).map(m => ({
    symbol: m['1. symbol'],
    name: m['2. name'],
    type: m['3. type'],
    region: m['4. region'],
    currency: m['8. currency'],
  }));
}

async function searchMarkets(query) {
  const [yahoo, alpha] = await Promise.allSettled([
    searchYahoo(query),
    searchAlphaVantage(query),
  ]);

  const results = [];
  if (yahoo.status === 'fulfilled') results.push(...yahoo.value);
  if (alpha.status === 'fulfilled') results.push(...alpha.value);
  return results.slice(0, 15);
}

module.exports = { searchMarkets, getQuote, getHistoricalData, getIndianMutualFundNav };
