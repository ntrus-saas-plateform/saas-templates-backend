import { Module } from '@nestjs/common';
import { MessagingModule } from '../../shared/messaging/messaging.module.js';
import { EXTRA_INTEGRATION_EVENT_HANDLERS } from '../../core/domain/ports/integration-event-handler.port.js';
import { EdgePersistenceModule } from './infrastructure/persistence/edge-persistence.module.js';
import { edgeApplicationProviders } from './infrastructure/edge-application.providers.js';
import { MarketingLeadQualifiedSalesHandler } from './infrastructure/sales/marketing-lead-qualified.handler.js';
import { SalesHandoffRequestedHandler } from './infrastructure/subscription/sales-handoff-requested.handler.js';
import { BillingCoordinationRequestedHandler } from './infrastructure/billing/billing-coordination-requested.handler.js';
import { BillingJobsBootstrap } from './infrastructure/billing/billing-jobs.bootstrap.js';
import { ReceiveSalesLeadUseCase } from './application/sales/sales.use-cases.js';
import {
  EdgeAdministratorsController,
  EdgeInvitationsController,
} from './presentation/controllers/administrators.controller.js';
import {
  EdgeMembershipsController,
  EdgeVerticalsController,
} from './presentation/controllers/verticals.controller.js';
import { EdgeAuthorizationController } from './presentation/controllers/authorization.controller.js';
import { EdgeWorkspacesController } from './presentation/controllers/workspaces.controller.js';
import { EdgeSecurityController } from './presentation/controllers/security.controller.js';
import { EdgeProductsController } from './presentation/controllers/products.controller.js';
import {
  EdgeBackendsController,
  EdgeBusinessProfilesController,
  EdgeCapabilitiesController,
  EdgeIntegrationContractsController,
  EdgeMarketSegmentsController,
  EdgeOperatingModelsController,
  EdgeReadinessEvaluationsController,
} from './presentation/controllers/catalog.controller.js';
import { EdgeCommercialController } from './presentation/controllers/commercial.controller.js';
import { EdgeMarketingController } from './presentation/controllers/marketing.controller.js';
import { EdgeSalesController } from './presentation/controllers/sales.controller.js';
import { EdgeSalesPlatformController } from './presentation/controllers/sales-platform.controller.js';
import { EdgeSubscriptionController } from './presentation/controllers/subscription.controller.js';
import { EdgeBillingController } from './presentation/controllers/billing.controller.js';
import { EdgeProvisioningController } from './presentation/controllers/provisioning.controller.js';
import { EdgeP5ProvisioningIntegrationController } from './presentation/controllers/p5-provisioning-integration.controller.js';
import { EdgeRegistryController } from './presentation/controllers/registry.controller.js';
import {
  EdgeCapacityController,
  EdgePlacementController,
} from './presentation/controllers/placement.controller.js';

/**
 * Okapi Edge Admin bounded context — Hexagonal / DDD layout:
 * - domain/          entities, ports, lifecycle rules
 * - application/     use cases
 * - infrastructure/  DI providers + CP persistence
 * - presentation/    /api/v1/edge/** controllers
 */
@Module({
  imports: [EdgePersistenceModule, MessagingModule],
  controllers: [
    EdgeAdministratorsController,
    EdgeInvitationsController,
    EdgeVerticalsController,
    EdgeMembershipsController,
    EdgeAuthorizationController,
    EdgeWorkspacesController,
    EdgeSecurityController,
    EdgeProductsController,
    EdgeMarketSegmentsController,
    EdgeBusinessProfilesController,
    EdgeOperatingModelsController,
    EdgeCapabilitiesController,
    EdgeBackendsController,
    EdgeIntegrationContractsController,
    EdgeReadinessEvaluationsController,
    EdgeCommercialController,
    EdgeMarketingController,
    EdgeSalesController,
    EdgeSalesPlatformController,
    EdgeSubscriptionController,
    EdgeBillingController,
    EdgeProvisioningController,
    EdgeP5ProvisioningIntegrationController,
    EdgeRegistryController,
    EdgePlacementController,
    EdgeCapacityController,
  ],
  providers: [
    ...edgeApplicationProviders,
    MarketingLeadQualifiedSalesHandler,
    SalesHandoffRequestedHandler,
    BillingCoordinationRequestedHandler,
    BillingJobsBootstrap,
    {
      provide: EXTRA_INTEGRATION_EVENT_HANDLERS,
      useFactory: (
        marketing: MarketingLeadQualifiedSalesHandler,
        handoff: SalesHandoffRequestedHandler,
        billingCoordination: BillingCoordinationRequestedHandler,
      ) => [marketing, handoff, billingCoordination],
      inject: [
        MarketingLeadQualifiedSalesHandler,
        SalesHandoffRequestedHandler,
        BillingCoordinationRequestedHandler,
      ],
    },
  ],
  exports: [
    EdgePersistenceModule,
    EXTRA_INTEGRATION_EVENT_HANDLERS,
    ReceiveSalesLeadUseCase,
    MarketingLeadQualifiedSalesHandler,
    SalesHandoffRequestedHandler,
    BillingCoordinationRequestedHandler,
  ],
})
export class EdgeModule {}
