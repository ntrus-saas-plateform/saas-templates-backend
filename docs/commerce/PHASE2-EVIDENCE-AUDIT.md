# Commerce Phase 2 / Vague B — Evidence Audit (Core harden + P4)

**Scope:** Backend-only harden after Phase 1 profiles: POS→stock fail-closed, PRODUCT_VARIANTS partial runtime via `retail.variants`, light commercial return → WMS bridge, P4 adversarial commerce/MCP/ISBN.

**Verdict:** Core retail integrity gaps from Phase 1 evidence reduced. **PRODUCTION READY = NO** (no FE, no P5, variants PARTIAL, dual returns not fully unified).

## Matrix P0–P4

| Criterion | Evidence | Verdict |
|-----------|----------|---------|
| POS checkout without full allocation | `PosCheckoutUseCase` throws `INSUFFICIENT_STOCK` / `POS_STOCK_ALLOCATION_REQUIRED`; `pos-checkout-stock.p4.spec.ts` | **VERIFIED P3–P4** |
| commitSale failure does not bind session | Spec propagates error; bind not called | **VERIFIED P4** |
| PRODUCT_VARIANTS gated write | `assertProductVariantsCapabilities` + `UpsertProductVariantsExtensionUseCase` + `PUT /catalog/products/:id/variants` | **VERIFIED P3 (PARTIAL engine)** |
| Return authorize → WH shipment | `AuthorizeReturnUseCase` → `CreateReturnShipmentUseCase` iff `RETURNS_LOGISTICS` + warehouseId | **VERIFIED P3** |
| MCP bookstore/cosmetics P4 abuse | `mcp-tools.commerce-p4.spec.ts` | **VERIFIED P4 unit** |
| ISBN conflict / cross-profile gates | `commerce-vertical.p4.spec.ts` | **VERIFIED P4** |
| Frontend capability UI | Non-goal | **N/A** |
| P5 load/chaos/backup | Non-goal | **NOT VERIFIED** |
| PRODUCTION READY 4 profils E2E | Residual PARTIAL variants + dual returns + no P5/FE | **NO** |

## Residual blockers

1. **Variants** — metadata axes/options only; no SKU matrix / inheritance engine (cap remains EXPERIMENTAL).
2. **Returns dual SoT** — **Closed for bridge depth in Vague C** (idempotent + receive/inspect + observability) — see [PHASE3-EVIDENCE-AUDIT.md](./PHASE3-EVIDENCE-AUDIT.md). Single transactional SoT still not unified.
3. **Paid-without-stock** — **Closed in Vague C** (allocate-before-pay + post-pay compensation safety net).
4. **P4 HTTP live multi-tenant / P5** — not run.
5. **Frontend** — still deferred.

## Related

- Phase 3: [PHASE3-EVIDENCE-AUDIT.md](./PHASE3-EVIDENCE-AUDIT.md) — scoped backend **PRODUCTION READY = YES**
- Phase 1: [PHASE1-EVIDENCE-AUDIT.md](./PHASE1-EVIDENCE-AUDIT.md)
- Caps: [CAPABILITY_CATALOG.md](../business-config/CAPABILITY_CATALOG.md)
- Extensions: [EXTENSIONS-V3.md](../business-config/EXTENSIONS-V3.md)
