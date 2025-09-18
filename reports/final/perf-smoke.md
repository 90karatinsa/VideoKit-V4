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
