// When the URL does not exist
function notFound(req, res) {
  res.status(404).json({ message: 'Route not found: ' + req.originalUrl });
}

// Catches all errors and sends a simple JSON message.
// The frontend (api.js) shows the "message" field to the user
function errorHandler(err, req, res, next) {
  // Wrong or missing data (e.g. no email)
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join(' '), details: messages });
  }

  // Email already used (MongoDB duplicate error)
  if (err.code === 11000) {
    return res.status(409).json({ message: 'This email is already registered.' });
  }

  console.error(err);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
}

module.exports = { notFound, errorHandler };
