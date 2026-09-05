const assert = require('node:assert/strict');
const test = require('node:test');
const { buildSofficeArgs } = require('../src/convert');

test('buildSofficeArgs assembles a headless LibreOffice conversion command', () => {
  const { command, args } = buildSofficeArgs(
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\temp\\job-123.xlsx',
    'C:\\temp',
  );

  assert.equal(command, 'C:\\Program Files\\LibreOffice\\program\\soffice.exe');
  assert.deepEqual(args, [
    '--headless',
    '--convert-to',
    'pdf',
    '--outdir',
    'C:\\temp',
    'C:\\temp\\job-123.xlsx',
  ]);
});

test('runCommand resolves stdout for a zero-exit command', async () => {
  const { runCommand } = require('../src/convert');
  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'cmd.exe' : 'node';
  const args = isWindows ? ['/c', 'echo hello'] : ['-e', 'console.log("hello")'];

  const result = await runCommand(command, args);

  assert.match(result.stdout, /hello/);
  assert.equal(result.code, 0);
});

test('runCommand rejects for a non-zero exit code', async () => {
  const { runCommand } = require('../src/convert');
  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'cmd.exe' : 'node';
  const args = isWindows ? ['/c', 'exit 3'] : ['-e', 'process.exit(3)'];

  await assert.rejects(() => runCommand(command, args), /exited with code 3/);
});

test('runCommand terminates only its timed-out invocation', async () => {
  const { runCommand } = require('../src/convert');
  await assert.rejects(
    runCommand(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { timeout: 150 }),
    /timed out/,
  );
});
