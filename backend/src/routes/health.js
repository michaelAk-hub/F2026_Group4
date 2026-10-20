const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

// GET /api/health - quick check that the API and the database are up.
router.get('/', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'degraded',
    database: dbConnected ? 'connected' : 'disconnected',
    time: new Date().toISOString(),
  });
});

module.exports = router;
