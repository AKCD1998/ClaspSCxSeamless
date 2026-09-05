const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const {
  processBatchWork,
  runOriginalBatchQueue,
  detectBatchJob,
} = require("../src/originalBatch");
const {
  parseGetPrintJobOutput,
  waitForSpecificJobToClear,
  buildSumatraArgs,
} = require("../src/print");
let tempDir;
test.beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "accounting-agent-test-"));
});
test.afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});
function setup(action = "print") {
  const buffer = Buffer.from("%PDF-test-fixture");
  const events = [];
  const work = {
    id: crypto.randomUUID(),
    token: crypto.randomUUID(),
    sequence: 1,
    filename: "statement.pdf",
    action,
    printerName: "FAKE",
    pageCount: 2,
    downloadUrl: "test",
    checksumSha256: crypto.createHash("sha256").update(buffer).digest("hex"),
  };
  let printed = 0,
    uploaded;
  const deps = {
    tempDir,
    env: {},
    logger: { log() {} },
    api: {
      async downloadBatchFile() {
        return buffer;
      },
      async batchEvent(id, body) {
        events.push(body);
      },
      async uploadBatchPreview(id, token, bytes) {
        uploaded = bytes;
      },
    },
    async getJobs() {
      return [];
    },
    async print(options) {
      printed++;
      assert.equal(options.printSettings, "paper=A4,fit,simplex,1x");
    },
    async detect() {
      return 55;
    },
    async waitForJob() {
      return { completed: true };
    },
  };
  return {
    work,
    deps,
    events,
    buffer,
    get printed() {
      return printed;
    },
    get uploaded() {
      return uploaded;
    },
  };
}
test("PDF original preview preserves bytes and never calls the printer or converter", async () => {
  const s = setup("prepare");
  s.deps.convert = () => {
    throw Error("must not convert original PDF");
  };
  assert.equal(await processBatchWork(s.work, s.deps), true);
  assert.equal(s.printed, 0);
  assert.deepEqual(s.uploaded, s.buffer);
});
test("persists submitting before physical print, records spooler id, then completes", async () => {
  const s = setup();
  s.deps.print = async () => {
    assert.equal(s.events.at(-1).event, "submitting");
  };
  assert.equal(await processBatchWork(s.work, s.deps), true);
  assert.deepEqual(
    s.events.map((event) => event.event),
    ["submitting", "spooler", "completed"],
  );
});
test("checksum mismatch stops without printing", async () => {
  const s = setup();
  s.work.checksumSha256 = "wrong";
  assert.equal(await processBatchWork(s.work, s.deps), false);
  assert.equal(s.printed, 0);
  assert.deepEqual(
    s.events.map((event) => event.event),
    ["failed"],
  );
});
test("unobserved spooler job is never reported completed", async () => {
  const s = setup();
  s.deps.detect = async () => {
    throw Error("unobserved job");
  };
  assert.equal(await processBatchWork(s.work, s.deps), false);
  assert.equal(s.printed, 1);
  assert.deepEqual(
    s.events.map((event) => event.event),
    ["submitting", "failed"],
  );
});
test("spooler observation runs before the print process exits", async () => {
  const s = setup();
  let finishPrint;
  s.deps.print = () =>
    new Promise((resolve) => {
      finishPrint = resolve;
    });
  s.deps.detect = async () => {
    assert.equal(typeof finishPrint, "function");
    finishPrint();
    return 55;
  };
  assert.equal(await processBatchWork(s.work, s.deps), true);
  assert.equal(s.events.at(-1).event, "completed");
});
test("printer failure stops the batch and does not claim the next document", async () => {
  const s = setup();
  let claims = 0;
  s.deps.api.claimBatchWork = async () => {
    claims++;
    return { work: s.work };
  };
  s.deps.waitForJob = async () => ({ completed: false, reason: "PaperOut" });
  assert.equal((await runOriginalBatchQueue(s.deps)).failed, true);
  assert.equal(claims, 1);
});
test("completion response lost never causes a second physical print", async () => {
  const s = setup();
  s.deps.api.batchEvent = async (id, body) => {
    s.events.push(body);
    if (body.event === "completed") throw Error("network");
  };
  assert.equal(await processBatchWork(s.work, s.deps), false);
  assert.equal(s.printed, 1);
});
test("dry-run does not claim jobs or send LINE", async () => {
  const result = await runOriginalBatchQueue({
    dryRun: true,
    logger: { log() {} },
    api: {
      claimBatchWork() {
        throw Error("must not call");
      },
    },
  });
  assert.equal(result.holdLegacy, false);
});
test("spooler detection ignores unrelated new jobs and requires the exact document marker", async () => {
  const id = await detectBatchJob({
    printerName: "FAKE",
    beforeIds: new Set(),
    marker: "our-file",
    getJobs: async () => [
      { id: 1, documentName: "unrelated" },
      { id: 2, documentName: "our-file.pdf" },
    ],
    wait: async () => {},
  });
  assert.equal(id, 2);
  await assert.rejects(
    detectBatchJob({
      printerName: "FAKE",
      beforeIds: new Set(),
      marker: "our-file",
      getJobs: async () => [{ id: 1, documentName: "unrelated" }],
      wait: async () => {},
    }),
    /ตรวจหมายเลข/,
  );
});
test("strict spooler mode rejects malformed output and immediately stops on PaperOut", async () => {
  assert.throws(() => parseGetPrintJobOutput("not JSON", { strict: true }));
  const result = await waitForSpecificJobToClear({
    printerName: "FAKE",
    jobId: 2,
    strict: true,
    getJobs: async () => [{ id: 2, jobStatus: "PaperOut" }],
  });
  assert.equal(result.completed, false);
  assert.match(result.reason, /PaperOut/);
  assert.deepEqual(
    buildSumatraArgs("sumatra", "FAKE", "file.pdf", "paper=A4,fit,simplex,1x")
      .args,
    [
      "-print-to",
      "FAKE",
      "-print-settings",
      "paper=A4,fit,simplex,1x",
      "-silent",
      "file.pdf",
    ],
  );
});
