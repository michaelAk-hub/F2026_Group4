const mongoose = require('mongoose');
const Account = require('../models/Account');
const Reservation = require('../models/reservation');
const Payment = require('../models/payment');
const { validateCard, chargeCard } = require('../services/paymentService');

// The token has the account id. The reservation needs the user (driver) id.
// (Same helper as in reservationController.js)
async function getUserId(req) {
  const account = await Account.findById(req.user.accountId);
  return account ? account.userID : null;
}

// POST /api/payments
// Body from the payment form: { reservationId, cardName, cardNumber, expiry, cvv }
// It pays the Incomplete payment that was created together with the reservation.
// The amount is NOT sent by the browser: it is the amount the server calculated (RQ09).
//
// PCI-DSS: never print (console.log) the body of this request and never send it back.
async function payReservation(req, res) {
  const { reservationId, cardName, cardNumber, expiry, cvv } = req.body || {};

  if (!mongoose.isValidObjectId(reservationId)) {
    return res.status(400).json({ message: 'Please choose a reservation to pay for.' });
  }

  // A driver can pay only their own reservation (404 like confirmReservation, so we do not
  // tell other drivers that this reservation exists)
  const userId = await getUserId(req);
  const reservation = await Reservation.findOne({ _id: reservationId, userID: userId });
  if (!reservation) {
    return res.status(404).json({ message: 'Reservation not found.' });
  }

  const payment = await Payment.findById(reservation.paymentID);
  if (!payment) {
    return res.status(404).json({ message: 'Payment not found.' });
  }
  if (payment.paymentStatus === 'Complete') {
    return res.status(409).json({ message: 'This reservation is already paid.' });
  }

  // Check the card details (RQ27: clear messages for the driver)
  const problems = validateCard({ cardName, cardNumber, expiry, cvv });
  if (problems.length > 0) {
    return res.status(400).json({ message: problems[0], errors: problems });
  }

  // The mock bank. A declined card leaves the payment Incomplete, so the driver can try again.
  const result = chargeCard({ cardNumber }, payment.paymentAmount);
  if (!result.approved) {
    return res.status(402).json({ message: result.message });
  }

  // Save ONLY the receipt and the last 4 digits. The filter paymentStatus: 'Incomplete' makes this
  // safe when two requests arrive together: only one of them can change Incomplete -> Complete.
  const update = await Payment.updateOne(
    { _id: payment._id, paymentStatus: 'Incomplete' },
    { $set: { paymentStatus: 'Complete', paymentMethod: 'Card', receiptId: result.receiptId, cardLast4: result.cardLast4 } }
  );
  if (update.modifiedCount !== 1) {
    return res.status(409).json({ message: 'This reservation is already paid.' });
  }

  res.json({
    message: 'Payment successful.',
    receipt: {
      receiptId: result.receiptId,
      reservationId: reservation._id,
      paymentId: payment._id,
      amount: payment.paymentAmount,
      cardLast4: result.cardLast4,
    },
  });
}

module.exports = { payReservation };
