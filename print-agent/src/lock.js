const fs = require('node:fs');

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function readLockPid(lockFilePath) {
  try {
    const content = fs.readFileSync(lockFilePath, 'utf8').trim();
    const pid = Number(content);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch (error) {
    return null;
  }
}

function writeLockFile(lockFilePath) {
  const fd = fs.openSync(lockFilePath, 'wx');
  fs.writeFileSync(fd, String(process.pid));
  fs.closeSync(fd);
}

function acquireLock(lockFilePath) {
  try {
    writeLockFile(lockFilePath);
    return true;
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }

  const existingPid = readLockPid(lockFilePath);

  if (existingPid !== null && isProcessRunning(existingPid)) {
    return false;
  }

  try {
    fs.unlinkSync(lockFilePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  try {
    writeLockFile(lockFilePath);
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') {
      return false;
    }

    throw error;
  }
}

function releaseLock(lockFilePath) {
  try {
    fs.unlinkSync(lockFilePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

module.exports = { acquireLock, isProcessRunning, readLockPid, releaseLock };
