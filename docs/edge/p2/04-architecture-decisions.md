# P2 — Architecture Decisions

## ADR-P2-001: Stay inside Edge modular monolith

**Decision:** Commercial domains live under `src/modules/edge/**`, not a separate microservice.  
**Why:** Matches P0/P1 Control Plane, shared IAM, shared migrations.

## ADR-P2-002: Consume P1 FKs; never duplicate product/capability tables

**Decision:** All commercial compositions reference `edge_products` / `edge_technical_capabilities` / segments / profiles.  
**Why:** Single technical SoT; commercial inclusion is a separate mapping layer.

## ADR-P2-003: NUMERIC money only

**Decision:** Store amounts as `NUMERIC(19,6)` (or tighter scale per currency policy); compute with decimal strings / integer minor units in domain helpers — never IEEE floats.  
**Why:** Pricing precision invariant.

## ADR-P2-004: No seed list prices / market sizes

**Decision:** Empty catalogs are valid; unknown research fields remain null with `NEEDS_RESEARCH`.  
**Why:** Spec forbids invented TAM/SAM/SOM and prices.

## ADR-P2-005: Commercial readiness ≠ technical readiness

**Decision:** Separate evaluation tables and engines; publication requires both gates when policy says so.  
**Why:** Spec §2.4 / §20.

## ADR-P2-006: Permission codes follow existing `platform:*` style

**Decision:** Seed `platform:commercial:*`, `platform:pricing:*`, etc., not a parallel `edge.*` auth system.  
**Why:** Consistency with 073/074 RBAC.
