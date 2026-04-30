const fs = require('node:fs/promises');
const path = require('node:path');
const { closePool, getClient } = require('./pool');

const seedsDir = path.resolve(__dirname, '../../db/seeds');
const force = process.argv.includes('--force');

async function ensureSeedTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_seeds (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function listSqlFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();
}

async function getAppliedSeeds(client) {
  const result = await client.query('SELECT filename FROM schema_seeds');
  return new Set(result.rows.map((row) => row.filename));
}

async function run() {
  const client = await getClient();

  try {
    await ensureSeedTable(client);

    const applied = await getAppliedSeeds(client);
    const files = await listSqlFiles(seedsDir);

    for (const filename of files) {
      if (applied.has(filename) && !force) {
        console.log(`Skipping already-applied seed: ${filename}`);
        continue;
      }

      const filePath = path.join(seedsDir, filename);
      const sql = await fs.readFile(filePath, 'utf8');

      console.log(`${applied.has(filename) ? 'Reapplying' : 'Applying'} seed: ${filename}`);
      await client.query(sql);
      await client.query(
        `
          INSERT INTO schema_seeds (filename, applied_at)
          VALUES ($1, now())
          ON CONFLICT (filename) DO UPDATE SET applied_at = EXCLUDED.applied_at
        `,
        [filename],
      );
    }

    console.log('Seeds complete.');
  } finally {
    client.release();
    await closePool();
  }
}

run().catch((error) => {
  console.error('Seed failed.');
  console.error(error);
  process.exitCode = 1;
});
