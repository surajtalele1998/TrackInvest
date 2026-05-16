const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('../config');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/auth');
const { limiter } = require('../middleware/rateLimiter');
const errorHandler = require('../middleware/errorHandler');

const healthRoutes = require('./health');
const aiRoutes = require('./ai');
const marketRoutes = require('./market');
const portfolioRoutes = require('./portfolio');
const notificationRoutes = require('./notifications');
const syncRoutes = require('./sync');
const pdfRoutes = require('./pdf');

const router = express.Router();

router.use('/v1/health', healthRoutes);
router.use('/v1/ai', authMiddleware, aiRoutes);
router.use('/v1/market', authMiddleware, marketRoutes);
router.use('/v1/portfolio', authMiddleware, portfolioRoutes);
router.use('/v1/notifications', authMiddleware, notificationRoutes);
router.use('/v1/sync', authMiddleware, syncRoutes);
router.use('/v1/pdf', authMiddleware, pdfRoutes);

module.exports = router;
