import { describe, expect, it, vi } from 'vitest';
import { TenantMailSurfaceService } from '../services/tenant-mail-surface.service.js';
import { DomainStatus, DomainType } from '../../domain/domain/tenant-domain.entity.js';
import type {
  ConfigurationContext,
  ConfigurationResolverPort,
} from '../../domain/ports/configuration-resolver.port.js';
import type { DomainRegistryPort } from '../../domain/ports/domain-registry.port.js';
import type { TenantRegistryPort } from '../../domain/ports/tenant-registry.port.js';

function settings(values: Record<string, string>): ConfigurationResolverPort {
  return {
    resolve: (async (fullKey: string, _context: ConfigurationContext) =>
      values[fullKey] ?? '') as ConfigurationResolverPort['resolve'],
    resolveNamespace: async () => ({}),
  };
}

describe('TenantMailSurfaceService', () => {
  const domainRegistry = {
    listByTenant: vi.fn(async () => []),
  } as unknown as DomainRegistryPort;
  const tenantRegistry = {
    findById: vi.fn(async () => ({ slug: 'acme' })),
  } as unknown as TenantRegistryPort;
  const fallbacks = {
    fallbackPublicAppUrl: 'http://localhost:3001',
    fallbackMailFrom: 'Atlas <noreply@localhost>',
    tenantBaseDomain: 'example.com',
  };

  it('uses branding.publicAppUrl when set', async () => {
    const service = new TenantMailSurfaceService(
      settings({ 'branding.publicAppUrl': 'https://app.acme.test/' }),
      domainRegistry,
      tenantRegistry,
      fallbacks,
    );
    expect(await service.resolvePublicAppUrl('tenant-1')).toBe('https://app.acme.test');
  });

  it('deduces URL from the primary active domain', async () => {
    const domains = {
      listByTenant: vi.fn(async () => [
        {
          hostname: 'acme.example.com',
          isPrimary: true,
          status: DomainStatus.ACTIVE,
          type: DomainType.SUBDOMAIN,
        },
      ]),
    } as unknown as DomainRegistryPort;
    const service = new TenantMailSurfaceService(
      settings({}),
      domains,
      tenantRegistry,
      fallbacks,
    );
    expect(await service.resolvePublicAppUrl('tenant-1')).toBe('https://acme.example.com');
  });

  it('falls back to slug + TENANT_BASE_DOMAIN', async () => {
    const service = new TenantMailSurfaceService(settings({}), domainRegistry, tenantRegistry, fallbacks);
    expect(await service.resolvePublicAppUrl('tenant-1')).toBe('https://acme.example.com');
  });

  it('uses platform PUBLIC_APP_URL last', async () => {
    const emptyTenants = { findById: vi.fn(async () => null) } as unknown as TenantRegistryPort;
    const service = new TenantMailSurfaceService(settings({}), domainRegistry, emptyTenants, {
      ...fallbacks,
      tenantBaseDomain: undefined,
    });
    expect(await service.resolvePublicAppUrl('tenant-1')).toBe('http://localhost:3001');
  });

  it('uses notifications.mailFrom then platform MAIL_FROM', async () => {
    const withFrom = new TenantMailSurfaceService(
      settings({ 'notifications.mailFrom': 'Acme <invites@acme.example.com>' }),
      domainRegistry,
      tenantRegistry,
      fallbacks,
    );
    expect(await withFrom.resolveMailFrom('tenant-1')).toBe('Acme <invites@acme.example.com>');

    const withoutFrom = new TenantMailSurfaceService(settings({}), domainRegistry, tenantRegistry, fallbacks);
    expect(await withoutFrom.resolveMailFrom('tenant-1')).toBe('Atlas <noreply@localhost>');
  });
});
