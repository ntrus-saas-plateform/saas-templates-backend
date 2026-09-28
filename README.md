# Platform Core Backend

Enterprise-grade multi-tenant SaaS platform core built with NestJS, PostgreSQL (DB-per-tenant), Keycloak, RabbitMQ, and Redis.

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment configuration
cp .env.example .env

# Start infrastructure (PostgreSQL, Redis, RabbitMQ, Keycloak)
docker compose up -d postgres redis rabbitmq

# Run control plane migrations
pnpm migrate:control

# Start development server
pnpm start:dev
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /liveness` | Liveness probe |
| `GET /readiness` | Readiness probe (DB, Redis, RabbitMQ) |
| `GET /health` | Health summary |
| `GET /metrics` | Prometheus metrics |
| `GET /api/v1/platform/context` | Current tenant/org context |
| `GET /api/v1/platform/organizations` | List user organizations |
| `POST /api/v1/platform/organizations/switch` | Switch active organization |
| `GET /api/docs` | OpenAPI documentation |

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

## Testing

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:architecture
pnpm test:integration
pnpm test:e2e
pnpm build
```

## Multi-Tenancy

- **Tenant** = absolute data isolation boundary (separate PostgreSQL database per tenant)
- **Organization** = branch/establishment within a tenant (Keycloak Organizations)
- Tenant ID is resolved from JWT claims, never from headers/parameters alone

See [MULTI-TENANCY.md](./MULTI-TENANCY.md) for details.

## Observability

- **Logs**: Pino structured JSON (`LoggerService`)
- **Metrics**: Prometheus via `@prometheus-io/client` → `GET /metrics`
- **Tracing**: OpenTelemetry auto-instrumentation (`src/instrumentation.ts`)
- **Health**: `/liveness`, `/readiness`, `/health`

See [OBSERVABILITY.md](./OBSERVABILITY.md) for details.

## Keycloak Setup

```bash
docker compose up -d keycloak
pnpm keycloak:import   # or auto-import via --import-realm volume
```

Test user: `user-a` / `password` (tenant A)

See [KEYCLOAK.md](./KEYCLOAK.md) for realm configuration.
