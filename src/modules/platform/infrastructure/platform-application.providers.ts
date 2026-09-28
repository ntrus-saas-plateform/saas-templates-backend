import type { Provider } from '@nestjs/common';
import { ORGANIZATION_REPOSITORY_PORT } from '../../identity/domain/ports/organization-repository.port.js';
import { KEYCLOAK_ADMIN_PORT } from '../../identity/domain/ports/keycloak-admin.port.js';
import { EVENT_PUBLISHER_PORT } from '../../identity/domain/ports/event-publisher.port.js';
import { TENANT_DATABASE_PROVISIONER_PORT, TENANT_DATABASE_HEALTH_CHECKER_PORT } from '../../../core/domain/ports/tenant-provisioning.port.js';
import { TENANT_ADMIN_PORT } from '../../identity/domain/ports/tenant-admin.port.js';
import { USER_TENANT_MEMBERSHIP_PORT } from '../../identity/domain/ports/user-tenant-membership.port.js';
import { DOMAIN_REGISTRY_PORT } from '../../identity/domain/ports/domain-registry.port.js';
import { PLAN_REPOSITORY_PORT } from '../../identity/domain/ports/plan-repository.port.js';
import { APP_CONFIG } from '../../../shared/configuration/configuration.module.js';
import { TOKEN_REVOCATION_PORT } from '../../../core/domain/ports/token-revocation.port.js';
import { ControlPlaneOutboxTransactionService } from '../../../shared/messaging/control-plane-outbox-transaction.service.js';
import { ListPlatformOrganizationsUseCase } from '../application/organization/list-platform-organizations.use-case.js';
import { SwitchOrganizationUseCase } from '../application/organization/switch-organization.use-case.js';
import { ProvisionTenantUseCase, RetryTenantProvisioningUseCase } from '../application/admin/provision-tenant.use-case.js';
import { DeprovisionTenantUseCase } from '../application/admin/deprovision-tenant.use-case.js';
import { GetTenantHealthUseCase } from '../application/admin/get-tenant-health.use-case.js';
import { TenantDatabaseManager } from '../../../shared/database/tenant-database.manager.js';
import { ORGANIZATION_ADMIN_PORT } from '../../identity/domain/ports/organization-admin.port.js';
import { MEMBERSHIP_REPOSITORY_PORT } from '../../identity/domain/ports/membership-repository.port.js';
import { PLATFORM_ADMIN_AUDIT_PORT } from '../domain/ports/platform-admin-audit.port.js';
import { PgPlatformAdminAuditRepository } from './persistence/pg-platform-admin-audit.repository.js';
import { PlatformAdminAuditService } from '../application/admin/platform-admin-audit.service.js';

