# P0-H.6 — Operational Readiness Report

**Date:** 2026-11-09  
**Status:** **PARTIAL PASS** — runbooks + config inventory verified; live failure injection **NOT_EXECUTED**

## Runbooks present (`docs/edge/runbooks/`)

- keycloak-unavailable
- control-plane-db-unavailable
- redis-unavailable
- session-revocation-failure
- administrator-compromise
- membership-sync-failure
- vertical-activation-failure
- invitation-delivery-failure
- authz-cache-inconsistency
- audit-delivery-failure
- emergency-access
- partial-provisioning-recovery

## Configuration / secrets (code audit)

| Item | Evidence |
|------|----------|
| Edge secrets env | `EDGE_KEYCLOAK_*`, `SESSION_SECRET_EDGE` in `.env.example` |
| ERP secrets separate | `KEYCLOAK_*`, `SESSION_SECRET` |
| Edge session secret derivation | `lib/edge-bff/session.ts` requires dedicated secret in production |
| Metrics | `EdgeMetricsService` (authorization denial, invalid workspace) |

## NOT_EXECUTED

- Injected Keycloak/Redis/DB outage while API running
- Recovery drills with measured RTO
