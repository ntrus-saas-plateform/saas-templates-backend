import type { UseCase } from '../common/use-case.js';
import type { ExecutionContext } from '../common/execution-context.js';
import { requireSubject } from '../common/access-control.js';
import type {
  KeycloakAccountUrls,
  KeycloakAdminPort,
  KeycloakCredential,
  KeycloakFederatedIdentity,
  KeycloakIdentityProvider,
} from '../../domain/ports/keycloak-admin.port.js';
import type { UserPreferencesPort } from '../../../../core/domain/ports/user-preferences.port.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

export type LinkedIdentity = {
  provider: string;
  providerUserId: string;
  username: string;
  primary: boolean;
};

export type IdentityVerification = {
  emailVerified: boolean;
  mfaEnrolled: boolean;
  phoneVerified: boolean;
  phoneE164: string | null;
};

export type MyIdentityOverview = {
  keycloakId: string;
  enabled: boolean;
  email: string | null;
  username: string | null;
  verification: IdentityVerification;
  mfa: { enabled: boolean; methods: readonly string[] };
  credentials: readonly KeycloakCredential[];
  linkedIdentities: readonly LinkedIdentity[];
  urls: KeycloakAccountUrls;
  keycloakAvailable: boolean;
};

export class GetMyIdentityOverviewUseCase
  implements UseCase<{ ctx: ExecutionContext; redirectUri?: string }, MyIdentityOverview>
{
  constructor(
    private readonly keycloakAdmin: KeycloakAdminPort,
    private readonly preferences: UserPreferencesPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    redirectUri?: string;
  }): Promise<MyIdentityOverview> {
    const ctx = requireSubject(input.ctx);
    const urls = await this.keycloakAdmin.getAccountUrls(input.redirectUri);
    const userSettings = await this.preferences
      .getSettings(ctx.tenantId, ctx.subjectId)
      .catch(() => ({} as Record<string, unknown>));
    const phoneVerified = userSettings['verification.phoneVerified'] === true;
    const phoneE164 =
      typeof userSettings['verification.phoneE164'] === 'string'
        ? userSettings['verification.phoneE164']
        : null;

    if (!(await this.keycloakAdmin.isAvailable())) {
      return {
        keycloakId: ctx.subjectId,
        enabled: true,
        email: null,
        username: null,
        verification: {
          emailVerified: false,
          mfaEnrolled: false,
          phoneVerified,
          phoneE164,
        },
        mfa: { enabled: false, methods: [] },
        credentials: [],
        linkedIdentities: [],
        urls,
        keycloakAvailable: false,
      };
    }

    const [user, status, credentials, federated] = await Promise.all([
      this.keycloakAdmin.getUser(ctx.subjectId),
      this.keycloakAdmin.getUserMfaStatus(ctx.subjectId),
      this.keycloakAdmin.listUserCredentials(ctx.subjectId),
      this.keycloakAdmin.listFederatedIdentities(ctx.subjectId),
    ]);

    const hasPassword = credentials.some((c) => c.type === 'password');
    const linked: LinkedIdentity[] = [];
    if (hasPassword || federated.length === 0) {
      linked.push({
        provider: 'local',
        providerUserId: ctx.subjectId,
        username: user?.username ?? user?.email ?? ctx.subjectId,
        primary: true,
      });
    }
    for (const [index, f] of federated.entries()) {
      linked.push({
        provider: f.identityProvider,
        providerUserId: f.userId,
        username: f.userName,
        primary: !hasPassword && index === 0 && linked.length === 0,
      });
    }
    const linkedIdentities =
      linked.length > 0 && !linked.some((l) => l.primary)
        ? linked.map((l, i) => (i === 0 ? { ...l, primary: true } : l))
        : linked;

    return {
      keycloakId: ctx.subjectId,
      enabled: user?.enabled ?? true,
      email: user?.email ?? null,
      username: user?.username ?? null,
      verification: {
        emailVerified: user?.emailVerified ?? false,
        mfaEnrolled: status.enabled,
        phoneVerified,
        phoneE164,
      },
      mfa: { enabled: status.enabled, methods: status.methods },
      credentials,
      linkedIdentities,
      urls,
      keycloakAvailable: true,
    };
  }
}

export class UnlinkMyIdentityUseCase
  implements
    UseCase<{ ctx: ExecutionContext; provider: string }, { unlinked: true; provider: string }>
{
  constructor(private readonly keycloakAdmin: KeycloakAdminPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    provider: string;
  }): Promise<{ unlinked: true; provider: string }> {
    const ctx = requireSubject(input.ctx);
    const provider = input.provider.trim().toLowerCase();
    if (!provider || provider === 'local') {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Cannot unlink local identity');
    }
    if (!(await this.keycloakAdmin.isAvailable())) {
      throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Keycloak admin unavailable');
    }
    const links = await this.keycloakAdmin.listFederatedIdentities(ctx.subjectId);
    if (!links.some((l) => l.identityProvider.toLowerCase() === provider)) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Linked identity not found');
    }
    const credentials = await this.keycloakAdmin.listUserCredentials(ctx.subjectId);
    const hasPassword = credentials.some((c) => c.type === 'password');
    if (!hasPassword && links.length <= 1) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Cannot unlink the only authentication method',
      );
    }
    const alias =
      links.find((l) => l.identityProvider.toLowerCase() === provider)?.identityProvider ??
      input.provider;
    await this.keycloakAdmin.removeFederatedIdentity(ctx.subjectId, alias);
    return { unlinked: true, provider: alias };
  }
}

export class RequestMyEmailVerificationUseCase
  implements UseCase<{ ctx: ExecutionContext }, { sent: true }>
{
  constructor(private readonly keycloakAdmin: KeycloakAdminPort) {}

  async execute(input: { ctx: ExecutionContext }): Promise<{ sent: true }> {
    const ctx = requireSubject(input.ctx);
    if (!(await this.keycloakAdmin.isAvailable())) {
      throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Keycloak admin unavailable');
    }
    await this.keycloakAdmin.sendExecuteActionsEmail(ctx.subjectId, ['VERIFY_EMAIL']);
    return { sent: true };
  }
}

export class RequestMyPasswordResetUseCase
  implements UseCase<{ ctx: ExecutionContext }, { sent: true }>
{
  constructor(private readonly keycloakAdmin: KeycloakAdminPort) {}

  async execute(input: { ctx: ExecutionContext }): Promise<{ sent: true }> {
    const ctx = requireSubject(input.ctx);
    if (!(await this.keycloakAdmin.isAvailable())) {
      throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Keycloak admin unavailable');
    }
    await this.keycloakAdmin.sendExecuteActionsEmail(ctx.subjectId, ['UPDATE_PASSWORD']);
    return { sent: true };
  }
}

export class ListIdentityProvidersUseCase
  implements
    UseCase<
      { ctx: ExecutionContext },
      { data: readonly KeycloakIdentityProvider[]; keycloakAvailable: boolean }
    >
{
  constructor(private readonly keycloakAdmin: KeycloakAdminPort) {}

  async execute(_input: {
    ctx: ExecutionContext;
  }): Promise<{ data: readonly KeycloakIdentityProvider[]; keycloakAvailable: boolean }> {
    const available = await this.keycloakAdmin.isAvailable();
    if (!available) {
      return { data: [], keycloakAvailable: false };
    }
    const data = await this.keycloakAdmin.listIdentityProviders();
    return { data, keycloakAvailable: true };
  }
}
