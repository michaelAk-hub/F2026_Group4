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

// /api/reservations (Member 3, week 4)
router.use('/reservations', require('./reservations'));

// /api/payments (Member 4, week 4)
router.use('/payments', require('./payments'));

module.exports = router;
