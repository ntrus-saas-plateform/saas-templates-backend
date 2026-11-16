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
  CreateLifecycleRecordUseCase,
  ListLifecycleUseCase,
  RequestLifecycleDeprovisionUseCase,
  RequestLifecycleResumeUseCase,
  RequestLifecycleSuspendUseCase,
} from '../../application/tenant-lifecycle/lifecycle.use-cases.js';
import {
  CreateLifecycleRecordDto,
  LifecyclePaginationQueryDto,
  RequestLifecycleDeprovisionDto,
  RequestLifecycleResumeDto,
  RequestLifecycleSuspendDto,
} from '../dto/lifecycle.dto.js';

type EdgeRequest = { user?: { sub?: string; id?: string } };

function actorId(req: EdgeRequest): string {
  return req.user?.sub ?? req.user?.id ?? 'unknown';
}

/**
 * P7.11 — Tenant Technical Lifecycle API.
 * Mutative suspend/resume/deprovision ONLY through P7.4 workflows (fail-closed P7.1).
 * Does NOT manage business IAM or set commercial Subscription status alone.
 * Deprovision requires authorized===true && confirmed===true && reason.
 */
@ApiTags('edge-p7-lifecycle')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller()
export class EdgeLifecycleController {
  constructor(
    private readonly lists: ListLifecycleUseCase,
    private readonly createRecord: CreateLifecycleRecordUseCase,
    private readonly requestSuspend: RequestLifecycleSuspendUseCase,
    private readonly requestResume: RequestLifecycleResumeUseCase,
    private readonly requestDeprovision: RequestLifecycleDeprovisionUseCase,
  ) {}

  @Get('edge/lifecycle/records')
  @RequireEdgePermissions('platform:lifecycle:read')
  @ApiOperation({ summary: 'List tenant technical lifecycle records' })
  async listRecords(@Query() query: LifecyclePaginationQueryDto) {
    return this.lists.records({
      tenantId: query.tenantId,
      productId: query.productId,
      status: query.status,
      activationRecordId: query.activationRecordId,
      provisioningRequestId: query.provisioningRequestId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get('edge/lifecycle/records/:id')
  @RequireEdgePermissions('platform:lifecycle:read')
  async getRecord(@Param('id') id: string) {
    const record = await this.lists.record(id);
    if (!record) return null;
    const [runs, evidence] = await Promise.all([
      this.lists.runs(id, 20),
      this.lists.evidence({ lifecycleRecordId: id, limit: 50 }),
    ]);
    return { record, runs, evidence };
  }

  @Post('edge/lifecycle/records')
  @RequireEdgePermissions('platform:lifecycle:suspend')
  @ApiOperation({
    summary: 'Create a lifecycle record from an ACTIVE P7.10 Activation Record (does not mutate runtime)',
  })
  async createRecordEndpoint(
    @Body() body: CreateLifecycleRecordDto,
    @Req() req: EdgeRequest,
  ) {
    return this.createRecord.execute({
      actorId: actorId(req),
      activationRecordId: body.activationRecordId,
      retentionPolicyRef: body.retentionPolicyRef,
      exportEvidenceRef: body.exportEvidenceRef,
      metadata: body.metadata,
    });
  }

  @Post('edge/lifecycle/records/:id/suspend')
  @RequireEdgePermissions('platform:lifecycle:suspend')
  @ApiOperation({ summary: 'Launch p711.lifecycle.suspend workflow' })
  async suspendEndpoint(
    @Param('id') id: string,
    @Body() body: RequestLifecycleSuspendDto,
    @Req() req: EdgeRequest,
  ) {
    return this.requestSuspend.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `p711-suspend-${id}-${Date.now()}`,
      lifecycleRecordId: id,
      provisioningRequestId: body.provisioningRequestId ?? null,
      reason: body.reason ?? null,
    });
  }

  @Post('edge/lifecycle/records/:id/resume')
  @RequireEdgePermissions('platform:lifecycle:resume')
  @ApiOperation({ summary: 'Launch p711.lifecycle.resume workflow' })
  async resumeEndpoint(
    @Param('id') id: string,
    @Body() body: RequestLifecycleResumeDto,
    @Req() req: EdgeRequest,
  ) {
    return this.requestResume.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `p711-resume-${id}-${Date.now()}`,
      lifecycleRecordId: id,
      provisioningRequestId: body.provisioningRequestId ?? null,
      reason: body.reason ?? null,
    });
  }

  @Post('edge/lifecycle/records/:id/deprovision')
  @RequireEdgePermissions('platform:lifecycle:deprovision')
  @ApiOperation({
    summary:
      'Launch p711.lifecycle.deprovision — requires authorized===true && confirmed===true && reason',
  })
  async deprovisionEndpoint(
    @Param('id') id: string,
    @Body() body: RequestLifecycleDeprovisionDto,
    @Req() req: EdgeRequest,
  ) {
    // Defense-in-depth beyond DTO Equals(true)
    if (body.authorized !== true || body.confirmed !== true || !body.reason?.trim()) {
      return {
        error: 'Deprovision requires authorized===true && confirmed===true && reason',
      };
    }
    return this.requestDeprovision.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `p711-deprovision-${id}-${Date.now()}`,
      lifecycleRecordId: id,
      authorized: true,
      confirmed: true,
      reason: body.reason,
      provisioningRequestId: body.provisioningRequestId ?? null,
      exportEvidenceRef: body.exportEvidenceRef ?? null,
    });
  }

  @Get('edge/lifecycle/records/:id/runs')
  @RequireEdgePermissions('platform:lifecycle:history:read')
  async listRuns(@Param('id') id: string) {
    const items = await this.lists.runs(id);
    return { items, total: items.length };
  }

  @Get('edge/lifecycle/records/:id/evidence')
  @RequireEdgePermissions('platform:lifecycle:history:read')
  async listEvidence(@Param('id') id: string) {
    const items = await this.lists.evidence({ lifecycleRecordId: id });
    return { items, total: items.length };
  }
}
