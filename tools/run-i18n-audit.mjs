import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { promises as fs } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = dirname(__dirname);

async function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function formatMissingDetails(missing) {
  const lines = [];
  for (const [locale, keys] of Object.entries(missing)) {
    if (!Array.isArray(keys) || keys.length === 0) {
      continue;
    }
    lines.push(`  - ${locale}: ${keys.join(', ')}`);
  }
  return lines.join('\n');
}

async function main() {
  await runCommand('python3', [join(repoRoot, 'scripts', 'i18n_scan.py')]);
  await runCommand('node', [join(repoRoot, 'scripts', 'generate-i18n-coverage.mjs')]);

  const coveragePath = join(repoRoot, 'reports', 'i18n', 'coverage.json');
  const usedKeysPath = join(repoRoot, 'reports', 'i18n', 'used-keys.json');

  const coverage = await readJson(coveragePath);
  const usedKeys = await readJson(usedKeysPath);

  const missing = coverage?.missing ?? {};
  const orphanUsedKeys = coverage?.orphan_used_keys ?? [];

  const localesWithMissing = Object.entries(missing).filter(([, keys]) => Array.isArray(keys) && keys.length > 0);

  if (localesWithMissing.length > 0) {
    const details = formatMissingDetails(missing);
    throw new Error(`Translation coverage below 100%.\n${details}`);
  }

  if (Array.isArray(orphanUsedKeys) && orphanUsedKeys.length > 0 && Array.isArray(usedKeys) && usedKeys.length > 0) {
    throw new Error(`Translation audit found orphan used keys: ${orphanUsedKeys.join(', ')}`);
  }

  console.log('✅ Translation coverage is 100% for all locales.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
