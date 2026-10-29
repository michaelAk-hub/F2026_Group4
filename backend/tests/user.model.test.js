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

  test('car number must be 3 letters and 3 numbers, same as the register form', async () => {
    const message = 'Use 3 letters and 3 numbers: ABC123 or ABC 123';
    await expect(User.create({ ...driver, userCarNumber: 'AB1' })).rejects.toThrow(message);      // too short
    await expect(User.create({ ...driver, userCarNumber: 'KAB 1234' })).rejects.toThrow(message); // 4 numbers
    await expect(User.create({ ...driver, userCarNumber: '123 KAB' })).rejects.toThrow(message);  // wrong order
    await expect(User.create({ ...driver, userCarNumber: 'KA  123' })).rejects.toThrow(message);  // 2 letters

    const noSpace = await User.create({ ...driver, userCarNumber: 'kab123' });
    expect(noSpace.userCarNumber).toBe('KAB123'); // the space is optional
  });
});
