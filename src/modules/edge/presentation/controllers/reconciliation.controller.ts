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
  ApproveReconciliationRemediationUseCase,
  CreateReconciliationPolicyUseCase,
  CreateReconciliationRunUseCase,
  CreateReconciliationWaiverUseCase,
  ListReconciliationUseCase,
  QuarantineReconciliationFindingUseCase,
  RequestReconciliationObserveUseCase,
  RequestReconciliationRemediateUseCase,
} from '../../application/reconciliation/reconciliation.use-cases.js';
import {
  ApproveReconciliationRemediationDto,
  CreateReconciliationPolicyDto,
  CreateReconciliationRunDto,
  CreateReconciliationWaiverDto,
  QuarantineReconciliationFindingDto,
  ReconciliationPaginationQueryDto,
  RequestReconciliationObserveDto,
  RequestReconciliationRemediateDto,
} from '../dto/reconciliation.dto.js';

type EdgeRequest = { user?: { sub?: string; id?: string } };

function actorId(req: EdgeRequest): string {
  return req.user?.sub ?? req.user?.id ?? 'unknown';
}

/**
 * P7.13 — Reconciliation & Operational Governance API.
 * Mutative observe/remediate ONLY through P7.4 workflows.
 * Timeout/unreachable ⇒ UNKNOWN (never deleted). No blind deletes.
 * Auto-remediate only when eligible + policy + reversible.
 */
@ApiTags('edge-p7-reconciliation')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller()
export class EdgeReconciliationController {
  constructor(
    private readonly lists: ListReconciliationUseCase,
    private readonly createPolicy: CreateReconciliationPolicyUseCase,
    private readonly createRun: CreateReconciliationRunUseCase,
    private readonly requestObserve: RequestReconciliationObserveUseCase,
    private readonly requestRemediate: RequestReconciliationRemediateUseCase,
    private readonly approveRemediation: ApproveReconciliationRemediationUseCase,
    private readonly createWaiver: CreateReconciliationWaiverUseCase,
    private readonly quarantineFinding: QuarantineReconciliationFindingUseCase,
  ) {}

  @Get('edge/reconciliation/policies')
  @RequireEdgePermissions('platform:reconciliation:read')
  @ApiOperation({ summary: 'List reconciliation policies' })
  async listPolicies(@Query() query: ReconciliationPaginationQueryDto) {
    return this.lists.policies({
      status: query.status,
      scope: query.scope,
      q: query.q,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get('edge/reconciliation/policies/:id')
  @RequireEdgePermissions('platform:reconciliation:read')
  async getPolicy(@Param('id') id: string) {
    return this.lists.policy(id);
  }

  @Post('edge/reconciliation/policies')
  @RequireEdgePermissions('platform:reconciliation:approve')
  @ApiOperation({ summary: 'Create a reconciliation policy' })
  async createPolicyEndpoint(
    @Body() body: CreateReconciliationPolicyDto,
    @Req() req: EdgeRequest,
  ) {
    return this.createPolicy.execute({
      actorId: actorId(req),
      code: body.code,
      name: body.name,
      description: body.description,
      scope: body.scope,
      autoRemediate: body.autoRemediate,
      requireApproval: body.requireApproval,
      rules: body.rules,
      metadata: body.metadata,
    });
  }

  @Get('edge/reconciliation/runs')
  @RequireEdgePermissions('platform:reconciliation:read')
  @ApiOperation({ summary: 'List reconciliation runs' })
  async listRuns(@Query() query: ReconciliationPaginationQueryDto) {
    return this.lists.runs({
      tenantId: query.tenantId,
      productId: query.productId,
      status: query.status,
      policyId: query.policyId,
      providerCode: query.providerCode,
      provisioningRequestId: query.provisioningRequestId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get('edge/reconciliation/runs/:id')
  @RequireEdgePermissions('platform:reconciliation:read')
  async getRun(@Param('id') id: string) {
    const run = await this.lists.run(id);
    if (!run) return null;
    const [findings, remediations, evidence] = await Promise.all([
      this.lists.findings({ runId: id, limit: 200 }),
      this.lists.remediations({ runId: id, limit: 100 }),
      this.lists.evidence({ runId: id, limit: 100 }),
    ]);
    return { run, findings: findings.items, remediations, evidence };
  }

  @Post('edge/reconciliation/runs')
  @RequireEdgePermissions('platform:reconciliation:run')
  @ApiOperation({
    summary: 'Create a reconciliation run (does not start workflow)',
  })
  async createRunEndpoint(
    @Body() body: CreateReconciliationRunDto,
    @Req() req: EdgeRequest,
  ) {
    return this.createRun.execute({
      actorId: actorId(req),
      tenantId: body.tenantId,
      productId: body.productId,
      providerCode: body.providerCode,
      policyId: body.policyId,
      triggerKind: body.triggerKind,
      provisioningRequestId: body.provisioningRequestId,
      authorizationRowId: body.authorizationRowId,
      authorizationVersion: body.authorizationVersion,
      desiredSnapshot: body.desiredSnapshot,
      observedSnapshot: body.observedSnapshot,
      metadata: body.metadata,
      correlationId: body.correlationId,
    });
  }

  @Post('edge/reconciliation/runs/:id/observe')
  @RequireEdgePermissions('platform:reconciliation:run')
  @ApiOperation({
    summary:
      'Launch p713.reconciliation.observe — unreachable ⇒ UNKNOWN (never deleted)',
  })
  async observeEndpoint(
    @Param('id') id: string,
    @Body() body: RequestReconciliationObserveDto,
    @Req() req: EdgeRequest,
  ) {
    return this.requestObserve.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `p713-observe-${id}-${Date.now()}`,
      runId: id,
      provisioningRequestId: body.provisioningRequestId ?? null,
      desired: body.desired,
      observed: body.observed,
      providerUnreachable: body.providerUnreachable,
      reason: body.reason ?? null,
    });
  }

  @Post('edge/reconciliation/runs/:id/remediate')
  @RequireEdgePermissions('platform:reconciliation:remediate')
  @ApiOperation({
    summary:
      'Launch p713.reconciliation.remediate — evidence-only; approval if not auto-eligible',
  })
  async remediateEndpoint(
    @Param('id') id: string,
    @Body() body: RequestReconciliationRemediateDto,
    @Req() req: EdgeRequest,
  ) {
    return this.requestRemediate.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `p713-remediate-${id}-${Date.now()}`,
      runId: id,
      findingId: body.findingId ?? null,
      remediationId: body.remediationId ?? null,
      provisioningRequestId: body.provisioningRequestId ?? null,
      reason: body.reason ?? null,
    });
  }

  @Post('edge/reconciliation/runs/:runId/remediations/:remediationId/decide')
  @RequireEdgePermissions('platform:reconciliation:approve')
  @ApiOperation({
    summary: 'Approve or reject remediation — P7.1 revalidated first',
  })
  async decideRemediationEndpoint(
    @Param('runId') runId: string,
    @Param('remediationId') remediationId: string,
    @Body() body: ApproveReconciliationRemediationDto,
    @Req() req: EdgeRequest,
  ) {
    return this.approveRemediation.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey:
        body.idempotencyKey ??
        `p713-${body.decision.toLowerCase()}-${remediationId}-${Date.now()}`,
      runId,
      remediationId,
      decision: body.decision,
      reason: body.reason ?? null,
      provisioningRequestId: body.provisioningRequestId ?? null,
    });
  }

