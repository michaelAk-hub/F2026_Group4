// Tests for how sensor messages change the database (src/services/sensorService.js).
// Run with: npm test
const mongoose = require('mongoose');
const ParkingSpot = require('../src/models/parkingSpot');
const Sensor = require('../src/models/sensor');
const Reservation = require('../src/models/reservation');
const Violation = require('../src/models/violation');
const Notification = require('../src/models/notification');
const violationService = require('../src/services/violationService');
const { handleMessage, sensorBackgroundCheck } = require('../src/services/sensorService');
const { startTestDB, clearTestDB, stopTestDB } = require('./setup');

const NOW = Date.now();
const THRESHOLD = 1000;

// Helpers: send a message like the sensor would
const sendStatus = (spot, status) =>
  handleMessage(`parking/spots/${spot._id}/status`, JSON.stringify({ status }));
const sendAvailability = (spot, text) =>
  handleMessage(`parking/spots/${spot._id}/availability`, text);

// A spot with one sensor, like the seed script creates
async function createSpotWithSensor(spotStatus = 'Available', lastSeen = undefined, sensorStatus = 'Unavailable')
{
  const spot = await ParkingSpot.create({ spotLocation: 'Lot A - Spot 01', spotStatus });
  await Sensor.create({ sensorAvailability: sensorStatus, sensorLastSeen: lastSeen, parkingSpotID: spot._id });
  return spot;
}

const statusOf = async (spot) => (await ParkingSpot.findById(spot._id)).spotStatus;
const sensorOf = (spot) => Sensor.findOne({ parkingSpotID: spot._id });

