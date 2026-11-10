# P7.5 — Architecture

| Field | Value |
|-------|-------|
| **Date** | 2026-11-10 |
| **Style** | Hexagonal / DDD inside Edge modular monolith |

---

## Stack

```
┌─────────────────────────────────────────────────────────────┐
│ Presentation (controllers / DTO — later slices)             │
├─────────────────────────────────────────────────────────────┤
│ Application use cases (TX: repo + history + audit + outbox) │
├─────────────────────────────────────────────────────────────┤
│ Domain: endpoint lifecycle · exchange SM · contracts ·      │
│         capabilities · error classification · handlers      │
├──────────────┬──────────────────────┬───────────────────────┤
│ PG repos     │ Typed HTTP client    │ Credential provider   │
│ (ports)      │ (ports — no secrets) │ Signature verifier    │
└──────────────┴──────────────────────┴───────────────────────┘
         ▲                    ▲
         │                    │
   PostgreSQL CP        Product Control API (external)
```

### Explicit non-choices

| Topic | Decision |
|-------|----------|
| Temporal / Cadence | **Not used** — durability is P7.4 Postgres workflow engine |
| Second product registry | **Forbidden** — FK to P7.2 `edge_p7_product_registry` / platforms / environments |
| Secrets in DB | **Forbidden** — `credential_ref` opaque handles only |
| Fake success | **Forbidden** — mutative ops → `OPERATION_NOT_IMPLEMENTED` |

## Hexagonal ports

| Port | Role |
|------|------|
| `ProductControlRepositoryPort` | Endpoints, exchanges, negotiated contracts, capabilities, health, reconciliation, history |
| `ProductControlClientPort` | Typed outbound handshake / discover / health / conformance |
| `CredentialProviderPort` | Resolve opaque `credential_ref` → short-lived material (never persisted) |
| `SignatureVerifierPort` | Request/response + callback signature verification |

## Workflow integration (P7.4)

Registered foundation handlers:

- `product_control.handshake`
- `product_control.discover_contract`
- `product_control.discover_capabilities`
- `product_control.verify_connectivity`
- `product_control.verify_health`
- `product_control.verify_conformance`

Remain unimplemented (honest failure):

- `unavailable:p76`, `unavailable:p77`
- `p7.5.product_control.provision`, `p7.5.product_control.activate`
- `p7.6.*`, `p7.7.*`

## Endpoint lifecycle

`PENDING_VALIDATION → VALIDATING → ACTIVE ⇄ DEGRADED ⇄ UNAVAILABLE → QUARANTINED | REVOKED`

`QUARANTINED` / `REVOKED` reject control dispatch.

## ControlExchange states

`CREATED → QUEUED → SENDING → SENT → ACKNOWLEDGED → SUCCEEDED`  
Failures: `FAILED`, `RETRY_PENDING`, `UNKNOWN_OUTCOME`, `RECONCILIATION_REQUIRED → RECONCILED`, `CANCELLED`

Timeout after send ⇒ `UNKNOWN_OUTCOME` (never assume non-receipt).

## Error taxonomy (mandate)

Security / auth / signature / TLS / contract spoofing ⇒ **not retryable**.  
Transient / timeout / rate-limit / unavailable ⇒ retryable under policy.

## Reuse

| Capability | Source |
|------------|--------|
| Product / platform / environment / published contracts | P7.2 registry |
| Durable steps / leases / fencing | P7.4 workflow |
| Outbox + audit TX | `ControlPlaneOutboxTransactionService`, `EDGE_P7_OUTBOX_TENANT` |
