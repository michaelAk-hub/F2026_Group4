// Tests for the User model rules. Run with: npm test
const User = require('../src/models/User');
const { startTestDB, clearTestDB, stopTestDB } = require('./setup');

// A correct driver we reuse in the tests
const driver = {
  userName: 'Maria Driver',
  userCarNumber: 'kab 123',
};

describe('User model', () => {
  beforeAll(startTestDB);
  afterEach(clearTestDB);
  afterAll(stopTestDB);

  test('saves a valid driver', async () => {
    const user = await User.create(driver);
    expect(user.userName).toBe('Maria Driver');
    expect(user.userCarNumber).toBe('KAB 123'); // saved in uppercase
  });

  test('needs a name', async () => {
    await expect(User.create({ userCarNumber: 'ABC 123' })).rejects.toThrow('Name is required');
  });

  test('driver needs a car number (RQ02)', async () => {
    await expect(User.create({ userName: 'No Car' })).rejects.toThrow('Car number is required');
  });

  test('rejects a car number that is too short', async () => {
    await expect(User.create({ ...driver, userCarNumber: 'AB1' })).rejects.toMatchObject({ name: 'ValidationError' });
  });
});
