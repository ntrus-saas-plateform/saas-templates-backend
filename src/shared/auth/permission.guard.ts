import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY, ROLES_KEY, IS_CUSTOMER_ROUTE_KEY } from './decorators.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { IdentityMetricsService } from '../observability/identity-metrics.service.js';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
    private readonly authorizationService: AuthorizationService,
    private readonly identityMetrics: IdentityMetricsService,
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const isCustomerRoute = this.reflector.getAllAndOverride<boolean>(IS_CUSTOMER_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isCustomerRoute) return true;

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions?.length && !requiredRoles?.length) {
      if (this.config.AUTH_PERMISSION_DENY_BY_DEFAULT) {
        this.identityMetrics.recordPermissionDenied();
        throw new ForbiddenException('Route requires explicit permission or role metadata');
      }
      return true;
    }

    const ctx = this.tenantContext.get();

    if (requiredRoles?.length) {
      const hasRole = requiredRoles.some((role) => ctx.roles.includes(role));
      if (!hasRole) {
        this.identityMetrics.recordPermissionDenied();
        throw new ForbiddenException('Insufficient role');
      }
      if (
        requiredRoles.includes('platform-admin') &&
        ctx.clientId !== this.config.KEYCLOAK_ADMIN_CLIENT_ID
      ) {
        this.identityMetrics.recordPermissionDenied();
        throw new ForbiddenException('platform-admin role requires the platform-admin client');
      }
    }

    if (requiredPermissions?.length) {
      const hasPermission = await this.authorizationService.hasAnyPermission(requiredPermissions);
      if (!hasPermission) {
        this.identityMetrics.recordPermissionDenied();
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    return true;
  }
}
