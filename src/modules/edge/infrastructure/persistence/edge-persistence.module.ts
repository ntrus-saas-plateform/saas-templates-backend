import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../../shared/database/database.module.js';
import { ADMINISTRATOR_REPOSITORY_PORT } from '../../domain/ports/administrator-repository.port.js';
import { VERTICAL_REPOSITORY_PORT } from '../../domain/ports/vertical-repository.port.js';
import { MEMBERSHIP_REPOSITORY_PORT } from '../../domain/ports/membership-repository.port.js';
import { INVITATION_REPOSITORY_PORT } from '../../domain/ports/invitation-repository.port.js';
import { ROLE_REPOSITORY_PORT } from '../../domain/ports/role-repository.port.js';
import { WORKSPACE_SESSION_REPOSITORY_PORT } from '../../domain/ports/workspace-session-repository.port.js';
import { DELEGATION_REPOSITORY_PORT } from '../../domain/ports/delegation-repository.port.js';
import { EMERGENCY_ACCESS_REPOSITORY_PORT } from '../../domain/ports/emergency-access-repository.port.js';
import { CONFIGURATION_REPOSITORY_PORT } from '../../domain/ports/configuration-repository.port.js';
import { CONFIGURATION_REPOSITORY_PORT as P78_CONFIGURATION_REPOSITORY_PORT } from '../../domain/configuration-entitlement/configuration-repository.port.js';
import { EXPERIENCE_REPOSITORY_PORT } from '../../domain/product-experience/experience-repository.port.js';
import { ACTIVATION_REPOSITORY_PORT } from '../../domain/readiness-activation/activation-repository.port.js';
import { LIFECYCLE_REPOSITORY_PORT } from '../../domain/tenant-lifecycle/lifecycle-repository.port.js';
import { ONBOARDING_REPOSITORY_PORT } from '../../domain/onboarding/onboarding-repository.port.js';
import { RECONCILIATION_REPOSITORY_PORT } from '../../domain/reconciliation/reconciliation-repository.port.js';
import { CERTIFICATION_REPOSITORY_PORT } from '../../domain/production-certification/certification-repository.port.js';
import { CONNECTIVITY_AGENT_REPOSITORY_PORT } from '../../domain/connectivity-agent/connectivity-agent-repository.port.js';
import { AUDIT_EVENT_REPOSITORY_PORT } from '../../domain/ports/audit-event-repository.port.js';
import { PRODUCT_REPOSITORY_PORT } from '../../domain/ports/product-repository.port.js';
import { PRODUCT_VERSION_REPOSITORY_PORT } from '../../domain/ports/product-version-repository.port.js';
import { SEGMENT_REPOSITORY_PORT } from '../../domain/ports/segment-repository.port.js';
import { PROFILE_REPOSITORY_PORT } from '../../domain/ports/profile-repository.port.js';
import { OPERATING_MODEL_REPOSITORY_PORT } from '../../domain/ports/operating-model-repository.port.js';
import { COMPATIBILITY_REPOSITORY_PORT } from '../../domain/ports/compatibility-repository.port.js';
import { CAPABILITY_REPOSITORY_PORT } from '../../domain/ports/capability-repository.port.js';
import { BACKEND_REPOSITORY_PORT } from '../../domain/ports/backend-repository.port.js';
import { CONTRACT_REPOSITORY_PORT } from '../../domain/ports/contract-repository.port.js';
import { READINESS_REPOSITORY_PORT } from '../../domain/ports/readiness-repository.port.js';
import { PUBLICATION_REPOSITORY_PORT } from '../../domain/ports/publication-repository.port.js';
import { VERTICAL_LIFECYCLE_REPOSITORY_PORT } from '../../domain/ports/vertical-lifecycle-repository.port.js';
import { COMMERCIAL_REPOSITORY_PORT } from '../../domain/ports/commercial-repository.port.js';
import { MARKETING_REPOSITORY_PORT } from '../../domain/ports/marketing-repository.port.js';
import { SALES_REPOSITORY_PORT } from '../../domain/ports/sales-repository.port.js';
import { SALES_COMMERCE_REPOSITORY_PORT } from '../../domain/ports/sales-commerce-repository.port.js';
import { SALES_PLATFORM_REPOSITORY_PORT } from '../../domain/ports/sales-platform-repository.port.js';
import { SUBSCRIPTION_REPOSITORY_PORT } from '../../domain/ports/subscription-repository.port.js';
import { BILLING_REPOSITORY_PORT } from '../../domain/ports/billing-repository.port.js';
import { PROVISIONING_REPOSITORY_PORT } from '../../domain/provisioning/provisioning-repository.port.js';
import { REGISTRY_REPOSITORY_PORT } from '../../domain/registry/registry-repository.port.js';
import { PLACEMENT_REPOSITORY_PORT } from '../../domain/placement/placement-repository.port.js';
import { PLACEMENT_AUTHORIZATION_VIEW_PORT } from '../../domain/placement/placement-authorization-view.port.js';
import { WORKFLOW_REPOSITORY_PORT } from '../../domain/workflow/workflow-repository.port.js';
import { WORKFLOW_AUTHORIZATION_PORT } from '../../domain/workflow/workflow-authorization.port.js';
import { WORKFLOW_PLACEMENT_PORT } from '../../domain/workflow/workflow-placement.port.js';
import { PRODUCT_CONTROL_REPOSITORY_PORT } from '../../domain/product-control/product-control-repository.port.js';
import { INFRASTRUCTURE_REPOSITORY_PORT } from '../../domain/infrastructure-provisioning/infrastructure-repository.port.js';
import { KEYCLOAK_REPOSITORY_PORT } from '../../domain/keycloak-topology/keycloak-repository.port.js';
import { PgAdministratorRepository } from './pg-administrator.repository.js';
import { PgKeycloakRepository } from '../keycloak/pg-keycloak.repository.js';
import { PgConfigurationEntitlementRepository } from '../configuration-entitlement/pg-configuration.repository.js';
import { PgExperienceRepository } from '../product-experience/pg-experience.repository.js';
import { PgActivationRepository } from '../readiness-activation/pg-activation.repository.js';
import { PgLifecycleRepository } from '../tenant-lifecycle/pg-lifecycle.repository.js';
import { PgOnboardingRepository } from '../onboarding/pg-onboarding.repository.js';
import { PgReconciliationRepository } from '../reconciliation/pg-reconciliation.repository.js';
import { PgConnectivityAgentRepository } from '../connectivity-agent/pg-connectivity-agent.repository.js';
import { PgCertificationRepository } from '../production-certification/pg-certification.repository.js';
import { TENANT_MANAGEMENT_REPOSITORY_PORT } from '../../domain/tenant-management/tenant-management-repository.port.js';
import { PgTenantManagementRepository } from '../tenant-management/pg-tenant-management.repository.js';
import { SERVICE_CATALOG_REPOSITORY_PORT } from '../../domain/platform-operations/service-catalog-repository.port.js';
import { SERVICE_OPERATIONS_REPOSITORY_PORT } from '../../domain/platform-operations/operations-repository.port.js';
import { ACQUISITION_REPOSITORY_PORT } from '../../domain/acquisition/acquisition-repository.port.js';
import { ACQUISITION_DOCUMENT_STORAGE_PORT } from '../../domain/acquisition/document-storage.port.js';
import { PgServiceCatalogRepository } from '../platform-operations/pg-service-catalog.repository.js';
import { PgOperationsRepository } from '../platform-operations/pg-operations.repository.js';
import { PgAcquisitionRepository } from '../acquisition/pg-acquisition.repository.js';
import { createAcquisitionDocumentStorage } from '../acquisition/create-acquisition-document-storage.js';
import { PgInfrastructureRepository } from '../infrastructure-provisioning/pg-infrastructure.repository.js';
import { PgProvisioningRepository } from '../provisioning/pg-provisioning.repository.js';
import { PgRegistryRepository } from '../registry/pg-registry.repository.js';
import { PgPlacementRepository } from '../placement/pg-placement.repository.js';
import { PgPlacementAuthorizationViewAdapter } from '../placement/pg-placement-authorization-view.adapter.js';
import { PgWorkflowRepository } from '../workflow/pg-workflow.repository.js';
import { PgWorkflowAuthorizationAdapter } from '../workflow/pg-workflow-authorization.adapter.js';
import { PgWorkflowPlacementAdapter } from '../workflow/pg-workflow-placement.adapter.js';
import { PgProductControlRepository } from '../product-control/pg-product-control.repository.js';
import { PgVerticalRepository } from './pg-vertical.repository.js';
import { PgMembershipRepository } from './pg-membership.repository.js';
import { PgInvitationRepository } from './pg-invitation.repository.js';
import { PgRoleRepository } from './pg-role.repository.js';
import { PgWorkspaceSessionRepository } from './pg-workspace-session.repository.js';
import { PgDelegationRepository } from './pg-delegation.repository.js';
import { PgEmergencyAccessRepository } from './pg-emergency-access.repository.js';
import { PgConfigurationRepository } from './pg-configuration.repository.js';
import { PgAuditEventRepository } from './pg-audit-event.repository.js';
import { PgProductRepository } from './pg-product.repository.js';
import { PgProductVersionRepository } from './pg-product-version.repository.js';
import { PgSegmentRepository } from './pg-segment.repository.js';
import { PgProfileRepository } from './pg-profile.repository.js';
import { PgOperatingModelRepository } from './pg-operating-model.repository.js';
import { PgCompatibilityRepository } from './pg-compatibility.repository.js';
import { PgCapabilityRepository } from './pg-capability.repository.js';
import { PgBackendRepository } from './pg-backend.repository.js';
import { PgContractRepository } from './pg-contract.repository.js';
import { PgReadinessRepository } from './pg-readiness.repository.js';
import { PgPublicationRepository } from './pg-publication.repository.js';
import { PgVerticalLifecycleRepository } from './pg-vertical-lifecycle.repository.js';
import { PgCommercialRepository } from './pg-commercial.repository.js';
import { PgMarketingRepository } from './pg-marketing.repository.js';
import { PgSalesRepository } from './pg-sales.repository.js';
import { PgSalesCommerceRepository } from './pg-sales-commerce.repository.js';
import { PgSalesPlatformRepository } from './pg-sales-platform.repository.js';
import { PgSubscriptionRepository } from './pg-subscription.repository.js';
import { PgBillingRepository } from './pg-billing.repository.js';

