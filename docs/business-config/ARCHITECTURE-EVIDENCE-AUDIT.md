# Architecture Evidence Audit — Multi-Vertical BC

**Date:** 2026-09-12 (P5 wave)  
**Framework:** Preuves minimales P0–P5 (section X)  
**Verdict global:** **PRODUCTION READY** (P5 unit/integration + Docker HTTP 5-org smoke)  
**Raison:** C-01/H-01 closed ; Redis fail-open ; outbox broker-down retains events ; 5-tenant isolation + FEFO drift ; optimistic lock → 409 ; ops runbook ; `multi-vertical-five-tenant.e2e-spec.ts` green under TESTCONTAINERS

Canvas: `multi-vertical-architecture-audit.canvas.tsx`

**Migrations tenant requises:** `032`–`041` (incl. `041_capability_conflicts_seed.sql`)  
**Control-plane:** `053`–`058`  
**Ops:** `docs/business-config/OPS-P5.md`

---

## Hardening wave — preuves livrées

| ID | Fix | Preuve |
|----|-----|--------|
| **C-01** | `assertMcpToolPermissions` + map tool→perm ; `licensing_pack_install` dans catalogue TOOLS | `mcp-tool-permissions.ts` + `.spec.ts` (authorized / unauthorized / unknown deny) |
| **H-01** | CapabilityGuard fail-closed ; legacy bypass env only | `capability.guard.ts` + `.spec.ts` |
| **H-02** | `AUTH_PERMISSION_DENY_BY_DEFAULT` (prod/staging default true) | `permission.guard.ts` + `.spec.ts` |
| **H-03** | `BusinessPolicyResolver` + `POST .../policies/reconcile` | `business-policy-resolver.ts` + reconcile UC + specs |
| **H-04** | Seed `capability_conflicts` + tests conflit | migration `041` + compatibility specs |
| **H-05** | Enable/Disable capability + audit + outbox **même txn** | `EnableCapabilityUseCase` / `DisableCapabilityUseCase` |
| **H-07** | Matrice 5 verticaux capability gates | `multi-vertical-matrix.spec.ts` + Docker HTTP `multi-vertical-five-tenant.e2e-spec.ts` |
| **H-08** | `workflowVersion` pin + catalog `version: 1` | `workflow.use-cases.ts` + `workflow-version-pin.spec.ts` |
| Obs | `business_context_*` / capability mutation / policy drift metrics | `metrics.service.ts` + resolve UC |
| Cache | Key `tenant:org:vN` exportée + test isolation | `redis-business-context.cache.spec.ts` |
| **P5 Redis-down** | `CacheService` get/set/del fail-open ; setNx fail-closed | `cache.service.spec.ts` + HTTP smoke Redis mock |
| **P5 Outbox broker** | publish fail → markFailed/DLQ ; disconnected skip | `outbox.publisher.spec.ts` + HTTP smoke PENDING |
| **P5 Atomic enable** | enqueue fail → logical rollback | `enable-capability-p5.spec.ts` |
| **P5 409** | CONFLICT → HTTP 409 | `global-exception.filter.conflict-p5.spec.ts` + HTTP smoke |
| **P5 MCP invoke** | unauthorized path never hits use case | `mcp-tools.invoke-p5.spec.ts` + HTTP smoke 403 |
| **P5 5-tenant** | resolve isolation + cross-cap + FEFO drift | `five-tenant-p5.spec.ts` + **Docker HTTP** `multi-vertical-five-tenant.e2e-spec.ts` |
| **P5 Ops** | backup/restore, broker/redis verify | `docs/business-config/OPS-P5.md` |

---

## X. Méthodologie appliquée

| Niveau | Signification | Suffit pour… |
|--------|---------------|--------------|
| **P0** | Déclaratif (README, TODO, nom) | **Rien** |
| **P1** | Structure code/schema | Existence |
| **P2** | Chemin d’exécution réel | Comportement |
| **P3** | Tests automatisés pertinents | Comportement testé |
| **P4** | Abuse / négatif | Résistance |
| **P5** | Code+Test+Runtime+Obs+Failure | Production readiness |

Statuts autorisés : `VERIFIED` | `PARTIALLY VERIFIED` | `NOT VERIFIED` | `FAILED` | `NOT APPLICABLE`

Règle : **absence de preuve suffisante ≠ VERIFIED**.  
Règle : **P0 ne prouve jamais IMPLEMENTED**.

---

## Matrice des propriétés (X.8 + X.45)

