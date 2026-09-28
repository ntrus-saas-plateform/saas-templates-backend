import { Inject, Injectable } from '@nestjs/common';
import type { IntegrationEventHandler } from '../../../core/domain/ports/integration-event-handler.port.js';
import type { IntegrationEvent } from '../../../core/domain/events/integration-event.js';
import { USER_NOTIFICATION_REPOSITORY_PORT } from '../../../modules/identity/domain/ports/user-notification-repository.port.js';
import type { UserNotificationRepositoryPort } from '../../../modules/identity/domain/ports/user-notification-repository.port.js';
import { USER_DEVICE_REPOSITORY_PORT } from '../../../modules/identity/domain/ports/user-device-repository.port.js';
import type { UserDeviceRepositoryPort } from '../../../modules/identity/domain/ports/user-device-repository.port.js';
import { EVENT_PUBLISHER_PORT } from '../../../modules/identity/domain/ports/event-publisher.port.js';
import type { EventPublisherPort } from '../../../modules/identity/domain/ports/event-publisher.port.js';
import { draftFromIntegrationEvent } from '../../../modules/identity/domain/notifications/notification-copy.js';
import { createNotificationPushRequestedEvent } from '../../../modules/identity/domain/events/notification.events.js';
import { CONFIGURATION_RESOLVER_PORT } from '../../../modules/identity/domain/ports/configuration-resolver.port.js';
import type { ConfigurationResolverPort } from '../../../modules/identity/domain/ports/configuration-resolver.port.js';
import { LoggerService } from '../../logging/logger.service.js';
import { PUSH_NOTIFICATION_PORT } from '../../../modules/identity/domain/ports/push-notification.port.js';
import type { PushNotificationPort } from '../../../modules/identity/domain/ports/push-notification.port.js';

const SUPPORTED = new Set([
  'membership.created.v1',
  'membership.revoked.v1',
  'membership.roles.updated.v1',
  'user.activated.v1',
  'user.suspended.v1',
  'user.disabled.v1',
  'user.reactivated.v1',
  'platform.organization.switched.v1',
  'security.policy.updated.v1',
]);

@Injectable()
export class UserNotificationFanoutHandler implements IntegrationEventHandler {
  constructor(
    @Inject(USER_NOTIFICATION_REPOSITORY_PORT)
    private readonly notifications: UserNotificationRepositoryPort,
    @Inject(USER_DEVICE_REPOSITORY_PORT)
    private readonly devices: UserDeviceRepositoryPort,
    @Inject(EVENT_PUBLISHER_PORT)
    private readonly events: EventPublisherPort,
    @Inject(CONFIGURATION_RESOLVER_PORT)
    private readonly configuration: ConfigurationResolverPort,
    @Inject(PUSH_NOTIFICATION_PORT)
    private readonly push: PushNotificationPort,
    private readonly logger: LoggerService,
  ) {}

  supports(eventType: string): boolean {
    return SUPPORTED.has(eventType);
  }

  async handle(event: IntegrationEvent): Promise<void> {
    const draft = draftFromIntegrationEvent(event);
    if (!draft) return;

    const inAppEnabled = await this.configuration.resolve<boolean>(
      'notifications.inAppEnabled',
      { tenantId: event.tenantId, organizationId: draft.organizationId ?? null },
    );
    if (inAppEnabled === false) {
      this.logger.debug('Skipping in-app notification (disabled)', {
        eventType: event.eventType,
        tenantId: event.tenantId,
      });
      return;
    }

    const created = await this.notifications.create(event.tenantId, {
      userId: draft.userId,
      organizationId: draft.organizationId,
      category: draft.category,
      priority: draft.priority ?? 'normal',
      title: draft.title,
      body: draft.body,
      channel: 'in_app',
      payload: {
        href: draft.href ?? null,
        sourceEventId: event.eventId,
        sourceEventType: event.eventType,
      },
    });

    this.logger.info('In-app notification created from event', {
      notificationId: created.id,
      eventType: event.eventType,
      userId: draft.userId,
      tenantId: event.tenantId,
    });

    const pushEnabledSetting = await this.configuration.resolve<boolean>(
      'notifications.pushEnabled',
      { tenantId: event.tenantId, organizationId: draft.organizationId ?? null },
    );
    if (pushEnabledSetting === false || !this.push.isEnabled()) {
      return;
    }

    const deviceList = await this.devices.listByUser(event.tenantId, draft.userId);
    const enrolled = deviceList.filter((d) => d.pushToken);
    if (enrolled.length === 0) return;

    await this.events.publish(
      event.tenantId,
      createNotificationPushRequestedEvent({
        tenantId: event.tenantId,
        organizationId: draft.organizationId,
        actorId: event.actor?.id ?? null,
        correlationId: event.correlationId,
        traceId: event.traceId,
        payload: {
          notificationId: created.id,
          userId: draft.userId,
          title: draft.title,
          body: draft.body,
          href: draft.href ?? null,
          category: draft.category,
          sourceEventId: event.eventId,
        },
      }),
    );
  }
}
