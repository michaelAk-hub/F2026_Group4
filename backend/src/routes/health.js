/**
 * GET /api/health
 *
 * A simple "is everything up?" check. Useful for the team, for the
 * hosting platform and for the frontend to show if the server is down.
 *
 * Example answer when everything works (HTTP 200):
 *   { "status": "ok", "database": "connected", "time": "2026-10-20T14:22:06.974Z" }
 * When the database is down it answers HTTP 503 with status "degraded".
 */
const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/', (req, res) => {
  // readyState 1 means Mongoose is connected (0 = disconnected,
  // 2 = connecting, 3 = disconnecting).
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'degraded',
    database: dbConnected ? 'connected' : 'disconnected',
    time: new Date().toISOString(), // UTC time of the answer
  });
});

module.exports = router;