  @Get('edge/reconciliation/findings')
  @RequireEdgePermissions('platform:reconciliation:read')
  @ApiOperation({ summary: 'List reconciliation findings' })
  async listFindings(@Query() query: ReconciliationPaginationQueryDto) {
    return this.lists.findings({
      runId: query.runId,
      tenantId: query.tenantId,
      status: query.status,
      observationClass: query.observationClass,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Post('edge/reconciliation/findings/:id/quarantine')
  @RequireEdgePermissions('platform:reconciliation:quarantine')
  @ApiOperation({ summary: 'Quarantine a finding (e.g. UNKNOWN observations)' })
  async quarantineEndpoint(
    @Param('id') id: string,
    @Body() body: QuarantineReconciliationFindingDto,
    @Req() req: EdgeRequest,
  ) {
    return this.quarantineFinding.execute({
      actorId: actorId(req),
      findingId: id,
      reason: body.reason ?? null,
      provisioningRequestId: body.provisioningRequestId ?? null,
    });
  }

  @Post('edge/reconciliation/waivers')
  @RequireEdgePermissions('platform:reconciliation:approve')
  @ApiOperation({ summary: 'Create a time-bounded waiver (expired = invalid)' })
  async createWaiverEndpoint(
    @Body() body: CreateReconciliationWaiverDto,
    @Req() req: EdgeRequest,
  ) {
    return this.createWaiver.execute({
      actorId: actorId(req),
      findingId: body.findingId,
      tenantId: body.tenantId,
      productId: body.productId,
      waiverCode: body.waiverCode,
      reason: body.reason,
      expiresAt: body.expiresAt,
      metadata: body.metadata,
    });
  }

  @Get('edge/reconciliation/waivers')
  @RequireEdgePermissions('platform:reconciliation:read')
  async listWaivers(@Query() query: ReconciliationPaginationQueryDto) {
    return this.lists.waivers({
      findingId: query.findingId,
      tenantId: query.tenantId,
      status: query.status,
      limit: query.limit,
    });
  }

  @Get('edge/reconciliation/runs/:id/evidence')
  @RequireEdgePermissions('platform:reconciliation:history:read')
  @ApiOperation({ summary: 'List evidence for a reconciliation run' })
  async listEvidence(@Param('id') id: string, @Query() query: ReconciliationPaginationQueryDto) {
    return this.lists.evidence({ runId: id, limit: query.limit });
  }

  @Get('edge/reconciliation/history')
  @RequireEdgePermissions('platform:reconciliation:history:read')
  @ApiOperation({ summary: 'List reconciliation evidence (history)' })
  async listHistory(@Query() query: ReconciliationPaginationQueryDto) {
    return this.lists.evidence({
      runId: query.runId,
      findingId: query.findingId,
      limit: query.limit,
    });
  }
}
