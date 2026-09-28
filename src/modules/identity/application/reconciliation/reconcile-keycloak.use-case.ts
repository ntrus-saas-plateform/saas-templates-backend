import type { OrganizationRepositoryPort } from '../../domain/ports/organization-repository.port.js';
import type { MembershipRepositoryPort } from '../../domain/ports/membership-repository.port.js';
import type { OrganizationAdminPort } from '../../domain/ports/organization-admin.port.js';
import type { KeycloakAdminPort } from '../../domain/ports/keycloak-admin.port.js';
import type { ApplicationUserRepositoryPort } from '../../domain/ports/application-user-repository.port.js';
import type { DomainRegistryPort } from '../../domain/ports/domain-registry.port.js';
import type { TenantRegistryPort } from '../../domain/ports/tenant-registry.port.js';
import type {
  ReconciliationDrift,
  ReconcileKeycloakResult,
} from '../../domain/reconciliation/reconciliation-report.entity.js';
import { ApplicationUserStatus } from '../../domain/user/application-user.entity.js';
import { TenantStatus } from '../../domain/tenant/tenant.entity.js';
import { DomainStatus } from '../../domain/domain/tenant-domain.entity.js';

export interface ReconcileKeycloakInput {
  readonly tenantId: string;
  readonly repair: boolean;
}

/** Optional extension deps for infrastructure drift detection (DB + domains). */
export interface ReconcileInfraExtensions {
  readonly domainRegistry?: DomainRegistryPort;
  readonly tenantRegistry?: TenantRegistryPort;
  /** If set, checks that ACTIVE tenants have a primary domain when base domain is configured. */
  readonly tenantBaseDomain?: string;
  /** Resolve a queryable connection for the tenant DB (for reachability / schema checks). */
  readonly getTenantPool?: (
    tenantId: string,
  ) => Promise<{ query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }>;
}

function isPlaceholderKeycloakId(id: string): boolean {
  return id.startsWith('kc-');
}

function shouldKeycloakUserBeEnabled(status: ApplicationUserStatus): boolean {
  return (
    status === ApplicationUserStatus.ACTIVE ||
    status === ApplicationUserStatus.INVITED ||
    status === ApplicationUserStatus.PENDING_ACTIVATION
  );
}

