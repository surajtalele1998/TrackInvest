const axios = require('axios');
const config = require('../config');
const cache = require('./cacheService');
const logger = require('../utils/logger');

async function getFinancialNews(query = 'stock market india', pageSize = 10) {
  if (!config.news.apiKey) {
    return { error: 'NEWSAPI_KEY not configured', articles: [] };
  }
  const cacheKey = `news:${query}:${pageSize}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: query,
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: Math.min(pageSize, 100),
        apiKey: config.news.apiKey,
      },
      timeout: 10000,
    });
    const articles = (data.articles || []).map(a => ({
      title: a.title,
      description: a.description,
      url: a.url,
      source: a.source?.name,
      publishedAt: a.publishedAt,
      imageUrl: a.urlToImage,
    }));
    const result = { totalResults: data.totalResults, articles };
    cache.set(cacheKey, result, 1800000);
    return result;
  } catch (err) {
    logger.error('NewsAPI failed: ' + (err.response?.data?.message || err.message));
    return { error: err.message, articles: [] };
  }
}

async function getTopHeadlines(country = 'in', category = 'business', pageSize = 10) {
  if (!config.news.apiKey) return { error: 'NEWSAPI_KEY not configured', articles: [] };
  const cacheKey = `headlines:${country}:${category}:${pageSize}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: { country, category, pageSize: Math.min(pageSize, 100), apiKey: config.news.apiKey },
      timeout: 10000,
    });
    const articles = (data.articles || []).map(a => ({
      title: a.title,
      description: a.description,
      url: a.url,
      source: a.source?.name,
      publishedAt: a.publishedAt,
      imageUrl: a.urlToImage,
    }));
    const result = { totalResults: data.totalResults, articles };
    cache.set(cacheKey, result, 1800000);
    return result;
  } catch (err) {
    logger.error('NewsAPI headlines failed: ' + err.message);
    return { error: err.message, articles: [] };
  }
}

async function getExchangeRate(base = 'INR', target = 'USD') {
  if (!config.exchangeRate.apiKey) return { error: 'EXCHANGERATE_API_KEY not configured' };
  const cacheKey = `fx:${base}:${target}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await axios.get(`https://v6.exchangerate-api.com/v6/${config.exchangeRate.apiKey}/pair/${base}/${target}`, { timeout: 10000 });
    const result = {
      base: data.base_code,
      target: data.target_code,
      rate: data.conversion_rate,
      lastUpdated: data.time_last_update_utc,
    };
    cache.set(cacheKey, result, 3600000);
    return result;
  } catch (err) {
    logger.error('ExchangeRate API failed: ' + err.message);
    return { error: err.message };
  }
}

module.exports = { getFinancialNews, getTopHeadlines, getExchangeRate };
