# Implementation Sequence — Okapi Edge Platform (P0-A … P0-H)

**Docs gate:** P0-A (this folder). Do not start application code until ADR-001…020 are accepted.  
**Locked:** 1A frontend isolation, 2A `edge-admin` realm.  
**Constraints:** all six mandatory constraints on every gate.

---

## Gate overview

| Gate | Name | Exit criteria |
|------|------|---------------|
| **P0-A** | Documentation lock | Audit, compatibility matrix, ADRs 001–020, this sequence published under `docs/edge/` |
| **P0-B** | Keycloak isolation | `edge-admin` realm + `edge-admin-api` / `edge-admin-web`; env & redirects separated from `platform` |
| **P0-C** | Control-plane schema | Migrations **073+** for Edge tables only; ERP 001–072 untouched |
| **P0-D** | Edge Nest module | `/api/v1/edge/**` authn/authz, memberships, invitations, workspace sessions |
| **P0-E** | Reconcile, cache, audit | Idempotent reconcile (no auto-grant); Redis cache non-SoT; Edge audit taxonomy |
| **P0-F** | Edge console frontend | `(edge-console)`, `okapi_edge_*`, `/api/edge-auth/*`, `/api/edge-backend/*`; no ERP chrome |
| **P0-G** | Hardening | MFA/step-up, delegation ceiling, break-glass TTL, multi-tab session rules |
| **P0-H** | Coexistence proof | Regression pack: ERP unchanged + Edge E2E; matrix in COMPATIBILITY.md green |

---

## P0-A — Documentation lock (current)

**Deliverables**

- [P0-AUDIT.md](./P0-AUDIT.md)  
- [COMPATIBILITY.md](./COMPATIBILITY.md)  
- [adr/ADR-001.md](./adr/ADR-001.md) … [ADR-020.md](./adr/ADR-020.md)  
- This file  

**Exit:** Product + security sign-off that 1A/2A and constraints are non-negotiable.

---

## P0-B — Keycloak isolation

**Depends on:** P0-A  
**Primary ADRs:** 002, 003, 012 (MFA wiring)

**Work**

1. Author `edge-admin` realm export (parallel to `docker/keycloak/platform-realm.json`).  
2. Clients: confidential SA `edge-admin-api`, public PKCE `edge-admin-web`.  
3. KC Organizations = Edge verticals; mapping stored later in CP (P0-C/D).  
4. Separate issuer, JWKS, audience, redirect URIs, secrets/env keys.  
5. Prove ERP `platform` realm boot path unchanged.

**Exit:** Realm importable in docker-compose; ERP login smoke still green.

---

## P0-C — Control-plane schema (073+)

**Depends on:** P0-A (ADR-004, 005, 009, 011, 018)  
**Primary ADRs:** 004, 005, 009, 011, 018

**Work**

1. Migrations starting at `migrations/control-plane/073_…` for Edge admins, memberships, invitations, sessions, workspace config versions, Edge audit extras as needed.  
2. No writes of Edge SoT into tenant DBs.  
3. Migration dry-run on empty + existing CP databases.

**Exit:** Schema applies cleanly; ERP CP tables byte-compatible.

---

## P0-D — Nest `edge` module + `/api/v1/edge/**`

**Depends on:** P0-B, P0-C  
**Primary ADRs:** 001, 006, 007, 008, 017

**Work**

1. Register Edge module (dirs already stubbed under `src/modules/edge/`).  
2. Edge JWT validation (issuer/audience) **without** weakening ERP `tenant_id` requirement.  
3. `vertical_workspace_context` ALS distinct from `TenantContextService`.  
4. Membership + role/permission checks; FE vertical id = selector only.  
5. Opaque workspace session create/validate/renew/rotate/revoke.  
6. Invitation accept/revoke flows on Edge tables.

**Exit:** Contract tests for Edge APIs; ERP OpenAPI paths unchanged.

---

## P0-E — Reconcile, authz cache, audit

**Depends on:** P0-D  
**Primary ADRs:** 010, 015, 019

**Work**

1. Idempotent Edge↔KC reconcile; report drift; **never auto-grant**.  
2. Redis authz cache with explicit invalidation; CP DB remains SoT.  
3. Extend audit writer usage with Edge event taxonomy.

**Exit:** Drift fixtures + cache invalidation tests; audit events queryable.

---

## P0-F — Frontend Edge console

**Depends on:** P0-D (API), P0-B (client)  
**Primary ADRs:** 016, 007, 020 (partial)

**Work**

1. Add `app/(edge-console)/**` with no Org Switcher / ERP shell chrome.  
2. Cookies `okapi_edge_*` with dedicated session secret.  
3. Routes `/api/edge-auth/*` and `/api/edge-backend/*`.  
4. Ensure `(shell)` and `edge_bff_session` paths untouched.

**Exit:** Manual dual-session demo; cookie names verified in browser.

---

## P0-G — Hardening

**Depends on:** P0-E, P0-F  
**Primary ADRs:** 012, 013, 014, 008, 020

**Work**

1. MFA in Keycloak + Edge policy + step-up on sensitive actions.  
2. Delegation with bounded ceiling.  
3. Break-glass temporary only; auto-expire; revoke sessions on suspend.  
4. Multi-tab: shared workspace cookie; switch rotates; stale tab 401/409.

**Exit:** Security checklist signed; abuse cases covered by tests.

---

## P0-H — Coexistence proof

**Depends on:** P0-G  
**Primary docs:** COMPATIBILITY.md

**Work**

1. Automated ERP regression (auth, org switch, invitations, platform-admin).  
2. Edge E2E happy path + negative cross-token tests.  
3. Dual logout / dual cookie jar tests.  
4. Migration replay + checksum documentation for 001–072.

**Exit:** P0 complete; Edge Admin eligible for product P1 features.

---

## Dependency graph (text)

```
P0-A
  ├─► P0-B ──────────────┐
  └─► P0-C ──► P0-D ─────┼─► P0-E ─┐
                         └─► P0-F ─┴─► P0-G ─► P0-H
```

---

## Non-goals inside P0

- Building ERP vertical product UIs inside Edge console  
- Migrating ERP tenants into Edge verticals  
- Replacing `platform-admin` with Edge operators  
- Changing `edge_bff_session` cookie name or ERP JWT claim requirements
