const { query } = require('../pool');
const { notFound } = require('../../utils/apiError');

function executor(client) {
  return client || { query };
}

function mapGeneratedFile(row) {
  return {
    id: row.id,
    processingRecordId: row.processing_record_id || '',
    batchId: row.batch_id || '',
    uploadId: row.upload_id || '',
    fileKind: row.file_kind,
    filename: row.filename,
    mimeType: row.mime_type || '',
    storageProvider: row.storage_provider,
    storagePath: row.storage_path || '',
    downloadUrl: row.download_url || '',
    viewUrl: row.view_url || '',
    fileSizeBytes: row.file_size_bytes || 0,
    checksumSha256: row.checksum_sha256 || '',
    legacyDriveFileId: row.legacy_drive_file_id || '',
    legacyDriveFileUrl: row.legacy_drive_file_url || '',
    metadata: row.metadata || {},
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

async function createGeneratedFile(file, client = null) {
  const db = executor(client);
  const result = await db.query(
    `
      INSERT INTO generated_files (
        processing_record_id,
        batch_id,
        upload_id,
        file_kind,
        filename,
        mime_type,
        storage_provider,
        storage_path,
        download_url,
        view_url,
        file_size_bytes,
        checksum_sha256,
        legacy_drive_file_id,
        legacy_drive_file_url,
        legacy_google_mime_type,
        metadata,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17)
      RETURNING *
    `,
    [
      file.processingRecordId || null,
      file.batchId || null,
      file.uploadId || null,
      file.fileKind,
      file.filename,
      file.mimeType || null,
      file.storageProvider || 'local',
      file.storagePath || null,
      file.downloadUrl || null,
      file.viewUrl || null,
      file.fileSizeBytes || null,
      file.checksumSha256 || null,
      file.legacyDriveFileId || null,
      file.legacyDriveFileUrl || null,
      file.legacyGoogleMimeType || null,
      JSON.stringify(file.metadata || {}),
      file.expiresAt || null,
    ],
  );

  return mapGeneratedFile(result.rows[0]);
}

async function getGeneratedFileById(id, client = null) {
  const db = executor(client);
  const result = await db.query('SELECT * FROM generated_files WHERE id = $1', [id]);

  if (!result.rows.length) {
    throw notFound(`Generated file not found for id: ${id}`);
  }

  return mapGeneratedFile(result.rows[0]);
}

async function updateGeneratedFile(id, patch, client = null) {
  const db = executor(client);
  const result = await db.query(
    `
      UPDATE generated_files
      SET
        processing_record_id = COALESCE($2, processing_record_id),
        download_url = COALESCE($3, download_url),
        view_url = COALESCE($4, view_url),
        storage_path = COALESCE($5, storage_path),
        file_size_bytes = COALESCE($6, file_size_bytes),
        checksum_sha256 = COALESCE($7, checksum_sha256),
        metadata = COALESCE($8::jsonb, metadata)
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      patch.processingRecordId || null,
      patch.downloadUrl || null,
      patch.viewUrl || null,
      patch.storagePath || null,
      patch.fileSizeBytes || null,
      patch.checksumSha256 || null,
      patch.metadata ? JSON.stringify(patch.metadata) : null,
    ],
  );

  return mapGeneratedFile(result.rows[0]);
}

module.exports = {
  createGeneratedFile,
  getGeneratedFileById,
  mapGeneratedFile,
  updateGeneratedFile,
};
