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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  EdgeRoute,
  RequireEdgePermissions,
  RequireEdgeWorkspace,
} from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import { EdgeWorkspaceGuard } from '../../../../shared/auth/edge-workspace.guard.js';
import { EdgeContextService } from '../../../../shared/auth/edge-context.service.js';
import {
  ActivateVerticalUseCase,
  ArchiveVerticalUseCase,
  CheckVerticalReadinessUseCase,
  CreateVerticalUseCase,
  DeactivateVerticalUseCase,
  DeprecateVerticalUseCase,
  GetVerticalHistoryUseCase,
  GetVerticalLifecycleEventsUseCase,
  GetVerticalUseCase,
  ListVerticalsUseCase,
  ReinstateVerticalUseCase,
  RetireVerticalUseCase,
  SuspendVerticalUseCase,
  UpdateVerticalUseCase,
} from '../../application/vertical/vertical.use-cases.js';
import {
  ActivateMembershipUseCase,
  InviteMembershipUseCase,
  ListMembershipsByVerticalUseCase,
  ReinstateMembershipUseCase,
  RevokeMembershipUseCase,
  SuspendMembershipUseCase,
} from '../../application/membership/membership.use-cases.js';
import {
  ActivateConfigurationUseCase,
  GetWorkspaceConfigurationUseCase,
  ListConfigurationHistoryUseCase,
  UpdateConfigurationDraftUseCase,
  ValidateConfigurationUseCase,
} from '../../application/configuration/configuration.use-cases.js';
import { VerticalStatus } from '../../domain/vertical/vertical.entity.js';

@ApiTags('edge-verticals')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgePermissionGuard)
@Controller('edge/verticals')
export class EdgeVerticalsController {
  constructor(
    private readonly edgeContext: EdgeContextService,
    private readonly create: CreateVerticalUseCase,
    private readonly update: UpdateVerticalUseCase,
    private readonly get: GetVerticalUseCase,
    private readonly list: ListVerticalsUseCase,
    private readonly readiness: CheckVerticalReadinessUseCase,
    private readonly activate: ActivateVerticalUseCase,
    private readonly suspend: SuspendVerticalUseCase,
    private readonly reinstate: ReinstateVerticalUseCase,
    private readonly deactivate: DeactivateVerticalUseCase,
    private readonly deprecate: DeprecateVerticalUseCase,
    private readonly retire: RetireVerticalUseCase,
    private readonly archive: ArchiveVerticalUseCase,
    private readonly history: GetVerticalHistoryUseCase,
    private readonly lifecycleEvents: GetVerticalLifecycleEventsUseCase,
    private readonly inviteMembership: InviteMembershipUseCase,
    private readonly listMemberships: ListMembershipsByVerticalUseCase,
    private readonly getConfig: GetWorkspaceConfigurationUseCase,
    private readonly updateDraft: UpdateConfigurationDraftUseCase,
    private readonly validateConfig: ValidateConfigurationUseCase,
    private readonly activateConfig: ActivateConfigurationUseCase,
    private readonly configHistory: ListConfigurationHistoryUseCase,
  ) {}

  @Get()
  @RequireEdgePermissions('platform:verticals:read')
  async listVerticals(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: VerticalStatus,
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

  @Post()
  @RequireEdgePermissions('platform:verticals:create')
  async createVertical(
    @Body()
    body: {
      code: string;
      slug: string;
      displayName: string;
      description?: string | null;
      iconRef?: string | null;
      visualIdentityRef?: string | null;
      keycloakOrganizationId?: string | null;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return { data: await this.create.execute({ actorId: ctx.administratorId!, ...body }) };
  }

  @Get(':id')
  @RequireEdgePermissions('platform:verticals:read')
  async getVertical(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.get.execute(id) };
  }

  @Patch(':id')
  @RequireEdgePermissions('platform:verticals:update')
  async patchVertical(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      displayName?: string;
      description?: string | null;
      iconRef?: string | null;
      visualIdentityRef?: string | null;
      keycloakOrganizationId?: string | null;
    },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return { data: await this.update.execute({ id, actorId: ctx.administratorId!, ...body }) };
  }

