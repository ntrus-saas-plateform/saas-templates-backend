# Architecture

## Overview

Platform Core is a modular monolith designed to evolve into microservices without domain rewrites.

```
PLATFORM CONTROL PLANE                    DATA PLANE
┌─────────────────────────┐              ┌──────────────────┐
│  Tenant Registry        │              │  Platform Core   │
│  Organization Registry  │──────────────│  API             │
│  Outbox / Inbox         │              │  Guards          │
│  Idempotency Store      │              │  Use Cases       │
│  Audit Logs             │              └────────┬─────────┘
└─────────────────────────┘                       │
         │                              ┌─────────┴─────────┐
         ▼                              ▼                   ▼
   PostgreSQL (control)          Tenant A DB          Tenant B DB
```

## Layer Structure

```
src/
├── core/domain/          # Pure domain (no framework dependencies)
├── core/application/     # Use cases (future business modules)
├── shared/               # Cross-cutting infrastructure
│   ├── auth/             # JWT validation, guards
│   ├── tenancy/          # TenantContext (AsyncLocalStorage)
│   ├── database/         # TenantDatabaseManager, pools
│   ├── messaging/        # Outbox, RabbitMQ, Inbox
│   ├── audit/            # Audit trail
│   ├── idempotency/      # HTTP idempotency
│   ├── observability/    # Metrics, logging
│   └── configuration/    # Validated env config
└── modules/              # Presentation layer (controllers)
```

## Request Pipeline

```
HTTP Request
  → Request ID / Correlation ID
  → JWT Authentication (AuthGuard)
  → Tenant Resolution (TenantGuard)
  → Organization Resolution (OrganizationGuard)
  → Authorization (PermissionGuard)
  → Rate Limiting
  → Validation
  → Idempotency (mutations)
  → Application Logic
  → Audit (sensitive operations)
```

## Key Patterns

| Pattern | Implementation |
|---------|---------------|
| DB-per-Tenant | `TenantDatabaseManager` with connection pool cache |
| Outbox | `PgOutboxStore` + `OutboxPublisher` → RabbitMQ |
| Inbox | `PgInboxDeduplicator` for consumer idempotency |
| Idempotency | `Idempotency-Key` header with `PgIdempotencyStore` |
| Tenant Context | `AsyncLocalStorage` via `TenantContextService` |
| Transactions | `PgTransactionManager` with BEGIN/COMMIT/ROLLBACK |

## C4 Context (C1)

```
┌──────────┐     ┌──────────────┐     ┌──────────┐
│  Users   │────▶│ Platform Core│────▶│ Keycloak │
└──────────┘     └──────┬───────┘     └──────────┘
                        │
              ┌─────────┼─────────┐
              ▼         ▼         ▼
         PostgreSQL  RabbitMQ   Redis
```
