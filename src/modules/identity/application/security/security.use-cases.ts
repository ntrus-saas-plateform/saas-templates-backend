import type { UseCase } from '../common/use-case.js';
import type { ExecutionContext } from '../common/execution-context.js';
import type { KeycloakAdminPort } from '../../domain/ports/keycloak-admin.port.js';
import type { SettingsRepositoryPort } from '../../domain/ports/settings-repository.port.js';
import type { ConfigurationResolverPort } from '../../domain/ports/configuration-resolver.port.js';
import type { KeycloakSession } from '../../domain/ports/keycloak-admin.port.js';
import type { EventPublisherPort } from '../../domain/ports/event-publisher.port.js';
import { accessDeniedError } from '../../../../core/domain/errors/access-denied.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { TokenRevocationPort } from '../../../../core/domain/ports/token-revocation.port.js';
import type { PaginatedResult } from '../common/pagination.js';
import { buildPaginationMeta, normalizePageLimit } from '../common/pagination.js';
import { validateSettingValue } from '../../domain/configuration/setting-definition.js';
import { createSecurityPolicyUpdatedEvent } from '../../domain/events/security.events.js';

export class GetSecurityPoliciesUseCase
  implements
    UseCase<
      { ctx: ExecutionContext },
      Record<string, unknown> & { keycloakAvailable: boolean }
    >
{
  constructor(
    private readonly configurationResolver: ConfigurationResolverPort,
    private readonly keycloakAdmin: KeycloakAdminPort,
  ) {}

  async execute(input: { ctx: ExecutionContext }): Promise<
    Record<string, unknown> & { keycloakAvailable: boolean }
  > {
    const security = await this.configurationResolver.resolveNamespace('security', {
      tenantId: input.ctx.tenantId,
      organizationId: input.ctx.organizationId,
    });
    const keycloakAvailable = await this.keycloakAdmin.isAvailable();
    return { ...security, keycloakAvailable };
  }
}

export class UpdateSecurityPoliciesUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; policies: Record<string, unknown> },
      Record<string, unknown> & { keycloakAvailable: boolean }
    >
{
  constructor(
    private readonly settings: SettingsRepositoryPort,
    private readonly getPolicies: GetSecurityPoliciesUseCase,
    private readonly events: EventPublisherPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    policies: Record<string, unknown>;
  }): Promise<Record<string, unknown> & { keycloakAvailable: boolean }> {
    const updatedKeys: string[] = [];
    for (const [key, value] of Object.entries(input.policies)) {
      if (key === 'keycloakAvailable' || key === 'extra') continue;
      // Nest DTO spreads often leave optional keys as undefined — never persist those.
      if (value === undefined) continue;
      const validated = validateSettingValue(`security.${key}`, value);
      await this.settings.setTenantSetting(
        input.ctx.tenantId,
        'security',
        key,
        validated,
      );
      updatedKeys.push(key);
    }
    if (updatedKeys.length > 0 && input.ctx.subjectId) {
      await this.events.publish(
        input.ctx.tenantId,
        createSecurityPolicyUpdatedEvent(input.ctx, updatedKeys),
      );
    }
    return this.getPolicies.execute({ ctx: input.ctx });
  }
}

