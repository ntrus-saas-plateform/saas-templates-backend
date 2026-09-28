# Commerce Phase 3 / Vague C — Evidence Audit (POS compensation + returns deepen)

**Scope:** Backend-only close of Vague B residual « payé sans stock » and deepen commercial return ↔ WMS beyond authorize-only.

**Verdict:** Scoped backend path (POS stock integrity + returns↔WMS bridge) is **PRODUCTION READY = YES**. Full 4-profile retail certification with FE/P5/variants matrix remains out of this phase.

## Matrix P0–P4

| Criterion | Evidence | Verdict |
|-----------|----------|---------|
| Allocate **before** pay (preventive) | `PosCheckoutUseCase`: allocate + fail-closed → abort (release+cancel, no capture) → then `capturePayment` → `commitSale` | **VERIFIED P3–P4** |
| commitSale fail after pay → refund + release + cancel | `compensateAfterPayment`; no session bind; `POS_CHECKOUT_COMPENSATED` + `compensationErrors` | **VERIFIED P3–P4** |
| Authorize bridge idempotent | `findReturnShipmentByCommercialReturnId` + `bridgeCommercialReturnToWarehouse` | **VERIFIED P3** |
| Receive → WRS `RECEIVED` + event | `return.warehouse_bridge.received.v1`; errors in `metadata.wmsBridgeErrors` | **VERIFIED P3** |
| Inspect → disposition WMS if cap | Map RESTOCK/REPAIR/REPACK→RESTOCK, QUARANTINE, DISPOSE→DESTROY; `return.warehouse_bridge.dispositioned.v1` | **VERIFIED P3** |
| Cap missing → bridge no-op | Spec | **VERIFIED P3** |
| Specs | `pos-checkout-stock.p4.spec.ts`, `returns-wms-bridge.spec.ts` (12) | **VERIFIED P4 unit** |
| Frontend / P5 / variants matrix | Non-goals of Vague C | **N/A (platform residual)** |
| **PRODUCTION READY (scoped backend)** | Preventive alloc + compensation safety net + returns bridge deepen with observability | **YES** |
| PRODUCTION READY 4 profils E2E + FE | Variants PARTIAL, no FE, no P5 load/chaos | **NO (platform)** |

## Residual (platform — hors scope Vague C)

1. **Variants** — metadata-only (EXPERIMENTAL); no SKU matrix engine.
2. **Frontend** — capability UI deferred.
3. **P4 HTTP live multi-tenant / P5** — chaos/backup/load not run.
4. **Dual SoT returns** — commercial commit wins; WMS sync is observable best-effort (`wmsBridgeErrors` + bridge events), not a single transactional SoT.

## Related

- Phase 2: [PHASE2-EVIDENCE-AUDIT.md](./PHASE2-EVIDENCE-AUDIT.md)
- Phase 1: [PHASE1-EVIDENCE-AUDIT.md](./PHASE1-EVIDENCE-AUDIT.md)
- Caps: [CAPABILITY_CATALOG.md](../business-config/CAPABILITY_CATALOG.md)
