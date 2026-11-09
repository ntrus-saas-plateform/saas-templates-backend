import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, REQUIRE_STEP_UP_KEY, IS_EDGE_ROUTE_KEY } from './decorators.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';

@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
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

    const requiredAcr = this.reflector.getAllAndOverride<string | undefined>(REQUIRE_STEP_UP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredAcr) return true;

    const ctx = this.tenantContext.get();
    const currentLevel = parseAcrLevel(ctx.authenticationAcr);
    const requiredLevel = parseAcrLevel(requiredAcr);
    if (currentLevel < requiredLevel) {
      throw new ForbiddenException('Step-up authentication required');
    }
    return true;
  }
}

function parseAcrLevel(acr: string | null): number {
  if (!acr) return 0;
  if (acr === '1' || acr.includes('loa2') || acr.includes('phr')) return 1;
  const numeric = Number(acr);
  return Number.isFinite(numeric) ? numeric : 0;
}
