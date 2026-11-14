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

// /api/me, /api/reservations/mine and /api/payments/mine (Member 5, week 5).
// The two history routes are added BEFORE /reservations and /payments of Members 3 and 4.
const { requireAuth, requireRole } = require('../middleware/auth');
const { myReservations, myPayments } = require('../controllers/historyController');
router.use('/me', require('./me'));
router.get('/reservations/mine', requireAuth, requireRole('driver'), myReservations);
router.get('/payments/mine', requireAuth, requireRole('driver'), myPayments);

// /api/reservations (Member 3, week 4)
router.use('/reservations', require('./reservations'));

// /api/payments (Member 4, week 4)
router.use('/payments', require('./payments'));

module.exports = router;
