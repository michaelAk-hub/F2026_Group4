const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

// GET /api/health -> shows if the server and the database are working
router.get('/', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1; // 1 = connected

  if (dbConnected) {
    res.status(200).json({ status: 'ok', database: 'connected' });
  } else {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

module.exports = router;
