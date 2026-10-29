const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Account = require('../models/Account');

// Same password rule as the register form: 8+ characters and at least one number
function isValidPassword(password) {
  if (!password || typeof password !== 'string') {
    return false; // no password was sent
  }
  const hasNumber = /[0-9]/.test(password); // true if there is at least one number
  return password.length >= 8 && hasNumber;
}

// The role is "admin" when the account belongs to an administrator, otherwise "driver"
function getRole(account) {
  return account.administratorID ? 'admin' : 'driver';
}

// Make the login token. It keeps the account id and the role
function makeToken(account) {
  return jwt.sign(
    { accountId: account._id, role: getRole(account) },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
}

// POST /api/auth/register
// Body from the register form: { name, email, password, confirmPassword, carNumber }
async function register(req, res) {
  const { name, email, password, confirmPassword, carNumber } = req.body;

  // Check the password here, because only its hash goes to the database
  if (!isValidPassword(password)) {
    return res.status(400).json({ message: 'Password needs 8+ characters and a number.' });
  }
  if (confirmPassword !== undefined && confirmPassword !== password) {
    return res.status(400).json({ message: 'Passwords do not match.' });
  }

  // RQ01: one account per email
  if (email && await Account.findOne({ accountEmail: email.trim().toLowerCase() })) {
    return res.status(409).json({ message: 'This email is already registered.' });
  }

  // First the driver (User), then the login details (Account)
  const user = await User.create({ userName: name, userCarNumber: carNumber });
  try {
    const hash = await bcrypt.hash(password, 10);
    const account = await Account.create({ accountEmail: email, accountPasswordHash: hash, userID: user._id });

    res.status(201).json({
      message: 'Account created',
      user: { id: user._id, name: user.userName, email: account.accountEmail, carNumber: user.userCarNumber },
    });
  } catch (err) {
    await User.deleteOne({ _id: user._id }); // do not keep a driver without an account
    throw err; // the error handler sends the message
  }
}

// POST /api/auth/login
// Body from the login form: { email, password }. Sends back { token, role }
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  // select('+...') because the hash is hidden by default (select: false)
  const account = await Account.findOne({ accountEmail: email.trim().toLowerCase() }).select('+accountPasswordHash');

  // Same message for wrong email and wrong password, so nobody can guess which emails exist
  if (!account || !(await bcrypt.compare(password, account.accountPasswordHash))) {
    return res.status(401).json({ message: 'Incorrect email or password.' });
  }

  res.json({ token: makeToken(account), role: getRole(account) });
}

module.exports = { register, login, isValidPassword };
