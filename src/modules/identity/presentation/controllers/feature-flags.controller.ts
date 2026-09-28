import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../../../shared/auth/decorators.js';
import { TenantContextService } from '../../../../shared/tenancy/tenant-context.service.js';
import { SwaggerTags } from '../../../../shared/swagger/swagger.constants.js';
import { ApiOkDataResponse, ApiCreatedDataResponse } from '../../../../shared/swagger/api-decorators.js';
import { PaginationQueryDto } from '../../../../shared/validation/query.dto.js';
import { toExecutionContext } from '../execution-context.mapper.js';
import { ListFeatureFlagsUseCase } from '../../application/feature-flag/list-feature-flags.use-case.js';
import { FeatureFlagEntryResponseDto } from '../dto/identity-response.dto.js';

@ApiTags(SwaggerTags.PLATFORM)
@ApiBearerAuth()
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly listFeatureFlagsUseCase: ListFeatureFlagsUseCase,
  ) {}

  @Get()
  @RequirePermissions('platform:read')
  @ApiOperation({ summary: 'List resolved feature flags for current tenant context (paginated)' })
  @ApiOkDataResponse(FeatureFlagEntryResponseDto, true)
  async list(@Query() pagination: PaginationQueryDto) {
    const result = await this.listFeatureFlagsUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      page: pagination.page,
      limit: pagination.limit,
    });

    return {
      data: result.data,
      pagination: result.pagination,
    };
  }
}
