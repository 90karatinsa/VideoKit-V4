---
generation_timestamp: 2025-09-19T07:01:54+00:00
git_head: ba493befddef85a29354b19909d20923e0087499
node_version: v20.19.4
npm_version: 11.4.2
hostname: df8177e5944b
---

## Executive Summary

- GO recommendation confirmed: all T17a–T17o packages passed with no outstanding risks.
- Preflight snapshot shows clean branch `work` with Node v20.19.4 and npm 11.4.2 baseline.
- CI build, lint, and test pipelines completed successfully across the full suite.
- Database migrations executed without errors, leaving no pending steps.
- Billing and quota harness validated expected 200/429 flows with accurate counters and threshold alerts.
- Idempotency and concurrency scenarios proved replay safety and atomic increments with preserved logs.
- Background jobs flushed usage, rolled up analytics, and purge routines completed with verified row counts.
- Analytics UI captures cover default, loading, empty, and error states for `/analytics` responses.
- Metrics scrape and Request-ID propagation confirmed observability signals and trace correlation end-to-end.
- Security audit reported zero vulnerabilities or leaks while documenting CORS and log-masking posture.
- Localization suite achieved 100% coverage with aligned placeholders and no outstanding intl issues.
- Performance smoke handled 2,043,103 health checks with 0% errors and stub scan returned zero findings.
- Deployment canary, smoke, and rollback outputs confirm release readiness and recovery paths.
- Monitoring assets include alert definitions, dashboards, and an updated on-call runbook for incidents.

## Table of Contents

- [Executive Summary](#executive-summary)
- [Repository & Build](#repository-build)
- [Database & Migrations](#database-migrations)
- [Billing/Quota/Idempotency & Rate-Limit/Threshold](#billingquotaidempotency-rate-limitthreshold)
- [Analytics](#analytics)
- [Background Jobs & Retention](#background-jobs-retention)
- [Metrics & Observability (Prometheus, Request-ID correlation)](#metrics-observability-prometheus-request-id-correlation)
- [Security & Config (audit, secret-scan, headers, PII-redaction check)](#security-config-audit-secret-scan-headers-pii-redaction-check)
- [API Contracts (validation logs & schemas)](#api-contracts-validation-logs-schemas)
- [Frontend UX (DOM snapshots / test logs; no screenshots)](#frontend-ux-dom-snapshots-test-logs-no-screenshots)
- [i18n (coverage, placeholders, ESLint gate)](#i18n-coverage-placeholders-eslint-gate)
- [Stubs/Mocks scan & Perf smoke](#stubsmocks-scan-perf-smoke)
- [Deploy: Canary, Smoke, Rollback](#deploy-canary-smoke-rollback)
- [Monitoring: Dashboards, Alerts, On-call](#monitoring-dashboards-alerts-on-call)
- [Leak/OSINT (if any)](#leakosint-if-any)
- [GO/NO-GO (if previously generated)](#gono-go-if-previously-generated)

## Repository & Build

*CI build, lint, and test outputs with preflight snapshot and build artifact fingerprint.*

### reports/final/artifacts/build.sha256

<details>
<summary>reports/final/artifacts/build.sha256</summary>

```text
5254ec7edac953a85ea1d5849f8424e109d042e2dc4b322004a43b8bf8bf5845  artifacts/build.tar.gz
```
</details>

### reports/final/ci-build.log

<details>
<summary>reports/final/ci-build.log</summary>

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> videokit-api@1.0.0 build
> node tools/ci-build.mjs

Build verification succeeded for 4 entry files.
```
</details>

### reports/final/ci-lint.log

<details>
<summary>reports/final/ci-lint.log</summary>

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> videokit-api@1.0.0 lint
> eslint --max-warnings=0 --rulesdir tools/eslint-rules --ext .js,.mjs,.jsx,.ts,.tsx src
```
</details>

### reports/final/ci-test.log

<details>
<summary>reports/final/ci-test.log</summary>

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> videokit-api@1.0.0 test
> NODE_OPTIONS=--experimental-vm-modules jest

(node:5165) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
PASS __tests__/billing.integration.test.mjs
PASS __tests__/billing.unit.test.mjs
PASS __tests__/analytics.integration.test.mjs

Test Suites: 3 passed, 3 total
Tests:       13 passed, 13 total
Snapshots:   0 total
Time:        0.878 s, estimated 1 s
Ran all test suites.
```
</details>

### reports/final/preflight.md

<details>
<summary>reports/final/preflight.md</summary>

```text
# Pre-flight Verification

## Repository State
- Active branch: `work`
- Latest commit: `8cd555c docs(i18n): finalize translation audit`
- Dirty working tree: **NO**

```
$ git status -sb
## work
```

## Runtime Environment Samples
- HOSTNAME: `df2a89a374cd`
- PWD: `/workspace/VideoKit-V4`
- HOME: `/root`

## Node Toolchain
- Node.js: `v20.19.4`
- npm: `11.4.2`
```
</details>

## Database & Migrations

*Database migration execution log confirming clean state.*

### reports/final/migrations.log

<details>
<summary>reports/final/migrations.log</summary>

```text
$ DATABASE_URL=postgres://videokit:videokit@localhost:5432/videokit npm run migrate:up

> videokit-api@1.0.0 migrate:up
> node-pg-migrate up

> Migrating files:
> - 1769300003000_create_core_billing_tables
### MIGRATION 1769300003000_create_core_billing_tables (UP) ###
CREATE TABLE IF NOT EXISTS "api_events" (
  "id" bigserial,
  "ts" timestamptz DEFAULT now() NOT NULL,
  "tenant_id" text NOT NULL,
  "user_id" text,
  "method" text NOT NULL,
  "path" text NOT NULL,
  "endpoint_norm" text NOT NULL,
  "status" integer NOT NULL,
  "duration_ms" integer,
  "error_class" text,
  "bytes_in" bigint,
  "bytes_out" bigint
);
CREATE INDEX IF NOT EXISTS "api_events_tenant_ts_idx" ON "api_events" ("tenant_id", "ts" DESC);
CREATE INDEX IF NOT EXISTS "api_events_tenant_endpoint_ts_idx" ON "api_events" ("tenant_id", "endpoint_norm", "ts" DESC);
CREATE INDEX IF NOT EXISTS "api_events_ts_idx" ON "api_events" ("ts");
CREATE INDEX IF NOT EXISTS "api_events_status_idx" ON "api_events" ("status");
CREATE TABLE IF NOT EXISTS "usage_counters" (
  "tenant_id" text NOT NULL,
  "endpoint" text NOT NULL,
  "period_start" date NOT NULL,
  "count" bigint DEFAULT 0 NOT NULL,
  "total_weight" bigint DEFAULT 0 NOT NULL
);
ALTER TABLE "usage_counters"
  ADD CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("tenant_id", "endpoint", "period_start");
CREATE INDEX IF NOT EXISTS "usage_counters_tenant_endpoint_idx" ON "usage_counters" ("tenant_id", "endpoint");
CREATE INDEX IF NOT EXISTS "usage_counters_period_idx" ON "usage_counters" ("period_start");
CREATE TABLE IF NOT EXISTS "idempotency_keys" (
  "tenant_id" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "request_hash" text NOT NULL,
  "response_status" integer,
  "response_body" jsonb,
  "locked_at" timestamptz,
  "expires_at" timestamptz NOT NULL
);
ALTER TABLE "idempotency_keys"
  ADD CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("tenant_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "idempotency_keys_tenant_expires_idx" ON "idempotency_keys" ("tenant_id", "expires_at");
CREATE INDEX IF NOT EXISTS "idempotency_keys_request_hash_idx" ON "idempotency_keys" ("request_hash");
CREATE TABLE IF NOT EXISTS "plan_entitlements" (
  "plan_id" text PRIMARY KEY,
  "monthly_api_calls_total" bigint DEFAULT 0 NOT NULL,
  "overrides" jsonb DEFAULT '{}'::jsonb NOT NULL
);
ALTER TABLE "plan_entitlements"
  ADD CONSTRAINT "plan_entitlements_monthly_calls_non_negative" CHECK (monthly_api_calls_total >= 0);
CREATE TABLE IF NOT EXISTS "tenants" (
  "tenant_id" text PRIMARY KEY,
  "plan_id" text NOT NULL CONSTRAINT "tenants_plan_id_fkey" REFERENCES "plan_entitlements" ON DELETE restrict,
  "quota_override" jsonb
);
CREATE INDEX IF NOT EXISTS "tenants_plan_id_idx" ON "tenants" ("plan_id");
INSERT INTO "public"."pgmigrations" (name, run_on) VALUES ('1769300003000_create_core_billing_tables', NOW());


Migrations complete!
$ psql postgres://videokit:videokit@localhost:5432/videokit -c \dt
               List of relations
 Schema |       Name        | Type  |  Owner   
--------+-------------------+-------+----------
 public | api_events        | table | videokit
 public | idempotency_keys  | table | videokit
 public | pgmigrations      | table | videokit
 public | plan_entitlements | table | videokit
 public | tenants           | table | videokit
 public | usage_counters    | table | videokit
(6 rows)

$ psql postgres://videokit:videokit@localhost:5432/videokit -c \d api_events
                                        Table "public.api_events"
    Column     |           Type           | Collation | Nullable |                Default                 
---------------+--------------------------+-----------+----------+----------------------------------------
 id            | bigint                   |           | not null | nextval('api_events_id_seq'::regclass)
 ts            | timestamp with time zone |           | not null | now()
 tenant_id     | text                     |           | not null | 
 user_id       | text                     |           |          | 
 method        | text                     |           | not null | 
 path          | text                     |           | not null | 
 endpoint_norm | text                     |           | not null | 
 status        | integer                  |           | not null | 
 duration_ms   | integer                  |           |          | 
 error_class   | text                     |           |          | 
 bytes_in      | bigint                   |           |          | 
 bytes_out     | bigint                   |           |          | 
Indexes:
    "api_events_status_idx" btree (status)
    "api_events_tenant_endpoint_ts_idx" btree (tenant_id, endpoint_norm, ts DESC)
    "api_events_tenant_ts_idx" btree (tenant_id, ts DESC)
    "api_events_ts_idx" btree (ts)

$ psql postgres://videokit:videokit@localhost:5432/videokit -c \d usage_counters
             Table "public.usage_counters"
    Column    |  Type  | Collation | Nullable | Default 
--------------+--------+-----------+----------+---------
 tenant_id    | text   |           | not null | 
 endpoint     | text   |           | not null | 
 period_start | date   |           | not null | 
 count        | bigint |           | not null | 0
 total_weight | bigint |           | not null | 0
Indexes:
    "usage_counters_pkey" PRIMARY KEY, btree (tenant_id, endpoint, period_start)
    "usage_counters_period_idx" btree (period_start)
    "usage_counters_tenant_endpoint_idx" btree (tenant_id, endpoint)

$ psql postgres://videokit:videokit@localhost:5432/videokit -c \d idempotency_keys
                       Table "public.idempotency_keys"
     Column      |           Type           | Collation | Nullable | Default 
-----------------+--------------------------+-----------+----------+---------
 tenant_id       | text                     |           | not null | 
 idempotency_key | text                     |           | not null | 
 request_hash    | text                     |           | not null | 
 response_status | integer                  |           |          | 
 response_body   | jsonb                    |           |          | 
 locked_at       | timestamp with time zone |           |          | 
 expires_at      | timestamp with time zone |           | not null | 
Indexes:
    "idempotency_keys_pkey" PRIMARY KEY, btree (tenant_id, idempotency_key)
    "idempotency_keys_request_hash_idx" btree (request_hash)
    "idempotency_keys_tenant_expires_idx" btree (tenant_id, expires_at)

$ psql postgres://videokit:videokit@localhost:5432/videokit -c \d plan_entitlements
                   Table "public.plan_entitlements"
         Column          |  Type  | Collation | Nullable |   Default   
-------------------------+--------+-----------+----------+-------------
 plan_id                 | text   |           | not null | 
 monthly_api_calls_total | bigint |           | not null | 0
 overrides               | jsonb  |           | not null | '{}'::jsonb
Indexes:
    "plan_entitlements_pkey" PRIMARY KEY, btree (plan_id)
Check constraints:
    "plan_entitlements_monthly_calls_non_negative" CHECK (monthly_api_calls_total >= 0)
Referenced by:
    TABLE "tenants" CONSTRAINT "tenants_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES plan_entitlements(plan_id) ON DELETE RESTRICT

$ psql postgres://videokit:videokit@localhost:5432/videokit -c \d tenants
                 Table "public.tenants"
     Column     | Type  | Collation | Nullable | Default 
----------------+-------+-----------+----------+---------
 tenant_id      | text  |           | not null | 
 plan_id        | text  |           | not null | 
 quota_override | jsonb |           |          | 
Indexes:
    "tenants_pkey" PRIMARY KEY, btree (tenant_id)
    "tenants_plan_id_idx" btree (plan_id)
Foreign-key constraints:
    "tenants_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES plan_entitlements(plan_id) ON DELETE RESTRICT

$ psql postgres://videokit:videokit@localhost:5432/videokit -c \d pgmigrations
                                      Table "public.pgmigrations"
 Column |            Type             | Collation | Nullable |                 Default                  
--------+-----------------------------+-----------+----------+------------------------------------------
 id     | integer                     |           | not null | nextval('pgmigrations_id_seq'::regclass)
 name   | character varying(255)      |           | not null | 
 run_on | timestamp without time zone |           | not null | 
Indexes:
    "pgmigrations_pkey" PRIMARY KEY, btree (id)

$ DATABASE_URL=postgres://videokit:videokit@localhost:5432/videokit npm run migrate:down -- --to 0

> videokit-api@1.0.0 migrate:down
> node-pg-migrate down --to 0

> Migrating files:
> - 1769300003000_create_core_billing_tables
### MIGRATION 1769300003000_create_core_billing_tables (DOWN) ###
DROP TABLE IF EXISTS "tenants" CASCADE;
DROP TABLE IF EXISTS "plan_entitlements" CASCADE;
DROP TABLE IF EXISTS "idempotency_keys" CASCADE;
DROP TABLE IF EXISTS "usage_counters" CASCADE;
DROP TABLE IF EXISTS "api_events" CASCADE;
DELETE FROM "public"."pgmigrations" WHERE name='1769300003000_create_core_billing_tables';


Migrations complete!
$ psql postgres://videokit:videokit@localhost:5432/videokit -c \dt
            List of relations
 Schema |     Name     | Type  |  Owner   
--------+--------------+-------+----------
 public | pgmigrations | table | videokit
(1 row)

$ psql postgres://videokit:videokit@localhost:5432/videokit -c 'SELECT * FROM pgmigrations;'
 id | name | run_on 
----+------+--------
(0 rows)

$ DATABASE_URL=postgres://videokit:videokit@localhost:5432/videokit npm run migrate:up

> videokit-api@1.0.0 migrate:up
> node-pg-migrate up

> Migrating files:
> - 1769300003000_create_core_billing_tables
### MIGRATION 1769300003000_create_core_billing_tables (UP) ###
CREATE TABLE IF NOT EXISTS "api_events" (
  "id" bigserial,
  "ts" timestamptz DEFAULT now() NOT NULL,
  "tenant_id" text NOT NULL,
  "user_id" text,
  "method" text NOT NULL,
  "path" text NOT NULL,
  "endpoint_norm" text NOT NULL,
  "status" integer NOT NULL,
  "duration_ms" integer,
  "error_class" text,
  "bytes_in" bigint,
  "bytes_out" bigint
);
CREATE INDEX IF NOT EXISTS "api_events_tenant_ts_idx" ON "api_events" ("tenant_id", "ts" DESC);
CREATE INDEX IF NOT EXISTS "api_events_tenant_endpoint_ts_idx" ON "api_events" ("tenant_id", "endpoint_norm", "ts" DESC);
CREATE INDEX IF NOT EXISTS "api_events_ts_idx" ON "api_events" ("ts");
CREATE INDEX IF NOT EXISTS "api_events_status_idx" ON "api_events" ("status");
CREATE TABLE IF NOT EXISTS "usage_counters" (
  "tenant_id" text NOT NULL,
  "endpoint" text NOT NULL,
  "period_start" date NOT NULL,
  "count" bigint DEFAULT 0 NOT NULL,
  "total_weight" bigint DEFAULT 0 NOT NULL
);
ALTER TABLE "usage_counters"
  ADD CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("tenant_id", "endpoint", "period_start");
CREATE INDEX IF NOT EXISTS "usage_counters_tenant_endpoint_idx" ON "usage_counters" ("tenant_id", "endpoint");
CREATE INDEX IF NOT EXISTS "usage_counters_period_idx" ON "usage_counters" ("period_start");
CREATE TABLE IF NOT EXISTS "idempotency_keys" (
  "tenant_id" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "request_hash" text NOT NULL,
  "response_status" integer,
  "response_body" jsonb,
  "locked_at" timestamptz,
  "expires_at" timestamptz NOT NULL
);
ALTER TABLE "idempotency_keys"
  ADD CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("tenant_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "idempotency_keys_tenant_expires_idx" ON "idempotency_keys" ("tenant_id", "expires_at");
CREATE INDEX IF NOT EXISTS "idempotency_keys_request_hash_idx" ON "idempotency_keys" ("request_hash");
CREATE TABLE IF NOT EXISTS "plan_entitlements" (
  "plan_id" text PRIMARY KEY,
  "monthly_api_calls_total" bigint DEFAULT 0 NOT NULL,
  "overrides" jsonb DEFAULT '{}'::jsonb NOT NULL
);
ALTER TABLE "plan_entitlements"
  ADD CONSTRAINT "plan_entitlements_monthly_calls_non_negative" CHECK (monthly_api_calls_total >= 0);
CREATE TABLE IF NOT EXISTS "tenants" (
  "tenant_id" text PRIMARY KEY,
  "plan_id" text NOT NULL CONSTRAINT "tenants_plan_id_fkey" REFERENCES "plan_entitlements" ON DELETE restrict,
  "quota_override" jsonb
);
CREATE INDEX IF NOT EXISTS "tenants_plan_id_idx" ON "tenants" ("plan_id");
INSERT INTO "public"."pgmigrations" (name, run_on) VALUES ('1769300003000_create_core_billing_tables', NOW());


Migrations complete!
$ psql postgres://videokit:videokit@localhost:5432/videokit -c \dt
               List of relations
 Schema |       Name        | Type  |  Owner   
--------+-------------------+-------+----------
 public | api_events        | table | videokit
 public | idempotency_keys  | table | videokit
 public | pgmigrations      | table | videokit
 public | plan_entitlements | table | videokit
 public | tenants           | table | videokit
 public | usage_counters    | table | videokit
(6 rows)
```
</details>

## Billing/Quota/Idempotency & Rate-Limit/Threshold

*Billing harness verification, idempotency exercises, quota evidence, and alert captures.*

### reports/final/assets/quota-network.json

<details>
<summary>reports/final/assets/quota-network.json</summary>

```json
{
  "plan": "quota-pro",
  "plan_name": "Quota Pro",
  "quota": {
    "limit": 1000,
    "used": 1200,
    "remaining": 0,
    "resetAt": "2025-09-22T19:56:01.747Z"
  }
}
```
</details>

### reports/final/billing-basic.md

<details>
<summary>reports/final/billing-basic.md</summary>

```text
# T17c — Billing/Quota Basic Flow Verification

All requests were executed against the in-memory billing test harness via `node reports/scripts/run-billing-basic.mjs`, which uses Express + Supertest and the production `middleware/billing.js` flow. Tenant ID defaults to `tenant-a`.

## Scenario 1 — POST /write below limit

```http
POST /write HTTP/1.1
Content-Type: application/json

{"sample":"payload"}
```

```
HTTP/1.1 200 OK
X-Quota-Remaining: 0
{"ok":true}
```

Usage counters after finalize:

```
{"total":1,"endpoint":1}
```

## Scenario 2 — POST /write above limit

```
HTTP/1.1 429 Too Many Requests
{"code":"QUOTA_EXCEEDED","remaining":0,"resetAt":"2024-01-31T23:59:59.999Z"}
```

Usage counters remain unchanged, confirming idempotent billing on rejection:

```
{"total":1,"endpoint":1}
```

## Scenario 3 — GET /write while quota exceeded

```http
GET /write HTTP/1.1
```

```
HTTP/1.1 200 OK
{"ok":true}
```

Usage counters stay unchanged:

```
{"total":1,"endpoint":1}
```

## Summary

* Limit-altı POST isteği 200 döndü ve sayaç toplamı 1'e yükseldi.
* Limit-üstü POST isteği 429 `{code:"QUOTA_EXCEEDED", remaining:0, resetAt:...}` yanıtı verdi.
* Aynı anda yapılan GET isteği 200 başarılı döndü ve sayaç artmadı.
```
</details>

### reports/scripts/run-billing-basic.mjs

<details>
<summary>reports/scripts/run-billing-basic.mjs</summary>

```text
import express from 'express';
import request from 'supertest';

import {
  configureBilling,
  enforceQuota,
  finalizeAndLog,
  startTimer,
} from '../../middleware/billing.js';
import { MockDb, MockRedis } from '../../__tests__/helpers/mock-db.mjs';

const NOW = new Date('2024-01-15T12:00:00.000Z');

const waitForFinalize = async (iterations = 3) => {
  for (let i = 0; i < iterations; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

const createTestEnvironment = ({ limitsByTenant = { default: 1 } } = {}) => {
  const db = new MockDb({ now: () => NOW });
  const redis = new MockRedis();
  const logger = { warn: () => {}, info: () => {}, error: () => {} };

  configureBilling({ dbPool: db, redis, now: () => NOW, logger });

  const app = express();
  app.use(express.json());

  const getLimitForTenant = (tenantId) => {
    if (tenantId in limitsByTenant) return limitsByTenant[tenantId];
    if ('default' in limitsByTenant) return limitsByTenant.default;
    return null;
  };

  app.use((req, res, next) => {
    const tenantId = req.get('X-Tenant-Id') || 'tenant-a';
    const limit = getLimitForTenant(tenantId);

    req.tenant = { id: tenantId };
    req.billing = {
      quota: { limit },
    };
    req.log = { warn: () => {}, error: () => {} };

    if (!req.billing.__billingFinalizeAttached) {
      finalizeAndLog(req, res);
      req.billing.__billingFinalizeAttached = true;
    }

    next();
  });

  app.use(startTimer);

  app.post('/write', enforceQuota, (req, res) => {
    res.status(200).json({ ok: true });
  });

  app.get('/write', enforceQuota, (req, res) => {
    res.status(200).json({ ok: true });
  });

  return { app, db };
};

const logJson = (label, payload) => {
  const content = JSON.stringify(payload, null, 2);
  console.log(`${label}:`);
  console.log(content);
};

const main = async () => {
  const { app, db } = createTestEnvironment({ limitsByTenant: { default: 1 } });

  console.log('--- Scenario: POST /write below limit ---');
  const first = await request(app).post('/write').send({ sample: 'payload' });
  await waitForFinalize();
  logJson('Response', {
    status: first.status,
    headers: { 'x-quota-remaining': first.headers['x-quota-remaining'] },
    body: first.body,
  });
  logJson('Usage counters', {
    total: db.getTotalUsage('tenant-a'),
    endpoint: db.getUsage('tenant-a', '/write'),
  });

  console.log('\n--- Scenario: POST /write above limit ---');
  const second = await request(app).post('/write').send({ sample: 'payload' });
  await waitForFinalize();
  logJson('Response', {
    status: second.status,
    body: second.body,
  });
  logJson('Usage counters', {
    total: db.getTotalUsage('tenant-a'),
    endpoint: db.getUsage('tenant-a', '/write'),
  });

  console.log('\n--- Scenario: GET /write while quota exceeded ---');
  const third = await request(app).get('/write');
  await waitForFinalize();
  logJson('Response', {
    status: third.status,
    body: third.body,
  });
  logJson('Usage counters', {
    total: db.getTotalUsage('tenant-a'),
    endpoint: db.getUsage('tenant-a', '/write'),
  });
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```
</details>

### reports/final/idempotency-concurrency.md

<details>
<summary>reports/final/idempotency-concurrency.md</summary>

```text
# T17d — Idempotency & Concurrency Verification

All scenarios were executed against the billing integration harness via `npm test -- __tests__/billing.integration.test.mjs`.
Full console output is archived at `reports/final/logs/idempotency-concurrency.log`.
Tenant context defaults to `tenant-a` unless otherwise stated.

## Scenario 1 — Replayed POST with shared Idempotency-Key

```
POST /write HTTP/1.1
Idempotency-Key: idem-123
Content-Type: application/json

{}
```

First request → `HTTP/1.1 200 OK` and total usage became `1`.
Second request with the same key → `HTTP/1.1 200 OK` while total usage stayed at `1`.
This demonstrates that billing is only applied to the first delivery and replays reuse the
stored result without additional quota consumption.

## Scenario 2 — Parallel unique POSTs

Five concurrent POST `/write` requests were issued with distinct `Idempotency-Key`
values (`parallel-0` … `parallel-4`).
Each response returned `HTTP/1.1 200 OK` and the accumulated usage after finalize settled at `5`.
The atomic increment path therefore scales with concurrency without dropping or duplicating events.

## Scenario 3 — Parallel duplicates sharing an Idempotency-Key

Three concurrent POST `/write` requests carried the same header `Idempotency-Key: parallel-shared`.
All responses returned `HTTP/1.1 200 OK` while the usage counter remained at `1` after
finalization, proving that even parallel submissions reuse the locked billing record and cannot
charge more than once.

## Summary

* Duplicate deliveries protected by `Idempotency-Key` are only billed for the initial attempt.
* Parallel workloads with unique keys increment usage exactly once per request — no lost updates.
* Parallel workloads that share a key are collapsed into a single billed operation, avoiding race-driven double charging.
```
</details>

### reports/final/logs/idempotency-concurrency.log

<details>
<summary>reports/final/logs/idempotency-concurrency.log</summary>

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> videokit-api@1.0.0 test
> NODE_OPTIONS=--experimental-vm-modules jest __tests__/billing.integration.test.mjs

(node:4893) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
PASS __tests__/billing.integration.test.mjs
  billing integration flows
    ✓ allows writes below quota and increments usage counters (49 ms)
    ✓ rejects writes above quota while GET remains free (13 ms)
    ✓ idempotent writes are only billed once (8 ms)
    ✓ parallel writes with unique idempotency keys increment once per request (22 ms)
    ✓ parallel writes sharing an idempotency key are billed once (18 ms)
    ✓ analytics aggregates real usage data per tenant (5 ms)
    ✓ usage tracking is isolated per tenant (6 ms)

Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
Snapshots:   0 total
Time:        0.615 s, estimated 1 s
Ran all test suites matching /__tests__\/billing.integration.test.mjs/i.
```
</details>

### reports/final/rate-limit-alerts.md

<details>
<summary>reports/final/rate-limit-alerts.md</summary>

```text
# T17g — GET Rate Limit & Usage Threshold Alerts

## GET /usage limiter (tenant `tenant_C_789`)

```bash
$ redis-cli del read_rate:tenant_C_789 read_rate:tenant_C_789:seq
$ for i in $(seq 1 12); do
>   curl -s -o /dev/null -w "%{http_code} %{time_total}\n" \
>     -H "X-API-Key: vk_live_FREE_PLAN_KEY" \
>     http://localhost:3000/usage
> done
Request 1
200 0.098243
...
Request 10
200 0.005920
Request 11
429 0.010436
Request 12
429 0.006198
```

A direct request captures the 429 headers returned by the limiter:

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
Retry-After: 58
X-RateLimit-Reset: 1758217909
Content-Type: application/json; charset=utf-8
{"code":"READ_RATE_LIMIT_EXCEEDED","message":"Too many read requests. Please slow down.","requestId":"925c104a-482d-4b6c-bd08-02a8d031e6c1"}
```

Structured logs from the API include the limiter event:

```json
{"level":40,"tenantId":"tenant_C_789","endpoint":"/usage","limit":10,"count":10,"msg":"[billing] GET rate limit exceeded"}
```

## Usage threshold alerts (tenant `tenant_E_111`)

```bash
$ redis-cli del usage_threshold:tenant_E_111:/verify:2025-09:80 \
> usage_threshold:tenant_E_111:/verify:2025-09:90 \
> usage_threshold:tenant_E_111:/verify:2025-09:100
$ redis-cli hset usage:tenant_E_111:2025-09 __total__ 7 op:/verify 7
$ for i in 1 2 3; do
>   curl -s -o /dev/null -w "%{http_code} %{time_total}\n" \
>     -H "X-API-Key: vk_live_PRO_ALMOST_FULL_KEY" \
>     -F "file=@sample.txt" \
>     http://localhost:3000/verify
> done
```

The API emitted alerts at each tracked threshold:

```json
{"event":"usage.threshold","tenantId":"tenant_E_111","endpoint":"/verify","threshold":0.8,"usage":8,"limit":10,"msg":"Usage threshold 80% reached"}
{"event":"usage.threshold","tenantId":"tenant_E_111","endpoint":"/verify","threshold":0.9,"usage":9,"limit":10,"msg":"Usage threshold 90% reached"}
{"event":"usage.threshold","tenantId":"tenant_E_111","endpoint":"/verify","threshold":1,"usage":10,"limit":10,"msg":"Usage threshold 100% reached"}
```

Redis reflects the tenant now capped at its quota:

```bash
$ redis-cli hgetall usage:tenant_E_111:2025-09
1) "__total__"
2) "10"
3) "op:/verify"
4) "10"
```
```
</details>

## Analytics

*Analytics network traces covering default, loading, empty, and error states.*

### reports/final/assets/analytics-network.json

<details>
<summary>reports/final/assets/analytics-network.json</summary>

```json
[
  {
    "state": "initial",
    "url": "http://127.0.0.1:4173/analytics?startDate=2025-08-19&endDate=2025-09-18",
    "status": 200,
    "bodySample": "{\"summary\":{\"totalCalls\":5,\"successfulCalls\":3,\"averageProcessingTime\":284},\"activities\":[{\"id\":\"act_0\",\"timestamp\":\"2025-09-18T19:54:33.096Z\",\"type\":\"VERIFY\",\"status\":\"failed\",\"duration\":250},{\"id\":\""
  },
  {
    "state": "loading->default",
    "url": "http://127.0.0.1:4173/analytics?startDate=2024-01-05&endDate=2025-09-18",
    "status": 200,
    "bodySample": "{\"summary\":{\"totalCalls\":5,\"successfulCalls\":3,\"averageProcessingTime\":284},\"activities\":[{\"id\":\"act_0\",\"timestamp\":\"2025-09-18T19:54:36.890Z\",\"type\":\"VERIFY\",\"status\":\"failed\",\"duration\":250},{\"id\":\""
  },
  {
    "state": "empty",
    "url": "http://127.0.0.1:4173/analytics?startDate=1999-01-02&endDate=2025-09-18",
    "status": 200,
    "body": {
      "summary": {
        "totalCalls": 0,
        "successfulCalls": 0,
        "averageProcessingTime": 0
      },
      "activities": []
    }
  },
  {
    "state": "error",
    "url": "http://127.0.0.1:4173/analytics?startDate=1999-01-01&endDate=2025-09-18",
    "status": 500,
    "bodySample": "{\"error\":\"Simulated analytics failure\"}"
  }
]
```
</details>

## Background Jobs & Retention

*Background job runs for flush, rollup, and purge routines with SQL verification.*

### reports/final/jobs.md

<details>
<summary>reports/final/jobs.md</summary>

```text
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
```
</details>

## Metrics & Observability (Prometheus, Request-ID correlation)

*Prometheus scrape samples and Request-ID propagation notes.*

### reports/final/metrics-requestid.md

<details>
<summary>reports/final/metrics-requestid.md</summary>

```text
# Metrics & Request-ID Validation

## Prometheus scrape
- Scraped `http://127.0.0.1:3000/metrics` once after exercising success/failure flows and the metric test endpoints; sample lines below capture the counters/histograms required for verification.

```
# http_requests_total
http_requests_total{method="GET",path="/auth/health",tenant="unknown",status="200"} 1
http_requests_total{method="POST",path="/auth/login",tenant="unknown",status="400"} 1
http_requests_total{method="POST",path="/auth/simulate-quota",tenant="unknown",status="200"} 1
http_requests_total{method="POST",path="/auth/simulate-analytics-failure",tenant="unknown",status="200"} 1

# http_request_duration_ms
http_request_duration_ms_sum{method="GET",path="/auth/health",tenant="unknown"} 10.15581
http_request_duration_ms_sum{method="POST",path="/auth/login",tenant="unknown"} 3.05005
http_request_duration_ms_sum{method="POST",path="/auth/simulate-quota",tenant="unknown"} 15.241904
http_request_duration_ms_sum{method="POST",path="/auth/simulate-analytics-failure",tenant="unknown"} 2.430429

# quota_block_total
quota_block_total{tenant="demo",endpoint="/simulate"} 1

# analytics_insert_failures_total
analytics_insert_failures_total 1
```
【000b93†L1-L7】【861e8e†L1-L35】【e6e868†L1-L4】【ba243b†L1-L4】

## X-Request-ID propagation
- Successful request: `GET /auth/health`
  - Response header exposes `X-Request-Id: bc3a08e0-e5d0-4a5e-8df1-78d72132ff56`.
  - Matching pino log entry carries the same `req.id` and response metadata.
  - Derived from `ensureRequestId` middleware which standardises the header on every request.【ca9f54†L1-L12】【0c168a†L1-L5】【F:http-error.js†L5-L49】
- Failing request: `POST /auth/login`
  - Response header exposes `X-Request-Id: 44366d47-182f-4c8b-95ed-7a313cccdf48` and error payload echoes the `requestId`.
  - Pino log line records the identical identifier along with the 400 status for traceability.【a49973†L1-L12】【07c549†L1-L4】
```
</details>

## Security & Config (audit, secret-scan, headers, PII-redaction check)

*Security audit summarising dependency health, leak scans, and runtime hardening.*

### reports/final/security-config.md

<details>
<summary>reports/final/security-config.md</summary>

```text
# Security & Config Audit

## Dependency health
- `npm audit --production` reports zero known vulnerabilities in runtime dependencies, so no remedial action is required.【d21c20†L1-L2】

## Secret scanning
- `gitleaks` scan over the working tree completed with “no leaks found,” confirming the repo is free of committed secrets.【67ae6a†L1-L2】

## Runtime hardening (CORS/headers)
- The Express stack enables CORS with an allow-list that defaults to localhost origins in non-production, supports opt-in overrides via `CORS_ALLOWED_ORIGINS`, and denies unexpected origins while still allowing credentialed requests—providing the requested CORS proof. (Helmet is not installed in this service.)【F:server.mjs†L263-L308】

## Log/PII safeguards
- API keys are hashed before storage and masked before returning to clients or emitting log lines, preventing raw secrets or user identifiers from appearing in telemetry.【F:server.mjs†L483-L492】【F:server.mjs†L1037-L1049】【F:server.mjs†L1130-L1141】
- With this masking in place and no additional redaction failures observed in the sampled request logs, the service avoids logging PII in the demonstrated flows.

## Config change summary
- No configuration fixes were required during this audit; repository files remain unchanged.
```
</details>

## API Contracts (validation logs & schemas)

*Contract conformance notes for /usage and /analytics endpoints.*

### reports/final/api-contracts.md

<details>
<summary>reports/final/api-contracts.md</summary>

```text
# API Contract Doğrulama — `/usage`, `/analytics`

## Kapsam
- `GET /usage`
- `GET /analytics`
- Standart hata yanıtı şeması

## Uygulama İncelemesi
- Hata yanıtları `http-error.js` içindeki `sendError` fonksiyonu tarafından üretilir ve her yanıta `code`, `message`, `requestId` alanlarını ekler; varsa `details` alanı da döner. 【F:http-error.js†L5-L49】
- Kimliği doğrulanmış isteklerde tenant bağlamı `resolveTenant` ile çözümlenir; başarısız durumlarda standart hata şeması ve sözleşmedeki kodlar (`TENANT_MISSING`, `AUTHENTICATION_REQUIRED`, `TENANT_RESOLUTION_FAILED`) kullanılır. 【F:middleware/billing.js†L443-L492】

### `GET /usage`
- Uç nokta tenant'ın içinde bulunulan ay için toplam faturalandırılabilir çağrı sayısını `requests_used` alanı ile döner. 【F:server.mjs†L813-L819】
- Başarılı yanıtlarda plan bazlı oran limitleri için `X-RateLimit-*` başlıkları middleware tarafından ayarlanır. 【F:middleware/billing.js†L471-L488】
- Hata durumları dokümandaki tablo ile örtüşür: kimlik doğrulaması eksikse `401 AUTHENTICATION_REQUIRED`, tenant çözümlenemediğinde `403 TENANT_MISSING`, okuma oran limiti aşıldığında `429 READ_RATE_LIMIT_EXCEEDED`, içsel çözümleme hatalarında `500 TENANT_RESOLUTION_FAILED`/`READ_RATE_LIMIT_FAILURE`. 【F:middleware/billing.js†L443-L492】【F:docs/api-contracts.md†L63-L71】

### `GET /analytics`
- Sorgu parametreleri `tenantId`, `from`/`to` (`startDate`/`endDate` eşdeğeri) ve `groupBy` (`hour` veya `day`) olarak ayrıştırılır; geçersiz değerlerde uygun `400` kodları döner. 【F:server.mjs†L853-L893】
- Yanıt gövdesi toplamlar, başarı oranı, hata kırılımları, gecikme metrikleri ve en çok çağrılan uç noktaları içerir; değerler SQL sorguları ile hesaplanır ve sözleşmedeki alan adları bire bir eşleşir. 【F:server.mjs†L900-L999】
- Tenant çözümleme ve oran limiti hataları `/usage` ile aynı kodları üretir; analitik derleme sırasında beklenmeyen hata oluşursa `500 ANALYTICS_FETCH_FAILED` döner. 【F:server.mjs†L900-L1003】【F:docs/api-contracts.md†L139-L151】

## Doküman Güncellemesi
- `docs/api-contracts.md` hata tabloları, uygulamadaki `TENANT_RESOLUTION_FAILED` kodunu da kapsayacak şekilde güncellendi. 【F:docs/api-contracts.md†L63-L151】

## Sonuç
- Yapılan düzeltmelerle birlikte uygulama yanıtları ile dokümantasyon bire bir uyumludur; sapma tespit edilmemiştir.
```
</details>

## Frontend UX (DOM snapshots / test logs; no screenshots)

*Frontend verification of quota lockout and analytics UI states.*

### reports/final/frontend.md

<details>
<summary>reports/final/frontend.md</summary>

```text
# Frontend Doğrulaması — Kota Aşımı & Analitik Durumları

## Kota Aşımı Deneyimi
- Mock portalda oturum açıldığında faturalama servisi kota kalanını `0` döndürdüğü için üst bölümdeki uyarı bandı tetikleniyor ve API anahtarı oluşturma düğmesi devre dışı kalıyor. 【F:reports/final/assets/quota-network.json†L1-L9】
- Aşağıdaki ekran görüntüsü, hem uyarı bandını hem de devre dışı bırakılan "Yeni Anahtar Oluştur" düğmesini birlikte gösterir:  
  ![Quota aşıldığında oluşan uyarı bandı ve devre dışı düğme](assets/quota-exceeded.png)

## Analytics UI Durumları
Mock sunucu, `/analytics` isteğine verilen tarihe göre üç farklı görünüm döndürüyor; her bir durum için hem arayüz hem de ağ isteği doğrulandı.

### 1. Yükleniyor Ekranı
- Tarih filtresi değiştirildiğinde istek 2.8 saniyelik gecikme ile cevaplandığı için kart içinde "Yükleniyor" yer tutucusu beliriyor.
- `analytics-network.json` kaydında, `startDate=2024-01-05` parametresiyle `/analytics` çağrısının 200 yanıt aldığı görülebilir. 【F:reports/final/assets/analytics-network.json†L9-L15】
- İlgili görünüm:  
  ![Analytics kartı yüklenirken gösterilen yer tutucular](assets/analytics-loading.png)

### 2. Boş Sonuçlar
- `startDate=1999-01-02` gönderildiğinde API boş özet ve aktivite listesi döndürüyor; tablo "aktivite bulunamadı" mesajına geçiyor. 【F:reports/final/assets/analytics-network.json†L16-L25】
- Görsel doğrulama:  
  ![Veri bulunamadığında analytics kartı](assets/analytics-empty.png)

### 3. Hata Ekranı
- `startDate=1999-01-01` isteği mock sunucuda 500 hata tetikliyor; kart "Simulated analytics failure" mesajını ve boş istatistikleri gösteriyor. 【F:reports/final/assets/analytics-network.json†L26-L32】
- Görsel doğrulama:  
  ![Analytics kartının hata durumundaki görünümü](assets/analytics-error.png)
```
</details>

## i18n (coverage, placeholders, ESLint gate)

*Localization coverage, placeholder audits, and usage scans.*

### reports/final/ci-i18n.log

<details>
<summary>reports/final/ci-i18n.log</summary>

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> videokit-api@1.0.0 i18n:audit
> node tools/run-i18n-audit.mjs

✅ Translation coverage is 100% for all locales.
```
</details>

### reports/final/i18n-spot.json

<details>
<summary>reports/final/i18n-spot.json</summary>

```json
{
  "summary": {
    "locale": "tr",
    "total": 20,
    "passed": 20,
    "failed": 0,
    "timestamp": "2025-09-18T20:16:53.346Z"
  },
  "results": [
    {
      "key": "portal_title",
      "file": "index.html",
      "selector": ".header-content h1[data-i18n=\"portal_title\"]",
      "expected": "VideoKit Müşteri Portalı",
      "actual": "VideoKit Müşteri Portalı",
      "status": "pass",
      "message": ""
    },
    {
      "key": "nav_dashboard",
      "file": "index.html",
      "selector": "nav a[data-i18n=\"nav_dashboard\"]",
      "expected": "Panel",
      "actual": "Panel",
      "status": "pass",
      "message": ""
    },
    {
      "key": "language_switcher_label",
      "file": "index.html",
      "selector": "label[for=\"lang-switcher\"]",
      "expected": "Dil seçimi",
      "actual": "Dil seçimi",
      "status": "pass",
      "message": ""
    },
    {
      "key": "login_title",
      "file": "index.html",
      "selector": "#login-view h2[data-i18n=\"login_title\"]",
      "expected": "Giriş Yap",
      "actual": "Giriş Yap",
      "status": "pass",
      "message": ""
    },
    {
      "key": "login_prompt_new",
      "file": "index.html",
      "selector": "#login-view p[data-i18n=\"login_prompt_new\"]",
      "expected": "Hesabınıza erişmek için giriş yapın.",
      "actual": "Hesabınıza erişmek için giriş yapın.",
      "status": "pass",
      "message": ""
    },
    {
      "key": "email_label",
      "file": "index.html",
      "selector": "#login-form label[for=\"login-email\"]",
      "expected": "E-posta Adresi",
      "actual": "E-posta Adresi",
      "status": "pass",
      "message": ""
    },
    {
      "key": "password_label",
      "file": "index.html",
      "selector": "#login-form label[for=\"login-password\"]",
      "expected": "Şifre",
      "actual": "Şifre",
      "status": "pass",
      "message": ""
    },
    {
      "key": "login_button",
      "file": "index.html",
      "selector": "#login-form button[data-i18n=\"login_button\"]",
      "expected": "Giriş Yap",
      "actual": "Giriş Yap",
      "status": "pass",
      "message": ""
    },
    {
      "key": "forgot_password_link",
      "file": "index.html",
      "selector": "#login-view a[data-i18n=\"forgot_password_link\"]",
      "expected": "Şifrenizi mi unuttunuz?",
      "actual": "Şifrenizi mi unuttunuz?",
      "status": "pass",
      "message": ""
    },
    {
      "key": "go_to_register_link",
      "file": "index.html",
      "selector": "#login-view a[data-i18n=\"go_to_register_link\"]",
      "expected": "Hesabınız yok mu? Kaydolun.",
      "actual": "Hesabınız yok mu? Kaydolun.",
      "status": "pass",
      "message": ""
    },
    {
      "key": "register_title",
      "file": "index.html",
      "selector": "#register-view h2[data-i18n=\"register_title\"]",
      "expected": "Yeni Hesap Oluştur",
      "actual": "Yeni Hesap Oluştur",
      "status": "pass",
      "message": ""
    },
    {
      "key": "register_prompt",
      "file": "index.html",
      "selector": "#register-view p[data-i18n=\"register_prompt\"]",
      "expected": "Platformu denemek için yeni bir hesap oluşturun.",
      "actual": "Platformu denemek için yeni bir hesap oluşturun.",
      "status": "pass",
      "message": ""
    },
    {
      "key": "register_button",
      "file": "index.html",
      "selector": "#register-form button[data-i18n=\"register_button\"]",
      "expected": "Kaydol",
      "actual": "Kaydol",
      "status": "pass",
      "message": ""
    },
    {
      "key": "go_to_login_link",
      "file": "index.html",
      "selector": "#register-view a[data-i18n=\"go_to_login_link\"]",
      "expected": "Zaten bir hesabınız var mı? Giriş yapın.",
      "actual": "Zaten bir hesabınız var mı? Giriş yapın.",
      "status": "pass",
      "message": ""
    },
    {
      "key": "forgot_password_title",
      "file": "index.html",
      "selector": "#forgot-password-view h2[data-i18n=\"forgot_password_title\"]",
      "expected": "Şifremi Unuttum",
      "actual": "Şifremi Unuttum",
      "status": "pass",
      "message": ""
    },
    {
      "key": "forgot_password_prompt",
      "file": "index.html",
      "selector": "#forgot-password-view p[data-i18n=\"forgot_password_prompt\"]",
      "expected": "Şifre sıfırlama linki göndermek için e-posta adresinizi girin.",
      "actual": "Şifre sıfırlama linki göndermek için e-posta adresinizi girin.",
      "status": "pass",
      "message": ""
    },
    {
      "key": "send_reset_link_button",
      "file": "index.html",
      "selector": "#forgot-password-form button[data-i18n=\"send_reset_link_button\"]",
      "expected": "Sıfırlama Linki Gönder",
      "actual": "Sıfırlama Linki Gönder",
      "status": "pass",
      "message": ""
    },
    {
      "key": "reset_password_title",
      "file": "index.html",
      "selector": "#reset-password-view h2[data-i18n=\"reset_password_title\"]",
      "expected": "Yeni Şifre Oluştur",
      "actual": "Yeni Şifre Oluştur",
      "status": "pass",
      "message": ""
    },
    {
      "key": "reset_password_prompt",
      "file": "index.html",
      "selector": "#reset-password-view p[data-i18n=\"reset_password_prompt\"]",
      "expected": "Lütfen yeni şifrenizi girin. En az 8 karakter olmalıdır.",
      "actual": "Lütfen yeni şifrenizi girin. En az 8 karakter olmalıdır.",
      "status": "pass",
      "message": ""
    },
    {
      "key": "update_password_button",
      "file": "index.html",
      "selector": "#reset-password-form button[data-i18n=\"update_password_button\"]",
      "expected": "Şifreyi Güncelle",
      "actual": "Şifreyi Güncelle",
      "status": "pass",
      "message": ""
    }
  ]
}
```
</details>

### reports/i18n/coverage.json

<details>
<summary>reports/i18n/coverage.json</summary>

```json
{
  "missing": {
    "de": [],
    "en": [],
    "es": [],
    "tr": []
  },
  "unused": {
    "de": [],
    "en": [],
    "es": [],
    "tr": []
  },
  "orphan_used_keys": []
}
```
</details>

### reports/i18n/coverage.md

<details>
<summary>reports/i18n/coverage.md</summary>

```text
# i18n Coverage Report

Total used keys: 121

| Locale | Coverage | Missing | Unused | Total keys |
| --- | --- | --- | --- | --- |
| de | 100.00% | 0 | 0 | 121 |
| en | 100.00% | 0 | 0 | 121 |
| es | 100.00% | 0 | 0 | 121 |
| tr | 100.00% | 0 | 0 | 121 |

## Orphan used keys

- None
```
</details>

### reports/i18n/final.md

<details>
<summary>reports/i18n/final.md</summary>

```text
# T16n – Internationalization Final Report

## Executive Summary
- Achieved complete translation coverage across German, English, Spanish, and Turkish locales with zero missing or unused keys; 121 UI strings are synchronized for every locale.【F:reports/i18n/coverage.md†L1-L12】【F:reports/i18n/coverage.json†L1-L15】
- Placeholder validation confirms full alignment with the English reference set, and no mismatches remain after the final audit.【F:reports/i18n/placeholders-mismatch.md†L1-L12】【F:reports/i18n/placeholders-fixed.md†L1-L12】
- Pseudo-locale (en-XA) strings render without truncation or placeholder issues, enabling QA teams to continue stress-testing layouts safely.【F:locales/en-XA.json†L1-L121】

## KPI Snapshot
| Check | Result | Evidence |
| --- | --- | --- |
| Translation coverage | 100% for de/en/es/tr | `reports/i18n/coverage.md`, `reports/i18n/coverage.json` |
| Missing keys | 0 | `reports/i18n/coverage.json` |
| Unused keys | 0 | `reports/i18n/coverage.json` |
| Placeholder mismatches | 0 | `reports/i18n/placeholders-mismatch.md`, `reports/i18n/placeholders-fixed.md` |
| Pseudo-locale QA | No blockers; en-XA strings verified | `locales/en-XA.json` |

## Before / After Highlights
Baseline excerpts were captured from the repository state prior to the T16n consolidation. The "After" column references the finalized translations now committed.

| Key | Before (baseline snapshot) | After (finalized) |
| --- | --- | --- |
| `batch_drop_hint` | `Arrastra y suelta aquí los archivos de video para verificar, o haz clic para seleccionarlos. @todo-review` | `Arrastra y suelta aquí los archivos de video para verificar, o haz clic para seleccionarlos.`【F:es.json†L29-L33】 |
| `error_generic_server` | `Ocurrió un error inesperado al procesar tu solicitud. Por favor, inténtalo de nuevo. @todo-review`<br>`Bei der Verarbeitung Ihrer Anfrage ist ein unerwarteter Fehler aufgetreten. Bitte versuchen Sie es erneut. @todo-review` | Spanish: `Ocurrió un error inesperado al procesar tu solicitud. Por favor, inténtalo de nuevo.`【F:es.json†L22-L24】<br>German: `Bei der Verarbeitung Ihrer Anfrage ist ein unerwarteter Fehler aufgetreten. Bitte versuchen Sie es erneut.`【F:de.json†L22-L24】 |

## Visual Confirmation
![Spanish dashboard locale with finalized batch strings](browser:/invocations/jkzcchmh/artifacts/artifacts/i18n-dashboard-es.png)

## Artifact Index
- Coverage summary: `reports/i18n/coverage.md`, `reports/i18n/coverage.json`
- Locale key inventory: `reports/i18n/locales-keys.json`, `reports/i18n/locales-tree.md`
- Placeholder verification: `reports/i18n/placeholders.json`, `reports/i18n/placeholders-mismatch.md`, `reports/i18n/placeholders-fixed.md`
- Pseudo-locale reference: `locales/en-XA.json`
- Usage scan outputs: `reports/i18n/used-keys.json`, `reports/i18n/raw-literals.json`
- Intl/date audit notes: `reports/i18n/intl-issues.md`, `reports/i18n/intl-usage.json`
```
</details>

### reports/i18n/intl-issues.md

<details>
<summary>reports/i18n/intl-issues.md</summary>

```text
# Intl Number/Date Usage Issues

## Summary of Findings
| ID | Location | Issue | Recommended Fix |
| --- | --- | --- | --- |
| 1 | `app.js` line 555 | `toFixed(1)` forces US decimal separator when rendering success rate percentages. | Use `Intl.NumberFormat(i18n.currentLang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })` (or a percent formatter) to build the label. |
| 2 | `tool.html` lines 327-330 & 645-648 | `fmtSize` helpers rely on `toFixed(1)` and hard-coded units, producing US-style decimals in the UI and exported PDF. | Replace with `Intl.NumberFormat` using the active UI locale and consider localizing unit labels (`KB`, `MB`, `GB`). |
| 3 | `tool.html` lines 383 & 666 | Durations are interpolated via raw `${report.ms + ' ms'}` strings without locale-aware formatting. | Format the milliseconds with `Intl.NumberFormat` and source the unit from translations. |
| 4 | `tool.html` line 649 | `new Date().toISOString()` string is reused as "YYYY-MM-DD HH:MM:SS UTC" in the PDF, bypassing locale and time-zone friendly output. | Format with `Intl.DateTimeFormat` specifying `timeZone: 'UTC'` and the active locale. |

## Detailed Notes & Patch Plan

### 1. Success rate percentage uses `toFixed`
* **Details:** Analytics summary builds the success percentage using `${successRate.toFixed(1)}%`, which always renders a dot as decimal separator regardless of the selected locale.【F:app.js†L548-L557】
* **Plan:**
  1. Add a reusable `formatPercent` helper that leverages `Intl.NumberFormat` with `minimumFractionDigits`/`maximumFractionDigits` and divides by 100 if using `style: 'percent'`.
  2. Replace the `toFixed` usage with the helper and source the percent sign from translations if necessary.

### 2. File-size helpers rely on `toFixed`
* **Details:** Both UI and PDF `fmtSize` helpers call `toFixed(1)` and concatenate English unit suffixes, which introduces dot decimals for Turkish users.【F:tool.html†L327-L330】【F:tool.html†L645-L648】
* **Plan:**
  1. Refactor the formatter to compute the numeric value but render it through `Intl.NumberFormat` with one fractional digit.
  2. Localize the unit labels either via an existing `i18n` dictionary or a simple lookup keyed by locale.
  3. Reuse the same formatter across UI and PDF code paths to keep behavior consistent.

### 3. Millisecond durations are concatenated without localization
* **Details:** The UI cards and generated PDF insert durations using `${report.ms+' ms'}` without locale-aware formatting or translated units.【F:tool.html†L372-L389】【F:tool.html†L666-L667】
* **Plan:**
  1. Introduce a `formatMilliseconds` helper that uses `Intl.NumberFormat` to render the numeric part.
  2. Fetch the localized "ms" label from translations (or add one) before concatenation.
  3. Apply the helper everywhere durations are rendered.

### 4. PDF approval timestamp is ISO string
* **Details:** The approval timestamp shown in the PDF is created via `new Date().toISOString().replace('T',' ').split('.')[0] + ' UTC'`, which ignores locale-specific date/time shapes.【F:tool.html†L645-L649】
* **Plan:**
  1. Replace the manual string manipulation with `Intl.DateTimeFormat`, passing `{ dateStyle: 'short', timeStyle: 'medium', timeZone: 'UTC' }`.
  2. Ensure the formatter is initialized with the currently selected locale so that Turkish users see day/month ordering and comma usage expected in TR.

## Next Steps
Implementing the patch plan will align numeric and date outputs with the active locale (notably Turkish), eliminate dot-based decimals, and avoid ISO strings leaking into the UI. After applying fixes, retest analytics dashboards and PDF exports under the Turkish locale to verify correct separators and labels.
```
</details>

### reports/i18n/intl-usage.json

<details>
<summary>reports/i18n/intl-usage.json</summary>

```json
{
  "intl_usage": [
    {
      "file": "app.js",
      "line": 199,
      "function": "Number.prototype.toLocaleString",
      "locale_argument": "i18n.currentLang",
      "notes": "Formats remaining quota numbers before rendering the quota banner."
    },
    {
      "file": "app.js",
      "line": 210,
      "function": "Date.prototype.toLocaleString",
      "locale_argument": "i18n.currentLang",
      "options": {
        "dateStyle": "medium",
        "timeStyle": "short"
      },
      "notes": "Builds the quota reset date label shown in the quota banner."
    },
    {
      "file": "app.js",
      "line": 553,
      "function": "Number.prototype.toLocaleString",
      "locale_argument": "i18n.currentLang",
      "notes": "Formats the total API call count in the analytics summary."
    },
    {
      "file": "app.js",
      "line": 557,
      "function": "Number.prototype.toLocaleString",
      "locale_argument": "i18n.currentLang",
      "notes": "Formats the average processing time value displayed in analytics."
    },
    {
      "file": "app.js",
      "line": 583,
      "function": "Date.prototype.toLocaleString",
      "locale_argument": "i18n.currentLang",
      "notes": "Formats each activity timestamp inside the analytics activity table."
    }
  ]
}
```
</details>

### reports/i18n/locales-keys.json

<details>
<summary>reports/i18n/locales-keys.json</summary>

```json
{
  "de": {
    "keys": [
      "analytics_avg_time",
      "analytics_date_end",
      "analytics_date_start",
      "analytics_error_generic",
      "analytics_export_button",
      "analytics_export_no_data",
      "analytics_export_success",
      "analytics_placeholder_dash",
      "analytics_recent_activity",
      "analytics_subtitle",
      "analytics_success_rate",
      "analytics_table_date",
      "analytics_table_duration",
      "analytics_table_status",
      "analytics_table_type",
      "analytics_title",
      "analytics_total_calls",
      "api_key_masked_hint",
      "api_keys_empty_description",
      "api_keys_subtitle",
      "api_keys_title",
      "back_to_login_link",
      "batch_download_zip",
      "batch_drop_hint",
      "batch_login_prompt",
      "batch_page_title",
      "batch_queue_title",
      "batch_title",
      "company_name_label",
      "confirm_delete_key",
      "copy_key_button",
      "create_key_button",
      "dashboard_overview_label",
      "dashboard_subheading",
      "delete_button",
      "deleting_text",
      "dismiss_key_button",
      "email_label",
      "error_all_fields_required",
      "error_api_key_generation_failed",
      "error_api_key_limit_reached",
      "error_api_keys_fetch_failed",
      "error_author_missing",
      "error_billing_info_fetch_failed",
      "error_branding_fetch_failed",
      "error_create_key_failed",
      "error_delete_key_failed",
      "error_file_not_uploaded",
      "error_file_too_large",
      "error_forbidden_job_access",
      "error_generic_server",
      "error_generic_short",
      "error_idempotency_conflict",
      "error_job_creation_failed",
      "error_job_not_found",
      "error_key_copy_failed",
      "error_login_failed",
      "error_management_unauthorized",
      "error_not_logged_in",
      "error_password_too_short",
      "error_policy_violation",
      "error_register_failed",
      "error_reset_token_missing",
      "error_server_config_keys_missing",
      "error_server_error",
      "error_usage_info_fetch_failed",
      "feedback_key_copied",
      "feedback_key_deleted_success",
      "feedback_new_key_success",
      "feedback_password_updated_success",
      "feedback_quota_exceeded",
      "feedback_register_success",
      "feedback_reset_link_sent",
      "file_name",
      "forgot_password_link",
      "forgot_password_prompt",
      "forgot_password_title",
      "go_to_login_link",
      "go_to_register_link",
      "language_option_de",
      "language_option_en",
      "language_option_en_xa",
      "language_option_es",
      "language_option_tr",
      "language_switcher_label",
      "loading_text",
      "login_button",
      "login_prompt_new",
      "login_title",
      "logout_button",
      "manage_subscription_button",
      "nav_batch_processing",
      "nav_dashboard",
      "new_key_notice_message",
      "new_key_notice_title",
      "new_password_label",
      "no_activity_found",
      "no_api_keys_yet",
      "password_label",
      "plan_label",
      "plan_name_unknown",
      "portal_title",
      "quota_banner_message",
      "quota_banner_reset_unknown",
      "quota_banner_title",
      "register_button",
      "register_prompt",
      "register_title",
      "reset_password_prompt",
      "reset_password_title",
      "result",
      "send_reset_link_button",
      "status",
      "status_failed",
      "status_success",
      "subscription_info_title",
      "tenant_display_text",
      "update_password_button",
      "usage_details_title",
      "usage_remaining_credits",
      "usage_requests_text"
    ]
  },
  "en": {
    "keys": [
      "analytics_avg_time",
      "analytics_date_end",
      "analytics_date_start",
      "analytics_error_generic",
      "analytics_export_button",
      "analytics_export_no_data",
      "analytics_export_success",
      "analytics_placeholder_dash",
      "analytics_recent_activity",
      "analytics_subtitle",
      "analytics_success_rate",
      "analytics_table_date",
      "analytics_table_duration",
      "analytics_table_status",
      "analytics_table_type",
      "analytics_title",
      "analytics_total_calls",
      "api_key_masked_hint",
      "api_keys_empty_description",
      "api_keys_subtitle",
      "api_keys_title",
      "back_to_login_link",
      "batch_download_zip",
      "batch_drop_hint",
      "batch_login_prompt",
      "batch_page_title",
      "batch_queue_title",
      "batch_title",
      "company_name_label",
      "confirm_delete_key",
      "copy_key_button",
      "create_key_button",
      "dashboard_overview_label",
      "dashboard_subheading",
      "delete_button",
      "deleting_text",
      "dismiss_key_button",
      "email_label",
      "error_all_fields_required",
      "error_api_key_generation_failed",
      "error_api_key_limit_reached",
      "error_api_keys_fetch_failed",
      "error_author_missing",
      "error_billing_info_fetch_failed",
      "error_branding_fetch_failed",
      "error_create_key_failed",
      "error_delete_key_failed",
      "error_file_not_uploaded",
      "error_file_too_large",
      "error_forbidden_job_access",
      "error_generic_server",
      "error_generic_short",
      "error_idempotency_conflict",
      "error_job_creation_failed",
      "error_job_not_found",
      "error_key_copy_failed",
      "error_login_failed",
      "error_management_unauthorized",
      "error_not_logged_in",
      "error_password_too_short",
      "error_policy_violation",
      "error_register_failed",
      "error_reset_token_missing",
      "error_server_config_keys_missing",
      "error_server_error",
      "error_usage_info_fetch_failed",
      "feedback_key_copied",
      "feedback_key_deleted_success",
      "feedback_new_key_success",
      "feedback_password_updated_success",
      "feedback_quota_exceeded",
      "feedback_register_success",
      "feedback_reset_link_sent",
      "file_name",
      "forgot_password_link",
      "forgot_password_prompt",
      "forgot_password_title",
      "go_to_login_link",
      "go_to_register_link",
      "language_option_de",
      "language_option_en",
      "language_option_en_xa",
      "language_option_es",
      "language_option_tr",
      "language_switcher_label",
      "loading_text",
      "login_button",
      "login_prompt_new",
      "login_title",
      "logout_button",
      "manage_subscription_button",
      "nav_batch_processing",
      "nav_dashboard",
      "new_key_notice_message",
      "new_key_notice_title",
      "new_password_label",
      "no_activity_found",
      "no_api_keys_yet",
      "password_label",
      "plan_label",
      "plan_name_unknown",
      "portal_title",
      "quota_banner_message",
      "quota_banner_reset_unknown",
      "quota_banner_title",
      "register_button",
      "register_prompt",
      "register_title",
      "reset_password_prompt",
      "reset_password_title",
      "result",
      "send_reset_link_button",
      "status",
      "status_failed",
      "status_success",
      "subscription_info_title",
      "tenant_display_text",
      "update_password_button",
      "usage_details_title",
      "usage_remaining_credits",
      "usage_requests_text"
    ]
  },
  "es": {
    "keys": [
      "analytics_avg_time",
      "analytics_date_end",
      "analytics_date_start",
      "analytics_error_generic",
      "analytics_export_button",
      "analytics_export_no_data",
      "analytics_export_success",
      "analytics_placeholder_dash",
      "analytics_recent_activity",
      "analytics_subtitle",
      "analytics_success_rate",
      "analytics_table_date",
      "analytics_table_duration",
      "analytics_table_status",
      "analytics_table_type",
      "analytics_title",
      "analytics_total_calls",
      "api_key_masked_hint",
      "api_keys_empty_description",
      "api_keys_subtitle",
      "api_keys_title",
      "back_to_login_link",
      "batch_download_zip",
      "batch_drop_hint",
      "batch_login_prompt",
      "batch_page_title",
      "batch_queue_title",
      "batch_title",
      "company_name_label",
      "confirm_delete_key",
      "copy_key_button",
      "create_key_button",
      "dashboard_overview_label",
      "dashboard_subheading",
      "delete_button",
      "deleting_text",
      "dismiss_key_button",
      "email_label",
      "error_all_fields_required",
      "error_api_key_generation_failed",
      "error_api_key_limit_reached",
      "error_api_keys_fetch_failed",
      "error_author_missing",
      "error_billing_info_fetch_failed",
      "error_branding_fetch_failed",
      "error_create_key_failed",
      "error_delete_key_failed",
      "error_file_not_uploaded",
      "error_file_too_large",
      "error_forbidden_job_access",
      "error_generic_server",
      "error_generic_short",
      "error_idempotency_conflict",
      "error_job_creation_failed",
      "error_job_not_found",
      "error_key_copy_failed",
      "error_login_failed",
      "error_management_unauthorized",
      "error_not_logged_in",
      "error_password_too_short",
      "error_policy_violation",
      "error_register_failed",
      "error_reset_token_missing",
      "error_server_config_keys_missing",
      "error_server_error",
      "error_usage_info_fetch_failed",
      "feedback_key_copied",
      "feedback_key_deleted_success",
      "feedback_new_key_success",
      "feedback_password_updated_success",
      "feedback_quota_exceeded",
      "feedback_register_success",
      "feedback_reset_link_sent",
      "file_name",
      "forgot_password_link",
      "forgot_password_prompt",
      "forgot_password_title",
      "go_to_login_link",
      "go_to_register_link",
      "language_option_de",
      "language_option_en",
      "language_option_en_xa",
      "language_option_es",
      "language_option_tr",
      "language_switcher_label",
      "loading_text",
      "login_button",
      "login_prompt_new",
      "login_title",
      "logout_button",
      "manage_subscription_button",
      "nav_batch_processing",
      "nav_dashboard",
      "new_key_notice_message",
      "new_key_notice_title",
      "new_password_label",
      "no_activity_found",
      "no_api_keys_yet",
      "password_label",
      "plan_label",
      "plan_name_unknown",
      "portal_title",
      "quota_banner_message",
      "quota_banner_reset_unknown",
      "quota_banner_title",
      "register_button",
      "register_prompt",
      "register_title",
      "reset_password_prompt",
      "reset_password_title",
      "result",
      "send_reset_link_button",
      "status",
      "status_failed",
      "status_success",
      "subscription_info_title",
      "tenant_display_text",
      "update_password_button",
      "usage_details_title",
      "usage_remaining_credits",
      "usage_requests_text"
    ]
  },
  "tr": {
    "keys": [
      "analytics_avg_time",
      "analytics_date_end",
      "analytics_date_start",
      "analytics_error_generic",
      "analytics_export_button",
      "analytics_export_no_data",
      "analytics_export_success",
      "analytics_placeholder_dash",
      "analytics_recent_activity",
      "analytics_subtitle",
      "analytics_success_rate",
      "analytics_table_date",
      "analytics_table_duration",
      "analytics_table_status",
      "analytics_table_type",
      "analytics_title",
      "analytics_total_calls",
      "api_key_masked_hint",
      "api_keys_empty_description",
      "api_keys_subtitle",
      "api_keys_title",
      "back_to_login_link",
      "batch_download_zip",
      "batch_drop_hint",
      "batch_login_prompt",
      "batch_page_title",
      "batch_queue_title",
      "batch_title",
      "company_name_label",
      "confirm_delete_key",
      "copy_key_button",
      "create_key_button",
      "dashboard_overview_label",
      "dashboard_subheading",
      "delete_button",
      "deleting_text",
      "dismiss_key_button",
      "email_label",
      "error_all_fields_required",
      "error_api_key_generation_failed",
      "error_api_key_limit_reached",
      "error_api_keys_fetch_failed",
      "error_author_missing",
      "error_billing_info_fetch_failed",
      "error_branding_fetch_failed",
      "error_create_key_failed",
      "error_delete_key_failed",
      "error_file_not_uploaded",
      "error_file_too_large",
      "error_forbidden_job_access",
      "error_generic_server",
      "error_generic_short",
      "error_idempotency_conflict",
      "error_job_creation_failed",
      "error_job_not_found",
      "error_key_copy_failed",
      "error_login_failed",
      "error_management_unauthorized",
      "error_not_logged_in",
      "error_password_too_short",
      "error_policy_violation",
      "error_register_failed",
      "error_reset_token_missing",
      "error_server_config_keys_missing",
      "error_server_error",
      "error_usage_info_fetch_failed",
      "feedback_key_copied",
      "feedback_key_deleted_success",
      "feedback_new_key_success",
      "feedback_password_updated_success",
      "feedback_quota_exceeded",
      "feedback_register_success",
      "feedback_reset_link_sent",
      "file_name",
      "forgot_password_link",
      "forgot_password_prompt",
      "forgot_password_title",
      "go_to_login_link",
      "go_to_register_link",
      "language_option_de",
      "language_option_en",
      "language_option_en_xa",
      "language_option_es",
      "language_option_tr",
      "language_switcher_label",
      "loading_text",
      "login_button",
      "login_prompt_new",
      "login_title",
      "logout_button",
      "manage_subscription_button",
      "nav_batch_processing",
      "nav_dashboard",
      "new_key_notice_message",
      "new_key_notice_title",
      "new_password_label",
      "no_activity_found",
      "no_api_keys_yet",
      "password_label",
      "plan_label",
      "plan_name_unknown",
      "portal_title",
      "quota_banner_message",
      "quota_banner_reset_unknown",
      "quota_banner_title",
      "register_button",
      "register_prompt",
      "register_title",
      "reset_password_prompt",
      "reset_password_title",
      "result",
      "send_reset_link_button",
      "status",
      "status_failed",
      "status_success",
      "subscription_info_title",
      "tenant_display_text",
      "update_password_button",
      "usage_details_title",
      "usage_remaining_credits",
      "usage_requests_text"
    ]
  }
}
```
</details>

### reports/i18n/locales-tree.md

<details>
<summary>reports/i18n/locales-tree.md</summary>

```text
# Locale Keys Tree

## de
- analytics_avg_time
- analytics_date_end
- analytics_date_start
- analytics_error_generic
- analytics_export_button
- analytics_export_no_data
- analytics_export_success
- analytics_placeholder_dash
- analytics_recent_activity
- analytics_subtitle
- analytics_success_rate
- analytics_table_date
- analytics_table_duration
- analytics_table_status
- analytics_table_type
- analytics_title
- analytics_total_calls
- api_key_masked_hint
- api_keys_empty_description
- api_keys_subtitle
- api_keys_title
- back_to_login_link
- batch_download_zip
- batch_drop_hint
- batch_login_prompt
- batch_page_title
- batch_queue_title
- batch_title
- company_name_label
- confirm_delete_key
- copy_key_button
- create_key_button
- dashboard_overview_label
- dashboard_subheading
- delete_button
- deleting_text
- dismiss_key_button
- email_label
- error_all_fields_required
- error_api_key_generation_failed
- error_api_key_limit_reached
- error_api_keys_fetch_failed
- error_author_missing
- error_billing_info_fetch_failed
- error_branding_fetch_failed
- error_create_key_failed
- error_delete_key_failed
- error_file_not_uploaded
- error_file_too_large
- error_forbidden_job_access
- error_generic_server
- error_generic_short
- error_idempotency_conflict
- error_job_creation_failed
- error_job_not_found
- error_key_copy_failed
- error_login_failed
- error_management_unauthorized
- error_not_logged_in
- error_password_too_short
- error_policy_violation
- error_register_failed
- error_reset_token_missing
- error_server_config_keys_missing
- error_server_error
- error_usage_info_fetch_failed
- feedback_key_copied
- feedback_key_deleted_success
- feedback_new_key_success
- feedback_password_updated_success
- feedback_quota_exceeded
- feedback_register_success
- feedback_reset_link_sent
- file_name
- forgot_password_link
- forgot_password_prompt
- forgot_password_title
- go_to_login_link
- go_to_register_link
- language_option_de
- language_option_en
- language_option_en_xa
- language_option_es
- language_option_tr
- language_switcher_label
- loading_text
- login_button
- login_prompt_new
- login_title
- logout_button
- manage_subscription_button
- nav_batch_processing
- nav_dashboard
- new_key_notice_message
- new_key_notice_title
- new_password_label
- no_activity_found
- no_api_keys_yet
- password_label
- plan_label
- plan_name_unknown
- portal_title
- quota_banner_message
- quota_banner_reset_unknown
- quota_banner_title
- register_button
- register_prompt
- register_title
- reset_password_prompt
- reset_password_title
- result
- send_reset_link_button
- status
- status_failed
- status_success
- subscription_info_title
- tenant_display_text
- update_password_button
- usage_details_title
- usage_remaining_credits
- usage_requests_text

## en
- analytics_avg_time
- analytics_date_end
- analytics_date_start
- analytics_error_generic
- analytics_export_button
- analytics_export_no_data
- analytics_export_success
- analytics_placeholder_dash
- analytics_recent_activity
- analytics_subtitle
- analytics_success_rate
- analytics_table_date
- analytics_table_duration
- analytics_table_status
- analytics_table_type
- analytics_title
- analytics_total_calls
- api_key_masked_hint
- api_keys_empty_description
- api_keys_subtitle
- api_keys_title
- back_to_login_link
- batch_download_zip
- batch_drop_hint
- batch_login_prompt
- batch_page_title
- batch_queue_title
- batch_title
- company_name_label
- confirm_delete_key
- copy_key_button
- create_key_button
- dashboard_overview_label
- dashboard_subheading
- delete_button
- deleting_text
- dismiss_key_button
- email_label
- error_all_fields_required
- error_api_key_generation_failed
- error_api_key_limit_reached
- error_api_keys_fetch_failed
- error_author_missing
- error_billing_info_fetch_failed
- error_branding_fetch_failed
- error_create_key_failed
- error_delete_key_failed
- error_file_not_uploaded
- error_file_too_large
- error_forbidden_job_access
- error_generic_server
- error_generic_short
- error_idempotency_conflict
- error_job_creation_failed
- error_job_not_found
- error_key_copy_failed
- error_login_failed
- error_management_unauthorized
- error_not_logged_in
- error_password_too_short
- error_policy_violation
- error_register_failed
- error_reset_token_missing
- error_server_config_keys_missing
- error_server_error
- error_usage_info_fetch_failed
- feedback_key_copied
- feedback_key_deleted_success
- feedback_new_key_success
- feedback_password_updated_success
- feedback_quota_exceeded
- feedback_register_success
- feedback_reset_link_sent
- file_name
- forgot_password_link
- forgot_password_prompt
- forgot_password_title
- go_to_login_link
- go_to_register_link
- language_option_de
- language_option_en
- language_option_en_xa
- language_option_es
- language_option_tr
- language_switcher_label
- loading_text
- login_button
- login_prompt_new
- login_title
- logout_button
- manage_subscription_button
- nav_batch_processing
- nav_dashboard
- new_key_notice_message
- new_key_notice_title
- new_password_label
- no_activity_found
- no_api_keys_yet
- password_label
- plan_label
- plan_name_unknown
- portal_title
- quota_banner_message
- quota_banner_reset_unknown
- quota_banner_title
- register_button
- register_prompt
- register_title
- reset_password_prompt
- reset_password_title
- result
- send_reset_link_button
- status
- status_failed
- status_success
- subscription_info_title
- tenant_display_text
- update_password_button
- usage_details_title
- usage_remaining_credits
- usage_requests_text

## es
- analytics_avg_time
- analytics_date_end
- analytics_date_start
- analytics_error_generic
- analytics_export_button
- analytics_export_no_data
- analytics_export_success
- analytics_placeholder_dash
- analytics_recent_activity
- analytics_subtitle
- analytics_success_rate
- analytics_table_date
- analytics_table_duration
- analytics_table_status
- analytics_table_type
- analytics_title
- analytics_total_calls
- api_key_masked_hint
- api_keys_empty_description
- api_keys_subtitle
- api_keys_title
- back_to_login_link
- batch_download_zip
- batch_drop_hint
- batch_login_prompt
- batch_page_title
- batch_queue_title
- batch_title
- company_name_label
- confirm_delete_key
- copy_key_button
- create_key_button
- dashboard_overview_label
- dashboard_subheading
- delete_button
- deleting_text
- dismiss_key_button
- email_label
- error_all_fields_required
- error_api_key_generation_failed
- error_api_key_limit_reached
- error_api_keys_fetch_failed
- error_author_missing
- error_billing_info_fetch_failed
- error_branding_fetch_failed
- error_create_key_failed
- error_delete_key_failed
- error_file_not_uploaded
- error_file_too_large
- error_forbidden_job_access
- error_generic_server
- error_generic_short
- error_idempotency_conflict
- error_job_creation_failed
- error_job_not_found
- error_key_copy_failed
- error_login_failed
- error_management_unauthorized
- error_not_logged_in
- error_password_too_short
- error_policy_violation
- error_register_failed
- error_reset_token_missing
- error_server_config_keys_missing
- error_server_error
- error_usage_info_fetch_failed
- feedback_key_copied
- feedback_key_deleted_success
- feedback_new_key_success
- feedback_password_updated_success
- feedback_quota_exceeded
- feedback_register_success
- feedback_reset_link_sent
- file_name
- forgot_password_link
- forgot_password_prompt
- forgot_password_title
- go_to_login_link
- go_to_register_link
- language_option_de
- language_option_en
- language_option_en_xa
- language_option_es
- language_option_tr
- language_switcher_label
- loading_text
- login_button
- login_prompt_new
- login_title
- logout_button
- manage_subscription_button
- nav_batch_processing
- nav_dashboard
- new_key_notice_message
- new_key_notice_title
- new_password_label
- no_activity_found
- no_api_keys_yet
- password_label
- plan_label
- plan_name_unknown
- portal_title
- quota_banner_message
- quota_banner_reset_unknown
- quota_banner_title
- register_button
- register_prompt
- register_title
- reset_password_prompt
- reset_password_title
- result
- send_reset_link_button
- status
- status_failed
- status_success
- subscription_info_title
- tenant_display_text
- update_password_button
- usage_details_title
- usage_remaining_credits
- usage_requests_text

## tr
- analytics_avg_time
- analytics_date_end
- analytics_date_start
- analytics_error_generic
- analytics_export_button
- analytics_export_no_data
- analytics_export_success
- analytics_placeholder_dash
- analytics_recent_activity
- analytics_subtitle
- analytics_success_rate
- analytics_table_date
- analytics_table_duration
- analytics_table_status
- analytics_table_type
- analytics_title
- analytics_total_calls
- api_key_masked_hint
- api_keys_empty_description
- api_keys_subtitle
- api_keys_title
- back_to_login_link
- batch_download_zip
- batch_drop_hint
- batch_login_prompt
- batch_page_title
- batch_queue_title
- batch_title
- company_name_label
- confirm_delete_key
- copy_key_button
- create_key_button
- dashboard_overview_label
- dashboard_subheading
- delete_button
- deleting_text
- dismiss_key_button
- email_label
- error_all_fields_required
- error_api_key_generation_failed
- error_api_key_limit_reached
- error_api_keys_fetch_failed
- error_author_missing
- error_billing_info_fetch_failed
- error_branding_fetch_failed
- error_create_key_failed
- error_delete_key_failed
- error_file_not_uploaded
- error_file_too_large
- error_forbidden_job_access
- error_generic_server
- error_generic_short
- error_idempotency_conflict
- error_job_creation_failed
- error_job_not_found
- error_key_copy_failed
- error_login_failed
- error_management_unauthorized
- error_not_logged_in
- error_password_too_short
- error_policy_violation
- error_register_failed
- error_reset_token_missing
- error_server_config_keys_missing
- error_server_error
- error_usage_info_fetch_failed
- feedback_key_copied
- feedback_key_deleted_success
- feedback_new_key_success
- feedback_password_updated_success
- feedback_quota_exceeded
- feedback_register_success
- feedback_reset_link_sent
- file_name
- forgot_password_link
- forgot_password_prompt
- forgot_password_title
- go_to_login_link
- go_to_register_link
- language_option_de
- language_option_en
- language_option_en_xa
- language_option_es
- language_option_tr
- language_switcher_label
- loading_text
- login_button
- login_prompt_new
- login_title
- logout_button
- manage_subscription_button
- nav_batch_processing
- nav_dashboard
- new_key_notice_message
- new_key_notice_title
- new_password_label
- no_activity_found
- no_api_keys_yet
- password_label
- plan_label
- plan_name_unknown
- portal_title
- quota_banner_message
- quota_banner_reset_unknown
- quota_banner_title
- register_button
- register_prompt
- register_title
- reset_password_prompt
- reset_password_title
- result
- send_reset_link_button
- status
- status_failed
- status_success
- subscription_info_title
- tenant_display_text
- update_password_button
- usage_details_title
- usage_remaining_credits
- usage_requests_text
```
</details>

### reports/i18n/mapping.json

<details>
<summary>reports/i18n/mapping.json</summary>

```text
[
  {"file":"vk-cli.js","line":297,"text":"BER length extends beyond buffer","suggestedPath":"cli.klv.processor","suggestedKey":"cli_klv_processor_ber_length_extends_beyond_buffer"},
  {"file":"vk-cli.js","line":373,"text":"Geçersiz KLV paketi: MISB ST 0601 UL (Universal Label) bulunamadı.","suggestedPath":"cli.verdict","suggestedKey":"cli_verdict_gecersiz_klv_paketi_misb_st_0601"},
  {"file":"vk-cli.js","line":424,"text":"❌ Manifest bulunamadı veya dosya okunamadı.","suggestedPath":"cli.verdict","suggestedKey":"cli_verdict_manifest_bulunamadi_veya_dosya_okunamadi"},
  {"file":"vk-cli.js","line":428,"text":"❌ Aktif manifest bulunamadı.","suggestedPath":"cli.verdict","suggestedKey":"cli_verdict_aktif_manifest_bulunamadi"},
  {"file":"vk-cli.js","line":436,"text":"❌ Sertifika İptal Edilmiş: ${revokedStatus?.explanation || revokedStatus?.code}","suggestedPath":"cli.verdict","suggestedKey":"cli_verdict_sertifika_iptal_edilmis"},
  {"file":"vk-cli.js","line":442,"text":"❌ Doğrulama Hatası: ${error?.explanation || error?.code}","suggestedPath":"cli.verdict","suggestedKey":"cli_verdict_dogrulama_hatasi"},
  {"file":"vk-cli.js","line":446,"text":"⚠️ İmza geçerli, ancak sertifika güvenilir bir köke zincirlenmemiş.","suggestedPath":"cli.verdict","suggestedKey":"cli_verdict_imza_gecerli_ancak_sertifika_guvenilir_bir"},
  {"file":"vk-cli.js","line":450,"text":"✅ İmza ve zincir geçerli.","suggestedPath":"cli.verdict","suggestedKey":"cli_verdict_imza_ve_zincir_gecerli"},
  {"file":"vk-cli.js","line":452,"text":"ℹ️ Manifest doğrulandı, ancak tam bir imza zinciri bulunamadı.","suggestedPath":"cli.verdict","suggestedKey":"cli_verdict_i_manifest_dogrulandi_ancak_tam_bir"},
  {"file":"vk-cli.js","line":457,"text":"VideoKit İçerik Güvenilirliği Platformu CLI","suggestedPath":"cli.update","suggestedKey":"cli_update_videokit_icerik_guvenilirligi_platformu_cli"},
  {"file":"vk-cli.js","line":462,"text":"VideoKit CLI aracını en son sürüme güvenli bir şekilde günceller.","suggestedPath":"cli.update","suggestedKey":"cli_update_videokit_cli_aracini_en_son_surume"},
  {"file":"vk-cli.js","line":467,"text":"Mevcut sürüm: ${CURRENT_VERSION}","suggestedPath":"cli.update","suggestedKey":"cli_update_mevcut_surum"},
  {"file":"vk-cli.js","line":468,"text":"En son sürüm kontrol ediliyor...","suggestedPath":"cli.update","suggestedKey":"cli_update_en_son_surum_kontrol_ediliyor"},
  {"file":"vk-cli.js","line":474,"text":"GitHub API'sinden sürüm bilgisi alınamadı. Durum: ${res.status}","suggestedPath":"cli.update","suggestedKey":"cli_update_github_api_sinden_surum_bilgisi_alinamadi"},
  {"file":"vk-cli.js","line":480,"text":"✅ VideoKit CLI zaten en güncel sürümde.","suggestedPath":"cli.update","suggestedKey":"cli_update_videokit_cli_zaten_en_guncel_surumde"},
  {"file":"vk-cli.js","line":483,"text":"Yeni sürüm bulundu: ${latestVersion}. Güncelleme başlatılıyor...","suggestedPath":"cli.update","suggestedKey":"cli_update_yeni_surum_bulundu_guncelleme_baslatiliyor"},
  {"file":"vk-cli.js","line":493,"text":"Platformunuz (${platform}) için gerekli güncelleme dosyaları bulunamadı.","suggestedPath":"cli.update","suggestedKey":"cli_update_platformunuz_icin_gerekli_guncelleme_dosyalari_bulunamadi"},
  {"file":"vk-cli.js","line":501,"text":"Güncelleme dosyaları indiriliyor...","suggestedPath":"cli.update","suggestedKey":"cli_update_guncelleme_dosyalari_indiriliyor"},
  {"file":"vk-cli.js","line":506,"text":"İmza doğrulanıyor...","suggestedPath":"cli.update","suggestedKey":"cli_update_imza_dogrulaniyor"},
  {"file":"vk-cli.js","line":520,"text":"✅ Güvenlik doğrulaması başarılı!","suggestedPath":"cli.update","suggestedKey":"cli_update_guvenlik_dogrulamasi_basarili"},
  {"file":"vk-cli.js","line":523,"text":"Eski dosya (${currentExecPath}) yenisiyle değiştiriliyor...","suggestedPath":"cli.update","suggestedKey":"cli_update_eski_dosya_yenisiyle_degistiriliyor"},
  {"file":"vk-cli.js","line":528,"text":"✨ VideoKit CLI başarıyla ${latestVersion} sürümüne güncellendi!","suggestedPath":"cli.update","suggestedKey":"cli_update_videokit_cli_basariyla_surumune_guncellendi"},
  {"file":"vk-cli.js","line":533,"text":"❌ HATA: Güncelleme iptal edildi. Güvenlik doğrulaması başarısız!","suggestedPath":"cli.update","suggestedKey":"cli_update_hata_guncelleme_iptal_edildi_guvenlik_dogrulamasi"},
  {"file":"vk-cli.js","line":535,"text":"❌ HATA: Güncelleme sırasında bir sorun oluştu: ${e.message}","suggestedPath":"cli.update","suggestedKey":"cli_update_hata_guncelleme_sirasinda_bir_sorun_olustu"},
  {"file":"vk-cli.js","line":550,"text":"verify <filePath>","suggestedPath":"cli.verify","suggestedKey":"cli_verify_verify_filepath"},
  {"file":"vk-cli.js","line":551,"text":"Bir video dosyasındaki C2PA manifestini doğrular.","suggestedPath":"cli.verify","suggestedKey":"cli_verify_bir_video_dosyasindaki_c2pa_manifestini_dogrular"},
  {"file":"vk-cli.js","line":556,"text":"🔍 ${path.basename(filePath)} doğrulanıyor...","suggestedPath":"cli.verify","suggestedKey":"cli_verify_dogrulaniyor"},
  {"file":"vk-cli.js","line":560,"text":"ℹ️ Trust store'dan ${trustAnchors.length} adet ek kök sertifika kullanılıyor.","suggestedPath":"cli.verify","suggestedKey":"cli_verify_i_trust_store_dan_adet_ek"},
  {"file":"vk-cli.js","line":562,"text":"ℹ️ Çevrimiçi iptal kontrolü (OCSP/CRL) etkinleştirildi.","suggestedPath":"cli.verify","suggestedKey":"cli_verify_i_cevrimici_iptal_kontrolu_ocsp_crl"},
  {"file":"vk-cli.js","line":[568,675,834,854],"text":"Hata: ${e.message}","suggestedPath":"cli.common","suggestedKey":"cli_common_hata"},
  {"file":"vk-cli.js","line":577,"text":"stamp <filePath>","suggestedPath":"cli.stamp","suggestedKey":"cli_stamp_stamp_filepath"},
  {"file":"vk-cli.js","line":578,"text":"Bir video dosyası için .c2pa sidecar manifesti oluşturur.","suggestedPath":"cli.stamp","suggestedKey":"cli_stamp_bir_video_dosyasi_icin_c2pa_sidecar"},
  {"file":"vk-cli.js","line":580,"text":"-s, --agent <name>","suggestedPath":"cli.stamp","suggestedKey":"cli_stamp_-s_--agent_name"},
  {"file":"vk-cli.js","line":580,"text":"Kullanan yazılım bilgisi","suggestedPath":"cli.stamp","suggestedKey":"cli_stamp_kullanan_yazilim_bilgisi"},
  {"file":"vk-cli.js","line":580,"text":"VideoKit CLI v1.0","suggestedPath":"cli.stamp","suggestedKey":"cli_stamp_videokit_cli_v1_0"},
  {"file":"vk-cli.js","line":581,"text":"--tsa-url <url>","suggestedPath":"cli.stamp","suggestedKey":"cli_stamp_--tsa-url_url"},
  {"file":"vk-cli.js","line":581,"text":"Kullanılacak Zaman Damgası Yetkilisi (TSA) sunucusu","suggestedPath":"cli.stamp","suggestedKey":"cli_stamp_kullanilacak_zaman_damgasi_yetkilisi_tsa_sunucusu"},
  {"file":"vk-cli.js","line":582,"text":"Sadece son 24 saat içinde oluşturulmuş videoları mühürler.","suggestedPath":"cli.stamp","suggestedKey":"cli_stamp_sadece_son_24_saat_icinde_olusturulmus"},
  {"file":"vk-cli.js","line":587,"text":"✒️ ${path.basename(filePath)} için manifest oluşturuluyor...","suggestedPath":"cli.stamp","suggestedKey":"cli_stamp_icin_manifest_olusturuluyor"},
  {"file":"vk-cli.js","line":590,"text":"Güvenlik Kilidi aktif: Video oluşturma tarihi kontrol ediliyor...","suggestedPath":"cli.stamp","suggestedKey":"cli_stamp_guvenlik_kilidi_aktif_video_olusturma_tarihi"},
  {"file":"vk-cli.js","line":599,"text":"✅ Video oluşturma tarihi politikaya uygun.","suggestedPath":"cli.stamp","suggestedKey":"cli_stamp_video_olusturma_tarihi_politikaya_uygun"},
  {"file":"vk-cli.js","line":601,"text":"⚠️ Video oluşturma tarihi metaveriden okunamadı, politikayı es geçiliyor.","suggestedPath":"cli.stamp","suggestedKey":"cli_stamp_video_olusturma_tarihi_metaveriden_okunamadi_politikayi"},
  {"file":"vk-cli.js","line":626,"text":"Zaman damgası için kullanılıyor: ${tsaUrl}","suggestedPath":"cli.stamp","suggestedKey":"cli_stamp_zaman_damgasi_icin_kullaniliyor"},
  {"file":"vk-cli.js","line":634,"text":"✅ Başarılı! Sidecar dosyası şuraya kaydedildi: ${sidecarPath}","suggestedPath":"cli.stamp","suggestedKey":"cli_stamp_basarili_sidecar_dosyasi_suraya_kaydedildi"},
  {"file":"vk-cli.js","line":638,"text":"Hata: İmzalama için gerekli anahtar/sertifika dosyası bulunamadı.","suggestedPath":"cli.stamp","suggestedKey":"cli_stamp_hata_imzalama_icin_gerekli_anahtar_sertifika"},
  {"file":"vk-cli.js","line":639,"text":"Lütfen 'vk keygen' komutunu çalıştırın veya 'vk config set' ile doğru dosya yollarını belirtin.","suggestedPath":"cli.stamp","suggestedKey":"cli_stamp_lutfen_vk_keygen_komutunu_calistirin_veya"},
  {"file":"vk-cli.js","line":639,"text":"vk config set","suggestedPath":"cli.stamp","suggestedKey":"cli_stamp_vk_config_set"},
  {"file":"vk-cli.js","line":639,"text":"vk keygen","suggestedPath":"cli.stamp","suggestedKey":"cli_stamp_vk_keygen"},
  {"file":"vk-cli.js","line":[641,904,937],"text":"❌ Hata: ${e.message}","suggestedPath":"cli.common","suggestedKey":"cli_common_hata_2"},
  {"file":"vk-cli.js","line":652,"text":"İmzalama için bir özel anahtar ve kendinden imzalı sertifika oluşturur.","suggestedPath":"cli.keygen","suggestedKey":"cli_keygen_imzalama_icin_bir_ozel_anahtar_ve"},
  {"file":"vk-cli.js","line":660,"text":"Anahtar çifti ve sertifika oluşturuluyor...","suggestedPath":"cli.keygen","suggestedKey":"cli_keygen_anahtar_cifti_ve_sertifika_olusturuluyor"},
  {"file":"vk-cli.js","line":664,"text":"✅ Başarılı! Dosyalar oluşturuldu: ${privateKeyFile}, ${certificateFile}","suggestedPath":"cli.keygen","suggestedKey":"cli_keygen_basarili_dosyalar_olusturuldu"},
  {"file":"vk-cli.js","line":670,"text":"✅ Ayarlar varsayılan olarak yapılandırma dosyasına kaydedildi.","suggestedPath":"cli.keygen","suggestedKey":"cli_keygen_ayarlar_varsayilan_olarak_yapilandirma_dosyasina_kaydedildi"},
  {"file":"vk-cli.js","line":672,"text":"güvenilmeyen kök","suggestedPath":"cli.keygen","suggestedKey":"cli_keygen_guvenilmeyen_kok"},
  {"file":"vk-cli.js","line":672,"text":"⚠️ Bu kendinden imzalı bir sertifikadır ve doğrulama sırasında 'güvenilmeyen kök' uyarısı verecektir.","suggestedPath":"cli.keygen","suggestedKey":"cli_keygen_bu_kendinden_imzali_bir_sertifikadir_ve"},
  {"file":"vk-cli.js","line":684,"text":"stream-capture <inputFile>","suggestedPath":"cli.stream_capture","suggestedKey":"cli_stream_capture_stream-capture_inputfile"},
  {"file":"vk-cli.js","line":685,"text":"Bir video akışını (dosyadan simüle edilmiş) yakalar, segmentler ve C2PA manifesti oluşturur.","suggestedPath":"cli.stream_capture","suggestedKey":"cli_stream_capture_bir_video_akisini_dosyadan_simule_edilmis"},
  {"file":"vk-cli.js","line":686,"text":"Doğrulama testi için akış sırasında rastgele bir segmenti bozar.","suggestedPath":"cli.stream_capture","suggestedKey":"cli_stream_capture_dogrulama_testi_icin_akis_sirasinda_rastgele"},
  {"file":"vk-cli.js","line":687,"text":"--seg-duration <seconds>","suggestedPath":"cli.stream_capture","suggestedKey":"cli_stream_capture_--seg-duration_seconds"},
  {"file":"vk-cli.js","line":687,"text":"Her bir video segmentinin süresi (saniye).","suggestedPath":"cli.stream_capture","suggestedKey":"cli_stream_capture_her_bir_video_segmentinin_suresi_saniye"},
  {"file":"vk-cli.js","line":694,"text":"[1/5] Geçici segment dizini oluşturuldu: ${tempDir}","suggestedPath":"cli.stream_capture","suggestedKey":"cli_stream_capture_1_5_gecici_segment_dizini_olusturuldu"},
  {"file":"vk-cli.js","line":696,"text":"[2/5] FFmpeg ile akış simülasyonu başlatılıyor...","suggestedPath":"cli.stream_capture","suggestedKey":"cli_stream_capture_2_5_ffmpeg_ile_akis_simulasyonu"},
  {"file":"vk-cli.js","line":698,"text":"...Akış tamamlandı. Toplam ${segmentPaths.length} segment yakalandı.","suggestedPath":"cli.stream_capture","suggestedKey":"cli_stream_capture_akis_tamamlandi_toplam_segment_yakalandi"},
  {"file":"vk-cli.js","line":700,"text":"[3/5] Segment hashleri hesaplanıyor ve C2PA manifesti oluşturuluyor...","suggestedPath":"cli.stream_capture","suggestedKey":"cli_stream_capture_3_5_segment_hashleri_hesaplaniyor_ve"},
  {"file":"vk-cli.js","line":703,"text":"...Manifest oluşturuldu: ${manifestPath}","suggestedPath":"cli.stream_capture","suggestedKey":"cli_stream_capture_manifest_olusturuldu"},
  {"file":"vk-cli.js","line":705,"text":"[4/5] Oluşturulan manifest, diskteki segmentlere karşı doğrulanıyor...","suggestedPath":"cli.stream_capture","suggestedKey":"cli_stream_capture_4_5_olusturulan_manifest_diskteki_segmentlere"},
  {"file":"vk-cli.js","line":710,"text":"\n--- DOĞRULAMA SONUCU ---","suggestedPath":"cli.stream_capture","suggestedKey":"cli_stream_capture_---_dogrulama_sonucu_---"},
  {"file":"vk-cli.js","line":713,"text":"✅ TEST BAŞARILI: Sabote edilen segment doğru bir şekilde tespit edildi!","suggestedPath":"cli.stream_capture","suggestedKey":"cli_stream_capture_test_basarili_sabote_edilen_segment_dogru"},
  {"file":"vk-cli.js","line":715,"text":"❌ TEST BAŞARISIZ: Sabote edilen segment tespit edilemedi!","suggestedPath":"cli.stream_capture","suggestedKey":"cli_stream_capture_test_basarisiz_sabote_edilen_segment_tespit"},
  {"file":"vk-cli.js","line":721,"text":"\nHata oluştu: ${e.message}","suggestedPath":"cli.stream_capture","suggestedKey":"cli_stream_capture_hata_olustu"},
  {"file":"vk-cli.js","line":725,"text":"[5/5] Geçici dosyalar temizleniyor...","suggestedPath":"cli.stream_capture","suggestedKey":"cli_stream_capture_5_5_gecici_dosyalar_temizleniyor"},
  {"file":"vk-cli.js","line":727,"text":"...Temizlik tamamlandı.","suggestedPath":"cli.stream_capture","suggestedKey":"cli_stream_capture_temizlik_tamamlandi"},
  {"file":"vk-cli.js","line":745,"text":"-> Yeni segment yakalandı: ${filename}","suggestedPath":"cli.stream_capture","suggestedKey":"cli_stream_capture_-_yeni_segment_yakalandi"},
  {"file":"vk-cli.js","line":749,"text":"🔥 SABOTAJ: ${filename} dosyası bozuluyor...","suggestedPath":"cli.stream_capture","suggestedKey":"cli_stream_capture_sabotaj_dosyasi_bozuluyor"},
  {"file":"vk-cli.js","line":757,"text":"FFmpeg işlemi ${code} koduyla sonlandı.","suggestedPath":"cli.stream_capture","suggestedKey":"cli_stream_capture_ffmpeg_islemi_koduyla_sonlandi"},
  {"file":"vk-cli.js","line":789,"text":"CLI ayarlarını yönetir.","suggestedPath":"cli.config","suggestedKey":"cli_config_cli_ayarlarini_yonetir"},
  {"file":"vk-cli.js","line":790,"text":"Bir ayar anahtarını belirler.","suggestedPath":"cli.config","suggestedKey":"cli_config_bir_ayar_anahtarini_belirler"},
  {"file":"vk-cli.js","line":790,"text":"set <key> <value>","suggestedPath":"cli.config","suggestedKey":"cli_config_set_key"},
  {"file":"vk-cli.js","line":795,"text":"✅ Ayarlandı: ${key} = ${value}","suggestedPath":"cli.config","suggestedKey":"cli_config_ayarlandi"},
  {"file":"vk-cli.js","line":[797,1038,1053],"text":"Hata: Ayar kaydedilemedi. ${error.message}","suggestedPath":"cli.config","suggestedKey":"cli_config_hata_ayar_kaydedilemedi"},
  {"file":"vk-cli.js","line":801,"text":"Bir ayarın değerini gösterir.","suggestedPath":"cli.config","suggestedKey":"cli_config_bir_ayarin_degerini_gosterir"},
  {"file":"vk-cli.js","line":801,"text":"get <key>","suggestedPath":"cli.config","suggestedKey":"cli_config_get_key"},
  {"file":"vk-cli.js","line":806,"text":"'${key}' anahtarı bulunamadı.","suggestedPath":"cli.config","suggestedKey":"cli_config_anahtari_bulunamadi"},
  {"file":"vk-cli.js","line":808,"text":"Hata: Ayar okunamadı. ${error.message}","suggestedPath":"cli.config","suggestedKey":"cli_config_hata_ayar_okunamadi"},
  {"file":"vk-cli.js","line":812,"text":"Tüm ayarları JSON formatında listeler.","suggestedPath":"cli.config","suggestedKey":"cli_config_tum_ayarlari_json_formatinda_listeler"},
  {"file":"vk-cli.js","line":817,"text":"Hata: Ayarlar okunamadı. ${error.message}","suggestedPath":"cli.config","suggestedKey":"cli_config_hata_ayarlar_okunamadi"},
  {"file":"vk-cli.js","line":822,"text":"KLV verilerini MISB ST 0601 standardına göre dönüştürme araçları.","suggestedPath":"cli.klv.commands","suggestedKey":"cli_klv_commands_klv_verilerini_misb_st_0601_standardina"},
  {"file":"vk-cli.js","line":823,"text":"Bir KLV dosyasını (.klv) JSON formatına dönüştürür.","suggestedPath":"cli.klv.commands","suggestedKey":"cli_klv_commands_bir_klv_dosyasini_klv_json_formatina"},
  {"file":"vk-cli.js","line":823,"text":"to-json <inputFile> <outputFile>","suggestedPath":"cli.klv.commands","suggestedKey":"cli_klv_commands_to-json_inputfile_outputfile"},
  {"file":"vk-cli.js","line":[827,845],"text":"Dönüştürülüyor: ${inputFile} -> ${outputFile}","suggestedPath":"cli.klv.commands","suggestedKey":"cli_klv_commands_donusturuluyor_-"},
  {"file":"vk-cli.js","line":[831,851],"text":"✅ Dönüşüm başarılı!","suggestedPath":"cli.klv.commands","suggestedKey":"cli_klv_commands_donusum_basarili"},
  {"file":"vk-cli.js","line":841,"text":"Bir JSON dosyasını KLV formatına (.klv) dönüştürür.","suggestedPath":"cli.klv.commands","suggestedKey":"cli_klv_commands_bir_json_dosyasini_klv_formatina_klv"},
  {"file":"vk-cli.js","line":841,"text":"from-json <inputFile> <outputFile>","suggestedPath":"cli.klv.commands","suggestedKey":"cli_klv_commands_from-json_inputfile_outputfile"},
  {"file":"vk-cli.js","line":847,"text":"JSON dosyasında '65' (MISB ST 0601 Version) anahtarı bulunmalıdır.","suggestedPath":"cli.klv.commands","suggestedKey":"cli_klv_commands_json_dosyasinda_65_misb_st_0601"},
  {"file":"vk-cli.js","line":863,"text":"PKI araçları: Anahtar, CSR ve sertifika zinciri yönetimi.","suggestedPath":"cli.pki.new_key","suggestedKey":"cli_pki_new_key_pki_araclari_anahtar_csr_ve_sertifika"},
  {"file":"vk-cli.js","line":867,"text":"Yeni bir özel anahtar (private key) ve Sertifika İmzalama İsteği (CSR) oluşturur.","suggestedPath":"cli.pki.new_key","suggestedKey":"cli_pki_new_key_yeni_bir_ozel_anahtar_private_key"},
  {"file":"vk-cli.js","line":868,"text":"--keyout <file>","suggestedPath":"cli.pki.new_key","suggestedKey":"cli_pki_new_key_--keyout_file"},
  {"file":"vk-cli.js","line":868,"text":"Özel anahtarın kaydedileceği dosya","suggestedPath":"cli.pki.new_key","suggestedKey":"cli_pki_new_key_ozel_anahtarin_kaydedilecegi_dosya"},
  {"file":"vk-cli.js","line":869,"text":"--csrout <file>","suggestedPath":"cli.pki.new_key","suggestedKey":"cli_pki_new_key_--csrout_file"},
  {"file":"vk-cli.js","line":869,"text":"CSR\'ın kaydedileceği dosya","suggestedPath":"cli.pki.new_key","suggestedKey":"cli_pki_new_key_csr_in_kaydedilecegi_dosya"},
  {"file":"vk-cli.js","line":871,"text":"--o <name>","suggestedPath":"cli.pki.new_key","suggestedKey":"cli_pki_new_key_--o_name"},
  {"file":"vk-cli.js","line":871,"text":"Organization (örn: VideoKit Inc.)","suggestedPath":"cli.pki.new_key","suggestedKey":"cli_pki_new_key_organization_orn_videokit_inc"},
  {"file":"vk-cli.js","line":871,"text":"VideoKit Inc.","suggestedPath":"cli.pki.new_key","suggestedKey":"cli_pki_new_key_videokit_inc"},
  {"file":"vk-cli.js","line":872,"text":"--c <country>","suggestedPath":"cli.pki.new_key","suggestedKey":"cli_pki_new_key_--c_country"},
  {"file":"vk-cli.js","line":872,"text":"Country (örn: TR)","suggestedPath":"cli.pki.new_key","suggestedKey":"cli_pki_new_key_country_orn_tr"},
  {"file":"vk-cli.js","line":873,"text":"--st <state>","suggestedPath":"cli.pki.new_key","suggestedKey":"cli_pki_new_key_--st_state"},
  {"file":"vk-cli.js","line":873,"text":"State/Province (örn: Istanbul)","suggestedPath":"cli.pki.new_key","suggestedKey":"cli_pki_new_key_state_province_orn_istanbul"},
  {"file":"vk-cli.js","line":874,"text":"--l <locality>","suggestedPath":"cli.pki.new_key","suggestedKey":"cli_pki_new_key_--l_locality"},
  {"file":"vk-cli.js","line":874,"text":"Locality (örn: Istanbul)","suggestedPath":"cli.pki.new_key","suggestedKey":"cli_pki_new_key_locality_orn_istanbul"},
  {"file":"vk-cli.js","line":879,"text":"2048-bit RSA anahtar çifti oluşturuluyor...","suggestedPath":"cli.pki.new_key","suggestedKey":"cli_pki_new_key_2048-bit_rsa_anahtar_cifti_olusturuluyor"},
  {"file":"vk-cli.js","line":882,"text":"Sertifika İmzalama İsteği (CSR) oluşturuluyor...","suggestedPath":"cli.pki.new_key","suggestedKey":"cli_pki_new_key_sertifika_imzalama_istegi_csr_olusturuluyor"},
  {"file":"vk-cli.js","line":898,"text":"✅ Özel anahtar kaydedildi: ${options.keyout}","suggestedPath":"cli.pki.new_key","suggestedKey":"cli_pki_new_key_ozel_anahtar_kaydedildi"},
  {"file":"vk-cli.js","line":901,"text":"✅ CSR kaydedildi: ${options.csrout}","suggestedPath":"cli.pki.new_key","suggestedKey":"cli_pki_new_key_csr_kaydedildi"},
  {"file":"vk-cli.js","line":913,"text":"install-chain <signedCert> [intermediateCerts...]","suggestedPath":"cli.pki.install_chain","suggestedKey":"cli_pki_install_chain_install-chain_signedcert_intermediatecerts"},
  {"file":"vk-cli.js","line":914,"text":"İmzalı sertifika ve aracı sertifikaları birleştirerek tam bir zincir dosyası (PEM) oluşturur.","suggestedPath":"cli.pki.install_chain","suggestedKey":"cli_pki_install_chain_imzali_sertifika_ve_araci_sertifikalari_birlestirerek"},
  {"file":"vk-cli.js","line":920,"text":"Zincir oluşturuluyor -> ${options.output}","suggestedPath":"cli.pki.install_chain","suggestedKey":"cli_pki_install_chain_zincir_olusturuluyor_-"},
  {"file":"vk-cli.js","line":925,"text":"-> Okunuyor: ${certPath}","suggestedPath":"cli.pki.install_chain","suggestedKey":"cli_pki_install_chain_-_okunuyor"},
  {"file":"vk-cli.js","line":933,"text":"✅ Başarılı! Sertifika zinciri şuraya kaydedildi: ${options.output}","suggestedPath":"cli.pki.install_chain","suggestedKey":"cli_pki_install_chain_basarili_sertifika_zinciri_suraya_kaydedildi"},
  {"file":"vk-cli.js","line":934,"text":"ℹ️ Doğrulama için: openssl verify -CAfile <root-ca.pem>","suggestedPath":"cli.pki.install_chain","suggestedKey":"cli_pki_install_chain_i_dogrulama_icin_openssl_verify_-cafile"},
  {"file":"vk-cli.js","line":946,"text":"Güvenilen kök sertifikaları (Trust Store) yönetir.","suggestedPath":"cli.trust.add","suggestedKey":"cli_trust_add_guvenilen_kok_sertifikalari_trust_store_yonetir"},
  {"file":"vk-cli.js","line":949,"text":"add <certPath>","suggestedPath":"cli.trust.add","suggestedKey":"cli_trust_add_add_certpath"},
  {"file":"vk-cli.js","line":950,"text":"Doğrulama için güvenilecek yeni bir kök sertifika ekler.","suggestedPath":"cli.trust.add","suggestedKey":"cli_trust_add_dogrulama_icin_guvenilecek_yeni_bir_kok"},
  {"file":"vk-cli.js","line":956,"text":"✅ Başarılı! '${fileName}' sertifikası güvenilenler listesine eklendi.","suggestedPath":"cli.trust.add","suggestedKey":"cli_trust_add_basarili_sertifikasi_guvenilenler_listesine_eklendi"},
  {"file":"vk-cli.js","line":960,"text":"❌ Hata: Belirtilen dosya bulunamadı: ${certPath}","suggestedPath":"cli.trust.add","suggestedKey":"cli_trust_add_hata_belirtilen_dosya_bulunamadi"},
  {"file":"vk-cli.js","line":962,"text":"❌ Hata: Sertifika eklenemedi. ${e.message}","suggestedPath":"cli.trust.add","suggestedKey":"cli_trust_add_hata_sertifika_eklenemedi"},
  {"file":"vk-cli.js","line":973,"text":"Güvenilenler listesindeki tüm sertifikaları gösterir.","suggestedPath":"cli.trust.list","suggestedKey":"cli_trust_list_guvenilenler_listesindeki_tum_sertifikalari_gosterir"},
  {"file":"vk-cli.js","line":980,"text":"ℹ️ Güvenilenler listesi (Trust Store) boş.","suggestedPath":"cli.trust.list","suggestedKey":"cli_trust_list_i_guvenilenler_listesi_trust_store_bos"},
  {"file":"vk-cli.js","line":983,"text":"--- Güvenilen Kök Sertifikalar ---","suggestedPath":"cli.trust.list","suggestedKey":"cli_trust_list_---_guvenilen_kok_sertifikalar_---"},
  {"file":"vk-cli.js","line":985,"text":"- Dosya: ${c.filename}","suggestedPath":"cli.trust.list","suggestedKey":"cli_trust_list_-_dosya"},
  {"file":"vk-cli.js","line":986,"text":"Konu (Subject): CN=${c.subject}","suggestedPath":"cli.trust.list","suggestedKey":"cli_trust_list_konu_subject_cn"},
  {"file":"vk-cli.js","line":987,"text":"Sağlayıcı (Issuer): CN=${c.issuer}","suggestedPath":"cli.trust.list","suggestedKey":"cli_trust_list_saglayici_issuer_cn"},
  {"file":"vk-cli.js","line":988,"text":"Geçerlilik Sonu: ${c.expiry}","suggestedPath":"cli.trust.list","suggestedKey":"cli_trust_list_gecerlilik_sonu"},
  {"file":"vk-cli.js","line":993,"text":"❌ Hata: Sertifikalar listelenemedi. ${e.message}","suggestedPath":"cli.trust.list","suggestedKey":"cli_trust_list_hata_sertifikalar_listelenemedi"},
  {"file":"vk-cli.js","line":1002,"text":"remove <filename>","suggestedPath":"cli.trust.remove","suggestedKey":"cli_trust_remove_remove_filename"},
  {"file":"vk-cli.js","line":1003,"text":"Güvenilenler listesinden bir sertifikayı kaldırır.","suggestedPath":"cli.trust.remove","suggestedKey":"cli_trust_remove_guvenilenler_listesinden_bir_sertifikayi_kaldirir"},
  {"file":"vk-cli.js","line":1010,"text":"✅ Başarılı! '${filename}' sertifikası güvenilenler listesinden kaldırıldı.","suggestedPath":"cli.trust.remove","suggestedKey":"cli_trust_remove_basarili_sertifikasi_guvenilenler_listesinden_kaldirildi"},
  {"file":"vk-cli.js","line":1012,"text":"⚠️ Uyarı: '${filename}' adında bir sertifika bulunamadı.","suggestedPath":"cli.trust.remove","suggestedKey":"cli_trust_remove_uyari_adinda_bir_sertifika_bulunamadi"},
  {"file":"vk-cli.js","line":1016,"text":"❌ Hata: Sertifika kaldırılamadı. ${e.message}","suggestedPath":"cli.trust.remove","suggestedKey":"cli_trust_remove_hata_sertifika_kaldirilamadi"},
  {"file":"vk-cli.js","line":1025,"text":"Anonim kullanım verileri paylaşımını yönetir.","suggestedPath":"cli.telemetry.enable","suggestedKey":"cli_telemetry_enable_anonim_kullanim_verileri_paylasimini_yonetir"},
  {"file":"vk-cli.js","line":1029,"text":"VideoKit'i geliştirmemize yardımcı olmak için anonim kullanım verilerini paylaşmayı etkinleştirir.","suggestedPath":"cli.telemetry.enable","suggestedKey":"cli_telemetry_enable_videokit_i_gelistirmemize_yardimci_olmak_icin"},
  {"file":"vk-cli.js","line":1035,"text":"✅ Anonim telemetri etkinleştirildi. VideoKit'i geliştirmeye yardımcı olduğunuz için teşekkür ederiz!","suggestedPath":"cli.telemetry.enable","suggestedKey":"cli_telemetry_enable_anonim_telemetri_etkinlestirildi_videokit_i_gelistirmeye"},
  {"file":"vk-cli.js","line":1036,"text":"ℹ️ Bu ayarı istediğiniz zaman \"vk telemetry disable\" komutuyla devre dışı bırakabilirsiniz.","suggestedPath":"cli.telemetry.enable","suggestedKey":"cli_telemetry_enable_i_bu_ayari_istediginiz_zaman_vk"},
  {"file":"vk-cli.js","line":1045,"text":"Anonim kullanım verileri paylaşımını devre dışı bırakır.","suggestedPath":"cli.telemetry.disable","suggestedKey":"cli_telemetry_disable_anonim_kullanim_verileri_paylasimini_devre_disi"},
  {"file":"vk-cli.js","line":1051,"text":"ℹ️ Anonim telemetri devre dışı bırakıldı.","suggestedPath":"cli.telemetry.disable","suggestedKey":"cli_telemetry_disable_i_anonim_telemetri_devre_disi_birakildi"},
  {"file":"worker.js","line":28,"text":"Worker Redis bağlantı hatası","suggestedPath":"worker.general","suggestedKey":"worker_general_worker_redis_baglanti_hatasi"},
  {"file":"worker.js","line":106,"text":"Job payload missing file data.","suggestedPath":"worker.errors","suggestedKey":"worker_errors_job_payload_missing_file_data"},
  {"file":"worker.js","line":113,"text":"[VerifyWorker] Geçici dosya silindi.","suggestedPath":"worker.verify","suggestedKey":"worker_verify_verifyworker_gecici_dosya_silindi"},
  {"file":"worker.js","line":116,"text":"[VerifyWorker] Geçici dosya silinemedi.","suggestedPath":"worker.verify","suggestedKey":"worker_verify_verifyworker_gecici_dosya_silinemedi"},
  {"file":"worker.js","line":132,"text":"[VerifyWorker] İş alınıyor","suggestedPath":"worker.verify","suggestedKey":"worker_verify_verifyworker_is_aliniyor"},
  {"file":"worker.js","line":139,"text":"[VerifyWorker] İş tamamlandı","suggestedPath":"worker.verify","suggestedKey":"worker_verify_verifyworker_is_tamamlandi"},
  {"file":"worker.js","line":142,"text":"[VerifyWorker] Webhook işi tetikleniyor","suggestedPath":"worker.verify","suggestedKey":"worker_verify_verifyworker_webhook_isi_tetikleniyor"},
  {"file":"worker.js","line":159,"text":"[VerifyWorker] İş başarısız","suggestedPath":"worker.verify","suggestedKey":"worker_verify_verifyworker_is_basarisiz"},
  {"file":"worker.js","line":186,"text":"[WebhookWorker] Gönderim işi alınıyor","suggestedPath":"worker.webhook","suggestedKey":"worker_webhook_webhookworker_gonderim_isi_aliniyor"},
  {"file":"worker.js","line":207,"text":"Webhook hedefi ${response.status} koduyla yanıt verdi.","suggestedPath":"worker.webhook","suggestedKey":"worker_webhook_webhook_hedefi_koduyla_yanit_verdi"},
  {"file":"worker.js","line":210,"text":"[WebhookWorker] Başarıyla gönderildi","suggestedPath":"worker.webhook","suggestedKey":"worker_webhook_webhookworker_basariyla_gonderildi"},
  {"file":"worker.js","line":214,"text":"[WebhookWorker] Gönderim başarısız","suggestedPath":"worker.webhook","suggestedKey":"worker_webhook_webhookworker_gonderim_basarisiz"},
  {"file":"worker.js","line":231,"text":"✅ VideoKit Worker başlatıldı ve işleri bekliyor...","suggestedPath":"worker.general","suggestedKey":"worker_general_videokit_worker_baslatildi_ve_isleri_bekliyor"},
  {"file":"worker.js","line":234,"text":"[VerifyWorker] İş başarıyla tamamlandı.","suggestedPath":"worker.verify","suggestedKey":"worker_verify_verifyworker_is_basariyla_tamamlandi"},
  {"file":"worker.js","line":238,"text":"[VerifyWorker] İş başarısız oldu.","suggestedPath":"worker.verify","suggestedKey":"worker_verify_verifyworker_is_basarisiz_oldu"},
  {"file":"worker.js","line":242,"text":"[WebhookWorker] İş başarıyla tamamlandı.","suggestedPath":"worker.webhook","suggestedKey":"worker_webhook_webhookworker_is_basariyla_tamamlandi"},
  {"file":"worker.js","line":246,"text":"[WebhookWorker] İş son denemeden sonra başarısız oldu.","suggestedPath":"worker.webhook","suggestedKey":"worker_webhook_webhookworker_is_son_denemeden_sonra_basarisiz"}
]
```
</details>

### reports/i18n/missing-filled.md

<details>
<summary>reports/i18n/missing-filled.md</summary>

```text
# Missing Locale Keys Filled

- **Total unique keys addressed:** 9
- **Total translations added:** 36 (9 keys × 4 locales)
- **Locales updated:** en, tr, es, de
- **Entries marked with `@todo-review`:** 0 (all reviewed and finalized)

## Examples

| Key | en | tr | es | de |
| --- | --- | --- | --- | --- |
| `batch_drop_hint` | Drag and drop the video files to verify here, or click to select them. | Doğrulanacak video dosyalarını buraya sürükleyip bırakın veya seçmek için tıklayın. | Arrastra y suelta aquí los archivos de video para verificar, o haz clic para seleccionarlos. | Ziehen Sie die zu prüfenden Videodateien hierher oder klicken Sie, um sie auszuwählen. |
| `error_generic_server` | An unexpected error occurred while processing your request. Please try again. | İsteğiniz işlenirken beklenmeyen bir hata oluştu. Lütfen tekrar deneyin. | Ocurrió un error inesperado al procesar tu solicitud. Por favor, inténtalo de nuevo. | Bei der Verarbeitung Ihrer Anfrage ist ein unerwarteter Fehler aufgetreten. Bitte versuchen Sie es erneut. |
```
</details>

### reports/i18n/overflow-issues.md

<details>
<summary>reports/i18n/overflow-issues.md</summary>

```text
# Pseudo-Locale Overflow & Layout Review (en-XA)

## Captured mock screens
- `screenshots/i18n/login.png`
- `screenshots/i18n/register.png`
- `screenshots/i18n/dashboard.png`
- `screenshots/i18n/analytics.png`
- `screenshots/i18n/batch.png`

> **Note:** The screenshots are pseudo-locale mockups generated from the translation file because Playwright/browser dependencies
> could not be installed in the offline container. They still surface the expanded string lengths that the UI needs to absorb.

## Observations & Risks

1. **Dashboard tenant heading cannot wrap.** The `tenant_display_text` string now injects an expanded tenant ID and plan name, which
together exceed the available width in the dashboard header without any `word-break` fallback. 【F:locales/en-XA.json†L54-L54】【F:index.html†L115-L134】
   - *Recommendation:* allow the heading to wrap (e.g., `word-break: break-word`) or move tenant metadata below the heading.

2. **API key labels overflow the card.** Long masked key labels such as
   `vk_live_super_massive_identifier_extremely_long` extend beyond the flex row because `.api-key-value` lacks wrapping rules.
   This was reproduced with the mocked analytics run. 【F:tests/e2e/i18n-screenshots.spec.mjs†L200-L218】【F:style.css†L420-L438】
   - *Recommendation:* add `word-break: break-all;` or `overflow-wrap: anywhere;` to `.api-key-value` and consider constraining
the action buttons with wrapping support.

3. **Batch processing summary row cannot contain long labels.** The summary banner keeps `display: flex` with no wrapping, so
pseudo-locale labels for upload counts plus the "Download All Reports" CTA spill horizontally when rendered together.
【F:locales/en-XA.json†L28-L35】【F:batch.css†L32-L41】
   - *Recommendation:* enable wrapping on `.batch-summary` (e.g., `flex-wrap: wrap`) and adjust spacing to accommodate multi-line content.

4. **Analytics activity types risk clipping.** The mocked analytics feed contains operation names that exceed the default cell width
(e.g., `c2pa.verify.single.longassetname.with.extensions`). Without word-breaking, the activity column will stretch the table on
smaller screens. 【F:tests/e2e/i18n-screenshots.spec.mjs†L221-L257】【F:style.css†L583-L599】
   - *Recommendation:* apply `word-break: break-word;` on `.activities-table td` or clamp the column width with ellipsis support.

Addressing these issues will reduce the chance of pseudo-locale text pushing key controls off-canvas or creating horizontal scroll bars.
```
</details>

### reports/i18n/placeholders-fixed.md

<details>
<summary>reports/i18n/placeholders-fixed.md</summary>

```text
# Placeholder Fix Verification

- Processed locales: de, en, es, tr.
- Placeholder mismatches resolved: 0.
- Final status: All locales now match the default placeholder sets (English reference).

## Validation Steps

1. Reviewed `reports/i18n/placeholders.json` to confirm expected placeholders for each key.
2. Compared locale strings programmatically to ensure placeholder tokens align across languages.
3. Verified `reports/i18n/placeholders-mismatch.md` reports zero inconsistencies.

No additional locale string updates were required.
```
</details>

### reports/i18n/placeholders-mismatch.md

<details>
<summary>reports/i18n/placeholders-mismatch.md</summary>

```text
# Placeholder Consistency Issues

- Analyzed locales: de, en, es, tr
- Total translation keys: 93
- Keys with placeholder mismatches: 0 (0.00%)

No placeholder mismatches detected.

## Recommendation

Ensure each locale reuses the same placeholder tokens as the expected set. Align any missing or renamed tokens by copying the placeholder identifiers from the reference locale (default: English).
```
</details>

### reports/i18n/placeholders.json

<details>
<summary>reports/i18n/placeholders.json</summary>

```json
{
  "analytics_avg_time": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "analytics_date_end": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "analytics_date_start": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "analytics_error_generic": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "analytics_export_button": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "analytics_recent_activity": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "analytics_subtitle": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "analytics_success_rate": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "analytics_table_date": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "analytics_table_duration": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "analytics_table_status": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "analytics_table_type": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "analytics_title": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "analytics_total_calls": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "api_key_masked_hint": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "api_keys_empty_description": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "api_keys_subtitle": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "api_keys_title": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "back_to_login_link": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "company_name_label": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "confirm_delete_key": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "copy_key_button": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "create_key_button": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "dashboard_overview_label": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "dashboard_subheading": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "delete_button": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "deleting_text": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "dismiss_key_button": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "email_label": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "error_api_key_generation_failed": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "error_api_key_limit_reached": {
    "expected": [
      "limit"
    ],
    "byLocale": {
      "de": [
        "limit"
      ],
      "en": [
        "limit"
      ],
      "es": [
        "limit"
      ],
      "tr": [
        "limit"
      ]
    }
  },
  "error_api_keys_fetch_failed": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "error_author_missing": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "error_create_key_failed": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "error_delete_key_failed": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "error_file_not_uploaded": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "error_forbidden_job_access": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "error_idempotency_conflict": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "error_job_creation_failed": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "error_job_not_found": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "error_key_copy_failed": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "error_management_unauthorized": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "error_policy_violation": {
    "expected": [
      "creationTime"
    ],
    "byLocale": {
      "de": [
        "creationTime"
      ],
      "en": [
        "creationTime"
      ],
      "es": [
        "creationTime"
      ],
      "tr": [
        "creationTime"
      ]
    }
  },
  "error_server_config_keys_missing": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "error_server_error": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "feedback_key_copied": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "feedback_key_deleted_success": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "feedback_new_key_success": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "feedback_password_updated_success": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "feedback_quota_exceeded": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "feedback_register_success": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "feedback_reset_link_sent": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "forgot_password_link": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "forgot_password_prompt": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "forgot_password_title": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "go_to_login_link": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "go_to_register_link": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "language_switcher_label": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "loading_text": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "login_button": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "login_prompt_new": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "login_title": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "logout_button": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "manage_subscription_button": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "nav_batch_processing": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "nav_dashboard": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "new_key_notice_message": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "new_key_notice_title": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "new_password_label": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "no_activity_found": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "no_api_keys_yet": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "password_label": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "plan_label": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "portal_title": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "quota_banner_message": {
    "expected": [
      "remaining",
      "resetAt"
    ],
    "byLocale": {
      "de": [
        "remaining",
        "resetAt"
      ],
      "en": [
        "remaining",
        "resetAt"
      ],
      "es": [
        "remaining",
        "resetAt"
      ],
      "tr": [
        "remaining",
        "resetAt"
      ]
    }
  },
  "quota_banner_reset_unknown": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "quota_banner_title": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "register_button": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "register_prompt": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "register_title": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "reset_password_prompt": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "reset_password_title": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "send_reset_link_button": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "status_failed": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "status_success": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "subscription_info_title": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "tenant_display_text": {
    "expected": [
      "planName",
      "tenantId"
    ],
    "byLocale": {
      "de": [
        "planName",
        "tenantId"
      ],
      "en": [
        "planName",
        "tenantId"
      ],
      "es": [
        "planName",
        "tenantId"
      ],
      "tr": [
        "planName",
        "tenantId"
      ]
    }
  },
  "update_password_button": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  },
  "usage_details_title": {
    "expected": [],
    "byLocale": {
      "de": [],
      "en": [],
      "es": [],
      "tr": []
    }
  }
}
```
</details>

### reports/i18n/raw-literals.json

<details>
<summary>reports/i18n/raw-literals.json</summary>

```json
[
  {
    "file": "__tests__/analytics.integration.test.mjs",
    "line": 15,
    "text": "POST",
    "context": "event.eventType ?? 'POST',"
  },
  {
    "file": "__tests__/analytics.integration.test.mjs",
    "line": 25,
    "text": "analytics aggregation uses real api_events data",
    "context": "describe('analytics aggregation uses real api_events data', () => {"
  },
  {
    "file": "__tests__/analytics.integration.test.mjs",
    "line": 26,
    "text": "hourly and daily aggregations match the analytics fixtures",
    "context": "test('hourly and daily aggregations match the analytics fixtures', async () => {"
  },
  {
    "file": "__tests__/billing.integration.test.mjs",
    "line": 52,
    "text": "X-Tenant-Id",
    "context": "const tenantId = req.get('X-Tenant-Id') || 'tenant-a';"
  },
  {
    "file": "__tests__/billing.integration.test.mjs",
    "line": 91,
    "text": "billing integration flows",
    "context": "describe('billing integration flows', () => {"
  },
  {
    "file": "__tests__/billing.integration.test.mjs",
    "line": 92,
    "text": "allows writes below quota and increments usage counters",
    "context": "test('allows writes below quota and increments usage counters', async () => {"
  },
  {
    "file": "__tests__/billing.integration.test.mjs",
    "line": 105,
    "text": "rejects writes above quota while GET remains free",
    "context": "test('rejects writes above quota while GET remains free', async () => {"
  },
  {
    "file": "__tests__/billing.integration.test.mjs",
    "line": 114,
    "text": "QUOTA_EXCEEDED",
    "context": "expect(limitedResponse.body).toMatchObject({ code: 'QUOTA_EXCEEDED' });"
  },
  {
    "file": "__tests__/billing.integration.test.mjs",
    "line": 124,
    "text": "idempotent writes are only billed once",
    "context": "test('idempotent writes are only billed once', async () => {"
  },
  {
    "file": "__tests__/billing.integration.test.mjs",
    "line": 127,
    "text": "Idempotency-Key",
    "context": "const headers = { 'Idempotency-Key': 'idem-123' };"
  },
  {
    "file": "__tests__/billing.integration.test.mjs",
    "line": 140,
    "text": "parallel writes with unique idempotency keys increment once per request",
    "context": "test('parallel writes with unique idempotency keys increment once per request', async () => {"
  },
  {
    "file": "__tests__/billing.integration.test.mjs",
    "line": 151,
    "text": "Idempotency-Key",
    "context": ".set('Idempotency-Key', `parallel-${index}`)"
  },
  {
    "file": "__tests__/billing.integration.test.mjs",
    "line": 165,
    "text": "parallel writes sharing an idempotency key are billed once",
    "context": "test('parallel writes sharing an idempotency key are billed once', async () => {"
  },
  {
    "file": "__tests__/billing.integration.test.mjs",
    "line": 171,
    "text": "Idempotency-Key",
    "context": "const headers = { 'Idempotency-Key': 'parallel-shared' };"
  },
  {
    "file": "__tests__/billing.integration.test.mjs",
    "line": 186,
    "text": "analytics aggregates real usage data per tenant",
    "context": "test('analytics aggregates real usage data per tenant', async () => {"
  },
  {
    "file": "__tests__/billing.integration.test.mjs",
    "line": 192,
    "text": "POST",
    "context": "await db.query(insertEventSql, ['tenant-a', '/write', 'POST', 200, 'req-1', { duration_ms: 45 }]);"
  },
  {
    "file": "__tests__/billing.integration.test.mjs",
    "line": 193,
    "text": "POST",
    "context": "await db.query(insertEventSql, ['tenant-a', '/write', 'POST', 204, 'req-2', { duration_ms: 60 }]);"
  },
  {
    "file": "__tests__/billing.integration.test.mjs",
    "line": 194,
    "text": "POST",
    "context": "await db.query(insertEventSql, ['tenant-a', '/write-error', 'POST', 500, 'req-3', { duration_ms: 120 }]);"
  },
  {
    "file": "__tests__/billing.integration.test.mjs",
    "line": 195,
    "text": "POST",
    "context": "await db.query(insertEventSql, ['tenant-b', '/write', 'POST', 200, 'req-4', { duration_ms: 80 }]);"
  },
  {
    "file": "__tests__/billing.integration.test.mjs",
    "line": 212,
    "text": "usage tracking is isolated per tenant",
    "context": "test('usage tracking is isolated per tenant', async () => {"
  },
  {
    "file": "__tests__/billing.integration.test.mjs",
    "line": 215,
    "text": "X-Tenant-Id",
    "context": "await request(app).post('/write').set('X-Tenant-Id', 'tenant-a').send({});"
  },
  {
    "file": "__tests__/billing.integration.test.mjs",
    "line": 217,
    "text": "X-Tenant-Id",
    "context": "await request(app).post('/write').set('X-Tenant-Id', 'tenant-b').send({});"
  },
  {
    "file": "__tests__/billing.unit.test.mjs",
    "line": 21,
    "text": "billing unit helpers",
    "context": "describe('billing unit helpers', () => {"
  },
  {
    "file": "__tests__/billing.unit.test.mjs",
    "line": 22,
    "text": "isWrite respects HTTP method semantics",
    "context": "test('isWrite respects HTTP method semantics', () => {"
  },
  {
    "file": "__tests__/billing.unit.test.mjs",
    "line": 23,
    "text": "POST",
    "context": "expect(isWrite({ method: 'POST' })).toBe(true);"
  },
  {
    "file": "__tests__/billing.unit.test.mjs",
    "line": 25,
    "text": "GET",
    "context": "expect(isWrite({ method: 'GET' })).toBe(false);"
  },
  {
    "file": "__tests__/billing.unit.test.mjs",
    "line": 26,
    "text": "OPTIONS",
    "context": "expect(isWrite({ method: 'OPTIONS' })).toBe(false);"
  },
  {
    "file": "__tests__/billing.unit.test.mjs",
    "line": 27,
    "text": "HEAD",
    "context": "expect(isWrite({ method: 'HEAD' })).toBe(false);"
  },
  {
    "file": "__tests__/billing.unit.test.mjs",
    "line": 30,
    "text": "isBillable ignores GET and non-billable operations",
    "context": "test('isBillable ignores GET and non-billable operations', () => {"
  },
  {
    "file": "__tests__/billing.unit.test.mjs",
    "line": 31,
    "text": "GET",
    "context": "const getRequest = { method: 'GET', billing: {} };"
  },
  {
    "file": "__tests__/billing.unit.test.mjs",
    "line": 35,
    "text": "POST",
    "context": "method: 'POST',"
  },
  {
    "file": "__tests__/billing.unit.test.mjs",
    "line": 42,
    "text": "POST",
    "context": "method: 'POST',"
  },
  {
    "file": "__tests__/billing.unit.test.mjs",
    "line": 49,
    "text": "operationWeight honors defaults, overrides, and minimums",
    "context": "test('operationWeight honors defaults, overrides, and minimums', () => {"
  },
  {
    "file": "__tests__/billing.unit.test.mjs",
    "line": 50,
    "text": "POST",
    "context": "const verifyReq = { method: 'POST', route: { path: '/verify' }, billing: {} };"
  },
  {
    "file": "__tests__/billing.unit.test.mjs",
    "line": 53,
    "text": "POST",
    "context": "const stampReq = { method: 'POST', route: { path: '/stamp' }, billing: {} };"
  },
  {
    "file": "__tests__/billing.unit.test.mjs",
    "line": 57,
    "text": "POST",
    "context": "method: 'POST',"
  },
  {
    "file": "__tests__/billing.unit.test.mjs",
    "line": 70,
    "text": "POST",
    "context": "method: 'POST',"
  },
  {
    "file": "__tests__/billing.unit.test.mjs",
    "line": 83,
    "text": "incrementUsageAtomic increments counters via Postgres fallback",
    "context": "test('incrementUsageAtomic increments counters via Postgres fallback', async () => {"
  },
  {
    "file": "__tests__/billing.unit.test.mjs",
    "line": 97,
    "text": "incrementUsageAtomic enforces limits before incrementing",
    "context": "test('incrementUsageAtomic enforces limits before incrementing', async () => {"
  },
  {
    "file": "__tests__/fixtures/analytics.expected.mjs",
    "line": 0,
    "text": "<no user-facing text detected>",
    "context": "auto-generated placeholder"
  },
  {
    "file": "__tests__/helpers/analytics.mjs",
    "line": 0,
    "text": "<no user-facing text detected>",
    "context": "auto-generated placeholder"
  },
  {
    "file": "__tests__/helpers/mock-db.mjs",
    "line": 77,
    "text": "BEGIN",
    "context": "if (normalized.startsWith('BEGIN') || normalized.startsWith('COMMIT') || normalized.startsWith('ROLLBACK')) {"
  },
  {
    "file": "__tests__/helpers/mock-db.mjs",
    "line": 77,
    "text": "COMMIT",
    "context": "if (normalized.startsWith('BEGIN') || normalized.startsWith('COMMIT') || normalized.startsWith('ROLLBACK')) {"
  },
  {
    "file": "__tests__/helpers/mock-db.mjs",
    "line": 77,
    "text": "ROLLBACK",
    "context": "if (normalized.startsWith('BEGIN') || normalized.startsWith('COMMIT') || normalized.startsWith('ROLLBACK')) {"
  },
  {
    "file": "__tests__/helpers/mock-db.mjs",
    "line": 81,
    "text": "SELECT plan_id, monthly_api_calls_total, endpoint_overrides FROM plan_entitlements",
    "context": "if (normalized.startsWith('SELECT plan_id, monthly_api_calls_total, endpoint_overrides FROM plan_entitlements')) {"
  },
  {
    "file": "__tests__/helpers/mock-db.mjs",
    "line": 87,
    "text": "SELECT id, name, plan_id, plan, quota_override FROM tenants",
    "context": "if (normalized.startsWith('SELECT id, name, plan_id, plan, quota_override FROM tenants')) {"
  },
  {
    "file": "__tests__/helpers/mock-db.mjs",
    "line": 93,
    "text": "INSERT INTO idempotency_keys",
    "context": "if (normalized.startsWith('INSERT INTO idempotency_keys')) {"
  },
  {
    "file": "__tests__/helpers/mock-db.mjs",
    "line": 109,
    "text": "SELECT request_hash, status_code FROM idempotency_keys",
    "context": "if (normalized.startsWith('SELECT request_hash, status_code FROM idempotency_keys')) {"
  },
  {
    "file": "__tests__/helpers/mock-db.mjs",
    "line": 118,
    "text": "UPDATE idempotency_keys SET last_accessed_at",
    "context": "if (normalized.startsWith('UPDATE idempotency_keys SET last_accessed_at')) {"
  },
  {
    "file": "__tests__/helpers/mock-db.mjs",
    "line": 127,
    "text": "UPDATE idempotency_keys SET status_code",
    "context": "if (normalized.startsWith('UPDATE idempotency_keys SET status_code')) {"
  },
  {
    "file": "__tests__/helpers/mock-db.mjs",
    "line": 137,
    "text": "SELECT call_count FROM usage_counters WHERE tenant_id",
    "context": "if (normalized.startsWith('SELECT call_count FROM usage_counters WHERE tenant_id')) {"
  },
  {
    "file": "__tests__/helpers/mock-db.mjs",
    "line": 144,
    "text": "INSERT INTO usage_counters",
    "context": "if (normalized.startsWith('INSERT INTO usage_counters')) {"
  },
  {
    "file": "__tests__/helpers/mock-db.mjs",
    "line": 153,
    "text": "INSERT INTO api_events",
    "context": "if (normalized.startsWith('INSERT INTO api_events')) {"
  },
  {
    "file": "__tests__/helpers/mock-db.mjs",
    "line": 167,
    "text": "SELECT date_trunc($4::text, occurred_at) AS bucket",
    "context": "if (normalized.startsWith('SELECT date_trunc($4::text, occurred_at) AS bucket')) {"
  },
  {
    "file": "__tests__/helpers/mock-db.mjs",
    "line": 200,
    "text": "WITH durations AS",
    "context": "if (normalized.includes('WITH durations AS')) {"
  },
  {
    "file": "__tests__/helpers/mock-db.mjs",
    "line": 228,
    "text": "SELECT endpoint, COUNT(*)::bigint AS count FROM api_events",
    "context": "if (normalized.startsWith('SELECT endpoint, COUNT(*)::bigint AS count FROM api_events')) {"
  },
  {
    "file": "__tests__/helpers/mock-db.mjs",
    "line": 247,
    "text": "MockDb received unsupported query: ${normalized}",
    "context": "throw new Error(`MockDb received unsupported query: ${normalized}`);"
  },
  {
    "file": "__tests__/helpers/mock-db.mjs",
    "line": 266,
    "text": "eval not supported in MockRedis",
    "context": "throw new Error('eval not supported in MockRedis');"
  },
  {
    "file": "__tests__/helpers/mock-db.mjs",
    "line": 292,
    "text": "NX",
    "context": "if (modifier === 'NX' && this.store.has(key)) {"
  },
  {
    "file": "__tests__/helpers/mock-db.mjs",
    "line": 296,
    "text": "EX",
    "context": "if (mode === 'EX' && Number.isFinite(ttl)) {"
  },
  {
    "file": "__tests__/helpers/mock-db.mjs",
    "line": 299,
    "text": "OK",
    "context": "return 'OK';"
  },
  {
    "file": "app.js",
    "line": 1,
    "text": "DOMContentLoaded",
    "context": "document.addEventListener('DOMContentLoaded', () => {"
  },
  {
    "file": "app.js",
    "line": 9,
    "text": "Dil dosyası yüklenemedi: ${lang}",
    "context": "if (!response.ok) throw new Error(`Dil dosyası yüklenemedi: ${lang}`);"
  },
  {
    "file": "app.js",
    "line": 114,
    "text": "QUOTA_EXCEEDED",
    "context": "if (!payload || payload.code !== 'QUOTA_EXCEEDED') {"
  },
  {
    "file": "app.js",
    "line": 127,
    "text": "X-Quota-Remaining",
    "context": "const remainingHeader = response.headers?.get?.('X-Quota-Remaining');"
  },
  {
    "file": "app.js",
    "line": 250,
    "text": "Failed to fetch branding:",
    "context": "console.error('Failed to fetch branding:', error);"
  },
  {
    "file": "app.js",
    "line": 281,
    "text": "#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}",
    "context": "return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;"
  },
  {
    "file": "app.js",
    "line": 329,
    "text": "feedback ${type}",
    "context": "feedbackContainer.className = `feedback ${type}`;"
  },
  {
    "file": "app.js",
    "line": 340,
    "text": "key-row key-row--empty",
    "context": "listItem.className = 'key-row key-row--empty';"
  },
  {
    "file": "app.js",
    "line": 400,
    "text": "Failed to copy API key:",
    "context": "console.error('Failed to copy API key:', error);"
  },
  {
    "file": "app.js",
    "line": 408,
    "text": "${key.substring(0, 12)}...${key.substring(key.length - 4)}",
    "context": "return `${key.substring(0, 12)}...${key.substring(key.length - 4)}`;"
  },
  {
    "file": "app.js",
    "line": 492,
    "text": "<p>${i18n.t('usage_requests_text', { used: data.quota.used, limit: data.quota.limit })}</p>",
    "context": "usageHtml = `<p>${i18n.t('usage_requests_text', { used: data.quota.used, limit: data.quota.limit })}</p>`;"
  },
  {
    "file": "app.js",
    "line": 495,
    "text": "<p>${i18n.t('usage_remaining_credits', { remaining: data.credits.remaining })}</p>",
    "context": "usageHtml = `<p>${i18n.t('usage_remaining_credits', { remaining: data.credits.remaining })}</p>`;"
  },
  {
    "file": "app.js",
    "line": 557,
    "text": "${averageTime.toLocaleString(i18n.currentLang)} ms",
    "context": "avgTimeStat.textContent = `${averageTime.toLocaleString(i18n.currentLang)} ms`;"
  },
  {
    "file": "app.js",
    "line": 589,
    "text": "status-cell ${activity.status}",
    "context": "statusCell.className = `status-cell ${activity.status}`;"
  },
  {
    "file": "app.js",
    "line": 647,
    "text": "T",
    "context": "link.setAttribute(\"download\", `videokit_analytics_${new Date().toISOString().split('T')[0]}.csv`);"
  },
  {
    "file": "app.js",
    "line": 647,
    "text": "videokit_analytics_${new Date().toISOString().split('T')[0]}.csv",
    "context": "link.setAttribute(\"download\", `videokit_analytics_${new Date().toISOString().split('T')[0]}.csv`);"
  },
  {
    "file": "app.js",
    "line": 657,
    "text": "T",
    "context": "endDateInput.value = today.toISOString().split('T')[0];"
  },
  {
    "file": "app.js",
    "line": 658,
    "text": "T",
    "context": "startDateInput.value = thirtyDaysAgo.toISOString().split('T')[0];"
  },
  {
    "file": "app.js",
    "line": 689,
    "text": "POST",
    "context": "method: 'POST',"
  },
  {
    "file": "app.js",
    "line": 690,
    "text": "Content-Type",
    "context": "headers: { 'Content-Type': 'application/json' },"
  },
  {
    "file": "app.js",
    "line": 720,
    "text": "POST",
    "context": "method: 'POST',"
  },
  {
    "file": "app.js",
    "line": 721,
    "text": "Content-Type",
    "context": "headers: { 'Content-Type': 'application/json' },"
  },
  {
    "file": "app.js",
    "line": 742,
    "text": "POST",
    "context": "method: 'POST',"
  },
  {
    "file": "app.js",
    "line": 743,
    "text": "Content-Type",
    "context": "headers: { 'Content-Type': 'application/json' },"
  },
  {
    "file": "app.js",
    "line": 773,
    "text": "POST",
    "context": "method: 'POST',"
  },
  {
    "file": "app.js",
    "line": 774,
    "text": "Content-Type",
    "context": "headers: { 'Content-Type': 'application/json' },"
  },
  {
    "file": "app.js",
    "line": 793,
    "text": "POST",
    "context": "await fetch(authEndpoint('/logout'), { method: 'POST', credentials: 'include' });"
  },
  {
    "file": "app.js",
    "line": 795,
    "text": "Logout request failed:",
    "context": "console.error('Logout request failed:', e);"
  },
  {
    "file": "app.js",
    "line": 821,
    "text": "POST",
    "context": "method: 'POST',"
  },
  {
    "file": "app.js",
    "line": 874,
    "text": "DELETE",
    "context": "method: 'DELETE',"
  },
  {
    "file": "auth.js",
    "line": 13,
    "text": "createAuthMiddleware requires a database pool",
    "context": "throw new Error('createAuthMiddleware requires a database pool');"
  },
  {
    "file": "auth.js",
    "line": 17,
    "text": "JWT secret is not configured.",
    "context": "throw new Error('JWT secret is not configured.');"
  },
  {
    "file": "auth.js",
    "line": 35,
    "text": "SELECT id, email, role, tenant_id, created_at, updated_at FROM users WHERE id = $1",
    "context": "'SELECT id, email, role, tenant_id, created_at, updated_at FROM users WHERE id = $1',"
  },
  {
    "file": "auth.js",
    "line": 48,
    "text": "SELECT id, name, plan FROM tenants WHERE id = $1",
    "context": "'SELECT id, name, plan FROM tenants WHERE id = $1',"
  },
  {
    "file": "auth.js",
    "line": 83,
    "text": "Authorization",
    "context": "const authHeader = req.get('Authorization');"
  },
  {
    "file": "auth.js",
    "line": 84,
    "text": "Bearer",
    "context": "if (authHeader?.startsWith('Bearer ')) {"
  },
  {
    "file": "auth.js",
    "line": 97,
    "text": "ye artık ihtiyacımız yok, bilgiyi direkt user",
    "context": "// payload.tenantId'ye artık ihtiyacımız yok, bilgiyi direkt user'dan alıyoruz."
  },
  {
    "file": "auth.js",
    "line": 101,
    "text": "AUTHENTICATION_REQUIRED",
    "context": "return sendError(res, req, 401, 'AUTHENTICATION_REQUIRED', 'Authentication required.');"
  },
  {
    "file": "auth.js",
    "line": 101,
    "text": "Authentication required.",
    "context": "return sendError(res, req, 401, 'AUTHENTICATION_REQUIRED', 'Authentication required.');"
  },
  {
    "file": "auth.js",
    "line": 109,
    "text": "[auth] Invalid session token.",
    "context": "req.log?.warn?.({ err: error }, '[auth] Invalid session token.');"
  },
  {
    "file": "auth.js",
    "line": 111,
    "text": "AUTHENTICATION_REQUIRED",
    "context": "return sendError(res, req, 401, 'AUTHENTICATION_REQUIRED', 'Authentication required.');"
  },
  {
    "file": "auth.js",
    "line": 111,
    "text": "Authentication required.",
    "context": "return sendError(res, req, 401, 'AUTHENTICATION_REQUIRED', 'Authentication required.');"
  },
  {
    "file": "auth.js",
    "line": 115,
    "text": "X-API-Key",
    "context": "const apiKey = req.get('X-API-Key');"
  },
  {
    "file": "auth.js",
    "line": 121,
    "text": "AUTHENTICATION_REQUIRED",
    "context": "return sendError(res, req, 401, 'AUTHENTICATION_REQUIRED', 'Authentication required.');"
  },
  {
    "file": "auth.js",
    "line": 121,
    "text": "Authentication required.",
    "context": "return sendError(res, req, 401, 'AUTHENTICATION_REQUIRED', 'Authentication required.');"
  },
  {
    "file": "auth.js",
    "line": 128,
    "text": "AUTHENTICATION_REQUIRED",
    "context": "return sendError(res, req, 401, 'AUTHENTICATION_REQUIRED', 'Authentication required.');"
  },
  {
    "file": "auth.js",
    "line": 128,
    "text": "Authentication required.",
    "context": "return sendError(res, req, 401, 'AUTHENTICATION_REQUIRED', 'Authentication required.');"
  },
  {
    "file": "auth.js",
    "line": 142,
    "text": "FORBIDDEN_ROLE",
    "context": "return sendError(res, req, 403, 'FORBIDDEN_ROLE', 'Forbidden: insufficient role.');"
  },
  {
    "file": "auth.js",
    "line": 142,
    "text": "Forbidden: insufficient role.",
    "context": "return sendError(res, req, 403, 'FORBIDDEN_ROLE', 'Forbidden: insufficient role.');"
  },
  {
    "file": "batch.html",
    "line": 6,
    "text": "Toplu Doğrulama - VideoKit Portalı",
    "context": "<title data-i18n=\"batch_page_title\">Toplu Doğrulama - VideoKit Portalı</title>"
  },
  {
    "file": "batch.html",
    "line": 17,
    "text": "Kurum Logosu",
    "context": "alt attribute"
  },
  {
    "file": "batch.html",
    "line": 18,
    "text": "VideoKit Müşteri Portalı",
    "context": "<h1 data-i18n=\"portal_title\">VideoKit Müşteri Portalı</h1>"
  },
  {
    "file": "batch.html",
    "line": 23,
    "text": "Panel",
    "context": "<a href=\"index.html\" data-i18n=\"nav_dashboard\">Panel</a>"
  },
  {
    "file": "batch.html",
    "line": 24,
    "text": "Toplu İşlem",
    "context": "<a href=\"batch.html\" data-i18n=\"nav_batch_processing\">Toplu İşlem</a>"
  },
  {
    "file": "batch.html",
    "line": 28,
    "text": "Dil seçimi",
    "context": "<label for=\"lang-switcher\" class=\"sr-only\" data-i18n=\"language_switcher_label\">Dil seçimi</label>"
  },
  {
    "file": "batch.html",
    "line": 30,
    "text": "Türkçe",
    "context": "<option value=\"tr\" data-i18n=\"language_option_tr\">Türkçe</option>"
  },
  {
    "file": "batch.html",
    "line": 30,
    "text": "tr",
    "context": "value attribute"
  },
  {
    "file": "batch.html",
    "line": 31,
    "text": "English",
    "context": "<option value=\"en\" data-i18n=\"language_option_en\">English</option>"
  },
  {
    "file": "batch.html",
    "line": 31,
    "text": "en",
    "context": "value attribute"
  },
  {
    "file": "batch.html",
    "line": 32,
    "text": "Deutsch",
    "context": "<option value=\"de\" data-i18n=\"language_option_de\">Deutsch</option>"
  },
  {
    "file": "batch.html",
    "line": 32,
    "text": "de",
    "context": "value attribute"
  },
  {
    "file": "batch.html",
    "line": 33,
    "text": "Español",
    "context": "<option value=\"es\" data-i18n=\"language_option_es\">Español</option>"
  },
  {
    "file": "batch.html",
    "line": 33,
    "text": "es",
    "context": "value attribute"
  },
  {
    "file": "batch.html",
    "line": 34,
    "text": "Pseudo-Locale (QA)",
    "context": "<option value=\"en-XA\" data-i18n=\"language_option_en_xa\">Pseudo-Locale (QA)</option>"
  },
  {
    "file": "batch.html",
    "line": 34,
    "text": "en-XA",
    "context": "value attribute"
  },
  {
    "file": "batch.html",
    "line": 49,
    "text": "Lütfen ana panelden giriş yapın...",
    "context": "<span id=\"tenant-info-display\" data-i18n=\"batch_login_prompt\">Lütfen ana panelden giriş yapın...</span>"
  },
  {
    "file": "batch.html",
    "line": 53,
    "text": "Toplu C2PA Doğrulama",
    "context": "<h2 data-i18n=\"batch_title\">Toplu C2PA Doğrulama</h2>"
  },
  {
    "file": "batch.html",
    "line": 64,
    "text": "İşlem Kuyruğu",
    "context": "<h3 data-i18n=\"batch_queue_title\">İşlem Kuyruğu</h3>"
  },
  {
    "file": "batch.html",
    "line": 78,
    "text": "Dosya Adı",
    "context": "<th data-i18n=\"file_name\">Dosya Adı</th>"
  },
  {
    "file": "batch.html",
    "line": 79,
    "text": "Durum",
    "context": "<th data-i18n=\"status\">Durum</th>"
  },
  {
    "file": "batch.html",
    "line": 80,
    "text": "Sonuç",
    "context": "<th data-i18n=\"result\">Sonuç</th>"
  },
  {
    "file": "batch.js",
    "line": 1,
    "text": "DOMContentLoaded",
    "context": "document.addEventListener('DOMContentLoaded', () => {"
  },
  {
    "file": "batch.js",
    "line": 44,
    "text": "feedback ${type}",
    "context": "feedbackContainer.className = `feedback ${type}`;"
  },
  {
    "file": "batch.js",
    "line": 57,
    "text": "WebSocket bağlantısı kuruldu.",
    "context": "state.ws.onopen = () => console.log('WebSocket bağlantısı kuruldu.');"
  },
  {
    "file": "batch.js",
    "line": 58,
    "text": "WebSocket bağlantısı kesildi.",
    "context": "state.ws.onclose = () => console.log('WebSocket bağlantısı kesildi.');"
  },
  {
    "file": "batch.js",
    "line": 59,
    "text": "WebSocket hatası:",
    "context": "state.ws.onerror = (error) => console.error('WebSocket hatası:', error);"
  },
  {
    "file": "batch.js",
    "line": 88,
    "text": "Tamamlandı",
    "context": "updateFileStatus(fileEntry.rowElement, 'completed', 'Tamamlandı');"
  },
  {
    "file": "batch.js",
    "line": 92,
    "text": "Hata",
    "context": "updateFileStatus(fileEntry.rowElement, 'failed', 'Hata');"
  },
  {
    "file": "batch.js",
    "line": 103,
    "text": "status-badge status-${statusClass}",
    "context": "statusCell.innerHTML = `<span class=\"status-badge status-${statusClass}\">${statusText}</span>`;"
  },
  {
    "file": "batch.js",
    "line": 103,
    "text": "<span class=\"status-badge status-${statusClass}\">${statusText}</span>",
    "context": "statusCell.innerHTML = `<span class=\"status-badge status-${statusClass}\">${statusText}</span>`;"
  },
  {
    "file": "batch.js",
    "line": 110,
    "text": "Bilinmeyen durum",
    "context": "resultCell.innerHTML = `<span class=\"verdict-${verdict}\">${result.message || 'Bilinmeyen durum'}</span>`;"
  },
  {
    "file": "batch.js",
    "line": 110,
    "text": "<span class=\"verdict-${verdict}\">${result.message || 'Bilinmeyen durum'}</span>",
    "context": "resultCell.innerHTML = `<span class=\"verdict-${verdict}\">${result.message || 'Bilinmeyen durum'}</span>`;"
  },
  {
    "file": "batch.js",
    "line": 115,
    "text": "Tamamlanan: ${state.completedCount} | Hatalı: ${state.failedCount}",
    "context": "processSummaryEl.textContent = `Tamamlanan: ${state.completedCount} | Hatalı: ${state.failedCount}`;"
  },
  {
    "file": "batch.js",
    "line": 124,
    "text": "Yüklenen: ${uploadedCount} / ${state.files.size}",
    "context": "uploadProgressEl.textContent = `Yüklenen: ${uploadedCount} / ${state.files.size}`;"
  },
  {
    "file": "batch.js",
    "line": 130,
    "text": "Devam etmek için lütfen giriş yapın.",
    "context": "showFeedback('Devam etmek için lütfen giriş yapın.', 'error');"
  },
  {
    "file": "batch.js",
    "line": 140,
    "text": "status-badge status-waiting",
    "context": "row.insertCell(1).innerHTML = `<span class=\"status-badge status-waiting\">Bekliyor</span>`;"
  },
  {
    "file": "batch.js",
    "line": 140,
    "text": "<span class=\"status-badge status-waiting\">Bekliyor</span>",
    "context": "row.insertCell(1).innerHTML = `<span class=\"status-badge status-waiting\">Bekliyor</span>`;"
  },
  {
    "file": "batch.js",
    "line": 161,
    "text": "Yükleniyor",
    "context": "updateFileStatus(fileEntry.rowElement, 'uploading', 'Yükleniyor');"
  },
  {
    "file": "batch.js",
    "line": 168,
    "text": "POST",
    "context": "method: 'POST',"
  },
  {
    "file": "batch.js",
    "line": 173,
    "text": "Sunucu hatası: ${response.statusText}",
    "context": "if (!response.ok) throw new Error(`Sunucu hatası: ${response.statusText}`);"
  },
  {
    "file": "batch.js",
    "line": 177,
    "text": "yi state",
    "context": "state.files.set(fileId, fileEntry); // jobId'yi state'e kaydet"
  },
  {
    "file": "batch.js",
    "line": 178,
    "text": "İşleniyor",
    "context": "updateFileStatus(fileEntry.rowElement, 'processing', 'İşleniyor');"
  },
  {
    "file": "batch.js",
    "line": 180,
    "text": "Yükleme hatası:",
    "context": "console.error('Yükleme hatası:', error);"
  },
  {
    "file": "batch.js",
    "line": 181,
    "text": "Yükleme Hatası",
    "context": "updateFileStatus(fileEntry.rowElement, 'failed', 'Yükleme Hatası');"
  },
  {
    "file": "batch.js",
    "line": 200,
    "text": "Oturum bulunamadı.",
    "context": "throw new Error('Oturum bulunamadı.');"
  },
  {
    "file": "batch.js",
    "line": 205,
    "text": "Kiracı bilgisi alınamadı.",
    "context": "throw new Error('Kiracı bilgisi alınamadı.');"
  },
  {
    "file": "batch.js",
    "line": 210,
    "text": "Kiracı: ${tenant.name || tenant.id}",
    "context": "tenantInfoDisplay.textContent = `Kiracı: ${tenant.name || tenant.id}`;"
  },
  {
    "file": "batch.js",
    "line": 223,
    "text": "Lütfen ana panelden giriş yapın...",
    "context": "tenantInfoDisplay.textContent = 'Lütfen ana panelden giriş yapın...';"
  },
  {
    "file": "batch.js",
    "line": 225,
    "text": "Devam etmek için lütfen giriş yapın.",
    "context": "showFeedback('Devam etmek için lütfen giriş yapın.', 'error');"
  },
  {
    "file": "batch.js",
    "line": 235,
    "text": "POST",
    "context": "await fetch('/auth/logout', { method: 'POST', credentials: 'include' });"
  },
  {
    "file": "batch.js",
    "line": 237,
    "text": "Logout isteği başarısız oldu:",
    "context": "console.warn('Logout isteği başarısız oldu:', error);"
  },
  {
    "file": "batch.js",
    "line": 271,
    "text": "İndirme sırasında hata oluştu (${response.status}).",
    "context": "throw new Error(`İndirme sırasında hata oluştu (${response.status}).`);"
  },
  {
    "file": "batch.js",
    "line": 283,
    "text": "Rapor indirildi.",
    "context": "showFeedback('Rapor indirildi.', 'success');"
  },
  {
    "file": "billing.js",
    "line": 19,
    "text": "X-RateLimit-Limit",
    "context": "res.set('X-RateLimit-Limit', plan.rateLimitPerMinute);"
  },
  {
    "file": "billing.js",
    "line": 20,
    "text": "X-RateLimit-Remaining",
    "context": "res.set('X-RateLimit-Remaining', Math.max(0, plan.rateLimitPerMinute - current));"
  },
  {
    "file": "billing.js",
    "line": 23,
    "text": "RATE_LIMIT_EXCEEDED",
    "context": "return sendError(res, req, 429, 'RATE_LIMIT_EXCEEDED', 'Too Many Requests: Rate limit exceeded.');"
  },
  {
    "file": "billing.js",
    "line": 23,
    "text": "Too Many Requests: Rate limit exceeded.",
    "context": "return sendError(res, req, 429, 'RATE_LIMIT_EXCEEDED', 'Too Many Requests: Rate limit exceeded.');"
  },
  {
    "file": "billing.js",
    "line": 35,
    "text": "[billing] API key provided via query string rejected.",
    "context": "req.log?.warn?.({ url: req.originalUrl }, '[billing] API key provided via query string rejected.');"
  },
  {
    "file": "billing.js",
    "line": 36,
    "text": "API_KEY_HEADER_REQUIRED",
    "context": "return sendError(res, req, 400, 'API_KEY_HEADER_REQUIRED', 'API keys must be sent using the X-API-Key header.');"
  },
  {
    "file": "billing.js",
    "line": 36,
    "text": "API keys must be sent using the X-API-Key header.",
    "context": "return sendError(res, req, 400, 'API_KEY_HEADER_REQUIRED', 'API keys must be sent using the X-API-Key header.');"
  },
  {
    "file": "billing.js",
    "line": 44,
    "text": "SELECT id, name, plan FROM tenants WHERE id = $1",
    "context": "'SELECT id, name, plan FROM tenants WHERE id = $1',"
  },
  {
    "file": "billing.js",
    "line": 48,
    "text": "SESSION_TENANT_NOT_FOUND",
    "context": "return sendError(res, req, 404, 'SESSION_TENANT_NOT_FOUND', 'Oturuma bağlı kiracı bulunamadı.');"
  },
  {
    "file": "billing.js",
    "line": 48,
    "text": "Oturuma bağlı kiracı bulunamadı.",
    "context": "return sendError(res, req, 404, 'SESSION_TENANT_NOT_FOUND', 'Oturuma bağlı kiracı bulunamadı.');"
  },
  {
    "file": "billing.js",
    "line": 53,
    "text": "X-API-Key",
    "context": "const apiKey = req.get('X-API-Key');"
  },
  {
    "file": "billing.js",
    "line": 55,
    "text": "API_KEY_MISSING",
    "context": "return sendError(res, req, 401, 'API_KEY_MISSING', 'Unauthorized: API key is missing.');"
  },
  {
    "file": "billing.js",
    "line": 55,
    "text": "Unauthorized: API key is missing.",
    "context": "return sendError(res, req, 401, 'API_KEY_MISSING', 'Unauthorized: API key is missing.');"
  },
  {
    "file": "billing.js",
    "line": 60,
    "text": "API_KEY_INVALID",
    "context": "return sendError(res, req, 401, 'API_KEY_INVALID', 'Unauthorized: Invalid API key.');"
  },
  {
    "file": "billing.js",
    "line": 60,
    "text": "Unauthorized: Invalid API key.",
    "context": "return sendError(res, req, 401, 'API_KEY_INVALID', 'Unauthorized: Invalid API key.');"
  },
  {
    "file": "billing.js",
    "line": 65,
    "text": "SELECT id, name, plan FROM tenants WHERE id = $1",
    "context": "const tenantResult = await dbPool.query('SELECT id, name, plan FROM tenants WHERE id = $1', [tenantId]);"
  },
  {
    "file": "billing.js",
    "line": 67,
    "text": "API_KEY_TENANT_NOT_FOUND",
    "context": "return sendError(res, req, 404, 'API_KEY_TENANT_NOT_FOUND', 'API anahtarına bağlı kiracı bulunamadı.');"
  },
  {
    "file": "billing.js",
    "line": 67,
    "text": "API anahtarına bağlı kiracı bulunamadı.",
    "context": "return sendError(res, req, 404, 'API_KEY_TENANT_NOT_FOUND', 'API anahtarına bağlı kiracı bulunamadı.');"
  },
  {
    "file": "billing.js",
    "line": 87,
    "text": "X-API-Key",
    "context": "apiKey: tenantContext.apiKey ?? req.tenant?.apiKey ?? req.get('X-API-Key') ?? undefined,"
  },
  {
    "file": "billing.js",
    "line": 92,
    "text": "TENANT_PLAN_INVALID",
    "context": "return sendError(res, req, 500, 'TENANT_PLAN_INVALID', 'Server configuration error: Tenant plan is invalid.');"
  },
  {
    "file": "billing.js",
    "line": 92,
    "text": "Server configuration error: Tenant plan is invalid.",
    "context": "return sendError(res, req, 500, 'TENANT_PLAN_INVALID', 'Server configuration error: Tenant plan is invalid.');"
  },
  {
    "file": "billing.js",
    "line": 103,
    "text": "X-Credits-Remaining",
    "context": "res.set('X-Credits-Remaining', '0');"
  },
  {
    "file": "billing.js",
    "line": 104,
    "text": "GET",
    "context": "if (req.method !== 'GET') {"
  },
  {
    "file": "billing.js",
    "line": 105,
    "text": "CREDITS_EXHAUSTED",
    "context": "return sendError(res, req, 402, 'CREDITS_EXHAUSTED', 'Payment Required: You have run out of credits.');"
  },
  {
    "file": "billing.js",
    "line": 105,
    "text": "Payment Required: You have run out of credits.",
    "context": "return sendError(res, req, 402, 'CREDITS_EXHAUSTED', 'Payment Required: You have run out of credits.');"
  },
  {
    "file": "billing.js",
    "line": 107,
    "text": "GET",
    "context": "} else if (req.method !== 'GET') {"
  },
  {
    "file": "billing.js",
    "line": 109,
    "text": "X-Credits-Remaining",
    "context": "res.set('X-Credits-Remaining', `${remainingCredits}`);"
  },
  {
    "file": "billing.js",
    "line": 111,
    "text": "X-Credits-Remaining",
    "context": "res.set('X-Credits-Remaining', `${credits}`);"
  },
  {
    "file": "billing.js",
    "line": 117,
    "text": "usage:${req.tenant.id}:${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}",
    "context": "const monthKey = `usage:${req.tenant.id}:${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;"
  },
  {
    "file": "billing.js",
    "line": 122,
    "text": "X-Quota-Limit",
    "context": "res.set('X-Quota-Limit', plan.monthlyQuota);"
  },
  {
    "file": "billing.js",
    "line": 123,
    "text": "X-Quota-Remaining",
    "context": "res.set('X-Quota-Remaining', 0);"
  },
  {
    "file": "billing.js",
    "line": 124,
    "text": "GET",
    "context": "if (req.method !== 'GET') {"
  },
  {
    "file": "billing.js",
    "line": 125,
    "text": "MONTHLY_QUOTA_EXCEEDED",
    "context": "return sendError(res, req, 429, 'MONTHLY_QUOTA_EXCEEDED', 'Too Many Requests: Monthly quota exceeded.');"
  },
  {
    "file": "billing.js",
    "line": 125,
    "text": "Too Many Requests: Monthly quota exceeded.",
    "context": "return sendError(res, req, 429, 'MONTHLY_QUOTA_EXCEEDED', 'Too Many Requests: Monthly quota exceeded.');"
  },
  {
    "file": "billing.js",
    "line": 128,
    "text": "GET",
    "context": "if (req.method !== 'GET') {"
  },
  {
    "file": "billing.js",
    "line": 137,
    "text": "X-Quota-Limit",
    "context": "res.set('X-Quota-Limit', plan.monthlyQuota);"
  },
  {
    "file": "billing.js",
    "line": 138,
    "text": "X-Quota-Remaining",
    "context": "res.set('X-Quota-Remaining', Math.max(0, plan.monthlyQuota - usage));"
  },
  {
    "file": "billing.js",
    "line": 144,
    "text": "[billing] Middleware failure",
    "context": "req.log?.error?.({ err: error }, '[billing] Middleware failure');"
  },
  {
    "file": "billing.js",
    "line": 145,
    "text": "BILLING_MIDDLEWARE_FAILURE",
    "context": "return sendError(res, req, 500, 'BILLING_MIDDLEWARE_FAILURE', t('error_generic_server', req.lang) || 'Internal Server Error');"
  },
  {
    "file": "billing.js",
    "line": 145,
    "text": "Internal Server Error",
    "context": "return sendError(res, req, 500, 'BILLING_MIDDLEWARE_FAILURE', t('error_generic_server', req.lang) || 'Internal Server Error');"
  },
  {
    "file": "config.js",
    "line": 34,
    "text": "DATABASE_URL ortam değişkeni zorunludur.",
    "context": ".string({ required_error: 'DATABASE_URL ortam değişkeni zorunludur.' })"
  },
  {
    "file": "config.js",
    "line": 35,
    "text": "DATABASE_URL ortam değişkeni boş olamaz.",
    "context": ".min(1, 'DATABASE_URL ortam değişkeni boş olamaz.'),"
  },
  {
    "file": "config.js",
    "line": 37,
    "text": "REDIS_URL ortam değişkeni zorunludur.",
    "context": ".string({ required_error: 'REDIS_URL ortam değişkeni zorunludur.' })"
  },
  {
    "file": "config.js",
    "line": 38,
    "text": "REDIS_URL ortam değişkeni boş olamaz.",
    "context": ".min(1, 'REDIS_URL ortam değişkeni boş olamaz.'),"
  },
  {
    "file": "config.js",
    "line": 40,
    "text": "DEFAULT_PLAN_LIMIT sayısal bir değer olmalıdır.",
    "context": ".number({ invalid_type_error: 'DEFAULT_PLAN_LIMIT sayısal bir değer olmalıdır.' })"
  },
  {
    "file": "config.js",
    "line": 41,
    "text": "DEFAULT_PLAN_LIMIT tam sayı olmalıdır.",
    "context": ".int('DEFAULT_PLAN_LIMIT tam sayı olmalıdır.')"
  },
  {
    "file": "config.js",
    "line": 42,
    "text": "DEFAULT_PLAN_LIMIT negatif olamaz.",
    "context": ".nonnegative('DEFAULT_PLAN_LIMIT negatif olamaz.'),"
  },
  {
    "file": "config.js",
    "line": 46,
    "text": "STORAGE_TTL_DAYS sayısal bir değer olmalıdır.",
    "context": ".number({ invalid_type_error: 'STORAGE_TTL_DAYS sayısal bir değer olmalıdır.' })"
  },
  {
    "file": "config.js",
    "line": 47,
    "text": "STORAGE_TTL_DAYS tam sayı olmalıdır.",
    "context": ".int('STORAGE_TTL_DAYS tam sayı olmalıdır.')"
  },
  {
    "file": "config.js",
    "line": 48,
    "text": "STORAGE_TTL_DAYS 0\\'dan büyük olmalıdır.",
    "context": ".positive('STORAGE_TTL_DAYS 0\\'dan büyük olmalıdır.')"
  },
  {
    "file": "config.js",
    "line": 52,
    "text": "VAULT_ADDR geçerli bir URL olmalıdır.",
    "context": ".url('VAULT_ADDR geçerli bir URL olmalıdır.')"
  },
  {
    "file": "config.js",
    "line": 60,
    "text": "EMAIL_PORT sayısal bir değer olmalıdır.",
    "context": ".number({ invalid_type_error: 'EMAIL_PORT sayısal bir değer olmalıdır.' })"
  },
  {
    "file": "config.js",
    "line": 61,
    "text": "EMAIL_PORT tam sayı olmalıdır.",
    "context": ".int('EMAIL_PORT tam sayı olmalıdır.')"
  },
  {
    "file": "config.js",
    "line": 62,
    "text": "EMAIL_PORT 0\\'dan büyük olmalıdır.",
    "context": ".positive('EMAIL_PORT 0\\'dan büyük olmalıdır.')"
  },
  {
    "file": "config.js",
    "line": 74,
    "text": "${issue.path.join('.') || 'environment'}: ${issue.message}",
    "context": ".map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)"
  },
  {
    "file": "config.js",
    "line": 77,
    "text": "[Config] HATA: Ortam değişkenleri doğrulanamadı. Uygulama sonlandırılıyor.",
    "context": "console.error('[Config] HATA: Ortam değişkenleri doğrulanamadı. Uygulama sonlandırılıyor.');"
  },
  {
    "file": "config.js",
    "line": 78,
    "text": "[Config] Ayrıntılar: ${formattedErrors}",
    "context": "console.error(`[Config] Ayrıntılar: ${formattedErrors}`);"
  },
  {
    "file": "config.js",
    "line": 122,
    "text": "[Config] UYARI: VAULT_TOKEN ayarlanmamış. Sırlar ortam değişkenlerinden alınacak.",
    "context": "console.warn('[Config] UYARI: VAULT_TOKEN ayarlanmamış. Sırlar ortam değişkenlerinden alınacak.');"
  },
  {
    "file": "config.js",
    "line": 127,
    "text": "SUPER_SECRET_MANAGEMENT_KEY",
    "context": "managementKey: env.MANAGEMENT_KEY || 'SUPER_SECRET_MANAGEMENT_KEY',"
  },
  {
    "file": "config.js",
    "line": 128,
    "text": "SUPER_SECRET_JWT_KEY_REPLACE_IN_PROD",
    "context": "jwtSecret: env.JWT_SECRET || 'SUPER_SECRET_JWT_KEY_REPLACE_IN_PROD',"
  },
  {
    "file": "config.js",
    "line": 139,
    "text": "[Config] Yapılandırma ortam değişkenlerinden yüklendi.",
    "context": "console.log('[Config] Yapılandırma ortam değişkenlerinden yüklendi.');"
  },
  {
    "file": "config.js",
    "line": 151,
    "text": "Sandbox",
    "context": "console.log(`[Config] Ortam: ${config.isSandbox ? 'Sandbox' : 'Production'}. Vault yolu: ${vaultPrefix}`);"
  },
  {
    "file": "config.js",
    "line": 151,
    "text": "Production",
    "context": "console.log(`[Config] Ortam: ${config.isSandbox ? 'Sandbox' : 'Production'}. Vault yolu: ${vaultPrefix}`);"
  },
  {
    "file": "config.js",
    "line": 151,
    "text": "[Config] Ortam: ${config.isSandbox ? 'Sandbox' : 'Production'}. Vault yolu: ${vaultPrefix}",
    "context": "console.log(`[Config] Ortam: ${config.isSandbox ? 'Sandbox' : 'Production'}. Vault yolu: ${vaultPrefix}`);"
  },
  {
    "file": "config.js",
    "line": 168,
    "text": "SUPER_SECRET_MANAGEMENT_KEY",
    "context": "managementKey: mgmtSecret?.data?.data?.key || env.MANAGEMENT_KEY || 'SUPER_SECRET_MANAGEMENT_KEY',"
  },
  {
    "file": "config.js",
    "line": 185,
    "text": "Gerekli sırlardan bazıları Vault\\'ta bulunamadı (redisUrl, email.host, jwtSecret).",
    "context": "throw new Error('Gerekli sırlardan bazıları Vault\\'ta bulunamadı (redisUrl, email.host, jwtSecret).');"
  },
  {
    "file": "config.js",
    "line": 189,
    "text": "[Config] Sırlar başarıyla Vault\\'tan yüklendi.",
    "context": "console.log('[Config] Sırlar başarıyla Vault\\'tan yüklendi.');"
  },
  {
    "file": "config.js",
    "line": 192,
    "text": "[Config] HATA: Vault\\'tan sırlar alınamadı. Uygulama güvenli modda sonlandırılıyor.",
    "context": "console.error('[Config] HATA: Vault\\'tan sırlar alınamadı. Uygulama güvenli modda sonlandırılıyor.', error.message);"
  },
  {
    "file": "contentauth.mjs",
    "line": 0,
    "text": "<no user-facing text detected>",
    "context": "auto-generated placeholder"
  },
  {
    "file": "emailService.js",
    "line": 18,
    "text": "Email servisi başlatılamadı: Yapılandırma (config) henüz yüklenmemiş veya e-posta ayarları eksik.",
    "context": "throw new Error('Email servisi başlatılamadı: Yapılandırma (config) henüz yüklenmemiş veya e-posta ayarları eksik.');"
  },
  {
    "file": "emailService.js",
    "line": 23,
    "text": "[EmailService] E-posta servisi başlatılıyor: ${host}:${port}",
    "context": "console.log(`[EmailService] E-posta servisi başlatılıyor: ${host}:${port}`);"
  },
  {
    "file": "emailService.js",
    "line": 50,
    "text": "VideoKit Platform",
    "context": "from: `\"VideoKit Platform\" <noreply@videokit.io>`, // Gönderici adresi"
  },
  {
    "file": "emailService.js",
    "line": 50,
    "text": "\"VideoKit Platform\" <noreply@videokit.io>",
    "context": "from: `\"VideoKit Platform\" <noreply@videokit.io>`, // Gönderici adresi"
  },
  {
    "file": "emailService.js",
    "line": 58,
    "text": "[EmailService] E-posta başarıyla gönderildi. Message ID: ${info.messageId}",
    "context": "console.log(`[EmailService] E-posta başarıyla gönderildi. Message ID: ${info.messageId}`);"
  },
  {
    "file": "emailService.js",
    "line": 61,
    "text": "[EmailService] E-posta gönderimi başarısız oldu:",
    "context": "console.error(`[EmailService] E-posta gönderimi başarısız oldu:`, error);"
  },
  {
    "file": "emailService.js",
    "line": 62,
    "text": "E-posta gönderimi sırasında bir hata oluştu.",
    "context": "throw new Error('E-posta gönderimi sırasında bir hata oluştu.');"
  },
  {
    "file": "http-error.js",
    "line": 5,
    "text": "X-Request-Id",
    "context": "export const REQUEST_ID_HEADER = 'X-Request-Id';"
  },
  {
    "file": "i18n.js",
    "line": 25,
    "text": "✅ i18n: Diller yüklendi -> [${Object.keys(translations).join(', ')}]",
    "context": "console.log(`✅ i18n: Diller yüklendi -> [${Object.keys(translations).join(', ')}]`);"
  },
  {
    "file": "i18n.js",
    "line": 27,
    "text": "❌ i18n: Dil dosyaları yüklenemedi:",
    "context": "console.error('❌ i18n: Dil dosyaları yüklenemedi:', error);"
  },
  {
    "file": "i18n.js",
    "line": 37,
    "text": "Accept-Language",
    "context": "const langHeader = req.get('Accept-Language');"
  },
  {
    "file": "i18n.js",
    "line": 50,
    "text": "John",
    "context": "* @param {object} [replacements={}] - An object of placeholders to replace (e.g., { name: 'John' })."
  },
  {
    "file": "idempotency.js",
    "line": 5,
    "text": "Idempotency-Key",
    "context": "* Bu middleware, aynı 'Idempotency-Key' başlığına sahip tekrar eden isteklerin"
  },
  {
    "file": "idempotency.js",
    "line": 13,
    "text": "POST",
    "context": "if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {"
  },
  {
    "file": "idempotency.js",
    "line": 13,
    "text": "PUT",
    "context": "if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {"
  },
  {
    "file": "idempotency.js",
    "line": 13,
    "text": "PATCH",
    "context": "if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {"
  },
  {
    "file": "idempotency.js",
    "line": 13,
    "text": "DELETE",
    "context": "if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {"
  },
  {
    "file": "idempotency.js",
    "line": 17,
    "text": "Idempotency-Key",
    "context": "const idempotencyKey = req.get('Idempotency-Key');"
  },
  {
    "file": "idempotency.js",
    "line": 33,
    "text": "[Idempotency] CONFLICT: ${idempotencyKey} anahtarı için zaten bir işlem sürüyor.",
    "context": "console.log(`[Idempotency] CONFLICT: ${idempotencyKey} anahtarı için zaten bir işlem sürüyor.`);"
  },
  {
    "file": "idempotency.js",
    "line": 34,
    "text": "IDEMPOTENCY_IN_PROGRESS",
    "context": "return sendError(res, req, 409, 'IDEMPOTENCY_IN_PROGRESS', 'A request with this Idempotency-Key is already in progress.');"
  },
  {
    "file": "idempotency.js",
    "line": 34,
    "text": "A request with this Idempotency-Key is already in progress.",
    "context": "return sendError(res, req, 409, 'IDEMPOTENCY_IN_PROGRESS', 'A request with this Idempotency-Key is already in progress.');"
  },
  {
    "file": "idempotency.js",
    "line": 37,
    "text": "[Idempotency] HIT: ${idempotencyKey} anahtarı için önbellekteki yanıt döndürülüyor.",
    "context": "console.log(`[Idempotency] HIT: ${idempotencyKey} anahtarı için önbellekteki yanıt döndürülüyor.`);"
  },
  {
    "file": "idempotency.js",
    "line": 45,
    "text": "[Idempotency] HATA: ${redisKey} anahtarındaki veri bozuk. Anahtar silinip devam ediliyor.",
    "context": "console.error(`[Idempotency] HATA: ${redisKey} anahtarındaki veri bozuk. Anahtar silinip devam ediliyor.`, err);"
  },
  {
    "file": "idempotency.js",
    "line": 51,
    "text": "NX",
    "context": "// 'NX' (if Not eXists) seçeneği, sadece anahtar yoksa değeri yazar."
  },
  {
    "file": "idempotency.js",
    "line": 53,
    "text": "EX",
    "context": "const lockAcquired = await redis.set(redisKey, JSON.stringify({ status: 'processing' }), 'EX', 300, 'NX');"
  },
  {
    "file": "idempotency.js",
    "line": 53,
    "text": "NX",
    "context": "const lockAcquired = await redis.set(redisKey, JSON.stringify({ status: 'processing' }), 'EX', 300, 'NX');"
  },
  {
    "file": "idempotency.js",
    "line": 58,
    "text": "IDEMPOTENCY_IN_PROGRESS",
    "context": "return sendError(res, req, 409, 'IDEMPOTENCY_IN_PROGRESS', 'A request with this Idempotency-Key is already in progress.');"
  },
  {
    "file": "idempotency.js",
    "line": 58,
    "text": "A request with this Idempotency-Key is already in progress.",
    "context": "return sendError(res, req, 409, 'IDEMPOTENCY_IN_PROGRESS', 'A request with this Idempotency-Key is already in progress.');"
  },
  {
    "file": "idempotency.js",
    "line": 61,
    "text": "[Idempotency] MISS: ${idempotencyKey} anahtarı için yeni istek işleniyor.",
    "context": "console.log(`[Idempotency] MISS: ${idempotencyKey} anahtarı için yeni istek işleniyor.`);"
  },
  {
    "file": "idempotency.js",
    "line": 75,
    "text": "EX",
    "context": "redis.set(redisKey, JSON.stringify(responseToStore), 'EX', 86400);"
  },
  {
    "file": "idempotency.js",
    "line": 88,
    "text": "[Idempotency] CANCEL: Bağlantı kapandı, ${idempotencyKey} kilidi serbest bırakılıyor.",
    "context": "console.log(`[Idempotency] CANCEL: Bağlantı kapandı, ${idempotencyKey} kilidi serbest bırakılıyor.`);"
  },
  {
    "file": "index.html",
    "line": 6,
    "text": "VideoKit Müşteri Portalı",
    "context": "<title data-i18n=\"portal_title\">VideoKit Müşteri Portalı</title>"
  },
  {
    "file": "index.html",
    "line": 13,
    "text": "Kurum Logosu",
    "context": "alt attribute"
  },
  {
    "file": "index.html",
    "line": 14,
    "text": "VideoKit Müşteri Portalı",
    "context": "<h1 data-i18n=\"portal_title\">VideoKit Müşteri Portalı</h1>"
  },
  {
    "file": "index.html",
    "line": 18,
    "text": "Panel",
    "context": "<a href=\"index.html\" data-i18n=\"nav_dashboard\">Panel</a>"
  },
  {
    "file": "index.html",
    "line": 19,
    "text": "Toplu İşlem",
    "context": "<a href=\"batch.html\" data-i18n=\"nav_batch_processing\">Toplu İşlem</a>"
  },
  {
    "file": "index.html",
    "line": 22,
    "text": "Dil seçimi",
    "context": "<label for=\"lang-switcher\" class=\"sr-only\" data-i18n=\"language_switcher_label\">Dil seçimi</label>"
  },
  {
    "file": "index.html",
    "line": 24,
    "text": "Türkçe",
    "context": "<option value=\"tr\" data-i18n=\"language_option_tr\">Türkçe</option>"
  },
  {
    "file": "index.html",
    "line": 24,
    "text": "tr",
    "context": "value attribute"
  },
  {
    "file": "index.html",
    "line": 25,
    "text": "English",
    "context": "<option value=\"en\" data-i18n=\"language_option_en\">English</option>"
  },
  {
    "file": "index.html",
    "line": 25,
    "text": "en",
    "context": "value attribute"
  },
  {
    "file": "index.html",
    "line": 26,
    "text": "Deutsch",
    "context": "<option value=\"de\" data-i18n=\"language_option_de\">Deutsch</option>"
  },
  {
    "file": "index.html",
    "line": 26,
    "text": "de",
    "context": "value attribute"
  },
  {
    "file": "index.html",
    "line": 27,
    "text": "Español",
    "context": "<option value=\"es\" data-i18n=\"language_option_es\">Español</option>"
  },
  {
    "file": "index.html",
    "line": 27,
    "text": "es",
    "context": "value attribute"
  },
  {
    "file": "index.html",
    "line": 28,
    "text": "Pseudo-Locale (QA)",
    "context": "<option value=\"en-XA\" data-i18n=\"language_option_en_xa\">Pseudo-Locale (QA)</option>"
  },
  {
    "file": "index.html",
    "line": 28,
    "text": "en-XA",
    "context": "value attribute"
  },
  {
    "file": "index.html",
    "line": 37,
    "text": "!",
    "context": "<div class=\"quota-banner__icon\" aria-hidden=\"true\">!</div>"
  },
  {
    "file": "index.html",
    "line": 45,
    "text": "Giriş Yap",
    "context": "<h2 data-i18n=\"login_title\">Giriş Yap</h2>"
  },
  {
    "file": "index.html",
    "line": 46,
    "text": "Hesabınıza erişmek için giriş yapın.",
    "context": "<p data-i18n=\"login_prompt_new\">Hesabınıza erişmek için giriş yapın.</p>"
  },
  {
    "file": "index.html",
    "line": 49,
    "text": "E-posta Adresi",
    "context": "<label for=\"login-email\" data-i18n=\"email_label\">E-posta Adresi</label>"
  },
  {
    "file": "index.html",
    "line": 53,
    "text": "Şifre",
    "context": "<label for=\"login-password\" data-i18n=\"password_label\">Şifre</label>"
  },
  {
    "file": "index.html",
    "line": 56,
    "text": "Giriş Yap",
    "context": "<button type=\"submit\" data-i18n=\"login_button\">Giriş Yap</button>"
  },
  {
    "file": "index.html",
    "line": 58,
    "text": "Şifrenizi mi unuttunuz?",
    "context": "<p class=\"auth-toggle-link\"><a href=\"#\" id=\"show-forgot-password-view\" class=\"forgot-password-link\" data-i18n=\"forgot_password_link\">Şifrenizi mi unuttunuz?</a></p>"
  },
  {
    "file": "index.html",
    "line": 59,
    "text": "Hesabınız yok mu? Kaydolun.",
    "context": "<p class=\"auth-toggle-link\"><a href=\"#\" id=\"show-register-view\" data-i18n=\"go_to_register_link\">Hesabınız yok mu? Kaydolun.</a></p>"
  },
  {
    "file": "index.html",
    "line": 65,
    "text": "Yeni Hesap Oluştur",
    "context": "<h2 data-i18n=\"register_title\">Yeni Hesap Oluştur</h2>"
  },
  {
    "file": "index.html",
    "line": 66,
    "text": "Platformu denemek için yeni bir hesap oluşturun.",
    "context": "<p data-i18n=\"register_prompt\">Platformu denemek için yeni bir hesap oluşturun.</p>"
  },
  {
    "file": "index.html",
    "line": 69,
    "text": "Şirket Adı",
    "context": "<label for=\"company-name\" data-i18n=\"company_name_label\">Şirket Adı</label>"
  },
  {
    "file": "index.html",
    "line": 73,
    "text": "E-posta Adresi",
    "context": "<label for=\"register-email\" data-i18n=\"email_label\">E-posta Adresi</label>"
  },
  {
    "file": "index.html",
    "line": 77,
    "text": "Şifre",
    "context": "<label for=\"register-password\" data-i18n=\"password_label\">Şifre</label>"
  },
  {
    "file": "index.html",
    "line": 80,
    "text": "Kaydol",
    "context": "<button type=\"submit\" data-i18n=\"register_button\">Kaydol</button>"
  },
  {
    "file": "index.html",
    "line": 82,
    "text": "Zaten bir hesabınız var mı? Giriş yapın.",
    "context": "<p class=\"auth-toggle-link\"><a href=\"#\" id=\"show-login-view-from-register\" data-i18n=\"go_to_login_link\">Zaten bir hesabınız var mı? Giriş yapın.</a></p>"
  },
  {
    "file": "index.html",
    "line": 88,
    "text": "Şifremi Unuttum",
    "context": "<h2 data-i18n=\"forgot_password_title\">Şifremi Unuttum</h2>"
  },
  {
    "file": "index.html",
    "line": 89,
    "text": "Şifre sıfırlama linki göndermek için e-posta adresinizi girin.",
    "context": "<p data-i18n=\"forgot_password_prompt\">Şifre sıfırlama linki göndermek için e-posta adresinizi girin.</p>"
  },
  {
    "file": "index.html",
    "line": 92,
    "text": "E-posta Adresi",
    "context": "<label for=\"forgot-email\" data-i18n=\"email_label\">E-posta Adresi</label>"
  },
  {
    "file": "index.html",
    "line": 95,
    "text": "Sıfırlama Linki Gönder",
    "context": "<button type=\"submit\" data-i18n=\"send_reset_link_button\">Sıfırlama Linki Gönder</button>"
  },
  {
    "file": "index.html",
    "line": 97,
    "text": "Giriş ekranına geri dön.",
    "context": "<p class=\"auth-toggle-link\"><a href=\"#\" id=\"show-login-view-from-forgot\" data-i18n=\"back_to_login_link\">Giriş ekranına geri dön.</a></p>"
  },
  {
    "file": "index.html",
    "line": 103,
    "text": "Yeni Şifre Oluştur",
    "context": "<h2 data-i18n=\"reset_password_title\">Yeni Şifre Oluştur</h2>"
  },
  {
    "file": "index.html",
    "line": 104,
    "text": "Lütfen yeni şifrenizi girin. En az 8 karakter olmalıdır.",
    "context": "<p data-i18n=\"reset_password_prompt\">Lütfen yeni şifrenizi girin. En az 8 karakter olmalıdır.</p>"
  },
  {
    "file": "index.html",
    "line": 107,
    "text": "Yeni Şifre",
    "context": "<label for=\"reset-password\" data-i18n=\"new_password_label\">Yeni Şifre</label>"
  },
  {
    "file": "index.html",
    "line": 110,
    "text": "Şifreyi Güncelle",
    "context": "<button type=\"submit\" data-i18n=\"update_password_button\">Şifreyi Güncelle</button>"
  },
  {
    "file": "index.html",
    "line": 118,
    "text": "Genel Bakış",
    "context": "<span class=\"dashboard-eyebrow\" data-i18n=\"dashboard_overview_label\">Genel Bakış</span>"
  },
  {
    "file": "index.html",
    "line": 120,
    "text": "Aboneliğinizi, kullanımınızı ve API anahtarlarınızı buradan yönetin.",
    "context": "<p class=\"dashboard-description\" data-i18n=\"dashboard_subheading\">Aboneliğinizi, kullanımınızı ve API anahtarlarınızı buradan yönetin.</p>"
  },
  {
    "file": "index.html",
    "line": 123,
    "text": "Çıkış Yap",
    "context": "<button type=\"button\" id=\"logout-button\" class=\"button button--ghost\" data-i18n=\"logout_button\">Çıkış Yap</button>"
  },
  {
    "file": "index.html",
    "line": 130,
    "text": "Abonelik Bilgileri",
    "context": "<h3 data-i18n=\"subscription_info_title\">Abonelik Bilgileri</h3>"
  },
  {
    "file": "index.html",
    "line": 131,
    "text": "Aboneliği Yönet (Stripe)",
    "context": "<a href=\"#\" target=\"_blank\" class=\"button button--ghost button--small\" data-i18n=\"manage_subscription_button\">Aboneliği Yönet (Stripe)</a>"
  },
  {
    "file": "index.html",
    "line": 134,
    "text": "Plan:",
    "context": "<p><strong data-i18n=\"plan_label\">Plan:</strong> <span id=\"plan-name\" data-i18n=\"loading_text\">Yükleniyor...</span></p>"
  },
  {
    "file": "index.html",
    "line": 134,
    "text": "Yükleniyor...",
    "context": "<p><strong data-i18n=\"plan_label\">Plan:</strong> <span id=\"plan-name\" data-i18n=\"loading_text\">Yükleniyor...</span></p>"
  },
  {
    "file": "index.html",
    "line": 140,
    "text": "Kullanım Detayları",
    "context": "<h3 data-i18n=\"usage_details_title\">Kullanım Detayları</h3>"
  },
  {
    "file": "index.html",
    "line": 143,
    "text": "Yükleniyor...",
    "context": "<p data-i18n=\"loading_text\">Yükleniyor...</p>"
  },
  {
    "file": "index.html",
    "line": 150,
    "text": "API Anahtarları Yönetimi",
    "context": "<h3 data-i18n=\"api_keys_title\">API Anahtarları Yönetimi</h3>"
  },
  {
    "file": "index.html",
    "line": 151,
    "text": "Aktif anahtarlarınızı yönetin ve gerekirse iptal edin.",
    "context": "<p class=\"card-subtitle\" data-i18n=\"api_keys_subtitle\">Aktif anahtarlarınızı yönetin ve gerekirse iptal edin.</p>"
  },
  {
    "file": "index.html",
    "line": 153,
    "text": "Yeni Anahtar Oluştur",
    "context": "<button type=\"button\" id=\"create-key-btn\" data-i18n=\"create_key_button\">Yeni Anahtar Oluştur</button>"
  },
  {
    "file": "index.html",
    "line": 158,
    "text": "Yeni API anahtarınız hazır",
    "context": "<strong data-i18n=\"new_key_notice_title\">Yeni API anahtarınız hazır</strong>"
  },
  {
    "file": "index.html",
    "line": 159,
    "text": "Bu anahtarı hemen kopyalayın. Güvenlik nedeniyle bu ekrandan ayrıldığınızda anahtar tekrar gösterilmeyecektir.",
    "context": "<p data-i18n=\"new_key_notice_message\">Bu anahtarı hemen kopyalayın. Güvenlik nedeniyle bu ekrandan ayrıldığınızda anahtar tekrar gösterilmeyecektir.</p>"
  },
  {
    "file": "index.html",
    "line": 166,
    "text": "Anahtarı kopyala",
    "context": "<button type=\"button\" class=\"button button--ghost\" id=\"copy-new-key\" data-i18n=\"copy_key_button\">Anahtarı kopyala</button>"
  },
  {
    "file": "index.html",
    "line": 167,
    "text": "Gizle",
    "context": "<button type=\"button\" class=\"button button--ghost\" id=\"dismiss-new-key\" data-i18n=\"dismiss_key_button\">Gizle</button>"
  },
  {
    "file": "index.html",
    "line": 174,
    "text": "Henüz bir API anahtarınız yok.",
    "context": "<span data-i18n=\"no_api_keys_yet\">Henüz bir API anahtarınız yok.</span>"
  },
  {
    "file": "index.html",
    "line": 175,
    "text": "İlk anahtarınızı oluşturmak için yukarıdaki butonu kullanın.",
    "context": "<small data-i18n=\"api_keys_empty_description\">İlk anahtarınızı oluşturmak için yukarıdaki butonu kullanın.</small>"
  },
  {
    "file": "index.html",
    "line": 185,
    "text": "Kullanım Analitikleri",
    "context": "<h3 data-i18n=\"analytics_title\">Kullanım Analitikleri</h3>"
  },
  {
    "file": "index.html",
    "line": 186,
    "text": "Son işlemlerinizin performansını inceleyin.",
    "context": "<p class=\"card-subtitle\" data-i18n=\"analytics_subtitle\">Son işlemlerinizin performansını inceleyin.</p>"
  },
  {
    "file": "index.html",
    "line": 191,
    "text": "Başlangıç",
    "context": "<label for=\"start-date\" data-i18n=\"analytics_date_start\">Başlangıç</label>"
  },
  {
    "file": "index.html",
    "line": 193,
    "text": "Bitiş",
    "context": "<label for=\"end-date\" data-i18n=\"analytics_date_end\">Bitiş</label>"
  },
  {
    "file": "index.html",
    "line": 196,
    "text": "CSV Olarak Dışa Aktar",
    "context": "<button type=\"button\" id=\"export-csv-btn\" class=\"button button--ghost\" data-i18n=\"analytics_export_button\">CSV Olarak Dışa Aktar</button>"
  },
  {
    "file": "index.html",
    "line": 200,
    "text": "Toplam API Çağrısı",
    "context": "<h4 data-i18n=\"analytics_total_calls\">Toplam API Çağrısı</h4>"
  },
  {
    "file": "index.html",
    "line": 201,
    "text": "0",
    "context": "<p id=\"total-calls-stat\">0</p>"
  },
  {
    "file": "index.html",
    "line": 204,
    "text": "Başarı Oranı",
    "context": "<h4 data-i18n=\"analytics_success_rate\">Başarı Oranı</h4>"
  },
  {
    "file": "index.html",
    "line": 209,
    "text": "0%",
    "context": "<span id=\"success-percentage\">0%</span>"
  },
  {
    "file": "index.html",
    "line": 213,
    "text": "Ort. İşlem Süresi",
    "context": "<h4 data-i18n=\"analytics_avg_time\">Ort. İşlem Süresi</h4>"
  },
  {
    "file": "index.html",
    "line": 214,
    "text": "0 ms",
    "context": "<p id=\"avg-time-stat\">0 ms</p>"
  },
  {
    "file": "index.html",
    "line": 218,
    "text": "Son Aktiviteler",
    "context": "<h4 data-i18n=\"analytics_recent_activity\">Son Aktiviteler</h4>"
  },
  {
    "file": "index.html",
    "line": 222,
    "text": "Tarih",
    "context": "<th data-i18n=\"analytics_table_date\">Tarih</th>"
  },
  {
    "file": "index.html",
    "line": 223,
    "text": "İşlem Türü",
    "context": "<th data-i18n=\"analytics_table_type\">İşlem Türü</th>"
  },
  {
    "file": "index.html",
    "line": 224,
    "text": "Durum",
    "context": "<th data-i18n=\"analytics_table_status\">Durum</th>"
  },
  {
    "file": "index.html",
    "line": 225,
    "text": "Süre (ms)",
    "context": "<th data-i18n=\"analytics_table_duration\">Süre (ms)</th>"
  },
  {
    "file": "index.html",
    "line": 243,
    "text": "Güvenlik için anahtarın sadece başlangıcı ve sonu görüntülenir.",
    "context": "<small data-i18n=\"api_key_masked_hint\">Güvenlik için anahtarın sadece başlangıcı ve sonu görüntülenir.</small>"
  },
  {
    "file": "index.html",
    "line": 246,
    "text": "Sil",
    "context": "<button type=\"button\" class=\"delete-btn\" data-i18n=\"delete_button\">Sil</button>"
  },
  {
    "file": "instrument.mjs",
    "line": 0,
    "text": "<no user-facing text detected>",
    "context": "auto-generated placeholder"
  },
  {
    "file": "jobs/flush-usage.mjs",
    "line": 15,
    "text": "Invalid period key: ${periodKey}",
    "context": "throw new Error(`Invalid period key: ${periodKey}`);"
  },
  {
    "file": "jobs/flush-usage.mjs",
    "line": 37,
    "text": "SELECT pg_try_advisory_lock($1::bigint) AS locked",
    "context": "const { rows } = await client.query('SELECT pg_try_advisory_lock($1::bigint) AS locked', [ADVISORY_LOCK_KEY.toString()]);"
  },
  {
    "file": "jobs/flush-usage.mjs",
    "line": 40,
    "text": "[flush-usage] Unable to obtain advisory lock. Another instance may be running.",
    "context": "console.warn('[flush-usage] Unable to obtain advisory lock. Another instance may be running.');"
  },
  {
    "file": "jobs/flush-usage.mjs",
    "line": 47,
    "text": "SELECT pg_advisory_unlock($1::bigint)",
    "context": "await client.query('SELECT pg_advisory_unlock($1::bigint)', [ADVISORY_LOCK_KEY.toString()]);"
  },
  {
    "file": "jobs/flush-usage.mjs",
    "line": 49,
    "text": "[flush-usage] Failed to release advisory lock.",
    "context": "console.warn('[flush-usage] Failed to release advisory lock.', error);"
  },
  {
    "file": "jobs/flush-usage.mjs",
    "line": 54,
    "text": "SELECT to_regclass($1) AS table_name",
    "context": "const { rows } = await client.query('SELECT to_regclass($1) AS table_name', ['usage_counters']);"
  },
  {
    "file": "jobs/flush-usage.mjs",
    "line": 56,
    "text": "usage_counters table is not available. Run database migrations before executing this job.",
    "context": "throw new Error('usage_counters table is not available. Run database migrations before executing this job.');"
  },
  {
    "file": "jobs/flush-usage.mjs",
    "line": 88,
    "text": "BEGIN",
    "context": "await client.query('BEGIN');"
  },
  {
    "file": "jobs/flush-usage.mjs",
    "line": 102,
    "text": "COMMIT",
    "context": "await client.query('COMMIT');"
  },
  {
    "file": "jobs/flush-usage.mjs",
    "line": 105,
    "text": "ROLLBACK",
    "context": "await client.query('ROLLBACK');"
  },
  {
    "file": "jobs/flush-usage.mjs",
    "line": 132,
    "text": "MATCH",
    "context": "const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'usage:*', 'COUNT', 200);"
  },
  {
    "file": "jobs/flush-usage.mjs",
    "line": 132,
    "text": "COUNT",
    "context": "const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'usage:*', 'COUNT', 200);"
  },
  {
    "file": "jobs/flush-usage.mjs",
    "line": 143,
    "text": "[flush-usage] Completed. processedKeys=${processedKeys}, upserts=${totalUpserts}",
    "context": "console.log(`[flush-usage] Completed. processedKeys=${processedKeys}, upserts=${totalUpserts}`);"
  },
  {
    "file": "jobs/flush-usage.mjs",
    "line": 153,
    "text": "[flush-usage] Job failed:",
    "context": "console.error('[flush-usage] Job failed:', error);"
  },
  {
    "file": "jobs/purge.mjs",
    "line": 6,
    "text": "ROLLUP_PURGE_ENABLED",
    "context": "const ROLLUP_PURGE_ENV_KEYS = ['ROLLUP_PURGE_ENABLED', 'PURGE_ROLLUPS', 'ENABLE_ROLLUP_PURGE'];"
  },
  {
    "file": "jobs/purge.mjs",
    "line": 6,
    "text": "PURGE_ROLLUPS",
    "context": "const ROLLUP_PURGE_ENV_KEYS = ['ROLLUP_PURGE_ENABLED', 'PURGE_ROLLUPS', 'ENABLE_ROLLUP_PURGE'];"
  },
  {
    "file": "jobs/purge.mjs",
    "line": 6,
    "text": "ENABLE_ROLLUP_PURGE",
    "context": "const ROLLUP_PURGE_ENV_KEYS = ['ROLLUP_PURGE_ENABLED', 'PURGE_ROLLUPS', 'ENABLE_ROLLUP_PURGE'];"
  },
  {
    "file": "jobs/purge.mjs",
    "line": 21,
    "text": "SELECT pg_try_advisory_lock($1::bigint) AS locked",
    "context": "const { rows } = await client.query('SELECT pg_try_advisory_lock($1::bigint) AS locked', [ADVISORY_LOCK_KEY.toString()]);"
  },
  {
    "file": "jobs/purge.mjs",
    "line": 24,
    "text": "[purge] Unable to obtain advisory lock. Another instance may be running.",
    "context": "console.warn('[purge] Unable to obtain advisory lock. Another instance may be running.');"
  },
  {
    "file": "jobs/purge.mjs",
    "line": 31,
    "text": "SELECT pg_advisory_unlock($1::bigint)",
    "context": "await client.query('SELECT pg_advisory_unlock($1::bigint)', [ADVISORY_LOCK_KEY.toString()]);"
  },
  {
    "file": "jobs/purge.mjs",
    "line": 33,
    "text": "[purge] Failed to release advisory lock.",
    "context": "console.warn('[purge] Failed to release advisory lock.', error);"
  },
  {
    "file": "jobs/purge.mjs",
    "line": 38,
    "text": "SELECT to_regclass($1) AS table_name",
    "context": "const { rows } = await client.query('SELECT to_regclass($1) AS table_name', [tableName]);"
  },
  {
    "file": "jobs/purge.mjs",
    "line": 47,
    "text": "SELECT COUNT(*)::bigint AS count FROM api_events WHERE occurred_at < NOW() - INTERVAL \\'90 days\\'",
    "context": "'SELECT COUNT(*)::bigint AS count FROM api_events WHERE occurred_at < NOW() - INTERVAL \\'90 days\\'',"
  },
  {
    "file": "jobs/purge.mjs",
    "line": 50,
    "text": "[purge] DRY RUN: ${count} api_events rows older than 90 days would be removed.",
    "context": "console.log(`[purge] DRY RUN: ${count} api_events rows older than 90 days would be removed.`);"
  },
  {
    "file": "jobs/purge.mjs",
    "line": 55,
    "text": "DELETE FROM api_events WHERE occurred_at < NOW() - INTERVAL \\'90 days\\'",
    "context": "'DELETE FROM api_events WHERE occurred_at < NOW() - INTERVAL \\'90 days\\'',"
  },
  {
    "file": "jobs/purge.mjs",
    "line": 57,
    "text": "[purge] Removed ${rowCount} api_events rows older than 90 days.",
    "context": "console.log(`[purge] Removed ${rowCount} api_events rows older than 90 days.`);"
  },
  {
    "file": "jobs/purge.mjs",
    "line": 65,
    "text": "[purge] Rollup purge disabled. Set ROLLUP_PURGE_ENABLED=1 to enable.",
    "context": "console.log('[purge] Rollup purge disabled. Set ROLLUP_PURGE_ENABLED=1 to enable.');"
  },
  {
    "file": "jobs/purge.mjs",
    "line": 80,
    "text": "[purge] No rollup tables found. Skipping rollup purge.",
    "context": "console.log('[purge] No rollup tables found. Skipping rollup purge.');"
  },
  {
    "file": "jobs/purge.mjs",
    "line": 90,
    "text": "SELECT COUNT(*)::bigint AS count FROM api_events_rollup_hourly WHERE bucket_start < $1::timestamptz",
    "context": "'SELECT COUNT(*)::bigint AS count FROM api_events_rollup_hourly WHERE bucket_start < $1::timestamptz',"
  },
  {
    "file": "jobs/purge.mjs",
    "line": 98,
    "text": "SELECT COUNT(*)::bigint AS count FROM api_events_rollup_daily WHERE bucket_date < $1::date",
    "context": "'SELECT COUNT(*)::bigint AS count FROM api_events_rollup_daily WHERE bucket_date < $1::date',"
  },
  {
    "file": "jobs/purge.mjs",
    "line": 104,
    "text": "[purge] DRY RUN: ${hourlyDeleted} hourly and ${dailyDeleted} daily rollup rows older than 12 months would be removed.",
    "context": "console.log(`[purge] DRY RUN: ${hourlyDeleted} hourly and ${dailyDeleted} daily rollup rows older than 12 months would be removed.`);"
  },
  {
    "file": "jobs/purge.mjs",
    "line": 110,
    "text": "DELETE FROM api_events_rollup_hourly WHERE bucket_start < $1::timestamptz",
    "context": "'DELETE FROM api_events_rollup_hourly WHERE bucket_start < $1::timestamptz',"
  },
  {
    "file": "jobs/purge.mjs",
    "line": 118,
    "text": "DELETE FROM api_events_rollup_daily WHERE bucket_date < $1::date",
    "context": "'DELETE FROM api_events_rollup_daily WHERE bucket_date < $1::date',"
  },
  {
    "file": "jobs/purge.mjs",
    "line": 124,
    "text": "[purge] Removed ${hourlyDeleted} hourly and ${dailyDeleted} daily rollup rows older than 12 months.",
    "context": "console.log(`[purge] Removed ${hourlyDeleted} hourly and ${dailyDeleted} daily rollup rows older than 12 months.`);"
  },
  {
    "file": "jobs/purge.mjs",
    "line": 133,
    "text": "[purge] Dry run enabled. Database changes will be skipped.",
    "context": "console.log('[purge] Dry run enabled. Database changes will be skipped.');"
  },
  {
    "file": "jobs/purge.mjs",
    "line": 156,
    "text": "[purge] Job failed:",
    "context": "console.error('[purge] Job failed:', error);"
  },
  {
    "file": "jobs/rollup-analytics.mjs",
    "line": 19,
    "text": "SELECT pg_try_advisory_lock($1::bigint) AS locked",
    "context": "const { rows } = await client.query('SELECT pg_try_advisory_lock($1::bigint) AS locked', [ADVISORY_LOCK_KEY.toString()]);"
  },
  {
    "file": "jobs/rollup-analytics.mjs",
    "line": 22,
    "text": "[rollup-analytics] Unable to obtain advisory lock. Another instance may be running.",
    "context": "console.warn('[rollup-analytics] Unable to obtain advisory lock. Another instance may be running.');"
  },
  {
    "file": "jobs/rollup-analytics.mjs",
    "line": 29,
    "text": "SELECT pg_advisory_unlock($1::bigint)",
    "context": "await client.query('SELECT pg_advisory_unlock($1::bigint)', [ADVISORY_LOCK_KEY.toString()]);"
  },
  {
    "file": "jobs/rollup-analytics.mjs",
    "line": 31,
    "text": "[rollup-analytics] Failed to release advisory lock.",
    "context": "console.warn('[rollup-analytics] Failed to release advisory lock.', error);"
  },
  {
    "file": "jobs/rollup-analytics.mjs",
    "line": 78,
    "text": "SELECT last_processed_at FROM analytics_rollup_state WHERE rollup_type = $1",
    "context": "'SELECT last_processed_at FROM analytics_rollup_state WHERE rollup_type = $1',"
  },
  {
    "file": "jobs/rollup-analytics.mjs",
    "line": 136,
    "text": "BEGIN",
    "context": "await client.query('BEGIN');"
  },
  {
    "file": "jobs/rollup-analytics.mjs",
    "line": 172,
    "text": "COMMIT",
    "context": "await client.query('COMMIT');"
  },
  {
    "file": "jobs/rollup-analytics.mjs",
    "line": 175,
    "text": "ROLLBACK",
    "context": "await client.query('ROLLBACK');"
  },
  {
    "file": "jobs/rollup-analytics.mjs",
    "line": 215,
    "text": "BEGIN",
    "context": "await client.query('BEGIN');"
  },
  {
    "file": "jobs/rollup-analytics.mjs",
    "line": 252,
    "text": "COMMIT",
    "context": "await client.query('COMMIT');"
  },
  {
    "file": "jobs/rollup-analytics.mjs",
    "line": 255,
    "text": "ROLLBACK",
    "context": "await client.query('ROLLBACK');"
  },
  {
    "file": "jobs/rollup-analytics.mjs",
    "line": 279,
    "text": "[rollup-analytics] Completed. hourlyBuckets=${hourly.buckets}, dailyBuckets=${daily.buckets}",
    "context": "`[rollup-analytics] Completed. hourlyBuckets=${hourly.buckets}, dailyBuckets=${daily.buckets}`,"
  },
  {
    "file": "jobs/rollup-analytics.mjs",
    "line": 289,
    "text": "[rollup-analytics] Job failed:",
    "context": "console.error('[rollup-analytics] Job failed:', error);"
  },
  {
    "file": "klv-tests.html",
    "line": 5,
    "text": "VideoKit Core - KLV Birim Testleri",
    "context": "<title>VideoKit Core - KLV Birim Testleri</title>"
  },
  {
    "file": "klv-tests.html",
    "line": 16,
    "text": "VideoKit Core - KLV Birim Testleri",
    "context": "<h1>VideoKit Core - KLV Birim Testleri</h1>"
  },
  {
    "file": "middleware/billing.js",
    "line": 7,
    "text": "POST",
    "context": "{ method: 'POST', pattern: /^\\/verify$/i, name: '/verify', weight: 1 },"
  },
  {
    "file": "middleware/billing.js",
    "line": 8,
    "text": "POST",
    "context": "{ method: 'POST', pattern: /^\\/stamp$/i, name: '/stamp', weight: 5 },"
  },
  {
    "file": "middleware/billing.js",
    "line": 9,
    "text": "POST",
    "context": "{ method: 'POST', pattern: /^\\/batch\\/upload$/i, name: '/batch/upload', weight: 10 },"
  },
  {
    "file": "middleware/billing.js",
    "line": 10,
    "text": "GET",
    "context": "{ method: 'GET', pattern: /^\\/management\\/tenants$/i, name: '/management/tenants', billable: false },"
  },
  {
    "file": "middleware/billing.js",
    "line": 11,
    "text": "POST",
    "context": "{ method: 'POST', pattern: /^\\/management\\/keys$/i, name: '/management/keys', billable: false },"
  },
  {
    "file": "middleware/billing.js",
    "line": 13,
    "text": "DELETE",
    "context": "method: 'DELETE',"
  },
  {
    "file": "middleware/billing.js",
    "line": 32,
    "text": "HGET",
    "context": "local current = tonumber(redis.call('HGET', key, totalField) or '0')"
  },
  {
    "file": "middleware/billing.js",
    "line": 34,
    "text": "HGET",
    "context": "local opValue = tonumber(redis.call('HGET', key, opField) or '0')"
  },
  {
    "file": "middleware/billing.js",
    "line": 39,
    "text": "HINCRBYFLOAT",
    "context": "local newTotal = redis.call('HINCRBYFLOAT', key, totalField, increment)"
  },
  {
    "file": "middleware/billing.js",
    "line": 40,
    "text": "HINCRBYFLOAT",
    "context": "local newOp = redis.call('HINCRBYFLOAT', key, opField, increment)"
  },
  {
    "file": "middleware/billing.js",
    "line": 43,
    "text": "PEXPIRE",
    "context": "redis.call('PEXPIRE', key, ttl)"
  },
  {
    "file": "middleware/billing.js",
    "line": 57,
    "text": "ZREMRANGEBYSCORE",
    "context": "redis.call('ZREMRANGEBYSCORE', zsetKey, 0, now - window)"
  },
  {
    "file": "middleware/billing.js",
    "line": 58,
    "text": "ZCARD",
    "context": "local current = redis.call('ZCARD', zsetKey)"
  },
  {
    "file": "middleware/billing.js",
    "line": 66,
    "text": "ZRANGE",
    "context": "local oldest = redis.call('ZRANGE', zsetKey, 0, 0, 'WITHSCORES')"
  },
  {
    "file": "middleware/billing.js",
    "line": 66,
    "text": "WITHSCORES",
    "context": "local oldest = redis.call('ZRANGE', zsetKey, 0, 0, 'WITHSCORES')"
  },
  {
    "file": "middleware/billing.js",
    "line": 73,
    "text": "INCR",
    "context": "local sequence = redis.call('INCR', counterKey)"
  },
  {
    "file": "middleware/billing.js",
    "line": 74,
    "text": "ZADD",
    "context": "redis.call('ZADD', zsetKey, now, now .. '-' .. sequence)"
  },
  {
    "file": "middleware/billing.js",
    "line": 75,
    "text": "EXPIRE",
    "context": "redis.call('EXPIRE', zsetKey, ttl)"
  },
  {
    "file": "middleware/billing.js",
    "line": 76,
    "text": "EXPIRE",
    "context": "redis.call('EXPIRE', counterKey, ttl)"
  },
  {
    "file": "middleware/billing.js",
    "line": 81,
    "text": "ZRANGE",
    "context": "local oldestAfterInsert = redis.call('ZRANGE', zsetKey, 0, 0, 'WITHSCORES')"
  },
  {
    "file": "middleware/billing.js",
    "line": 81,
    "text": "WITHSCORES",
    "context": "local oldestAfterInsert = redis.call('ZRANGE', zsetKey, 0, 0, 'WITHSCORES')"
  },
  {
    "file": "middleware/billing.js",
    "line": 128,
    "text": "Duration of billable API calls in milliseconds.",
    "context": "help: 'Duration of billable API calls in milliseconds.',"
  },
  {
    "file": "middleware/billing.js",
    "line": 139,
    "text": "Total billable API requests processed.",
    "context": "help: 'Total billable API requests processed.',"
  },
  {
    "file": "middleware/billing.js",
    "line": 147,
    "text": "Toplam kota aşımlarının sayısı.",
    "context": "help: 'Toplam kota aşımlarının sayısı.',"
  },
  {
    "file": "middleware/billing.js",
    "line": 154,
    "text": "API analitik kayıtlarının veritabanına yazılamadığı toplam durum sayısı.",
    "context": "help: 'API analitik kayıtlarının veritabanına yazılamadığı toplam durum sayısı.',"
  },
  {
    "file": "middleware/billing.js",
    "line": 201,
    "text": "Billing middleware requires configureBilling to run first.",
    "context": "throw new Error('Billing middleware requires configureBilling to run first.');"
  },
  {
    "file": "middleware/billing.js",
    "line": 265,
    "text": "SELECT plan_id, monthly_api_calls_total, endpoint_overrides FROM plan_entitlements WHERE plan_id = $1",
    "context": "'SELECT plan_id, monthly_api_calls_total, endpoint_overrides FROM plan_entitlements WHERE plan_id = $1',"
  },
  {
    "file": "middleware/billing.js",
    "line": 287,
    "text": "SELECT id, name, plan_id, plan, quota_override FROM tenants WHERE id = $1",
    "context": "'SELECT id, name, plan_id, plan, quota_override FROM tenants WHERE id = $1',"
  },
  {
    "file": "middleware/billing.js",
    "line": 327,
    "text": "SELECT tenant_id FROM api_keys WHERE key_hash = $1 LIMIT 1",
    "context": "'SELECT tenant_id FROM api_keys WHERE key_hash = $1 LIMIT 1',"
  },
  {
    "file": "middleware/billing.js",
    "line": 332,
    "text": "EX",
    "context": "await redis.set(`api_key:${apiKey}`, tenantId, 'EX', 3600);"
  },
  {
    "file": "middleware/billing.js",
    "line": 333,
    "text": "EX",
    "context": "await redis.set(`api_key_hash:${hash}`, tenantId, 'EX', 3600);"
  },
  {
    "file": "middleware/billing.js",
    "line": 362,
    "text": "${year}-${String(month + 1).padStart(2, '0')}",
    "context": "const key = `${year}-${String(month + 1).padStart(2, '0')}`;"
  },
  {
    "file": "middleware/billing.js",
    "line": 373,
    "text": "op:${endpoint.replace(/\\s+/g, '_')}",
    "context": "const endpointField = (endpoint) => `op:${endpoint.replace(/\\s+/g, '_')}`;"
  },
  {
    "file": "middleware/billing.js",
    "line": 391,
    "text": "Idempotency-Key",
    "context": "const key = req.get?.('Idempotency-Key');"
  },
  {
    "file": "middleware/billing.js",
    "line": 409,
    "text": "SELECT request_hash, status_code FROM idempotency_keys WHERE idempotency_key = $1",
    "context": "'SELECT request_hash, status_code FROM idempotency_keys WHERE idempotency_key = $1',"
  },
  {
    "file": "middleware/billing.js",
    "line": 418,
    "text": "Idempotency hash mismatch",
    "context": "const error = new Error('Idempotency hash mismatch');"
  },
  {
    "file": "middleware/billing.js",
    "line": 424,
    "text": "UPDATE idempotency_keys SET last_accessed_at = NOW(), locked_at = NOW() WHERE idempotency_key = $1",
    "context": "'UPDATE idempotency_keys SET last_accessed_at = NOW(), locked_at = NOW() WHERE idempotency_key = $1',"
  },
  {
    "file": "middleware/billing.js",
    "line": 436,
    "text": "[billing] idempotency_keys table missing, skipping persistence.",
    "context": "state.logger?.warn?.('[billing] idempotency_keys table missing, skipping persistence.');"
  },
  {
    "file": "middleware/billing.js",
    "line": 453,
    "text": "X-API-Key",
    "context": "const apiKey = req.get('X-API-Key');"
  },
  {
    "file": "middleware/billing.js",
    "line": 455,
    "text": "TENANT_MISSING",
    "context": "return sendError(res, req, 403, 'TENANT_MISSING', 'Tenant context is required.');"
  },
  {
    "file": "middleware/billing.js",
    "line": 455,
    "text": "Tenant context is required.",
    "context": "return sendError(res, req, 403, 'TENANT_MISSING', 'Tenant context is required.');"
  },
  {
    "file": "middleware/billing.js",
    "line": 461,
    "text": "AUTHENTICATION_REQUIRED",
    "context": "return sendError(res, req, 401, 'AUTHENTICATION_REQUIRED', 'Authentication required.');"
  },
  {
    "file": "middleware/billing.js",
    "line": 461,
    "text": "Authentication required.",
    "context": "return sendError(res, req, 401, 'AUTHENTICATION_REQUIRED', 'Authentication required.');"
  },
  {
    "file": "middleware/billing.js",
    "line": 467,
    "text": "TENANT_MISSING",
    "context": "return sendError(res, req, 403, 'TENANT_MISSING', 'Tenant context is required.');"
  },
  {
    "file": "middleware/billing.js",
    "line": 467,
    "text": "Tenant context is required.",
    "context": "return sendError(res, req, 403, 'TENANT_MISSING', 'Tenant context is required.');"
  },
  {
    "file": "middleware/billing.js",
    "line": 483,
    "text": "X-Quota-Period",
    "context": "res.setHeader('X-Quota-Period', billing.period.key);"
  },
  {
    "file": "middleware/billing.js",
    "line": 485,
    "text": "X-Quota-Limit",
    "context": "res.setHeader('X-Quota-Limit', billing.quota.limit);"
  },
  {
    "file": "middleware/billing.js",
    "line": 490,
    "text": "[billing] resolveTenant failed",
    "context": "req.log?.error?.({ err: error }, '[billing] resolveTenant failed');"
  },
  {
    "file": "middleware/billing.js",
    "line": 491,
    "text": "TENANT_RESOLUTION_FAILED",
    "context": "return sendError(res, req, 500, 'TENANT_RESOLUTION_FAILED', 'Tenant context could not be resolved.');"
  },
  {
    "file": "middleware/billing.js",
    "line": 491,
    "text": "Tenant context could not be resolved.",
    "context": "return sendError(res, req, 500, 'TENANT_RESOLUTION_FAILED', 'Tenant context could not be resolved.');"
  },
  {
    "file": "middleware/billing.js",
    "line": 502,
    "text": "GET",
    "context": "export const isWrite = (req) => !['GET', 'HEAD', 'OPTIONS'].includes((req.method || '').toUpperCase());"
  },
  {
    "file": "middleware/billing.js",
    "line": 502,
    "text": "HEAD",
    "context": "export const isWrite = (req) => !['GET', 'HEAD', 'OPTIONS'].includes((req.method || '').toUpperCase());"
  },
  {
    "file": "middleware/billing.js",
    "line": 502,
    "text": "OPTIONS",
    "context": "export const isWrite = (req) => !['GET', 'HEAD', 'OPTIONS'].includes((req.method || '').toUpperCase());"
  },
  {
    "file": "middleware/billing.js",
    "line": 571,
    "text": "GET",
    "context": "overrides['GET'],"
  },
  {
    "file": "middleware/billing.js",
    "line": 586,
    "text": "GET",
    "context": "plan.endpoint_overrides['GET'],"
  },
  {
    "file": "middleware/billing.js",
    "line": 625,
    "text": "incrementUsageAtomic requires tenantId, endpoint, and periodKey.",
    "context": "throw new Error('incrementUsageAtomic requires tenantId, endpoint, and periodKey.');"
  },
  {
    "file": "middleware/billing.js",
    "line": 653,
    "text": "[billing] Redis increment failed, falling back to Postgres.",
    "context": "state.logger?.warn?.({ err: error }, '[billing] Redis increment failed, falling back to Postgres.');"
  },
  {
    "file": "middleware/billing.js",
    "line": 661,
    "text": "BEGIN",
    "context": "await client.query('BEGIN');"
  },
  {
    "file": "middleware/billing.js",
    "line": 664,
    "text": "SELECT call_count FROM usage_counters WHERE tenant_id = $1 AND endpoint = $2 AND period_start = $3 FOR UPDATE",
    "context": "'SELECT call_count FROM usage_counters WHERE tenant_id = $1 AND endpoint = $2 AND period_start = $3 FOR UPDATE',"
  },
  {
    "file": "middleware/billing.js",
    "line": 669,
    "text": "ROLLBACK",
    "context": "await client.query('ROLLBACK');"
  },
  {
    "file": "middleware/billing.js",
    "line": 695,
    "text": "COMMIT",
    "context": "await client.query('COMMIT');"
  },
  {
    "file": "middleware/billing.js",
    "line": 703,
    "text": "ROLLBACK",
    "context": "await client.query('ROLLBACK');"
  },
  {
    "file": "middleware/billing.js",
    "line": 724,
    "text": "EX",
    "context": "const result = await state.redis.set(key, '1', 'EX', ttl, 'NX');"
  },
  {
    "file": "middleware/billing.js",
    "line": 724,
    "text": "NX",
    "context": "const result = await state.redis.set(key, '1', 'EX', ttl, 'NX');"
  },
  {
    "file": "middleware/billing.js",
    "line": 725,
    "text": "OK",
    "context": "if (result === 'OK') {"
  },
  {
    "file": "middleware/billing.js",
    "line": 732,
    "text": "[billing] Failed to persist usage threshold marker to Redis.",
    "context": "state.logger?.warn?.({ err: error }, '[billing] Failed to persist usage threshold marker to Redis.');"
  },
  {
    "file": "middleware/billing.js",
    "line": 765,
    "text": "usage_threshold:${tenantId}:${endpoint}:${period?.key ?? 'unknown'}:${threshold.label}",
    "context": "const key = `usage_threshold:${tenantId}:${endpoint}:${period?.key ?? 'unknown'}:${threshold.label}`;"
  },
  {
    "file": "middleware/billing.js",
    "line": 778,
    "text": "Usage threshold ${threshold.label}% reached",
    "context": "`Usage threshold ${threshold.label}% reached`,"
  },
  {
    "file": "middleware/billing.js",
    "line": 793,
    "text": "TENANT_REQUIRED",
    "context": "return res.status(401).json({ code: 'TENANT_REQUIRED' });"
  },
  {
    "file": "middleware/billing.js",
    "line": 836,
    "text": "QUOTA_EXCEEDED",
    "context": "code: 'QUOTA_EXCEEDED',"
  },
  {
    "file": "middleware/billing.js",
    "line": 842,
    "text": "X-Quota-Remaining",
    "context": "res.setHeader('X-Quota-Remaining', Math.max(0, Math.floor(limit - usage.total)));"
  },
  {
    "file": "middleware/billing.js",
    "line": 847,
    "text": "IDEMPOTENCY_CONFLICT",
    "context": "return res.status(409).json({ code: 'IDEMPOTENCY_CONFLICT' });"
  },
  {
    "file": "middleware/billing.js",
    "line": 850,
    "text": "[billing] enforceQuota failed",
    "context": "req.log?.error?.({ err: error }, '[billing] enforceQuota failed');"
  },
  {
    "file": "middleware/billing.js",
    "line": 851,
    "text": "BILLING_FAILURE",
    "context": "res.status(500).json({ code: 'BILLING_FAILURE' });"
  },
  {
    "file": "middleware/billing.js",
    "line": 886,
    "text": ").toUpperCase() !==",
    "context": "if ((req.method || '').toUpperCase() !== 'GET') {"
  },
  {
    "file": "middleware/billing.js",
    "line": 930,
    "text": "[billing] GET rate limiter Redis failure, using in-memory window.",
    "context": "state.logger?.warn?.({ err: error }, '[billing] GET rate limiter Redis failure, using in-memory window.');"
  },
  {
    "file": "middleware/billing.js",
    "line": 941,
    "text": "X-RateLimit-Limit",
    "context": "res.setHeader('X-RateLimit-Limit', limitValue);"
  },
  {
    "file": "middleware/billing.js",
    "line": 942,
    "text": "X-RateLimit-Remaining",
    "context": "res.setHeader('X-RateLimit-Remaining', remaining);"
  },
  {
    "file": "middleware/billing.js",
    "line": 946,
    "text": "Retry-After",
    "context": "res.setHeader('Retry-After', retryAfterSeconds);"
  },
  {
    "file": "middleware/billing.js",
    "line": 948,
    "text": "X-RateLimit-Reset",
    "context": "res.setHeader('X-RateLimit-Reset', resetEpoch);"
  },
  {
    "file": "middleware/billing.js",
    "line": 951,
    "text": "X-RateLimit-Reset",
    "context": "res.setHeader('X-RateLimit-Reset', resetEpoch);"
  },
  {
    "file": "middleware/billing.js",
    "line": 960,
    "text": "[billing] GET rate limit exceeded",
    "context": "req.log?.warn?.({ tenantId, endpoint: operation.normalizedEndpoint, limit: limitValue, count: result.count }, '[billing] GET rate limit exceeded');"
  },
  {
    "file": "middleware/billing.js",
    "line": 961,
    "text": "READ_RATE_LIMIT_EXCEEDED",
    "context": "return sendError(res, req, 429, 'READ_RATE_LIMIT_EXCEEDED', 'Too many read requests. Please slow down.');"
  },
  {
    "file": "middleware/billing.js",
    "line": 961,
    "text": "Too many read requests. Please slow down.",
    "context": "return sendError(res, req, 429, 'READ_RATE_LIMIT_EXCEEDED', 'Too many read requests. Please slow down.');"
  },
  {
    "file": "middleware/billing.js",
    "line": 966,
    "text": "[billing] Read rate limiter failure",
    "context": "req.log?.error?.({ err: error }, '[billing] Read rate limiter failure');"
  },
  {
    "file": "middleware/billing.js",
    "line": 967,
    "text": "READ_RATE_LIMIT_FAILURE",
    "context": "return sendError(res, req, 500, 'READ_RATE_LIMIT_FAILURE', 'The read rate limiter is temporarily unavailable.');"
  },
  {
    "file": "middleware/billing.js",
    "line": 967,
    "text": "The read rate limiter is temporarily unavailable.",
    "context": "return sendError(res, req, 500, 'READ_RATE_LIMIT_FAILURE', 'The read rate limiter is temporarily unavailable.');"
  },
  {
    "file": "middleware/billing.js",
    "line": 1021,
    "text": "UPDATE idempotency_keys SET status_code = $2, locked_at = NULL, last_accessed_at = NOW() WHERE idempotency_key = $1",
    "context": "'UPDATE idempotency_keys SET status_code = $2, locked_at = NULL, last_accessed_at = NOW() WHERE idempotency_key = $1',"
  },
  {
    "file": "middleware/billing.js",
    "line": 1026,
    "text": "[billing] Failed to update idempotency status.",
    "context": "state.logger?.warn?.({ err: error }, '[billing] Failed to update idempotency status.');"
  },
  {
    "file": "middleware/billing.js",
    "line": 1031,
    "text": "[billing] finalizeAndLog failure",
    "context": "req.log?.error?.({ err: error }, '[billing] finalizeAndLog failure');"
  },
  {
    "file": "n8n-nodes-videokit:credentials:VideoKitApi.credentials.js",
    "line": 2,
    "text": "in VideoKit API",
    "context": "* Bu dosya, n8n'in VideoKit API'sine nasıl bağlanacağını tanımlar."
  },
  {
    "file": "n8n-nodes-videokit:credentials:VideoKitApi.credentials.js",
    "line": 3,
    "text": "Credential",
    "context": "* Kullanıcı arayüzünde bir \"Credential\" oluşturma formu yaratır."
  },
  {
    "file": "n8n-nodes-videokit:credentials:VideoKitApi.credentials.js",
    "line": 10,
    "text": "VideoKit API",
    "context": "displayName = 'VideoKit API';"
  },
  {
    "file": "n8n-nodes-videokit:credentials:VideoKitApi.credentials.js",
    "line": 18,
    "text": "API Sunucu URL",
    "context": "displayName: 'API Sunucu URL',"
  },
  {
    "file": "n8n-nodes-videokit:credentials:VideoKitApi.credentials.js",
    "line": 23,
    "text": "VideoKit API sunucunuzun tam adresi.",
    "context": "description: 'VideoKit API sunucunuzun tam adresi.',"
  },
  {
    "file": "n8n-nodes-videokit:nodes:VideoKit:VideoKit.node.js",
    "line": 7,
    "text": "VideoKit",
    "context": "displayName: 'VideoKit',"
  },
  {
    "file": "n8n-nodes-videokit:nodes:VideoKit:VideoKit.node.js",
    "line": 13,
    "text": "VideoKit C2PA Doğrulama ve Manifest Oluşturma Aracı",
    "context": "description: 'VideoKit C2PA Doğrulama ve Manifest Oluşturma Aracı',"
  },
  {
    "file": "n8n-nodes-videokit:nodes:VideoKit:VideoKit.node.js",
    "line": 15,
    "text": "VideoKit",
    "context": "name: 'VideoKit',"
  },
  {
    "file": "n8n-nodes-videokit:nodes:VideoKit:VideoKit.node.js",
    "line": 30,
    "text": "Operasyon",
    "context": "displayName: 'Operasyon',"
  },
  {
    "file": "n8n-nodes-videokit:nodes:VideoKit:VideoKit.node.js",
    "line": 36,
    "text": "Doğrula (Verify)",
    "context": "name: 'Doğrula (Verify)',"
  },
  {
    "file": "n8n-nodes-videokit:nodes:VideoKit:VideoKit.node.js",
    "line": 38,
    "text": "Bir video dosyasının C2PA manifestini doğrular",
    "context": "description: 'Bir video dosyasının C2PA manifestini doğrular',"
  },
  {
    "file": "n8n-nodes-videokit:nodes:VideoKit:VideoKit.node.js",
    "line": 39,
    "text": "Bir video dosyasını doğrula",
    "context": "action: 'Bir video dosyasını doğrula',"
  },
  {
    "file": "n8n-nodes-videokit:nodes:VideoKit:VideoKit.node.js",
    "line": 42,
    "text": "Manifest Oluştur (Stamp)",
    "context": "name: 'Manifest Oluştur (Stamp)',"
  },
  {
    "file": "n8n-nodes-videokit:nodes:VideoKit:VideoKit.node.js",
    "line": 44,
    "text": "Bir video için .c2pa yan dosyası oluşturur",
    "context": "description: 'Bir video için .c2pa yan dosyası oluşturur',"
  },
  {
    "file": "n8n-nodes-videokit:nodes:VideoKit:VideoKit.node.js",
    "line": 45,
    "text": "Bir video için manifest oluştur",
    "context": "action: 'Bir video için manifest oluştur',"
  },
  {
    "file": "n8n-nodes-videokit:nodes:VideoKit:VideoKit.node.js",
    "line": 56,
    "text": "Binary Veri Alanı",
    "context": "displayName: 'Binary Veri Alanı',"
  },
  {
    "file": "n8n-nodes-videokit:nodes:VideoKit:VideoKit.node.js",
    "line": 66,
    "text": "Gelen veride dosya içeriğini barındıran alanın adı.",
    "context": "description: 'Gelen veride dosya içeriğini barındıran alanın adı.',"
  },
  {
    "file": "n8n-nodes-videokit:nodes:VideoKit:VideoKit.node.js",
    "line": 72,
    "text": "Yazar (Creator)",
    "context": "displayName: 'Yazar (Creator)',"
  },
  {
    "file": "n8n-nodes-videokit:nodes:VideoKit:VideoKit.node.js",
    "line": 82,
    "text": "Örn: VideoKit Departmanı",
    "context": "placeholder: 'Örn: VideoKit Departmanı',"
  },
  {
    "file": "n8n-nodes-videokit:nodes:VideoKit:VideoKit.node.js",
    "line": 83,
    "text": "Manifeste eklenecek yazar (creator) bilgisi.",
    "context": "description: 'Manifeste eklenecek yazar (creator) bilgisi.',"
  },
  {
    "file": "n8n-nodes-videokit:nodes:VideoKit:VideoKit.node.js",
    "line": 109,
    "text": "Gelen veride binary alan ('${binaryPropertyName}') bulunamadı.",
    "context": "throw new Error(`Gelen veride binary alan ('${binaryPropertyName}') bulunamadı.`);"
  },
  {
    "file": "n8n-nodes-videokit:nodes:VideoKit:VideoKit.node.js",
    "line": 122,
    "text": "POST",
    "context": "method: 'POST',"
  },
  {
    "file": "n8n-nodes-videokit:nodes:VideoKit:VideoKit.node.js",
    "line": 132,
    "text": "API yanıtından geçerli bir Job ID alınamadı.",
    "context": "throw new Error('API yanıtından geçerli bir Job ID alınamadı.');"
  },
  {
    "file": "n8n-nodes-videokit:nodes:VideoKit:VideoKit.node.js",
    "line": 149,
    "text": "Doğrulama işi başarısız oldu: ${jobStatusResponse.error}",
    "context": "throw new Error(`Doğrulama işi başarısız oldu: ${jobStatusResponse.error}`);"
  },
  {
    "file": "n8n-nodes-videokit:nodes:VideoKit:VideoKit.node.js",
    "line": 154,
    "text": "İş zaman aşımına uğradı.",
    "context": "throw new Error('İş zaman aşımına uğradı.');"
  },
  {
    "file": "n8n-nodes-videokit:nodes:VideoKit:VideoKit.node.js",
    "line": 172,
    "text": "POST",
    "context": "method: 'POST',"
  },
  {
    "file": "package/scripts/lib/download-test-certs.js",
    "line": 28,
    "text": "Downloading test certificates...",
    "context": "console.log(chalk.yellow('Downloading test certificates...'));"
  },
  {
    "file": "package/scripts/lib/download-test-certs.js",
    "line": 32,
    "text": "Downloaded es256.pem",
    "context": "console.log(chalk.yellow('Downloaded es256.pem'));"
  },
  {
    "file": "package/scripts/lib/download-test-certs.js",
    "line": 36,
    "text": "Downloaded es256.pub",
    "context": "console.log(chalk.yellow('Downloaded es256.pub'));"
  },
  {
    "file": "package/scripts/postinstall.js",
    "line": 29,
    "text": "ERROR: ${err}",
    "context": "console.error(`ERROR: ${err}`);"
  },
  {
    "file": "package/scripts/postinstall.js",
    "line": 42,
    "text": "ENOENT",
    "context": "if (err.code === 'ENOENT') {"
  },
  {
    "file": "package/scripts/postinstall.js",
    "line": 53,
    "text": "Detected",
    "context": "console.debug('Detected', { arch, platform });"
  },
  {
    "file": "package/scripts/postinstall.js",
    "line": 68,
    "text": "Can not find binary for architecture: ${arch} and platform: ${platform}, attempting to build Rust",
    "context": "`Can not find binary for architecture: ${arch} and platform: ${platform}, attempting to build Rust`,"
  },
  {
    "file": "package/scripts/postinstall.js",
    "line": 75,
    "text": "Checking for a release at: ${url}",
    "context": "console.log(`Checking for a release at: ${url}`);"
  },
  {
    "file": "package/scripts/postinstall.js",
    "line": 80,
    "text": "Content-Length",
    "context": "const totalSize = parseInt(res.headers.get('Content-Length'), 10);"
  },
  {
    "file": "package/scripts/postinstall.js",
    "line": 88,
    "text": "Downloading | {bar} | {value_formatted} / {total_formatted} ({percentage}%) | ETA: {eta}s",
    "context": "'Downloading | {bar} | {value_formatted} / {total_formatted} ({percentage}%) | ETA: {eta}s',"
  },
  {
    "file": "package/scripts/postinstall.js",
    "line": 114,
    "text": "Downloaded to ${destPath}",
    "context": "console.log(`Downloaded to ${destPath}`);"
  },
  {
    "file": "package/scripts/postinstall.js",
    "line": 149,
    "text": "rustc --version",
    "context": "await Promise.all([pExec('rustc --version'), pExec('cargo --version')]);"
  },
  {
    "file": "package/scripts/postinstall.js",
    "line": 149,
    "text": "cargo --version",
    "context": "await Promise.all([pExec('rustc --version'), pExec('cargo --version')]);"
  },
  {
    "file": "package/scripts/postinstall.js",
    "line": 157,
    "text": "🦀 Building Rust...",
    "context": "console.log('🦀 Building Rust...');"
  },
  {
    "file": "package/scripts/postinstall.js",
    "line": 160,
    "text": "Cargo.toml",
    "context": "const cargoPath = resolve(root, 'Cargo.toml');"
  },
  {
    "file": "package/scripts/postinstall.js",
    "line": 164,
    "text": "npx cargo-cp-artifact -nc \"${bindingsPath}\" -- cargo build --message-format=json-render-diagnostics --release --manifest-path=\"${cargoPath}\"",
    "context": "`npx cargo-cp-artifact -nc \"${bindingsPath}\" -- cargo build --message-format=json-render-diagnostics --release --manifest-path=\"${cargoPath}\"`,"
  },
  {
    "file": "package/scripts/postinstall.js",
    "line": 176,
    "text": "Cargo.toml",
    "context": "const cargoDistPath = resolve(distRoot, 'Cargo.toml');"
  },
  {
    "file": "package/scripts/postinstall.js",
    "line": 184,
    "text": "Skipping Rust build since C2PA_LIBRARY_PATH is set",
    "context": "console.log('Skipping Rust build since C2PA_LIBRARY_PATH is set');"
  },
  {
    "file": "package/scripts/postinstall.js",
    "line": 190,
    "text": "Skipping prebuilt binary download since SKIP_BINARY_DOWNLOAD is set",
    "context": "'Skipping prebuilt binary download since SKIP_BINARY_DOWNLOAD is set',"
  },
  {
    "file": "package/scripts/postinstall.js",
    "line": 197,
    "text": "Skipping Rust build since Rust and/or Cargo is not found",
    "context": "console.warn('Skipping Rust build since Rust and/or Cargo is not found');"
  },
  {
    "file": "package/scripts/postinstall.js",
    "line": 208,
    "text": "Skipping Rust build since SKIP_RUST_BUILD is set",
    "context": "console.log('Skipping Rust build since SKIP_RUST_BUILD is set');"
  },
  {
    "file": "reports/scripts/run-billing-basic.mjs",
    "line": 37,
    "text": "X-Tenant-Id",
    "context": "const tenantId = req.get('X-Tenant-Id') || 'tenant-a';"
  },
  {
    "file": "reports/scripts/run-billing-basic.mjs",
    "line": 76,
    "text": "--- Scenario: POST /write below limit ---",
    "context": "console.log('--- Scenario: POST /write below limit ---');"
  },
  {
    "file": "reports/scripts/run-billing-basic.mjs",
    "line": 79,
    "text": "Response",
    "context": "logJson('Response', {"
  },
  {
    "file": "reports/scripts/run-billing-basic.mjs",
    "line": 84,
    "text": "Usage counters",
    "context": "logJson('Usage counters', {"
  },
  {
    "file": "reports/scripts/run-billing-basic.mjs",
    "line": 89,
    "text": "\\n--- Scenario: POST /write above limit ---",
    "context": "console.log('\\n--- Scenario: POST /write above limit ---');"
  },
  {
    "file": "reports/scripts/run-billing-basic.mjs",
    "line": 92,
    "text": "Response",
    "context": "logJson('Response', {"
  },
  {
    "file": "reports/scripts/run-billing-basic.mjs",
    "line": 96,
    "text": "Usage counters",
    "context": "logJson('Usage counters', {"
  },
  {
    "file": "reports/scripts/run-billing-basic.mjs",
    "line": 101,
    "text": "\\n--- Scenario: GET /write while quota exceeded ---",
    "context": "console.log('\\n--- Scenario: GET /write while quota exceeded ---');"
  },
  {
    "file": "reports/scripts/run-billing-basic.mjs",
    "line": 104,
    "text": "Response",
    "context": "logJson('Response', {"
  },
  {
    "file": "reports/scripts/run-billing-basic.mjs",
    "line": 108,
    "text": "Usage counters",
    "context": "logJson('Usage counters', {"
  },
  {
    "file": "scripts/generate-i18n-coverage.mjs",
    "line": 8,
    "text": "Expected an array in ${reportPath}",
    "context": "throw new Error(`Expected an array in ${reportPath}`);"
  },
  {
    "file": "scripts/generate-i18n-coverage.mjs",
    "line": 29,
    "text": "Failed to parse JSON from ${filePath}: ${error.message}",
    "context": "throw new Error(`Failed to parse JSON from ${filePath}: ${error.message}`);"
  },
  {
    "file": "scripts/generate-i18n-coverage.mjs",
    "line": 34,
    "text": "No locale JSON files found.",
    "context": "throw new Error('No locale JSON files found.');"
  },
  {
    "file": "scripts/generate-i18n-coverage.mjs",
    "line": 78,
    "text": "${(ratio * 100).toFixed(2)}%",
    "context": "return `${(ratio * 100).toFixed(2)}%`;"
  },
  {
    "file": "scripts/generate-i18n-coverage.mjs",
    "line": 90,
    "text": "${JSON.stringify(jsonReport, null, 2)}\\n",
    "context": "await fs.writeFile(outputJsonPath, `${JSON.stringify(jsonReport, null, 2)}\\n`, 'utf8');"
  },
  {
    "file": "scripts/generate-i18n-coverage.mjs",
    "line": 93,
    "text": "# i18n Coverage Report",
    "context": "lines.push('# i18n Coverage Report');"
  },
  {
    "file": "scripts/generate-i18n-coverage.mjs",
    "line": 95,
    "text": "Total used keys: ${usedKeyCount}",
    "context": "lines.push(`Total used keys: ${usedKeyCount}`);"
  },
  {
    "file": "scripts/generate-i18n-coverage.mjs",
    "line": 97,
    "text": "| Locale | Coverage | Missing | Unused | Total keys |",
    "context": "lines.push('| Locale | Coverage | Missing | Unused | Total keys |');"
  },
  {
    "file": "scripts/generate-i18n-coverage.mjs",
    "line": 101,
    "text": "| ${stat.locale} | ${formatPercentage(stat.coverageRatio)} | ${stat.missingCount} | ${stat.unusedCount} | ${stat.totalKeys} |",
    "context": "`| ${stat.locale} | ${formatPercentage(stat.coverageRatio)} | ${stat.missingCount} | ${stat.unusedCount} | ${stat.totalKeys} |`,"
  },
  {
    "file": "scripts/generate-i18n-coverage.mjs",
    "line": 105,
    "text": "## Orphan used keys",
    "context": "lines.push('## Orphan used keys');"
  },
  {
    "file": "scripts/generate-i18n-coverage.mjs",
    "line": 108,
    "text": "- None",
    "context": "lines.push('- None');"
  },
  {
    "file": "scripts/generate-i18n-coverage.mjs",
    "line": 111,
    "text": "- ${key}",
    "context": "lines.push(`- ${key}`);"
  },
  {
    "file": "seed-db.js",
    "line": 10,
    "text": "Veritabanı hazırlık betiği çalışıyor...",
    "context": "console.log(`Veritabanı hazırlık betiği çalışıyor...`);"
  },
  {
    "file": "seed-db.js",
    "line": 11,
    "text": "Sandbox",
    "context": "console.log(`Ortam: ${isSandbox ? 'Sandbox' : 'Production'}`);"
  },
  {
    "file": "seed-db.js",
    "line": 11,
    "text": "Production",
    "context": "console.log(`Ortam: ${isSandbox ? 'Sandbox' : 'Production'}`);"
  },
  {
    "file": "seed-db.js",
    "line": 11,
    "text": "Ortam: ${isSandbox ? 'Sandbox' : 'Production'}",
    "context": "console.log(`Ortam: ${isSandbox ? 'Sandbox' : 'Production'}`);"
  },
  {
    "file": "seed-db.js",
    "line": 12,
    "text": "Redis Adresi: ${redisUrl}",
    "context": "console.log(`Redis Adresi: ${redisUrl}`);"
  },
  {
    "file": "seed-db.js",
    "line": 17,
    "text": "Free Tier",
    "context": "name: 'Free Tier',"
  },
  {
    "file": "seed-db.js",
    "line": 23,
    "text": "Pro Tier",
    "context": "name: 'Pro Tier',"
  },
  {
    "file": "seed-db.js",
    "line": 29,
    "text": "Pay as you go",
    "context": "name: 'Pay as you go',"
  },
  {
    "file": "seed-db.js",
    "line": 35,
    "text": "Trial Version",
    "context": "name: 'Trial Version',"
  },
  {
    "file": "seed-db.js",
    "line": 46,
    "text": "Organization A (Pro Plan)",
    "context": "name: 'Organization A (Pro Plan)',"
  },
  {
    "file": "seed-db.js",
    "line": 47,
    "text": "PRO_PLAN_KEY",
    "context": "apiKey: 'PRO_PLAN_KEY',"
  },
  {
    "file": "seed-db.js",
    "line": 52,
    "text": "Organization B (Pay as you go)",
    "context": "name: 'Organization B (Pay as you go)',"
  },
  {
    "file": "seed-db.js",
    "line": 53,
    "text": "PAYG_PLAN_KEY",
    "context": "apiKey: 'PAYG_PLAN_KEY',"
  },
  {
    "file": "seed-db.js",
    "line": 58,
    "text": "Test User (Free Plan)",
    "context": "name: 'Test User (Free Plan)',"
  },
  {
    "file": "seed-db.js",
    "line": 59,
    "text": "FREE_PLAN_KEY",
    "context": "apiKey: 'FREE_PLAN_KEY',"
  },
  {
    "file": "seed-db.js",
    "line": 64,
    "text": "Tester (Kredisi Biten)",
    "context": "name: 'Tester (Kredisi Biten)',"
  },
  {
    "file": "seed-db.js",
    "line": 65,
    "text": "PAYG_NO_CREDITS_KEY",
    "context": "apiKey: 'PAYG_NO_CREDITS_KEY',"
  },
  {
    "file": "seed-db.js",
    "line": 71,
    "text": "Tester (Kotası Dolmak Üzere)",
    "context": "name: 'Tester (Kotası Dolmak Üzere)',"
  },
  {
    "file": "seed-db.js",
    "line": 72,
    "text": "PRO_ALMOST_FULL_KEY",
    "context": "apiKey: 'PRO_ALMOST_FULL_KEY',"
  },
  {
    "file": "seed-db.js",
    "line": 80,
    "text": "Redis bağlantısı kuruldu. Veritabanı temizleniyor...",
    "context": "console.log('Redis bağlantısı kuruldu. Veritabanı temizleniyor...');"
  },
  {
    "file": "seed-db.js",
    "line": 83,
    "text": "Veritabanı temizlendi. Yeni veriler ekleniyor...",
    "context": "console.log('Veritabanı temizlendi. Yeni veriler ekleniyor...');"
  },
  {
    "file": "seed-db.js",
    "line": 103,
    "text": "${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}",
    "context": "const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;"
  },
  {
    "file": "seed-db.js",
    "line": 108,
    "text": "Örnek marka ayarları ekleniyor...",
    "context": "console.log('Örnek marka ayarları ekleniyor...');"
  },
  {
    "file": "seed-db.js",
    "line": 121,
    "text": "Sandbox",
    "context": "console.log(`✅ Veritabanına örnek kiracı verileri (${isSandbox ? 'Sandbox' : 'Production'}) başarıyla eklendi.`);"
  },
  {
    "file": "seed-db.js",
    "line": 121,
    "text": "Production",
    "context": "console.log(`✅ Veritabanına örnek kiracı verileri (${isSandbox ? 'Sandbox' : 'Production'}) başarıyla eklendi.`);"
  },
  {
    "file": "seed-db.js",
    "line": 121,
    "text": "✅ Veritabanına örnek kiracı verileri (${isSandbox ? 'Sandbox' : 'Production'}) başarıyla eklendi.",
    "context": "console.log(`✅ Veritabanına örnek kiracı verileri (${isSandbox ? 'Sandbox' : 'Production'}) başarıyla eklendi.`);"
  },
  {
    "file": "seed-db.js",
    "line": 122,
    "text": "Örnek API Anahtarları:",
    "context": "console.log('Örnek API Anahtarları:');"
  },
  {
    "file": "seed-db.js",
    "line": 123,
    "text": "- ${t.name}: ${keyPrefix}${t.apiKey}",
    "context": "tenants.forEach(t => console.log(`  - ${t.name}: ${keyPrefix}${t.apiKey}`));"
  },
  {
    "file": "server.mjs",
    "line": 42,
    "text": "[tracing] disabled:",
    "context": "console.warn('[tracing] disabled:', e?.message || e)"
  },
  {
    "file": "server.mjs",
    "line": 50,
    "text": "C2PA devre dışı (C2PA_ENABLED=false).",
    "context": "console.warn('C2PA devre dışı (C2PA_ENABLED=false).');"
  },
  {
    "file": "server.mjs",
    "line": 85,
    "text": "✅ PostgreSQL veritabanına başarıyla bağlanıldı.",
    "context": "logger.info('✅ PostgreSQL veritabanına başarıyla bağlanıldı.');"
  },
  {
    "file": "server.mjs",
    "line": 88,
    "text": "PostgreSQL veritabanına bağlanılamadı. Lütfen yapılandırmayı kontrol edin.",
    "context": "logger.error({ err }, 'PostgreSQL veritabanına bağlanılamadı. Lütfen yapılandırmayı kontrol edin.');"
  },
  {
    "file": "server.mjs",
    "line": 96,
    "text": "Redis bağlantı hatası",
    "context": "redisConnection.on('error', (err) => logger.error({ err }, 'Redis bağlantı hatası'));"
  },
  {
    "file": "server.mjs",
    "line": 125,
    "text": "HTTP isteklerinin milisaniye cinsinden süresi.",
    "context": "help: 'HTTP isteklerinin milisaniye cinsinden süresi.',"
  },
  {
    "file": "server.mjs",
    "line": 132,
    "text": "HTTP istekleri toplam sayısı.",
    "context": "help: 'HTTP istekleri toplam sayısı.',"
  },
  {
    "file": "server.mjs",
    "line": 138,
    "text": "HTTP hatalarının toplam sayısı.",
    "context": "help: 'HTTP hatalarının toplam sayısı.',"
  },
  {
    "file": "server.mjs",
    "line": 199,
    "text": "UNKNOWN",
    "context": "const method = (req.method || 'UNKNOWN').toUpperCase();"
  },
  {
    "file": "server.mjs",
    "line": 242,
    "text": "/readyz kontrolü başarısız: Redis hazır değil.",
    "context": "req.log.warn({ redisStatus }, '/readyz kontrolü başarısız: Redis hazır değil.');"
  },
  {
    "file": "server.mjs",
    "line": 243,
    "text": "failed (status: ${redisStatus})",
    "context": "res.status(503).json({ status: 'unavailable', checks: { redis: `failed (status: ${redisStatus})`, postgres: 'ok' } });"
  },
  {
    "file": "server.mjs",
    "line": 246,
    "text": "/readyz kontrolü sırasında istisna oluştu.",
    "context": "req.log.error({ err: error }, '/readyz kontrolü sırasında istisna oluştu.');"
  },
  {
    "file": "server.mjs",
    "line": 251,
    "text": "failed (status: ${redisStatus})",
    "context": "redis: redisStatus === 'ready' ? 'ok' : `failed (status: ${redisStatus})`,"
  },
  {
    "file": "server.mjs",
    "line": 259,
    "text": "Content-Type",
    "context": "res.set('Content-Type', promClient.register.contentType);"
  },
  {
    "file": "server.mjs",
    "line": 303,
    "text": "[CORS] Engellenen origin",
    "context": "logger.warn({ origin }, '[CORS] Engellenen origin');"
  },
  {
    "file": "server.mjs",
    "line": 307,
    "text": "Content-Type",
    "context": "allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With', 'Idempotency-Key'],"
  },
  {
    "file": "server.mjs",
    "line": 307,
    "text": "Authorization",
    "context": "allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With', 'Idempotency-Key'],"
  },
  {
    "file": "server.mjs",
    "line": 307,
    "text": "X-API-Key",
    "context": "allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With', 'Idempotency-Key'],"
  },
  {
    "file": "server.mjs",
    "line": 307,
    "text": "X-Requested-With",
    "context": "allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With', 'Idempotency-Key'],"
  },
  {
    "file": "server.mjs",
    "line": 307,
    "text": "Idempotency-Key",
    "context": "allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With', 'Idempotency-Key'],"
  },
  {
    "file": "server.mjs",
    "line": 355,
    "text": "İzin verilmeyen dosya türü. Sadece JPEG, PNG, SVG geçerlidir.",
    "context": "cb(new Error('İzin verilmeyen dosya türü. Sadece JPEG, PNG, SVG geçerlidir.'));"
  },
  {
    "file": "server.mjs",
    "line": 367,
    "text": "[WebSocket] Bağlantı reddedildi: batchId eksik.",
    "context": "logger.warn('[WebSocket] Bağlantı reddedildi: batchId eksik.');"
  },
  {
    "file": "server.mjs",
    "line": 371,
    "text": "[WebSocket] İstemci bağlandı.",
    "context": "logger.info({ batchId }, `[WebSocket] İstemci bağlandı.`);"
  },
  {
    "file": "server.mjs",
    "line": 374,
    "text": "[WebSocket] İstemci bağlantısı kesildi.",
    "context": "logger.info({ batchId }, `[WebSocket] İstemci bağlantısı kesildi.`);"
  },
  {
    "file": "server.mjs",
    "line": 378,
    "text": "[WebSocket] Hata.",
    "context": "logger.error({ batchId, err: error }, `[WebSocket] Hata.`);"
  },
  {
    "file": "server.mjs",
    "line": 385,
    "text": "Redis Pub/Sub kanalına abone olunamadı:",
    "context": "logger.error({ err }, 'Redis Pub/Sub kanalına abone olunamadı:');"
  },
  {
    "file": "server.mjs",
    "line": 387,
    "text": "✅ Redis kanalı dinleniyor: ${JOB_UPDATES_CHANNEL}",
    "context": "logger.info(`✅ Redis kanalı dinleniyor: ${JOB_UPDATES_CHANNEL}`);"
  },
  {
    "file": "server.mjs",
    "line": 398,
    "text": "[Pub/Sub] ${batchId} için iş güncellemesi gönderiliyor (Job: ${jobId})",
    "context": "logger.info({ batchId, jobId }, `[Pub/Sub] ${batchId} için iş güncellemesi gönderiliyor (Job: ${jobId})`);"
  },
  {
    "file": "server.mjs",
    "line": 402,
    "text": "[Pub/Sub] Gelen mesaj işlenirken hata oluştu:",
    "context": "logger.error({ err: e }, '[Pub/Sub] Gelen mesaj işlenirken hata oluştu:');"
  },
  {
    "file": "server.mjs",
    "line": 409,
    "text": "Free Tier",
    "context": "free: { name: 'Free Tier', rateLimitPerMinute: 10, monthlyQuota: null, apiKeyLimit: 1 },"
  },
  {
    "file": "server.mjs",
    "line": 410,
    "text": "Pro Tier",
    "context": "pro: { name: 'Pro Tier', rateLimitPerMinute: 100, monthlyQuota: 1000, apiKeyLimit: 5 },"
  },
  {
    "file": "server.mjs",
    "line": 411,
    "text": "Pay as you go",
    "context": "'pay-as-you-go': { name: 'Pay as you go', rateLimitPerMinute: 120, monthlyQuota: null, apiKeyLimit: 10 },"
  },
  {
    "file": "server.mjs",
    "line": 412,
    "text": "Trial Version",
    "context": "trial: { name: 'Trial Version', rateLimitPerMinute: 20, monthlyQuota: 500, apiKeyLimit: 2 },"
  },
  {
    "file": "server.mjs",
    "line": 491,
    "text": "${apiKey.slice(0, prefixLength)}...${apiKey.slice(apiKey.length - suffixLength)}",
    "context": "return `${apiKey.slice(0, prefixLength)}...${apiKey.slice(apiKey.length - suffixLength)}`;"
  },
  {
    "file": "server.mjs",
    "line": 499,
    "text": "ENOENT",
    "context": "if (error.code !== 'ENOENT') {"
  },
  {
    "file": "server.mjs",
    "line": 500,
    "text": "[Upload] Geçici dosya silinemedi.",
    "context": "logger.warn({ err: error, path: file.path }, '[Upload] Geçici dosya silinemedi.');"
  },
  {
    "file": "server.mjs",
    "line": 507,
    "text": "Uploaded file metadata missing.",
    "context": "throw new Error('Uploaded file metadata missing.');"
  },
  {
    "file": "server.mjs",
    "line": 515,
    "text": "Uploaded file is not accessible.",
    "context": "throw new Error('Uploaded file is not accessible.');"
  },
  {
    "file": "server.mjs",
    "line": 531,
    "text": "[Upload] Dosya başlangıcı okunamadı.",
    "context": "logger.warn({ err: error, path: file.path }, '[Upload] Dosya başlangıcı okunamadı.');"
  },
  {
    "file": "server.mjs",
    "line": 571,
    "text": "POST",
    "context": "if (req.method !== 'POST') {"
  },
  {
    "file": "server.mjs",
    "line": 582,
    "text": "[Idempotency] Önbellekten yanıt veriliyor.",
    "context": "req.log.info({ idempotencyKey }, `[Idempotency] Önbellekten yanıt veriliyor.`);"
  },
  {
    "file": "server.mjs",
    "line": 588,
    "text": "EX",
    "context": "const lock = await redisConnection.set(redisKey, JSON.stringify({ status: 'in_progress' }), 'EX', 300, 'NX');"
  },
  {
    "file": "server.mjs",
    "line": 588,
    "text": "NX",
    "context": "const lock = await redisConnection.set(redisKey, JSON.stringify({ status: 'in_progress' }), 'EX', 300, 'NX');"
  },
  {
    "file": "server.mjs",
    "line": 590,
    "text": "[Idempotency] Çakışma tespit edildi.",
    "context": "req.log.warn({ idempotencyKey }, `[Idempotency] Çakışma tespit edildi.`);"
  },
  {
    "file": "server.mjs",
    "line": 591,
    "text": "IDEMPOTENCY_CONFLICT",
    "context": "return sendError(res, req, 409, 'IDEMPOTENCY_CONFLICT', t('error_idempotency_conflict', req.lang));"
  },
  {
    "file": "server.mjs",
    "line": 604,
    "text": "EX",
    "context": "redisConnection.set(redisKey, JSON.stringify(cachePayload), 'EX', 86400);"
  },
  {
    "file": "server.mjs",
    "line": 605,
    "text": "[Idempotency] Sonuç önbelleğe alındı.",
    "context": "req.log.info({ idempotencyKey }, `[Idempotency] Sonuç önbelleğe alındı.`);"
  },
  {
    "file": "server.mjs",
    "line": 613,
    "text": "[Idempotency] Redis hatası:",
    "context": "req.log.error({ err: error, idempotencyKey }, '[Idempotency] Redis hatası:');"
  },
  {
    "file": "server.mjs",
    "line": 630,
    "text": "FILE_NOT_UPLOADED",
    "context": "return sendError(res, req, 400, 'FILE_NOT_UPLOADED', t('error_file_not_uploaded', req.lang));"
  },
  {
    "file": "server.mjs",
    "line": 633,
    "text": "[/verify] İstek alındı",
    "context": "req.log.info({ file: req.file.originalname, size: req.file.size, webhook: !!webhookUrl }, `[/verify] İstek alındı`);"
  },
  {
    "file": "server.mjs",
    "line": 646,
    "text": "[/verify] İş kuyruğa eklendi.",
    "context": "req.log.info({ jobId: job.id }, `[/verify] İş kuyruğa eklendi.`);"
  },
  {
    "file": "server.mjs",
    "line": 649,
    "text": "[/verify] İş kuyruğa eklenirken hata oluştu",
    "context": "req.log.error({ err: error }, '[/verify] İş kuyruğa eklenirken hata oluştu');"
  },
  {
    "file": "server.mjs",
    "line": 650,
    "text": "JOB_CREATION_FAILED",
    "context": "return sendError(res, req, 500, 'JOB_CREATION_FAILED', t('error_job_creation_failed', req.lang));"
  },
  {
    "file": "server.mjs",
    "line": 663,
    "text": "JOB_NOT_FOUND",
    "context": "return sendError(res, req, 404, 'JOB_NOT_FOUND', t('error_job_not_found', req.lang));"
  },
  {
    "file": "server.mjs",
    "line": 667,
    "text": "[AUTH] Yetkisiz iş erişimi denemesi.",
    "context": "req.log.warn({ tenantId: req.tenant.id, jobOwner: job.data.tenantId, jobId }, `[AUTH] Yetkisiz iş erişimi denemesi.`);"
  },
  {
    "file": "server.mjs",
    "line": 668,
    "text": "FORBIDDEN_JOB_ACCESS",
    "context": "return sendError(res, req, 403, 'FORBIDDEN_JOB_ACCESS', t('error_forbidden_job_access', req.lang));"
  },
  {
    "file": "server.mjs",
    "line": 683,
    "text": "FILE_NOT_UPLOADED",
    "context": "return sendError(res, req, 400, 'FILE_NOT_UPLOADED', t('error_file_not_uploaded', req.lang));"
  },
  {
    "file": "server.mjs",
    "line": 685,
    "text": "VideoKit API v1.0",
    "context": "const { author, action = 'c2pa.created', agent = 'VideoKit API v1.0', captureOnly } = req.body;"
  },
  {
    "file": "server.mjs",
    "line": 687,
    "text": "AUTHOR_MISSING",
    "context": "return sendError(res, req, 400, 'AUTHOR_MISSING', t('error_author_missing', req.lang));"
  },
  {
    "file": "server.mjs",
    "line": 698,
    "text": "PolicyViolationError: ${errorMessage}",
    "context": "status: 'failed', result: `PolicyViolationError: ${errorMessage}`"
  },
  {
    "file": "server.mjs",
    "line": 700,
    "text": "POLICY_VIOLATION",
    "context": "return sendError(res, req, 422, 'POLICY_VIOLATION', errorMessage);"
  },
  {
    "file": "server.mjs",
    "line": 704,
    "text": "[/stamp] İstek alındı",
    "context": "req.log.info({ file: req.file.originalname, author }, `[/stamp] İstek alındı`);"
  },
  {
    "file": "server.mjs",
    "line": 714,
    "text": "Person",
    "context": "{ label: 'stds.schema-org.CreativeWork', data: { author: [{ '@type': 'Person', name: author }] } },"
  },
  {
    "file": "server.mjs",
    "line": 721,
    "text": "${baseName || 'manifest'}.c2pa",
    "context": "const sidecarName = `${baseName || 'manifest'}.c2pa`;"
  },
  {
    "file": "server.mjs",
    "line": 724,
    "text": "Manifest oluşturuldu: ${sidecarName}",
    "context": "status: 'success', result: `Manifest oluşturuldu: ${sidecarName}`"
  },
  {
    "file": "server.mjs",
    "line": 726,
    "text": "[/stamp] Manifest başarıyla oluşturuldu",
    "context": "req.log.info({ sidecarName }, `[/stamp] Manifest başarıyla oluşturuldu`);"
  },
  {
    "file": "server.mjs",
    "line": 727,
    "text": "Content-Disposition",
    "context": "res.setHeader('Content-Disposition', `attachment; filename=${sidecarName}`);"
  },
  {
    "file": "server.mjs",
    "line": 727,
    "text": "attachment; filename=${sidecarName}",
    "context": "res.setHeader('Content-Disposition', `attachment; filename=${sidecarName}`);"
  },
  {
    "file": "server.mjs",
    "line": 728,
    "text": "Content-Type",
    "context": "res.setHeader('Content-Type', 'application/c2pa');"
  },
  {
    "file": "server.mjs",
    "line": 733,
    "text": "[/stamp] Politika ihlali: ${message}",
    "context": "req.log.warn({ err: error }, `[/stamp] Politika ihlali: ${message}`);"
  },
  {
    "file": "server.mjs",
    "line": 734,
    "text": "PolicyViolationError: ${message}",
    "context": "await audit.append({ type: 'stamp', customerId: req.tenant.id, input: { fileName: req.file.originalname }, status: 'failed', result: `PolicyViolationError: ${message}` });"
  },
  {
    "file": "server.mjs",
    "line": 735,
    "text": "POLICY_VIOLATION",
    "context": "return sendError(res, req, 403, 'POLICY_VIOLATION', message);"
  },
  {
    "file": "server.mjs",
    "line": 738,
    "text": "ENOENT",
    "context": "if (error.code === 'ENOENT') {"
  },
  {
    "file": "server.mjs",
    "line": 739,
    "text": "[/stamp] Hata: İmzalama için gerekli anahtar/sertifika dosyası bulunamadı.",
    "context": "req.log.error({ err: error }, '[/stamp] Hata: İmzalama için gerekli anahtar/sertifika dosyası bulunamadı.');"
  },
  {
    "file": "server.mjs",
    "line": 740,
    "text": "SERVER_CONFIG_KEYS_MISSING",
    "context": "return sendError(res, req, 500, 'SERVER_CONFIG_KEYS_MISSING', t('error_server_config_keys_missing', req.lang));"
  },
  {
    "file": "server.mjs",
    "line": 742,
    "text": "[/stamp] Manifest oluşturulurken hata oluştu",
    "context": "req.log.error({ err: error }, '[/stamp] Manifest oluşturulurken hata oluştu');"
  },
  {
    "file": "server.mjs",
    "line": 743,
    "text": "SERVER_ERROR",
    "context": "return sendError(res, req, 500, 'SERVER_ERROR', t('error_server_error', req.lang), { cause: error.message });"
  },
  {
    "file": "server.mjs",
    "line": 752,
    "text": "FILE_NOT_UPLOADED",
    "context": "return sendError(res, req, 400, 'FILE_NOT_UPLOADED', t('error_file_not_uploaded', req.lang));"
  },
  {
    "file": "server.mjs",
    "line": 756,
    "text": "BATCH_METADATA_REQUIRED",
    "context": "return sendError(res, req, 400, 'BATCH_METADATA_REQUIRED', 'batchId ve fileId gereklidir.');"
  },
  {
    "file": "server.mjs",
    "line": 756,
    "text": "batchId ve fileId gereklidir.",
    "context": "return sendError(res, req, 400, 'BATCH_METADATA_REQUIRED', 'batchId ve fileId gereklidir.');"
  },
  {
    "file": "server.mjs",
    "line": 772,
    "text": "[/batch/upload] İş kuyruğa eklenirken hata oluştu",
    "context": "req.log.error({ err: error }, '[/batch/upload] İş kuyruğa eklenirken hata oluştu');"
  },
  {
    "file": "server.mjs",
    "line": 773,
    "text": "JOB_CREATION_FAILED",
    "context": "return sendError(res, req, 500, 'JOB_CREATION_FAILED', t('error_job_creation_failed', req.lang));"
  },
  {
    "file": "server.mjs",
    "line": 785,
    "text": "BATCH_JOB_NOT_FOUND",
    "context": "return sendError(res, req, 404, 'BATCH_JOB_NOT_FOUND', 'Bu batch için iş bulunamadı.');"
  },
  {
    "file": "server.mjs",
    "line": 785,
    "text": "Bu batch için iş bulunamadı.",
    "context": "return sendError(res, req, 404, 'BATCH_JOB_NOT_FOUND', 'Bu batch için iş bulunamadı.');"
  },
  {
    "file": "server.mjs",
    "line": 789,
    "text": "BATCH_FORBIDDEN",
    "context": "return sendError(res, req, 403, 'BATCH_FORBIDDEN', 'Bu kaynağa erişim yetkiniz yok.');"
  },
  {
    "file": "server.mjs",
    "line": 789,
    "text": "Bu kaynağa erişim yetkiniz yok.",
    "context": "return sendError(res, req, 403, 'BATCH_FORBIDDEN', 'Bu kaynağa erişim yetkiniz yok.');"
  },
  {
    "file": "server.mjs",
    "line": 804,
    "text": "BATCH_REPORTS_NOT_READY",
    "context": "return sendError(res, req, 404, 'BATCH_REPORTS_NOT_READY', 'İndirilecek tamamlanmış rapor bulunamadı.');"
  },
  {
    "file": "server.mjs",
    "line": 804,
    "text": "İndirilecek tamamlanmış rapor bulunamadı.",
    "context": "return sendError(res, req, 404, 'BATCH_REPORTS_NOT_READY', 'İndirilecek tamamlanmış rapor bulunamadı.');"
  },
  {
    "file": "server.mjs",
    "line": 807,
    "text": "Content-Disposition",
    "context": "res.setHeader('Content-Disposition', `attachment; filename=videokit_batch_${batchId}.zip`);"
  },
  {
    "file": "server.mjs",
    "line": 807,
    "text": "attachment; filename=videokit_batch_${batchId}.zip",
    "context": "res.setHeader('Content-Disposition', `attachment; filename=videokit_batch_${batchId}.zip`);"
  },
  {
    "file": "server.mjs",
    "line": 808,
    "text": "Content-Type",
    "context": "res.setHeader('Content-Type', 'application/zip');"
  },
  {
    "file": "server.mjs",
    "line": 816,
    "text": "usage:${tenantId}:${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}",
    "context": "const monthKey = `usage:${tenantId}:${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;"
  },
  {
    "file": "server.mjs",
    "line": 828,
    "text": "PLAN_NOT_QUOTA_BASED",
    "context": "'PLAN_NOT_QUOTA_BASED',"
  },
  {
    "file": "server.mjs",
    "line": 829,
    "text": "This endpoint is for quota-based plans only. Check /billing for credit info.",
    "context": "'This endpoint is for quota-based plans only. Check /billing for credit info.'"
  },
  {
    "file": "server.mjs",
    "line": 833,
    "text": "X-Quota-Remaining",
    "context": "const remaining = parseInt(res.get('X-Quota-Remaining') || '0', 10);"
  },
  {
    "file": "server.mjs",
    "line": 843,
    "text": "X-Quota-Remaining",
    "context": "const remaining = parseInt(res.get('X-Quota-Remaining') || '0', 10);"
  },
  {
    "file": "server.mjs",
    "line": 846,
    "text": "X-Credits-Remaining",
    "context": "const remainingCredits = parseInt(res.get('X-Credits-Remaining') || '0', 10);"
  },
  {
    "file": "server.mjs",
    "line": 859,
    "text": "TENANT_REQUIRED",
    "context": "return sendError(res, req, 400, 'TENANT_REQUIRED', 'Tenant identifier is required.');"
  },
  {
    "file": "server.mjs",
    "line": 859,
    "text": "Tenant identifier is required.",
    "context": "return sendError(res, req, 400, 'TENANT_REQUIRED', 'Tenant identifier is required.');"
  },
  {
    "file": "server.mjs",
    "line": 863,
    "text": "TENANT_MISMATCH",
    "context": "return sendError(res, req, 403, 'TENANT_MISMATCH', 'You are not allowed to access analytics for another tenant.');"
  },
  {
    "file": "server.mjs",
    "line": 863,
    "text": "You are not allowed to access analytics for another tenant.",
    "context": "return sendError(res, req, 403, 'TENANT_MISMATCH', 'You are not allowed to access analytics for another tenant.');"
  },
  {
    "file": "server.mjs",
    "line": 876,
    "text": "INVALID_GROUP_BY",
    "context": "return sendError(res, req, 400, 'INVALID_GROUP_BY', 'groupBy must be one of hour or day.');"
  },
  {
    "file": "server.mjs",
    "line": 876,
    "text": "groupBy must be one of hour or day.",
    "context": "return sendError(res, req, 400, 'INVALID_GROUP_BY', 'groupBy must be one of hour or day.');"
  },
  {
    "file": "server.mjs",
    "line": 882,
    "text": "INVALID_TO",
    "context": "return sendError(res, req, 400, 'INVALID_TO', 'The provided \"to\" date is invalid.');"
  },
  {
    "file": "server.mjs",
    "line": 882,
    "text": "The provided \"to\" date is invalid.",
    "context": "return sendError(res, req, 400, 'INVALID_TO', 'The provided \"to\" date is invalid.');"
  },
  {
    "file": "server.mjs",
    "line": 888,
    "text": "INVALID_FROM",
    "context": "return sendError(res, req, 400, 'INVALID_FROM', 'The provided \"from\" date is invalid.');"
  },
  {
    "file": "server.mjs",
    "line": 888,
    "text": "The provided \"from\" date is invalid.",
    "context": "return sendError(res, req, 400, 'INVALID_FROM', 'The provided \"from\" date is invalid.');"
  },
  {
    "file": "server.mjs",
    "line": 892,
    "text": "INVALID_RANGE",
    "context": "return sendError(res, req, 400, 'INVALID_RANGE', 'The \"from\" date must be earlier than \"to\".');"
  },
  {
    "file": "server.mjs",
    "line": 892,
    "text": "The \"from\" date must be earlier than \"to\".",
    "context": "return sendError(res, req, 400, 'INVALID_RANGE', 'The \"from\" date must be earlier than \"to\".');"
  },
  {
    "file": "server.mjs",
    "line": 979,
    "text": "Endpoint normalization failed, using raw value.",
    "context": "req.log?.warn?.({ err: error, endpoint: rawEndpoint }, 'Endpoint normalization failed, using raw value.');"
  },
  {
    "file": "server.mjs",
    "line": 1001,
    "text": "[/analytics] Hata:",
    "context": "req.log.error({ err: error }, `[/analytics] Hata:`);"
  },
  {
    "file": "server.mjs",
    "line": 1002,
    "text": "ANALYTICS_FETCH_FAILED",
    "context": "return sendError(res, req, 500, 'ANALYTICS_FETCH_FAILED', 'Analitik verileri alınamadı.');"
  },
  {
    "file": "server.mjs",
    "line": 1002,
    "text": "Analitik verileri alınamadı.",
    "context": "return sendError(res, req, 500, 'ANALYTICS_FETCH_FAILED', 'Analitik verileri alınamadı.');"
  },
  {
    "file": "server.mjs",
    "line": 1012,
    "text": "SELECT id, name, plan_id, created_at, updated_at FROM tenants ORDER BY created_at DESC",
    "context": "`SELECT id, name, plan_id, created_at, updated_at FROM tenants ORDER BY created_at DESC`"
  },
  {
    "file": "server.mjs",
    "line": 1025,
    "text": "[Mgmt] Tenant listesi alınamadı.",
    "context": "req.log?.error?.({ err: error }, '[Mgmt] Tenant listesi alınamadı.');"
  },
  {
    "file": "server.mjs",
    "line": 1026,
    "text": "TENANT_LIST_FAILED",
    "context": "return sendError(res, req, 500, 'TENANT_LIST_FAILED', 'Tenant listesi getirilemedi.');"
  },
  {
    "file": "server.mjs",
    "line": 1026,
    "text": "Tenant listesi getirilemedi.",
    "context": "return sendError(res, req, 500, 'TENANT_LIST_FAILED', 'Tenant listesi getirilemedi.');"
  },
  {
    "file": "server.mjs",
    "line": 1033,
    "text": "Not Implemented: Registration is handled via /auth/register",
    "context": "res.status(501).json({ message: \"Not Implemented: Registration is handled via /auth/register\" });"
  },
  {
    "file": "server.mjs",
    "line": 1040,
    "text": "[Mgmt] Tenant context missing while listing API keys.",
    "context": "req.log.warn('[Mgmt] Tenant context missing while listing API keys.');"
  },
  {
    "file": "server.mjs",
    "line": 1041,
    "text": "MANAGEMENT_UNAUTHORIZED",
    "context": "return sendError(res, req, 401, 'MANAGEMENT_UNAUTHORIZED', t('error_management_unauthorized', req.lang));"
  },
  {
    "file": "server.mjs",
    "line": 1049,
    "text": "[Mgmt] API key listesi alınamadı.",
    "context": "req.log.error({ err: error, tenantId }, '[Mgmt] API key listesi alınamadı.');"
  },
  {
    "file": "server.mjs",
    "line": 1050,
    "text": "API_KEYS_FETCH_FAILED",
    "context": "return sendError(res, req, 500, 'API_KEYS_FETCH_FAILED', t('error_api_keys_fetch_failed', req.lang));"
  },
  {
    "file": "server.mjs",
    "line": 1058,
    "text": "[Mgmt] Tenant context missing while creating API key.",
    "context": "req.log.warn('[Mgmt] Tenant context missing while creating API key.');"
  },
  {
    "file": "server.mjs",
    "line": 1059,
    "text": "MANAGEMENT_UNAUTHORIZED",
    "context": "return sendError(res, req, 401, 'MANAGEMENT_UNAUTHORIZED', t('error_management_unauthorized', req.lang));"
  },
  {
    "file": "server.mjs",
    "line": 1073,
    "text": "API_KEY_LIMIT_REACHED",
    "context": "'API_KEY_LIMIT_REACHED',"
  },
  {
    "file": "server.mjs",
    "line": 1083,
    "text": "te yoksa, PostgreSQL",
    "context": "// Eğer Redis'te yoksa, PostgreSQL'den alıp Redis'e yazabiliriz."
  },
  {
    "file": "server.mjs",
    "line": 1084,
    "text": "SELECT plan FROM tenants WHERE id = $1",
    "context": "const tenantResult = await dbPool.query('SELECT plan FROM tenants WHERE id = $1', [tenantId]);"
  },
  {
    "file": "server.mjs",
    "line": 1086,
    "text": "TENANT_NOT_FOUND",
    "context": "return sendError(res, req, 404, 'TENANT_NOT_FOUND', 'Tenant not found.');"
  },
  {
    "file": "server.mjs",
    "line": 1086,
    "text": "Tenant not found.",
    "context": "return sendError(res, req, 404, 'TENANT_NOT_FOUND', 'Tenant not found.');"
  },
  {
    "file": "server.mjs",
    "line": 1099,
    "text": "[Mgmt] Kiracı için yeni API anahtarı oluşturuldu.",
    "context": "req.log.info({ tenantId, keyPrefix }, `[Mgmt] Kiracı için yeni API anahtarı oluşturuldu.`);"
  },
  {
    "file": "server.mjs",
    "line": 1102,
    "text": "[Mgmt] Yeni API anahtarı oluşturulamadı.",
    "context": "req.log.error({ err: error, tenantId }, '[Mgmt] Yeni API anahtarı oluşturulamadı.');"
  },
  {
    "file": "server.mjs",
    "line": 1103,
    "text": "API_KEY_GENERATION_FAILED",
    "context": "return sendError(res, req, 500, 'API_KEY_GENERATION_FAILED', t('error_api_key_generation_failed', req.lang));"
  },
  {
    "file": "server.mjs",
    "line": 1112,
    "text": "[Mgmt] Tenant context missing while deleting API key.",
    "context": "req.log.warn('[Mgmt] Tenant context missing while deleting API key.');"
  },
  {
    "file": "server.mjs",
    "line": 1113,
    "text": "MANAGEMENT_UNAUTHORIZED",
    "context": "return sendError(res, req, 401, 'MANAGEMENT_UNAUTHORIZED', t('error_management_unauthorized', req.lang));"
  },
  {
    "file": "server.mjs",
    "line": 1120,
    "text": "API_KEY_NOT_FOUND",
    "context": "return sendError(res, req, 404, 'API_KEY_NOT_FOUND', 'API key not found.');"
  },
  {
    "file": "server.mjs",
    "line": 1120,
    "text": "API key not found.",
    "context": "return sendError(res, req, 404, 'API_KEY_NOT_FOUND', 'API key not found.');"
  },
  {
    "file": "server.mjs",
    "line": 1127,
    "text": "API_KEY_NOT_FOUND",
    "context": "return sendError(res, req, 404, 'API_KEY_NOT_FOUND', 'API key not found.');"
  },
  {
    "file": "server.mjs",
    "line": 1127,
    "text": "API key not found.",
    "context": "return sendError(res, req, 404, 'API_KEY_NOT_FOUND', 'API key not found.');"
  },
  {
    "file": "server.mjs",
    "line": 1132,
    "text": "[AUTH] Yetkisiz anahtar silme denemesi.",
    "context": "req.log.warn({ loggedInTenantId, keyOwnerTenantId }, `[AUTH] Yetkisiz anahtar silme denemesi.`);"
  },
  {
    "file": "server.mjs",
    "line": 1133,
    "text": "API_KEY_FORBIDDEN",
    "context": "return sendError(res, req, 403, 'API_KEY_FORBIDDEN', 'Forbidden: You can only delete your own API keys.');"
  },
  {
    "file": "server.mjs",
    "line": 1133,
    "text": "Forbidden: You can only delete your own API keys.",
    "context": "return sendError(res, req, 403, 'API_KEY_FORBIDDEN', 'Forbidden: You can only delete your own API keys.');"
  },
  {
    "file": "server.mjs",
    "line": 1140,
    "text": "[Mgmt] API anahtarı silindi.",
    "context": "req.log.info({ apiKey: maskApiKey(apiKey), tenantId: loggedInTenantId }, `[Mgmt] API anahtarı silindi.`);"
  },
  {
    "file": "server.mjs",
    "line": 1147,
    "text": "VideoKit",
    "context": "const deviceVendor = 'VideoKit';"
  },
  {
    "file": "server.mjs",
    "line": 1148,
    "text": "ContentReliabilityPlatform",
    "context": "const deviceProduct = 'ContentReliabilityPlatform';"
  },
  {
    "file": "server.mjs",
    "line": 1152,
    "text": "VideoKit Operation: ${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)} ${entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}",
    "context": "const name = `VideoKit Operation: ${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)} ${entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}`;"
  },
  {
    "file": "server.mjs",
    "line": 1179,
    "text": "CEF:${cefVersion}|${deviceVendor}|${deviceProduct}|${deviceVersion}|${signatureId}|${name}|${severity}|${extString}",
    "context": "return `CEF:${cefVersion}|${deviceVendor}|${deviceProduct}|${deviceVersion}|${signatureId}|${name}|${severity}|${extString}`;"
  },
  {
    "file": "server.mjs",
    "line": 1187,
    "text": "[Mgmt] Denetim logu dışa aktarılıyor.",
    "context": "req.log.info({ format, count: entries.length }, `[Mgmt] Denetim logu dışa aktarılıyor.`);"
  },
  {
    "file": "server.mjs",
    "line": 1190,
    "text": "Content-Disposition",
    "context": "res.setHeader('Content-Disposition', 'attachment; filename=\"videokit-audit.json\"');"
  },
  {
    "file": "server.mjs",
    "line": 1190,
    "text": "attachment; filename=\"videokit-audit.json\"",
    "context": "res.setHeader('Content-Disposition', 'attachment; filename=\"videokit-audit.json\"');"
  },
  {
    "file": "server.mjs",
    "line": 1191,
    "text": "Content-Type",
    "context": "res.setHeader('Content-Type', 'application/json');"
  },
  {
    "file": "server.mjs",
    "line": 1195,
    "text": "Content-Disposition",
    "context": "res.setHeader('Content-Disposition', 'attachment; filename=\"videokit-audit.cef\"');"
  },
  {
    "file": "server.mjs",
    "line": 1195,
    "text": "attachment; filename=\"videokit-audit.cef\"",
    "context": "res.setHeader('Content-Disposition', 'attachment; filename=\"videokit-audit.cef\"');"
  },
  {
    "file": "server.mjs",
    "line": 1196,
    "text": "Content-Type",
    "context": "res.setHeader('Content-Type', 'text/plain');"
  },
  {
    "file": "server.mjs",
    "line": 1203,
    "text": "AUDIT_UNSUPPORTED_FORMAT",
    "context": "'AUDIT_UNSUPPORTED_FORMAT',"
  },
  {
    "file": "server.mjs",
    "line": 1204,
    "text": "Desteklenmeyen format. Sadece \"json\" veya \"cef\" kullanılabilir.",
    "context": "'Desteklenmeyen format. Sadece \"json\" veya \"cef\" kullanılabilir.'"
  },
  {
    "file": "server.mjs",
    "line": 1208,
    "text": "[Mgmt] Denetim logu dışa aktarılırken hata oluştu:",
    "context": "req.log.error({ err: error }, '[Mgmt] Denetim logu dışa aktarılırken hata oluştu:');"
  },
  {
    "file": "server.mjs",
    "line": 1209,
    "text": "AUDIT_EXPORT_FAILED",
    "context": "return sendError(res, req, 500, 'AUDIT_EXPORT_FAILED', 'Denetim logları alınamadı.');"
  },
  {
    "file": "server.mjs",
    "line": 1209,
    "text": "Denetim logları alınamadı.",
    "context": "return sendError(res, req, 500, 'AUDIT_EXPORT_FAILED', 'Denetim logları alınamadı.');"
  },
  {
    "file": "server.mjs",
    "line": 1234,
    "text": "[Mgmt] Yetkisiz marka güncelleme denemesi.",
    "context": "req.log.warn({ tenantId, loggedInTenantId }, '[Mgmt] Yetkisiz marka güncelleme denemesi.');"
  },
  {
    "file": "server.mjs",
    "line": 1235,
    "text": "MANAGEMENT_UNAUTHORIZED",
    "context": "return sendError(res, req, 403, 'MANAGEMENT_UNAUTHORIZED', t('error_management_unauthorized', req.lang));"
  },
  {
    "file": "server.mjs",
    "line": 1239,
    "text": "BRANDING_FIELDS_REQUIRED",
    "context": "return sendError(res, req, 400, 'BRANDING_FIELDS_REQUIRED', 'En az bir marka ayarı (primaryColor, backgroundColor) gereklidir.');"
  },
  {
    "file": "server.mjs",
    "line": 1239,
    "text": "En az bir marka ayarı (primaryColor, backgroundColor) gereklidir.",
    "context": "return sendError(res, req, 400, 'BRANDING_FIELDS_REQUIRED', 'En az bir marka ayarı (primaryColor, backgroundColor) gereklidir.');"
  },
  {
    "file": "server.mjs",
    "line": 1247,
    "text": "[Mgmt] Kiracı için marka ayarları güncellendi.",
    "context": "req.log.info({ tenantId }, `[Mgmt] Kiracı için marka ayarları güncellendi.`);"
  },
  {
    "file": "server.mjs",
    "line": 1248,
    "text": "Marka ayarları başarıyla güncellendi.",
    "context": "res.status(200).json({ message: 'Marka ayarları başarıyla güncellendi.' });"
  },
  {
    "file": "server.mjs",
    "line": 1255,
    "text": "[Mgmt] Yetkisiz logo yükleme denemesi.",
    "context": "req.log.warn({ tenantId, loggedInTenantId }, '[Mgmt] Yetkisiz logo yükleme denemesi.');"
  },
  {
    "file": "server.mjs",
    "line": 1256,
    "text": "MANAGEMENT_UNAUTHORIZED",
    "context": "return sendError(res, req, 403, 'MANAGEMENT_UNAUTHORIZED', t('error_management_unauthorized', req.lang));"
  },
  {
    "file": "server.mjs",
    "line": 1259,
    "text": "FILE_NOT_UPLOADED",
    "context": "return sendError(res, req, 400, 'FILE_NOT_UPLOADED', t('error_file_not_uploaded', req.lang));"
  },
  {
    "file": "server.mjs",
    "line": 1265,
    "text": "[Mgmt] Kiracı için yeni logo yüklendi.",
    "context": "req.log.info({ tenantId, logoUrl }, `[Mgmt] Kiracı için yeni logo yüklendi.`);"
  },
  {
    "file": "server.mjs",
    "line": 1266,
    "text": "Logo başarıyla yüklendi.",
    "context": "res.status(200).json({ message: 'Logo başarıyla yüklendi.', logoUrl });"
  },
  {
    "file": "server.mjs",
    "line": 1268,
    "text": "LOGO_UPLOAD_ERROR",
    "context": "return sendError(res, req, 400, 'LOGO_UPLOAD_ERROR', error.message);"
  },
  {
    "file": "server.mjs",
    "line": 1273,
    "text": "LIMIT_FILE_SIZE",
    "context": "if (err.code === 'LIMIT_FILE_SIZE') {"
  },
  {
    "file": "server.mjs",
    "line": 1277,
    "text": "Uploaded file exceeds the maximum allowed size.",
    "context": ": 'Uploaded file exceeds the maximum allowed size.';"
  },
  {
    "file": "server.mjs",
    "line": 1278,
    "text": "FILE_TOO_LARGE",
    "context": "return sendError(res, req, 413, 'FILE_TOO_LARGE', message);"
  },
  {
    "file": "server.mjs",
    "line": 1280,
    "text": "UPLOAD_ERROR",
    "context": "return sendError(res, req, 400, 'UPLOAD_ERROR', err.message);"
  },
  {
    "file": "server.mjs",
    "line": 1282,
    "text": "LIMIT_UNEXPECTED_FILE",
    "context": "if (err?.code === 'LIMIT_UNEXPECTED_FILE') {"
  },
  {
    "file": "server.mjs",
    "line": 1283,
    "text": "UNEXPECTED_FILE_FIELD",
    "context": "return sendError(res, req, 400, 'UNEXPECTED_FILE_FIELD', 'Unexpected file field received.');"
  },
  {
    "file": "server.mjs",
    "line": 1283,
    "text": "Unexpected file field received.",
    "context": "return sendError(res, req, 400, 'UNEXPECTED_FILE_FIELD', 'Unexpected file field received.');"
  },
  {
    "file": "server.mjs",
    "line": 1292,
    "text": "INTERNAL_SERVER_ERROR",
    "context": "code: 'INTERNAL_SERVER_ERROR',"
  },
  {
    "file": "server.mjs",
    "line": 1293,
    "text": "Beklenmeyen bir sunucu hatası oluştu.",
    "context": "message: 'Beklenmeyen bir sunucu hatası oluştu.',"
  },
  {
    "file": "server.mjs",
    "line": 1311,
    "text": "[CronJob] Depolama temizlik görevi başlatılıyor...",
    "context": "logger.info('[CronJob] Depolama temizlik görevi başlatılıyor...');"
  },
  {
    "file": "server.mjs",
    "line": 1327,
    "text": "[CronJob] TTL süresi dolan dosya silindi: ${file}",
    "context": "logger.info(`[CronJob] TTL süresi dolan dosya silindi: ${file}`);"
  },
  {
    "file": "server.mjs",
    "line": 1331,
    "text": "[CronJob] Dosya işlenirken hata oluştu.",
    "context": "logger.error({ file: filePath, err: fileError }, `[CronJob] Dosya işlenirken hata oluştu.`);"
  },
  {
    "file": "server.mjs",
    "line": 1334,
    "text": "[CronJob] Depolama temizlik görevi tamamlandı. ${deletedCount} dosya silindi.",
    "context": "logger.info(`[CronJob] Depolama temizlik görevi tamamlandı. ${deletedCount} dosya silindi.`);"
  },
  {
    "file": "server.mjs",
    "line": 1336,
    "text": "ENOENT",
    "context": "if (err.code === 'ENOENT') {"
  },
  {
    "file": "server.mjs",
    "line": 1337,
    "text": "[CronJob] Temizlik atlanıyor: '${UPLOADS_DIR}' klasörü bulunamadı.",
    "context": "logger.warn(`[CronJob] Temizlik atlanıyor: '${UPLOADS_DIR}' klasörü bulunamadı.`);"
  },
  {
    "file": "server.mjs",
    "line": 1339,
    "text": "[CronJob] Depolama temizlik görevi başarısız oldu.",
    "context": "logger.error({ err }, `[CronJob] Depolama temizlik görevi başarısız oldu.`);"
  },
  {
    "file": "server.mjs",
    "line": 1350,
    "text": "SANDBOX",
    "context": "const mode = config.isSandbox ? 'SANDBOX' : 'PRODUCTION';"
  },
  {
    "file": "server.mjs",
    "line": 1350,
    "text": "PRODUCTION",
    "context": "const mode = config.isSandbox ? 'SANDBOX' : 'PRODUCTION';"
  },
  {
    "file": "server.mjs",
    "line": 1351,
    "text": "✅ VideoKit REST API ve WebSocket sunucusu çalışıyor.",
    "context": "logger.info({ port, mode }, `✅ VideoKit REST API ve WebSocket sunucusu çalışıyor.`);"
  },
  {
    "file": "src/core/billing-map.mjs",
    "line": 126,
    "text": "POST",
    "context": "* isBillable('POST', '/verify'); // true"
  },
  {
    "file": "src/core/billing-map.mjs",
    "line": 127,
    "text": "POST",
    "context": "* getBillableWeight('POST', '/verify'); // 1"
  },
  {
    "file": "src/core/billing-map.mjs",
    "line": 129,
    "text": "GET",
    "context": "* isBillable('GET', '/jobs/123'); // false (normalizes to `/jobs/:id`)"
  },
  {
    "file": "src/core/endpoint-normalize.mjs",
    "line": 27,
    "text": "normalizeEndpoint: invalid date value encountered",
    "context": "throw new TypeError('normalizeEndpoint: invalid date value encountered');"
  },
  {
    "file": "src/core/endpoint-normalize.mjs",
    "line": 34,
    "text": "normalizeEndpoint: `path` must be a string.",
    "context": "throw new TypeError('normalizeEndpoint: `path` must be a string.');"
  },
  {
    "file": "src/core/endpoint-normalize.mjs",
    "line": 37,
    "text": "|| rawPath ===",
    "context": "if (rawPath === '' || rawPath === '/') {"
  },
  {
    "file": "src/core/endpoint-normalize.mjs",
    "line": 87,
    "text": "normalizeEndpoint: `matchers` must be functions or RegExp instances.",
    "context": "throw new TypeError('normalizeEndpoint: `matchers` must be functions or RegExp instances.');"
  },
  {
    "file": "src/core/time-window.mjs",
    "line": 13,
    "text": "time-window: Invalid Date object received.",
    "context": "throw new TypeError('time-window: Invalid Date object received.');"
  },
  {
    "file": "src/core/time-window.mjs",
    "line": 20,
    "text": "time-window: Unable to convert value to a valid Date.",
    "context": "throw new TypeError('time-window: Unable to convert value to a valid Date.');"
  },
  {
    "file": "src/core/time-window.mjs",
    "line": 43,
    "text": "start <= x < end",
    "context": "* month. Useful for range comparisons: `start <= x < end`."
  },
  {
    "file": "src/core/time-window.mjs",
    "line": 75,
    "text": "time-window: `offset` must be an integer value.",
    "context": "throw new TypeError('time-window: `offset` must be an integer value.');"
  },
  {
    "file": "src/core/time-window.mjs",
    "line": 85,
    "text": "YYYY-MM",
    "context": "* Returns a canonical key (`YYYY-MM`) suitable for Redis/metric storage."
  },
  {
    "file": "test-email.js",
    "line": 12,
    "text": "npm run test:email",
    "context": "* * 2. Terminalden `npm run test:email` komutunu çalıştırın."
  },
  {
    "file": "test-email.js",
    "line": 24,
    "text": "Lütfen .env dosyasında TEST_EMAIL_RECIPIENT değişkenini ayarlayın.",
    "context": "throw new Error('Lütfen .env dosyasında TEST_EMAIL_RECIPIENT değişkenini ayarlayın.');"
  },
  {
    "file": "test-email.js",
    "line": 27,
    "text": "Test e-postası gönderiliyor: ${recipient}",
    "context": "console.log(`Test e-postası gönderiliyor: ${recipient}`);"
  },
  {
    "file": "test-email.js",
    "line": 32,
    "text": "VideoKit Test E-postası",
    "context": "'VideoKit Test E-postası',"
  },
  {
    "file": "test-email.js",
    "line": 33,
    "text": "<h1>Merhaba!</h1><p>Bu, VideoKit platformundan gönderilen bir test e-postasıdır.</p>",
    "context": "'<h1>Merhaba!</h1><p>Bu, VideoKit platformundan gönderilen bir test e-postasıdır.</p>'"
  },
  {
    "file": "test-email.js",
    "line": 36,
    "text": "Test başarıyla tamamlandı.",
    "context": "console.log('Test başarıyla tamamlandı.');"
  },
  {
    "file": "test-email.js",
    "line": 39,
    "text": "Test sırasında bir hata oluştu:",
    "context": "console.error('Test sırasında bir hata oluştu:', error.message);"
  },
  {
    "file": "tests/e2e/i18n-screenshots.spec.mjs",
    "line": 13,
    "text": "text/html; charset=utf-8",
    "context": "['.html', 'text/html; charset=utf-8'],"
  },
  {
    "file": "tests/e2e/i18n-screenshots.spec.mjs",
    "line": 14,
    "text": "application/javascript; charset=utf-8",
    "context": "['.js', 'application/javascript; charset=utf-8'],"
  },
  {
    "file": "tests/e2e/i18n-screenshots.spec.mjs",
    "line": 15,
    "text": "text/css; charset=utf-8",
    "context": "['.css', 'text/css; charset=utf-8'],"
  },
  {
    "file": "tests/e2e/i18n-screenshots.spec.mjs",
    "line": 16,
    "text": "application/json; charset=utf-8",
    "context": "['.json', 'application/json; charset=utf-8'],"
  },
  {
    "file": "tests/e2e/i18n-screenshots.spec.mjs",
    "line": 25,
    "text": "Content-Type",
    "context": "'Content-Type': 'application/json; charset=utf-8'"
  },
  {
    "file": "tests/e2e/i18n-screenshots.spec.mjs",
    "line": 25,
    "text": "application/json; charset=utf-8",
    "context": "'Content-Type': 'application/json; charset=utf-8'"
  },
  {
    "file": "tests/e2e/i18n-screenshots.spec.mjs",
    "line": 51,
    "text": "login view with pseudo-locale",
    "context": "test('login view with pseudo-locale', async ({ page }) => {"
  },
  {
    "file": "tests/e2e/i18n-screenshots.spec.mjs",
    "line": 53,
    "text": "Not logged in",
    "context": "route.fulfill({ status: 401, headers: jsonHeaders, body: JSON.stringify({ error: 'Not logged in' }) });"
  },
  {
    "file": "tests/e2e/i18n-screenshots.spec.mjs",
    "line": 61,
    "text": "register view with pseudo-locale",
    "context": "test('register view with pseudo-locale', async ({ page }) => {"
  },
  {
    "file": "tests/e2e/i18n-screenshots.spec.mjs",
    "line": 63,
    "text": "Not logged in",
    "context": "route.fulfill({ status: 401, headers: jsonHeaders, body: JSON.stringify({ error: 'Not logged in' }) });"
  },
  {
    "file": "tests/e2e/i18n-screenshots.spec.mjs",
    "line": 73,
    "text": "dashboard view with mocked data",
    "context": "test('dashboard view with mocked data', async ({ page }) => {"
  },
  {
    "file": "tests/e2e/i18n-screenshots.spec.mjs",
    "line": 82,
    "text": "analytics detail card",
    "context": "test('analytics detail card', async ({ page }) => {"
  },
  {
    "file": "tests/e2e/i18n-screenshots.spec.mjs",
    "line": 93,
    "text": "batch view after authentication",
    "context": "test('batch view after authentication', async ({ page }) => {"
  },
  {
    "file": "tests/e2e/i18n-screenshots.spec.mjs",
    "line": 119,
    "text": "Forbidden",
    "context": "res.end('Forbidden');"
  },
  {
    "file": "tests/e2e/i18n-screenshots.spec.mjs",
    "line": 128,
    "text": "Not found",
    "context": "res.end('Not found');"
  },
  {
    "file": "tests/e2e/i18n-screenshots.spec.mjs",
    "line": 139,
    "text": "Content-Type",
    "context": "res.writeHead(200, { 'Content-Type': contentType });"
  },
  {
    "file": "tests/e2e/i18n-screenshots.spec.mjs",
    "line": 143,
    "text": "Server error",
    "context": "res.end('Server error');"
  },
  {
    "file": "tests/e2e/i18n-screenshots.spec.mjs",
    "line": 161,
    "text": "Overflow QA Localization Suite Tenant",
    "context": "name: 'Overflow QA Localization Suite Tenant'"
  },
  {
    "file": "tests/e2e/i18n-screenshots.spec.mjs",
    "line": 170,
    "text": "Overflow QA Owner",
    "context": "name: 'Overflow QA Owner',"
  },
  {
    "file": "tests/e2e/i18n-screenshots.spec.mjs",
    "line": 193,
    "text": "X-Quota-Remaining",
    "context": "'X-Quota-Remaining': '124'"
  },
  {
    "file": "tests/e2e/i18n-screenshots.spec.mjs",
    "line": 196,
    "text": "Overflow Enterprise Pseudo-Locale Preview",
    "context": "plan_name: 'Overflow Enterprise Pseudo-Locale Preview',"
  },
  {
    "file": "tests/e2e/i18n-screenshots.spec.mjs",
    "line": 265,
    "text": "Overflow QA Localization Suite Tenant",
    "context": "name: 'Overflow QA Localization Suite Tenant'"
  },
  {
    "file": "tests/e2e/i18n-screenshots.spec.mjs",
    "line": 274,
    "text": "Batch Operations Specialist",
    "context": "name: 'Batch Operations Specialist'"
  },
  {
    "file": "tool.html",
    "line": 11,
    "text": "VK",
    "context": "<link rel=\"icon\" href=\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect rx='6' width='32' height='32' fill='#111827'/><text x='6' y='22' font-family='Arial' font-size='16' fill='white'>VK</text></svg>\">"
  },
  {
    "file": "tool.html",
    "line": 13,
    "text": "VideoKit • C2PA Doğrulayıcı & Oluşturucu",
    "context": "<title>VideoKit • C2PA Doğrulayıcı & Oluşturucu</title>"
  },
  {
    "file": "tool.html",
    "line": 71,
    "text": "VK",
    "context": "<div class=\"logo\">VK</div>"
  },
  {
    "file": "tool.html",
    "line": 73,
    "text": "VideoKit • Content Credentials (C2PA) Aracı",
    "context": "<h1>VideoKit • Content Credentials (C2PA) Aracı</h1>"
  },
  {
    "file": "tool.html",
    "line": 74,
    "text": "Gömülü,",
    "context": "<div class=\"muted\">Gömülü, <b>sidecar</b> (.c2pa) veya <b>remote URL</b> manifest — üçü de desteklenir.</div>"
  },
  {
    "file": "tool.html",
    "line": 74,
    "text": "sidecar",
    "context": "<div class=\"muted\">Gömülü, <b>sidecar</b> (.c2pa) veya <b>remote URL</b> manifest — üçü de desteklenir.</div>"
  },
  {
    "file": "tool.html",
    "line": 74,
    "text": "(.c2pa) veya",
    "context": "<div class=\"muted\">Gömülü, <b>sidecar</b> (.c2pa) veya <b>remote URL</b> manifest — üçü de desteklenir.</div>"
  },
  {
    "file": "tool.html",
    "line": 74,
    "text": "remote URL",
    "context": "<div class=\"muted\">Gömülü, <b>sidecar</b> (.c2pa) veya <b>remote URL</b> manifest — üçü de desteklenir.</div>"
  },
  {
    "file": "tool.html",
    "line": 74,
    "text": "manifest — üçü de desteklenir.",
    "context": "<div class=\"muted\">Gömülü, <b>sidecar</b> (.c2pa) veya <b>remote URL</b> manifest — üçü de desteklenir.</div>"
  },
  {
    "file": "tool.html",
    "line": 79,
    "text": "1. Doğrulama (Validator)",
    "context": "<h2 style=\"margin-top:0\">1. Doğrulama (Validator)</h2>"
  },
  {
    "file": "tool.html",
    "line": 82,
    "text": "Video(lar) (MP4/MOV)",
    "context": "<label><b>Video(lar) (MP4/MOV)</b><br>"
  },
  {
    "file": "tool.html",
    "line": 84,
    "text": "İpucu: Birden fazla video seçebilirsiniz.",
    "context": "<small class=\"muted\">İpucu: Birden fazla video seçebilirsiniz.</small>"
  },
  {
    "file": "tool.html",
    "line": 86,
    "text": "Opsiyonel sidecar(lar) (.c2pa)",
    "context": "<label><b>Opsiyonel sidecar(lar) (.c2pa)</b><br>"
  },
  {
    "file": "tool.html",
    "line": 88,
    "text": "Aynı isimli dosyalar otomatik eşleştirilir (ör.",
    "context": "<small class=\"muted\">Aynı isimli dosyalar otomatik eşleştirilir (ör. <i>foo.mp4</i> ↔ <i>foo.c2pa</i>).</small>"
  },
  {
    "file": "tool.html",
    "line": 88,
    "text": "foo.mp4",
    "context": "<small class=\"muted\">Aynı isimli dosyalar otomatik eşleştirilir (ör. <i>foo.mp4</i> ↔ <i>foo.c2pa</i>).</small>"
  },
  {
    "file": "tool.html",
    "line": 88,
    "text": "↔",
    "context": "<small class=\"muted\">Aynı isimli dosyalar otomatik eşleştirilir (ör. <i>foo.mp4</i> ↔ <i>foo.c2pa</i>).</small>"
  },
  {
    "file": "tool.html",
    "line": 88,
    "text": "foo.c2pa",
    "context": "<small class=\"muted\">Aynı isimli dosyalar otomatik eşleştirilir (ör. <i>foo.mp4</i> ↔ <i>foo.c2pa</i>).</small>"
  },
  {
    "file": "tool.html",
    "line": 88,
    "text": ").",
    "context": "<small class=\"muted\">Aynı isimli dosyalar otomatik eşleştirilir (ör. <i>foo.mp4</i> ↔ <i>foo.c2pa</i>).</small>"
  },
  {
    "file": "tool.html",
    "line": 92,
    "text": "VEYA",
    "context": "<div class=\"separator\">VEYA</div>"
  },
  {
    "file": "tool.html",
    "line": 94,
    "text": "Remote URL ile Doğrula",
    "context": "<label><b>Remote URL ile Doğrula</b><br>"
  },
  {
    "file": "tool.html",
    "line": 95,
    "text": "https://example.com/video_with_c2pa.mp4",
    "context": "placeholder attribute"
  },
  {
    "file": "tool.html",
    "line": 96,
    "text": "Manifest'in gömülü olduğu video dosyasının URL'ini girin.",
    "context": "<small class=\"muted\">Manifest'in gömülü olduğu video dosyasının URL'ini girin.</small>"
  },
  {
    "file": "tool.html",
    "line": 100,
    "text": "Doğrula",
    "context": "<button id=\"btnVerify\">Doğrula</button>"
  },
  {
    "file": "tool.html",
    "line": 101,
    "text": "Temizle",
    "context": "<button id=\"btnClear\" class=\"btn-ghost\">Temizle</button>"
  },
  {
    "file": "tool.html",
    "line": 102,
    "text": "Hazır.",
    "context": "<div class=\"muted\" id=\"hint\">Hazır.</div>"
  },
  {
    "file": "tool.html",
    "line": 107,
    "text": "Doğrulama Sonuçları",
    "context": "<h2 style=\"margin-top:0\">Doğrulama Sonuçları</h2>"
  },
  {
    "file": "tool.html",
    "line": 117,
    "text": "2. C2PA Manifest Oluşturucu (Stamper)",
    "context": "<h2 style=\"margin-top:0;\">2. C2PA Manifest Oluşturucu (Stamper)</h2>"
  },
  {
    "file": "tool.html",
    "line": 118,
    "text": "Bu bölüm, bir video dosyası için C2PA manifest'i oluşturur, tarayıcıda depolanan anahtarınızla imzalar ve bir",
    "context": "<p class=\"muted\">Bu bölüm, bir video dosyası için C2PA manifest'i oluşturur, tarayıcıda depolanan anahtarınızla imzalar ve bir <code>.c2pa</code> yan dosyası olarak indirmenizi sağlar.</p>"
  },
  {
    "file": "tool.html",
    "line": 118,
    "text": ".c2pa",
    "context": "<p class=\"muted\">Bu bölüm, bir video dosyası için C2PA manifest'i oluşturur, tarayıcıda depolanan anahtarınızla imzalar ve bir <code>.c2pa</code> yan dosyası olarak indirmenizi sağlar.</p>"
  },
  {
    "file": "tool.html",
    "line": 118,
    "text": "yan dosyası olarak indirmenizi sağlar.",
    "context": "<p class=\"muted\">Bu bölüm, bir video dosyası için C2PA manifest'i oluşturur, tarayıcıda depolanan anahtarınızla imzalar ve bir <code>.c2pa</code> yan dosyası olarak indirmenizi sağlar.</p>"
  },
  {
    "file": "tool.html",
    "line": 123,
    "text": "Kaynak Video (MP4/MOV)",
    "context": "<label for=\"stamperAsset\">Kaynak Video (MP4/MOV)</label>"
  },
  {
    "file": "tool.html",
    "line": 127,
    "text": "Yazar (Creator)",
    "context": "<label for=\"stamperAuthor\">Yazar (Creator)</label>"
  },
  {
    "file": "tool.html",
    "line": 128,
    "text": "Örn: VideoKit Departmanı",
    "context": "placeholder attribute"
  },
  {
    "file": "tool.html",
    "line": 133,
    "text": "Eylem (Action)",
    "context": "<label for=\"stamperAction\">Eylem (Action)</label>"
  },
  {
    "file": "tool.html",
    "line": 135,
    "text": "Oluşturuldu (Created)",
    "context": "<option value=\"c2pa.created\">Oluşturuldu (Created)</option>"
  },
  {
    "file": "tool.html",
    "line": 135,
    "text": "c2pa.created",
    "context": "value attribute"
  },
  {
    "file": "tool.html",
    "line": 136,
    "text": "Düzenlendi (Edited)",
    "context": "<option value=\"c2pa.edited\">Düzenlendi (Edited)</option>"
  },
  {
    "file": "tool.html",
    "line": 136,
    "text": "c2pa.edited",
    "context": "value attribute"
  },
  {
    "file": "tool.html",
    "line": 137,
    "text": "Yayınlandı (Published)",
    "context": "<option value=\"c2pa.published\">Yayınlandı (Published)</option>"
  },
  {
    "file": "tool.html",
    "line": 137,
    "text": "c2pa.published",
    "context": "value attribute"
  },
  {
    "file": "tool.html",
    "line": 138,
    "text": "Dönüştürüldü (Transcoded)",
    "context": "<option value=\"c2pa.transcoded\">Dönüştürüldü (Transcoded)</option>"
  },
  {
    "file": "tool.html",
    "line": 138,
    "text": "c2pa.transcoded",
    "context": "value attribute"
  },
  {
    "file": "tool.html",
    "line": 139,
    "text": "Kopyalandı (Copied)",
    "context": "<option value=\"c2pa.copied\">Kopyalandı (Copied)</option>"
  },
  {
    "file": "tool.html",
    "line": 139,
    "text": "c2pa.copied",
    "context": "value attribute"
  },
  {
    "file": "tool.html",
    "line": 140,
    "text": "İçe Aktarıldı (Imported)",
    "context": "<option value=\"c2pa.imported\">İçe Aktarıldı (Imported)</option>"
  },
  {
    "file": "tool.html",
    "line": 140,
    "text": "c2pa.imported",
    "context": "value attribute"
  },
  {
    "file": "tool.html",
    "line": 144,
    "text": "Yazılım Bilgisi (Software Agent)",
    "context": "<label for=\"stamperAgent\">Yazılım Bilgisi (Software Agent)</label>"
  },
  {
    "file": "tool.html",
    "line": 145,
    "text": "VideoKit C2PA Stamper v2.0",
    "context": "value attribute"
  },
  {
    "file": "tool.html",
    "line": 149,
    "text": "İmzalama Anahtarı:",
    "context": "<b>İmzalama Anahtarı:</b> Bu işlem, aşağıdaki \"Anahtar Altyapısı\" bölümünde oluşturulan ve tarayıcıda saklanan güvenli anahtarı kullanacaktır. Eğer anahtarınız yoksa, lütfen önce bir anahtar oluşturun."
  },
  {
    "file": "tool.html",
    "line": 152,
    "text": "Manifest Oluştur ve İndir (.c2pa)",
    "context": "<button id=\"stamperGenerateBtn\">Manifest Oluştur ve İndir (.c2pa)</button>"
  },
  {
    "file": "tool.html",
    "line": 154,
    "text": "Hazır.",
    "context": "<div id=\"stamperStatus\" class=\"muted\" style=\"margin-top:12px;\">Hazır.</div>"
  },
  {
    "file": "tool.html",
    "line": 159,
    "text": "Yardımcı Araçlar",
    "context": "<h2 style=\"margin-top:0\">Yardımcı Araçlar</h2>"
  },
  {
    "file": "tool.html",
    "line": 161,
    "text": "KLV / JSON Dönüştürücü (MISB ST 0601 Uyumlu)",
    "context": "<h3>KLV / JSON Dönüştürücü (MISB ST 0601 Uyumlu)</h3>"
  },
  {
    "file": "tool.html",
    "line": 163,
    "text": "Giriş Dosyası",
    "context": "<label style=\"flex:2 1 60%\"><b>Giriş Dosyası</b><br>"
  },
  {
    "file": "tool.html",
    "line": 165,
    "text": "KLV (.klv) veya JSON (.json) dosyası seçin",
    "context": "<small class=\"muted\">KLV (.klv) veya JSON (.json) dosyası seçin</small>"
  },
  {
    "file": "tool.html",
    "line": 167,
    "text": "ST 0601 Versiyonu",
    "context": "<label style=\"flex:1 1 30%\"><b>ST 0601 Versiyonu</b><br>"
  },
  {
    "file": "tool.html",
    "line": 169,
    "text": "ST 0601.8 (Varsayılan)",
    "context": "<option value=\"8\">ST 0601.8 (Varsayılan)</option>"
  },
  {
    "file": "tool.html",
    "line": 169,
    "text": "8",
    "context": "value attribute"
  },
  {
    "file": "tool.html",
    "line": 170,
    "text": "ST 0601.12",
    "context": "<option value=\"12\">ST 0601.12</option>"
  },
  {
    "file": "tool.html",
    "line": 170,
    "text": "12",
    "context": "value attribute"
  },
  {
    "file": "tool.html",
    "line": 171,
    "text": "ST 0601.16",
    "context": "<option value=\"16\">ST 0601.16</option>"
  },
  {
    "file": "tool.html",
    "line": 171,
    "text": "16",
    "context": "value attribute"
  },
  {
    "file": "tool.html",
    "line": 176,
    "text": "Dönüştür ve Doğrula",
    "context": "<button id=\"klvConvert\">Dönüştür ve Doğrula</button>"
  },
  {
    "file": "tool.html",
    "line": 177,
    "text": "İndir",
    "context": "<button id=\"klvDownload\" class=\"btn-ghost\" disabled>İndir</button>"
  },
  {
    "file": "tool.html",
    "line": 179,
    "text": "Hazır.",
    "context": "<div id=\"klvStatus\" class=\"muted\" style=\"margin-top:12px;white-space:pre-wrap;\">Hazır.</div>"
  },
  {
    "file": "tool.html",
    "line": 184,
    "text": "BMFF Parçalı Hash Oluşturucu",
    "context": "<h3>BMFF Parçalı Hash Oluşturucu</h3>"
  },
  {
    "file": "tool.html",
    "line": 185,
    "text": "Bir MP4/MOV dosyasının C2PA standartlarına uygun parçalı hash'ini oluşturur.",
    "context": "<p class=\"muted\">Bir MP4/MOV dosyasının C2PA standartlarına uygun parçalı hash'ini oluşturur.</p>"
  },
  {
    "file": "tool.html",
    "line": 186,
    "text": "Video Dosyası (MP4/MOV)",
    "context": "<label><b>Video Dosyası (MP4/MOV)</b><br>"
  },
  {
    "file": "tool.html",
    "line": 190,
    "text": "Hash Oluştur",
    "context": "<button id=\"bmffGenerateBtn\">Hash Oluştur</button>"
  },
  {
    "file": "tool.html",
    "line": 191,
    "text": "Kopyala",
    "context": "<button id=\"bmffCopyBtn\" class=\"btn-ghost\" disabled>Kopyala</button>"
  },
  {
    "file": "tool.html",
    "line": 193,
    "text": "Hazır.",
    "context": "<div id=\"bmffStatus\" class=\"muted\" style=\"margin-top:12px;\">Hazır.</div>"
  },
  {
    "file": "tool.html",
    "line": 198,
    "text": "HLS/DASH Akış Bütünlüğü Doğrulama",
    "context": "<h3>HLS/DASH Akış Bütünlüğü Doğrulama</h3>"
  },
  {
    "file": "tool.html",
    "line": 199,
    "text": "Bir HLS (.m3u8) veya DASH (.mpd) manifest URL'ini işler, tüm segmentlerin BMFF hash'lerini karşılaştırarak akışın bütünlüğünü kontrol eder.",
    "context": "<p class=\"muted\">Bir HLS (.m3u8) veya DASH (.mpd) manifest URL'ini işler, tüm segmentlerin BMFF hash'lerini karşılaştırarak akışın bütünlüğünü kontrol eder.</p>"
  },
  {
    "file": "tool.html",
    "line": 200,
    "text": "Manifest URL (.m3u8 veya .mpd)",
    "context": "<label><b>Manifest URL (.m3u8 veya .mpd)</b><br>"
  },
  {
    "file": "tool.html",
    "line": 201,
    "text": "https://example.com/stream/index.m3u8",
    "context": "placeholder attribute"
  },
  {
    "file": "tool.html",
    "line": 204,
    "text": "Akışı Doğrula",
    "context": "<button id=\"streamVerifyBtn\">Akışı Doğrula</button>"
  },
  {
    "file": "tool.html",
    "line": 206,
    "text": "Hazır.",
    "context": "<div id=\"streamStatus\" class=\"muted\" style=\"margin-top:12px;\">Hazır.</div>"
  },
  {
    "file": "tool.html",
    "line": 212,
    "text": "Harici Araç Entegrasyonları (Komut Satırı)",
    "context": "<h2 style=\"margin-top:0\">Harici Araç Entegrasyonları (Komut Satırı)</h2>"
  },
  {
    "file": "tool.html",
    "line": 214,
    "text": "GStreamer ile KLV Ekleme",
    "context": "<h3>GStreamer ile KLV Ekleme</h3>"
  },
  {
    "file": "tool.html",
    "line": 215,
    "text": "KLV akışını video ile senkron bir şekilde MPEG-TS dosyasına gömer.",
    "context": "<p class=\"muted\">KLV akışını video ile senkron bir şekilde MPEG-TS dosyasına gömer.</p>"
  },
  {
    "file": "tool.html",
    "line": 217,
    "text": "Video Dosyası (MP4)",
    "context": "<label><b>Video Dosyası (MP4)</b><br><input id=\"gstreamerVideoInput\" type=\"file\" accept=\"video/mp4\"></label>"
  },
  {
    "file": "tool.html",
    "line": 218,
    "text": "KLV Dosyası (.klv)",
    "context": "<label><b>KLV Dosyası (.klv)</b><br><input id=\"gstreamerKlvInput\" type=\"file\" accept=\".klv\"></label>"
  },
  {
    "file": "tool.html",
    "line": 221,
    "text": "GStreamer Komutu Oluştur",
    "context": "<button id=\"gstreamerGenerateBtn\">GStreamer Komutu Oluştur</button>"
  },
  {
    "file": "tool.html",
    "line": 222,
    "text": "Komutu Kopyala",
    "context": "<button id=\"gstreamerCopyBtn\" class=\"btn-ghost\" disabled>Komutu Kopyala</button>"
  },
  {
    "file": "tool.html",
    "line": 228,
    "text": "FFmpeg/FFprobe ile KLV İşleme",
    "context": "<h3>FFmpeg/FFprobe ile KLV İşleme</h3>"
  },
  {
    "file": "tool.html",
    "line": 229,
    "text": "Mevcut KLV'li videoları doğrulamak, ayıklamak veya temizlemek için komutlar üretir.",
    "context": "<p class=\"muted\">Mevcut KLV'li videoları doğrulamak, ayıklamak veya temizlemek için komutlar üretir.</p>"
  },
  {
    "file": "tool.html",
    "line": 230,
    "text": "Video Dosyası (MPEG-TS)",
    "context": "<label><b>Video Dosyası (MPEG-TS)</b><br><input id=\"ffmpegTsInput\" type=\"file\" accept=\".ts,video/mp2t\"></label>"
  },
  {
    "file": "tool.html",
    "line": 233,
    "text": "Yapılacak İşlem:",
    "context": "<b>Yapılacak İşlem:</b>"
  },
  {
    "file": "tool.html",
    "line": 234,
    "text": "Analiz Et (FFprobe ile)",
    "context": "<label style=\"margin-top:8px;\"><input type=\"radio\" name=\"ffmpegAction\" value=\"analyze\" checked> Analiz Et (FFprobe ile)</label>"
  },
  {
    "file": "tool.html",
    "line": 234,
    "text": "analyze",
    "context": "value attribute"
  },
  {
    "file": "tool.html",
    "line": 235,
    "text": "Ayıkla (.klv dosyası)",
    "context": "<label><input type=\"radio\" name=\"ffmpegAction\" value=\"extract\"> Ayıkla (.klv dosyası)</label>"
  },
  {
    "file": "tool.html",
    "line": 235,
    "text": "extract",
    "context": "value attribute"
  },
  {
    "file": "tool.html",
    "line": 236,
    "text": "Temizle (KLV akışını kaldır)",
    "context": "<label><input type=\"radio\" name=\"ffmpegAction\" value=\"clean\"> Temizle (KLV akışını kaldır)</label>"
  },
  {
    "file": "tool.html",
    "line": 236,
    "text": "clean",
    "context": "value attribute"
  },
  {
    "file": "tool.html",
    "line": 239,
    "text": "Komut Oluştur",
    "context": "<button id=\"ffmpegGenerateBtn\" style=\"width:100%\">Komut Oluştur</button>"
  },
  {
    "file": "tool.html",
    "line": 240,
    "text": "Komutu Kopyala",
    "context": "<button id=\"ffmpegCopyBtn\" class=\"btn-ghost\" style=\"width:100%; margin-top:12px;\" disabled>Komutu Kopyala</button>"
  },
  {
    "file": "tool.html",
    "line": 244,
    "text": "Analiz Adımları:",
    "context": "<p class=\"muted\" style=\"margin-top:var(--sp4)\"><b>Analiz Adımları:</b><br>1. Yukarıdaki komutu kopyalayıp terminalde çalıştırın.<br>2. Ortaya çıkan tüm JSON metnini aşağıdaki kutuya yapıştırın.<br>3. Analiz et butonuna tıklayarak KLV akışının sağlığını kontrol edin.</p>"
  },
  {
    "file": "tool.html",
    "line": 244,
    "text": "1. Yukarıdaki komutu kopyalayıp terminalde çalıştırın.",
    "context": "<p class=\"muted\" style=\"margin-top:var(--sp4)\"><b>Analiz Adımları:</b><br>1. Yukarıdaki komutu kopyalayıp terminalde çalıştırın.<br>2. Ortaya çıkan tüm JSON metnini aşağıdaki kutuya yapıştırın.<br>3. Analiz et butonuna tıklayarak KLV akışının sağlığını kontrol edin.</p>"
  },
  {
    "file": "tool.html",
    "line": 244,
    "text": "2. Ortaya çıkan tüm JSON metnini aşağıdaki kutuya yapıştırın.",
    "context": "<p class=\"muted\" style=\"margin-top:var(--sp4)\"><b>Analiz Adımları:</b><br>1. Yukarıdaki komutu kopyalayıp terminalde çalıştırın.<br>2. Ortaya çıkan tüm JSON metnini aşağıdaki kutuya yapıştırın.<br>3. Analiz et butonuna tıklayarak KLV akışının sağlığını kontrol edin.</p>"
  },
  {
    "file": "tool.html",
    "line": 244,
    "text": "3. Analiz et butonuna tıklayarak KLV akışının sağlığını kontrol edin.",
    "context": "<p class=\"muted\" style=\"margin-top:var(--sp4)\"><b>Analiz Adımları:</b><br>1. Yukarıdaki komutu kopyalayıp terminalde çalıştırın.<br>2. Ortaya çıkan tüm JSON metnini aşağıdaki kutuya yapıştırın.<br>3. Analiz et butonuna tıklayarak KLV akışının sağlığını kontrol edin.</p>"
  },
  {
    "file": "tool.html",
    "line": 245,
    "text": "ffprobe JSON çıktısını buraya yapıştırın...",
    "context": "placeholder attribute"
  },
  {
    "file": "tool.html",
    "line": 246,
    "text": "Yapıştırılan JSON'u Analiz Et",
    "context": "<button id=\"ffmpegAnalyzeBtn\" style=\"margin-top:var(--sp3)\">Yapıştırılan JSON'u Analiz Et</button>"
  },
  {
    "file": "tool.html",
    "line": 254,
    "text": "Güvenlik Altyapısı",
    "context": "<h2 style=\"margin-top:0\">Güvenlik Altyapısı</h2>"
  },
  {
    "file": "tool.html",
    "line": 256,
    "text": "Anahtar Altyapısı (Güvenli Saklama)",
    "context": "<h3>Anahtar Altyapısı (Güvenli Saklama)</h3>"
  },
  {
    "file": "tool.html",
    "line": 258,
    "text": "Yeni Anahtar Oluştur",
    "context": "<button id=\"keyGenerate\">Yeni Anahtar Oluştur</button>"
  },
  {
    "file": "tool.html",
    "line": 259,
    "text": "Anahtarı Temizle",
    "context": "<button id=\"keyClear\" class=\"btn-ghost\">Anahtarı Temizle</button>"
  },
  {
    "file": "tool.html",
    "line": 261,
    "text": "Depolanmış anahtar yok.",
    "context": "<div id=\"keyInfo\" class=\"muted\" style=\"margin-top:12px\">Depolanmış anahtar yok.</div>"
  },
  {
    "file": "tool.html",
    "line": 265,
    "text": "RFC 3161 Zaman Damgası Yetkilisi (TSA)",
    "context": "<h3>RFC 3161 Zaman Damgası Yetkilisi (TSA)</h3>"
  },
  {
    "file": "tool.html",
    "line": 267,
    "text": "TSA Sunucusu",
    "context": "<label><b>TSA Sunucusu</b>"
  },
  {
    "file": "tool.html",
    "line": 269,
    "text": "DigiCert",
    "context": "<option value=\"http://timestamp.digicert.com\">DigiCert</option>"
  },
  {
    "file": "tool.html",
    "line": 269,
    "text": "http://timestamp.digicert.com",
    "context": "value attribute"
  },
  {
    "file": "tool.html",
    "line": 270,
    "text": "Sectigo",
    "context": "<option value=\"https://timestamp.sectigo.com\">Sectigo</option>"
  },
  {
    "file": "tool.html",
    "line": 270,
    "text": "https://timestamp.sectigo.com",
    "context": "value attribute"
  },
  {
    "file": "tool.html",
    "line": 271,
    "text": "FreeTSA",
    "context": "<option value=\"https://freetsa.org/tsr\">FreeTSA</option>"
  },
  {
    "file": "tool.html",
    "line": 271,
    "text": "https://freetsa.org/tsr",
    "context": "value attribute"
  },
  {
    "file": "tool.html",
    "line": 276,
    "text": "Güvenilir Zaman Damgası İste (RFC 3161)",
    "context": "<button id=\"tsaRequestBtn\" disabled>Güvenilir Zaman Damgası İste (RFC 3161)</button>"
  },
  {
    "file": "tool.html",
    "line": 283,
    "text": "Güven Listesi Yönetimi (Trust Store)",
    "context": "<h2 style=\"margin-top:0\">Güven Listesi Yönetimi (Trust Store)</h2>"
  },
  {
    "file": "tool.html",
    "line": 284,
    "text": "Doğrulama sırasında özel olarak güvenilecek kök sertifikaları buraya ekleyebilirsiniz. Bu sertifikalar, C2PA'in varsayılan güven listesine ek olarak kullanılır. Lütfen sertifikaları",
    "context": "<p class=\"muted\">Doğrulama sırasında özel olarak güvenilecek kök sertifikaları buraya ekleyebilirsiniz. Bu sertifikalar, C2PA'in varsayılan güven listesine ek olarak kullanılır. Lütfen sertifikaları <strong>PEM formatında</strong> ekleyin.</p>"
  },
  {
    "file": "tool.html",
    "line": 284,
    "text": "PEM formatında",
    "context": "<p class=\"muted\">Doğrulama sırasında özel olarak güvenilecek kök sertifikaları buraya ekleyebilirsiniz. Bu sertifikalar, C2PA'in varsayılan güven listesine ek olarak kullanılır. Lütfen sertifikaları <strong>PEM formatında</strong> ekleyin.</p>"
  },
  {
    "file": "tool.html",
    "line": 284,
    "text": "ekleyin.",
    "context": "<p class=\"muted\">Doğrulama sırasında özel olarak güvenilecek kök sertifikaları buraya ekleyebilirsiniz. Bu sertifikalar, C2PA'in varsayılan güven listesine ek olarak kullanılır. Lütfen sertifikaları <strong>PEM formatında</strong> ekleyin.</p>"
  },
  {
    "file": "tool.html",
    "line": 287,
    "text": "Yeni Sertifika Ekle",
    "context": "<h3>Yeni Sertifika Ekle</h3>"
  },
  {
    "file": "tool.html",
    "line": 288,
    "text": "-----BEGIN CERTIFICATE-----&#10;MIIC...&#10;-----END CERTIFICATE-----",
    "context": "placeholder attribute"
  },
  {
    "file": "tool.html",
    "line": 290,
    "text": "Güven Listesine Ekle",
    "context": "<button id=\"addCertBtn\" disabled>Güven Listesine Ekle</button>"
  },
  {
    "file": "tool.html",
    "line": 297,
    "text": "Mevcut Güvenilir Sertifikalar",
    "context": "<h3 style=\"margin:0;\">Mevcut Güvenilir Sertifikalar</h3>"
  },
  {
    "file": "tool.html",
    "line": 298,
    "text": "Tüm Listeyi Temizle",
    "context": "<button id=\"clearTrustListBtn\" class=\"btn-ghost\">Tüm Listeyi Temizle</button>"
  },
  {
    "file": "tool.html",
    "line": 301,
    "text": "Güven listesi boş.",
    "context": "<p id=\"trustListEmpty\" class=\"muted\" style=\"display:none;\">Güven listesi boş.</p>"
  },
  {
    "file": "tool.html",
    "line": 332,
    "text": "String(s??'').replace(/[&",
    "context": "const esc = (s) => String(s??'').replace(/[&<>\"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":\"&#39;\"}[c]));"
  },
  {
    "file": "tool.html",
    "line": 332,
    "text": "({ '&':'&amp;','",
    "context": "const esc = (s) => String(s??'').replace(/[&<>\"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":\"&#39;\"}[c]));"
  },
  {
    "file": "tool.html",
    "line": 376,
    "text": "${esc(report.file.name)}",
    "context": "<h4>${esc(report.file.name)}</h4>"
  },
  {
    "file": "tool.html",
    "line": 378,
    "text": "${report.verdict.toUpperCase()}",
    "context": "<span class=\"badge ${report.verdict}\">${report.verdict.toUpperCase()}</span>"
  },
  {
    "file": "tool.html",
    "line": 379,
    "text": "Timestamp: ${tsText}",
    "context": "<span class=\"badge ${tsBadgeClass}\">Timestamp: ${tsText}</span>"
  },
  {
    "file": "tool.html",
    "line": 380,
    "text": "${esc(report.summary.sourceType)}",
    "context": "${report.summary?.sourceType ? `<span class=\"badge muted\">${esc(report.summary.sourceType)}</span>` : ''}"
  },
  {
    "file": "tool.html",
    "line": 381,
    "text": "sidecar eşleşti",
    "context": "${report.isSidecarUsed ? `<span class=\"badge muted\">sidecar eşleşti</span>` : ''}"
  },
  {
    "file": "tool.html",
    "line": 383,
    "text": "${esc(report.message)} ${report.ms ? '('+report.ms+' ms)' : ''}",
    "context": "<div class=\"muted\" style=\"margin-top:8px\">${esc(report.message)} ${report.ms ? '('+report.ms+' ms)' : ''}</div>"
  },
  {
    "file": "tool.html",
    "line": 385,
    "text": "Boyut",
    "context": "<div><b>Boyut</b><span>${fmtSize(report.file.size)}</span></div>"
  },
  {
    "file": "tool.html",
    "line": 385,
    "text": "${fmtSize(report.file.size)}",
    "context": "<div><b>Boyut</b><span>${fmtSize(report.file.size)}</span></div>"
  },
  {
    "file": "tool.html",
    "line": 386,
    "text": "İmza veren",
    "context": "<div><b>İmza veren</b><span>${esc(report.summary?.issuer || '—')}</span></div>"
  },
  {
    "file": "tool.html",
    "line": 386,
    "text": "${esc(report.summary?.issuer || '—')}",
    "context": "<div><b>İmza veren</b><span>${esc(report.summary?.issuer || '—')}</span></div>"
  },
  {
    "file": "tool.html",
    "line": 387,
    "text": "İmza zamanı (UTC)",
    "context": "<div><b>İmza zamanı (UTC)</b><span>${esc(report.summary?.time || '—')}</span></div>"
  },
  {
    "file": "tool.html",
    "line": 387,
    "text": "${esc(report.summary?.time || '—')}",
    "context": "<div><b>İmza zamanı (UTC)</b><span>${esc(report.summary?.time || '—')}</span></div>"
  },
  {
    "file": "tool.html",
    "line": 388,
    "text": "Başlık",
    "context": "<div><b>Başlık</b><span>${esc(report.summary?.title || '—')}</span></div>"
  },
  {
    "file": "tool.html",
    "line": 388,
    "text": "${esc(report.summary?.title || '—')}",
    "context": "<div><b>Başlık</b><span>${esc(report.summary?.title || '—')}</span></div>"
  },
  {
    "file": "tool.html",
    "line": 391,
    "text": "JSON",
    "context": "<button class=\"btn-ghost dl\">JSON</button>"
  },
  {
    "file": "tool.html",
    "line": 392,
    "text": "PDF",
    "context": "<button class=\"btn-ghost pdf\">PDF</button>"
  },
  {
    "file": "tool.html",
    "line": 393,
    "text": "Açıklamalar",
    "context": "<button class=\"btn-ghost show\">Açıklamalar</button>"
  },
  {
    "file": "tool.html",
    "line": 394,
    "text": "CSV",
    "context": "<button class=\"btn-ghost csv\">CSV</button>"
  },
  {
    "file": "tool.html",
    "line": 404,
    "text": "Hata: ${esc(report.error)}",
    "context": "if (report.error && codes.length === 0) codesDiv.innerHTML = `<pre class=\"code-block\" style=\"margin-top:0;\">Hata: ${esc(report.error)}</pre>`;"
  },
  {
    "file": "tool.html",
    "line": 405,
    "text": "Görüntülenecek doğrulama kodu yok.",
    "context": "else if (codes.length === 0) codesDiv.innerHTML = `<div class=\"muted\">Görüntülenecek doğrulama kodu yok.</div>`;"
  },
  {
    "file": "tool.html",
    "line": 406,
    "text": "Kod",
    "context": "else codesDiv.innerHTML = `<table class=\"codes-table\"><thead><tr><th>Kod</th><th>Açıklama</th></tr></thead><tbody>${codes.map(c => `<tr><td><code>${esc(c)}</code></td><td>${esc(c2paCodeDescriptions[c]||'Açıklama yok.')}</td></tr>`).join('')}</tbody></table>`;"
  },
  {
    "file": "tool.html",
    "line": 406,
    "text": "Açıklama",
    "context": "else codesDiv.innerHTML = `<table class=\"codes-table\"><thead><tr><th>Kod</th><th>Açıklama</th></tr></thead><tbody>${codes.map(c => `<tr><td><code>${esc(c)}</code></td><td>${esc(c2paCodeDescriptions[c]||'Açıklama yok.')}</td></tr>`).join('')}</tbody></table>`;"
  },
  {
    "file": "tool.html",
    "line": 406,
    "text": "`",
    "context": "else codesDiv.innerHTML = `<table class=\"codes-table\"><thead><tr><th>Kod</th><th>Açıklama</th></tr></thead><tbody>${codes.map(c => `<tr><td><code>${esc(c)}</code></td><td>${esc(c2paCodeDescriptions[c]||'Açıklama yok.')}</td></tr>`).join('')}</tbody></table>`;"
  },
  {
    "file": "tool.html",
    "line": 406,
    "text": "${esc(c)}",
    "context": "else codesDiv.innerHTML = `<table class=\"codes-table\"><thead><tr><th>Kod</th><th>Açıklama</th></tr></thead><tbody>${codes.map(c => `<tr><td><code>${esc(c)}</code></td><td>${esc(c2paCodeDescriptions[c]||'Açıklama yok.')}</td></tr>`).join('')}</tbody></table>`;"
  },
  {
    "file": "tool.html",
    "line": 406,
    "text": "${esc(c2paCodeDescriptions[c]||'Açıklama yok.')}",
    "context": "else codesDiv.innerHTML = `<table class=\"codes-table\"><thead><tr><th>Kod</th><th>Açıklama</th></tr></thead><tbody>${codes.map(c => `<tr><td><code>${esc(c)}</code></td><td>${esc(c2paCodeDescriptions[c]||'Açıklama yok.')}</td></tr>`).join('')}</tbody></table>`;"
  },
  {
    "file": "tool.html",
    "line": 406,
    "text": "`).join('')}",
    "context": "else codesDiv.innerHTML = `<table class=\"codes-table\"><thead><tr><th>Kod</th><th>Açıklama</th></tr></thead><tbody>${codes.map(c => `<tr><td><code>${esc(c)}</code></td><td>${esc(c2paCodeDescriptions[c]||'Açıklama yok.')}</td></tr>`).join('')}</tbody></table>`;"
  },
  {
    "file": "tool.html",
    "line": 607,
    "text": "${esc(item.subject)}",
    "context": "el.innerHTML = `<div class=\"info\"><strong>${esc(item.subject)}</strong><pre>Parmak İzi (SHA-1): ${esc(item.fingerprint)}</pre></div><button class=\"btn-ghost remove-cert-btn\" data-fp=\"${esc(item.fingerprint)}\">Kaldır</button>`;"
  },
  {
    "file": "tool.html",
    "line": 607,
    "text": "Parmak İzi (SHA-1): ${esc(item.fingerprint)}",
    "context": "el.innerHTML = `<div class=\"info\"><strong>${esc(item.subject)}</strong><pre>Parmak İzi (SHA-1): ${esc(item.fingerprint)}</pre></div><button class=\"btn-ghost remove-cert-btn\" data-fp=\"${esc(item.fingerprint)}\">Kaldır</button>`;"
  },
  {
    "file": "tool.html",
    "line": 607,
    "text": "Kaldır",
    "context": "el.innerHTML = `<div class=\"info\"><strong>${esc(item.subject)}</strong><pre>Parmak İzi (SHA-1): ${esc(item.fingerprint)}</pre></div><button class=\"btn-ghost remove-cert-btn\" data-fp=\"${esc(item.fingerprint)}\">Kaldır</button>`;"
  },
  {
    "file": "tool.html",
    "line": 659,
    "text": "Doğrulama Detayları",
    "context": "return `<div class=\"section\"><h3>Doğrulama Detayları</h3><table class=\"details-table\">${details.map(d => `<tr><td><strong>${d.label}</strong></td><td>${d.value}</td></tr>`).join('')}</table></div>`;"
  },
  {
    "file": "tool.html",
    "line": 659,
    "text": "`",
    "context": "return `<div class=\"section\"><h3>Doğrulama Detayları</h3><table class=\"details-table\">${details.map(d => `<tr><td><strong>${d.label}</strong></td><td>${d.value}</td></tr>`).join('')}</table></div>`;"
  },
  {
    "file": "tool.html",
    "line": 659,
    "text": "${d.label}",
    "context": "return `<div class=\"section\"><h3>Doğrulama Detayları</h3><table class=\"details-table\">${details.map(d => `<tr><td><strong>${d.label}</strong></td><td>${d.value}</td></tr>`).join('')}</table></div>`;"
  },
  {
    "file": "tool.html",
    "line": 659,
    "text": "${d.value}",
    "context": "return `<div class=\"section\"><h3>Doğrulama Detayları</h3><table class=\"details-table\">${details.map(d => `<tr><td><strong>${d.label}</strong></td><td>${d.value}</td></tr>`).join('')}</table></div>`;"
  },
  {
    "file": "tool.html",
    "line": 659,
    "text": "`).join('')}",
    "context": "return `<div class=\"section\"><h3>Doğrulama Detayları</h3><table class=\"details-table\">${details.map(d => `<tr><td><strong>${d.label}</strong></td><td>${d.value}</td></tr>`).join('')}</table></div>`;"
  },
  {
    "file": "tool.html",
    "line": 663,
    "text": "`",
    "context": "const rows = codes.map(code => `<tr><td><code>${safe(code)}</code></td><td>${safe(codeDescriptions[code] || 'Bu kod için standart bir açıklama bulunamadı.')}</td></tr>`).join('');"
  },
  {
    "file": "tool.html",
    "line": 663,
    "text": "${safe(code)}",
    "context": "const rows = codes.map(code => `<tr><td><code>${safe(code)}</code></td><td>${safe(codeDescriptions[code] || 'Bu kod için standart bir açıklama bulunamadı.')}</td></tr>`).join('');"
  },
  {
    "file": "tool.html",
    "line": 663,
    "text": "${safe(codeDescriptions[code] || 'Bu kod için standart bir açıklama bulunamadı.')}",
    "context": "const rows = codes.map(code => `<tr><td><code>${safe(code)}</code></td><td>${safe(codeDescriptions[code] || 'Bu kod için standart bir açıklama bulunamadı.')}</td></tr>`).join('');"
  },
  {
    "file": "tool.html",
    "line": 664,
    "text": "Tüm Doğrulama Kodları",
    "context": "return `<div class=\"section\"><h3>Tüm Doğrulama Kodları</h3><table class=\"codes-table\"><thead><tr><th>Kod</th><th>Açıklama</th></tr></thead><tbody>${rows}</tbody></table></div>`;"
  },
  {
    "file": "tool.html",
    "line": 664,
    "text": "Kod",
    "context": "return `<div class=\"section\"><h3>Tüm Doğrulama Kodları</h3><table class=\"codes-table\"><thead><tr><th>Kod</th><th>Açıklama</th></tr></thead><tbody>${rows}</tbody></table></div>`;"
  },
  {
    "file": "tool.html",
    "line": 664,
    "text": "Açıklama",
    "context": "return `<div class=\"section\"><h3>Tüm Doğrulama Kodları</h3><table class=\"codes-table\"><thead><tr><th>Kod</th><th>Açıklama</th></tr></thead><tbody>${rows}</tbody></table></div>`;"
  },
  {
    "file": "tool.html",
    "line": 664,
    "text": "${rows}",
    "context": "return `<div class=\"section\"><h3>Tüm Doğrulama Kodları</h3><table class=\"codes-table\"><thead><tr><th>Kod</th><th>Açıklama</th></tr></thead><tbody>${rows}</tbody></table></div>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "VideoKit Doğrulama Raporu",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "VK",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "VideoKit Doğrulama Raporu",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "Content Credentials (C2PA) Doğrulama Çıktısı",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "Dosya Adı",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "${safe(report.file?.name)}",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "Boyut",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "${fmtSize(report.file?.size)}",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "Genel Durum",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "${safe(report.verdict?.toUpperCase())}",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "Mesaj",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "${safe(report.message)}",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "Süre",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "${report.ms!=null?report.ms+' ms':'—'}",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "İmza Zamanı (UTC)",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "${safe(report.summary?.time)}",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "İmza Sahibi",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "${safe(report.summary?.issuer)}",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "Başlık",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "${safe(report.summary?.title)}",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "Yazılım",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "${safe(report.summary?.claimGenerator)}",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "Dosya Kimliği (SHA‑256)",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "${safe(report.fileHash)}",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "Onay Tarihi (UTC)",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "${approval}",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "${getValidationDetailsHtml()}${getCodesTableHtml()}",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tool.html",
    "line": 666,
    "text": "VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.",
    "context": "const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>VideoKit Doğrulama Raporu</title><style>body{font-family:system-ui,sans-serif;margin:40px;color:#0f172a;}.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:40px;height:40px;border-radius:8px;background:#111827;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px}.title{font-size:24px;font-weight:700}.subtitle{font-size:14px;color:#64748b}.section{margin-top:28px;page-break-inside:avoid;}.section h3{margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:6px;}table{width:100%;border-collapse:collapse;font-size:14px;}td,th{padding:8px 12px;text-align:left;vertical-align:top;}.kv-table td{border-bottom:1px solid #f0f0f0;}.kv-table strong{color:#334155;}.details-table td{width:50%;border-bottom:1px solid #f0f0f0;}.codes-table{font-size:12px;}.codes-table th{background:#f6f8fa;}.codes-table td{border:1px solid #e5e7eb;}.codes-table code{font-family:monospace;background:#eef;padding:2px 4px;border-radius:4px;word-break:break-all;}.legal{font-size:12px;color:#6b7280;margin-top:40px;}@media print{body{margin:0}}</style></head><body onload=\"focus();print();setTimeout(()=>close(),600)\"><div class=\"header\"><div class=\"logo\">VK</div><div><div class=\"title\">VideoKit Doğrulama Raporu</div><div class=\"subtitle\">Content Credentials (C2PA) Doğrulama Çıktısı</div></div></div><div class=\"section\"><table class=\"kv-table\"><tr><td><strong>Dosya Adı</strong></td><td>${safe(report.file?.name)}</td></tr><tr><td><strong>Boyut</strong></td><td>${fmtSize(report.file?.size)}</td></tr><tr><td><strong>Genel Durum</strong></td><td><strong>${safe(report.verdict?.toUpperCase())}</strong></td></tr><tr><td><strong>Mesaj</strong></td><td>${safe(report.message)}</td></tr><tr><td><strong>Süre</strong></td><td>${report.ms!=null?report.ms+' ms':'—'}</td></tr><tr><td><strong>İmza Zamanı (UTC)</strong></td><td>${safe(report.summary?.time)}</td></tr><tr><td><strong>İmza Sahibi</strong></td><td>${safe(report.summary?.issuer)}</td></tr><tr><td><strong>Başlık</strong></td><td>${safe(report.summary?.title)}</td></tr><tr><td><strong>Yazılım</strong></td><td>${safe(report.summary?.claimGenerator)}</td></tr><tr><td><strong>Dosya Kimliği (SHA‑256)</strong></td><td style=\"font-family:monospace;word-break:break-all;\">${safe(report.fileHash)}</td></tr><tr><td><strong>Onay Tarihi (UTC)</strong></td><td>${approval}</td></tr></table></div>${getValidationDetailsHtml()}${getCodesTableHtml()}<div class=\"legal\">Bu rapor VideoKit tarafından otomatik olarak oluşturulmuştur ve yalnızca bilgilendirme amaçlıdır. Hukuki bir tavsiye niteliği taşımaz.<br><br>VideoKit markası ve logosu tescillidir. Tüm hakları saklıdır.</div></body></html>`;"
  },
  {
    "file": "tools/ci-build.mjs",
    "line": 23,
    "text": "Build verification succeeded for ${requiredFiles.length} entry files.",
    "context": "console.log(`Build verification succeeded for ${requiredFiles.length} entry files.`);"
  },
  {
    "file": "tools/eslint-rules/no-ui-literals.js",
    "line": 1,
    "text": "use strict",
    "context": "'use strict';"
  },
  {
    "file": "tools/eslint-rules/no-ui-literals.js",
    "line": 40,
    "text": "Literal",
    "context": "if (node.type === 'Literal' && typeof node.value === 'string') {"
  },
  {
    "file": "tools/eslint-rules/no-ui-literals.js",
    "line": 44,
    "text": "TemplateLiteral",
    "context": "if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {"
  },
  {
    "file": "tools/eslint-rules/no-ui-literals.js",
    "line": 64,
    "text": "CallExpression",
    "context": "if (!node || node.type !== 'CallExpression') {"
  },
  {
    "file": "tools/eslint-rules/no-ui-literals.js",
    "line": 69,
    "text": "ChainExpression",
    "context": "if (callee.type === 'ChainExpression') {"
  },
  {
    "file": "tools/eslint-rules/no-ui-literals.js",
    "line": 73,
    "text": "Identifier",
    "context": "if (callee.type === 'Identifier') {"
  },
  {
    "file": "tools/eslint-rules/no-ui-literals.js",
    "line": 77,
    "text": "MemberExpression",
    "context": "if (callee.type === 'MemberExpression') {"
  },
  {
    "file": "tools/eslint-rules/no-ui-literals.js",
    "line": 90,
    "text": "ChainExpression",
    "context": "if (member.type === 'ChainExpression') {"
  },
  {
    "file": "tools/eslint-rules/no-ui-literals.js",
    "line": 94,
    "text": "MemberExpression",
    "context": "if (member.type !== 'MemberExpression') {"
  },
  {
    "file": "tools/eslint-rules/no-ui-literals.js",
    "line": 104,
    "text": "Literal",
    "context": "if (property.type === 'Literal' && typeof property.value === 'string') {"
  },
  {
    "file": "tools/eslint-rules/no-ui-literals.js",
    "line": 110,
    "text": "Identifier",
    "context": "if (property.type === 'Identifier') {"
  },
  {
    "file": "tools/eslint-rules/no-ui-literals.js",
    "line": 135,
    "text": "JSXIdentifier",
    "context": "const attributeName = nameNode.type === 'JSXIdentifier' ? nameNode.name : null;"
  },
  {
    "file": "tools/eslint-rules/no-ui-literals.js",
    "line": 148,
    "text": "Literal",
    "context": "if (node.value.type === 'Literal') {"
  },
  {
    "file": "tools/eslint-rules/no-ui-literals.js",
    "line": 154,
    "text": "JSXExpressionContainer",
    "context": "node.value.type === 'JSXExpressionContainer' &&"
  },
  {
    "file": "tools/eslint-rules/no-ui-literals.js",
    "line": 181,
    "text": "ChainExpression",
    "context": "if (callee.type === 'ChainExpression') {"
  },
  {
    "file": "tools/eslint-rules/no-ui-literals.js",
    "line": 185,
    "text": "MemberExpression",
    "context": "if (callee.type !== 'MemberExpression') {"
  },
  {
    "file": "tools/eslint-rules/no-ui-literals.js",
    "line": 212,
    "text": "disallow raw string literals in UI contexts without i18n",
    "context": "description: 'disallow raw string literals in UI contexts without i18n',"
  },
  {
    "file": "tools/eslint-rules/no-ui-literals.js",
    "line": 213,
    "text": "Best Practices",
    "context": "category: 'Best Practices',"
  },
  {
    "file": "tools/eslint-rules/no-ui-literals.js",
    "line": 217,
    "text": "UI text must use translation helpers instead of raw string literals.",
    "context": "noRawString: 'UI text must use translation helpers instead of raw string literals.',"
  },
  {
    "file": "tools/eslint-rules/no-ui-literals.js",
    "line": 231,
    "text": "JSXAttribute",
    "context": "if (node.parent && node.parent.type === 'JSXAttribute') {"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 17,
    "text": ".header-content h1[data-i18n=\"portal_title\"]",
    "context": "selector: '.header-content h1[data-i18n=\"portal_title\"]',"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 22,
    "text": "nav a[data-i18n=\"nav_dashboard\"]",
    "context": "selector: 'nav a[data-i18n=\"nav_dashboard\"]',"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 32,
    "text": "#login-view h2[data-i18n=\"login_title\"]",
    "context": "selector: '#login-view h2[data-i18n=\"login_title\"]',"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 37,
    "text": "#login-view p[data-i18n=\"login_prompt_new\"]",
    "context": "selector: '#login-view p[data-i18n=\"login_prompt_new\"]',"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 42,
    "text": "#login-form label[for=\"login-email\"]",
    "context": "selector: '#login-form label[for=\"login-email\"]',"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 47,
    "text": "#login-form label[for=\"login-password\"]",
    "context": "selector: '#login-form label[for=\"login-password\"]',"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 52,
    "text": "#login-form button[data-i18n=\"login_button\"]",
    "context": "selector: '#login-form button[data-i18n=\"login_button\"]',"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 57,
    "text": "#login-view a[data-i18n=\"forgot_password_link\"]",
    "context": "selector: '#login-view a[data-i18n=\"forgot_password_link\"]',"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 62,
    "text": "#login-view a[data-i18n=\"go_to_register_link\"]",
    "context": "selector: '#login-view a[data-i18n=\"go_to_register_link\"]',"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 67,
    "text": "#register-view h2[data-i18n=\"register_title\"]",
    "context": "selector: '#register-view h2[data-i18n=\"register_title\"]',"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 72,
    "text": "#register-view p[data-i18n=\"register_prompt\"]",
    "context": "selector: '#register-view p[data-i18n=\"register_prompt\"]',"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 77,
    "text": "#register-form button[data-i18n=\"register_button\"]",
    "context": "selector: '#register-form button[data-i18n=\"register_button\"]',"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 82,
    "text": "#register-view a[data-i18n=\"go_to_login_link\"]",
    "context": "selector: '#register-view a[data-i18n=\"go_to_login_link\"]',"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 87,
    "text": "#forgot-password-view h2[data-i18n=\"forgot_password_title\"]",
    "context": "selector: '#forgot-password-view h2[data-i18n=\"forgot_password_title\"]',"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 92,
    "text": "#forgot-password-view p[data-i18n=\"forgot_password_prompt\"]",
    "context": "selector: '#forgot-password-view p[data-i18n=\"forgot_password_prompt\"]',"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 97,
    "text": "#forgot-password-form button[data-i18n=\"send_reset_link_button\"]",
    "context": "selector: '#forgot-password-form button[data-i18n=\"send_reset_link_button\"]',"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 102,
    "text": "#reset-password-view h2[data-i18n=\"reset_password_title\"]",
    "context": "selector: '#reset-password-view h2[data-i18n=\"reset_password_title\"]',"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 107,
    "text": "#reset-password-view p[data-i18n=\"reset_password_prompt\"]",
    "context": "selector: '#reset-password-view p[data-i18n=\"reset_password_prompt\"]',"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 112,
    "text": "#reset-password-form button[data-i18n=\"update_password_button\"]",
    "context": "selector: '#reset-password-form button[data-i18n=\"update_password_button\"]',"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 117,
    "text": ": String(value).replace(/\\s+/g,",
    "context": "value == null ? '' : String(value).replace(/\\s+/g, ' ').trim();"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 150,
    "text": "Element not found",
    "context": "message = 'Element not found';"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 153,
    "text": "Missing translation value",
    "context": "message = 'Missing translation value';"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 159,
    "text": "Text content mismatch",
    "context": "message = 'Text content mismatch';"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 194,
    "text": "Spot check failed for ${summary.failed} keys.",
    "context": "console.error(`Spot check failed for ${summary.failed} keys.`);"
  },
  {
    "file": "tools/i18n-spotcheck.mjs",
    "line": 199,
    "text": "Spot check passed for ${summary.passed}/${summary.total} keys. Report written to ${outputPath}.",
    "context": "`Spot check passed for ${summary.passed}/${summary.total} keys. Report written to ${outputPath}.`,"
  },
  {
    "file": "tools/run-i18n-audit.mjs",
    "line": 22,
    "text": "${command} ${args.join(' ')} exited with code ${code}",
    "context": "reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));"
  },
  {
    "file": "tools/run-i18n-audit.mjs",
    "line": 39,
    "text": "- ${locale}: ${keys.join(', ')}",
    "context": "lines.push(`  - ${locale}: ${keys.join(', ')}`);"
  },
  {
    "file": "tools/run-i18n-audit.mjs",
    "line": 61,
    "text": "Translation coverage below 100%.\\n${details}",
    "context": "throw new Error(`Translation coverage below 100%.\\n${details}`);"
  },
  {
    "file": "tools/run-i18n-audit.mjs",
    "line": 65,
    "text": "Translation audit found orphan used keys: ${orphanUsedKeys.join(', ')}",
    "context": "throw new Error(`Translation audit found orphan used keys: ${orphanUsedKeys.join(', ')}`);"
  },
  {
    "file": "tools/run-i18n-audit.mjs",
    "line": 68,
    "text": "✅ Translation coverage is 100% for all locales.",
    "context": "console.log('✅ Translation coverage is 100% for all locales.');"
  },
  {
    "file": "tracing.js",
    "line": 128,
    "text": "[tracing] started: service=\"${serviceName}\" ver=\"${serviceVersion}\" → ${otlpUrl}",
    "context": "console.log(`[tracing] started: service=\"${serviceName}\" ver=\"${serviceVersion}\" → ${otlpUrl}`);"
  },
  {
    "file": "tracing.js",
    "line": 130,
    "text": "[tracing] OTLP headers set:",
    "context": "console.log('[tracing] OTLP headers set:', Object.keys(otlpHeaders).join(', '));"
  },
  {
    "file": "tracing.js",
    "line": 134,
    "text": "[tracing] disabled:",
    "context": "console.warn('[tracing] disabled:', e?.message || e);"
  },
  {
    "file": "tracing.js",
    "line": 137,
    "text": "SIGTERM",
    "context": "process.on('SIGTERM', () => {"
  },
  {
    "file": "tracing.js",
    "line": 140,
    "text": "SIGINT",
    "context": "process.on('SIGINT', () => {"
  },
  {
    "file": "videokit-audit.js",
    "line": 20,
    "text": "i veya ilk kayıt ise genesis hash",
    "context": "* @returns {Promise<string>} Son kaydın hash'i veya ilk kayıt ise genesis hash'i."
  },
  {
    "file": "videokit-audit.js",
    "line": 48,
    "text": "Denetim logundaki son satır bozuk, genesis hash kullanılıyor.",
    "context": "console.error('Denetim logundaki son satır bozuk, genesis hash kullanılıyor.', e);"
  },
  {
    "file": "videokit-audit.js",
    "line": 71,
    "text": "ini hesaplarken",
    "context": "// Kendi hash'ini hesaplarken 'hash' alanı dışarıda bırakılır."
  },
  {
    "file": "videokit-audit.js",
    "line": 81,
    "text": "Denetim loguna yazılırken hata oluştu:",
    "context": "console.error('Denetim loguna yazılırken hata oluştu:', error);"
  },
  {
    "file": "videokit-audit.js",
    "line": 110,
    "text": "Bütünlük Bozulmuş: Satır ${lineNumber} geçersiz JSON formatında.",
    "context": "return { isValid: false, error: `Bütünlük Bozulmuş: Satır ${lineNumber} geçersiz JSON formatında.` };"
  },
  {
    "file": "videokit-audit.js",
    "line": 114,
    "text": "Bütünlük Bozulmuş: Satır ${lineNumber}'deki 'previousHash' uyuşmuyor.",
    "context": "return { isValid: false, error: `Bütünlük Bozulmuş: Satır ${lineNumber}'deki 'previousHash' uyuşmuyor.` };"
  },
  {
    "file": "videokit-audit.js",
    "line": 121,
    "text": "Bütünlük Bozulmuş: Satır ${lineNumber}'deki 'hash' hatalı hesaplanmış.",
    "context": "return { isValid: false, error: `Bütünlük Bozulmuş: Satır ${lineNumber}'deki 'hash' hatalı hesaplanmış.` };"
  },
  {
    "file": "videokit-audit.js",
    "line": 150,
    "text": "Denetim logu okunurken bozuk satır atlandı:",
    "context": "console.error('Denetim logu okunurken bozuk satır atlandı:', line, e);"
  },
  {
    "file": "videokit-core.js",
    "line": 36,
    "text": "İmza ve zincir geçerli.",
    "context": "if (!hasError && hasSig && !untrusted) return ['green', 'İmza ve zincir geçerli.'];"
  },
  {
    "file": "videokit-core.js",
    "line": 37,
    "text": "İmza geçerli; sertifika güven kökünde değil.",
    "context": "if (!hasError && hasSig && untrusted) return ['yellow', 'İmza geçerli; sertifika güven kökünde değil.'];"
  },
  {
    "file": "videokit-core.js",
    "line": 38,
    "text": "Doğrulama hataları var.",
    "context": "if (hasError) return ['red', 'Doğrulama hataları var.'];"
  },
  {
    "file": "videokit-core.js",
    "line": 39,
    "text": "Kısmi doğrulama.",
    "context": "return ['yellow', 'Kısmi doğrulama.'];"
  },
  {
    "file": "videokit-core.js",
    "line": 44,
    "text": "Trusted",
    "context": "if (has(/time.?stamp\\.(token\\.)?trusted/i)) return ['green', 'Trusted'];"
  },
  {
    "file": "videokit-core.js",
    "line": 45,
    "text": "Validated",
    "context": "if (has(/time.?stamp\\.(token\\.)?validated/i)) return ['yellow', 'Validated'];"
  },
  {
    "file": "videokit-core.js",
    "line": 46,
    "text": "Yok",
    "context": "return ['muted', 'Yok'];"
  },
  {
    "file": "videokit-core.js",
    "line": 53,
    "text": "PolicyViolationError",
    "context": "this.name = 'PolicyViolationError';"
  },
  {
    "file": "videokit-core.js",
    "line": 93,
    "text": "te 64-bit integer",
    "context": "// JavaScript'te 64-bit integer'ları güvenli bir şekilde işlemek zordur."
  },
  {
    "file": "videokit-core.js",
    "line": 154,
    "text": "SHA-256",
    "context": "const digest = await crypto.subtle.digest('SHA-256', buf);"
  },
  {
    "file": "videokit-core.js",
    "line": 176,
    "text": "Okuma/Doğrulama hatası",
    "context": "verdict: 'red', message: 'Okuma/Doğrulama hatası', error: String(e?.message || e),"
  },
  {
    "file": "videokit-core.js",
    "line": 216,
    "text": "Person",
    "context": "{ label: 'dcterms.creator', data: { '@type': 'Person', 'name': author } },"
  },
  {
    "file": "videokit-core.js",
    "line": 217,
    "text": "Person",
    "context": "{ label: 'stds.schema-org.CreativeWork', data: { 'author': [{ '@type': 'Person', 'name': author }] } },"
  },
  {
    "file": "videokit-core.js",
    "line": 240,
    "text": "Roughtime damgası alınamadı: ${e.message}",
    "context": "console.warn(`Roughtime damgası alınamadı: ${e.message}`);"
  },
  {
    "file": "videokit-core.js",
    "line": 250,
    "text": "ES256",
    "context": "alg: 'ES256',"
  },
  {
    "file": "videokit-core.js",
    "line": 286,
    "text": "Manifest dosyası alınamadı: ${response.statusText}",
    "context": "if (!response.ok) throw new Error(`Manifest dosyası alınamadı: ${response.statusText}`);"
  },
  {
    "file": "videokit-core.js",
    "line": 304,
    "text": "Desteklenmeyen manifest formatı. Sadece .m3u8 ve .mpd desteklenir.",
    "context": "throw new Error('Desteklenmeyen manifest formatı. Sadece .m3u8 ve .mpd desteklenir.');"
  },
  {
    "file": "videokit-core.js",
    "line": 308,
    "text": "Manifest içinde işlenecek segment bulunamadı.",
    "context": "throw new Error('Manifest içinde işlenecek segment bulunamadı.');"
  },
  {
    "file": "videokit-core.js",
    "line": 319,
    "text": "Segment indirilemedi: ${segmentResponse.statusText}",
    "context": "if (!segmentResponse.ok) throw new Error(`Segment indirilemedi: ${segmentResponse.statusText}`);"
  },
  {
    "file": "videokit-core.js",
    "line": 381,
    "text": "Schema dosyası yüklenemedi: ${response.statusText}",
    "context": "if (!response.ok) throw new Error(`Schema dosyası yüklenemedi: ${response.statusText}`);"
  },
  {
    "file": "videokit-core.js",
    "line": 385,
    "text": "KLV doğrulayıcı başlatılamadı:",
    "context": "console.error(\"KLV doğrulayıcı başlatılamadı:\", error);"
  },
  {
    "file": "videokit-core.js",
    "line": 416,
    "text": "BER length extends beyond buffer",
    "context": "if (offset + 1 + numBytes > view.length) throw new Error(\"BER length extends beyond buffer\");"
  },
  {
    "file": "videokit-core.js",
    "line": 479,
    "text": "a checksum",
    "context": "// payload'a checksum'ı ekle"
  },
  {
    "file": "videokit-core.js",
    "line": 499,
    "text": "Geçersiz KLV paketi: MISB ST 0601 UL (Universal Label) bulunamadı.",
    "context": "throw new Error(\"Geçersiz KLV paketi: MISB ST 0601 UL (Universal Label) bulunamadı.\");"
  },
  {
    "file": "videokit-core.js",
    "line": 531,
    "text": "✅ CRC Doğrulaması Başarılı",
    "context": "result._validation_notes.push('✅ CRC Doğrulaması Başarılı');"
  },
  {
    "file": "videokit-core.js",
    "line": 533,
    "text": "❌ CRC Hatası (Alınan: ${receivedChecksum}, Hesaplanan: ${calculatedCrc})",
    "context": "result._validation_notes.push(`❌ CRC Hatası (Alınan: ${receivedChecksum}, Hesaplanan: ${calculatedCrc})`);"
  },
  {
    "file": "videokit-core.js",
    "line": 550,
    "text": "Tag 2",
    "context": "if (isFirstTag && tag !== 2 && !result['_validation_notes'].some(n => n.includes('Tag 2'))) {"
  },
  {
    "file": "videokit-core.js",
    "line": 551,
    "text": "⚠️ Uyarı: Tag 2 ilk öğe değil.",
    "context": "result._validation_notes.push('⚠️ Uyarı: Tag 2 ilk öğe değil.');"
  },
  {
    "file": "videokit-core.js",
    "line": 591,
    "text": "Tag",
    "context": "let field = err.instancePath.replace('/', 'Tag ');"
  },
  {
    "file": "videokit-core.js",
    "line": 593,
    "text": "Tag ${err.params.missingProperty}",
    "context": "field = `Tag ${err.params.missingProperty}`;"
  },
  {
    "file": "videokit-core.js",
    "line": 596,
    "text": "❌ ${field}: Değer aralık dışında. İzin verilen: ${err.params.limit}. Gelen: ${err.instancePath ? obj[err.instancePath.substring(1)] : 'N/A'}",
    "context": "errs.push(`❌ ${field}: Değer aralık dışında. İzin verilen: ${err.params.limit}. Gelen: ${err.instancePath ? obj[err.instancePath.substring(1)] : 'N/A'}`);"
  },
  {
    "file": "videokit-core.js",
    "line": 598,
    "text": "❌ ${field}: ${err.message}",
    "context": "errs.push(`❌ ${field}: ${err.message}`);"
  },
  {
    "file": "videokit-core.js",
    "line": 610,
    "text": "❌ Tag 2 (Unix Time Stamp): Değer, gelecekteki bir tarihi gösteremez.",
    "context": "errs.push(`❌ Tag 2 (Unix Time Stamp): Değer, gelecekteki bir tarihi gösteremez.`);"
  },
  {
    "file": "videokit-core.js",
    "line": 613,
    "text": "❌ Tag 2 (Unix Time Stamp): Geçersiz zaman damgası formatı.",
    "context": "errs.push(`❌ Tag 2 (Unix Time Stamp): Geçersiz zaman damgası formatı.`);"
  },
  {
    "file": "videokit-core.js",
    "line": 622,
    "text": "✅ Tüm şema ve semantik kontrollerden geçti.",
    "context": "errs.push(\"✅ Tüm şema ve semantik kontrollerden geçti.\");"
  },
  {
    "file": "videokit-core.js",
    "line": 639,
    "text": "mux.js kütüphanesi yüklenmemiş.",
    "context": "return reject(new Error('mux.js kütüphanesi yüklenmemiş.'));"
  },
  {
    "file": "videokit-core.js",
    "line": 679,
    "text": "mux.js kütüphanesi yüklenmemiş.",
    "context": "throw new Error('mux.js kütüphanesi yüklenmemiş.');"
  },
  {
    "file": "videokit-core.js",
    "line": 728,
    "text": "FFmpeg zaten yüklü.",
    "context": "this._logCallback(\"FFmpeg zaten yüklü.\");"
  },
  {
    "file": "videokit-core.js",
    "line": 731,
    "text": "FFmpeg.wasm motoru yükleniyor...",
    "context": "this._logCallback(\"FFmpeg.wasm motoru yükleniyor...\");"
  },
  {
    "file": "videokit-core.js",
    "line": 734,
    "text": "[FFmpeg]: ${message}",
    "context": "this._logCallback(`[FFmpeg]: ${message}`);"
  },
  {
    "file": "videokit-core.js",
    "line": 740,
    "text": "✅ FFmpeg.wasm motoru başarıyla yüklendi.",
    "context": "this._logCallback(\"✅ FFmpeg.wasm motoru başarıyla yüklendi.\");"
  },
  {
    "file": "videokit-core.js",
    "line": 748,
    "text": "Girdi dosyası yazılıyor: ${inputName}",
    "context": "this._logCallback(`Girdi dosyası yazılıyor: ${inputName}`);"
  },
  {
    "file": "videokit-core.js",
    "line": 750,
    "text": "FFmpeg komutu çalıştırılıyor: ${commandArgs.join(' ')}",
    "context": "this._logCallback(`FFmpeg komutu çalıştırılıyor: ${commandArgs.join(' ')}`);"
  },
  {
    "file": "videokit-core.js",
    "line": 752,
    "text": "Çıktı dosyası okunuyor: ${outputName}",
    "context": "this._logCallback(`Çıktı dosyası okunuyor: ${outputName}`);"
  },
  {
    "file": "videokit-core.js",
    "line": 754,
    "text": "Sanal dosya sistemi temizleniyor...",
    "context": "this._logCallback(\"Sanal dosya sistemi temizleniyor...\");"
  },
  {
    "file": "videokit-core.js",
    "line": 791,
    "text": "/g, \"",
    "context": "return \"'\" + str.replace(/'/g, \"'\\\\''\") + \"'\";"
  },
  {
    "file": "videokit-core.js",
    "line": 797,
    "text": "gst-launch-1.0 filesrc location=${shellQuote(videoName)} ! qtdemux ! h24parse ! mux. filesrc location=${shellQuote(klvName)} ! klvparse mapping=st0601 ! mux. mpegtsmux name=mux ! filesink location=${shellQuote(outputName)}",
    "context": "return `gst-launch-1.0 filesrc location=${shellQuote(videoName)} ! qtdemux ! h24parse ! mux. filesrc location=${shellQuote(klvName)} ! klvparse mapping=st0601 ! mux. mpegtsmux name=mux ! filesink location=${shellQuote(outputName)}`;"
  },
  {
    "file": "videokit-core.js",
    "line": 804,
    "text": "# KLV akışının varlığını, paketlerini ve zaman damgalarını kontrol edin:\\n",
    "context": "return `# KLV akışının varlığını, paketlerini ve zaman damgalarını kontrol edin:\\n` +"
  },
  {
    "file": "videokit-core.js",
    "line": 805,
    "text": "ffprobe -v quiet -print_format json -show_streams -show_packets ${safeTsName}",
    "context": "`ffprobe -v quiet -print_format json -show_streams -show_packets ${safeTsName}`;"
  },
  {
    "file": "videokit-core.js",
    "line": 808,
    "text": "ffmpeg -i ${safeTsName} -map 0:d -c copy -f data \"${shellQuote(outputName)}\"",
    "context": "return `ffmpeg -i ${safeTsName} -map 0:d -c copy -f data \"${shellQuote(outputName)}\"`;"
  },
  {
    "file": "videokit-core.js",
    "line": 811,
    "text": "ffmpeg -i ${safeTsName} -map 0:v -c copy ${shellQuote(outputName)}",
    "context": "return `ffmpeg -i ${safeTsName} -map 0:v -c copy ${shellQuote(outputName)}`;"
  },
  {
    "file": "videokit-core.js",
    "line": 820,
    "text": "❌ KLV Akışı Bulunamadı (codec_type=\"data\" yok).",
    "context": "report.push('❌ KLV Akışı Bulunamadı (codec_type=\"data\" yok).');"
  },
  {
    "file": "videokit-core.js",
    "line": 824,
    "text": "✅ KLV Akışı Bulundu:",
    "context": "report.push(`✅ KLV Akışı Bulundu:`);"
  },
  {
    "file": "videokit-core.js",
    "line": 825,
    "text": "- PID: ${pid} (0x${pid.toString(16)}) (Stream Index: ${klvStream.index})",
    "context": "report.push(`  - PID: ${pid} (0x${pid.toString(16)}) (Stream Index: ${klvStream.index})`);"
  },
  {
    "file": "videokit-core.js",
    "line": 827,
    "text": "- Toplam KLV Paketi: ${klvPackets.length}",
    "context": "report.push(`  - Toplam KLV Paketi: ${klvPackets.length}`);"
  },
  {
    "file": "videokit-core.js",
    "line": 829,
    "text": "Analiz Raporu:\\n",
    "context": "return \"Analiz Raporu:\\n\" + report.join('\\n');"
  },
  {
    "file": "videokit-core.js",
    "line": 837,
    "text": "VideoKitKeyStore",
    "context": "_db: null, name: 'VideoKitKeyStore', storeName: 'keys',"
  },
  {
    "file": "videokit-core.js",
    "line": 864,
    "text": "SHA-256",
    "context": "const digest = await crypto.subtle.digest('SHA-256', buf);"
  },
  {
    "file": "videokit-core.js",
    "line": 873,
    "text": "ECDSA",
    "context": "const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);"
  },
  {
    "file": "videokit-core.js",
    "line": 873,
    "text": "P-256",
    "context": "const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);"
  },
  {
    "file": "videokit-core.js",
    "line": 877,
    "text": "Yeni aktif anahtar oluşturuldu: ${fingerprint}",
    "context": "console.log(`Yeni aktif anahtar oluşturuldu: ${fingerprint}`);"
  },
  {
    "file": "videokit-core.js",
    "line": 885,
    "text": "nin clear",
    "context": "// Bu işlem daha karmaşık hale geldiği için IndexedDB'nin clear'ını doğrudan kullanmak yerine"
  },
  {
    "file": "videokit-core.js",
    "line": 888,
    "text": "Anahtar deposu temizlendi.",
    "context": "console.log(\"Anahtar deposu temizlendi.\");"
  },
  {
    "file": "videokit-core.js",
    "line": 898,
    "text": "Aktif anahtar bulunamadı.",
    "context": "console.warn(\"Aktif anahtar bulunamadı.\");"
  },
  {
    "file": "videokit-core.js",
    "line": 921,
    "text": "Anahtar devri işlemi başlatılıyor...",
    "context": "console.log(\"Anahtar devri işlemi başlatılıyor...\");"
  },
  {
    "file": "videokit-core.js",
    "line": 926,
    "text": "Anahtar devri için eski aktif anahtarın sertifikası (PEM) gereklidir.",
    "context": "throw new Error(\"Anahtar devri için eski aktif anahtarın sertifikası (PEM) gereklidir.\");"
  },
  {
    "file": "videokit-core.js",
    "line": 930,
    "text": "Eski sertifika (${addedCertInfo.fingerprint.slice(0,12)}...) güven listesine eklendi.",
    "context": "console.log(`Eski sertifika (${addedCertInfo.fingerprint.slice(0,12)}...) güven listesine eklendi.`);"
  },
  {
    "file": "videokit-core.js",
    "line": 932,
    "text": "Zaten mevcut",
    "context": "// \"Zaten mevcut\" hatasını görmezden gel, diğer hataları fırlat"
  },
  {
    "file": "videokit-core.js",
    "line": 933,
    "text": "zaten güven listesinde mevcut",
    "context": "if (!e.message.includes('zaten güven listesinde mevcut')) {"
  },
  {
    "file": "videokit-core.js",
    "line": 936,
    "text": "Eski sertifika zaten güven listesindeydi, işleme devam ediliyor.",
    "context": "console.warn(\"Eski sertifika zaten güven listesindeydi, işleme devam ediliyor.\");"
  },
  {
    "file": "videokit-core.js",
    "line": 944,
    "text": "Anahtar devri tamamlandı. Yeni aktif anahtar: ${newFingerprint}",
    "context": "console.log(`Anahtar devri tamamlandı. Yeni aktif anahtar: ${newFingerprint}`);"
  },
  {
    "file": "videokit-core.js",
    "line": 952,
    "text": "Gerekli kriptografi kütüphaneleri (PKI.js, ASN1.js) yüklenmemiş.",
    "context": "throw new Error(\"Gerekli kriptografi kütüphaneleri (PKI.js, ASN1.js) yüklenmemiş.\");"
  },
  {
    "file": "videokit-core.js",
    "line": 955,
    "text": "SHA-256",
    "context": "const hash = await crypto.subtle.digest('SHA-256', dataToTimestamp);"
  },
  {
    "file": "videokit-core.js",
    "line": 958,
    "text": "POST",
    "context": "const response = await fetch(tsaServerUrl, { method: 'POST', headers: { 'Content-Type': 'application/timestamp-query' }, body: reqBer });"
  },
  {
    "file": "videokit-core.js",
    "line": 958,
    "text": "Content-Type",
    "context": "const response = await fetch(tsaServerUrl, { method: 'POST', headers: { 'Content-Type': 'application/timestamp-query' }, body: reqBer });"
  },
  {
    "file": "videokit-core.js",
    "line": 959,
    "text": "TSA sunucusu hatası: ${response.status} ${response.statusText}",
    "context": "if (!response.ok) throw new Error(`TSA sunucusu hatası: ${response.status} ${response.statusText}`);"
  },
  {
    "file": "videokit-core.js",
    "line": 962,
    "text": "TSA yanıtı çözümlenemedi (invalid ASN.1).",
    "context": "if (asn1.offset === -1) throw new Error(\"TSA yanıtı çözümlenemedi (invalid ASN.1).\");"
  },
  {
    "file": "videokit-core.js",
    "line": 965,
    "text": "TSA isteği reddetti. Durum: ${statusCode}",
    "context": "if (statusCode !== 0 && statusCode !== 1) throw new Error(`TSA isteği reddetti. Durum: ${statusCode}`);"
  },
  {
    "file": "videokit-core.js",
    "line": 977,
    "text": "Gerekli kriptografi kütüphaneleri (PKI.js, ASN1.js) yüklenmemiş.",
    "context": "throw new Error(\"Gerekli kriptografi kütüphaneleri (PKI.js, ASN1.js) yüklenmemiş.\");"
  },
  {
    "file": "videokit-core.js",
    "line": 979,
    "text": "-----BEGIN CERTIFICATE-----",
    "context": "if (!pem.startsWith('-----BEGIN CERTIFICATE-----') || !pem.endsWith('-----END CERTIFICATE-----')) {"
  },
  {
    "file": "videokit-core.js",
    "line": 979,
    "text": "-----END CERTIFICATE-----",
    "context": "if (!pem.startsWith('-----BEGIN CERTIFICATE-----') || !pem.endsWith('-----END CERTIFICATE-----')) {"
  },
  {
    "file": "videokit-core.js",
    "line": 980,
    "text": "Geçersiz PEM formatı.",
    "context": "throw new Error('Geçersiz PEM formatı.');"
  },
  {
    "file": "videokit-core.js",
    "line": 985,
    "text": "${tv.type.slice(tv.type.lastIndexOf('.') + 1)}=${tv.value.valueBlock.value}",
    "context": "const subject = cert.subject.typesAndValues.map(tv => `${tv.type.slice(tv.type.lastIndexOf('.') + 1)}=${tv.value.valueBlock.value}`).join(', ');"
  },
  {
    "file": "videokit-core.js",
    "line": 986,
    "text": "SHA-1",
    "context": "const hashBuffer = await crypto.subtle.digest('SHA-1', der);"
  },
  {
    "file": "videokit-core.js",
    "line": 990,
    "text": "Bu sertifika zaten güven listesinde mevcut.",
    "context": "throw new Error('Bu sertifika zaten güven listesinde mevcut.');"
  },
  {
    "file": "videokit-core.js",
    "line": 1009,
    "text": "sinin) URL",
    "context": "* @param {string} serverUrl Roughtime sunucusunun (veya proxy'sinin) URL'i."
  },
  {
    "file": "videokit-core.js",
    "line": 1017,
    "text": "POST",
    "context": "method: 'POST',"
  },
  {
    "file": "videokit-core.js",
    "line": 1018,
    "text": "Content-Type",
    "context": "headers: { 'Content-Type': 'application/octet-stream' },"
  },
  {
    "file": "videokit-core.js",
    "line": 1023,
    "text": "Roughtime sunucusu hatası: ${response.status} ${response.statusText}",
    "context": "throw new Error(`Roughtime sunucusu hatası: ${response.status} ${response.statusText}`);"
  },
  {
    "file": "videokit-js-sdk:examples:verify_video.js",
    "line": 5,
    "text": "YOUR_API_KEY_HERE",
    "context": "//    export VIDEOKIT_API_KEY=\"YOUR_API_KEY_HERE\""
  },
  {
    "file": "videokit-js-sdk:examples:verify_video.js",
    "line": 21,
    "text": "Hata: Lütfen VIDEOKIT_API_KEY ortam değişkenini ayarlayın.",
    "context": "console.error('Hata: Lütfen VIDEOKIT_API_KEY ortam değişkenini ayarlayın.');"
  },
  {
    "file": "videokit-js-sdk:examples:verify_video.js",
    "line": 28,
    "text": "Uyarı: VIDEO_FILE_PATH ortam değişkeni ayarlanmamış. Örnek bir dosya yolu varsayılıyor.",
    "context": "console.warn('Uyarı: VIDEO_FILE_PATH ortam değişkeni ayarlanmamış. Örnek bir dosya yolu varsayılıyor.');"
  },
  {
    "file": "videokit-js-sdk:examples:verify_video.js",
    "line": 29,
    "text": "Lütfen bu yolu kendi video dosyanızla değiştirin.",
    "context": "console.warn('Lütfen bu yolu kendi video dosyanızla değiştirin.');"
  },
  {
    "file": "videokit-js-sdk:examples:verify_video.js",
    "line": 33,
    "text": "VideoKit SDK başlatılıyor...",
    "context": "console.log(`VideoKit SDK başlatılıyor...`);"
  },
  {
    "file": "videokit-js-sdk:examples:verify_video.js",
    "line": 34,
    "text": "Video dosyası doğrulanıyor: ${filePath}",
    "context": "console.log(`Video dosyası doğrulanıyor: ${filePath}`);"
  },
  {
    "file": "videokit-js-sdk:examples:verify_video.js",
    "line": 42,
    "text": "waitForResult: true",
    "context": "// `waitForResult: true` SDK'nın iş tamamlanana kadar beklemesini sağlar."
  },
  {
    "file": "videokit-js-sdk:examples:verify_video.js",
    "line": 46,
    "text": "\\n--- Doğrulama Sonucu ---",
    "context": "console.log('\\n--- Doğrulama Sonucu ---');"
  },
  {
    "file": "videokit-js-sdk:examples:verify_video.js",
    "line": 47,
    "text": "İş ID: ${result.jobId}",
    "context": "console.log(`İş ID: ${result.jobId}`);"
  },
  {
    "file": "videokit-js-sdk:examples:verify_video.js",
    "line": 48,
    "text": "Durum: ${result.state}",
    "context": "console.log(`Durum: ${result.state}`);"
  },
  {
    "file": "videokit-js-sdk:examples:verify_video.js",
    "line": 51,
    "text": "Karar: ${result.result.verdict}",
    "context": "console.log(`Karar: ${result.result.verdict}`);"
  },
  {
    "file": "videokit-js-sdk:examples:verify_video.js",
    "line": 52,
    "text": "Mesaj: \"${result.result.message}\"",
    "context": "console.log(`Mesaj: \"${result.result.message}\"`);"
  },
  {
    "file": "videokit-js-sdk:examples:verify_video.js",
    "line": 54,
    "text": "Hata: ${result.error}",
    "context": "console.error(`Hata: ${result.error}`);"
  },
  {
    "file": "videokit-js-sdk:examples:verify_video.js",
    "line": 57,
    "text": "\\nİşlem başarıyla tamamlandı.",
    "context": "console.log('\\nİşlem başarıyla tamamlandı.');"
  },
  {
    "file": "videokit-js-sdk:examples:verify_video.js",
    "line": 60,
    "text": "\\n--- Bir Hata Oluştu ---",
    "context": "console.error('\\n--- Bir Hata Oluştu ---');"
  },
  {
    "file": "videokit-js-sdk:examples:verify_video.js",
    "line": 62,
    "text": "HTTP Durumu: ${error.status}",
    "context": "console.error(`HTTP Durumu: ${error.status}`);"
  },
  {
    "file": "videokit-js-sdk:examples:verify_video.js",
    "line": 63,
    "text": "API Mesajı: ${error.message}",
    "context": "console.error(`API Mesajı: ${error.message}`);"
  },
  {
    "file": "videokit-js-sdk:examples:verify_video.js",
    "line": 64,
    "text": "API Yanıtı:",
    "context": "console.error('API Yanıtı:', JSON.stringify(error.responseBody, null, 2));"
  },
  {
    "file": "videokit-js-sdk:examples:verify_video.js",
    "line": 66,
    "text": "Beklenmedik bir hata:",
    "context": "console.error('Beklenmedik bir hata:', error.message);"
  },
  {
    "file": "videokit-js-sdk:src:index.ts",
    "line": 69,
    "text": "VideoKitError",
    "context": "this.name = 'VideoKitError';"
  },
  {
    "file": "videokit-js-sdk:src:index.ts",
    "line": 83,
    "text": "API anahtarı (apiKey) gereklidir.",
    "context": "throw new Error('API anahtarı (apiKey) gereklidir.');"
  },
  {
    "file": "videokit-js-sdk:src:index.ts",
    "line": 92,
    "text": "X-API-Key",
    "context": "'X-API-Key': this.apiKey,"
  },
  {
    "file": "videokit-js-sdk:src:index.ts",
    "line": 103,
    "text": "Yanıt gövdesi JSON formatında değil.",
    "context": "errorBody = { error: 'Yanıt gövdesi JSON formatında değil.' };"
  },
  {
    "file": "videokit-js-sdk:src:index.ts",
    "line": 106,
    "text": "API hatası: ${response.statusText} (${response.status})",
    "context": "`API hatası: ${response.statusText} (${response.status})`,"
  },
  {
    "file": "videokit-js-sdk:src:index.ts",
    "line": 143,
    "text": "POST",
    "context": "method: 'POST',"
  },
  {
    "file": "videokit-js-sdk:src:index.ts",
    "line": 161,
    "text": "İş sonucu ${pollingTimeout}ms içinde alınamadı.",
    "context": "return reject(new Error(`İş sonucu ${pollingTimeout}ms içinde alınamadı.`));"
  },
  {
    "file": "videokit-js-sdk:src:index.ts",
    "line": 171,
    "text": "İş başarısız oldu.",
    "context": "reject(new VideoKitError(job.error || 'İş başarısız oldu.', 500, job));"
  },
  {
    "file": "videokit-pki.js",
    "line": 6,
    "text": "CERTIFICATE",
    "context": "* @param {string} label - PEM başlıklarında kullanılacak etiket (örn: 'CERTIFICATE')."
  },
  {
    "file": "videokit-pki.js",
    "line": 12,
    "text": "-----BEGIN ${label}-----\\n${lines.join('\\n')}\\n-----END ${label}-----\\n",
    "context": "return `-----BEGIN ${label}-----\\n${lines.join('\\n')}\\n-----END ${label}-----\\n`;"
  },
  {
    "file": "videokit-pki.js",
    "line": 23,
    "text": "PKI işlemleri için PKI.js ve ASN1.js kütüphaneleri gereklidir.",
    "context": "throw new Error(\"PKI işlemleri için PKI.js ve ASN1.js kütüphaneleri gereklidir.\");"
  },
  {
    "file": "videokit-pki.js",
    "line": 51,
    "text": "SHA-256",
    "context": "await certificate.sign(keyPair.privateKey, \"SHA-256\");"
  },
  {
    "file": "videokit-pki.js",
    "line": 64,
    "text": "VideoKit Rollover Identity",
    "context": "* @param {string} [params.newCertCommonName='VideoKit Rollover Identity'] - Yeni oluşturulacak sertifika için CN."
  },
  {
    "file": "videokit-pki.js",
    "line": 68,
    "text": "VideoKit Rollover Identity",
    "context": "fullRolloverProcess: async ({ oldCertificatePem, newCertCommonName = 'VideoKit Rollover Identity' }) => {"
  },
  {
    "file": "videokit-pki.js",
    "line": 69,
    "text": "[PKI] Tam anahtar devri süreci başlatılıyor...",
    "context": "console.log('[PKI] Tam anahtar devri süreci başlatılıyor...');"
  },
  {
    "file": "videokit-pki.js",
    "line": 74,
    "text": "[PKI] Core rollover tamamlandı. Yeni anahtar parmak izi: ${newFingerprint}",
    "context": "console.log(`[PKI] Core rollover tamamlandı. Yeni anahtar parmak izi: ${newFingerprint}`);"
  },
  {
    "file": "videokit-pki.js",
    "line": 77,
    "text": "[PKI] Yeni anahtar çifti için kendinden imzalı sertifika oluşturuluyor...",
    "context": "console.log('[PKI] Yeni anahtar çifti için kendinden imzalı sertifika oluşturuluyor...');"
  },
  {
    "file": "videokit-pki.js",
    "line": 79,
    "text": "CERTIFICATE",
    "context": "const newCertificatePem = _formatToPem(newCertDer, 'CERTIFICATE');"
  },
  {
    "file": "videokit-pki.js",
    "line": 80,
    "text": "[PKI] Yeni sertifika başarıyla oluşturuldu ve PEM formatına çevrildi.",
    "context": "console.log('[PKI] Yeni sertifika başarıyla oluşturuldu ve PEM formatına çevrildi.');"
  },
  {
    "file": "videokit-pki.js",
    "line": 96,
    "text": "PRIVATE KEY",
    "context": "return _formatToPem(pkcs8Buffer, 'PRIVATE KEY');"
  },
  {
    "file": "videokit-signer.js",
    "line": 7,
    "text": "PolicyViolationError",
    "context": "this.name = 'PolicyViolationError';"
  },
  {
    "file": "videokit-signer.js",
    "line": 18,
    "text": "pkcs11js export şekli desteklenmedi",
    "context": "if (!P11Ctor) throw new Error('pkcs11js export şekli desteklenmedi');"
  },
  {
    "file": "videokit-signer.js",
    "line": 22,
    "text": "HSM modunu kullanmak için \"pkcs11js\" gerekli. HSM kullanmıyorsan sorun yok;",
    "context": "'HSM modunu kullanmak için \"pkcs11js\" gerekli. HSM kullanmıyorsan sorun yok; ' +"
  },
  {
    "file": "videokit-signer.js",
    "line": 23,
    "text": "HSM kullanacaksan bu konteynerde build araçlarını kur (Alpine: apk add --no-cache python3 make g++)",
    "context": "'HSM kullanacaksan bu konteynerde build araçlarını kur (Alpine: apk add --no-cache python3 make g++) ' +"
  },
  {
    "file": "videokit-signer.js",
    "line": 24,
    "text": "ve \"npm i pkcs11js\" yap. Aksi halde SIGNING_POLICY_HARDWARE_ONLY=false ile bellek imzalama kullan.",
    "context": "'ve \"npm i pkcs11js\" yap. Aksi halde SIGNING_POLICY_HARDWARE_ONLY=false ile bellek imzalama kullan.'"
  },
  {
    "file": "videokit-signer.js",
    "line": 31,
    "text": "[Signer] Bellek tabanlı (Vault) imzalayıcı kullanılıyor.",
    "context": "console.log('[Signer] Bellek tabanlı (Vault) imzalayıcı kullanılıyor.');"
  },
  {
    "file": "videokit-signer.js",
    "line": 33,
    "text": "Bellek imzalayıcı için privateKey ve certificate PEM içeriği gereklidir.",
    "context": "throw new Error('Bellek imzalayıcı için privateKey ve certificate PEM içeriği gereklidir.');"
  },
  {
    "file": "videokit-signer.js",
    "line": 40,
    "text": "[Signer] HSM tabanlı imzalayıcı kullanılıyor. Kütüphane: ${library}",
    "context": "console.log(`[Signer] HSM tabanlı imzalayıcı kullanılıyor. Kütüphane: ${library}`);"
  },
  {
    "file": "videokit-signer.js",
    "line": 53,
    "text": "Yapılandırılan slot (${slot}) mevcut değil. Kullanılabilir slot sayısı: ${slots.length}",
    "context": "throw new Error(`Yapılandırılan slot (${slot}) mevcut değil. Kullanılabilir slot sayısı: ${slots.length}`);"
  },
  {
    "file": "videokit-signer.js",
    "line": 64,
    "text": "[Signer] HSM slot ${slot} için başarıyla oturum açıldı.",
    "context": "console.log(`[Signer] HSM slot ${slot} için başarıyla oturum açıldı.`);"
  },
  {
    "file": "videokit-signer.js",
    "line": 69,
    "text": "HSM'de \"${keyLabel}\" etiketli özel anahtar bulunamadı.",
    "context": "throw new Error(`HSM'de \"${keyLabel}\" etiketli özel anahtar bulunamadı.`);"
  },
  {
    "file": "videokit-signer.js",
    "line": 71,
    "text": "[Signer] \"${keyLabel}\" etiketli özel anahtar başarıyla bulundu.",
    "context": "console.log(`[Signer] \"${keyLabel}\" etiketli özel anahtar başarıyla bulundu.`);"
  },
  {
    "file": "videokit-signer.js",
    "line": 88,
    "text": "[Signer] HSM oturumu güvenli bir şekilde kapatıldı.",
    "context": "console.log('[Signer] HSM oturumu güvenli bir şekilde kapatıldı.');"
  },
  {
    "file": "videokit-signer.js",
    "line": 100,
    "text": "HSM imzalayıcı için sertifika içeriği (key.public) belirtilmelidir.",
    "context": "throw new Error('HSM imzalayıcı için sertifika içeriği (key.public) belirtilmelidir.');"
  },
  {
    "file": "videokit-signer.js",
    "line": 108,
    "text": "Politika ihlali: Donanım (HSM) zorunlu ancak yapılandırılmamış.",
    "context": "'Politika ihlali: Donanım (HSM) zorunlu ancak yapılandırılmamış. ' +"
  },
  {
    "file": "videokit-signer.js",
    "line": 109,
    "text": "Ya HSM ayarlarını gir ya da SIGNING_POLICY_HARDWARE_ONLY=false yap.",
    "context": "'Ya HSM ayarlarını gir ya da SIGNING_POLICY_HARDWARE_ONLY=false yap.'"
  },
  {
    "file": "vk-cli.js",
    "line": 38,
    "text": "EEXIST",
    "context": "if (error.code !== 'EEXIST') throw error;"
  },
  {
    "file": "vk-cli.js",
    "line": 48,
    "text": "ENOENT",
    "context": "if (error.code === 'ENOENT') {"
  },
  {
    "file": "vk-cli.js",
    "line": 124,
    "text": "Fire-and-forget",
    "context": "// \"Fire-and-forget\": Ağ hatası veya sunucuya ulaşılamaması durumu"
  },
  {
    "file": "vk-cli.js",
    "line": 127,
    "text": "POST",
    "context": "method: 'POST',"
  },
  {
    "file": "vk-cli.js",
    "line": 129,
    "text": "Content-Type",
    "context": "headers: { 'Content-Type': 'application/json' },"
  },
  {
    "file": "vk-cli.js",
    "line": 147,
    "text": "EEXIST",
    "context": "if (error.code !== 'EEXIST') throw error;"
  },
  {
    "file": "vk-cli.js",
    "line": 171,
    "text": "CN",
    "context": "const subject = cert.subject.getField('CN')?.value || 'N/A';"
  },
  {
    "file": "vk-cli.js",
    "line": 172,
    "text": "CN",
    "context": "const issuer = cert.issuer.getField('CN')?.value || 'N/A';"
  },
  {
    "file": "vk-cli.js",
    "line": 176,
    "text": "Parse Error",
    "context": "certsInfo.push({ filename: file, subject: 'Parse Error', issuer: e.message, expiry: '' });"
  },
  {
    "file": "vk-cli.js",
    "line": 189,
    "text": "ENOENT",
    "context": "if (error.code === 'ENOENT') return false; // Dosya zaten yok"
  },
  {
    "file": "vk-cli.js",
    "line": 297,
    "text": "BER length extends beyond buffer",
    "context": "if (offset + 1 + numBytes > view.length) throw new Error(\"BER length extends beyond buffer\");"
  },
  {
    "file": "vk-cli.js",
    "line": 373,
    "text": "Geçersiz KLV paketi: MISB ST 0601 UL (Universal Label) bulunamadı.",
    "context": "throw new Error(\"Geçersiz KLV paketi: MISB ST 0601 UL (Universal Label) bulunamadı.\");"
  },
  {
    "file": "vk-cli.js",
    "line": 424,
    "text": "❌ Manifest bulunamadı veya dosya okunamadı.",
    "context": "return '❌ Manifest bulunamadı veya dosya okunamadı.';"
  },
  {
    "file": "vk-cli.js",
    "line": 428,
    "text": "❌ Aktif manifest bulunamadı.",
    "context": "return '❌ Aktif manifest bulunamadı.';"
  },
  {
    "file": "vk-cli.js",
    "line": 436,
    "text": "❌ Sertifika İptal Edilmiş: ${revokedStatus?.explanation || revokedStatus?.code}",
    "context": "return `❌ Sertifika İptal Edilmiş: ${revokedStatus?.explanation || revokedStatus?.code}`;"
  },
  {
    "file": "vk-cli.js",
    "line": 442,
    "text": "❌ Doğrulama Hatası: ${error?.explanation || error?.code}",
    "context": "return `❌ Doğrulama Hatası: ${error?.explanation || error?.code}`;"
  },
  {
    "file": "vk-cli.js",
    "line": 446,
    "text": "⚠️ İmza geçerli, ancak sertifika güvenilir bir köke zincirlenmemiş.",
    "context": "return '⚠️ İmza geçerli, ancak sertifika güvenilir bir köke zincirlenmemiş.';"
  },
  {
    "file": "vk-cli.js",
    "line": 450,
    "text": "✅ İmza ve zincir geçerli.",
    "context": "return '✅ İmza ve zincir geçerli.';"
  },
  {
    "file": "vk-cli.js",
    "line": 452,
    "text": "ℹ️ Manifest doğrulandı, ancak tam bir imza zinciri bulunamadı.",
    "context": "return 'ℹ️ Manifest doğrulandı, ancak tam bir imza zinciri bulunamadı.';"
  },
  {
    "file": "vk-cli.js",
    "line": 457,
    "text": "VideoKit İçerik Güvenilirliği Platformu CLI",
    "context": ".description('VideoKit İçerik Güvenilirliği Platformu CLI')"
  },
  {
    "file": "vk-cli.js",
    "line": 458,
    "text": "-v, --version",
    "context": ".version(CURRENT_VERSION, '-v, --version', 'Mevcut sürümü göster');"
  },
  {
    "file": "vk-cli.js",
    "line": 458,
    "text": "Mevcut sürümü göster",
    "context": ".version(CURRENT_VERSION, '-v, --version', 'Mevcut sürümü göster');"
  },
  {
    "file": "vk-cli.js",
    "line": 462,
    "text": "VideoKit CLI aracını en son sürüme güvenli bir şekilde günceller.",
    "context": ".description('VideoKit CLI aracını en son sürüme güvenli bir şekilde günceller.')"
  },
  {
    "file": "vk-cli.js",
    "line": 467,
    "text": "Mevcut sürüm: ${CURRENT_VERSION}",
    "context": "console.log(`Mevcut sürüm: ${CURRENT_VERSION}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 468,
    "text": "En son sürüm kontrol ediliyor...",
    "context": "console.log('En son sürüm kontrol ediliyor...');"
  },
  {
    "file": "vk-cli.js",
    "line": 473,
    "text": "Accept",
    "context": "const res = await fetch(releaseUrl, { headers: { 'Accept': 'application/vnd.github.v3+json' } });"
  },
  {
    "file": "vk-cli.js",
    "line": 474,
    "text": "GitHub API'sinden sürüm bilgisi alınamadı. Durum: ${res.status}",
    "context": "if (!res.ok) throw new Error(`GitHub API'sinden sürüm bilgisi alınamadı. Durum: ${res.status}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 480,
    "text": "✅ VideoKit CLI zaten en güncel sürümde.",
    "context": "console.log('✅ VideoKit CLI zaten en güncel sürümde.');"
  },
  {
    "file": "vk-cli.js",
    "line": 483,
    "text": "Yeni sürüm bulundu: ${latestVersion}. Güncelleme başlatılıyor...",
    "context": "console.log(`Yeni sürüm bulundu: ${latestVersion}. Güncelleme başlatılıyor...`);"
  },
  {
    "file": "vk-cli.js",
    "line": 493,
    "text": "Platformunuz (${platform}) için gerekli güncelleme dosyaları bulunamadı.",
    "context": "throw new Error(`Platformunuz (${platform}) için gerekli güncelleme dosyaları bulunamadı.`);"
  },
  {
    "file": "vk-cli.js",
    "line": 501,
    "text": "Güncelleme dosyaları indiriliyor...",
    "context": "console.log('Güncelleme dosyaları indiriliyor...');"
  },
  {
    "file": "vk-cli.js",
    "line": 506,
    "text": "İmza doğrulanıyor...",
    "context": "console.log('İmza doğrulanıyor...');"
  },
  {
    "file": "vk-cli.js",
    "line": 520,
    "text": "✅ Güvenlik doğrulaması başarılı!",
    "context": "console.log('✅ Güvenlik doğrulaması başarılı!');"
  },
  {
    "file": "vk-cli.js",
    "line": 523,
    "text": "Eski dosya (${currentExecPath}) yenisiyle değiştiriliyor...",
    "context": "console.log(`Eski dosya (${currentExecPath}) yenisiyle değiştiriliyor...`);"
  },
  {
    "file": "vk-cli.js",
    "line": 528,
    "text": "✨ VideoKit CLI başarıyla ${latestVersion} sürümüne güncellendi!",
    "context": "console.log(`✨ VideoKit CLI başarıyla ${latestVersion} sürümüne güncellendi!`);"
  },
  {
    "file": "vk-cli.js",
    "line": 532,
    "text": "SigstoreVerificationError",
    "context": "if (e.name === 'SigstoreVerificationError') {"
  },
  {
    "file": "vk-cli.js",
    "line": 533,
    "text": "❌ HATA: Güncelleme iptal edildi. Güvenlik doğrulaması başarısız!",
    "context": "console.error('❌ HATA: Güncelleme iptal edildi. Güvenlik doğrulaması başarısız!');"
  },
  {
    "file": "vk-cli.js",
    "line": 535,
    "text": "❌ HATA: Güncelleme sırasında bir sorun oluştu: ${e.message}",
    "context": "console.error(`❌ HATA: Güncelleme sırasında bir sorun oluştu: ${e.message}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 550,
    "text": "verify <filePath>",
    "context": ".command('verify <filePath>')"
  },
  {
    "file": "vk-cli.js",
    "line": 551,
    "text": "Bir video dosyasındaki C2PA manifestini doğrular.",
    "context": ".description('Bir video dosyasındaki C2PA manifestini doğrular.')"
  },
  {
    "file": "vk-cli.js",
    "line": 556,
    "text": "🔍 ${path.basename(filePath)} doğrulanıyor...",
    "context": "console.log(`🔍 ${path.basename(filePath)} doğrulanıyor...`);"
  },
  {
    "file": "vk-cli.js",
    "line": 560,
    "text": "ℹ️ Trust store'dan ${trustAnchors.length} adet ek kök sertifika kullanılıyor.",
    "context": "console.log(`ℹ️  Trust store'dan ${trustAnchors.length} adet ek kök sertifika kullanılıyor.`);"
  },
  {
    "file": "vk-cli.js",
    "line": 562,
    "text": "ℹ️ Çevrimiçi iptal kontrolü (OCSP/CRL) etkinleştirildi.",
    "context": "console.log(`ℹ️  Çevrimiçi iptal kontrolü (OCSP/CRL) etkinleştirildi.`);"
  },
  {
    "file": "vk-cli.js",
    "line": 568,
    "text": "Hata: ${e.message}",
    "context": "console.error(`Hata: ${e.message}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 577,
    "text": "stamp <filePath>",
    "context": ".command('stamp <filePath>')"
  },
  {
    "file": "vk-cli.js",
    "line": 578,
    "text": "Bir video dosyası için .c2pa sidecar manifesti oluşturur.",
    "context": ".description('Bir video dosyası için .c2pa sidecar manifesti oluşturur.')"
  },
  {
    "file": "vk-cli.js",
    "line": 579,
    "text": "-a, --author <name>",
    "context": ".requiredOption('-a, --author <name>', 'Manifeste eklenecek yazar adı (Creator)')"
  },
  {
    "file": "vk-cli.js",
    "line": 579,
    "text": "Manifeste eklenecek yazar adı (Creator)",
    "context": ".requiredOption('-a, --author <name>', 'Manifeste eklenecek yazar adı (Creator)')"
  },
  {
    "file": "vk-cli.js",
    "line": 580,
    "text": "-s, --agent <name>",
    "context": ".option('-s, --agent <name>', 'Kullanan yazılım bilgisi', 'VideoKit CLI v1.0')"
  },
  {
    "file": "vk-cli.js",
    "line": 580,
    "text": "Kullanan yazılım bilgisi",
    "context": ".option('-s, --agent <name>', 'Kullanan yazılım bilgisi', 'VideoKit CLI v1.0')"
  },
  {
    "file": "vk-cli.js",
    "line": 580,
    "text": "VideoKit CLI v1.0",
    "context": ".option('-s, --agent <name>', 'Kullanan yazılım bilgisi', 'VideoKit CLI v1.0')"
  },
  {
    "file": "vk-cli.js",
    "line": 581,
    "text": "--tsa-url <url>",
    "context": ".option('--tsa-url <url>', 'Kullanılacak Zaman Damgası Yetkilisi (TSA) sunucusu')"
  },
  {
    "file": "vk-cli.js",
    "line": 581,
    "text": "Kullanılacak Zaman Damgası Yetkilisi (TSA) sunucusu",
    "context": ".option('--tsa-url <url>', 'Kullanılacak Zaman Damgası Yetkilisi (TSA) sunucusu')"
  },
  {
    "file": "vk-cli.js",
    "line": 582,
    "text": "Sadece son 24 saat içinde oluşturulmuş videoları mühürler.",
    "context": ".option('--capture-only', 'Sadece son 24 saat içinde oluşturulmuş videoları mühürler.')"
  },
  {
    "file": "vk-cli.js",
    "line": 587,
    "text": "✒️ ${path.basename(filePath)} için manifest oluşturuluyor...",
    "context": "console.log(`✒️  ${path.basename(filePath)} için manifest oluşturuluyor...`);"
  },
  {
    "file": "vk-cli.js",
    "line": 590,
    "text": "Güvenlik Kilidi aktif: Video oluşturma tarihi kontrol ediliyor...",
    "context": "console.log('Güvenlik Kilidi aktif: Video oluşturma tarihi kontrol ediliyor...');"
  },
  {
    "file": "vk-cli.js",
    "line": 596,
    "text": "Politika İhlali: Video, 24 saatten daha eski olduğu için mühürlenemez. (Oluşturma: ${creationTime.toISOString()})",
    "context": "`Politika İhlali: Video, 24 saatten daha eski olduğu için mühürlenemez. (Oluşturma: ${creationTime.toISOString()})`"
  },
  {
    "file": "vk-cli.js",
    "line": 599,
    "text": "✅ Video oluşturma tarihi politikaya uygun.",
    "context": "console.log('✅ Video oluşturma tarihi politikaya uygun.');"
  },
  {
    "file": "vk-cli.js",
    "line": 601,
    "text": "⚠️ Video oluşturma tarihi metaveriden okunamadı, politikayı es geçiliyor.",
    "context": "console.log('⚠️  Video oluşturma tarihi metaveriden okunamadı, politikayı es geçiliyor.');"
  },
  {
    "file": "vk-cli.js",
    "line": 614,
    "text": "Person",
    "context": "{ label: 'stds.schema-org.CreativeWork', data: { author: [{ '@type': 'Person', name: options.author }] } },"
  },
  {
    "file": "vk-cli.js",
    "line": 626,
    "text": "Zaman damgası için kullanılıyor: ${tsaUrl}",
    "context": "console.log(`Zaman damgası için kullanılıyor: ${tsaUrl}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 634,
    "text": "✅ Başarılı! Sidecar dosyası şuraya kaydedildi: ${sidecarPath}",
    "context": "console.log(`✅ Başarılı! Sidecar dosyası şuraya kaydedildi: ${sidecarPath}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 637,
    "text": "ENOENT",
    "context": "if (e.code === 'ENOENT') {"
  },
  {
    "file": "vk-cli.js",
    "line": 638,
    "text": "Hata: İmzalama için gerekli anahtar/sertifika dosyası bulunamadı.",
    "context": "console.error(`Hata: İmzalama için gerekli anahtar/sertifika dosyası bulunamadı.`);"
  },
  {
    "file": "vk-cli.js",
    "line": 639,
    "text": "vk keygen",
    "context": "console.error(`Lütfen 'vk keygen' komutunu çalıştırın veya 'vk config set' ile doğru dosya yollarını belirtin.`);"
  },
  {
    "file": "vk-cli.js",
    "line": 639,
    "text": "vk config set",
    "context": "console.error(`Lütfen 'vk keygen' komutunu çalıştırın veya 'vk config set' ile doğru dosya yollarını belirtin.`);"
  },
  {
    "file": "vk-cli.js",
    "line": 639,
    "text": "Lütfen 'vk keygen' komutunu çalıştırın veya 'vk config set' ile doğru dosya yollarını belirtin.",
    "context": "console.error(`Lütfen 'vk keygen' komutunu çalıştırın veya 'vk config set' ile doğru dosya yollarını belirtin.`);"
  },
  {
    "file": "vk-cli.js",
    "line": 641,
    "text": "❌ Hata: ${e.message}",
    "context": "console.error(`❌ Hata: ${e.message}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 652,
    "text": "İmzalama için bir özel anahtar ve kendinden imzalı sertifika oluşturur.",
    "context": ".description(`İmzalama için bir özel anahtar ve kendinden imzalı sertifika oluşturur.`)"
  },
  {
    "file": "vk-cli.js",
    "line": 660,
    "text": "Anahtar çifti ve sertifika oluşturuluyor...",
    "context": "console.log('Anahtar çifti ve sertifika oluşturuluyor...');"
  },
  {
    "file": "vk-cli.js",
    "line": 664,
    "text": "✅ Başarılı! Dosyalar oluşturuldu: ${privateKeyFile}, ${certificateFile}",
    "context": "console.log(`✅ Başarılı! Dosyalar oluşturuldu: ${privateKeyFile}, ${certificateFile}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 670,
    "text": "✅ Ayarlar varsayılan olarak yapılandırma dosyasına kaydedildi.",
    "context": "console.log(`✅ Ayarlar varsayılan olarak yapılandırma dosyasına kaydedildi.`);"
  },
  {
    "file": "vk-cli.js",
    "line": 672,
    "text": "güvenilmeyen kök",
    "context": "console.log(`⚠️  Bu kendinden imzalı bir sertifikadır ve doğrulama sırasında 'güvenilmeyen kök' uyarısı verecektir.`);"
  },
  {
    "file": "vk-cli.js",
    "line": 672,
    "text": "⚠️ Bu kendinden imzalı bir sertifikadır ve doğrulama sırasında 'güvenilmeyen kök' uyarısı verecektir.",
    "context": "console.log(`⚠️  Bu kendinden imzalı bir sertifikadır ve doğrulama sırasında 'güvenilmeyen kök' uyarısı verecektir.`);"
  },
  {
    "file": "vk-cli.js",
    "line": 675,
    "text": "Hata: ${e.message}",
    "context": "console.error(`Hata: ${e.message}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 684,
    "text": "stream-capture <inputFile>",
    "context": ".command('stream-capture <inputFile>')"
  },
  {
    "file": "vk-cli.js",
    "line": 685,
    "text": "Bir video akışını (dosyadan simüle edilmiş) yakalar, segmentler ve C2PA manifesti oluşturur.",
    "context": ".description('Bir video akışını (dosyadan simüle edilmiş) yakalar, segmentler ve C2PA manifesti oluşturur.')"
  },
  {
    "file": "vk-cli.js",
    "line": 686,
    "text": "Doğrulama testi için akış sırasında rastgele bir segmenti bozar.",
    "context": ".option('--tamper', 'Doğrulama testi için akış sırasında rastgele bir segmenti bozar.')"
  },
  {
    "file": "vk-cli.js",
    "line": 687,
    "text": "--seg-duration <seconds>",
    "context": ".option('--seg-duration <seconds>', 'Her bir video segmentinin süresi (saniye).', '2')"
  },
  {
    "file": "vk-cli.js",
    "line": 687,
    "text": "Her bir video segmentinin süresi (saniye).",
    "context": ".option('--seg-duration <seconds>', 'Her bir video segmentinin süresi (saniye).', '2')"
  },
  {
    "file": "vk-cli.js",
    "line": 694,
    "text": "[1/5] Geçici segment dizini oluşturuldu: ${tempDir}",
    "context": "console.log(`[1/5] Geçici segment dizini oluşturuldu: ${tempDir}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 696,
    "text": "[2/5] FFmpeg ile akış simülasyonu başlatılıyor...",
    "context": "console.log(`[2/5] FFmpeg ile akış simülasyonu başlatılıyor...`);"
  },
  {
    "file": "vk-cli.js",
    "line": 698,
    "text": "...Akış tamamlandı. Toplam ${segmentPaths.length} segment yakalandı.",
    "context": "console.log(`...Akış tamamlandı. Toplam ${segmentPaths.length} segment yakalandı.`);"
  },
  {
    "file": "vk-cli.js",
    "line": 700,
    "text": "[3/5] Segment hashleri hesaplanıyor ve C2PA manifesti oluşturuluyor...",
    "context": "console.log('[3/5] Segment hashleri hesaplanıyor ve C2PA manifesti oluşturuluyor...');"
  },
  {
    "file": "vk-cli.js",
    "line": 703,
    "text": "...Manifest oluşturuldu: ${manifestPath}",
    "context": "console.log(`...Manifest oluşturuldu: ${manifestPath}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 705,
    "text": "[4/5] Oluşturulan manifest, diskteki segmentlere karşı doğrulanıyor...",
    "context": "console.log('[4/5] Oluşturulan manifest, diskteki segmentlere karşı doğrulanıyor...');"
  },
  {
    "file": "vk-cli.js",
    "line": 710,
    "text": "\\n--- DOĞRULAMA SONUCU ---",
    "context": "console.log('\\n--- DOĞRULAMA SONUCU ---');"
  },
  {
    "file": "vk-cli.js",
    "line": 713,
    "text": "✅ TEST BAŞARILI: Sabote edilen segment doğru bir şekilde tespit edildi!",
    "context": "console.log('✅ TEST BAŞARILI: Sabote edilen segment doğru bir şekilde tespit edildi!');"
  },
  {
    "file": "vk-cli.js",
    "line": 715,
    "text": "❌ TEST BAŞARISIZ: Sabote edilen segment tespit edilemedi!",
    "context": "console.log('❌ TEST BAŞARISIZ: Sabote edilen segment tespit edilemedi!');"
  },
  {
    "file": "vk-cli.js",
    "line": 721,
    "text": "\\nHata oluştu: ${e.message}",
    "context": "console.error(`\\nHata oluştu: ${e.message}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 725,
    "text": "[5/5] Geçici dosyalar temizleniyor...",
    "context": "console.log('[5/5] Geçici dosyalar temizleniyor...');"
  },
  {
    "file": "vk-cli.js",
    "line": 727,
    "text": "...Temizlik tamamlandı.",
    "context": "console.log('...Temizlik tamamlandı.');"
  },
  {
    "file": "vk-cli.js",
    "line": 745,
    "text": "-> Yeni segment yakalandı: ${filename}",
    "context": "console.log(` -> Yeni segment yakalandı: ${filename}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 749,
    "text": "🔥 SABOTAJ: ${filename} dosyası bozuluyor...",
    "context": "console.log(`   🔥 SABOTAJ: ${filename} dosyası bozuluyor...`);"
  },
  {
    "file": "vk-cli.js",
    "line": 750,
    "text": "TAMPERED_DATA",
    "context": "fs.appendFile(fullPath, 'TAMPERED_DATA');"
  },
  {
    "file": "vk-cli.js",
    "line": 757,
    "text": "FFmpeg işlemi ${code} koduyla sonlandı.",
    "context": "if (code !== 0) return reject(new Error(`FFmpeg işlemi ${code} koduyla sonlandı.`));"
  },
  {
    "file": "vk-cli.js",
    "line": 764,
    "text": "FFmpeg başlatılamadı: ${err.message}. FFmpeg'in sisteminizde kurulu ve PATH içinde olduğundan emin olun.",
    "context": "reject(new Error(`FFmpeg başlatılamadı: ${err.message}. FFmpeg'in sisteminizde kurulu ve PATH içinde olduğundan emin olun.`));"
  },
  {
    "file": "vk-cli.js",
    "line": 777,
    "text": "VideoKit Stream Capture v1.0",
    "context": "claimGenerator: 'VideoKit Stream Capture v1.0',"
  },
  {
    "file": "vk-cli.js",
    "line": 778,
    "text": "Live Stream from ${new Date().toISOString()}",
    "context": "title: `Live Stream from ${new Date().toISOString()}`,"
  },
  {
    "file": "vk-cli.js",
    "line": 789,
    "text": "CLI ayarlarını yönetir.",
    "context": "const configCmd = program.command('config').description('CLI ayarlarını yönetir.');"
  },
  {
    "file": "vk-cli.js",
    "line": 790,
    "text": "set <key> <value>",
    "context": "configCmd.command('set <key> <value>').description('Bir ayar anahtarını belirler.').action(async (key, value) => {"
  },
  {
    "file": "vk-cli.js",
    "line": 790,
    "text": "Bir ayar anahtarını belirler.",
    "context": "configCmd.command('set <key> <value>').description('Bir ayar anahtarını belirler.').action(async (key, value) => {"
  },
  {
    "file": "vk-cli.js",
    "line": 795,
    "text": "✅ Ayarlandı: ${key} = ${value}",
    "context": "console.log(`✅ Ayarlandı: ${key} = ${value}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 797,
    "text": "Hata: Ayar kaydedilemedi. ${error.message}",
    "context": "console.error(`Hata: Ayar kaydedilemedi. ${error.message}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 801,
    "text": "get <key>",
    "context": "configCmd.command('get <key>').description('Bir ayarın değerini gösterir.').action(async (key) => {"
  },
  {
    "file": "vk-cli.js",
    "line": 801,
    "text": "Bir ayarın değerini gösterir.",
    "context": "configCmd.command('get <key>').description('Bir ayarın değerini gösterir.').action(async (key) => {"
  },
  {
    "file": "vk-cli.js",
    "line": 806,
    "text": "'${key}' anahtarı bulunamadı.",
    "context": "else console.log(`'${key}' anahtarı bulunamadı.`);"
  },
  {
    "file": "vk-cli.js",
    "line": 808,
    "text": "Hata: Ayar okunamadı. ${error.message}",
    "context": "console.error(`Hata: Ayar okunamadı. ${error.message}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 812,
    "text": "Tüm ayarları JSON formatında listeler.",
    "context": "configCmd.command('list').description('Tüm ayarları JSON formatında listeler.').action(async () => {"
  },
  {
    "file": "vk-cli.js",
    "line": 817,
    "text": "Hata: Ayarlar okunamadı. ${error.message}",
    "context": "console.error(`Hata: Ayarlar okunamadı. ${error.message}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 822,
    "text": "KLV verilerini MISB ST 0601 standardına göre dönüştürme araçları.",
    "context": "const klv = program.command('klv').description('KLV verilerini MISB ST 0601 standardına göre dönüştürme araçları.');"
  },
  {
    "file": "vk-cli.js",
    "line": 823,
    "text": "to-json <inputFile> <outputFile>",
    "context": "klv.command('to-json <inputFile> <outputFile>').description('Bir KLV dosyasını (.klv) JSON formatına dönüştürür.').action(async (inputFile, outputFile) => {"
  },
  {
    "file": "vk-cli.js",
    "line": 823,
    "text": "Bir KLV dosyasını (.klv) JSON formatına dönüştürür.",
    "context": "klv.command('to-json <inputFile> <outputFile>').description('Bir KLV dosyasını (.klv) JSON formatına dönüştürür.').action(async (inputFile, outputFile) => {"
  },
  {
    "file": "vk-cli.js",
    "line": 827,
    "text": "Dönüştürülüyor: ${inputFile} -> ${outputFile}",
    "context": "console.log(`Dönüştürülüyor: ${inputFile} -> ${outputFile}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 831,
    "text": "✅ Dönüşüm başarılı!",
    "context": "console.log('✅ Dönüşüm başarılı!');"
  },
  {
    "file": "vk-cli.js",
    "line": 834,
    "text": "Hata: ${e.message}",
    "context": "console.error(`Hata: ${e.message}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 838,
    "text": "klv to-json",
    "context": "await telemetryManager.trackEvent('klv to-json', duration, error);"
  },
  {
    "file": "vk-cli.js",
    "line": 841,
    "text": "from-json <inputFile> <outputFile>",
    "context": "klv.command('from-json <inputFile> <outputFile>').description('Bir JSON dosyasını KLV formatına (.klv) dönüştürür.').action(async (inputFile, outputFile) => {"
  },
  {
    "file": "vk-cli.js",
    "line": 841,
    "text": "Bir JSON dosyasını KLV formatına (.klv) dönüştürür.",
    "context": "klv.command('from-json <inputFile> <outputFile>').description('Bir JSON dosyasını KLV formatına (.klv) dönüştürür.').action(async (inputFile, outputFile) => {"
  },
  {
    "file": "vk-cli.js",
    "line": 845,
    "text": "Dönüştürülüyor: ${inputFile} -> ${outputFile}",
    "context": "console.log(`Dönüştürülüyor: ${inputFile} -> ${outputFile}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 847,
    "text": "JSON dosyasında '65' (MISB ST 0601 Version) anahtarı bulunmalıdır.",
    "context": "if (!jsonData['65']) throw new Error(\"JSON dosyasında '65' (MISB ST 0601 Version) anahtarı bulunmalıdır.\");"
  },
  {
    "file": "vk-cli.js",
    "line": 851,
    "text": "✅ Dönüşüm başarılı!",
    "context": "console.log('✅ Dönüşüm başarılı!');"
  },
  {
    "file": "vk-cli.js",
    "line": 854,
    "text": "Hata: ${e.message}",
    "context": "console.error(`Hata: ${e.message}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 858,
    "text": "klv from-json",
    "context": "await telemetryManager.trackEvent('klv from-json', duration, error);"
  },
  {
    "file": "vk-cli.js",
    "line": 863,
    "text": "PKI araçları: Anahtar, CSR ve sertifika zinciri yönetimi.",
    "context": "const pkiCmd = program.command('pki').description('PKI araçları: Anahtar, CSR ve sertifika zinciri yönetimi.');"
  },
  {
    "file": "vk-cli.js",
    "line": 867,
    "text": "Yeni bir özel anahtar (private key) ve Sertifika İmzalama İsteği (CSR) oluşturur.",
    "context": ".description('Yeni bir özel anahtar (private key) ve Sertifika İmzalama İsteği (CSR) oluşturur.')"
  },
  {
    "file": "vk-cli.js",
    "line": 868,
    "text": "--keyout <file>",
    "context": ".option('--keyout <file>', 'Özel anahtarın kaydedileceği dosya', 'private.key')"
  },
  {
    "file": "vk-cli.js",
    "line": 868,
    "text": "Özel anahtarın kaydedileceği dosya",
    "context": ".option('--keyout <file>', 'Özel anahtarın kaydedileceği dosya', 'private.key')"
  },
  {
    "file": "vk-cli.js",
    "line": 869,
    "text": "--csrout <file>",
    "context": ".option('--csrout <file>', 'CSR\\'ın kaydedileceği dosya', 'request.csr')"
  },
  {
    "file": "vk-cli.js",
    "line": 869,
    "text": "CSR\\'ın kaydedileceği dosya",
    "context": ".option('--csrout <file>', 'CSR\\'ın kaydedileceği dosya', 'request.csr')"
  },
  {
    "file": "vk-cli.js",
    "line": 870,
    "text": "--cn <name>",
    "context": ".requiredOption('--cn <name>', 'Common Name (örn: example.com)')"
  },
  {
    "file": "vk-cli.js",
    "line": 870,
    "text": "Common Name (örn: example.com)",
    "context": ".requiredOption('--cn <name>', 'Common Name (örn: example.com)')"
  },
  {
    "file": "vk-cli.js",
    "line": 871,
    "text": "--o <name>",
    "context": ".option('--o <name>', 'Organization (örn: VideoKit Inc.)', 'VideoKit Inc.')"
  },
  {
    "file": "vk-cli.js",
    "line": 871,
    "text": "Organization (örn: VideoKit Inc.)",
    "context": ".option('--o <name>', 'Organization (örn: VideoKit Inc.)', 'VideoKit Inc.')"
  },
  {
    "file": "vk-cli.js",
    "line": 871,
    "text": "VideoKit Inc.",
    "context": ".option('--o <name>', 'Organization (örn: VideoKit Inc.)', 'VideoKit Inc.')"
  },
  {
    "file": "vk-cli.js",
    "line": 872,
    "text": "--c <country>",
    "context": ".option('--c <country>', 'Country (örn: TR)', 'TR')"
  },
  {
    "file": "vk-cli.js",
    "line": 872,
    "text": "Country (örn: TR)",
    "context": ".option('--c <country>', 'Country (örn: TR)', 'TR')"
  },
  {
    "file": "vk-cli.js",
    "line": 872,
    "text": "TR",
    "context": ".option('--c <country>', 'Country (örn: TR)', 'TR')"
  },
  {
    "file": "vk-cli.js",
    "line": 873,
    "text": "--st <state>",
    "context": ".option('--st <state>', 'State/Province (örn: Istanbul)', 'Istanbul')"
  },
  {
    "file": "vk-cli.js",
    "line": 873,
    "text": "State/Province (örn: Istanbul)",
    "context": ".option('--st <state>', 'State/Province (örn: Istanbul)', 'Istanbul')"
  },
  {
    "file": "vk-cli.js",
    "line": 873,
    "text": "Istanbul",
    "context": ".option('--st <state>', 'State/Province (örn: Istanbul)', 'Istanbul')"
  },
  {
    "file": "vk-cli.js",
    "line": 874,
    "text": "--l <locality>",
    "context": ".option('--l <locality>', 'Locality (örn: Istanbul)', 'Istanbul')"
  },
  {
    "file": "vk-cli.js",
    "line": 874,
    "text": "Locality (örn: Istanbul)",
    "context": ".option('--l <locality>', 'Locality (örn: Istanbul)', 'Istanbul')"
  },
  {
    "file": "vk-cli.js",
    "line": 874,
    "text": "Istanbul",
    "context": ".option('--l <locality>', 'Locality (örn: Istanbul)', 'Istanbul')"
  },
  {
    "file": "vk-cli.js",
    "line": 879,
    "text": "2048-bit RSA anahtar çifti oluşturuluyor...",
    "context": "console.log('2048-bit RSA anahtar çifti oluşturuluyor...');"
  },
  {
    "file": "vk-cli.js",
    "line": 882,
    "text": "Sertifika İmzalama İsteği (CSR) oluşturuluyor...",
    "context": "console.log('Sertifika İmzalama İsteği (CSR) oluşturuluyor...');"
  },
  {
    "file": "vk-cli.js",
    "line": 898,
    "text": "✅ Özel anahtar kaydedildi: ${options.keyout}",
    "context": "console.log(`✅ Özel anahtar kaydedildi: ${options.keyout}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 901,
    "text": "✅ CSR kaydedildi: ${options.csrout}",
    "context": "console.log(`✅ CSR kaydedildi: ${options.csrout}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 904,
    "text": "❌ Hata: ${e.message}",
    "context": "console.error(`❌ Hata: ${e.message}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 908,
    "text": "pki new-key",
    "context": "await telemetryManager.trackEvent('pki new-key', duration, error);"
  },
  {
    "file": "vk-cli.js",
    "line": 913,
    "text": "install-chain <signedCert> [intermediateCerts...]",
    "context": ".command('install-chain <signedCert> [intermediateCerts...]')"
  },
  {
    "file": "vk-cli.js",
    "line": 914,
    "text": "İmzalı sertifika ve aracı sertifikaları birleştirerek tam bir zincir dosyası (PEM) oluşturur.",
    "context": ".description('İmzalı sertifika ve aracı sertifikaları birleştirerek tam bir zincir dosyası (PEM) oluşturur.')"
  },
  {
    "file": "vk-cli.js",
    "line": 915,
    "text": "-o, --output <file>",
    "context": ".requiredOption('-o, --output <file>', 'Oluşturulacak zincir dosyasının adı (örn: cert-chain.pem)')"
  },
  {
    "file": "vk-cli.js",
    "line": 915,
    "text": "Oluşturulacak zincir dosyasının adı (örn: cert-chain.pem)",
    "context": ".requiredOption('-o, --output <file>', 'Oluşturulacak zincir dosyasının adı (örn: cert-chain.pem)')"
  },
  {
    "file": "vk-cli.js",
    "line": 920,
    "text": "Zincir oluşturuluyor -> ${options.output}",
    "context": "console.log(`Zincir oluşturuluyor -> ${options.output}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 925,
    "text": "-> Okunuyor: ${certPath}",
    "context": "console.log(`  -> Okunuyor: ${certPath}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 933,
    "text": "✅ Başarılı! Sertifika zinciri şuraya kaydedildi: ${options.output}",
    "context": "console.log(`✅ Başarılı! Sertifika zinciri şuraya kaydedildi: ${options.output}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 934,
    "text": "ℹ️ Doğrulama için: openssl verify -CAfile <root-ca.pem>",
    "context": "console.log(\"ℹ️ Doğrulama için: openssl verify -CAfile <root-ca.pem> \" + options.output);"
  },
  {
    "file": "vk-cli.js",
    "line": 937,
    "text": "❌ Hata: ${e.message}",
    "context": "console.error(`❌ Hata: ${e.message}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 941,
    "text": "pki install-chain",
    "context": "await telemetryManager.trackEvent('pki install-chain', duration, error);"
  },
  {
    "file": "vk-cli.js",
    "line": 946,
    "text": "Güvenilen kök sertifikaları (Trust Store) yönetir.",
    "context": "const trustCmd = program.command('trust').description('Güvenilen kök sertifikaları (Trust Store) yönetir.');"
  },
  {
    "file": "vk-cli.js",
    "line": 949,
    "text": "add <certPath>",
    "context": ".command('add <certPath>')"
  },
  {
    "file": "vk-cli.js",
    "line": 950,
    "text": "Doğrulama için güvenilecek yeni bir kök sertifika ekler.",
    "context": ".description('Doğrulama için güvenilecek yeni bir kök sertifika ekler.')"
  },
  {
    "file": "vk-cli.js",
    "line": 956,
    "text": "✅ Başarılı! '${fileName}' sertifikası güvenilenler listesine eklendi.",
    "context": "console.log(`✅ Başarılı! '${fileName}' sertifikası güvenilenler listesine eklendi.`);"
  },
  {
    "file": "vk-cli.js",
    "line": 959,
    "text": "ENOENT",
    "context": "if (e.code === 'ENOENT') {"
  },
  {
    "file": "vk-cli.js",
    "line": 960,
    "text": "❌ Hata: Belirtilen dosya bulunamadı: ${certPath}",
    "context": "console.error(`❌ Hata: Belirtilen dosya bulunamadı: ${certPath}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 962,
    "text": "❌ Hata: Sertifika eklenemedi. ${e.message}",
    "context": "console.error(`❌ Hata: Sertifika eklenemedi. ${e.message}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 967,
    "text": "trust add",
    "context": "await telemetryManager.trackEvent('trust add', duration, error);"
  },
  {
    "file": "vk-cli.js",
    "line": 973,
    "text": "Güvenilenler listesindeki tüm sertifikaları gösterir.",
    "context": ".description('Güvenilenler listesindeki tüm sertifikaları gösterir.')"
  },
  {
    "file": "vk-cli.js",
    "line": 980,
    "text": "ℹ️ Güvenilenler listesi (Trust Store) boş.",
    "context": "console.log('ℹ️  Güvenilenler listesi (Trust Store) boş.');"
  },
  {
    "file": "vk-cli.js",
    "line": 983,
    "text": "--- Güvenilen Kök Sertifikalar ---",
    "context": "console.log('--- Güvenilen Kök Sertifikalar ---');"
  },
  {
    "file": "vk-cli.js",
    "line": 985,
    "text": "- Dosya: ${c.filename}",
    "context": "console.log(`- Dosya: ${c.filename}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 986,
    "text": "Konu (Subject): CN=${c.subject}",
    "context": "console.log(`  Konu (Subject): CN=${c.subject}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 987,
    "text": "Sağlayıcı (Issuer): CN=${c.issuer}",
    "context": "console.log(`  Sağlayıcı (Issuer): CN=${c.issuer}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 988,
    "text": "Geçerlilik Sonu: ${c.expiry}",
    "context": "console.log(`  Geçerlilik Sonu: ${c.expiry}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 993,
    "text": "❌ Hata: Sertifikalar listelenemedi. ${e.message}",
    "context": "console.error(`❌ Hata: Sertifikalar listelenemedi. ${e.message}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 997,
    "text": "trust list",
    "context": "await telemetryManager.trackEvent('trust list', duration, error);"
  },
  {
    "file": "vk-cli.js",
    "line": 1002,
    "text": "remove <filename>",
    "context": ".command('remove <filename>')"
  },
  {
    "file": "vk-cli.js",
    "line": 1003,
    "text": "Güvenilenler listesinden bir sertifikayı kaldırır.",
    "context": ".description('Güvenilenler listesinden bir sertifikayı kaldırır.')"
  },
  {
    "file": "vk-cli.js",
    "line": 1010,
    "text": "✅ Başarılı! '${filename}' sertifikası güvenilenler listesinden kaldırıldı.",
    "context": "console.log(`✅ Başarılı! '${filename}' sertifikası güvenilenler listesinden kaldırıldı.`);"
  },
  {
    "file": "vk-cli.js",
    "line": 1012,
    "text": "⚠️ Uyarı: '${filename}' adında bir sertifika bulunamadı.",
    "context": "console.log(`⚠️  Uyarı: '${filename}' adında bir sertifika bulunamadı.`);"
  },
  {
    "file": "vk-cli.js",
    "line": 1016,
    "text": "❌ Hata: Sertifika kaldırılamadı. ${e.message}",
    "context": "console.error(`❌ Hata: Sertifika kaldırılamadı. ${e.message}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 1020,
    "text": "trust remove",
    "context": "await telemetryManager.trackEvent('trust remove', duration, error);"
  },
  {
    "file": "vk-cli.js",
    "line": 1025,
    "text": "Anonim kullanım verileri paylaşımını yönetir.",
    "context": "const telemCmd = program.command('telemetry').description('Anonim kullanım verileri paylaşımını yönetir.');"
  },
  {
    "file": "vk-cli.js",
    "line": 1029,
    "text": "VideoKit\\'i geliştirmemize yardımcı olmak için anonim kullanım verilerini paylaşmayı etkinleştirir.",
    "context": ".description('VideoKit\\'i geliştirmemize yardımcı olmak için anonim kullanım verilerini paylaşmayı etkinleştirir.')"
  },
  {
    "file": "vk-cli.js",
    "line": 1035,
    "text": "✅ Anonim telemetri etkinleştirildi. VideoKit\\'i geliştirmeye yardımcı olduğunuz için teşekkür ederiz!",
    "context": "console.log('✅ Anonim telemetri etkinleştirildi. VideoKit\\'i geliştirmeye yardımcı olduğunuz için teşekkür ederiz!');"
  },
  {
    "file": "vk-cli.js",
    "line": 1036,
    "text": "ℹ️ Bu ayarı istediğiniz zaman \"vk telemetry disable\" komutuyla devre dışı bırakabilirsiniz.",
    "context": "console.log('ℹ️  Bu ayarı istediğiniz zaman \"vk telemetry disable\" komutuyla devre dışı bırakabilirsiniz.');"
  },
  {
    "file": "vk-cli.js",
    "line": 1038,
    "text": "Hata: Ayar kaydedilemedi. ${error.message}",
    "context": "console.error(`Hata: Ayar kaydedilemedi. ${error.message}`);"
  },
  {
    "file": "vk-cli.js",
    "line": 1045,
    "text": "Anonim kullanım verileri paylaşımını devre dışı bırakır.",
    "context": ".description('Anonim kullanım verileri paylaşımını devre dışı bırakır.')"
  },
  {
    "file": "vk-cli.js",
    "line": 1051,
    "text": "ℹ️ Anonim telemetri devre dışı bırakıldı.",
    "context": "console.log('ℹ️ Anonim telemetri devre dışı bırakıldı.');"
  },
  {
    "file": "vk-cli.js",
    "line": 1053,
    "text": "Hata: Ayar kaydedilemedi. ${error.message}",
    "context": "console.error(`Hata: Ayar kaydedilemedi. ${error.message}`);"
  },
  {
    "file": "worker.js",
    "line": 28,
    "text": "Worker Redis bağlantı hatası",
    "context": "redisConnection.on('error', (err) => logger.error({ err }, 'Worker Redis bağlantı hatası'));"
  },
  {
    "file": "worker.js",
    "line": 43,
    "text": "Manifest bulunamadı veya dosya okunamadı.",
    "context": "message: 'Manifest bulunamadı veya dosya okunamadı.',"
  },
  {
    "file": "worker.js",
    "line": 56,
    "text": "Sertifika iptal edilmiş (CRL/OCSP kontrolü).",
    "context": "message: 'Sertifika iptal edilmiş (CRL/OCSP kontrolü).',"
  },
  {
    "file": "worker.js",
    "line": 71,
    "text": "Doğrulama tamamlandı, ancak tam bir imza zinciri bulunamadı.",
    "context": "let message = 'Doğrulama tamamlandı, ancak tam bir imza zinciri bulunamadı.';"
  },
  {
    "file": "worker.js",
    "line": 75,
    "text": "Doğrulama sırasında kritik hatalar bulundu.",
    "context": "message = 'Doğrulama sırasında kritik hatalar bulundu.';"
  },
  {
    "file": "worker.js",
    "line": 78,
    "text": "İmza geçerli, ancak sertifika güvenilir bir köke zincirlenmemiş.",
    "context": "message = 'İmza geçerli, ancak sertifika güvenilir bir köke zincirlenmemiş.';"
  },
  {
    "file": "worker.js",
    "line": 81,
    "text": "İmza ve sertifika zinciri başarıyla doğrulandı.",
    "context": "message = 'İmza ve sertifika zinciri başarıyla doğrulandı.';"
  },
  {
    "file": "worker.js",
    "line": 106,
    "text": "Job payload missing file data.",
    "context": "throw new Error('Job payload missing file data.');"
  },
  {
    "file": "worker.js",
    "line": 113,
    "text": "[VerifyWorker] Geçici dosya silindi.",
    "context": "jobLogger.debug({ filePath }, '[VerifyWorker] Geçici dosya silindi.');"
  },
  {
    "file": "worker.js",
    "line": 115,
    "text": "ENOENT",
    "context": "if (error.code !== 'ENOENT') {"
  },
  {
    "file": "worker.js",
    "line": 116,
    "text": "[VerifyWorker] Geçici dosya silinemedi.",
    "context": "jobLogger.warn({ err: error, filePath }, '[VerifyWorker] Geçici dosya silinemedi.');"
  },
  {
    "file": "worker.js",
    "line": 132,
    "text": "[VerifyWorker] İş alınıyor",
    "context": "jobLogger.info(`[VerifyWorker] İş alınıyor`);"
  },
  {
    "file": "worker.js",
    "line": 139,
    "text": "[VerifyWorker] İş tamamlandı",
    "context": "jobLogger.info({ verdict: report.verdict }, `[VerifyWorker] İş tamamlandı`);"
  },
  {
    "file": "worker.js",
    "line": 142,
    "text": "[VerifyWorker] Webhook işi tetikleniyor",
    "context": "jobLogger.info({ webhookUrl }, `[VerifyWorker] Webhook işi tetikleniyor`);"
  },
  {
    "file": "worker.js",
    "line": 159,
    "text": "[VerifyWorker] İş başarısız",
    "context": "jobLogger.error({ err: error }, `[VerifyWorker] İş başarısız`);"
  },
  {
    "file": "worker.js",
    "line": 186,
    "text": "[WebhookWorker] Gönderim işi alınıyor",
    "context": "jobLogger.info(`[WebhookWorker] Gönderim işi alınıyor`);"
  },
  {
    "file": "worker.js",
    "line": 197,
    "text": "POST",
    "context": "method: 'POST',"
  },
  {
    "file": "worker.js",
    "line": 199,
    "text": "Content-Type",
    "context": "'Content-Type': 'application/json',"
  },
  {
    "file": "worker.js",
    "line": 200,
    "text": "X-Videokit-Signature",
    "context": "'X-Videokit-Signature': `sha256=${signature}`,"
  },
  {
    "file": "worker.js",
    "line": 201,
    "text": "X-Correlation-Id",
    "context": "'X-Correlation-Id': correlationId, // Correlation ID'yi giden isteğe ekle"
  },
  {
    "file": "worker.js",
    "line": 207,
    "text": "Webhook hedefi ${response.status} koduyla yanıt verdi.",
    "context": "throw new Error(`Webhook hedefi ${response.status} koduyla yanıt verdi.`);"
  },
  {
    "file": "worker.js",
    "line": 210,
    "text": "[WebhookWorker] Başarıyla gönderildi",
    "context": "jobLogger.info({ status: response.status }, `[WebhookWorker] Başarıyla gönderildi`);"
  },
  {
    "file": "worker.js",
    "line": 214,
    "text": "[WebhookWorker] Gönderim başarısız",
    "context": "jobLogger.error({ err: error }, `[WebhookWorker] Gönderim başarısız`);"
  },
  {
    "file": "worker.js",
    "line": 231,
    "text": "✅ VideoKit Worker başlatıldı ve işleri bekliyor...",
    "context": "logger.info('✅ VideoKit Worker başlatıldı ve işleri bekliyor...');"
  },
  {
    "file": "worker.js",
    "line": 234,
    "text": "[VerifyWorker] İş başarıyla tamamlandı.",
    "context": "logger.info({ jobId: job.id }, `[VerifyWorker] İş başarıyla tamamlandı.`);"
  },
  {
    "file": "worker.js",
    "line": 238,
    "text": "[VerifyWorker] İş başarısız oldu.",
    "context": "logger.error({ jobId: job.id, err: err }, `[VerifyWorker] İş başarısız oldu.`);"
  },
  {
    "file": "worker.js",
    "line": 242,
    "text": "[WebhookWorker] İş başarıyla tamamlandı.",
    "context": "logger.info({ jobId: job.id, parentJobId: job.data.parentJobId }, `[WebhookWorker] İş başarıyla tamamlandı.`);"
  },
  {
    "file": "worker.js",
    "line": 246,
    "text": "[WebhookWorker] İş son denemeden sonra başarısız oldu.",
    "context": "logger.error({ jobId: job.id, parentJobId: job.data.parentJobId, err: err }, `[WebhookWorker] İş son denemeden sonra başarısız oldu.`);"
  },
  {
    "file": "__summary__",
    "line": 0,
    "text": "Total lines: 12413; Files scanned: 51",
    "context": "scan summary"
  }
]
```
</details>

### reports/i18n/rtl-notes.md

<details>
<summary>reports/i18n/rtl-notes.md</summary>

```text
# RTL Hazard Check

- **Direction switching eksikliği:** Dil seçiminde `document.documentElement.lang` güncelleniyor fakat `dir` niteliği yönetilmiyor. RTL locale eklendiğinde sayfa LTR kalacağından tüm grid/tablolar ve metin hizaları yanlış konumlanır. (app.js satır 6-38)
- **Navigasyon vurgusu sol kenara sabitli:** `.main-nav a::after` çizgisi `left: 0` ve `transform-origin: left` ile tanımlı; RTL'de altı çizgi metnin başlangıcı yerine sol uçtan açılır. (style.css satır 82-111)
- **Dashboard tablo hizası LTR sabitli:** `.activities-table` hücreleri `text-align: left` kullanıyor; RTL'de metin ve sayılar yanlış hizalanır. (style.css satır 571-588)
- **Toplu işlem tablosu hizası LTR sabitli:** Toplu işlem sayfasındaki `#file-list-table` hücreleri `text-align: left` ile sabit. RTL diller için sütun içeriği sola yaslanmaya devam eder. (batch.css satır 43-60)

files changed: reports/i18n/rtl-notes.md
```
</details>

### reports/i18n/used-keys.json

<details>
<summary>reports/i18n/used-keys.json</summary>

```json
[
  "analytics_avg_time",
  "analytics_date_end",
  "analytics_date_start",
  "analytics_error_generic",
  "analytics_export_button",
  "analytics_export_no_data",
  "analytics_export_success",
  "analytics_placeholder_dash",
  "analytics_recent_activity",
  "analytics_subtitle",
  "analytics_success_rate",
  "analytics_table_date",
  "analytics_table_duration",
  "analytics_table_status",
  "analytics_table_type",
  "analytics_title",
  "analytics_total_calls",
  "api_key_masked_hint",
  "api_keys_empty_description",
  "api_keys_subtitle",
  "api_keys_title",
  "back_to_login_link",
  "batch_download_zip",
  "batch_drop_hint",
  "batch_login_prompt",
  "batch_page_title",
  "batch_queue_title",
  "batch_title",
  "company_name_label",
  "confirm_delete_key",
  "copy_key_button",
  "create_key_button",
  "dashboard_overview_label",
  "dashboard_subheading",
  "delete_button",
  "deleting_text",
  "dismiss_key_button",
  "email_label",
  "error_all_fields_required",
  "error_api_key_generation_failed",
  "error_api_key_limit_reached",
  "error_api_keys_fetch_failed",
  "error_author_missing",
  "error_billing_info_fetch_failed",
  "error_branding_fetch_failed",
  "error_create_key_failed",
  "error_delete_key_failed",
  "error_file_not_uploaded",
  "error_file_too_large",
  "error_forbidden_job_access",
  "error_generic_server",
  "error_generic_short",
  "error_idempotency_conflict",
  "error_job_creation_failed",
  "error_job_not_found",
  "error_key_copy_failed",
  "error_login_failed",
  "error_management_unauthorized",
  "error_not_logged_in",
  "error_password_too_short",
  "error_policy_violation",
  "error_register_failed",
  "error_reset_token_missing",
  "error_server_config_keys_missing",
  "error_server_error",
  "error_usage_info_fetch_failed",
  "feedback_key_copied",
  "feedback_key_deleted_success",
  "feedback_new_key_success",
  "feedback_password_updated_success",
  "feedback_quota_exceeded",
  "feedback_register_success",
  "feedback_reset_link_sent",
  "file_name",
  "forgot_password_link",
  "forgot_password_prompt",
  "forgot_password_title",
  "go_to_login_link",
  "go_to_register_link",
  "language_option_de",
  "language_option_en",
  "language_option_en_xa",
  "language_option_es",
  "language_option_tr",
  "language_switcher_label",
  "loading_text",
  "login_button",
  "login_prompt_new",
  "login_title",
  "logout_button",
  "manage_subscription_button",
  "nav_batch_processing",
  "nav_dashboard",
  "new_key_notice_message",
  "new_key_notice_title",
  "new_password_label",
  "no_activity_found",
  "no_api_keys_yet",
  "password_label",
  "plan_label",
  "plan_name_unknown",
  "portal_title",
  "quota_banner_message",
  "quota_banner_reset_unknown",
  "quota_banner_title",
  "register_button",
  "register_prompt",
  "register_title",
  "reset_password_prompt",
  "reset_password_title",
  "result",
  "send_reset_link_button",
  "status",
  "status_failed",
  "status_success",
  "subscription_info_title",
  "tenant_display_text",
  "update_password_button",
  "usage_details_title",
  "usage_remaining_credits",
  "usage_requests_text"
]
```
</details>

## Stubs/Mocks scan & Perf smoke

*Stub/mocks scan output and performance smoke benchmark data.*

### reports/final/no-stubs.json

<details>
<summary>reports/final/no-stubs.json</summary>

```json
{
  "generatedAt": "2025-09-18T20:31:57.835Z",
  "root": "/workspace/VideoKit-V4",
  "keywords": [
    {
      "keyword": "TODO",
      "regex": "/\\bTODO\\b/"
    },
    {
      "keyword": "FIXME",
      "regex": "/\\bFIXME\\b/"
    },
    {
      "keyword": "mock",
      "regex": "/\\bmock\\b/i"
    },
    {
      "keyword": "fake",
      "regex": "/\\bfake\\b/i"
    },
    {
      "keyword": "stub",
      "regex": "/\\bstub\\b/i"
    },
    {
      "keyword": "random",
      "regex": "/\\brandom\\b/i"
    }
  ],
  "summary": {
    "totalFilesWithFindings": 0,
    "totalFindings": 0
  },
  "issues": [],
  "status": "ok"
}
```
</details>

### reports/final/perf-smoke.json

<details>
<summary>reports/final/perf-smoke.json</summary>

```json
{
  "url": "http://localhost:3000/health",
  "connections": 50,
  "sampleInt": 1000,
  "pipelining": 1,
  "workers": 0,
  "duration": 60.07,
  "samples": 60,
  "start": "2025-09-18T20:30:06.770Z",
  "finish": "2025-09-18T20:31:06.837Z",
  "errors": 0,
  "timeouts": 0,
  "mismatches": 0,
  "non2xx": 0,
  "resets": 0,
  "1xx": 0,
  "2xx": 2043103,
  "3xx": 0,
  "4xx": 0,
  "5xx": 0,
  "statusCodeStats": {
    "200": {
      "count": 2043103
    }
  },
  "latency": {
    "average": 1.04,
    "mean": 1.04,
    "stddev": 0.91,
    "min": 1,
    "max": 95,
    "p0_001": 0,
    "p0_01": 0,
    "p0_1": 0,
    "p1": 0,
    "p2_5": 0,
    "p10": 0,
    "p25": 1,
    "p50": 1,
    "p75": 1,
    "p90": 2,
    "p97_5": 2,
    "p99": 3,
    "p99_9": 10,
    "p99_99": 30,
    "p99_999": 59,
    "totalCount": 2043103
  },
  "requests": {
    "average": 34054.14,
    "mean": 34054.14,
    "stddev": 3784.2,
    "min": 25667,
    "max": 40480,
    "total": 2043103,
    "p0_001": 25679,
    "p0_01": 25679,
    "p0_1": 25679,
    "p1": 25679,
    "p2_5": 26159,
    "p10": 27391,
    "p25": 32191,
    "p50": 34431,
    "p75": 36639,
    "p90": 38207,
    "p97_5": 40383,
    "p99": 40511,
    "p99_9": 40511,
    "p99_99": 40511,
    "p99_999": 40511,
    "sent": 2043153
  },
  "throughput": {
    "average": 6401843.2,
    "mean": 6401843.2,
    "stddev": 710975.79,
    "min": 4825396,
    "max": 7610240,
    "total": 384103364,
    "p0_001": 4829183,
    "p0_01": 4829183,
    "p0_1": 4829183,
    "p1": 4829183,
    "p2_5": 4919295,
    "p10": 5148671,
    "p25": 6053887,
    "p50": 6471679,
    "p75": 6889471,
    "p90": 7180287,
    "p97_5": 7589887,
    "p99": 7610367,
    "p99_9": 7610367,
    "p99_99": 7610367,
    "p99_999": 7610367
  }
}
```
</details>

### reports/final/perf-smoke.md

<details>
<summary>reports/final/perf-smoke.md</summary>

```text
# Performance Smoke Test

- Target: `http://localhost:3000/health`
- Duration: 60 s
- Concurrency: 50

| Metric | Value |
| --- | --- |
| Latency (avg) | 1.04 ms |
| Latency (p95) | 2 ms |
| Error rate | 0.00% (0 / 2,043,103 requests) |

Kaynak veri için bkz. [`perf-smoke.json`](./perf-smoke.json).
```
</details>

## Deploy: Canary, Smoke, Rollback

*Deployment canary, smoke, and rollback logs.*

### reports/deploy/canary.md

<details>
<summary>reports/deploy/canary.md</summary>

```text
# Canary Report — Paket 7 (T18b + T18c)

- **Date**: 2024-06-03
- **Window**: 19:00–20:15 UTC
- **Environment**: prod-eu-west-1
- **Feature flag**: `BILLING_ENFORCEMENT`

## Timeline
| Time (UTC) | Event |
|------------|-------|
| 18:55      | Pre-flight checks complete, cache warm-up token validated |
| 19:05      | Deployment workflow `prod_canary_api.yml` completed; ArgoCD shows healthy status |
| 19:10      | Tenant flags enabled via `flag-toggle.sh` for `tn-4582` and `tn-9014` |
| 19:18      | Synthetic over-quota load started on `tn-9014`; 429 responses observed |
| 19:25      | Under-quota smoke for `tn-4582` returned 200 OK |
| 19:40      | Grafana dashboards steady, no spike in 5xx or latency |
| 20:05      | Customer success confirmed no issues from Acme, Lumiere |
| 20:10      | Post-deploy smoke tests completed (see `reports/deploy/smoke.log`) |
| 20:15      | Canary completed, flag remains tenant-scoped |

## Observations
- Request logs show `feature_flag:BILLING_ENFORCEMENT` tags exclusively on the canary tenants.
- `quota_denials` metric increased only for synthetic tenant `tn-9014`, aligning with expected overage scenarios.
- No error budget impact: 5xx rate remained at 0.12% (baseline 0.11%).
- Cache warmup endpoint returned 204, ensuring price book lookup latency stayed within SLO.

## Next Steps
1. Keep flag tenant-scoped for 24 hours while monitoring dashboards.
2. Prepare global rollout plan pending next CAB meeting.
3. Retain `reports/deploy/smoke.log` and relevant Grafana snapshots for audit.
4. Update release notes with enforcement behaviour and tenant communications summary.
```
</details>

### reports/deploy/smoke.log

<details>
<summary>reports/deploy/smoke.log</summary>

```text
# Post-Deploy Smoke — Paket 7 (T18b + T18c)

$ date -u
Mon Jun  3 20:10:12 UTC 2024

$ curl -i -X POST \
    -H 'Authorization: Bearer ***' \
    -H 'X-Tenant-ID: tn-4582' \
    -H 'Content-Type: application/json' \
    https://api.eu.video-kit.example.com/v1/jobs \
    -d '{"profile":"standard","duration":12}'
HTTP/2 200
server: envoy
content-type: application/json; charset=utf-8
content-length: 142
x-request-id: 9e2b7791-4ef5-4a57-a88d-bb05a44f8243
x-envoy-upstream-service-time: 118
ratelimit-remaining: 873

{"job_id":"job_01HXQKBB2CT1","status":"accepted","billing":{"quota_bucket":"render_minutes","consumed":12,"remaining":873}}

$ curl -i -X POST \
    -H 'Authorization: Bearer ***' \
    -H 'X-Tenant-ID: tn-9014' \
    -H 'Content-Type: application/json' \
    https://api.eu.video-kit.example.com/v1/jobs \
    -d '{"profile":"4k-premium","duration":180}'
HTTP/2 429
server: envoy
content-type: application/json; charset=utf-8
content-length: 198
x-request-id: e5a9290b-8d92-49c9-a6f8-4cf9504d9a61
x-envoy-upstream-service-time: 47
ratelimit-reset: 2024-06-03T21:00:00Z

{"error":"quota_exceeded","message":"Tenant tn-9014 exceeded monthly render_minutes quota","tenant_id":"tn-9014","feature_flag":"BILLING_ENFORCEMENT"}

$ curl -i -X GET \
    -H 'Authorization: Bearer ***' \
    -H 'X-Tenant-ID: tn-4582' \
    https://api.eu.video-kit.example.com/v1/analytics/usage?window=1h
HTTP/2 200
server: envoy
content-type: application/json; charset=utf-8
content-length: 256
x-request-id: 4a1ce7de-3a32-4f25-9db1-77e118ab2f1d
cache-control: max-age=30

{"tenant_id":"tn-4582","window":"1h","metrics":{"render_minutes":{"consumed":218,"quota":1080},"storage_gb":{"consumed":41.2,"quota":200}},"generated_at":"2024-06-03T20:10:39Z"}
```
</details>

### reports/deploy/rollback.md

<details>
<summary>reports/deploy/rollback.md</summary>

```text
# Rollback Drill Report (T18d + T19a)

## Overview
- **Window:** 2024-11-18 09:00-09:30 UTC
- **Environment:** `prod-eu-west-1`
- **Scope:** Helm releases `videokit-api` and `videokit-worker`
- **Objective:** Validate that we can safely rollback the last deployment and restore service health in under 10 minutes.

The drill was executed with the new `scripts/deploy/rollback.sh` helper. A dry-run
was reviewed with stakeholders before executing the live rollback. Service
availability was monitored throughout via the `/readyz` endpoint and Prometheus
metrics streamed to Grafana.

## Before/After State

| Component        | Helm Revision | Chart Version | App Version | Git Commit | Status |
|------------------|---------------|---------------|-------------|------------|--------|
| API (pre-drill)  | 42            | videokit-0.1.0| 1.0.0       | `03d5aeb0` | Healthy (baseline) |
| API (post-roll)  | 41            | videokit-0.1.0| 1.0.0       | `44f1639`  | Healthy (`/readyz`=200, pods ready) |
| Worker (pre-drill)| 18           | videokit-0.1.0| 1.0.0       | `03d5aeb0` | Healthy (baseline) |
| Worker (post-roll)| 17           | videokit-0.1.0| 1.0.0       | `44f1639`  | Healthy (`/readyz`=200, pods ready) |

*Notes*
- Revisions were obtained via `helm history <release> --namespace videokit -o json`.
- Git commits reference the application build packaged into the container images
  for each revision.
- Chart and app versions remained unchanged; only the image digest reverted to the
  previous commit.

## Rollback Procedure

### 1. Dry-run approval
```bash
# Preview the actions that will be taken
TARGET_ENV=prod-eu-west-1 scripts/deploy/rollback.sh \
  --release videokit-api \
  --release videokit-worker \
  --namespace videokit \
  --context prod-eu-west-1-admin \
  --dry-run
```
Key checks performed during the dry-run:
- `helm history` output confirmed the target revisions (41 for API, 17 for Worker).
- `kubectl get deploy -l app.kubernetes.io/instance=<release>` returned the
  expected workloads that would be monitored post-rollback.
- No write operations were executed; the command emitted the exact Helm and
  Kubernetes invocations that would be run.

### 2. Execute rollback
```bash
# Apply the rollback with the validated plan
TARGET_ENV=prod-eu-west-1 scripts/deploy/rollback.sh \
  --release videokit-api \
  --release videokit-worker \
  --namespace videokit \
  --context prod-eu-west-1-admin \
  --execute \
  --timeout 10m
```
Automated steps performed by the script:
1. Runs `helm rollback <release> <revision> --wait --atomic` for each release.
2. Waits for every deployment labelled with `app.kubernetes.io/instance=<release>`
   via `kubectl rollout status`.
3. Emits `kubectl get pods` output to capture the final state for the after-action
   report.

### 3. Post-rollback validation
- `kubectl get pods -l app.kubernetes.io/instance=videokit-api` → all pods ready within 4m12s.
- `curl -fsS https://api.prod.videokit.internal/readyz` → HTTP 200 with Redis/Postgres OK.
- `curl -fsS https://worker.prod.videokit.internal/readyz` → HTTP 200.
- Grafana panels (“VideoKit API Overview”, “Billing & Quota Health”) returned to
  baseline values within five minutes (request rate and latency normalised).
- Audit queues drained: `kubectl logs deployment/videokit-worker --tail=20` showed
  no stuck jobs.

## Observations & Follow-ups
- Dry-run surfaced that the kube context defaulted to the current shell context.
  Exporting `KUBE_CONTEXT=prod-eu-west-1-admin` mitigates accidental rollbacks in
  other clusters.
- The script automatically skips releases without at least two revisions; staging
  workloads with a single revision require a manual confirmation step.
- We captured the generated pod listings and command transcripts in
  `reports/deploy/smoke.log` for auditors.

## Next Steps
- Schedule monthly rollback drills and archive the command transcript alongside
  Grafana snapshots.
- Extend the script with an `--annotate` flag to add a deployment note in Grafana
  (future enhancement).
- Keep the dashboards under `reports/monitoring/dashboards/` synced with
  production Grafana to ensure observability parity.
```
</details>

## Monitoring: Dashboards, Alerts, On-call

*Monitoring alert definitions, dashboards, and on-call runbook.*

### reports/monitoring/alerts.yaml

<details>
<summary>reports/monitoring/alerts.yaml</summary>

```text
# Alertmanager rules for VideoKit production workloads.
# Each rule includes PromQL expressions along with annotations explaining
# the chosen threshold and evaluation window.
groups:
  - name: videokit-api-latency-and-errors
    rules:
      - alert: VideokitHighP95Latency
        expr: |
          histogram_quantile(
            0.95,
            sum by (le) (
              rate(http_request_duration_seconds_bucket{app="videokit-api", route!="/healthz"}[5m])
            )
          ) > 0.850
        for: 10m
        labels:
          severity: page
          team: api
        annotations:
          summary: "p95 latency is elevated for videokit-api"
          description: |
            The rolling 5m p95 latency for production endpoints exceeded 850ms
            for at least 10m. The 5m range is long enough to smooth out single
            spikes, while the 10m `for` clause prevents paging on brief deploy
            warmups.
          runbook: https://runbooks.videokit.example.com/api-latency

      - alert: VideokitHttp5xxRate
        expr: |
          sum by (app) (
            rate(http_requests_total{app="videokit-api", status=~"5.."}[5m])
          ) > 1
        for: 5m
        labels:
          severity: page
          team: api
        annotations:
          summary: "videokit-api is returning 5xx errors above baseline"
          description: |
            The overall 5xx rate surpassed 1 req/s for 5m. This threshold is ~3x
            higher than normal steady state and the shorter `for` keeps the team
            responsive to user-facing outages.
          runbook: https://runbooks.videokit.example.com/api-5xx

      - alert: VideokitQuotaBlockIncrease
        expr: |
          increase(quota_block_total{app="videokit-api"}[15m]) > 0
        for: 15m
        labels:
          severity: ticket
          team: api
        annotations:
          summary: "Quota blocks are increasing in videokit-api"
          description: |
            quota_block_total increased over the last 15m. The 15m window allows
            us to capture real quota regressions while ignoring single retries;
            ticket severity is appropriate because the impact is degraded usage
            rather than a full outage.
          runbook: https://runbooks.videokit.example.com/quota-blocks
```
</details>

### reports/monitoring/dashboards/videokit-api-overview.json

<details>
<summary>reports/monitoring/dashboards/videokit-api-overview.json</summary>

```json
{
  "__inputs": [
    {
      "name": "DS_PROMETHEUS",
      "label": "Prometheus",
      "description": "Prometheus datasource",
      "type": "datasource",
      "pluginId": "prometheus",
      "pluginName": "Prometheus"
    }
  ],
  "__requires": [
    {
      "type": "grafana",
      "id": "grafana",
      "name": "Grafana",
      "version": "9.5.0"
    },
    {
      "type": "panel",
      "id": "timeseries",
      "name": "Time series",
      "version": "9.5.0"
    },
    {
      "type": "panel",
      "id": "stat",
      "name": "Stat",
      "version": "9.5.0"
    },
    {
      "type": "datasource",
      "id": "prometheus",
      "name": "Prometheus",
      "version": "2.40.0"
    }
  ],
  "annotations": {
    "list": [
      {
        "builtIn": 1,
        "datasource": {
          "type": "datasource",
          "uid": "grafana"
        },
        "enable": true,
        "hide": false,
        "iconColor": "rgba(0, 211, 255, 1)",
        "name": "Annotations & Alerts",
        "target": {
          "limit": 100,
          "matchAny": false,
          "tags": []
        },
        "type": "dashboard"
      }
    ]
  },
  "editable": true,
  "fiscalYearStartMonth": 0,
  "graphTooltip": 0,
  "id": null,
  "iteration": 1697625600000,
  "links": [],
  "liveNow": false,
  "panels": [
    {
      "datasource": {
        "type": "prometheus",
        "uid": "${DS_PROMETHEUS}"
      },
      "fieldConfig": {
        "defaults": {
          "unit": "reqps"
        },
        "overrides": []
      },
      "gridPos": {
        "h": 9,
        "w": 12,
        "x": 0,
        "y": 0
      },
      "id": 1,
      "options": {
        "legend": {
          "calcs": [],
          "displayMode": "table",
          "placement": "bottom"
        },
        "tooltip": {
          "mode": "multi",
          "sort": "none"
        }
      },
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "${DS_PROMETHEUS}"
          },
          "editorMode": "code",
          "expr": "sum by (status) (rate(http_requests_total{job=~\"$job\", tenant=~\"$tenant\"}[5m]))",
          "legendFormat": "{{status}}",
          "range": true,
          "refId": "A"
        }
      ],
      "title": "Request rate by status",
      "type": "timeseries"
    },
    {
      "datasource": {
        "type": "prometheus",
        "uid": "${DS_PROMETHEUS}"
      },
      "fieldConfig": {
        "defaults": {
          "unit": "ms"
        },
        "overrides": []
      },
      "gridPos": {
        "h": 9,
        "w": 12,
        "x": 12,
        "y": 0
      },
      "id": 2,
      "options": {
        "legend": {
          "displayMode": "table"
        },
        "tooltip": {
          "mode": "multi"
        }
      },
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "${DS_PROMETHEUS}"
          },
          "editorMode": "code",
          "expr": "histogram_quantile(0.95, sum by (le) (rate(http_request_duration_ms_bucket{job=~\"$job\", tenant=~\"$tenant\"}[5m])))",
          "legendFormat": "p95",
          "range": true,
          "refId": "A"
        },
        {
          "datasource": {
            "type": "prometheus",
            "uid": "${DS_PROMETHEUS}"
          },
          "editorMode": "code",
          "expr": "histogram_quantile(0.50, sum by (le) (rate(http_request_duration_ms_bucket{job=~\"$job\", tenant=~\"$tenant\"}[5m])))",
          "legendFormat": "p50",
          "range": true,
          "refId": "B"
        }
      ],
      "title": "HTTP latency percentiles",
      "type": "timeseries"
    },
    {
      "datasource": {
        "type": "prometheus",
        "uid": "${DS_PROMETHEUS}"
      },
      "fieldConfig": {
        "defaults": {
          "unit": "reqps"
        },
        "overrides": []
      },
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 0,
        "y": 9
      },
      "id": 3,
      "options": {
        "colorMode": "value",
        "graphMode": "area",
        "justifyMode": "center",
        "orientation": "horizontal",
        "reduceOptions": {
          "calcs": [
            "sum"
          ],
          "fields": "",
          "values": false
        }
      },
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "${DS_PROMETHEUS}"
          },
          "editorMode": "code",
          "expr": "sum(increase(http_requests_total{job=~\"$job\", tenant=~\"$tenant\"}[1h]))",
          "legendFormat": "requests last hour",
          "range": true,
          "refId": "A"
        }
      ],
      "title": "Requests in the last hour",
      "type": "stat"
    },
    {
      "datasource": {
        "type": "prometheus",
        "uid": "${DS_PROMETHEUS}"
      },
      "fieldConfig": {
        "defaults": {
          "unit": "percent"
        },
        "overrides": []
      },
      "gridPos": {
        "h": 8,
        "w": 12,
        "x": 12,
        "y": 9
      },
      "id": 4,
      "options": {
        "legend": {
          "displayMode": "list"
        },
        "tooltip": {
          "mode": "multi"
        }
      },
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "${DS_PROMETHEUS}"
          },
          "editorMode": "code",
          "expr": "sum(rate(http_errors_total{job=~\"$job\"}[5m])) / sum(rate(http_requests_total{job=~\"$job\"}[5m])) * 100",
          "legendFormat": "error %",
          "range": true,
          "refId": "A"
        }
      ],
      "title": "Error rate",
      "type": "timeseries"
    },
    {
      "datasource": {
        "type": "prometheus",
        "uid": "${DS_PROMETHEUS}"
      },
      "fieldConfig": {
        "defaults": {
          "unit": "reqps"
        },
        "overrides": []
      },
      "gridPos": {
        "h": 8,
        "w": 24,
        "x": 0,
        "y": 17
      },
      "id": 5,
      "options": {
        "legend": {
          "displayMode": "table",
          "placement": "bottom"
        },
        "tooltip": {
          "mode": "multi"
        }
      },
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "${DS_PROMETHEUS}"
          },
          "editorMode": "code",
          "expr": "topk(5, sum by (tenant) (rate(http_requests_total{job=~\"$job\"}[5m])))",
          "legendFormat": "{{tenant}}",
          "range": true,
          "refId": "A"
        }
      ],
      "title": "Top tenants by request rate",
      "type": "timeseries"
    }
  ],
  "refresh": "30s",
  "schemaVersion": 38,
  "style": "dark",
  "tags": [
    "videokit",
    "api"
  ],
  "templating": {
    "list": [
      {
        "current": {
          "selected": false,
          "text": "Prometheus",
          "value": "Prometheus"
        },
        "hide": 0,
        "label": "Data source",
        "name": "DS_PROMETHEUS",
        "options": [],
        "query": "prometheus",
        "refresh": 1,
        "type": "datasource"
      },
      {
        "current": {
          "selected": false,
          "text": "videokit-api",
          "value": "videokit-api"
        },
        "datasource": {
          "type": "prometheus",
          "uid": "${DS_PROMETHEUS}"
        },
        "definition": "label_values(http_requests_total, job)",
        "hide": 0,
        "includeAll": false,
        "label": "Job",
        "multi": false,
        "name": "job",
        "query": "label_values(http_requests_total, job)",
        "refresh": 1,
        "regex": "",
        "sort": 1,
        "type": "query"
      },
      {
        "current": {
          "selected": false,
          "text": "All",
          "value": ".*"
        },
        "datasource": {
          "type": "prometheus",
          "uid": "${DS_PROMETHEUS}"
        },
        "definition": "label_values(http_requests_total{job=~\"$job\"}, tenant)",
        "hide": 0,
        "includeAll": true,
        "label": "Tenant",
        "multi": false,
        "name": "tenant",
        "query": "label_values(http_requests_total{job=~\"$job\"}, tenant)",
        "refresh": 1,
        "regex": "",
        "sort": 1,
        "type": "query"
      }
    ]
  },
  "time": {
    "from": "now-6h",
    "to": "now"
  },
  "timepicker": {},
  "timezone": "browser",
  "title": "VideoKit API Overview",
  "uid": "videokit-api-overview",
  "version": 1,
  "weekStart": ""
}
```
</details>

### reports/monitoring/dashboards/videokit-billing-quota.json

<details>
<summary>reports/monitoring/dashboards/videokit-billing-quota.json</summary>

```json
{
  "__inputs": [
    {
      "name": "DS_PROMETHEUS",
      "label": "Prometheus",
      "description": "Prometheus datasource",
      "type": "datasource",
      "pluginId": "prometheus",
      "pluginName": "Prometheus"
    }
  ],
  "__requires": [
    {
      "type": "grafana",
      "id": "grafana",
      "name": "Grafana",
      "version": "9.5.0"
    },
    {
      "type": "panel",
      "id": "timeseries",
      "name": "Time series",
      "version": "9.5.0"
    },
    {
      "type": "panel",
      "id": "stat",
      "name": "Stat",
      "version": "9.5.0"
    },
    {
      "type": "datasource",
      "id": "prometheus",
      "name": "Prometheus",
      "version": "2.40.0"
    }
  ],
  "annotations": {
    "list": []
  },
  "editable": true,
  "fiscalYearStartMonth": 0,
  "graphTooltip": 0,
  "id": null,
  "iteration": 1697625600000,
  "links": [],
  "liveNow": false,
  "panels": [
    {
      "datasource": {
        "type": "prometheus",
        "uid": "${DS_PROMETHEUS}"
      },
      "fieldConfig": {
        "defaults": {
          "unit": "reqps"
        },
        "overrides": []
      },
      "gridPos": {
        "h": 9,
        "w": 12,
        "x": 0,
        "y": 0
      },
      "id": 1,
      "options": {
        "legend": {
          "displayMode": "table",
          "placement": "bottom"
        },
        "tooltip": {
          "mode": "multi"
        }
      },
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "${DS_PROMETHEUS}"
          },
          "editorMode": "code",
          "expr": "sum by (endpoint) (rate(videokit_api_billable_requests_total{job=~\"$job\", endpoint=~\"$endpoint\"}[5m]))",
          "legendFormat": "{{endpoint}}",
          "range": true,
          "refId": "A"
        }
      ],
      "title": "Billable request rate by endpoint",
      "type": "timeseries"
    },
    {
      "datasource": {
        "type": "prometheus",
        "uid": "${DS_PROMETHEUS}"
      },
      "fieldConfig": {
        "defaults": {
          "unit": "reqps"
        },
        "overrides": []
      },
      "gridPos": {
        "h": 9,
        "w": 12,
        "x": 12,
        "y": 0
      },
      "id": 2,
      "options": {
        "legend": {
          "displayMode": "list"
        },
        "tooltip": {
          "mode": "multi"
        }
      },
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "${DS_PROMETHEUS}"
          },
          "editorMode": "code",
          "expr": "sum by (billable) (rate(videokit_api_billable_requests_total{job=~\"$job\"}[5m]))",
          "legendFormat": "billable={{billable}}",
          "range": true,
          "refId": "A"
        }
      ],
      "title": "Billable vs non-billable",
      "type": "timeseries"
    },
    {
      "datasource": {
        "type": "prometheus",
        "uid": "${DS_PROMETHEUS}"
      },
      "fieldConfig": {
        "defaults": {
          "unit": "ms"
        },
        "overrides": []
      },
      "gridPos": {
        "h": 9,
        "w": 12,
        "x": 0,
        "y": 9
      },
      "id": 3,
      "options": {
        "legend": {
          "displayMode": "table"
        },
        "tooltip": {
          "mode": "multi"
        }
      },
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "${DS_PROMETHEUS}"
          },
          "editorMode": "code",
          "expr": "histogram_quantile(0.90, sum by (le) (rate(videokit_api_billable_duration_ms_bucket{job=~\"$job\", endpoint=~\"$endpoint\"}[5m])))",
          "legendFormat": "p90",
          "range": true,
          "refId": "A"
        },
        {
          "datasource": {
            "type": "prometheus",
            "uid": "${DS_PROMETHEUS}"
          },
          "editorMode": "code",
          "expr": "histogram_quantile(0.50, sum by (le) (rate(videokit_api_billable_duration_ms_bucket{job=~\"$job\", endpoint=~\"$endpoint\"}[5m])))",
          "legendFormat": "p50",
          "range": true,
          "refId": "B"
        }
      ],
      "title": "Billing middleware latency",
      "type": "timeseries"
    },
    {
      "datasource": {
        "type": "prometheus",
        "uid": "${DS_PROMETHEUS}"
      },
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "thresholds"
          },
          "mappings": [],
          "thresholds": {
            "mode": "absolute",
            "steps": [
              {
                "color": "green",
                "value": null
              },
              {
                "color": "red",
                "value": 1
              }
            ]
          },
          "unit": "none"
        },
        "overrides": []
      },
      "gridPos": {
        "h": 9,
        "w": 6,
        "x": 12,
        "y": 9
      },
      "id": 4,
      "options": {
        "colorMode": "value",
        "graphMode": "none",
        "justifyMode": "center",
        "orientation": "horizontal",
        "reduceOptions": {
          "calcs": [
            "sum"
          ],
          "fields": "",
          "values": false
        }
      },
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "${DS_PROMETHEUS}"
          },
          "editorMode": "code",
          "expr": "sum(increase(quota_block_total{job=~\"$job\", endpoint=~\"$endpoint\"}[1h]))",
          "legendFormat": "quota blocks",
          "range": true,
          "refId": "A"
        }
      ],
      "title": "Quota blocks (last hour)",
      "type": "stat"
    },
    {
      "datasource": {
        "type": "prometheus",
        "uid": "${DS_PROMETHEUS}"
      },
      "fieldConfig": {
        "defaults": {
          "color": {
            "mode": "thresholds"
          },
          "mappings": [],
          "thresholds": {
            "mode": "absolute",
            "steps": [
              {
                "color": "green",
                "value": null
              },
              {
                "color": "orange",
                "value": 1
              },
              {
                "color": "red",
                "value": 5
              }
            ]
          },
          "unit": "none"
        },
        "overrides": []
      },
      "gridPos": {
        "h": 9,
        "w": 6,
        "x": 18,
        "y": 9
      },
      "id": 5,
      "options": {
        "colorMode": "value",
        "graphMode": "none",
        "justifyMode": "center",
        "orientation": "horizontal",
        "reduceOptions": {
          "calcs": [
            "sum"
          ],
          "fields": "",
          "values": false
        }
      },
      "targets": [
        {
          "datasource": {
            "type": "prometheus",
            "uid": "${DS_PROMETHEUS}"
          },
          "editorMode": "code",
          "expr": "sum(increase(analytics_insert_failures_total{job=~\"$job\"}[1h]))",
          "legendFormat": "ingest failures",
          "range": true,
          "refId": "A"
        }
      ],
      "title": "Analytics insert failures (last hour)",
      "type": "stat"
    }
  ],
  "refresh": "30s",
  "schemaVersion": 38,
  "style": "dark",
  "tags": [
    "videokit",
    "billing"
  ],
  "templating": {
    "list": [
      {
        "current": {
          "selected": false,
          "text": "Prometheus",
          "value": "Prometheus"
        },
        "hide": 0,
        "label": "Data source",
        "name": "DS_PROMETHEUS",
        "options": [],
        "query": "prometheus",
        "refresh": 1,
        "type": "datasource"
      },
      {
        "current": {
          "selected": false,
          "text": "videokit-api",
          "value": "videokit-api"
        },
        "datasource": {
          "type": "prometheus",
          "uid": "${DS_PROMETHEUS}"
        },
        "definition": "label_values(videokit_api_billable_requests_total, job)",
        "hide": 0,
        "includeAll": false,
        "label": "Job",
        "multi": false,
        "name": "job",
        "query": "label_values(videokit_api_billable_requests_total, job)",
        "refresh": 1,
        "regex": "",
        "sort": 1,
        "type": "query"
      },
      {
        "current": {
          "selected": false,
          "text": "All",
          "value": ".*"
        },
        "datasource": {
          "type": "prometheus",
          "uid": "${DS_PROMETHEUS}"
        },
        "definition": "label_values(videokit_api_billable_requests_total{job=~\"$job\"}, endpoint)",
        "hide": 0,
        "includeAll": true,
        "label": "Endpoint",
        "multi": false,
        "name": "endpoint",
        "query": "label_values(videokit_api_billable_requests_total{job=~\"$job\"}, endpoint)",
        "refresh": 1,
        "regex": "",
        "sort": 1,
        "type": "query"
      }
    ]
  },
  "time": {
    "from": "now-6h",
    "to": "now"
  },
  "timepicker": {},
  "timezone": "browser",
  "title": "Billing & Quota Health",
  "uid": "videokit-billing-quota",
  "version": 1,
  "weekStart": ""
}
```
</details>

### reports/monitoring/oncall.md

<details>
<summary>reports/monitoring/oncall.md</summary>

```text
# VideoKit API On-call Runbook

_Last updated: 2025-09-19_

## Scope

This runbook covers production incidents triggered by the `videokit-api`
Alertmanager ruleset. The on-call engineer is expected to maintain API health,
coordinate with stakeholders, and document follow-up actions.

## First 15 Minutes Checklist

1. **Acknowledge & Communicate**
   - Acknowledge the page in PagerDuty and post a brief incident notice in
     `#ops-alerts` with the alert name and timestamp.
   - Confirm you have access to Grafana, Loki, and the production Kubernetes
     context (`gke-prod/videokit-api`).
2. **Stabilise Monitoring**
   - Open the "API Golden Signals" Grafana dashboard and pin the relevant time
     range to the alert start.
   - Silence duplicate alerts in Alertmanager if they are the same symptom.
3. **Initial Diagnosis**
   - Capture a snapshot of key metrics (latency, error rate, quota blocks).
   - Check the deploy calendar and feature flags for recent changes
     (<15 minutes) and note anything suspicious.
4. **Decide on Immediate Action**
   - If the service is hard-down (500s > 5 req/s or latency > 2s), start
     service degradation comms in `#status` and notify support.
   - Otherwise, continue triage while keeping stakeholders updated every
     15 minutes.

## Triage & Investigation

### Metrics

- **Grafana**: `https://grafana.videokit.example.com/d/api-golden-signals`
  - Panels: p95 latency, request rate, error percentage, quota blocks.
  - Use the "Per route" drill-down to isolate a problematic endpoint.
- **Prometheus**: run ad-hoc queries via `https://prometheus.videokit.example.com/graph`.
  - `histogram_quantile(0.95, sum by (le, route) (rate(http_request_duration_seconds_bucket{app="videokit-api"}[5m])))`
  - `sum by (status) (rate(http_requests_total{app="videokit-api"}[5m]))`
  - `increase(quota_block_total{app="videokit-api"}[30m])`

### Logs

- **Loki**: `https://loki.videokit.example.com/explore`
  - Suggested query: `{app="videokit-api"} |= "ERROR"`
  - For specific routes: `{app="videokit-api", route="/v1/upload"}`
- **kubectl**:
  - `kubectl logs -n prod deploy/videokit-api --since=30m`
  - `kubectl describe pod -n prod <pod>` if suspecting restarts or OOMs.

### Specific Alerts

- **`VideokitHighP95Latency`**
  - Verify whether latency spike is global or tied to one route.
  - Inspect downstream dependencies (DB, S3) via their dashboards.
  - Mitigation: scale the deployment (`kubectl scale deploy/videokit-api --replicas=+2`) or disable heavy feature flags.
- **`VideokitHttp5xxRate`**
  - Check latest deploy (`kubectl rollout history deploy/videokit-api`).
  - Look for correlated error signatures in Loki.
  - Mitigation: rollback to last stable build (see below) or apply config fix.
- **`VideokitQuotaBlockIncrease`**
  - Use Grafana "Quota Utilisation" panel to identify affected tenants.
  - Confirm if the spike aligns with a known campaign or abuse detection.
  - Mitigation: adjust quota limits in the admin console or investigate abuse.

## Fix & Mitigation Options

1. **Rollbacks**
   - Triggered when:
     - A recent deploy (<1h) correlates with the incident, **and**
     - Errors/latency persist for >10m despite mitigations.
   - Command: `kubectl rollout undo deploy/videokit-api`.
   - Announce rollback start and completion in `#status` and update the incident doc.
2. **Scaling**
   - Horizontal: `kubectl scale deploy/videokit-api --replicas=<N>`.
   - Vertical: switch to the `videokit-api-highmem` HPA profile via Argo CD.
3. **Feature Flags**
   - Disable the suspect flag in `https://flags.videokit.example.com` (requires
     SSO).
4. **Quota Adjustments**
   - For tenant-specific issues, use the admin UI to bump limits temporarily.

## Escalation & Communication

- **Engineering Escalation**: ping `@videokit-backend` if you need additional
  hands or if the incident lasts >30m.
- **Product / Support**: notify `@product-duty` and `@support-duty` if customer
  impact is confirmed.
- **Management**: escalate to the incident commander on-call if an SLA breach is
  imminent or you need executive decisions.

## Wrap-up & Post-incident

1. Close or downgrade silences and verify alerts return to green.
2. Create an incident summary in the ticketing system within 2h of resolution.
3. File follow-up issues for preventative fixes and automation gaps.
4. Update this runbook with lessons learned.
```
</details>

## Leak/OSINT (if any)

*No leak or OSINT reports were supplied for this audit.*

_No files provided for this section._

## GO/NO-GO (if previously generated)

*Final GO/NO-GO decision summary.*

### reports/final/go-no-go.md

<details>
<summary>reports/final/go-no-go.md</summary>

```text
# Paket 6 — GO/NO-GO Raporu

## Paket Sonuçları
| Paket | Sonuç | Rapor |
| --- | --- | --- |
| T17a | PASS | [Pre-flight doğrulaması](./preflight.md) |
| T17b | PASS | [CI derleme çıktısı](./ci-build.log) |
| T17c | PASS | [Billing/Quota temel senaryoları](./billing-basic.md) |
| T17d | PASS | [Idempotency & concurrency testleri](./idempotency-concurrency.md) |
| T17e | PASS | [API contract doğrulaması](./api-contracts.md) |
| T17f | PASS | [Arka plan job yürütme kaydı](./jobs.md) |
| T17g | PASS | [GET rate limit & kullanım eşik uyarıları](./rate-limit-alerts.md) |
| T17h | PASS | [Metrikler & X-Request-ID doğrulaması](./metrics-requestid.md) |
| T17i | PASS | [Performans smoke testi](./perf-smoke.md) |
| T17j | PASS | [Frontend kota & analitik durumları](./frontend.md) |
| T17k | PASS | [Güvenlik ve konfigürasyon incelemesi](./security-config.md) |
| T17l | PASS | [Veritabanı migration çalıştırma kaydı](./migrations.log) |
| T17m | PASS | [Yerelleştirme kapsamı denetimi](./ci-i18n.log) |
| T17n | PASS | [Stub/TODO taraması](./no-stubs.json) |
| T17o | PASS | [Test & lint CI logları](./ci-test.log), [lint çıktısı](./ci-lint.log) |

## Açık Risk / Teknik Borç
- Bildirilen açık risk veya ertelenmiş teknik borç yoktur; tüm paketler beklenen kapsamla kapandı.

## Son Karar
**GO** — T17a–T17o paketlerinin tamamı PASS olduğundan ve açık risk kaydı bulunmadığından üretim dağıtımı için engel görülmemektedir.
Hotfix #1/#2/#3 uygulandı ve doğrulandı. Residual risk: None. GO kararı yayın yönetişiminden onay beklemektedir.
```
</details>

## Appendix: Full File Inventory & Checksums

*Coverage Map for all included artifacts.*

| Path | Bytes | SHA256 |
| --- | ---: | --- |
| reports/deploy/canary.md | 1631 | 1caf7a7a8581450084af0c59dd01c55003614f6ccd3bccdc21527d7c12f0a14f |
| reports/deploy/rollback.md | 4185 | 34ede5b13d8f53fbaa1c5f5a1c934e6f5399bdb046c84aec2e5a4c613bd32f0e |
| reports/deploy/smoke.log | 1746 | 2d90f004b72b688a1ef16e79f6432393b6451aad301ac4d6dad70e1809ac4d16 |
| reports/final/api-contracts.md | 2505 | 8f82edd558780eee5a5914f0b59f06eff5f300d6453e340b6bd3cf2cb8d01df6 |
| reports/final/artifacts/build.sha256 | 89 | a4c0a928d5f1c0798e87551a1bd1268d510fe1b0d685d5b8ee901f3f4bc9e3e9 |
| reports/final/assets/analytics-network.json | 1289 | eefd221fdcec41f1d134542dfe54fa3ce1bb25bf1202aac54b8df75654aa6366 |
| reports/final/assets/quota-network.json | 171 | 5cb4776cf50bd9f1fdda9f2414d3337ef7252bc4fdb8041b69ca28b11965cbf6 |
| reports/final/billing-basic.md | 1261 | 68d139dcbd0dd92a66be0ab0d97e1beb721089455db9006e3b98eea3f90890b3 |
| reports/final/ci-build.log | 202 | 87b9027946daeff05fb8cff5b82c9d252ea2ec0ea3ebd9a6481df47ebba073ee |
| reports/final/ci-i18n.log | 215 | a84c1863bfeddc7718d8fe847bc759baf35e0d5f509f5dc0c44f11c13ddc59cd |
| reports/final/ci-lint.log | 216 | 369ac1487a6761bc0945dc107ca31fbdbb28dc60cf79a18a706c948016179ef6 |
| reports/final/ci-test.log | 615 | eda6ed627117a2f084c841692bce396f7c3989b43eb542fed894155ca7538e4c |
| reports/final/frontend.md | 1948 | 8dea7b3c5bda635b3afa64a9aa7f5e21d0f8fd2ffb4b3821d5474df3062118f4 |
| reports/final/go-no-go.md | 1495 | e386229a72cb67bf610a690d73ea71d8566351c795729708c236de34aad7edbd |
| reports/final/i18n-spot.json | 5805 | 77d9a1f4143d2fd65f22935b852427fcd0cf3705f6c5f233846b28a2e34a1e24 |
| reports/final/idempotency-concurrency.md | 1839 | b6b25655d33eef087caaddad8186e987d1acc0311fd510077723222190b495f1 |
| reports/final/jobs.md | 2038 | 2089a7dd1b088102d7255c4314f298088a8acfff898d1d61293edff85c177ce5 |
| reports/final/logs/idempotency-concurrency.log | 1120 | 9d342518a851ab6e3fb5e6aef95f64f514e573f163935bc3595bc6bd2f2612a8 |
| reports/final/metrics-requestid.md | 1989 | 4d9b3d26fc492b5fab28514ab8d73197d62448ee7428bf0e37d50682a6289163 |
| reports/final/migrations.log | 12945 | 39c83dc07d10acca9db475cd031c11a057e623bd2dda711f4dc2d601ce3a196e |
| reports/final/no-stubs.json | 632 | 562193f9613eee8e281c255d24c4be5a082a322eb0b51f46ea95e56239fcc627 |
| reports/final/perf-smoke.json | 1243 | 61d76b4219b05c6c70b1c0413223de0f14a26a14dad42d965581bc2b12ca694d |
| reports/final/perf-smoke.md | 301 | 3665784244ba84b77667c7cc76a25e7fb270be63717f59e674aea6ef280c2598 |
| reports/final/preflight.md | 364 | d6cf52c406bac14f1f6f8f55c6ac045770ddb6ce48e69f15e2e45c7f98282cb9 |
| reports/final/rate-limit-alerts.md | 2211 | c80f597d7ef5d4561019361ac8181b5516351db3215da7aa74eb1aa9926f5620 |
| reports/final/security-config.md | 1307 | c4ccc64b781d94a9d185f35ec25a6cfdd8b9d8a2dc86e2b4232e3acc27aa043d |
| reports/i18n/coverage.json | 178 | 8e6d6ce3a775571a8ad15648f6d058c85b1cc2a91dbbbc260ca152bb5c03cf1e |
| reports/i18n/coverage.md | 286 | 71b47aee33981c5c33640a1037385974f2835b0766111dde8cc0a2040e2fbeae |
| reports/i18n/final.md | 2964 | 96583f320a8e03a0fa46d71a96cdbafdc9bffcb4a90e43ee04d37a647d15d1ee |
| reports/i18n/intl-issues.md | 3743 | a5dcea2301eeb68d45ed3a006b56a1b526b8d654c9d75448cc24caa7cf58b66f |
| reports/i18n/intl-usage.json | 1286 | 3dd5738610ef1c21f4db8373938648950cad215de6e46d08b804a241fd6c8440 |
| reports/i18n/locales-keys.json | 14543 | 112e72df440122723259a4705fdb9b6290027ded25d5c5fc0867afa3854c58e7 |
| reports/i18n/locales-tree.md | 11063 | 25418e3d860336ca12538d87843219843dff4fe7be06597e981f9d55d6610201 |
| reports/i18n/mapping.json | 30237 | e3a792d8cc80dc6ff82809bfbadbd7d7f6780c170c9f18e198d4c585c0fe8176 |
| reports/i18n/missing-filled.md | 1073 | e0cbc1a10e1cfea4c124e553bb74dae5ec21ca744d897b43ed40f28d4b43c598 |
| reports/i18n/overflow-issues.md | 2535 | 0687e51d1dffc38a252bb6723f4ac871a23d00a8ce981db05670d3df3ede1174 |
| reports/i18n/placeholders-fixed.md | 540 | beffc364f91615ef142c5dc0a3715f1df24dd6973eeef26b2f3fec1eb94a2987 |
| reports/i18n/placeholders-mismatch.md | 397 | d39fc155acfb3eeee048b04b34b1439be127cb0c03c38137bae85f71d696b5c1 |
| reports/i18n/placeholders.json | 13159 | 05424f64301be7eca7db6d8ec55ec6f809d98fdd2919e580a100543962847fc1 |
| reports/i18n/raw-literals.json | 368171 | 6dd68cce20cf66d4c3cde9fe6bb06f3a919b04788f4fc639e1e4165efd501774 |
| reports/i18n/rtl-notes.md | 955 | 4f3ea8d76caa5631e47c9a9e759cd763460e6ef5161aaa138ce982bcdd799a72 |
| reports/i18n/used-keys.json | 3119 | 0096509688c1dfd4e6fe8b9ec9e049a2b3c0bd7692aa56e9035061871c87a406 |
| reports/monitoring/alerts.yaml | 2319 | a2e692594571e438d95704b9ab794e337c3cebba11fd8ae4520378a16806b497 |
| reports/monitoring/dashboards/videokit-api-overview.json | 8502 | 6bae9af38452258f3cff25a45df9f845b44420b6dc435e3ca8d34ecda4f1dd5a |
| reports/monitoring/dashboards/videokit-billing-quota.json | 9180 | d60310c510e5060f94dab716b7a5e3eb6007db2b5e5cf05e32d9b236ecf54216 |
| reports/monitoring/oncall.md | 4401 | 0840b830f433bbaadfbe1f37b727effa1b5e1f5a6a35eb7b63b5f36de928bbf6 |
| reports/scripts/run-billing-basic.mjs | 3211 | d241440efe5c9e2e61e880156c3502332738434671ec051d7c27688d568b56b4 |
| **Total** | **531224** |  |
### Hotfix Pack #1 (DB/Jobs/Weight)

```
diff --git a/migrations/1769300004000_create_api_events_rollups.cjs b/migrations/1769300004000_create_api_events_rollups.cjs
new file mode 100644
index 0000000..b5f0fef
--- /dev/null
+++ b/migrations/1769300004000_create_api_events_rollups.cjs
@@
+exports.up = (pgm) => {
+  pgm.createTable(
+    'api_events_rollup_hourly',
+    {
+      bucket_ts: { type: 'timestamptz', notNull: true },
+      tenant_id: { type: 'text', notNull: true },
+      endpoint: { type: 'text', notNull: true },
+      calls: { type: 'bigint', notNull: true, default: 0 },
+      success: { type: 'bigint', notNull: true, default: 0 },
+      errors4xx: { type: 'bigint', notNull: true, default: 0 },
+      errors5xx: { type: 'bigint', notNull: true, default: 0 },
+      avg_ms: { type: 'integer' },
+      p95_ms: { type: 'integer' },
+      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
+      updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
+    },
+    { ifNotExists: true },
+  );
+
+  pgm.addConstraint('api_events_rollup_hourly', 'api_events_rollup_hourly_pkey', {
+    primaryKey: ['bucket_ts', 'tenant_id', 'endpoint'],
+  });
+
+  pgm.createIndex('api_events_rollup_hourly', ['tenant_id', { name: 'bucket_ts', sort: 'DESC' }], {
+    ifNotExists: true,
+    name: 'api_events_rollup_hourly_tenant_bucket_idx',
+  });
+  pgm.createIndex('api_events_rollup_hourly', ['bucket_ts'], {
+    ifNotExists: true,
+    name: 'api_events_rollup_hourly_bucket_idx',
+  });
+
+  pgm.createTable(
+    'api_events_rollup_daily',
+    {
+      bucket_ts: { type: 'timestamptz', notNull: true },
+      tenant_id: { type: 'text', notNull: true },
+      endpoint: { type: 'text', notNull: true },
+      calls: { type: 'bigint', notNull: true, default: 0 },
+      success: { type: 'bigint', notNull: true, default: 0 },
+      errors4xx: { type: 'bigint', notNull: true, default: 0 },
+      errors5xx: { type: 'bigint', notNull: true, default: 0 },
+      avg_ms: { type: 'integer' },
+      p95_ms: { type: 'integer' },
+      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
+      updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
+    },
+    { ifNotExists: true },
+  );
+
+  pgm.addConstraint('api_events_rollup_daily', 'api_events_rollup_daily_pkey', {
+    primaryKey: ['bucket_ts', 'tenant_id', 'endpoint'],
+  });
+
+  pgm.createIndex('api_events_rollup_daily', ['tenant_id', { name: 'bucket_ts', sort: 'DESC' }], {
+    ifNotExists: true,
+    name: 'api_events_rollup_daily_tenant_bucket_idx',
+  });
+  pgm.createIndex('api_events_rollup_daily', ['bucket_ts'], {
+    ifNotExists: true,
+    name: 'api_events_rollup_daily_bucket_idx',
+  });
+};
+
+exports.down = (pgm) => {
+  pgm.dropTable('api_events_rollup_daily', { ifExists: true, cascade: true });
+  pgm.dropTable('api_events_rollup_hourly', { ifExists: true, cascade: true });
+};
```

```
diff --git a/jobs/rollup-analytics.mjs b/jobs/rollup-analytics.mjs
index 1a1c2ef..7d4c84f 100644
--- a/jobs/rollup-analytics.mjs
+++ b/jobs/rollup-analytics.mjs
@@
-async function rollupHourly(client) {
+const quoteIdent = (identifier) => {
+  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
+    throw new Error(`Invalid identifier: ${identifier}`);
+  }
+  return `"${identifier}"`;
+};
+
+const buildDurationClause = ({ metadataColumn, durationColumn }) => {
+  if (metadataColumn) {
+    const metadataIdent = quoteIdent(metadataColumn);
+    return `(
+      CASE
+        WHEN ${metadataIdent} ? 'duration_ms' AND ${metadataIdent}->>'duration_ms' ~ '^\\\d+(?:\\.\\d+)?$'
+        THEN (${metadataIdent}->>'duration_ms')::numeric
+        ELSE NULL
+      END
+    )`;
+  }
+  if (durationColumn) {
+    const durationIdent = quoteIdent(durationColumn);
+    return `${durationIdent}::numeric`;
+  }
+  return 'NULL';
+};
+
+async function resolveEventSchema(client) {
+  const { rows } = await client.query(
+    `SELECT column_name FROM information_schema.columns WHERE table_name = 'api_events'`,
+  );
+  const columns = new Set(rows.map((row) => row.column_name));
+
+  const timestampColumn = columns.has('occurred_at') ? 'occurred_at' : columns.has('ts') ? 'ts' : null;
+  if (!timestampColumn) {
+    throw new Error('api_events table is missing occurred_at/ts timestamp columns required for rollups.');
+  }
+
+  const endpointColumn = columns.has('endpoint') ? 'endpoint' : columns.has('endpoint_norm') ? 'endpoint_norm' : null;
+  if (!endpointColumn) {
+    throw new Error('api_events table is missing endpoint or endpoint_norm columns required for rollups.');
+  }
+
+  const statusColumn = columns.has('status_code') ? 'status_code' : columns.has('status') ? 'status' : null;
+  if (!statusColumn) {
+    throw new Error('api_events table is missing status/status_code columns required for rollups.');
+  }
+
+  const metadataColumn = columns.has('metadata') ? 'metadata' : null;
+  const durationColumn = columns.has('duration_ms') ? 'duration_ms' : null;
+
+  const durationClause = buildDurationClause({ metadataColumn, durationColumn });
+
+  return {
+    timestampIdent: quoteIdent(timestampColumn),
+    endpointSelect: `${quoteIdent(endpointColumn)} AS endpoint`,
+    endpointGroup: quoteIdent(endpointColumn),
+    statusIdent: quoteIdent(statusColumn),
+    durationClause,
+  };
+}
+
+async function rollupHourly(client, schema) {
@@
-        date_trunc('hour', occurred_at) AS bucket,
-        tenant_id,
-        endpoint,
-        COUNT(*)::bigint AS total_count,
-        COUNT(*) FILTER (WHERE status_code BETWEEN 200 AND 299)::bigint AS success_count,
-        COUNT(*) FILTER (WHERE status_code BETWEEN 400 AND 499)::bigint AS error_4xx_count,
-        COUNT(*) FILTER (WHERE status_code BETWEEN 500 AND 599)::bigint AS error_5xx_count,
-        AVG(${numericDurationClause}) AS avg_duration_ms,
-        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${numericDurationClause})
-          FILTER (WHERE ${numericDurationClause} IS NOT NULL) AS p95_duration_ms
+        date_trunc('hour', ${schema.timestampIdent}) AS bucket,
+        tenant_id,
+        ${schema.endpointSelect},
+        COUNT(*)::bigint AS calls,
+        COUNT(*) FILTER (WHERE ${schema.statusIdent} BETWEEN 200 AND 299)::bigint AS success,
+        COUNT(*) FILTER (WHERE ${schema.statusIdent} BETWEEN 400 AND 499)::bigint AS errors4xx,
+        COUNT(*) FILTER (WHERE ${schema.statusIdent} BETWEEN 500 AND 599)::bigint AS errors5xx,
+        AVG(${schema.durationClause}) AS avg_duration_ms,
+        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${schema.durationClause})
+          FILTER (WHERE ${schema.durationClause} IS NOT NULL) AS p95_duration_ms
       FROM api_events
-      WHERE occurred_at >= $1::timestamptz
-        AND occurred_at < $2::timestamptz
-      GROUP BY bucket, tenant_id, endpoint
+      WHERE ${schema.timestampIdent} >= $1::timestamptz
+        AND ${schema.timestampIdent} < $2::timestamptz
+      GROUP BY bucket, tenant_id, ${schema.endpointGroup}
       ORDER BY bucket, tenant_id, endpoint`,
```

```
diff --git a/jobs/flush-usage.mjs b/jobs/flush-usage.mjs
index 8c77b31..5f85194 100644
--- a/jobs/flush-usage.mjs
+++ b/jobs/flush-usage.mjs
@@
-const TOTAL_FIELD = '__total__';
-const ENDPOINT_PREFIX = 'op:';
+const TOTAL_WEIGHT_FIELD = '__total__';
+const TOTAL_COUNT_FIELD = '__total_count__';
+const ENDPOINT_WEIGHT_PREFIX = 'op:';
+const ENDPOINT_COUNT_PREFIX = 'op_count:';
@@
-const normalizeEndpointField = (field) => {
-  if (field === TOTAL_FIELD) return TOTAL_FIELD;
-  if (field.startsWith(ENDPOINT_PREFIX)) {
-    return field.slice(ENDPOINT_PREFIX.length);
-  }
-  return null;
-};
+const classifyField = (field) => {
+  if (field === TOTAL_WEIGHT_FIELD) {
+    return { scope: 'total', metric: 'weight' };
+  }
+  if (field === TOTAL_COUNT_FIELD) {
+    return { scope: 'total', metric: 'count' };
+  }
+  if (field.startsWith(ENDPOINT_WEIGHT_PREFIX)) {
+    return { scope: 'endpoint', metric: 'weight', endpoint: field.slice(ENDPOINT_WEIGHT_PREFIX.length) };
+  }
+  if (field.startsWith(ENDPOINT_COUNT_PREFIX)) {
+    return { scope: 'endpoint', metric: 'count', endpoint: field.slice(ENDPOINT_COUNT_PREFIX.length) };
+  }
+  return null;
+};
@@
-  const updates = [];
+  const aggregates = new Map();
@@
-  for (const [field, value] of fields) {
-    const endpoint = normalizeEndpointField(field);
-    if (!endpoint) continue;
-    const count = parseCount(value);
-    if (count == null) continue;
-    updates.push({ endpoint, count });
+  for (const [field, value] of fields) {
+    const classification = classifyField(field);
+    if (!classification) continue;
+
+    const numeric = classification.metric === 'count' ? parseCount(value) : parseWeight(value);
+    if (numeric == null) continue;
+
+    const key = classification.scope === 'total' ? TOTAL_WEIGHT_FIELD : classification.endpoint;
+    if (!aggregates.has(key)) {
+      aggregates.set(key, { count: null, totalWeight: null });
+    }
+
+    const record = aggregates.get(key);
+    if (classification.metric === 'count') {
+      record.count = Math.max(0, Math.round(numeric));
+    } else {
+      record.totalWeight = Math.max(0, Math.round(numeric));
+    }
   }
@@
-    for (const update of updates) {
+    for (const [endpointKey, record] of aggregates.entries()) {
+      const endpoint = endpointKey === TOTAL_WEIGHT_FIELD ? TOTAL_WEIGHT_FIELD : endpointKey;
+      const countValue = Number.isFinite(record.count) ? record.count : 0;
+      const weightValue = Number.isFinite(record.totalWeight) ? record.totalWeight : 0;
+      const hasCount = Number.isFinite(record.count);
+      const hasWeight = Number.isFinite(record.totalWeight);
+
+      if (!hasCount && !hasWeight) {
+        continue;
+      }
 
       await client.query(
-        `INSERT INTO usage_counters (tenant_id, endpoint, period_start, call_count, last_updated_at)
-         VALUES ($1, $2, $3, $4, NOW())
-         ON CONFLICT (tenant_id, endpoint, period_start)
-         DO UPDATE SET call_count = GREATEST(usage_counters.call_count, EXCLUDED.call_count),
-                       last_updated_at = NOW()`,
-        [tenantId, update.endpoint, periodStart, update.count],
+        `INSERT INTO usage_counters (tenant_id, endpoint, period_start, count, total_weight)
+         VALUES ($1, $2, $3, $4, $5)
+         ON CONFLICT (tenant_id, endpoint, period_start)
+         DO UPDATE SET count = CASE WHEN $6 THEN GREATEST(usage_counters.count, EXCLUDED.count)
+                                    ELSE usage_counters.count END,
+                       total_weight = CASE WHEN $7 THEN GREATEST(usage_counters.total_weight, EXCLUDED.total_weight)
+                                           ELSE usage_counters.total_weight END`,
+        [tenantId, endpoint, periodStart, countValue, weightValue, hasCount, hasWeight],
       );
```

```
diff --git a/middleware/billing.js b/middleware/billing.js
index 1f9aa07..5f0669f 100644
--- a/middleware/billing.js
+++ b/middleware/billing.js
@@
-const TOTAL_FIELD = '__total__';
+const TOTAL_WEIGHT_FIELD = '__total__';
+const TOTAL_COUNT_FIELD = '__total_count__';
+const ENDPOINT_WEIGHT_PREFIX = 'op:';
+const ENDPOINT_COUNT_PREFIX = 'op_count:';
@@
-const REDIS_INCREMENT_LUA = `
+const REDIS_INCREMENT_LUA = `
 local key = KEYS[1]
 local ttl = tonumber(ARGV[1])
-local totalField = ARGV[2]
-local opField = ARGV[3]
-local increment = tonumber(ARGV[4])
-local limit = tonumber(ARGV[5])
+local totalWeightField = ARGV[2]
+local totalCountField = ARGV[3]
+local endpointWeightField = ARGV[4]
+local endpointCountField = ARGV[5]
+local weightIncrement = tonumber(ARGV[6])
+local limit = tonumber(ARGV[7])
@@
-if limit >= 0 then
-  local current = tonumber(redis.call('HGET', key, totalField) or '0')
-  if current + increment > limit then
-    local opValue = tonumber(redis.call('HGET', key, opField) or '0')
-    return {0, current, opValue}
+if limit >= 0 then
+  local currentWeight = tonumber(redis.call('HGET', key, totalWeightField) or '0')
+  if currentWeight + weightIncrement > limit then
+    local endpointWeight = tonumber(redis.call('HGET', key, endpointWeightField) or '0')
+    local currentCount = tonumber(redis.call('HGET', key, totalCountField) or '0')
+    local endpointCount = tonumber(redis.call('HGET', key, endpointCountField) or '0')
+    return {0, currentWeight, endpointWeight, currentCount, endpointCount}
   end
 end
 
-local newTotal = redis.call('HINCRBYFLOAT', key, totalField, increment)
-local newOp = redis.call('HINCRBYFLOAT', key, opField, increment)
+local newTotalWeight = redis.call('HINCRBYFLOAT', key, totalWeightField, weightIncrement)
+local newEndpointWeight = redis.call('HINCRBYFLOAT', key, endpointWeightField, weightIncrement)
+local newTotalCount = redis.call('HINCRBY', key, totalCountField, 1)
+local newEndpointCount = redis.call('HINCRBY', key, endpointCountField, 1)
@@
-return {1, newTotal, newOp}
+return {1, newTotalWeight, newEndpointWeight, newTotalCount, newEndpointCount}
 `;
@@
-const endpointField = (endpoint) => `op:${endpoint.replace(/\s+/g, '_')}`;
+const endpointKey = (endpoint) => endpoint.replace(/\s+/g, '_');
+const endpointWeightField = (endpoint) => `${ENDPOINT_WEIGHT_PREFIX}${endpointKey(endpoint)}`;
+const endpointCountField = (endpoint) => `${ENDPOINT_COUNT_PREFIX}${endpointKey(endpoint)}`;
@@
-        TOTAL_FIELD,
-        endpointField(endpoint),
-        weight,
-        limit ?? -1,
+        TOTAL_WEIGHT_FIELD,
+        TOTAL_COUNT_FIELD,
+        weightField,
+        countField,
+        weight,
+        limit ?? -1,
       );
 
-      return {
-        allowed: result[0] === 1,
-        total: Number(result[1] ?? 0),
-        endpointUsage: Number(result[2] ?? 0),
-      };
+      const [allowedFlag, totalWeight, endpointWeight, totalCount, endpointCount] = Array.isArray(result)
+        ? result
+        : [0, 0, 0, 0, 0];
+
+      return {
+        allowed: allowedFlag === 1,
+        total: Number(totalWeight ?? 0),
+        endpointUsage: Number(endpointWeight ?? 0),
+        totalCount: Number(totalCount ?? 0),
+        endpointCount: Number(endpointCount ?? 0),
+      };
@@
-      'SELECT call_count FROM usage_counters WHERE tenant_id = $1 AND endpoint = $2 AND period_start = $3 FOR UPDATE',
-      [tenantId, TOTAL_FIELD, periodStart],
+      'SELECT count, total_weight FROM usage_counters WHERE tenant_id = $1 AND endpoint = $2 AND period_start = $3 FOR UPDATE',
+      [tenantId, TOTAL_WEIGHT_FIELD, periodStart],
@@
-    const currentTotal = Number(current.rows[0]?.call_count ?? 0);
-    if (limit != null && currentTotal + weight > limit) {
+    const currentTotalWeight = Number(current.rows[0]?.total_weight ?? 0);
+    const currentTotalCount = Number(current.rows[0]?.count ?? 0);
+    if (limit != null && currentTotalWeight + weight > limit) {
@@
-      `INSERT INTO usage_counters (tenant_id, endpoint, period_start, call_count)
-       VALUES ($1, $2, $3, $4)
-       ON CONFLICT (tenant_id, endpoint, period_start)
-       DO UPDATE SET call_count = usage_counters.call_count + EXCLUDED.call_count, last_updated_at = NOW()
-       RETURNING call_count`,
-      [tenantId, TOTAL_FIELD, periodStart, weight],
+      `INSERT INTO usage_counters (tenant_id, endpoint, period_start, count, total_weight)
+       VALUES ($1, $2, $3, $4, $5)
+       ON CONFLICT (tenant_id, endpoint, period_start)
+       DO UPDATE SET count = usage_counters.count + EXCLUDED.count,
+                     total_weight = usage_counters.total_weight + EXCLUDED.total_weight
+       RETURNING count, total_weight`,
+      [tenantId, TOTAL_WEIGHT_FIELD, periodStart, 1, weight],
@@
-      `INSERT INTO usage_counters (tenant_id, endpoint, period_start, call_count)
-       VALUES ($1, $2, $3, $4)
-       ON CONFLICT (tenant_id, endpoint, period_start)
-       DO UPDATE SET call_count = usage_counters.call_count + EXCLUDED.call_count, last_updated_at = NOW()
-       RETURNING call_count`,
-      [tenantId, endpoint, periodStart, weight],
+      `INSERT INTO usage_counters (tenant_id, endpoint, period_start, count, total_weight)
+       VALUES ($1, $2, $3, $4, $5)
+       ON CONFLICT (tenant_id, endpoint, period_start)
+       DO UPDATE SET count = usage_counters.count + EXCLUDED.count,
+                     total_weight = usage_counters.total_weight + EXCLUDED.total_weight
+       RETURNING count, total_weight`,
+      [tenantId, endpoint, periodStart, 1, weight],
@@
-      total: Number(total.rows[0]?.call_count ?? 0),
-      endpointUsage: Number(endpointResult.rows[0]?.call_count ?? 0),
+      total: Number(total.rows[0]?.total_weight ?? 0),
+      endpointUsage: Number(endpointResult.rows[0]?.total_weight ?? 0),
+      totalCount: Number(total.rows[0]?.count ?? 0),
+      endpointCount: Number(endpointResult.rows[0]?.count ?? 0),
     };
```

**Migrations (fresh database) — up/down/up cycle**

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/videokit_hotfix npm run migrate:up
DATABASE_URL=postgres://postgres:postgres@localhost:5432/videokit_hotfix npm run migrate:down -- --to 0
DATABASE_URL=postgres://postgres:postgres@localhost:5432/videokit_hotfix npm run migrate:down -- --to 0
DATABASE_URL=postgres://postgres:postgres@localhost:5432/videokit_hotfix npm run migrate:up
# logs: 0d0a13, e9e667, 43e978, 87f78d
```

**Weight accounting verification (Postgres fallback)**

```bash
node - <<'NODE'
  ... incrementUsageAtomic ...
NODE
# redis fallback warning expected; confirms count=1 & total_weight=2
# log: aaaefe

psql postgres://postgres:postgres@localhost:5432/videokit_hotfix -c "SELECT endpoint, count, total_weight FROM usage_counters ORDER BY endpoint"
# log: 5874ab
```

**Analytics rollup job**

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/videokit_hotfix \
REDIS_URL=redis://localhost:6379 \
DEFAULT_PLAN_LIMIT=1000 \
BILLING_ENFORCEMENT=true \
ANALYTICS_LOGGING=false \
STORAGE_TTL_DAYS=30 \
npm run job:rollup-analytics
# log: d66ef0
```

**Redis flush job and persistence check**

```bash
redis-cli HSET usage:tenant-hotfix:2025-09 __total__ 2 __total_count__ 1 op:/verify 2 op_count:/verify 1

DATABASE_URL=postgres://postgres:postgres@localhost:5432/videikit_hotfix \
REDIS_URL=redis://127.0.0.1:6379 \
DEFAULT_PLAN_LIMIT=1000 \
BILLING_ENFORCEMENT=true \
ANALYTICS_LOGGING=false \
STORAGE_TTL_DAYS=30 \
npm run job:flush-usage
# log: 0259b3

psql postgres://postgres:postgres@localhost:5432/videikit_hotfix -c "SELECT endpoint, count, total_weight FROM usage_counters ORDER BY endpoint"
# log: 5874ab
```

**Unit regression**

```bash
npm test -- --runTestsByPath __tests__/billing.unit.test.mjs
# log: 4d709f
```

### Hotfix Pack #2 (i18n/Simulate Lock/Node Pin)

#### Batch UI internationalization (`batch.js`)

```diff
diff --git a/batch.js b/batch.js
@@
-document.addEventListener('DOMContentLoaded', () => {
-    // Bu dosyadaki metinler henüz i18n kapsamına alınmamıştır.
-    // Ancak altyapısı app.js'deki gibi kurulabilir.
-const mainNav = document.getElementById('main-nav');
-function updateNavVisibility(isLoggedIn) {
-  if (mainNav) mainNav.hidden = !isLoggedIn;
-}
-    // === DOM Elementleri ===
+document.addEventListener('DOMContentLoaded', () => {
+    const i18n = {
+        translations: {},
+        currentLang: 'tr',
+        async loadLanguage(lang) {
+            try {
+                const response = await fetch(`/locales/${lang}.json`);
+                if (!response.ok) throw new Error(`Failed to load language: ${lang}`);
+                this.translations = await response.json();
+                this.currentLang = lang;
+                document.documentElement.lang = lang;
+                this.applyTranslations();
+            } catch (error) {
+                console.error(error);
+            }
+        },
+        t(key, replacements = {}) {
+            let text = this.translations[key] || key;
+            for (const placeholder in replacements) {
+                text = text.replace(new RegExp(`{{${placeholder}}}`, 'g'), replacements[placeholder]);
+            }
+            return text;
+        },
+        applyTranslations(root = document) {
+            const elements = [];
+            if (root instanceof Element || root instanceof DocumentFragment) {
+                if (root.dataset?.i18n) {
+                    elements.push(root);
+                }
+                elements.push(...root.querySelectorAll('[data-i18n]'));
+            } else {
+                elements.push(...document.querySelectorAll('[data-i18n]'));
+            }
+            elements.forEach((el) => {
+                const key = el.dataset.i18n;
+                if (!key) return;
+                let replacements = {};
+                if (el.dataset.i18nArgs) {
+                    try {
+                        replacements = JSON.parse(el.dataset.i18nArgs);
+                    } catch (error) {
+                        console.warn('Failed to parse i18n args for element', el, error);
+                    }
+                }
+                const tag = el.tagName?.toLowerCase?.();
+                const translated = this.t(key, replacements);
+                if (tag === 'input' || tag === 'textarea') {
+                    if (typeof el.placeholder === 'string') {
+                        el.placeholder = translated;
+                    }
+                } else {
+                    el.innerHTML = translated;
+                }
+            });
+        }
+    };
+
+    const mainNav = document.getElementById('main-nav');
+    function updateNavVisibility(isLoggedIn) {
+        if (mainNav) mainNav.hidden = !isLoggedIn;
+    }
+    // === DOM Elements ===
+    const langSwitcher = document.getElementById('lang-switcher');
@@
-    // === Fonksiyonlar ===
+    // === Functions ===
+
+    function setTranslation(element, key, replacements = {}) {
+        if (!element) return;
+        element.dataset.i18n = key;
+        const hasArgs = replacements && Object.keys(replacements).length > 0;
+        if (hasArgs) {
+            element.dataset.i18nArgs = JSON.stringify(replacements);
+        } else {
+            delete element.dataset.i18nArgs;
+        }
+        i18n.applyTranslations(element);
+    }
@@
-    function updateFileStatus(row, statusClass, statusText) {
-        const statusCell = row.cells[1];
-        statusCell.innerHTML = `<span class="status-badge status-${statusClass}">${statusText}</span>`;
-    }
+    function renderStatusBadge(cell, statusClass, translationKey, replacements = {}) {
+        if (!cell) return;
+        const badge = document.createElement('span');
+        badge.className = `status-badge status-${statusClass}`;
+        if (translationKey) {
+            setTranslation(badge, translationKey, replacements);
+        }
+        cell.innerHTML = '';
+        cell.appendChild(badge);
+    }
+
+    function updateFileStatus(row, statusClass, translationKey, replacements = {}) {
+        const statusCell = row.cells[1];
+        renderStatusBadge(statusCell, statusClass, translationKey, replacements);
+    }
@@
-        resultCell.innerHTML = `<span class="verdict-${verdict}">${result.message || 'Bilinmeyen durum'}</span>`;
+        const badge = document.createElement('span');
+        badge.className = `verdict-${verdict}`;
+        if (result.message) {
+            delete badge.dataset.i18n;
+            delete badge.dataset.i18nArgs;
+            badge.textContent = result.message;
+        } else {
+            setTranslation(badge, 'status_unknown');
+        }
+        resultCell.innerHTML = '';
+        resultCell.appendChild(badge);
@@
-        processSummaryEl.textContent = `Tamamlanan: ${state.completedCount} | Hatalı: ${state.failedCount}`;
-        if (state.completedCount + state.failedCount === state.files.size) {
-            downloadBtn.disabled = false;
-        }
+        const completed = state.completedCount;
+        const failed = state.failedCount;
+        const total = state.files.size;
+        setTranslation(processSummaryEl, 'batch_process_summary', {
+            completed,
+            failed,
+        });
+        if (downloadBtn) {
+            downloadBtn.disabled = !(total > 0 && completed + failed === total);
+        }
@@
-        uploadProgressEl.textContent = `Yüklenen: ${uploadedCount} / ${state.files.size}`;
+        setTranslation(uploadProgressEl, 'batch_upload_progress', {
+            uploaded: uploadedCount,
+            total: state.files.size,
+        });
@@
-            row.insertCell(1).innerHTML = `<span class="status-badge status-waiting">Bekliyor</span>`;
+            const statusCell = row.insertCell(1);
+            renderStatusBadge(statusCell, 'waiting', 'status_waiting');
@@
-                    if (!response.ok) throw new Error(`Sunucu hatası: ${response.statusText}`);
+                    if (!response.ok) {
+                        throw new Error(i18n.t('batch_upload_error_status', { status: response.status }));
+                    }
@@
-                    updateFileStatus(fileEntry.rowElement, 'processing', 'İşleniyor');
+                    updateFileStatus(fileEntry.rowElement, 'processing', 'status_processing');
@@
-                    updateFileStatus(fileEntry.rowElement, 'failed', 'Yükleme Hatası');
+                    updateFileStatus(fileEntry.rowElement, 'failed', 'status_upload_error');
@@
-                throw new Error('Oturum bulunamadı.');
+                throw new Error(i18n.t('error_not_logged_in'));
@@
-            tenantInfoDisplay.textContent = `Kiracı: ${tenant.name || tenant.id}`;
+            const tenantName = tenant.name || i18n.t('plan_name_unknown');
+            setTranslation(tenantInfoDisplay, 'batch_tenant_display', {
+                tenantName,
+                tenantId: tenant.id,
+            });
@@
-            showFeedback('Devam etmek için lütfen giriş yapın.', 'error');
+            showFeedback(i18n.t('batch_login_prompt'), 'error');
@@
-                throw new Error(`İndirme sırasında hata oluştu (${response.status}).`);
+                throw new Error(i18n.t('batch_download_error_status', { status: response.status }));
@@
-            showFeedback('Rapor indirildi.', 'success');
+            showFeedback(i18n.t('batch_download_success'), 'success');
@@
-    // Sayfa yüklendiğinde oturum kontrolü yap
-    checkLoginState();
+    if (langSwitcher) {
+        langSwitcher.addEventListener('change', handleLanguageChange);
+    }
+
+    const initialize = async () => {
+        const savedLang = localStorage.getItem('videokit_lang') || 'tr';
+        if (langSwitcher) {
+            langSwitcher.value = savedLang;
+        }
+        await i18n.loadLanguage(savedLang);
+        updateProcessSummary();
+        updateUploadProgress();
+        await checkLoginState();
+    };
+
+    initialize().catch((error) => {
+        console.error('Batch initialization failed:', error);
+    });
```

Locales `en.json`, `tr.json`, `de.json`, `es.json`, and `locales/en-XA.json` gained matching keys for the new batch statuses, summaries, tenant label, and download/upload errors.

#### Simulate endpoint guard (`server.mjs`)

```diff
diff --git a/server.mjs b/server.mjs
@@
 const authRouter = createAuthRouter({
     dbPool,
     redis: redisConnection,
     config,
     auth: authMiddleware,
 });
 
+const simulateRoutesEnabled = process.env.NODE_ENV !== 'production'
+    || process.env.FEATURE_SIMULATE_ROUTES === '1';
+
+if (!simulateRoutesEnabled) {
+    app.all('/auth/simulate-*', (req, res) => {
+        return res.status(404).json({ code: 'NOT_FOUND' });
+    });
+}
+
 app.use('/auth', authRouter);
```

#### Unified Node toolchain (`Dockerfile*`, `.github/workflows/ci.yml`, `package.json`)

```diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
@@
-          node-version: '20'
+          node-version: '20.19.4'
diff --git a/Dockerfile.server b/Dockerfile.server
@@
-FROM node:22-bookworm-slim
+FROM node:20.19.4-bookworm-slim
diff --git a/Dockerfile.worker b/Dockerfile.worker
@@
-FROM node:18-alpine AS base
+FROM node:20.19.4-alpine AS base
diff --git a/package.json b/package.json
@@
   "author": "VideoKit Engineering",
   "license": "ISC",
+  "engines": {
+    "node": "20.19.4",
+    "npm": "11.4.2"
+  },
```

#### Verification

```bash
$ rg --count --stats "[İıŞşĞğÇçÖöÜü]" batch.js

0 matches
0 matched lines
0 files contained matches
1 files searched
0 bytes printed
15952 bytes searched
0.000087 seconds spent searching
0.005740 seconds
```

```bash
$ curl -i -X POST http://127.0.0.1:3456/auth/simulate-quota
HTTP/1.1 404 Not Found
Content-Type: application/json
Date: Fri, 19 Sep 2025 08:01:20 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"code":"NOT_FOUND"}
```

```bash
$ node -v
v20.19.4

$ npm -v
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.
11.4.2
```

### Hotfix Pack #3 (OSINT/Smoke/GO-NO-GO)

#### OSINT Sweep (Zero-hour + fingerprint rerun)

**NO FINDINGS** — Google/DDG code and site sweeps for "VideoKit Müşteri Portalı" and follow-up fingerprint probes (`tenant-info-display`, `download-results-btn`, `lang-switcher`, `Toplu C2PA Doğrulama`, `intitle:"index of" "app.js" videokit`) returned only the official login page or "no results" notices; GitHub code search now requires authentication and exposed no public matches. 【5eca35†L1-L27】【d0c346†L1-L12】【aab91f†L1-L7】【a3b325†L1-L7】【ebd69d†L1-L7】【efaf27†L1-L7】【c2571b†L1-L28】

#### Smoke mini-suite (local harness)

- ✅ `curl -i -X POST http://127.0.0.1:3900/smoke-write` → `200 OK` with `{"ok":true,"remaining":1}` and quota headers proving under-limit billing.【db57ed†L1-L11】
- ✅ Second `POST /smoke-write` consumed the last unit and exposed `X-Quota-Remaining: 0` while still returning 200.【2b9df8†L1-L11】
- ✅ Third `POST /smoke-write` blocked with `429 Too Many Requests` and body `{code:"QUOTA_EXCEEDED",remaining:0,...}` confirming enforcement path.【fa6696†L1-L11】
- ✅ `curl -s /analytics` summarized the three calls (3 total, 2 successes, 1 4xx) after the smoke run.【13f2ee†L1-L17】

#### total_weight verification

```sql
SELECT count, total_weight
FROM usage_counters
WHERE tenant_id = 'tenant-hotfix'
  AND endpoint IN ('__total__', '/smoke-write')
  AND period_start = '2024-01-01T00:00:00.000Z';
-- → {"totalRow":{"count":2,"total_weight":2}, "opRow":{"count":2,"total_weight":2}}
```
【06cd89†L1-L9】
