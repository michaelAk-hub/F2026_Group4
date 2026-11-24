// Admin dashboard data (Member 5, Week 6): live occupancy and revenue - RQ18
// GET /api/admin/dashboard  (administrators only)
const Payment = require('../models/payment');
const Reservation = require('../models/reservation');
const { loadSpots } = require('./spotsController');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Revenue = payments that are paid (Complete). A cancelled reservation's payment becomes
// Refunded (Member 4), so its money is not counted any more. The time of a Complete payment
// is its updatedAt: the payment service sets Complete at the moment the driver pays.
async function revenueSince(since) {
  const [result] = await Payment.aggregate([
    { $match: { paymentStatus: 'Complete', updatedAt: { $gte: since } } },
    { $group: { _id: null, amount: { $sum: '$paymentAmount' }, count: { $sum: 1 } } },
  ]);
  return { amount: round(result ? result.amount : 0), payments: result ? result.count : 0 };
}

async function refundsSince(since) {
  const [result] = await Payment.aggregate([
    { $match: { paymentStatus: 'Refunded', refundedAt: { $gte: since } } },
    { $group: { _id: null, amount: { $sum: '$refundAmount' }, count: { $sum: 1 } } },
  ]);
  return { amount: round(result ? result.amount : 0), payments: result ? result.count : 0 };
}

// 2 decimals for euros (avoids 0.1 + 0.2 = 0.30000000000000004)
function round(value) {
  return Math.round(value * 100) / 100;
}

// The 5 newest paid payments, with the spot of their reservation
async function latestPayments() {
  const payments = await Payment.find({ paymentStatus: 'Complete' })
    .select('paymentAmount receiptId cardLast4 updatedAt')
    .sort({ updatedAt: -1 })
    .limit(5)
    .lean();
  const reservations = await Reservation.find({ paymentID: { $in: payments.map((p) => p._id) } })
    .select('paymentID parkingSpotID')
    .populate('parkingSpotID', 'spotLocation')
    .lean();
  const spotOf = new Map(reservations.map((r) => [String(r.paymentID), r.parkingSpotID ? r.parkingSpotID.spotLocation : null]));

  return payments.map((p) => ({
    receiptId: p.receiptId,
    amount: p.paymentAmount,
    paidAt: p.updatedAt,
    spot: spotOf.get(String(p._id)) || null,
  }));
}

// GET /api/admin/dashboard
async function adminDashboard(req, res) {
  const now = Date.now();
  const [spots, last24h, last7d, last30d, refunds30d, recent, activeNow] = await Promise.all([
    loadSpots(),
    revenueSince(new Date(now - DAY)),
    revenueSince(new Date(now - 7 * DAY)),
    revenueSince(new Date(now - 30 * DAY)),
    refundsSince(new Date(now - 30 * DAY)),
    latestPayments(),
    Reservation.countDocuments({
      reservationStatus: 'Paid',
      reservationStartTime: { $lte: new Date(now) },
      reservationEndTime: { $gt: new Date(now) },
    }),
  ]);

  const { total, counts } = spots;
  res.json({
    occupancy: {
      total,
      counts, // empty, occupied, reserved, unknown - the same as GET /api/spots
      // share of the spots that are taken by a car right now
      occupiedPercent: total > 0 ? Math.round((counts.occupied / total) * 100) : 0,
      activeReservations: activeNow,
    },
    revenue: { currency: 'EUR', last24h, last7d, last30d },
    refunds: { last30d: refunds30d },
    latestPayments: recent,
    generatedAt: new Date(now).toISOString(),
  });
}

module.exports = { adminDashboard };
