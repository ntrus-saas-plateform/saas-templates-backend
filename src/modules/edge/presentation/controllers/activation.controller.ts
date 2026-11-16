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
  CreateActivationRecordUseCase,
  CreateReadinessEvaluationUseCase,
  ListActivationUseCase,
  RequestReadinessEvaluateUseCase,
  RequestTechnicalActivationUseCase,
} from '../../application/readiness-activation/activation.use-cases.js';
import {
  ActivationPaginationQueryDto,
  CreateActivationRecordDto,
  CreateReadinessEvaluationDto,
  RequestReadinessEvaluateDto,
  RequestTechnicalActivationDto,
} from '../dto/activation.dto.js';

type EdgeRequest = { user?: { sub?: string; id?: string } };

function actorId(req: EdgeRequest): string {
  return req.user?.sub ?? req.user?.id ?? 'unknown';
}

/**
 * P7.10 — Technical Readiness & Activation Gate API.
 * Mutative evaluate/activate ONLY through P7.4 workflows (fail-closed P7.1 auth).
 * Does NOT set commercial Subscription.ACTIVE.
 */
@ApiTags('edge-p7-activation')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller()
export class EdgeActivationController {
  constructor(
    private readonly lists: ListActivationUseCase,
    private readonly createEvaluation: CreateReadinessEvaluationUseCase,
    private readonly createRecord: CreateActivationRecordUseCase,
    private readonly requestEvaluate: RequestReadinessEvaluateUseCase,
    private readonly requestActivate: RequestTechnicalActivationUseCase,
  ) {}

  // --- evaluations --------------------------------------------------------

  @Get('edge/activation/evaluations')
  @RequireEdgePermissions('platform:activation:read')
  @ApiOperation({ summary: 'List technical readiness evaluations' })
  async listEvaluations(@Query() query: ActivationPaginationQueryDto) {
    return this.lists.evaluations({
      tenantId: query.tenantId,
      productId: query.productId,
      status: query.status,
      provisioningRequestId: query.provisioningRequestId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get('edge/activation/evaluations/:id')
  @RequireEdgePermissions('platform:activation:read')
  async getEvaluation(@Param('id') id: string) {
    const evaluation = await this.lists.evaluation(id);
    if (!evaluation) return null;
    const [checks, evidence] = await Promise.all([
      this.lists.checks(id),
      this.lists.evidence({ evaluationId: id, limit: 50 }),
    ]);
    return { evaluation, checks, evidence };
  }

  @Post('edge/activation/evaluations')
  @RequireEdgePermissions('platform:activation:evaluate')
  @ApiOperation({
    summary: 'Create a readiness evaluation (binds P7.1 auth, seeds pending checks)',
  })
  async createEvaluationEndpoint(
    @Body() body: CreateReadinessEvaluationDto,
    @Req() req: EdgeRequest,
  ) {
    return this.createEvaluation.execute({
      actorId: actorId(req),
      tenantId: body.tenantId,
      productId: body.productId,
      provisioningRequestId: body.provisioningRequestId,
      subscriptionId: body.subscriptionId,
      accountId: body.accountId,
      metadata: body.metadata,
    });
  }

  @Post('edge/activation/evaluations/:id/evaluate')
  @RequireEdgePermissions('platform:activation:evaluate')
  @ApiOperation({ summary: 'Launch p710.readiness.evaluate workflow' })
  async evaluateEndpoint(
    @Param('id') id: string,
    @Body() body: RequestReadinessEvaluateDto,
    @Req() req: EdgeRequest,
  ) {
    return this.requestEvaluate.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `p710-evaluate-${id}-${Date.now()}`,
      evaluationId: id,
      activationRecordId: body.activationRecordId ?? null,
      provisioningRequestId: body.provisioningRequestId ?? null,
    });
  }

  // --- activation records -------------------------------------------------

  @Get('edge/activation/records')
  @RequireEdgePermissions('platform:activation:read')
  @ApiOperation({ summary: 'List activation records' })
  async listRecords(@Query() query: ActivationPaginationQueryDto) {
    return this.lists.records({
      tenantId: query.tenantId,
      productId: query.productId,
      status: query.status,
      provisioningRequestId: query.provisioningRequestId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get('edge/activation/records/:id')
  @RequireEdgePermissions('platform:activation:read')
  async getRecord(@Param('id') id: string) {
    const record = await this.lists.record(id);
    if (!record) return null;
    const [runs, evidence] = await Promise.all([
      this.lists.runs(id, 20),
      this.lists.evidence({ activationRecordId: id, limit: 50 }),
    ]);
    return { record, runs, evidence };
  }

  @Post('edge/activation/records')
  @RequireEdgePermissions('platform:activation:activate')
  @ApiOperation({
    summary: 'Create an activation record bound to P7.1 authorization (does not activate)',
  })
  async createRecordEndpoint(
    @Body() body: CreateActivationRecordDto,
    @Req() req: EdgeRequest,
  ) {
    return this.createRecord.execute({
      actorId: actorId(req),
      tenantId: body.tenantId,
      productId: body.productId,
      provisioningRequestId: body.provisioningRequestId,
      readinessEvaluationId: body.readinessEvaluationId,
      subscriptionId: body.subscriptionId,
      accountId: body.accountId,
      metadata: body.metadata,
    });
  }

  @Post('edge/activation/records/:id/evaluate')
  @RequireEdgePermissions('platform:activation:evaluate')
  @ApiOperation({
    summary: 'Launch readiness evaluate for the evaluation bound to this activation record',
  })
  async evaluateRecordEndpoint(
    @Param('id') id: string,
    @Body() body: RequestReadinessEvaluateDto,
    @Req() req: EdgeRequest,
  ) {
    const record = await this.lists.record(id);
    if (!record?.readinessEvaluationId) {
      return { error: 'Activation record has no bound readiness evaluation' };
    }
    return this.requestEvaluate.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `p710-record-evaluate-${id}-${Date.now()}`,
      evaluationId: record.readinessEvaluationId,
      activationRecordId: id,
      provisioningRequestId: body.provisioningRequestId ?? record.provisioningRequestId,
    });
  }

  @Post('edge/activation/records/:id/activate')
  @RequireEdgePermissions('platform:activation:activate')
  @ApiOperation({ summary: 'Launch p710.activation.activate workflow (fail-closed)' })
  async activateEndpoint(
    @Param('id') id: string,
    @Body() body: RequestTechnicalActivationDto,
    @Req() req: EdgeRequest,
  ) {
    return this.requestActivate.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `p710-activate-${id}-${Date.now()}`,
      activationRecordId: id,
      provisioningRequestId: body.provisioningRequestId ?? null,
    });
  }

  @Get('edge/activation/records/:id/runs')
  @RequireEdgePermissions('platform:activation:history:read')
  async listRuns(@Param('id') id: string) {
    const items = await this.lists.runs(id);
    return { items, total: items.length };
  }

  @Get('edge/activation/records/:id/evidence')
  @RequireEdgePermissions('platform:activation:history:read')
  async listEvidence(@Param('id') id: string) {
    const items = await this.lists.evidence({ activationRecordId: id });
    return { items, total: items.length };
  }
}
