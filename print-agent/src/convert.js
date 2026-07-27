const path = require('node:path');
const { spawn } = require('node:child_process');

function buildSofficeArgs(sofficePath, inputFile, outDir) {
  return {
    command: sofficePath,
    args: ['--headless', '--convert-to', 'pdf', '--outdir', outDir, inputFile],
  };
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, ...options });
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

module.exports = { buildSofficeArgs, convertToPdf, runCommand };
