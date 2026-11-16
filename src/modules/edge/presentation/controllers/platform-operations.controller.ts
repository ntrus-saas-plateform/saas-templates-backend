import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
  AddServiceDependencyUseCase,
  GetPlatformServiceUseCase,
  ListPlatformServicesUseCase,
  RegisterPlatformServiceUseCase,
  RemoveServiceDependencyUseCase,
  UpdatePlatformServiceUseCase,
} from '../../application/platform-operations/service-catalog.use-cases.js';
import {
  AddServiceDependencyDto,
  RegisterPlatformServiceDto,
  RemoveServiceDependencyQueryDto,
  ServiceCatalogSearchQueryDto,
  UpdatePlatformServiceDto,
} from '../dto/service-catalog.dto.js';

type EdgeRequest = { user?: { sub?: string; id?: string } };

function actorId(req: EdgeRequest): string {
  return req.user?.sub ?? req.user?.id ?? 'unknown';
}

@ApiTags('edge-p9-platform-operations')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller()
export class EdgePlatformOperationsController {
  constructor(
    private readonly listServices: ListPlatformServicesUseCase,
    private readonly getService: GetPlatformServiceUseCase,
    private readonly registerService: RegisterPlatformServiceUseCase,
    private readonly updateService: UpdatePlatformServiceUseCase,
    private readonly addDependency: AddServiceDependencyUseCase,
    private readonly removeDependency: RemoveServiceDependencyUseCase,
  ) {}

  @Get('edge/operations/services')
  @RequireEdgePermissions('platform:service_catalog:read')
  @ApiOperation({ summary: 'Search platform service catalog' })
  async searchServices(@Query() query: ServiceCatalogSearchQueryDto) {
    return this.listServices.execute(query);
  }

  @Post('edge/operations/services')
  @RequireEdgePermissions('platform:service_catalog:manage')
  async createService(@Body() body: RegisterPlatformServiceDto, @Req() req: EdgeRequest) {
    return this.registerService.execute({
      actorId: actorId(req),
      ...body,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Get('edge/operations/services/:id')
  @RequireEdgePermissions('platform:service_catalog:read')
  async getServiceById(@Param('id') id: string) {
    return this.getService.execute(id);
  }

  @Patch('edge/operations/services/:id')
  @RequireEdgePermissions('platform:service_catalog:manage')
  async patchService(
    @Param('id') id: string,
    @Body() body: UpdatePlatformServiceDto,
    @Req() req: EdgeRequest,
  ) {
    return this.updateService.execute({
      actorId: actorId(req),
      id,
      ...body,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Post('edge/operations/services/:id/dependencies')
  @RequireEdgePermissions('platform:service_catalog:manage')
  async postDependency(
    @Param('id') id: string,
    @Body() body: AddServiceDependencyDto,
    @Req() req: EdgeRequest,
  ) {
    return this.addDependency.execute({
      actorId: actorId(req),
      serviceId: id,
      dependsOnServiceId: body.dependsOnServiceId,
      dependencyType: body.dependencyType,
      criticality: body.criticality,
      description: body.description,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Delete('edge/operations/services/:id/dependencies')
  @RequireEdgePermissions('platform:service_catalog:manage')
  async deleteDependency(
    @Param('id') id: string,
    @Query() query: RemoveServiceDependencyQueryDto,
    @Req() req: EdgeRequest,
  ) {
    await this.removeDependency.execute({
      actorId: actorId(req),
      serviceId: id,
      dependsOnServiceId: query.dependsOnServiceId,
      dependencyType: query.dependencyType,
      correlationId: randomUUID(),
    });
    return { ok: true };
  }

  @Get('edge/operations/overview')
  @RequireEdgePermissions('platform:operations:overview:read')
  @ApiOperation({
    summary: 'Operations overview (P9.1 stub honesty — catalog counts only; no fabricated health)',
  })
  async operationsOverview() {
    const catalog = await this.listServices.execute({ limit: 1, offset: 0 });
    return {
      availability: 'PARTIAL',
      note: 'P9.1 exposes catalog counts only. Live health/alerts/incidents require P9.2+',
      catalog: {
        totalServices: catalog.total,
        observation: 'CONFIGURED_REGISTRY_ONLY',
      },
      activeIncidents: { availability: 'UNAVAILABLE', integration: 'P9_INCIDENT' },
      activeAlerts: { availability: 'UNAVAILABLE', integration: 'P9_ALERT' },
      computedAt: new Date().toISOString(),
    };
  }
}
