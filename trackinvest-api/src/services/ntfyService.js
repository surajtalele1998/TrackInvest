const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const NTFY_BASE = 'https://ntfy.sh';

async function sendNtfy(title, body, priority = 3) {
  if (!config.ntfy.topic) {
    return { sent: false, reason: 'NTFY_TOPIC not configured' };
  }
  try {
    await axios.post(`${NTFY_BASE}/${config.ntfy.topic}`, body, {
      headers: {
        Title: title,
        Priority: String(priority),
        Tags: 'chart_with_upwards_trend',
      },
    });
    logger.info(`ntfy.sh notification sent: ${title}`);
    return { sent: true };
  } catch (err) {
    logger.error('ntfy.sh failed: ' + err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendNtfy };
