const express = require('express');
const appProcessingRecordRoutes = require('./appProcessingRecordRoutes');
const bootstrapRoutes = require('./bootstrapRoutes');
const fileRoutes = require('./fileRoutes');
const healthRoutes = require('./healthRoutes');
const processingRecordRoutes = require('./processingRecordRoutes');
const workbookRoutes = require('./workbookRoutes');

const router = express.Router();

router.use('/bootstrap', bootstrapRoutes);
router.use('/files', fileRoutes);
router.use('/health', healthRoutes);
router.use('/app/processing-records', appProcessingRecordRoutes);
router.use('/processing-records', processingRecordRoutes);
router.use('/workbooks', workbookRoutes);

module.exports = router;
