// Tests for the User model rules. Run with: npm test
const User = require('../src/models/User');
const { startTestDB, clearTestDB, stopTestDB } = require('./setup');

// A correct driver we reuse in the tests
const driver = {
  userName: 'Maria Driver',
  userCarNumber: 'kab123',
};

describe('User model', () => {
  beforeAll(startTestDB);
  afterEach(clearTestDB);
  afterAll(stopTestDB);

  test('saves a valid driver', async () => {
    const user = await User.create(driver);
    expect(user.userName).toBe('Maria Driver');
    expect(user.userCarNumber).toBe('KAB123'); // saved in uppercase
  });

  test('needs a name', async () => {
    await expect(User.create({ userCarNumber: 'ABC 123' })).rejects.toThrow('Name is required');
  });

  test('driver needs a car number (RQ02)', async () => {
    await expect(User.create({ userName: 'No Car' })).rejects.toThrow('Car number is required');
  });

  test('car number must have 3-6 characters', async () => {
    await expect(User.create({ ...driver, userCarNumber: 'AB' })).rejects.toThrow('Car number must have 3-6 characters');
    await expect(User.create({ ...driver, userCarNumber: 'KAB 123' })).rejects.toThrow('Car number must have 3-6 characters'); // 7 with the space

    const oldPlate = await User.create({ ...driver, userCarNumber: 'ab1' });
    expect(oldPlate.userCarNumber).toBe('AB1');
  });
});
