import type { UseCase } from '../common/use-case.js';
import type { ExecutionContext } from '../common/execution-context.js';
import { requireSubject } from '../common/access-control.js';
import type { UserPreferencesPort } from '../../../../core/domain/ports/user-preferences.port.js';
import {
  parsePersonalization,
  validatePersonalizationPatch,
} from '../../domain/user/user-personalization.js';
import type { UserNotificationRepositoryPort } from '../../domain/ports/user-notification-repository.port.js';
import type { UserDeviceRepositoryPort } from '../../domain/ports/user-device-repository.port.js';
import type { KeycloakAdminPort } from '../../domain/ports/keycloak-admin.port.js';
import type { PaginatedResult } from '../common/pagination.js';
import { buildPaginationMeta, normalizePageLimit } from '../common/pagination.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

const PERSONALIZATION_KEY = 'personalization';

export class GetMyPersonalizationUseCase
  implements UseCase<{ ctx: ExecutionContext }, Record<string, unknown>>
{
  constructor(private readonly userPreferences: UserPreferencesPort) {}

  async execute(input: { ctx: ExecutionContext }): Promise<Record<string, unknown>> {
    const ctx = requireSubject(input.ctx);
    const settings = await this.userPreferences.getSettings(ctx.tenantId, ctx.subjectId);
    return parsePersonalization(settings[PERSONALIZATION_KEY]);
  }
}

export class UpdateMyPersonalizationUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; personalization: Record<string, unknown> },
      Record<string, unknown>
    >
{
  constructor(private readonly userPreferences: UserPreferencesPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    personalization: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    const ctx = requireSubject(input.ctx);
    const current = await this.userPreferences.getSettings(ctx.tenantId, ctx.subjectId);
    const existing = parsePersonalization(current[PERSONALIZATION_KEY]);
    const patch = validatePersonalizationPatch(input.personalization);
    const merged = { ...existing, ...patch };
    await this.userPreferences.patchSettings(
      ctx.tenantId,
      ctx.subjectId,
      {
        [PERSONALIZATION_KEY]: merged,
      },
      undefined,
      ctx.organizationId,
    );
    return merged;
  }
}

export class ListMyNotificationsUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; page?: number; limit?: number; unreadOnly?: boolean },
      PaginatedResult<
        import('../../domain/ports/user-notification-repository.port.js').UserNotification
      > & { stats: { unreadCount: number } }
    >
{
  constructor(private readonly notifications: UserNotificationRepositoryPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  }) {
    const ctx = requireSubject(input.ctx);
    const { page, limit } = normalizePageLimit(input.page, input.limit);
    const result = await this.notifications.listByUser(
      ctx.tenantId,
      ctx.subjectId,
      page,
      limit,
      { unreadOnly: input.unreadOnly },
    );
    return {
      data: result.items,
      pagination: buildPaginationMeta(page, limit, result.total),
      stats: { unreadCount: result.unreadCount },
    };
  }
}

export class MarkNotificationReadUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; notificationId: string },
      import('../../domain/ports/user-notification-repository.port.js').UserNotification
    >
{
  constructor(private readonly notifications: UserNotificationRepositoryPort) {}

  async execute(input: { ctx: ExecutionContext; notificationId: string }) {
    const ctx = requireSubject(input.ctx);
    const updated = await this.notifications.markRead(
      ctx.tenantId,
      ctx.subjectId,
      input.notificationId,
    );
    if (!updated) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Notification not found');
    }
    return updated;
  }
}

export class MarkAllNotificationsReadUseCase
  implements UseCase<{ ctx: ExecutionContext }, { marked: number }>
{
  constructor(private readonly notifications: UserNotificationRepositoryPort) {}

  async execute(input: { ctx: ExecutionContext }) {
    const ctx = requireSubject(input.ctx);
    const marked = await this.notifications.markAllRead(ctx.tenantId, ctx.subjectId);
    return { marked };
  }
}

