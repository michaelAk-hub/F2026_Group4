const express = require('express');
const { listSpots } = require('../controllers/spotsController');
const { streamSpots } = require('../services/spotStream');

const router = express.Router();

// GET /api/spots -> parking spots with their state (empty / occupied / reserved / unknown)
router.get('/', listSpots);

// GET /api/spots/stream -> live updates of the spots (Server-Sent Events)
router.get('/stream', streamSpots);

module.exports = router;
