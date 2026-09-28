import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PgOutboxStore } from './pg-outbox.store.js';
import { PgControlPlaneOutboxStore } from './pg-control-plane-outbox.store.js';
import { PgInboxDeduplicator } from './pg-inbox.deduplicator.js';
import { OutboxPublisher } from './outbox.publisher.js';
import { RabbitMqService } from './rabbitmq.service.js';
import { RabbitMqConsumer } from './rabbitmq.consumer.js';
import { OutboxTransactionService } from './outbox-transaction.service.js';
import { ControlPlaneOutboxTransactionService } from './control-plane-outbox-transaction.service.js';
import { RoutingEventPublisher } from './routing-event-publisher.js';
import { IntegrationEventDispatcher } from './integration-event.dispatcher.js';
import { OrganizationSwitchedHandler } from './handlers/organization-switched.handler.js';
import { CustomerTimelineHandler } from './handlers/customer-timeline.handler.js';
import { UserNotificationFanoutHandler } from './handlers/user-notification-fanout.handler.js';
import { NotificationPushHandler } from './handlers/notification-push.handler.js';
import { OUTBOX_STORE_PORT } from '../../core/domain/ports/outbox.port.js';
import { CONTROL_PLANE_OUTBOX_STORE_PORT } from '../../core/domain/ports/control-plane-outbox.port.js';
import { EVENT_PUBLISHER_PORT } from '../../modules/identity/domain/ports/event-publisher.port.js';
import { INBOX_DEDUPLICATOR_PORT } from '../../core/domain/ports/inbox.port.js';
import { INTEGRATION_EVENT_HANDLERS } from '../../core/domain/ports/integration-event-handler.port.js';
import { PUSH_NOTIFICATION_PORT } from '../../modules/identity/domain/ports/push-notification.port.js';
import { CompositePushNotificationAdapter } from '../../modules/identity/infrastructure/push/composite-push.adapter.js';
import { PgIdempotencyStore } from '../idempotency/pg-idempotency.store.js';
import { IdempotencyInterceptor } from '../idempotency/idempotency.interceptor.js';
import { IDEMPOTENCY_STORE_PORT } from '../../core/domain/ports/idempotency.port.js';
import { CONTROL_PLANE_TRANSACTION_MANAGER_PORT } from '../../core/domain/ports/control-plane-transaction-manager.port.js';
import { PgControlPlaneTransactionManager } from '../database/pg-control-plane-transaction.manager.js';

@Global()
@Module({
  providers: [
    RabbitMqService,
    RabbitMqConsumer,
    OutboxPublisher,
    OutboxTransactionService,
    ControlPlaneOutboxTransactionService,
    RoutingEventPublisher,
    IntegrationEventDispatcher,
    OrganizationSwitchedHandler,
    CustomerTimelineHandler,
    UserNotificationFanoutHandler,
    NotificationPushHandler,
    CompositePushNotificationAdapter,
    { provide: PUSH_NOTIFICATION_PORT, useExisting: CompositePushNotificationAdapter },
    {
      provide: INTEGRATION_EVENT_HANDLERS,
      useFactory: (
        organizationSwitched: OrganizationSwitchedHandler,
        customerTimeline: CustomerTimelineHandler,
        userNotificationFanout: UserNotificationFanoutHandler,
        notificationPush: NotificationPushHandler,
      ) => [
        organizationSwitched,
        customerTimeline,
        userNotificationFanout,
        notificationPush,
      ],
      inject: [
        OrganizationSwitchedHandler,
        CustomerTimelineHandler,
        UserNotificationFanoutHandler,
        NotificationPushHandler,
      ],
    },
    { provide: OUTBOX_STORE_PORT, useClass: PgOutboxStore },
    { provide: CONTROL_PLANE_OUTBOX_STORE_PORT, useClass: PgControlPlaneOutboxStore },
    {
      provide: CONTROL_PLANE_TRANSACTION_MANAGER_PORT,
      useClass: PgControlPlaneTransactionManager,
    },
    { provide: EVENT_PUBLISHER_PORT, useExisting: RoutingEventPublisher },
    { provide: INBOX_DEDUPLICATOR_PORT, useClass: PgInboxDeduplicator },
    { provide: IDEMPOTENCY_STORE_PORT, useClass: PgIdempotencyStore },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
  exports: [
    OUTBOX_STORE_PORT,
    CONTROL_PLANE_OUTBOX_STORE_PORT,
    CONTROL_PLANE_TRANSACTION_MANAGER_PORT,
    INBOX_DEDUPLICATOR_PORT,
    IDEMPOTENCY_STORE_PORT,
    RabbitMqService,
    OutboxTransactionService,
    ControlPlaneOutboxTransactionService,
    RoutingEventPublisher,
    EVENT_PUBLISHER_PORT,
    IntegrationEventDispatcher,
  ],
})
export class MessagingModule {}
