// Tests for cancelling a reservation and the refund record (DELETE /api/reservations/:id, task 5.4).
// Run with: npm test
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const ParkingSpot = require('../src/models/parkingSpot');
const Reservation = require('../src/models/reservation');
const Payment = require('../src/models/payment');
const { runReservationJob } = require('../src/services/reservationJob');
const { startTestDB, clearTestDB, stopTestDB } = require('./setup');

const HOUR = 60 * 60 * 1000;
const CARD = { cardName: 'Maria Driver', cardNumber: '4242 4242 4242 4242', expiry: '12/45', cvv: '123' };

const auth = (token) => ({ Authorization: 'Bearer ' + token });

// Register a driver and log in, like the frontend does. Returns the token.
async function loginDriver(email = 'maria@example.com') {
  await request(app).post('/api/auth/register').send({ name: 'Maria Driver', email, password: 'secret123', carNumber: 'KAB 123' });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
  return res.body.token;
}

// Reserve a spot for 2 hours (the amount is 4), starting in one hour unless another start is given
async function reserve(token, spotId, start = new Date(Date.now() + HOUR)) {
  const end = new Date(start.getTime() + 2 * HOUR);
  return request(app)
    .post('/api/reservations')
    .set(auth(token))
    .send({ spotId, startTime: start.toISOString(), endTime: end.toISOString() });
}

const pay = (token, reservationId) => request(app).post('/api/payments').set(auth(token)).send({ reservationId, ...CARD });
const confirm = (token, id) => request(app).post(`/api/reservations/${id}/confirm`).set(auth(token));
const cancel = (token, id) => request(app).delete(`/api/reservations/${id}`).set(auth(token));

