const fs = require('node:fs/promises');
const path = require('node:path');
const { closePool, getClient } = require('./pool');
const { ensureAppSchema, ensureMigrationTable } = require('./schemaBootstrap');
const { tables } = require('./identifiers');

const migrationsDir = path.resolve(__dirname, '../../db/migrations');

async function listSqlFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();
}

async function getAppliedMigrations(client) {
  const result = await client.query(`SELECT filename FROM ${tables.schemaMigrations}`);
  return new Set(result.rows.map((row) => row.filename));
}

async function run() {
  const client = await getClient();

  try {
    await ensureAppSchema(client);
    await ensureMigrationTable(client);

    const applied = await getAppliedMigrations(client);
    const files = await listSqlFiles(migrationsDir);

    for (const filename of files) {
      if (applied.has(filename)) {
        console.log(`Skipping already-applied migration: ${filename}`);
        continue;
      }

      const filePath = path.join(migrationsDir, filename);
      const sql = await fs.readFile(filePath, 'utf8');

      console.log(`Applying migration: ${filename}`);
      await client.query(sql);
      await client.query(
        `INSERT INTO ${tables.schemaMigrations} (filename) VALUES ($1)`,
        [filename],
      );
    }

    console.log('Migrations complete.');
  } finally {
    client.release();
    await closePool();
  }
}

run().catch((error) => {
  console.error('Migration failed.');
  console.error(error);
  process.exitCode = 1;
});
