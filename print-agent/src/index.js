require('dotenv').config({ quiet: true });

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createApiClient } = require('./apiClient');
const { convertToPdf } = require('./convert');
const { detectNewSpoolerJobId, getPrintJobs, printPdf, waitForSpecificJobToClear } = require('./print');
const { createLogger } = require('./logger');
const { acquireLock, releaseLock } = require('./lock');

function readEnv() {
  return {
    apiBaseUrl: process.env.API_BASE_URL || '',
    internalApiToken: process.env.INTERNAL_API_TOKEN || '',
    printerName: process.env.PRINTER_NAME || '',
    agentHost: process.env.AGENT_HOST || os.hostname(),
    sofficePath: process.env.SOFFICE_PATH || '',
    sumatraPath: process.env.SUMATRA_PATH || '',
    pollLogDir: process.env.POLL_LOG_DIR || 'logs',
  };
}

async function processDocument(doc, { env, api, logger, dryRun, tempDir }) {
  if (dryRun) {
    logger.log(
      `[dry-run] Would create a print job for record ${doc.processingRecordId} (${doc.filename}), ` +
        `download from ${doc.downloadUrl}, convert to PDF, and print to "${env.printerName}".`,
    );
    return { ok: true };
  }

  logger.log(`Creating print job for record ${doc.processingRecordId} (${doc.filename})`);

  let job;
  try {
    job = await api.createPrintJob({
      processingRecordId: doc.processingRecordId,
      generatedFileId: doc.outputFileId,
      agentHost: env.agentHost,
      printerName: env.printerName,
    });
  } catch (error) {
    if (error.status === 409) {
      // Another caller (a concurrent poll, a stray duplicate agent instance, etc.) won the
      // race to claim/create this record's print job — this is not a failure, we must simply
      // not print it ourselves. Treating this as ok:true is what actually prevents the
      // double-print: the old code returned the winner's job here indistinguishably from
      // success, so every "loser" agent proceeded to download and physically print anyway.
      logger.log(`Record ${doc.processingRecordId} is already owned by another print job — skipping.`);
      return { ok: true };
    }

    logger.log(`Failed to create a print job for record ${doc.processingRecordId}: ${error.message}`);
    return { ok: false };
  }

  try {
    await api.updatePrintJob(job.id, { status: 'downloading' });

    const xlsxPath = path.join(tempDir, `${job.id}.xlsx`);
    const fileBuffer = await api.downloadFile(doc.downloadUrl);
    fs.writeFileSync(xlsxPath, fileBuffer);

    const pdfPath = await convertToPdf({
      sofficePath: env.sofficePath,
      inputFile: xlsxPath,
      outDir: tempDir,
    });

    // The printer's queue can carry unrelated jobs that never clear (see print.js), so we
    // snapshot job ids before printing and track only the specific new job this run created.
    const beforeJobIds = new Set(
      (await getPrintJobs(env.printerName)).map((printJob) => printJob.id).filter((id) => id !== null),
    );

    await printPdf({ sumatraPath: env.sumatraPath, printerName: env.printerName, pdfFile: pdfPath });

    const spoolerJobId = await detectNewSpoolerJobId({ printerName: env.printerName, beforeJobIds });

    await api.updatePrintJob(job.id, {
      status: 'sent_to_spooler',
      sentToSpoolerAt: new Date().toISOString(),
      spoolerJobId,
    });

    let waitResult;
    if (spoolerJobId === null) {
      logger.log(
        `Print job ${job.id}: no new spooler job was observed after printing — assuming it printed ` +
          'immediately (common for small documents); no spoolerJobId recorded.',
      );
      waitResult = { completed: true };
    } else {
      waitResult = await waitForSpecificJobToClear({ printerName: env.printerName, jobId: spoolerJobId });
    }

    if (!waitResult.completed) {
      throw new Error('Timed out waiting for the print job to clear the spooler.');
    }

    await api.completePrintJob(job.id);
    logger.log(`Completed print job ${job.id} for record ${doc.processingRecordId}`);
    return { ok: true };
  } catch (error) {
    logger.log(`Print job ${job.id} failed: ${error.message}`);
    await api.updatePrintJob(job.id, { status: 'failed', errorMessage: error.message }).catch(() => {});
    return { ok: false };
  }
}

async function runOnce({ dryRun = false } = {}) {
  const env = readEnv();
  const logger = createLogger(path.resolve(__dirname, '..', env.pollLogDir));
  const lockFilePath = path.resolve(__dirname, '..', 'agent.lock');

  if (!acquireLock(lockFilePath)) {
    logger.log('Another run is already in progress (agent.lock present). Exiting.');
    return;
  }

  let tempDir = null;
  let anyFailures = false;

  try {
    const api = createApiClient({ apiBaseUrl: env.apiBaseUrl, internalApiToken: env.internalApiToken });
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'print-agent-'));

    let queue;
    try {
      queue = await api.getPrintQueue();
    } catch (error) {
      logger.log(`Failed to fetch print queue: ${error.message}`);
      return;
    }

    if (!queue.length) {
      logger.log('Nothing to print.');
      return;
    }

    logger.log(`Found ${queue.length} document(s) to print.`);

    for (const doc of queue) {
      const result = await processDocument(doc, { env, api, logger, dryRun, tempDir });

      if (!result.ok) {
        anyFailures = true;
      }
    }
  } finally {
    if (tempDir) {
      if (anyFailures) {
        logger.log(`Keeping temp directory for troubleshooting because a document failed: ${tempDir}`);
      } else {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }

    releaseLock(lockFilePath);
  }
}

function main() {
  const dryRun = process.argv.includes('--dry-run');

  runOnce({ dryRun }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

if (require.main === module) {
  main();
}

module.exports = { processDocument, readEnv, runOnce };