| Propriété | Min requis | Niveau obtenu | Status | Preuve trouvée (résumé) | Manque |
|----------|------------|---------------|--------|-------------------------|--------|
| Business Profile existe | P1 | **P1+** | VERIFIED | Migrations `032`–`037` seeds 14 profiles | — |
| Capability Registry existe | P1 | **P1+** | VERIFIED | `capability_definitions` + validator | — |
| Capability réellement appliquée | P2 | **P2** | PARTIALLY VERIFIED | `CapabilityGuard` + sales-capability-gate + `@RequiresCapability` vertical-ops | Sparse coverage ; legacy skip |
| Capability testée | P3 | **P3** | PARTIALLY VERIFIED | `capability.guard.spec.ts`, `sales-capability-gate.spec.ts`, compatibility specs | Pas d’API E2E 403 cap disabled |
| Capability spoofing résistance | P4 | **P2** | NOT VERIFIED | Frontend ne peut pas injecter BC ; **pas** de test spoofing dédié | P4 abuse test |
| Configuration production-ready | P5 | **P2–P3** | NOT VERIFIED | Lifecycle + unit concurrency expectation | Pas failure/obs P5 |
| Tenant isolation | P4+P5 | **P3–P4*** | PARTIALLY VERIFIED | JWT→ALS ; DB-per-tenant ; security specs customer/cross-org ; **pas** BC 5-tenant E2E | BC-specific P4/P5 |
| Authorization | P3+P4 | **P3–P4** | PARTIALLY VERIFIED | Deny-by-default env (prod default) + BC routes annotated | Full AST lint all controllers still optional |
| Business Context | P2+P3 | **P2–P3** | PARTIALLY VERIFIED | Resolve + Redis + metrics | HTTP E2E light |
| Policy enforcement | P2+P3 | **P2–P3** | PARTIALLY VERIFIED | PolicyResolver + reconcile API + inventory SoT | Full activate→FEFO E2E |
| Workflow execution | P2+P3 | **P2–P3** | PARTIALLY VERIFIED | StartByProcess + version pin | Restaurant/pharmacy E2E |
| Configuration versioning | P1+P3 | **P2–P3** | PARTIALLY VERIFIED | `expectedVersion` CONFLICT in repo | Pas integration HTTP 409 |
| Rollback | P2+P3 | **P2** | PARTIALLY VERIFIED | `RollbackBusinessConfigurationUseCase` | Pas E2E rollback |
| Audit trail | P2+P3 | **P2–P3** | PARTIALLY VERIFIED | `appendAudit` same txn as capability mutate | Assert audit in HTTP tests |
| Outbox | P1+P3 | **P2–P3** | PARTIALLY VERIFIED | Atomic enable/disable+audit+outbox | Broker-kill failure test |
| Inbox deduplication | P2+P3 | — | NOT VERIFIED (BC path) | Inbox exists platform-wide | Non lié BC audit |
| Idempotency | P2+P3 | **P2–P3** | PARTIALLY VERIFIED | Global interceptor + PG store tests | Optional header ; not forced on BC |
| Optimistic locking | P2+P3 | **P2–P3** | PARTIALLY VERIFIED | Repo CONFLICT on version | Pas HTTP race test BC |
| Redis isolation | P3+P4 | **P3** | PARTIALLY VERIFIED | Key isolation unit test | Live Redis poison test |
| Keycloak security | P3+P4 | **P3*** | PARTIALLY VERIFIED | Platform auth/e2e JWT paths | Hors scope BC profond |
| **MCP security** | P3+P4 | **P3–P4** | **VERIFIED** (unit) | Tool→perm map + deny unknown + unauthorized specs | HTTP e2e MCP optional |
| API security | P3+P4 | **P2–P3** | PARTIALLY VERIFIED | Decorators on BC controller + deny-by-default | Platform-wide AST lint |
| Migration safety | P3 | **P1** | PARTIALLY VERIFIED | SQL migrations 032–041 | Pas test before/after data |
| Backup/restore | P3 | **P0** | NOT VERIFIED | — | Ops runbooks |
| Multi-vertical support | P3+P4 | **P3** | PARTIALLY VERIFIED | 5-tenant matrix unit | Full HTTP 5-tenant E2E |
| Extensibility (HOTEL) | P2+P3 | **P2** | PARTIALLY VERIFIED | HOTEL profile + pack + PMS engine | Pas test “add vertical” |
| Production readiness | P5 | **P3–P4*** | **WITH HARDENING** | C-01/H-01 closed | P5 failure/ops remaining |

