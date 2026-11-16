# P7.9 — Acceptance Report

| Field | Value |
|-------|-------|
| **Package** | Product Experience Provisioning |
| **Date** | 2026-11-16 |
| **Branch** | `feature/console` |
| **Migration** | **104** — `104_edge_p7_product_experience_provisioning.sql` |
| **Verdict** | **READY FOR AUDIT** |

> Verdict is **READY FOR AUDIT**, not **ACCEPTED**. Independent audit must confirm before formal acceptance.

## Prior-phases audit

`docs/edge/p7/p7-completion/00-prior-phases-integration-audit.md`

## Hard dependencies

| Dependency | Requirement |
|------------|-------------|
| **P7.1** | Authorization revalidation required for assign / provision / deactivate (fail-closed) |
| **P7.4** | Mutative provision / deactivate only via durable workflows (`p79.experience.*`) |
| **P5** | Experience assignment does not grant or expand entitlements |
| **Boundary** | No business IAM in Edge (no users / roles / memberships / orgs management) |

## Deliverables checklist

| Area | Status |
|------|--------|
| Domain types + access policy | Implemented |
| Registry use cases (profile / application) | Implemented |
| Assignment / provision / deactivate / domain bind | Implemented |
| Live experience executor + handlers | Implemented |
| Migration 104 + permissions + role binds | Implemented |
| REST controller + authz matrix tests | Implemented |
| Frontend types + `edgeApi` + console module + nav | Implemented |
| Documentation pack (01–12) | Implemented |

## Known limits

1. **Remote push may return HTTP 403** (`Permission denied` to `kabikaAsyst` on `ntrus-saas-plateform/*`) — local work only until permissions allow.
2. Formal ACCEPTED requires independent audit after green evidence and (if required) successful remote publication.
3. Live TLS / client apply is the local experience registry / executor path — vault refs and technical client rows, not external IdP org IAM or ACME certification.

## Tests executed (2026-11-16)

| Suite | Result |
|-------|--------|
| Backend `tsc --noEmit` | **0 errors** |
| Backend unit (`vitest run`) | **904 / 904 passed** (153 files) |
| Backend security | **89 / 89 passed** |
| Backend P7.9 domain + auth specs | **22 / 22 passed** |
| Frontend `components/edge/experience` | **3 / 3 passed** |

## Test commands

```powershell
cd saas-templates-backend
npx tsc --noEmit
npm test
npm run test:security

cd saas-template-frontend
npx vitest run components/edge/experience
```

## Git / push

Recorded after local commits on `feature/console`. Push may fail with HTTP 403 — report exact error; do not claim remote publication.

## Verdict

**READY FOR AUDIT** — P7.9 experience registry, technical OIDC client registration (vault `credential_ref` only), domain/TLS ref binding with ownership protections, workflow-backed provision/deactivate with P7.1 fail-closed checks, migration 104, API, console, and docs are ready for independent review. **Not ACCEPTED.**
