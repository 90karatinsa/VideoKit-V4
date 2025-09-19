#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/deploy/rollback.sh [options]

Performs a Helm rollback for one or more VideoKit releases and waits for the
underlying Kubernetes deployments to become healthy again.

Options:
  --release <name>       Helm release name to rollback. Can be repeated.
                         Defaults to the releases listed in ROLLBACK_RELEASES or
                         "videokit-api" if unset.
  --revision <number>    Target revision to rollback to. When omitted the script
                         automatically selects the previous successful revision.
  --namespace <name>     Kubernetes namespace. Defaults to the value of the
                         NAMESPACE environment variable or "videokit".
  --context <name>       Kubernetes context to use. Defaults to $KUBECONFIG current
                         context. You can also set the KUBE_CONTEXT environment
                         variable.
  --dry-run              Preview the rollback plan without executing Helm/Kubernetes
                         write operations (default behaviour).
  --execute              Run the rollback commands. Must be passed to make any
                         changes.
  --timeout <duration>   Timeout passed to "kubectl rollout status". Defaults to
                         5m0s.
  -h, --help             Show this help message.

Environment variables:
  ROLLBACK_RELEASES  Space separated list of releases used when --release is not
                     provided.
  NAMESPACE          Default namespace (overridden by --namespace).
  KUBE_CONTEXT       Default kube context (overridden by --context).
USAGE
}

log() {
  local level=$1
  shift
  printf '%s [%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$level" "$*"
}

log_info() { log INFO "$@"; }
log_warn() { log WARN "$@"; }
log_error() { log ERROR "$@"; }

fatal() {
  log_error "$@"
  exit 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fatal "Required command '$1' is not available in PATH"
  fi
}

print_command() {
  local prefix=$1
  shift
  printf '%s ' "$prefix"
  printf '%q ' "$@"
  printf '\n'
}

run_cmd() {
  if (( DRY_RUN )); then
    print_command '[DRY-RUN]' "$@"
    return 0
  fi

  print_command '[EXEC]' "$@"
  "$@"
}

fetch_history_json() {
  local release=$1
  local history_json
  if ! history_json=$(helm "${HELM_GLOBAL_ARGS[@]}" history "$release" --max "$HISTORY_LIMIT" -o json 2>/tmp/rollback-helm.err); then
    cat /tmp/rollback-helm.err >&2 || true
    fatal "Failed to fetch helm history for release '$release'"
  fi
  echo "$history_json"
}

select_target_revision() {
  local history_json=$1
  local requested_revision=$2
  local length
  length=$(jq 'length' <<<"$history_json")

  if [[ -n "$requested_revision" ]]; then
    local match
    match=$(jq -r --arg rev "$requested_revision" '.[] | select((.revision | tostring) == $rev) | .revision' <<<"$history_json")
    if [[ -z "$match" ]]; then
      fatal "Requested revision '$requested_revision' not found in helm history"
    fi
    echo "$match"
    return 0
  fi

  if (( length < 2 )); then
    fatal "Not enough revisions to perform an automatic rollback (need >= 2)"
  fi

  jq -r '.[length-2].revision' <<<"$history_json"
}

extract_revision_field() {
  local history_json=$1
  local revision=$2
  local field=$3
  jq -r --arg rev "$revision" --arg field "$field" '.[] | select((.revision | tostring) == $rev) | .[$field] // ""' <<<"$history_json"
}

summarise_revision() {
  local history_json=$1
  local revision=$2
  local chart app_version updated
  chart=$(extract_revision_field "$history_json" "$revision" chart)
  app_version=$(extract_revision_field "$history_json" "$revision" app_version)
  updated=$(extract_revision_field "$history_json" "$revision" updated)
  printf 'rev=%s chart=%s app=%s updated=%s' "$revision" "$chart" "$app_version" "$updated"
}

list_release_deployments() {
  local release=$1
  kubectl "${KUBECTL_GLOBAL_ARGS[@]}" get deploy \
    -l "app.kubernetes.io/instance=${release}" \
    -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}'
}

collect_deployments() {
  local release=$1
  local deployments_output
  if ! deployments_output=$(list_release_deployments "$release"); then
    fatal "Failed to list deployments for release '$release'"
  fi

  if [[ -z "$deployments_output" ]]; then
    log_warn "No deployments found for release '$release'. Rollout checks will be skipped."
    return 0
  fi

  mapfile -t RELEASE_DEPLOYMENTS <<<"$deployments_output"
}

