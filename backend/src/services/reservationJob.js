// Reservation expiry job (Member 3, Week 5; with BUG-02: spots are reserved when the reservation starts).
// server.js runs it every minute. It makes a spot Reserved when a paid reservation starts,
// and it frees parking spots in two cases:
//   1. Unpaid reservation: the driver has HOLD_MINUTES to pay (RQ09). After that
//      the reservation and its unfinished payment are deleted, so the time is free again.
//      A reservation whose payment is already Complete is kept (it only waits for confirm).
//   2. Paid reservation that has ended: the spot goes back to Available, unless a car
//      is still in it (Taken) or another paid reservation of the spot is running now.
//      A paid reservation that starts later does not keep the spot Reserved (BUG-02).
// It also frees a spot whose reservation was cancelled (status "Cancelled", task of Member 4),
// because then no paid reservation keeps it Reserved any more.
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

// A paid reservation of the spot that is running at this moment (started, not ended)
function runningReservation(spotId, now) {
  return Reservation.exists({
    parkingSpotID: spotId,
    reservationStatus: 'Paid',
    reservationStartTime: { $lte: now },
    reservationEndTime: { $gt: now },
  });
}

// Step 2 (BUG-02): an Available spot becomes Reserved when its paid reservation starts.
// A Taken spot (car inside) is not changed; the sensor service handles it.
async function startReservations(now) {
  const freeSpots = await ParkingSpot.find({ spotStatus: 'Available' });
  let started = 0;

  for (const spot of freeSpots) {
    if (await runningReservation(spot._id, now)) {
      spot.spotStatus = 'Reserved';
      await spot.save();
      started++;
    }
  }
  return started;
}

// Step 3: a Reserved spot goes back to Available when no paid reservation is running on it
async function releaseSpots(now) {
  const reservedSpots = await ParkingSpot.find({ spotStatus: 'Reserved' });
  let released = 0;

  for (const spot of reservedSpots) {
    // only a paid reservation that is running now keeps the spot Reserved
    const stillNeeded = await runningReservation(spot._id, now);
    if (!stillNeeded) {
      spot.spotStatus = 'Available';
      await spot.save();
      released++;
    }
  }
  return released;
}

// Runs the 3 steps. "now" can be given by the tests.
async function runReservationJob(now = new Date()) {
  const removed = await removeUnpaid(now);
  const started = await startReservations(now);
  const released = await releaseSpots(now);
  return { removed, started, released };
}

module.exports = { runReservationJob, HOLD_MINUTES };
