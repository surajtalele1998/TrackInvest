const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const BASE = `https://api.telegram.org/bot`;

async function sendMessage(text, parseMode = 'Markdown') {
  if (!config.telegram.botToken || !config.telegram.chatId) {
    logger.warn('Telegram not configured');
    return { sent: false, reason: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing' };
  }
  try {
    const { data } = await axios.post(`${BASE}${config.telegram.botToken}/sendMessage`, {
      chat_id: config.telegram.chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    });
    logger.info('Telegram message sent');
    return { sent: true, messageId: data.result?.message_id };
  } catch (err) {
    logger.error('Telegram send failed: ' + (err.response?.data?.description || err.message));
    return { sent: false, error: err.message };
  }
}

async function sendNotification(title, body) {
  const text = `*${title}*\n\n${body}`;
  return sendMessage(text);
}

async function sendReport(reportTitle, reportBody) {
  const text = `📊 *${reportTitle}*\n\n${reportBody}\n\n— TrackInvest AI`;
  return sendMessage(text);
}

async function sendSipReminder(amount, assetName, dueDate) {
  const text = `🔔 *SIP Reminder*\n\nYour SIP of *₹${amount}* for *${assetName}* is due on *${dueDate}*.\n\nEnsure sufficient balance.`;
  return sendMessage(text);
}

async function sendGoalAlert(goalName, progress, target) {
  const pct = ((progress / target) * 100).toFixed(1);
  const text = `🎯 *Goal Progress: ${goalName}*\n\n₹${progress} / ₹${target} (${pct}%)\n\nKeep going!`;
  return sendMessage(text);
}

async function sendMarketAlert(symbol, price, changePct) {
  const icon = changePct >= 0 ? '📈' : '📉';
  const text = `${icon} *${symbol}* ${changePct >= 0 ? '+' : ''}${changePct}%\nPrice: ₹${price}`;
  return sendMessage(text);
}

module.exports = { sendMessage, sendNotification, sendReport, sendSipReminder, sendGoalAlert, sendMarketAlert };
