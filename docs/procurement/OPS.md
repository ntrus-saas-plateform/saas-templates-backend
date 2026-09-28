# Procurement Ops Runbook (Wave 1)

## Migrate

```bash
pnpm migrate:control   # includes 059_procurement_permissions
pnpm migrate:tenant <tenantId>  # includes 042_procurement_engine_v1
```

## Broker down

Mutations that emit events use `runWithOutbox`. Rows stay `PENDING` until publisher recovers. Do **not** dual-write.

## Redis down

Procurement Wave 1 does not require Redis for correctness (document SoT is Postgres). If a future cache is added, follow BusinessContext fail-open patterns.

## Three-way mismatch

1. Inspect `purchasing_three_way_matches.variance_codes`
2. Correct supplier invoice document or GRN
3. Re-run `POST /purchasing/three-way-match`
4. Accounting posting remains out of band until Wave 2

## Supplier blocked

`SupplierStatus.BLOCKED` / `ARCHIVED` cannot receive new POs (`assertSupplierUsableForOrder`). Unblock via lifecycle transition with `purchasing:supplier_manage`.

## Rollback

Tenant `042` is additive (ALTER/CREATE). To rollback: drop new tables / columns only after draining open RFQs/invoices; keep `019` purchasing MVP intact.
