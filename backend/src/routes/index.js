const express = require('express');
const healthRoutes = require('./health');

const router = express.Router();

// /api/health
router.use('/health', healthRoutes);

// /api/spots (Member 5, week 2)
router.use('/spots', require('./spots'));

// Next weeks:
// router.use('/auth', require('./auth'));   // week 2: register / login

module.exports = router;
