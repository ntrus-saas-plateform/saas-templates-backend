import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigurationResolverService } from './configuration-resolver.service.js';
import type { SettingsRepositoryPort } from '../../modules/identity/domain/ports/settings-repository.port.js';

describe('ConfigurationResolverService', () => {
  let service: ConfigurationResolverService;
  let settings: SettingsRepositoryPort;

  beforeEach(() => {
    settings = {
      getTenantSetting: vi.fn().mockResolvedValue(null),
      listTenantNamespace: vi.fn().mockResolvedValue({}),
      setTenantSetting: vi.fn(),
      getOrganizationSetting: vi.fn().mockResolvedValue(null),
      listOrganizationNamespace: vi.fn().mockResolvedValue({}),
      setOrganizationSetting: vi.fn(),
    };
    service = new ConfigurationResolverService(settings);
  });

  it('returns platform default when no overrides exist', async () => {
    const value = await service.resolve<string>('localization.locale', {
      tenantId: 'tenant-1',
    });
    expect(value).toBe('en');
  });

  it('prefers tenant setting over default', async () => {
    vi.mocked(settings.getTenantSetting).mockResolvedValue('fr');
    const value = await service.resolve<string>('localization.locale', {
      tenantId: 'tenant-1',
    });
    expect(value).toBe('fr');
  });

  it('prefers organization override when allowed', async () => {
    vi.mocked(settings.getOrganizationSetting).mockResolvedValue('Europe/Paris');
    const value = await service.resolve<string>('localization.timezone', {
      tenantId: 'tenant-1',
      organizationId: 'org-1',
    });
    expect(value).toBe('Europe/Paris');
    expect(settings.getTenantSetting).not.toHaveBeenCalled();
  });

  it('prefers user settings over tenant and org', async () => {
    vi.mocked(settings.getTenantSetting).mockResolvedValue('de');
    const value = await service.resolve<string>('localization.locale', {
      tenantId: 'tenant-1',
      organizationId: 'org-1',
      userSettings: { 'localization.locale': 'es' },
    });
    expect(value).toBe('es');
  });

  it('prefers session overrides over user settings', async () => {
    const value = await service.resolve<string>('localization.locale', {
      tenantId: 'tenant-1',
      userSettings: { 'localization.locale': 'es' },
      sessionOverrides: { 'localization.locale': 'rw' },
    });
    expect(value).toBe('rw');
  });

  it('merges namespace with tenant and org overrides', async () => {
    vi.mocked(settings.listTenantNamespace).mockResolvedValue({ locale: 'fr' });
    vi.mocked(settings.listOrganizationNamespace).mockResolvedValue({ timezone: 'Europe/Paris' });

    const merged = await service.resolveNamespace('localization', {
      tenantId: 'tenant-1',
      organizationId: 'org-1',
    });

    expect(merged.locale).toBe('fr');
    expect(merged.timezone).toBe('Europe/Paris');
  });
});
