import pg from 'pg';

import config, { initialize as initializeConfig } from '../config.js';

const ADVISORY_LOCK_KEY = 0x707572676501; // "purge" in hex with suffix
const ROLLUP_PURGE_ENV_KEYS = ['ROLLUP_PURGE_ENABLED', 'PURGE_ROLLUPS', 'ENABLE_ROLLUP_PURGE'];

const coerceBoolean = (value) => {
  if (value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
};

async function acquireLock(client) {
  const { rows } = await client.query('SELECT pg_try_advisory_lock($1::bigint) AS locked', [ADVISORY_LOCK_KEY.toString()]);
  const locked = rows[0]?.locked === true;
  if (!locked) {
    console.warn('[purge] Unable to obtain advisory lock. Another instance may be running.');
  }
  return locked;
}

async function releaseLock(client) {
  try {
    await client.query('SELECT pg_advisory_unlock($1::bigint)', [ADVISORY_LOCK_KEY.toString()]);
  } catch (error) {
    console.warn('[purge] Failed to release advisory lock.', error);
  }
}

async function tableExists(client, tableName) {
  const { rows } = await client.query('SELECT to_regclass($1) AS table_name', [tableName]);
  return Boolean(rows[0]?.table_name);
}

async function purgeApiEvents(client) {
  const { rowCount } = await client.query(
    'DELETE FROM api_events WHERE occurred_at < NOW() - INTERVAL \'90 days\'',
  );
  console.log(`[purge] Removed ${rowCount} api_events rows older than 90 days.`);
}

async function purgeRollups(client) {
  const shouldPurge = ROLLUP_PURGE_ENV_KEYS.some((key) => coerceBoolean(process.env[key]));
  if (!shouldPurge) {
    console.log('[purge] Rollup purge disabled. Set ROLLUP_PURGE_ENABLED=1 to enable.');
    return;
  }

  const now = new Date();
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 12);

  const cutoffTimestamp = cutoff.toISOString();
  const cutoffDate = cutoffTimestamp.slice(0, 10);

  const hourlyExists = await tableExists(client, 'api_events_rollup_hourly');
  const dailyExists = await tableExists(client, 'api_events_rollup_daily');

  if (!hourlyExists && !dailyExists) {
    console.log('[purge] No rollup tables found. Skipping rollup purge.');
    return;
  }

  let hourlyDeleted = 0;
  let dailyDeleted = 0;

  if (hourlyExists) {
    const result = await client.query(
      'DELETE FROM api_events_rollup_hourly WHERE bucket_start < $1::timestamptz',
      [cutoffTimestamp],
    );
    hourlyDeleted = result.rowCount || 0;
  }

  if (dailyExists) {
    const result = await client.query(
      'DELETE FROM api_events_rollup_daily WHERE bucket_date < $1::date',
      [cutoffDate],
    );
    dailyDeleted = result.rowCount || 0;
  }

  console.log(`[purge] Removed ${hourlyDeleted} hourly and ${dailyDeleted} daily rollup rows older than 12 months.`);
}

async function main() {
  try {
    await initializeConfig();

    const pool = new pg.Pool({ connectionString: config.database.connectionString });
    const client = await pool.connect();
    let lockAcquired = false;

    try {
      lockAcquired = await acquireLock(client);
      if (!lockAcquired) {
        return;
      }

      await purgeApiEvents(client);
      await purgeRollups(client);
    } finally {
      if (lockAcquired) {
        await releaseLock(client);
      }
      client.release();
      await pool.end();
    }
  } catch (error) {
    console.error('[purge] Job failed:', error);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

