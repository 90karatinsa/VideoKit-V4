import { test, expect } from '@playwright/test';
import http from 'http';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const screenshotDir = path.join(projectRoot, 'screenshots', 'i18n');

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.ico', 'image/x-icon']
]);

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8'
};

let server;
let baseUrl;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await fs.mkdir(screenshotDir, { recursive: true });
  ({ server, baseUrl } = await startStaticServer());
});

test.afterAll(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('videokit_lang', 'en-XA');
  });
});

test('login view with pseudo-locale', async ({ page }) => {
  await page.route('**/auth/me', (route) => {
    route.fulfill({ status: 401, headers: jsonHeaders, body: JSON.stringify({ error: 'Not logged in' }) });
  });
  await page.goto(`${baseUrl}/index.html`);
  await waitForPseudoLocale(page);
  await page.waitForSelector('#login-view:not([hidden])');
  await page.screenshot({ path: path.join(screenshotDir, 'login.png'), fullPage: true });
});

test('register view with pseudo-locale', async ({ page }) => {
  await page.route('**/auth/me', (route) => {
    route.fulfill({ status: 401, headers: jsonHeaders, body: JSON.stringify({ error: 'Not logged in' }) });
  });
  await page.goto(`${baseUrl}/index.html`);
  await waitForPseudoLocale(page);
  await page.waitForSelector('#login-view:not([hidden])');
  await page.click('#show-register-view');
  await page.waitForSelector('#register-view:not([hidden])');
  await page.screenshot({ path: path.join(screenshotDir, 'register.png'), fullPage: true });
});

test('dashboard view with mocked data', async ({ page }) => {
  await mockAuthenticatedDashboard(page);
  await page.goto(`${baseUrl}/index.html`);
  await waitForPseudoLocale(page);
  await page.waitForSelector('#dashboard-view:not([hidden])');
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(screenshotDir, 'dashboard.png'), fullPage: true });
});

test('analytics detail card', async ({ page }) => {
  await mockAuthenticatedDashboard(page);
  await page.goto(`${baseUrl}/index.html`);
  await waitForPseudoLocale(page);
  await page.waitForSelector('.analytics-card');
  const analyticsCard = page.locator('.analytics-card');
  await analyticsCard.waitFor();
  await page.waitForTimeout(250);
  await analyticsCard.screenshot({ path: path.join(screenshotDir, 'analytics.png') });
});

test('batch view after authentication', async ({ page }) => {
  await mockBatchAuthentication(page);
  await page.goto(`${baseUrl}/batch.html`);
  await waitForPseudoLocale(page);
  await page.waitForSelector('#batch-view:not([hidden])');
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(screenshotDir, 'batch.png'), fullPage: true });
});

async function startStaticServer() {
  const staticServer = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const decodedPath = decodeURIComponent(url.pathname);

      let relativePath;
      if (decodedPath.startsWith('/locales/')) {
        relativePath = path.join('locales', decodedPath.replace('/locales/', ''));
      } else {
        const candidate = decodedPath === '/' ? '/index.html' : decodedPath;
        relativePath = candidate.startsWith('/') ? candidate.slice(1) : candidate;
      }

      let absolutePath = path.normalize(path.join(projectRoot, relativePath));
      if (!absolutePath.startsWith(projectRoot)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      let stats;
      try {
        stats = await fs.stat(absolutePath);
      } catch (error) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      if (stats.isDirectory()) {
        absolutePath = path.join(absolutePath, 'index.html');
      }

      const file = await fs.readFile(absolutePath);
      const ext = path.extname(absolutePath).toLowerCase();
      const contentType = mimeTypes.get(ext) ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(file);
    } catch (error) {
      res.writeHead(500);
      res.end('Server error');
    }
  });

  await new Promise((resolve) => staticServer.listen(0, '127.0.0.1', resolve));
  const address = staticServer.address();
  const origin = `http://127.0.0.1:${address.port}`;
  return { server: staticServer, baseUrl: origin };
}

async function waitForPseudoLocale(page) {
  await page.waitForFunction(() => document.documentElement.lang === 'en-XA');
  await expect(page.locator('body')).toContainText('[!!');
}

async function mockAuthenticatedDashboard(page) {
  const tenant = {
    id: 'tenant_overflow_localization_suite',
    name: 'Overflow QA Localization Suite Tenant'
  };
  await page.route('**/auth/me', (route) => {
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        user: {
          id: 'user_overflow_owner',
          name: 'Overflow QA Owner',
          email: 'overflow.qa.owner@example.com'
        },
        tenant
      })
    });
  });
  await page.route('**/branding/*', (route) => {
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        logoUrl: '/default-logo.svg',
        primaryColor: '#7c3aed',
        backgroundColor: '#f5f3ff'
      })
    });
  });
  await page.route('**/billing', (route) => {
    route.fulfill({
      status: 200,
      headers: {
        ...jsonHeaders,
        'X-Quota-Remaining': '124'
      },
      body: JSON.stringify({
        plan_name: 'Overflow Enterprise Pseudo-Locale Preview',
        quota: { used: 9876, limit: 10000, remaining: 124 }
      })
    });
  });
  await page.route('**/management/keys', (route) => {
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        keys: [
          {
            id: 'key_live_super_massive_identifier',
            label: 'vk_live_super_massive_identifier_extremely_long',
            createdAt: new Date().toISOString()
          },
          {
            id: 'key_backup_observatory',
            label: 'vk_test_backup_observatory_spanning_many_characters',
            createdAt: new Date(Date.now() - 3600_000).toISOString()
          }
        ]
      })
    });
  });
  await page.route('**/analytics*', (route) => {
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        summary: {
          totalCalls: 48231,
          successfulCalls: 45120,
          averageProcessingTime: 1284
        },
        activities: [
          {
            timestamp: new Date().toISOString(),
            type: 'c2pa.verify.batch.large-payload',
            status: 'success',
            duration: 1524
          },
          {
            timestamp: new Date(Date.now() - 120_000).toISOString(),
            type: 'c2pa.verify.single.longassetname.with.extensions',
            status: 'failed',
            duration: 9845
          },
          {
            timestamp: new Date(Date.now() - 3600_000).toISOString(),
            type: 'api.key.rotate.overflow-scenario-case-study',
            status: 'success',
            duration: 312
          },
          {
            timestamp: new Date(Date.now() - 7200_000).toISOString(),
            type: 'webhook.delivery.integration-partner.excessively-long',
            status: 'success',
            duration: 418
          }
        ]
      })
    });
  });
}

async function mockBatchAuthentication(page) {
  const tenant = {
    id: 'tenant_overflow_localization_suite',
    name: 'Overflow QA Localization Suite Tenant'
  };
  await page.route('**/auth/me', (route) => {
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        user: {
          id: 'user_batch_operator',
          name: 'Batch Operations Specialist'
        },
        tenant
      })
    });
  });
  await page.route('**/branding/*', (route) => {
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        logoUrl: '/default-logo.svg',
        primaryColor: '#0f766e',
        backgroundColor: '#ecfdf5'
      })
    });
  });
}