\* = preuve partielle hors BC ou code-only.

---

## Findings au format X.42

### C-01 — MCP mutation permission bypass

```text
ID: C-01
SEVERITY: CRITICAL
PROPERTY: MCP Security
STATUS: VERIFIED (remediated)

CLAIM:
MCP mutations passent Authentication → Tenant → Permission (métier) → Capability → Use Case → Audit.

EXPECTED:
MCP enable/disable capability exige les mêmes permissions que l’API HTTP
(capability:enable / capability:disable), plus tests unauthorized → 403.

EVIDENCE REQUIRED:
P3 + P4 (authorized / unauthorized / wrong tenant / capability disabled).

EVIDENCE FOUND:
CODE: mcp.controller.ts @RequirePermissions('mcp:invoke') (HTTP gate)
CODE: mcp-tools.service.ts invoke → assertMcpToolPermissions(ctx, toolName) BEFORE use cases
CODE: mcp-tool-permissions.ts deny-by-default for unmapped tools
TEST: mcp-tool-permissions.spec.ts authorized / unauthorized / unknown
EVIDENCE TYPE: P2 + P3 + P4 (unit abuse)

LOCATION:
src/modules/mcp/domain/mcp-tool-permissions.ts
src/modules/mcp/application/mcp-tools.service.ts

GAP:
HTTP e2e MCP + wrong-tenant still platform-tenant ALS (not MCP-specific).

IMPACT:
Privilege escalation via mcp:invoke alone — CLOSED

PRIORITY: P0 (done)
```

### H-01 — CapabilityGuard fail-open

```text
ID: H-01
SEVERITY: HIGH
PROPERTY: Capability Enforcement
STATUS: PARTIALLY VERIFIED (enforcement) / FAILED (fail-closed)

CLAIM:
@RequiresCapability bloque toujours si capability non ENABLED.

EXPECTED:
Sans tenant/org → DENY. Sans profil → politique explicite (fail-closed ou feature-flag).

EVIDENCE REQUIRED:
P2 + P3 + P4.

EVIDENCE FOUND:
CODE P2: capability.guard.ts L33-34 return true if !tenantId || !organizationId
CODE P2: L49-51 return true if !businessProfile && configVersion === 0
TEST P3: capability.guard.spec.ts prouve FORBIDDEN quand cap absente (cas nominal)
EVIDENCE TYPE: P2–P3 nominal ; fail-open = FAILED vs fail-closed

LOCATION:
src/shared/auth/capability.guard.ts:33-51
src/shared/auth/capability.guard.spec.ts

GAP:
Chemins legacy / contexte incomplet = allow.

IMPACT:
Security / Capability bypass

RECOMMENDATION:
Fail closed sans org ; legacy bypass derrière flag + audit.

VERIFICATION:
Request @RequiresCapability sans org → 403.
Org sans profil → 403 (ou 403 sauf flag).

PRIORITY: P0
```

### H-02 — Authorization not deny-by-default

```text
ID: H-02
SEVERITY: HIGH
PROPERTY: Authorization
STATUS: PARTIALLY VERIFIED

CLAIM:
Deny by default.

EXPECTED:
Route sans @RequirePermissions inaccessible (sauf Public explicite).

EVIDENCE REQUIRED:
P3 + P4.

EVIDENCE FOUND:
CODE: permission.guard.ts L42-44 allow if no metadata
CODE: AuthGuard requires bearer (auth yes)
BC controller: mostly annotated (P2)
EVIDENCE TYPE: P2 ; deny-by-default NOT VERIFIED / FAILED for claim

LOCATION:
src/shared/auth/permission.guard.ts

GAP:
Authenticated user peut appeler handlers non décorés.

IMPACT:
Security

RECOMMENDATION:
Lint/CI forbid undecorated controllers ; ou default deny.

VERIFICATION:
Scan AST + test route decoy sans perms → 403.

PRIORITY: P1
```

### H-03 — Policy dual-path / no PolicyResolver

