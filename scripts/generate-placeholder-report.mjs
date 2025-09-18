import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REPORTS_DIR = path.join(ROOT, 'reports', 'i18n');
const LOCALES_CONFIG_PATH = path.join(REPORTS_DIR, 'locales-keys.json');
const OUTPUT_JSON_PATH = path.join(REPORTS_DIR, 'placeholders.json');
const OUTPUT_MD_PATH = path.join(REPORTS_DIR, 'placeholders-mismatch.md');

const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}|\{([a-zA-Z0-9_.-]+)\}/g;

function extractPlaceholders(value) {
  if (typeof value !== 'string') {
    return [];
  }

  const placeholders = new Set();
  let match;
  while ((match = PLACEHOLDER_REGEX.exec(value)) !== null) {
    const [, mustache, single] = match;
    const token = mustache ?? single;
    if (token) {
      placeholders.add(token);
    }
  }
  PLACEHOLDER_REGEX.lastIndex = 0;
  return Array.from(placeholders).sort();
}

async function loadLocales() {
  let localeKeys;
  try {
    const raw = await fs.readFile(LOCALES_CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    localeKeys = Object.keys(parsed);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    const entries = await fs.readdir(ROOT, { withFileTypes: true });
    localeKeys = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name.replace(/\.json$/, ''));
  }

  return localeKeys.sort();
}

async function loadLocaleData(locale) {
  const filePath = path.join(ROOT, `${locale}.json`);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function determineExpected(byLocale, baselineLocale = 'en') {
  const counts = new Map();
  const representations = new Map();

  for (const [locale, value] of Object.entries(byLocale)) {
    if (!Array.isArray(value)) {
      continue;
    }
    const key = JSON.stringify(value);
    const current = counts.get(key) ?? 0;
    counts.set(key, current + 1);
    representations.set(key, value);
  }

  if (counts.size === 0) {
    return [];
  }

  let expectedKey = null;
  let expectedCount = -1;
  for (const [key, count] of counts.entries()) {
    if (count > expectedCount) {
      expectedKey = key;
      expectedCount = count;
      continue;
    }
    if (count === expectedCount && expectedKey !== null) {
      const baseline = byLocale[baselineLocale];
      if (Array.isArray(baseline) && JSON.stringify(baseline) === key) {
        expectedKey = key;
      }
    }
  }

  return representations.get(expectedKey) ?? [];
}

function arrayEquals(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}

(async () => {
  const locales = await loadLocales();
  const localeDataEntries = await Promise.all(
    locales.map(async (locale) => [locale, await loadLocaleData(locale)])
  );
  const localeData = Object.fromEntries(localeDataEntries);

  const allKeys = new Set();
  for (const data of Object.values(localeData)) {
    if (!data) continue;
    Object.keys(data).forEach((key) => allKeys.add(key));
  }

  const report = {};
  const mismatches = [];

  for (const key of Array.from(allKeys).sort()) {
    const byLocale = {};
    for (const locale of locales) {
      const data = localeData[locale];
      if (!data || typeof data[key] === 'undefined') {
        byLocale[locale] = null;
        continue;
      }
      const placeholders = extractPlaceholders(data[key]);
      byLocale[locale] = placeholders;
    }

    const expected = determineExpected(byLocale);
    report[key] = {
      expected,
      byLocale,
    };

    const mismatchLocales = [];
    for (const locale of locales) {
      const placeholders = byLocale[locale];
      if (placeholders === null) {
        mismatchLocales.push({ locale, reason: 'missing_translation' });
        continue;
      }
      if (!arrayEquals(placeholders, expected)) {
        mismatchLocales.push({ locale, reason: 'different_placeholders' });
      }
    }

    if (mismatchLocales.length > 0) {
      mismatches.push({ key, expected, mismatchLocales, byLocale });
    }
  }

  await fs.mkdir(REPORTS_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);

  const totalKeys = Object.keys(report).length;
  const mismatchCount = mismatches.length;
  const mismatchRatio = totalKeys === 0 ? 0 : mismatchCount / totalKeys;

  const lines = [
    '# Placeholder Consistency Report',
    '',
    `- Total keys analysed: ${totalKeys}`,
    `- Keys with placeholder mismatches: ${mismatchCount}`,
    `- Mismatch ratio: ${(mismatchRatio * 100).toFixed(2)}%`,
    '',
    '## Example mismatched keys',
  ];

  const exampleCount = Math.min(10, mismatches.length);
  if (exampleCount === 0) {
    lines.push('', '_No mismatches detected._');
  } else {
    for (let index = 0; index < exampleCount; index += 1) {
      const mismatch = mismatches[index];
      const localeDetails = mismatch.mismatchLocales
        .map(({ locale, reason }) => {
          if (reason === 'missing_translation') {
            return `${locale}: missing translation`;
          }
          const placeholders = mismatch.byLocale[locale];
          return `${locale}: [${placeholders.join(', ')}]`;
        })
        .join('; ');
      lines.push(
        `- \`${mismatch.key}\` → expected [${mismatch.expected.join(', ')}]; ${localeDetails}`
      );
    }
  }

  lines.push(
    '',
    '## Recommendation',
    '',
    'Ensure each locale includes the same placeholder set as the expected value for every key. Add missing translations where necessary and align placeholder tokens (e.g., `{{tenantId}}`) so runtime formatting remains consistent.'
  );

  await fs.writeFile(OUTPUT_MD_PATH, `${lines.join('\n')}\n`);
})();
