const fs = require('node:fs');
const path = require('node:path');
const cors = require('cors');
const express = require('express');
const morgan = require('morgan');
const routes = require('./routes');
const { env } = require('./config/env');
const { errorHandler } = require('./middleware/errorHandler');
const { notFoundHandler } = require('./middleware/notFoundHandler');

const clientDistPath = path.resolve(__dirname, '../../client/dist');

function registerClientApp(app) {
  if (!fs.existsSync(clientDistPath)) {
    return;
  }

  app.use(express.static(clientDistPath));
  app.get(/^\/(?!api(?:\/|$)).*/, (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '30mb' }));
  app.use(express.urlencoded({ extended: true, limit: '30mb' }));
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

  app.use('/api', routes);
  registerClientApp(app);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
