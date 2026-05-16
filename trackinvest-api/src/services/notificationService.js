const webPush = require('web-push');
const nodemailer = require('nodemailer');
const config = require('../config');
const { getDb } = require('../models/database');
const logger = require('../utils/logger');

if (config.notifications.vapidPublicKey && config.notifications.vapidPrivateKey) {
  webPush.setVapidDetails(
    config.notifications.vapidSubject,
    config.notifications.vapidPublicKey,
    config.notifications.vapidPrivateKey
  );
}

function getSubscriptions() {
  const db = getDb();
  return db.prepare('SELECT * FROM push_subscriptions').all();
}

function addSubscription(sub) {
  const db = getDb();
  db.prepare(`INSERT OR REPLACE INTO push_subscriptions (endpoint, p256dh, auth) VALUES (?, ?, ?)`)
    .run(sub.endpoint, sub.keys.p256dh, sub.keys.auth);
  logger.info('Push subscription added');
}

function removeSubscription(endpoint) {
  const db = getDb();
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  logger.info('Push subscription removed');
}

async function sendPushNotification(title, body, tag = 'general') {
  const subs = getSubscriptions();
  if (subs.length === 0) {
    logger.warn('No push subscriptions to send to');
    return { sent: 0, failed: 0 };
  }

  const payload = JSON.stringify({ title, body, tag, timestamp: new Date().toISOString() });
  let sent = 0, failed = 0;

  for (const sub of subs) {
    try {
      await webPush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }, payload);
      sent++;
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        removeSubscription(sub.endpoint);
      }
      failed++;
    }
  }

  logNotification(title, body, tag, sent > 0 ? 'sent' : 'failed');
  logger.info(`Push notification sent to ${sent}/${subs.length} subscribers`);
  return { sent, failed };
}

async function sendEmail(to, subject, html) {
  if (!config.smtp.host || !config.smtp.user) {
    logger.warn('SMTP not configured, skipping email');
    return { sent: false, reason: 'SMTP not configured' };
  }

  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });

  await transporter.sendMail({
    from: `"TrackInvest" <${config.smtp.user}>`,
    to,
    subject,
    html,
  });

  logNotification(subject, '', 'email', 'sent');
  logger.info(`Email sent to ${to}`);
  return { sent: true };
}

function logNotification(title, body, tag, status) {
  const db = getDb();
  db.prepare(`INSERT INTO notification_log (title, body, tag, status) VALUES (?, ?, ?, ?)`)
    .run(title, body, tag || null, status);
}

function getNotificationLog(limit = 50) {
  const db = getDb();
  return db.prepare('SELECT * FROM notification_log ORDER BY sent_at DESC LIMIT ?').all(limit);
}

module.exports = { addSubscription, removeSubscription, sendPushNotification, sendEmail, getNotificationLog, getSubscriptions };
