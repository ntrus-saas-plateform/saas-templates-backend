# ADR-P7-003 — Tenant Naming & Identity Boundaries

**Status:** Proposed (G0)  
**Date:** 2026-11-10

## Decision

| Concept | Store | Owner |
|---------|-------|-------|
| Platform / Identity tenant | Identity module tables + `TenantRegistryPort` | Identity |
| Commercial Account | `edge_commercial_accounts` | P3/P4 |
| Subscription | `edge_subscriptions` | P5 |
| Product tenant (BB) | P7 registry + BB authoritative id | P7 / BB |
| Edge vertical workspace | `edge_verticals` | P0 |

P7 tables **must not** use Identity `tenants` PK as product tenant id.

Recommended naming in APIs: `productTenantId` / `businessTenantRef` vs `platformTenantId` when both appear.

## Consequence

Frontend nav “Tenant Management” should be labeled as **Product Tenant Operations** (or similar) when enabled under P7.

Do **not** wire Edge P7 to Platform `TenantProvisioningOrchestrator` or ERP `/admin/tenants` without an explicit cross-BC ADR. Those paths provision Identity/platform tenants, not product Business Backend tenants.