describe('Sensor messages', () =>
{
  beforeAll(() => startTestDB());
  afterAll(() => stopTestDB());

  beforeEach(() => {
    // Keep the test output clean (the service logs every change)
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () =>
  {
    jest.restoreAllMocks();
    await clearTestDB();
  });

  test('TC-SENSOR-01: Occupied makes the spot Taken, free makes it Available again', async () =>
  {
    const spot = await createSpotWithSensor();

    await sendStatus(spot, 'occupied');
    expect(await statusOf(spot)).toBe('Taken');

    await sendStatus(spot, 'free');
    expect(await statusOf(spot)).toBe('Available');
  });

  test('TC-SENSOR-02: A reserved spot stays Reserved while the sensor says free', async () =>
  {
    const spot = await createSpotWithSensor('Reserved');
    await sendStatus(spot, 'free');
    expect(await statusOf(spot)).toBe('Reserved');
  });

  test('TC-SENSOR-03: A spot goes back to Reserved if the car leaves during a reservation', async () =>
  {
    const spot = await createSpotWithSensor('Taken');
    const now = Date.now();
    await Reservation.create({
      reservationStartTime: new Date(now - 60 * 60 * 1000),
      reservationEndTime: new Date(now + 60 * 60 * 1000),
      reservationStatus: 'Paid',
      userID: new mongoose.Types.ObjectId(),
      parkingSpotID: spot._id,
      paymentID: new mongoose.Types.ObjectId(),
    });

    await sendStatus(spot, 'free');
    expect(await statusOf(spot)).toBe('Reserved');
  });

  test('TC-SENSOR-04: A status message marks the sensor Available and sets sensorLastSeen', async () =>
  {
    const spot = await createSpotWithSensor();
    const before = Date.now();
    await sendStatus(spot, 'free');

    const sensor = await sensorOf(spot);
    expect(sensor.sensorAvailability).toBe('Available');
    expect(sensor.sensorLastSeen.getTime()).toBeGreaterThanOrEqual(before);
  });

  test('TC-SENSOR-05: Offline marks the sensor Unavailable but keeps the spot status', async () =>
  {
    const spot = await createSpotWithSensor();
    await sendStatus(spot, 'occupied');

    await sendAvailability(spot, 'offline');
    expect((await sensorOf(spot)).sensorAvailability).toBe('Unavailable');
    expect(await statusOf(spot)).toBe('Taken');

    await sendAvailability(spot, 'online');
    expect((await sensorOf(spot)).sensorAvailability).toBe('Available');
  });

  test('TC-SENSOR-06: Offline does not change sensorLastSeen', async () =>
  {
    const spot = await createSpotWithSensor();
    await sendStatus(spot, 'free');
    const seen = (await sensorOf(spot)).sensorLastSeen.getTime();

    await sendAvailability(spot, 'offline');
    expect((await sensorOf(spot)).sensorLastSeen.getTime()).toBe(seen);
  });

  test('TC-SENSOR-07: Bad messages are ignored without crashing or changing anything', async () =>
  {
    const spot = await createSpotWithSensor();
    const base = `parking/spots/${spot._id}`;

    await handleMessage(`${base}/status`, 'not json');
    await handleMessage(`${base}/status`, JSON.stringify({ status: 'banana' }));
    await handleMessage('parking/spots/not-an-id/status', JSON.stringify({ status: 'occupied' }));
    await handleMessage(
      `parking/spots/${new mongoose.Types.ObjectId()}/status`,
      JSON.stringify({ status: 'occupied' })
    );
    await handleMessage('some/other/topic', 'hello'); // not ours: ignored silently

    expect(await statusOf(spot)).toBe('Available');
    expect(console.warn).toHaveBeenCalledTimes(4); // one warning per bad message
  });

  test('TC-SENSOR-08: Sensor being exactly at the threshold remains Available', async() =>
  {
    const spot = await createSpotWithSensor('Available',new Date(NOW - THRESHOLD), 'Available');

    const changes = await sensorBackgroundCheck(NOW, THRESHOLD);

    expect(changes).toBe(0);
    expect((await sensorOf(spot)).sensorAvailability).toBe('Available');
  });

  test('TC-SENSOR-09: Sensor being over the threshold becomes Unavailable', async() =>
  {
    const spot = await createSpotWithSensor('Available',new Date(NOW - THRESHOLD - 1000), 'Available');

    const changes = await sensorBackgroundCheck(NOW, THRESHOLD);

    expect(changes).toBe(1);
    expect((await sensorOf(spot)).sensorAvailability).toBe('Unavailable');
  });

  test('TC-SENSOR-10: A recently seen sensor is untouched', async() =>
  {
    const spot = await createSpotWithSensor('Available', new Date(NOW - 100), 'Available');

    const changes = await sensorBackgroundCheck(NOW, THRESHOLD);

    expect(changes).toBe(0);
    expect((await sensorOf(spot)).sensorAvailability).toBe('Available');
  });
  
  test('TC-SENSOR-11: An already-Unavailable sensor isn\'t counted', async() =>
  {
    const spot = await createSpotWithSensor('Available',new Date(NOW - THRESHOLD - 1000), 'Unavailable');

    const changes = await sensorBackgroundCheck(NOW, THRESHOLD);

    expect(changes).toBe(0);
    expect((await sensorOf(spot)).sensorAvailability).toBe('Unavailable');
  });
  
  test('TC-SENSOR-12: The spot\'s status isn\'t changed', async() =>
  {
    const spot = await createSpotWithSensor('Taken', new Date(NOW - THRESHOLD - 1000), 'Available');

    await sensorBackgroundCheck(NOW, THRESHOLD);

    expect((await statusOf(spot))).toBe('Taken');
    expect((await sensorOf(spot)).sensorAvailability).toBe('Unavailable');
  });
  
  test('TC-SENSOR-13: Recovery after a message', async() =>
  {
      const spot = await createSpotWithSensor('Available',new Date(NOW - THRESHOLD - 1000), 'Available');

      await sensorBackgroundCheck(NOW, THRESHOLD);
      expect((await sensorOf(spot)).sensorAvailability).toBe('Unavailable');

      await sendStatus(spot, 'free');
      expect((await sensorOf(spot)).sensorAvailability).toBe('Available');
      expect((await sensorOf(spot)).sensorLastSeen.getTime()).toBeGreaterThanOrEqual(NOW);
  });

  // ################ Violations: a car parks without a paid reservation (task 6.4, RQ14 / RQ15) ################

  // A reservation that is running right now (one hour before and one hour after)
  const createActiveReservation = (spot, reservationStatus, userID = new mongoose.Types.ObjectId()) =>
    Reservation.create({
      reservationStartTime: new Date(Date.now() - 60 * 60 * 1000),
      reservationEndTime: new Date(Date.now() + 60 * 60 * 1000),
      reservationStatus,
      userID,
      parkingSpotID: spot._id,
      paymentID: new mongoose.Types.ObjectId(),
    });

  test('TC-SENSOR-14: A car in a spot with no reservation creates an Unreserved parking violation', async () =>
  {
    const spot = await createSpotWithSensor();

    await sendStatus(spot, 'occupied');

    const violations = await Violation.find();
    expect(violations).toHaveLength(1);
    expect(violations[0].violationType).toBe('Unreserved parking');
    expect(violations[0].violationStatus).toBe('Unresolved');
    expect(String(violations[0].parkingSpotID)).toBe(String(spot._id));
  });

  test('TC-SENSOR-15: Repeated "occupied" messages (heartbeats) give only one violation', async () =>
  {
    const spot = await createSpotWithSensor();

    await sendStatus(spot, 'occupied');
    await sendStatus(spot, 'occupied');
    await sendStatus(spot, 'occupied');

    expect(await Violation.countDocuments()).toBe(1);
  });

  test('TC-SENSOR-16: A car that leaves and comes back while the violation is open adds no second one', async () =>
  {
    const spot = await createSpotWithSensor();

    await sendStatus(spot, 'occupied');
    await sendStatus(spot, 'free');
    await sendStatus(spot, 'occupied');

    expect(await Violation.countDocuments()).toBe(1);
  });

  test('TC-SENSOR-17: A car in a spot with an active Paid reservation gives no violation', async () =>
  {
    const spot = await createSpotWithSensor('Reserved');
    await createActiveReservation(spot, 'Paid');

    await sendStatus(spot, 'occupied');

    expect(await statusOf(spot)).toBe('Taken');
    expect(await Violation.countDocuments()).toBe(0);
  });

  test('TC-SENSOR-18: A car in a spot with an active Unpaid reservation gives a violation and notifies that driver', async () =>
  {
    const spot = await createSpotWithSensor();
    const userID = new mongoose.Types.ObjectId();
    await createActiveReservation(spot, 'Unpaid', userID);

    await sendStatus(spot, 'occupied');

    const violation = await Violation.findOne();
    expect(violation.violationType).toBe('Unpaid reservation');
    expect(String(violation.userID)).toBe(String(userID));

    const notifications = await Notification.find();
    expect(notifications).toHaveLength(1);
    expect(String(notifications[0].userID)).toBe(String(userID));
    expect(String(notifications[0].violationID)).toBe(String(violation._id));
  });

  test('TC-SENSOR-19: A "free" message gives no violation', async () =>
  {
    const spot = await createSpotWithSensor('Taken');

    await sendStatus(spot, 'free');

    expect(await Violation.countDocuments()).toBe(0);
  });

  test('TC-SENSOR-20: A problem in the violation check does not break the sensor message', async () =>
  {
    jest.spyOn(violationService, 'checkViolations').mockRejectedValue(new Error('fail'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const spot = await createSpotWithSensor();

    await sendStatus(spot, 'occupied'); // must not throw

    expect(await statusOf(spot)).toBe('Taken'); // the spot was still updated
    expect(console.error).toHaveBeenCalled(); // and the problem was logged
    expect(await Violation.countDocuments()).toBe(0);
  });
});
