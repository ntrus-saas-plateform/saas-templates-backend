import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { EdgeRoute, RequireEdgePermissions } from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgeOptionalWorkspaceGuard } from '../../../../shared/auth/edge-optional-workspace.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import {
  CancelPlacementUseCase,
  ConfirmPlacementUseCase,
  CreatePlacementPolicyUseCase,
  CreatePlacementRequestUseCase,
  EvaluatePlacementUseCase,
  ExpireReservationUseCase,
  ListPlacementResourcesUseCase,
  PatchCapacityInventoryUseCase,
  PatchPlacementPolicyUseCase,
  ReEvaluatePlacementUseCase,
  ReleaseReservationUseCase,
  UpsertCapacityInventoryUseCase,
} from '../../application/placement/placement.use-cases.js';
import {
  CancelPlacementDto,
  CapacityInventoryQueryDto,
  CapacityReservationsQueryDto,
  ConfirmPlacementDto,
  CreatePlacementPolicyDto,
  CreatePlacementRequestDto,
  EvaluatePlacementDto,
  ExpireReservationDto,
  PatchCapacityInventoryDto,
  PatchPlacementPolicyDto,
  PlacementHistoryQueryDto,
  PlacementPaginationQueryDto,
  ReEvaluatePlacementDto,
  ReleaseReservationDto,
  UpsertCapacityInventoryDto,
  pickDefinedPatch,
} from '../dto/placement.dto.js';

type EdgeRequest = { user?: { sub?: string; id?: string } };

function actorId(req: EdgeRequest): string {
  return req.user?.sub ?? req.user?.id ?? 'unknown';
}

function resolveIdempotencyKey(
  headerValue: string | string[] | undefined,
  bodyKey?: string,
): string | undefined {
  const header = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  return (header?.trim() || bodyKey?.trim() || undefined) as string | undefined;
}

@ApiTags('edge-p7-placement')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller('edge/placement')
export class EdgePlacementController {
  constructor(
    private readonly lists: ListPlacementResourcesUseCase,
    private readonly createRequest: CreatePlacementRequestUseCase,
    private readonly evaluate: EvaluatePlacementUseCase,
    private readonly confirm: ConfirmPlacementUseCase,
    private readonly cancel: CancelPlacementUseCase,
    private readonly reEvaluate: ReEvaluatePlacementUseCase,
    private readonly createPolicy: CreatePlacementPolicyUseCase,
    private readonly patchPolicy: PatchPlacementPolicyUseCase,
  ) {}

  @Get('requests')
  @RequireEdgePermissions('platform:placement:read')
  listRequests(@Query() query: PlacementPaginationQueryDto) {
    return this.lists.listRequests({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      status: query.status,
      q: query.q,
    });
  }

