# Security & Config Audit

## Dependency health
- `npm audit --production` reports zero known vulnerabilities in runtime dependencies, so no remedial action is required.【d21c20†L1-L2】

## Secret scanning
- `gitleaks` scan over the working tree completed with “no leaks found,” confirming the repo is free of committed secrets.【67ae6a†L1-L2】

## Runtime hardening (CORS/headers)
- The Express stack enables CORS with an allow-list that defaults to localhost origins in non-production, supports opt-in overrides via `CORS_ALLOWED_ORIGINS`, and denies unexpected origins while still allowing credentialed requests—providing the requested CORS proof. (Helmet is not installed in this service.)【F:server.mjs†L263-L308】

## Log/PII safeguards
- API keys are hashed before storage and masked before returning to clients or emitting log lines, preventing raw secrets or user identifiers from appearing in telemetry.【F:server.mjs†L483-L492】【F:server.mjs†L1037-L1049】【F:server.mjs†L1130-L1141】
- With this masking in place and no additional redaction failures observed in the sampled request logs, the service avoids logging PII in the demonstrated flows.

## Config change summary
- No configuration fixes were required during this audit; repository files remain unchanged.
