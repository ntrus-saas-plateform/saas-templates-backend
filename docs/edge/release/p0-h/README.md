# P0-H — Release Qualification & Production Readiness

**Nature:** Qualification, security hardening, non-regression, operational validation, and staging readiness.  
**Not:** New functional development.

**Current decision (2026-11-09):** **NO-GO for staging** — see `staging/P0-H8-REPORT.md` and `acceptance-matrix.md`.

---

## Sub-phases (blocking gates)

| Phase | Focus | Status |
|-------|--------|--------|
| **H.1** | Control Plane migration `073` (+ additive `074`) | **PASS** |
| **H.2** | Dual Keycloak realms `platform` + `edge-admin` | **PASS** |
| **H.3** | Backend Edge security | **PASS** (unit) |
| **H.4** | ERP / Edge non-regression | **PASS** |
| **H.5** | Playwright E2E | **PARTIAL** (smoke only) |
| **H.6** | Operations / resilience | **PARTIAL** |
| **H.7** | Performance & load | **NOT_EXECUTED** |
| **H.8** | Staging deploy + Go/No-Go | **NO-GO** |

---

## Evidence tree

```text
docs/edge/release/p0-h/
  README.md
  acceptance-matrix.md
  database/                 ← H.1 PASS
  keycloak/                 ← H.2 PASS
  security/                 ← H.3
  non-regression/           ← H.4
  e2e/                      ← H.5
  operations/               ← H.6
  performance/              ← H.7
  staging/                  ← H.8
```

---

## Non-negotiable invariants (reconfirmed)

1. ERP JWT invalid without `tenant_id`.
2. Edge / ERP tokens non-interchangeable (distinct issuer/audience/JWKS).
3. Cookies independent: `edge_bff_session`/`edge_csrf` vs `okapi_edge_bff_session`/`okapi_edge_csrf`.
4. Workspace session never replaces administrator authentication.
5. Frontend gating is not a security control.
6. Vertical admin cannot assign global roles.
7. No implicit cross-vertical access.
