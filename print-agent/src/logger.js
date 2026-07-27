const fs = require('node:fs');
const path = require('node:path');

function dailyLogPath(logDir) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');

  return path.join(logDir, `print-agent-${y}${m}${d}.log`);
}

function createLogger(logDir) {
  fs.mkdirSync(logDir, { recursive: true });

  function log(message) {
    const line = `[${new Date().toISOString()}] ${message}`;
    console.log(line);
    fs.appendFileSync(dailyLogPath(logDir), `${line}\n`);
  }

  return { log };
}

module.exports = { createLogger, dailyLogPath };
