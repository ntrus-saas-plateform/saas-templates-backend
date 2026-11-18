import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  EdgeRoute,
  RequireEdgePermissions,
} from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgeOptionalWorkspaceGuard } from '../../../../shared/auth/edge-optional-workspace.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import {
  ListPartnerOpportunitiesUseCase,
  RegisterPartnerOpportunityUseCase,
  TransitionPartnerOpportunityUseCase,
} from '../../application/partners/partner-opportunity.use-cases.js';
import type { PartnerOpportunityStatus } from '../../domain/partners/opportunity-registration.js';

@ApiTags('edge-partners')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller('edge/partners/opportunities')
export class EdgePartnerOpportunityController {
  constructor(
    private readonly registerOpp: RegisterPartnerOpportunityUseCase,
    private readonly listOpp: ListPartnerOpportunitiesUseCase,
    private readonly transitionOpp: TransitionPartnerOpportunityUseCase,
  ) {}

  @Post()
  @RequireEdgePermissions('platform:sales:opportunities:create')
  register(
    @Body()
    body: {
      partnerCode: string;
      accountName: string;
      territoryCode?: string | null;
      productSegment?: string | null;
      estimatedMrr?: number | null;
      conflictWindowDays?: number;
      notes?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.registerOpp.execute(body);
  }

  @Get()
  @RequireEdgePermissions('platform:sales:opportunities:read')
  list(
    @Query('partnerCode') partnerCode?: string,
    @Query('status') status?: PartnerOpportunityStatus,
    @Query('limit') limit?: string,
  ) {
    return this.listOpp.execute({
      partnerCode,
      status,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post(':id/transition')
  @RequireEdgePermissions('platform:sales:opportunities:update')
  transition(
    @Param('id') id: string,
    @Body() body: { status: PartnerOpportunityStatus },
  ) {
    return this.transitionOpp.execute({ id, status: body.status });
  }
}
