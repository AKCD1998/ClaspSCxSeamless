const express = require('express');
const { handleLineWebhook } = require('../controllers/lineWebhookController');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.post('/webhook', asyncHandler(handleLineWebhook));

module.exports = router;