export const platformApplicationProviders: Provider[] = [
  PgPlatformAdminAuditRepository,
  {
    provide: PLATFORM_ADMIN_AUDIT_PORT,
    useExisting: PgPlatformAdminAuditRepository,
  },
  PlatformAdminAuditService,
  {
    provide: ProvisionTenantUseCase,
    useFactory: (
      provisioner,
      tenantAdmin,
      userTenantMembership,
      organizationAdmin,
      membershipRepository,
      keycloakAdmin,
      config,
      outboxService,
      domainRegistry,
      planRepository,
      organizationRepository,
    ) =>
      new ProvisionTenantUseCase(
        provisioner,
        tenantAdmin,
        userTenantMembership,
        organizationAdmin,
        membershipRepository,
        keycloakAdmin,
        {
          environment: config.NODE_ENV ?? 'production',
          databaseHost: config.CONTROL_PLANE_DB_HOST,
          databasePort: config.CONTROL_PLANE_DB_PORT,
        },
        outboxService,
        domainRegistry,
        config.TENANT_BASE_DOMAIN,
        planRepository,
        organizationRepository,
      ),
    inject: [
      TENANT_DATABASE_PROVISIONER_PORT,
      TENANT_ADMIN_PORT,
      USER_TENANT_MEMBERSHIP_PORT,
      ORGANIZATION_ADMIN_PORT,
      MEMBERSHIP_REPOSITORY_PORT,
      KEYCLOAK_ADMIN_PORT,
      APP_CONFIG,
      ControlPlaneOutboxTransactionService,
      DOMAIN_REGISTRY_PORT,
      PLAN_REPOSITORY_PORT,
      ORGANIZATION_REPOSITORY_PORT,
    ],
  },
  {
    provide: RetryTenantProvisioningUseCase,
    useFactory: (
      provisioner,
      tenantAdmin,
      userTenantMembership,
      organizationAdmin,
      membershipRepository,
      keycloakAdmin,
      config,
      outboxService,
      domainRegistry,
      planRepository,
      organizationRepository,
    ) =>
      new RetryTenantProvisioningUseCase(
        provisioner,
        tenantAdmin,
        userTenantMembership,
        organizationAdmin,
        membershipRepository,
        keycloakAdmin,
        {
          environment: config.NODE_ENV ?? 'production',
          databaseHost: config.CONTROL_PLANE_DB_HOST,
          databasePort: config.CONTROL_PLANE_DB_PORT,
        },
        outboxService,
        domainRegistry,
        config.TENANT_BASE_DOMAIN,
        planRepository,
        organizationRepository,
      ),
    inject: [
      TENANT_DATABASE_PROVISIONER_PORT,
      TENANT_ADMIN_PORT,
      USER_TENANT_MEMBERSHIP_PORT,
      ORGANIZATION_ADMIN_PORT,
      MEMBERSHIP_REPOSITORY_PORT,
      KEYCLOAK_ADMIN_PORT,
      APP_CONFIG,
      ControlPlaneOutboxTransactionService,
      DOMAIN_REGISTRY_PORT,
      PLAN_REPOSITORY_PORT,
      ORGANIZATION_REPOSITORY_PORT,
    ],
  },
  {
    provide: DeprovisionTenantUseCase,
    useFactory: (provisioner: import('../../../core/domain/ports/tenant-provisioning.port.js').TenantDatabaseProvisionerPort) =>
      new DeprovisionTenantUseCase(provisioner),
    inject: [TENANT_DATABASE_PROVISIONER_PORT],
  },
  {
    provide: ListPlatformOrganizationsUseCase,
    useFactory: (
      organizationRepository: import('../../identity/domain/ports/organization-repository.port.js').OrganizationRepositoryPort,
    ) => new ListPlatformOrganizationsUseCase(organizationRepository),
    inject: [ORGANIZATION_REPOSITORY_PORT],
  },
  {
    provide: SwitchOrganizationUseCase,
    useFactory: (
      organizationRepository,
      keycloakAdmin,
      eventPublisher,
      tokenRevocation,
    ) =>
      new SwitchOrganizationUseCase(
        organizationRepository,
        keycloakAdmin,
        eventPublisher,
        tokenRevocation,
      ),
    inject: [
      ORGANIZATION_REPOSITORY_PORT,
      KEYCLOAK_ADMIN_PORT,
      EVENT_PUBLISHER_PORT,
      TOKEN_REVOCATION_PORT,
    ],
  },
  {
    provide: GetTenantHealthUseCase,
    useFactory: (
      tenantAdmin,
      dbHealthChecker,
      dbManager,
      domainRegistry,
      organizationRepository,
      keycloakAdmin,
    ) =>
      new GetTenantHealthUseCase(
        tenantAdmin,
        dbHealthChecker,
        dbManager,
        domainRegistry,
        organizationRepository,
        keycloakAdmin,
      ),
    inject: [
      TENANT_ADMIN_PORT,
      TENANT_DATABASE_HEALTH_CHECKER_PORT,
      TenantDatabaseManager,
      DOMAIN_REGISTRY_PORT,
      ORGANIZATION_REPOSITORY_PORT,
      KEYCLOAK_ADMIN_PORT,
    ],
  },
];
