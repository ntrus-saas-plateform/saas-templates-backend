import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserNotificationFanoutHandler } from './user-notification-fanout.handler.js';
import { createMembershipCreatedEvent } from '../../../modules/identity/domain/events/membership.events.js';

describe('UserNotificationFanoutHandler', () => {
  const notifications = {
    create: vi.fn(),
  };
  const devices = {
    listByUser: vi.fn(),
  };
  const events = {
    publish: vi.fn(),
  };
  const configuration = {
    resolve: vi.fn(),
  };
  const push = {
    isEnabled: vi.fn(),
  };
  const logger = { info: vi.fn(), debug: vi.fn() };

  let handler: UserNotificationFanoutHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    configuration.resolve.mockResolvedValue(true);
    push.isEnabled.mockReturnValue(true);
    notifications.create.mockResolvedValue({
      id: 'n1',
      userId: 'u1',
      title: 'Organization access granted',
    });
    devices.listByUser.mockResolvedValue([
      { id: 'd1', pushToken: 'tok', pushPlatform: 'fcm' },
    ]);
    handler = new UserNotificationFanoutHandler(
      notifications as never,
      devices as never,
      events as never,
      configuration as never,
      push as never,
      logger as never,
    );
  });

  it('supports membership and user lifecycle events', () => {
    expect(handler.supports('membership.created.v1')).toBe(true);
    expect(handler.supports('user.suspended.v1')).toBe(true);
    expect(handler.supports('notification.push.requested.v1')).toBe(false);
  });

  it('creates inbox item and enqueues push when enrolled', async () => {
    const event = createMembershipCreatedEvent({
      tenantId: 'tenant-1',
      organizationId: 'org-1',
      membershipId: 'm1',
      userId: 'u1',
      actorId: 'actor-1',
      correlationId: 'corr-1',
      traceId: null,
    });

    await handler.handle(event);

    expect(notifications.create).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        userId: 'u1',
        category: 'membership',
        channel: 'in_app',
      }),
    );
    expect(events.publish).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        eventType: 'notification.push.requested.v1',
        payload: expect.objectContaining({
          notificationId: 'n1',
          userId: 'u1',
        }),
      }),
    );
  });

  it('skips when in-app notifications disabled', async () => {
    configuration.resolve.mockResolvedValueOnce(false);
    const event = createMembershipCreatedEvent({
      tenantId: 'tenant-1',
      organizationId: 'org-1',
      membershipId: 'm1',
      userId: 'u1',
      actorId: 'actor-1',
      correlationId: 'corr-1',
      traceId: null,
    });

    await handler.handle(event);

    expect(notifications.create).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('does not enqueue push without enrolled devices', async () => {
    devices.listByUser.mockResolvedValueOnce([{ id: 'd1', pushToken: null }]);
    const event = createMembershipCreatedEvent({
      tenantId: 'tenant-1',
      organizationId: 'org-1',
      membershipId: 'm1',
      userId: 'u1',
      actorId: 'actor-1',
      correlationId: 'corr-1',
      traceId: null,
    });

    await handler.handle(event);

    expect(notifications.create).toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });
});
