const fs = require('node:fs/promises');
const { createStoredFileStream } = require('../services/fileStorageService');
const { getGeneratedFileById } = require('../db/repositories/generatedFileRepository');
const { notFound } = require('../utils/apiError');

async function downloadGeneratedFile(req, res) {
  const file = await getGeneratedFileById(req.params.id);

  if (!file.storagePath) {
    throw notFound(`Generated file has no local storage path for id: ${req.params.id}`);
  }

  try {
    await fs.access(file.storagePath);
  } catch (error) {
    throw notFound(`Generated file content not found for id: ${req.params.id}`);
  }

  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`);

  createStoredFileStream(file.storagePath).pipe(res);
}

module.exports = { downloadGeneratedFile };
