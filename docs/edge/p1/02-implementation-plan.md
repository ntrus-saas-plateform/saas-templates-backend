# P1.0 — Implementation Plan

## Order (vertically integrated increments)

1. **074 migration + permissions** — full Control Plane schema for P1 tables + permission seeds  
2. **P1.1 Vertical governance** — extend domain transitions + history API/UI  
3. **P1.2 Products + versions** — registry, lifecycle, immutability rules  
4. **P1.3–P1.6 Taxonomy stack** — segments, profiles, operating models, compatibility  
5. **P1.8–P1.9 Capabilities** — registry, deps, mapping, evidence  
6. **P1.10–P1.12 Backends + contracts**  
7. **P1.13–P1.15 Readiness + availability + publication**  
8. **P1.16 Console** — portfolio, catalog, taxonomy, readiness, vertical products  
9. **Tests + docs P1.17–P1.23**

## Technical approach

- NestJS Edge module additive folders; no new microservice.
- APIs under `/api/v1/edge/**` only.
- Frontend under `/edge/**` only; BFF proxy unchanged.
- Do not edit `073_edge_foundation.sql`.
- Seeds idempotent (`ON CONFLICT DO NOTHING`).
- Unit tests for lifecycles + readiness + authorization denials; Testcontainers for migrations.

## Permission convention (aligned with 073)

Use stable codes such as:

- `platform:products:read|create|update|lifecycle|publish`
- `platform:taxonomy:read|manage`
- `platform:capabilities:read|manage`
- `platform:backends:read|manage`
- `platform:contracts:manage`
- `platform:readiness:evaluate`
- `platform:publication:approve`
- Vertical roles get product read/update within workspace; publish remains global or explicitly granted.
