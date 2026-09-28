# Commerce Phase 1 — Evidence Audit (Vague A, backend only)

**Scope:** Seed/enrich 4 Business Profiles (`GENERAL_COMMERCE`, `RETAIL_STORE`, `STATIONERY_BOOKSTORE`, `COSMETICS_RETAIL`) via capabilities + vertical extensions + gates + MCP. Reuses Core Sales/POS/Inventory — no second engines, no frontend.

**Verdict:** profiles/caps/extensions/MCP foundation = VERIFIED P2–P3. **PRODUCTION READY = NO** for full retail certification (Core gaps deferred).

**Follow-up:** Vague B (Core harden + P4) — see [PHASE2-EVIDENCE-AUDIT.md](./PHASE2-EVIDENCE-AUDIT.md).

## Matrix P0–P3

| Criterion | Evidence | Verdict |
|-----------|----------|---------|
| 4 profiles assignable | Tenant migration `066_commerce_profiles_phase1.sql`; materializer specs | **VERIFIED P2–P3** |
| Caps + deps seeded | `GENERAL_COMMERCE`, `STORE_MANAGEMENT`, `BOOKSTORE`/`BOOK_CATALOG`/`ISBN`, `STATIONERY`, `COSMETICS_RETAIL`/`COSMETIC_PRODUCT` + Core reuse | **VERIFIED P2–P3** |
| Book / cosmetic extensions | `(BOOKSTORE, book.metadata)`, `(STATIONERY, stationery.attributes)`, `(COSMETICS_RETAIL, cosmetic.attributes)`; dual-write sync helpers | **VERIFIED P3** |
| ISBN validate + uniqueness | `book-isbn.ts` check digits; `product_isbn_index` org-scoped unique (JSONB alone not unique) | **VERIFIED P3** |
| Capability gates (no `businessType`) | `commerce-capability-gate.ts` — BOOKSTORE/COSMETICS/GENERAL_COMMERCE | **VERIFIED P3** |
| HTTP catalog routes | `/catalog/books/*`, `/catalog/cosmetics/*` + `@RequiresCapability` + CP perms `071` | **VERIFIED P2–P3** |
| MCP bookstore/cosmetics | Maps in `mcp-tool-permissions.ts`; tools in `mcp-tools.service.ts` | **VERIFIED P2–P3** |
| No Core engine duplication | Wrappers over `CreateProduct` / `UpdateProductMaster` + satellite extensions | **VERIFIED P1–P2** |
| Pharmacy non-regression | Existing pharmacy vitest suite (smoke) | **SMOKE** |
| PRODUCTION READY (4 profiles end-to-end retail) | Core POS→stock harden, variants runtime, dual returns/WMS out of scope | **NO** |

## Explicit blockers (Core / out of Vague A)

1. **POS → stock** — not hardened in this wave; do not certify cash-and-carry inventory correctness beyond existing Core evidence.
2. **PRODUCT_VARIANTS** — remains EXPERIMENTAL / PARTIAL at runtime.
3. **Dual returns / WMS unification** — deferred (sales returns vs warehouse returns logistics).
4. **Omnichannel / offline POS rewrite / P4 adversarial / P5 soak** — non-goals.
5. **Country-specific cosmetics/pharmacy regulation** — not invented; cosmetics get lot/exp/FEFO flags only when Core caps present.

## ISBN uniqueness note

`book.metadata` JSONB is the product-facing payload. Uniqueness is enforced via satellite table `product_isbn_index (organization_id, isbn, product_id)` (unique on `(organization_id, isbn)`). Application lookup + fail-closed conflict on create/update. Do not rely on JSONB expression indexes alone for org-scoped uniqueness without that table.

## Certification table (end of Vague A)

| Critère | Verdict |
|---------|---------|
| 4 profils assignables | VERIFIED P2–P3 |
| Caps + deps | VERIFIED P2–P3 |
| Book/cosmetic extensions | VERIFIED P3 |
| MCP bookstore/cosmetics | VERIFIED P2–P3 |
| Pas de doublon Core | VERIFIED P1–P2 |
| PRODUCTION READY 4 profils | **NO** (Core retail gaps hors scope) |

## Related

- Profiles: [PROFILE_CATALOG.md](../business-config/PROFILE_CATALOG.md)
- Caps: [CAPABILITY_CATALOG.md](../business-config/CAPABILITY_CATALOG.md)
- Extensions: [EXTENSIONS-V3.md](../business-config/EXTENSIONS-V3.md)
