// Local preview helper only. Never imports the queue, API client or printer.
const fs = require('node:fs/promises');
const path = require('node:path');
const { convertOriginalToPdf } = require('../src/convert');

(async () => {
  const [sofficePath, sourceDirectory, outDir, filenamePrefix] = process.argv.slice(2);
  if (!sofficePath || !sourceDirectory || !outDir) throw new Error('Usage: soffice-path source-directory output-directory');
  if (path.resolve(sourceDirectory) === path.resolve(outDir)) throw new Error('Use a separate preview directory');
  await fs.mkdir(outDir, { recursive: true });
  for (const entry of await fs.readdir(sourceDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.xlsx$/i.test(entry.name)) continue;
    if (filenamePrefix && !entry.name.startsWith(filenamePrefix)) continue;
    const pdf = await convertOriginalToPdf({ sofficePath, inputFile:path.join(sourceDirectory, entry.name), outDir });
    console.log(path.basename(pdf) + ': ' + (await fs.stat(pdf)).size + ' bytes');
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
