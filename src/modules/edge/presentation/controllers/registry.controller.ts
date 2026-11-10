import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EdgeRoute, RequireEdgePermissions } from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import { EdgeOptionalWorkspaceGuard } from '../../../../shared/auth/edge-optional-workspace.guard.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  CreateControlContractUseCase,
  CreateTechnicalVersionUseCase,
  EvaluateCompatibilityUseCase,
  ListRegistryResourcesUseCase,
  RegisterEnvironmentUseCase,
  RegisterPlatformUseCase,
  RegisterProductUseCase,
  TransitionControlContractUseCase,
  TransitionDeploymentProfileUseCase,
  TransitionEnvironmentUseCase,
  TransitionPlatformUseCase,
  TransitionProductRegistryUseCase,
  TransitionTechnicalVersionUseCase,
  UpdateControlContractDraftUseCase,
  UpdateDeploymentProfileUseCase,
  UpdateEnvironmentUseCase,
  UpdatePlatformUseCase,
  UpdateProductRegistryUseCase,
  UpdateTechnicalVersionDraftUseCase,
} from '../../application/registry/registry.use-cases.js';
import {
  ControlContractStatus,
  EnvironmentStatus,
  PlatformOperationalStatus,
  PlatformType,
  ProfileStatus,
  RegistryLifecycleStatus,
  RuntimeEnvironmentType,
  TechnicalVersionStatus,
} from '../../domain/registry/registry.types.js';

type EdgeRequest = { user?: { sub?: string; id?: string } };

function actorId(req: EdgeRequest): string {
  return req.user?.sub ?? req.user?.id ?? 'unknown';
}

@ApiTags('edge-p7-registry')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller('edge/registry')
export class EdgeRegistryController {
  constructor(
    private readonly lists: ListRegistryResourcesUseCase,
    private readonly registerProduct: RegisterProductUseCase,
    private readonly updateProduct: UpdateProductRegistryUseCase,
    private readonly transitionProduct: TransitionProductRegistryUseCase,
    private readonly createVersion: CreateTechnicalVersionUseCase,
    private readonly updateVersion: UpdateTechnicalVersionDraftUseCase,
    private readonly transitionVersion: TransitionTechnicalVersionUseCase,
    private readonly registerPlatform: RegisterPlatformUseCase,
    private readonly updatePlatform: UpdatePlatformUseCase,
    private readonly transitionPlatform: TransitionPlatformUseCase,
    private readonly registerEnvironment: RegisterEnvironmentUseCase,
    private readonly updateEnvironment: UpdateEnvironmentUseCase,
    private readonly transitionEnvironment: TransitionEnvironmentUseCase,
    private readonly updateProfile: UpdateDeploymentProfileUseCase,
    private readonly transitionProfile: TransitionDeploymentProfileUseCase,
    private readonly createContract: CreateControlContractUseCase,
    private readonly updateContract: UpdateControlContractDraftUseCase,
    private readonly transitionContract: TransitionControlContractUseCase,
    private readonly evaluateCompatibility: EvaluateCompatibilityUseCase,
  ) {}

  // ---- Products ----
  @Get('products')
  @RequireEdgePermissions('platform:product_registry:read')
  listProducts(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.lists.listProducts({
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
      status,
      q,
    });
  }

  @Get('products/:id')
  @RequireEdgePermissions('platform:product_registry:read')
  async getProduct(@Param('id') id: string) {
    const item = await this.lists.getProduct(id);
    if (!item) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product registry not found');
    return item;
  }

  @Post('products')
  @RequireEdgePermissions('platform:product_registry:manage')
  createProduct(
    @Req() req: EdgeRequest,
    @Body()
    body: {
      productId: string;
      code: string;
      name: string;
      description?: string;
      verticalCategory?: string;
    },
  ) {
    return this.registerProduct.execute({ actorId: actorId(req), ...body });
  }

  @Patch('products/:id')
  @RequireEdgePermissions('platform:product_registry:manage')
  patchProduct(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: { expectedVersion: number; patch: Record<string, unknown> },
  ) {
    return this.updateProduct.execute({
      actorId: actorId(req),
      id,
      expectedVersion: body.expectedVersion,
      patch: body.patch as never,
    });
  }

  @Post('products/:id/transition')
  @RequireEdgePermissions('platform:product_registry:certify')
  transitionProductStatus(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: { toStatus: RegistryLifecycleStatus; reason?: string },
  ) {
    return this.transitionProduct.execute({
      actorId: actorId(req),
      id,
      toStatus: body.toStatus,
      reason: body.reason,
    });
  }

