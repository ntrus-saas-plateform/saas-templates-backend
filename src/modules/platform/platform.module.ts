import { Module } from '@nestjs/common';
import { KeycloakModule } from '../../shared/keycloak/keycloak.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { platformApplicationProviders } from './infrastructure/platform-application.providers.js';
import { PlatformController } from './presentation/controllers/platform.controller.js';
import { PlatformAdminController } from './presentation/controllers/platform-admin.controller.js';
import { TenantDomainsController } from './presentation/controllers/tenant-domains.controller.js';
import { HealthController } from './presentation/controllers/health.controller.js';
import { MetricsController } from './presentation/controllers/metrics.controller.js';
import { SwitchOrganizationUseCase } from './application/organization/switch-organization.use-case.js';
import { ListPlatformOrganizationsUseCase } from './application/organization/list-platform-organizations.use-case.js';
import {
  ProvisionTenantUseCase,
  RetryTenantProvisioningUseCase,
} from './application/admin/provision-tenant.use-case.js';
import { GetTenantHealthUseCase } from './application/admin/get-tenant-health.use-case.js';

/**
 * Platform bounded context — session context, org switching orchestration, ops endpoints.
 */
@Module({
  imports: [KeycloakModule, IdentityModule],
  controllers: [
    PlatformController,
    PlatformAdminController,
    TenantDomainsController,
    HealthController,
    MetricsController,
  ],
  providers: [...platformApplicationProviders],
  exports: [
    SwitchOrganizationUseCase,
    ListPlatformOrganizationsUseCase,
    ProvisionTenantUseCase,
    RetryTenantProvisioningUseCase,
    GetTenantHealthUseCase,
  ],
})
export class PlatformModule {}
