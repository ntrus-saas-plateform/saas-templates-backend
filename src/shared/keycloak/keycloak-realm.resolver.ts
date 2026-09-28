import { Injectable, Inject } from '@nestjs/common';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';

/**
 * Resolves the platform Keycloak realm.
 *
 * Single shared realm for all tenants. Tenant isolation is JWT `tenant_id` plus
 * one or more Keycloak Organizations per tenant — never a realm-per-tenant.
 */
@Injectable()
export class KeycloakRealmResolver {
  constructor(@Inject(APP_CONFIG) private readonly config: EnvironmentConfig) {}

  async resolveRealm(_tenantId?: string): Promise<string> {
    return this.config.KEYCLOAK_ADMIN_REALM;
  }
}
