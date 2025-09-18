# T17f — Background Jobs Execution Log

## Flush Usage (Redis → Postgres)

```bash
$ npm run job:flush-usage
[flush-usage] Completed. processedKeys=2, upserts=5
```

Post-run verification of the `usage_counters` table shows the Redis keys were persisted:

```sql
SELECT tenant_id, endpoint, period_start, call_count, total_weight
FROM usage_counters
ORDER BY tenant_id, endpoint;
```

```
tenant_E_111 | /verify     | 2025-09-01 | 10 | 0
tenant_E_111 | __total__   | 2025-09-01 | 10 | 0
tenant_FLUSH_DEMO | GET_/usage | 2025-09-01 | 12 | 0
tenant_FLUSH_DEMO | POST_/verify | 2025-09-01 | 3 | 0
tenant_FLUSH_DEMO | __total__ | 2025-09-01 | 15 | 0
```

## Analytics Rollup

```bash
$ npm run job:rollup-analytics
[rollup-analytics] Completed. hourlyBuckets=0, dailyBuckets=0
```

The hourly rollup table retains prior aggregates for inspection:

```sql
SELECT tenant_id, bucket_start, total_count, success_count, error_4xx_count, error_5xx_count
FROM api_events_rollup_hourly
ORDER BY bucket_start DESC, tenant_id
LIMIT 3;
```

```
tenant_FLUSH_DEMO | 2025-09-18 16:00:00+00 | 1 | 0 | 0 | 1
tenant_FLUSH_DEMO | 2025-09-18 15:00:00+00 | 1 | 1 | 0 | 0
tenant_FLUSH_DEMO | 2025-09-18 14:00:00+00 | 1 | 1 | 0 | 0
```

## Purge (Dry-Run)

```bash
$ npm run job:purge -- --dry-run
[purge] Dry run enabled. Database changes will be skipped.
[purge] DRY RUN: 0 api_events rows older than 90 days would be removed.
[purge] DRY RUN: 0 hourly and 0 daily rollup rows older than 12 months would be removed.
```

## Purge (Execution)

```bash
$ npm run job:purge
[purge] Removed 0 api_events rows older than 90 days.
[purge] Removed 0 hourly and 0 daily rollup rows older than 12 months.
```

Row counts after the real purge confirm no unintended deletions:

```sql
SELECT
  (SELECT COUNT(*) FROM api_events) AS api_events,
  (SELECT COUNT(*) FROM api_events_rollup_hourly) AS hourly_rollups,
  (SELECT COUNT(*) FROM api_events_rollup_daily) AS daily_rollups;
```

```
api_events | hourly_rollups | daily_rollups
31         | 3              | 0
```
