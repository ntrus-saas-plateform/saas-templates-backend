# Audit & Integration Events

## Audit actions

Controller decorator `@AuditAction(action, resource)` triggers audit writer for mutations.

## Outbox pattern

Lifecycle mutations enqueue integration events in the same transaction as domain changes (tenant DB outbox).

Publisher: `OutboxEventPublisher` → RabbitMQ.

## Identity event catalog (selection)

| Event | Version | Trigger |
|-------|---------|---------|
| `platform.organization.switched.v1` | v1 | Org switch |
| `identity.organization.created.v1` | v1 | Org create |
| `identity.organization.suspended.v1` | v1 | Org suspend |
| `identity.membership.created.v1` | v1 | Membership grant |
| `identity.membership.revoked.v1` | v1 | Membership revoke |
| `identity.user.invited.v1` | v1 | Invitation create |
| `identity.user.activated.v1` | v1 | Invitation accept |

Full registry: `src/core/domain/events/event-catalog.ts`.

## Integration log

`OrganizationSwitchedHandler` and other handlers may log to `integration_event_log` for traceability.

## Reconciliation metrics

Drift detections increment `identity_reconciliation_drifts_total{drift_type=...}`.
