const express = require('express');
const healthRoutes = require('./health');

const router = express.Router();

// /api/health
router.use('/health', healthRoutes);

// Next weeks:
// router.use('/auth', require('./auth'));   // week 2: register / login
// router.use('/spots', require('./spots')); // week 3: parking spots

module.exports = router;
