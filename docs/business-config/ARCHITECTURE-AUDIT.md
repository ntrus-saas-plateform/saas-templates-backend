# Architecture Audit — Multi-Vertical Business Configuration

**Date:** 2026-09-12  
**Method:** Code verification (not docs-as-truth). PostgreSQL DB-per-tenant. SurrealDB = non-goal.  
**Verdict:** **NOT PRODUCTION READY** (CRITICAL ≥ 1)  
**Score:** **70 / 100** · **Maturity LEVEL 3** (Capability + Policy + Workflow — policies partial)

Interactive summary: Cursor canvas `multi-vertical-architecture-audit.canvas.tsx`.  
**Evidence framework (P0–P5):** [`ARCHITECTURE-EVIDENCE-AUDIT.md`](./ARCHITECTURE-EVIDENCE-AUDIT.md)

---

## 1. Executive Summary

J’ai vérifié la chaîne Auth → Tenant → BusinessContext → Capability → Use case → Persistence → Outbox/Audit.

Le système est un **vrai socle multi-vertical** (ONE CORE + profiles + capabilities + lifecycle + gates + moteurs Insurance/Kitchen/PMS), **pas** un ERP “flags UI only”.

Il **n’est pas Production Ready** : bypass permissions MCP sur mutations (CRITICAL), CapabilityGuard fail-open legacy, pas de PolicyResolver unique, conflits de capabilities non seedés, pas d’E2E 5 tenants, observabilité BC absente.

---

## 2. Architecture actuelle détectée

```text
NestJS modules
  identity / tenancy (Keycloak JWT → ALS)
  business-config (profiles, caps, lifecycle, packs, extensions, MCP tools)
  sales / inventory / pricing / catalog (core commercial)
  vertical-ops (insurance, kitchen, hotel PMS)
  workflow (templates + by-process)
  accounting / finance (existant, non dupliqué)
Persistence: PostgreSQL DB-per-tenant + Redis BC cache
```

## 3. Architecture cible

```text
ONE ERP CORE → BusinessContext → Capabilities + Policies + Workflows + Extensions
```

Écart principal : **policies** matérialisées vers SoT Inventory/Commercial, pas évaluées par un PolicyResolver unique à chaque opération.

## 4. Score global /100

| Area | Score |
|------|------:|
| Architecture | 11/15 |
| Multi-tenancy | 13/15 |
| Security | 9/15 |
| Capabilities | 7/10 |
| Policies | 5/10 |
| Workflows | 6/10 |
| Configuration | 8/10 |
| Integration | 4/5 |
| Testing | 2/5 |
| Observability | 2/5 |
| Performance | 3/5 |
| **TOTAL** | **70/100** |

Interprétation: **Significant Gaps** (70–79) + CRITICAL ⇒ **NOT PRODUCTION READY**.

## 5. Architecture maturity level

**LEVEL 3 — Capability + Policy + Workflow** (policies PARTIAL / dual-path SoT).

Pas LEVEL 4 : enforcement incomplet, E2E multi-tenant manquant, MCP ACL hole.

---

## 6–9. Findings

### CRITICAL

| ID | Problem | Evidence |
|----|---------|----------|
| C-01 | MCP mutations (`enable`/`disable`/draft/install) only need `mcp:invoke` | `mcp.controller.ts`; use cases without permission check; module comment false |

### HIGH

| ID | Problem |
|----|---------|
| H-01 | CapabilityGuard returns true if org missing or legacy no-profile |
| H-02 | PermissionGuard allow if no `@RequirePermissions` (not deny-by-default) |
| H-03 | No PolicyResolver — drift risk SoT vs policyBundle |
| H-04 | `capability_conflicts` never seeded |
| H-05 | Outbox after capability commit (not same txn) |
| H-06 | PRESCRIPTION/DISPENSING EXPERIMENTAL vs pharmacy profile |
| H-07 | No 5-tenant simultaneous multi-vertical E2E |
| H-08 | `workflowVersion` unused at start |

### MEDIUM / LOW

| ID | Problem |
|----|---------|
| M-01 | No `business_context_*` metrics |
| M-02 | Lifecycle lacks VALIDATING/PENDING_APPROVAL |
| M-03 | `@RequiresCapability` sparse outside vertical-ops/recall/cold-chain |
| L-01 | Stale comment in safe-disable evaluator |
| L-02 | Supermarket workflow template thin |

---

## 10. Tenant isolation

**YES (prouvé pour BC/MCP).**  
JWT `tenant_id` + membership + DB-per-tenant pool + `organization_id`. Body ne set pas TenantContext sur BC.  
**NON PROUVÉ** sous charge E2E 5 tenants.

## 11. Keycloak / security

JWT validation + issuer/audience path present (platform auth). Org from active-org claim + membership check.  
Auth required globally. Permissions **not** deny-by-default. MCP ACL hole = CRITICAL.

## 12. Capability architecture

Registry + deps + EXPERIMENTAL manual block + licensedModules + sales gates + vertical-ops decorators.  
Conflicts empty. Legacy bypass. Sparse decorator coverage.

## 13. Policy engine

**PARTIAL.** `PolicyBundle` JSON + rematerialize to inventory/commercial SoT.  
No business `PolicyResolver`/`PolicyEvaluator`. RBAC PolicyEvaluator exists separately (authz).