  @Get('products/:id/versions')
  @RequireEdgePermissions('platform:product_registry:read')
  listVersions(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
  ) {
    return this.lists.listVersions(id, {
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
      status,
    });
  }

  @Post('products/:id/versions')
  @RequireEdgePermissions('platform:product_registry:manage')
  createProductVersion(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body()
    body: { technicalVersion: string; releaseChannel?: string; changeSummary?: string },
  ) {
    return this.createVersion.execute({
      actorId: actorId(req),
      productRegistryId: id,
      ...body,
    });
  }

  @Patch('versions/:id')
  @RequireEdgePermissions('platform:product_registry:manage')
  patchVersion(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.updateVersion.execute({ actorId: actorId(req), id, patch: body as never });
  }

  @Post('versions/:id/transition')
  @RequireEdgePermissions('platform:product_registry:manage')
  transitionVersionStatus(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: { toStatus: TechnicalVersionStatus },
  ) {
    return this.transitionVersion.execute({
      actorId: actorId(req),
      id,
      toStatus: body.toStatus,
    });
  }

  // ---- Platforms ----
  @Get('platforms')
  @RequireEdgePermissions('platform:product_platforms:read')
  listPlatforms(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.lists.listPlatforms({
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
      status,
      q,
    });
  }

  @Get('platforms/:id')
  @RequireEdgePermissions('platform:product_platforms:read')
  async getPlatform(@Param('id') id: string) {
    const item = await this.lists.getPlatform(id);
    if (!item) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Platform not found');
    return item;
  }

  @Post('platforms')
  @RequireEdgePermissions('platform:product_platforms:manage')
  createPlatform(
    @Req() req: EdgeRequest,
    @Body()
    body: {
      code: string;
      name: string;
      description?: string;
      platformType: PlatformType;
      businessBackendId?: string;
      allowedProductIds?: string[];
      supportedEnvironmentTypes?: string[];
      supportedProfileCodes?: string[];
      connectivityReference?: string;
      secureConfigRef?: string;
    },
  ) {
    return this.registerPlatform.execute({ actorId: actorId(req), ...body });
  }

  @Patch('platforms/:id')
  @RequireEdgePermissions('platform:product_platforms:manage')
  patchPlatform(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: { expectedVersion: number; patch: Record<string, unknown> },
  ) {
    return this.updatePlatform.execute({
      actorId: actorId(req),
      id,
      expectedVersion: body.expectedVersion,
      patch: body.patch as never,
    });
  }

  @Post('platforms/:id/transition')
  @RequireEdgePermissions('platform:product_platforms:manage')
  transitionPlatformStatus(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: { toStatus: PlatformOperationalStatus; reason?: string },
  ) {
    return this.transitionPlatform.execute({
      actorId: actorId(req),
      id,
      toStatus: body.toStatus,
      reason: body.reason,
    });
  }

  // ---- Environments ----
  @Get('environments')
  @RequireEdgePermissions('platform:runtime_environments:read')
  listEnvironments(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('platformId') platformId?: string,
  ) {
    return this.lists.listEnvironments({
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
      status,
      q,
      platformId,
    });
  }

  @Get('environments/:id')
  @RequireEdgePermissions('platform:runtime_environments:read')
  async getEnvironment(@Param('id') id: string) {
    const item = await this.lists.getEnvironment(id);
    if (!item) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Environment not found');
    return item;
  }

  @Post('environments')
  @RequireEdgePermissions('platform:runtime_environments:manage')
  createEnvironment(
    @Req() req: EdgeRequest,
    @Body()
    body: {
      platformId: string;
      code: string;
      name: string;
      environmentType: RuntimeEnvironmentType;
      region?: string;
      geoZone?: string;
      securityClassification?: string;
      dataClassification?: string;
      allowedProfileCodes?: string[];
      dataResidencyConstraints?: Record<string, unknown>;
    },
  ) {
    return this.registerEnvironment.execute({ actorId: actorId(req), ...body });
  }

  @Patch('environments/:id')
  @RequireEdgePermissions('platform:runtime_environments:manage')
  patchEnvironment(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: { expectedVersion: number; patch: Record<string, unknown> },
  ) {
    return this.updateEnvironment.execute({
      actorId: actorId(req),
      id,
      expectedVersion: body.expectedVersion,
      patch: body.patch as never,
    });
  }

