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
import { normalizeEndpoint } from '../src/core/endpoint-normalize.mjs';

const NOW = new Date('2024-01-15T12:00:00.000Z');

const waitForFinalize = async (iterations = 3) => {
  for (let i = 0; i < iterations; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

const fetchAnalytics = async (db, tenantId, { from, to, groupBy = 'day' }) => {
  const toExclusive = new Date(to.getTime() + 1);
  const fromIso = from.toISOString();
  const toIso = toExclusive.toISOString();
  const groupByParam = groupBy.toLowerCase();

  const totalsResult = await db.query(
    `SELECT
        date_trunc($4::text, occurred_at) AS bucket,
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE status_code BETWEEN 200 AND 299)::bigint AS success_count,
        COUNT(*) FILTER (WHERE status_code BETWEEN 400 AND 499)::bigint AS errors_4xx,
        COUNT(*) FILTER (WHERE status_code BETWEEN 500 AND 599)::bigint AS errors_5xx
      FROM api_events
      WHERE tenant_id = $1
        AND occurred_at >= $2::timestamptz
        AND occurred_at < $3::timestamptz
      GROUP BY bucket
      ORDER BY bucket ASC;`,
    [tenantId, fromIso, toIso, groupByParam],
  );

  const totals = totalsResult.rows.map((row) => {
    const bucketDate = row.bucket instanceof Date ? row.bucket : new Date(row.bucket);
    const total = Number(row.total || 0);
    const success = Number(row.success_count || 0);
    const errors4xx = Number(row.errors_4xx || 0);
    const errors5xx = Number(row.errors_5xx || 0);
    const errors = { '4xx': errors4xx, '5xx': errors5xx };

    return {
      bucket: bucketDate.toISOString(),
      total,
      success,
      errors,
      successRate: total > 0 ? success / total : 0,
    };
  });

  const aggregate = totals.reduce(
    (acc, row) => {
      acc.total += row.total;
      acc.success += row.success;
      acc.errors['4xx'] += row.errors['4xx'];
      acc.errors['5xx'] += row.errors['5xx'];
      return acc;
    },
    { total: 0, success: 0, errors: { '4xx': 0, '5xx': 0 } },
  );

  const latencyResult = await db.query(
    `WITH durations AS (
        SELECT (metadata->>'duration_ms')::numeric AS value
        FROM api_events
        WHERE tenant_id = $1
          AND occurred_at >= $2::timestamptz
          AND occurred_at < $3::timestamptz
          AND (metadata->>'duration_ms') ~ '^\\d+(?:\\.\\d+)?$'
      )
      SELECT
        AVG(value) AS avg_duration,
        PERCENTILE_DISC(0.95) WITHIN GROUP (ORDER BY value) AS p95_duration
      FROM durations;`,
    [tenantId, fromIso, toIso],
  );

  const latencyRow = latencyResult.rows[0] || {};
  const latency = {
    avg: latencyRow.avg_duration != null ? Number(latencyRow.avg_duration) : null,
    p95: latencyRow.p95_duration != null ? Number(latencyRow.p95_duration) : null,
  };

  const topEndpointsResult = await db.query(
    `SELECT endpoint, COUNT(*)::bigint AS count
      FROM api_events
      WHERE tenant_id = $1
        AND occurred_at >= $2::timestamptz
        AND occurred_at < $3::timestamptz
      GROUP BY endpoint
      ORDER BY count DESC
      LIMIT 20;`,
    [tenantId, fromIso, toIso],
  );

  const endpointAggregates = new Map();
  for (const row of topEndpointsResult.rows) {
    const rawEndpoint = typeof row.endpoint === 'string' ? row.endpoint : '/';
    let normalized;
    try {
      normalized = normalizeEndpoint(rawEndpoint);
    } catch (error) {
      normalized = rawEndpoint || '/';
    }
    const current = endpointAggregates.get(normalized) ?? 0;
    endpointAggregates.set(normalized, current + Number(row.count || 0));
  }

  const topEndpoints = Array.from(endpointAggregates.entries())
    .map(([endpoint, count]) => ({ endpoint, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totals,
    successRate: aggregate.total > 0 ? aggregate.success / aggregate.total : 0,
    errors: aggregate.errors,
    latency,
    topEndpoints,
  };
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
