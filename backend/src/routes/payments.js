const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { payReservation } = require('../controllers/paymentController');

const router = express.Router();

// Only logged in drivers can pay (RQ24)
router.use(requireAuth, requireRole('driver'));

// /api/payments
router.post('/', payReservation);

module.exports = router;
