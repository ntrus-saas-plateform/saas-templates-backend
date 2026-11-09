import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EDGE_PERMISSIONS_KEY, IS_PUBLIC_KEY } from './decorators.js';
import { EdgeContextService } from './edge-context.service.js';
import { EdgeMetricsService } from '../observability/edge-metrics.service.js';

@Injectable()
export class EdgePermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly edgeContext: EdgeContextService,
    private readonly edgeMetrics: EdgeMetricsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[]>(EDGE_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length) {
      this.edgeMetrics.recordAuthorizationDenial();
      throw new ForbiddenException('Edge route requires explicit permission metadata');
    }

    const ctx = this.edgeContext.get();
    const granted = new Set(ctx.permissions);
    const ok = required.some((permission) => granted.has(permission));
    if (!ok) {
      this.edgeMetrics.recordAuthorizationDenial();
      throw new ForbiddenException('Insufficient Edge permissions');
    }
    return true;
  }
}
