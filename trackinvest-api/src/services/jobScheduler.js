const cron = require('node-cron');
const config = require('../config');
const logger = require('../utils/logger');
const { getDb } = require('../models/database');
const { analyzePortfolio } = require('./portfolioAnalyzer');

let jobs = [];

function registerJob(name, schedule, task) {
  if (!cron.validate(schedule)) {
    logger.warn(`Invalid cron schedule for job "${name}": ${schedule}`);
    return;
  }
  const job = cron.schedule(schedule, async () => {
    logger.info(`Cron job "${name}" started`);
    try {
      await task();
      logger.info(`Cron job "${name}" completed`);
    } catch (err) {
      logger.error(`Cron job "${name}" failed: ${err.message}`);
    }
  }, { scheduled: false });
  jobs.push({ name, schedule, job });
  return job;
}

function startAll() {
  jobs.forEach(j => {
    j.job.start();
    logger.info(`Cron job "${j.name}" started [${j.schedule}]`);
  });
}

function stopAll() {
  jobs.forEach(j => j.job.stop());
  jobs = [];
  logger.info('All cron jobs stopped');
}

function initDefaultJobs() {
  if (!config.supabase.url) {
    logger.info('Supabase not configured — default cron jobs disabled');
    return;
  }

  const telegram = require('./telegramBot');

  registerJob('daily-market-summary', '0 18 * * 1-5', async () => {
    logger.info('Daily market summary — placeholder');
    await telegram.sendNotification('📊 Daily Market Summary', 'Market summary job executed. Extend with real data.');
  });

  registerJob('weekly-auto-backup', '0 8 * * 1', async () => {
    logger.info('Weekly auto backup triggered');
  });

  logger.info('Default cron jobs registered');
}

module.exports = { registerJob, startAll, stopAll, initDefaultJobs };
