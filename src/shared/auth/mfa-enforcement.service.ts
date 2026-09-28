import { Injectable, UnauthorizedException, Inject, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_CUSTOMER_ROUTE_KEY } from './decorators.js';
import type { AuthenticatedUser } from './jwt-validation.service.js';
import { ConfigurationResolverService } from '../configuration/configuration-resolver.service.js';
import { KEYCLOAK_ADMIN_PORT } from '../../modules/identity/domain/ports/keycloak-admin.port.js';
import type { KeycloakAdminPort } from '../../modules/identity/domain/ports/keycloak-admin.port.js';
import { MEMBERSHIP_REPOSITORY_PORT } from '../../modules/identity/domain/ports/membership-repository.port.js';
import type { MembershipRepositoryPort } from '../../modules/identity/domain/ports/membership-repository.port.js';
import { hasTenantAdminRole } from '../../modules/identity/domain/membership/organization-membership.entity.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';

/**
 * Enforces tenant security.mfaPolicy against Keycloak MFA enrollment at login.
 */
@Injectable()
export class MfaEnforcementService {
  constructor(
    private readonly reflector: Reflector,
    private readonly configurationResolver: ConfigurationResolverService,
    @Inject(KEYCLOAK_ADMIN_PORT) private readonly keycloakAdmin: KeycloakAdminPort,
    @Inject(MEMBERSHIP_REPOSITORY_PORT)
    private readonly membershipRepository: MembershipRepositoryPort,
    private readonly tenantContext: TenantContextService,
  ) {}

  async assertLoginMfaCompliance(
    user: AuthenticatedUser,
    context?: ExecutionContext,
  ): Promise<void> {
    if (context) {
      const isCustomerRoute = this.reflector.getAllAndOverride<boolean>(IS_CUSTOMER_ROUTE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (isCustomerRoute) return;
    }

    const ctx = this.tenantContext.get();
    const policy = await this.configurationResolver.resolve<string>('security.mfaPolicy', {
      tenantId: user.tenantId,
      organizationId: ctx.organizationId,
    });

    if (!policy || policy === 'optional') {
      return;
    }

    if (!(await this.keycloakAdmin.isAvailable())) {
      if (policy === 'required' || policy === 'required_for_admins') {
        throw new UnauthorizedException(
          'Multi-factor authentication cannot be verified (identity admin unavailable)',
        );
      }
      return;
    }

    const mfaStatus = await this.keycloakAdmin.getUserMfaStatus(user.subjectId);

    if (policy === 'required' && !mfaStatus.enabled) {
      throw new UnauthorizedException('Multi-factor authentication is required for this tenant');
    }

    if (policy === 'required_for_admins') {
      const memberships = await this.membershipRepository.findByUser(user.tenantId, user.subjectId);
      const isTenantAdmin = memberships.some((m) => hasTenantAdminRole(m.roles));
      if (isTenantAdmin && !mfaStatus.enabled) {
        throw new UnauthorizedException(
          'Multi-factor authentication is required for tenant administrators',
        );
      }
    }
  }
}
