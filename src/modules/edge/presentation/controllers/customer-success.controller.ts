import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  EdgeRoute,
  RequireEdgePermissions,
} from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgeOptionalWorkspaceGuard } from '../../../../shared/auth/edge-optional-workspace.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import {
  ComputeChurnRiskUseCase,
  ComputeCustomerHealthScoreUseCase,
  EvaluateExpansionSignalsUseCase,
  IngestAdoptionEventUseCase,
  ListAdoptionEventsUseCase,
  ListAhaMomentsUseCase,
} from '../../application/customer-success/customer-success.use-cases.js';
import type { ExpansionSignalInput } from '../../domain/customer-success/expansion-signals.js';

@ApiTags('edge-customer-success')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller('edge/cs')
export class EdgeCustomerSuccessController {
  constructor(
    private readonly listAha: ListAhaMomentsUseCase,
    private readonly health: ComputeCustomerHealthScoreUseCase,
    private readonly ingestAdoption: IngestAdoptionEventUseCase,
    private readonly listAdoption: ListAdoptionEventsUseCase,
    private readonly expansion: EvaluateExpansionSignalsUseCase,
    private readonly churn: ComputeChurnRiskUseCase,
  ) {}

  @Get('aha-moments')
  @RequireEdgePermissions('platform:onboarding:read')
  listAhaMoments(
    @Query('segment') segment?: 'RETAIL_PHARMACY' | 'WHOLESALE' | 'RESTAURANT',
  ) {
    return this.listAha.execute(segment);
  }

  @Post('health-score')
  @RequireEdgePermissions('platform:subscriptions:read_analytics')
  computeHealth(
    @Body()
    body: {
      adoptionScore?: number | null;
      ahaCompletionPct?: number | null;
      supportLoadInverseScore?: number | null;
      paymentHealthScore?: number | null;
      delinquent?: boolean;
      suspended?: boolean;
    },
  ) {
    return this.health.execute(body);
  }

  @Post('adoption-events')
  @RequireEdgePermissions('platform:onboarding:advance')
  ingestAdoptionEvent(
    @Body()
    body: {
      subscriptionId: string;
      productTenantRef?: string | null;
      eventCode: string;
      occurredAt?: string | null;
      source?: 'BB' | 'EDGE_OPS' | 'MANUAL';
      correlationId?: string | null;
      payload?: Record<string, unknown>;
    },
  ) {
    return this.ingestAdoption.execute(body);
  }

  @Get('adoption-events')
  @RequireEdgePermissions('platform:onboarding:read')
  listAdoptionEvents(
    @Query('subscriptionId') subscriptionId: string,
    @Query('segment') segment?: 'RETAIL_PHARMACY' | 'WHOLESALE' | 'RESTAURANT',
    @Query('limit') limit?: string,
  ) {
    return this.listAdoption.execute({
      subscriptionId,
      segment,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('expansion-signals')
  @RequireEdgePermissions('platform:subscriptions:read_analytics')
  evaluateExpansion(@Body() body: { signals: ExpansionSignalInput[] }) {
    return this.expansion.execute(body);
  }

  @Post('churn-risk')
  @RequireEdgePermissions('platform:subscriptions:read_analytics')
  computeChurn(
    @Body()
    body: {
      healthBand?: 'HIGH' | 'MID' | 'LOW' | 'UNKNOWN' | null;
      healthScore?: number | null;
      delinquent?: boolean | null;
      suspended?: boolean | null;
      daysToRenewal?: number | null;
      ahaCompletionPct?: number | null;
    },
  ) {
    return this.churn.execute(body);
  }
}
