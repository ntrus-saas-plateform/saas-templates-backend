import { Injectable } from '@nestjs/common';
import { ConfigurationResolverService } from '../../shared/configuration/configuration-resolver.service.js';
import { TenantContextService } from '../../shared/tenancy/tenant-context.service.js';
import { getNamespaceSettingKeys } from '../../modules/identity/domain/configuration/setting-definition.js';
import { SETTING_DEFINITIONS } from '../../modules/identity/domain/configuration/setting-definition.js';
import type {
  FeatureContext,
  FeatureFlagEntry,
  FeatureFlagServicePort,
} from '../../modules/identity/domain/feature-flag/feature-flag.port.js';

@Injectable()
export class TenantFeatureFlagService implements FeatureFlagServicePort {
  constructor(
    private readonly configurationResolver: ConfigurationResolverService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async isEnabled(flag: string, context?: FeatureContext): Promise<boolean> {
    const ctx = this.tenantContext.getOrThrow();
    const tenantId = context?.tenantId ?? ctx.tenantId;
    const organizationId = context?.organizationId ?? ctx.organizationId;
    const value = await this.configurationResolver.resolve<boolean>(`features.${flag}`, {
      tenantId,
      organizationId,
    });
    return Boolean(value);
  }

  async listFlags(context?: FeatureContext): Promise<Readonly<Record<string, boolean>>> {
    const ctx = this.tenantContext.getOrThrow();
    const tenantId = context?.tenantId ?? ctx.tenantId;
    const organizationId = context?.organizationId ?? ctx.organizationId;
    const keys = getNamespaceSettingKeys('features');
    const flags: Record<string, boolean> = {};
    for (const fullKey of keys) {
      const flag = fullKey.slice('features.'.length);
      flags[flag] = await this.configurationResolver.resolve<boolean>(fullKey, {
        tenantId,
        organizationId,
      });
    }
    return flags;
  }

  async listFlagsPage(
    context?: FeatureContext,
    page = 1,
    limit = 20,
  ): Promise<{ items: readonly FeatureFlagEntry[]; total: number }> {
    const ctx = this.tenantContext.getOrThrow();
    const tenantId = context?.tenantId ?? ctx.tenantId;
    const organizationId = context?.organizationId ?? ctx.organizationId;
    const keys = getNamespaceSettingKeys('features');
    const total = keys.length;
    const offset = (page - 1) * limit;
    const slice = keys.slice(offset, offset + limit);
    const items: FeatureFlagEntry[] = [];

    for (const fullKey of slice) {
      const definition = SETTING_DEFINITIONS[fullKey];
      const flag = fullKey.slice('features.'.length);
      const enabled = await this.configurationResolver.resolve<boolean>(fullKey, {
        tenantId,
        organizationId,
      });
      items.push({
        key: flag,
        enabled: Boolean(enabled),
        namespace: 'features',
        defaultValue: definition?.default ?? false,
        overrideable: definition?.overrideable ?? false,
      });
    }

    return { items, total };
  }
}
