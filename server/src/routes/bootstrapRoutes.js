const express = require('express');
const { getBootstrap } = require('../controllers/bootstrapController');

const router = express.Router();

router.get('/', getBootstrap);

module.exports = router;
