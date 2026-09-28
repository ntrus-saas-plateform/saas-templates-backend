import { Module } from '@nestjs/common';
import { MessagingModule } from '../../shared/messaging/messaging.module.js';
import { StorageModule } from '../../shared/storage/storage.module.js';
import { EmailModule } from '../../shared/email/email.module.js';
import { FeatureFlagsModule } from '../../shared/feature-flags/feature-flags.module.js';
import { SchedulingModule } from '../../shared/scheduling/scheduling.module.js';
import { IdentityPersistenceModule } from './infrastructure/persistence/identity-persistence.module.js';
import { identityApplicationProviders } from './infrastructure/identity-application.providers.js';
import { ReconciliationJobBootstrap } from './infrastructure/reconciliation-job.bootstrap.js';
import { TenantsController } from './presentation/controllers/tenants.controller.js';
import { OrganizationsController } from './presentation/controllers/organizations.controller.js';
import { OrganizationOpsController } from './presentation/controllers/organization-ops.controller.js';
import { UsersController } from './presentation/controllers/users.controller.js';
import { MembershipsController } from './presentation/controllers/memberships.controller.js';
import { InvitationsController } from './presentation/controllers/invitations.controller.js';
import { RolesController } from './presentation/controllers/roles.controller.js';
import { SettingsController } from './presentation/controllers/settings.controller.js';
import {
  TenantSettingsResourcesController,
  AuditLogsController,
} from './presentation/controllers/tenant-settings-resources.controller.js';
import { SecurityController, SessionsController } from './presentation/controllers/security.controller.js';
import { ReconciliationController } from './presentation/controllers/reconciliation.controller.js';
import { FeatureFlagsController } from './presentation/controllers/feature-flags.controller.js';
import {
  DelegationsController,
  EmergencyAccessController,
} from './presentation/controllers/delegation.controller.js';
import { TransitionTenantStatusUseCase } from './application/tenant/tenant.use-cases.js';
import { TenantKeycloakLifecycleService } from './application/services/tenant-keycloak-lifecycle.service.js';
import { OrganizationAccessPolicyService } from './application/services/organization-access-policy.service.js';

/**
 * Identity bounded context — Hexagonal / DDD layout:
 * - domain/       entities, ports, lifecycle rules (Identity bounded context)
 * - application/  use cases
 * - infrastructure/ DI providers, scheduled jobs
 * - presentation/ controllers + DTOs
 */
@Module({
  imports: [
    IdentityPersistenceModule,
    MessagingModule,
    StorageModule,
    EmailModule,
    FeatureFlagsModule,
    SchedulingModule,
  ],
  controllers: [
    TenantsController,
    OrganizationsController,
    OrganizationOpsController,
    UsersController,
    MembershipsController,
    InvitationsController,
    RolesController,
    SettingsController,
    TenantSettingsResourcesController,
    AuditLogsController,
    SecurityController,
    SessionsController,
    ReconciliationController,
    FeatureFlagsController,
    DelegationsController,
    EmergencyAccessController,
  ],
  providers: [...identityApplicationProviders, ReconciliationJobBootstrap],
  exports: [TransitionTenantStatusUseCase, TenantKeycloakLifecycleService, OrganizationAccessPolicyService],
})
export class IdentityModule {}
