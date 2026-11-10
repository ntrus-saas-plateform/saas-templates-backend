# ADR-P7-002 — Product Keycloak Topology Model

**Status:** Proposed (G0)  
**Date:** 2026-11-10  
**Context:** P7.7 requires Modes A–D (realm-per-tenant, shared realm + orgs, multi-org per tenant, hybrid). Edge today stores only vertical workspace Keycloak org ids; Identity module reconciles platform orgs — neither is product topology.

## Decision

1. **Separate bounded context:** `edge_identity_topology_*` (name TBD) for **product** IAM bindings — never reuse `edge_verticals.keycloak_organization_id` as product realm/org.
2. **Explicit topology mode** per product platform / tenant binding (`REALM_PER_TENANT` | `SHARED_REALM_ORGS` | `MULTI_ORG` | `HYBRID`).
3. **Stable Edge refs** map to Keycloak technical ids; Keycloak realm name / org id are **not** business identifiers.
4. **Business Backend owns** establishment list and whether a KC org is required; P7 prepares/verifies technical bindings.
5. **Capability discovery** per Keycloak provider version (Organizations feature may be unavailable) — declare before use.

## Isolation rules (shared realm)

- Distinct org per tenant (or per establishment when required)
- Audience / issuer / client bindings verified in readiness
- Cross-tenant token acceptance is a **security incident** class in reconciliation

## Non-goals

- Managing users, groups, or BB roles from Edge
- Assuming one org ≡ one establishment without BB contract

## Gate

G7 requires Modes A–C demonstrated with isolation tests — creating a realm alone is insufficient.
