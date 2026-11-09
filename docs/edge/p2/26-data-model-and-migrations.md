# P2 data model & migrations

## Migration
- File: `migrations/control-plane/075_edge_commercial_foundation.sql`
- Additive only; does not rewrite 073/074.
- All tables live on Control Plane PostgreSQL (never tenant DBs).

## Core tables (Increment 1)
- `edge_commercial_markets`, `edge_market_research_projects`, `edge_market_research_sources`
- `edge_segment_intelligence` (enriches P1 `edge_market_segments`)
- `edge_icp_definitions`, `edge_icp_segment_links`
- `edge_persona_definitions`, `edge_value_propositions`
- `edge_solution_packages`, `edge_solution_package_capabilities`
- `edge_commercial_plans`, `edge_commercial_plan_capabilities`
- `edge_commercial_addons`, `edge_commercial_addon_capabilities`, `edge_commercial_addon_plan_links`
- `edge_pricing_units`, `edge_pricing_models`, `edge_price_books`, `edge_price_book_entries`
- `edge_discount_policies`
- `edge_commercial_readiness_profiles`, `edge_commercial_readiness_evaluations`
- `edge_commercial_publication_snapshots`

## Integrity rules enforced in SQL
- Product FKs to `edge_products`
- Capability FKs to `edge_technical_capabilities`
- Vertical FKs to `edge_verticals`
- Plan tier / inclusion / readiness result check constraints
- Price entry `amount >= 0` with `NUMERIC(19,6)`
- Currency `CHAR(3)` on price books

## Application-layer integrity
- Cross-product associations rejected (`assertSameProductOwnership`)
- Capability inclusion gated on P1 technical status / commercial availability
- Publication gated on commercial readiness

## Seeds
- Default readiness profile `DEFAULT_COMMERCIAL` (rules only)
- RBAC permission codes under `platform:commercial:*` and `platform:pricing:*`
- **No** invented prices, TAM/SAM/SOM, or geographic tariffs
