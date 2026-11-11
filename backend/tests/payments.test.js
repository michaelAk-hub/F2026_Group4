// Tests for the payment API (POST /api/payments). Run with: npm test
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const ParkingSpot = require('../src/models/parkingSpot');
const Reservation = require('../src/models/reservation');
const Payment = require('../src/models/payment');
const { DECLINED_TEST_CARDS } = require('../src/services/paymentService');
const { startTestDB, clearTestDB, stopTestDB } = require('./setup');

const HOUR = 60 * 60 * 1000;

// A card that works, exactly as the form sends it (the form shows the number with spaces)
const CARD = { cardName: 'Maria Driver', cardNumber: '4242 4242 4242 4242', expiry: '12/45', cvv: '123' };

// Register a driver and log in, like the frontend does. Returns the token.
async function loginDriver(email = 'maria@example.com') {
  await request(app).post('/api/auth/register').send({
    name: 'Maria Driver',
    email,
    password: 'secret123',
    carNumber: 'KAB 123',
  });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
  return res.body.token;
}

// Reserve a spot for 2 hours (so the payment amount is 4). Returns the reservation from the response.
async function reserve(token, spotId) {
  const start = new Date(Date.now() + HOUR);
  const end = new Date(start.getTime() + 2 * HOUR);
  const res = await request(app)
    .post('/api/reservations')
    .set('Authorization', 'Bearer ' + token)
    .send({ spotId, startTime: start.toISOString(), endTime: end.toISOString() });
  return res.body.reservation;
}

// Send the payment form for a reservation
function pay(token, reservationId, card = CARD) {
  const req = request(app).post('/api/payments');
  if (token) req.set('Authorization', 'Bearer ' + token);
  return req.send({ reservationId, ...card });
}

