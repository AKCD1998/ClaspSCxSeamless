const express = require('express');
const {
  listProcessingRecords,
  markPrinted,
  markUnprinted,
} = require('../controllers/processingRecordController');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(listProcessingRecords));
router.post('/:id/mark-printed', asyncHandler(markPrinted));
router.post('/:id/mark-unprinted', asyncHandler(markUnprinted));

module.exports = router;
