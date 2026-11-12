# P7.7 — Acceptance Report

| Field | Value |
|-------|-------|
| **Package** | Keycloak Topology Provisioning |
| **Date** | 2026-11-12 |
| **Branch** | `feature/console` (both repos) |
| **Boundary** | P7.8+ (deployment configs, product provisioning, readiness/activation) **NOT implemented** |

## Git state

| Repo | HEAD | P7.7 changes | Push |
|------|------|--------------|------|
| `saas-templates-backend` | `b3cf3ac` (`b3cf3ac9d3d572f9c8414f95d0a12c366a3368e8`) | **UNCOMMITTED** as of writing | **FAILED — HTTP 403** (account `kabikaAsyst` lacks permission on `ntrus-saas-plateform/*`; unchanged blocker since P7.6) |
| `saas-template-frontend` | `0f59c98` (`0f59c98c5fc4b50e5cbaf7e9e439f47de77df5ce`) | **UNCOMMITTED** | same 403 blocker |

## Acceptance criteria (mandate §20)

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Edge provisions Keycloak topologies — Model A `DEDICATED_REALM`, Model B `SHARED_REALM_ORGANIZATIONS` (Keycloak Organizations), Model C `EXTERNAL_SPECIFIC` | **PASS** | `keycloak-plan.ts` gating, executor branches; A live-tested (8/8), B/C code paths + probes (see §"Topology test honesty") |
| 2 | No business IAM in Edge (no tenant end-users, org memberships, business roles/permissions, customer invitations) | **PASS** | No user/membership tables or operations; provider constraints `noBusinessUsers`/`noBusinessRoles` asserted in DB suite; orgs marked `technical_purpose` |
| 3 | P7.8+ boundary respected (no deployment configs, product provisioning, readiness/activation) | **PASS** | Nothing implemented beyond topology provisioning; stated in migration header + docs |
| 4 | Lifecycle statuses + fail-closed state machine (`READY` only via `VERIFYING`) | **PASS** | `keycloak-state-machine.ts` + `.spec` (unit suite 855/855) |
| 5 | Real Keycloak Admin API — no simulated provisioning | **PASS** | `HttpKeycloakAdminAdapter` executed against `quay.io/keycloak/keycloak:26.0.7` (live 8/8); handlers fail without live executor |
| 6 | Secrets only as opaque `credential_ref` (vault) | **PASS** | Security masking tests + DB schema-guard test; registration fails without vault |
| 7 | Mutations only through P7.4 workflows (handler keys, saga + compensation) | **PASS** | 9 `KEYCLOAK_HANDLER_KEYS`, 4 workflow definitions, workflow-only controller |
| 8 | Fencing discipline (stale/invalid token ⇒ no Keycloak call) | **PASS** | `isValidFencingToken` integer `>= 1` (defect #2 fixed); 2 security tests |
| 9 | P7.1 authorization revalidated fail-closed at every boundary | **PASS** | Plan validation, provisioning request required, launch revalidation, `validate_plan` step; 3 security tests |
| 10 | SSRF confinement to registered server origin | **PASS** | 5 security tests + live hostile-realm test (404 on registered server) |
| 11 | RBAC-protected API (7 `platform:keycloak:*` permissions) | **PASS** | Migration 102 seed + per-route `@RequireEdgePermissions`; frontend RBAC gates |
| 12 | Migration 102 with 14 mandated tables | **PASS** | DB integration suite: migration applied, `KEYCLOAK_TABLES` all present |
| 13 | Durable evidence + history + audit + outbox atomically | **PASS** | Evidence mandatory in executor; outbox TX pattern; DB suite evidence/history test |
| 14 | Reconciliation with drift detection, no blind recreate/delete | **PASS** (code + unit/DB) | Reconcile run classification; live reconcile cycle **not executed** |
| 15 | Capability discovery persisted (serverinfo + org probe) | **PASS** | Live capabilities test; `edge_p7_keycloak_capabilities` upsert |
| 16 | Frontend console: TanStack Query, RBAC, credential masking | **PASS** | 6 module tests (masking `••••••••`, forbidden state, history gate, explicit reconcile) |
| 17 | Typecheck + lint clean for P7.7 code | **PASS** | Backend `tsc --noEmit` 0 errors; lint 0 errors; frontend 0 errors in P7.7 files |
| 18 | Executed test matrix green | **PASS** | 855/855 unit · 58/58 security · 7/7 DB IT · 8/8 live · 120/120 frontend |
| 19 | Honest reporting of gaps | **PASS** | Gaps listed below and in `12-test-evidence.md` |
| 20 | Push to remote | **FAILED (403)** | Known permission blocker on `ntrus-saas-plateform/*` — not a P7.7 code issue |

## Topology test honesty

| Model | Code | Live evidence |
|-------|------|---------------|
| A `DEDICATED_REALM` | full path | **LIVE-TESTED** (realm create/re-adopt, client, OIDC discovery vs KC 26.0.7) |
| B `SHARED_REALM_ORGANIZATIONS` | full path (capability-gated) | **PROBE-COVERED ONLY** — container runs `--features=organization`; org **creation** not exercised by an executed live test |
| C `EXTERNAL_SPECIFIC` | plan-requires-certified-adapter; executor `SKIPPED` | **NOT LIVE-TESTED** (no external adapter available) |

## Tests executed / results (2026-11-12)

| Suite | Result |
|-------|--------|
| Backend unit (`vitest.config.ts`) | **855/855 passed** |
| Backend security (`vitest.config.security.ts`) | **58/58 passed** (12 P7.7) |
| Backend integration DB (`edge-keycloak-topology-db.spec.ts`, TESTCONTAINERS=true) | **7/7 passed** |
| Backend live Keycloak (`edge-keycloak-live.spec.ts`, TESTCONTAINERS=true, KC **26.0.7**) | **8/8 passed** |
| Backend typecheck / lint | **0 errors / 0 errors** (2 pre-existing-style warnings in adapter) |
| Frontend vitest | **120/120 passed** (22 files, incl. 6 P7.7) |
| Frontend tsc | **0 errors in P7.7 files**; 85 pre-existing errors in untouched files (`app/(edge-console)/edge/subscriptions/page.tsx`, `components/edge/infrastructure/shared.tsx`, `components/identity/user-admin-hub.tsx`) |

## Tests NOT executed (pending / out of scope)

- **Model B live org creation end-to-end** — the live container enables organizations, but the org create path is exercised only via the probe (`organizationExists`); `createOrganization` has no executed live test.
- Live reconciliation cycle against a real server; live Model C; HTTP smoke test of controller endpoints (not part of the matrix).
- Frontend TS debt cleanup (85 pre-existing errors outside P7.7 files).

## Security control results

| Control | Result |
|---------|--------|
| SSRF origin confinement | **PASS** (5 security + live hostile-realm tests) |
| Secret redaction / vault-only storage | **PASS** (masking tests, schema guard, live health/redaction) |
| Fencing fail-closed | **PASS** (defect #2 fixed) |
| P7.1 authz fail-closed | **PASS** |
| Redirect/origin policy | **PASS** |
| Defects fixed during P7.7 | #1 KC 26 field names · #2 fencing tokens · #3 stale-token 403 (live-only) · #4 jsdom `scrollIntoView` |

## Remaining limits

1. Push **FAILED 403** — changes uncommitted/unpushed on both repos (owner permission issue on `ntrus-saas-plateform/*`).
2. Frontend inherited TS debt: 85 pre-existing errors in files not touched by P7.7.
3. Model C not live-tested; Model B org creation not live-tested; no live reconcile cycle.

## Files

**Created (backend):** `migrations/control-plane/102_edge_p7_keycloak_topology_provisioning.sql`; `src/modules/edge/domain/keycloak-topology/` (`keycloak.types.ts`, `keycloak-provider.port.ts`, `keycloak-handlers.ts`, `keycloak-state-machine.ts`, `keycloak-plan.ts`, `keycloak-repository.port.ts`, `keycloak.events.ts`, `keycloak-validation-context.ts` + `.spec` files); `src/modules/edge/application/keycloak-topology/keycloak.use-cases.ts`; `src/modules/edge/infrastructure/keycloak/` (`keycloak-admin.adapter.ts`, `live-keycloak.executor.ts`, `pg-keycloak.repository.ts`); `src/modules/edge/presentation/controllers/keycloak.controller.ts` + `dto/keycloak.dto.ts`; tests `test/security/edge-keycloak-security.spec.ts`, `test/integration/edge-keycloak-topology-db.spec.ts`, `test/integration/edge-keycloak-live.spec.ts`.

**Modified (backend):** `domain/infrastructure-provisioning/secrets-provider.port.ts`, `domain/workflow/workflow-handler.port.ts`, `domain/workflow/workflow.types.ts`, `edge.module.ts`, `infrastructure/edge-application.providers.ts`, `infrastructure/persistence/edge-persistence.module.ts`, `infrastructure/workflow/workflow-handler.registry.ts`.

**Frontend:** created `app/(edge-console)/edge/provisioning/keycloak/page.tsx`, `components/edge/keycloak/edge-keycloak-module.tsx`, `components/edge/keycloak/edge-keycloak-module.test.tsx`, `types/edge-keycloak.ts`; modified `lib/api/edge.ts` (+144 lines, 14 new Keycloak API functions).

## Verdict

**READY FOR AUDIT** — code, migration, and executed test matrix are green; remaining items are external (push 403) or explicitly disclosed live-test gaps (Models B/C, live reconcile).
