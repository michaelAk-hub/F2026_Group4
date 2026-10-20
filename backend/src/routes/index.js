const express = require('express');
const healthRoutes = require('./health');

const router = express.Router();

router.use('/health', healthRoutes);
// Week 2: router.use('/auth', require('./auth'));
// Week 3: router.use('/spots', require('./spots'));

module.exports = router;
