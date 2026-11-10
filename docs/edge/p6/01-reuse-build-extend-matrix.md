# P6 � Reuse / Build / Extend Matrix

**Date:** 2026-11-09  
**Implementation:** **OPS_COMPLETE / RUNTIME_PENDING** (updated 2026-11-10)

| Capability | Decision | Evidence / target |
|------------|----------|-------------------|
| Edge auth / RBAC / workspace | **REUSE** | P0 guards + `edge_permissions` |
| CP outbox / audit | **REUSE** | Outbox + `edge_audit_events` |
| P5 billing coordination tables / events | **EXTEND** | Consumer of `subscription.billing_coordination.requested.v1`; producer of `billing.*` |
| P5 subscription refs (read) | **REUSE** | FK-style; P6 never owns subscription status |
| P2 commercial snapshots (via P5) | **REUSE** | Pricing inputs � copy at invoice issue |
| Edge console shell / gates | **REUSE** | `edge-shell`, permission gates |
| Billing accounts + profiles | **BUILD** | `090` |
| Invoice lifecycle + lines | **BUILD** | `090`�`091` |
| Tax placeholders / jurisdiction refs | **BUILD (minimal)** | `091` � no full engine in P6.0 |
| Payment intents / attempts | **BUILD** | `091` |
| Refunds / credits (ledger-linked) | **BUILD (foundation)** | `092` |
| Collections / dunning read models | **BUILD (stubs)** | Honest `NOT_CONFIGURED` until policy engine |
| Reconciliation + ledger entries | **BUILD** | `092` append-only |
| Payment provider port | **BUILD** | Default **UNAVAILABLE**; `HttpWebhook` stub |
| Hyperswitch integration | **DO NOT BUILD** | Forbidden dependency |
| P5 subscription state machine | **DO NOT BUILD** | P5 owns |
| Tenant provisioning | **DO NOT BUILD** | P7 owns |
| Billing console (FE) | **BUILD** | `/edge/billing/**` � **ABSENT** today |
| Store PAN/CVV | **FORBIDDEN** | � |
