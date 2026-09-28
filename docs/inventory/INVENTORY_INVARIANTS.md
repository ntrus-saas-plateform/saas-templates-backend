# Inventory invariants (coded)

Platform inventory / WMS invariants that are enforced in domain engines, repositories, or API gates. Requirement **55**.

## Soft delete & ledger

| Invariant | Where |
|-----------|--------|
| Catalog / warehouse / location soft-delete filters active rows (`deleted_at IS NULL`) | `listLotsFiltered` / list queries |
| Ledger is never deleted or updated in place — corrections = new entries | `inventory_ledger` inserts only |
| Redis / `CommercialCacheService` is **never** source of truth for stock or alerts | cache namespaces are advisory TTL only |

## Stock quantity

| Invariant | Where |
|-----------|--------|
| No negative on-hand when org policy forbids it | `inventory-policy.forbidNegativeStock` + movement / adjust paths |
| ATP does not double-subtract allocated (allocated ⊆ reserved) | `availability.engine` / ATP snapshot |
| Adjustments require controlled `reason_code` | `wms-status.machine` / adjust use-cases |

## Lot / pharma quality

| Invariant | Where |
|-----------|--------|
| Expired lots are not sellable | `isLotSellable` / `assertLotSellableForIssue` / `pharma.rules` |
| Recalled lots are not allocated / sold | allocation + sellable checks; `LotQualityStatus.RECALLED` |
| Quarantined stock excluded from sellable ATP | availability buckets |
| FEFO prefers earliest expiry among sellable lots | `fefo.allocator` |

## Ledger & movements

| Invariant | Where |
|-----------|--------|
| Ledger is append-only; corrections = new entries | `inventory-movement.engine` / `inventory_ledger` inserts only |
| Sole stock mutation surface is inventory repository ports | module architecture / ports |
| Idempotent receive/adjust keys when provided | `inventory_idempotency` |

## Freeze / counts / transfers

| Invariant | Where |
|-----------|--------|
| Active freeze blocks forbidden ops (receive/transfer/adjust/… per matrix) | `freeze.rules` / `hasActiveFreeze` |
| Count post writes variance via adjust path then releases freeze | count session use-cases |
| Completed transfers are immutable (no further status except documented terminal) | `wms-status.machine` transfer SM |

## Serialization

| Invariant | Where |
|-----------|--------|
| Serial unique per `(organization_id, sku_id, serial_number)` | DB unique + receive insert |
| Serial status transitions follow serial state machine | `serial-state.machine` |

## Import (commercial-ops)

| Invariant | Where |
|-----------|--------|
| Import never commits unvalidated staging | commit only `VALIDATED` or `APPROVED` |
| Commit requires `approved_by` | `ImportBatchUseCase` |
| Validation always runs and is persisted (never skipped) | `ValidateImportBatchUseCase` |
| `source_format` recorded on batch | create/update import batch |

## Scanner

| Invariant | Where |
|-----------|--------|
| Recalled / quarantine / expired scans restrict allowed actions | `allowedActionsForContext` |

## Alerts / audit

| Invariant | Where |
|-----------|--------|
| Raised alerts emit `inventory.alert.raised.v1` via outbox | `EvaluateAlertsForOrgUseCase` |
| Audit rows chain `row_hash = sha256(prev_hash + payload)` when columns exist | `PgAuditWriter` |