  @Get(':id/readiness')
  @RequireEdgePermissions('platform:verticals:read')
  async readinessCheck(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.readiness.execute(id) };
  }

  @Post(':id/activate')
  @RequireEdgePermissions('platform:verticals:activate')
  async activateVertical(@Param('id', ParseUUIDPipe) id: string) {
    const ctx = this.edgeContext.getOrThrow();
    return { data: await this.activate.execute({ id, actorId: ctx.administratorId! }) };
  }

  @Post(':id/suspend')
  @RequireEdgePermissions('platform:verticals:suspend')
  async suspendVertical(
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
  @RequireEdgePermissions('platform:verticals:activate')
  async reinstateVertical(@Param('id', ParseUUIDPipe) id: string) {
    const ctx = this.edgeContext.getOrThrow();
    return { data: await this.reinstate.execute({ id, actorId: ctx.administratorId! }) };
  }

  @Post(':id/deactivate')
  @RequireEdgePermissions('platform:verticals:suspend')
  async deactivateVertical(
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

  @Post(':id/deprecate')
  @RequireEdgePermissions('platform:verticals:suspend')
  async deprecateVertical(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.deprecate.execute({
        id,
        actorId: ctx.administratorId!,
        reason: body.reason,
      }),
    };
  }

  @Post(':id/retire')
  @RequireEdgePermissions('platform:verticals:suspend')
  async retireVertical(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.retire.execute({
        id,
        actorId: ctx.administratorId!,
        reason: body.reason,
      }),
    };
  }

  @Post(':id/archive')
  @RequireEdgePermissions('platform:verticals:suspend')
  async archiveVertical(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.archive.execute({
        id,
        actorId: ctx.administratorId!,
        reason: body.reason,
      }),
    };
  }

  @Get(':id/history')
  @RequireEdgePermissions('audit:read')
  async verticalHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const result = await this.history.execute(id, Number(page) || 1, Number(limit) || 50);
    return { data: result.items, pagination: { total: result.total } };
  }

  @Get(':id/lifecycle-events')
  @RequireEdgePermissions('platform:verticals:read')
  async verticalLifecycleEvents(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const result = await this.lifecycleEvents.execute(
      id,
      Number(page) || 1,
      Number(limit) || 50,
    );
    return { data: result.items, pagination: { total: result.total } };
  }

  @Get(':id/memberships')
  @RequireEdgePermissions('membership:read')
  async memberships(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.listMemberships.execute(id) };
  }

  @Post(':id/memberships/invite')
  @RequireEdgePermissions('membership:invite')
  async inviteMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { administratorId: string },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.inviteMembership.execute({
        actorId: ctx.administratorId!,
        verticalId: id,
        administratorId: body.administratorId,
      }),
    };
  }

  @Get(':id/configuration')
  @RequireEdgePermissions('workspace:configuration:read')
  @RequireEdgeWorkspace()
  @UseGuards(EdgeWorkspaceGuard)
  @ApiOperation({ summary: 'Get active/draft workspace configuration' })
  async configuration(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.getConfig.execute(id) };
  }

  @Put(':id/configuration/draft')
  @RequireEdgePermissions('workspace:configuration:update')
  @RequireEdgeWorkspace()
  @UseGuards(EdgeWorkspaceGuard)
  async updateConfigurationDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { config: Record<string, unknown>; changeReason?: string },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.updateDraft.execute({
        verticalId: id,
        actorId: ctx.administratorId!,
        config: body.config,
        changeReason: body.changeReason,
      }),
    };
  }

  @Post(':id/configuration/validate')
  @RequireEdgePermissions('workspace:configuration:update')
  @RequireEdgeWorkspace()
  @UseGuards(EdgeWorkspaceGuard)
  async validateConfiguration(@Param('id', ParseUUIDPipe) id: string) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.validateConfig.execute({
        verticalId: id,
        actorId: ctx.administratorId!,
      }),
    };
  }

  @Post(':id/configuration/activate')
  @RequireEdgePermissions('workspace:configuration:update')
  @RequireEdgeWorkspace()
  @UseGuards(EdgeWorkspaceGuard)
  async activateConfiguration(@Param('id', ParseUUIDPipe) id: string) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.activateConfig.execute({
        verticalId: id,
        actorId: ctx.administratorId!,
      }),
    };
  }

  @Get(':id/configuration/history')
  @RequireEdgePermissions('workspace:configuration:read')
  async configurationHistory(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.configHistory.execute(id) };
  }
}

@ApiTags('edge-memberships')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgePermissionGuard)
@Controller('edge/memberships')
export class EdgeMembershipsController {
  constructor(
    private readonly edgeContext: EdgeContextService,
    private readonly activate: ActivateMembershipUseCase,
    private readonly suspend: SuspendMembershipUseCase,
    private readonly reinstate: ReinstateMembershipUseCase,
    private readonly revoke: RevokeMembershipUseCase,
  ) {}

  @Post(':id/activate')
  @RequireEdgePermissions('membership:activate')
  async activateMembership(@Param('id', ParseUUIDPipe) id: string) {
    const ctx = this.edgeContext.getOrThrow();
    return { data: await this.activate.execute({ id, actorId: ctx.administratorId! }) };
  }

  @Post(':id/suspend')
  @RequireEdgePermissions('membership:suspend')
  async suspendMembership(
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
  @RequireEdgePermissions('membership:reinstate')
  async reinstateMembership(@Param('id', ParseUUIDPipe) id: string) {
    const ctx = this.edgeContext.getOrThrow();
    return { data: await this.reinstate.execute({ id, actorId: ctx.administratorId! }) };
  }

  @Post(':id/revoke')
  @RequireEdgePermissions('membership:revoke')
  async revokeMembership(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.revoke.execute({
        id,
        actorId: ctx.administratorId!,
        reason: body.reason,
      }),
    };
  }
}
