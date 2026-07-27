const { spawn } = require('node:child_process');

function buildSumatraArgs(sumatraPath, printerName, pdfFile) {
  return {
    command: sumatraPath,
    args: ['-print-to', printerName, '-silent', pdfFile],
  };
}

function parseGetPrintJobOutput(output) {
  const text = String(output || '').trim();

  if (!text) {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return [];
  }

  const rows = Array.isArray(parsed) ? parsed : [parsed];

  return rows.filter(Boolean).map((row) => ({
    id: row.Id ?? row.id ?? null,
    jobStatus: row.JobStatus ?? row.jobStatus ?? '',
  }));
}

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`PowerShell exited with code ${code}: ${stderr || stdout}`));
      }
    });
  });
}

async function getPrintJobs(printerName) {
  const escaped = String(printerName || '').replace(/'/g, "''");
  const script = `Get-PrintJob -PrinterName '${escaped}' | ConvertTo-Json -Compress`;
  const output = await runPowerShell(script);
  return parseGetPrintJobOutput(output);
}

function printPdf({ sumatraPath, printerName, pdfFile }) {
  const { command, args } = buildSumatraArgs(sumatraPath, printerName, pdfFile);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`SumatraPDF exited with code ${code}`));
      }
    });
  });
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The printer's queue can carry unrelated stuck/error jobs left over from other
// print history (confirmed on the real branch printer — 25 jobs stuck since 2020)
// that never clear, so waiting for the *whole* queue to empty would never succeed.
// Instead: snapshot job ids before printing, then find the id that's new afterward.
async function detectNewSpoolerJobId({
  printerName,
  beforeJobIds,
  detectTimeoutMs = 20000,
  pollIntervalMs = 2000,
  sleep = defaultSleep,
  getJobs = getPrintJobs,
}) {
  const deadline = Date.now() + detectTimeoutMs;

  while (Date.now() < deadline) {
    const jobs = await getJobs(printerName);
    const newJob = jobs.find((job) => job.id !== null && !beforeJobIds.has(job.id));

    if (newJob) {
      return newJob.id;
    }

    await sleep(pollIntervalMs);
  }

  return null;
}

async function waitForSpecificJobToClear({
  printerName,
  jobId,
  timeoutMs = 10 * 60 * 1000,
  pollIntervalMs = 5000,
  sleep = defaultSleep,
  getJobs = getPrintJobs,
}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const jobs = await getJobs(printerName);
    const stillThere = jobs.some((job) => job.id === jobId);

    if (!stillThere) {
      return { completed: true };
    }

    await sleep(pollIntervalMs);
  }

  return { completed: false };
}

module.exports = {
  buildSumatraArgs,
  detectNewSpoolerJobId,
  getPrintJobs,
  parseGetPrintJobOutput,
  printPdf,
  waitForSpecificJobToClear,
};