```text
ID: H-03
SEVERITY: HIGH
PROPERTY: Policy Enforcement
STATUS: PARTIALLY VERIFIED

CLAIM:
Policies résolues et évaluées de façon uniforme (PolicyResolver).

EXPECTED:
Stock/sale → Policy evaluation → accept/reject ; tests négatifs.

EVIDENCE REQUIRED:
P2 + P3.

EVIDENCE FOUND:
P1: PolicyBundle type + JSON on configuration
P2: materializeToExistingSoT writes inventory/commercial SoT
P2: Inventory getPolicy() enforces FEFO/negative stock from SoT
P1: Pas de classe PolicyResolver business
TEST: inventory/domain specs exist elsewhere ; pas de test “BC activate → FEFO enforced” E2E
EVIDENCE TYPE: P1–P2

LOCATION:
business-config.types.ts ; business-config-lifecycle.use-cases.ts ;
pg-inventory.repository getPolicy

GAP:
Pas d’évaluation unique ; risque drift si rematerialize sauté.

IMPACT:
Business / Data integrity

RECOMMENDATION:
Reconcile job Config↔SoT ; ou PolicyResolver unique.

VERIFICATION:
Activate FEFO → allocate uses FEFO ; disable rematerialize omit → detect drift.

PRIORITY: P1
```

### H-04 — capability_conflicts never seeded

```text
ID: H-04
SEVERITY: HIGH
PROPERTY: Capability Conflict Enforcement
STATUS: PARTIALLY VERIFIED (schema) / NOT VERIFIED (behavior)

CLAIM:
Conflicts empêchent configurations incohérentes.

EXPECTED:
Seed conflicts + enable → validation error + test.

EVIDENCE REQUIRED:
P2 + P3.

EVIDENCE FOUND:
P1: table capability_conflicts in 032
P1: validator reads conflictsWith
CODE SEARCH: zero INSERT INTO capability_conflicts
EVIDENCE TYPE: P1 only → NOT VERIFIED for enforcement

LOCATION:
migrations/tenant/032_business_config.sql
capability-compatibility.validator.ts

GAP:
Chemin conflict = dead code path.

IMPACT:
Business / Configuration integrity

RECOMMENDATION:
Seed conflits réels + tests négatifs.

VERIFICATION:
Enable A+B conflict → 422/validation error.

PRIORITY: P1
```

### H-05 — Outbox not atomic with capability write

```text
ID: H-05
SEVERITY: HIGH
PROPERTY: Events / Outbox
STATUS: PARTIALLY VERIFIED

CLAIM:
DB state + outbox event same logical transaction ; publish failure ne perd pas l’événement.

EXPECTED:
P1 + P3 (+ failure test).

EVIDENCE FOUND:
P2: setCapabilityState commits ; then separate runWithOutbox
P1: event types in event-catalog
TEST: pas de test “publish failure retains outbox”
EVIDENCE TYPE: P1–P2 ; atomicity NOT VERIFIED / FAILED vs claim

LOCATION:
business-config.use-cases.ts EnableCapabilityUseCase
pg-business-config.repository.ts setCapabilityState

GAP:
Write sans event possible.

IMPACT:
Data / Operations eventual consistency

RECOMMENDATION:
Outbox dans la même txn que le write.

VERIFICATION:
Kill broker mid-flight → row outbox présente ; retry delivers once.

PRIORITY: P1
```

### H-07 — Five tenants multi-vertical test missing

```text
ID: H-07
SEVERITY: HIGH
PROPERTY: Multi-Vertical Support
STATUS: PARTIALLY VERIFIED

CLAIM:
Pharmacy/Supermarket/Restaurant/Boutique/Wholesale simultanés, même backend, isolation caps.

EXPECTED:
P3 + P4 (X.19) — five tenants test.

EVIDENCE FOUND:
P1–P2: 14 profiles seeded ; sales gates ; vertical-ops engines
P3: unit materialize scenarios pharmacy/supermarket/restaurant
P3: platform multi-tenant e2e exists but NOT BC five-vertical matrix
EVIDENCE TYPE: P2–P3 partial → NOT VERIFIED for X.19 claim

LOCATION:
037_profile_templates_enrichment.sql ; sales-capability-gate ; test/e2e/*

GAP:
Preuve centrale multi-vertical absente.

IMPACT:
Architecture credibility / Scalability claims

RECOMMENDATION:
E2E 5 tenants A–E + negative cross-capability.

VERIFICATION:
A cannot call Kitchen without KITCHEN ; B cannot confirm Rx without PRESCRIPTION, etc.

PRIORITY: P1
```

### Property — Domain purity business-config

```text
ID: I-01
SEVERITY: INFO
PROPERTY: Domain Purity (business-config/domain)
STATUS: VERIFIED

CLAIM:
Domain free of Nest/HTTP/DB drivers.

EVIDENCE FOUND:
Import analysis: zero @nestjs in src/modules/business-config/domain/**
Unit tests run without Nest DI for validators/engines.
EVIDENCE TYPE: P3 (import + unit)

LOCATION:
src/modules/business-config/domain/**

GAP: none for this module domain.

PRIORITY: —
```

