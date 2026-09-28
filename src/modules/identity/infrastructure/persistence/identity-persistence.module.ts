import { Module } from '@nestjs/common';
import { TENANT_REGISTRY_PORT } from '../../domain/ports/tenant-registry.port.js';
import { TENANT_ADMIN_PORT } from '../../domain/ports/tenant-admin.port.js';
import { DOMAIN_REGISTRY_PORT } from '../../domain/ports/domain-registry.port.js';
import { PgDomainRegistry } from './pg-domain-registry.js';
import { ORGANIZATION_REPOSITORY_PORT } from '../../domain/ports/organization-repository.port.js';
import { ORGANIZATION_ADMIN_PORT } from '../../domain/ports/organization-admin.port.js';
import { ORGANIZATION_OPS_PORT } from '../../domain/ports/organization-ops.port.js';
import { APPLICATION_USER_REPOSITORY_PORT } from '../../domain/ports/application-user-repository.port.js';
import { MEMBERSHIP_REPOSITORY_PORT } from '../../domain/ports/membership-repository.port.js';
import { INVITATION_REPOSITORY_PORT } from '../../domain/ports/invitation-repository.port.js';
import { ROLE_REPOSITORY_PORT } from '../../domain/ports/role-repository.port.js';
import { DELEGATION_REPOSITORY_PORT } from '../../domain/ports/delegation-repository.port.js';
import { EMERGENCY_ACCESS_REPOSITORY_PORT } from '../../domain/ports/emergency-access-repository.port.js';
import { CONTROL_PLANE_TRANSACTION_PORT } from '../../domain/ports/control-plane-transaction.port.js';
import { USER_TENANT_MEMBERSHIP_PORT } from '../../domain/ports/user-tenant-membership.port.js';
import { SETTINGS_REPOSITORY_PORT } from '../../domain/ports/settings-repository.port.js';
import { RECONCILIATION_REPORT_REPOSITORY_PORT } from '../../domain/ports/reconciliation-report-repository.port.js';
import { PLAN_REPOSITORY_PORT } from '../../domain/ports/plan-repository.port.js';
import { TENANT_SETTINGS_RESOURCES_PORT } from '../../domain/ports/tenant-settings-resources.port.js';
import { USER_NOTIFICATION_REPOSITORY_PORT } from '../../domain/ports/user-notification-repository.port.js';
import { USER_DEVICE_REPOSITORY_PORT } from '../../domain/ports/user-device-repository.port.js';
import { USER_LOGIN_HISTORY_REPOSITORY_PORT } from '../../domain/ports/user-login-history-repository.port.js';
import { USER_API_TOKEN_REPOSITORY_PORT } from '../../domain/ports/user-api-token-repository.port.js';
import { USER_ACTIVITY_REPOSITORY_PORT } from '../../domain/ports/user-activity-repository.port.js';
import { PgTenantRegistry } from './pg-tenant-registry.js';
import { PgTenantAdminRepository } from './pg-tenant-admin.repository.js';
import { PgOrganizationRepository } from './pg-organization.repository.js';
import { PgOrganizationAdminRepository } from './pg-organization-admin.repository.js';
import { PgOrganizationOpsRepository } from './pg-organization-ops.repository.js';
import { PgApplicationUserRepository } from './pg-application-user.repository.js';
import { PgMembershipRepository } from './pg-membership.repository.js';
import { PgInvitationRepository } from './pg-invitation.repository.js';
import { PgRoleRepository } from './pg-role.repository.js';
import { PgDelegationRepository } from './pg-delegation.repository.js';
import { PgEmergencyAccessRepository } from './pg-emergency-access.repository.js';
import { PgControlPlaneTransactionManager } from './pg-control-plane-transaction.manager.js';
import { PgUserTenantMembershipRepository } from './pg-user-tenant-membership.repository.js';
import { PgSettingsRepository } from './pg-settings.repository.js';
import { PgReconciliationReportRepository } from './pg-reconciliation-report.repository.js';
import { PgPlanRepository } from './pg-plan.repository.js';
import { PgTenantSettingsResourcesRepository } from './pg-tenant-settings-resources.repository.js';
import { PgUserNotificationRepository } from './pg-user-notification.repository.js';
import { PgUserDeviceRepository } from './pg-user-device.repository.js';
import { PgUserLoginHistoryRepository } from './pg-user-login-history.repository.js';
import { PgUserApiTokenRepository } from './pg-user-api-token.repository.js';
import { PgUserActivityRepository } from './pg-user-activity.repository.js';

