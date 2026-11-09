import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, REQUIRE_WRITABLE_TENANT_KEY, IS_EDGE_ROUTE_KEY } from './decorators.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import { TENANT_REGISTRY_PORT } from '../../modules/identity/domain/ports/tenant-registry.port.js';
import type { TenantRegistryPort } from '../../modules/identity/domain/ports/tenant-registry.port.js';
import { isTenantWritable } from '../../modules/identity/domain/tenant/tenant.entity.js';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class TenantWritableGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
    @Inject(TENANT_REGISTRY_PORT) private readonly tenantRegistry: TenantRegistryPort,
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

    const requiresWritable = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_WRITABLE_TENANT_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<{ method: string }>();
    const isMutation = MUTATION_METHODS.has(request.method);

    if (!requiresWritable && !isMutation) {
      return true;
    }

    const ctx = this.tenantContext.get();
    if (!ctx.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    const tenant = await this.tenantRegistry.findById(ctx.tenantId);
    if (!tenant || !isTenantWritable(tenant.status)) {
      throw new ForbiddenException(`Tenant is not writable: ${tenant?.status ?? 'UNKNOWN'}`);
    }

    return true;
  }
}