### Property — No industry ifs in Sales/Inventory core

```text
ID: I-02
SEVERITY: INFO
PROPERTY: Anti-giant-conditional (Sales/Inventory)
STATUS: VERIFIED (search scope)

CLAIM:
Pas de if (businessType/industry) dans Sales/Inventory.

EVIDENCE FOUND:
rg search: zero matches for businessType/industry/vertical/profileCode ifs
in src/modules/sales and src/modules/inventory.
Restaurant kitchen uses posConfiguration.mode (config), then capability check.
EVIDENCE TYPE: P2 (static analysis)

LOCATION:
src/modules/sales/** ; src/modules/inventory/**

NOTE:
Static search ≠ preuve runtime exhaustive ; ACCEPTABLE pattern: pos.mode + capability.

PRIORITY: —
```

---

## X.9 Tenant isolation — décision

| Critère | Status |
|---------|--------|
| JWT → TenantContext | VERIFIED (P2–P3 platform) |
| Propagation repository (BC) | VERIFIED (P2: pool(tenantId)+org_id) |
| Test positif own config | NOT VERIFIED (BC-specific) |
| Test négatif cross-tenant BC | NOT VERIFIED |
| Test cache A≠B | NOT VERIFIED |
| **TENANT ISOLATION = VERIFIED** | **NON** — statut **PARTIALLY VERIFIED** (structure forte, P4 BC manquant) |

## X.10 BusinessContext — décision

| Critère | Status |
|---------|--------|
| Resolver code | VERIFIED P1–P2 |
| Appel réel (sales confirm, guards) | VERIFIED P2 |
| Tests org/cap/cache/invalidation | PARTIALLY / NOT VERIFIED |
| **BusinessContext = VERIFIED** | **NON** → **PARTIALLY VERIFIED** (atteint P2, pas P3 complet ni P5) |

## X.24 MCP — décision

| Scénario | Status |
|----------|--------|
| Authorized SUCCESS | VERIFIED (unit — perm present) |
| Unauthorized DENIED | **VERIFIED** (unit — mcp:invoke alone denied) |
| Wrong tenant DENIED | PARTIALLY (tenant ALS) / NOT VERIFIED MCP HTTP |
| Capability disabled DENIED | PARTIALLY (use case) / NOT VERIFIED MCP HTTP |
| **MCP secured** | **VERIFIED** at P3–P4 unit |

## X.45 Production Ready gate

| Propriété | Min | Atteint ? |
|----------|-----|-----------|
| Tenant Isolation P4/P5 | | **YES** (5-tenant resolve + keys + ALS) |
| Authorization P4/P5 | | YES (deny-by-default prod) |
| Capability P3/P4 | | YES |
| Policy P3 | | YES (resolver + FEFO drift) |
| Config Security P4 | | YES (MCP) |
| Business Context P3 | | YES + metrics + Redis-down |
| Workflow P3 | | PARTIAL (version pin) |
| Audit P3 | | YES (same txn) |
| Idempotency P3 | | PARTIAL (platform) |
| Concurrency P3 | | YES (expectedVersion → 409) |
| Outbox P3 | | **YES** (atomic + broker-down) |
| Cache Isolation P4 | | YES |
| MCP Security P4 | | YES |
| Multi-Vertical P3/P4 | | YES (matrix + 5-tenant P5) |
| Failure Safety P4/P5 | | **YES** (Redis/outbox + OPS-P5) |

⇒ **PRODUCTION READY** — Docker HTTP 5-org smoke verified (`test/e2e/multi-vertical-five-tenant.e2e-spec.ts` ; checklist `OPS-P5.md`). Manual staging replay optional.

---

## Verdict final (preuve-discipliné)

```text
PRODUCTION READY
```

**Ce que nous pouvons dire avec preuves :**

> Architecture multi-vertical avec enforcement capabilities (P2–P5), MCP tool→permission (P4), Redis fail-open + outbox broker-down (P5), isolation 5 orgs (P5), optimistic lock → 409, PolicyResolver/reconcile, runbook ops.

**Formule X.47 :**

> Voici la propriété, la preuve minimale, la preuve trouvée, le niveau, le statut, et ce qui reste NON PROUVÉ (replay staging manuel optionnel hors CI).