  @Post('requests')
  @RequireEdgePermissions('platform:placement:request')
  @ApiOperation({ summary: 'Create a placement request (commercial identity from P7.1 auth view)' })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiBody({ type: CreatePlacementRequestDto })
  createPlacementRequest(
    @Req() req: EdgeRequest,
    @Headers('idempotency-key') idempotencyHeader: string | undefined,
    @Body() body: CreatePlacementRequestDto,
  ) {
    const idempotencyKey = resolveIdempotencyKey(idempotencyHeader, body.idempotencyKey);
    if (!idempotencyKey) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Idempotency-Key header or body.idempotencyKey is required',
      );
    }
    return this.createRequest.execute({
      actorId: actorId(req),
      idempotencyKey,
      provisioningRequestId: body.provisioningRequestId,
      productRegistryId: body.productRegistryId,
      technicalVersionId: body.technicalVersionId,
      contractId: body.contractId,
      deploymentProfileId: body.deploymentProfileId,
      requestedEnvironmentType: body.requestedEnvironmentType,
      requestedDeploymentModel: body.requestedDeploymentModel,
      platformId: body.platformId,
      requestedRegion: body.requestedRegion,
      dataResidencyConstraints: body.dataResidencyConstraints,
      securityClassification: body.securityClassification,
      availabilityRequirements: body.availabilityRequirements,
      recoveryRequirements: body.recoveryRequirements,
      capacityRequirements: body.capacityRequirements,
      causationId: body.causationId,
      metadata: body.metadata,
    });
  }

  @Get('requests/:id')
  @RequireEdgePermissions('platform:placement:read')
  async getRequest(@Param('id') id: string) {
    const item = await this.lists.getRequest(id);
    if (!item) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Placement request not found');
    return item;
  }

  @Post('requests/:id/evaluate')
  @RequireEdgePermissions('platform:placement:evaluate')
  @ApiOperation({ summary: 'Evaluate placement and optionally hold capacity (no P7.4)' })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiBody({ type: EvaluatePlacementDto })
  evaluateRequest(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyHeader: string | undefined,
    @Body() body: EvaluatePlacementDto,
  ) {
    return this.evaluate.execute({
      actorId: actorId(req),
      placementRequestId: id,
      policyCode: body.policyCode,
      idempotencyKey: resolveIdempotencyKey(idempotencyHeader, body.idempotencyKey),
      holdTtlMs: body.holdTtlMs,
    });
  }

  @Post('requests/:id/confirm')
  @RequireEdgePermissions('platform:placement:confirm')
  @ApiOperation({ summary: 'Confirm placement: HELD → COMMITTED reservation (no P7.4 workflow)' })
  @ApiBody({ type: ConfirmPlacementDto })
  confirmRequest(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: ConfirmPlacementDto,
  ) {
    return this.confirm.execute({
      actorId: actorId(req),
      placementRequestId: id,
      decisionId: body.decisionId,
    });
  }

  @Post('requests/:id/cancel')
  @RequireEdgePermissions('platform:placement:cancel')
  @ApiBody({ type: CancelPlacementDto })
  cancelRequest(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: CancelPlacementDto,
  ) {
    return this.cancel.execute({
      actorId: actorId(req),
      placementRequestId: id,
      reason: body.reason,
    });
  }

  @Post('requests/:id/re-evaluate')
  @RequireEdgePermissions('platform:placement:evaluate')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiBody({ type: ReEvaluatePlacementDto })
  reEvaluateRequest(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyHeader: string | undefined,
    @Body() body: ReEvaluatePlacementDto,
  ) {
    const idempotencyKey = resolveIdempotencyKey(idempotencyHeader, body.idempotencyKey);
    if (!idempotencyKey) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Idempotency-Key header or body.idempotencyKey is required',
      );
    }
    return this.reEvaluate.execute({
      actorId: actorId(req),
      placementRequestId: id,
      policyCode: body.policyCode,
      idempotencyKey,
    });
  }

  @Get('decisions/:id')
  @RequireEdgePermissions('platform:placement:read')
  async getDecision(@Param('id') id: string) {
    const item = await this.lists.getDecision(id);
    if (!item) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Placement decision not found');
    return item;
  }

  @Get('decisions/:id/candidates')
  @RequireEdgePermissions('platform:placement:read')
  listCandidates(@Param('id') id: string) {
    return this.lists.listCandidates(id);
  }

  @Get('history')
  @RequireEdgePermissions('platform:placement:read')
  listHistory(@Query() query: PlacementHistoryQueryDto) {
    return this.lists.listHistory({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
    });
  }

  @Get('policies')
  @RequireEdgePermissions('platform:placement_policy:read')
  listPolicies(@Query() query: PlacementPaginationQueryDto) {
    return this.lists.listPolicies({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      status: query.status,
      q: query.q,
    });
  }

  @Post('policies')
  @RequireEdgePermissions('platform:placement_policy:manage')
  @ApiBody({ type: CreatePlacementPolicyDto })
  createPlacementPolicy(@Req() req: EdgeRequest, @Body() body: CreatePlacementPolicyDto) {
    return this.createPolicy.execute({ actorId: actorId(req), ...body });
  }

  @Patch('policies/:id')
  @RequireEdgePermissions('platform:placement_policy:manage')
  @ApiBody({ type: PatchPlacementPolicyDto })
  patchPlacementPolicy(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: PatchPlacementPolicyDto,
  ) {
    const { expectedVersion, ...fields } = body;
    return this.patchPolicy.execute({
      actorId: actorId(req),
      id,
      expectedVersion,
      patch: pickDefinedPatch(fields),
    });
  }
}

