const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildSumatraArgs,
  detectNewSpoolerJobId,
  parseGetPrintJobOutput,
  waitForSpecificJobToClear,
} = require('../src/print');

test('buildSumatraArgs assembles a silent print-to command', () => {
  const { command, args } = buildSumatraArgs(
    'C:\\Users\\Administrator\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe',
    'Brother MFC-T4500DW',
    'C:\\temp\\job-123.pdf',
  );

  assert.equal(command, 'C:\\Users\\Administrator\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe');
  assert.deepEqual(args, ['-print-to', 'Brother MFC-T4500DW', '-silent', 'C:\\temp\\job-123.pdf']);
});

test('parseGetPrintJobOutput returns [] for empty output', () => {
  assert.deepEqual(parseGetPrintJobOutput(''), []);
  assert.deepEqual(parseGetPrintJobOutput('   '), []);
});

test('parseGetPrintJobOutput returns [] for unparseable output instead of throwing', () => {
  assert.deepEqual(parseGetPrintJobOutput('not json'), []);
});

test('parseGetPrintJobOutput normalizes a single PowerShell object (not wrapped in an array)', () => {
  const output = JSON.stringify({ Id: 7, JobStatus: 'Printing' });
  assert.deepEqual(parseGetPrintJobOutput(output), [{ id: 7, jobStatus: 'Printing' }]);
});

test('parseGetPrintJobOutput normalizes an array of PowerShell objects', () => {
  const output = JSON.stringify([
    { Id: 1, JobStatus: 'Spooling' },
    { Id: 2, JobStatus: 'Printing' },
  ]);

  assert.deepEqual(parseGetPrintJobOutput(output), [
    { id: 1, jobStatus: 'Spooling' },
    { id: 2, jobStatus: 'Printing' },
  ]);
});

test('waitForSpecificJobToClear resolves completed:true once only that job id disappears, ignoring unrelated stuck jobs', async () => {
  let callCount = 0;
  const getJobs = async () => {
    callCount += 1;
    // job 999 is a permanently-stuck unrelated job (like the 25 stuck jobs found on the real
    // branch printer) that must never block completion — only job 42 (ours) matters.
    const stuckJobs = [{ id: 999, jobStatus: 'Error' }];
    return callCount < 3 ? [...stuckJobs, { id: 42, jobStatus: 'Printing' }] : stuckJobs;
  };

  const result = await waitForSpecificJobToClear({
    printerName: 'Brother MFC-T4500DW',
    jobId: 42,
    pollIntervalMs: 0,
    sleep: () => Promise.resolve(),
    getJobs,
  });

  assert.deepEqual(result, { completed: true });
  assert.equal(callCount, 3);
});

test('waitForSpecificJobToClear resolves completed:false when the timeout elapses', async () => {
  const getJobs = async () => [{ id: 42, jobStatus: 'Printing' }];
  let now = 0;
  const originalNow = Date.now;
  Date.now = () => now;

  try {
    const result = await waitForSpecificJobToClear({
      printerName: 'Brother MFC-T4500DW',
      jobId: 42,
      timeoutMs: 100,
      pollIntervalMs: 10,
      sleep: () => {
        now += 20;
        return Promise.resolve();
      },
      getJobs,
    });

    assert.deepEqual(result, { completed: false });
  } finally {
    Date.now = originalNow;
  }
});

test('waitForSpecificJobToClear never blocks on a permanently-stuck unrelated job', async () => {
  // Regression test for the real-world scenario: the printer queue has 25 jobs stuck since
  // 2020 that never clear. Waiting for "the whole queue empty" would time out forever;
  // waiting for a specific job id must succeed as soon as *that* job is gone.
  const getJobs = async () => [{ id: 999, jobStatus: 'Error' }];

  const result = await waitForSpecificJobToClear({
    printerName: 'Brother MFC-T4500DW',
    jobId: 42,
    timeoutMs: 50,
    pollIntervalMs: 0,
    sleep: () => Promise.resolve(),
    getJobs,
  });

  assert.deepEqual(result, { completed: true });
});

test('detectNewSpoolerJobId returns the id of a job that appeared after the snapshot', async () => {
  let callCount = 0;
  const getJobs = async () => {
    callCount += 1;
    const stuckJobs = [{ id: 999, jobStatus: 'Error' }];
    return callCount < 2 ? stuckJobs : [...stuckJobs, { id: 42, jobStatus: 'Printing' }];
  };

  const jobId = await detectNewSpoolerJobId({
    printerName: 'Brother MFC-T4500DW',
    beforeJobIds: new Set([999]),
    pollIntervalMs: 0,
    sleep: () => Promise.resolve(),
    getJobs,
  });

  assert.equal(jobId, 42);
});

test('detectNewSpoolerJobId returns null when no new job ever appears before the detection window elapses', async () => {
  const getJobs = async () => [{ id: 999, jobStatus: 'Error' }];
  let now = 0;
  const originalNow = Date.now;
  Date.now = () => now;

  try {
    const jobId = await detectNewSpoolerJobId({
      printerName: 'Brother MFC-T4500DW',
      beforeJobIds: new Set([999]),
      detectTimeoutMs: 40,
      pollIntervalMs: 10,
      sleep: () => {
        now += 20;
        return Promise.resolve();
      },
      getJobs,
    });

    assert.equal(jobId, null);
  } finally {
    Date.now = originalNow;
  }
});
