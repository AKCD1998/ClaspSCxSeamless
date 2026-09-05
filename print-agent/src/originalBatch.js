const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { convertOriginalToPdf } = require("./convert");
const {
  getPrintJobs,
  printPdf,
  waitForSpecificJobToClear,
} = require("./print");
const checksum = (buffer) =>
  crypto.createHash("sha256").update(buffer).digest("hex");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function detectBatchJob({
  printerName,
  beforeIds,
  marker,
  getJobs,
  wait = sleep,
}) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const candidates = (await getJobs(printerName)).filter(
      (job) => !beforeIds.has(job.id),
    );
    const matches = candidates.filter((job) =>
      String(job.documentName || "").includes(marker),
    );
    if (matches.length === 1) return matches[0].id;
    // Never identify an unrelated user's newly submitted job as ours.
    if (matches.length > 1)
      throw new Error("พบงานพิมพ์ซ้ำหลายงาน ต้องตรวจคิวที่เครื่อง");
    await wait(250);
  }
  throw new Error(
    "ส่งพิมพ์แล้วแต่ตรวจหมายเลขงานไม่ได้ ต้องตรวจเอกสารที่เครื่องก่อนทำต่อ",
  );
}

async function processBatchWork(
  work,
  {
    api,
    env,
    logger,
    tempDir,
    convert = convertOriginalToPdf,
    getJobs = (name) => getPrintJobs(name, { strict: true }),
    print = printPdf,
    waitForJob = waitForSpecificJobToClear,
    detect = detectBatchJob,
  },
) {
  let heartbeatFailure = null;
  let heartbeatInFlight = Promise.resolve();
  const timer = setInterval(() => {
    heartbeatInFlight = heartbeatInFlight
      .then(() =>
        api.batchEvent(work.id, { token: work.token, event: "heartbeat" }),
      )
      .catch((error) => {
        heartbeatFailure = error;
      });
  }, 30000);
  const report = (event, extra = {}) =>
    api.batchEvent(work.id, { token: work.token, event, ...extra });
  try {
    const buffer = await api.downloadBatchFile(work.downloadUrl);
    if (checksum(buffer) !== work.checksumSha256)
      throw new Error("ไฟล์ที่ดาวน์โหลดไม่ตรงกับไฟล์ที่อนุมัติ");
    if (work.action === "prepare") {
      const extension = path.extname(work.filename).toLowerCase();
      if (![".pdf", ".xlsx"].includes(extension))
        throw new Error("รองรับเฉพาะ PDF และ XLSX");
      const source = path.join(tempDir, work.id + extension);
      await fs.writeFile(source, buffer);
      let printLayout;
      const previewPath =
        extension === ".pdf"
          ? source
          : await convert({
              sofficePath: env.sofficePath,
              inputFile: source,
              originalFilename: work.filename,
              onLayout: layout => { printLayout=layout; },
              outDir: tempDir,
            });
      if (heartbeatFailure) throw heartbeatFailure;
      await api.uploadBatchPreview(
        work.id,
        work.token,
        await fs.readFile(previewPath),
        printLayout,
      );
      logger.log(
        "Prepared original document " + work.sequence + ": " + work.filename,
      );
      return true;
    }
    const pdfPath = path.join(tempDir, work.id + ".pdf");
    await fs.writeFile(pdfPath, buffer);
    if (heartbeatFailure) throw heartbeatFailure;
    const beforeIds = new Set(
      (await getJobs(work.printerName)).map((job) => job.id),
    );
    await report("submitting");
    if (heartbeatFailure) throw heartbeatFailure;
    // Observe while Sumatra is still submitting, so short jobs can be seen
    // before the child exits. Never treat an unobserved job as successful.
    const [, spoolerJobId] = await Promise.all([
      print({
        sumatraPath: env.sumatraPath,
        printerName: work.printerName,
        pdfFile: pdfPath,
        printSettings: "paper=A4,fit,simplex,1x",
      }),
      detect({
        printerName: work.printerName,
        beforeIds,
        marker: work.id,
        getJobs,
      }),
    ]);
    await report("spooler", { spoolerJobId });
    const result = await waitForJob({
      printerName: work.printerName,
      jobId: spoolerJobId,
      getJobs,
      strict: true,
      timeoutMs: Math.max(10 * 60 * 1000, work.pageCount * 20000),
    });
    if (!result.completed)
      throw new Error(result.reason || "คิวพิมพ์ยังไม่จบภายในเวลาที่กำหนด");
    if (heartbeatFailure) throw heartbeatFailure;
    await report("completed");
    logger.log(
      "Original document left spooler: " + work.sequence + " " + work.filename,
    );
    return true;
  } catch (error) {
    logger.log("Original batch stopped: " + error.message);
    await report("failed", { message: error.message }).catch((failure) =>
      logger.log(
        "Could not report failure; server will pause expired print claim: " +
          failure.message,
      ),
    );
    return false;
  } finally {
    clearInterval(timer);
    await heartbeatInFlight;
  }
}
async function runOriginalBatchQueue({
  api,
  env,
  logger,
  tempDir,
  dryRun = false,
  ...dependencies
}) {
  // Dry run makes no claim, upload, notification, or print request.
  if (dryRun) {
    logger.log("[dry-run] Original batch queue is not claimed.");
    return { holdLegacy: false };
  }
  let processed = false;
  for (let index = 0; index < 100; index++) {
    const payload = await api.claimBatchWork({
      protocol: 1,
      agentHost: env.agentHost,
      printerName: env.printerName,
    });
    if (!payload.work) return { holdLegacy: payload.holdLegacy || processed };
    processed = true;
    if (
      !(await processBatchWork(payload.work, {
        api,
        env,
        logger,
        tempDir,
        ...dependencies,
      }))
    )
      return { holdLegacy: true, failed: true };
  }
  return { holdLegacy: true };
}
module.exports = { processBatchWork, runOriginalBatchQueue, detectBatchJob };
