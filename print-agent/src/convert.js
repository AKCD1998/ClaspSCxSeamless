const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs/promises');

function buildSofficeArgs(sofficePath, inputFile, outDir) {
  return {
    command: sofficePath,
    args: ['--headless', '--convert-to', 'pdf', '--outdir', outDir, inputFile],
  };
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const { timeout = 0, ...spawnOptions } = options;
    const child = spawn(command, args, { windowsHide: true, ...spawnOptions });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    // LibreOffice's launcher can leave soffice.bin running. Stop only this
    // invocation's process tree, never other users' Office processes.
    const timer = timeout > 0 ? setTimeout(() => {
      timedOut = true;
      if (process.platform === 'win32' && child.pid) {
        const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
        killer.on('error', () => child.kill());
      } else child.kill();
    }, timeout) : null;

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

    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`Command timed out after ${timeout} ms: ${command}`));
      } else if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`Command "${command}" exited with code ${code}: ${stderr || stdout}`));
      }
    });
  });
}

async function convertToPdf({ sofficePath, inputFile, outDir }) {
  const { command, args } = buildSofficeArgs(sofficePath, inputFile, outDir);
  await runCommand(command, args);

  const base = path.basename(inputFile, path.extname(inputFile));
  return path.join(outDir, `${base}.pdf`);
}

async function convertOriginalToPdf({ sofficePath, inputFile, outDir, originalFilename, onLayout }) {
  const { preparePrintWorkbook } = require('./accountingPrintLayout');
  const printInputDir = path.join(outDir, 'print-input');
  await fs.mkdir(printInputDir, { recursive:true });
  const printInput = path.join(printInputDir, path.basename(inputFile));
  const prepared = await preparePrintWorkbook(await fs.readFile(inputFile), originalFilename || path.basename(inputFile));
  await fs.writeFile(printInput, prepared.buffer);
  const profile = pathToFileURL(path.join(outDir, 'libreoffice-profile')).href;
  // A unique output directory prevents a failed conversion from reusing an old PDF.
  const conversionDir = await fs.mkdtemp(path.join(outDir, 'convert-'));
  const result = await runCommand(sofficePath, [
    '-env:UserInstallation=' + profile, '--headless', '--norestore',
    '--convert-to', 'pdf:calc_pdf_Export', '--outdir', conversionDir, printInput,
  ], { timeout: 120000 });
  const pdfPath = path.join(outDir, path.basename(inputFile, path.extname(inputFile)) + '.pdf');
  const convertedPdf = path.join(conversionDir,path.basename(pdfPath));
  try {
    if (!(await fs.stat(convertedPdf)).size) throw new Error('empty PDF');
  } catch {
    throw new Error('LibreOffice ไม่ได้สร้าง PDF: ' + (result.stderr || result.stdout || 'ไม่มีไฟล์ผลลัพธ์').slice(0, 500));
  }
  await fs.copyFile(convertedPdf,pdfPath);
  const { workbook, buffer, ...layout } = prepared;
  await fs.writeFile(pdfPath + '.layout.json', JSON.stringify(layout,null,2));
  if (onLayout) onLayout(layout);
  return pdfPath;
}

module.exports = { buildSofficeArgs, convertToPdf, convertOriginalToPdf, runCommand };