@ApiTags('edge-p7-capacity')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller('edge/capacity')
export class EdgeCapacityController {
  constructor(
    private readonly lists: ListPlacementResourcesUseCase,
    private readonly upsertInventory: UpsertCapacityInventoryUseCase,
    private readonly patchInventory: PatchCapacityInventoryUseCase,
    private readonly release: ReleaseReservationUseCase,
    private readonly expire: ExpireReservationUseCase,
  ) {}

  @Get('inventory')
  @RequireEdgePermissions('platform:capacity:read')
  listInventory(@Query() query: CapacityInventoryQueryDto) {
    return this.lists.listInventory({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      platformId: query.platformId,
      environmentId: query.environmentId,
      resourceType: query.resourceType,
      status: query.status,
    });
  }

  @Post('inventory')
  @RequireEdgePermissions('platform:capacity:manage')
  @ApiBody({ type: UpsertCapacityInventoryDto })
  upsert(@Req() req: EdgeRequest, @Body() body: UpsertCapacityInventoryDto) {
    return this.upsertInventory.execute({
      actorId: actorId(req),
      platformId: body.platformId,
      environmentId: body.environmentId,
      resourceType: body.resourceType,
      unit: body.unit,
      totalCapacity: body.totalCapacity,
      unavailableCapacity: body.unavailableCapacity,
      measurementSource: body.measurementSource,
      measuredAt: body.measuredAt ? new Date(body.measuredAt) : undefined,
      validUntil: new Date(body.validUntil),
      capacityStatus: body.capacityStatus,
      metadata: body.metadata,
    });
  }

  @Patch('inventory/:id')
  @RequireEdgePermissions('platform:capacity:manage')
  @ApiBody({ type: PatchCapacityInventoryDto })
  patch(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: PatchCapacityInventoryDto,
  ) {
    const { expectedVersion, measuredAt, validUntil, ...fields } = body;
    return this.patchInventory.execute({
      actorId: actorId(req),
      id,
      expectedVersion,
      patch: {
        ...pickDefinedPatch(fields),
        ...(measuredAt ? { measuredAt: new Date(measuredAt) } : {}),
        ...(validUntil ? { validUntil: new Date(validUntil) } : {}),
      },
    });
  }

  @Get('reservations')
  @RequireEdgePermissions('platform:capacity:read')
  listReservations(@Query() query: CapacityReservationsQueryDto) {
    return this.lists.listReservations({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      placementRequestId: query.placementRequestId,
      environmentId: query.environmentId,
      status: query.status,
    });
  }

  @Get('reservations/:id')
  @RequireEdgePermissions('platform:capacity:read')
  async getReservation(@Param('id') id: string) {
    const item = await this.lists.getReservation(id);
    if (!item) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Reservation not found');
    return item;
  }

  @Post('reservations/:id/release')
  @RequireEdgePermissions('platform:capacity:release')
  @ApiBody({ type: ReleaseReservationDto })
  releaseReservation(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: ReleaseReservationDto,
  ) {
    return this.release.execute({
      actorId: actorId(req),
      reservationId: id,
      expectedVersion: body.expectedVersion,
      reason: body.reason,
    });
  }

  @Post('reservations/:id/expire')
  @RequireEdgePermissions('platform:capacity:release')
  @ApiBody({ type: ExpireReservationDto })
  expireReservation(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: ExpireReservationDto,
  ) {
    return this.expire.execute({
      actorId: actorId(req),
      reservationId: id,
      expectedVersion: body.expectedVersion,
    });
  }
}
