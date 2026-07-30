const express = require('express');
const agentRoutes = require('./agentRoutes');
const appProcessingRecordRoutes = require('./appProcessingRecordRoutes');
const bootstrapRoutes = require('./bootstrapRoutes');
const fileRoutes = require('./fileRoutes');
const healthRoutes = require('./healthRoutes');
const lineRoutes = require('./lineRoutes');
const processingRecordRoutes = require('./processingRecordRoutes');
const sessionRoutes = require('./sessionRoutes');
const workbookRoutes = require('./workbookRoutes');

const router = express.Router();

router.use('/agent', agentRoutes);
router.use('/bootstrap', bootstrapRoutes);
router.use('/files', fileRoutes);
router.use('/health', healthRoutes);
router.use('/line', lineRoutes);
router.use('/app/processing-records', appProcessingRecordRoutes);
router.use('/app/session', sessionRoutes);
router.use('/processing-records', processingRecordRoutes);
router.use('/workbooks', workbookRoutes);

module.exports = router;
