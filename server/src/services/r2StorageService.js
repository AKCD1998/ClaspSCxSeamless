const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { env } = require('../config/env');

const r2Configured = !!(
  env.r2.endpoint &&
  env.r2.accessKeyId &&
  env.r2.secretAccessKey &&
  env.r2.bucket
);

const client = r2Configured
  ? new S3Client({
      region: 'auto',
      endpoint: env.r2.endpoint,
      forcePathStyle: env.r2.forcePathStyle,
      credentials: {
        accessKeyId: env.r2.accessKeyId,
        secretAccessKey: env.r2.secretAccessKey,
      },
    })
  : null;

function buildKey(kind, uniqueName) {
  const prefix = env.r2.keyPrefix.replace(/^\/+|\/+$/g, '');
  return `${prefix}/${kind}/${uniqueName}`;
}

async function uploadBuffer(key, buffer, mimeType) {
  await client.send(
    new PutObjectCommand({
      Bucket: env.r2.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType || 'application/octet-stream',
    }),
  );
}

async function getObjectStream(key) {
  const result = await client.send(new GetObjectCommand({ Bucket: env.r2.bucket, Key: key }));
  return result.Body;
}

async function getObjectBuffer(key) {
  const stream = await getObjectStream(key);
  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

module.exports = {
  buildKey,
  getObjectBuffer,
  getObjectStream,
  r2Configured,
  uploadBuffer,
};
