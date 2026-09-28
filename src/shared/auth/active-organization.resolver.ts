import { Injectable, Inject } from '@nestjs/common';
import type { AuthenticatedUser } from './jwt-validation.service.js';
import { ORGANIZATION_REPOSITORY_PORT } from '../../modules/identity/domain/ports/organization-repository.port.js';
import type { OrganizationRepositoryPort } from '../../modules/identity/domain/ports/organization-repository.port.js';

/**
 * Resolves the active organization from the Keycloak JWT (post-login org picker or token refresh).
 * Maps Keycloak organization ids / aliases to application organization UUIDs and validates membership.
 */
@Injectable()
export class ActiveOrganizationResolver {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY_PORT)
    private readonly organizationRepository: OrganizationRepositoryPort,
  ) {}

  async resolve(user: AuthenticatedUser): Promise<string | null> {
    const activeRef = user.jwtActiveOrganizationRef;
    if (!activeRef) {
      return null;
    }

    const organization = await this.resolveOrganizationRef(user.tenantId, user.subjectId, activeRef);
    return organization?.id ?? null;
  }

  private async resolveOrganizationRef(
    tenantId: string,
    subjectId: string,
    organizationRef: string,
  ): Promise<{ id: string } | null> {
    const byKeycloakId = await this.organizationRepository.findByKeycloakId(tenantId, organizationRef);
    if (byKeycloakId && await this.isMember(tenantId, subjectId, byKeycloakId.id)) {
      return byKeycloakId;
    }

    const byAlias = await this.resolveByAlias(tenantId, subjectId, organizationRef);
    if (byAlias) {
      return byAlias;
    }

    const byAppId = await this.organizationRepository.findById(tenantId, organizationRef);
    if (byAppId && await this.isMember(tenantId, subjectId, byAppId.id)) {
      return byAppId;
    }

    return null;
  }

  private async resolveByAlias(
    tenantId: string,
    subjectId: string,
    alias: string,
  ): Promise<{ id: string } | null> {
    const memberships = await this.organizationRepository.findByUserMembership(tenantId, subjectId);
    const match = memberships.find((org) => org.slug === alias);
    return match ?? null;
  }

  private async isMember(
    tenantId: string,
    subjectId: string,
    organizationId: string,
  ): Promise<boolean> {
    const memberships = await this.organizationRepository.findByUserMembership(tenantId, subjectId);
    return memberships.some((m) => m.id === organizationId);
  }
}
