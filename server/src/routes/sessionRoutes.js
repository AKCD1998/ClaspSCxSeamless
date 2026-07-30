const express = require('express');
const { getSession, login, logout } = require('../controllers/sessionController');

// Exempted from appAuth via EXEMPT_PATHS in middleware/appAuth.js — this is how a client
// without a session first obtains one.
const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/', getSession);

module.exports = router;
