# P0-H.2 — Token Isolation

## Validator contracts

| Validator | Issuer | Audience | `tenant_id` |
|-----------|--------|----------|-------------|
| `JwtValidationService` (ERP) | `/realms/platform` | `platform-api` | **Required** |
| `EdgeJwtValidationService` | `/realms/edge-admin` | `edge-admin-api` | **Not required** |

## Suite executed

```text
pnpm exec vitest run src/shared/auth/edge-token-isolation.spec.ts \
  src/shared/auth/jwt-validation.service.spec.ts \
  src/shared/auth/edge-jwt-validation.service.spec.ts
```

**Result:** PASS (includes 7 isolation matrix tests + ERP/Edge claim suites)

## Matrix coverage (validator-level)

| Case | Status |
|------|--------|
| ERP requires tenant_id | PASS |
| Edge accepts without tenant_id | PASS |
| Edge verifies edge-admin issuer/audience | PASS |
| ERP verifies platform issuer/audience | PASS |
| Issuers/audiences distinct | PASS |
| Missing Edge subject rejected | PASS |

Live JWT mint + cross-endpoint HTTP rejection against Nest is **NOT_EXECUTED** (no full API boot in this run). Validator isolation + dual JWKS is evidenced.
