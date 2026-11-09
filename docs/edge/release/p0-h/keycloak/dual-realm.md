# P0-H.2 — Dual-Realm Live Evidence

**Date:** 2026-11-09  
**Keycloak:** 26.0.8 (`quay.io/keycloak/keycloak:26.0`) via `docker compose up -d postgres keycloak`

## Import

| Realm | Import log | OIDC discovery |
|-------|------------|----------------|
| `platform` | `Realm 'platform' imported` | HTTP 200 `http://localhost:8080/realms/platform` |
| `edge-admin` | `Realm 'edge-admin' imported` | HTTP 200 `http://localhost:8080/realms/edge-admin` |

Both realms available **simultaneously**.

## Clients verified (Admin API)

**platform:** `platform-api`, `platform-admin`, `platform-web`, `platform-b2c`  
**edge-admin:** `edge-admin-api` (confidential), `edge-admin-web` (public)

## Mappers

- `edge-admin-web` / `edge-admin-api`: **0** `tenant_id` mappers
- Edge audience mapper: `audience-edge-admin-api`
- Platform retains `tenant_id` attribute mappers (ERP contract)

## JWKS

- platform keys: 2  
- edge-admin keys: 2  
- **No shared kid** across realms

## Persistence

`docker restart saas-templates-backend-keycloak-1` → both OIDC endpoints 200; clients still present → **PASS**
