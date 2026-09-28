# Tenant lifecycle & multi-tenant security — re-audit

**Date:** 2026-09-03  
**Scope:** Backend only (no frontend)  
**Baseline:** prior post-remediation score ~88 → interim ~92 → **this pass 95/100**

---

## Verdict

**Enterprise Candidate / production-ready headless backend** for shared-cluster DB-per-tenant + shared Keycloak realm (Organizations).

| Dimension | Verdict |
|-----------|---------|
| Backend API headless | **Production-ready** (ops checklist below) |
| SaaS product UI | Out of scope (explicitly deferred) |
| 10k+ tenants at scale | Needs load validation + Vault prod auth |

**Score: 95 / 100**

---

## What landed in this wave

| Area | Status |
|------|--------|
| Per-tenant DB passwords (`secret:` / `vault:`) | Done |
| `VaultSecretProvider` + compose `vault` (dev) | Done |
| `secret_store` migration 033 + AES-GCM env provider | Done |
| Provision: unique password, update `database_credentials_ref` | Done |
| Cluster admin vs app-role password split | Done |
| Hard deprovision deletes Vault/`secret_store` secret | Done |
| B2C Host ↔ JWT tenant binding (`TenantHostGuard`) | Done |
| Domain verify = token **+** DNS TXT lookup | Done |
| Provision owner → real Keycloak org ID | Done |
| `SECRET_ENCRYPTION_KEY` required in prod for env/local | Done |
| Quotas, ModuleGuard, CP audit, pool math, introspection defaults | Done (prior wave) |

---

## Remaining (non-blocking)

| Priority | Item |
|----------|------|
| P1 | Vault production auth (AppRole / K8s), not static root token / `vault -dev` |
| P2 | Rabbit consumer DLQ metric (outbox path already counted) |
| P2 | Capabilities API: expose `maxCustomers` / `maxProducts` |
| P2 | ACME / TLS cert automation for custom domains (ops/edge) |
| P2 | Platform-admin audit insert fail-closed vs best-effort |
| — | Frontend OIDC + capabilities UI (excluded by request) |

---

## Validation run

| Suite | Result |
|-------|--------|
| `tsc --noEmit` | Pass |
| Security tests | 52/52 |
| Host guard + secret provider unit | Pass |

---

## Ops checklist (go-live)

1. `SECRET_PROVIDER=vault` + non-dev Vault + short-lived token; or `SECRET_ENCRYPTION_KEY` with `env`.
2. Align `POSTGRES_MAX_CONNECTIONS` with real Postgres `max_connections`.
3. `TRUST_X_FORWARDED_HOST=true` only behind a proxy that overwrites `X-Forwarded-Host`.
4. Migrate control plane through `033_secret_store`.
5. Smoke: provision → `database_credentials_ref` is `vault:…` or `secret:…` → ACTIVE login as tenant role.
6. Custom domain: TXT at `_platform-verify.{hostname}` then `verify/check`.
7. Confirm owner appears in Keycloak Organization after provision with `ownerIdentityId`.
