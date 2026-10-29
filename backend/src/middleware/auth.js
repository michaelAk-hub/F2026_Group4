const jwt = require('jsonwebtoken');

// Put this before a route that needs a logged in user.
// The frontend sends the token in the header: Authorization: Bearer <token>
function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''; // e.g. "Bearer abc.def.ghi"
  const parts = header.split(' ');                 // ["Bearer", "abc.def.ghi"]

  // no token was sent, so the user is not logged in
  if (parts[0] !== 'Bearer' || !parts[1]) {
    return res.status(401).json({ message: 'Please log in.' });
  }
  const token = parts[1];

  // jwt.verify throws an error if the token is wrong or too old
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { accountId, role }
    next();
  } catch (err) {
    res.status(401).json({ message: 'Login expired, please log in again.' });
  }
}

// RQ24: only this role can use the route, e.g. requireRole('admin')
// It gives back a middleware function, so we can write requireRole('admin') in a route.
// Use it after requireAuth, because it reads req.user
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ message: 'You are not allowed to open this page.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
