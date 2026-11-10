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
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgeOptionalWorkspaceGuard } from '../../../../shared/auth/edge-optional-workspace.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import { EdgeRoute, RequireEdgePermissions } from '../../../../shared/auth/decorators.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  CancelProvisioningRequestUseCase,
  GetProvisioningAuthorizationSummaryUseCase,
  GetProvisioningRequestHistoryUseCase,
  GetProvisioningRequestStatsUseCase,
  GetProvisioningRequestUseCase,
  HandleAuthorizationRevocationUseCase,
  ListProvisioningRequestsUseCase,
  mapLegacyProvisioningRequestedEvent,
} from '../../application/provisioning/provisioning.use-cases.js';

type EdgeRequest = { user?: { sub?: string; id?: string } };

function actorId(req: EdgeRequest): string {
  return req.user?.sub ?? req.user?.id ?? 'unknown';
}

@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller('edge/provisioning-requests')
export class EdgeProvisioningController {
  constructor(
    private readonly listRequests: ListProvisioningRequestsUseCase,
    private readonly getRequest: GetProvisioningRequestUseCase,
    private readonly getHistory: GetProvisioningRequestHistoryUseCase,
    private readonly getStats: GetProvisioningRequestStatsUseCase,
    private readonly cancelRequest: CancelProvisioningRequestUseCase,
    private readonly getAuthorization: GetProvisioningAuthorizationSummaryUseCase,
    private readonly handleRevocation: HandleAuthorizationRevocationUseCase,
  ) {}

  @Get('stats')
  @RequireEdgePermissions('platform:provisioning_requests:read')
  stats() {
    return this.getStats.execute();
  }

  @Get('event-compatibility')
  @RequireEdgePermissions('platform:provisioning_requests:read')
  eventCompatibility() {
    return mapLegacyProvisioningRequestedEvent(
      'OQ-05 dual-consume: legacy subscription.provisioning.requested.v1 is not a canonical authorization',
    );
  }

  @Post('revocations/ingest')
  @RequireEdgePermissions('platform:provisioning_requests:cancel')
  ingestRevocation(
    @Req() req: EdgeRequest,
    @Body()
    body: {
      eventId?: string;
      eventName?: string;
      authorizationId?: string;
      revocationVersion?: number;
      revokedAt?: string;
      reasonCode?: string;
      reference?: string;
      payload?: Record<string, unknown>;
    },
  ) {
    if (!body?.eventId || !body.authorizationId || body.revocationVersion == null) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'eventId, authorizationId and revocationVersion are required',
      );
    }
    return this.handleRevocation.execute({
      actorId: actorId(req),
      eventId: body.eventId,
      eventName: body.eventName ?? 'subscription.provisioning.authorization.revoked.v1',
      authorizationId: body.authorizationId,
      revocationVersion: Number(body.revocationVersion),
      revokedAt: body.revokedAt,
      reasonCode: body.reasonCode,
      reference: body.reference,
      payload: body.payload,
    });
  }

  @Get()
  @RequireEdgePermissions('platform:provisioning_requests:read')
  list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('accountId') accountId?: string,
    @Query('productId') productId?: string,
    @Query('subscriptionId') subscriptionId?: string,
    @Query('environmentSlot') environmentSlot?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.listRequests.execute({
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
      status,
      accountId,
      productId,
      subscriptionId,
      environmentSlot,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get(':id')
  @RequireEdgePermissions('platform:provisioning_requests:read')
  get(@Param('id') id: string) {
    return this.getRequest.execute(id);
  }

  @Get(':id/history')
  @RequireEdgePermissions('platform:provisioning_requests:read_history')
  history(@Param('id') id: string) {
    return this.getHistory.execute(id);
  }

  @Get(':id/authorization')
  @RequireEdgePermissions('platform:provisioning_authorizations:read')
  async authorization(@Param('id') id: string) {
    const request = await this.getRequest.execute(id);
    if (!request.authorizationRowId) {
      throw new DomainError(
        ErrorCode.RESOURCE_NOT_FOUND,
        'No authorization summary linked to this request',
      );
    }
    return this.getAuthorization.execute(request.authorizationRowId);
  }

  @Post(':id/cancel')
  @RequireEdgePermissions('platform:provisioning_requests:cancel')
  cancel(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.cancelRequest.execute({
      actorId: actorId(req),
      requestId: id,
      reason: body?.reason ?? '',
    });
  }
}