describe('Payment API', () => {
  let token;
  let spot;
  let reservation;

  beforeAll(startTestDB);
  afterAll(stopTestDB);

  beforeEach(async () => {
    token = await loginDriver();
    spot = await ParkingSpot.create({ spotLocation: 'Lot A - Spot 05' });
    reservation = await reserve(token, spot.id);
  });
  afterEach(clearTestDB);

  test('TC-G48: paying completes the payment and returns a receipt (RQ09, RQ11)', async () => {
    const res = await pay(token, reservation.id);

    expect(res.status).toBe(200);
    expect(res.body.receipt.receiptId).toMatch(/^RCPT-[0-9A-F]{10}$/);
    expect(res.body.receipt.reservationId).toBe(reservation.id);
    expect(res.body.receipt.paymentId).toBe(reservation.paymentId);
    expect(res.body.receipt.amount).toBe(4); // the amount calculated by the server, 2 hours x €2
    expect(res.body.receipt.cardLast4).toBe('4242');

    const payment = await Payment.findById(reservation.paymentId);
    expect(payment.paymentStatus).toBe('Complete');
    expect(payment.receiptId).toBe(res.body.receipt.receiptId);
    expect(payment.cardLast4).toBe('4242');
  });

  test('TC-G49: the full card number and the CVV are not in the database or in the response (PCI-DSS, C06)', async () => {
    const res = await pay(token, reservation.id);
    expect(res.status).toBe(200);

    // lean() gives the raw document exactly as it is stored
    const payment = await Payment.findById(reservation.paymentId).lean();
    const stored = JSON.stringify(payment);
    expect(stored).not.toContain('4242424242424242');
    expect(stored).not.toContain('4242 4242 4242 4242');
    for (const field of ['cardNumber', 'cvv', 'expiry', 'cardName']) {
      expect(Object.keys(payment)).not.toContain(field);
    }

    const storedReservation = JSON.stringify(await Reservation.findById(reservation.id).lean());
    expect(storedReservation).not.toContain('4242424242424242');

    const sent = JSON.stringify(res.body);
    expect(sent).not.toContain('4242424242424242');
    expect(sent.toLowerCase()).not.toContain('cvv');
  });

  test('TC-G50: a declined card gives 402 and the payment stays Incomplete (RQ27)', async () => {
    const res = await pay(token, reservation.id, { ...CARD, cardNumber: DECLINED_TEST_CARDS[0] });

    expect(res.status).toBe(402);
    expect(res.body.message).toBe('Your card was declined. Please try another card.');

    const payment = await Payment.findById(reservation.paymentId);
    expect(payment.paymentStatus).toBe('Incomplete');
    expect(payment.receiptId).toBeUndefined();
    expect(payment.cardLast4).toBeUndefined();

    // the driver can try again with another card
    const retry = await pay(token, reservation.id);
    expect(retry.status).toBe(200);
  });

  test('TC-G51: wrong card details give 400 and nothing is paid (RQ27)', async () => {
    const badNumber = await pay(token, reservation.id, { ...CARD, cardNumber: '4242 4242 4242 4241' });
    expect(badNumber.status).toBe(400);
    expect(badNumber.body.message).toBe('The card number is not valid.');

    const expired = await pay(token, reservation.id, { ...CARD, expiry: '01/20' });
    expect(expired.status).toBe(400);

    const empty = await pay(token, reservation.id, {});
    expect(empty.status).toBe(400);
    expect(empty.body.errors).toHaveLength(4);

    expect((await Payment.findById(reservation.paymentId)).paymentStatus).toBe('Incomplete');
  });

  test('TC-G52: without a token returns 401, an administrator gets 403 (RQ24)', async () => {
    const noToken = await pay(null, reservation.id);
    expect(noToken.status).toBe(401);

    const adminToken = jwt.sign({ accountId: 'abc', role: 'admin' }, process.env.JWT_SECRET);
    const admin = await pay(adminToken, reservation.id);
    expect(admin.status).toBe(403);
  });

  test('TC-G53: a driver cannot pay the reservation of another driver', async () => {
    const otherToken = await loginDriver('nikos@example.com');
    const res = await pay(otherToken, reservation.id);

    expect(res.status).toBe(404);
    expect((await Payment.findById(reservation.paymentId)).paymentStatus).toBe('Incomplete');
  });

  test('TC-G54: a missing or unknown reservation is rejected', async () => {
    const wrong = await pay(token, 'not-an-id');
    expect(wrong.status).toBe(400);

    const missing = await pay(token, undefined);
    expect(missing.status).toBe(400);

    const unknown = await pay(token, '507f1f77bcf86cd799439011');
    expect(unknown.status).toBe(404);
  });

  test('TC-G55: paying a second time gives 409 and keeps the first receipt', async () => {
    const first = await pay(token, reservation.id);
    expect(first.status).toBe(200);

    const second = await pay(token, reservation.id);
    expect(second.status).toBe(409);

    const payment = await Payment.findById(reservation.paymentId);
    expect(payment.receiptId).toBe(first.body.receipt.receiptId);
  });

  test('TC-G56: two payments at the same moment: only one succeeds', async () => {
    const [a, b] = await Promise.all([pay(token, reservation.id), pay(token, reservation.id)]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });

  test('TC-G57: reserve, pay, confirm: the whole flow works (RQ09, RQ10)', async () => {
    const paid = await pay(token, reservation.id);
    expect(paid.status).toBe(200);

    const confirmed = await request(app)
      .post(`/api/reservations/${reservation.id}/confirm`)
      .set('Authorization', 'Bearer ' + token);

    expect(confirmed.status).toBe(200);
    expect(confirmed.body.reservation.status).toBe('Paid');
    expect((await ParkingSpot.findById(spot.id)).spotStatus).toBe('Reserved');
  });

  test('TC-G58: confirm still gives 402 when the card was declined (RQ09)', async () => {
    await pay(token, reservation.id, { ...CARD, cardNumber: DECLINED_TEST_CARDS[0] });

    const confirmed = await request(app)
      .post(`/api/reservations/${reservation.id}/confirm`)
      .set('Authorization', 'Bearer ' + token);

    expect(confirmed.status).toBe(402);
    expect((await Reservation.findById(reservation.id)).reservationStatus).toBe('Unpaid');
  });
});
