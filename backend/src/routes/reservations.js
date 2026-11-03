const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { createReservation, confirmReservation } = require('../controllers/reservationController');

const router = express.Router();

// Only logged in drivers can reserve (RQ08, RQ24)
router.use(requireAuth, requireRole('driver'));

// /api/reservations and /api/reservations/:id/confirm
router.post('/', createReservation);
router.post('/:id/confirm', confirmReservation);

module.exports = router;
