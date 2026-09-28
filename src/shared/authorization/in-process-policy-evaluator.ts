import { Injectable, Inject } from '@nestjs/common';
import type {
  AuthorizationDecision,
  PolicyEvaluationContext,
  PolicyEvaluatorPort,
} from '../../core/domain/authorization/policy-evaluation.js';
import { AuthorizationService } from './authorization.service.js';
import { MEMBERSHIP_REPOSITORY_PORT } from '../../modules/identity/domain/ports/membership-repository.port.js';
import type { MembershipRepositoryPort } from '../../modules/identity/domain/ports/membership-repository.port.js';
import {
  canAccessOrganizationMembershipData,
} from '../../modules/identity/domain/membership/organization-access.policy.js';

/**
 * Default policy evaluator — RBAC via DB-resolved permissions plus org-scoped ABAC.
 */
@Injectable()
export class InProcessPolicyEvaluator implements PolicyEvaluatorPort {
  constructor(
    private readonly authorizationService: AuthorizationService,
    @Inject(MEMBERSHIP_REPOSITORY_PORT)
    private readonly membershipRepository: MembershipRepositoryPort,
  ) {}

  async evaluate(context: PolicyEvaluationContext): Promise<AuthorizationDecision> {
    const permissionKey = `${context.resource.type}:${context.action}`;
    const altKey = context.action.includes(':') ? context.action : permissionKey;

    const hasPermission = context.permissions.includes(permissionKey) ||
      context.permissions.includes(altKey) ||
      (await this.authorizationService.hasAnyPermission([permissionKey, altKey]));

    if (!hasPermission) {
      return {
        allowed: false,
        reason: 'Insufficient permissions',
        source: 'rbac',
      };
    }

    const orgId =
      typeof context.resource.attributes?.organizationId === 'string'
        ? context.resource.attributes.organizationId
        : context.organizationId;

    if (orgId) {
      const memberships = await this.membershipRepository.findByUser(
        context.tenantId,
        context.subjectId,
      );
      if (!canAccessOrganizationMembershipData(memberships, orgId)) {
        return {
          allowed: false,
          reason: 'Organization access denied',
          source: 'abac',
        };
      }
    }

    return { allowed: true, source: 'rbac' };
  }
}