const providers = [
  { provide: ADMINISTRATOR_REPOSITORY_PORT, useClass: PgAdministratorRepository },
  { provide: VERTICAL_REPOSITORY_PORT, useClass: PgVerticalRepository },
  { provide: MEMBERSHIP_REPOSITORY_PORT, useClass: PgMembershipRepository },
  { provide: INVITATION_REPOSITORY_PORT, useClass: PgInvitationRepository },
  { provide: ROLE_REPOSITORY_PORT, useClass: PgRoleRepository },
  { provide: WORKSPACE_SESSION_REPOSITORY_PORT, useClass: PgWorkspaceSessionRepository },
  { provide: DELEGATION_REPOSITORY_PORT, useClass: PgDelegationRepository },
  { provide: EMERGENCY_ACCESS_REPOSITORY_PORT, useClass: PgEmergencyAccessRepository },
  { provide: CONFIGURATION_REPOSITORY_PORT, useClass: PgConfigurationRepository },
  { provide: AUDIT_EVENT_REPOSITORY_PORT, useClass: PgAuditEventRepository },
  { provide: PRODUCT_REPOSITORY_PORT, useClass: PgProductRepository },
  { provide: PRODUCT_VERSION_REPOSITORY_PORT, useClass: PgProductVersionRepository },
  { provide: SEGMENT_REPOSITORY_PORT, useClass: PgSegmentRepository },
  { provide: PROFILE_REPOSITORY_PORT, useClass: PgProfileRepository },
  { provide: OPERATING_MODEL_REPOSITORY_PORT, useClass: PgOperatingModelRepository },
  { provide: COMPATIBILITY_REPOSITORY_PORT, useClass: PgCompatibilityRepository },
  { provide: CAPABILITY_REPOSITORY_PORT, useClass: PgCapabilityRepository },
  { provide: BACKEND_REPOSITORY_PORT, useClass: PgBackendRepository },
  { provide: CONTRACT_REPOSITORY_PORT, useClass: PgContractRepository },
  { provide: READINESS_REPOSITORY_PORT, useClass: PgReadinessRepository },
  { provide: PUBLICATION_REPOSITORY_PORT, useClass: PgPublicationRepository },
  { provide: VERTICAL_LIFECYCLE_REPOSITORY_PORT, useClass: PgVerticalLifecycleRepository },
  { provide: COMMERCIAL_REPOSITORY_PORT, useClass: PgCommercialRepository },
  { provide: MARKETING_REPOSITORY_PORT, useClass: PgMarketingRepository },
  { provide: SALES_REPOSITORY_PORT, useClass: PgSalesRepository },
  { provide: SALES_COMMERCE_REPOSITORY_PORT, useClass: PgSalesCommerceRepository },
  { provide: SALES_PLATFORM_REPOSITORY_PORT, useClass: PgSalesPlatformRepository },
  { provide: SUBSCRIPTION_REPOSITORY_PORT, useClass: PgSubscriptionRepository },
  { provide: BILLING_REPOSITORY_PORT, useClass: PgBillingRepository },
  { provide: PROVISIONING_REPOSITORY_PORT, useClass: PgProvisioningRepository },
  { provide: REGISTRY_REPOSITORY_PORT, useClass: PgRegistryRepository },
  { provide: PLACEMENT_REPOSITORY_PORT, useClass: PgPlacementRepository },
  {
    provide: PLACEMENT_AUTHORIZATION_VIEW_PORT,
    useClass: PgPlacementAuthorizationViewAdapter,
  },
  { provide: WORKFLOW_REPOSITORY_PORT, useClass: PgWorkflowRepository },
  { provide: WORKFLOW_AUTHORIZATION_PORT, useClass: PgWorkflowAuthorizationAdapter },
  { provide: WORKFLOW_PLACEMENT_PORT, useClass: PgWorkflowPlacementAdapter },
  { provide: PRODUCT_CONTROL_REPOSITORY_PORT, useClass: PgProductControlRepository },
  { provide: INFRASTRUCTURE_REPOSITORY_PORT, useClass: PgInfrastructureRepository },
  // P7.7 — Keycloak topology registry (durable topology/resource registry).
  { provide: KEYCLOAK_REPOSITORY_PORT, useClass: PgKeycloakRepository },
  // P7.8 — Configuration & entitlement deployment registry (migration 103).
  { provide: P78_CONFIGURATION_REPOSITORY_PORT, useClass: PgConfigurationEntitlementRepository },
  // P7.9 — Product experience provisioning registry (migration 104).
  { provide: EXPERIENCE_REPOSITORY_PORT, useClass: PgExperienceRepository },
  // P7.10 — Technical readiness & activation gate (migration 105).
  { provide: ACTIVATION_REPOSITORY_PORT, useClass: PgActivationRepository },
  // P7.11 — Tenant technical lifecycle (migration 106).
  { provide: LIFECYCLE_REPOSITORY_PORT, useClass: PgLifecycleRepository },
  // P7.12 — Onboarding operations (migration 107).
  { provide: ONBOARDING_REPOSITORY_PORT, useClass: PgOnboardingRepository },
  // P7.13 — Reconciliation & operational governance (migration 109; 108=P8).
  { provide: RECONCILIATION_REPOSITORY_PORT, useClass: PgReconciliationRepository },
  // P7.14 — Connectivity agent & registry (migration 110).
  { provide: CONNECTIVITY_AGENT_REPOSITORY_PORT, useClass: PgConnectivityAgentRepository },
  // P7.15 — Production certification & evidence pack (migration 111).
  { provide: CERTIFICATION_REPOSITORY_PORT, useClass: PgCertificationRepository },
  // P8 — Advanced tenant management & governance (migration 108).
  { provide: TENANT_MANAGEMENT_REPOSITORY_PORT, useClass: PgTenantManagementRepository },
  // P9.1 — Platform operations service catalog (migration 115).
  { provide: SERVICE_CATALOG_REPOSITORY_PORT, useClass: PgServiceCatalogRepository },
  // P9.2–P9.11 — Operations core (migration 116).
  { provide: SERVICE_OPERATIONS_REPOSITORY_PORT, useClass: PgOperationsRepository },
  // P10 — SaaS Customer Experience & Subscription Acquisition (migration 117).
  { provide: ACQUISITION_REPOSITORY_PORT, useClass: PgAcquisitionRepository },
  {
    provide: ACQUISITION_DOCUMENT_STORAGE_PORT,
    useFactory: () => createAcquisitionDocumentStorage(),
  },
];

@Module({
  imports: [DatabaseModule],
  providers,
  exports: providers.map((p) => p.provide),
})
export class EdgePersistenceModule {}
