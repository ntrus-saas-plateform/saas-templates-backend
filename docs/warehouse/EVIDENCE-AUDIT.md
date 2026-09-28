# Warehouse — Evidence Audit (Phase 7 Waves 1–2 + audit hardening + P4/delivery)

**Date:** 2026-09-14  
**Verdict:** **PARTIALLY VERIFIED** — C01/C02 closed; delivery/POD + inbox dedup + MCP P4 unit abuse added.  
**PRODUCTION READY = NO** (no Docker five-tenant WMS HTTP P5, no live carriers/fleet/routes).

## Closed this wave

| Item | Evidence |
|------|----------|
| HTTP BusinessContext → UC gates | `warehouse.controller.ts` caps() |
| Offline executes putaway/pick | `SyncWarehouseOfflineOperationUseCase` |
| Returns/cold-chain → Inventory | disposition + excursion UCs |
| Pick strategy planner | `pick-strategy.engine.ts` |
| Delivery/POD | `ConfirmWarehouseDeliveryUseCase` + mig `050` + perm `063` |
| Inbox dedup on dispatch | `ProcessWarehouseShipmentDispatchedInboxUseCase` + handler in orchestration EXTRA |
| MCP P4 deny without perm/cap | `mcp-tools.warehouse-p4.spec.ts` |

## Still NOT VERIFIED

| Item | Status |
|------|--------|
| Docker five-tenant WMS HTTP P5 | NOT VERIFIED |
| Live carrier / fleet / route optimization | NOT VERIFIED |
| Redis WH task queues | NOT VERIFIED |
| Performance / failure drills | NOT VERIFIED |

## Migrate

```bash
pnpm migrate:control   # 061–063
pnpm migrate:tenant <id>  # 047–050
```

## Tests

```bash
pnpm exec vitest run src/modules/warehouse src/modules/mcp/application/mcp-tools.warehouse
```
