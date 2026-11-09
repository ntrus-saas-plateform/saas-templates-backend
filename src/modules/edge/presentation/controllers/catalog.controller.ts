import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EdgeRoute, RequireEdgePermissions } from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import {
  CreateOperatingModelUseCase,
  CreateProfileUseCase,
  CreateSegmentUseCase,
  GetOperatingModelUseCase,
  GetProfileUseCase,
  GetSegmentUseCase,
  ListOperatingModelsUseCase,
  ListProfilesUseCase,
  ListSegmentsByVerticalUseCase,
  UpdateSegmentUseCase,
} from '../../application/market/market.use-cases.js';
import {
  AddCapabilityDependencyUseCase,
  CreateCapabilityUseCase,
  GetCapabilityUseCase,
  ListCapabilitiesUseCase,
} from '../../application/capability/capability.use-cases.js';
import {
  CreateBackendUseCase,
  GetBackendUseCase,
  ListBackendsUseCase,
} from '../../application/backend/backend.use-cases.js';
import {
  CreateContractUseCase,
  GetContractUseCase,
  ListContractsUseCase,
} from '../../application/contract/contract.use-cases.js';
import { ListReadinessEvaluationsUseCase } from '../../application/readiness/readiness.use-cases.js';
import { CapabilityDependencyKind } from '../../domain/capability/technical-capability.entity.js';

@ApiTags('edge-market-segments')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgePermissionGuard)
@Controller('edge/market-segments')
export class EdgeMarketSegmentsController {
  constructor(
    private readonly create: CreateSegmentUseCase,
    private readonly update: UpdateSegmentUseCase,
    private readonly get: GetSegmentUseCase,
    private readonly listByVertical: ListSegmentsByVerticalUseCase,
  ) {}

  @Get()
  @RequireEdgePermissions('platform:taxonomy:read')
  async list(@Query('verticalId', ParseUUIDPipe) verticalId: string) {
    return { data: await this.listByVertical.execute(verticalId) };
  }

  @Post()
  @RequireEdgePermissions('platform:taxonomy:manage')
  async createSegment(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string | null;
      verticalId: string;
      parentSegmentId?: string | null;
      status?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return { data: await this.create.execute(body) };
  }

  @Get(':id')
  @RequireEdgePermissions('platform:taxonomy:read')
  async getSegment(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.get.execute(id) };
  }

  @Patch(':id')
  @RequireEdgePermissions('platform:taxonomy:manage')
  async patchSegment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      name?: string;
      description?: string | null;
      parentSegmentId?: string | null;
      status?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return { data: await this.update.execute({ id, ...body }) };
  }
}

@ApiTags('edge-business-profiles')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgePermissionGuard)
@Controller('edge/business-profiles')
export class EdgeBusinessProfilesController {
  constructor(
    private readonly create: CreateProfileUseCase,
    private readonly list: ListProfilesUseCase,
    private readonly get: GetProfileUseCase,
  ) {}

  @Get()
  @RequireEdgePermissions('platform:profiles:manage')
  async listProfiles(@Query('verticalId') verticalId?: string) {
    return { data: await this.list.execute(verticalId) };
  }

  @Post()
  @RequireEdgePermissions('platform:profiles:manage')
  async createProfile(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string | null;
      verticalId: string;
      segmentId?: string | null;
      status?: string;
      attributesSchema?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    },
  ) {
    return { data: await this.create.execute(body) };
  }

  @Get(':id')
  @RequireEdgePermissions('platform:profiles:manage')
  async getProfile(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.get.execute(id) };
  }
}

@ApiTags('edge-operating-models')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgePermissionGuard)
@Controller('edge/operating-models')
export class EdgeOperatingModelsController {
  constructor(
    private readonly create: CreateOperatingModelUseCase,
    private readonly list: ListOperatingModelsUseCase,
    private readonly get: GetOperatingModelUseCase,
  ) {}

  @Get()
  @RequireEdgePermissions('platform:operating_models:manage')
  async listModels(@Query('verticalId') verticalId?: string) {
    return { data: await this.list.execute(verticalId) };
  }

  @Post()
  @RequireEdgePermissions('platform:operating_models:manage')
  async createModel(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string | null;
      dimension?: string | null;
      verticalId?: string | null;
      status?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return { data: await this.create.execute(body) };
  }

