const express = require('express');
const { register, login } = require('../controllers/authController');

const router = express.Router();

// /api/auth/register and /api/auth/login
router.post('/register', register);
router.post('/login', login);

module.exports = router;
