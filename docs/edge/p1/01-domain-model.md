# P1.0 — Domain Model

## Bounded contexts (logical → Edge module folders)

| Context | Aggregate roots | Notes |
|---------|-----------------|-------|
| Vertical Governance | Vertical (+ history) | Extend P0 |
| Product Catalog | Product, ProductVersion | 1 vertical : N products |
| Market Taxonomy | MarketSegment, TaxonomyVersion | Hierarchical, cycle-free |
| Business Profiles | BusinessProfileTemplate | Templates only — not CRM |
| Operating Models | OperatingModel | Shared dimensions |
| Compatibility | ProductCompatibility* | Segment/profile/model mappings |
| Technical Capabilities | TechnicalCapability, CapabilityDependency, CapabilityEvidence | Not entitlements |
| Product Capability Mapping | ProductCapabilityMapping | Per product/version |
| Backend Registry | BusinessBackend, ProductBackendBinding | No secrets in clear |
| Integration Contracts | IntegrationContract | Versioned schemas refs |
| Readiness | ReadinessProfile, ReadinessEvaluation | Snapshot history |
| Publication | PublicationSnapshot | Immutable |

## Hard invariants

1. Product → exactly one Vertical.
2. Tenant (future) → one vertical + one product — not modeled as multi-product tenant in P1.
3. Technical status ≠ commercial availability ≠ tenant entitlement.
4. Published product version technical contract fields are immutable.
5. All P1 data lives in Control Plane only.
6. Authorization: global vs vertical-scoped; backend is SoT.

## Independent status dimensions

- **Technical readiness:** NOT_IMPLEMENTED → … → VALIDATED / BLOCKED / DEPRECATED  
- **Commercial availability:** UNAVAILABLE → … → AVAILABLE / DEPRECATED  
- **Tenant entitlement:** deferred to P6 (schema may reserve enums only if needed — prefer omit)

## Vertical lifecycle (compatible extension)

Keep P0: DRAFT, CONFIGURING, READY_FOR_ACTIVATION, ACTIVE, SUSPENDED, DEACTIVATION_PENDING, DEACTIVATED.  
Add: DEPRECATED, RETIRED, ARCHIVED with explicit transitions (e.g. ACTIVE→DEPRECATED→RETIRED→ARCHIVED; DEACTIVATED→ARCHIVED).
