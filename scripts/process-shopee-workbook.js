const fs = require('node:fs/promises');
const path = require('node:path');
const { buildOutputFilename } = require('../server/src/services/workbookRules');
const { transformWorkbook } = require('../server/src/services/workbookTransformService');

async function main() {
  const inputPath = process.argv[2];
  const outputDirectory = process.argv[3] || path.resolve('outputs', 'shopee-mvp');

  if (!inputPath) {
    throw new Error('Usage: node scripts/process-shopee-workbook.js <input.xlsx> [output-directory]');
  }

  const sourceBuffer = await fs.readFile(inputPath);
  const originalFilename = path.basename(inputPath);
  const result = await transformWorkbook(sourceBuffer, {
    requestedVariant: 'shopee',
    originalFilename,
  });
  const output = buildOutputFilename(
    result.worksheet,
    originalFilename,
    result.effectiveVariant,
    result.metadata,
  );

  await fs.mkdir(outputDirectory, { recursive: true });
  const outputPath = path.resolve(outputDirectory, output.filename);
  await fs.writeFile(outputPath, Buffer.from(await result.workbook.xlsx.writeBuffer()));

  process.stdout.write(
    `${JSON.stringify(
      {
        outputPath,
        warnings: [...result.warnings, ...output.warnings],
        summary: result.metadata,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
