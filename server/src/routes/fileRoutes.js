const express = require('express');
const { downloadGeneratedFile } = require('../controllers/fileController');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/:id/download', asyncHandler(downloadGeneratedFile));

module.exports = router;
