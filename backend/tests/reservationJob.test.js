// Tests for the reservation expiry job. Run with: npm test
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters';

const request = require('supertest');
const app = require('../src/app');
const ParkingSpot = require('../src/models/parkingSpot');
const Reservation = require('../src/models/reservation');
const Payment = require('../src/models/payment');
const User = require('../src/models/User');
const { runReservationJob, HOLD_MINUTES } = require('../src/services/reservationJob');
const { startTestDB, clearTestDB, stopTestDB } = require('./setup');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// A reservation saved straight in the database (the API cannot make past ones)
async function makeReservation(spot, user, { status, startIn, endIn, paid }) {
  const now = Date.now();
  const payment = await Payment.create({ paymentAmount: 4, paymentStatus: paid ? 'Complete' : 'Incomplete' });
  return Reservation.create({
    reservationStartTime: new Date(now + startIn),
    reservationEndTime: new Date(now + endIn),
    reservationStatus: status,
    userID: user._id,
    parkingSpotID: spot._id,
    paymentID: payment._id,
  });
}

describe('Reservation expiry job', () => {
  let spot;
  let user;

  beforeAll(startTestDB);
  afterAll(stopTestDB);

  beforeEach(async () => {
    spot = await ParkingSpot.create({ spotLocation: 'Lot A - Spot 07' });
    user = await User.create({ userName: 'Maria Driver', userCarNumber: 'KAB 123' });
  });
  afterEach(clearTestDB);

  test('TC-G29: an unpaid reservation older than the hold time is deleted with its payment', async () => {
    const reservation = await makeReservation(spot, user, { status: 'Unpaid', startIn: HOUR, endIn: 3 * HOUR });

    // run the job as if HOLD_MINUTES + 1 minutes have passed
    const result = await runReservationJob(new Date(Date.now() + (HOLD_MINUTES + 1) * MINUTE));

    expect(result.removed).toBe(1);
    expect(await Reservation.findById(reservation._id)).toBeNull();
    expect(await Payment.findById(reservation.paymentID)).toBeNull();
  });

  test('TC-G30: an unpaid reservation inside the hold time is kept', async () => {
    const reservation = await makeReservation(spot, user, { status: 'Unpaid', startIn: HOUR, endIn: 3 * HOUR });

    const result = await runReservationJob(new Date(Date.now() + 5 * MINUTE));

    expect(result.removed).toBe(0);
    expect(await Reservation.findById(reservation._id)).not.toBeNull();
  });

  test('TC-G31: a paid reservation is never deleted by the job', async () => {
    const reservation = await makeReservation(spot, user, { status: 'Paid', paid: true, startIn: HOUR, endIn: 3 * HOUR });

    await runReservationJob(new Date(Date.now() + 2 * HOUR));

    expect(await Reservation.findById(reservation._id)).not.toBeNull();
  });

  test('TC-G32: when a paid reservation has ended, the spot goes back to Available', async () => {
    spot.spotStatus = 'Reserved';
    await spot.save();
    await makeReservation(spot, user, { status: 'Paid', paid: true, startIn: -3 * HOUR, endIn: -1 * HOUR });

    const result = await runReservationJob();

    expect(result.released).toBe(1);
    expect((await ParkingSpot.findById(spot._id)).spotStatus).toBe('Available');
  });

  test('TC-G33: a spot stays Reserved while a paid reservation is running or starts later', async () => {
    spot.spotStatus = 'Reserved';
    await spot.save();
    const other = await ParkingSpot.create({ spotLocation: 'Lot A - Spot 08', spotStatus: 'Reserved' });
    await makeReservation(spot, user, { status: 'Paid', paid: true, startIn: -1 * HOUR, endIn: HOUR }); // running now
    await makeReservation(other, user, { status: 'Paid', paid: true, startIn: 2 * HOUR, endIn: 4 * HOUR }); // later

    const result = await runReservationJob();

    expect(result.released).toBe(0);
    expect((await ParkingSpot.findById(spot._id)).spotStatus).toBe('Reserved');
    expect((await ParkingSpot.findById(other._id)).spotStatus).toBe('Reserved');
  });

  test('TC-G34: a Taken spot (car inside) is not changed by the job', async () => {
    spot.spotStatus = 'Taken';
    await spot.save();
    await makeReservation(spot, user, { status: 'Paid', paid: true, startIn: -3 * HOUR, endIn: -1 * HOUR });

    await runReservationJob();

    expect((await ParkingSpot.findById(spot._id)).spotStatus).toBe('Taken');
  });

  test('TC-G35: a Reserved spot with no reservation (cancelled) is released', async () => {
    spot.spotStatus = 'Reserved';
    await spot.save();

    const result = await runReservationJob();

    expect(result.released).toBe(1);
    expect((await ParkingSpot.findById(spot._id)).spotStatus).toBe('Available');
  });

  test('TC-G36: after an unpaid reservation expires, another driver can reserve the same time (API)', async () => {
    // two drivers register and log in, like the frontend does
    const tokens = [];
    for (const email of ['anna@example.com', 'nikos@example.com']) {
      await request(app).post('/api/auth/register').send({ name: 'Driver', email, password: 'secret123', carNumber: 'KAB 999' });
      const login = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
      tokens.push(login.body.token);
    }
    const start = new Date(Date.now() + HOUR).toISOString();
    const end = new Date(Date.now() + 3 * HOUR).toISOString();
    const reserve = (token) => request(app)
      .post('/api/reservations')
      .set('Authorization', 'Bearer ' + token)
      .send({ spotId: spot.id, startTime: start, endTime: end });

    // the first driver reserves but does not pay
    expect((await reserve(tokens[0])).status).toBe(201);
    // while the hold time is running, the time is taken (double-booking protection)
    expect((await reserve(tokens[1])).status).toBe(409);

    // the hold time passes and the job runs
    await runReservationJob(new Date(Date.now() + (HOLD_MINUTES + 1) * MINUTE));

    // now the second driver can reserve the same time
    expect((await reserve(tokens[1])).status).toBe(201);
  });

  test('TC-G59: a reservation that is paid but not confirmed yet is not deleted', async () => {
    // the payment of Member 4 is Complete, but /confirm was not called yet (e.g. the page was closed)
    const reservation = await makeReservation(spot, user, { status: 'Unpaid', paid: true, startIn: HOUR, endIn: 3 * HOUR });

    const result = await runReservationJob(new Date(Date.now() + (HOLD_MINUTES + 1) * MINUTE));

    // the driver has paid, so the reservation and the payment must stay
    expect(result.removed).toBe(0);
    expect(await Reservation.findById(reservation._id)).not.toBeNull();
    expect(await Payment.findById(reservation.paymentID)).not.toBeNull();
  });
});
