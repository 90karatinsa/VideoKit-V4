# Canary Deploy Plan — Paket 7 (T18b + T18c)

## Scope
- **Feature**: Billing enforcement with usage caps (feature flag: `BILLING_ENFORCEMENT`).
- **Release package**: Paket 7 — tasks T18b and T18c.
- **Services touched**: Billing API, usage metering workers, tenant analytics pipeline.

## Target Environment
- **Cluster**: `prod-eu-west-1`
- **Deployment window**: 2024-06-03 19:00–20:00 UTC
- **Ingress**: `https://api.eu.video-kit.example.com`
- **Global flag default**: `BILLING_ENFORCEMENT=off` (remains off until post-canary promotion)

## Canary Tenants
| Tenant ID | Display name           | Flag state | Notes |
|-----------|------------------------|------------|-------|
| `tn-4582` | Acme Studio EU Sandbox | `on`       | Current high-volume pilot customer with customer success on-call |
| `tn-9014` | Lumiere Testbed        | `on`       | Synthetic load tenant mirroring enterprise traffic |

## Pre-Deployment Checklist
1. ✅ Confirm latest database migrations are applied in staging.
2. ✅ Verify `usage-metering` Kafka consumer lag is < 100 messages in production.
3. ✅ Align with CS on contact persons: `@ema` (Acme), `@orhan` (Lumiere).
4. ✅ Validate rollback artifacts packaged: `videokit-api:7.18.0` and `usage-worker:7.18.0`.
5. ✅ Ensure `VIDEO_KIT_ADMIN_TOKEN` secret available in deployment runner.

## Deployment Steps
1. **Announce start** in #deployments with change summary and link to this plan.
2. **Deploy application**
   - Trigger GitHub Actions workflow: `prod_canary_api.yml` with parameter `package=P7`.
   - Monitor rollout status in ArgoCD (`videokit-api` and `usage-worker` apps) until healthy.
3. **Run database migrations** (if not auto-run)
   - `kubectl -n billing exec deploy/videokit-api -- node node-pg-migrate up`.
4. **Warm caches**
   - `curl -H "Authorization: Bearer $CACHE_TOKEN" https://api.eu.video-kit.example.com/v1/tenants/cache-warmup`.

## Feature Flag Control
Use the helper script committed with this plan:

```bash
# enable for tenant
VIDEO_KIT_ADMIN_TOKEN=*** TARGET_ENV=prod-eu-west-1 \
  ./scripts/deploy/flag-toggle.sh enable BILLING_ENFORCEMENT --tenant tn-4582

# disable for tenant
VIDEO_KIT_ADMIN_TOKEN=*** TARGET_ENV=prod-eu-west-1 \
  ./scripts/deploy/flag-toggle.sh disable BILLING_ENFORCEMENT --tenant tn-4582

# show current flag state
VIDEO_KIT_ADMIN_TOKEN=*** TARGET_ENV=prod-eu-west-1 \
  ./scripts/deploy/flag-toggle.sh status BILLING_ENFORCEMENT --tenant tn-4582
```

The script defaults to the global flag scope when no `--tenant` argument is given. Global flag must remain **off** throughout the canary.

## Canary Verification Steps
1. Confirm only canary tenants have the flag **on** (`status` command above).
2. Run targeted health checks:
   - `GET /v1/usage/quota` for each canary tenant → expect `429` when over the limit (synthetic load).
   - `POST /v1/jobs` under quota → expect `200` and `X-Request-ID` header.
   - `GET /v1/analytics/events?range=1h` → expect `200`.
3. Observe billing dashboards:
   - Grafana: `Billing / Enforcement` → watch `quota_denials` for canary tenants only.
   - Datadog log pattern: `service:videokit-api feature_flag:BILLING_ENFORCEMENT tenant:tn-4582`.
4. Maintain real-time comms with CSMs for customer-reported anomalies.
5. Log findings and timestamps in `reports/deploy/canary.md`.

## Exit Criteria
- ✅ No elevated error rates (>1% 5xx) for canary tenants after 30 minutes.
- ✅ Billing enforcement correctly blocks over-quota requests while allowing under-quota traffic.
- ✅ Post-deploy smoke tests (see below) succeed with evidence.
- ✅ No customer escalations for 45 minutes post-deploy.

If any criteria fail, disable the flag for the affected tenant(s) and notify incident channel. Rollback to previous package if systemic issues are detected.

## Post-Canary Actions
1. If successful for 60 minutes, schedule flag promotion window (global enablement) with SRE.
2. Archive observability snapshots and smoke logs under `reports/deploy/`.
3. Update release notes with enforcement go-live details.
