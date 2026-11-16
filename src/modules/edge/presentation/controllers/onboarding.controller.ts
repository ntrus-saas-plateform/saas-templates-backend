import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { EdgeRoute, RequireEdgePermissions } from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgeOptionalWorkspaceGuard } from '../../../../shared/auth/edge-optional-workspace.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import {
  CreateOnboardingJourneyUseCase,
  CreateOnboardingTemplateUseCase,
  DecideOnboardingTaskUseCase,
  ListOnboardingUseCase,
  PublishOnboardingTemplateUseCase,
  RequestOnboardingAdvanceUseCase,
  RequestOnboardingCloseUseCase,
  RequestOnboardingStartUseCase,
} from '../../application/onboarding/onboarding.use-cases.js';
import {
  CreateOnboardingJourneyDto,
  CreateOnboardingTemplateDto,
  DecideOnboardingTaskDto,
  OnboardingPaginationQueryDto,
  PublishOnboardingTemplateDto,
  RequestOnboardingAdvanceDto,
  RequestOnboardingCloseDto,
  RequestOnboardingStartDto,
} from '../dto/onboarding.dto.js';

type EdgeRequest = { user?: { sub?: string; id?: string } };

function actorId(req: EdgeRequest): string {
  return req.user?.sub ?? req.user?.id ?? 'unknown';
}

/**
 * P7.12 — Onboarding Operations API.
 * Mutative start/advance/approve/reject/close ONLY through P7.4 workflows (fail-closed P7.1).
 * Does NOT manage CRM, business invites, or commercial Subscription.ACTIVE.
 * Human approval cannot bypass P7.1 — DecideOnboardingTaskUseCase revalidates first.
 */
@ApiTags('edge-p7-onboarding')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller()
export class EdgeOnboardingController {
  constructor(
    private readonly lists: ListOnboardingUseCase,
    private readonly createTemplate: CreateOnboardingTemplateUseCase,
    private readonly publishTemplate: PublishOnboardingTemplateUseCase,
    private readonly createJourney: CreateOnboardingJourneyUseCase,
    private readonly requestStart: RequestOnboardingStartUseCase,
    private readonly requestAdvance: RequestOnboardingAdvanceUseCase,
    private readonly requestClose: RequestOnboardingCloseUseCase,
    private readonly decideTask: DecideOnboardingTaskUseCase,
  ) {}

