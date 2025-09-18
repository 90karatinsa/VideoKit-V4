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
