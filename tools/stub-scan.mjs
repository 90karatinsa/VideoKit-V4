#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const KEYWORD_PATTERNS = [
  { keyword: 'TODO', regex: /\bTODO\b/ },
  { keyword: 'FIXME', regex: /\bFIXME\b/ },
  { keyword: 'mock', regex: /\bmock\b/i },
  { keyword: 'fake', regex: /\bfake\b/i },
  { keyword: 'stub', regex: /\bstub\b/i },
  { keyword: 'random', regex: /\brandom\b/i },
];

const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.github',
  '.idea',
  '.vscode',
  'node_modules',
  'reports',
  'coverage',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.cache',
  '.pnpm',
  '.yarn',
  '.nyc_output',
  'tmp',
  'logs',
  'uploads',
  '__tests__',
  'tests',
  'docs',
]);

const IGNORED_FILE_EXTENSIONS = new Set([
  '.lock',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.mp4',
  '.mp3',
  '.mov',
  '.zip',
  '.tar',
  '.gz',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.pdf',
  '.bin',
]);

const IGNORED_FILE_NAMES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
]);

const IGNORED_PATH_PATTERNS = [
  /(^|\/)__mocks__(\/|$)/,
  /(^|\/)fixtures?(\/|$)/,
  /(^|\/)reports(\/|$)/,
  /^tools\/stub-scan\.mjs$/,
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const issues = [];

async function isProbablyTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (IGNORED_FILE_EXTENSIONS.has(ext)) {
    return false;
  }

  // Treat files without extension as text if they are smaller than a threshold.
  if (!ext) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size <= 1024 * 1024; // 1MB safety limit for binary files.
    } catch (error) {
      console.warn(`[stub-scan] Dosya boyutu okunamadı: ${filePath}`, error.message);
      return false;
    }
  }

  return true;
}

function normalizeLine(line) {
  return line.replace(/\s+/g, ' ').trim();
}

async function scanFile(filePath) {
  const relativePath = path.relative(ROOT, filePath);

  if (IGNORED_FILE_NAMES.has(path.basename(filePath)) || IGNORED_PATH_PATTERNS.some((pattern) => pattern.test(relativePath))) {
    return;
  }

  if (!(await isProbablyTextFile(filePath))) {
    return;
  }

  let content;
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    console.warn(`[stub-scan] Dosya okunamadı, atlanıyor: ${filePath}`, error.message);
    return;
  }

  const lines = content.split(/\r?\n/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    for (const { keyword, regex } of KEYWORD_PATTERNS) {
      if (regex.test(line)) {
        issues.push({
          file: relativePath,
          line: lineIndex + 1,
          keyword,
          snippet: normalizeLine(line).slice(0, 240),
        });
      }
    }
  }
}

async function walk(directory) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    console.warn(`[stub-scan] Dizin okunamadı, atlanıyor: ${directory}`, error.message);
    return;
  }

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      await walk(entryPath);
    } else if (entry.isFile()) {
      await scanFile(entryPath);
    }
  }
}

async function main() {
  await walk(ROOT);

  const report = {
    generatedAt: new Date().toISOString(),
    root: ROOT,
    keywords: KEYWORD_PATTERNS.map(({ keyword, regex }) => ({ keyword, regex: regex.toString() })),
    summary: {
      totalFilesWithFindings: new Set(issues.map((item) => item.file)).size,
      totalFindings: issues.length,
    },
    issues,
  };

  if (issues.length === 0) {
    report.status = 'ok';
  } else {
    report.status = 'issues-found';
  }

  const outputDir = path.join(ROOT, 'reports', 'final');
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'no-stubs.json');
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[stub-scan] Tarama tamamlandı. Bulgu sayısı: ${issues.length}. Rapor: ${outputPath}`);
}

main().catch((error) => {
  console.error('[stub-scan] Kritik hata:', error);
  process.exitCode = 1;
});
