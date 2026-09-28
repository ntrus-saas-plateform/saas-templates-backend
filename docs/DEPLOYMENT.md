# Deployment

## Environments

| Environment | Purpose |
|-------------|---------|
| development | Local dev with Docker Compose |
| test | CI/CD automated tests |
| staging | Pre-production validation |
| production | Live environment |

## Docker

```bash
# Build image
docker build -t platform-core .

# Run with infrastructure
docker compose up -d
```

## Local Development

```bash
cp .env.example .env
docker compose up -d postgres redis rabbitmq
pnpm migrate:control
pnpm seed:dev
pnpm start:dev
```

## Production Checklist

- [ ] All environment variables configured
- [ ] Secrets via secret manager (not env files)
- [ ] SSL/TLS for PostgreSQL connections
- [ ] Keycloak realm configured with Organizations
- [ ] Control plane migrations applied
- [ ] Tenant databases provisioned and migrated
- [ ] RabbitMQ exchange created
- [ ] Redis persistence configured
- [ ] Health checks configured in orchestrator
- [ ] Prometheus scraping `/metrics`
- [ ] Log aggregation configured
- [ ] Backup strategy in place

## Horizontal Scaling

Platform Core is stateless:
- Tenant context via AsyncLocalStorage (per-request)
- Shared state in PostgreSQL, Redis, RabbitMQ
- Connection pools per instance per tenant
- Outbox publisher uses `FOR UPDATE SKIP LOCKED` for safe concurrent polling

## CI/CD Pipeline

```
install → lint → typecheck → unit tests → architecture tests
→ integration tests → e2e tests → build → container build → deploy
```

See `.github/workflows/ci.yml`

## Kubernetes (Future)

- Liveness: `/liveness`
- Readiness: `/readiness`
- ConfigMaps for non-secret config
- Secrets for credentials
- HPA based on request metrics
