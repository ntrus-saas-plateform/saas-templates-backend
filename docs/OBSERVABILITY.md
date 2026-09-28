# Observability

## Tracing (OpenTelemetry)

Auto-instrumentation enabled by default (`OTEL_ENABLED=true`).

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

- `src/instrumentation.ts` — loaded before app bootstrap in production
- `TracingService` — manual spans enriched with tenant/org/user context
- Auto-instruments: HTTP, PostgreSQL, Redis, RabbitMQ

## Logging (Pino)

Structured JSON logs with automatic context enrichment:

```json
{
  "level": "info",
  "service": "platform-core",
  "tenantId": "...",
  "organizationId": "...",
  "requestId": "...",
  "correlationId": "...",
  "msg": "..."
}
```

Configuration: `LOG_LEVEL` (fatal/error/warn/info/debug/trace)

## Metrics (Prometheus)

Endpoint: `GET /metrics`

Uses `@prometheus-io/client` (successor to deprecated `prom-client`).

| Metric | Type | Labels |
|--------|------|--------|
| `http_request_count` | Counter | method, route, status |
| `http_request_latency_seconds` | Histogram | method, route |
| `outbox_pending_total` | Counter | — |
| `outbox_failed_total` | Counter | — |
| `database_pool_usage_total` | Counter | tenant_id |
| `identity_login_failures_total` | Counter | reason |
| `identity_permission_denied_total` | Counter | — |
| `identity_cross_tenant_attempts_total` | Counter | — |
| `identity_invitation_failures_total` | Counter | reason |
| `identity_membership_changes_total` | Counter | operation |
| `identity_reconciliation_drifts_total` | Counter | drift_type |
| Default Node.js metrics | — | — |

## Health Checks

| Endpoint | Purpose |
|----------|---------|
| `GET /liveness` | Process alive |
| `GET /readiness` | Dependencies ready (DB, Redis, RabbitMQ) |
| `GET /health` | Summary with service info |

## Tracing

Request context propagation:
- `X-Request-Id` — unique per request
- `X-Correlation-Id` — cross-service correlation
- `X-Trace-Id` — distributed trace ID

Stored in `TenantContext` and included in logs, audit, and events.

## Graceful Shutdown

On SIGTERM/SIGINT:
1. Stop accepting requests
2. Complete active requests
3. Stop outbox publisher
4. Close database pools
5. Close Redis connection
6. Close RabbitMQ connection
7. Exit

## Dashboards (Recommended)

- Request rate and latency (Grafana + Prometheus)
- Error rate by endpoint
- Outbox pending/failed counts
- Database pool usage per tenant
- Tenant health check latencies
