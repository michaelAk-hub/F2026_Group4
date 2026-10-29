const express = require('express');
const { listSpots } = require('../controllers/spotsController');

const router = express.Router();

// GET /api/spots -> parking spots with their state (empty / occupied / reserved / unknown)
router.get('/', listSpots);

module.exports = router;
