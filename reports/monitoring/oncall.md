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
