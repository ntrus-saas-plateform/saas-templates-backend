import type { Provider } from '@nestjs/common';
import { OrganizationAccessPolicyService } from '../application/services/organization-access-policy.service.js';
import { TenantMailSurfaceService } from '../application/services/tenant-mail-surface.service.js';
import { TENANT_REGISTRY_PORT } from '../domain/ports/tenant-registry.port.js';
import { TENANT_ADMIN_PORT } from '../domain/ports/tenant-admin.port.js';
import { USER_TENANT_MEMBERSHIP_PORT } from '../domain/ports/user-tenant-membership.port.js';
import { CONTROL_PLANE_TRANSACTION_PORT } from '../domain/ports/control-plane-transaction.port.js';
import { ORGANIZATION_REPOSITORY_PORT } from '../domain/ports/organization-repository.port.js';
import { ORGANIZATION_ADMIN_PORT } from '../domain/ports/organization-admin.port.js';
import { ORGANIZATION_OPS_PORT } from '../domain/ports/organization-ops.port.js';
import { EVENT_PUBLISHER_PORT } from '../domain/ports/event-publisher.port.js';
import { ControlPlaneOutboxTransactionService } from '../../../shared/messaging/control-plane-outbox-transaction.service.js';
import { OutboxTransactionService } from '../../../shared/messaging/outbox-transaction.service.js';
import { APPLICATION_USER_REPOSITORY_PORT } from '../domain/ports/application-user-repository.port.js';
import { MEMBERSHIP_REPOSITORY_PORT } from '../domain/ports/membership-repository.port.js';
import { INVITATION_REPOSITORY_PORT } from '../domain/ports/invitation-repository.port.js';
import { ROLE_REPOSITORY_PORT } from '../domain/ports/role-repository.port.js';
import { SETTINGS_REPOSITORY_PORT } from '../domain/ports/settings-repository.port.js';
import { CONFIGURATION_RESOLVER_PORT } from '../domain/ports/configuration-resolver.port.js';
import { KEYCLOAK_ADMIN_PORT } from '../domain/ports/keycloak-admin.port.js';
import { FEATURE_FLAG_SERVICE_PORT } from '../domain/feature-flag/feature-flag.port.js';
import { PLAN_REPOSITORY_PORT } from '../domain/ports/plan-repository.port.js';
import { FILE_STORAGE_PORT } from '../../../core/domain/ports/file-storage.port.js';
import { EMAIL_SENDER_PORT } from '../../../core/domain/ports/email-sender.port.js';
import {
  GetTenantUseCase,
  UpdateTenantUseCase,
  TransitionTenantStatusUseCase,
  TransferTenantOwnershipUseCase,
} from '../application/tenant/tenant.use-cases.js';
import {
  ListOrganizationsUseCase,
  ListOrganizationTreeUseCase,
  GetOrganizationUseCase,
  CreateOrganizationUseCase,
  UpdateOrganizationUseCase,
  SuspendOrganizationUseCase,
  ActivateOrganizationUseCase,
} from '../application/organization/organization.use-cases.js';
import {
  ListFacilitiesUseCase,
  CreateFacilityUseCase,
  UpdateFacilityUseCase,
  DeleteFacilityUseCase,
  ListLocationTypesUseCase,
  ListWarehousesUseCase,
  CreateWarehouseUseCase,
  UpdateWarehouseUseCase,
  DeleteWarehouseUseCase,
  ListWarehouseZonesUseCase,
  CreateWarehouseZoneUseCase,
  UpdateWarehouseZoneUseCase,
  DeleteWarehouseZoneUseCase,
  ListWarehouseLocationsUseCase,
  CreateWarehouseLocationUseCase,
  UpdateWarehouseLocationUseCase,
  DeleteWarehouseLocationUseCase,
  ListPosTerminalsUseCase,
  CreatePosTerminalUseCase,
  UpdatePosTerminalUseCase,
  DeletePosTerminalUseCase,
  ListCashRegistersUseCase,
  CreateCashRegisterUseCase,
  UpdateCashRegisterUseCase,
  DeleteCashRegisterUseCase,
  ListWorkflowsUseCase,
  CreateWorkflowUseCase,
  UpdateWorkflowUseCase,
  DeleteWorkflowUseCase,
} from '../application/organization/organization-ops.use-cases.js';
import {
  GetMyProfileUseCase,
  UpdateMyProfileUseCase,
  UploadMyAvatarUseCase,
  GetUserByIdentityUseCase,
  ListMyMembershipsUseCase,
} from '../application/user/user.use-cases.js';
import {
  GetMyPreferencesUseCase,
  UpdateMyPreferencesUseCase,
} from '../application/user/user-preferences.use-cases.js';
import {
  GetMyPersonalizationUseCase,
  UpdateMyPersonalizationUseCase,
  ListMyNotificationsUseCase,
  MarkNotificationReadUseCase,
  MarkAllNotificationsReadUseCase,
  DeleteMyNotificationUseCase,
  CreateMyNotificationUseCase,
  ListMyDevicesUseCase,
  TrustMyDeviceUseCase,
  RemoveMyDeviceUseCase,
} from '../application/user/user-account-phase2.use-cases.js';
import {
  ListMyLoginHistoryUseCase,
  RecordMyLoginUseCase,
  ListMyApiTokensUseCase,
  CreateMyApiTokenUseCase,
  RevokeMyApiTokenUseCase,
  ListMyActivityUseCase,
  CreateMyActivityUseCase,
  ClearMyActivityUseCase,
  EnrollMyPushDeviceUseCase,
  ClearMyDevicePushUseCase,
} from '../application/user/user-account-phase3.use-cases.js';
import {
  GetMySecurityOverviewUseCase,
  DeleteMyCredentialUseCase,
} from '../application/security/user-security.use-cases.js';
import {
  GetMyIdentityOverviewUseCase,
  UnlinkMyIdentityUseCase,
  RequestMyEmailVerificationUseCase,
  RequestMyPasswordResetUseCase,
  ListIdentityProvidersUseCase,
} from '../application/security/identity.use-cases.js';
import {
  CreateIdentityProviderUseCase,
  UpdateIdentityProviderUseCase,
  DeleteIdentityProviderUseCase,
  GetIdentityProviderUseCase,
  SendPhoneVerificationOtpUseCase,
  VerifyPhoneVerificationOtpUseCase,
} from '../application/security/identity-providers-phone.use-cases.js';
import { WHATSAPP_OTP_PORT } from '../domain/ports/whatsapp-otp.port.js';
import { MetaWhatsAppOtpAdapter } from './whatsapp/meta-whatsapp-otp.adapter.js';
import { CacheService } from '../../../shared/database/cache.service.js';
import { USER_PREFERENCES_PORT } from '../../../core/domain/ports/user-preferences.port.js';
import { USER_NOTIFICATION_REPOSITORY_PORT } from '../domain/ports/user-notification-repository.port.js';
import { USER_DEVICE_REPOSITORY_PORT } from '../domain/ports/user-device-repository.port.js';
import { USER_LOGIN_HISTORY_REPOSITORY_PORT } from '../domain/ports/user-login-history-repository.port.js';
import { USER_API_TOKEN_REPOSITORY_PORT } from '../domain/ports/user-api-token-repository.port.js';
import { USER_ACTIVITY_REPOSITORY_PORT } from '../domain/ports/user-activity-repository.port.js';
import {
  ListMembershipsUseCase,
  GrantMembershipUseCase,
  RevokeMembershipUseCase,
  UpdateMembershipRolesUseCase,
} from '../application/membership/membership.use-cases.js';
import {
  CreateInvitationUseCase,
  AcceptInvitationUseCase,
  RevokeInvitationUseCase,
  ListInvitationsUseCase,
} from '../application/invitation/invitation.use-cases.js';
import {
  ListUsersUseCase,
  SuspendUserUseCase,
  DisableUserUseCase,
  ReactivateUserUseCase,
} from '../application/user/user-lifecycle.use-cases.js';
import { UserKeycloakLifecycleService } from '../application/services/user-keycloak-lifecycle.service.js';
import { TOKEN_REVOCATION_PORT } from '../../../core/domain/ports/token-revocation.port.js';
import { RECONCILIATION_REPORT_REPOSITORY_PORT } from '../domain/ports/reconciliation-report-repository.port.js';
import { ListRolesUseCase, ListPermissionsUseCase, CreateRoleUseCase, UpdateRoleUseCase, DeleteRoleUseCase } from '../application/role/role.use-cases.js';
import {
  GetTenantSettingsNamespaceUseCase,
  UpdateTenantSettingsNamespaceUseCase,
  GetOrganizationSettingsNamespaceUseCase,
  UpdateOrganizationSettingsNamespaceUseCase,
} from '../application/configuration/settings.use-cases.js';
import {
  GetSettingsCatalogUseCase,
  ListTenantResourceUseCase,
  CreateTenantResourceUseCase,
  UpdateTenantResourceUseCase,
  DeleteTenantResourceUseCase,
  PreviewNumberSequenceUseCase,
  NextNumberSequenceUseCase,
  ListAuditLogsUseCase,
  GetTenantModulesUseCase,
  PatchTenantModulesUseCase,
  GetTenantBillingOverviewUseCase,
} from '../application/configuration/tenant-settings-resources.use-cases.js';
import { TENANT_SETTINGS_RESOURCES_PORT } from '../domain/ports/tenant-settings-resources.port.js';
import {
  GetSecurityPoliciesUseCase,
  UpdateSecurityPoliciesUseCase,
  ListSessionsUseCase,
  RevokeSessionUseCase,
  RevokeAllSessionsUseCase,
  LogoutCurrentTokenUseCase,
  GetMfaStatusUseCase,
} from '../application/security/security.use-cases.js';
import { ListFeatureFlagsUseCase } from '../application/feature-flag/list-feature-flags.use-case.js';
import { ReconcileKeycloakUseCase } from '../application/reconciliation/reconcile-keycloak.use-case.js';
import { DOMAIN_REGISTRY_PORT } from '../domain/ports/domain-registry.port.js';
import { APP_CONFIG } from '../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../shared/configuration/environment.schema.js';
import { TenantDatabaseManager } from '../../../shared/database/tenant-database.manager.js';
import {
  RunReconciliationUseCase,
  GetReconciliationReportUseCase,
  ListReconciliationReportsUseCase,
} from '../application/reconciliation/reconciliation.use-cases.js';
import { KeycloakOrganizationSyncService } from '../application/services/keycloak-sync.service.js';
import { TenantKeycloakLifecycleService } from '../application/services/tenant-keycloak-lifecycle.service.js';
import { DELEGATION_REPOSITORY_PORT } from '../domain/ports/delegation-repository.port.js';
import { EMERGENCY_ACCESS_REPOSITORY_PORT } from '../domain/ports/emergency-access-repository.port.js';
import {
  GrantDelegationUseCase,
  ListDelegationsUseCase,
  RevokeDelegationUseCase,
  GrantEmergencyAccessUseCase,
  ListEmergencyAccessGrantsUseCase,
  RevokeEmergencyAccessUseCase,
} from '../application/delegation/delegation.use-cases.js';

