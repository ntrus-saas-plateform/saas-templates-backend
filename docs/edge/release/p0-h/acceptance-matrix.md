# P0-H — Acceptance Matrix

| Phase | Primary deliverable | PASS condition | Status |
|-------|---------------------|----------------|--------|
| P0-H.1 | Database Qualification Report | Clean install + upgrade from `072` succeed; integrity verified; no ERP/CP data regression | **PASS** (2026-11-09; reconfirmed with 074) |
| P0-H.2 | Keycloak Qualification Report | Both realms operational and isolated; tokens non-interchangeable | **PASS** (2026-11-09) |
| P0-H.3 | Backend Security Report | Authz, escalation blocks, revocation, session security, audit verified | **PASS** unit / HTTP matrix NOT_EXECUTED |
| P0-H.4 | Non-Regression Report | ERP baseline + Edge coexistence; no cookie/token/context cross-contamination | **PASS** (2026-11-09) |
| P0-H.5 | E2E Test Report | Edge scenarios A–G + ERP smoke pass in integrated env | **PARTIAL PASS** — smoke 14/14; A–G NOT_EXECUTED |
| P0-H.6 | Operational Readiness Report | Injected failures safe; recovery documented; metrics/logs usable | **PARTIAL PASS** — runbooks OK; injection NOT_EXECUTED |
| P0-H.7 | Performance Report | Declared capacity targets met; no security shortcuts | **NOT_EXECUTED** |
| P0-H.8 | Staging Release Report | Reproducible staging deploy; smoke green; formal Go/No-Go | **NO-GO** (deploy NOT_EXECUTED) |

## Final exit checklist

- [x] Migration `073` validated on empty DB
- [x] Migration `073` (+ `074`) validated from `072`
- [x] Dual Keycloak realm import verified
- [x] JWT / audience isolation demonstrated (validators + dual JWKS)
- [x] Cookie / session isolation demonstrated
- [x] Global and vertical authorization verified (unit / domain)
- [x] Privilege escalation blocked (unit)
- [x] Workspace session revocation semantics verified (domain)
- [x] ERP non-regression demonstrated (smoke + contracts)
- [x] Playwright Edge smoke executed
- [x] Playwright ERP smoke executed
- [ ] Integrated security HTTP tests (live tokens) passed
- [ ] Authenticated Playwright Edge A–G
- [ ] Resilience failure injection verified
- [ ] Performance baseline produced
- [ ] Staging deployment reproducible
- [x] No open P0 isolation defects in executed suites
- [ ] Go/No-Go report approved → **NO-GO** until blockers closed

## Formal decision

**NO-GO for staging.**  
Qualification progressed through live Keycloak dual-realm + non-regression smokes; remaining blockers are authenticated E2E, Edge load, and real staging deploy.