  @Get(':id')
  @RequireEdgePermissions('platform:operating_models:manage')
  async getModel(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.get.execute(id) };
  }
}

@ApiTags('edge-capabilities')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgePermissionGuard)
@Controller('edge/capabilities')
export class EdgeCapabilitiesController {
  constructor(
    private readonly create: CreateCapabilityUseCase,
    private readonly list: ListCapabilitiesUseCase,
    private readonly get: GetCapabilityUseCase,
    private readonly addDependency: AddCapabilityDependencyUseCase,
  ) {}

  @Get()
  @RequireEdgePermissions('platform:capabilities:read')
  async listCapabilities() {
    return { data: await this.list.execute() };
  }

  @Post()
  @RequireEdgePermissions('platform:capabilities:manage')
  async createCapability(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string | null;
      category?: string | null;
      technicalStatus?: string | null;
      commercialAvailability?: string | null;
      ownerRef?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    return { data: await this.create.execute(body) };
  }

  @Get(':id')
  @RequireEdgePermissions('platform:capabilities:read')
  async getCapability(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.get.execute(id) };
  }

  @Post(':id/dependencies')
  @RequireEdgePermissions('platform:capabilities:manage')
  async createDependency(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      dependsOnCapabilityId: string;
      dependencyKind: CapabilityDependencyKind;
      minVersion?: string | null;
    },
  ) {
    return {
      data: await this.addDependency.execute({
        capabilityId: id,
        dependsOnCapabilityId: body.dependsOnCapabilityId,
        dependencyKind: body.dependencyKind,
        minVersion: body.minVersion,
      }),
    };
  }
}

@ApiTags('edge-backends')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgePermissionGuard)
@Controller('edge/backends')
export class EdgeBackendsController {
  constructor(
    private readonly create: CreateBackendUseCase,
    private readonly list: ListBackendsUseCase,
    private readonly get: GetBackendUseCase,
  ) {}

  @Get()
  @RequireEdgePermissions('platform:backends:read')
  async listBackends() {
    return { data: await this.list.execute() };
  }

  @Post()
  @RequireEdgePermissions('platform:backends:manage')
  async createBackend(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string | null;
      backendType?: string | null;
      lifecycleStatus?: string;
      deploymentModes?: readonly unknown[];
      supportedProtocols?: readonly unknown[];
      supportedApiVersions?: readonly unknown[];
      supportedEventVersions?: readonly unknown[];
      securityProfile?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    },
  ) {
    return { data: await this.create.execute(body) };
  }

  @Get(':id')
  @RequireEdgePermissions('platform:backends:read')
  async getBackend(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.get.execute(id) };
  }
}

@ApiTags('edge-integration-contracts')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgePermissionGuard)
@Controller('edge/integration-contracts')
export class EdgeIntegrationContractsController {
  constructor(
    private readonly create: CreateContractUseCase,
    private readonly list: ListContractsUseCase,
    private readonly get: GetContractUseCase,
  ) {}

  @Get()
  @RequireEdgePermissions('platform:contracts:manage')
  async listContracts() {
    return { data: await this.list.execute() };
  }

  @Post()
  @RequireEdgePermissions('platform:contracts:manage')
  async createContract(
    @Body()
    body: {
      code: string;
      name: string;
      contractType?: string | null;
      version: string;
      ownerRef?: string | null;
      description?: string | null;
      schemaRef?: string | null;
      compatibilityPolicy?: string | null;
      status?: string;
      effectiveFrom?: string | null;
      documentationRef?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    return {
      data: await this.create.execute({
        ...body,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : null,
      }),
    };
  }

  @Get(':id')
  @RequireEdgePermissions('platform:contracts:manage')
  async getContract(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.get.execute(id) };
  }
}

@ApiTags('edge-readiness-evaluations')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgePermissionGuard)
@Controller('edge/readiness-evaluations')
export class EdgeReadinessEvaluationsController {
  constructor(private readonly list: ListReadinessEvaluationsUseCase) {}

  @Get()
  @RequireEdgePermissions('platform:readiness:evaluate')
  async listEvaluations(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('productId') productId?: string,
  ) {
    const result = await this.list.execute({
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
      productId,
    });
    return { data: result.items, pagination: { total: result.total } };
  }
}
