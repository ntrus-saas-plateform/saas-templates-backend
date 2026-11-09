# P0-H.2 — OIDC / BFF Flow Audit

## Architecture (code-verified)

| Responsibility | Component |
|----------------|-----------|
| Authorization Code + PKCE initiation | Frontend Edge BFF → Keycloak `edge-admin-web` |
| Code exchange | Server-side `lib/edge-bff/keycloak.ts` |
| Access / refresh token storage | HttpOnly Edge session cookie `okapi_edge_bff_session` |
| Browser JS | Does **not** hold Edge access tokens |
| Backend API calls | BFF `/api/edge-backend/**` with Bearer from Edge session |
| Backend JWT validation | `EdgeJwtValidationService` (issuer/audience RS256) |
| Logout | Edge BFF clears session + Keycloak logout URL helper |
| Refresh | Server-side `edgeRefreshAccessToken` |

## ERP separation

| Surface | Cookie | CSRF |
|---------|--------|------|
| ERP BFF | `edge_bff_session` | `edge_csrf` |
| Edge BFF | `okapi_edge_bff_session` | `okapi_edge_csrf` |

Evidence: Playwright `e2e/edge-smoke.spec.ts` cookie independence tests **PASS**.
