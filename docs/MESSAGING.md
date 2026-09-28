# Messaging

## Architecture

RabbitMQ is used for asynchronous event-driven communication. Synchronous operations use REST.

```
Business Transaction → Outbox (DB) → COMMIT → OutboxPublisher → RabbitMQ → Consumers
```

## Outbox Pattern

Prevents dual-write inconsistency between database and message broker.

1. Business logic writes to DB + outbox table in same transaction
2. `OutboxPublisher` polls pending events
3. Events published to RabbitMQ exchange
4. Status updated: PUBLISHED / FAILED / DEAD_LETTER

### Outbox Event Status

| Status | Description |
|--------|-------------|
| PENDING | Awaiting publication |
| PUBLISHED | Successfully sent |
| FAILED | Retry pending |
| DEAD_LETTER | Max retries exceeded |

## Event Envelope

All events follow `IntegrationEvent<T>`:

```typescript
{
  eventId, eventType, version, occurredAt,
  tenantId, organizationId,
  correlationId, causationId, traceId,
  actor, source, payload
}
```

## Inbox / Consumer Idempotency

Consumers use `InboxDeduplicator`:
1. Check if `messageId + consumerId` already processed
2. If yes → ACK without processing
3. If no → process → record in inbox → ACK

## Configuration

```env
RABBITMQ_URL=amqp://platform:platform@localhost:5672
RABBITMQ_EXCHANGE=platform.events
RABBITMQ_CONSUMER_ENABLED=false
```

Set `RABBITMQ_CONSUMER_ENABLED=true` so `IntegrationEventDispatcher` runs handlers (customer timeline, organization switch log, **user notification fanout**, **push delivery**).

## Handlers

| Handler | Events |
|---------|--------|
| `OrganizationSwitchedHandler` | `platform.organization.switched.v1` |
| `CustomerTimelineHandler` | customer / commerce order events |
| `UserNotificationFanoutHandler` | membership.*, user lifecycle, org switch, security.policy.updated → inbox (+ optional push request) |
| `NotificationPushHandler` | `notification.push.requested.v1` → FCM / Web Push / APNs |

Control-plane outbox prefixes: `customer.*`, `membership.*`, `organization.*`, `user.*`.  
Everything else (including `notification.push.requested.v1`) uses the **tenant** outbox.

Push delivery env: `PUSH_DELIVERY_ENABLED`, `FCM_SERVER_KEY`, `VAPID_*`, `APNS_*` (see `.env.example`).

## Routing

Events published with routing key = `eventType` to a topic exchange.

## Retry Policy

- Max 5 attempts per outbox message
- Failed messages retried on next poll cycle
- Dead letter after max attempts

## Rules

- Never publish directly to RabbitMQ from business logic
- Always use outbox within transactions
- All consumers must be idempotent
- Include correlation ID for tracing
