import express from 'express';
import request from 'supertest';

import {
  configureBilling,
  enforceQuota,
  finalizeAndLog,
  startTimer,
} from '../../middleware/billing.js';
import { MockDb, MockRedis } from '../../__tests__/helpers/mock-db.mjs';

const NOW = new Date('2024-01-15T12:00:00.000Z');

const waitForFinalize = async (iterations = 3) => {
  for (let i = 0; i < iterations; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

const createTestEnvironment = ({ limitsByTenant = { default: 1 } } = {}) => {
  const db = new MockDb({ now: () => NOW });
  const redis = new MockRedis();
  const logger = { warn: () => {}, info: () => {}, error: () => {} };

  configureBilling({ dbPool: db, redis, now: () => NOW, logger });

  const app = express();
  app.use(express.json());

  const getLimitForTenant = (tenantId) => {
    if (tenantId in limitsByTenant) return limitsByTenant[tenantId];
    if ('default' in limitsByTenant) return limitsByTenant.default;
    return null;
  };

  app.use((req, res, next) => {
    const tenantId = req.get('X-Tenant-Id') || 'tenant-a';
    const limit = getLimitForTenant(tenantId);

    req.tenant = { id: tenantId };
    req.billing = {
      quota: { limit },
    };
    req.log = { warn: () => {}, error: () => {} };

    if (!req.billing.__billingFinalizeAttached) {
      finalizeAndLog(req, res);
      req.billing.__billingFinalizeAttached = true;
    }

    next();
  });

  app.use(startTimer);

  app.post('/write', enforceQuota, (req, res) => {
    res.status(200).json({ ok: true });
  });

  app.get('/write', enforceQuota, (req, res) => {
    res.status(200).json({ ok: true });
  });

  return { app, db };
};

const logJson = (label, payload) => {
  const content = JSON.stringify(payload, null, 2);
  console.log(`${label}:`);
  console.log(content);
};

const main = async () => {
  const { app, db } = createTestEnvironment({ limitsByTenant: { default: 1 } });

  console.log('--- Scenario: POST /write below limit ---');
  const first = await request(app).post('/write').send({ sample: 'payload' });
  await waitForFinalize();
  logJson('Response', {
    status: first.status,
    headers: { 'x-quota-remaining': first.headers['x-quota-remaining'] },
    body: first.body,
  });
  logJson('Usage counters', {
    total: db.getTotalUsage('tenant-a'),
    endpoint: db.getUsage('tenant-a', '/write'),
  });

  console.log('\n--- Scenario: POST /write above limit ---');
  const second = await request(app).post('/write').send({ sample: 'payload' });
  await waitForFinalize();
  logJson('Response', {
    status: second.status,
    body: second.body,
  });
  logJson('Usage counters', {
    total: db.getTotalUsage('tenant-a'),
    endpoint: db.getUsage('tenant-a', '/write'),
  });

  console.log('\n--- Scenario: GET /write while quota exceeded ---');
  const third = await request(app).get('/write');
  await waitForFinalize();
  logJson('Response', {
    status: third.status,
    body: third.body,
  });
  logJson('Usage counters', {
    total: db.getTotalUsage('tenant-a'),
    endpoint: db.getUsage('tenant-a', '/write'),
  });
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
