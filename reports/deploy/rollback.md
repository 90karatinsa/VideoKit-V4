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
