# Warehouse Ops Runbook (Waves 1–2)

## Migrate

```bash
pnpm migrate:control   # 061 + 062 warehouse permissions
pnpm migrate:tenant <tenantId>  # 047 + 048 + 049
```

## Stock integrity

Warehouse never writes `stock_lots` / `inventory_ledger` directly.  
Receiving accept → `InventoryRepository.receiveLot`.  
Dispatch → fulfillment `MarkShipmentShipped` → `commitIssue`.  
PO → ASN bridge does **not** post GR / stock.

## Broker down

Outbox retains `warehouse.*` events until publisher recovers.

## Stuck putaway / ops center

`POST /api/v1/warehouse/ops/scan-stuck` creates reconciliation discrepancies + ops incidents.  
Act with ACKNOWLEDGE / INVESTIGATE / RESOLVE / ESCALATE — never raw PATCH status.

## Offline sync

Open session with config + BusinessContext versions. Stale versions and wrong warehouse/device → reject.  
Idempotency key + clientOperationId — duplicate different payload → **409**.

## Carriers

Default adapter is **noop**. Persist quotes via `POST /carriers/rates`. Live carrier APIs remain NOT VERIFIED.

## Cold chain

`POST /cold-chain/readings` with thresholds → excursion opens QUARANTINED record + CRITICAL ops incident.

## Capability off

`@RequiresCapability` fail-closed when BusinessContext profile present. Enable WAREHOUSE family (+ Wave 2 caps as needed) in business-config.
