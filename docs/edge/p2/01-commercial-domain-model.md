# P2 — Commercial Domain Model

## Core separations

```
P1 Product (technical) ──referenced by──► P2 Commercial Item (plan / package / add-on)
P1 Technical Capability ──included via──► P2 Commercial Capability Mapping
P1 Market Segment ──────enriched by──────► P2 Segment Intelligence / Market
ICP / Persona ──────────templates only───► (real accounts stay in P4)
Price Book / Pricing ───rules only────────► (invoices/payments stay in P7)
```

## Aggregates (logical)

1. **CommercialMarket** — intelligence wrapper over vertical + geography (FK vertical)
2. **MarketResearchProject** + findings/sources — provenance required
3. **SegmentIntelligence** — enrichment of `edge_market_segments` (FK segment)
4. **IcpDefinition** (+ versions, criteria, assessments)
5. **PersonaDefinition** + **BuyingCommitteeModel**
6. **ValueProposition**
7. **SolutionPackage** (+ versions, components → P1 capabilities)
8. **CommercialPlan** (+ versions, inclusions, tier)
9. **CommercialAddon** (+ versions, eligibility)
10. **PricingModel** / **PricingUnit** / **UsageMetricDefinition**
11. **PriceBook** (+ versions, entries with NUMERIC amounts + currency)
12. **DiscountPolicy** / **ApprovalPolicy**
13. **EligibilityPolicy**
14. **OfferConfiguration** (configurator result snapshot)
15. **CommercialReadinessEvaluation**
16. **CommercialPublicationSnapshot**

## Non-negotiable invariants

- One commercial object → exactly one `product_id`
- Capability references must exist in P1 and pass availability gates
- Published plan/package/price-book versions are immutable snapshots
- Unknown market metrics stay `null` / `NEEDS_RESEARCH` — never invented
- Enterprise ≠ automatic On-Premise
