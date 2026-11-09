import { Body, Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  BootstrapWorkspaceUseCase,
  GetActiveWorkspaceUseCase,
  ListAvailableWorkspacesUseCase,
  RenewWorkspaceUseCase,
  RevokeAllWorkspacesUseCase,
  RevokeWorkspaceUseCase,
  SwitchWorkspaceUseCase,
} from '../../application/workspace/workspace.use-cases.js';

@ApiTags('edge-workspaces')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgePermissionGuard)
@Controller('edge/workspaces')
export class EdgeWorkspacesController {
  constructor(
    private readonly edgeContext: EdgeContextService,
    private readonly listAvailable: ListAvailableWorkspacesUseCase,
    private readonly switchWorkspace: SwitchWorkspaceUseCase,
    private readonly bootstrap: BootstrapWorkspaceUseCase,
    private readonly getActive: GetActiveWorkspaceUseCase,
    private readonly renew: RenewWorkspaceUseCase,
    private readonly revoke: RevokeWorkspaceUseCase,
    private readonly revokeAll: RevokeAllWorkspacesUseCase,
  ) {}

  @Get()
  @RequireEdgePermissions('workspace:read')
  async list() {
    const ctx = this.edgeContext.getOrThrow();
    return { data: await this.listAvailable.execute(ctx.administratorId!) };
  }

  @Post('switch')
  @RequireEdgePermissions('workspace:switch')
  async switch(@Body() body: { verticalId: string }) {
    const ctx = this.edgeContext.getOrThrow();
    const result = await this.switchWorkspace.execute({
      administratorId: ctx.administratorId!,
      verticalId: body.verticalId,
    });
    return { data: { session: result.session, token: result.token } };
  }

  @Post('bootstrap')
  @RequireEdgePermissions('workspace:switch')
  async bootstrapWorkspace(@Body() body: { verticalId: string }) {
    const ctx = this.edgeContext.getOrThrow();
    const result = await this.bootstrap.execute({
      administratorId: ctx.administratorId!,
      verticalId: body.verticalId,
    });
    return { data: { session: result.session, token: result.token } };
  }

  @Get('active')
  @RequireEdgePermissions('workspace:read')
  @RequireEdgeWorkspace()
  @UseGuards(EdgeWorkspaceGuard)
  async active(
    @Headers('x-edge-workspace-session') workspaceToken?: string,
    @Headers('x-workspace-session') fallbackToken?: string,
  ) {
    const ctx = this.edgeContext.getOrThrow();
    const token = workspaceToken ?? fallbackToken ?? '';
    return {
      data: await this.getActive.execute({
        administratorId: ctx.administratorId!,
        workspaceToken: token,
      }),
    };
  }

  @Post('renew')
  @RequireEdgePermissions('workspace:switch')
  @RequireEdgeWorkspace()
  @UseGuards(EdgeWorkspaceGuard)
  async renewSession(
    @Headers('x-edge-workspace-session') workspaceToken?: string,
    @Headers('x-workspace-session') fallbackToken?: string,
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.renew.execute({
        administratorId: ctx.administratorId!,
        workspaceToken: workspaceToken ?? fallbackToken ?? '',
      }),
    };
  }

  @Post('revoke')
  @RequireEdgePermissions('security:sessions:revoke')
  async revokeSession(
    @Headers('x-edge-workspace-session') workspaceToken?: string,
    @Headers('x-workspace-session') fallbackToken?: string,
    @Body() body?: { reason?: string },
  ) {
    const ctx = this.edgeContext.getOrThrow();
    return {
      data: await this.revoke.execute({
        administratorId: ctx.administratorId!,
        workspaceToken: workspaceToken ?? fallbackToken ?? '',
        reason: body?.reason,
      }),
    };
  }

  @Post('revoke-all')
  @RequireEdgePermissions('security:sessions:revoke')
  async revokeAllSessions(@Body() body?: { reason?: string }) {
    const ctx = this.edgeContext.getOrThrow();
    const count = await this.revokeAll.execute(
      ctx.administratorId!,
      body?.reason ?? 'revoke-all',
    );
    return { data: { revoked: count } };
  }
}