export class DeleteMyNotificationUseCase
  implements UseCase<{ ctx: ExecutionContext; notificationId: string }, { deleted: boolean }>
{
  constructor(private readonly notifications: UserNotificationRepositoryPort) {}

  async execute(input: { ctx: ExecutionContext; notificationId: string }) {
    const ctx = requireSubject(input.ctx);
    const deleted = await this.notifications.delete(
      ctx.tenantId,
      ctx.subjectId,
      input.notificationId,
    );
    if (!deleted) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Notification not found');
    }
    return { deleted: true };
  }
}

export class CreateMyNotificationUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        title: string;
        body?: string;
        category?: string;
        priority?: string;
        payload?: Record<string, unknown>;
      },
      import('../../domain/ports/user-notification-repository.port.js').UserNotification
    >
{
  /** Dev/seed helper — creates an inbox item for the current user. */
  constructor(private readonly notifications: UserNotificationRepositoryPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    title: string;
    body?: string;
    category?: string;
    priority?: string;
    payload?: Record<string, unknown>;
  }) {
    const ctx = requireSubject(input.ctx);
    return this.notifications.create(ctx.tenantId, {
      userId: ctx.subjectId,
      organizationId: ctx.organizationId,
      title: input.title,
      body: input.body,
      category: input.category,
      priority: input.priority,
      payload: input.payload,
      channel: 'in_app',
    });
  }
}

export class ListMyDevicesUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; syncSessions?: boolean },
      {
        devices: import('../../domain/ports/user-device-repository.port.js').UserDevice[];
        keycloakAvailable: boolean;
      }
    >
{
  constructor(
    private readonly devices: UserDeviceRepositoryPort,
    private readonly keycloakAdmin: KeycloakAdminPort,
  ) {}

  async execute(input: { ctx: ExecutionContext; syncSessions?: boolean }) {
    const ctx = requireSubject(input.ctx);
    let keycloakAvailable = false;
    if (input.syncSessions !== false) {
      keycloakAvailable = await this.keycloakAdmin.isAvailable();
      if (keycloakAvailable) {
        const sessions = await this.keycloakAdmin.listUserSessions(ctx.subjectId);
        for (const session of sessions) {
          const name = [session.browser, session.os].filter(Boolean).join(' / ') ||
            session.device ||
            'Unknown device';
          await this.devices.upsertFromSession(ctx.tenantId, {
            userId: ctx.subjectId,
            externalSessionId: session.id,
            deviceName: name,
            platform: session.device ?? null,
            browser: session.browser ?? null,
            os: session.os ?? null,
            lastIp: session.ipAddress || null,
            lastSeenAt: session.lastAccess
              ? new Date(session.lastAccess)
              : new Date(),
            metadata: { clients: session.clients },
          });
        }
      }
    }
    const devices = await this.devices.listByUser(ctx.tenantId, ctx.subjectId);
    return { devices: [...devices], keycloakAvailable };
  }
}

export class TrustMyDeviceUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; deviceId: string; trusted: boolean },
      import('../../domain/ports/user-device-repository.port.js').UserDevice
    >
{
  constructor(private readonly devices: UserDeviceRepositoryPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    deviceId: string;
    trusted: boolean;
  }) {
    const ctx = requireSubject(input.ctx);
    const updated = await this.devices.setTrusted(
      ctx.tenantId,
      ctx.subjectId,
      input.deviceId,
      input.trusted,
    );
    if (!updated) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Device not found');
    }
    return updated;
  }
}

export class RemoveMyDeviceUseCase
  implements UseCase<{ ctx: ExecutionContext; deviceId: string }, { deleted: boolean }>
{
  constructor(private readonly devices: UserDeviceRepositoryPort) {}

  async execute(input: { ctx: ExecutionContext; deviceId: string }) {
    const ctx = requireSubject(input.ctx);
    const deleted = await this.devices.remove(
      ctx.tenantId,
      ctx.subjectId,
      input.deviceId,
    );
    if (!deleted) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Device not found');
    }
    return { deleted: true };
  }
}
