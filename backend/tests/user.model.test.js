// Tests for the User model rules. Run with: npm test
const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert');
const User = require('../src/models/User');
const { startTestDB, clearTestDB, stopTestDB } = require('./setup');

// A correct driver we reuse in the tests
const driver = {
  userName: 'Maria Driver',
  userCarNumber: 'kab 123',
};

describe('User model', () => {
  before(startTestDB);
  afterEach(clearTestDB);
  after(stopTestDB);

  it('saves a valid driver', async () => {
    const user = await User.create(driver);
    assert.strictEqual(user.userName, 'Maria Driver');
    assert.strictEqual(user.userCarNumber, 'KAB 123'); // saved in uppercase
  });

  it('needs a name', async () => {
    await assert.rejects(User.create({ userCarNumber: 'ABC 123' }), /Name is required/);
  });

  it('driver needs a car number (RQ02)', async () => {
    await assert.rejects(User.create({ userName: 'No Car' }), /Car number is required/);
  });

  it('rejects a car number that is too short', async () => {
    await assert.rejects(User.create({ ...driver, userCarNumber: 'AB1' }), { name: 'ValidationError' });
  });
});
