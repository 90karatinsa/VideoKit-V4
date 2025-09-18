#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outputPath = path.join(repoRoot, 'reports', 'final', 'i18n-spot.json');
const locale = 'tr';
const translationPath = path.join(repoRoot, `${locale}.json`);

const checks = [
  {
    key: 'portal_title',
    file: 'index.html',
    selector: '.header-content h1[data-i18n="portal_title"]',
  },
  {
    key: 'nav_dashboard',
    file: 'index.html',
    selector: 'nav a[data-i18n="nav_dashboard"]',
  },
  {
    key: 'language_switcher_label',
    file: 'index.html',
    selector: 'label[for="lang-switcher"]',
  },
  {
    key: 'login_title',
    file: 'index.html',
    selector: '#login-view h2[data-i18n="login_title"]',
  },
  {
    key: 'login_prompt_new',
    file: 'index.html',
    selector: '#login-view p[data-i18n="login_prompt_new"]',
  },
  {
    key: 'email_label',
    file: 'index.html',
    selector: '#login-form label[for="login-email"]',
  },
  {
    key: 'password_label',
    file: 'index.html',
    selector: '#login-form label[for="login-password"]',
  },
  {
    key: 'login_button',
    file: 'index.html',
    selector: '#login-form button[data-i18n="login_button"]',
  },
  {
    key: 'forgot_password_link',
    file: 'index.html',
    selector: '#login-view a[data-i18n="forgot_password_link"]',
  },
  {
    key: 'go_to_register_link',
    file: 'index.html',
    selector: '#login-view a[data-i18n="go_to_register_link"]',
  },
  {
    key: 'register_title',
    file: 'index.html',
    selector: '#register-view h2[data-i18n="register_title"]',
  },
  {
    key: 'register_prompt',
    file: 'index.html',
    selector: '#register-view p[data-i18n="register_prompt"]',
  },
  {
    key: 'register_button',
    file: 'index.html',
    selector: '#register-form button[data-i18n="register_button"]',
  },
  {
    key: 'go_to_login_link',
    file: 'index.html',
    selector: '#register-view a[data-i18n="go_to_login_link"]',
  },
  {
    key: 'forgot_password_title',
    file: 'index.html',
    selector: '#forgot-password-view h2[data-i18n="forgot_password_title"]',
  },
  {
    key: 'forgot_password_prompt',
    file: 'index.html',
    selector: '#forgot-password-view p[data-i18n="forgot_password_prompt"]',
  },
  {
    key: 'send_reset_link_button',
    file: 'index.html',
    selector: '#forgot-password-form button[data-i18n="send_reset_link_button"]',
  },
  {
    key: 'reset_password_title',
    file: 'index.html',
    selector: '#reset-password-view h2[data-i18n="reset_password_title"]',
  },
  {
    key: 'reset_password_prompt',
    file: 'index.html',
    selector: '#reset-password-view p[data-i18n="reset_password_prompt"]',
  },
  {
    key: 'update_password_button',
    file: 'index.html',
    selector: '#reset-password-form button[data-i18n="update_password_button"]',
  },
];

const normalize = (value) =>
  value == null ? '' : String(value).replace(/\s+/g, ' ').trim();

async function loadTranslations() {
  const file = await readFile(translationPath, 'utf8');
  return JSON.parse(file);
}

async function loadDom(file) {
  const html = await readFile(path.join(repoRoot, file), 'utf8');
  return new JSDOM(html);
}

async function main() {
  const translations = await loadTranslations();
  const domCache = new Map();
  const results = [];
  let passed = 0;

  for (const check of checks) {
    if (!domCache.has(check.file)) {
      domCache.set(check.file, await loadDom(check.file));
    }
    const dom = domCache.get(check.file);
    const document = dom.window.document;
    const element = document.querySelector(check.selector);
    const expectedRaw = translations[check.key];
    const expected = normalize(expectedRaw);
    let actual = '';
    let status = 'pass';
    let message = '';

    if (!element) {
      status = 'fail';
      message = 'Element not found';
    } else if (expectedRaw == null) {
      status = 'fail';
      message = 'Missing translation value';
      actual = normalize(element.textContent);
    } else {
      actual = normalize(element.textContent);
      if (actual !== expected) {
        status = 'fail';
        message = 'Text content mismatch';
      }
    }

    if (status === 'pass') {
      passed += 1;
    }

    results.push({
      key: check.key,
      file: check.file,
      selector: check.selector,
      expected,
      actual,
      status,
      message,
    });
  }

  const summary = {
    locale,
    total: checks.length,
    passed,
    failed: checks.length - passed,
    timestamp: new Date().toISOString(),
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    JSON.stringify({ summary, results }, null, 2),
    'utf8',
  );

  if (summary.failed > 0) {
    console.error(`Spot check failed for ${summary.failed} keys.`);
    process.exit(1);
  }

  console.log(
    `Spot check passed for ${summary.passed}/${summary.total} keys. Report written to ${outputPath}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
