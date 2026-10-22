// Tests for the Account model (login details). Run with: npm test
const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert');
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
  before(startTestDB);
  afterEach(clearTestDB);
  after(stopTestDB);

  it('saves a valid account', async () => {
    const acc = await Account.create(account);
    assert.strictEqual(acc.accountEmail, 'maria@example.com'); // saved in lowercase
  });

  it('needs email and password', async () => {
    await assert.rejects(Account.create({ userID: account.userID }), { name: 'ValidationError' });
  });

  it('rejects a wrong email', async () => {
    await assert.rejects(Account.create({ ...account, accountEmail: 'not-an-email' }), /Email is not valid/);
  });

  it('needs a user or an administrator', async () => {
    await assert.rejects(
      Account.create({ accountEmail: 'a@b.com', accountPasswordHash: 'x' }),
      /Account needs a user or an administrator/
    );

    const admin = await Account.create({ accountEmail: 'admin@b.com', accountPasswordHash: 'x', administratorID: new mongoose.Types.ObjectId() });
    assert.ok(admin.administratorID);
  });

  it('does not allow the same email twice', async () => {
    await Account.init(); // makes sure the unique email rule is ready
    await Account.create(account);
    await assert.rejects(Account.create(account), { code: 11000 });
  });

  it('does not show the password hash', async () => {
    const acc = await Account.create(account);
    assert.strictEqual(acc.toJSON().accountPasswordHash, undefined);

    const found = await Account.findOne({ accountEmail: 'maria@example.com' });
    assert.strictEqual(found.accountPasswordHash, undefined);
  });
});