export class ListSessionsUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; page?: number; limit?: number },
      PaginatedResult<KeycloakSession> & { keycloakAvailable: boolean }
    >
{
  constructor(private readonly keycloakAdmin: KeycloakAdminPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<KeycloakSession> & { keycloakAvailable: boolean }> {
    if (!input.ctx.subjectId) {
      throw new DomainError(ErrorCode.UNAUTHORIZED, 'User context required');
    }
    if (!(await this.keycloakAdmin.isAvailable())) {
      const { page, limit } = normalizePageLimit(input.page, input.limit);
      return {
        data: [],
        pagination: buildPaginationMeta(page, limit, 0),
        keycloakAvailable: false,
      };
    }
    const sessions = await this.keycloakAdmin.listUserSessions(input.ctx.subjectId);
    const { page, limit } = normalizePageLimit(input.page, input.limit);
    const offset = (page - 1) * limit;
    const slice = sessions.slice(offset, offset + limit);
    return {
      data: slice,
      pagination: buildPaginationMeta(page, limit, sessions.length),
      keycloakAvailable: true,
    };
  }
}

export class RevokeSessionUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        sessionId: string;
        denylistCallerToken?: boolean;
      },
      { sessionId: string; revoked: true }
    >
{
  constructor(
    private readonly keycloakAdmin: KeycloakAdminPort,
    private readonly tokenRevocation: TokenRevocationPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    sessionId: string;
    denylistCallerToken?: boolean;
  }): Promise<{
    sessionId: string;
    revoked: true;
  }> {
    if (!(await this.keycloakAdmin.isAvailable())) {
      throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Keycloak admin unavailable');
    }
    if (!input.ctx.subjectId) {
      throw new DomainError(ErrorCode.UNAUTHORIZED, 'User context required');
    }
    const sessions = await this.keycloakAdmin.listUserSessions(input.ctx.subjectId);
    if (!sessions.some((session) => session.id === input.sessionId)) {
      throw accessDeniedError();
    }
    await this.keycloakAdmin.revokeSession(input.sessionId);
    if (input.denylistCallerToken && input.ctx.subjectId) {
      if (input.ctx.tokenId) {
        await this.tokenRevocation.revokeTokenByJti(input.ctx.tokenId);
      } else {
        await this.tokenRevocation.revokeAllTokensForSubject(input.ctx.subjectId);
      }
    }
    return { sessionId: input.sessionId, revoked: true };
  }
}

export class LogoutCurrentTokenUseCase
  implements UseCase<{ ctx: ExecutionContext }, { loggedOut: true }>
{
  constructor(private readonly tokenRevocation: TokenRevocationPort) {}

  async execute(input: { ctx: ExecutionContext }): Promise<{ loggedOut: true }> {
    if (!input.ctx.subjectId) {
      throw new DomainError(ErrorCode.UNAUTHORIZED, 'User context required');
    }
    if (input.ctx.tokenId) {
      await this.tokenRevocation.revokeTokenByJti(input.ctx.tokenId);
    } else {
      await this.tokenRevocation.revokeAllTokensForSubject(input.ctx.subjectId);
    }
    return { loggedOut: true };
  }
}

export class RevokeAllSessionsUseCase
  implements UseCase<{ ctx: ExecutionContext }, { revoked: true }>
{
  constructor(
    private readonly keycloakAdmin: KeycloakAdminPort,
    private readonly tokenRevocation: TokenRevocationPort,
  ) {}

  async execute(input: { ctx: ExecutionContext }): Promise<{ revoked: true }> {
    if (!input.ctx.subjectId) {
      throw new DomainError(ErrorCode.UNAUTHORIZED, 'User context required');
    }
    if (!(await this.keycloakAdmin.isAvailable())) {
      throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Keycloak admin unavailable');
    }
    await this.keycloakAdmin.revokeAllUserSessions(input.ctx.subjectId);
    await this.tokenRevocation.revokeAllTokensForSubject(input.ctx.subjectId);
    return { revoked: true };
  }
}

export class GetMfaStatusUseCase
  implements
    UseCase<
      { ctx: ExecutionContext },
      { enabled: boolean; methods: readonly string[]; keycloakAvailable: boolean }
    >
{
  constructor(private readonly keycloakAdmin: KeycloakAdminPort) {}

  async execute(input: { ctx: ExecutionContext }): Promise<{
    enabled: boolean;
    methods: readonly string[];
    keycloakAvailable: boolean;
  }> {
    if (!input.ctx.subjectId) {
      throw new DomainError(ErrorCode.UNAUTHORIZED, 'User context required');
    }
    if (!(await this.keycloakAdmin.isAvailable())) {
      return { enabled: false, methods: [], keycloakAvailable: false };
    }
    const status = await this.keycloakAdmin.getUserMfaStatus(input.ctx.subjectId);
    return { ...status, keycloakAvailable: true };
  }
}
