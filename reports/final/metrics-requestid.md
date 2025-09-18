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
