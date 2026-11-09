import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, REQUIRE_MODULE_KEY, IS_EDGE_ROUTE_KEY } from './decorators.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import { CapabilityResolverService } from '../authorization/capability-resolver.service.js';

/**
 * Enforces plan/module entitlements when a route declares @RequireModule(...).
 * Runs after Auth/Tenant so tenantId is available. Does not replace PermissionGuard.
 */
@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
    private readonly capabilityResolver: CapabilityResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const isEdgeRoute = this.reflector.getAllAndOverride<boolean>(IS_EDGE_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isEdgeRoute) return true;

    const moduleKey = this.reflector.getAllAndOverride<string>(REQUIRE_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!moduleKey) return true;

    const ctx = this.tenantContext.get();
    if (!ctx.tenantId) return true;

    await this.capabilityResolver.assertModuleEnabled(ctx.tenantId, moduleKey);
    return true;
  }
}
