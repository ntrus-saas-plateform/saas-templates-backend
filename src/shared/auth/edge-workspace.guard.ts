import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY, REQUIRE_EDGE_WORKSPACE_KEY } from './decorators.js';
import { EdgeContextService } from './edge-context.service.js';
import { WORKSPACE_SESSION_REPOSITORY_PORT } from '../../modules/edge/domain/ports/workspace-session-repository.port.js';
import type { WorkspaceSessionRepositoryPort } from '../../modules/edge/domain/ports/workspace-session-repository.port.js';
import { ADMINISTRATOR_REPOSITORY_PORT } from '../../modules/edge/domain/ports/administrator-repository.port.js';
import type { AdministratorRepositoryPort } from '../../modules/edge/domain/ports/administrator-repository.port.js';
import { MEMBERSHIP_REPOSITORY_PORT } from '../../modules/edge/domain/ports/membership-repository.port.js';
import type { MembershipRepositoryPort } from '../../modules/edge/domain/ports/membership-repository.port.js';
import { VERTICAL_REPOSITORY_PORT } from '../../modules/edge/domain/ports/vertical-repository.port.js';
import type { VerticalRepositoryPort } from '../../modules/edge/domain/ports/vertical-repository.port.js';
import {
  assertWorkspaceSessionValid,
  hashWorkspaceSessionToken,
} from '../../modules/edge/domain/session/workspace-session.entity.js';
import { ROLE_REPOSITORY_PORT } from '../../modules/edge/domain/ports/role-repository.port.js';
import type { RoleRepositoryPort } from '../../modules/edge/domain/ports/role-repository.port.js';
import { EdgeMetricsService } from '../observability/edge-metrics.service.js';

@Injectable()
export class EdgeWorkspaceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly edgeContext: EdgeContextService,
    private readonly edgeMetrics: EdgeMetricsService,
    @Inject(WORKSPACE_SESSION_REPOSITORY_PORT)
    private readonly sessions: WorkspaceSessionRepositoryPort,
    @Inject(ADMINISTRATOR_REPOSITORY_PORT)
    private readonly administrators: AdministratorRepositoryPort,
    @Inject(MEMBERSHIP_REPOSITORY_PORT)
    private readonly memberships: MembershipRepositoryPort,
    @Inject(VERTICAL_REPOSITORY_PORT)
    private readonly verticals: VerticalRepositoryPort,
    @Inject(ROLE_REPOSITORY_PORT)
    private readonly roles: RoleRepositoryPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_EDGE_WORKSPACE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const raw =
      (request.headers['x-edge-workspace-session'] as string | undefined) ??
      (request.headers['x-workspace-session'] as string | undefined);
    if (!raw?.trim()) {
      this.edgeMetrics.recordInvalidWorkspaceContext();
      throw new UnauthorizedException('Missing Edge workspace session');
    }

    const session = await this.sessions.findByTokenHash(hashWorkspaceSessionToken(raw));
    if (!session) {
      this.edgeMetrics.recordInvalidWorkspaceContext();
      throw new UnauthorizedException('Invalid Edge workspace session');
    }

    const edgeCtx = this.edgeContext.get();
    if (!edgeCtx.administratorId) {
      throw new UnauthorizedException('Edge administrator context required');
    }

    const [administrator, membership, vertical] = await Promise.all([
      this.administrators.findById(edgeCtx.administratorId),
      this.memberships.findById(session.membershipId),
      this.verticals.findById(session.verticalId),
    ]);

    if (!administrator || !membership || !vertical) {
      throw new UnauthorizedException('Workspace session references missing entities');
    }

    try {
      assertWorkspaceSessionValid({ session, administrator, membership, vertical });
    } catch {
      this.edgeMetrics.recordInvalidWorkspaceContext();
      throw new ForbiddenException('Workspace session is not valid for the current context');
    }

    if (session.administratorId !== edgeCtx.administratorId) {
      throw new ForbiddenException('Workspace session does not belong to the authenticated admin');
    }

    // Includes GLOBAL (scope_vertical_id NULL) + this vertical only — never other verticals.
    const assignments = await this.roles.listActiveAssignmentsForAdministrator(
      administrator.id,
      vertical.id,
    );
    const roleIds = [...new Set(assignments.map((a) => a.roleId))];
    const permissions = roleIds.length
      ? await this.roles.findPermissionCodesByRoleIds(roleIds)
      : [];

    this.edgeContext.set({
      workspaceSessionId: session.id,
      verticalId: vertical.id,
      membershipId: membership.id,
      permissions: [...permissions],
    });

    return true;
  }
}
