const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { acquireLock, isProcessRunning, readLockPid, releaseLock } = require('../src/lock');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'print-agent-lock-test-'));
const lockFilePath = path.join(tempDir, 'agent.lock');

test.afterEach(() => {
  try {
    fs.unlinkSync(lockFilePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
});

test.after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('isProcessRunning returns true for the current process', () => {
  assert.equal(isProcessRunning(process.pid), true);
});

test('acquireLock succeeds when no lock file exists and writes its own PID', () => {
  const acquired = acquireLock(lockFilePath);

  assert.equal(acquired, true);
  assert.equal(readLockPid(lockFilePath), process.pid);
});

test('acquireLock fails when the lock is held by a currently running process', () => {
  fs.writeFileSync(lockFilePath, String(process.pid));

  const acquired = acquireLock(lockFilePath);

  assert.equal(acquired, false);
});

test('acquireLock reclaims a stale lock left by a process that has already exited', () => {
  const deadProcess = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
  const deadPid = deadProcess.pid;
  assert.equal(isProcessRunning(deadPid), false);

  fs.writeFileSync(lockFilePath, String(deadPid));

  const acquired = acquireLock(lockFilePath);

  assert.equal(acquired, true);
  assert.equal(readLockPid(lockFilePath), process.pid);
});

test('acquireLock reclaims a lock file with unreadable/corrupt PID content', () => {
  fs.writeFileSync(lockFilePath, 'not-a-pid');

  const acquired = acquireLock(lockFilePath);

  assert.equal(acquired, true);
});

test('releaseLock removes the lock file and tolerates it already being gone', () => {
  fs.writeFileSync(lockFilePath, String(process.pid));
  releaseLock(lockFilePath);

  assert.equal(fs.existsSync(lockFilePath), false);
  assert.doesNotThrow(() => releaseLock(lockFilePath));
});
