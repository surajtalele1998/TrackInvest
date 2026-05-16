const { z } = require('zod');

const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z.array(z.object({ role: z.enum(['user', 'model']), text: z.string() })).optional(),
});

const reportSchema = z.object({
  type: z.enum(['full_report', 'ledger', 'blueprint', 'forecast']),
  portfolioData: z.any().optional(),
});

const portfolioSchema = z.object({
  holdings: z.array(z.object({
    name: z.string().min(1),
    symbol: z.string().optional(),
    type: z.enum(['stock', 'mutual_fund', 'etf', 'crypto', 'fd', 'bond', 'gold', 'real_estate', 'other']),
    invested: z.number().min(0),
    currentValue: z.number().min(0),
    quantity: z.number().min(0).optional(),
    buyDate: z.string().optional(),
  })).min(1),
});

const backupSchema = z.object({
  data: z.record(z.any()),
  version: z.string().optional(),
  label: z.string().max(100).optional(),
});

const notificationSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  icon: z.string().url().optional(),
  tag: z.string().max(50).optional(),
  subscription: z.object({
    endpoint: z.string(),
    keys: z.object({ p256dh: z.string(), auth: z.string() }),
  }),
});

const marketSearchSchema = z.object({
  query: z.string().min(1).max(100),
});

module.exports = { chatSchema, reportSchema, portfolioSchema, backupSchema, notificationSchema, marketSearchSchema };
