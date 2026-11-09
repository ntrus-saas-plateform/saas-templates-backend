# P1.0 — Architecture Decisions

## ADR-P1-001: Extend P0 Vertical, do not replace

**Decision:** Keep `edge_verticals` and P0 status machine; add DEPRECATED/RETIRED/ARCHIVED.  
**Rationale:** Avoid breaking P0 APIs and memberships.  
**Rejected:** Parallel `edge_vertical_governance` table.

## ADR-P1-002: Product Catalog inside Edge module

**Decision:** New domain packages under `src/modules/edge/`, not a separate Nest app.  
**Rationale:** Same Control Plane, same Edge IAM, modular monolith.

## ADR-P1-003: Separate technical vs commercial vs entitlement

**Decision:** Distinct columns/enums; no automatic promotion VALIDATED→AVAILABLE.  
**Rejected:** Single `status` field for all dimensions.

## ADR-P1-004: Published version immutability

**Decision:** Domain refuses mutating contractual fields of PUBLISHED versions; create new version instead.  
**Storage:** Row remains; updates blocked in use-case.

## ADR-P1-005: No tenant DB / no runtime routing

**Decision:** Backend registry + bindings are governance metadata only.  
**Rejected:** Edge querying tenant databases.

## ADR-P1-006: Permission code style

**Decision:** Continue `resource:action` style of 073 (`platform:products:read`), not dotted `edge.products.read`.  
**Rationale:** Consistency with existing EdgePermissionGuard catalog.

## ADR-P1-007: P0-H independence

**Decision:** P1 ships without claiming P0 staging Go. Document dependency explicitly.
