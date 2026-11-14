// Profile of the logged-in driver (Member 5, Week 5)
// GET /api/me  -> see my profile        PUT /api/me -> change my profile (RQ12)
// The driver is always the one in the login token, never an id sent by the browser.
const Account = require('../models/Account');
const User = require('../models/User');

// Fields the driver may change. Anything else in the body (password, role, ids...) is ignored.
const EDITABLE = ['name', 'email', 'carNumber', 'paymentMethod'];

// PCI-DSS (C07): the profile may keep a short description such as "Visa ending 4242",
// but never a card number. More than 4 digits in a row looks like a card number.
const LOOKS_LIKE_CARD_NUMBER = /\d{5,}/;

// Account and driver of the logged-in user (the account id is in the token)
async function findMe(req) {
  const account = await Account.findById(req.user.accountId);
  const user = account && account.userID ? await User.findById(account.userID) : null;
  return { account, user };
}

// What we send back. Never the password hash.
function toJson(account, user) {
  return {
    id: user._id,
    name: user.userName,
    email: account.accountEmail,
    carNumber: user.userCarNumber,
    paymentMethod: user.userPaymentMethod || null,
  };
}

// GET /api/me
async function getProfile(req, res) {
  const { account, user } = await findMe(req);
  if (!user) {
    return res.status(404).json({ message: 'Profile not found.' });
  }
  res.json({ user: toJson(account, user) });
}

// PUT /api/me
// Body from the profile page, all optional: { name, email, carNumber, paymentMethod }
async function updateProfile(req, res) {
  const body = req.body || {};
  if (!EDITABLE.some((field) => body[field] !== undefined)) {
    return res.status(400).json({ message: 'Nothing to update. Send name, email, carNumber or paymentMethod.' });
  }

  const { account, user } = await findMe(req);
  if (!user) {
    return res.status(404).json({ message: 'Profile not found.' });
  }

  if (body.paymentMethod !== undefined && body.paymentMethod !== null) {
    const method = String(body.paymentMethod).trim();
    if (LOOKS_LIKE_CARD_NUMBER.test(method.replace(/[\s-]/g, ''))) {
      return res.status(400).json({ message: 'Do not save a card number. Use a short name such as "Visa ending 4242".' });
    }
    if (method.length > 40) {
      return res.status(400).json({ message: 'The payment method can have at most 40 characters.' });
    }
  }

  // A new email must not belong to another account (same message as register)
  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    const other = await Account.findOne({ accountEmail: email, _id: { $ne: account._id } });
    if (other) {
      return res.status(409).json({ message: 'This email is already registered.' });
    }
    account.accountEmail = email;
  }
  if (body.name !== undefined) user.userName = body.name;
  if (body.carNumber !== undefined) user.userCarNumber = body.carNumber;
  if (body.paymentMethod !== undefined) {
    user.userPaymentMethod = body.paymentMethod === null ? undefined : String(body.paymentMethod).trim();
  }

  // Check BOTH documents before saving either, so a wrong value never saves half of the change.
  // A ValidationError goes to the error handler, which sends 400 with the message.
  await user.validate();
  await account.validate();
  await user.save();
  await account.save();

  res.json({ message: 'Profile updated.', user: toJson(account, user) });
}

module.exports = { getProfile, updateProfile };
