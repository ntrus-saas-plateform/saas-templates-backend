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
  AssignTenantExperienceUseCase,
  BindExperienceDomainUseCase,
  CreateExperienceApplicationUseCase,
  CreateExperienceProfileUseCase,
  ListExperienceUseCase,
  PublishExperienceApplicationUseCase,
  PublishExperienceProfileUseCase,
  RequestExperienceDeactivateUseCase,
  RequestExperienceProvisionUseCase,
} from '../../application/product-experience/experience.use-cases.js';
import {
  AssignTenantExperienceDto,
  CreateExperienceApplicationDto,
  CreateExperienceDomainDto,
  CreateExperienceProfileDto,
  ExperiencePaginationQueryDto,
  PublishExperienceApplicationDto,
  PublishExperienceProfileDto,
  RequestExperienceDeactivateDto,
  RequestExperienceProvisionDto,
} from '../dto/experience.dto.js';

type EdgeRequest = { user?: { sub?: string; id?: string } };

function actorId(req: EdgeRequest): string {
  return req.user?.sub ?? req.user?.id ?? 'unknown';
}

/**
 * P7.9 — Product Experience Provisioning API.
 * Mutative provisioning ONLY through P7.4 workflows (fail-closed P7.1 auth).
 */
@ApiTags('edge-p7-experience')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller()
export class EdgeExperienceController {
  constructor(
    private readonly lists: ListExperienceUseCase,
    private readonly createProfile: CreateExperienceProfileUseCase,
    private readonly publishProfile: PublishExperienceProfileUseCase,
    private readonly createApplication: CreateExperienceApplicationUseCase,
    private readonly publishApplication: PublishExperienceApplicationUseCase,
    private readonly assign: AssignTenantExperienceUseCase,
    private readonly bindDomain: BindExperienceDomainUseCase,
    private readonly requestProvision: RequestExperienceProvisionUseCase,
    private readonly requestDeactivate: RequestExperienceDeactivateUseCase,
  ) {}

  // --- profiles -----------------------------------------------------------

  @Get('edge/experience/profiles')
  @RequireEdgePermissions('platform:experience:read')
  @ApiOperation({ summary: 'List experience profiles' })
  async listProfiles(@Query() query: ExperiencePaginationQueryDto) {
    return this.lists.profiles({
      limit: query.limit,
      offset: query.offset,
      status: query.status,
      q: query.q,
      productId: query.productId,
    });
  }

  @Get('edge/experience/profiles/:id')
  @RequireEdgePermissions('platform:experience:read')
  async getProfile(@Param('id') id: string) {
    return this.lists.profile(id);
  }

  @Post('edge/experience/profiles')
  @RequireEdgePermissions('platform:experience:manage')
  @ApiOperation({ summary: 'Create an experience profile (DRAFT)' })
  async createProfileEndpoint(
    @Body() body: CreateExperienceProfileDto,
    @Req() req: EdgeRequest,
  ) {
    return this.createProfile.execute({
      actorId: actorId(req),
      code: body.code,
      name: body.name,
      description: body.description,
      productId: body.productId,
      compatibleRuntimeCodes: body.compatibleRuntimeCodes,
      compatibleDeploymentProfileCodes: body.compatibleDeploymentProfileCodes,
      metadata: body.metadata,
    });
  }

  @Post('edge/experience/profiles/:id/publish')
  @RequireEdgePermissions('platform:experience:manage')
  async publishProfileEndpoint(
    @Param('id') id: string,
    @Body() body: PublishExperienceProfileDto,
    @Req() req: EdgeRequest,
  ) {
    return this.publishProfile.execute({
      actorId: actorId(req),
      profileId: id,
      expectedVersion: body.expectedVersion,
    });
  }

  // --- applications -------------------------------------------------------

  @Get('edge/experience/applications')
  @RequireEdgePermissions('platform:experience:read')
  async listApplications(@Query() query: ExperiencePaginationQueryDto) {
    return this.lists.applications({
      limit: query.limit,
      offset: query.offset,
      status: query.status,
      q: query.q,
      productId: query.productId,
      experienceProfileId: query.experienceProfileId,
    });
  }

  @Get('edge/experience/applications/:id')
  @RequireEdgePermissions('platform:experience:read')
  async getApplication(@Param('id') id: string) {
    return this.lists.application(id);
  }

  @Post('edge/experience/applications')
  @RequireEdgePermissions('platform:experience:manage')
  @ApiOperation({ summary: 'Create an experience application with draft manifest' })
  async createApplicationEndpoint(
    @Body() body: CreateExperienceApplicationDto,
    @Req() req: EdgeRequest,
  ) {
    return this.createApplication.execute({
      actorId: actorId(req),
      code: body.code,
      name: body.name,
      description: body.description,
      productId: body.productId,
      applicationKind: body.applicationKind,
      experienceProfileId: body.experienceProfileId,
      draftManifest: body.draftManifest,
      productVersion: body.productVersion,
      runtimeVersion: body.runtimeVersion,
      apiCompatibilityVersion: body.apiCompatibilityVersion,
      deploymentProfileCode: body.deploymentProfileCode,
      configurationBundleCode: body.configurationBundleCode,
      entitlementSnapshotVersion: body.entitlementSnapshotVersion,
      metadata: body.metadata,
    });
  }

