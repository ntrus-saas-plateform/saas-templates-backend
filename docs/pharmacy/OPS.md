# Pharmacy Ops (Waves 1–4)

## Migrate

```bash
pnpm migrate:control   # 065–066 pharmacy (+ enterprise) + 068 inventory QC + **069** industrial + **070** advanced ops
pnpm migrate:tenant <id>  # 054–060 pharmacy; 062 wave1; 063 serial; **064** industrial; **065** advanced ops
```

## Wave 2 traceability (hardening)

| Gate | Behavior |
|------|----------|
| `POST /recalls/:id/simulate` | Dry-run matches; no status change / no inventory quarantine |
| `POST /recalls/:id/execute` | Fail-closed `RECALL_BRIDGE_REQUIRED` if any recall lot has `lotId` without `RecallLotUseCase` |
| Cold excursion + `lotId` | Fail-closed `QUARANTINE_BRIDGE_REQUIRED` when `coldChainBlockOnExcursion` |
| Medication return → QUARANTINE | Fail-closed `QUARANTINE_BRIDGE_REQUIRED` when `returnQuarantineRequired` + `lotId` |
| Prepare dispensing | `assertDispenseSerials` when `SERIALIZATION` + `serialTrackingRequired` |
| `GET /lots/:lotId/genealogy` | Facade over inventory genealogy; fail-closed without bridge |

National serialization hubs / eBR / LIMS remain **out of scope** (hub = config-only in 065).

## Wave 3 industrial ops foundation (064 — not full MES)

| Surface | Behavior |
|---------|----------|
| Batch WO stub | DRAFT→…→QC_HOLD/RELEASED_LOT — **no** eBR step engine |
| Equipment + PM WOs | Calendar lite; overdue in industrial ops snapshot |
| Stability study stub | Protocol + timepoints JSON — **not** LIMS |
| CAPA effectiveness | `VERIFIED`/`WAIVED` required before NC CLOSE |
| Demand `syncStock` | Fail-closed `STOCK_BRIDGE_REQUIRED` / `REQUISITION_BRIDGE_REQUIRED` |
| Cap | `PHARMACY_INDUSTRIAL_OPS` |

## Advanced ops (065)

| Surface | Behavior |
|---------|----------|
| Serial↔`stock_serials` | Prepare verifies; complete → `ISSUED` when `PHARMACY_ADVANCED_OPS` + `SERIALIZATION` |
| Batch TRANSFORM | `RELEASED_LOT` + `parentLotId` → inventory lot link; fail-closed without bridge |
| Stability → NC | FAIL/OOS opens inventory NC (fail-closed) |
| Signed cold | `SIGNED_API` HMAC + `last_seen_at`; stale devices in ops copilot |
| Ops copilot | Rule anomalies only — **not** ML digital twin |
| Serialization hub | `serialization_hub_config` JSONB — **CONFIG_ONLY** |
| Demand `useForecast` | Fail-closed `FORECAST_BRIDGE_REQUIRED` |
| Cap | `PHARMACY_ADVANCED_OPS` |

**Deferred:** full MES/eBR, MRP/APS solvers, LIMS instruments, live FMD/DSCSA connectors, ML twin, OEE, supplier CoA portals UI.

## Backup / restore (§76)

Pharmacy data lives in the **tenant database** (DB-per-tenant). Follow platform [Disaster Recovery](../DISASTER-RECOVERY.md) and the timed drill template [RESTORE-DRILL.md](./RESTORE-DRILL.md):

1. Restore **control-plane** first (tenant registry, org membership, permissions).
2. Restore the **tenant DB** (pharmacy tables from migrations `054`–`060`, plus inventory/sales/insurance SoTs used by dispense bridges).
3. Redis/BusinessContext cache is ephemeral — warm via normal requests.
4. Outbox/RabbitMQ: replay undelivered events after DB restore; do not treat broker alone as SoT.

**Not verified in this repo session:** a filled sign-off row on [RESTORE-DRILL.md](./RESTORE-DRILL.md) with measured RTO.

## External bridges (§70)

Complete dispense / patient responsibility / API cold ingest use `invokePharmacyExternalBridge` (timeout + `DEPENDENCY_UNAVAILABLE`). Failures are fail-closed — no silent success.

### Dispense compensation (§79)

Complete dispense optionally records a `PHARMACY_DISPENSE` orchestration saga (migration `060`). Domain compensation remains SoT via `compensatePharmacyDispenseSideEffects` (LIFO):

1. Cancel insurance claim via `CancelClaimUseCase` (`POST /insurance/claims/:id/cancel`)
2. Cancel sales order (when `CancelSalesOrderUseCase` is wired)
3. `receiveReturn` stock via `InventoryEngineService.compensateIssuedStock`
4. Else release FEFO reservations if issue never committed
5. Orchestration `CompensateSagaUseCase` records the compensation plan (does not replace domain adapters)

Membership used at complete is persisted on `pharmacy_dispensings.metadata.membershipId` for §80 claim recon.

This is business-level compensation + saga tracking, not a distributed XA transaction. Live chaos kill of inventory mid-flight remains **NOT VERIFIED**.

## Capabilities

Enable `PHARMACY` (+ children) on healthcare profiles only — supermarket defaults exclude PHARMACY.

Wave 3 analytics (`056`): `PHARMACY_MCP`, `PHARMACY_MOBILE`, `PHARMACY_OFFLINE`, `PHARMACY_REPORTING`.  
Wave 3 industrial (`064`): `PHARMACY_INDUSTRIAL_OPS` — command-center enriches alerts when this cap is enabled.

## Command center

1. `GET /pharmacy/analytics/kpis` — counts
2. `GET /pharmacy/command-center` — KPIs + alert subset (open recalls / cold / controlled / refills due)
3. `GET /pharmacy/analytics/reconciliation` — §80 Rx/dispense/sales/claim divergence scan (controlled physical via `POST …/controlled/reconcile`)

## Offline sync

`POST /pharmacy/offline/sync` with `deviceId` + `clientOperationId` — returns existing row on replay (idempotent). Requires `PHARMACY_OFFLINE`. Stub apply marks `APPLIED` (no full mobile offline engine yet).

## MCP

Require `mcp:invoke` + domain permission + BusinessContext caps including `PHARMACY_MCP`.

## Tests

```bash
pnpm exec vitest run src/modules/pharmacy src/modules/mcp/application/mcp-tools.pharmacy --reporter=dot
```