  @Post('environments/:id/transition')
  @RequireEdgePermissions('platform:runtime_environments:manage')
  transitionEnvironmentStatus(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: { toStatus: EnvironmentStatus; reason?: string },
  ) {
    return this.transitionEnvironment.execute({
      actorId: actorId(req),
      id,
      toStatus: body.toStatus,
      reason: body.reason,
    });
  }

  // ---- Profiles ----
  @Get('deployment-profiles')
  @RequireEdgePermissions('platform:deployment_profiles:read')
  listProfiles(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.lists.listProfiles({
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
      status,
      q,
    });
  }

  @Get('deployment-profiles/:id')
  @RequireEdgePermissions('platform:deployment_profiles:read')
  async getProfile(@Param('id') id: string) {
    const item = await this.lists.getProfile(id);
    if (!item) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Profile not found');
    return item;
  }

  @Patch('deployment-profiles/:id')
  @RequireEdgePermissions('platform:deployment_profiles:manage')
  patchProfile(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.updateProfile.execute({ actorId: actorId(req), id, patch: body as never });
  }

  @Post('deployment-profiles/:id/transition')
  @RequireEdgePermissions('platform:deployment_profiles:manage')
  transitionProfileStatus(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: { toStatus: ProfileStatus; reason?: string },
  ) {
    return this.transitionProfile.execute({
      actorId: actorId(req),
      id,
      toStatus: body.toStatus,
      reason: body.reason,
    });
  }

  // ---- Contracts ----
  @Get('control-contracts')
  @RequireEdgePermissions('platform:product_control_contracts:read')
  listContracts(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('productId') productId?: string,
    @Query('platformId') platformId?: string,
  ) {
    return this.lists.listContracts({
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
      status,
      q,
      productId,
      platformId,
    });
  }

  @Get('control-contracts/:id')
  @RequireEdgePermissions('platform:product_control_contracts:read')
  async getContract(@Param('id') id: string) {
    const item = await this.lists.getContract(id);
    if (!item) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Control contract not found');
    return item;
  }

  @Post('control-contracts')
  @RequireEdgePermissions('platform:product_control_contracts:manage')
  createControlContract(
    @Req() req: EdgeRequest,
    @Body()
    body: {
      productId: string;
      platformId: string;
      contractCode: string;
      contractVersion: string;
      schemaVersion: string;
      connectivityModel: string;
      supportedCapabilities?: unknown[];
      supportedControlOperations?: unknown[];
      s2sAuthPolicy?: Record<string, unknown>;
    },
  ) {
    return this.createContract.execute({ actorId: actorId(req), ...body });
  }

  @Patch('control-contracts/:id')
  @RequireEdgePermissions('platform:product_control_contracts:manage')
  patchContract(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.updateContract.execute({ actorId: actorId(req), id, patch: body as never });
  }

  @Post('control-contracts/:id/transition')
  @RequireEdgePermissions('platform:product_control_contracts:certify')
  transitionContractStatus(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: { toStatus: ControlContractStatus; reason?: string },
  ) {
    return this.transitionContract.execute({
      actorId: actorId(req),
      id,
      toStatus: body.toStatus,
      reason: body.reason,
    });
  }

  // ---- Compatibility ----
  @Post('compatibility/evaluate')
  @RequireEdgePermissions('platform:registry_compatibility:evaluate')
  evaluate(
    @Req() req: EdgeRequest,
    @Body()
    body: {
      productRegistryId: string;
      technicalVersionId: string;
      platformId: string;
      environmentId: string;
      profileId: string;
      contractId: string;
      correlationId?: string;
    },
  ) {
    return this.evaluateCompatibility.execute({ actorId: actorId(req), ...body });
  }

  @Get('compatibility/evaluations')
  @RequireEdgePermissions('platform:registry_compatibility:evaluate')
  listEvaluations(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
  ) {
    return this.lists.listEvaluations({
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
      status,
    });
  }

  @Get('compatibility/evaluations/:id')
  @RequireEdgePermissions('platform:registry_compatibility:evaluate')
  async getEvaluation(@Param('id') id: string) {
    const item = await this.lists.getEvaluation(id);
    if (!item) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Evaluation not found');
    return item;
  }

  @Get('history')
  @RequireEdgePermissions('platform:registry_history:read')
  listHistory(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
  ) {
    return this.lists.listHistory({
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
      resourceType: resourceType as never,
      resourceId,
    });
  }
}
