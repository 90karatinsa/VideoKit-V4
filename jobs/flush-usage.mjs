import pg from 'pg';
import Redis from 'ioredis';

import config, { initialize as initializeConfig } from '../config.js';

const TOTAL_FIELD = '__total__';
const ENDPOINT_PREFIX = 'op:';
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

const normalizeEndpointField = (field) => {
  if (field === TOTAL_FIELD) return TOTAL_FIELD;
  if (field.startsWith(ENDPOINT_PREFIX)) {
    return field.slice(ENDPOINT_PREFIX.length);
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
  const updates = [];

  for (const [field, value] of fields) {
    const endpoint = normalizeEndpointField(field);
    if (!endpoint) continue;
    const count = parseCount(value);
    if (count == null) continue;
    updates.push({ endpoint, count });
  }

  if (!updates.length) {
    return { processed: true, upserts: 0 };
  }

  await client.query('BEGIN');
  try {
    let upserts = 0;
    for (const update of updates) {
      await client.query(
        `INSERT INTO usage_counters (tenant_id, endpoint, period_start, call_count, last_updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (tenant_id, endpoint, period_start)
         DO UPDATE SET call_count = GREATEST(usage_counters.call_count, EXCLUDED.call_count),
                       last_updated_at = NOW()`,
        [tenantId, update.endpoint, periodStart, update.count],
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

