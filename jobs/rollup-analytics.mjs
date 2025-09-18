import pg from 'pg';

import config, { initialize as initializeConfig } from '../config.js';

const ADVISORY_LOCK_KEY = 0x726f6c6c757001; // "rollup" in hex with suffix
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const parseTimestamp = (value, fallback = new Date(0)) => {
  if (!value) return new Date(fallback);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date(fallback);
  }
  return date;
};

async function acquireLock(client) {
  const { rows } = await client.query('SELECT pg_try_advisory_lock($1::bigint) AS locked', [ADVISORY_LOCK_KEY.toString()]);
  const locked = rows[0]?.locked === true;
  if (!locked) {
    console.warn('[rollup-analytics] Unable to obtain advisory lock. Another instance may be running.');
  }
  return locked;
}

async function releaseLock(client) {
  try {
    await client.query('SELECT pg_advisory_unlock($1::bigint)', [ADVISORY_LOCK_KEY.toString()]);
  } catch (error) {
    console.warn('[rollup-analytics] Failed to release advisory lock.', error);
  }
}

async function ensureTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS analytics_rollup_state (
      rollup_type text PRIMARY KEY,
      last_processed_at timestamptz NOT NULL
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS api_events_rollup_hourly (
      tenant_id text NOT NULL,
      bucket_start timestamptz NOT NULL,
      total_count bigint NOT NULL,
      success_count bigint NOT NULL,
      error_4xx_count bigint NOT NULL,
      error_5xx_count bigint NOT NULL,
      avg_duration_ms double precision,
      p95_duration_ms double precision,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      PRIMARY KEY (tenant_id, bucket_start)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS api_events_rollup_daily (
      tenant_id text NOT NULL,
      bucket_date date NOT NULL,
      total_count bigint NOT NULL,
      success_count bigint NOT NULL,
      error_4xx_count bigint NOT NULL,
      error_5xx_count bigint NOT NULL,
      avg_duration_ms double precision,
      p95_duration_ms double precision,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      PRIMARY KEY (tenant_id, bucket_date)
    );
  `);
}

async function getRollupState(client, rollupType) {
  const { rows } = await client.query(
    'SELECT last_processed_at FROM analytics_rollup_state WHERE rollup_type = $1',
    [rollupType],
  );
  return parseTimestamp(rows[0]?.last_processed_at);
}

async function updateRollupState(client, rollupType, timestamp) {
  await client.query(
    `INSERT INTO analytics_rollup_state (rollup_type, last_processed_at)
     VALUES ($1, $2)
     ON CONFLICT (rollup_type) DO UPDATE SET last_processed_at = EXCLUDED.last_processed_at`,
    [rollupType, timestamp],
  );
}

const numericDurationClause = `(
  CASE
    WHEN metadata ? 'duration_ms' AND metadata->>'duration_ms' ~ '^\\d+(?:\\.\\d+)?$'
    THEN (metadata->>'duration_ms')::numeric
    ELSE NULL
  END
)`;

async function rollupHourly(client) {
  const state = await getRollupState(client, 'hourly');
  const now = new Date();
  const cutoff = new Date(Math.floor((now.getTime() - 5 * 60 * 1000) / HOUR_MS) * HOUR_MS);

  if (cutoff <= state) {
    await updateRollupState(client, 'hourly', cutoff);
    return { buckets: 0 };
  }

  const start = new Date(Math.max(0, state.getTime() - HOUR_MS));
  const { rows } = await client.query(
    `SELECT
        date_trunc('hour', occurred_at) AS bucket,
        tenant_id,
        COUNT(*)::bigint AS total_count,
        COUNT(*) FILTER (WHERE status_code BETWEEN 200 AND 299)::bigint AS success_count,
        COUNT(*) FILTER (WHERE status_code BETWEEN 400 AND 499)::bigint AS error_4xx_count,
        COUNT(*) FILTER (WHERE status_code BETWEEN 500 AND 599)::bigint AS error_5xx_count,
        AVG(${numericDurationClause}) AS avg_duration_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${numericDurationClause})
          FILTER (WHERE ${numericDurationClause} IS NOT NULL) AS p95_duration_ms
      FROM api_events
      WHERE occurred_at >= $1::timestamptz
        AND occurred_at < $2::timestamptz
      GROUP BY bucket, tenant_id
      ORDER BY bucket, tenant_id`,
    [start.toISOString(), cutoff.toISOString()],
  );

  if (!rows.length) {
    await updateRollupState(client, 'hourly', cutoff);
    return { buckets: 0 };
  }

  await client.query('BEGIN');
  try {
    const seenBuckets = new Set();
    for (const row of rows) {
      const bucket = parseTimestamp(row.bucket);
      const tenantId = row.tenant_id;
      if (!tenantId || !bucket) continue;
      const params = [
        tenantId,
        bucket,
        Number(row.total_count || 0),
        Number(row.success_count || 0),
        Number(row.error_4xx_count || 0),
        Number(row.error_5xx_count || 0),
        row.avg_duration_ms != null ? Number(row.avg_duration_ms) : null,
        row.p95_duration_ms != null ? Number(row.p95_duration_ms) : null,
      ];

      await client.query(
        `INSERT INTO api_events_rollup_hourly (
           tenant_id, bucket_start, total_count, success_count, error_4xx_count, error_5xx_count, avg_duration_ms, p95_duration_ms, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (tenant_id, bucket_start)
         DO UPDATE SET total_count = EXCLUDED.total_count,
                       success_count = EXCLUDED.success_count,
                       error_4xx_count = EXCLUDED.error_4xx_count,
                       error_5xx_count = EXCLUDED.error_5xx_count,
                       avg_duration_ms = EXCLUDED.avg_duration_ms,
                       p95_duration_ms = EXCLUDED.p95_duration_ms,
                       updated_at = NOW()`,
        params,
      );
      seenBuckets.add(bucket.toISOString());
    }

    await updateRollupState(client, 'hourly', cutoff.toISOString());
    await client.query('COMMIT');
    return { buckets: seenBuckets.size };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function rollupDaily(client) {
  const state = await getRollupState(client, 'daily');
  const now = new Date();
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  if (cutoff <= state) {
    await updateRollupState(client, 'daily', cutoff);
    return { buckets: 0 };
  }

  const start = new Date(Math.max(0, state.getTime() - DAY_MS));
  const { rows } = await client.query(
    `SELECT
        date_trunc('day', occurred_at) AS bucket,
        tenant_id,
        COUNT(*)::bigint AS total_count,
        COUNT(*) FILTER (WHERE status_code BETWEEN 200 AND 299)::bigint AS success_count,
        COUNT(*) FILTER (WHERE status_code BETWEEN 400 AND 499)::bigint AS error_4xx_count,
        COUNT(*) FILTER (WHERE status_code BETWEEN 500 AND 599)::bigint AS error_5xx_count,
        AVG(${numericDurationClause}) AS avg_duration_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${numericDurationClause})
          FILTER (WHERE ${numericDurationClause} IS NOT NULL) AS p95_duration_ms
      FROM api_events
      WHERE occurred_at >= $1::timestamptz
        AND occurred_at < $2::timestamptz
      GROUP BY bucket, tenant_id
      ORDER BY bucket, tenant_id`,
    [start.toISOString(), cutoff.toISOString()],
  );

  if (!rows.length) {
    await updateRollupState(client, 'daily', cutoff);
    return { buckets: 0 };
  }

  await client.query('BEGIN');
  try {
    const seenBuckets = new Set();
    for (const row of rows) {
      const bucket = parseTimestamp(row.bucket);
      const tenantId = row.tenant_id;
      if (!tenantId || !bucket) continue;
      const bucketDate = bucket.toISOString().slice(0, 10);
      const params = [
        tenantId,
        bucketDate,
        Number(row.total_count || 0),
        Number(row.success_count || 0),
        Number(row.error_4xx_count || 0),
        Number(row.error_5xx_count || 0),
        row.avg_duration_ms != null ? Number(row.avg_duration_ms) : null,
        row.p95_duration_ms != null ? Number(row.p95_duration_ms) : null,
      ];

      await client.query(
        `INSERT INTO api_events_rollup_daily (
           tenant_id, bucket_date, total_count, success_count, error_4xx_count, error_5xx_count, avg_duration_ms, p95_duration_ms, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (tenant_id, bucket_date)
         DO UPDATE SET total_count = EXCLUDED.total_count,
                       success_count = EXCLUDED.success_count,
                       error_4xx_count = EXCLUDED.error_4xx_count,
                       error_5xx_count = EXCLUDED.error_5xx_count,
                       avg_duration_ms = EXCLUDED.avg_duration_ms,
                       p95_duration_ms = EXCLUDED.p95_duration_ms,
                       updated_at = NOW()`,
        params,
      );
      seenBuckets.add(bucketDate);
    }

    await updateRollupState(client, 'daily', cutoff.toISOString());
    await client.query('COMMIT');
    return { buckets: seenBuckets.size };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  try {
    await initializeConfig();

    const pool = new pg.Pool({ connectionString: config.database.connectionString });
    const client = await pool.connect();
    let lockAcquired = false;

    try {
      await ensureTables(client);
      lockAcquired = await acquireLock(client);
      if (!lockAcquired) {
        return;
      }

      const hourly = await rollupHourly(client);
      const daily = await rollupDaily(client);

      console.log(
        `[rollup-analytics] Completed. hourlyBuckets=${hourly.buckets}, dailyBuckets=${daily.buckets}`,
      );
    } finally {
      if (lockAcquired) {
        await releaseLock(client);
      }
      client.release();
      await pool.end();
    }
  } catch (error) {
    console.error('[rollup-analytics] Job failed:', error);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

