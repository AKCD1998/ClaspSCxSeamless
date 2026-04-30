const { env } = require('../config/env');
const { query } = require('../db/pool');

async function getHealth(req, res, next) {
  try {
    const startedAt = Date.now();
    let database = { status: 'ok' };

    try {
      await query('SELECT 1 AS ok');
      database.latencyMs = Date.now() - startedAt;
    } catch (error) {
      database = {
        status: 'unavailable',
        message: error.message,
      };
    }

    const statusCode = database.status === 'ok' || !env.healthFailOnDbError ? 200 : 503;

    res.status(statusCode).json({
      status: database.status === 'ok' ? 'ok' : 'degraded',
      service: 'seamless-x-api',
      database,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getHealth };
