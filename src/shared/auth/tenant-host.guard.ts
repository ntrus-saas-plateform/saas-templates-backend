import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './decorators.js';
import { TenantContextService } from '../tenancy/tenant-context.service.js';
import { normalizeHostname } from '../tenancy/normalize-hostname.js';
import { DOMAIN_REGISTRY_PORT } from '../../modules/identity/domain/ports/domain-registry.port.js';
import type { DomainRegistryPort } from '../../modules/identity/domain/ports/domain-registry.port.js';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';

/**
 * Validates that the incoming Host header matches the tenant bound to the JWT.
 *
 * Guard order (registered after AuthGuard / CustomerAuthGuard so tenant context is set):
 *   AuthGuard → CustomerAuthGuard → TenantHostGuard → TenantGuard → …
 *
 * Skip conditions:
 *   - @Public() routes
 *   - Host resolves to null (localhost, IP address, no header)
 *   - Hostname is not registered in tenant_domains (unknown host → allow through)
 *   - No tenantId in context yet (e.g. public auth endpoints)
 *
 * Deny condition:
 *   - Host is registered but maps to a DIFFERENT tenantId than the JWT tenant_id
 *
 * Applies to staff and B2C (`@CustomerRoute`) once a tenant is bound.
 * X-Forwarded-Host is used only when TRUST_X_FORWARDED_HOST=true (trusted reverse proxy).
 */
@Injectable()
export class TenantHostGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
    @Inject(DOMAIN_REGISTRY_PORT) private readonly domainRegistry: DomainRegistryPort,
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const forwarded = request.headers['x-forwarded-host'] as string | undefined;
    const rawHost =
      this.config.TRUST_X_FORWARDED_HOST && forwarded
        ? forwarded
        : request.headers.host;
    const hostname = normalizeHostname(rawHost);

    if (!hostname) return true;

    const domain = await this.domainRegistry.findByHostname(hostname);
    if (!domain) return true;

    const ctx = this.tenantContext.get();
    if (!ctx.tenantId) return true;

    if (domain.tenantId !== ctx.tenantId) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
