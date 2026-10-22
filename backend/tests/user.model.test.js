/**
 * Tests for the User model rules (report RQ01-RQ03, RQ23-RQ24).
 * Each test saves users in the in-memory database and checks that valid
 * users are accepted and invalid ones are rejected with the right error.
 * Run with: npm test
 */
const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const User = require('../src/models/User');
const { startTestDB, clearTestDB, stopTestDB } = require('./setup');

const validDriver = {
  name: 'Maria Driver',
  email: 'Maria@Example.com',
  passwordHash: 'hashed-value',
  carNumber: 'kab 123',
};

describe('User model', () => {
  before(startTestDB);     // once, before all tests
  afterEach(clearTestDB);  // after every test: empty the database
  after(stopTestDB);       // once, at the end

  it('saves a valid driver with default role and normalised fields', async () => {
    const user = await User.create(validDriver);
    assert.equal(user.role, 'driver');
    assert.equal(user.email, 'maria@example.com');
    assert.equal(user.carNumber, 'KAB 123');
    assert.ok(user.createdAt instanceof Date);
  });

  it('requires name, email and password hash', async () => {
    await assert.rejects(User.create({ carNumber: 'ABC 1' }), (err) => {
      assert.equal(err.name, 'ValidationError');
      for (const field of ['name', 'email', 'passwordHash']) assert.ok(err.errors[field], `${field} should be required`);
      return true;
    });
  });

  it('requires a car number for drivers (RQ02) but not for admins', async () => {
    const { carNumber, ...noCar } = validDriver;
    await assert.rejects(User.create(noCar), /Car number is required/);

    const admin = await User.create({ ...noCar, role: 'admin' });
    assert.equal(admin.role, 'admin');
  });

  it('rejects an invalid email and an unknown role', async () => {
    await assert.rejects(User.create({ ...validDriver, email: 'not-an-email' }), /Email is not valid/);
    await assert.rejects(User.create({ ...validDriver, role: 'superuser' }), /role/);
  });

  it('does not allow two accounts with the same email', async () => {
    await User.init(); // make sure the unique index exists
    await User.create(validDriver);
    await assert.rejects(User.create({ ...validDriver, email: 'maria@example.com' }), { code: 11000 });
  });

  it('never exposes the password hash', async () => {
    await User.create(validDriver);
    const found = await User.findOne({ email: 'maria@example.com' });
    assert.equal(found.passwordHash, undefined);
    assert.equal(found.toJSON().passwordHash, undefined);

    const withHash = await User.findOne({ email: 'maria@example.com' }).select('+passwordHash');
    assert.equal(withHash.passwordHash, 'hashed-value');
    assert.equal(withHash.toJSON().passwordHash, undefined);
  });
});
