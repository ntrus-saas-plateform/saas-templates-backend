import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EdgeRoute, RequireEdgePermissions } from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import { EdgeContextService } from '../../../../shared/auth/edge-context.service.js';
import {
  ApproveEmergencyAccessUseCase,
  CreateDelegationUseCase,
  GetMfaStateUseCase,
  ListDelegationsUseCase,
  ListSecurityAuditEventsUseCase,
  ListSecuritySessionsUseCase,
  RequestEmergencyAccessUseCase,
  RevokeAllSecuritySessionsUseCase,
  RevokeDelegationUseCase,
  RevokeEmergencyAccessUseCase,
  RevokeSecuritySessionUseCase,
} from '../../application/security/security.use-cases.js';

@ApiTags('edge-security')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgePermissionGuard)
@Controller('edge/security')
export class EdgeSecurityController {
  constructor(
    private readonly edgeContext: EdgeContextService,
    private readonly listSessions: ListSecuritySessionsUseCase,
    private readonly revokeSession: RevokeSecuritySessionUseCase,
    private readonly revokeAllSessions: RevokeAllSecuritySessionsUseCase,
    private readonly listEvents: ListSecurityAuditEventsUseCase,
    private readonly mfaState: GetMfaStateUseCase,
    private readonly requestEmergency: RequestEmergencyAccessUseCase,
    private readonly approveEmergency: ApproveEmergencyAccessUseCase,
    private readonly revokeEmergency: RevokeEmergencyAccessUseCase,
    private readonly listDelegations: ListDelegationsUseCase,
    private readonly createDelegation: CreateDelegationUseCase,
    private readonly revokeDelegation: RevokeDelegationUseCase,
  ) {}

  @Get('sessions')
  @RequireEdgePermissions('security:sessions:read')
  async sessions(@Query('administratorId') administratorId?: string) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.listSessions.execute(administratorId ?? ctx.administratorId!),
    };
  }

  @Post('sessions/:id/revoke')
  @RequireEdgePermissions('security:sessions:revoke')
  async revokeOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body?: { reason?: string },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.revokeSession.execute({
        sessionId: id,
        actorId: ctx.administratorId!,
        reason: body?.reason,
      }),
    };
  }

  @Post('sessions/revoke-all')
  @RequireEdgePermissions('security:sessions:revoke')
  async revokeAll(@Body() body?: { administratorId?: string; reason?: string }) {
    const ctx = this.edgeContext.getOrThrow();
    const count = await this.revokeAllSessions.execute(
      body?.administratorId ?? ctx.administratorId!,
      body?.reason,
    );
    return { data: { revoked: count } };
  }

  @Get('events')
  @RequireEdgePermissions('audit:read')
  async events(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('eventType') eventType?: string,
    @Query('actorId') actorId?: string,
    @Query('verticalId') verticalId?: string,
  ) {
    const result = await this.listEvents.execute({
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 50, 200),
      eventType,
      actorId,
      verticalId,
    });
    return { data: result.items, pagination: { total: result.total } };
  }

  @Get('mfa')
  @RequireEdgePermissions('security:policies:read')
  async mfa() {
    const ctx = this.edgeContext.getOrThrow();
    return { data: await this.mfaState.execute(ctx.administratorId!) };
  }

  @Post('emergency-access')
  @RequireEdgePermissions('emergency-access:request')
  async request(
    @Body() body: { justification: string; scope?: Record<string, unknown> },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.requestEmergency.execute({
        requesterId: ctx.administratorId!,
        justification: body.justification,
        scope: body.scope,
      }),
    };
  }

  @Post('emergency-access/:id/approve')
  @RequireEdgePermissions('emergency-access:approve')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body?: { ttlMinutes?: number },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.approveEmergency.execute({
        id,
        approverId: ctx.administratorId!,
        ttlMinutes: body?.ttlMinutes,
      }),
    };
  }

  @Post('emergency-access/:id/revoke')
  @RequireEdgePermissions('emergency-access:revoke')
  async revokeEmergencyGrant(@Param('id', ParseUUIDPipe) id: string) {
    const ctx = this.edgeContext.getOrThrow();
    return { data: await this.revokeEmergency.execute({ id, actorId: ctx.administratorId! }) };
  }

  @Get('delegations')
  @RequireEdgePermissions('delegation:read')
  async delegations() {
    const ctx = this.edgeContext.getOrThrow();
    return { data: await this.listDelegations.execute(ctx.administratorId!) };
  }

  @Post('delegations')
  @RequireEdgePermissions('delegation:create')
  async createDelegationEndpoint(
    @Body()
    body: {
      granteeId: string;
      scope: Record<string, unknown>;
      permittedOperations: string[];
      expiresAt: string;
      justification?: string;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.createDelegation.execute({
        grantorId: ctx.administratorId!,
        granteeId: body.granteeId,
        scope: body.scope,
        permittedOperations: body.permittedOperations,
        expiresAt: new Date(body.expiresAt),
        justification: body.justification,
      }),
    };
  }

  @Post('delegations/:id/revoke')
  @RequireEdgePermissions('delegation:revoke')
  async revokeDelegationEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    const ctx = this.edgeContext.getOrThrow();
    return { data: await this.revokeDelegation.execute({ id, actorId: ctx.administratorId! }) };
  }
}
