import type { UseCase } from '../common/use-case.js';
import type { ExecutionContext } from '../common/execution-context.js';
import type { FeatureFlagServicePort } from '../../domain/feature-flag/feature-flag.port.js';
import type { FeatureFlagEntry } from '../../domain/feature-flag/feature-flag.port.js';
import {
  buildPaginationMeta,
  normalizePageLimit,
  type PaginatedResult,
} from '../common/pagination.js';

export class ListFeatureFlagsUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; page?: number; limit?: number },
      PaginatedResult<FeatureFlagEntry>
    >
{
  constructor(private readonly featureFlags: FeatureFlagServicePort) {}

  async execute(input: {
    ctx: ExecutionContext;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<FeatureFlagEntry>> {
    const { page, limit } = normalizePageLimit(input.page, input.limit);
    const { items, total } = await this.featureFlags.listFlagsPage(
      {
        tenantId: input.ctx.tenantId,
        organizationId: input.ctx.organizationId,
        userId: input.ctx.subjectId,
      },
      page,
      limit,
    );

    return {
      data: items,
      pagination: buildPaginationMeta(page, limit, total),
    };
  }
}
