# P0-H.3 — Edge Route Permission Matrix (discovered)

Source: `src/modules/edge/presentation/controllers/*.ts`  
All routes use `@EdgeRoute` + `EdgeAuthGuard` + `EdgePermissionGuard` unless noted.

## Administrators / invitations

| Method | Path | Permission |
|--------|------|------------|
| GET | `edge/administrators/me` | `platform:administrators:read` \| `workspace:read` |
| GET | `edge/administrators` | `platform:administrators:read` |
| POST | `edge/administrators/invite` | `platform:administrators:invite` |
| GET/PATCH | `edge/administrators/:id` | read / update |
| POST | `.../suspend\|reinstate\|deactivate` | suspend / deactivate |
| POST | `edge/invitations/accept` | (public/invite flow) |

## Verticals / memberships / configuration

| Method | Path | Permission | Workspace |
|--------|------|------------|-----------|
| CRUD lifecycle | `edge/verticals/**` | `platform:verticals:*` | — |
| Memberships | `edge/verticals/:id/memberships` | `membership:*` | — |
| Configuration | `.../configuration*` | `workspace:configuration:*` | **Required** on mutate/active |

## Workspaces / security / authorization

| Domain | Permissions |
|--------|-------------|
| Workspaces | `workspace:read`, `workspace:switch`, `security:sessions:revoke` |
| Security | `security:sessions:*`, `emergency-access:*`, `delegation:*`, `audit:read` |
| Roles | `authorization:roles:*` |

## Products / catalog (P1 additive)

| Domain | Permissions |
|--------|-------------|
| Products | `platform:products:read\|create\|update\|lifecycle\|publish` |
| Taxonomy/profiles/models | `platform:taxonomy:*`, `platform:profiles:manage`, `platform:operating_models:manage` |
| Capabilities/backends/contracts | `platform:capabilities:*`, `platform:backends:*`, `platform:contracts:manage` |
| Readiness/publication | `platform:readiness:evaluate`, `platform:publication:approve` |

Optional workspace enrichment: `EdgeOptionalWorkspaceGuard` on products → vertical isolation via `assertProductVerticalAccess`.
