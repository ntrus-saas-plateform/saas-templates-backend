import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EdgeRoute, RequireEdgePermissions } from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import { EdgeOptionalWorkspaceGuard } from '../../../../shared/auth/edge-optional-workspace.guard.js';
import { EdgeContextService } from '../../../../shared/auth/edge-context.service.js';
import {
  CreateProductUseCase,
  GetProductUseCase,
  ListProductsUseCase,
  TransitionProductLifecycleUseCase,
  UpdateProductUseCase,
} from '../../application/product/product.use-cases.js';
import {
  CreateProductVersionUseCase,
  GetProductVersionUseCase,
  ListProductVersionsUseCase,
  PublishProductVersionUseCase,
  UpdateProductVersionDraftUseCase,
} from '../../application/product/product-version.use-cases.js';
import {
  ListCompatibilitiesByProductUseCase,
  UpsertCompatibilityUseCase,
} from '../../application/product/compatibility.use-cases.js';
import {
  ListProductCapabilityMappingsUseCase,
  UpsertProductCapabilityMappingUseCase,
} from '../../application/capability/capability.use-cases.js';
import {
  CreateProductBackendBindingUseCase,
  ListProductBackendBindingsUseCase,
} from '../../application/backend/backend.use-cases.js';
import { EvaluateProductReadinessUseCase } from '../../application/readiness/readiness.use-cases.js';
import { PublishProductUseCase } from '../../application/publication/publication.use-cases.js';
import {
  CommercialAvailability,
  ProductLifecycleStatus,
} from '../../domain/product/product.entity.js';
import { ProductReleaseType } from '../../domain/product/product-version.entity.js';
import {
  CompatibilityStatus,
  CompatibilityTargetType,
} from '../../domain/product/product-compatibility.entity.js';
import { CapabilityMappingClassification } from '../../domain/capability/technical-capability.entity.js';
import { BackendBindingType } from '../../domain/backend/business-backend.entity.js';

@ApiTags('edge-products')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller('edge/products')
export class EdgeProductsController {
  constructor(
    private readonly edgeContext: EdgeContextService,
    private readonly createProduct: CreateProductUseCase,
    private readonly updateProduct: UpdateProductUseCase,
    private readonly getProduct: GetProductUseCase,
    private readonly listProducts: ListProductsUseCase,
    private readonly transitionLifecycle: TransitionProductLifecycleUseCase,
    private readonly createVersion: CreateProductVersionUseCase,
    private readonly updateVersion: UpdateProductVersionDraftUseCase,
    private readonly getVersion: GetProductVersionUseCase,
    private readonly listVersions: ListProductVersionsUseCase,
    private readonly publishVersion: PublishProductVersionUseCase,
    private readonly upsertCompatibility: UpsertCompatibilityUseCase,
    private readonly listCompatibilities: ListCompatibilitiesByProductUseCase,
    private readonly upsertCapabilityMapping: UpsertProductCapabilityMappingUseCase,
    private readonly listCapabilityMappings: ListProductCapabilityMappingsUseCase,
    private readonly createBinding: CreateProductBackendBindingUseCase,
    private readonly listBindings: ListProductBackendBindingsUseCase,
    private readonly evaluateReadiness: EvaluateProductReadinessUseCase,
    private readonly publishProduct: PublishProductUseCase,
  ) {}

  @Get()
  @RequireEdgePermissions('platform:products:read')
  async list(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('verticalId') verticalId?: string,
    @Query('status') status?: ProductLifecycleStatus,
  ) {
    const ctx = this.edgeContext.getOrThrow();
    const result = await this.listProducts.execute({
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
      verticalId,
      status,
      scopeVerticalId: ctx.verticalId,
    });
    return { data: result.items, pagination: { total: result.total } };
  }

  @Post()
  @RequireEdgePermissions('platform:products:create')
  async create(
    @Body()
    body: {
      code: string;
      slug: string;
      name: string;
      shortDescription?: string | null;
      description?: string | null;
      verticalId: string;
      productType?: string | null;
      technicalStatus?: string | null;
      commercialAvailability?: CommercialAvailability;
      iconRef?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.createProduct.execute({
        actorId: ctx.administratorId!,
        scopeVerticalId: ctx.verticalId,
        ...body,
      }),
    };
  }

