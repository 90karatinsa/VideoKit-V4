import { jest } from '@jest/globals';
import {
  configureBilling,
  isWrite,
  isBillable,
  operationWeight,
  incrementUsageAtomic,
} from '../middleware/billing.js';
import { MockDb, MockRedis } from './helpers/mock-db.mjs';

const NOW = new Date('2024-01-15T00:00:00.000Z');

const createBillingContext = () => {
  const db = new MockDb({ now: () => NOW });
  const redis = new MockRedis();
  const logger = { warn: jest.fn(), info: jest.fn(), error: jest.fn() };
  configureBilling({ dbPool: db, redis, now: () => NOW, logger });
  return { db, redis };
};

describe('billing unit helpers', () => {
  test('isWrite respects HTTP method semantics', () => {
    expect(isWrite({ method: 'POST' })).toBe(true);
    expect(isWrite({ method: 'put' })).toBe(true);
    expect(isWrite({ method: 'GET' })).toBe(false);
    expect(isWrite({ method: 'OPTIONS' })).toBe(false);
    expect(isWrite({ method: 'HEAD' })).toBe(false);
  });

  test('isBillable ignores GET and non-billable operations', () => {
    const getRequest = { method: 'GET', billing: {} };
    expect(isBillable(getRequest)).toBe(false);

    const managementRequest = {
      method: 'POST',
      route: { path: '/management/keys' },
      billing: {},
    };
    expect(isBillable(managementRequest)).toBe(false);

    const regularPost = {
      method: 'POST',
      route: { path: '/custom' },
      billing: {},
    };
    expect(isBillable(regularPost)).toBe(true);
  });

  test('operationWeight honors defaults, overrides, and minimums', () => {
    const verifyReq = { method: 'POST', route: { path: '/verify' }, billing: {} };
    expect(operationWeight(verifyReq)).toBe(1);

    const stampReq = { method: 'POST', route: { path: '/stamp' }, billing: {} };
    expect(operationWeight(stampReq)).toBe(5);

    const overridden = {
      method: 'POST',
      route: { path: '/custom' },
      billing: {
        quota: {
          endpointOverrides: {
            '/custom': { weight: 3 },
          },
        },
      },
    };
    expect(operationWeight(overridden)).toBe(3);

    const negativeOverride = {
      method: 'POST',
      route: { path: '/custom' },
      billing: {
        quota: {
          endpointOverrides: {
            '/custom': { weight: -10 },
          },
        },
      },
    };
    expect(operationWeight(negativeOverride)).toBe(1);
  });

  test('incrementUsageAtomic increments counters via Postgres fallback', async () => {
    const { db } = createBillingContext();
    const period = '2024-01';

    const first = await incrementUsageAtomic('tenant-a', '/write', 2, period, { limit: 10 });
    expect(first).toEqual(
      expect.objectContaining({ allowed: true, total: 2, endpointUsage: 2, totalCount: 1, endpointCount: 1 }),
    );

    const second = await incrementUsageAtomic('tenant-a', '/write', 1, period, { limit: 10 });
    expect(second).toEqual(
      expect.objectContaining({ allowed: true, total: 3, endpointUsage: 3, totalCount: 2, endpointCount: 2 }),
    );

    expect(db.getTotalUsage('tenant-a')).toBe(3);
    expect(db.getUsage('tenant-a', '/write')).toBe(2);
  });

  test('incrementUsageAtomic enforces limits before incrementing', async () => {
    createBillingContext();
    const period = '2024-01';

    await incrementUsageAtomic('tenant-b', '/write', 4, period, { limit: 5 });
    const denied = await incrementUsageAtomic('tenant-b', '/write', 2, period, { limit: 5 });

    expect(denied.allowed).toBe(false);
    expect(denied.total).toBe(4);
    expect(denied.endpointUsage).toBe(4);
  });
});
