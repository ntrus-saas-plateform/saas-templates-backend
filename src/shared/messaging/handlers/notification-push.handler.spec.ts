import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationPushHandler } from './notification-push.handler.js';
import { createNotificationPushRequestedEvent } from '../../../modules/identity/domain/events/notification.events.js';

describe('NotificationPushHandler', () => {
  const devices = {
    listByUser: vi.fn(),
    clearPush: vi.fn(),
  };
  const push = {
    isEnabled: vi.fn(),
    send: vi.fn(),
  };
  const logger = { info: vi.fn(), debug: vi.fn() };

  let handler: NotificationPushHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    push.isEnabled.mockReturnValue(true);
    devices.listByUser.mockResolvedValue([
      { id: 'd1', pushToken: 'tok-1', pushPlatform: 'fcm' },
      { id: 'd2', pushToken: 'tok-bad', pushPlatform: 'fcm' },
    ]);
    push.send.mockResolvedValue({ sent: 1, failedDeviceIds: ['d2'] });
    devices.clearPush.mockResolvedValue(null);
    handler = new NotificationPushHandler(
      devices as never,
      push as never,
      logger as never,
    );
  });

  it('supports push requested events only', () => {
    expect(handler.supports('notification.push.requested.v1')).toBe(true);
    expect(handler.supports('membership.created.v1')).toBe(false);
  });

  it('delivers and clears invalid tokens', async () => {
    const event = createNotificationPushRequestedEvent({
      tenantId: 'tenant-1',
      organizationId: null,
      actorId: null,
      correlationId: 'corr-1',
      payload: {
        notificationId: 'n1',
        userId: 'u1',
        title: 'Hello',
        body: 'World',
        href: '/settings',
        category: 'general',
      },
    });

    await handler.handle(event);

    expect(push.send).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Hello',
        targets: expect.arrayContaining([
          expect.objectContaining({ deviceId: 'd1' }),
        ]),
      }),
    );
    expect(devices.clearPush).toHaveBeenCalledWith('tenant-1', 'u1', 'd2');
  });

  it('no-ops when push delivery disabled', async () => {
    push.isEnabled.mockReturnValue(false);
    const event = createNotificationPushRequestedEvent({
      tenantId: 'tenant-1',
      correlationId: 'corr-1',
      payload: {
        notificationId: 'n1',
        userId: 'u1',
        title: 'Hello',
        body: 'World',
      },
    });

    await handler.handle(event);
    expect(push.send).not.toHaveBeenCalled();
  });
});
