const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const config = require('../config');
const logger = require('../utils/logger');

const SYSTEM_PROMPTS = {
  general: `You are TrackInvest AI, a friendly Indian financial advisor. Help users with investment queries, portfolio analysis, and financial planning. Use Indian market context (NSE, BSE, Mutual Funds, etc.). Be concise and practical. Format responses with short paragraphs, bullet points, and key numbers in **bold**.`,

  full_report: `You are a seasoned financial analyst. Generate a comprehensive portfolio health report covering:
1. Portfolio Overview — total invested, current value, overall return (INR and %)
2. Asset Allocation — % across stocks, mutual funds, ETFs, crypto, FD, gold, etc.
3. Top Performers & Laggards
4. Diversification Score (out of 10)
5. Risk Assessment (Low / Moderate / High)
6. Recommendations — actionable steps to rebalance / improve

Format with clear section headers (###), bullet points, and **bold** numbers.`,

  ledger: `You are a spending & investment habit analyst. Analyze the user's investment ledger entries and provide:
1. Investment Frequency — how often they invest (daily/weekly/monthly)
2. Average Investment Size
3. Asset Preferences — which types they favor
4. Consistency Score (out of 10)
5. Behavioral Insights — are they timing the market or staying disciplined?
6. Suggestions to improve investment habits

Be encouraging and practical.`,

  blueprint: `You are a wealth architect. Create a personalized Wealth Blueprint based on the user's current portfolio:
1. Current Net Worth Snapshot
2. 1-Year Wealth Target (realistic, data-backed)
3. 5-Year Wealth Projection
4. Recommended Monthly Investment
5. Suggested Asset Allocation by goal (short-term, retirement, emergency, etc.)
6. Action Plan — 3 concrete steps to take this month

Use Indian financial instruments (PPF, EPF, NPS, Mutual Funds, etc.) where relevant.`,

  forecast: `You are an economic forecaster. Based on the user's portfolio and market trends, provide:
1. 30-Day Market Outlook for their holdings
2. 6-Month Projected Portfolio Value
3. Sector-wise Trends (IT, Pharma, Banking, FMCG, etc.)
4. Potential Risks (global cues, inflation, interest rates)
5. Recommended Positioning (aggressive/conservative/hybrid)

Include a disclaimer that past performance doesn't guarantee future results.`,
};

const SYSTEM_PROMPTS_MAP = {
  full_report: SYSTEM_PROMPTS.full_report,
  ledger: SYSTEM_PROMPTS.ledger,
  blueprint: SYSTEM_PROMPTS.blueprint,
  forecast: SYSTEM_PROMPTS.forecast,
};

async function askGemini(prompt, systemKey = 'general', history = []) {
  const genAI = new GoogleGenerativeAI(config.ai.geminiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: SYSTEM_PROMPTS_MAP[systemKey] || SYSTEM_PROMPTS.general,
  });

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(prompt);
  return result.response.text();
}

async function askOpenAI(prompt, systemKey = 'general', history = []) {
  const openai = new OpenAI({ apiKey: config.ai.openaiKey });
  const messages = [
    { role: 'system', content: SYSTEM_PROMPTS_MAP[systemKey] || SYSTEM_PROMPTS.general },
    ...history.map(m => ({ role: m.role, content: m.text })),
    { role: 'user', content: prompt },
  ];
  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.7,
    max_tokens: 4096,
  });
  return resp.choices[0].message.content;
}

async function askGroq(prompt, systemKey = 'general', history = []) {
  const groq = new OpenAI({
    apiKey: config.ai.groqKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });
  const messages = [
    { role: 'system', content: SYSTEM_PROMPTS_MAP[systemKey] || SYSTEM_PROMPTS.general },
    ...history.map(m => ({ role: m.role, content: m.text })),
    { role: 'user', content: prompt },
  ];
  const resp = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    temperature: 0.7,
    max_tokens: 4096,
  });
  return resp.choices[0].message.content;
}

async function generateChat(prompt, history = []) {
  const provider = config.ai.provider;
  if (!provider) throw Object.assign(new Error('No AI provider configured. Set GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY.'), { status: 503, expose: true });

  logger.info(`AI chat [${provider}] — ${prompt.slice(0, 60)}...`);
  if (provider === 'gemini') return askGemini(prompt, 'general', history);
  if (provider === 'groq') return askGroq(prompt, 'general', history);
  return askOpenAI(prompt, 'general', history);
}

async function generateReport(type, portfolioData) {
  const provider = config.ai.provider;
  if (!provider) throw Object.assign(new Error('No AI provider configured.'), { status: 503, expose: true });

  const dataStr = JSON.stringify(portfolioData, null, 2);
  const prompt = `Here is the user's portfolio data:\n\`\`\`json\n${dataStr}\n\`\`\`\n\nGenerate the ${type.replace('_', ' ')} report as instructed.`;

  logger.info(`AI report [${provider}] — ${type}`);
  if (provider === 'gemini') return askGemini(prompt, type);
  if (provider === 'groq') return askGroq(prompt, type);
  return askOpenAI(prompt, type);
}

module.exports = { generateChat, generateReport };
