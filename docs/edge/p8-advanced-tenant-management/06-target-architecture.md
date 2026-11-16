# 06 — Target Architecture

## Bounded Context

**Tenant Management (P8)** — administration, gouvernance, intelligence du portefeuille de product tenants.

```
Presentation  → EdgeTenantManagementController (/api/edge/tenants/**)
Application   → Registry, 360, Admin, LifecycleRequest, Exception,
                Migration, Recovery, Termination, Reconciliation, Analytics use cases
Domain        → Types, policies, state machines, ports, events
Infrastructure→ PgTenantManagementRepository, projection readers P5/P6/P7,
                outbox publishers
```

## Modèle d’agrégation

```
edge_p8_tenants (aggregate root registry)
  ├── profile / preferences
  ├── tags / assignments
  ├── administrative / governance status (owned)
  ├── technical status (projection from P7, stale-aware)
  ├── commercial refs (accountId, subscriptionId, productId)
  ├── lifecycle / migration / recovery / termination requests
  ├── exceptions + approvals
  ├── health snapshots
  ├── risk assessments
  ├── reconciliation findings
  └── activity / audit append-only
```

## State dimensions

| Dimension | Owner écriture | Source lecture |
|---|---|---|
| AdministrativeStatus | P8 | P8 |
| TechnicalStatus | P7 (projection) | P7 via sync/reconcile |
| GovernanceStatus | P8 (+ règles) | P8 |
| SubscriptionStatus | P5 | P5 |
| FinancialStatus | P6 | P6 |

## Flux typiques

1. **Register / sync** — depuis activation P7.10 ou provisioning auth → upsert registry.
2. **Admin update** — metadata/tags/owner → audit + outbox.
3. **Lifecycle request** — P8 crée demande + approval → délègue à P7.11 / P5.
4. **Reconciliation** — compare registry vs P5/P7 → findings → remediation contrôlée.
5. **360°** — fan-out lectures spécialisées (pas une mega-query unique côté client).

## Package paths

```
src/modules/edge/domain/tenant-management/
src/modules/edge/application/tenant-management/
src/modules/edge/infrastructure/tenant-management/
src/modules/edge/presentation/controllers/tenant-management.controller.ts
src/modules/edge/presentation/dto/tenant-management.dto.ts
```

## Frontend

```
/edge/tenants                     → Tenant Management Center
/edge/tenants/[tenantId]          → 360 workspace (tabs)
/edge/tenants/approvals|exceptions|reconciliation|reports → workspaces
```
