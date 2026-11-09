# P1.0 — Architecture Audit

**Date:** 2026-11-09  
**Repos:** `saas-templates-backend`, `saas-template-frontend`  
**Evidence class:** VERIFIED unless noted

## Backend — Edge (P0)

| Area | Status | Path / notes |
|------|--------|--------------|
| Module | VERIFIED | `src/modules/edge/` hexagonal (domain/application/infrastructure/presentation) |
| Vertical registry | VERIFIED | Entity + lifecycle DRAFT→…→DEACTIVATED; APIs under `edge/verticals` |
| Memberships / RBAC / sessions | VERIFIED | P0 complete |
| Auth | VERIFIED | `@EdgeRoute`, Edge JWT (no `tenant_id`), workspace header |
| Latest CP migration | VERIFIED | `073_edge_foundation.sql` → next **074+** |
| Product catalog / taxonomy / capabilities / backends / readiness / publication | **ABSENT** | No Edge tables or modules |
| ERP catalog / org capabilities | NOT Edge | Do not reuse as Product Platform SoT |
| Audit | VERIFIED | `edge_audit_events` reusable |
| CP outbox | VERIFIED available | Not yet used by Edge use-cases |

## Frontend — Edge Console

| Area | Status | Notes |
|------|--------|-------|
| Route group | VERIFIED | `app/(edge-console)/edge/**` |
| BFF cookies | VERIFIED | `okapi_edge_bff_session`, `okapi_edge_csrf` |
| Pages | VERIFIED | Overview, verticals, admins, security, audit, workspace |
| Product / market / readiness UI | **ABSENT** | Greenfield under `/edge` |
| Design system | VERIFIED | Reuse `components/ui` + Edge states |

## P0-H dependency

- P0-H.1 DB qualification: **PASS**
- P0-H.2…H.8: **Pending**
- P1 may proceed on a parallel track; must not claim P0 staging-ready.

## Reuse vs extend vs create

| Asset | Decision |
|-------|----------|
| Vertical aggregate | **Extend** lifecycle + governance history; keep P0 states + add DEPRECATED/RETIRED/ARCHIVED |
| Edge RBAC / guards | **Reuse**; seed additive permissions |
| Workspace session | **Reuse** for vertical-scoped product ops |
| Product / taxonomy / capability / backend / readiness / publication | **Create** under `src/modules/edge/domain/*` |
| ERP tenant catalog | **Do not** merge |

## Risks

1. Vertical status enum expansion must remain backward-compatible with existing rows.
2. Permission naming in P1 prompt (`edge.products.*`) must map to existing `platform:` / resource style — use `platform:products:*` / `catalog:*` consistent with 073.
3. Scope creep into P2–P9 commercial domains — blocked by out-of-scope rules.
