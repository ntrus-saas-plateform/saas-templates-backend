import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuditAction, RequirePermissions } from '../../../../shared/auth/decorators.js';
import { TenantContextService } from '../../../../shared/tenancy/tenant-context.service.js';
import { SwaggerTags } from '../../../../shared/swagger/swagger.constants.js';
import { ApiOkDataResponse, ApiCreatedDataResponse, ApiJsonBody } from '../../../../shared/swagger/api-decorators.js';
import { PaginationQueryDto } from '../../../../shared/validation/query.dto.js';
import { toExecutionContext } from '../execution-context.mapper.js';
import {
  RunReconciliationUseCase,
  GetReconciliationReportUseCase,
  ListReconciliationReportsUseCase,
} from '../../application/reconciliation/reconciliation.use-cases.js';
import { RunReconciliationDto } from '../dto/reconciliation.dto.js';
import { IdentityMetricsService } from '../../../../shared/observability/identity-metrics.service.js';
import type { ReconcileKeycloakResult } from '../../domain/reconciliation/reconciliation-report.entity.js';
import {
  ReconcileKeycloakResultResponseDto,
  ReconciliationReportRecordResponseDto,
} from '../dto/identity-response.dto.js';

function recordReconciliationDrifts(metrics: IdentityMetricsService, report: ReconcileKeycloakResult): void {
  for (const drift of report.drifts) {
    metrics.recordReconciliationDrift(drift.type);
  }
}

@ApiTags(SwaggerTags.ADMIN)
@ApiBearerAuth()
@Controller('admin/reconciliation')
export class ReconciliationController {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly runReconciliationUseCase: RunReconciliationUseCase,
    private readonly getReconciliationReportUseCase: GetReconciliationReportUseCase,
    private readonly listReconciliationReportsUseCase: ListReconciliationReportsUseCase,
    private readonly identityMetrics: IdentityMetricsService,
  ) {}

  @Post('run')
  @RequirePermissions('tenant:update')
  @AuditAction('reconciliation.run', 'admin')
  @ApiOperation({
    summary: 'Run Keycloak ↔ application reconciliation for current tenant',
    description:
      'Detects drift between Keycloak organizations and application registry. Optional repair syncs placeholder org IDs and memberships.',
  })
  @ApiJsonBody(RunReconciliationDto)
  @ApiOkDataResponse(ReconcileKeycloakResultResponseDto)
  async run(@Body() dto: RunReconciliationDto) {
    const report = await this.runReconciliationUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      repair: dto.repair ?? false,
    });
    recordReconciliationDrifts(this.identityMetrics, report);
    return { data: report };
  }

  @Get('report')
  @RequirePermissions('tenant:read')
  @ApiOperation({ summary: 'Get last reconciliation report for current tenant' })
  @ApiOkDataResponse(ReconcileKeycloakResultResponseDto)
  async getReport() {
    const report = await this.getReconciliationReportUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
    });
    return { data: report };
  }

  @Get('reports')
  @RequirePermissions('tenant:read')
  @ApiOperation({ summary: 'List reconciliation report history (paginated)' })
  @ApiOkDataResponse(ReconciliationReportRecordResponseDto, true)
  async listReports(@Query() pagination: PaginationQueryDto) {
    const result = await this.listReconciliationReportsUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      page: pagination.page,
      limit: pagination.limit,
    });
    return { data: result.data, pagination: result.pagination };
  }
}
