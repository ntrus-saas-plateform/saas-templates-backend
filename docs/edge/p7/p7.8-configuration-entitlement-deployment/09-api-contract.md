# P7.8 — API Contract

Base (Nest): `EdgeConfigurationController` under `@EdgeRoute()`.  
BFF / frontend prefix: `/api/edge-backend/configuration/...` and `/api/edge-backend/entitlements/...`.

## Schemas

| Method | Path | Permission |
|--------|------|------------|
| GET | `/edge/configuration/schemas` | read |
| GET | `/edge/configuration/schemas/:id` | read |
| POST | `/edge/configuration/schemas` | manage |

Body (create): `code`, `name`, optional `description`/`productId`/`schemaVersion`/`metadata`, required `jsonSchema`.

## Templates

| Method | Path | Permission |
|--------|------|------------|
| GET | `/edge/configuration/templates` | read |
| GET | `/edge/configuration/templates/:id` | read |
| POST | `/edge/configuration/templates` | manage |
| POST | `/edge/configuration/templates/:id/publish` | manage |

Publish body: `expectedVersion`, optional `versionNumber`.

## Bundles

| Method | Path | Permission |
|--------|------|------------|
| GET | `/edge/configuration/bundles` | read |
| GET | `/edge/configuration/bundles/:id` | read |
| POST | `/edge/configuration/bundles` | manage |
| POST | `/edge/configuration/bundles/:id/publish` | manage |

## Assignments

| Method | Path | Permission |
|--------|------|------------|
| GET | `/edge/configuration/assignments` | read |
| GET | `/edge/configuration/assignments/:id` | read → `{ assignment, runs, evidence, entitlements }` |
| POST | `/edge/configuration/assignments` | deploy |
| POST | `/edge/configuration/assignments/:id/deploy` | deploy |
| POST | `/edge/configuration/assignments/:id/rollback` | rollback |
| GET | `/edge/configuration/assignments/:id/runs` | history:read |
| GET | `/edge/configuration/assignments/:id/evidence` | history:read |

Assign body requires `tenantId`, `productId`, `provisioningRequestId`, `bundleId`, `bundleVersion`, `desiredConfig`, `grantedEntitlements`.

## Entitlements

| Method | Path | Permission |
|--------|------|------------|
| GET | `/edge/entitlements/assignments/:assignmentId` | entitlement:read |
| POST | `/edge/entitlements/assignments/:assignmentId/reconcile` | entitlement:reconcile |

## List query params

`limit` (1–200), `offset`, optional `status`, `q`, `tenantId`, `productId` (where applicable).

## Frontend client

`edgeApi` methods mirror the routes above (`listConfigurationSchemas`, `deployTenantConfiguration`, `reconcileTenantEntitlements`, …).
