/**
 * TenantGuard — enforces tenant-level accessibility before any tenant-scoped handler.
 *
 * Policy summary:
 *  - ACTIVE / READ_ONLY  → always accessible (reads + writes controlled by TenantWritableGuard)
 *  - SUSPENDED           → reads allowed when TENANT_SUSPENDED_ALLOW_READS=true; mutations
 *                          still blocked by TenantWritableGuard (isTenantWritable returns false)
 *  - LOCKED              → always denied with explicit "Tenant is locked" message
 *  - FAILED / ARCHIVED / DELETED / DEACTIVATING / PROVISIONING → denied (isTenantAccessible=false)
 *
 * Platform-admin break-glass: admin routes require `platform-admin` role which is checked by
 * RolesGuard. The platform admin's own JWT tenant is what TenantGuard sees — admin cross-tenant
 * calls (e.g. POST /admin/tenants/:id/status) work because the JWT carries the admin's own tenant.
 * No bypass is needed in TenantGuard.
 */
import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, IS_CUSTOMER_ROUTE_KEY, IS_EDGE_ROUTE_KEY } from './decorators.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import { TENANT_REGISTRY_PORT } from '../../modules/identity/domain/ports/tenant-registry.port.js';
import type { TenantRegistryPort } from '../../modules/identity/domain/ports/tenant-registry.port.js';
import { USER_TENANT_MEMBERSHIP_PORT } from '../../modules/identity/domain/ports/user-tenant-membership.port.js';
import type { UserTenantMembershipPort } from '../../modules/identity/domain/ports/user-tenant-membership.port.js';
import { isTenantAccessible, TenantStatus } from '../../modules/identity/domain/tenant/tenant.entity.js';
import { accessDeniedError } from '../../core/domain/errors/access-denied.js';
import { IdentityMetricsService } from '../observability/identity-metrics.service.js';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
    @Inject(TENANT_REGISTRY_PORT) private readonly tenantRegistry: TenantRegistryPort,
    @Inject(USER_TENANT_MEMBERSHIP_PORT)
    private readonly userTenantMembership: UserTenantMembershipPort,
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

    const isEdgeRoute = this.reflector.getAllAndOverride<boolean>(IS_EDGE_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isEdgeRoute) return true;

    const ctx = this.tenantContext.get();
    if (!ctx.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    const tenant = await this.tenantRegistry.findById(ctx.tenantId);
    if (!tenant) {
      this.identityMetrics.recordCrossTenantAttempt();
      throw accessDeniedError();
    }

    // Explicit LOCKED message — intentional hard block, no reads allowed
    if (tenant.status === TenantStatus.LOCKED) {
      throw new ForbiddenException('Tenant is locked');
    }

    if (
      !isTenantAccessible(tenant.status, {
        allowSuspendedReads: this.config.TENANT_SUSPENDED_ALLOW_READS,
      })
    ) {
      throw new ForbiddenException(`Tenant is not accessible: ${tenant.status}`);
    }

    if (ctx.subjectId && ctx.authKind !== 'customer' && !isCustomerRoute) {
      const isMember = await this.userTenantMembership.isMember(ctx.subjectId, ctx.tenantId);
      if (!isMember) {
        this.identityMetrics.recordCrossTenantAttempt();
        throw accessDeniedError();
      }
    }

    return true;
  }
}
