# Commercial Retention

Retention is configured per organization on `commercial_org_config` (migration `022`):

| Field | Default | Purpose |
|-------|---------|---------|
| `audit_retention_days` | 2555 (~7y) | Audit / compliance trail |
| `transaction_retention_days` | 3650 (~10y) | Orders, invoices, payments, ledger |
| `event_retention_days` | 730 (~2y) | Outbox / domain event history |

Edit via `PUT /api/v1/commercial-config` or Settings → Commercial (org).

## Usage

- Jobs should purge or archive by these windows — never hard-delete active open AR or on-hand lots solely by age.
- Explain snapshots (`commercial_explain_snapshots`) follow event retention unless a compliance hold applies.
- Control-plane audit may use identity/`privacy.*` settings separately; commercial document retention is tenant-DB scoped via the fields above.
- Inventory ledger retention remains on `inventory_policies.retention` (separate SoT).

## Related feature flags

`commercial_org_config.enable_*` is the write SoT; upsert syncs tenant `features.enable_*` (and aliases `features.commerce.loyalty` / `features.commerce.pos`). Do not maintain parallel toggles elsewhere.

## Reservation expiry

`reservation_timeout_minutes` drives:

1. `expires_at` on confirm reserve
2. ExpireReservations job (also expires ACTIVE rows with NULL `expires_at` using org timeout)
3. Orchestration timeout key `RESERVATION` (bidirectional sync)
