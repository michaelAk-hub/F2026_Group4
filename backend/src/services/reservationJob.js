// Reservation expiry job (Member 3, Week 4).
// server.js runs it every minute. It frees parking spots in two cases:
//   1. Unpaid reservation: the driver has HOLD_MINUTES to pay (RQ09). After that
//      the reservation and its unfinished payment are deleted, so the time is free again.
//      A reservation whose payment is already Complete is kept (it only waits for confirm).
//   2. Paid reservation that has ended: the spot goes back to Available, unless a car
//      is still in it (Taken) or another paid reservation of the spot has not ended yet.
// It also frees a spot whose reservation was cancelled (deleted), because then
// no paid reservation keeps it Reserved any more.
// No timers in this file, so it is easy to test (see tests/reservationJob.test.js).

const ParkingSpot = require('../models/parkingSpot');
const Reservation = require('../models/reservation');
const Payment = require('../models/payment');

// How long an unpaid reservation keeps the time slot
const HOLD_MINUTES = 15;

// Step 1: delete unpaid reservations that are older than HOLD_MINUTES
async function removeUnpaid(now) {
  const limit = new Date(now.getTime() - HOLD_MINUTES * 60 * 1000);
  const old = await Reservation.find({ reservationStatus: 'Unpaid', createdAt: { $lt: limit } });

  let removed = 0;
  for (const reservation of old) {
    // Delete the payment only if it is still Incomplete. If the payment service of Member 4
    // made it Complete (the driver paid but did not confirm yet), nothing is deleted and the
    // reservation stays. The filter also works when the driver pays at the same moment.
    const result = await Payment.deleteOne({ _id: reservation.paymentID, paymentStatus: 'Incomplete' });
    const paid = result.deletedCount === 0 && await Payment.exists({ _id: reservation.paymentID });
    if (paid) continue;

    await Reservation.deleteOne({ _id: reservation._id });
    removed++;
  }
  return removed;
}

// Step 2: a Reserved spot goes back to Available when no paid reservation needs it any more
async function releaseSpots(now) {
  const reservedSpots = await ParkingSpot.find({ spotStatus: 'Reserved' });
  let released = 0;

  for (const spot of reservedSpots) {
    // a paid reservation that is running now or starts later keeps the spot Reserved
    const stillNeeded = await Reservation.exists({
      parkingSpotID: spot._id,
      reservationStatus: 'Paid',
      reservationEndTime: { $gt: now },
    });
    if (!stillNeeded) {
      spot.spotStatus = 'Available';
      await spot.save();
      released++;
    }
  }
  return released;
}

// Runs both steps. "now" can be given by the tests.
async function runReservationJob(now = new Date()) {
  const removed = await removeUnpaid(now);
  const released = await releaseSpots(now);
  return { removed, released };
}

module.exports = { runReservationJob, HOLD_MINUTES };
