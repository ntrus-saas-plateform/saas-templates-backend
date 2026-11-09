# P2 security & RBAC

Permissions seeded in migration `075` (Control Plane `edge_permissions`):

- `platform:commercial:markets:read|manage`
- `platform:commercial:icp:manage`
- `platform:commercial:personas:manage`
- `platform:commercial:value_props:manage`
- `platform:commercial:packages:read|manage`
- `platform:commercial:plans:read|manage|approve`
- `platform:commercial:addons:manage`
- `platform:commercial:catalog:read`
- `platform:pricing:read|manage`
- `platform:pricing:discounts:manage`
- `platform:commercial:readiness:evaluate`
- `platform:commercial:offers:publish`

Role bindings follow the existing Edge RBAC tables (same pattern as P1). Controllers enforce permissions with `RequireEdgePermissions` — never UI-only.

Product ownership checks prevent cross-vertical / cross-product commercial composition even when the caller holds global commercial manage.
