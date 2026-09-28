import { createHash, randomBytes } from 'node:crypto';
import type { UseCase } from '../common/use-case.js';
import type { ExecutionContext } from '../common/execution-context.js';
import { requireSubject } from '../common/access-control.js';
import type { PaginatedResult } from '../common/pagination.js';
import { buildPaginationMeta, normalizePageLimit } from '../common/pagination.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { UserLoginHistoryRepositoryPort } from '../../domain/ports/user-login-history-repository.port.js';
import type { UserApiTokenRepositoryPort } from '../../domain/ports/user-api-token-repository.port.js';
import type { UserActivityRepositoryPort } from '../../domain/ports/user-activity-repository.port.js';
import type { UserDeviceRepositoryPort } from '../../domain/ports/user-device-repository.port.js';
import type { UserNotificationRepositoryPort } from '../../domain/ports/user-notification-repository.port.js';
import {
  guessBrowser,
  guessDevice,
  guessOs,
} from '../../../../shared/http/user-agent.js';
import { buildPersonalApiTokenPlaintext } from '../../../../shared/auth/pat-validation.service.js';

export class ListMyLoginHistoryUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; page?: number; limit?: number },
      PaginatedResult<
        import('../../domain/ports/user-login-history-repository.port.js').UserLoginHistoryEntry
      >
    >
{
  constructor(private readonly loginHistory: UserLoginHistoryRepositoryPort) {}

  async execute(input: { ctx: ExecutionContext; page?: number; limit?: number }) {
    const ctx = requireSubject(input.ctx);
    const { page, limit } = normalizePageLimit(input.page, input.limit);
    const result = await this.loginHistory.listByUser(
      ctx.tenantId,
      ctx.subjectId,
      page,
      limit,
    );
    return {
      data: result.items,
      pagination: buildPaginationMeta(page, limit, result.total),
    };
  }
}

export class RecordMyLoginUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        ip?: string | null;
        userAgent?: string | null;
        eventType?: string;
        success?: boolean;
        metadata?: Record<string, unknown>;
      },
      {
        entry: import('../../domain/ports/user-login-history-repository.port.js').UserLoginHistoryEntry;
        created: boolean;
      }
    >
{
  constructor(
    private readonly loginHistory: UserLoginHistoryRepositoryPort,
    private readonly notifications: UserNotificationRepositoryPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    ip?: string | null;
    userAgent?: string | null;
    eventType?: string;
    success?: boolean;
    metadata?: Record<string, unknown>;
  }) {
    const ctx = requireSubject(input.ctx);
    const ua = input.userAgent ?? null;
    const sessionId =
      ctx.tokenId ??
      (ctx.tokenIssuedAt != null
        ? `iat:${ctx.tokenIssuedAt}:${ctx.subjectId}`
        : `sub:${ctx.subjectId}:${new Date().toISOString().slice(0, 13)}`);
    const result = await this.loginHistory.record(ctx.tenantId, {
      userId: ctx.subjectId,
      eventType: input.eventType ?? 'login',
      success: input.success ?? true,
      ip: input.ip ?? null,
      userAgent: ua,
      browser: ua ? guessBrowser(ua) : null,
      os: ua ? guessOs(ua) : null,
      device: ua ? guessDevice(ua) : null,
      sessionId,
      metadata: input.metadata,
    });

    if (result.created && (input.success ?? true)) {
      await this.notifications.create(ctx.tenantId, {
        userId: ctx.subjectId,
        organizationId: ctx.organizationId,
        category: 'security',
        title: 'New sign-in',
        body: [
          ua ? guessBrowser(ua) : null,
          ua ? guessOs(ua) : null,
          input.ip,
        ]
          .filter(Boolean)
          .join(' · ') || 'A new session was recorded for your account.',
        payload: { href: '/settings/security', kind: 'login' },
      });
    }

    return result;
  }
}

export class ListMyApiTokensUseCase
  implements
    UseCase<
      { ctx: ExecutionContext },
      {
        tokens: import('../../domain/ports/user-api-token-repository.port.js').UserApiToken[];
      }
    >
{
  constructor(private readonly tokens: UserApiTokenRepositoryPort) {}

  async execute(input: { ctx: ExecutionContext }) {
    const ctx = requireSubject(input.ctx);
    const tokens = await this.tokens.listByUser(ctx.tenantId, ctx.subjectId);
    return { tokens: [...tokens] };
  }
}

