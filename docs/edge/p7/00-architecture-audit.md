# P7.0 — Repository Architecture Audit

**Date:** 2026-11-10  
**Status:** **G0_EVIDENCE_COMPLETE** (audit only — no P7 domain implementation)  
**Repos:** `saas-templates-backend`, `saas-template-frontend`  
**Method:** Live code/migration inspection (not prior audit assumptions)

---

## 1. Backend architecture (observed)

| Concern | Evidence | Verdict |
|---------|----------|---------|
| Nest modular + hexagonal Edge | `src/modules/edge/{domain,application,infrastructure,presentation}` | **REUSE** |
| DI providers | `edge-application.providers.ts` | **REUSE** |
| Controllers under `edge/*` | catalog, commercial, marketing, sales, subscription, billing | **REUSE** pattern |
| Platform IAM / RBAC | `EdgeAuthGuard`, `RequireEdgePermissions`, `edge_permissions` | **REUSE** |
| Control-plane Postgres + migrations | `migrations/control-plane/073+` | **REUSE** |
| Outbox / integration events | `ControlPlaneOutboxTransactionService`, handlers via `EXTRA_INTEGRATION_EVENT_HANDLERS` | **REUSE** |
| Idempotency keys (billing) | `edge_billing_idempotency_keys` (092) | **EXTEND** pattern to P7 |
| Job scheduler (interval + Redis lock) | `JobSchedulerService`, `BILLING_JOBS_*` | **EXTEND** — not a durable saga engine |
| Durable workflow / saga / leases / fencing | **Absent** as first-class domain | **BUILD** |
| Product Control Contract API client | **Absent** (backends registry is catalog metadata only) | **BUILD** |
| Connectivity Agent | **Absent** | **BUILD** (later P7.14) |

---

## 2. P0–P6 dependency audit (provisioning-relevant)

### P0 — Edge IAM / Vertical Workspace

| Asset | Path | P7 use |
|-------|------|--------|
| Verticals + KC org id (workspace) | `edge_verticals.keycloak_organization_id` | **DO NOT confuse** with tenant IAM topology |
| Administrators / memberships / workspaces | Edge auth modules | **REUSE** for operators |

### P1 — Product Catalog

| Asset | Path | P7 use |
|-------|------|--------|
| Products, backends, readiness | `074_edge_product_catalog.sql`, `EdgeBackendsController` | **EXTEND** as Product/Platform seed — not runtime registry |
| Commercial readiness ≠ technical readiness | `edge_readiness_*` | Separate from P7 readiness checks |

### P4 — Sales

| Asset | Path | P7 use |
|-------|------|--------|
| Handoff (no tenant create) | `085`, `SalesHandoffRequestedHandler` | Upstream only |
| `edge_sales_provisioning_references` | 085 | Historical refs — **VERIFY** before reuse as P7 source of truth |

### P5 — Subscriptions (critical handoff)

| Asset | Path | P7 use |
|-------|------|--------|
| `edge_subscription_provisioning_requests` | `089` | **EXTEND** — P5-side audit trail / coordination rows |
| Port `SubscriptionProvisioningCoordinationPort` | `provisioning-coordination.port.ts` | **EXTEND** — implement real P7 adapter; today **Unavailable** |
| Adapter honesty | `unavailable-provisioning.adapter.ts` | **REUSE** pattern until Product Control live |
| Entitlement snapshots | `088`, publish APIs | **REUSE** as immutable input to P7.8 |
| Docs contract P5→P7 | `docs/edge/p5/08-integration-contracts.md` | **REUSE** as baseline event names |

**P5 explicitly does not create tenants or Keycloak orgs** (adapter message + events comments).

### P6 — Billing

| Asset | Path | P7 use |
|-------|------|--------|
| Billing ops / financial events | `docs/edge/p6/*`, `/edge/billing` | **DO NOT** consume raw financial events for activation |
| P5 interprets finance → contractual decisions → P7 | Architecture rule | **ENFORCE** |

### Identity / Platform module (non-Edge product path)

| Asset | Path | P7 use |
|-------|------|--------|
| `TenantRegistryPort` / `PgTenantRegistry` | `modules/identity` | **Platform tenants** — **NOT** product BB tenants |
| `TenantProvisioningOrchestrator` + `TenantProvisioningStep` | `modules/platform/.../tenant-provisioning.orchestrator.ts` | **VERIFY as pattern only** — Identity BC saga, not P7 product SoT |
| `PgTenantDatabaseProvisioner` | `shared/database/tenant-provisioning.service.ts` | **VERIFY** for adapter ideas; product DB path is BB-contracted |
| Platform admin `POST /admin/tenants` | `platform-admin.controller.ts` | **DO NOT** treat as Edge P7 API |
| Keycloak lifecycle / reconcile | Identity services + `reconciliation-job.bootstrap.ts` | Platform IAM — **≠** product topology (P7.7) |
| Shared Keycloak admin client | `shared/keycloak/*` | **REUSE** infra for adapters |

**Risk:** Naming collision “tenant” (Identity vs product). P7 must use distinct tables/refs (`edge_*` product tenant registry / BB refs). Expanded inventory: [Explore backend P7.0](ebb0f3b4-d3a2-430f-aaf4-9768b2ace181).
---

## 3. Keycloak inventory

| Capability | Observed | Decision |
|------------|----------|----------|
| Edge vertical KC org id | Vertical entity field | Platform workspace — not product topology |
| Identity Keycloak reconcile | Identity module | Platform org/user drift — not P7 realm-per-tenant |
| Product realm / org provisioning adapters | **Absent** in Edge | **BUILD** under P7.7 |
| Multi-org-per-tenant mapping tables | **Absent** | **BUILD** |

---

## 4. Frontend inventory

| Asset | Path | Decision |
|-------|------|----------|
| Edge shell + nav | `components/edge/edge-shell.tsx` | **REUSE** |
| “Tenant Management” nav | href `/edge/tenants`, **disabled: true** | **EXTEND** → P7 console (rename/clarify vs Identity) |
| Subscriptions / Billing hubs | `/edge/subscriptions`, `/edge/billing` | **REUSE** UX patterns |
| Permission gates / empty states | `components/edge/*` | **REUSE** |
| Provisioning / workflow / recon screens | **Absent** | **BUILD** |
| Playwright Edge CSRF + gated auth | `e2e/edge-*-*.spec.ts` | **REUSE** |

---

## 5. Explicit non-existence (must BUILD)

- Durable saga engine (definitions, leases, fencing, compensations)
- Product Control Contract client + M2M to Business Backends
- Placement / capacity pools
- Tenant DB / infra adapters
- IAM topology multi-mode provisioning
- Evidence / readiness gate aggregate
- Lifecycle ops beyond P5 subscription status
- Connectivity Agent
- P7 reconciliation center

---

## 6. Immediate sequencing (from Implementation Plan §31)

1. Complete G0 review (this pack)
2. ADRs: durable engine; Keycloak topologies; tenant naming vs Identity
3. Detailed backlog for P7.1 only after G0 approval
4. **Do not** start tenant-create UI or endpoints first
