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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  EdgeRoute,
  Public,
  RequireEdgePermissions,
} from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import { EdgeContextService } from '../../../../shared/auth/edge-context.service.js';
import {
  AcceptInvitationUseCase,
  DeactivateAdministratorUseCase,
  GetAdministratorByIdUseCase,
  GetAdministratorMeUseCase,
  InviteAdministratorUseCase,
  ListAdministratorsUseCase,
  ReinstateAdministratorUseCase,
  SuspendAdministratorUseCase,
  UpdateAdministratorProfileUseCase,
} from '../../application/administrator/administrator.use-cases.js';
import { ListMembershipsByAdministratorUseCase } from '../../application/membership/membership.use-cases.js';
import { ResolveEffectivePermissionsUseCase } from '../../application/authorization/authorization.use-cases.js';
import { PlatformAdministratorStatus } from '../../domain/administrator/platform-administrator.entity.js';

@ApiTags('edge-administrators')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgePermissionGuard)
@Controller('edge/administrators')
export class EdgeAdministratorsController {
  constructor(
    private readonly edgeContext: EdgeContextService,
    private readonly invite: InviteAdministratorUseCase,
    private readonly getMe: GetAdministratorMeUseCase,
    private readonly getById: GetAdministratorByIdUseCase,
    private readonly list: ListAdministratorsUseCase,
    private readonly updateProfile: UpdateAdministratorProfileUseCase,
    private readonly suspend: SuspendAdministratorUseCase,
    private readonly reinstate: ReinstateAdministratorUseCase,
    private readonly deactivate: DeactivateAdministratorUseCase,
    private readonly listMemberships: ListMembershipsByAdministratorUseCase,
    private readonly resolvePermissions: ResolveEffectivePermissionsUseCase,
  ) {}

  @Get('me')
  @RequireEdgePermissions('platform:administrators:read', 'workspace:read')
  @ApiOperation({ summary: 'Get current Edge administrator' })
  async me() {
    const ctx = this.edgeContext.getOrThrow();
    const data = await this.getMe.execute(ctx.administratorId!);
    return { data };
  }

  @Get()
  @RequireEdgePermissions('platform:administrators:read')
  @ApiOperation({ summary: 'List Edge administrators' })
  async listAdministrators(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: PlatformAdministratorStatus,
    @Query('search') search?: string,
  ) {
    const result = await this.list.execute({
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
      status,
      search,
    });
    return { data: result.items, pagination: { total: result.total } };
  }

  @Post('invite')
  @RequireEdgePermissions('platform:administrators:invite')
  @ApiOperation({ summary: 'Invite an Edge administrator' })
  async inviteAdministrator(
    @Body()
    body: {
      email: string;
      displayName: string;
      verticalIds?: string[];
      roleCodes?: string[];
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    const result = await this.invite.execute({
      actorId: ctx.administratorId!,
      email: body.email,
      displayName: body.displayName,
      verticalIds: body.verticalIds,
      roleCodes: body.roleCodes,
    });
    return {
      data: {
        administrator: result.administrator,
        invitationId: result.invitationId,
        token: result.token,
      },
    };
  }

  @Get(':id')
  @RequireEdgePermissions('platform:administrators:read')
  async getAdministrator(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.getById.execute(id) };
  }

  @Patch(':id')
  @RequireEdgePermissions('platform:administrators:update')
  async patchAdministrator(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      displayName?: string;
      preferredLanguage?: string;
      timezone?: string;
      profilePictureRef?: string | null;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.updateProfile.execute({ id, actorId: ctx.administratorId!, ...body }),
    };
  }

  @Post(':id/suspend')
  @RequireEdgePermissions('platform:administrators:suspend')
  async suspendAdministrator(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.suspend.execute({
        id,
        actorId: ctx.administratorId!,
        reason: body.reason,
      }),
    };
  }

  @Post(':id/reinstate')
  @RequireEdgePermissions('platform:administrators:suspend')
  async reinstateAdministrator(@Param('id', ParseUUIDPipe) id: string) {
    const ctx = this.edgeContext.getOrThrow();
    return { data: await this.reinstate.execute({ id, actorId: ctx.administratorId! }) };
  }

  @Post(':id/deactivate')
  @RequireEdgePermissions('platform:administrators:deactivate')
  async deactivateAdministrator(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.deactivate.execute({
        id,
        actorId: ctx.administratorId!,
        reason: body.reason,
      }),
    };
  }

  @Get(':id/memberships')
  @RequireEdgePermissions('membership:read')
  async memberships(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.listMemberships.execute(id) };
  }

  @Get(':id/effective-permissions')
  @RequireEdgePermissions('authorization:roles:read')
  async effectivePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('verticalId') verticalId?: string,
  ) {
    return { data: await this.resolvePermissions.execute({ administratorId: id, verticalId }) };
  }
}

@ApiTags('edge-invitations')
@EdgeRoute()
@Controller('edge/invitations')
export class EdgeInvitationsController {
  constructor(private readonly acceptInvitation: AcceptInvitationUseCase) {}

  @Post('accept')
  @Public()
  @ApiOperation({ summary: 'Accept Edge invitation (single-use token)' })
  async accept(
    @Body()
    body: {
      token: string;
      externalIdentityId: string;
      displayName?: string;
    },
  ) {
    const data = await this.acceptInvitation.execute(body);
    return { data };
  }
}