@Module({
  providers: [
    { provide: TENANT_REGISTRY_PORT, useClass: PgTenantRegistry },
    { provide: TENANT_ADMIN_PORT, useClass: PgTenantAdminRepository },
    { provide: ORGANIZATION_REPOSITORY_PORT, useClass: PgOrganizationRepository },
    { provide: ORGANIZATION_ADMIN_PORT, useClass: PgOrganizationAdminRepository },
    { provide: ORGANIZATION_OPS_PORT, useClass: PgOrganizationOpsRepository },
    { provide: APPLICATION_USER_REPOSITORY_PORT, useClass: PgApplicationUserRepository },
    { provide: MEMBERSHIP_REPOSITORY_PORT, useClass: PgMembershipRepository },
    { provide: INVITATION_REPOSITORY_PORT, useClass: PgInvitationRepository },
    { provide: ROLE_REPOSITORY_PORT, useClass: PgRoleRepository },
    { provide: DELEGATION_REPOSITORY_PORT, useClass: PgDelegationRepository },
    { provide: EMERGENCY_ACCESS_REPOSITORY_PORT, useClass: PgEmergencyAccessRepository },
    { provide: CONTROL_PLANE_TRANSACTION_PORT, useClass: PgControlPlaneTransactionManager },
    { provide: USER_TENANT_MEMBERSHIP_PORT, useClass: PgUserTenantMembershipRepository },
    { provide: SETTINGS_REPOSITORY_PORT, useClass: PgSettingsRepository },
    {
      provide: RECONCILIATION_REPORT_REPOSITORY_PORT,
      useClass: PgReconciliationReportRepository,
    },
    { provide: DOMAIN_REGISTRY_PORT, useClass: PgDomainRegistry },
    { provide: PLAN_REPOSITORY_PORT, useClass: PgPlanRepository },
    { provide: TENANT_SETTINGS_RESOURCES_PORT, useClass: PgTenantSettingsResourcesRepository },
    { provide: USER_NOTIFICATION_REPOSITORY_PORT, useClass: PgUserNotificationRepository },
    { provide: USER_DEVICE_REPOSITORY_PORT, useClass: PgUserDeviceRepository },
    { provide: USER_LOGIN_HISTORY_REPOSITORY_PORT, useClass: PgUserLoginHistoryRepository },
    { provide: USER_API_TOKEN_REPOSITORY_PORT, useClass: PgUserApiTokenRepository },
    { provide: USER_ACTIVITY_REPOSITORY_PORT, useClass: PgUserActivityRepository },
  ],
  exports: [
    TENANT_REGISTRY_PORT,
    TENANT_ADMIN_PORT,
    ORGANIZATION_REPOSITORY_PORT,
    ORGANIZATION_ADMIN_PORT,
    ORGANIZATION_OPS_PORT,
    APPLICATION_USER_REPOSITORY_PORT,
    MEMBERSHIP_REPOSITORY_PORT,
    INVITATION_REPOSITORY_PORT,
    ROLE_REPOSITORY_PORT,
    DELEGATION_REPOSITORY_PORT,
    EMERGENCY_ACCESS_REPOSITORY_PORT,
    CONTROL_PLANE_TRANSACTION_PORT,
    USER_TENANT_MEMBERSHIP_PORT,
    SETTINGS_REPOSITORY_PORT,
    RECONCILIATION_REPORT_REPOSITORY_PORT,
    DOMAIN_REGISTRY_PORT,
    PLAN_REPOSITORY_PORT,
    TENANT_SETTINGS_RESOURCES_PORT,
    USER_NOTIFICATION_REPOSITORY_PORT,
    USER_DEVICE_REPOSITORY_PORT,
    USER_LOGIN_HISTORY_REPOSITORY_PORT,
    USER_API_TOKEN_REPOSITORY_PORT,
    USER_ACTIVITY_REPOSITORY_PORT,
  ],
})
export class IdentityPersistenceModule {}
