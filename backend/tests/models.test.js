// Tests for the models of Member 4 (ParkingSpot, Sensor, Reservation, Payment,
// Violation, Report, Administrator). Run with: npm test
const ParkingSpot = require('../src/models/parkingSpot');
const Sensor = require('../src/models/sensor');
const Reservation = require('../src/models/reservation');
const Payment = require('../src/models/payment');
const Violation = require('../src/models/violation');
const Report = require('../src/models/report');
const Administrator = require('../src/models/administrator');
const User = require('../src/models/User');
const { startTestDB, clearTestDB, stopTestDB } = require('./setup');

describe('Parking models', () => {
  beforeAll(startTestDB);
  afterEach(clearTestDB);
  afterAll(stopTestDB);

  test('parking spot is Available by default', async () => {
    const spot = await ParkingSpot.create({ spotLocation: 'A1' });
    expect(spot.spotStatus).toBe('Available');
  });

  test('parking spot needs a location and a correct status', async () => {
    await expect(ParkingSpot.create({})).rejects.toMatchObject({ name: 'ValidationError' });
    await expect(ParkingSpot.create({ spotLocation: 'A1', spotStatus: 'Broken' })).rejects.toMatchObject({ name: 'ValidationError' });
  });

  test('sensor needs a parking spot', async () => {
    await expect(Sensor.create({ sensorAvailability: 'Available' })).rejects.toMatchObject({ name: 'ValidationError' });

    const spot = await ParkingSpot.create({ spotLocation: 'A1' });
    const sensor = await Sensor.create({ sensorAvailability: 'Available', parkingSpotID: spot._id });
    expect(String(sensor.parkingSpotID)).toBe(String(spot._id));
  });

  test('payment is Incomplete by default', async () => {
    const payment = await Payment.create({ paymentAmount: 2.5, paymentMethod: 'Card' });
    expect(payment.paymentStatus).toBe('Incomplete');
  });

  test('reservation links a user, a parking spot and a payment and starts Unpaid', async () => {
    const user = await User.create({ userName: 'Maria', userCarNumber: 'KAB 123' });
    const spot = await ParkingSpot.create({ spotLocation: 'A1' });
    const payment = await Payment.create({ paymentAmount: 2, paymentMethod: 'Card' });

    const res = await Reservation.create({
      reservationStartTime: new Date('2026-10-23T10:00'),
      reservationEndTime: new Date('2026-10-23T12:00'),
      userID: user._id,
      parkingSpotID: spot._id,
      paymentID: payment._id,
    });
    expect(res.reservationStatus).toBe('Unpaid');

    // read it back together with the user and the spot
    const found = await Reservation.findById(res._id).populate('userID').populate('parkingSpotID');
    expect(found.userID.userName).toBe('Maria');
    expect(found.parkingSpotID.spotLocation).toBe('A1');
  });

  test('reservation needs start and end time', async () => {
    await expect(Reservation.create({ reservationStatus: 'Unpaid' })).rejects.toMatchObject({ name: 'ValidationError' });
  });

  test('violation is Unresolved by default and needs a spot and an administrator', async () => {
    await expect(Violation.create({ violationType: 'No reservation' })).rejects.toMatchObject({ name: 'ValidationError' });

    const admin = await Administrator.create({});
    const spot = await ParkingSpot.create({ spotLocation: 'A1' });
    const violation = await Violation.create({ violationType: 'No reservation', parkingSpotID: spot._id, administratorID: admin._id });
    expect(violation.violationStatus).toBe('Unresolved');
  });

  test('report needs a generation date and an administrator', async () => {
    await expect(Report.create({ reportType: 'Monetary' })).rejects.toMatchObject({ name: 'ValidationError' });

    const admin = await Administrator.create({});
    const report = await Report.create({ reportGenerationDate: new Date(), administratorID: admin._id });
    expect(report.reportType).toBe('Monetary');
  });

  test('administrator finds its violations and reports', async () => {
    const admin = await Administrator.create({});
    const spot = await ParkingSpot.create({ spotLocation: 'A1' });
    await Violation.create({ violationType: 'No reservation', parkingSpotID: spot._id, administratorID: admin._id });
    await Report.create({ reportGenerationDate: new Date(), administratorID: admin._id });

    const found = await Administrator.findById(admin._id).populate('records').populate('generates');
    expect(found.records.length).toBe(1);
    expect(found.generates.length).toBe(1);
  });
});
