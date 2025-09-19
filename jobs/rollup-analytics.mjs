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
      bucket_ts timestamptz NOT NULL,
      tenant_id text NOT NULL,
      endpoint text NOT NULL,
      calls bigint NOT NULL DEFAULT 0,
      success bigint NOT NULL DEFAULT 0,
      errors4xx bigint NOT NULL DEFAULT 0,
      errors5xx bigint NOT NULL DEFAULT 0,
      avg_ms integer,
      p95_ms integer,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      PRIMARY KEY (bucket_ts, tenant_id, endpoint)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS api_events_rollup_daily (
      bucket_ts timestamptz NOT NULL,
      tenant_id text NOT NULL,
      endpoint text NOT NULL,
      calls bigint NOT NULL DEFAULT 0,
      success bigint NOT NULL DEFAULT 0,
      errors4xx bigint NOT NULL DEFAULT 0,
      errors5xx bigint NOT NULL DEFAULT 0,
      avg_ms integer,
      p95_ms integer,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      PRIMARY KEY (bucket_ts, tenant_id, endpoint)
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

const quoteIdent = (identifier) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
    throw new Error(`Invalid identifier: ${identifier}`);
  }
  return `"${identifier}"`;
};

const buildDurationClause = ({ metadataColumn, durationColumn }) => {
  if (metadataColumn) {
    const metadataIdent = quoteIdent(metadataColumn);
    return `(
      CASE
        WHEN ${metadataIdent} ? 'duration_ms' AND ${metadataIdent}->>'duration_ms' ~ '^\\\d+(?:\\.\\d+)?$'
        THEN (${metadataIdent}->>'duration_ms')::numeric
        ELSE NULL
      END
    )`;
  }
  if (durationColumn) {
    const durationIdent = quoteIdent(durationColumn);
    return `${durationIdent}::numeric`;
  }
  return 'NULL';
};

