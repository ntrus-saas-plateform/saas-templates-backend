import { Injectable, Inject } from '@nestjs/common';
import { SETTINGS_REPOSITORY_PORT } from '../../modules/identity/domain/ports/settings-repository.port.js';
import type { SettingsRepositoryPort } from '../../modules/identity/domain/ports/settings-repository.port.js';
import {
  PLATFORM_DEFAULTS,
  OVERRIDEABLE_ORG_SETTINGS,
} from '../../modules/identity/domain/configuration/platform-defaults.js';

export interface ConfigurationContext {
  tenantId: string;
  organizationId?: string | null;
  userSettings?: Readonly<Record<string, unknown>>;
  sessionOverrides?: Readonly<Record<string, unknown>>;
}

@Injectable()
export class ConfigurationResolverService {
  constructor(
    @Inject(SETTINGS_REPOSITORY_PORT) private readonly settings: SettingsRepositoryPort,
  ) {}

  async resolve<T>(fullKey: string, context: ConfigurationContext): Promise<T> {
    const [namespace, ...rest] = fullKey.split('.');
    const key = rest.join('.');
    if (!namespace || !key) {
      return PLATFORM_DEFAULTS[fullKey] as T;
    }

    // SESSION → USER → ORG → TENANT → PLATFORM (most specific wins)
    if (context.sessionOverrides?.[fullKey] !== undefined) {
      return context.sessionOverrides[fullKey] as T;
    }

    if (context.userSettings?.[fullKey] !== undefined) {
      return context.userSettings[fullKey] as T;
    }

    if (context.organizationId && OVERRIDEABLE_ORG_SETTINGS.has(fullKey)) {
      const orgValue = await this.settings.getOrganizationSetting(
        context.tenantId,
        context.organizationId,
        namespace,
        key,
      );
      if (orgValue !== null) return orgValue as T;
    }

    const tenantValue = await this.settings.getTenantSetting(context.tenantId, namespace, key);
    if (tenantValue !== null) return tenantValue as T;

    return (PLATFORM_DEFAULTS[fullKey] ?? null) as T;
  }

  async resolveNamespace(
    namespace: string,
    context: ConfigurationContext,
  ): Promise<Record<string, unknown>> {
    const tenantValues = await this.settings.listTenantNamespace(context.tenantId, namespace);
    const defaults = Object.fromEntries(
      Object.entries(PLATFORM_DEFAULTS)
        .filter(([k]) => k.startsWith(`${namespace}.`))
        .map(([k, v]) => [k.slice(namespace.length + 1), v]),
    );

    let merged: Record<string, unknown> = { ...defaults, ...tenantValues };

    if (context.organizationId) {
      const orgValues = await this.settings.listOrganizationNamespace(
        context.tenantId,
        context.organizationId,
        namespace,
      );
      for (const [k, v] of Object.entries(orgValues)) {
        const fullKey = `${namespace}.${k}`;
        if (OVERRIDEABLE_ORG_SETTINGS.has(fullKey)) {
          merged[k] = v;
        }
      }
    }

    if (context.userSettings) {
      for (const [k, v] of Object.entries(context.userSettings)) {
        if (k.startsWith(`${namespace}.`)) {
          merged[k.slice(namespace.length + 1)] = v;
        }
      }
    }

    if (context.sessionOverrides) {
      for (const [k, v] of Object.entries(context.sessionOverrides)) {
        if (k.startsWith(`${namespace}.`)) {
          merged[k.slice(namespace.length + 1)] = v;
        }
      }
    }

    return merged;
  }
}