describe('Cancel a reservation and refund', () => {
  let token;
  let spot;

  beforeAll(startTestDB);
  afterAll(stopTestDB);

  beforeEach(async () => {
    token = await loginDriver();
    spot = await ParkingSpot.create({ spotLocation: 'Lot A - Spot 07' });
  });
  afterEach(clearTestDB);

  // A reservation that is paid and confirmed
  async function paidReservation() {
    const reservation = (await reserve(token, spot.id)).body.reservation;
    expect((await pay(token, reservation.id)).status).toBe(200);
    expect((await confirm(token, reservation.id)).status).toBe(200);
    return reservation;
  }

  test('TC-G66: cancelling a paid reservation keeps it as Cancelled and records a full refund', async () => {
    const reservation = await paidReservation();

    const res = await cancel(token, reservation.id);

    expect(res.status).toBe(200);
    expect(res.body.refund.amount).toBe(4);
    expect(res.body.refund.cardLast4).toBe('4242');
    expect(res.body.refund.receiptId).toMatch(/^RCPT-/);

    const savedReservation = await Reservation.findById(reservation.id);
    expect(savedReservation.reservationStatus).toBe('Cancelled');

    const payment = await Payment.findById(reservation.paymentId);
    expect(payment.paymentStatus).toBe('Refunded');
    expect(payment.refundAmount).toBe(4);
    expect(payment.refundedAt).toBeInstanceOf(Date);
    expect(payment.receiptId).toBeDefined(); // the original receipt is kept
  });

  test('TC-G67: cancelling a reservation that was not paid deletes it, with nothing to refund', async () => {
    const reservation = (await reserve(token, spot.id)).body.reservation;

    const res = await cancel(token, reservation.id);

    expect(res.status).toBe(200);
    expect(res.body.refund).toBeUndefined();
    expect(await Reservation.findById(reservation.id)).toBeNull();
    expect(await Payment.findById(reservation.paymentId)).toBeNull();
  });

  test('TC-G68: a driver who paid but did not confirm yet is refunded too', async () => {
    const reservation = (await reserve(token, spot.id)).body.reservation;
    await pay(token, reservation.id); // paid, but the reservation is still Unpaid

    const res = await cancel(token, reservation.id);

    expect(res.status).toBe(200);
    expect((await Reservation.findById(reservation.id)).reservationStatus).toBe('Cancelled');
    expect((await Payment.findById(reservation.paymentId)).paymentStatus).toBe('Refunded');
  });

  test('TC-G69: a cancelled reservation does not make the spot Reserved when its time comes', async () => {
    const reservation = await paidReservation();
    // the reservation starts in 1 hour: the spot is free until then (BUG-02)
    expect((await ParkingSpot.findById(spot.id)).spotStatus).toBe('Available');

    await cancel(token, reservation.id);
    await runReservationJob(new Date(Date.now() + 2 * HOUR)); // the job runs when the start time has come

    expect((await ParkingSpot.findById(spot.id)).spotStatus).toBe('Available');
  });

  test('TC-G70: a reservation that has already started cannot be cancelled', async () => {
    const reservation = await paidReservation();
    await Reservation.updateOne({ _id: reservation.id }, { $set: { reservationStartTime: new Date(Date.now() - 60 * 1000) } });

    const res = await cancel(token, reservation.id);

    expect(res.status).toBe(409);
    expect((await Reservation.findById(reservation.id)).reservationStatus).toBe('Paid');
    expect((await Payment.findById(reservation.paymentId)).paymentStatus).toBe('Complete');
  });

  test('TC-G71: cancelling a second time gives 409 and does not refund again', async () => {
    const reservation = await paidReservation();
    expect((await cancel(token, reservation.id)).status).toBe(200);
    const firstRefund = (await Payment.findById(reservation.paymentId)).refundedAt.getTime();

    const second = await cancel(token, reservation.id);

    expect(second.status).toBe(409);
    expect((await Payment.findById(reservation.paymentId)).refundedAt.getTime()).toBe(firstRefund);
  });

  test('TC-G72: two cancels at the same moment: only one succeeds', async () => {
    const reservation = await paidReservation();

    const [a, b] = await Promise.all([cancel(token, reservation.id), cancel(token, reservation.id)]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((await Payment.findById(reservation.paymentId)).paymentStatus).toBe('Refunded');
  });

  test('TC-G73: a driver cannot cancel the reservation of another driver', async () => {
    const reservation = await paidReservation();
    const otherToken = await loginDriver('nikos@example.com');

    const res = await cancel(otherToken, reservation.id);

    expect(res.status).toBe(403);
    expect((await Reservation.findById(reservation.id)).reservationStatus).toBe('Paid');
    expect((await Payment.findById(reservation.paymentId)).paymentStatus).toBe('Complete');
  });

  test('TC-G74: an invalid or unknown reservation id gives 404', async () => {
    expect((await cancel(token, 'not-an-id')).status).toBe(404);
    expect((await cancel(token, '507f1f77bcf86cd799439011')).status).toBe(404);
  });

  test('TC-G75: without a token gives 401, an administrator gets 403 (RQ24)', async () => {
    const reservation = await paidReservation();

    const noToken = await request(app).delete(`/api/reservations/${reservation.id}`);
    expect(noToken.status).toBe(401);

    const adminToken = jwt.sign({ accountId: 'abc', role: 'admin' }, process.env.JWT_SECRET);
    expect((await cancel(adminToken, reservation.id)).status).toBe(403);
  });

  test('TC-G76: after the cancel, another driver can reserve the same time', async () => {
    const start = new Date(Date.now() + HOUR);
    const reservation = (await reserve(token, spot.id, start)).body.reservation;
    await pay(token, reservation.id);
    await confirm(token, reservation.id);
    const otherToken = await loginDriver('nikos@example.com');

    expect((await reserve(otherToken, spot.id, start)).status).toBe(409); // still taken

    await cancel(token, reservation.id);

    expect((await reserve(otherToken, spot.id, start)).status).toBe(201); // free again
  });

  test('TC-G77: a cancelled reservation can no longer be paid or confirmed', async () => {
    const reservation = await paidReservation();
    await cancel(token, reservation.id);

    const paid = await pay(token, reservation.id);
    expect(paid.status).toBe(409);
    expect(paid.body.message).toBe('This reservation was cancelled.');

    const confirmed = await confirm(token, reservation.id);
    expect(confirmed.status).toBe(409);
    expect((await Reservation.findById(reservation.id)).reservationStatus).toBe('Cancelled');
  });

  test('TC-G78: the driver still sees the cancelled reservation and the refund in the history (RQ13)', async () => {
    const reservation = await paidReservation();
    await cancel(token, reservation.id);

    const reservations = await request(app).get('/api/reservations/mine').set(auth(token));
    expect(reservations.body.reservations).toHaveLength(1);
    expect(reservations.body.reservations[0].reservationStatus).toBe('Cancelled');

    const payments = await request(app).get('/api/payments/mine').set(auth(token));
    expect(payments.body.payments).toHaveLength(1);
    expect(payments.body.payments[0].paymentStatus).toBe('Refunded');
    expect(payments.body.payments[0].reservationId).toBe(reservation.id);
  });

  test('TC-G79: the models accept the new statuses and still reject unknown ones', async () => {
    const refunded = await Payment.create({ paymentAmount: 4, paymentStatus: 'Refunded', refundAmount: 4, refundedAt: new Date() });
    expect(refunded.paymentStatus).toBe('Refunded');
    await expect(Payment.create({ paymentStatus: 'Banana' })).rejects.toMatchObject({ name: 'ValidationError' });

    const error = new Reservation({ reservationStatus: 'Cancelled' }).validateSync();
    expect(error.errors.reservationStatus).toBeUndefined(); // only the other required fields are missing
    const bad = new Reservation({ reservationStatus: 'Banana' }).validateSync();
    expect(bad.errors.reservationStatus).toBeDefined();
  });
});