export class ReconcileKeycloakUseCase {
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly membershipRepository: MembershipRepositoryPort,
    private readonly organizationAdmin: OrganizationAdminPort,
    private readonly keycloakAdmin: KeycloakAdminPort,
    private readonly applicationUserRepository: ApplicationUserRepositoryPort,
    private readonly infraExtensions?: ReconcileInfraExtensions,
  ) {}

  async execute(input: ReconcileKeycloakInput): Promise<ReconcileKeycloakResult> {
    const drifts: ReconciliationDrift[] = [];
    const repairs: ReconcileKeycloakResult['repairs'][number][] = [];
    const keycloakAvailable = await this.keycloakAdmin.isAvailable();
    const organizations = await this.organizationRepository.findAllByTenant(input.tenantId);

    let keycloakOrgs: readonly { id: string; alias: string }[] = [];
    if (keycloakAvailable) {
      try {
        keycloakOrgs = await this.keycloakAdmin.listOrganizations();
      } catch {
        keycloakOrgs = [];
      }
    }

    const kcIds = new Set(keycloakOrgs.map((o) => o.id));
    const appKcIds = new Set(
      organizations.map((o) => o.keycloakOrganizationId).filter((id) => !isPlaceholderKeycloakId(id)),
    );

    for (const org of organizations) {
      if (!keycloakAvailable && isPlaceholderKeycloakId(org.keycloakOrganizationId)) {
        drifts.push({
          type: 'organization.keycloak_unverified',
          resourceId: org.id,
          message: 'Placeholder Keycloak ID; admin API unavailable for verification',
          severity: 'warning',
          repairable: false,
        });
        continue;
      }

      if (
        keycloakAvailable &&
        !isPlaceholderKeycloakId(org.keycloakOrganizationId) &&
        !kcIds.has(org.keycloakOrganizationId)
      ) {
        drifts.push({
          type: 'organization.keycloak_missing',
          resourceId: org.id,
          message: `Application org references Keycloak ID ${org.keycloakOrganizationId} not found in realm`,
          severity: 'critical',
          repairable: true,
        });
      }

      if (keycloakAvailable && isPlaceholderKeycloakId(org.keycloakOrganizationId)) {
        drifts.push({
          type: 'organization.keycloak_placeholder',
          resourceId: org.id,
          message: 'Organization has placeholder Keycloak ID; sync recommended',
          severity: 'warning',
          repairable: true,
        });

        if (input.repair) {
          try {
            const kcId = await this.keycloakAdmin.createOrganization(org.name, org.slug);
            await this.organizationAdmin.updateKeycloakOrganizationId(
              input.tenantId,
              org.id,
              kcId,
            );
            repairs.push({
              type: 'organization.keycloak_placeholder',
              resourceId: org.id,
              status: 'applied',
            });
          } catch {
            repairs.push({
              type: 'organization.keycloak_placeholder',
              resourceId: org.id,
              status: 'failed',
            });
          }
        }
      }

      const memberships = await this.membershipRepository.findByOrganization(
        input.tenantId,
        org.id,
      );
      if (memberships.length === 0 && org.status === 'ACTIVE') {
        drifts.push({
          type: 'organization.no_members',
          resourceId: org.id,
          message: 'Active organization has no memberships',
          severity: 'info',
          repairable: false,
        });
      }

      if (keycloakAvailable && !isPlaceholderKeycloakId(org.keycloakOrganizationId)) {
        try {
          const kcMemberIds = await this.keycloakAdmin.listOrganizationMemberIds(
            org.keycloakOrganizationId,
          );
          const kcMemberSet = new Set(kcMemberIds);
          const appMemberIds = new Set(memberships.map((m) => m.userId));
          for (const membership of memberships) {
            if (!kcMemberSet.has(membership.userId)) {
              drifts.push({
                type: 'membership.keycloak_missing',
                resourceId: membership.id,
                message: `User ${membership.userId} in app but not in Keycloak org`,
                severity: 'warning',
                repairable: true,
              });
              if (input.repair) {
                try {
                  await this.keycloakAdmin.addUserToOrganization(
                    org.keycloakOrganizationId,
                    membership.userId,
                  );
                  repairs.push({
                    type: 'membership.keycloak_missing',
                    resourceId: membership.id,
                    status: 'applied',
                  });
                } catch {
                  repairs.push({
                    type: 'membership.keycloak_missing',
                    resourceId: membership.id,
                    status: 'failed',
                  });
                }
              }
            }
          }
          for (const kcMemberId of kcMemberIds) {
            if (!appMemberIds.has(kcMemberId)) {
              drifts.push({
                type: 'membership.keycloak_extra',
                resourceId: kcMemberId,
                message: `User ${kcMemberId} in Keycloak org ${org.slug} but not in application memberships`,
                severity: 'warning',
                repairable: false,
              });
            }
          }
        } catch {
          // Org may not exist in KC yet
        }
      }
    }

    if (keycloakAvailable) {
      for (const kcOrg of keycloakOrgs) {
        if (!appKcIds.has(kcOrg.id)) {
          const mapped = organizations.find((o) => o.keycloakOrganizationId === kcOrg.id);
          if (!mapped) {
            drifts.push({
              type: 'keycloak.organization_unmapped',
              resourceId: kcOrg.id,
              message: `Keycloak organization ${kcOrg.alias} has no application mapping`,
              severity: 'critical',
              repairable: false,
            });
          }
        }
      }

      await this.reconcileApplicationUsers(input, drifts, repairs);
    }

    // --- Infrastructure drift checks (optional extensions) ---
    await this.reconcileInfrastructure(input, drifts);

    return {
      tenantId: input.tenantId,
      ranAt: new Date().toISOString(),
      keycloakAvailable,
      drifts,
      repairs,
      summary: {
        total: drifts.length,
        critical: drifts.filter((d) => d.severity === 'critical').length,
        warning: drifts.filter((d) => d.severity === 'warning').length,
        repaired: repairs.filter((r) => r.status === 'applied').length,
      },
    };
  }

  private async reconcileInfrastructure(
    input: ReconcileKeycloakInput,
    drifts: ReconciliationDrift[],
  ): Promise<void> {
    const ext = this.infraExtensions;
    if (!ext) return;

    // --- Database probes ---
    if (ext.getTenantPool) {
      let pool: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
      try {
        pool = await ext.getTenantPool(input.tenantId);
        await pool.query('SELECT 1');
      } catch {
        drifts.push({
          type: 'database.missing',
          resourceId: input.tenantId,
          message: 'Tenant database is unreachable (SELECT 1 failed)',
          severity: 'critical',
          repairable: false,
        });
        return;
      }

      // Schema staleness: report schema_migrations count as soft info
      try {
        const res = (await pool.query(
          'SELECT COUNT(*)::int AS cnt FROM schema_migrations',
        )) as { rows: Array<{ cnt: number }> };
        const count = res.rows[0]?.cnt ?? 0;
        if (count === 0) {
          drifts.push({
            type: 'database.schema_stale',
            resourceId: input.tenantId,
            message: 'Tenant schema_migrations table is empty — tenant may not be fully migrated',
            severity: 'warning',
            repairable: false,
          });
        }
      } catch {
        // schema_migrations missing or unreachable
      }
    }

    // --- Domain drift checks ---
    if (ext.domainRegistry) {
      try {
        const domains = await ext.domainRegistry.listByTenant(input.tenantId);

        // domain.missing_primary: active tenant without primary domain (only when base domain configured)
        if (ext.tenantBaseDomain) {
          const hasPrimary = domains.some((d) => d.isPrimary && d.status === DomainStatus.ACTIVE);
          if (!hasPrimary) {
            let tenantActive = true;
            if (ext.tenantRegistry) {
              const tenant = await ext.tenantRegistry.findById(input.tenantId).catch(() => null);
              tenantActive = tenant?.status === TenantStatus.ACTIVE;
            }
            if (tenantActive) {
              drifts.push({
                type: 'domain.missing_primary',
                resourceId: input.tenantId,
                message: `Tenant has no active primary domain but TENANT_BASE_DOMAIN (${ext.tenantBaseDomain}) is configured`,
                severity: 'warning',
                repairable: false,
              });
            }
          }
        }

        // domain.orphan: any domain whose tenant isn't resolvable (only when registry provided)
        if (ext.tenantRegistry) {
          const tenant = await ext.tenantRegistry.findById(input.tenantId).catch(() => null);
          if (!tenant || tenant.status === TenantStatus.DELETED) {
            for (const domain of domains) {
              drifts.push({
                type: 'domain.orphan',
                resourceId: domain.id,
                message: `Domain ${domain.hostname} belongs to tenant ${input.tenantId} which is DELETED or missing`,
                severity: 'warning',
                repairable: false,
              });
            }
          }
        }
      } catch {
        // Domain registry unavailable — skip domain drift silently
      }
    }
  }

  private async reconcileApplicationUsers(
    input: ReconcileKeycloakInput,
    drifts: ReconciliationDrift[],
    repairs: ReconcileKeycloakResult['repairs'][number][],
  ): Promise<void> {
    const appIdentityIds = new Set<string>();
    let page = 1;
    const pageSize = 100;

    while (true) {
      const { items, total } = await this.applicationUserRepository.listPage(
        input.tenantId,
        page,
        pageSize,
      );

      for (const user of items) {
        appIdentityIds.add(user.identityId);
        if (user.status === ApplicationUserStatus.DELETED) {
          continue;
        }

        const kcUser = await this.keycloakAdmin.getUser(user.identityId);
        if (!kcUser) {
          drifts.push({
            type: 'user.keycloak_missing',
            resourceId: user.id,
            message: `Application user ${user.identityId} not found in Keycloak`,
            severity: 'critical',
            repairable: false,
          });
          continue;
        }

        const expectedEnabled = shouldKeycloakUserBeEnabled(user.status);
        if (kcUser.enabled !== expectedEnabled) {
          drifts.push({
            type: 'user.enabled_mismatch',
            resourceId: user.id,
            message: `User ${user.identityId}: app status ${user.status} vs KC enabled=${kcUser.enabled}`,
            severity: 'warning',
            repairable: true,
          });
          if (input.repair) {
            try {
              await this.keycloakAdmin.setUserEnabled(user.identityId, expectedEnabled);
              repairs.push({
                type: 'user.enabled_mismatch',
                resourceId: user.id,
                status: 'applied',
              });
            } catch {
              repairs.push({
                type: 'user.enabled_mismatch',
                resourceId: user.id,
                status: 'failed',
              });
            }
          }
        }
      }

      if (page * pageSize >= total) {
        break;
      }
      page += 1;
    }

    let offset = 0;
    const kcPageSize = 100;
    while (true) {
      const kcUsers = await this.keycloakAdmin.listUsersPage(offset, kcPageSize);
      if (kcUsers.length === 0) {
        break;
      }
      for (const kcUser of kcUsers) {
        if (!appIdentityIds.has(kcUser.id)) {
          drifts.push({
            type: 'user.keycloak_extra',
            resourceId: kcUser.id,
            message: `Keycloak user ${kcUser.id} has no application user record in tenant`,
            severity: 'warning',
            repairable: false,
          });
        }
      }
      if (kcUsers.length < kcPageSize) {
        break;
      }
      offset += kcPageSize;
    }
  }
}
