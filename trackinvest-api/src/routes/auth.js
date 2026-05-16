const express = require('express');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');
const { hashPassword, verifyPassword, generateTokens, verifyToken, authMiddleware } = require('../services/authService');
const { sendNotification } = require('../services/telegramBot');
const supabase = require('../services/supabase');

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const client = supabase.getClient();
    if (!client) return res.status(503).json({ error: 'Supabase not configured' });

    const passwordHash = hashPassword(password);
    const { data: user, error } = await client.from('users').insert({
      email, name: name || email.split('@')[0], password_hash: passwordHash,
    }).select('id, email, name, created_at').single();

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      throw error;
    }

    const tokens = generateTokens({ id: user.id, email: user.email });
    await sendNotification('👤 New User Registered', `${user.email} joined TrackInvest`);

    res.status(201).json({ success: true, user: { id: user.id, email: user.email, name: user.name }, ...tokens });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password, deviceName, deviceId } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const client = supabase.getClient();
    if (!client) return res.status(503).json({ error: 'Supabase not configured' });

    const { data: user } = await client.from('users').select('*').eq('email', email).single();
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const tokens = generateTokens({ id: user.id, email: user.email });

    if (deviceId) {
      await client.from('devices').upsert({
        user_id: user.id, device_name: deviceName || 'Unknown', device_id: deviceId,
        refresh_token: tokens.refreshToken, last_active: new Date().toISOString(),
      }, { onConflict: 'device_id' });
    }

    res.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      ...tokens,
    });
  } catch (err) { next(err); }
});

router.get('/profile', authMiddleware, async (req, res, next) => {
  try {
    const client = supabase.getClient();
    if (!client) return res.status(503).json({ error: 'Supabase not configured' });
    const { data: user } = await client.from('users').select('id, email, name, preferences, created_at').eq('id', req.user.id).single();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user });
  } catch (err) { next(err); }
});

router.put('/profile', authMiddleware, async (req, res, next) => {
  try {
    const client = supabase.getClient();
    if (!client) return res.status(503).json({ error: 'Supabase not configured' });
    const { name, preferences } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (preferences) updates.preferences = preferences;
    const { data: user } = await client.from('users').update(updates).eq('id', req.user.id).select('id, email, name, preferences').single();
    res.json({ success: true, user });
  } catch (err) { next(err); }
});

router.get('/devices', authMiddleware, async (req, res, next) => {
  try {
    const client = supabase.getClient();
    if (!client) return res.status(503).json({ error: 'Supabase not configured' });
    const { data: devices } = await client.from('devices').select('*').eq('user_id', req.user.id).order('last_active', { ascending: false });
    res.json({ success: true, devices: devices || [] });
  } catch (err) { next(err); }
});

router.delete('/devices/:id', authMiddleware, async (req, res, next) => {
  try {
    const client = supabase.getClient();
    if (!client) return res.status(503).json({ error: 'Supabase not configured' });
    await client.from('devices').delete().eq('id', req.params.id).eq('user_id', req.user.id);
    res.json({ success: true, message: 'Device removed' });
  } catch (err) { next(err); }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });
    const client = supabase.getClient();
    if (!client) return res.status(503).json({ error: 'Supabase not configured' });
    const { data: device } = await client.from('devices').select('user_id').eq('refresh_token', refreshToken).single();
    if (!device) return res.status(401).json({ error: 'Invalid refresh token' });
    const { data: user } = await client.from('users').select('id, email').eq('id', device.user_id).single();
    if (!user) return res.status(401).json({ error: 'User not found' });
    const tokens = generateTokens({ id: user.id, email: user.email });
    await client.from('devices').update({ refresh_token: tokens.refreshToken }).eq('refresh_token', refreshToken);
    res.json({ success: true, ...tokens });
  } catch (err) { next(err); }
});

module.exports = router;