  @Post('edge/experience/applications/:id/publish')
  @RequireEdgePermissions('platform:experience:manage')
  async publishApplicationEndpoint(
    @Param('id') id: string,
    @Body() body: PublishExperienceApplicationDto,
    @Req() req: EdgeRequest,
  ) {
    return this.publishApplication.execute({
      actorId: actorId(req),
      applicationId: id,
      versionNumber: body.versionNumber ?? 1,
      expectedVersion: body.expectedVersion,
    });
  }

  // --- assignments / provision / deactivate -------------------------------

  @Get('edge/experience/assignments')
  @RequireEdgePermissions('platform:experience:read')
  async listAssignments(@Query() query: ExperiencePaginationQueryDto) {
    return this.lists.assignments({
      tenantId: query.tenantId,
      productId: query.productId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get('edge/experience/assignments/:id')
  @RequireEdgePermissions('platform:experience:read')
  async getAssignment(@Param('id') id: string) {
    const assignment = await this.lists.assignment(id);
    if (!assignment) return null;
    const [runs, evidence, bindings, clients, domains] = await Promise.all([
      this.lists.runs(id, 20),
      this.lists.evidence(id, 50),
      this.lists.bindings(id),
      this.lists.clients(id),
      this.lists.domains(id),
    ]);
    return { assignment, runs, evidence, bindings, clients, domains };
  }

  @Post('edge/experience/assignments')
  @RequireEdgePermissions('platform:experience:deploy')
  @ApiOperation({
    summary:
      'Assign a tenant experience (P7.1 revalidation, published profile, validated desiredManifest)',
  })
  async assignEndpoint(@Body() body: AssignTenantExperienceDto, @Req() req: EdgeRequest) {
    return this.assign.execute({
      actorId: actorId(req),
      tenantId: body.tenantId,
      productId: body.productId,
      provisioningRequestId: body.provisioningRequestId,
      experienceProfileId: body.experienceProfileId,
      desiredManifest: body.desiredManifest,
      subscriptionId: body.subscriptionId,
      accountId: body.accountId,
      metadata: body.metadata,
    });
  }

  @Post('edge/experience/assignments/:id/provision')
  @RequireEdgePermissions('platform:experience:deploy')
  @ApiOperation({ summary: 'Launch p79.experience.provision workflow' })
  async provisionEndpoint(
    @Param('id') id: string,
    @Body() body: RequestExperienceProvisionDto,
    @Req() req: EdgeRequest,
  ) {
    return this.requestProvision.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `p79-provision-${id}-${Date.now()}`,
      assignmentId: id,
      provisioningRequestId: body.provisioningRequestId ?? null,
    });
  }

  @Post('edge/experience/assignments/:id/deactivate')
  @RequireEdgePermissions('platform:experience:deploy')
  @ApiOperation({ summary: 'Launch p79.experience.deactivate workflow' })
  async deactivateEndpoint(
    @Param('id') id: string,
    @Body() body: RequestExperienceDeactivateDto,
    @Req() req: EdgeRequest,
  ) {
    return this.requestDeactivate.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `p79-deactivate-${id}-${Date.now()}`,
      assignmentId: id,
      provisioningRequestId: body.provisioningRequestId ?? null,
    });
  }

  @Get('edge/experience/assignments/:id/runs')
  @RequireEdgePermissions('platform:experience:history:read')
  async listRuns(@Param('id') id: string) {
    const items = await this.lists.runs(id);
    return { items, total: items.length };
  }

  @Get('edge/experience/assignments/:id/evidence')
  @RequireEdgePermissions('platform:experience:history:read')
  async listEvidence(@Param('id') id: string) {
    const items = await this.lists.evidence(id);
    return { items, total: items.length };
  }

  @Get('edge/experience/assignments/:id/domains')
  @RequireEdgePermissions('platform:experience:read')
  async listDomains(@Param('id') id: string) {
    const items = await this.lists.domains(id);
    return { items, total: items.length };
  }

  // --- domains ------------------------------------------------------------

  @Post('edge/experience/domains')
  @RequireEdgePermissions('platform:experience:domains')
  @ApiOperation({ summary: 'Bind a domain to an assignment (PENDING ownership challenge)' })
  async bindDomainEndpoint(@Body() body: CreateExperienceDomainDto, @Req() req: EdgeRequest) {
    return this.bindDomain.execute({
      actorId: actorId(req),
      assignmentId: body.assignmentId,
      hostname: body.hostname,
      domainKind: body.domainKind,
    });
  }
}
