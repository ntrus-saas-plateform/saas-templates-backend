# P7.0 — Reuse / Extend / Build Matrix

**Date:** 2026-11-10  
**Gate:** G0

| Capability (Implementation Plan) | Decision | Evidence |
|----------------------------------|----------|----------|
| Edge hexagonal Nest modules | **REUSE** | `src/modules/edge/**` |
| Platform RBAC / Edge auth | **REUSE** | guards + `edge_permissions` |
| Outbox / event handlers | **REUSE** | MessagingModule + EXTRA handlers |
| Job scheduler intervals | **EXTEND** | Insufficient alone for sagas |
| P5 provisioning request rows | **EXTEND** | `edge_subscription_provisioning_requests` (089) |
| P5 provisioning port | **EXTEND** | `SubscriptionProvisioningCoordinationPort` → real P7 adapter |
| Unavailable adapter honesty | **REUSE** | `UnavailableSubscriptionProvisioningAdapter` |
| Entitlement snapshots P5 | **REUSE** | snapshots + version |
| Product / backends catalog | **EXTEND** | P1 backends → Product Platform Registry |
| Commercial/product readiness | **VERIFY** | Not technical readiness |
| Identity TenantRegistry / Platform tenant saga | **DO NOT REUSE as P7 tenant SoT** | Pattern VERIFY only ([backend explore](ebb0f3b4-d3a2-430f-aaf4-9768b2ace181)) |
| Shared Keycloak admin client | **REUSE** infra | Product topology still **BUILD** |
| Billing financial events → activation | **FORBIDDEN direct** | Route via P5 |
| ERP FE `/admin/tenants` | **DO NOT REUSE** | Wrong BC ([frontend explore](dfe6cdae-7a4a-43ac-94c7-bccdb759f8a2)) |
| P5 FE subscription Provisioning tab | **REUSE** deep-link / coordination | Not P7 ops console |
| Durable workflow engine | **BUILD** | Absent |
| Placement & capacity | **BUILD** | Absent |
| Product Control Integration | **BUILD** | Absent |
| Infra/DB adapters | **BUILD** | Absent |
| Keycloak product topology | **BUILD** | Absent |
| Config/entitlement deploy ops | **BUILD** | Absent (delivery layer) |
| App access / DNS / TLS | **BUILD** | Absent |
| Readiness & activation evidence | **BUILD** | Absent |
| Lifecycle (suspend/migrate/…) | **BUILD** | Absent as P7 technical ops |
| Onboarding cases | **BUILD** | Absent |
| Reconciliation (P7) | **BUILD** | Absent (billing recon ≠ tenant recon) |
| Connectivity Agent | **BUILD** | Absent |
| FE Tenant Management entry | **EXTEND** | Nav disabled stub |
| FE ops console screens | **BUILD** | Per plan §20 order |

## Naming collision risk

| Term | Existing meaning | P7 meaning |
|------|------------------|------------|
| Tenant | Identity platform tenant / BB customer | Product isolation unit in one BB |
| Keycloak org | Edge vertical workspace org | Product establishment IAM org |
| Provisioning request | P5 coordination row | Full durable provisioning request aggregate |

ADR required before P7.1 schema design.
