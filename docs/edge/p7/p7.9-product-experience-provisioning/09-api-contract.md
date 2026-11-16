# P7.9 — API Contract

Base (Nest): `EdgeExperienceController` under `@EdgeRoute()`.  
Paths below are Edge routes as implemented on the controller.

## Profiles

| Method | Path | Permission |
|--------|------|------------|
| GET | `/edge/experience/profiles` | read |
| GET | `/edge/experience/profiles/:id` | read |
| POST | `/edge/experience/profiles` | manage |
| POST | `/edge/experience/profiles/:id/publish` | manage |

Create body: `code`, `name`, optional `description` / `productId` / `compatibleRuntimeCodes` / `compatibleDeploymentProfileCodes` / `metadata`.  
Publish body: `expectedVersion`.

## Applications

| Method | Path | Permission |
|--------|------|------------|
| GET | `/edge/experience/applications` | read |
| GET | `/edge/experience/applications/:id` | read |
| POST | `/edge/experience/applications` | manage |
| POST | `/edge/experience/applications/:id/publish` | manage |

Create body includes `applicationKind`, `draftManifest`, optional version/compat/bundle/snapshot labels.  
Publish body: `expectedVersion`, optional `versionNumber`.

## Assignments

| Method | Path | Permission |
|--------|------|------------|
| GET | `/edge/experience/assignments` | read |
| GET | `/edge/experience/assignments/:id` | read → `{ assignment, runs, evidence, bindings, clients, domains }` |
| POST | `/edge/experience/assignments` | deploy |
| POST | `/edge/experience/assignments/:id/provision` | deploy |
| POST | `/edge/experience/assignments/:id/deactivate` | deploy |
| GET | `/edge/experience/assignments/:id/runs` | history:read |
| GET | `/edge/experience/assignments/:id/evidence` | history:read |
| GET | `/edge/experience/assignments/:id/domains` | read |

Assign body requires `tenantId`, `productId`, `provisioningRequestId`, `desiredManifest` (validated redirects/origins/domains/secrets).  
Provision / deactivate body: optional `idempotencyKey`, `correlationId`, `provisioningRequestId`.

## Domains

| Method | Path | Permission |
|--------|------|------------|
| POST | `/edge/experience/domains` | domains |

Body: `assignmentId`, `hostname`, optional `domainKind` (`SUBDOMAIN` \| `CUSTOM`). Creates PENDING ownership with ownership token.

## List query params

`limit` (1–200), `offset`, optional `status`, `q`, `tenantId`, `productId`, `experienceProfileId` (where applicable).
