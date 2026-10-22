// Tests for the User model rules. Run with: npm test
const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert');
const User = require('../src/models/User');
const { startTestDB, clearTestDB, stopTestDB } = require('./setup');

// A correct driver we reuse in the tests
const driver = {
  name: 'Maria Driver',
  email: 'Maria@Example.com',
  passwordHash: 'hashed-password',
  carNumber: 'kab 123',
};

describe('User model', () => {
  before(startTestDB);
  afterEach(clearTestDB);
  after(stopTestDB);

  it('saves a valid driver', async () => {
    const user = await User.create(driver);
    assert.strictEqual(user.role, 'driver'); // default role
    assert.strictEqual(user.email, 'maria@example.com'); // saved in lowercase
    assert.strictEqual(user.carNumber, 'KAB 123'); // saved in uppercase
  });

  it('needs name, email and password', async () => {
    await assert.rejects(User.create({ carNumber: 'ABC 1' }), { name: 'ValidationError' });
  });

  it('driver needs a car number, admin does not (RQ02)', async () => {
    await assert.rejects(
      User.create({ name: 'No Car', email: 'nocar@example.com', passwordHash: 'x' }),
      /Car number is required/
    );

    const admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
    assert.strictEqual(admin.role, 'admin');
  });

  it('rejects a wrong email and a wrong role', async () => {
    await assert.rejects(User.create({ ...driver, email: 'not-an-email' }), /Email is not valid/);
    await assert.rejects(User.create({ ...driver, role: 'boss' }), { name: 'ValidationError' });
  });

  it('does not allow the same email twice', async () => {
    await User.init(); // makes sure the unique email rule is ready
    await User.create(driver);
    await assert.rejects(User.create(driver), { code: 11000 });
  });

  it('does not show the password hash', async () => {
    await User.create(driver);
    const user = await User.findOne({ email: 'maria@example.com' });
    assert.strictEqual(user.passwordHash, undefined);
  });
});
