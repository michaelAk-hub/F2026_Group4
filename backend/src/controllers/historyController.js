// History of the logged-in driver (Member 5, Week 5) - RQ13: a driver sees ONLY their own data.
// GET /api/reservations/mine  and  GET /api/payments/mine  (used by the My Reservations page)
// The driver is always the one in the login token, never an id sent by the browser.
const Account = require('../models/Account');
const Reservation = require('../models/reservation');
const Payment = require('../models/payment');

// Payment fields that are safe to send. The full card number and the CVV are never stored (C07).
const PAYMENT_FIELDS = 'paymentAmount paymentStatus paymentMethod receiptId cardLast4 createdAt updatedAt';

// The driver (user) id of the logged-in account
async function myUserId(req) {
  const account = await Account.findById(req.user.accountId);
  return account ? account.userID : null;
}

// GET /api/reservations/mine
// The field names are the ones of the database, as the My Reservations page reads them:
// reservationStartTime, reservationEndTime, reservationStatus, parkingSpotID.spotLocation, paymentID.paymentAmount
async function myReservations(req, res) {
  const userId = await myUserId(req);
  if (!userId) {
    return res.json({ reservations: [] });
  }

  const reservations = await Reservation.find({ userID: userId })
    .select('-userID -__v')
    .sort({ reservationStartTime: -1 }) // newest first
    .populate('parkingSpotID', 'spotLocation')
    .populate('paymentID', PAYMENT_FIELDS)
    .lean();

  res.json({ reservations });
}

// GET /api/payments/mine
// A payment has no user id: it belongs to the driver through the reservation that links to it.
async function myPayments(req, res) {
  const userId = await myUserId(req);
  if (!userId) {
    return res.json({ payments: [] });
  }

  const reservations = await Reservation.find({ userID: userId }).select('paymentID').lean();
  const reservationOf = new Map(reservations.map((r) => [String(r.paymentID), r._id]));

  const payments = await Payment.find({ _id: { $in: [...reservationOf.keys()] } })
    .select(PAYMENT_FIELDS)
    .sort({ createdAt: -1 }) // newest first
    .lean();

  res.json({
    payments: payments.map((p) => ({ ...p, reservationId: reservationOf.get(String(p._id)) })),
  });
}

module.exports = { myReservations, myPayments };
