const { schemaSql, searchPathSql, tables } = require('./identifiers');

async function ensureAppSchema(client) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaSql}`);
  await client.query(`SET search_path TO ${searchPathSql}`);
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${tables.schemaMigrations} (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function ensureSeedTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${tables.schemaSeeds} (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

module.exports = {
  ensureAppSchema,
  ensureMigrationTable,
  ensureSeedTable,
};
