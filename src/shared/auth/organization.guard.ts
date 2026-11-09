import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  IS_PUBLIC_KEY,
  REQUIRE_ORGANIZATION_KEY,
  IS_CUSTOMER_ROUTE_KEY,
  IS_EDGE_ROUTE_KEY,
} from './decorators.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import { ORGANIZATION_REPOSITORY_PORT } from '../../modules/identity/domain/ports/organization-repository.port.js';
import type { OrganizationRepositoryPort } from '../../modules/identity/domain/ports/organization-repository.port.js';
import { isOrganizationAccessible } from '../../modules/identity/domain/organization/organization.entity.js';
import { accessDeniedError } from '../../core/domain/errors/access-denied.js';

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
    @Inject(ORGANIZATION_REPOSITORY_PORT)
    private readonly organizationRepository: OrganizationRepositoryPort,
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

    const isEdgeRoute = this.reflector.getAllAndOverride<boolean>(IS_EDGE_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isEdgeRoute) return true;

    const requiresOrganization = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_ORGANIZATION_KEY,
      [context.getHandler(), context.getClass()],
    );

    const ctx = this.tenantContext.get();

    if (!requiresOrganization && !ctx.organizationId) {
      return true;
    }

    if (!ctx.organizationId) {
      throw new ForbiddenException('Organization context required');
    }

    const organization = await this.organizationRepository.findById(
      ctx.tenantId,
      ctx.organizationId,
    );

    if (!organization) {
      throw accessDeniedError();
    }

    if (organization.tenantId !== ctx.tenantId) {
      throw accessDeniedError();
    }

    if (!isOrganizationAccessible(organization.status)) {
      throw new ForbiddenException(`Organization is not accessible: ${organization.status}`);
    }

    if (ctx.subjectId) {
      const memberships = await this.organizationRepository.findByUserMembership(
        ctx.tenantId,
        ctx.subjectId,
      );
      const isMember = memberships.some((m) => m.id === ctx.organizationId);
      if (!isMember) {
        throw accessDeniedError();
      }
    }

    return true;
  }
}
