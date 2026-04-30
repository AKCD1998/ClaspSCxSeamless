const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createReadStream } = require('node:fs');
const { env } = require('../config/env');

function storageRoot() {
  return path.resolve(process.cwd(), env.storageDir || 'storage');
}

function safeSegment(value) {
  return String(value || 'file')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160) || 'file';
}

async function ensureDirectory(...segments) {
  const directory = path.join(storageRoot(), ...segments.map(safeSegment));
  await fs.mkdir(directory, { recursive: true });
  return directory;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function writeStoredFile(kind, filename, buffer) {
  const directory = await ensureDirectory(kind);
  const uniqueName = `${Date.now()}-${crypto.randomUUID()}-${safeSegment(filename)}`;
  const filePath = path.join(directory, uniqueName);

  await fs.writeFile(filePath, buffer);

  return {
    storagePath: filePath,
    fileSizeBytes: buffer.length,
    checksumSha256: sha256(buffer),
  };
}

async function readStoredFile(filePath) {
  return fs.readFile(filePath);
}

function createStoredFileStream(filePath) {
  return createReadStream(filePath);
}

function buildApiUrl(pathname) {
  const base = (env.publicBaseUrl || '').replace(/\/+$/, '');
  return base ? `${base}${pathname}` : pathname;
}

module.exports = {
  buildApiUrl,
  createStoredFileStream,
  readStoredFile,
  writeStoredFile,
};
