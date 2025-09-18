import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import {
  configureBilling,
  startTimer,
  enforceQuota,
  finalizeAndLog,
} from '../middleware/billing.js';
import { MockDb, MockRedis } from './helpers/mock-db.mjs';
import { fetchAnalytics } from './helpers/analytics.mjs';

const NOW = new Date('2024-01-15T12:00:00.000Z');

const waitForFinalize = async (iterations = 3) => {
  for (let i = 0; i < iterations; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

const createTestEnvironment = ({
  limitsByTenant = { default: 5 },
  endpointOverrides = {},
  writeDelayMs = 0,
} = {}) => {
  const db = new MockDb({ now: () => NOW });
  const redis = new MockRedis();
  const logger = { warn: jest.fn(), info: jest.fn(), error: jest.fn() };
  configureBilling({ dbPool: db, redis, now: () => NOW, logger });

  const app = express();
  app.use(express.json());

  const maybeDelay = async () => {
    if (writeDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, writeDelayMs));
    }
  };

  const getLimitForTenant = (tenantId) => {
    if (tenantId in limitsByTenant) {
      return limitsByTenant[tenantId];
    }
    if ('default' in limitsByTenant) {
      return limitsByTenant.default;
    }
    return null;
  };

  app.use((req, res, next) => {
    const tenantId = req.get('X-Tenant-Id') || 'tenant-a';
    const limit = getLimitForTenant(tenantId);

    req.tenant = { id: tenantId };
    req.billing = {
      quota: {
        limit,
        endpointOverrides,
      },
    };
    req.log = { warn: jest.fn(), error: jest.fn() };

    if (!req.billing.__billingFinalizeAttached) {
      finalizeAndLog(req, res);
      req.billing.__billingFinalizeAttached = true;
    }

    next();
  });

  app.use(startTimer);

  app.post('/write', enforceQuota, async (req, res) => {
    await maybeDelay();
    res.status(200).json({ ok: true });
  });

  app.post('/write-error', enforceQuota, async (req, res) => {
    await maybeDelay();
    res.status(500).json({ ok: false });
  });

  app.get('/write', enforceQuota, (req, res) => {
    res.status(200).json({ ok: true });
  });

  return { app, db, redis };
};

describe('billing integration flows', () => {
  test('allows writes below quota and increments usage counters', async () => {
    const { app, db } = createTestEnvironment({ limitsByTenant: { default: 5 } });

    const response = await request(app).post('/write').send({});
    expect(response.status).toBe(200);
    expect(response.headers['x-quota-remaining']).toBe('4');

    await waitForFinalize();

    expect(db.getTotalUsage('tenant-a')).toBe(1);
    expect(db.getUsage('tenant-a', '/write')).toBe(1);
  });

  test('rejects writes above quota while GET remains free', async () => {
    const { app, db } = createTestEnvironment({ limitsByTenant: { default: 1 } });

    const okResponse = await request(app).post('/write').send({});
    expect(okResponse.status).toBe(200);
    await waitForFinalize();

    const limitedResponse = await request(app).post('/write').send({});
    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.body).toMatchObject({ code: 'QUOTA_EXCEEDED' });

    const getResponse = await request(app).get('/write');
    expect(getResponse.status).toBe(200);

    await waitForFinalize();

    expect(db.getTotalUsage('tenant-a')).toBe(1);
  });

  test('idempotent writes are only billed once', async () => {
    const { app, db } = createTestEnvironment({ limitsByTenant: { default: 3 } });

    const headers = { 'Idempotency-Key': 'idem-123' };
    const first = await request(app).post('/write').set(headers).send({});
    expect(first.status).toBe(200);
    await waitForFinalize();

    const second = await request(app).post('/write').set(headers).send({});
    expect(second.status).toBe(200);

    await waitForFinalize();

    expect(db.getTotalUsage('tenant-a')).toBe(1);
  });

  test('parallel writes with unique idempotency keys increment once per request', async () => {
    const parallelism = 5;
    const { app, db } = createTestEnvironment({
      limitsByTenant: { default: 20 },
      writeDelayMs: 10,
    });

    const responses = await Promise.all(
      Array.from({ length: parallelism }, (_, index) =>
        request(app)
          .post('/write')
          .set('Idempotency-Key', `parallel-${index}`)
          .send({ index })
      )
    );

    for (const response of responses) {
      expect(response.status).toBe(200);
    }

    await waitForFinalize(10);

    expect(db.getTotalUsage('tenant-a')).toBe(parallelism);
  });

  test('parallel writes sharing an idempotency key are billed once', async () => {
    const { app, db } = createTestEnvironment({
      limitsByTenant: { default: 20 },
      writeDelayMs: 10,
    });

    const headers = { 'Idempotency-Key': 'parallel-shared' };

    const responses = await Promise.all(
      Array.from({ length: 3 }, () => request(app).post('/write').set(headers).send({}))
    );

    for (const response of responses) {
      expect(response.status).toBe(200);
    }

    await waitForFinalize(10);

    expect(db.getTotalUsage('tenant-a')).toBe(1);
  });

  test('analytics aggregates real usage data per tenant', async () => {
    const { db } = createTestEnvironment();

    const insertEventSql = `INSERT INTO api_events (tenant_id, endpoint, event_type, status_code, request_id, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)`;

    await db.query(insertEventSql, ['tenant-a', '/write', 'POST', 200, 'req-1', { duration_ms: 45 }]);
    await db.query(insertEventSql, ['tenant-a', '/write', 'POST', 204, 'req-2', { duration_ms: 60 }]);
    await db.query(insertEventSql, ['tenant-a', '/write-error', 'POST', 500, 'req-3', { duration_ms: 120 }]);
    await db.query(insertEventSql, ['tenant-b', '/write', 'POST', 200, 'req-4', { duration_ms: 80 }]);

    const analytics = await fetchAnalytics(db, 'tenant-a', {
      from: new Date('2024-01-01T00:00:00.000Z'),
      to: new Date('2024-01-31T00:00:00.000Z'),
      groupBy: 'day',
    });

    expect(analytics.totals).toHaveLength(1);
    expect(analytics.totals[0].total).toBe(3);
    expect(analytics.totals[0].success).toBe(2);
    expect(analytics.totals[0].errors['5xx']).toBe(1);
    expect(analytics.successRate).toBeCloseTo(2 / 3);
    expect(analytics.errors['4xx']).toBe(0);
    expect(analytics.topEndpoints[0]).toMatchObject({ endpoint: '/write', count: 2 });
  });

  test('usage tracking is isolated per tenant', async () => {
    const { app, db } = createTestEnvironment({ limitsByTenant: { 'tenant-a': 5, 'tenant-b': 5 } });

    await request(app).post('/write').set('X-Tenant-Id', 'tenant-a').send({});
    await waitForFinalize();
    await request(app).post('/write').set('X-Tenant-Id', 'tenant-b').send({});
    await waitForFinalize();

    expect(db.getTotalUsage('tenant-a')).toBe(1);
    expect(db.getTotalUsage('tenant-b')).toBe(1);
  });
});