export class CreateMyApiTokenUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        name: string;
        scopes?: string[];
        expiresAt?: string | null;
      },
      {
        token: import('../../domain/ports/user-api-token-repository.port.js').UserApiToken;
        plaintext: string;
      }
    >
{
  constructor(private readonly tokens: UserApiTokenRepositoryPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    name: string;
    scopes?: string[];
    expiresAt?: string | null;
  }) {
    const ctx = requireSubject(input.ctx);
    const name = input.name.trim();
    if (!name) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Token name is required');
    }
    const secret = randomBytes(24).toString('base64url');
    const plaintext = buildPersonalApiTokenPlaintext(ctx.tenantId, secret);
    const tokenHash = createHash('sha256').update(plaintext).digest('hex');
    const tokenPrefix = plaintext.slice(0, 16);
    let expiresAt: Date | null = null;
    if (input.expiresAt) {
      expiresAt = new Date(input.expiresAt);
      if (Number.isNaN(expiresAt.getTime())) {
        throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Invalid expiresAt');
      }
    }
    const token = await this.tokens.create(ctx.tenantId, {
      userId: ctx.subjectId,
      name,
      tokenPrefix,
      tokenHash,
      scopes: input.scopes ?? [],
      expiresAt,
    });
    return { token, plaintext };
  }
}

export class RevokeMyApiTokenUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; tokenId: string },
      import('../../domain/ports/user-api-token-repository.port.js').UserApiToken
    >
{
  constructor(private readonly tokens: UserApiTokenRepositoryPort) {}

  async execute(input: { ctx: ExecutionContext; tokenId: string }) {
    const ctx = requireSubject(input.ctx);
    const token = await this.tokens.revoke(
      ctx.tenantId,
      ctx.subjectId,
      input.tokenId,
    );
    if (!token) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'API token not found');
    }
    return token;
  }
}

export class ListMyActivityUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; page?: number; limit?: number },
      PaginatedResult<
        import('../../domain/ports/user-activity-repository.port.js').UserActivityEvent
      >
    >
{
  constructor(private readonly activity: UserActivityRepositoryPort) {}

  async execute(input: { ctx: ExecutionContext; page?: number; limit?: number }) {
    const ctx = requireSubject(input.ctx);
    const { page, limit } = normalizePageLimit(input.page, input.limit, 50);
    const result = await this.activity.listByUser(
      ctx.tenantId,
      ctx.subjectId,
      page,
      limit,
    );
    return {
      data: result.items,
      pagination: buildPaginationMeta(page, limit, result.total),
    };
  }
}

export class CreateMyActivityUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        title: string;
        detail?: string;
        category?: string;
        href?: string | null;
        payload?: Record<string, unknown>;
      },
      import('../../domain/ports/user-activity-repository.port.js').UserActivityEvent
    >
{
  constructor(private readonly activity: UserActivityRepositoryPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    title: string;
    detail?: string;
    category?: string;
    href?: string | null;
    payload?: Record<string, unknown>;
  }) {
    const ctx = requireSubject(input.ctx);
    return this.activity.create(ctx.tenantId, {
      userId: ctx.subjectId,
      organizationId: ctx.organizationId,
      title: input.title,
      detail: input.detail,
      category: input.category,
      href: input.href,
      payload: input.payload,
    });
  }
}

export class ClearMyActivityUseCase
  implements UseCase<{ ctx: ExecutionContext }, { deleted: number }>
{
  constructor(private readonly activity: UserActivityRepositoryPort) {}

  async execute(input: { ctx: ExecutionContext }) {
    const ctx = requireSubject(input.ctx);
    const deleted = await this.activity.clearByUser(ctx.tenantId, ctx.subjectId);
    return { deleted };
  }
}

export class EnrollMyPushDeviceUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        deviceName: string;
        pushToken: string;
        pushPlatform: string;
        platform?: string;
        ip?: string | null;
        userAgent?: string | null;
      },
      import('../../domain/ports/user-device-repository.port.js').UserDevice
    >
{
  constructor(private readonly devices: UserDeviceRepositoryPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    deviceName: string;
    pushToken: string;
    pushPlatform: string;
    platform?: string;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    const ctx = requireSubject(input.ctx);
    const ua = input.userAgent ?? null;
    return this.devices.enrollPush(ctx.tenantId, {
      userId: ctx.subjectId,
      deviceName: input.deviceName.trim() || 'Push device',
      pushToken: input.pushToken.trim(),
      pushPlatform: input.pushPlatform.trim(),
      platform: input.platform ?? null,
      browser: ua ? guessBrowser(ua) : null,
      os: ua ? guessOs(ua) : null,
      lastIp: input.ip ?? null,
    });
  }
}

export class ClearMyDevicePushUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; deviceId: string },
      import('../../domain/ports/user-device-repository.port.js').UserDevice
    >
{
  constructor(private readonly devices: UserDeviceRepositoryPort) {}

  async execute(input: { ctx: ExecutionContext; deviceId: string }) {
    const ctx = requireSubject(input.ctx);
    const device = await this.devices.clearPush(
      ctx.tenantId,
      ctx.subjectId,
      input.deviceId,
    );
    if (!device) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Device not found');
    }
    return device;
  }
}
