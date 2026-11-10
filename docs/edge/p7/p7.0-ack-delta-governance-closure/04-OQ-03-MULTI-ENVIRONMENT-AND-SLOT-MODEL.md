# 04 — OQ-03 Multi-Environment and Slot Model

| OQ ID | OQ-03 |
| Title | Multi environment_slot per account+product — commercial offer? |
| Status | **ACCEPTED** |
| Priority | P0 BLOCKING Gate A |
| Final Decision | One PROD slot by default; extra slots only via P5 entitlements |
| Decision record | `17-OQ-TECHNICAL-DECISION-PACKAGE.md` (2026-11-10) |

## Problem

Avoid equating Product Tenant with Runtime Environment. Commercial may sell staging/DR slots.

## Final Decision — ACCEPTED (Option C + slots)

**Product Tenant** = logical isolation (Account+Product).  
**Runtime Environment / Deployment Instance / Database Binding** = technical placement.  
**Environment Slot** = commercial/technical role (PROD, STAGING, DR, TEMP_TEST) authorized by **P5 entitlements**.  
**Tenant Runtime Assignment** = versioned link tenant↔runtime(+slot).

Default commercial: **one PROD slot** per Product Tenant. Extra slots only if entitlement allows (P5). P7 never invents slot rights.

| Scenario | Model |
|----------|-------|
| Shared SaaS / dedicated DB/runtime / private / on-prem | Placement profile on assignment |
| Staging + prod | Two slots, one tenant (if entitled) |
| DR / blue-green | Assignments with roles; coexistence temporary |
| Multi-region active-active | Only if product capability + entitlement |
| Multi-establishment | BB domain — not new tenants |

## Boundaries

P5: entitlement for slots/profiles.  
P7: placement/assignment execution (after later phases).  
P7.1: **no** multi-slot execution — only ensure data model does not forbid future slots.

## Approvers

Product Owner · P5 · P7 Arch · Principal Architect

## Acceptance criteria

ERD concepts approved · default one PROD · extras entitlement-gated · tenant≠runtime≠KC org≠establishment.