export const identityApplicationProviders: Provider[] = [
  TenantKeycloakLifecycleService,
  UserKeycloakLifecycleService,
  {
    provide: KeycloakOrganizationSyncService,
    useFactory: (
      keycloakAdmin: import('../domain/ports/keycloak-admin.port.js').KeycloakAdminPort,
      featureFlags: import('../domain/feature-flag/feature-flag.port.js').FeatureFlagServicePort,
    ) => new KeycloakOrganizationSyncService(keycloakAdmin, featureFlags),
    inject: [KEYCLOAK_ADMIN_PORT, FEATURE_FLAG_SERVICE_PORT],
  },
  {
    provide: GetTenantUseCase,
    useFactory: (tenantRegistry) => new GetTenantUseCase(tenantRegistry),
    inject: [TENANT_REGISTRY_PORT],
  },
  {
    provide: UpdateTenantUseCase,
    useFactory: (tenantAdmin, settings) => new UpdateTenantUseCase(tenantAdmin, settings),
    inject: [TENANT_ADMIN_PORT, SETTINGS_REPOSITORY_PORT],
  },
  {
    provide: TransitionTenantStatusUseCase,
    useFactory: (tenantAdmin, keycloakLifecycle) =>
      new TransitionTenantStatusUseCase(tenantAdmin, keycloakLifecycle),
    inject: [TENANT_ADMIN_PORT, TenantKeycloakLifecycleService],
  },
  {
    provide: TransferTenantOwnershipUseCase,
    useFactory: (tenantAdmin, userTenantMembership, controlPlaneTransaction) =>
      new TransferTenantOwnershipUseCase(
        tenantAdmin,
        userTenantMembership,
        controlPlaneTransaction,
      ),
    inject: [TENANT_ADMIN_PORT, USER_TENANT_MEMBERSHIP_PORT, CONTROL_PLANE_TRANSACTION_PORT],
  },
  {
    provide: ListOrganizationsUseCase,
    useFactory: (organizationRepository) => new ListOrganizationsUseCase(organizationRepository),
    inject: [ORGANIZATION_REPOSITORY_PORT],
  },
  {
    provide: ListOrganizationTreeUseCase,
    useFactory: (organizationRepository) => new ListOrganizationTreeUseCase(organizationRepository),
    inject: [ORGANIZATION_REPOSITORY_PORT],
  },
  {
    provide: GetOrganizationUseCase,
    useFactory: (organizationRepository) => new GetOrganizationUseCase(organizationRepository),
    inject: [ORGANIZATION_REPOSITORY_PORT],
  },
  {
    provide: CreateOrganizationUseCase,
    useFactory: (organizationAdmin, controlPlaneOutbox, keycloakSync, planRepository, tenantRegistry) =>
      new CreateOrganizationUseCase(organizationAdmin, controlPlaneOutbox, keycloakSync, planRepository, tenantRegistry),
    inject: [ORGANIZATION_ADMIN_PORT, ControlPlaneOutboxTransactionService, KeycloakOrganizationSyncService, PLAN_REPOSITORY_PORT, TENANT_REGISTRY_PORT],
  },
  {
    provide: UpdateOrganizationUseCase,
    useFactory: (organizationAdmin, organizationRepository, controlPlaneOutbox, keycloakSync) =>
      new UpdateOrganizationUseCase(organizationAdmin, organizationRepository, controlPlaneOutbox, keycloakSync),
    inject: [ORGANIZATION_ADMIN_PORT, ORGANIZATION_REPOSITORY_PORT, ControlPlaneOutboxTransactionService, KeycloakOrganizationSyncService],
  },
  {
    provide: SuspendOrganizationUseCase,
    useFactory: (organizationAdmin, controlPlaneOutbox) =>
      new SuspendOrganizationUseCase(organizationAdmin, controlPlaneOutbox),
    inject: [ORGANIZATION_ADMIN_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ActivateOrganizationUseCase,
    useFactory: (organizationAdmin, controlPlaneOutbox) =>
      new ActivateOrganizationUseCase(organizationAdmin, controlPlaneOutbox),
    inject: [ORGANIZATION_ADMIN_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ListFacilitiesUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new ListFacilitiesUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: CreateFacilityUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new CreateFacilityUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: UpdateFacilityUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new UpdateFacilityUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: DeleteFacilityUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new DeleteFacilityUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: ListLocationTypesUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new ListLocationTypesUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: ListWarehousesUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new ListWarehousesUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: CreateWarehouseUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new CreateWarehouseUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: UpdateWarehouseUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new UpdateWarehouseUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: DeleteWarehouseUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new DeleteWarehouseUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: ListWarehouseZonesUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new ListWarehouseZonesUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: CreateWarehouseZoneUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new CreateWarehouseZoneUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: UpdateWarehouseZoneUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new UpdateWarehouseZoneUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: DeleteWarehouseZoneUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new DeleteWarehouseZoneUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: ListWarehouseLocationsUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new ListWarehouseLocationsUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: CreateWarehouseLocationUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new CreateWarehouseLocationUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: UpdateWarehouseLocationUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new UpdateWarehouseLocationUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: DeleteWarehouseLocationUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new DeleteWarehouseLocationUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: ListPosTerminalsUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new ListPosTerminalsUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: CreatePosTerminalUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new CreatePosTerminalUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: UpdatePosTerminalUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new UpdatePosTerminalUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: DeletePosTerminalUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new DeletePosTerminalUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: ListCashRegistersUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new ListCashRegistersUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: CreateCashRegisterUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new CreateCashRegisterUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: UpdateCashRegisterUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new UpdateCashRegisterUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: DeleteCashRegisterUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new DeleteCashRegisterUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: ListWorkflowsUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new ListWorkflowsUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: CreateWorkflowUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new CreateWorkflowUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: UpdateWorkflowUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new UpdateWorkflowUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: DeleteWorkflowUseCase,
    useFactory: (organizationRepository, organizationOps) =>
      new DeleteWorkflowUseCase(organizationRepository, organizationOps),
    inject: [ORGANIZATION_REPOSITORY_PORT, ORGANIZATION_OPS_PORT],
  },
  {
    provide: GetMyProfileUseCase,
    useFactory: (applicationUserRepository, membershipRepository, organizationRepository) =>
      new GetMyProfileUseCase(
        applicationUserRepository,
        membershipRepository,
        organizationRepository,
      ),
    inject: [
      APPLICATION_USER_REPOSITORY_PORT,
      MEMBERSHIP_REPOSITORY_PORT,
      ORGANIZATION_REPOSITORY_PORT,
    ],
  },
  {
    provide: UpdateMyProfileUseCase,
    useFactory: (applicationUserRepository, membershipRepository, organizationRepository) =>
      new UpdateMyProfileUseCase(
        applicationUserRepository,
        membershipRepository,
        organizationRepository,
      ),
    inject: [
      APPLICATION_USER_REPOSITORY_PORT,
      MEMBERSHIP_REPOSITORY_PORT,
      ORGANIZATION_REPOSITORY_PORT,
    ],
  },
  {
    provide: UploadMyAvatarUseCase,
    useFactory: (
      applicationUserRepository,
      membershipRepository,
      organizationRepository,
      storage,
    ) =>
      new UploadMyAvatarUseCase(
        applicationUserRepository,
        membershipRepository,
        organizationRepository,
        storage,
      ),
    inject: [
      APPLICATION_USER_REPOSITORY_PORT,
      MEMBERSHIP_REPOSITORY_PORT,
      ORGANIZATION_REPOSITORY_PORT,
      FILE_STORAGE_PORT,
    ],
  },
  {
    provide: GetUserByIdentityUseCase,
    useFactory: (applicationUserRepository, membershipRepository, organizationRepository) =>
      new GetUserByIdentityUseCase(
        applicationUserRepository,
        membershipRepository,
        organizationRepository,
      ),
    inject: [
      APPLICATION_USER_REPOSITORY_PORT,
      MEMBERSHIP_REPOSITORY_PORT,
      ORGANIZATION_REPOSITORY_PORT,
    ],
  },
  {
    provide: ListMyMembershipsUseCase,
    useFactory: (membershipRepository) => new ListMyMembershipsUseCase(membershipRepository),
    inject: [MEMBERSHIP_REPOSITORY_PORT],
  },
  {
    provide: GetMyPreferencesUseCase,
    useFactory: (userPreferences, configurationResolver) =>
      new GetMyPreferencesUseCase(userPreferences, configurationResolver),
    inject: [USER_PREFERENCES_PORT, CONFIGURATION_RESOLVER_PORT],
  },
  {
    provide: UpdateMyPreferencesUseCase,
    useFactory: (userPreferences) => new UpdateMyPreferencesUseCase(userPreferences),
    inject: [USER_PREFERENCES_PORT],
  },
  {
    provide: GetMyPersonalizationUseCase,
    useFactory: (userPreferences) => new GetMyPersonalizationUseCase(userPreferences),
    inject: [USER_PREFERENCES_PORT],
  },
  {
    provide: UpdateMyPersonalizationUseCase,
    useFactory: (userPreferences) => new UpdateMyPersonalizationUseCase(userPreferences),
    inject: [USER_PREFERENCES_PORT],
  },
  {
    provide: ListMyNotificationsUseCase,
    useFactory: (notifications) => new ListMyNotificationsUseCase(notifications),
    inject: [USER_NOTIFICATION_REPOSITORY_PORT],
  },
  {
    provide: MarkNotificationReadUseCase,
    useFactory: (notifications) => new MarkNotificationReadUseCase(notifications),
    inject: [USER_NOTIFICATION_REPOSITORY_PORT],
  },
  {
    provide: MarkAllNotificationsReadUseCase,
    useFactory: (notifications) => new MarkAllNotificationsReadUseCase(notifications),
    inject: [USER_NOTIFICATION_REPOSITORY_PORT],
  },
  {
    provide: DeleteMyNotificationUseCase,
    useFactory: (notifications) => new DeleteMyNotificationUseCase(notifications),
    inject: [USER_NOTIFICATION_REPOSITORY_PORT],
  },
  {
    provide: CreateMyNotificationUseCase,
    useFactory: (notifications) => new CreateMyNotificationUseCase(notifications),
    inject: [USER_NOTIFICATION_REPOSITORY_PORT],
  },
  {
    provide: ListMyDevicesUseCase,
    useFactory: (devices, keycloakAdmin) =>
      new ListMyDevicesUseCase(devices, keycloakAdmin),
    inject: [USER_DEVICE_REPOSITORY_PORT, KEYCLOAK_ADMIN_PORT],
  },
  {
    provide: TrustMyDeviceUseCase,
    useFactory: (devices) => new TrustMyDeviceUseCase(devices),
    inject: [USER_DEVICE_REPOSITORY_PORT],
  },
  {
    provide: RemoveMyDeviceUseCase,
    useFactory: (devices) => new RemoveMyDeviceUseCase(devices),
    inject: [USER_DEVICE_REPOSITORY_PORT],
  },
  {
    provide: ListMyLoginHistoryUseCase,
    useFactory: (loginHistory) => new ListMyLoginHistoryUseCase(loginHistory),
    inject: [USER_LOGIN_HISTORY_REPOSITORY_PORT],
  },
  {
    provide: RecordMyLoginUseCase,
    useFactory: (loginHistory, notifications) =>
      new RecordMyLoginUseCase(loginHistory, notifications),
    inject: [USER_LOGIN_HISTORY_REPOSITORY_PORT, USER_NOTIFICATION_REPOSITORY_PORT],
  },
  {
    provide: ListMyApiTokensUseCase,
    useFactory: (tokens) => new ListMyApiTokensUseCase(tokens),
    inject: [USER_API_TOKEN_REPOSITORY_PORT],
  },
  {
    provide: CreateMyApiTokenUseCase,
    useFactory: (tokens) => new CreateMyApiTokenUseCase(tokens),
    inject: [USER_API_TOKEN_REPOSITORY_PORT],
  },
  {
    provide: RevokeMyApiTokenUseCase,
    useFactory: (tokens) => new RevokeMyApiTokenUseCase(tokens),
    inject: [USER_API_TOKEN_REPOSITORY_PORT],
  },
  {
    provide: ListMyActivityUseCase,
    useFactory: (activity) => new ListMyActivityUseCase(activity),
    inject: [USER_ACTIVITY_REPOSITORY_PORT],
  },
  {
    provide: CreateMyActivityUseCase,
    useFactory: (activity) => new CreateMyActivityUseCase(activity),
    inject: [USER_ACTIVITY_REPOSITORY_PORT],
  },
  {
    provide: ClearMyActivityUseCase,
    useFactory: (activity) => new ClearMyActivityUseCase(activity),
    inject: [USER_ACTIVITY_REPOSITORY_PORT],
  },
  {
    provide: EnrollMyPushDeviceUseCase,
    useFactory: (devices) => new EnrollMyPushDeviceUseCase(devices),
    inject: [USER_DEVICE_REPOSITORY_PORT],
  },
  {
    provide: ClearMyDevicePushUseCase,
    useFactory: (devices) => new ClearMyDevicePushUseCase(devices),
    inject: [USER_DEVICE_REPOSITORY_PORT],
  },
  {
    provide: GetMySecurityOverviewUseCase,
    useFactory: (keycloakAdmin) => new GetMySecurityOverviewUseCase(keycloakAdmin),
    inject: [KEYCLOAK_ADMIN_PORT],
  },
  {
    provide: GetMyIdentityOverviewUseCase,
    useFactory: (keycloakAdmin, preferences) =>
      new GetMyIdentityOverviewUseCase(keycloakAdmin, preferences),
    inject: [KEYCLOAK_ADMIN_PORT, USER_PREFERENCES_PORT],
  },
  {
    provide: UnlinkMyIdentityUseCase,
    useFactory: (keycloakAdmin) => new UnlinkMyIdentityUseCase(keycloakAdmin),
    inject: [KEYCLOAK_ADMIN_PORT],
  },
  {
    provide: RequestMyEmailVerificationUseCase,
    useFactory: (keycloakAdmin) => new RequestMyEmailVerificationUseCase(keycloakAdmin),
    inject: [KEYCLOAK_ADMIN_PORT],
  },
  {
    provide: RequestMyPasswordResetUseCase,
    useFactory: (keycloakAdmin) => new RequestMyPasswordResetUseCase(keycloakAdmin),
    inject: [KEYCLOAK_ADMIN_PORT],
  },
  {
    provide: ListIdentityProvidersUseCase,
    useFactory: (keycloakAdmin) => new ListIdentityProvidersUseCase(keycloakAdmin),
    inject: [KEYCLOAK_ADMIN_PORT],
  },
  {
    provide: WHATSAPP_OTP_PORT,
    useClass: MetaWhatsAppOtpAdapter,
  },
  {
    provide: GetIdentityProviderUseCase,
    useFactory: (keycloakAdmin) => new GetIdentityProviderUseCase(keycloakAdmin),
    inject: [KEYCLOAK_ADMIN_PORT],
  },
  {
    provide: CreateIdentityProviderUseCase,
    useFactory: (keycloakAdmin) => new CreateIdentityProviderUseCase(keycloakAdmin),
    inject: [KEYCLOAK_ADMIN_PORT],
  },
  {
    provide: UpdateIdentityProviderUseCase,
    useFactory: (keycloakAdmin) => new UpdateIdentityProviderUseCase(keycloakAdmin),
    inject: [KEYCLOAK_ADMIN_PORT],
  },
  {
    provide: DeleteIdentityProviderUseCase,
    useFactory: (keycloakAdmin) => new DeleteIdentityProviderUseCase(keycloakAdmin),
    inject: [KEYCLOAK_ADMIN_PORT],
  },
  {
    provide: SendPhoneVerificationOtpUseCase,
    useFactory: (cache, whatsapp, preferences) =>
      new SendPhoneVerificationOtpUseCase(cache, whatsapp, preferences),
    inject: [CacheService, WHATSAPP_OTP_PORT, USER_PREFERENCES_PORT],
  },
  {
    provide: VerifyPhoneVerificationOtpUseCase,
    useFactory: (cache, preferences) =>
      new VerifyPhoneVerificationOtpUseCase(cache, preferences),
    inject: [CacheService, USER_PREFERENCES_PORT],
  },
  {
    provide: DeleteMyCredentialUseCase,
    useFactory: (keycloakAdmin) => new DeleteMyCredentialUseCase(keycloakAdmin),
    inject: [KEYCLOAK_ADMIN_PORT],
  },
  {
    provide: UserKeycloakLifecycleService,
    useFactory: (keycloakAdmin, tokenRevocation) =>
      new UserKeycloakLifecycleService(keycloakAdmin, tokenRevocation),
    inject: [KEYCLOAK_ADMIN_PORT, TOKEN_REVOCATION_PORT],
  },
  {
    provide: ListUsersUseCase,
    useFactory: (applicationUserRepository, membershipRepository, organizationRepository) =>
      new ListUsersUseCase(
        applicationUserRepository,
        membershipRepository,
        organizationRepository,
      ),
    inject: [
      APPLICATION_USER_REPOSITORY_PORT,
      MEMBERSHIP_REPOSITORY_PORT,
      ORGANIZATION_REPOSITORY_PORT,
    ],
  },
  {
    provide: SuspendUserUseCase,
    useFactory: (applicationUserRepository, userKeycloakLifecycle, controlPlaneOutbox) =>
      new SuspendUserUseCase(applicationUserRepository, userKeycloakLifecycle, controlPlaneOutbox),
    inject: [APPLICATION_USER_REPOSITORY_PORT, UserKeycloakLifecycleService, ControlPlaneOutboxTransactionService],
  },
  {
    provide: DisableUserUseCase,
    useFactory: (applicationUserRepository, userKeycloakLifecycle, controlPlaneOutbox) =>
      new DisableUserUseCase(applicationUserRepository, userKeycloakLifecycle, controlPlaneOutbox),
    inject: [APPLICATION_USER_REPOSITORY_PORT, UserKeycloakLifecycleService, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ReactivateUserUseCase,
    useFactory: (applicationUserRepository, userKeycloakLifecycle, controlPlaneOutbox) =>
      new ReactivateUserUseCase(applicationUserRepository, userKeycloakLifecycle, controlPlaneOutbox),
    inject: [APPLICATION_USER_REPOSITORY_PORT, UserKeycloakLifecycleService, ControlPlaneOutboxTransactionService],
  },
  {
    provide: TenantMailSurfaceService,
    useFactory: (configuration, domainRegistry, tenantRegistry, config) =>
      new TenantMailSurfaceService(configuration, domainRegistry, tenantRegistry, {
        fallbackPublicAppUrl: config.PUBLIC_APP_URL,
        fallbackMailFrom: config.MAIL_FROM,
        tenantBaseDomain: config.TENANT_BASE_DOMAIN,
      }),
    inject: [CONFIGURATION_RESOLVER_PORT, DOMAIN_REGISTRY_PORT, TENANT_REGISTRY_PORT, APP_CONFIG],
  },
  {
    provide: OrganizationAccessPolicyService,
    useFactory: (membershipRepository) =>
      new OrganizationAccessPolicyService(membershipRepository),
    inject: [MEMBERSHIP_REPOSITORY_PORT],
  },
  {
    provide: ListMembershipsUseCase,
    useFactory: (membershipRepository, organizationAccessPolicy) =>
      new ListMembershipsUseCase(membershipRepository, organizationAccessPolicy),
    inject: [MEMBERSHIP_REPOSITORY_PORT, OrganizationAccessPolicyService],
  },
  {
    provide: GrantMembershipUseCase,
    useFactory: (
      organizationRepository,
      membershipRepository,
      roleRepository,
      userTenantMembership,
      controlPlaneOutbox,
      keycloakSync,
      planRepository,
      tenantRegistry,
    ) =>
      new GrantMembershipUseCase(
        organizationRepository,
        membershipRepository,
        roleRepository,
        userTenantMembership,
        controlPlaneOutbox,
        keycloakSync,
        planRepository,
        tenantRegistry,
      ),
    inject: [
      ORGANIZATION_REPOSITORY_PORT,
      MEMBERSHIP_REPOSITORY_PORT,
      ROLE_REPOSITORY_PORT,
      USER_TENANT_MEMBERSHIP_PORT,
      ControlPlaneOutboxTransactionService,
      KeycloakOrganizationSyncService,
      PLAN_REPOSITORY_PORT,
      TENANT_REGISTRY_PORT,
    ],
  },
  {
    provide: RevokeMembershipUseCase,
    useFactory: (organizationRepository, membershipRepository, controlPlaneOutbox, keycloakSync) =>
      new RevokeMembershipUseCase(
        organizationRepository,
        membershipRepository,
        controlPlaneOutbox,
        keycloakSync,
      ),
    inject: [
      ORGANIZATION_REPOSITORY_PORT,
      MEMBERSHIP_REPOSITORY_PORT,
      ControlPlaneOutboxTransactionService,
      KeycloakOrganizationSyncService,
    ],
  },
  {
    provide: UpdateMembershipRolesUseCase,
    useFactory: (membershipRepository, roleRepository, controlPlaneOutbox) =>
      new UpdateMembershipRolesUseCase(membershipRepository, roleRepository, controlPlaneOutbox),
    inject: [MEMBERSHIP_REPOSITORY_PORT, ROLE_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: CreateInvitationUseCase,
    useFactory: (
      organizationRepository,
      invitationRepository,
      membershipRepository,
      roleRepository,
      controlPlaneOutbox,
      planRepository,
      tenantRegistry,
      emailSender,
      mailSurface,
    ) =>
      new CreateInvitationUseCase(
        organizationRepository,
        invitationRepository,
        membershipRepository,
        roleRepository,
        controlPlaneOutbox,
        planRepository,
        tenantRegistry,
        emailSender,
        mailSurface,
      ),
    inject: [
      ORGANIZATION_REPOSITORY_PORT,
      INVITATION_REPOSITORY_PORT,
      MEMBERSHIP_REPOSITORY_PORT,
      ROLE_REPOSITORY_PORT,
      ControlPlaneOutboxTransactionService,
      PLAN_REPOSITORY_PORT,
      TENANT_REGISTRY_PORT,
      EMAIL_SENDER_PORT,
      TenantMailSurfaceService,
    ],
  },
  {
    provide: AcceptInvitationUseCase,
    useFactory: (
      organizationRepository,
      invitationRepository,
      applicationUserRepository,
      membershipRepository,
      userTenantMembership,
      controlPlaneOutbox,
      keycloakSync,
      keycloakAdmin,
    ) =>
      new AcceptInvitationUseCase(
        organizationRepository,
        invitationRepository,
        applicationUserRepository,
        membershipRepository,
        userTenantMembership,
        controlPlaneOutbox,
        keycloakSync,
        keycloakAdmin,
      ),
    inject: [
      ORGANIZATION_REPOSITORY_PORT,
      INVITATION_REPOSITORY_PORT,
      APPLICATION_USER_REPOSITORY_PORT,
      MEMBERSHIP_REPOSITORY_PORT,
      USER_TENANT_MEMBERSHIP_PORT,
      ControlPlaneOutboxTransactionService,
      KeycloakOrganizationSyncService,
      KEYCLOAK_ADMIN_PORT,
    ],
  },
  {
    provide: RevokeInvitationUseCase,
    useFactory: (invitationRepository) => new RevokeInvitationUseCase(invitationRepository),
    inject: [INVITATION_REPOSITORY_PORT],
  },
  {
    provide: ListInvitationsUseCase,
    useFactory: (invitationRepository, organizationAccessPolicy) =>
      new ListInvitationsUseCase(invitationRepository, organizationAccessPolicy),
    inject: [INVITATION_REPOSITORY_PORT, OrganizationAccessPolicyService],
  },
  {
    provide: ListRolesUseCase,
    useFactory: (roleRepository) => new ListRolesUseCase(roleRepository),
    inject: [ROLE_REPOSITORY_PORT],
  },
  {
    provide: ListPermissionsUseCase,
    useFactory: (roleRepository) => new ListPermissionsUseCase(roleRepository),
    inject: [ROLE_REPOSITORY_PORT],
  },
  {
    provide: CreateRoleUseCase,
    useFactory: (roleRepository) => new CreateRoleUseCase(roleRepository),
    inject: [ROLE_REPOSITORY_PORT],
  },
  {
    provide: UpdateRoleUseCase,
    useFactory: (roleRepository) => new UpdateRoleUseCase(roleRepository),
    inject: [ROLE_REPOSITORY_PORT],
  },
  {
    provide: DeleteRoleUseCase,
    useFactory: (roleRepository) => new DeleteRoleUseCase(roleRepository),
    inject: [ROLE_REPOSITORY_PORT],
  },
  {
    provide: GetTenantSettingsNamespaceUseCase,
    useFactory: (configurationResolver) =>
      new GetTenantSettingsNamespaceUseCase(configurationResolver),
    inject: [CONFIGURATION_RESOLVER_PORT],
  },
  {
    provide: UpdateTenantSettingsNamespaceUseCase,
    useFactory: (settings, configurationResolver, outboxTransaction) =>
      new UpdateTenantSettingsNamespaceUseCase(settings, configurationResolver, outboxTransaction),
    inject: [SETTINGS_REPOSITORY_PORT, CONFIGURATION_RESOLVER_PORT, OutboxTransactionService],
  },
  {
    provide: GetOrganizationSettingsNamespaceUseCase,
    useFactory: (organizationRepository, configurationResolver) =>
      new GetOrganizationSettingsNamespaceUseCase(
        organizationRepository,
        configurationResolver,
      ),
    inject: [ORGANIZATION_REPOSITORY_PORT, CONFIGURATION_RESOLVER_PORT],
  },
  {
    provide: UpdateOrganizationSettingsNamespaceUseCase,
    useFactory: (organizationRepository, settings, configurationResolver, outboxTransaction) =>
      new UpdateOrganizationSettingsNamespaceUseCase(
        organizationRepository,
        settings,
        configurationResolver,
        outboxTransaction,
      ),
    inject: [
      ORGANIZATION_REPOSITORY_PORT,
      SETTINGS_REPOSITORY_PORT,
      CONFIGURATION_RESOLVER_PORT,
      OutboxTransactionService,
    ],
  },
  {
    provide: GetSecurityPoliciesUseCase,
    useFactory: (configurationResolver, keycloakAdmin) =>
      new GetSecurityPoliciesUseCase(configurationResolver, keycloakAdmin),
    inject: [CONFIGURATION_RESOLVER_PORT, KEYCLOAK_ADMIN_PORT],
  },
  {
    provide: UpdateSecurityPoliciesUseCase,
    useFactory: (settings, getPolicies, events) =>
      new UpdateSecurityPoliciesUseCase(settings, getPolicies, events),
    inject: [SETTINGS_REPOSITORY_PORT, GetSecurityPoliciesUseCase, EVENT_PUBLISHER_PORT],
  },
  {
    provide: ListSessionsUseCase,
    useFactory: (keycloakAdmin) => new ListSessionsUseCase(keycloakAdmin),
    inject: [KEYCLOAK_ADMIN_PORT],
  },
  {
    provide: RevokeSessionUseCase,
    useFactory: (keycloakAdmin, tokenRevocation) =>
      new RevokeSessionUseCase(keycloakAdmin, tokenRevocation),
    inject: [KEYCLOAK_ADMIN_PORT, TOKEN_REVOCATION_PORT],
  },
  {
    provide: LogoutCurrentTokenUseCase,
    useFactory: (tokenRevocation) => new LogoutCurrentTokenUseCase(tokenRevocation),
    inject: [TOKEN_REVOCATION_PORT],
  },
  {
    provide: RevokeAllSessionsUseCase,
    useFactory: (keycloakAdmin, tokenRevocation) =>
      new RevokeAllSessionsUseCase(keycloakAdmin, tokenRevocation),
    inject: [KEYCLOAK_ADMIN_PORT, TOKEN_REVOCATION_PORT],
  },
  {
    provide: GetMfaStatusUseCase,
    useFactory: (keycloakAdmin) => new GetMfaStatusUseCase(keycloakAdmin),
    inject: [KEYCLOAK_ADMIN_PORT],
  },
  {
    provide: ListFeatureFlagsUseCase,
    useFactory: (featureFlags) => new ListFeatureFlagsUseCase(featureFlags),
    inject: [FEATURE_FLAG_SERVICE_PORT],
  },
  {
    provide: ReconcileKeycloakUseCase,
    useFactory: (
      organizationRepository,
      membershipRepository,
      organizationAdmin,
      keycloakAdmin,
      applicationUserRepository,
      domainRegistry,
      tenantRegistry,
      config: EnvironmentConfig,
      dbManager: TenantDatabaseManager,
    ) =>
      new ReconcileKeycloakUseCase(
        organizationRepository,
        membershipRepository,
        organizationAdmin,
        keycloakAdmin,
        applicationUserRepository,
        {
          domainRegistry,
          tenantRegistry,
          tenantBaseDomain: config.TENANT_BASE_DOMAIN,
          getTenantPool: (tenantId) => dbManager.getPool(tenantId),
        },
      ),
    inject: [
      ORGANIZATION_REPOSITORY_PORT,
      MEMBERSHIP_REPOSITORY_PORT,
      ORGANIZATION_ADMIN_PORT,
      KEYCLOAK_ADMIN_PORT,
      APPLICATION_USER_REPOSITORY_PORT,
      DOMAIN_REGISTRY_PORT,
      TENANT_REGISTRY_PORT,
      APP_CONFIG,
      TenantDatabaseManager,
    ],
  },
  {
    provide: RunReconciliationUseCase,
    useFactory: (reconcileKeycloak, reportRepository) =>
      new RunReconciliationUseCase(reconcileKeycloak, reportRepository),
    inject: [ReconcileKeycloakUseCase, RECONCILIATION_REPORT_REPOSITORY_PORT],
  },
  {
    provide: GetReconciliationReportUseCase,
    useFactory: (reportRepository) => new GetReconciliationReportUseCase(reportRepository),
    inject: [RECONCILIATION_REPORT_REPOSITORY_PORT],
  },
  {
    provide: ListReconciliationReportsUseCase,
    useFactory: (reportRepository) => new ListReconciliationReportsUseCase(reportRepository),
    inject: [RECONCILIATION_REPORT_REPOSITORY_PORT],
  },
  {
    provide: GrantDelegationUseCase,
    useFactory: (
      organizationRepository,
      membershipRepository,
      roleRepository,
      delegationRepository,
    ) =>
      new GrantDelegationUseCase(
        organizationRepository,
        membershipRepository,
        roleRepository,
        delegationRepository,
      ),
    inject: [
      ORGANIZATION_REPOSITORY_PORT,
      MEMBERSHIP_REPOSITORY_PORT,
      ROLE_REPOSITORY_PORT,
      DELEGATION_REPOSITORY_PORT,
    ],
  },
  {
    provide: ListDelegationsUseCase,
    useFactory: (delegationRepository) => new ListDelegationsUseCase(delegationRepository),
    inject: [DELEGATION_REPOSITORY_PORT],
  },
  {
    provide: RevokeDelegationUseCase,
    useFactory: (delegationRepository) => new RevokeDelegationUseCase(delegationRepository),
    inject: [DELEGATION_REPOSITORY_PORT],
  },
  {
    provide: GrantEmergencyAccessUseCase,
    useFactory: (organizationRepository, emergencyAccessRepository) =>
      new GrantEmergencyAccessUseCase(organizationRepository, emergencyAccessRepository),
    inject: [ORGANIZATION_REPOSITORY_PORT, EMERGENCY_ACCESS_REPOSITORY_PORT],
  },
  {
    provide: ListEmergencyAccessGrantsUseCase,
    useFactory: (emergencyAccessRepository) =>
      new ListEmergencyAccessGrantsUseCase(emergencyAccessRepository),
    inject: [EMERGENCY_ACCESS_REPOSITORY_PORT],
  },
  {
    provide: RevokeEmergencyAccessUseCase,
    useFactory: (emergencyAccessRepository) =>
      new RevokeEmergencyAccessUseCase(emergencyAccessRepository),
    inject: [EMERGENCY_ACCESS_REPOSITORY_PORT],
  },
  { provide: GetSettingsCatalogUseCase, useFactory: () => new GetSettingsCatalogUseCase() },
  {
    provide: ListTenantResourceUseCase,
    useFactory: (resources) => new ListTenantResourceUseCase(resources),
    inject: [TENANT_SETTINGS_RESOURCES_PORT],
  },
  {
    provide: CreateTenantResourceUseCase,
    useFactory: (resources) => new CreateTenantResourceUseCase(resources),
    inject: [TENANT_SETTINGS_RESOURCES_PORT],
  },
  {
    provide: UpdateTenantResourceUseCase,
    useFactory: (resources) => new UpdateTenantResourceUseCase(resources),
    inject: [TENANT_SETTINGS_RESOURCES_PORT],
  },
  {
    provide: DeleteTenantResourceUseCase,
    useFactory: (resources) => new DeleteTenantResourceUseCase(resources),
    inject: [TENANT_SETTINGS_RESOURCES_PORT],
  },
  {
    provide: PreviewNumberSequenceUseCase,
    useFactory: (resources) => new PreviewNumberSequenceUseCase(resources),
    inject: [TENANT_SETTINGS_RESOURCES_PORT],
  },
  {
    provide: NextNumberSequenceUseCase,
    useFactory: (resources) => new NextNumberSequenceUseCase(resources),
    inject: [TENANT_SETTINGS_RESOURCES_PORT],
  },
  {
    provide: ListAuditLogsUseCase,
    useFactory: (resources) => new ListAuditLogsUseCase(resources),
    inject: [TENANT_SETTINGS_RESOURCES_PORT],
  },
  {
    provide: GetTenantModulesUseCase,
    useFactory: (plans, tenants, configurationResolver) =>
      new GetTenantModulesUseCase(plans, tenants, configurationResolver),
    inject: [PLAN_REPOSITORY_PORT, TENANT_REGISTRY_PORT, CONFIGURATION_RESOLVER_PORT],
  },
  {
    provide: PatchTenantModulesUseCase,
    useFactory: (settings, getModules) => new PatchTenantModulesUseCase(settings, getModules),
    inject: [SETTINGS_REPOSITORY_PORT, GetTenantModulesUseCase],
  },
  {
    provide: GetTenantBillingOverviewUseCase,
    useFactory: (tenants, plans, resources, configurationResolver) =>
      new GetTenantBillingOverviewUseCase(tenants, plans, resources, configurationResolver),
    inject: [
      TENANT_REGISTRY_PORT,
      PLAN_REPOSITORY_PORT,
      TENANT_SETTINGS_RESOURCES_PORT,
      CONFIGURATION_RESOLVER_PORT,
    ],
  },
];
