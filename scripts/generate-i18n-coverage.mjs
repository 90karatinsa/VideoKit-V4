import { promises as fs } from 'fs';
import path from 'path';

async function loadUsedKeys(reportPath) {
  const content = await fs.readFile(reportPath, 'utf8');
  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected an array in ${reportPath}`);
  }
  return parsed;
}

async function loadLocaleFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const locales = new Map();

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(/^([a-z]{2})\.json$/i);
    if (!match) continue;
    const locale = match[1];
    const filePath = path.join(rootDir, entry.name);
    const fileContent = await fs.readFile(filePath, 'utf8');
    try {
      const json = JSON.parse(fileContent);
      const keys = Object.keys(json);
      locales.set(locale, { filePath, keys });
    } catch (error) {
      throw new Error(`Failed to parse JSON from ${filePath}: ${error.message}`);
    }
  }

  if (locales.size === 0) {
    throw new Error('No locale JSON files found.');
  }

  return locales;
}

function computeCoverage(usedKeys, locales) {
  const usedSet = new Set(usedKeys);
  const allLocaleKeys = new Set();
  const missing = {};
  const unused = {};
  const stats = [];

  for (const [locale, { keys }] of Array.from(locales.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    const keySet = new Set(keys);
    const missingKeys = usedKeys.filter((key) => !keySet.has(key));
    const unusedKeys = keys.filter((key) => !usedSet.has(key));

    missing[locale] = missingKeys;
    unused[locale] = unusedKeys;

    for (const key of keys) {
      allLocaleKeys.add(key);
    }

    const coverageRatio = usedKeys.length === 0
      ? 1
      : (usedKeys.length - missingKeys.length) / usedKeys.length;

    stats.push({
      locale,
      totalKeys: keys.length,
      missingCount: missingKeys.length,
      unusedCount: unusedKeys.length,
      coverageRatio,
    });
  }

  const orphanUsedKeys = usedKeys.filter((key) => !allLocaleKeys.has(key));

  return { missing, unused, stats, orphanUsedKeys };
}

function formatPercentage(ratio) {
  return `${(ratio * 100).toFixed(2)}%`;
}

async function writeReports({ missing, unused, stats, orphanUsedKeys }, options) {
  const { outputJsonPath, outputMarkdownPath, usedKeyCount } = options;

  const jsonReport = {
    missing,
    unused,
    orphan_used_keys: orphanUsedKeys,
  };
  await fs.mkdir(path.dirname(outputJsonPath), { recursive: true });
  await fs.writeFile(outputJsonPath, `${JSON.stringify(jsonReport, null, 2)}\n`, 'utf8');

  const lines = [];
  lines.push('# i18n Coverage Report');
  lines.push('');
  lines.push(`Total used keys: ${usedKeyCount}`);
  lines.push('');
  lines.push('| Locale | Coverage | Missing | Unused | Total keys |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const stat of stats) {
    lines.push(
      `| ${stat.locale} | ${formatPercentage(stat.coverageRatio)} | ${stat.missingCount} | ${stat.unusedCount} | ${stat.totalKeys} |`,
    );
  }
  lines.push('');
  lines.push('## Orphan used keys');
  lines.push('');
  if (orphanUsedKeys.length === 0) {
    lines.push('- None');
  } else {
    for (const key of orphanUsedKeys) {
      lines.push(`- ${key}`);
    }
  }
  lines.push('');

  await fs.writeFile(outputMarkdownPath, `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
  const repoRoot = process.cwd();
  const usedKeysPath = path.join(repoRoot, 'reports', 'i18n', 'used-keys.json');
  const localesDir = repoRoot;
  const outputJsonPath = path.join(repoRoot, 'reports', 'i18n', 'coverage.json');
  const outputMarkdownPath = path.join(repoRoot, 'reports', 'i18n', 'coverage.md');

  const usedKeys = await loadUsedKeys(usedKeysPath);
  const locales = await loadLocaleFiles(localesDir);
  const { missing, unused, stats, orphanUsedKeys } = computeCoverage(usedKeys, locales);

  await writeReports(
    { missing, unused, stats, orphanUsedKeys },
    { outputJsonPath, outputMarkdownPath, usedKeyCount: usedKeys.length },
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
