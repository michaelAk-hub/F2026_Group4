/**
 * The Express application: decides what happens to every HTTP request.
 *
 * It is kept separate from server.js (which connects to the database and
 * starts listening) so the tests can load the app without starting a
 * real server.
 *
 * A request passes through the middleware below from top to bottom.
 */
const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// CORS: lets the frontend (a different address, e.g. Vercel or
// localhost:3000) call this API from the browser.
app.use(cors({ origin: env.corsOrigin }));

// Reads JSON request bodies (e.g. register/login forms) into req.body.
// The 100kb limit blocks very large requests.
app.use(express.json({ limit: '100kb' }));

// All API endpoints start with /api, e.g. /api/health, /api/auth/login.
app.use('/api', routes);

// Reached only if no route above matched -> 404 "Route not found".
app.use(notFound);

// Last stop for any error thrown in a route -> clean JSON error response.
app.use(errorHandler);

module.exports = app;
