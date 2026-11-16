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
  AttachCertificationEvidenceUseCase,
  CreateCertificationPackageUseCase,
  ListCertificationUseCase,
  RequestCertificationAssembleUseCase,
  RequestCertificationCertifyUseCase,
  RequestCertificationRevokeUseCase,
} from '../../application/production-certification/certification.use-cases.js';
import {
  AttachCertificationEvidenceDto,
  CertificationPaginationQueryDto,
  CreateCertificationPackageDto,
  RequestCertificationAssembleDto,
  RequestCertificationCertifyDto,
  RequestCertificationRevokeDto,
} from '../dto/certification.dto.js';

type EdgeRequest = { user?: { sub?: string; id?: string } };

function actorId(req: EdgeRequest): string {
  return req.user?.sub ?? req.user?.id ?? 'unknown';
}

/**
 * P7.15 — Production Certification & Evidence Pack API.
 * Mutative assemble/certify/revoke ONLY through P7.4 workflows.
 * Cannot CERTIFY if any required evidence is MISSING/FAILED.
 * Revoke clears CERTIFIED.
 */
@ApiTags('edge-p7-certification')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller()
export class EdgeCertificationController {
  constructor(
    private readonly lists: ListCertificationUseCase,
    private readonly createPackage: CreateCertificationPackageUseCase,
    private readonly attachEvidence: AttachCertificationEvidenceUseCase,
    private readonly requestAssemble: RequestCertificationAssembleUseCase,
    private readonly requestCertify: RequestCertificationCertifyUseCase,
    private readonly requestRevoke: RequestCertificationRevokeUseCase,
  ) {}

  @Get('edge/certification/packages')
  @RequireEdgePermissions('platform:certification:read')
  @ApiOperation({ summary: 'List production certification packages' })
  async listPackages(@Query() query: CertificationPaginationQueryDto) {
    return this.lists.packages({
      status: query.status,
      productId: query.productId,
      deploymentProfileCode: query.deploymentProfileCode,
      q: query.q,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get('edge/certification/packages/:id')
  @RequireEdgePermissions('platform:certification:read')
  @ApiOperation({ summary: 'Get certification package with evidence items + runs' })
  async getPackage(@Param('id') id: string) {
    const pkg = await this.lists.package(id);
    if (!pkg) return null;
    const [evidenceItems, runs, evidence] = await Promise.all([
      this.lists.evidenceItems(id),
      this.lists.runs({ packageId: id, limit: 50 }),
      this.lists.evidence({ packageId: id, limit: 100 }),
    ]);
    return { package: pkg, evidenceItems, runs: runs.items, evidence };
  }

  @Post('edge/certification/packages')
  @RequireEdgePermissions('platform:certification:manage')
  @ApiOperation({ summary: 'Create a certification package (DRAFT)' })
  async createPackageEndpoint(
    @Body() body: CreateCertificationPackageDto,
    @Req() req: EdgeRequest,
  ) {
    return this.createPackage.execute({
      actorId: actorId(req),
      code: body.code,
      name: body.name,
      description: body.description,
      productId: body.productId,
      deploymentProfileCode: body.deploymentProfileCode,
      scope: body.scope,
      provisioningRequestId: body.provisioningRequestId,
      authorizationRowId: body.authorizationRowId,
      authorizationVersion: body.authorizationVersion,
      metadata: body.metadata,
    });
  }

  @Post('edge/certification/packages/:id/assemble')
  @RequireEdgePermissions('platform:certification:manage')
  @ApiOperation({
    summary:
      'Launch p715.certification.assemble — seeds default required evidence (p714_agents optional)',
  })
  async assembleEndpoint(
    @Param('id') id: string,
    @Body() body: RequestCertificationAssembleDto,
    @Req() req: EdgeRequest,
  ) {
    return this.requestAssemble.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `p715-assemble-${id}-${Date.now()}`,
      packageId: id,
      provisioningRequestId: body.provisioningRequestId ?? null,
      reason: body.reason ?? null,
      includeOptionalAgents: body.includeOptionalAgents,
    });
  }

  @Post('edge/certification/packages/:id/certify')
  @RequireEdgePermissions('platform:certification:certify')
  @ApiOperation({
    summary:
      'Launch p715.certification.certify — fail-closed if required evidence MISSING/FAILED',
  })
  async certifyEndpoint(
    @Param('id') id: string,
    @Body() body: RequestCertificationCertifyDto,
    @Req() req: EdgeRequest,
  ) {
    return this.requestCertify.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `p715-certify-${id}-${Date.now()}`,
      packageId: id,
      provisioningRequestId: body.provisioningRequestId ?? null,
      reason: body.reason ?? null,
    });
  }

  @Post('edge/certification/packages/:id/revoke')
  @RequireEdgePermissions('platform:certification:revoke')
  @ApiOperation({
    summary: 'Launch p715.certification.revoke — clears CERTIFIED',
  })
  async revokeEndpoint(
    @Param('id') id: string,
    @Body() body: RequestCertificationRevokeDto,
    @Req() req: EdgeRequest,
  ) {
    return this.requestRevoke.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `p715-revoke-${id}-${Date.now()}`,
      packageId: id,
      provisioningRequestId: body.provisioningRequestId ?? null,
      reason: body.reason ?? null,
    });
  }

  @Post('edge/certification/packages/:id/evidence')
  @RequireEdgePermissions('platform:certification:manage')
  @ApiOperation({ summary: 'Attach or upsert an evidence item on a package' })
  async attachEvidenceEndpoint(
    @Param('id') id: string,
    @Body() body: AttachCertificationEvidenceDto,
    @Req() req: EdgeRequest,
  ) {
    return this.attachEvidence.execute({
      actorId: actorId(req),
      packageId: id,
      evidenceKey: body.evidenceKey,
      phaseCode: body.phaseCode,
      required: body.required,
      itemStatus: body.itemStatus,
      sourceRef: body.sourceRef,
      checksum: body.checksum,
      details: body.details,
    });
  }

  @Get('edge/certification/packages/:id/evidence')
  @RequireEdgePermissions('platform:certification:history:read')
  @ApiOperation({ summary: 'List durable evidence records for a package' })
  async listPackageEvidence(
    @Param('id') id: string,
    @Query() query: CertificationPaginationQueryDto,
  ) {
    return this.lists.evidence({ packageId: id, limit: query.limit });
  }

  @Get('edge/certification/packages/:id/evidence-items')
  @RequireEdgePermissions('platform:certification:read')
  @ApiOperation({ summary: 'List evidence items (manifest slots) for a package' })
  async listEvidenceItems(@Param('id') id: string) {
    return this.lists.evidenceItems(id);
  }

  @Get('edge/certification/packages/:id/runs')
  @RequireEdgePermissions('platform:certification:history:read')
  @ApiOperation({ summary: 'List certification runs for a package' })
  async listRuns(
    @Param('id') id: string,
    @Query() query: CertificationPaginationQueryDto,
  ) {
    return this.lists.runs({
      packageId: id,
      operation: query.operation,
      outcome: query.outcome,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get('edge/certification/history')
  @RequireEdgePermissions('platform:certification:history:read')
  @ApiOperation({ summary: 'List certification evidence (history)' })
  async listHistory(@Query() query: CertificationPaginationQueryDto) {
    return this.lists.evidence({
      packageId: query.packageId,
      limit: query.limit,
    });
  }
}
