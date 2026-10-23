// When the URL does not exist
function notFound(req, res) {
  res.status(404).json({ error: 'Route not found: ' + req.originalUrl });
}

// Catches all errors and sends a simple JSON message
function errorHandler(err, req, res, next) {
  // Wrong or missing data (e.g. no email)
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: 'Validation failed', details: messages });
  }

  // Email already used (MongoDB duplicate error)
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Email already exists' });
  }

  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
}

module.exports = { notFound, errorHandler };