  @Get(':id')
  @RequireEdgePermissions('platform:products:read')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const ctx = this.edgeContext.getOrThrow();
    return { data: await this.getProduct.execute(id, ctx.verticalId) };
  }

  @Patch(':id')
  @RequireEdgePermissions('platform:products:update')
  async patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      name?: string;
      shortDescription?: string | null;
      description?: string | null;
      productType?: string | null;
      technicalStatus?: string | null;
      commercialAvailability?: CommercialAvailability;
      iconRef?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.updateProduct.execute({
        id,
        actorId: ctx.administratorId!,
        scopeVerticalId: ctx.verticalId,
        ...body,
      }),
    };
  }

  @Post(':id/lifecycle')
  @RequireEdgePermissions('platform:products:lifecycle')
  async lifecycle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { toStatus: ProductLifecycleStatus },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.transitionLifecycle.execute({
        id,
        actorId: ctx.administratorId!,
        scopeVerticalId: ctx.verticalId,
        toStatus: body.toStatus,
      }),
    };
  }

  @Get(':id/versions')
  @RequireEdgePermissions('platform:products:read')
  async versions(@Param('id', ParseUUIDPipe) id: string) {
    const ctx = this.edgeContext.getOrThrow();
    return { data: await this.listVersions.execute(id, ctx.verticalId) };
  }

  @Post(':id/versions')
  @RequireEdgePermissions('platform:products:create')
  async createProductVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      version: string;
      releaseName?: string | null;
      description?: string | null;
      releaseType: ProductReleaseType;
      apiCompatibility?: string | null;
      eventCompatibility?: string | null;
      minimumBackendVersion?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.createVersion.execute({
        actorId: ctx.administratorId!,
        scopeVerticalId: ctx.verticalId,
        productId: id,
        ...body,
      }),
    };
  }

  @Get(':id/versions/:versionId')
  @RequireEdgePermissions('platform:products:read')
  async getProductVersion(@Param('versionId', ParseUUIDPipe) versionId: string) {
    const ctx = this.edgeContext.getOrThrow();
    return { data: await this.getVersion.execute(versionId, ctx.verticalId) };
  }

  @Patch(':id/versions/:versionId')
  @RequireEdgePermissions('platform:products:update')
  async patchVersion(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body()
    body: {
      releaseName?: string | null;
      description?: string | null;
      apiCompatibility?: string | null;
      eventCompatibility?: string | null;
      minimumBackendVersion?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.updateVersion.execute({
        id: versionId,
        scopeVerticalId: ctx.verticalId,
        ...body,
      }),
    };
  }

  @Post(':id/versions/:versionId/publish')
  @RequireEdgePermissions('platform:products:publish')
  async publishProductVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.publishVersion.execute({
        productId: id,
        versionId,
        actorId: ctx.administratorId!,
        scopeVerticalId: ctx.verticalId,
      }),
    };
  }

  @Get(':id/compatibilities')
  @RequireEdgePermissions('platform:products:read')
  async compatibilities(@Param('id', ParseUUIDPipe) id: string) {
    const ctx = this.edgeContext.getOrThrow();
    await this.getProduct.execute(id, ctx.verticalId);
    return { data: await this.listCompatibilities.execute(id) };
  }

  @Put(':id/compatibilities')
  @RequireEdgePermissions('platform:products:update')
  async putCompatibility(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      productVersionId?: string | null;
      targetType: CompatibilityTargetType;
      targetId: string;
      status: CompatibilityStatus;
      justification?: string | null;
      restrictions?: Record<string, unknown>;
      evidence?: Record<string, unknown>;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    await this.getProduct.execute(id, ctx.verticalId);
    return {
      data: await this.upsertCompatibility.execute({
        productId: id,
        validatedBy: ctx.administratorId!,
        ...body,
      }),
    };
  }

  @Get(':id/capabilities')
  @RequireEdgePermissions('platform:capabilities:read')
  async capabilities(@Param('id', ParseUUIDPipe) id: string) {
    const ctx = this.edgeContext.getOrThrow();
    await this.getProduct.execute(id, ctx.verticalId);
    return { data: await this.listCapabilityMappings.execute(id) };
  }

  @Put(':id/capabilities')
  @RequireEdgePermissions('platform:capabilities:manage')
  async putCapability(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      productVersionId?: string | null;
      capabilityId: string;
      classification: CapabilityMappingClassification;
      technicalStatus?: string | null;
      commercialAvailability?: string | null;
      restrictions?: Record<string, unknown>;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    await this.getProduct.execute(id, ctx.verticalId);
    return {
      data: await this.upsertCapabilityMapping.execute({ productId: id, ...body }),
    };
  }

  @Get(':id/bindings')
  @RequireEdgePermissions('platform:backends:read')
  async bindings(@Param('id', ParseUUIDPipe) id: string) {
    const ctx = this.edgeContext.getOrThrow();
    await this.getProduct.execute(id, ctx.verticalId);
    return { data: await this.listBindings.execute(id) };
  }

  @Post(':id/bindings')
  @RequireEdgePermissions('platform:backends:manage')
  async createProductBinding(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      productVersionId?: string | null;
      backendId: string;
      bindingType: BackendBindingType;
      deploymentMode?: string | null;
      compatibilityStatus?: string | null;
      effectiveFrom?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    await this.getProduct.execute(id, ctx.verticalId);
    return {
      data: await this.createBinding.execute({
        productId: id,
        productVersionId: body.productVersionId,
        backendId: body.backendId,
        bindingType: body.bindingType,
        deploymentMode: body.deploymentMode,
        compatibilityStatus: body.compatibilityStatus,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : null,
        metadata: body.metadata,
      }),
    };
  }

  @Post(':id/readiness')
  @RequireEdgePermissions('platform:readiness:evaluate')
  async readiness(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: { productVersionId: string; profileId?: string | null; profileCode?: string | null },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.evaluateReadiness.execute({
        productId: id,
        productVersionId: body.productVersionId,
        actorId: ctx.administratorId!,
        scopeVerticalId: ctx.verticalId,
        profileId: body.profileId,
        profileCode: body.profileCode,
      }),
    };
  }

  @Post(':id/publish')
  @RequireEdgePermissions('platform:publication:approve')
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      productVersionId: string;
      profileId?: string | null;
      approvalRefs?: readonly unknown[];
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.publishProduct.execute({
        productId: id,
        productVersionId: body.productVersionId,
        actorId: ctx.administratorId!,
        scopeVerticalId: ctx.verticalId,
        profileId: body.profileId,
        approvalRefs: body.approvalRefs,
      }),
    };
  }
}
