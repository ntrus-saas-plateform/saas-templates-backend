# P5 — Reuse / Build / Extend Matrix

**Date:** 2026-11-09  
**Implementation:** **IMPLEMENTATION_COMPLETE**

| Capability | Decision | Evidence / target |
|------------|----------|-------------------|
| Edge auth / RBAC / workspace | **REUSE** | P0 guards + `edge_permissions` |
| CP outbox / audit | **REUSE** | Outbox + `edge_audit_events` |
| Product / vertical catalog | **REUSE** | P1 |
| Plans / packages / add-ons / capability inclusions | **REUSE** | P2 — inputs only, not runtime entitlements |
| Offer configurator / pricing snapshots | **REUSE** | Replay from P4 handoff `offerConfiguration` |
| P4 sales handoff package + events | **EXTEND** | Consumer: `sales.handoff.*.v1` ? subscription draft |
| Commercial account / order refs | **REUSE** | FK-style refs; Account ? Subscription |
| P0 approval / workflow patterns | **REUSE (pattern)** | Change requests + enterprise policies |
| Edge console shell / gates | **REUSE** | `edge-shell`, permission gates |
| Subscription aggregate + lifecycle | **BUILD** | `087` + `domain/subscription` |
| Composition (plan/package/add-ons) | **BUILD** | `087` items + periods |
| Entitlement resolution + snapshots | **BUILD** | `088` resolver + immutable snapshots |
| Change / renew / trial / suspend flows | **BUILD** | `088`–`089` state + coordination tables |
| Billing coordination port (P6) | **BUILD (stub)** | Adapter **UNAVAILABLE** until P6 configured |
| Provisioning coordination port (P7) | **BUILD (stub)** | Adapter **UNAVAILABLE** until P7 configured |
| Subscription console (FE) | **BUILD** | `/edge/subscriptions/**` — **ABSENT** today |
| Invoicing / payment / tax | **DO NOT BUILD** | P6 owns |
| Tenant DB provision / migrate | **DO NOT BUILD** | P7 owns |
| Second catalog / fake billing success | **FORBIDDEN** | — |
