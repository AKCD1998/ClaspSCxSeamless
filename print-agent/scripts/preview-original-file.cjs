const fs = require("node:fs/promises");
const { convertOriginalToPdf } = require("../src/convert");
(async () => {
  const [sofficePath, inputFile, outDir] = process.argv.slice(2);
  if (!sofficePath || !inputFile || !outDir)
    throw new Error("Usage: soffice-path input-file output-directory");
  await fs.mkdir(outDir, { recursive: true });
  const result = await convertOriginalToPdf({ sofficePath, inputFile, outDir });
  console.log(result);
  console.log((await fs.stat(result)).size + " bytes");
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
