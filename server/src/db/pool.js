const { Pool } = require('pg');
const { env } = require('../config/env');
const { searchPathOption } = require('./identifiers');

function buildPoolConfig() {
  const config = {
    options: `-c search_path=${searchPathOption}`,
  };

  if (env.databaseUrl) {
    return {
      ...config,
      connectionString: env.databaseUrl,
    };
  }

  return {
    ...config,
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
