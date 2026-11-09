# P2 — Bounded Contexts

Implemented as cohesive packages under `src/modules/edge/domain/commercial/` and `application/commercial/` (same Edge modular monolith).

| Context | Responsibility | Depends on P1 |
|---------|----------------|---------------|
| Market Intelligence | Markets, research, segment enrichment, prioritization | verticals, segments |
| ICP & Personas | Ideal customer profiles, personas, buying committees | products, segments, profiles, operating models |
| Value & Positioning | Value propositions, messaging pillars, proof points | products, segments, ICP |
| Solution Packaging | Packages composed of P1 capabilities | products, capabilities, compatibility |
| Commercial Catalog | Plans, add-ons, catalog views | products, packages, capabilities |
| Pricing Architecture | Models, units, price books, discounts (no billing) | plans, add-ons |
| Offer Governance | Eligibility, configurator, commercial readiness, publication | all above + P1 readiness/publication |

## Module wiring

- Presentation: `/api/v1/edge/commercial/**` (+ focused resource controllers)
- Persistence: Control Plane tables `edge_commercial_*` / `edge_market_*` intelligence (migration **075**)
- Auth: additive `platform:commercial:*` / `platform:pricing:*` permissions on existing Edge RBAC
