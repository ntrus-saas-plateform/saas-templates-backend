import type { TenantAdminPort } from '../../../identity/domain/ports/tenant-admin.port.js';
import type { TenantDatabaseHealthCheckerPort } from '../../../../core/domain/ports/tenant-provisioning.port.js';
import type { DomainRegistryPort } from '../../../identity/domain/ports/domain-registry.port.js';
import type { OrganizationRepositoryPort } from '../../../identity/domain/ports/organization-repository.port.js';
import type { KeycloakAdminPort } from '../../../identity/domain/ports/keycloak-admin.port.js';
import type { TenantDatabaseManager } from '../../../../shared/database/tenant-database.manager.js';
import { DomainStatus } from '../../../identity/domain/domain/tenant-domain.entity.js';

export interface TenantHealthResult {
  tenantId: string;
  status: string;
  provisioningStep: string | null;
  database: {
    reachable: boolean;
    latencyMs?: number;
    schemaVersions?: string[];
  };
  keycloak: {
    organizationsExpected: number;
    organizationsPresent: number;
    missing: string[];
  };
  domains: {
    primary: string | null;
    total: number;
  };
  healthy: boolean;
}

export class GetTenantHealthUseCase {
  constructor(
    private readonly tenantAdmin: TenantAdminPort,
    private readonly dbHealthChecker: TenantDatabaseHealthCheckerPort,
    private readonly dbManager: TenantDatabaseManager,
    private readonly domainRegistry: DomainRegistryPort,
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly keycloakAdmin: KeycloakAdminPort,
  ) {}

  async execute(tenantId: string): Promise<TenantHealthResult> {
    const tenant = await this.tenantAdmin.findById(tenantId);
    if (!tenant) {
      return {
        tenantId,
        status: 'NOT_FOUND',
        provisioningStep: null,
        database: { reachable: false },
        keycloak: { organizationsExpected: 0, organizationsPresent: 0, missing: [] },
        domains: { primary: null, total: 0 },
        healthy: false,
      };
    }

    // --- Database health ---
    let dbResult: TenantHealthResult['database'] = { reachable: false };
    try {
      const health = await this.dbHealthChecker.check(tenantId);
      if (health.healthy) {
        const pool = await this.dbManager.getPool(tenantId);
        let schemaVersions: string[] = [];
        try {
          const res = await pool.query<{ version: string }>(
            'SELECT version FROM schema_migrations ORDER BY version',
          );
          schemaVersions = res.rows.map((r) => r.version);
        } catch {
          // schema_migrations may not exist yet (pre-migration tenant)
        }
        dbResult = { reachable: true, latencyMs: health.latencyMs, schemaVersions };
      }
    } catch {
      dbResult = { reachable: false };
    }

    // --- Keycloak organizations ---
    let kcResult: TenantHealthResult['keycloak'] = {
      organizationsExpected: 0,
      organizationsPresent: 0,
      missing: [],
    };
    try {
      const appOrgs = await this.organizationRepository.findAllByTenant(tenantId);
      const keycloakAvailable = await this.keycloakAdmin.isAvailable();
      if (keycloakAvailable) {
        const kcOrgs = await this.keycloakAdmin.listOrganizations();
        const kcIds = new Set(kcOrgs.map((o) => o.id));
        const missing = appOrgs
          .filter(
            (o) => !o.keycloakOrganizationId.startsWith('kc-') && !kcIds.has(o.keycloakOrganizationId),
          )
          .map((o) => o.id);
        kcResult = {
          organizationsExpected: appOrgs.length,
          organizationsPresent: kcOrgs.length,
          missing,
        };
      } else {
        kcResult = {
          organizationsExpected: appOrgs.length,
          organizationsPresent: 0,
          missing: [],
        };
      }
    } catch {
      // Keycloak unavailable; leave defaults
    }

    // --- Domains ---
    let domainsResult: TenantHealthResult['domains'] = { primary: null, total: 0 };
    try {
      const domains = await this.domainRegistry.listByTenant(tenantId);
      const primary = domains.find((d) => d.isPrimary && d.status === DomainStatus.ACTIVE);
      domainsResult = {
        primary: primary?.hostname ?? null,
        total: domains.length,
      };
    } catch {
      // Domain registry unavailable
    }

    const healthy =
      dbResult.reachable &&
      kcResult.missing.length === 0 &&
      (tenant.status === 'ACTIVE' || tenant.status === 'READ_ONLY');

    return {
      tenantId,
      status: tenant.status,
      provisioningStep: tenant.provisioningStep ?? null,
      database: dbResult,
      keycloak: kcResult,
      domains: domainsResult,
      healthy,
    };
  }
}

export const GET_TENANT_HEALTH_USE_CASE = Symbol('GET_TENANT_HEALTH_USE_CASE');
