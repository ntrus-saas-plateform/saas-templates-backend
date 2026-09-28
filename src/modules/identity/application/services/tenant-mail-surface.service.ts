import type { ConfigurationResolverPort } from '../../domain/ports/configuration-resolver.port.js';
import type { DomainRegistryPort } from '../../domain/ports/domain-registry.port.js';
import { DomainStatus } from '../../domain/domain/tenant-domain.entity.js';
import type { TenantRegistryPort } from '../../domain/ports/tenant-registry.port.js';
import {
  normalizePublicAppUrl,
  publicUrlFromHostname,
  publicUrlFromSubdomain,
} from '../invitation/tenant-public-url.js';

export type TenantMailSurfaceFallbacks = {
  readonly fallbackPublicAppUrl: string;
  readonly fallbackMailFrom: string;
  readonly tenantBaseDomain?: string;
};

export interface TenantMailSurface {
  resolvePublicAppUrl(tenantId: string): Promise<string>;
  resolveMailFrom(tenantId: string): Promise<string>;
}

/**
 * Resolves per-tenant public app URL and mail From for invitations / transactional mail.
 * Precedence for URL: branding.publicAppUrl → primary ACTIVE domain → branding.customDomain
 * → branding.subdomain|slug + TENANT_BASE_DOMAIN → platform PUBLIC_APP_URL.
 * Precedence for From: notifications.mailFrom → platform MAIL_FROM.
 */
export class TenantMailSurfaceService implements TenantMailSurface {
  constructor(
    private readonly configuration: ConfigurationResolverPort,
    private readonly domainRegistry: DomainRegistryPort,
    private readonly tenantRegistry: TenantRegistryPort,
    private readonly fallbacks: TenantMailSurfaceFallbacks,
  ) {}

  async resolvePublicAppUrl(tenantId: string): Promise<string> {
    try {
      const ctx = { tenantId };
      const override = await this.configuration.resolve<string>('branding.publicAppUrl', ctx);
      const fromSetting = normalizePublicAppUrl(String(override ?? ''));
      if (fromSetting) return fromSetting;

      const domains = await this.domainRegistry.listByTenant(tenantId);
      const primary =
        domains.find((d) => d.isPrimary && d.status === DomainStatus.ACTIVE) ??
        domains.find((d) => d.status === DomainStatus.ACTIVE);
      const fromDomain = primary ? publicUrlFromHostname(primary.hostname) : null;
      if (fromDomain) return fromDomain;

      const customDomain = await this.configuration.resolve<string>('branding.customDomain', ctx);
      const fromCustom = normalizePublicAppUrl(String(customDomain ?? ''));
      if (fromCustom) return fromCustom;

      const subdomain = await this.configuration.resolve<string>('branding.subdomain', ctx);
      const tenant = await this.tenantRegistry.findById(tenantId);
      const label = String(subdomain ?? '').trim() || tenant?.slug || '';
      const base = this.fallbacks.tenantBaseDomain;
      if (label && base) {
        const fromSub = publicUrlFromSubdomain(label, base);
        if (fromSub) return fromSub;
      }
    } catch {
      // fall through to platform default
    }
    return this.fallbacks.fallbackPublicAppUrl.replace(/\/+$/, '');
  }

  async resolveMailFrom(tenantId: string): Promise<string> {
    try {
      const value = await this.configuration.resolve<string>('notifications.mailFrom', { tenantId });
      const trimmed = String(value ?? '').trim();
      if (trimmed) return trimmed;
    } catch {
      // fall through to platform default
    }
    return this.fallbacks.fallbackMailFrom;
  }
}
