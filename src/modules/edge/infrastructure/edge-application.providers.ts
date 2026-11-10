import type { Provider } from '@nestjs/common';
import { APP_CONFIG } from '../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../shared/configuration/environment.schema.js';
import { ADMINISTRATOR_REPOSITORY_PORT } from '../domain/ports/administrator-repository.port.js';
import { VERTICAL_REPOSITORY_PORT } from '../domain/ports/vertical-repository.port.js';
import { MEMBERSHIP_REPOSITORY_PORT } from '../domain/ports/membership-repository.port.js';
import { INVITATION_REPOSITORY_PORT } from '../domain/ports/invitation-repository.port.js';
import { ROLE_REPOSITORY_PORT } from '../domain/ports/role-repository.port.js';
import { WORKSPACE_SESSION_REPOSITORY_PORT } from '../domain/ports/workspace-session-repository.port.js';
import { DELEGATION_REPOSITORY_PORT } from '../domain/ports/delegation-repository.port.js';
import { EMERGENCY_ACCESS_REPOSITORY_PORT } from '../domain/ports/emergency-access-repository.port.js';
import { CONFIGURATION_REPOSITORY_PORT } from '../domain/ports/configuration-repository.port.js';
import { AUDIT_EVENT_REPOSITORY_PORT } from '../domain/ports/audit-event-repository.port.js';
import {
  AcceptInvitationUseCase,
  DeactivateAdministratorUseCase,
  GetAdministratorByIdUseCase,
  GetAdministratorMeUseCase,
  InviteAdministratorUseCase,
  ListAdministratorsUseCase,
  ReinstateAdministratorUseCase,
  SuspendAdministratorUseCase,
  UpdateAdministratorProfileUseCase,
} from '../application/administrator/administrator.use-cases.js';
import {
  ActivateVerticalUseCase,
  ArchiveVerticalUseCase,
  CheckVerticalReadinessUseCase,
  CreateVerticalUseCase,
  DeactivateVerticalUseCase,
  DeprecateVerticalUseCase,
  GetVerticalHistoryUseCase,
  GetVerticalLifecycleEventsUseCase,
  GetVerticalUseCase,
  ListVerticalsUseCase,
  ReinstateVerticalUseCase,
  RetireVerticalUseCase,
  SuspendVerticalUseCase,
  UpdateVerticalUseCase,
} from '../application/vertical/vertical.use-cases.js';
import {
  CreateProductUseCase,
  GetProductUseCase,
  ListProductsUseCase,
  TransitionProductLifecycleUseCase,
  UpdateProductUseCase,
} from '../application/product/product.use-cases.js';
import {
  CreateProductVersionUseCase,
  GetProductVersionUseCase,
  ListProductVersionsUseCase,
  PublishProductVersionUseCase,
  UpdateProductVersionDraftUseCase,
} from '../application/product/product-version.use-cases.js';
import {
  ListCompatibilitiesByProductUseCase,
  UpsertCompatibilityUseCase,
} from '../application/product/compatibility.use-cases.js';
import {
  CreateOperatingModelUseCase,
  CreateProfileUseCase,
  CreateSegmentUseCase,
  GetOperatingModelUseCase,
  GetProfileUseCase,
  GetSegmentUseCase,
  ListOperatingModelsUseCase,
  ListProfilesUseCase,
  ListSegmentsByVerticalUseCase,
  UpdateSegmentUseCase,
} from '../application/market/market.use-cases.js';
import {
  AddCapabilityDependencyUseCase,
  CreateCapabilityUseCase,
  GetCapabilityUseCase,
  ListCapabilitiesUseCase,
  ListProductCapabilityMappingsUseCase,
  UpsertProductCapabilityMappingUseCase,
} from '../application/capability/capability.use-cases.js';
import {
  CreateBackendUseCase,
  CreateProductBackendBindingUseCase,
  GetBackendUseCase,
  ListBackendsUseCase,
  ListProductBackendBindingsUseCase,
} from '../application/backend/backend.use-cases.js';
import {
  CreateContractUseCase,
  GetContractUseCase,
  ListContractsUseCase,
} from '../application/contract/contract.use-cases.js';
import {
  EvaluateProductReadinessUseCase,
  ListReadinessEvaluationsUseCase,
} from '../application/readiness/readiness.use-cases.js';
import { PublishProductUseCase } from '../application/publication/publication.use-cases.js';
import {
  ApproveMarketingCampaignUseCase,
  CreateMarketingAudienceUseCase,
  CreateMarketingBudgetUseCase,
  CreateMarketingCampaignUseCase,
  CreateMarketingFormUseCase,
  CreateMarketingStrategyUseCase,
  GetMarketingCampaignUseCase,
  GetMarketingLeadUseCase,
  ListMarketingAudiencesUseCase,
  ListMarketingBudgetsUseCase,
  ListMarketingCampaignsUseCase,
  ListMarketingFormsUseCase,
  ListMarketingLeadsUseCase,
  ListMarketingStrategiesUseCase,
  PublishMarketingCampaignUseCase,
  PublishMarketingFormUseCase,
  ScoreMarketingLeadUseCase,
  SubmitMarketingFormPublicUseCase,
  TransitionMarketingCampaignUseCase,
} from '../application/marketing/marketing.use-cases.js';
import {
  ActivateMarketingJourneyUseCase,
  ApproveMarketingContentUseCase,
  CalculateMarketingAttributionUseCase,
  CreateMarketingContentUseCase,
  CreateMarketingJourneyUseCase,
  CreateMarketingLandingPageUseCase,
  CreateMarketingMessageTemplateUseCase,
  CreateMarketingPerformanceSnapshotUseCase,
  CreateMarketingSuppressionUseCase,
  IngestMarketingDeliveryReceiptUseCase,
  ListMarketingAttributionModelsUseCase,
  ListMarketingChannelsUseCase,
  ListMarketingContentsUseCase,
  ListMarketingJourneysUseCase,
  ListMarketingLandingPagesUseCase,
  ListMarketingMessageTemplatesUseCase,
  ListMarketingPerformanceSnapshotsUseCase,
  PublishMarketingContentUseCase,
  PublishMarketingLandingPageUseCase,
  RequestMarketingDeliveryUseCase,
  ResumeWaitingMarketingJourneysUseCase,
  StartMarketingJourneyExecutionUseCase,
  AssignMarketingLeadUseCase,
  MergeMarketingLeadsUseCase,
  SummarizeMarketingAnalyticsUseCase,
  UpdateMarketingContentStudioUseCase,
  UpdateMarketingLandingStudioUseCase,
  UpsertMarketingChannelUseCase,
} from '../application/marketing/marketing-orchestration.use-cases.js';
import { MARKETING_REPOSITORY_PORT } from '../domain/ports/marketing-repository.port.js';
import { SALES_REPOSITORY_PORT } from '../domain/ports/sales-repository.port.js';
import { SALES_COMMERCE_REPOSITORY_PORT } from '../domain/ports/sales-commerce-repository.port.js';
import { SUBSCRIPTION_REPOSITORY_PORT } from '../domain/ports/subscription-repository.port.js';
import { SUBSCRIPTION_BILLING_COORDINATION_PORT } from '../domain/subscription/billing-coordination.port.js';
import { SUBSCRIPTION_PROVISIONING_COORDINATION_PORT } from '../domain/subscription/provisioning-coordination.port.js';
import { UnavailableSubscriptionBillingAdapter } from './subscription/unavailable-billing.adapter.js';
import { UnavailableSubscriptionProvisioningAdapter } from './subscription/unavailable-provisioning.adapter.js';
import {
  ActivateSubscriptionUseCase,
  AddSubscriptionItemUseCase,
  ApproveSubscriptionUseCase,
  CalculateAndSnapshotEntitlementsUseCase,
  CancelSubscriptionUseCase,
  ConfirmBillingCoordinationUseCase,
  CompleteProvisioningUseCase,
  ConvertTrialUseCase,
  CreateChangeRequestUseCase,
  CreateSubscriptionFromHandoffUseCase,
  CreateSubscriptionUseCase,
  ExecuteChangeRequestUseCase,
  ExpireTrialUseCase,
  GetSubscriptionAnalyticsUseCase,
  GetSubscriptionHistoryUseCase,
  GetSubscriptionOverviewUseCase,
  GetSubscriptionUseCase,
  GetSubscriptionWorkspaceUseCase,
  ListChangeRequestsUseCase,
  ListEntitlementSnapshotsUseCase,
  ListRenewalsUseCase,
  ListSubscriptionItemsUseCase,
  ListSubscriptionsUseCase,
  ListTrialsUseCase,
  PublishEntitlementsUseCase,
  ReactivateSubscriptionUseCase,
  RenewSubscriptionUseCase,
  RequestActivationUseCase,
  RequestBillingCoordinationUseCase,
  RequestProvisioningUseCase,
  StartTrialUseCase,
  SubmitSubscriptionUseCase,
  SuspendSubscriptionUseCase,
  TerminateSubscriptionUseCase,
  ResolveSubscriptionIdempotencyUseCase,
} from '../application/subscription/subscription.use-cases.js';
import {
  ApproveChangeRequestUseCase,
  GetCoordinationUseCase,
  ListPendingApprovalsUseCase,
  ListPoliciesUseCase,
  ListSubscriptionCancellationsUseCase,
  ListSubscriptionPublicationsUseCase,
  ListSubscriptionSuspensionsUseCase,
  ProcessDueScheduledChangesUseCase,
  ProposeRenewalUseCase,
  ReconcileEntitlementsUseCase,
  RejectChangeRequestUseCase,
  ScheduleChangeUseCase,
  UpdateSubscriptionUseCase,
  UpsertPolicyUseCase,
} from '../application/subscription/subscription-governance.use-cases.js';
import { SALES_SIGNATURE_ADAPTER_PORT } from '../domain/sales/signature-adapter.port.js';
import { UnavailableSalesSignatureAdapter } from './sales/unavailable-signature.adapter.js';
import { DocuSignSalesSignatureAdapter } from './sales/docusign-signature.adapter.js';
import { HelloSignSalesSignatureAdapter } from './sales/hellosign-signature.adapter.js';
import { ResolvingSalesSignatureAdapter } from './sales/resolving-signature.adapter.js';
import { SALES_PLATFORM_REPOSITORY_PORT } from '../domain/ports/sales-platform-repository.port.js';
import { SALES_PROPOSAL_DOCUMENT_ADAPTER_PORT } from '../domain/sales/proposal-document.adapter.port.js';
import { MinimalPdfProposalAdapter } from './sales/minimal-pdf-proposal.adapter.js';
import { SALES_CALENDAR_ADAPTER_PORT } from '../domain/sales/calendar-adapter.port.js';
import { UnavailableSalesCalendarAdapter } from './sales/unavailable-calendar.adapter.js';
import { GoogleSalesCalendarAdapter } from './sales/google-calendar.adapter.js';
import { OutlookSalesCalendarAdapter } from './sales/outlook-calendar.adapter.js';
import { ResolvingSalesCalendarAdapter } from './sales/resolving-calendar.adapter.js';
import { BILLING_REPOSITORY_PORT } from '../domain/ports/billing-repository.port.js';
import { PAYMENT_PROVIDER_PORT } from '../domain/billing/payment-provider.port.js';
import { UnavailablePaymentProviderAdapter } from './billing/unavailable-payment.adapter.js';
import { HttpWebhookPaymentProviderAdapter } from './billing/http-webhook-payment.adapter.js';
import { ResolvingPaymentProviderAdapter } from './billing/resolving-payment.adapter.js';
import {
  AppendJournalEntryUseCase,
  ApproveInvoiceUseCase,
  ApproveRefundUseCase,
  AllocatePaymentUseCase,
  CreateBillingAccountUseCase,
  CreateBillingScheduleUseCase,
  CreateDraftInvoiceFromSubscriptionUseCase,
  CreatePaymentIntentUseCase,
  CreateRefundUseCase,
  ConfirmPaymentIntentUseCase,
  GetBillingAccountUseCase,
  GetBillingAnalyticsUseCase,
  GetBillingOverviewUseCase,
  GetInvoiceUseCase,
  IngestSubscriptionBillingCoordinationUseCase,
  IssueInvoiceUseCase,
  LinkSubscriptionToBillingAccountUseCase,
  ListBillingAccountsUseCase,
  ListInvoicesUseCase,
  MarkInvoicePaidIfSettledUseCase,
  OpenCollectionCaseUseCase,
  PreviewInvoiceUseCase,
  ProcessPaymentWebhookUseCase,
  RecordDunningAttemptUseCase,
  UpsertBillingProfileUseCase,
  VoidInvoiceUseCase,
} from '../application/billing/billing.use-cases.js';
import {
  ApplyTaxToInvoiceUseCase,
  ConvertAmountUseCase,
  CreateCreditNoteUseCase,
  CreateDisputeUseCase,
  CreateFxRateUseCase,
  CreateSettlementBatchUseCase,
  EscalateCollectionCaseUseCase,
  GetBillingProfileUseCase,
  GetCollectionCaseUseCase,
  IngestProviderTransactionUseCase,
  ListBillingPartiesUseCase,
  ListBillingPoliciesUseCase,
  ListBillingProfilesUseCase,
  ListBillingSchedulesUseCase,
  ListCollectionCasesUseCase,
  ListCreditNotesUseCase,
  ListDisputesUseCase,
  ListFxRatesUseCase,
  ListJournalEntriesUseCase,
  ListPaymentIntentsUseCase,
  ListPaymentMethodsUseCase,
  ListReconciliationExceptionsUseCase,
  ListReconciliationRunsUseCase,
  ListRefundsUseCase,
  ListSettlementBatchesUseCase,
  ListTaxJurisdictionsUseCase,
  RegisterPaymentMethodUseCase,
  ResolveCollectionCaseUseCase,
  ResolveDisputeUseCase,
  ResolveReconciliationExceptionUseCase,
  RevokePaymentMethodUseCase,
  RunReconciliationUseCase,
  UpsertBillingPartyUseCase,
  UpsertBillingPolicyUseCase,
} from '../application/billing/billing-ops.use-cases.js';
import {
  GenerateFinancialExportUseCase,
  GetCustomerBillingPortalUseCase,
  GetFinancialExportUseCase,
  ListFinancialExportsUseCase,
  ListRevenuePoliciesUseCase,
  MarkOverdueInvoicesUseCase,
  ProcessDueBillingSchedulesUseCase,
  UpsertRevenuePolicyUseCase,
} from '../application/billing/billing-lifecycle.use-cases.js';
import {
  AddAccountRelationshipUseCase,
  AddContactRoleUseCase,
  AssertSalesSubjectAccessUseCase,
  CreateContractAmendmentUseCase,
  CreateSalesSavedViewUseCase,
  DeleteSalesSavedViewUseCase,
  ExecuteContractAmendmentUseCase,
  ExportSalesEntitiesUseCase,
  GenerateProposalDocumentUseCase,
  GetAccountHierarchyUseCase,
  GlobalSalesSearchUseCase,
  GrantSalesVisibilityUseCase,
  ListContactRolesUseCase,
  ListContractAmendmentsUseCase,
  ListDiscoveryQuestionnairesUseCase,
  ListSalesExportJobsUseCase,
  ListSalesForecastSnapshotsUseCase,
  ListSalesOrderLinesUseCase,
  ListSalesSavedViewsUseCase,
  ListSalesVisibilityGrantsUseCase,
  PersistSalesForecastSnapshotUseCase,
  ResolveSalesIdempotencyUseCase,
  SetSalesOrderLinesUseCase,
  SyncSalesActivityCalendarUseCase,
  UpsertDiscoveryQuestionnaireUseCase,
  ValidateSolutionFitUseCase,
} from '../application/sales/sales-platform.use-cases.js';
import {
  AcceptSalesLeadUseCase,
  AddSalesTeamMemberUseCase,
  AssignSalesLeadUseCase,
  CompleteSalesTaskUseCase,
  CreateCommercialAccountUseCase,
  CreateSalesContactUseCase,
  CreateSalesNoteUseCase,
  CreateSalesTaskUseCase,
  CreateSalesTeamUseCase,
  CreateSalesTerritoryUseCase,
  FindDuplicateAccountsUseCase,
  GetCommercialAccountUseCase,
  GetSalesContactUseCase,
  GetSalesLeadUseCase,
  ListAccountTimelineUseCase,
  ListCommercialAccountsUseCase,
  ListSalesContactsUseCase,
  ListSalesLeadsUseCase,
  ListSalesTasksUseCase,
  ListSalesTeamsUseCase,
  ListSalesTerritoriesUseCase,
  MergeCommercialAccountsUseCase,
  QualifySalesLeadUseCase,
  ReceiveSalesLeadUseCase,
  RejectSalesLeadUseCase,
  SalesOverviewUseCase,
  UpdateCommercialAccountUseCase,
} from '../application/sales/sales.use-cases.js';
import {
  AddOpportunityCompetitorUseCase,
  AddOpportunityContactUseCase,
  AddOpportunityRiskUseCase,
  CreateOpportunityUseCase,
  GetOpportunityUseCase,
  GetSalesPipelineBoardUseCase,
  ListOpportunitiesUseCase,
  ListSalesPipelinesUseCase,
  ReopenOpportunityUseCase,
  TransitionOpportunityStageUseCase,
  UpdateOpportunityUseCase,
} from '../application/sales/sales-opportunity.use-cases.js';
import {
  AcceptSalesHandoffUseCase,
  CompleteNeedsAssessmentUseCase,
  CompleteSalesActivityUseCase,
  CreateNeedsAssessmentUseCase,
  CreateOpportunityOfferConfigurationUseCase,
  CreateSalesActivityUseCase,
  CreateSalesContractUseCase,
  CreateSalesOrderUseCase,
  CreateSalesProposalUseCase,
  CreateSalesQuoteUseCase,
  DecideSalesApprovalUseCase,
  DecideSalesDiscountUseCase,
  GetSalesForecastUseCase,
  GetSalesPerformanceUseCase,
  GetSalesQuoteUseCase,
  IssueSalesProposalUseCase,
  ListNeedsAssessmentsUseCase,
  ListOfferConfigurationsUseCase,
  ListSalesActivitiesUseCase,
  ListSalesApprovalsUseCase,
  ListSalesContractsUseCase,
  ListSalesDiscountRequestsUseCase,
  ListSalesHandoffsUseCase,
  ListSalesOrdersUseCase,
  ListSalesProposalsUseCase,
  ListSalesQuotesUseCase,
  ReceiveProvisioningStatusUseCase,
  RequestSalesDiscountUseCase,
  RequestSalesHandoffUseCase,
  ReviseSalesQuoteUseCase,
  TransitionSalesContractUseCase,
  TransitionSalesOrderUseCase,
  TransitionSalesQuoteUseCase,
} from '../application/sales/sales-commerce.use-cases.js';
import { MARKETING_CHANNEL_ADAPTER_PORT } from '../domain/marketing/channel-adapter.port.js';
import { UnavailableMarketingChannelAdapter } from './marketing/unavailable-channel.adapter.js';
import { LoggingAcceptedMarketingChannelAdapter } from './marketing/logging-accepted-channel.adapter.js';
import { HttpWebhookMarketingChannelAdapter } from './marketing/http-webhook-channel.adapter.js';
import { ResendMarketingChannelAdapter } from './marketing/resend-channel.adapter.js';
import { MetaWhatsAppMarketingChannelAdapter } from './marketing/meta-whatsapp-channel.adapter.js';
import { ResolvingMarketingChannelAdapter } from './marketing/resolving-channel.adapter.js';
import { MarketingJourneyWaitWorker } from './marketing/marketing-journey-wait.worker.js';
import { ProcessResendMarketingWebhookUseCase } from '../application/marketing/resend-webhook.use-case.js';
import {
  ProcessMetaWhatsAppMarketingWebhookUseCase,
  VerifyMetaWhatsAppWebhookSubscriptionUseCase,
} from '../application/marketing/whatsapp-webhook.use-case.js';
import {
  AddAddonCapabilityUseCase,
  AddPackageCapabilityUseCase,
  AddPlanCapabilityUseCase,
  AddPriceBookEntryUseCase,
  CreateCommercialAddonUseCase,
  CreateCommercialMarketUseCase,
  CreateCommercialPlanUseCase,
  CreateIcpUseCase,
  CreatePriceBookUseCase,
  CreatePricingUnitUseCase,
  CreateSolutionPackageUseCase,
  EvaluateCommercialPlanReadinessUseCase,
  LinkAddonToPlanUseCase,
  ListAddonsUseCase,
  ListCommercialMarketsUseCase,
  ListCommercialPlansUseCase,
  ListIcpsUseCase,
  ListPackagesUseCase,
  ListPriceBooksUseCase,
  ListPricingUnitsUseCase,
  ConfigureCommercialOfferUseCase,
  CreateDiscountPolicyUseCase,
  CreatePersonaUseCase,
  CreateValuePropositionUseCase,
  ListDiscountPoliciesUseCase,
  ListPersonasUseCase,
  ListValuePropositionsUseCase,
  EvaluateCommercialOfferReadinessUseCase,
  GetCommercialCatalogViewUseCase,
  GetCommercialPlanUseCase,
  GetSolutionPackageUseCase,
  ListPriceBookEntriesUseCase,
  ListPublicationSnapshotsUseCase,
  PreviewCommercialPriceUseCase,
  PublishCommercialAddonUseCase,
  PublishCommercialPlanUseCase,
  PublishEnterpriseTemplateUseCase,
  PublishPriceBookUseCase,
  PublishSolutionPackageUseCase,
} from '../application/commercial/commercial.use-cases.js';
import {
  AddMarketAssessmentUseCase,
  AddResearchSourceUseCase,
  CompleteResearchProjectUseCase,
  CreateBuyingCommitteeUseCase,
  CreateDecisionJourneyUseCase,
  CreateEligibilityPolicyUseCase,
  CreateEnterpriseTemplateUseCase,
  CreatePricingModelUseCase,
  CreateResearchProjectUseCase,
  CreateUsageMetricUseCase,
  ListBuyingCommitteesUseCase,
  ListDecisionJourneysUseCase,
  ListEligibilityPoliciesUseCase,
  ListEnterpriseTemplatesUseCase,
  ListMarketAssessmentsUseCase,
  ListPricingModelsUseCase,
  ListResearchProjectsUseCase,
  ListSegmentIntelligenceUseCase,
  ListUsageMetricsUseCase,
  ScoreSegmentPriorityUseCase,
  UpsertSegmentIntelligenceUseCase,
} from '../application/commercial/commercial-governance.use-cases.js';
import { PRODUCT_REPOSITORY_PORT } from '../domain/ports/product-repository.port.js';
import { COMMERCIAL_REPOSITORY_PORT } from '../domain/ports/commercial-repository.port.js';
import { ControlPlaneOutboxTransactionService } from '../../../shared/messaging/control-plane-outbox-transaction.service.js';
import { PRODUCT_VERSION_REPOSITORY_PORT } from '../domain/ports/product-version-repository.port.js';
import { SEGMENT_REPOSITORY_PORT } from '../domain/ports/segment-repository.port.js';
import { PROFILE_REPOSITORY_PORT } from '../domain/ports/profile-repository.port.js';
import { OPERATING_MODEL_REPOSITORY_PORT } from '../domain/ports/operating-model-repository.port.js';
import { COMPATIBILITY_REPOSITORY_PORT } from '../domain/ports/compatibility-repository.port.js';
import { CAPABILITY_REPOSITORY_PORT } from '../domain/ports/capability-repository.port.js';
import { BACKEND_REPOSITORY_PORT } from '../domain/ports/backend-repository.port.js';
import { CONTRACT_REPOSITORY_PORT } from '../domain/ports/contract-repository.port.js';
import { READINESS_REPOSITORY_PORT } from '../domain/ports/readiness-repository.port.js';
import { PUBLICATION_REPOSITORY_PORT } from '../domain/ports/publication-repository.port.js';
import { VERTICAL_LIFECYCLE_REPOSITORY_PORT } from '../domain/ports/vertical-lifecycle-repository.port.js';
import {
  ActivateMembershipUseCase,
  InviteMembershipUseCase,
  ListMembershipsByAdministratorUseCase,
  ListMembershipsByVerticalUseCase,
  ReinstateMembershipUseCase,
  RevokeMembershipUseCase,
  SuspendMembershipUseCase,
} from '../application/membership/membership.use-cases.js';
import {
  AssignEdgeRoleUseCase,
  CreateCustomEdgeRoleUseCase,
  ListEdgePermissionsUseCase,
  ListEdgeRolesUseCase,
  ResolveEffectivePermissionsUseCase,
  RevokeEdgeRoleAssignmentUseCase,
  UpdateCustomEdgeRoleUseCase,
} from '../application/authorization/authorization.use-cases.js';
import {
  BootstrapWorkspaceUseCase,
  GetActiveWorkspaceUseCase,
  ListAvailableWorkspacesUseCase,
  RenewWorkspaceUseCase,
  RevokeAllWorkspacesUseCase,
  RevokeWorkspaceUseCase,
  SwitchWorkspaceUseCase,
} from '../application/workspace/workspace.use-cases.js';
import {
  ApproveEmergencyAccessUseCase,
  CreateDelegationUseCase,
  GetMfaStateUseCase,
  ListDelegationsUseCase,
  ListSecurityAuditEventsUseCase,
  ListSecuritySessionsUseCase,
  RequestEmergencyAccessUseCase,
  RevokeAllSecuritySessionsUseCase,
  RevokeDelegationUseCase,
  RevokeEmergencyAccessUseCase,
  RevokeSecuritySessionUseCase,
} from '../application/security/security.use-cases.js';
import {
  ActivateConfigurationUseCase,
  GetWorkspaceConfigurationUseCase,
  ListConfigurationHistoryUseCase,
  UpdateConfigurationDraftUseCase,
  ValidateConfigurationUseCase,
} from '../application/configuration/configuration.use-cases.js';

