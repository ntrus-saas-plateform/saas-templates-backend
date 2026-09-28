import type { UseCase } from '../common/use-case.js';
import type { ExecutionContext } from '../common/execution-context.js';
import { requireSubject } from '../common/access-control.js';
import type {
  KeycloakAccountUrls,
  KeycloakAdminPort,
  KeycloakCredential,
} from '../../domain/ports/keycloak-admin.port.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

export type MySecurityOverview = {
  enabled: boolean;
  methods: readonly string[];
  credentials: readonly KeycloakCredential[];
  urls: KeycloakAccountUrls;
  keycloakAvailable: boolean;
  /** Prefer GET /users/me/identity for full Identity surface. */
  identity?: {
    keycloakId: string;
    emailVerified: boolean;
    linkedCount: number;
  };
};

export class GetMySecurityOverviewUseCase
  implements UseCase<{ ctx: ExecutionContext; redirectUri?: string }, MySecurityOverview>
{
  constructor(private readonly keycloakAdmin: KeycloakAdminPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    redirectUri?: string;
  }): Promise<MySecurityOverview> {
    requireSubject(input.ctx);
    const urls = await this.keycloakAdmin.getAccountUrls(input.redirectUri);
    if (!(await this.keycloakAdmin.isAvailable())) {
      return {
        enabled: false,
        methods: [],
        credentials: [],
        urls,
        keycloakAvailable: false,
      };
    }
    const [status, credentials, user, federated] = await Promise.all([
      this.keycloakAdmin.getUserMfaStatus(input.ctx.subjectId!),
      this.keycloakAdmin.listUserCredentials(input.ctx.subjectId!),
      this.keycloakAdmin.getUser(input.ctx.subjectId!),
      this.keycloakAdmin.listFederatedIdentities(input.ctx.subjectId!),
    ]);
    return {
      enabled: status.enabled,
      methods: status.methods,
      credentials,
      urls,
      keycloakAvailable: true,
      identity: {
        keycloakId: input.ctx.subjectId!,
        emailVerified: user?.emailVerified ?? false,
        linkedCount: federated.length,
      },
    };
  }
}

export class DeleteMyCredentialUseCase
  implements
    UseCase<{ ctx: ExecutionContext; credentialId: string }, { deleted: true; credentialId: string }>
{
  constructor(private readonly keycloakAdmin: KeycloakAdminPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    credentialId: string;
  }): Promise<{ deleted: true; credentialId: string }> {
    const ctx = requireSubject(input.ctx);
    if (!(await this.keycloakAdmin.isAvailable())) {
      throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Keycloak admin unavailable');
    }
    const credentials = await this.keycloakAdmin.listUserCredentials(ctx.subjectId);
    if (!credentials.some((c) => c.id === input.credentialId)) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Credential not found');
    }
    await this.keycloakAdmin.deleteUserCredential(ctx.subjectId, input.credentialId);
    return { deleted: true, credentialId: input.credentialId };
  }
}
