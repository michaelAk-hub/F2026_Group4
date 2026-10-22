/**
 * Error handling middleware.
 *
 * Makes sure the frontend always gets a short JSON answer it can show
 * to the user, instead of an HTML error page or a crash.
 */

// Used when no route matched the URL, e.g. GET /api/does-not-exist.
function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Express recognises an error handler because it has 4 parameters
// (err, req, res, next). Any error thrown in a route ends up here.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // 400 Bad Request: data did not pass the model rules
  // (e.g. missing name, invalid email). We list every problem found.
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: 'Validation failed', details });
  }

  // 409 Conflict: MongoDB error 11000 = a unique value already exists
  // (e.g. registering with an email that is already used).
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Already exists', fields: Object.keys(err.keyValue || {}) });
  }

  // Anything else: use the status the code set, or 500 (server error).
  // For 500 we log the real error on the server but send a generic
  // message, so internal details are not shown to users.
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
}

module.exports = { notFound, errorHandler };
