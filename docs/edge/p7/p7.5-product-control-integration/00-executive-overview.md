# P7.5 — Product Control Integration — Executive Overview

| Field | Value |
|-------|-------|
| **Status** | APPLICATION + INFRA + API — use cases, HTTP client, RBAC APIs, security/TX tests |
| **Date** | 2026-11-10 |
| **Branch** | `feature/console` |
| **Migration** | `100_edge_p7_product_control_integration.sql` |
| **Depends on** | P7.1 authorization, P7.2 registry, P7.3 placement, P7.4 workflow |
| **Out of scope (this slice)** | Live BB provisioning mutations, P7.6 cloud/DB, P7.7 Keycloak, tenant ACTIVE, frontend console |

---

## Objective

Provide the durable integration foundation between Okapi Edge (SaaS Control Plane) and Product Control APIs:

1. Endpoint registry (linked to P7.2 product/platform/environment — **no second product registry**).
2. Contract negotiation / capability discovery domain rules.
3. Durable `ControlExchange` lifecycle with unknown-outcome & reconciliation states.
4. Error classification with **non-retryable security failures**.
5. Real P7.4 workflow handlers for non-mutative integration ops.
6. Mutative / future infra handlers remain `OPERATION_NOT_IMPLEMENTED`.

## Architecture choices (frozen for foundation)

| Decision | Choice |
|----------|--------|
| Orchestration | **Postgres + Nest hexagonal** — reuse P7.4 durable workflow (**no Temporal**) |
| Client | Typed Product Control HTTP client port (adapter later) |
| Secrets | **Credential refs only** — never plaintext in PostgreSQL |
| Events / audit | `ControlPlaneOutboxTransactionService` + `audit.create(client)` + `EDGE_P7_OUTBOX_TENANT` |
| Module layout | `src/modules/edge/{domain,application,infrastructure}/product-control` |

## Table naming note

P7.2 already owns `edge_p7_product_control_contracts` (published registry contracts).  
P7.5 discovered/negotiated snapshots live in `edge_p7_product_control_negotiated_contracts`.

## Foundation deliverables

- Docs: this overview + `01-architecture.md`
- Migration `100`
- Domain types, lifecycle, exchange SM, contract validation, capability matching, error/retry classification, ports, events, handlers
- Domain vitest suite green
- Application use-case stubs (TX pattern)
- Workflow registry: real `product_control.*` handlers; `unavailable:p76/p77` + mutative keys stay unimplemented
