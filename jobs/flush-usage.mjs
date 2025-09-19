import pg from 'pg';
import Redis from 'ioredis';

import config, { initialize as initializeConfig } from '../config.js';

const TOTAL_WEIGHT_FIELD = '__total__';
const TOTAL_COUNT_FIELD = '__total_count__';
const ENDPOINT_WEIGHT_PREFIX = 'op:';
const ENDPOINT_COUNT_PREFIX = 'op_count:';
const USAGE_KEY_PATTERN = /^usage:([^:]+):(\d{4}-\d{2})$/;
const ADVISORY_LOCK_KEY = 0x666c75736801; // "flush" in hex with suffix

const monthStartFromKey = (periodKey) => {
  const iso = `${periodKey}-01T00:00:00.000Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid period key: ${periodKey}`);
  }
  return date;
};

const parseCount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }
  return Math.round(numeric);
};

const parseWeight = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }
  return numeric;
};

const classifyField = (field) => {
  if (field === TOTAL_WEIGHT_FIELD) {
    return { scope: 'total', metric: 'weight' };
  }
  if (field === TOTAL_COUNT_FIELD) {
    return { scope: 'total', metric: 'count' };
  }
  if (field.startsWith(ENDPOINT_WEIGHT_PREFIX)) {
    return { scope: 'endpoint', metric: 'weight', endpoint: field.slice(ENDPOINT_WEIGHT_PREFIX.length) };
  }
  if (field.startsWith(ENDPOINT_COUNT_PREFIX)) {
    return { scope: 'endpoint', metric: 'count', endpoint: field.slice(ENDPOINT_COUNT_PREFIX.length) };
  }
  return null;
};

async function acquireLock(client) {
  const { rows } = await client.query('SELECT pg_try_advisory_lock($1::bigint) AS locked', [ADVISORY_LOCK_KEY.toString()]);
  const locked = rows[0]?.locked === true;
  if (!locked) {
    console.warn('[flush-usage] Unable to obtain advisory lock. Another instance may be running.');
  }
  return locked;
}

async function releaseLock(client) {
  try {
    await client.query('SELECT pg_advisory_unlock($1::bigint)', [ADVISORY_LOCK_KEY.toString()]);
  } catch (error) {
    console.warn('[flush-usage] Failed to release advisory lock.', error);
  }
}

async function ensureUsageTable(client) {
  const { rows } = await client.query('SELECT to_regclass($1) AS table_name', ['usage_counters']);
  if (!rows[0]?.table_name) {
    throw new Error('usage_counters table is not available. Run database migrations before executing this job.');
  }
}

async function processUsageKey({ client, redis, key }) {
  const match = USAGE_KEY_PATTERN.exec(key);
  if (!match) {
    return { processed: false, upserts: 0 };
  }

  const [, tenantId, periodKey] = match;
  const values = await redis.hgetall(key);
  const fields = Object.entries(values);
  if (!fields.length) {
    return { processed: true, upserts: 0 };
  }

  const periodStart = monthStartFromKey(periodKey);
  const aggregates = new Map();

  for (const [field, value] of fields) {
    const classification = classifyField(field);
    if (!classification) continue;

    const numeric = classification.metric === 'count' ? parseCount(value) : parseWeight(value);
    if (numeric == null) continue;

    const key = classification.scope === 'total' ? TOTAL_WEIGHT_FIELD : classification.endpoint;
    if (!aggregates.has(key)) {
      aggregates.set(key, { count: null, totalWeight: null });
    }

    const record = aggregates.get(key);
    if (classification.metric === 'count') {
      record.count = Math.max(0, Math.round(numeric));
    } else {
      record.totalWeight = Math.max(0, Math.round(numeric));
    }
  }

  if (!aggregates.size) {
    return { processed: true, upserts: 0 };
  }

  await client.query('BEGIN');
  try {
    let upserts = 0;
    for (const [endpointKey, record] of aggregates.entries()) {
      const endpoint = endpointKey === TOTAL_WEIGHT_FIELD ? TOTAL_WEIGHT_FIELD : endpointKey;
      const countValue = Number.isFinite(record.count) ? record.count : 0;
      const weightValue = Number.isFinite(record.totalWeight) ? record.totalWeight : 0;
      const hasCount = Number.isFinite(record.count);
      const hasWeight = Number.isFinite(record.totalWeight);

      if (!hasCount && !hasWeight) {
        continue;
      }

      await client.query(
        `INSERT INTO usage_counters (tenant_id, endpoint, period_start, count, total_weight)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, endpoint, period_start)
         DO UPDATE SET count = CASE WHEN $6 THEN GREATEST(usage_counters.count, EXCLUDED.count)
                                    ELSE usage_counters.count END,
                       total_weight = CASE WHEN $7 THEN GREATEST(usage_counters.total_weight, EXCLUDED.total_weight)
                                           ELSE usage_counters.total_weight END`,
        [tenantId, endpoint, periodStart, countValue, weightValue, hasCount, hasWeight],
      );
      upserts += 1;
    }
    await client.query('COMMIT');
    return { processed: true, upserts };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  try {
    await initializeConfig();

    const pool = new pg.Pool({ connectionString: config.database.connectionString });
    const redis = new Redis(config.secrets.redisUrl, { lazyConnect: true });
    await redis.connect();

    const client = await pool.connect();
    let lockAcquired = false;
    try {
      await ensureUsageTable(client);
      lockAcquired = await acquireLock(client);
      if (!lockAcquired) {
        return;
      }

      let cursor = '0';
      let processedKeys = 0;
      let totalUpserts = 0;

      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'usage:*', 'COUNT', 200);
        cursor = nextCursor;
        for (const key of keys) {
          const { processed, upserts } = await processUsageKey({ client, redis, key });
          if (processed) {
            processedKeys += 1;
            totalUpserts += upserts;
          }
        }
      } while (cursor !== '0');

      console.log(`[flush-usage] Completed. processedKeys=${processedKeys}, upserts=${totalUpserts}`);
    } finally {
      if (lockAcquired) {
        await releaseLock(client);
      }
      client.release();
      await redis.quit();
      await pool.end();
    }
  } catch (error) {
    console.error('[flush-usage] Job failed:', error);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

