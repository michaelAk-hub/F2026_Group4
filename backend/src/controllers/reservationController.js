const mongoose = require('mongoose');
const Account = require('../models/Account');
const ParkingSpot = require('../models/parkingSpot');
const Reservation = require('../models/reservation');
const Payment = require('../models/payment');

// Same price as the reservation page: 2 hours = €4.00
const PRICE_PER_HOUR = 2;

// A reservation can be at most one day long
const MAX_HOURS = 24;

// and at least 15 minutes, so the price is never 0.00 (BUG-03)
const MIN_MINUTES = 15;

// Small helper: true if the text is a real date
function isValidDate(date) {
  return !isNaN(date.getTime());
}

// The token has the account id. The reservation needs the user (driver) id.
async function getUserId(req) {
  const account = await Account.findById(req.user.accountId);
  return account ? account.userID : null;
}

// What we send back for one reservation
function toJson(reservation, payment) {
  return {
    id: reservation._id,
    spotId: reservation.parkingSpotID,
    startTime: reservation.reservationStartTime,
    endTime: reservation.reservationEndTime,
    status: reservation.reservationStatus, // "Unpaid" or "Paid"
    paymentId: reservation.paymentID,
    amount: payment ? payment.paymentAmount : undefined,
  };
}

// POST /api/reservations
// Body from the reservation page: { spotId, startTime, endTime }
async function createReservation(req, res) {
  const { spotId, startTime, endTime } = req.body;

  // The spot must exist
  if (!mongoose.isValidObjectId(spotId)) {
    return res.status(400).json({ message: 'Please choose a parking spot.' });
  }
  const spot = await ParkingSpot.findById(spotId);
  if (!spot) {
    return res.status(404).json({ message: 'Parking spot not found.' });
  }

  // Check the times
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (!startTime || !endTime || !isValidDate(start) || !isValidDate(end)) {
    return res.status(400).json({ message: 'Please give a start and an end time.' });
  }
  if (end <= start) {
    return res.status(400).json({ message: 'The end time must be after the start time.' });
  }
  const oneMinuteAgo = Date.now() - 60 * 1000; // a small margin for slow clicks
  if (start.getTime() < oneMinuteAgo) {
    return res.status(400).json({ message: 'The start time is in the past.' });
  }
  const hours = (end - start) / (60 * 60 * 1000);
  if (hours > MAX_HOURS) {
    return res.status(400).json({ message: 'A reservation can be at most 24 hours.' });
  }
  if (hours * 60 < MIN_MINUTES) {
    return res.status(400).json({ message: 'A reservation must be at least 15 minutes.' });
  }

  // Double-booking protection: no other reservation of this spot may overlap these times.
  // Two time ranges overlap when one starts before the other ends.
  const overlap = await Reservation.exists({
    parkingSpotID: spot._id,
    reservationStartTime: { $lt: end },
    reservationEndTime: { $gt: start },
  });
  if (overlap) {
    return res.status(409).json({ message: 'This spot is already reserved for that time.' });
  }

  const userId = await getUserId(req);
  if (!userId) {
    return res.status(403).json({ message: 'Only drivers can reserve a spot.' });
  }

  // RQ09: the reservation starts as Unpaid with a payment that is not done yet.
  // It is confirmed only after the payment (see confirmReservation).
  const amount = Math.round(hours * PRICE_PER_HOUR * 100) / 100; // e.g. 2 hours -> 4
  const payment = await Payment.create({ paymentAmount: amount, paymentStatus: 'Incomplete' });
  try {
    const reservation = await Reservation.create({
      reservationStartTime: start,
      reservationEndTime: end,
      userID: userId,
      parkingSpotID: spot._id,
      paymentID: payment._id,
    });

    // Double-booking protection, second check (BUG-01): two drivers who reserve at the same
    // moment can both pass the first check before any of them is saved. So we look again
    // after saving: the reservation that was saved first keeps the time, the later one
    // (a bigger _id) is removed again and gets 409.
    const earlier = await Reservation.exists({
      _id: { $lt: reservation._id },
      parkingSpotID: spot._id,
      reservationStartTime: { $lt: end },
      reservationEndTime: { $gt: start },
    });
    if (earlier) {
      await Reservation.deleteOne({ _id: reservation._id });
      await Payment.deleteOne({ _id: payment._id });
      return res.status(409).json({ message: 'This spot is already reserved for that time.' });
    }

    res.status(201).json({
      message: 'Reservation created. Please pay to confirm it.',
      reservation: toJson(reservation, payment),
    });
  } catch (err) {
    await Payment.deleteOne({ _id: payment._id }); // do not keep a payment without a reservation
    throw err; // the error handler sends the message
  }
}

// POST /api/reservations/:id/confirm
// RQ09 pre-payment rule: a reservation is confirmed only when its payment is Complete
async function confirmReservation(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Reservation not found.' });
  }

  // A driver can confirm only their own reservation
  const userId = await getUserId(req);
  const reservation = await Reservation.findOne({ _id: req.params.id, userID: userId });
  if (!reservation) {
    return res.status(404).json({ message: 'Reservation not found.' });
  }

  const payment = await Payment.findById(reservation.paymentID);
  if (!payment || payment.paymentStatus !== 'Complete') {
    return res.status(402).json({ message: 'Please pay first to confirm the reservation.' });
  }

  reservation.reservationStatus = 'Paid';
  await reservation.save();

  // The spot is shown as reserved on the map, unless a car is already in it
  const spot = await ParkingSpot.findById(reservation.parkingSpotID);
  if (spot && spot.spotStatus === 'Available') {
    spot.spotStatus = 'Reserved';
    await spot.save();
  }

  res.json({ message: 'Reservation confirmed.', reservation: toJson(reservation, payment) });
}

module.exports = { createReservation, confirmReservation, PRICE_PER_HOUR };
