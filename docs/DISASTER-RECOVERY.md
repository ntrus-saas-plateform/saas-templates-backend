# Disaster Recovery

## Recovery Objectives

| Metric | Target | Notes |
|--------|--------|-------|
| RPO (Recovery Point Objective) | < 1 hour | Per-tenant backup frequency |
| RTO (Recovery Time Objective) | < 4 hours | Full tenant restoration |

## Backup Strategy

### Control Plane Database
- Daily full backup
- WAL archiving for point-in-time recovery
- Backup includes: tenants, organizations, outbox, audit logs

### Tenant Databases (DB-per-Tenant)
- Independent backup per tenant database
- Enables single-tenant recovery without affecting others
- Backup schedule configurable per tenant tier

### RabbitMQ
- Queue definitions exported
- Messages are transient (outbox ensures re-delivery)
- Dead letter queue monitored and replayable

### Redis
- Cache data is ephemeral (rebuild on restore)
- Idempotency keys have TTL (acceptable loss window)

## Recovery Procedures

### Single Tenant Recovery
1. Restore tenant database from backup
2. Verify tenant record in control plane
3. Run tenant migrations if needed
4. Replay pending outbox events
5. Verify health check passes

### Control Plane Recovery
1. Restore control plane database
2. Verify tenant registry integrity
3. Restart platform services
4. Verify readiness checks

### Outbox Recovery
1. Query `outbox_events WHERE status = 'PENDING'`
2. OutboxPublisher automatically retries on restart
3. Dead letter events require manual investigation

## Message Recovery

- Outbox pattern ensures at-least-once delivery
- Consumers are idempotent via inbox deduplication
- Dead letter queue for manual replay

## Monitoring

- Alert on backup failures
- Monitor outbox pending count
- Track dead letter queue depth
- Database replication lag alerts

## Business Continuity

- Multi-AZ deployment for control plane
- Tenant databases can be in different regions
- Read-only mode (`READ_ONLY` tenant status) for maintenance
