const { Pool } = require('pg');
const { env } = require('../config/env');

function buildPoolConfig() {
  if (env.databaseUrl) {
    return {
      connectionString: env.databaseUrl,
    };
  }

  return {
    host: env.pg.host,
    port: env.pg.port,
    database: env.pg.database,
    user: env.pg.user,
    password: env.pg.password,
  };
}

const pool = new Pool(buildPoolConfig());

function query(text, params) {
  return pool.query(text, params);
}

function getClient() {
  return pool.connect();
}

async function closePool() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  getClient,
  closePool,
};
