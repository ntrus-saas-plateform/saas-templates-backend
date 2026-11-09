import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './decorators.js';
import { EdgeJwtValidationService } from './edge-jwt-validation.service.js';
import { EdgeContextService } from './edge-context.service.js';
import { ADMINISTRATOR_REPOSITORY_PORT } from '../../modules/edge/domain/ports/administrator-repository.port.js';
import type { AdministratorRepositoryPort } from '../../modules/edge/domain/ports/administrator-repository.port.js';
import { isAdministratorAuthenticatable } from '../../modules/edge/domain/administrator/platform-administrator.entity.js';
import { ROLE_REPOSITORY_PORT } from '../../modules/edge/domain/ports/role-repository.port.js';
import type { RoleRepositoryPort } from '../../modules/edge/domain/ports/role-repository.port.js';

@Injectable()
export class EdgeAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtValidation: EdgeJwtValidationService,
    private readonly edgeContext: EdgeContextService,
    @Inject(ADMINISTRATOR_REPOSITORY_PORT)
    private readonly administrators: AdministratorRepositoryPort,
    @Inject(ROLE_REPOSITORY_PORT)
    private readonly roles: RoleRepositoryPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const user = await this.jwtValidation.validateToken(token);
      const administrator = await this.administrators.findByExternalIdentityId(user.subjectId);

      if (!administrator || !isAdministratorAuthenticatable(administrator.status)) {
        throw new UnauthorizedException('Edge administrator is not active');
      }

      // Global roles only — vertical permissions resolve in EdgeWorkspaceGuard (ADR-005/006).
      const assignments = await this.roles.listActiveAssignmentsForAdministrator(
        administrator.id,
        null,
      );
      const roleIds = assignments.map((a) => a.roleId);
      const permissions = roleIds.length
        ? await this.roles.findPermissionCodesByRoleIds(roleIds)
        : [];

      (request as Request & { edgeUser: unknown }).edgeUser = user;

      this.edgeContext.set({
        administratorId: administrator.id,
        subjectId: user.subjectId,
        email: administrator.email,
        permissions: [...permissions],
        workspaceSessionId: null,
        verticalId: null,
        membershipId: null,
        authenticationAcr: user.authenticationAcr,
        tokenId: user.tokenId,
      });

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      if (process.env.NODE_ENV !== 'production') {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`[EdgeAuthGuard] token rejected: ${reason}`);
      }
      throw new UnauthorizedException('Invalid or expired Edge token');
    }
  }

  private extractBearerToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice(7);
  }
}
