# Security

## Zero Trust Model

All endpoints are **deny by default**. Only endpoints decorated with `@Public()` are accessible without authentication.

## Request Security Pipeline

```
Request ID → Correlation ID → JWT Auth → Tenant Guard → Organization Guard → Permission Guard → Rate Limit → Validation → Handler
```

## Authentication (Keycloak / OIDC)

- JWT validated via JWKS (`jose` library)
- Issuer, audience, expiration, and signature verified
- `tenant_id` claim required — never accepted from headers/query/body
- Roles extracted from `realm_access` and `resource_access`
- Permissions from custom `permissions` claim

## Authorization

| Guard | Responsibility |
|-------|---------------|
| `AuthGuard` | Validates Bearer token, populates TenantContext |
| `TenantGuard` | Verifies tenant exists and is accessible |
| `OrganizationGuard` | Verifies org membership when required |
| `PermissionGuard` | Checks `@RequirePermissions()` / `@RequireRoles()` |

## STRIDE Threat Model

### Spoofing
- **Threat**: Fake JWT tokens
- **Mitigation**: JWKS signature validation, issuer/audience checks

### Tampering
- **Threat**: Modified tenant_id in request
- **Mitigation**: tenant_id only from validated JWT, never from client input

### Repudiation
- **Threat**: Denied actions
- **Mitigation**: Audit logs with correlation ID, actor, timestamp

### Information Disclosure
- **Threat**: Cross-tenant data leak
- **Mitigation**: DB-per-tenant, tenant-scoped queries, cache key namespacing

### Denial of Service
- **Threat**: API abuse
- **Mitigation**: Rate limiting (`@nestjs/throttler`), payload limits, connection pool limits

### Elevation of Privilege
- **Threat**: Cross-organization access
- **Mitigation**: Organization membership verification, permission guards

## Data Protection

- Secrets via `SecretProvider` abstraction (never in code/logs/responses)
- Audit sanitization redacts passwords, tokens, credentials
- Stack traces hidden in production (`NODE_ENV=production`)
- Helmet security headers enabled
- CORS restricted to configured origins

## API Security

- DTO validation with `class-validator` (whitelist + forbidNonWhitelisted)
- Idempotency-Key for mutation deduplication
- SQL injection prevented via parameterized queries (`pg`)
- Mass assignment prevented via ValidationPipe whitelist