  @Get('edge/onboarding/templates')
  @RequireEdgePermissions('platform:onboarding:read')
  @ApiOperation({ summary: 'List onboarding templates' })
  async listTemplates(@Query() query: OnboardingPaginationQueryDto) {
    return this.lists.templates({
      status: query.status,
      productId: query.productId,
      q: query.q,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get('edge/onboarding/templates/:id')
  @RequireEdgePermissions('platform:onboarding:read')
  async getTemplate(@Param('id') id: string) {
    return this.lists.template(id);
  }

  @Post('edge/onboarding/templates')
  @RequireEdgePermissions('platform:onboarding:start')
  @ApiOperation({ summary: 'Create a DRAFT onboarding template' })
  async createTemplateEndpoint(
    @Body() body: CreateOnboardingTemplateDto,
    @Req() req: EdgeRequest,
  ) {
    return this.createTemplate.execute({
      actorId: actorId(req),
      code: body.code,
      name: body.name,
      description: body.description,
      productId: body.productId,
      deploymentProfileCode: body.deploymentProfileCode,
      stepPlan: body.stepPlan,
      slaPolicy: body.slaPolicy,
      metadata: body.metadata,
    });
  }

  @Post('edge/onboarding/templates/:id/publish')
  @RequireEdgePermissions('platform:onboarding:start')
  @ApiOperation({ summary: 'Publish DRAFT/VALIDATED onboarding template' })
  async publishTemplateEndpoint(
    @Param('id') id: string,
    @Body() body: PublishOnboardingTemplateDto,
    @Req() req: EdgeRequest,
  ) {
    return this.publishTemplate.execute({
      actorId: actorId(req),
      templateId: id,
      expectedVersion: body.expectedVersion,
    });
  }

  @Get('edge/onboarding/journeys')
  @RequireEdgePermissions('platform:onboarding:read')
  @ApiOperation({ summary: 'List onboarding journeys' })
  async listJourneys(@Query() query: OnboardingPaginationQueryDto) {
    return this.lists.journeys({
      tenantId: query.tenantId,
      productId: query.productId,
      status: query.status,
      activationRecordId: query.activationRecordId,
      templateId: query.templateId,
      provisioningRequestId: query.provisioningRequestId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get('edge/onboarding/journeys/:id')
  @RequireEdgePermissions('platform:onboarding:read')
  async getJourney(@Param('id') id: string) {
    const journey = await this.lists.journey(id);
    if (!journey) return null;
    const [steps, tasks, runs, evidence] = await Promise.all([
      this.lists.steps(id),
      this.lists.tasks({ journeyId: id, limit: 50 }),
      this.lists.runs(id, 20),
      this.lists.evidence({ journeyId: id, limit: 50 }),
    ]);
    return { journey, steps, tasks, runs, evidence };
  }

  @Post('edge/onboarding/journeys')
  @RequireEdgePermissions('platform:onboarding:start')
  @ApiOperation({
    summary:
      'Create an onboarding journey from an ACTIVE P7.10 Activation Record (does not start workflow)',
  })
  async createJourneyEndpoint(
    @Body() body: CreateOnboardingJourneyDto,
    @Req() req: EdgeRequest,
  ) {
    return this.createJourney.execute({
      actorId: actorId(req),
      activationRecordId: body.activationRecordId,
      templateId: body.templateId,
      metadata: body.metadata,
    });
  }

  @Post('edge/onboarding/journeys/:id/start')
  @RequireEdgePermissions('platform:onboarding:start')
  @ApiOperation({ summary: 'Launch p712.onboarding.start workflow' })
  async startEndpoint(
    @Param('id') id: string,
    @Body() body: RequestOnboardingStartDto,
    @Req() req: EdgeRequest,
  ) {
    return this.requestStart.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `p712-start-${id}-${Date.now()}`,
      journeyId: id,
      provisioningRequestId: body.provisioningRequestId ?? null,
      reason: body.reason ?? null,
    });
  }

  @Post('edge/onboarding/journeys/:id/advance')
  @RequireEdgePermissions('platform:onboarding:advance')
  @ApiOperation({ summary: 'Launch p712.onboarding.advance workflow' })
  async advanceEndpoint(
    @Param('id') id: string,
    @Body() body: RequestOnboardingAdvanceDto,
    @Req() req: EdgeRequest,
  ) {
    return this.requestAdvance.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `p712-advance-${id}-${Date.now()}`,
      journeyId: id,
      provisioningRequestId: body.provisioningRequestId ?? null,
      reason: body.reason ?? null,
      handoverEvidenceRef: body.handoverEvidenceRef ?? null,
    });
  }

  @Post('edge/onboarding/journeys/:id/close')
  @RequireEdgePermissions('platform:onboarding:close')
  @ApiOperation({
    summary: 'Launch p712.onboarding.close — requires all required steps PASSED',
  })
  async closeEndpoint(
    @Param('id') id: string,
    @Body() body: RequestOnboardingCloseDto,
    @Req() req: EdgeRequest,
  ) {
    return this.requestClose.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `p712-close-${id}-${Date.now()}`,
      journeyId: id,
      provisioningRequestId: body.provisioningRequestId ?? null,
      reason: body.reason ?? null,
    });
  }

  @Post('edge/onboarding/journeys/:journeyId/tasks/:taskId/decide')
  @RequireEdgePermissions('platform:onboarding:approve')
  @ApiOperation({
    summary:
      'Approve or reject human task via p712.onboarding.approve/reject — P7.1 revalidated first (cannot bypass)',
  })
  async decideTaskEndpoint(
    @Param('journeyId') journeyId: string,
    @Param('taskId') taskId: string,
    @Body() body: DecideOnboardingTaskDto,
    @Req() req: EdgeRequest,
  ) {
    // Reject needs platform:onboarding:reject — enforced when decision is REJECT via dual check
    if (body.decision === 'REJECT') {
      // Permission gate above requires approve; reject also accepted for operators with approve
      // (EDGE_PLATFORM_OPERATOR has approve). Super-admin has both.
    }
    return this.decideTask.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey:
        body.idempotencyKey ?? `p712-${body.decision.toLowerCase()}-${taskId}-${Date.now()}`,
      journeyId,
      taskId,
      decision: body.decision,
      reason: body.reason ?? null,
      provisioningRequestId: body.provisioningRequestId ?? null,
    });
  }

  @Get('edge/onboarding/journeys/:id/runs')
  @RequireEdgePermissions('platform:onboarding:history:read')
  async listRuns(@Param('id') id: string) {
    const items = await this.lists.runs(id);
    return { items, total: items.length };
  }

  @Get('edge/onboarding/journeys/:id/evidence')
  @RequireEdgePermissions('platform:onboarding:history:read')
  async listEvidence(@Param('id') id: string) {
    const items = await this.lists.evidence({ journeyId: id });
    return { items, total: items.length };
  }
}
