const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { createReservation, confirmReservation } = require('../controllers/reservationController');
const { cancelReservation } = require('../controllers/cancelController');

const router = express.Router();

// Only logged in drivers can reserve (RQ08, RQ24)
router.use(requireAuth, requireRole('driver'));

// /api/reservations, /api/reservations/:id/confirm and DELETE /api/reservations/:id (cancel)
router.post('/', createReservation);
router.post('/:id/confirm', confirmReservation);
router.delete('/:id', cancelReservation); // task 5.4

module.exports = router;
