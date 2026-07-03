const express = require('express');
const {
  createProcessingRecord,
  listProcessingRecords,
  markPrinted,
  markUnprinted,
  updateProcessingRecord,
  upsertProcessingRecordFromPreview,
} = require('../controllers/processingRecordController');
const { asyncHandler } = require('../utils/asyncHandler');
const { internalApiAuth } = require('../middleware/internalApiAuth');

const router = express.Router();

router.use(internalApiAuth);
router.post('/', asyncHandler(createProcessingRecord));
router.get('/', asyncHandler(listProcessingRecords));
router.post('/upsert-preview', asyncHandler(upsertProcessingRecordFromPreview));
router.patch('/:id', asyncHandler(updateProcessingRecord));
router.post('/:id/mark-printed', asyncHandler(markPrinted));
router.post('/:id/mark-unprinted', asyncHandler(markUnprinted));

module.exports = router;
