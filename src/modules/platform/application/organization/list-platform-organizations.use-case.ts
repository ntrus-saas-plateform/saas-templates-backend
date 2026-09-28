import type { Organization } from '../../../identity/domain/organization/organization.entity.js';
import type { OrganizationRepositoryPort } from '../../../identity/domain/ports/organization-repository.port.js';
import type { ExecutionContext } from '../common/execution-context.js';
import { requireSubject } from '../common/access-control.js';
import type { PaginatedResult } from '../common/pagination.js';
import { buildPaginationMeta, normalizePageLimit } from '../common/pagination.js';

export class ListPlatformOrganizationsUseCase {
  constructor(private readonly organizationRepository: OrganizationRepositoryPort) {}

  async execute(input: {
    ctx: ExecutionContext;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<Organization>> {
    const ctx = requireSubject(input.ctx);
    const { page, limit } = normalizePageLimit(input.page, input.limit);
    const result = await this.organizationRepository.findByUserMembershipPage(
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