DRY_RUN=1
REQUESTED_REVISION=""
HISTORY_LIMIT=${HISTORY_LIMIT:-20}
TIMEOUT='5m0s'
RELEASES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release)
      [[ $# -ge 2 ]] || fatal "--release requires a value"
      RELEASES+=("$2")
      shift 2
      ;;
    --revision)
      [[ $# -ge 2 ]] || fatal "--revision requires a value"
      REQUESTED_REVISION=$2
      shift 2
      ;;
    --namespace)
      [[ $# -ge 2 ]] || fatal "--namespace requires a value"
      NAMESPACE=$2
      shift 2
      ;;
    --context)
      [[ $# -ge 2 ]] || fatal "--context requires a value"
      KUBE_CONTEXT=$2
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --execute)
      DRY_RUN=0
      shift
      ;;
    --timeout)
      [[ $# -ge 2 ]] || fatal "--timeout requires a value"
      TIMEOUT=$2
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fatal "Unknown argument: $1"
      ;;
  esac
done

if [[ ${#RELEASES[@]} -eq 0 ]]; then
  if [[ -n "${ROLLBACK_RELEASES:-}" ]]; then
    # shellcheck disable=SC2206
    RELEASES=($ROLLBACK_RELEASES)
  else
    RELEASES=("videokit-api")
  fi
fi

NAMESPACE=${NAMESPACE:-videokit}
KUBE_CONTEXT=${KUBE_CONTEXT:-}

require_cmd helm
require_cmd jq
require_cmd kubectl

HELM_GLOBAL_ARGS=()
if [[ -n "$KUBE_CONTEXT" ]]; then
  HELM_GLOBAL_ARGS+=(--kube-context "$KUBE_CONTEXT")
fi
if [[ -n "$NAMESPACE" ]]; then
  HELM_GLOBAL_ARGS+=(--namespace "$NAMESPACE")
fi

KUBECTL_GLOBAL_ARGS=()
if [[ -n "$KUBE_CONTEXT" ]]; then
  KUBECTL_GLOBAL_ARGS+=(--context "$KUBE_CONTEXT")
fi
if [[ -n "$NAMESPACE" ]]; then
  KUBECTL_GLOBAL_ARGS+=(--namespace "$NAMESPACE")
fi

log_info "Rollback plan prepared with namespace='$NAMESPACE', context='${KUBE_CONTEXT:-current}'"
if (( DRY_RUN )); then
  log_info "Running in dry-run mode. Use --execute to apply changes."
fi

for release in "${RELEASES[@]}"; do
  log_info "\n=== Release: ${release} ==="
  history_json=$(fetch_history_json "$release")
  current_revision=$(jq -r '.[length-1].revision' <<<"$history_json")
  target_revision=$(select_target_revision "$history_json" "$REQUESTED_REVISION")

  if [[ "$current_revision" == "$target_revision" ]]; then
    log_warn "Current revision ($current_revision) already matches target. Skipping."
    continue
  fi

  current_summary=$(summarise_revision "$history_json" "$current_revision")
  target_summary=$(summarise_revision "$history_json" "$target_revision")
  log_info "Current: $current_summary"
  log_info "Target : $target_summary"

  RELEASE_DEPLOYMENTS=()
  collect_deployments "$release"

  run_cmd helm "${HELM_GLOBAL_ARGS[@]}" rollback "$release" "$target_revision" --wait --atomic

  if [[ ${#RELEASE_DEPLOYMENTS[@]} -gt 0 ]]; then
    for deployment in "${RELEASE_DEPLOYMENTS[@]}"; do
      run_cmd kubectl "${KUBECTL_GLOBAL_ARGS[@]}" rollout status "deployment/${deployment}" --timeout "$TIMEOUT"
    done
  fi

  run_cmd kubectl "${KUBECTL_GLOBAL_ARGS[@]}" get pods -l "app.kubernetes.io/instance=${release}" -o wide
  log_info "Rollback steps queued for release '${release}'."

  if (( DRY_RUN )); then
    log_info "Review the plan above. Re-run with --execute to perform the rollback."
  fi

done
