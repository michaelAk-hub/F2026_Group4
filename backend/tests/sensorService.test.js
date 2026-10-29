// Tests for how sensor messages change the database (src/services/sensorService.js).
// Run with: npm test
const mongoose = require('mongoose');
const ParkingSpot = require('../src/models/parkingSpot');
const Sensor = require('../src/models/sensor');
const Reservation = require('../src/models/reservation');
const { handleMessage } = require('../src/services/sensorService');
const { startTestDB, clearTestDB, stopTestDB } = require('./setup');

// Helpers: send a message like the sensor would
const sendStatus = (spot, status) =>
  handleMessage(`parking/spots/${spot._id}/status`, JSON.stringify({ status }));
const sendAvailability = (spot, text) =>
  handleMessage(`parking/spots/${spot._id}/availability`, text);

// A spot with one sensor, like the seed script creates
async function createSpotWithSensor(spotStatus = 'Available') {
  const spot = await ParkingSpot.create({ spotLocation: 'Lot A - Spot 01', spotStatus });
  await Sensor.create({ sensorAvailability: 'Unavailable', parkingSpotID: spot._id });
  return spot;
}

const statusOf = async (spot) => (await ParkingSpot.findById(spot._id)).spotStatus;
const sensorOf = (spot) => Sensor.findOne({ parkingSpotID: spot._id });

describe('Sensor messages', () => {
  beforeAll(() => startTestDB());
  afterAll(() => stopTestDB());

  beforeEach(() => {
    // Keep the test output clean (the service logs every change)
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await clearTestDB();
  });

  test('TC-SENSOR-01: occupied makes the spot Taken, free makes it Available again', async () => {
    const spot = await createSpotWithSensor();

    await sendStatus(spot, 'occupied');
    expect(await statusOf(spot)).toBe('Taken');

    await sendStatus(spot, 'free');
    expect(await statusOf(spot)).toBe('Available');
  });

  test('TC-SENSOR-02: a reserved spot stays Reserved while the sensor says free', async () => {
    const spot = await createSpotWithSensor('Reserved');
    await sendStatus(spot, 'free');
    expect(await statusOf(spot)).toBe('Reserved');
  });

  test('TC-SENSOR-03: a spot goes back to Reserved if the car leaves during a reservation', async () => {
    const spot = await createSpotWithSensor('Taken');
    const now = Date.now();
    await Reservation.create({
      reservationStartTime: new Date(now - 60 * 60 * 1000),
      reservationEndTime: new Date(now + 60 * 60 * 1000),
      userID: new mongoose.Types.ObjectId(),
      parkingSpotID: spot._id,
      paymentID: new mongoose.Types.ObjectId(),
    });

    await sendStatus(spot, 'free');
    expect(await statusOf(spot)).toBe('Reserved');
  });

  test('TC-SENSOR-04: a status message marks the sensor Available and sets sensorLastSeen', async () => {
    const spot = await createSpotWithSensor();
    const before = Date.now();
    await sendStatus(spot, 'free');

    const sensor = await sensorOf(spot);
    expect(sensor.sensorAvailability).toBe('Available');
    expect(sensor.sensorLastSeen.getTime()).toBeGreaterThanOrEqual(before);
  });

  test('TC-SENSOR-05: offline marks the sensor Unavailable but keeps the spot status', async () => {
    const spot = await createSpotWithSensor();
    await sendStatus(spot, 'occupied');

    await sendAvailability(spot, 'offline');
    expect((await sensorOf(spot)).sensorAvailability).toBe('Unavailable');
    expect(await statusOf(spot)).toBe('Taken');

    await sendAvailability(spot, 'online');
    expect((await sensorOf(spot)).sensorAvailability).toBe('Available');
  });

  test('TC-SENSOR-06: offline does not change sensorLastSeen', async () => {
    const spot = await createSpotWithSensor();
    await sendStatus(spot, 'free');
    const seen = (await sensorOf(spot)).sensorLastSeen.getTime();

    await sendAvailability(spot, 'offline');
    expect((await sensorOf(spot)).sensorLastSeen.getTime()).toBe(seen);
  });

  test('TC-SENSOR-07: bad messages are ignored without crashing or changing anything', async () => {
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
});
