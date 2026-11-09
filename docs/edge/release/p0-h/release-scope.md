# P0-H — Release Scope

## In scope (qualify)

- Migration `073_edge_foundation.sql` on empty CP DB and upgrade from schema through `072`.
- Simultaneous Keycloak realms `platform` + `edge-admin`.
- Identity / token / session / cookie / authorization isolation ERP ↔ Edge.
- Membership, global vs vertical roles, workspace session security.
- Real Edge BFF ↔ backend behavior.
- ERP non-regression on existing contracts.
- Playwright Edge end-to-end (scenarios A–G) and ERP smoke.
- Revocation, audit, observability, performance, resilience.
- Staging deployability with documented procedures and Go/No-Go.

## Out of scope (do not implement in P0-H)

- Product Catalog
- Commercial Management
- Subscription Management
- Billing & Financial Operations
- Tenant productization / full commercial provisioning
- Vertical business/domain features

## Repository split

| Repo | Primary H phases |
|------|------------------|
| `saas-templates-backend` | H.1, H.2 (JWT/realm), H.3, H.4 (API), H.6, H.7 |
| `saas-template-frontend` | H.2 (OIDC/BFF), H.4 (cookies), H.5, H.6 (UX errors), H.8 prep |
| Shared integration env | Postgres CP, dual Keycloak, Redis/RabbitMQ as required, evidence collection |

## Known P0 baseline (from delivery report)

- Backend Edge unit/architecture tests executed; typecheck green.
- Frontend unit tests green; full-repo lint has pre-existing non-Edge failures.
- Live `migrate:control`, dual-realm smoke, Playwright Edge/ERP, load baselines: **not yet evidenced** — these are P0-H deliverables.
