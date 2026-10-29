const express = require('express');
const healthRoutes = require('./health');
const authRoutes = require('./auth');

const router = express.Router();

// /api/health
router.use('/health', healthRoutes);

// /api/auth (register / login)
router.use('/auth', authRoutes);

// /api/spots (Member 5, week 2)
router.use('/spots', require('./spots'));

module.exports = router;
