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
