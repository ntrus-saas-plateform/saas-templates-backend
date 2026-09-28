import { Injectable, Inject } from '@nestjs/common';
import { MEMBERSHIP_REPOSITORY_PORT } from '../../modules/identity/domain/ports/membership-repository.port.js';
import type { MembershipRepositoryPort } from '../../modules/identity/domain/ports/membership-repository.port.js';
import {
  assertOrganizationMembershipAccess,
  canAccessOrganizationMembershipData,
} from '../../modules/identity/domain/membership/organization-access.policy.js';

@Injectable()
export class PolicyEvaluatorService {
  constructor(
    @Inject(MEMBERSHIP_REPOSITORY_PORT)
    private readonly membershipRepository: MembershipRepositoryPort,
  ) {}

  /**
   * ABAC-style check: subject may access organization-scoped data.
   */
  async assertOrganizationDataAccess(
    tenantId: string,
    subjectId: string,
    organizationId: string,
  ): Promise<void> {
    const memberships = await this.membershipRepository.findByUser(tenantId, subjectId);
    assertOrganizationMembershipAccess(memberships, organizationId);
  }

  async canAccessOrganizationData(
    tenantId: string,
    subjectId: string,
    organizationId: string,
  ): Promise<boolean> {
    const memberships = await this.membershipRepository.findByUser(tenantId, subjectId);
    return canAccessOrganizationMembershipData(memberships, organizationId);
  }
}