async function resolveEventSchema(client) {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'api_events'`,
  );
  const columns = new Set(rows.map((row) => row.column_name));

  const timestampColumn = columns.has('occurred_at') ? 'occurred_at' : columns.has('ts') ? 'ts' : null;
  if (!timestampColumn) {
    throw new Error('api_events table is missing occurred_at/ts timestamp columns required for rollups.');
  }

  const endpointColumn = columns.has('endpoint') ? 'endpoint' : columns.has('endpoint_norm') ? 'endpoint_norm' : null;
  if (!endpointColumn) {
    throw new Error('api_events table is missing endpoint or endpoint_norm columns required for rollups.');
  }

  const statusColumn = columns.has('status_code') ? 'status_code' : columns.has('status') ? 'status' : null;
  if (!statusColumn) {
    throw new Error('api_events table is missing status/status_code columns required for rollups.');
  }

  const metadataColumn = columns.has('metadata') ? 'metadata' : null;
  const durationColumn = columns.has('duration_ms') ? 'duration_ms' : null;

  const durationClause = buildDurationClause({ metadataColumn, durationColumn });

  return {
    timestampColumn,
    timestampIdent: quoteIdent(timestampColumn),
    endpointSelect: `${quoteIdent(endpointColumn)} AS endpoint`,
    endpointGroup: quoteIdent(endpointColumn),
    statusIdent: quoteIdent(statusColumn),
    durationClause,
  };
}

async function rollupHourly(client, schema) {
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
        date_trunc('hour', ${schema.timestampIdent}) AS bucket,
        tenant_id,
        ${schema.endpointSelect},
        COUNT(*)::bigint AS calls,
        COUNT(*) FILTER (WHERE ${schema.statusIdent} BETWEEN 200 AND 299)::bigint AS success,
        COUNT(*) FILTER (WHERE ${schema.statusIdent} BETWEEN 400 AND 499)::bigint AS errors4xx,
        COUNT(*) FILTER (WHERE ${schema.statusIdent} BETWEEN 500 AND 599)::bigint AS errors5xx,
        AVG(${schema.durationClause}) AS avg_duration_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${schema.durationClause})
          FILTER (WHERE ${schema.durationClause} IS NOT NULL) AS p95_duration_ms
      FROM api_events
      WHERE ${schema.timestampIdent} >= $1::timestamptz
        AND ${schema.timestampIdent} < $2::timestamptz
      GROUP BY bucket, tenant_id, ${schema.endpointGroup}
      ORDER BY bucket, tenant_id, endpoint`,
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
      const endpoint = row.endpoint;
      if (!tenantId || !endpoint || !bucket) continue;
      const params = [
        bucket,
        tenantId,
        endpoint,
        Number(row.calls || 0),
        Number(row.success || 0),
        Number(row.errors4xx || 0),
        Number(row.errors5xx || 0),
        row.avg_duration_ms != null && Number.isFinite(Number(row.avg_duration_ms))
          ? Math.round(Number(row.avg_duration_ms))
          : null,
        row.p95_duration_ms != null && Number.isFinite(Number(row.p95_duration_ms))
          ? Math.round(Number(row.p95_duration_ms))
          : null,
      ];

      await client.query(
        `INSERT INTO api_events_rollup_hourly (
           bucket_ts, tenant_id, endpoint, calls, success, errors4xx, errors5xx, avg_ms, p95_ms, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (bucket_ts, tenant_id, endpoint)
         DO UPDATE SET calls = EXCLUDED.calls,
                       success = EXCLUDED.success,
                       errors4xx = EXCLUDED.errors4xx,
                       errors5xx = EXCLUDED.errors5xx,
                       avg_ms = EXCLUDED.avg_ms,
                       p95_ms = EXCLUDED.p95_ms,
                       updated_at = NOW()`,
        params,
      );
      seenBuckets.add(`${bucket.toISOString()}::${tenantId}::${endpoint}`);
    }

    await updateRollupState(client, 'hourly', cutoff.toISOString());
    await client.query('COMMIT');
    return { buckets: seenBuckets.size };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function rollupDaily(client, schema) {
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
        date_trunc('day', ${schema.timestampIdent}) AS bucket,
        tenant_id,
        ${schema.endpointSelect},
        COUNT(*)::bigint AS calls,
        COUNT(*) FILTER (WHERE ${schema.statusIdent} BETWEEN 200 AND 299)::bigint AS success,
        COUNT(*) FILTER (WHERE ${schema.statusIdent} BETWEEN 400 AND 499)::bigint AS errors4xx,
        COUNT(*) FILTER (WHERE ${schema.statusIdent} BETWEEN 500 AND 599)::bigint AS errors5xx,
        AVG(${schema.durationClause}) AS avg_duration_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${schema.durationClause})
          FILTER (WHERE ${schema.durationClause} IS NOT NULL) AS p95_duration_ms
      FROM api_events
      WHERE ${schema.timestampIdent} >= $1::timestamptz
        AND ${schema.timestampIdent} < $2::timestamptz
      GROUP BY bucket, tenant_id, ${schema.endpointGroup}
      ORDER BY bucket, tenant_id, endpoint`,
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
      const endpoint = row.endpoint;
      if (!tenantId || !endpoint || !bucket) continue;
      const params = [
        bucket,
        tenantId,
        endpoint,
        Number(row.calls || 0),
        Number(row.success || 0),
        Number(row.errors4xx || 0),
        Number(row.errors5xx || 0),
        row.avg_duration_ms != null && Number.isFinite(Number(row.avg_duration_ms))
          ? Math.round(Number(row.avg_duration_ms))
          : null,
        row.p95_duration_ms != null && Number.isFinite(Number(row.p95_duration_ms))
          ? Math.round(Number(row.p95_duration_ms))
          : null,
      ];

      await client.query(
        `INSERT INTO api_events_rollup_daily (
           bucket_ts, tenant_id, endpoint, calls, success, errors4xx, errors5xx, avg_ms, p95_ms, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (bucket_ts, tenant_id, endpoint)
         DO UPDATE SET calls = EXCLUDED.calls,
                       success = EXCLUDED.success,
                       errors4xx = EXCLUDED.errors4xx,
                       errors5xx = EXCLUDED.errors5xx,
                       avg_ms = EXCLUDED.avg_ms,
                       p95_ms = EXCLUDED.p95_ms,
                       updated_at = NOW()`,
        params,
      );
      seenBuckets.add(`${bucket.toISOString()}::${tenantId}::${endpoint}`);
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

      const schema = await resolveEventSchema(client);
      const hourly = await rollupHourly(client, schema);
      const daily = await rollupDaily(client, schema);

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

