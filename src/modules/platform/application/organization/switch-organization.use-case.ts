import { accessDeniedError } from '../../../../core/domain/errors/access-denied.js';
import { createOrganizationSwitchedEvent } from '../../../../core/domain/events/organization-switched.event.js';
import type { OrganizationRepositoryPort } from '../../../identity/domain/ports/organization-repository.port.js';
import type { KeycloakAdminPort } from '../../../identity/domain/ports/keycloak-admin.port.js';
import type { EventPublisherPort } from '../../../identity/domain/ports/event-publisher.port.js';
import type { ExecutionContext } from '../common/execution-context.js';
import { requireSubject } from '../common/access-control.js';

import type { TokenRevocationPort } from '../../../../core/domain/ports/token-revocation.port.js';
import { TOKEN_REVOCATION_PORT } from '../../../../core/domain/ports/token-revocation.port.js';

export interface SwitchOrganizationResult {
  readonly organizationId: string;
  readonly keycloakOrganizationId: string;
  readonly organizationAlias: string;
  readonly requiresTokenRefresh: true;
  readonly tokenRefreshScope: string;
  readonly message: string;
}

export class SwitchOrganizationUseCase {
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly keycloakAdmin: KeycloakAdminPort,
    private readonly eventPublisher: EventPublisherPort,
    private readonly tokenRevocation: TokenRevocationPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    organizationId: string;
  }): Promise<SwitchOrganizationResult> {
    const ctx = requireSubject(input.ctx);

    const organization = await this.organizationRepository.findById(
      ctx.tenantId,
      input.organizationId,
    );
    if (!organization) {
      throw accessDeniedError();
    }

    const memberships = await this.organizationRepository.findByUserMembership(
      ctx.tenantId,
      ctx.subjectId,
    );
    if (!memberships.some((m) => m.id === input.organizationId)) {
      throw accessDeniedError();
    }

    await this.keycloakAdmin.setUserActiveOrganization(
      ctx.subjectId,
      organization.keycloakOrganizationId,
    );

    if (ctx.subjectId) {
      await this.tokenRevocation.revokeAllTokensForSubject(ctx.subjectId);
    }

    await this.eventPublisher.publish(
      ctx.tenantId,
      createOrganizationSwitchedEvent({
        tenantId: ctx.tenantId,
        organizationId: organization.id,
        previousOrganizationId: ctx.organizationId,
        userId: ctx.subjectId,
        correlationId: ctx.correlationId,
        traceId: ctx.traceId,
      }),
    );

    return {
      organizationId: organization.id,
      keycloakOrganizationId: organization.keycloakOrganizationId,
      organizationAlias: organization.slug,
      requiresTokenRefresh: true,
      tokenRefreshScope: `organization:${organization.slug}`,
      message:
        'Organization switch recorded in Keycloak. Refresh the access token (organization scope) to apply the new organization context.',
    };
  }
}
