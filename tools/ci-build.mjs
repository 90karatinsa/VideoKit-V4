#!/usr/bin/env node
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const requiredFiles = [
  'app.js',
  'server.mjs',
  'worker.js',
  'config.js',
];

await Promise.all(
  requiredFiles.map(async (file) => {
    const target = path.join(repoRoot, file);
    await access(target);
  }),
);

console.log(`Build verification succeeded for ${requiredFiles.length} entry files.`);
