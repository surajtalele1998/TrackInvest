const express = require('express');
const config = require('../config');
const authMiddleware = require('../middleware/auth');
const { limiter } = require('../middleware/rateLimiter');

const healthRoutes = require('./health');
const aiRoutes = require('./ai');
const marketRoutes = require('./market');
const portfolioRoutes = require('./portfolio');
const notificationRoutes = require('./notifications');
const syncRoutes = require('./sync');
const pdfRoutes = require('./pdf');
const authRoutes = require('./auth');
const exportRoutes = require('./export');
const newsRoutes = require('./news');
const viewsRoutes = require('./views');

const router = express.Router();

router.use('/v1/health', healthRoutes);
router.use('/v1/ai', authMiddleware, aiRoutes);
router.use('/v1/market', authMiddleware, marketRoutes);
router.use('/v1/portfolio', authMiddleware, portfolioRoutes);
router.use('/v1/notifications', authMiddleware, notificationRoutes);
router.use('/v1/sync', authMiddleware, syncRoutes);
router.use('/v1/pdf', authMiddleware, pdfRoutes);
router.use('/v1/auth', authRoutes);
router.use('/v1/export', exportRoutes);
router.use('/v1/news', newsRoutes);
router.use('/v1/views', viewsRoutes);

module.exports = router;
