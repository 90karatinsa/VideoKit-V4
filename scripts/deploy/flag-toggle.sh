#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: TARGET_ENV=<env> VIDEO_KIT_ADMIN_TOKEN=<token> $0 <enable|disable|status> <flag-name> [--tenant <tenant-id>]

Required environment variables:
  TARGET_ENV               Deployment environment key (e.g. prod-eu-west-1)
  VIDEO_KIT_ADMIN_TOKEN    Admin bearer token authorised for feature flag updates

Options:
  --tenant <tenant-id>     Limit the flag update to a tenant scope. When omitted, applies globally.
USAGE
}

if [[ $# -lt 2 ]]; then
  usage
  exit 1
fi

action=$1
flag=$2
shift 2

tenant=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tenant)
      tenant="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

: "${TARGET_ENV:?TARGET_ENV must be set}"
: "${VIDEO_KIT_ADMIN_TOKEN:?VIDEO_KIT_ADMIN_TOKEN must be set}"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for JSON processing" >&2
  exit 1
fi

case "$action" in
  enable) desired_state=true ;;
  disable) desired_state=false ;;
  status) desired_state="" ;;
  *)
    echo "Unsupported action: $action" >&2
    usage
    exit 1
    ;;
esac

base_url="https://${TARGET_ENV}.videokit.internal/api/admin/feature-flags"

if [[ -n "$tenant" ]]; then
  scope_path="tenants/${tenant}"
else
  scope_path="global"
fi

if [[ "$action" == "status" ]]; then
  curl -sS -H "Authorization: Bearer ${VIDEO_KIT_ADMIN_TOKEN}" \
       -H "Accept: application/json" \
       "${base_url}/${scope_path}/${flag}" | jq .
  exit 0
fi

payload=$(jq -n --arg flag "$flag" --argjson enabled "$desired_state" '{flag: $flag, enabled: $enabled}')

response=$(curl -sS -w "\nHTTP_STATUS:%{http_code}\n" \
  -H "Authorization: Bearer ${VIDEO_KIT_ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -X PUT \
  -d "${payload}" \
  "${base_url}/${scope_path}/${flag}")

http_status=$(echo "$response" | awk -F: '/HTTP_STATUS/ {print $2}')
body=$(echo "$response" | sed '$d')

if [[ "$http_status" != "200" ]]; then
  echo "Flag update failed with status ${http_status}: ${body}" >&2
  exit 1
fi

echo "$body" | jq .
echo "Flag '${flag}' updated to state '${action}' for scope '${scope_path}'."
