import { Inject, Injectable } from '@nestjs/common';
import type { IntegrationEventHandler } from '../../../core/domain/ports/integration-event-handler.port.js';
import type { IntegrationEvent } from '../../../core/domain/events/integration-event.js';
import type { NotificationPushRequestedPayload } from '../../../modules/identity/domain/events/notification.events.js';
import { USER_DEVICE_REPOSITORY_PORT } from '../../../modules/identity/domain/ports/user-device-repository.port.js';
import type { UserDeviceRepositoryPort } from '../../../modules/identity/domain/ports/user-device-repository.port.js';
import { PUSH_NOTIFICATION_PORT } from '../../../modules/identity/domain/ports/push-notification.port.js';
import type { PushNotificationPort } from '../../../modules/identity/domain/ports/push-notification.port.js';
import { LoggerService } from '../../logging/logger.service.js';

@Injectable()
export class NotificationPushHandler implements IntegrationEventHandler {
  constructor(
    @Inject(USER_DEVICE_REPOSITORY_PORT)
    private readonly devices: UserDeviceRepositoryPort,
    @Inject(PUSH_NOTIFICATION_PORT)
    private readonly push: PushNotificationPort,
    private readonly logger: LoggerService,
  ) {}

  supports(eventType: string): boolean {
    return eventType === 'notification.push.requested.v1';
  }

  async handle(event: IntegrationEvent): Promise<void> {
    if (!this.push.isEnabled()) return;

    const payload = event.payload as NotificationPushRequestedPayload;
    if (!payload?.userId || !payload.title) return;

    const deviceList = await this.devices.listByUser(event.tenantId, payload.userId);
    const targets = deviceList
      .filter((d) => d.pushToken && d.pushPlatform)
      .map((d) => ({
        deviceId: d.id,
        pushToken: d.pushToken as string,
        pushPlatform: d.pushPlatform as string,
      }));

    if (targets.length === 0) return;

    const result = await this.push.send({
      title: payload.title,
      body: payload.body ?? '',
      data: {
        notificationId: payload.notificationId,
        href: payload.href ?? '',
        category: payload.category ?? 'general',
      },
      targets,
    });

    for (const deviceId of result.failedDeviceIds) {
      await this.devices.clearPush(event.tenantId, payload.userId, deviceId);
      this.logger.info('Cleared invalid push token', {
        deviceId,
        userId: payload.userId,
        tenantId: event.tenantId,
      });
    }

    this.logger.info('Push delivery completed', {
      tenantId: event.tenantId,
      userId: payload.userId,
      notificationId: payload.notificationId,
      sent: result.sent,
      cleared: result.failedDeviceIds.length,
    });
  }
}
