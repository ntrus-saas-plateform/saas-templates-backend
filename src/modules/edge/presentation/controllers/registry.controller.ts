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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateControlContractDto,
  CreateTechnicalVersionDto,
  EvaluateCompatibilityDto,
  PatchControlContractDraftDto,
  PatchDeploymentProfileDto,
  PatchEnvironmentDto,
  PatchPlatformDto,
  PatchProductRegistryDto,
  PatchTechnicalVersionDraftDto,
  pickDefinedPatch,
  RegisterEnvironmentDto,
  RegisterPlatformDto,
  RegisterProductDto,
  RegistryContractsQueryDto,
  RegistryEnvironmentsQueryDto,
  RegistryHistoryQueryDto,
  RegistryPaginationQueryDto,
  TransitionControlContractStatusDto,
  TransitionDeploymentProfileStatusDto,
  TransitionEnvironmentStatusDto,
  TransitionPlatformStatusDto,
  TransitionProductRegistryStatusDto,
  TransitionTechnicalVersionStatusDto,
} from '../dto/registry.dto.js';
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
  listProducts(@Query() query: RegistryPaginationQueryDto) {
    return this.lists.listProducts({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      status: query.status,
      q: query.q,
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
  @ApiOperation({ summary: 'Register a P1 product into the P7.2 technical registry' })
  @ApiBody({ type: RegisterProductDto })
  createProduct(@Req() req: EdgeRequest, @Body() body: RegisterProductDto) {
    return this.registerProduct.execute({ actorId: actorId(req), ...body });
  }

  @Patch('products/:id')
  @RequireEdgePermissions('platform:product_registry:manage')
  @ApiOperation({ summary: 'Update product registry metadata (optimistic concurrency)' })
  @ApiBody({ type: PatchProductRegistryDto })
  patchProduct(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: PatchProductRegistryDto,
  ) {
    const { expectedVersion, ...fields } = body;
    return this.updateProduct.execute({
      actorId: actorId(req),
      id,
      expectedVersion,
      patch: pickDefinedPatch(fields),
    });
  }

  @Post('products/:id/transition')
  @RequireEdgePermissions('platform:product_registry:certify')
  @ApiOperation({ summary: 'Transition product registry lifecycle (certify/suspend/deprecate/retire)' })
  @ApiBody({ type: TransitionProductRegistryStatusDto })
  transitionProductStatus(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: TransitionProductRegistryStatusDto,
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
  listVersions(@Param('id') id: string, @Query() query: RegistryPaginationQueryDto) {
    return this.lists.listVersions(id, {
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      status: query.status,
    });
  }

  @Post('products/:id/versions')
  @RequireEdgePermissions('platform:product_registry:manage')
  @ApiOperation({ summary: 'Create a draft technical version for a registered product' })
  @ApiBody({ type: CreateTechnicalVersionDto })
  createProductVersion(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: CreateTechnicalVersionDto,
  ) {
    return this.createVersion.execute({
      actorId: actorId(req),
      productRegistryId: id,
      ...body,
    });
  }

  @Get('versions/:id')
  @RequireEdgePermissions('platform:product_registry:read')
  async getVersion(@Param('id') id: string) {
    const item = await this.lists.getVersion(id);
    if (!item) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Technical version not found');
    return item;
  }

  @Patch('versions/:id')
  @RequireEdgePermissions('platform:product_registry:manage')
  @ApiBody({ type: PatchTechnicalVersionDraftDto })
  patchVersion(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: PatchTechnicalVersionDraftDto,
  ) {
    const { availableFrom, supportEndsAt, ...rest } = body;
    return this.updateVersion.execute({
      actorId: actorId(req),
      id,
      patch: {
        ...pickDefinedPatch(rest),
        ...(availableFrom !== undefined ? { availableFrom: new Date(availableFrom) } : {}),
        ...(supportEndsAt !== undefined ? { supportEndsAt: new Date(supportEndsAt) } : {}),
      },
    });
  }

  @Post('versions/:id/transition')
  @RequireEdgePermissions('platform:product_registry:manage')
  @ApiOperation({ summary: 'Publish/deprecate/retire a technical version' })
  @ApiBody({ type: TransitionTechnicalVersionStatusDto })
  transitionVersionStatus(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: TransitionTechnicalVersionStatusDto,
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
  listPlatforms(@Query() query: RegistryPaginationQueryDto) {
    return this.lists.listPlatforms({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      status: query.status,
      q: query.q,
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
  @ApiOperation({ summary: 'Register a product platform (no plaintext secrets)' })
  @ApiBody({ type: RegisterPlatformDto })
  createPlatform(@Req() req: EdgeRequest, @Body() body: RegisterPlatformDto) {
    return this.registerPlatform.execute({
      actorId: actorId(req),
      ...body,
    });
  }

  @Patch('platforms/:id')
  @RequireEdgePermissions('platform:product_platforms:manage')
  @ApiBody({ type: PatchPlatformDto })
  patchPlatform(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: PatchPlatformDto,
  ) {
    const { expectedVersion, ...fields } = body;
    return this.updatePlatform.execute({
      actorId: actorId(req),
      id,
      expectedVersion,
      patch: pickDefinedPatch(fields),
    });
  }

  @Post('platforms/:id/transition')
  @RequireEdgePermissions('platform:product_platforms:manage')
  @ApiOperation({ summary: 'Transition platform operational status with dependency checks' })
  @ApiBody({ type: TransitionPlatformStatusDto })
  transitionPlatformStatus(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: TransitionPlatformStatusDto,
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
  listEnvironments(@Query() query: RegistryEnvironmentsQueryDto) {
    return this.lists.listEnvironments({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      status: query.status,
      q: query.q,
      platformId: query.platformId,
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
  @ApiOperation({ summary: 'Register a runtime environment (context, not a physical server)' })
  @ApiBody({ type: RegisterEnvironmentDto })
  createEnvironment(@Req() req: EdgeRequest, @Body() body: RegisterEnvironmentDto) {
    return this.registerEnvironment.execute({
      actorId: actorId(req),
      ...body,
    });
  }

  @Patch('environments/:id')
  @RequireEdgePermissions('platform:runtime_environments:manage')
  @ApiBody({ type: PatchEnvironmentDto })
  patchEnvironment(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: PatchEnvironmentDto,
  ) {
    const { expectedVersion, ...fields } = body;
    return this.updateEnvironment.execute({
      actorId: actorId(req),
      id,
      expectedVersion,
      patch: pickDefinedPatch(fields),
    });
  }

  @Post('environments/:id/transition')
  @RequireEdgePermissions('platform:runtime_environments:manage')
  @ApiOperation({ summary: 'Transition runtime environment status' })
  @ApiBody({ type: TransitionEnvironmentStatusDto })
  transitionEnvironmentStatus(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: TransitionEnvironmentStatusDto,
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
  listProfiles(@Query() query: RegistryPaginationQueryDto) {
    return this.lists.listProfiles({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      status: query.status,
      q: query.q,
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
  @ApiBody({ type: PatchDeploymentProfileDto })
  patchProfile(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: PatchDeploymentProfileDto,
  ) {
    return this.updateProfile.execute({
      actorId: actorId(req),
      id,
      patch: pickDefinedPatch(body),
    });
  }

  @Post('deployment-profiles/:id/transition')
  @RequireEdgePermissions('platform:deployment_profiles:manage')
  @ApiOperation({ summary: 'Transition deployment profile status' })
  @ApiBody({ type: TransitionDeploymentProfileStatusDto })
  transitionProfileStatus(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: TransitionDeploymentProfileStatusDto,
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
  listContracts(@Query() query: RegistryContractsQueryDto) {
    return this.lists.listContracts({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      status: query.status,
      q: query.q,
      productId: query.productId,
      platformId: query.platformId,
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
  @ApiOperation({ summary: 'Create a draft product control contract' })
  @ApiBody({ type: CreateControlContractDto })
  createControlContract(@Req() req: EdgeRequest, @Body() body: CreateControlContractDto) {
    return this.createContract.execute({ actorId: actorId(req), ...body });
  }

  @Patch('control-contracts/:id')
  @RequireEdgePermissions('platform:product_control_contracts:manage')
  @ApiBody({ type: PatchControlContractDraftDto })
  patchContract(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: PatchControlContractDraftDto,
  ) {
    return this.updateContract.execute({
      actorId: actorId(req),
      id,
      patch: pickDefinedPatch(body),
    });
  }

  @Post('control-contracts/:id/transition')
  @RequireEdgePermissions('platform:product_control_contracts:certify')
  @ApiOperation({ summary: 'Certify/publish/deprecate a control contract' })
  @ApiBody({ type: TransitionControlContractStatusDto })
  transitionContractStatus(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: TransitionControlContractStatusDto,
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
  @ApiOperation({ summary: 'Evaluate deterministic product/platform/environment/profile/contract compatibility' })
  @ApiBody({ type: EvaluateCompatibilityDto })
  evaluate(@Req() req: EdgeRequest, @Body() body: EvaluateCompatibilityDto) {
    return this.evaluateCompatibility.execute({ actorId: actorId(req), ...body });
  }

  @Get('compatibility/evaluations')
  @RequireEdgePermissions('platform:registry_compatibility:evaluate')
  listEvaluations(@Query() query: RegistryPaginationQueryDto) {
    return this.lists.listEvaluations({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      status: query.status,
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
  listHistory(@Query() query: RegistryHistoryQueryDto) {
    return this.lists.listHistory({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
    });
  }
}
