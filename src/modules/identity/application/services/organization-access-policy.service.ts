import type { MembershipRepositoryPort } from '../../domain/ports/membership-repository.port.js';
import {
  assertOrganizationMembershipAccess,
  canAccessOrganizationMembershipData,
} from '../../domain/membership/organization-access.policy.js';

export class OrganizationAccessPolicyService {
  constructor(private readonly membershipRepository: MembershipRepositoryPort) {}

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
