// Tests for the Account model (login details). Run with: npm test
const mongoose = require('mongoose');
const Account = require('../src/models/Account');
const { startTestDB, clearTestDB, stopTestDB } = require('./setup');

// A correct driver account we reuse in the tests
const account = {
  accountEmail: 'Maria@Example.com',
  accountPasswordHash: 'hashed-password',
  userID: new mongoose.Types.ObjectId(),
};

describe('Account model', () => {
  beforeAll(startTestDB);
  afterEach(clearTestDB);
  afterAll(stopTestDB);

  test('saves a valid account', async () => {
    const acc = await Account.create(account);
    expect(acc.accountEmail).toBe('maria@example.com'); // saved in lowercase
  });

  test('needs email and password', async () => {
    await expect(Account.create({ userID: account.userID })).rejects.toMatchObject({ name: 'ValidationError' });
  });

  test('rejects a wrong email', async () => {
    await expect(Account.create({ ...account, accountEmail: 'not-an-email' })).rejects.toThrow('Email is not valid');
  });

  test('needs a user or an administrator', async () => {
    await expect(Account.create({ accountEmail: 'a@b.com', accountPasswordHash: 'x' }))
      .rejects.toThrow('Account needs a user or an administrator');

    const admin = await Account.create({ accountEmail: 'admin@b.com', accountPasswordHash: 'x', administratorID: new mongoose.Types.ObjectId() });
    expect(admin.administratorID).toBeTruthy();
  });

  test('does not allow the same email twice', async () => {
    await Account.init(); // makes sure the unique email rule is ready
    await Account.create(account);
    await expect(Account.create(account)).rejects.toMatchObject({ code: 11000 });
  });

  test('does not show the password hash', async () => {
    const acc = await Account.create(account);
    expect(acc.toJSON().accountPasswordHash).toBeUndefined();

    const found = await Account.findOne({ accountEmail: 'maria@example.com' });
    expect(found.accountPasswordHash).toBeUndefined();
  });
});
