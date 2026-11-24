// Creates an administrator account, so someone can log in to the admin dashboard.
// Run in the backend folder (uses MONGODB_URI from .env):
//   node scripts/seed-admin.js admin@parking.com Admin12345
// Running it again with the same email changes that administrator's password.
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { loadConfig } = require('../src/config/env');
const { connectDB } = require('../src/config/db');
const Account = require('../src/models/Account');
const Administrator = require('../src/models/administrator');

// The same password rule as the register form: 8+ characters and a number
function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8 && /\d/.test(password);
}

async function seedAdmin(email, password) {
  if (!email || !isValidPassword(password)) {
    throw new Error('Usage: node scripts/seed-admin.js <email> <password with 8+ characters and a number>');
  }
  const hash = await bcrypt.hash(password, 10);
  const existing = await Account.findOne({ accountEmail: email.trim().toLowerCase() });

  if (existing) {
    if (!existing.administratorID) {
      throw new Error('This email belongs to a driver account, use another email.');
    }
    existing.accountPasswordHash = hash;
    await existing.save();
    return 'updated';
  }
  const admin = await Administrator.create({});
  await Account.create({ accountEmail: email, accountPasswordHash: hash, administratorID: admin._id });
  return 'created';
}

if (require.main === module) {
  const [email, password] = process.argv.slice(2);
  (async () => {
    await connectDB(loadConfig().mongodbUri);
    const result = await seedAdmin(email, password);
    console.log(`Administrator ${email} ${result}. Log in on login.html to open the admin dashboard.`);
    await mongoose.disconnect();
  })().catch(async (err) => {
    console.error('Could not create the administrator:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  });
}

module.exports = { seedAdmin };
