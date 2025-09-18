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
