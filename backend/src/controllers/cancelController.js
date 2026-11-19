const mongoose = require('mongoose');
const Account = require('../models/Account');
const Reservation = require('../models/reservation');
const Payment = require('../models/payment');

// The token has the account id. The reservation needs the user (driver) id.
// (Same helper as in reservationController.js)
async function getUserId(req) {
  const account = await Account.findById(req.user.accountId);
  return account ? account.userID : null;
}

// DELETE /api/reservations/:id   (task 5.4)
//
//  - Not paid yet: the reservation and its unfinished payment are deleted (like the expiry job does).
//    Nothing was charged, so there is nothing to refund.
//  - Paid: the reservation becomes "Cancelled" and the payment becomes "Refunded" (full refund,
//    saved in refundedAt / refundAmount). Both are KEPT, so the driver still sees them in
//    their history. A paid reservation can be cancelled only before it starts.
//
// The spot is not changed here: reservationJob.js frees a Reserved spot within a minute,
// because it counts only "Paid" reservations.
async function cancelReservation(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Reservation not found.' });
  }

  const reservation = await Reservation.findById(req.params.id);
  if (!reservation) {
    return res.status(404).json({ message: 'Reservation not found.' });
  }

  // Only the owner can cancel
  const userId = await getUserId(req);
  if (!userId || String(reservation.userID) !== String(userId)) {
    return res.status(403).json({ message: 'You can only cancel your own reservations.' });
  }

  if (reservation.reservationStatus === 'Cancelled') {
    return res.status(409).json({ message: 'This reservation is already cancelled.' });
  }

  let payment = await Payment.findById(reservation.paymentID);
  if (!payment) {
    return res.status(404).json({ message: 'Payment not found.' });
  }

  // Case 1: not paid. The filter paymentStatus: 'Incomplete' keeps this safe if the driver pays
  // (or the expiry job deletes it) at the same moment: only one of them can win.
  if (payment.paymentStatus === 'Incomplete') {
    const removed = await Payment.deleteOne({ _id: payment._id, paymentStatus: 'Incomplete' });
    if (removed.deletedCount === 1) {
      await Reservation.deleteOne({ _id: reservation._id });
      return res.json({ message: 'Reservation cancelled. Nothing was charged.' });
    }
    // The payment changed while we worked: look again
    payment = await Payment.findById(reservation.paymentID);
    if (!payment) {
      return res.status(404).json({ message: 'Reservation not found.' }); // removed by the expiry job
    }
  }

  // Case 2: paid, so there is something to refund
  if (payment.paymentStatus !== 'Complete') {
    return res.status(409).json({ message: 'This reservation cannot be cancelled.' });
  }
  if (reservation.reservationStartTime <= new Date()) {
    return res.status(409).json({ message: 'This reservation has already started and can no longer be cancelled.' });
  }

  // Step 1: cancel the reservation. The filter makes sure only ONE request can do it,
  // so a double click or two requests together cannot refund twice (the loser gets 409).
  const previousStatus = reservation.reservationStatus;
  const cancelled = await Reservation.updateOne(
    { _id: reservation._id, reservationStatus: { $ne: 'Cancelled' } },
    { $set: { reservationStatus: 'Cancelled' } }
  );
  if (cancelled.modifiedCount !== 1) {
    return res.status(409).json({ message: 'This reservation is already cancelled.' });
  }

  // Step 2: the refund record (full amount, mock: no real money moves)
  const refundedAt = new Date();
  const refundAmount = payment.paymentAmount;
  try {
    await Payment.updateOne(
      { _id: payment._id, paymentStatus: 'Complete' },
      { $set: { paymentStatus: 'Refunded', refundedAt, refundAmount } }
    );
  } catch (err) {
    // do not leave a cancelled reservation with a payment that was not refunded
    await Reservation.updateOne({ _id: reservation._id }, { $set: { reservationStatus: previousStatus } });
    throw err; // the error handler sends the message
  }

  res.json({
    message: 'Reservation cancelled. Your payment was refunded.',
    refund: {
      amount: refundAmount,
      receiptId: payment.receiptId,
      cardLast4: payment.cardLast4,
      refundedAt,
    },
  });
}

module.exports = { cancelReservation };
