import pg from 'pg';

import config, { initialize as initializeConfig } from '../config.js';

const ADVISORY_LOCK_KEY = 0x707572676501; // "purge" in hex with suffix
const ROLLUP_PURGE_ENV_KEYS = ['ROLLUP_PURGE_ENABLED', 'PURGE_ROLLUPS', 'ENABLE_ROLLUP_PURGE'];

const coerceBoolean = (value) => {
  if (value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
};

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run')
  || args.has('-n')
  || coerceBoolean(process.env.PURGE_DRY_RUN)
  || coerceBoolean(process.env.DRY_RUN);

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

async function purgeApiEvents(client, options = {}) {
  const { dryRun: dry } = options;

  if (dry) {
    const { rows } = await client.query(
      'SELECT COUNT(*)::bigint AS count FROM api_events WHERE occurred_at < NOW() - INTERVAL \'90 days\'',
    );
    const count = Number(rows[0]?.count || 0);
    console.log(`[purge] DRY RUN: ${count} api_events rows older than 90 days would be removed.`);
    return { deleted: 0, wouldDelete: count };
  }

  const { rowCount } = await client.query(
    'DELETE FROM api_events WHERE occurred_at < NOW() - INTERVAL \'90 days\'',
  );
  console.log(`[purge] Removed ${rowCount} api_events rows older than 90 days.`);
  return { deleted: rowCount, wouldDelete: rowCount };
}

async function purgeRollups(client, options = {}) {
  const { dryRun: dry } = options;
  const shouldPurge = ROLLUP_PURGE_ENV_KEYS.some((key) => coerceBoolean(process.env[key]));
  if (!shouldPurge) {
    console.log('[purge] Rollup purge disabled. Set ROLLUP_PURGE_ENABLED=1 to enable.');
    return { hourly: 0, daily: 0, wouldHourly: 0, wouldDaily: 0 };
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
    return { hourly: 0, daily: 0, wouldHourly: 0, wouldDaily: 0 };
  }

  let hourlyDeleted = 0;
  let dailyDeleted = 0;

  if (dry) {
    if (hourlyExists) {
      const { rows } = await client.query(
        'SELECT COUNT(*)::bigint AS count FROM api_events_rollup_hourly WHERE bucket_start < $1::timestamptz',
        [cutoffTimestamp],
      );
      hourlyDeleted = Number(rows[0]?.count || 0);
    }

    if (dailyExists) {
      const { rows } = await client.query(
        'SELECT COUNT(*)::bigint AS count FROM api_events_rollup_daily WHERE bucket_date < $1::date',
        [cutoffDate],
      );
      dailyDeleted = Number(rows[0]?.count || 0);
    }

    console.log(`[purge] DRY RUN: ${hourlyDeleted} hourly and ${dailyDeleted} daily rollup rows older than 12 months would be removed.`);
    return { hourly: 0, daily: 0, wouldHourly: hourlyDeleted, wouldDaily: dailyDeleted };
  }

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
  return { hourly: hourlyDeleted, daily: dailyDeleted, wouldHourly: hourlyDeleted, wouldDaily: dailyDeleted };
}

async function main() {
  try {
    await initializeConfig();

    if (dryRun) {
      console.log('[purge] Dry run enabled. Database changes will be skipped.');
    }

    const pool = new pg.Pool({ connectionString: config.database.connectionString });
    const client = await pool.connect();
    let lockAcquired = false;

    try {
      lockAcquired = await acquireLock(client);
      if (!lockAcquired) {
        return;
      }

      await purgeApiEvents(client, { dryRun });
      await purgeRollups(client, { dryRun });
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