## 14. Workflow engine

Bindings + `StartWorkflowByProcess` + in-code catalog. Version field unused. Supermarket thin.

## 15. Business Context

Resolved backend-only; Redis key `tenant:org:vN`; immutable snapshot object; stamped on sales confirm (`040`). Frontend cannot forge enabledCapabilities for BC resolve.

## 16. Configuration

DRAFT/ACTIVE/ARCHIVED + versions + expectedVersion 409 + dry-run + diff + rollback + migration plans.  
FSM shorter than master DoD.

## 17. Business Profiles

All 14 expected profiles seeded (032–037). Composable via caps, not deep inheritance.

## 18. Vertical Extensions

JSON registry + product extensions — **not** full plugin host.

## 19–24. Vertical audits

| Vertical | Status |
|----------|--------|
| Pharmacy | PARTIAL — profile+gates+insurance; Rx/dispensing EXPERIMENTAL |
| Insurance | DONE* — PG engine + safe-disable; not EDI clearinghouse |
| Supermarket | PARTIAL — confirm gates; WEIGHTED engine thin |
| Restaurant | PARTIAL — Kitchen/Tables + KDS fire; Recipes EXPERIMENTAL |
| Retail | Config-heavy; VARIANTS EXPERIMENTAL |
| Wholesale | PARTIAL — profile + commercial B2B |

## 25–27. Integrations

Inventory / Commercial / Accounting **reused** — no second engines. **Verified.**

## 28–29. MCP / Okapi

MCP HTTP secured for auth/tenant; **not** for fine-grained perms. Okapi explain + context APIs exist; not a full Copilot.

## 30–31. Events / Cache

Event catalog BC events exist. Outbox pattern used but not always atomic with write. Cache isolation YES.

## 32–35. API / DB / Perf / Obs

APIs annotated unevenly. Migrations solid. Confirm path may N+1 SKUs. No BC metrics.

## 36–39. Testing / Migration / Compat / Prod

Unit strong for BC/gates. E2E multi-vertical **NON PROUVÉ**. Migration plans exist. Backward compat generally preserved. Prod readiness blocked by CRITICAL.

## 40–43. Missing / debt / fixes / roadmap

See canvas gap table. **P0:** C-01, H-01. **P1:** H-02–H-07. **P2:** metrics, workflow version, broader gates, engines.

## 44. Final verdict

```text
NOT PRODUCTION READY
```

Parce que CRITICAL > 0 (MCP permission bypass), plus HIGH sur fail-open capability, policy dual-path, conflicts morts, E2E absent.

Ce n’est **pas** “quelques paramètres UI”. C’est une **architecture multi-vertical réelle incomplète**.

---

## §100 Self-audit

| Question | Answer |
|----------|--------|
| Truly multi-vertical? | YES* |
| Tenant isolation guaranteed? | YES (BC path) |
| Deny-by-default authz? | NO |
| Capabilities enforced server-side? | YES* |
| Policies enforced? | PARTIAL |
| Workflows versioned? | PARTIAL |
| Config versioned / rollback / audit? | YES |
| MCP same authz? | NO |
| Inventory/Commercial/Accounting reused? | YES |
| Pharmacy/Super/Rest/Retail/Wholesale work? | PARTIAL each |
| Hotel without Core rewrite? | YES* |
| Production-ready? | **NO** |

---

## Gap table (§102)

| ID | Severity | Module | File | Gap | Impact | Fix | Priority |
|----|----------|--------|------|-----|--------|-----|----------|
| C-01 | CRITICAL | MCP | mcp.controller.ts | Mutations `mcp:invoke` only | Priv-esc agents | Tool→permission map | P0 |
| H-01 | HIGH | Guard | capability.guard.ts | Fail-open missing org / legacy | Cap bypass | Fail closed | P0 |
| H-02 | HIGH | Authz | permission.guard.ts | Allow without perms metadata | Over-broad access | Deny-default / lint | P1 |
| H-03 | HIGH | Policies | PolicyBundle | No PolicyResolver | Drift SoT | Reconcile job | P1 |
| H-04 | HIGH | Caps | 032 sql | conflicts never seeded | Dead validation | Seed + tests | P1 |
| H-05 | HIGH | Outbox | enable use-case | Non-atomic events | Lost events | Shared txn | P1 |
| H-06 | HIGH | Pharmacy | caps EXPERIMENTAL | Profile over-promise | Runtime gap | Rx engine or honesty | P1 |
| H-07 | HIGH | QA | test/e2e | No 5-tenant E2E | Unproven isolation | §56 suite | P1 |
| H-08 | HIGH | Workflow | by-process | version unused | Drift templates | Pin version | P2 |
| M-01 | MEDIUM | Obs | metrics | No BC metrics | Ops blind | Histograms | P2 |
| M-02 | MEDIUM | Lifecycle | types | No PENDING_APPROVAL | Weak dual-control | Optional gate | P2 |
| M-03 | MEDIUM | Caps | controllers | Sparse @RequiresCapability | Permission-only ops | Expand | P2 |

---

*Audit principle: « J’ai vérifié » / « NON PROUVÉ » — existence de fichier ≠ comportement de chaîne complète.*
