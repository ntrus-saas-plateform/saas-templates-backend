# Testing

## Test Suites

| Command | Scope |
|---------|-------|
| `pnpm test` | Unit tests (`src/**/*.spec.ts`) |
| `pnpm test:architecture` | Domain purity, layer boundaries |
| `pnpm test:integration` | Config, resilience, JWT local, Postgres (Testcontainers) |
| `pnpm test:e2e` | HTTP pipeline (mocked + real Postgres/JWT) |
| `pnpm test:load` | Concurrent idempotency (Testcontainers) |
| `pnpm test:cov` | Coverage report |

## Unit Tests

Domain logic, tenant context, sanitization, pagination utilities.

## Architecture Tests

Verify:
- Domain layer has no framework/infrastructure imports
- Presentation layer doesn't import `pg` directly
- Domain doesn't reference infrastructure directory

## Integration Tests

Configuration validation, resilience patterns (retry, circuit breaker), multi-tenant access rules, JWT/JWKS validation, RabbitMQ consumer pipeline.

## E2E Tests

### Mocked (`test/app.e2e-spec.ts`)

Full NestJS application with mocked JWT, tenant registry, and DB — fast feedback.

### Real (`test/e2e/platform-postgres.e2e-spec.ts`)

Requires Docker + `TESTCONTAINERS=true`:
- Local JWKS server (real `JwtValidationService`)
- PostgreSQL control plane + tenant DB (Testcontainers)
- Real guards, membership, organization switch, outbox, idempotency replay

### Required Multi-Tenant Scenarios

| Scenario | Expected |
|----------|----------|
| User A → Tenant A → Org A1 | OK |
| User A → Tenant A → Org A2 | OK (if member) |
| User A → Tenant B | DENIED |
| User A → Org B1 | DENIED (404) |
| Unauthenticated request | 401 |

## Test Infrastructure

```bash
# Unit + mock integration (default)
pnpm test:integration

# Real PostgreSQL / JWT / E2E / load (requires Docker)
TESTCONTAINERS=true pnpm test:integration
TESTCONTAINERS=true pnpm test:e2e
TESTCONTAINERS=true pnpm test:load
```

## Writing Tests for Business Modules

1. Domain tests: pure functions, no mocks
2. Use case tests: mock ports
3. Integration tests: real PostgreSQL / RabbitMQ via Testcontainers (`TESTCONTAINERS=true`)
4. E2E: full HTTP with test app module

## Coverage Goals

- Domain: 100% of business rules
- Guards: all access paths
- Multi-tenant: all isolation scenarios
- Outbox/Inbox: happy path + failure paths