export const edgeApplicationProviders: Provider[] = [
  {
    provide: InviteAdministratorUseCase,
    useFactory: (admins, invitations, audit, config: EnvironmentConfig) =>
      new InviteAdministratorUseCase(admins, invitations, audit, config.EDGE_INVITATION_TTL_HOURS),
    inject: [
      ADMINISTRATOR_REPOSITORY_PORT,
      INVITATION_REPOSITORY_PORT,
      AUDIT_EVENT_REPOSITORY_PORT,
      APP_CONFIG,
    ],
  },
  {
    provide: AcceptInvitationUseCase,
    useFactory: (admins, invitations, memberships, roles, audit) =>
      new AcceptInvitationUseCase(admins, invitations, memberships, roles, audit),
    inject: [
      ADMINISTRATOR_REPOSITORY_PORT,
      INVITATION_REPOSITORY_PORT,
      MEMBERSHIP_REPOSITORY_PORT,
      ROLE_REPOSITORY_PORT,
      AUDIT_EVENT_REPOSITORY_PORT,
    ],
  },
  {
    provide: GetAdministratorMeUseCase,
    useFactory: (admins) => new GetAdministratorMeUseCase(admins),
    inject: [ADMINISTRATOR_REPOSITORY_PORT],
  },
  {
    provide: GetAdministratorByIdUseCase,
    useFactory: (admins) => new GetAdministratorByIdUseCase(admins),
    inject: [ADMINISTRATOR_REPOSITORY_PORT],
  },
  {
    provide: ListAdministratorsUseCase,
    useFactory: (admins) => new ListAdministratorsUseCase(admins),
    inject: [ADMINISTRATOR_REPOSITORY_PORT],
  },
  {
    provide: UpdateAdministratorProfileUseCase,
    useFactory: (admins) => new UpdateAdministratorProfileUseCase(admins),
    inject: [ADMINISTRATOR_REPOSITORY_PORT],
  },
  {
    provide: SuspendAdministratorUseCase,
    useFactory: (admins, sessions, audit) =>
      new SuspendAdministratorUseCase(admins, sessions, audit),
    inject: [
      ADMINISTRATOR_REPOSITORY_PORT,
      WORKSPACE_SESSION_REPOSITORY_PORT,
      AUDIT_EVENT_REPOSITORY_PORT,
    ],
  },
  {
    provide: ReinstateAdministratorUseCase,
    useFactory: (admins, audit) => new ReinstateAdministratorUseCase(admins, audit),
    inject: [ADMINISTRATOR_REPOSITORY_PORT, AUDIT_EVENT_REPOSITORY_PORT],
  },
  {
    provide: DeactivateAdministratorUseCase,
    useFactory: (admins, sessions, audit) =>
      new DeactivateAdministratorUseCase(admins, sessions, audit),
    inject: [
      ADMINISTRATOR_REPOSITORY_PORT,
      WORKSPACE_SESSION_REPOSITORY_PORT,
      AUDIT_EVENT_REPOSITORY_PORT,
    ],
  },
  {
    provide: CreateVerticalUseCase,
    useFactory: (verticals, audit) => new CreateVerticalUseCase(verticals, audit),
    inject: [VERTICAL_REPOSITORY_PORT, AUDIT_EVENT_REPOSITORY_PORT],
  },
  {
    provide: UpdateVerticalUseCase,
    useFactory: (verticals) => new UpdateVerticalUseCase(verticals),
    inject: [VERTICAL_REPOSITORY_PORT],
  },
  {
    provide: GetVerticalUseCase,
    useFactory: (verticals) => new GetVerticalUseCase(verticals),
    inject: [VERTICAL_REPOSITORY_PORT],
  },
  {
    provide: ListVerticalsUseCase,
    useFactory: (verticals) => new ListVerticalsUseCase(verticals),
    inject: [VERTICAL_REPOSITORY_PORT],
  },
  {
    provide: CheckVerticalReadinessUseCase,
    useFactory: (verticals) => new CheckVerticalReadinessUseCase(verticals),
    inject: [VERTICAL_REPOSITORY_PORT],
  },
  {
    provide: ActivateVerticalUseCase,
    useFactory: (verticals, audit, lifecycle) =>
      new ActivateVerticalUseCase(verticals, audit, lifecycle),
    inject: [
      VERTICAL_REPOSITORY_PORT,
      AUDIT_EVENT_REPOSITORY_PORT,
      VERTICAL_LIFECYCLE_REPOSITORY_PORT,
    ],
  },
  {
    provide: SuspendVerticalUseCase,
    useFactory: (verticals, audit, lifecycle) =>
      new SuspendVerticalUseCase(verticals, audit, lifecycle),
    inject: [
      VERTICAL_REPOSITORY_PORT,
      AUDIT_EVENT_REPOSITORY_PORT,
      VERTICAL_LIFECYCLE_REPOSITORY_PORT,
    ],
  },
  {
    provide: ReinstateVerticalUseCase,
    useFactory: (verticals, audit, lifecycle) =>
      new ReinstateVerticalUseCase(verticals, audit, lifecycle),
    inject: [
      VERTICAL_REPOSITORY_PORT,
      AUDIT_EVENT_REPOSITORY_PORT,
      VERTICAL_LIFECYCLE_REPOSITORY_PORT,
    ],
  },
  {
    provide: DeactivateVerticalUseCase,
    useFactory: (verticals, audit, lifecycle) =>
      new DeactivateVerticalUseCase(verticals, audit, lifecycle),
    inject: [
      VERTICAL_REPOSITORY_PORT,
      AUDIT_EVENT_REPOSITORY_PORT,
      VERTICAL_LIFECYCLE_REPOSITORY_PORT,
    ],
  },
  {
    provide: DeprecateVerticalUseCase,
    useFactory: (verticals, lifecycle, audit) =>
      new DeprecateVerticalUseCase(verticals, lifecycle, audit),
    inject: [
      VERTICAL_REPOSITORY_PORT,
      VERTICAL_LIFECYCLE_REPOSITORY_PORT,
      AUDIT_EVENT_REPOSITORY_PORT,
    ],
  },
  {
    provide: RetireVerticalUseCase,
    useFactory: (verticals, lifecycle, audit) =>
      new RetireVerticalUseCase(verticals, lifecycle, audit),
    inject: [
      VERTICAL_REPOSITORY_PORT,
      VERTICAL_LIFECYCLE_REPOSITORY_PORT,
      AUDIT_EVENT_REPOSITORY_PORT,
    ],
  },
  {
    provide: ArchiveVerticalUseCase,
    useFactory: (verticals, lifecycle, audit) =>
      new ArchiveVerticalUseCase(verticals, lifecycle, audit),
    inject: [
      VERTICAL_REPOSITORY_PORT,
      VERTICAL_LIFECYCLE_REPOSITORY_PORT,
      AUDIT_EVENT_REPOSITORY_PORT,
    ],
  },
  {
    provide: GetVerticalHistoryUseCase,
    useFactory: (audit) => new GetVerticalHistoryUseCase(audit),
    inject: [AUDIT_EVENT_REPOSITORY_PORT],
  },
  {
    provide: GetVerticalLifecycleEventsUseCase,
    useFactory: (lifecycle) => new GetVerticalLifecycleEventsUseCase(lifecycle),
    inject: [VERTICAL_LIFECYCLE_REPOSITORY_PORT],
  },
  {
    provide: InviteMembershipUseCase,
    useFactory: (memberships, admins, verticals, audit) =>
      new InviteMembershipUseCase(memberships, admins, verticals, audit),
    inject: [
      MEMBERSHIP_REPOSITORY_PORT,
      ADMINISTRATOR_REPOSITORY_PORT,
      VERTICAL_REPOSITORY_PORT,
      AUDIT_EVENT_REPOSITORY_PORT,
    ],
  },
  {
    provide: ActivateMembershipUseCase,
    useFactory: (memberships, audit) => new ActivateMembershipUseCase(memberships, audit),
    inject: [MEMBERSHIP_REPOSITORY_PORT, AUDIT_EVENT_REPOSITORY_PORT],
  },
  {
    provide: SuspendMembershipUseCase,
    useFactory: (memberships, sessions, audit) =>
      new SuspendMembershipUseCase(memberships, sessions, audit),
    inject: [
      MEMBERSHIP_REPOSITORY_PORT,
      WORKSPACE_SESSION_REPOSITORY_PORT,
      AUDIT_EVENT_REPOSITORY_PORT,
    ],
  },
  {
    provide: ReinstateMembershipUseCase,
    useFactory: (memberships, admins, audit) =>
      new ReinstateMembershipUseCase(memberships, admins, audit),
    inject: [
      MEMBERSHIP_REPOSITORY_PORT,
      ADMINISTRATOR_REPOSITORY_PORT,
      AUDIT_EVENT_REPOSITORY_PORT,
    ],
  },
  {
    provide: RevokeMembershipUseCase,
    useFactory: (memberships, sessions, audit) =>
      new RevokeMembershipUseCase(memberships, sessions, audit),
    inject: [
      MEMBERSHIP_REPOSITORY_PORT,
      WORKSPACE_SESSION_REPOSITORY_PORT,
      AUDIT_EVENT_REPOSITORY_PORT,
    ],
  },
  {
    provide: ListMembershipsByVerticalUseCase,
    useFactory: (memberships) => new ListMembershipsByVerticalUseCase(memberships),
    inject: [MEMBERSHIP_REPOSITORY_PORT],
  },
  {
    provide: ListMembershipsByAdministratorUseCase,
    useFactory: (memberships) => new ListMembershipsByAdministratorUseCase(memberships),
    inject: [MEMBERSHIP_REPOSITORY_PORT],
  },
  {
    provide: ListEdgeRolesUseCase,
    useFactory: (roles) => new ListEdgeRolesUseCase(roles),
    inject: [ROLE_REPOSITORY_PORT],
  },
  {
    provide: CreateCustomEdgeRoleUseCase,
    useFactory: (roles) => new CreateCustomEdgeRoleUseCase(roles),
    inject: [ROLE_REPOSITORY_PORT],
  },
  {
    provide: UpdateCustomEdgeRoleUseCase,
    useFactory: (roles) => new UpdateCustomEdgeRoleUseCase(roles),
    inject: [ROLE_REPOSITORY_PORT],
  },
  {
    provide: ListEdgePermissionsUseCase,
    useFactory: (roles) => new ListEdgePermissionsUseCase(roles),
    inject: [ROLE_REPOSITORY_PORT],
  },
  {
    provide: AssignEdgeRoleUseCase,
    useFactory: (roles, memberships) => new AssignEdgeRoleUseCase(roles, memberships),
    inject: [ROLE_REPOSITORY_PORT, MEMBERSHIP_REPOSITORY_PORT],
  },
  {
    provide: RevokeEdgeRoleAssignmentUseCase,
    useFactory: (roles) => new RevokeEdgeRoleAssignmentUseCase(roles),
    inject: [ROLE_REPOSITORY_PORT],
  },
  {
    provide: ResolveEffectivePermissionsUseCase,
    useFactory: (roles) => new ResolveEffectivePermissionsUseCase(roles),
    inject: [ROLE_REPOSITORY_PORT],
  },
  {
    provide: ListAvailableWorkspacesUseCase,
    useFactory: (memberships, verticals) =>
      new ListAvailableWorkspacesUseCase(memberships, verticals),
    inject: [MEMBERSHIP_REPOSITORY_PORT, VERTICAL_REPOSITORY_PORT],
  },
  {
    provide: SwitchWorkspaceUseCase,
    useFactory: (memberships, verticals, admins, sessions, config: EnvironmentConfig) =>
      new SwitchWorkspaceUseCase(
        memberships,
        verticals,
        admins,
        sessions,
        config.EDGE_WORKSPACE_SESSION_TTL_SECONDS,
      ),
    inject: [
      MEMBERSHIP_REPOSITORY_PORT,
      VERTICAL_REPOSITORY_PORT,
      ADMINISTRATOR_REPOSITORY_PORT,
      WORKSPACE_SESSION_REPOSITORY_PORT,
      APP_CONFIG,
    ],
  },
  {
    provide: BootstrapWorkspaceUseCase,
    useFactory: (switchWorkspace: SwitchWorkspaceUseCase) =>
      new BootstrapWorkspaceUseCase(switchWorkspace),
    inject: [SwitchWorkspaceUseCase],
  },
  {
    provide: GetActiveWorkspaceUseCase,
    useFactory: (sessions, admins, memberships, verticals) =>
      new GetActiveWorkspaceUseCase(sessions, admins, memberships, verticals),
    inject: [
      WORKSPACE_SESSION_REPOSITORY_PORT,
      ADMINISTRATOR_REPOSITORY_PORT,
      MEMBERSHIP_REPOSITORY_PORT,
      VERTICAL_REPOSITORY_PORT,
    ],
  },
  {
    provide: RenewWorkspaceUseCase,
    useFactory: (sessions, admins, memberships, verticals, config: EnvironmentConfig) =>
      new RenewWorkspaceUseCase(
        sessions,
        admins,
        memberships,
        verticals,
        config.EDGE_WORKSPACE_SESSION_TTL_SECONDS,
      ),
    inject: [
      WORKSPACE_SESSION_REPOSITORY_PORT,
      ADMINISTRATOR_REPOSITORY_PORT,
      MEMBERSHIP_REPOSITORY_PORT,
      VERTICAL_REPOSITORY_PORT,
      APP_CONFIG,
    ],
  },
  {
    provide: RevokeWorkspaceUseCase,
    useFactory: (sessions) => new RevokeWorkspaceUseCase(sessions),
    inject: [WORKSPACE_SESSION_REPOSITORY_PORT],
  },
  {
    provide: RevokeAllWorkspacesUseCase,
    useFactory: (sessions) => new RevokeAllWorkspacesUseCase(sessions),
    inject: [WORKSPACE_SESSION_REPOSITORY_PORT],
  },
  {
    provide: ListSecuritySessionsUseCase,
    useFactory: (sessions) => new ListSecuritySessionsUseCase(sessions),
    inject: [WORKSPACE_SESSION_REPOSITORY_PORT],
  },
  {
    provide: RevokeSecuritySessionUseCase,
    useFactory: (sessions) => new RevokeSecuritySessionUseCase(sessions),
    inject: [WORKSPACE_SESSION_REPOSITORY_PORT],
  },
  {
    provide: RevokeAllSecuritySessionsUseCase,
    useFactory: (sessions) => new RevokeAllSecuritySessionsUseCase(sessions),
    inject: [WORKSPACE_SESSION_REPOSITORY_PORT],
  },
  {
    provide: ListSecurityAuditEventsUseCase,
    useFactory: (audit) => new ListSecurityAuditEventsUseCase(audit),
    inject: [AUDIT_EVENT_REPOSITORY_PORT],
  },
  {
    provide: GetMfaStateUseCase,
    useFactory: (admins) => new GetMfaStateUseCase(admins),
    inject: [ADMINISTRATOR_REPOSITORY_PORT],
  },
  {
    provide: RequestEmergencyAccessUseCase,
    useFactory: (emergency, audit) => new RequestEmergencyAccessUseCase(emergency, audit),
    inject: [EMERGENCY_ACCESS_REPOSITORY_PORT, AUDIT_EVENT_REPOSITORY_PORT],
  },
  {
    provide: ApproveEmergencyAccessUseCase,
    useFactory: (emergency, audit) => new ApproveEmergencyAccessUseCase(emergency, audit),
    inject: [EMERGENCY_ACCESS_REPOSITORY_PORT, AUDIT_EVENT_REPOSITORY_PORT],
  },
  {
    provide: RevokeEmergencyAccessUseCase,
    useFactory: (emergency, audit) => new RevokeEmergencyAccessUseCase(emergency, audit),
    inject: [EMERGENCY_ACCESS_REPOSITORY_PORT, AUDIT_EVENT_REPOSITORY_PORT],
  },
  {
    provide: ListDelegationsUseCase,
    useFactory: (delegations) => new ListDelegationsUseCase(delegations),
    inject: [DELEGATION_REPOSITORY_PORT],
  },
  {
    provide: CreateDelegationUseCase,
    useFactory: (delegations, audit) => new CreateDelegationUseCase(delegations, audit),
    inject: [DELEGATION_REPOSITORY_PORT, AUDIT_EVENT_REPOSITORY_PORT],
  },
  {
    provide: RevokeDelegationUseCase,
    useFactory: (delegations, audit) => new RevokeDelegationUseCase(delegations, audit),
    inject: [DELEGATION_REPOSITORY_PORT, AUDIT_EVENT_REPOSITORY_PORT],
  },
  {
    provide: GetWorkspaceConfigurationUseCase,
    useFactory: (configurations) => new GetWorkspaceConfigurationUseCase(configurations),
    inject: [CONFIGURATION_REPOSITORY_PORT],
  },
  {
    provide: UpdateConfigurationDraftUseCase,
    useFactory: (configurations, verticals) =>
      new UpdateConfigurationDraftUseCase(configurations, verticals),
    inject: [CONFIGURATION_REPOSITORY_PORT, VERTICAL_REPOSITORY_PORT],
  },
  {
    provide: ValidateConfigurationUseCase,
    useFactory: (configurations) => new ValidateConfigurationUseCase(configurations),
    inject: [CONFIGURATION_REPOSITORY_PORT],
  },
  {
    provide: ActivateConfigurationUseCase,
    useFactory: (configurations, verticals, audit) =>
      new ActivateConfigurationUseCase(configurations, verticals, audit),
    inject: [
      CONFIGURATION_REPOSITORY_PORT,
      VERTICAL_REPOSITORY_PORT,
      AUDIT_EVENT_REPOSITORY_PORT,
    ],
  },
  {
    provide: ListConfigurationHistoryUseCase,
    useFactory: (configurations) => new ListConfigurationHistoryUseCase(configurations),
    inject: [CONFIGURATION_REPOSITORY_PORT],
  },
  {
    provide: CreateProductUseCase,
    useFactory: (products, verticals) => new CreateProductUseCase(products, verticals),
    inject: [PRODUCT_REPOSITORY_PORT, VERTICAL_REPOSITORY_PORT],
  },
  {
    provide: UpdateProductUseCase,
    useFactory: (products) => new UpdateProductUseCase(products),
    inject: [PRODUCT_REPOSITORY_PORT],
  },
  {
    provide: GetProductUseCase,
    useFactory: (products) => new GetProductUseCase(products),
    inject: [PRODUCT_REPOSITORY_PORT],
  },
  {
    provide: ListProductsUseCase,
    useFactory: (products) => new ListProductsUseCase(products),
    inject: [PRODUCT_REPOSITORY_PORT],
  },
  {
    provide: TransitionProductLifecycleUseCase,
    useFactory: (products) => new TransitionProductLifecycleUseCase(products),
    inject: [PRODUCT_REPOSITORY_PORT],
  },
  {
    provide: CreateProductVersionUseCase,
    useFactory: (products, versions) => new CreateProductVersionUseCase(products, versions),
    inject: [PRODUCT_REPOSITORY_PORT, PRODUCT_VERSION_REPOSITORY_PORT],
  },
  {
    provide: UpdateProductVersionDraftUseCase,
    useFactory: (products, versions) =>
      new UpdateProductVersionDraftUseCase(products, versions),
    inject: [PRODUCT_REPOSITORY_PORT, PRODUCT_VERSION_REPOSITORY_PORT],
  },
  {
    provide: GetProductVersionUseCase,
    useFactory: (products, versions) => new GetProductVersionUseCase(products, versions),
    inject: [PRODUCT_REPOSITORY_PORT, PRODUCT_VERSION_REPOSITORY_PORT],
  },
  {
    provide: ListProductVersionsUseCase,
    useFactory: (products, versions) =>
      new ListProductVersionsUseCase(products, versions),
    inject: [PRODUCT_REPOSITORY_PORT, PRODUCT_VERSION_REPOSITORY_PORT],
  },
  {
    provide: PublishProductVersionUseCase,
    useFactory: (products, versions) => new PublishProductVersionUseCase(products, versions),
    inject: [PRODUCT_REPOSITORY_PORT, PRODUCT_VERSION_REPOSITORY_PORT],
  },
  {
    provide: UpsertCompatibilityUseCase,
    useFactory: (products, compat) => new UpsertCompatibilityUseCase(products, compat),
    inject: [PRODUCT_REPOSITORY_PORT, COMPATIBILITY_REPOSITORY_PORT],
  },
  {
    provide: ListCompatibilitiesByProductUseCase,
    useFactory: (compat) => new ListCompatibilitiesByProductUseCase(compat),
    inject: [COMPATIBILITY_REPOSITORY_PORT],
  },
  {
    provide: CreateSegmentUseCase,
    useFactory: (segments, verticals) => new CreateSegmentUseCase(segments, verticals),
    inject: [SEGMENT_REPOSITORY_PORT, VERTICAL_REPOSITORY_PORT],
  },
  {
    provide: UpdateSegmentUseCase,
    useFactory: (segments) => new UpdateSegmentUseCase(segments),
    inject: [SEGMENT_REPOSITORY_PORT],
  },
  {
    provide: ListSegmentsByVerticalUseCase,
    useFactory: (segments) => new ListSegmentsByVerticalUseCase(segments),
    inject: [SEGMENT_REPOSITORY_PORT],
  },
  {
    provide: GetSegmentUseCase,
    useFactory: (segments) => new GetSegmentUseCase(segments),
    inject: [SEGMENT_REPOSITORY_PORT],
  },
  {
    provide: CreateProfileUseCase,
    useFactory: (profiles, verticals) => new CreateProfileUseCase(profiles, verticals),
    inject: [PROFILE_REPOSITORY_PORT, VERTICAL_REPOSITORY_PORT],
  },
  {
    provide: ListProfilesUseCase,
    useFactory: (profiles) => new ListProfilesUseCase(profiles),
    inject: [PROFILE_REPOSITORY_PORT],
  },
  {
    provide: GetProfileUseCase,
    useFactory: (profiles) => new GetProfileUseCase(profiles),
    inject: [PROFILE_REPOSITORY_PORT],
  },
  {
    provide: CreateOperatingModelUseCase,
    useFactory: (models) => new CreateOperatingModelUseCase(models),
    inject: [OPERATING_MODEL_REPOSITORY_PORT],
  },
  {
    provide: ListOperatingModelsUseCase,
    useFactory: (models) => new ListOperatingModelsUseCase(models),
    inject: [OPERATING_MODEL_REPOSITORY_PORT],
  },
  {
    provide: GetOperatingModelUseCase,
    useFactory: (models) => new GetOperatingModelUseCase(models),
    inject: [OPERATING_MODEL_REPOSITORY_PORT],
  },
  {
    provide: CreateCapabilityUseCase,
    useFactory: (capabilities) => new CreateCapabilityUseCase(capabilities),
    inject: [CAPABILITY_REPOSITORY_PORT],
  },
  {
    provide: ListCapabilitiesUseCase,
    useFactory: (capabilities) => new ListCapabilitiesUseCase(capabilities),
    inject: [CAPABILITY_REPOSITORY_PORT],
  },
  {
    provide: GetCapabilityUseCase,
    useFactory: (capabilities) => new GetCapabilityUseCase(capabilities),
    inject: [CAPABILITY_REPOSITORY_PORT],
  },
  {
    provide: AddCapabilityDependencyUseCase,
    useFactory: (capabilities) => new AddCapabilityDependencyUseCase(capabilities),
    inject: [CAPABILITY_REPOSITORY_PORT],
  },
  {
    provide: UpsertProductCapabilityMappingUseCase,
    useFactory: (products, capabilities) =>
      new UpsertProductCapabilityMappingUseCase(products, capabilities),
    inject: [PRODUCT_REPOSITORY_PORT, CAPABILITY_REPOSITORY_PORT],
  },
  {
    provide: ListProductCapabilityMappingsUseCase,
    useFactory: (capabilities) => new ListProductCapabilityMappingsUseCase(capabilities),
    inject: [CAPABILITY_REPOSITORY_PORT],
  },
  {
    provide: CreateBackendUseCase,
    useFactory: (backends) => new CreateBackendUseCase(backends),
    inject: [BACKEND_REPOSITORY_PORT],
  },
  {
    provide: ListBackendsUseCase,
    useFactory: (backends) => new ListBackendsUseCase(backends),
    inject: [BACKEND_REPOSITORY_PORT],
  },
  {
    provide: GetBackendUseCase,
    useFactory: (backends) => new GetBackendUseCase(backends),
    inject: [BACKEND_REPOSITORY_PORT],
  },
  {
    provide: CreateProductBackendBindingUseCase,
    useFactory: (products, backends) => new CreateProductBackendBindingUseCase(products, backends),
    inject: [PRODUCT_REPOSITORY_PORT, BACKEND_REPOSITORY_PORT],
  },
  {
    provide: ListProductBackendBindingsUseCase,
    useFactory: (backends) => new ListProductBackendBindingsUseCase(backends),
    inject: [BACKEND_REPOSITORY_PORT],
  },
  {
    provide: CreateContractUseCase,
    useFactory: (contracts) => new CreateContractUseCase(contracts),
    inject: [CONTRACT_REPOSITORY_PORT],
  },
  {
    provide: ListContractsUseCase,
    useFactory: (contracts) => new ListContractsUseCase(contracts),
    inject: [CONTRACT_REPOSITORY_PORT],
  },
  {
    provide: GetContractUseCase,
    useFactory: (contracts) => new GetContractUseCase(contracts),
    inject: [CONTRACT_REPOSITORY_PORT],
  },
  {
    provide: EvaluateProductReadinessUseCase,
    useFactory: (products, versions, capabilities, backends, readiness) =>
      new EvaluateProductReadinessUseCase(
        products,
        versions,
        capabilities,
        backends,
        readiness,
      ),
    inject: [
      PRODUCT_REPOSITORY_PORT,
      PRODUCT_VERSION_REPOSITORY_PORT,
      CAPABILITY_REPOSITORY_PORT,
      BACKEND_REPOSITORY_PORT,
      READINESS_REPOSITORY_PORT,
    ],
  },
  {
    provide: ListReadinessEvaluationsUseCase,
    useFactory: (readiness) => new ListReadinessEvaluationsUseCase(readiness),
    inject: [READINESS_REPOSITORY_PORT],
  },
  {
    provide: PublishProductUseCase,
    useFactory: (products, versions, capabilities, backends, publications, evaluate) =>
      new PublishProductUseCase(
        products,
        versions,
        capabilities,
        backends,
        publications,
        evaluate,
      ),
    inject: [
      PRODUCT_REPOSITORY_PORT,
      PRODUCT_VERSION_REPOSITORY_PORT,
      CAPABILITY_REPOSITORY_PORT,
      BACKEND_REPOSITORY_PORT,
      PUBLICATION_REPOSITORY_PORT,
      EvaluateProductReadinessUseCase,
    ],
  },
  {
    provide: CreateCommercialMarketUseCase,
    useFactory: (commercial, verticals, outbox) =>
      new CreateCommercialMarketUseCase(commercial, verticals, outbox),
    inject: [
      COMMERCIAL_REPOSITORY_PORT,
      VERTICAL_REPOSITORY_PORT,
      ControlPlaneOutboxTransactionService,
    ],
  },
  {
    provide: ListCommercialMarketsUseCase,
    useFactory: (commercial) => new ListCommercialMarketsUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: CreateIcpUseCase,
    useFactory: (commercial, products, verticals, outbox) =>
      new CreateIcpUseCase(commercial, products, verticals, outbox),
    inject: [
      COMMERCIAL_REPOSITORY_PORT,
      PRODUCT_REPOSITORY_PORT,
      VERTICAL_REPOSITORY_PORT,
      ControlPlaneOutboxTransactionService,
    ],
  },
  {
    provide: ListIcpsUseCase,
    useFactory: (commercial) => new ListIcpsUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: CreateSolutionPackageUseCase,
    useFactory: (commercial, products) =>
      new CreateSolutionPackageUseCase(commercial, products),
    inject: [COMMERCIAL_REPOSITORY_PORT, PRODUCT_REPOSITORY_PORT],
  },
  {
    provide: ListPackagesUseCase,
    useFactory: (commercial) => new ListPackagesUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: AddPackageCapabilityUseCase,
    useFactory: (commercial, capabilities) =>
      new AddPackageCapabilityUseCase(commercial, capabilities),
    inject: [COMMERCIAL_REPOSITORY_PORT, CAPABILITY_REPOSITORY_PORT],
  },
  {
    provide: CreateCommercialPlanUseCase,
    useFactory: (commercial, products) =>
      new CreateCommercialPlanUseCase(commercial, products),
    inject: [COMMERCIAL_REPOSITORY_PORT, PRODUCT_REPOSITORY_PORT],
  },
  {
    provide: ListCommercialPlansUseCase,
    useFactory: (commercial) => new ListCommercialPlansUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: AddPlanCapabilityUseCase,
    useFactory: (commercial, capabilities) =>
      new AddPlanCapabilityUseCase(commercial, capabilities),
    inject: [COMMERCIAL_REPOSITORY_PORT, CAPABILITY_REPOSITORY_PORT],
  },
  {
    provide: CreateCommercialAddonUseCase,
    useFactory: (commercial, products) =>
      new CreateCommercialAddonUseCase(commercial, products),
    inject: [COMMERCIAL_REPOSITORY_PORT, PRODUCT_REPOSITORY_PORT],
  },
  {
    provide: ListAddonsUseCase,
    useFactory: (commercial) => new ListAddonsUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: AddAddonCapabilityUseCase,
    useFactory: (commercial, capabilities) =>
      new AddAddonCapabilityUseCase(commercial, capabilities),
    inject: [COMMERCIAL_REPOSITORY_PORT, CAPABILITY_REPOSITORY_PORT],
  },
  {
    provide: GetCommercialPlanUseCase,
    useFactory: (commercial) => new GetCommercialPlanUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: GetSolutionPackageUseCase,
    useFactory: (commercial) => new GetSolutionPackageUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: ListPriceBookEntriesUseCase,
    useFactory: (commercial) => new ListPriceBookEntriesUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: LinkAddonToPlanUseCase,
    useFactory: (commercial) => new LinkAddonToPlanUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: CreatePriceBookUseCase,
    useFactory: (commercial, products) =>
      new CreatePriceBookUseCase(commercial, products),
    inject: [COMMERCIAL_REPOSITORY_PORT, PRODUCT_REPOSITORY_PORT],
  },
  {
    provide: ListPriceBooksUseCase,
    useFactory: (commercial) => new ListPriceBooksUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: AddPriceBookEntryUseCase,
    useFactory: (commercial) => new AddPriceBookEntryUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: CreatePricingUnitUseCase,
    useFactory: (commercial) => new CreatePricingUnitUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: ListPricingUnitsUseCase,
    useFactory: (commercial) => new ListPricingUnitsUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: PreviewCommercialPriceUseCase,
    useFactory: () => new PreviewCommercialPriceUseCase(),
    inject: [],
  },
  {
    provide: EvaluateCommercialPlanReadinessUseCase,
    useFactory: (commercial, products, capabilities, outbox) =>
      new EvaluateCommercialPlanReadinessUseCase(
        commercial,
        products,
        capabilities,
        outbox,
      ),
    inject: [
      COMMERCIAL_REPOSITORY_PORT,
      PRODUCT_REPOSITORY_PORT,
      CAPABILITY_REPOSITORY_PORT,
      ControlPlaneOutboxTransactionService,
    ],
  },
  {
    provide: PublishCommercialPlanUseCase,
    useFactory: (commercial, evaluate, outbox) =>
      new PublishCommercialPlanUseCase(commercial, evaluate, outbox),
    inject: [
      COMMERCIAL_REPOSITORY_PORT,
      EvaluateCommercialPlanReadinessUseCase,
      ControlPlaneOutboxTransactionService,
    ],
  },
  {
    provide: ConfigureCommercialOfferUseCase,
    useFactory: (commercial, products, capabilities) =>
      new ConfigureCommercialOfferUseCase(commercial, products, capabilities),
    inject: [
      COMMERCIAL_REPOSITORY_PORT,
      PRODUCT_REPOSITORY_PORT,
      CAPABILITY_REPOSITORY_PORT,
    ],
  },
  {
    provide: CreatePersonaUseCase,
    useFactory: (commercial) => new CreatePersonaUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: ListPersonasUseCase,
    useFactory: (commercial) => new ListPersonasUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: CreateValuePropositionUseCase,
    useFactory: (commercial, products) =>
      new CreateValuePropositionUseCase(commercial, products),
    inject: [COMMERCIAL_REPOSITORY_PORT, PRODUCT_REPOSITORY_PORT],
  },
  {
    provide: ListValuePropositionsUseCase,
    useFactory: (commercial) => new ListValuePropositionsUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: CreateDiscountPolicyUseCase,
    useFactory: (commercial) => new CreateDiscountPolicyUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: ListDiscountPoliciesUseCase,
    useFactory: (commercial) => new ListDiscountPoliciesUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: CreateResearchProjectUseCase,
    useFactory: (commercial) => new CreateResearchProjectUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: ListResearchProjectsUseCase,
    useFactory: (commercial) => new ListResearchProjectsUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: AddResearchSourceUseCase,
    useFactory: (commercial) => new AddResearchSourceUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: CompleteResearchProjectUseCase,
    useFactory: (commercial) => new CompleteResearchProjectUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: UpsertSegmentIntelligenceUseCase,
    useFactory: (commercial) => new UpsertSegmentIntelligenceUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: ScoreSegmentPriorityUseCase,
    useFactory: (commercial, outbox) =>
      new ScoreSegmentPriorityUseCase(commercial, outbox),
    inject: [COMMERCIAL_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: GetCommercialCatalogViewUseCase,
    useFactory: (commercial) => new GetCommercialCatalogViewUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: EvaluateCommercialOfferReadinessUseCase,
    useFactory: (commercial, products, capabilities, outbox) =>
      new EvaluateCommercialOfferReadinessUseCase(
        commercial,
        products,
        capabilities,
        outbox,
      ),
    inject: [
      COMMERCIAL_REPOSITORY_PORT,
      PRODUCT_REPOSITORY_PORT,
      CAPABILITY_REPOSITORY_PORT,
      ControlPlaneOutboxTransactionService,
    ],
  },
  {
    provide: PublishSolutionPackageUseCase,
    useFactory: (commercial, evaluate, outbox) =>
      new PublishSolutionPackageUseCase(commercial, evaluate, outbox),
    inject: [
      COMMERCIAL_REPOSITORY_PORT,
      EvaluateCommercialOfferReadinessUseCase,
      ControlPlaneOutboxTransactionService,
    ],
  },
  {
    provide: PublishCommercialAddonUseCase,
    useFactory: (commercial, evaluate) =>
      new PublishCommercialAddonUseCase(commercial, evaluate),
    inject: [COMMERCIAL_REPOSITORY_PORT, EvaluateCommercialOfferReadinessUseCase],
  },
  {
    provide: PublishEnterpriseTemplateUseCase,
    useFactory: (commercial, evaluate) =>
      new PublishEnterpriseTemplateUseCase(commercial, evaluate),
    inject: [COMMERCIAL_REPOSITORY_PORT, EvaluateCommercialOfferReadinessUseCase],
  },
  {
    provide: PublishPriceBookUseCase,
    useFactory: (commercial, outbox) =>
      new PublishPriceBookUseCase(commercial, outbox),
    inject: [COMMERCIAL_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ListPublicationSnapshotsUseCase,
    useFactory: (commercial) => new ListPublicationSnapshotsUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: ListSegmentIntelligenceUseCase,
    useFactory: (commercial) => new ListSegmentIntelligenceUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: CreatePricingModelUseCase,
    useFactory: (commercial, products) =>
      new CreatePricingModelUseCase(commercial, products),
    inject: [COMMERCIAL_REPOSITORY_PORT, PRODUCT_REPOSITORY_PORT],
  },
  {
    provide: ListPricingModelsUseCase,
    useFactory: (commercial) => new ListPricingModelsUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: CreateUsageMetricUseCase,
    useFactory: (commercial) => new CreateUsageMetricUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: ListUsageMetricsUseCase,
    useFactory: (commercial) => new ListUsageMetricsUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: CreateBuyingCommitteeUseCase,
    useFactory: (commercial) => new CreateBuyingCommitteeUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: ListBuyingCommitteesUseCase,
    useFactory: (commercial) => new ListBuyingCommitteesUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: CreateDecisionJourneyUseCase,
    useFactory: (commercial) => new CreateDecisionJourneyUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: ListDecisionJourneysUseCase,
    useFactory: (commercial) => new ListDecisionJourneysUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: CreateEnterpriseTemplateUseCase,
    useFactory: (commercial, products) =>
      new CreateEnterpriseTemplateUseCase(commercial, products),
    inject: [COMMERCIAL_REPOSITORY_PORT, PRODUCT_REPOSITORY_PORT],
  },
  {
    provide: ListEnterpriseTemplatesUseCase,
    useFactory: (commercial) => new ListEnterpriseTemplatesUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: CreateEligibilityPolicyUseCase,
    useFactory: (commercial) => new CreateEligibilityPolicyUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: ListEligibilityPoliciesUseCase,
    useFactory: (commercial) => new ListEligibilityPoliciesUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: AddMarketAssessmentUseCase,
    useFactory: (commercial) => new AddMarketAssessmentUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: ListMarketAssessmentsUseCase,
    useFactory: (commercial) => new ListMarketAssessmentsUseCase(commercial),
    inject: [COMMERCIAL_REPOSITORY_PORT],
  },
  {
    provide: CreateMarketingStrategyUseCase,
    useFactory: (marketing, outbox) =>
      new CreateMarketingStrategyUseCase(marketing, outbox),
    inject: [MARKETING_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ListMarketingStrategiesUseCase,
    useFactory: (marketing) => new ListMarketingStrategiesUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: CreateMarketingAudienceUseCase,
    useFactory: (marketing) => new CreateMarketingAudienceUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: ListMarketingAudiencesUseCase,
    useFactory: (marketing) => new ListMarketingAudiencesUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: CreateMarketingCampaignUseCase,
    useFactory: (marketing, products, commercial, outbox) =>
      new CreateMarketingCampaignUseCase(marketing, products, commercial, outbox),
    inject: [
      MARKETING_REPOSITORY_PORT,
      PRODUCT_REPOSITORY_PORT,
      COMMERCIAL_REPOSITORY_PORT,
      ControlPlaneOutboxTransactionService,
    ],
  },
  {
    provide: ListMarketingCampaignsUseCase,
    useFactory: (marketing) => new ListMarketingCampaignsUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: GetMarketingCampaignUseCase,
    useFactory: (marketing) => new GetMarketingCampaignUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: TransitionMarketingCampaignUseCase,
    useFactory: (marketing) => new TransitionMarketingCampaignUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: ApproveMarketingCampaignUseCase,
    useFactory: (marketing) => new ApproveMarketingCampaignUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: PublishMarketingCampaignUseCase,
    useFactory: (marketing, products, commercial, outbox) =>
      new PublishMarketingCampaignUseCase(marketing, products, commercial, outbox),
    inject: [
      MARKETING_REPOSITORY_PORT,
      PRODUCT_REPOSITORY_PORT,
      COMMERCIAL_REPOSITORY_PORT,
      ControlPlaneOutboxTransactionService,
    ],
  },
  {
    provide: CreateMarketingFormUseCase,
    useFactory: (marketing) => new CreateMarketingFormUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: ListMarketingFormsUseCase,
    useFactory: (marketing) => new ListMarketingFormsUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: PublishMarketingFormUseCase,
    useFactory: (marketing) => new PublishMarketingFormUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: SubmitMarketingFormPublicUseCase,
    useFactory: (marketing, outbox) =>
      new SubmitMarketingFormPublicUseCase(marketing, outbox),
    inject: [MARKETING_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ListMarketingLeadsUseCase,
    useFactory: (marketing) => new ListMarketingLeadsUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: GetMarketingLeadUseCase,
    useFactory: (marketing) => new GetMarketingLeadUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: ScoreMarketingLeadUseCase,
    useFactory: (marketing, outbox) =>
      new ScoreMarketingLeadUseCase(marketing, outbox),
    inject: [MARKETING_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: CreateMarketingBudgetUseCase,
    useFactory: (marketing) => new CreateMarketingBudgetUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: ListMarketingBudgetsUseCase,
    useFactory: (marketing) => new ListMarketingBudgetsUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: CreateMarketingContentUseCase,
    useFactory: (marketing) => new CreateMarketingContentUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: ListMarketingContentsUseCase,
    useFactory: (marketing) => new ListMarketingContentsUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: ApproveMarketingContentUseCase,
    useFactory: (marketing) => new ApproveMarketingContentUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: PublishMarketingContentUseCase,
    useFactory: (marketing, products) =>
      new PublishMarketingContentUseCase(marketing, products),
    inject: [MARKETING_REPOSITORY_PORT, PRODUCT_REPOSITORY_PORT],
  },
  {
    provide: CreateMarketingLandingPageUseCase,
    useFactory: (marketing) => new CreateMarketingLandingPageUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: ListMarketingLandingPagesUseCase,
    useFactory: (marketing) => new ListMarketingLandingPagesUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: PublishMarketingLandingPageUseCase,
    useFactory: (marketing) => new PublishMarketingLandingPageUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: ListMarketingChannelsUseCase,
    useFactory: (marketing) => new ListMarketingChannelsUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: UpsertMarketingChannelUseCase,
    useFactory: (marketing) => new UpsertMarketingChannelUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: CreateMarketingMessageTemplateUseCase,
    useFactory: (marketing) => new CreateMarketingMessageTemplateUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: ListMarketingMessageTemplatesUseCase,
    useFactory: (marketing) => new ListMarketingMessageTemplatesUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  UnavailableMarketingChannelAdapter,
  LoggingAcceptedMarketingChannelAdapter,
  HttpWebhookMarketingChannelAdapter,
  ResendMarketingChannelAdapter,
  MetaWhatsAppMarketingChannelAdapter,
  ResolvingMarketingChannelAdapter,
  {
    provide: MARKETING_CHANNEL_ADAPTER_PORT,
    useExisting: ResolvingMarketingChannelAdapter,
  },
  {
    provide: RequestMarketingDeliveryUseCase,
    useFactory: (marketing, adapter) =>
      new RequestMarketingDeliveryUseCase(marketing, adapter),
    inject: [MARKETING_REPOSITORY_PORT, MARKETING_CHANNEL_ADAPTER_PORT],
  },
  {
    provide: IngestMarketingDeliveryReceiptUseCase,
    useFactory: (marketing) => new IngestMarketingDeliveryReceiptUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: ProcessResendMarketingWebhookUseCase,
    useFactory: (
      marketing: unknown,
      ingest: IngestMarketingDeliveryReceiptUseCase,
      config: EnvironmentConfig,
    ) =>
      new ProcessResendMarketingWebhookUseCase(
        marketing as never,
        ingest,
        config.RESEND_WEBHOOK_SECRET,
      ),
    inject: [
      MARKETING_REPOSITORY_PORT,
      IngestMarketingDeliveryReceiptUseCase,
      APP_CONFIG,
    ],
  },
  {
    provide: ProcessMetaWhatsAppMarketingWebhookUseCase,
    useFactory: (
      marketing: unknown,
      ingest: IngestMarketingDeliveryReceiptUseCase,
      config: EnvironmentConfig,
    ) =>
      new ProcessMetaWhatsAppMarketingWebhookUseCase(
        marketing as never,
        ingest,
        config.WHATSAPP_APP_SECRET,
      ),
    inject: [
      MARKETING_REPOSITORY_PORT,
      IngestMarketingDeliveryReceiptUseCase,
      APP_CONFIG,
    ],
  },
  {
    provide: VerifyMetaWhatsAppWebhookSubscriptionUseCase,
    useFactory: (config: EnvironmentConfig) =>
      new VerifyMetaWhatsAppWebhookSubscriptionUseCase(
        config.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      ),
    inject: [APP_CONFIG],
  },
  {
    provide: UpdateMarketingContentStudioUseCase,
    useFactory: (marketing) => new UpdateMarketingContentStudioUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: UpdateMarketingLandingStudioUseCase,
    useFactory: (marketing) => new UpdateMarketingLandingStudioUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: ResumeWaitingMarketingJourneysUseCase,
    useFactory: (marketing) => new ResumeWaitingMarketingJourneysUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  MarketingJourneyWaitWorker,
  {
    provide: SummarizeMarketingAnalyticsUseCase,
    useFactory: (marketing) => new SummarizeMarketingAnalyticsUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: AssignMarketingLeadUseCase,
    useFactory: (marketing) => new AssignMarketingLeadUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: MergeMarketingLeadsUseCase,
    useFactory: (marketing) => new MergeMarketingLeadsUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: CreateMarketingJourneyUseCase,
    useFactory: (marketing) => new CreateMarketingJourneyUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: ListMarketingJourneysUseCase,
    useFactory: (marketing) => new ListMarketingJourneysUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: ActivateMarketingJourneyUseCase,
    useFactory: (marketing) => new ActivateMarketingJourneyUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: StartMarketingJourneyExecutionUseCase,
    useFactory: (marketing) => new StartMarketingJourneyExecutionUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: ListMarketingAttributionModelsUseCase,
    useFactory: (marketing) => new ListMarketingAttributionModelsUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: CalculateMarketingAttributionUseCase,
    useFactory: (marketing) => new CalculateMarketingAttributionUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: CreateMarketingPerformanceSnapshotUseCase,
    useFactory: (marketing) => new CreateMarketingPerformanceSnapshotUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: ListMarketingPerformanceSnapshotsUseCase,
    useFactory: (marketing) => new ListMarketingPerformanceSnapshotsUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: CreateMarketingSuppressionUseCase,
    useFactory: (marketing) => new CreateMarketingSuppressionUseCase(marketing),
    inject: [MARKETING_REPOSITORY_PORT],
  },
  {
    provide: SalesOverviewUseCase,
    useFactory: (sales) => new SalesOverviewUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: CreateSalesTeamUseCase,
    useFactory: (sales) => new CreateSalesTeamUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: ListSalesTeamsUseCase,
    useFactory: (sales) => new ListSalesTeamsUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: AddSalesTeamMemberUseCase,
    useFactory: (sales) => new AddSalesTeamMemberUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: CreateSalesTerritoryUseCase,
    useFactory: (sales) => new CreateSalesTerritoryUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: ListSalesTerritoriesUseCase,
    useFactory: (sales) => new ListSalesTerritoriesUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: CreateCommercialAccountUseCase,
    useFactory: (sales, outbox) => new CreateCommercialAccountUseCase(sales, outbox),
    inject: [SALES_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ListCommercialAccountsUseCase,
    useFactory: (sales) => new ListCommercialAccountsUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: GetCommercialAccountUseCase,
    useFactory: (sales) => new GetCommercialAccountUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: UpdateCommercialAccountUseCase,
    useFactory: (sales) => new UpdateCommercialAccountUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: FindDuplicateAccountsUseCase,
    useFactory: (sales) => new FindDuplicateAccountsUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: MergeCommercialAccountsUseCase,
    useFactory: (sales, outbox) => new MergeCommercialAccountsUseCase(sales, outbox),
    inject: [SALES_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: CreateSalesContactUseCase,
    useFactory: (sales, outbox) => new CreateSalesContactUseCase(sales, outbox),
    inject: [SALES_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ListSalesContactsUseCase,
    useFactory: (sales) => new ListSalesContactsUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: GetSalesContactUseCase,
    useFactory: (sales) => new GetSalesContactUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: ReceiveSalesLeadUseCase,
    useFactory: (sales, outbox) => new ReceiveSalesLeadUseCase(sales, outbox),
    inject: [SALES_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ListSalesLeadsUseCase,
    useFactory: (sales) => new ListSalesLeadsUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: GetSalesLeadUseCase,
    useFactory: (sales) => new GetSalesLeadUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: AcceptSalesLeadUseCase,
    useFactory: (sales, outbox) => new AcceptSalesLeadUseCase(sales, outbox),
    inject: [SALES_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: RejectSalesLeadUseCase,
    useFactory: (sales, outbox) => new RejectSalesLeadUseCase(sales, outbox),
    inject: [SALES_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: QualifySalesLeadUseCase,
    useFactory: (sales, outbox) => new QualifySalesLeadUseCase(sales, outbox),
    inject: [SALES_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: AssignSalesLeadUseCase,
    useFactory: (sales, outbox) => new AssignSalesLeadUseCase(sales, outbox),
    inject: [SALES_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ListAccountTimelineUseCase,
    useFactory: (sales) => new ListAccountTimelineUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: CreateSalesNoteUseCase,
    useFactory: (sales) => new CreateSalesNoteUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: CreateSalesTaskUseCase,
    useFactory: (sales) => new CreateSalesTaskUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: ListSalesTasksUseCase,
    useFactory: (sales) => new ListSalesTasksUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: CompleteSalesTaskUseCase,
    useFactory: (sales) => new CompleteSalesTaskUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: ListSalesPipelinesUseCase,
    useFactory: (sales) => new ListSalesPipelinesUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: GetSalesPipelineBoardUseCase,
    useFactory: (sales) => new GetSalesPipelineBoardUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: CreateOpportunityUseCase,
    useFactory: (sales, outbox) => new CreateOpportunityUseCase(sales, outbox),
    inject: [SALES_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ListOpportunitiesUseCase,
    useFactory: (sales) => new ListOpportunitiesUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: GetOpportunityUseCase,
    useFactory: (sales, commerce) => new GetOpportunityUseCase(sales, commerce),
    inject: [SALES_REPOSITORY_PORT, SALES_COMMERCE_REPOSITORY_PORT],
  },
  {
    provide: UpdateOpportunityUseCase,
    useFactory: (sales) => new UpdateOpportunityUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: TransitionOpportunityStageUseCase,
    useFactory: (sales, outbox, commerce) =>
      new TransitionOpportunityStageUseCase(sales, outbox, commerce),
    inject: [
      SALES_REPOSITORY_PORT,
      ControlPlaneOutboxTransactionService,
      SALES_COMMERCE_REPOSITORY_PORT,
    ],
  },
  {
    provide: ReopenOpportunityUseCase,
    useFactory: (sales) => new ReopenOpportunityUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: AddOpportunityRiskUseCase,
    useFactory: (sales) => new AddOpportunityRiskUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: AddOpportunityCompetitorUseCase,
    useFactory: (sales) => new AddOpportunityCompetitorUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: AddOpportunityContactUseCase,
    useFactory: (sales) => new AddOpportunityContactUseCase(sales),
    inject: [SALES_REPOSITORY_PORT],
  },
  {
    provide: CreateSalesActivityUseCase,
    useFactory: (c) => new CreateSalesActivityUseCase(c),
    inject: [SALES_COMMERCE_REPOSITORY_PORT],
  },
  {
    provide: ListSalesActivitiesUseCase,
    useFactory: (c) => new ListSalesActivitiesUseCase(c),
    inject: [SALES_COMMERCE_REPOSITORY_PORT],
  },
  {
    provide: CompleteSalesActivityUseCase,
    useFactory: (c) => new CompleteSalesActivityUseCase(c),
    inject: [SALES_COMMERCE_REPOSITORY_PORT],
  },
  {
    provide: CreateNeedsAssessmentUseCase,
    useFactory: (c, s) => new CreateNeedsAssessmentUseCase(c, s),
    inject: [SALES_COMMERCE_REPOSITORY_PORT, SALES_REPOSITORY_PORT],
  },
  {
    provide: CompleteNeedsAssessmentUseCase,
    useFactory: (c, outbox) => new CompleteNeedsAssessmentUseCase(c, outbox),
    inject: [SALES_COMMERCE_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ListNeedsAssessmentsUseCase,
    useFactory: (c) => new ListNeedsAssessmentsUseCase(c),
    inject: [SALES_COMMERCE_REPOSITORY_PORT],
  },
  {
    provide: CreateOpportunityOfferConfigurationUseCase,
    useFactory: (c, s, outbox) =>
      new CreateOpportunityOfferConfigurationUseCase(c, s, outbox),
    inject: [
      SALES_COMMERCE_REPOSITORY_PORT,
      SALES_REPOSITORY_PORT,
      ControlPlaneOutboxTransactionService,
    ],
  },
  {
    provide: ListOfferConfigurationsUseCase,
    useFactory: (c) => new ListOfferConfigurationsUseCase(c),
    inject: [SALES_COMMERCE_REPOSITORY_PORT],
  },
  {
    provide: CreateSalesQuoteUseCase,
    useFactory: (c, s, outbox) => new CreateSalesQuoteUseCase(c, s, outbox),
    inject: [
      SALES_COMMERCE_REPOSITORY_PORT,
      SALES_REPOSITORY_PORT,
      ControlPlaneOutboxTransactionService,
    ],
  },
  {
    provide: ListSalesQuotesUseCase,
    useFactory: (c) => new ListSalesQuotesUseCase(c),
    inject: [SALES_COMMERCE_REPOSITORY_PORT],
  },
  {
    provide: GetSalesQuoteUseCase,
    useFactory: (c) => new GetSalesQuoteUseCase(c),
    inject: [SALES_COMMERCE_REPOSITORY_PORT],
  },
  {
    provide: TransitionSalesQuoteUseCase,
    useFactory: (c, outbox) => new TransitionSalesQuoteUseCase(c, outbox),
    inject: [SALES_COMMERCE_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ReviseSalesQuoteUseCase,
    useFactory: (c) => new ReviseSalesQuoteUseCase(c),
    inject: [SALES_COMMERCE_REPOSITORY_PORT],
  },
  {
    provide: CreateSalesProposalUseCase,
    useFactory: (c, s) => new CreateSalesProposalUseCase(c, s),
    inject: [SALES_COMMERCE_REPOSITORY_PORT, SALES_REPOSITORY_PORT],
  },
  {
    provide: ListSalesProposalsUseCase,
    useFactory: (c) => new ListSalesProposalsUseCase(c),
    inject: [SALES_COMMERCE_REPOSITORY_PORT],
  },
  {
    provide: IssueSalesProposalUseCase,
    useFactory: (c, outbox) => new IssueSalesProposalUseCase(c, outbox),
    inject: [SALES_COMMERCE_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: RequestSalesDiscountUseCase,
    useFactory: (c, s, outbox) => new RequestSalesDiscountUseCase(c, s, outbox),
    inject: [
      SALES_COMMERCE_REPOSITORY_PORT,
      SALES_REPOSITORY_PORT,
      ControlPlaneOutboxTransactionService,
    ],
  },
  {
    provide: DecideSalesDiscountUseCase,
    useFactory: (c, outbox) => new DecideSalesDiscountUseCase(c, outbox),
    inject: [SALES_COMMERCE_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ListSalesDiscountRequestsUseCase,
    useFactory: (c) => new ListSalesDiscountRequestsUseCase(c),
    inject: [SALES_COMMERCE_REPOSITORY_PORT],
  },
  {
    provide: ListSalesApprovalsUseCase,
    useFactory: (c) => new ListSalesApprovalsUseCase(c),
    inject: [SALES_COMMERCE_REPOSITORY_PORT],
  },
  {
    provide: DecideSalesApprovalUseCase,
    useFactory: (c) => new DecideSalesApprovalUseCase(c),
    inject: [SALES_COMMERCE_REPOSITORY_PORT],
  },
  {
    provide: CreateSalesContractUseCase,
    useFactory: (c, s, outbox) => new CreateSalesContractUseCase(c, s, outbox),
    inject: [
      SALES_COMMERCE_REPOSITORY_PORT,
      SALES_REPOSITORY_PORT,
      ControlPlaneOutboxTransactionService,
    ],
  },
  {
    provide: ListSalesContractsUseCase,
    useFactory: (c) => new ListSalesContractsUseCase(c),
    inject: [SALES_COMMERCE_REPOSITORY_PORT],
  },
  UnavailableSalesSignatureAdapter,
  DocuSignSalesSignatureAdapter,
  HelloSignSalesSignatureAdapter,
  ResolvingSalesSignatureAdapter,
  {
    provide: SALES_SIGNATURE_ADAPTER_PORT,
    useExisting: ResolvingSalesSignatureAdapter,
  },
  {
    provide: TransitionSalesContractUseCase,
    useFactory: (c, outbox, signatures) =>
      new TransitionSalesContractUseCase(c, outbox, signatures),
    inject: [
      SALES_COMMERCE_REPOSITORY_PORT,
      ControlPlaneOutboxTransactionService,
      SALES_SIGNATURE_ADAPTER_PORT,
    ],
  },
  {
    provide: CreateSalesOrderUseCase,
    useFactory: (c, s, outbox) => new CreateSalesOrderUseCase(c, s, outbox),
    inject: [
      SALES_COMMERCE_REPOSITORY_PORT,
      SALES_REPOSITORY_PORT,
      ControlPlaneOutboxTransactionService,
    ],
  },
  {
    provide: ListSalesOrdersUseCase,
    useFactory: (c) => new ListSalesOrdersUseCase(c),
    inject: [SALES_COMMERCE_REPOSITORY_PORT],
  },
  {
    provide: TransitionSalesOrderUseCase,
    useFactory: (c, outbox) => new TransitionSalesOrderUseCase(c, outbox),
    inject: [SALES_COMMERCE_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: RequestSalesHandoffUseCase,
    useFactory: (c, outbox) => new RequestSalesHandoffUseCase(c, outbox),
    inject: [SALES_COMMERCE_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: AcceptSalesHandoffUseCase,
    useFactory: (c, outbox) => new AcceptSalesHandoffUseCase(c, outbox),
    inject: [SALES_COMMERCE_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ReceiveProvisioningStatusUseCase,
    useFactory: (c, outbox) => new ReceiveProvisioningStatusUseCase(c, outbox),
    inject: [SALES_COMMERCE_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ListSalesHandoffsUseCase,
    useFactory: (c) => new ListSalesHandoffsUseCase(c),
    inject: [SALES_COMMERCE_REPOSITORY_PORT],
  },
  {
    provide: GetSalesForecastUseCase,
    useFactory: (c) => new GetSalesForecastUseCase(c),
    inject: [SALES_COMMERCE_REPOSITORY_PORT],
  },
  {
    provide: GetSalesPerformanceUseCase,
    useFactory: (c) => new GetSalesPerformanceUseCase(c),
    inject: [SALES_COMMERCE_REPOSITORY_PORT],
  },
  { provide: SALES_PROPOSAL_DOCUMENT_ADAPTER_PORT, useClass: MinimalPdfProposalAdapter },
  UnavailableSalesCalendarAdapter,
  GoogleSalesCalendarAdapter,
  OutlookSalesCalendarAdapter,
  ResolvingSalesCalendarAdapter,
  {
    provide: SALES_CALENDAR_ADAPTER_PORT,
    useExisting: ResolvingSalesCalendarAdapter,
  },
  {
    provide: AddAccountRelationshipUseCase,
    useFactory: (p) => new AddAccountRelationshipUseCase(p),
    inject: [SALES_PLATFORM_REPOSITORY_PORT],
  },
  {
    provide: GetAccountHierarchyUseCase,
    useFactory: (p) => new GetAccountHierarchyUseCase(p),
    inject: [SALES_PLATFORM_REPOSITORY_PORT],
  },
  {
    provide: AddContactRoleUseCase,
    useFactory: (p) => new AddContactRoleUseCase(p),
    inject: [SALES_PLATFORM_REPOSITORY_PORT],
  },
  {
    provide: ListContactRolesUseCase,
    useFactory: (p) => new ListContactRolesUseCase(p),
    inject: [SALES_PLATFORM_REPOSITORY_PORT],
  },
  {
    provide: UpsertDiscoveryQuestionnaireUseCase,
    useFactory: (p) => new UpsertDiscoveryQuestionnaireUseCase(p),
    inject: [SALES_PLATFORM_REPOSITORY_PORT],
  },
  {
    provide: ListDiscoveryQuestionnairesUseCase,
    useFactory: (p) => new ListDiscoveryQuestionnairesUseCase(p),
    inject: [SALES_PLATFORM_REPOSITORY_PORT],
  },
  {
    provide: CreateContractAmendmentUseCase,
    useFactory: (p, c, outbox) => new CreateContractAmendmentUseCase(p, c, outbox),
    inject: [
      SALES_PLATFORM_REPOSITORY_PORT,
      SALES_COMMERCE_REPOSITORY_PORT,
      ControlPlaneOutboxTransactionService,
    ],
  },
  {
    provide: ListContractAmendmentsUseCase,
    useFactory: (p) => new ListContractAmendmentsUseCase(p),
    inject: [SALES_PLATFORM_REPOSITORY_PORT],
  },
  {
    provide: ExecuteContractAmendmentUseCase,
    useFactory: (p) => new ExecuteContractAmendmentUseCase(p),
    inject: [SALES_PLATFORM_REPOSITORY_PORT],
  },
  {
    provide: SetSalesOrderLinesUseCase,
    useFactory: (p, c) => new SetSalesOrderLinesUseCase(p, c),
    inject: [SALES_PLATFORM_REPOSITORY_PORT, SALES_COMMERCE_REPOSITORY_PORT],
  },
  {
    provide: ListSalesOrderLinesUseCase,
    useFactory: (p) => new ListSalesOrderLinesUseCase(p),
    inject: [SALES_PLATFORM_REPOSITORY_PORT],
  },
  {
    provide: PersistSalesForecastSnapshotUseCase,
    useFactory: (p, c) => new PersistSalesForecastSnapshotUseCase(p, c),
    inject: [SALES_PLATFORM_REPOSITORY_PORT, SALES_COMMERCE_REPOSITORY_PORT],
  },
  {
    provide: ListSalesForecastSnapshotsUseCase,
    useFactory: (p) => new ListSalesForecastSnapshotsUseCase(p),
    inject: [SALES_PLATFORM_REPOSITORY_PORT],
  },
  {
    provide: GlobalSalesSearchUseCase,
    useFactory: (p) => new GlobalSalesSearchUseCase(p),
    inject: [SALES_PLATFORM_REPOSITORY_PORT],
  },
  {
    provide: CreateSalesSavedViewUseCase,
    useFactory: (p) => new CreateSalesSavedViewUseCase(p),
    inject: [SALES_PLATFORM_REPOSITORY_PORT],
  },
  {
    provide: ListSalesSavedViewsUseCase,
    useFactory: (p) => new ListSalesSavedViewsUseCase(p),
    inject: [SALES_PLATFORM_REPOSITORY_PORT],
  },
  {
    provide: DeleteSalesSavedViewUseCase,
    useFactory: (p) => new DeleteSalesSavedViewUseCase(p),
    inject: [SALES_PLATFORM_REPOSITORY_PORT],
  },
  {
    provide: ExportSalesEntitiesUseCase,
    useFactory: (p, s, c) => new ExportSalesEntitiesUseCase(p, s, c),
    inject: [
      SALES_PLATFORM_REPOSITORY_PORT,
      SALES_REPOSITORY_PORT,
      SALES_COMMERCE_REPOSITORY_PORT,
    ],
  },
  {
    provide: ListSalesExportJobsUseCase,
    useFactory: (p) => new ListSalesExportJobsUseCase(p),
    inject: [SALES_PLATFORM_REPOSITORY_PORT],
  },
  {
    provide: GrantSalesVisibilityUseCase,
    useFactory: (p) => new GrantSalesVisibilityUseCase(p),
    inject: [SALES_PLATFORM_REPOSITORY_PORT],
  },
  {
    provide: ListSalesVisibilityGrantsUseCase,
    useFactory: (p) => new ListSalesVisibilityGrantsUseCase(p),
    inject: [SALES_PLATFORM_REPOSITORY_PORT],
  },
  {
    provide: AssertSalesSubjectAccessUseCase,
    useFactory: (p) => new AssertSalesSubjectAccessUseCase(p),
    inject: [SALES_PLATFORM_REPOSITORY_PORT],
  },
  {
    provide: GenerateProposalDocumentUseCase,
    useFactory: (c, p, docs, outbox) =>
      new GenerateProposalDocumentUseCase(c, p, docs, outbox),
    inject: [
      SALES_COMMERCE_REPOSITORY_PORT,
      SALES_PLATFORM_REPOSITORY_PORT,
      SALES_PROPOSAL_DOCUMENT_ADAPTER_PORT,
      ControlPlaneOutboxTransactionService,
    ],
  },
  {
    provide: SyncSalesActivityCalendarUseCase,
    useFactory: (c, p, cal) => new SyncSalesActivityCalendarUseCase(c, p, cal),
    inject: [
      SALES_COMMERCE_REPOSITORY_PORT,
      SALES_PLATFORM_REPOSITORY_PORT,
      SALES_CALENDAR_ADAPTER_PORT,
    ],
  },
  {
    provide: ValidateSolutionFitUseCase,
    useFactory: (c, outbox) => new ValidateSolutionFitUseCase(c, outbox),
    inject: [SALES_COMMERCE_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ResolveSalesIdempotencyUseCase,
    useFactory: (p) => new ResolveSalesIdempotencyUseCase(p),
    inject: [SALES_PLATFORM_REPOSITORY_PORT],
  },
  {
    provide: SUBSCRIPTION_BILLING_COORDINATION_PORT,
    useClass: UnavailableSubscriptionBillingAdapter,
  },
  {
    provide: SUBSCRIPTION_PROVISIONING_COORDINATION_PORT,
    useClass: UnavailableSubscriptionProvisioningAdapter,
  },
  {
    provide: GetSubscriptionOverviewUseCase,
    useFactory: (s) => new GetSubscriptionOverviewUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: GetSubscriptionAnalyticsUseCase,
    useFactory: (s) => new GetSubscriptionAnalyticsUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: ListSubscriptionsUseCase,
    useFactory: (s) => new ListSubscriptionsUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: GetSubscriptionUseCase,
    useFactory: (s) => new GetSubscriptionUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: GetSubscriptionWorkspaceUseCase,
    useFactory: (s) => new GetSubscriptionWorkspaceUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: GetSubscriptionHistoryUseCase,
    useFactory: (s) => new GetSubscriptionHistoryUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: CreateSubscriptionUseCase,
    useFactory: (s, outbox) => new CreateSubscriptionUseCase(s, outbox),
    inject: [SUBSCRIPTION_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: CreateSubscriptionFromHandoffUseCase,
    useFactory: (s, c, accept, outbox) =>
      new CreateSubscriptionFromHandoffUseCase(s, c, accept, outbox),
    inject: [
      SUBSCRIPTION_REPOSITORY_PORT,
      SALES_COMMERCE_REPOSITORY_PORT,
      AcceptSalesHandoffUseCase,
      ControlPlaneOutboxTransactionService,
    ],
  },
  {
    provide: SubmitSubscriptionUseCase,
    useFactory: (s, outbox) => new SubmitSubscriptionUseCase(s, outbox),
    inject: [SUBSCRIPTION_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ApproveSubscriptionUseCase,
    useFactory: (s, outbox) => new ApproveSubscriptionUseCase(s, outbox),
    inject: [SUBSCRIPTION_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: RequestActivationUseCase,
    useFactory: (s, prov, outbox) => new RequestActivationUseCase(s, prov, outbox),
    inject: [
      SUBSCRIPTION_REPOSITORY_PORT,
      SUBSCRIPTION_PROVISIONING_COORDINATION_PORT,
      ControlPlaneOutboxTransactionService,
    ],
  },
  {
    provide: ActivateSubscriptionUseCase,
    useFactory: (s, outbox) => new ActivateSubscriptionUseCase(s, outbox),
    inject: [SUBSCRIPTION_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: SuspendSubscriptionUseCase,
    useFactory: (s, outbox) => new SuspendSubscriptionUseCase(s, outbox),
    inject: [SUBSCRIPTION_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ReactivateSubscriptionUseCase,
    useFactory: (s, outbox) => new ReactivateSubscriptionUseCase(s, outbox),
    inject: [SUBSCRIPTION_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: CancelSubscriptionUseCase,
    useFactory: (s, outbox) => new CancelSubscriptionUseCase(s, outbox),
    inject: [SUBSCRIPTION_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: TerminateSubscriptionUseCase,
    useFactory: (s, outbox) => new TerminateSubscriptionUseCase(s, outbox),
    inject: [SUBSCRIPTION_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: AddSubscriptionItemUseCase,
    useFactory: (s) => new AddSubscriptionItemUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: ListSubscriptionItemsUseCase,
    useFactory: (s) => new ListSubscriptionItemsUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: CalculateAndSnapshotEntitlementsUseCase,
    useFactory: (s, outbox) => new CalculateAndSnapshotEntitlementsUseCase(s, outbox),
    inject: [SUBSCRIPTION_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ListEntitlementSnapshotsUseCase,
    useFactory: (s) => new ListEntitlementSnapshotsUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: PublishEntitlementsUseCase,
    useFactory: (s, outbox) => new PublishEntitlementsUseCase(s, outbox),
    inject: [SUBSCRIPTION_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: CreateChangeRequestUseCase,
    useFactory: (s) => new CreateChangeRequestUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: ListChangeRequestsUseCase,
    useFactory: (s) => new ListChangeRequestsUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: ExecuteChangeRequestUseCase,
    useFactory: (s, outbox) => new ExecuteChangeRequestUseCase(s, outbox),
    inject: [SUBSCRIPTION_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: RenewSubscriptionUseCase,
    useFactory: (s, outbox) => new RenewSubscriptionUseCase(s, outbox),
    inject: [SUBSCRIPTION_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ListRenewalsUseCase,
    useFactory: (s) => new ListRenewalsUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: StartTrialUseCase,
    useFactory: (s, outbox) => new StartTrialUseCase(s, outbox),
    inject: [SUBSCRIPTION_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ListTrialsUseCase,
    useFactory: (s) => new ListTrialsUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: ConvertTrialUseCase,
    useFactory: (s, outbox) => new ConvertTrialUseCase(s, outbox),
    inject: [SUBSCRIPTION_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ExpireTrialUseCase,
    useFactory: (s) => new ExpireTrialUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: RequestBillingCoordinationUseCase,
    useFactory: (s, b, outbox) => new RequestBillingCoordinationUseCase(s, b, outbox),
    inject: [
      SUBSCRIPTION_REPOSITORY_PORT,
      SUBSCRIPTION_BILLING_COORDINATION_PORT,
      ControlPlaneOutboxTransactionService,
    ],
  },
  {
    provide: ConfirmBillingCoordinationUseCase,
    useFactory: (s, outbox) => new ConfirmBillingCoordinationUseCase(s, outbox),
    inject: [SUBSCRIPTION_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: RequestProvisioningUseCase,
    useFactory: (s, p, outbox) => new RequestProvisioningUseCase(s, p, outbox),
    inject: [
      SUBSCRIPTION_REPOSITORY_PORT,
      SUBSCRIPTION_PROVISIONING_COORDINATION_PORT,
      ControlPlaneOutboxTransactionService,
    ],
  },
  {
    provide: CompleteProvisioningUseCase,
    useFactory: (s, outbox) => new CompleteProvisioningUseCase(s, outbox),
    inject: [SUBSCRIPTION_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ResolveSubscriptionIdempotencyUseCase,
    useFactory: (s) => new ResolveSubscriptionIdempotencyUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: UpdateSubscriptionUseCase,
    useFactory: (s) => new UpdateSubscriptionUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: ApproveChangeRequestUseCase,
    useFactory: (s, outbox) => new ApproveChangeRequestUseCase(s, outbox),
    inject: [SUBSCRIPTION_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: RejectChangeRequestUseCase,
    useFactory: (s) => new RejectChangeRequestUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: ScheduleChangeUseCase,
    useFactory: (s) => new ScheduleChangeUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: ProposeRenewalUseCase,
    useFactory: (s) => new ProposeRenewalUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: ReconcileEntitlementsUseCase,
    useFactory: (s, outbox) => new ReconcileEntitlementsUseCase(s, outbox),
    inject: [SUBSCRIPTION_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ListPoliciesUseCase,
    useFactory: (s) => new ListPoliciesUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: UpsertPolicyUseCase,
    useFactory: (s) => new UpsertPolicyUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: GetCoordinationUseCase,
    useFactory: (s) => new GetCoordinationUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: ListPendingApprovalsUseCase,
    useFactory: (s) => new ListPendingApprovalsUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: ListSubscriptionPublicationsUseCase,
    useFactory: (s) => new ListSubscriptionPublicationsUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: ListSubscriptionSuspensionsUseCase,
    useFactory: (s) => new ListSubscriptionSuspensionsUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: ListSubscriptionCancellationsUseCase,
    useFactory: (s) => new ListSubscriptionCancellationsUseCase(s),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: ProcessDueScheduledChangesUseCase,
    useFactory: (s, exec) => new ProcessDueScheduledChangesUseCase(s, exec),
    inject: [SUBSCRIPTION_REPOSITORY_PORT, ExecuteChangeRequestUseCase],
  },
  UnavailablePaymentProviderAdapter,
  HttpWebhookPaymentProviderAdapter,
  ResolvingPaymentProviderAdapter,
  {
    provide: PAYMENT_PROVIDER_PORT,
    useClass: ResolvingPaymentProviderAdapter,
  },
  {
    provide: CreateBillingAccountUseCase,
    useFactory: (b, outbox) => new CreateBillingAccountUseCase(b, outbox),
    inject: [BILLING_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: ListBillingAccountsUseCase,
    useFactory: (b) => new ListBillingAccountsUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: GetBillingAccountUseCase,
    useFactory: (b) => new GetBillingAccountUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: UpsertBillingProfileUseCase,
    useFactory: (b) => new UpsertBillingProfileUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: LinkSubscriptionToBillingAccountUseCase,
    useFactory: (b) => new LinkSubscriptionToBillingAccountUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: CreateBillingScheduleUseCase,
    useFactory: (b) => new CreateBillingScheduleUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: PreviewInvoiceUseCase,
    useFactory: (b) => new PreviewInvoiceUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: CreateDraftInvoiceFromSubscriptionUseCase,
    useFactory: (b, s) => new CreateDraftInvoiceFromSubscriptionUseCase(b, s),
    inject: [BILLING_REPOSITORY_PORT, SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: ApproveInvoiceUseCase,
    useFactory: (b) => new ApproveInvoiceUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: IssueInvoiceUseCase,
    useFactory: (b, outbox) => new IssueInvoiceUseCase(b, outbox),
    inject: [BILLING_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: VoidInvoiceUseCase,
    useFactory: (b) => new VoidInvoiceUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: CreatePaymentIntentUseCase,
    useFactory: (b, p) => new CreatePaymentIntentUseCase(b, p),
    inject: [BILLING_REPOSITORY_PORT, PAYMENT_PROVIDER_PORT],
  },
  {
    provide: ConfirmPaymentIntentUseCase,
    useFactory: (b, p, outbox) => new ConfirmPaymentIntentUseCase(b, p, outbox),
    inject: [BILLING_REPOSITORY_PORT, PAYMENT_PROVIDER_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: AllocatePaymentUseCase,
    useFactory: (b) => new AllocatePaymentUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: MarkInvoicePaidIfSettledUseCase,
    useFactory: (b, outbox, confirm) =>
      new MarkInvoicePaidIfSettledUseCase(b, outbox, confirm),
    inject: [
      BILLING_REPOSITORY_PORT,
      ControlPlaneOutboxTransactionService,
      ConfirmBillingCoordinationUseCase,
    ],
  },
  {
    provide: CreateRefundUseCase,
    useFactory: (b) => new CreateRefundUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ApproveRefundUseCase,
    useFactory: (b, p, outbox) => new ApproveRefundUseCase(b, p, outbox),
    inject: [BILLING_REPOSITORY_PORT, PAYMENT_PROVIDER_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: OpenCollectionCaseUseCase,
    useFactory: (b, outbox) => new OpenCollectionCaseUseCase(b, outbox),
    inject: [BILLING_REPOSITORY_PORT, ControlPlaneOutboxTransactionService],
  },
  {
    provide: RecordDunningAttemptUseCase,
    useFactory: (b) => new RecordDunningAttemptUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: AppendJournalEntryUseCase,
    useFactory: (b) => new AppendJournalEntryUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ListInvoicesUseCase,
    useFactory: (b) => new ListInvoicesUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: GetInvoiceUseCase,
    useFactory: (b) => new GetInvoiceUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: GetBillingOverviewUseCase,
    useFactory: (b) => new GetBillingOverviewUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: GetBillingAnalyticsUseCase,
    useFactory: (b) => new GetBillingAnalyticsUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ProcessPaymentWebhookUseCase,
    useFactory: (b, confirm, outbox) => new ProcessPaymentWebhookUseCase(b, confirm, outbox),
    inject: [BILLING_REPOSITORY_PORT, ConfirmPaymentIntentUseCase, ControlPlaneOutboxTransactionService],
  },
  {
    provide: IngestSubscriptionBillingCoordinationUseCase,
    useFactory: (b, s) => new IngestSubscriptionBillingCoordinationUseCase(b, s),
    inject: [BILLING_REPOSITORY_PORT, SUBSCRIPTION_REPOSITORY_PORT],
  },
  {
    provide: GetBillingProfileUseCase,
    useFactory: (b) => new GetBillingProfileUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ListBillingProfilesUseCase,
    useFactory: (b) => new ListBillingProfilesUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: UpsertBillingPartyUseCase,
    useFactory: (b) => new UpsertBillingPartyUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ListBillingPartiesUseCase,
    useFactory: (b) => new ListBillingPartiesUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ListBillingSchedulesUseCase,
    useFactory: (b) => new ListBillingSchedulesUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ApplyTaxToInvoiceUseCase,
    useFactory: (b) => new ApplyTaxToInvoiceUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ListTaxJurisdictionsUseCase,
    useFactory: (b) => new ListTaxJurisdictionsUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: CreateCreditNoteUseCase,
    useFactory: (b) => new CreateCreditNoteUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ListCreditNotesUseCase,
    useFactory: (b) => new ListCreditNotesUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ListCollectionCasesUseCase,
    useFactory: (b) => new ListCollectionCasesUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: GetCollectionCaseUseCase,
    useFactory: (b) => new GetCollectionCaseUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: EscalateCollectionCaseUseCase,
    useFactory: (b) => new EscalateCollectionCaseUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ResolveCollectionCaseUseCase,
    useFactory: (b) => new ResolveCollectionCaseUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ListBillingPoliciesUseCase,
    useFactory: (b) => new ListBillingPoliciesUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: UpsertBillingPolicyUseCase,
    useFactory: (b) => new UpsertBillingPolicyUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ListPaymentMethodsUseCase,
    useFactory: (b) => new ListPaymentMethodsUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: RegisterPaymentMethodUseCase,
    useFactory: (b) => new RegisterPaymentMethodUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: RevokePaymentMethodUseCase,
    useFactory: (b) => new RevokePaymentMethodUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: RunReconciliationUseCase,
    useFactory: (b) => new RunReconciliationUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ListReconciliationRunsUseCase,
    useFactory: (b) => new ListReconciliationRunsUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ListReconciliationExceptionsUseCase,
    useFactory: (b) => new ListReconciliationExceptionsUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ResolveReconciliationExceptionUseCase,
    useFactory: (b) => new ResolveReconciliationExceptionUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: IngestProviderTransactionUseCase,
    useFactory: (b) => new IngestProviderTransactionUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: CreateSettlementBatchUseCase,
    useFactory: (b) => new CreateSettlementBatchUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ListSettlementBatchesUseCase,
    useFactory: (b) => new ListSettlementBatchesUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: CreateDisputeUseCase,
    useFactory: (b) => new CreateDisputeUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ListDisputesUseCase,
    useFactory: (b) => new ListDisputesUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ResolveDisputeUseCase,
    useFactory: (b) => new ResolveDisputeUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ListFxRatesUseCase,
    useFactory: (b) => new ListFxRatesUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: CreateFxRateUseCase,
    useFactory: (b) => new CreateFxRateUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ConvertAmountUseCase,
    useFactory: (b) => new ConvertAmountUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ListPaymentIntentsUseCase,
    useFactory: (b) => new ListPaymentIntentsUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ListRefundsUseCase,
    useFactory: (b) => new ListRefundsUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ListJournalEntriesUseCase,
    useFactory: (b) => new ListJournalEntriesUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ProcessDueBillingSchedulesUseCase,
    useFactory: (b, draft) => new ProcessDueBillingSchedulesUseCase(b, draft),
    inject: [BILLING_REPOSITORY_PORT, CreateDraftInvoiceFromSubscriptionUseCase],
  },
  {
    provide: MarkOverdueInvoicesUseCase,
    useFactory: (b) => new MarkOverdueInvoicesUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: GetCustomerBillingPortalUseCase,
    useFactory: (b) => new GetCustomerBillingPortalUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: GenerateFinancialExportUseCase,
    useFactory: (b) => new GenerateFinancialExportUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ListFinancialExportsUseCase,
    useFactory: (b) => new ListFinancialExportsUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: GetFinancialExportUseCase,
    useFactory: (b) => new GetFinancialExportUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: ListRevenuePoliciesUseCase,
    useFactory: (b) => new ListRevenuePoliciesUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
  {
    provide: UpsertRevenuePolicyUseCase,
    useFactory: (b) => new UpsertRevenuePolicyUseCase(b),
    inject: [BILLING_REPOSITORY_PORT],
  },
];
