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
