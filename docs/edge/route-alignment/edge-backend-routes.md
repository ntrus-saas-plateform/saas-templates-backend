# Edge Backend — Inventaire complet des routes

> Généré par `saas-templates-backend/scripts/extract-edge-routes.py`.
>
> **Runtime Nest :** `setGlobalPrefix('api')` + URI versioning `v1`
> → chemin effectif = `/api/v1` + `@Controller` + `@Method`.
>
> Exemple : `@Controller('edge/sales')` + `@Get('opportunities')`
> → `GET /api/v1/edge/sales/opportunities`.

**Total handlers HTTP :** 927
**Fichiers contrôleurs :** 39
**Classes contrôleurs :** 49

## Index des fichiers

| Fichier | Premier `@Controller` | #routes |
|---|---|---:|
| `acquisition-public.controller.ts` | `(paths on methods)` | 12 |
| `acquisition.controller.ts` | `(paths on methods)` | 53 |
| `activation.controller.ts` | `(paths on methods)` | 11 |
| `administrators.controller.ts` | `edge/administrators` | 11 |
| `authorization.controller.ts` | `edge` | 6 |
| `billing.controller.ts` | `edge/billing` | 70 |
| `catalog.controller.ts` | `edge/market-segments` | 21 |
| `certification.controller.ts` | `(paths on methods)` | 11 |
| `commercial.controller.ts` | `edge/commercial` | 64 |
| `configuration.controller.ts` | `(paths on methods)` | 20 |
| `connectivity-agent.controller.ts` | `(paths on methods)` | 9 |
| `customer-success.controller.ts` | `edge/cs` | 6 |
| `experience.controller.ts` | `(paths on methods)` | 17 |
| `infrastructure.controller.ts` | `(paths on methods)` | 17 |
| `keycloak.controller.ts` | `(paths on methods)` | 16 |
| `lifecycle.controller.ts` | `(paths on methods)` | 8 |
| `live-complete.controller.ts` | `(paths on methods)` | 1 |
| `marketing.controller.ts` | `edge/marketing` | 52 |
| `onboarding.controller.ts` | `(paths on methods)` | 13 |
| `p5-provisioning-integration.controller.ts` | `edge/integrations/p5/provisioning` | 1 |
| `partner-opportunity.controller.ts` | `edge/partners/opportunities` | 3 |
| `placement.controller.ts` | `edge/placement` | 20 |
| `platform-operations.controller.ts` | `(paths on methods)` | 70 |
| `product-control.controller.ts` | `edge/product-controls` | 19 |
| `products.controller.ts` | `edge/products` | 18 |
| `provisioning-jobs.controller.ts` | `edge/provisioning-jobs` | 2 |
| `provisioning.controller.ts` | `edge/provisioning-requests` | 7 |
| `reconciliation.controller.ts` | `(paths on methods)` | 15 |
| `registry.controller.ts` | `edge/registry` | 33 |
| `revenue-operations.controller.ts` | `(paths on methods)` | 35 |
| `sales-platform.controller.ts` | `edge/sales` | 25 |
| `sales.controller.ts` | `edge/sales` | 75 |
| `security.controller.ts` | `edge/security` | 11 |
| `subscription.controller.ts` | `edge/subscriptions` | 55 |
| `tenant-management.controller.ts` | `(paths on methods)` | 53 |
| `verticals.controller.ts` | `edge/verticals` | 25 |
| `workflow-worker.controller.ts` | `edge/workflow-workers` | 6 |
| `workflow.controller.ts` | `edge/workflows` | 29 |
| `workspaces.controller.ts` | `edge/workspaces` | 7 |

## Index des classes (multi-controller)

| Classe | Controller path | #routes | Fichier |
|---|---|---:|---|
| `AcquisitionPublicController` | `(empty — full path on method)` | 12 | `acquisition-public.controller.ts` |
| `AcquisitionController` | `(empty — full path on method)` | 53 | `acquisition.controller.ts` |
| `EdgeActivationController` | `(empty — full path on method)` | 11 | `activation.controller.ts` |
| `EdgeAdministratorsController` | `edge/administrators` | 10 | `administrators.controller.ts` |
| `EdgeInvitationsController` | `edge/invitations` | 1 | `administrators.controller.ts` |
| `EdgeAuthorizationController` | `edge` | 6 | `authorization.controller.ts` |
| `EdgeBillingController` | `edge/billing` | 70 | `billing.controller.ts` |
| `EdgeBackendsController` | `edge/backends` | 3 | `catalog.controller.ts` |
| `EdgeBusinessProfilesController` | `edge/business-profiles` | 3 | `catalog.controller.ts` |
| `EdgeCapabilitiesController` | `edge/capabilities` | 4 | `catalog.controller.ts` |
| `EdgeIntegrationContractsController` | `edge/integration-contracts` | 3 | `catalog.controller.ts` |
| `EdgeMarketSegmentsController` | `edge/market-segments` | 4 | `catalog.controller.ts` |
| `EdgeOperatingModelsController` | `edge/operating-models` | 3 | `catalog.controller.ts` |
| `EdgeReadinessEvaluationsController` | `edge/readiness-evaluations` | 1 | `catalog.controller.ts` |
| `EdgeCertificationController` | `(empty — full path on method)` | 11 | `certification.controller.ts` |
| `EdgeCommercialController` | `edge/commercial` | 64 | `commercial.controller.ts` |
| `EdgeConfigurationController` | `(empty — full path on method)` | 20 | `configuration.controller.ts` |
| `EdgeConnectivityAgentController` | `(empty — full path on method)` | 9 | `connectivity-agent.controller.ts` |
| `EdgeCustomerSuccessController` | `edge/cs` | 6 | `customer-success.controller.ts` |
| `EdgeExperienceController` | `(empty — full path on method)` | 17 | `experience.controller.ts` |
| `EdgeInfrastructureController` | `(empty — full path on method)` | 17 | `infrastructure.controller.ts` |
| `EdgeKeycloakController` | `(empty — full path on method)` | 16 | `keycloak.controller.ts` |
| `EdgeLifecycleController` | `(empty — full path on method)` | 8 | `lifecycle.controller.ts` |
| `EdgeLiveCompleteController` | `(empty — full path on method)` | 1 | `live-complete.controller.ts` |
| `EdgeMarketingController` | `edge/marketing` | 52 | `marketing.controller.ts` |
| `EdgeOnboardingController` | `(empty — full path on method)` | 13 | `onboarding.controller.ts` |
| `EdgeP5ProvisioningIntegrationController` | `edge/integrations/p5/provisioning` | 1 | `p5-provisioning-integration.controller.ts` |
| `EdgePartnerOpportunityController` | `edge/partners/opportunities` | 3 | `partner-opportunity.controller.ts` |
| `EdgeCapacityController` | `edge/capacity` | 7 | `placement.controller.ts` |
| `EdgePlacementController` | `edge/placement` | 13 | `placement.controller.ts` |
| `EdgePlatformOperationsController` | `(empty — full path on method)` | 70 | `platform-operations.controller.ts` |
| `EdgeProductControlController` | `edge/product-controls` | 19 | `product-control.controller.ts` |
| `EdgeProductsController` | `edge/products` | 18 | `products.controller.ts` |
| `EdgeProvisioningJobsController` | `edge/provisioning-jobs` | 2 | `provisioning-jobs.controller.ts` |
| `EdgeProvisioningController` | `edge/provisioning-requests` | 7 | `provisioning.controller.ts` |
| `EdgeReconciliationController` | `(empty — full path on method)` | 15 | `reconciliation.controller.ts` |
| `EdgeRegistryController` | `edge/registry` | 33 | `registry.controller.ts` |
| `EdgeRevenueOperationsController` | `(empty — full path on method)` | 35 | `revenue-operations.controller.ts` |
| `EdgeSalesPlatformController` | `edge/sales` | 25 | `sales-platform.controller.ts` |
| `EdgeSalesController` | `edge/sales` | 75 | `sales.controller.ts` |
| `EdgeSecurityController` | `edge/security` | 11 | `security.controller.ts` |
| `EdgeSubscriptionController` | `edge/subscriptions` | 55 | `subscription.controller.ts` |
| `EdgeTenantManagementController` | `(empty — full path on method)` | 53 | `tenant-management.controller.ts` |
| `EdgeMembershipsController` | `edge/memberships` | 4 | `verticals.controller.ts` |
| `EdgeVerticalsController` | `edge/verticals` | 21 | `verticals.controller.ts` |
| `EdgeWorkflowWorkerController` | `edge/workflow-workers` | 6 | `workflow-worker.controller.ts` |
| `EdgeWorkflowController` | `edge/workflows` | 23 | `workflow.controller.ts` |
| `EdgeWorkflowTasksController` | `edge/workflow-tasks` | 6 | `workflow.controller.ts` |
| `EdgeWorkspacesController` | `edge/workspaces` | 7 | `workspaces.controller.ts` |

## Routes détaillées par fichier

### `acquisition-public.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/acquisition/public/products` | `publicProducts` | `AcquisitionPublicController` |
| `GET` | `/api/v1/edge/acquisition/public/products/:slug` | `publicProductBySlug` | `AcquisitionPublicController` |
| `GET` | `/api/v1/edge/acquisition/public/plans` | `publicPlans` | `AcquisitionPublicController` |
| `GET` | `/api/v1/edge/acquisition/public/segments` | `publicSegments` | `AcquisitionPublicController` |
| `GET` | `/api/v1/edge/acquisition/public/catalog` | `publicCatalog` | `AcquisitionPublicController` |
| `GET` | `/api/v1/edge/acquisition/public/forms/:publicSlug` | `publicForm` | `AcquisitionPublicController` |
| `GET` | `/api/v1/edge/acquisition/public/checkout/:id` | `publicCheckout` | `AcquisitionPublicController` |
| `POST` | `/api/v1/edge/acquisition/public/checkout` | `publicCreateCheckoutSession` | `AcquisitionPublicController` |
| `POST` | `/api/v1/edge/acquisition/public/applications` | `submit` | `AcquisitionPublicController` |
| `GET` | `/api/v1/edge/acquisition/public/challenge` | `publicChallenge` | `AcquisitionPublicController` |
| `POST` | `/api/v1/edge/acquisition/public/leads` | `publicCaptureLead` | `AcquisitionPublicController` |
| `POST` | `/api/v1/edge/acquisition/public/analytics/events` | `publicAnalytics` | `AcquisitionPublicController` |

### `acquisition.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/acquisition/overview` | `acquisitionOverview` | `AcquisitionController` |
| `GET` | `/api/v1/edge/acquisition/products` | `getProducts` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/products` | `postProduct` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/products/:id/content` | `postProductContent` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/products/:id/content/:versionId/publish` | `postPublishProductContent` | `AcquisitionController` |
| `GET` | `/api/v1/edge/acquisition/plans` | `getPlans` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/plans` | `postPlan` | `AcquisitionController` |
| `GET` | `/api/v1/edge/acquisition/segments` | `getSegments` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/segments` | `postSegment` | `AcquisitionController` |
| `GET` | `/api/v1/edge/acquisition/prospects` | `getProspects` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/prospects` | `postProspect` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/prospects/:id/transition` | `postProspectTransition` | `AcquisitionController` |
| `GET` | `/api/v1/edge/acquisition/leads` | `getLeads` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/leads` | `postLead` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/leads/:id/promote` | `postPromoteLead` | `AcquisitionController` |
| `GET` | `/api/v1/edge/acquisition/forms` | `getForms` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/forms` | `postForm` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/forms/from-contract` | `template` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/forms/:id/versions` | `postFormVersion` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/forms/versions/:versionId/publish` | `postPublishFormVersion` | `AcquisitionController` |
| `GET` | `/api/v1/edge/acquisition/applications` | `getApplications` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/applications` | `postApplication` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/applications/:id/answers` | `postApplicationAnswers` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/applications/:id/submit` | `postSubmitApplication` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/applications/:id/transition` | `postApplicationTransition` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/applications/:id/request-information` | `postRequestInformation` | `AcquisitionController` |
| `GET` | `/api/v1/edge/acquisition/documents` | `getDocuments` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/documents` | `postDocument` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/documents/:id/review` | `postDocumentReview` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/document-requirements` | `postDocumentRequirement` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/qualification/start` | `postStartQualification` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/qualification/:id/decide` | `postDecideQualification` | `AcquisitionController` |
| `GET` | `/api/v1/edge/acquisition/quotations` | `getQuotations` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/quotations` | `postQuotation` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/quotations/:id/references` | `postQuoteReference` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/quotations/:id/accept` | `postAcceptQuote` | `AcquisitionController` |
| `GET` | `/api/v1/edge/acquisition/checkout` | `getCheckouts` | `AcquisitionController` |
| `GET` | `/api/v1/edge/acquisition/checkout/:id` | `getCheckoutById` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/checkout` | `postCheckout` | `AcquisitionController` |
| `GET` | `/api/v1/edge/acquisition/handoffs` | `getHandoffs` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/checkout/:id/payment-reference` | `postPaymentReference` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/checkout/:id/initiate-payment` | `reference` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/checkout/:id/payment-result` | `postPaymentResult` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/checkout/revalidate-plan` | `postRevalidatePlan` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/handoffs` | `postHandoff` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/handoffs/:id/complete` | `postCompleteHandoff` | `AcquisitionController` |
| `GET` | `/api/v1/edge/acquisition/journeys/:applicationId` | `getJourney` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/journeys/:id/advance` | `postAdvanceJourney` | `AcquisitionController` |
| `GET` | `/api/v1/edge/acquisition/customer-portal/:prospectId` | `getCustomerPortal` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/communications` | `postCommunication` | `AcquisitionController` |
| `PATCH` | `/api/v1/edge/acquisition/communications/:id/status` | `patchCommunicationStatus` | `AcquisitionController` |
| `POST` | `/api/v1/edge/acquisition/analytics/events` | `postAnalyticsEvent` | `AcquisitionController` |
| `GET` | `/api/v1/edge/acquisition/analytics/funnel` | `getFunnel` | `AcquisitionController` |

### `activation.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/activation/evaluations` | `listEvaluations` | `EdgeActivationController` |
| `GET` | `/api/v1/edge/activation/evaluations/:id` | `getEvaluation` | `EdgeActivationController` |
| `POST` | `/api/v1/edge/activation/evaluations` | `evaluation` | `EdgeActivationController` |
| `POST` | `/api/v1/edge/activation/evaluations/:id/evaluate` | `evaluateEndpoint` | `EdgeActivationController` |
| `GET` | `/api/v1/edge/activation/records` | `listRecords` | `EdgeActivationController` |
| `GET` | `/api/v1/edge/activation/records/:id` | `getRecord` | `EdgeActivationController` |
| `POST` | `/api/v1/edge/activation/records` | `authorization` | `EdgeActivationController` |
| `POST` | `/api/v1/edge/activation/records/:id/evaluate` | `evaluateRecordEndpoint` | `EdgeActivationController` |
| `POST` | `/api/v1/edge/activation/records/:id/activate` | `activateEndpoint` | `EdgeActivationController` |
| `GET` | `/api/v1/edge/activation/records/:id/runs` | `listRuns` | `EdgeActivationController` |
| `GET` | `/api/v1/edge/activation/records/:id/evidence` | `listEvidence` | `EdgeActivationController` |

### `administrators.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/administrators/me` | `me` | `EdgeAdministratorsController` |
| `GET` | `/api/v1/edge/administrators` | `listAdministrators` | `EdgeAdministratorsController` |
| `POST` | `/api/v1/edge/administrators/invite` | `inviteAdministrator` | `EdgeAdministratorsController` |
| `GET` | `/api/v1/edge/administrators/:id` | `getAdministrator` | `EdgeAdministratorsController` |
| `PATCH` | `/api/v1/edge/administrators/:id` | `patchAdministrator` | `EdgeAdministratorsController` |
| `POST` | `/api/v1/edge/administrators/:id/suspend` | `suspendAdministrator` | `EdgeAdministratorsController` |
| `POST` | `/api/v1/edge/administrators/:id/reinstate` | `reinstateAdministrator` | `EdgeAdministratorsController` |
| `POST` | `/api/v1/edge/administrators/:id/deactivate` | `deactivateAdministrator` | `EdgeAdministratorsController` |
| `GET` | `/api/v1/edge/administrators/:id/memberships` | `memberships` | `EdgeAdministratorsController` |
| `GET` | `/api/v1/edge/administrators/:id/effective-permissions` | `effectivePermissions` | `EdgeAdministratorsController` |
| `POST` | `/api/v1/edge/invitations/accept` | `accept` | `EdgeInvitationsController` |

### `authorization.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/roles` | `roles` | `EdgeAuthorizationController` |
| `POST` | `/api/v1/edge/roles` | `create` | `EdgeAuthorizationController` |
| `PATCH` | `/api/v1/edge/roles/:id` | `update` | `EdgeAuthorizationController` |
| `GET` | `/api/v1/edge/permissions` | `permissions` | `EdgeAuthorizationController` |
| `POST` | `/api/v1/edge/role-assignments` | `assign` | `EdgeAuthorizationController` |
| `DELETE` | `/api/v1/edge/role-assignments/:id` | `revoke` | `EdgeAuthorizationController` |

### `billing.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/billing/overview` | `getOverview` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/analytics` | `getAnalytics` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/cash-truth` | `getCashTruthHandler` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/accounts` | `listAccounts` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/accounts/:id` | `getAccountById` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/accounts` | `createAccountHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/accounts/:id/subscriptions` | `linkSubscriptionHandler` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/accounts/:id/profiles` | `listAccountProfiles` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/accounts/:id/profiles/current` | `getCurrentProfile` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/accounts/:id/profiles` | `upsertAccountProfile` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/accounts/:id/parties` | `listAccountParties` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/accounts/:id/parties` | `upsertAccountParty` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/geo-payment-methods` | `listGeoPaymentMethodsHandler` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/accounts/:id/payment-methods` | `listAccountPaymentMethods` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/accounts/:id/payment-methods` | `registerAccountPaymentMethod` | `EdgeBillingController` |
| `DELETE` | `/api/v1/edge/billing/accounts/:id/payment-methods/:methodId` | `revokeAccountPaymentMethod` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/accounts/:id/journal` | `listAccountJournal` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/schedules` | `createScheduleHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/cadence` | `configureCadenceHandler` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/schedules` | `listSchedulesHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/invoices/preview` | `preview` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/invoices` | `listInvoices` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/invoices/:id` | `getInvoice` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/invoices/draft-from-subscription` | `draftFromSubscription` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/invoices/:id/approve` | `approve` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/invoices/:id/issue` | `issue` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/invoices/:id/void` | `voidInvoiceHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/invoices/:id/apply-tax` | `applyTaxHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/invoices/:id/credit-notes` | `createCreditNoteHandler` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/credit-notes` | `listCreditNotesHandler` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/tax/jurisdictions` | `taxJurisdictions` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/payments` | `listPayments` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/payments/intents` | `createIntent` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/payments/intents/:id/confirm` | `confirmIntent` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/refunds` | `createRefundHandler` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/refunds` | `listRefundsHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/refunds/:id/approve` | `approveRefundHandler` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/collections` | `listCollectionsHandler` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/collections/:id` | `getCollectionHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/collections` | `openCollectionHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/collections/dunning-scan` | `dunningScanHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/collections/:id/escalate` | `escalateCollectionHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/collections/:id/resolve` | `resolveCollectionHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/collections/:id/dunning` | `recordDunningHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/collections/:id/apply-policy` | `applyDunningPolicyHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/collections/:id/notify` | `dispatchDunningNotifyHandler` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/policies` | `listPoliciesHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/policies` | `upsertPolicyHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/reconciliation/runs` | `runReconciliationHandler` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/reconciliation/runs` | `listReconRunsHandler` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/reconciliation/exceptions` | `listReconExceptionsHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/reconciliation/exceptions/:id/resolve` | `resolveReconExceptionHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/provider-transactions` | `ingestProviderTxnHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/settlements` | `createSettlementHandler` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/settlements` | `listSettlementsHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/disputes` | `createDisputeHandler` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/disputes` | `listDisputesHandler` | `EdgeBillingController` |
| `PATCH` | `/api/v1/edge/billing/disputes/:id` | `resolveDisputeHandler` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/fx/rates` | `listFxHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/fx/rates` | `createFxHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/fx/convert` | `convertFxHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/schedules/process-due` | `processDueSchedulesHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/invoices/mark-overdue` | `markOverdueHandler` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/portal/:billingAccountId` | `customerPortalHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/exports` | `generateExportHandler` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/exports` | `listExportsHandler` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/exports/:id` | `getExportHandler` | `EdgeBillingController` |
| `GET` | `/api/v1/edge/billing/revenue-policies` | `listRevenuePoliciesHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/revenue-policies` | `upsertRevenuePolicyHandler` | `EdgeBillingController` |
| `POST` | `/api/v1/edge/billing/webhooks/payments` | `processPaymentWebhook` | `EdgeBillingController` |

### `catalog.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/market-segments` | `list` | `EdgeMarketSegmentsController` |
| `POST` | `/api/v1/edge/market-segments` | `createSegment` | `EdgeMarketSegmentsController` |
| `GET` | `/api/v1/edge/market-segments/:id` | `getSegment` | `EdgeMarketSegmentsController` |
| `PATCH` | `/api/v1/edge/market-segments/:id` | `patchSegment` | `EdgeMarketSegmentsController` |
| `GET` | `/api/v1/edge/business-profiles` | `listProfiles` | `EdgeBusinessProfilesController` |
| `POST` | `/api/v1/edge/business-profiles` | `createProfile` | `EdgeBusinessProfilesController` |
| `GET` | `/api/v1/edge/business-profiles/:id` | `getProfile` | `EdgeBusinessProfilesController` |
| `GET` | `/api/v1/edge/operating-models` | `listModels` | `EdgeOperatingModelsController` |
| `POST` | `/api/v1/edge/operating-models` | `createModel` | `EdgeOperatingModelsController` |
| `GET` | `/api/v1/edge/operating-models/:id` | `getModel` | `EdgeOperatingModelsController` |
| `GET` | `/api/v1/edge/capabilities` | `listCapabilities` | `EdgeCapabilitiesController` |
| `POST` | `/api/v1/edge/capabilities` | `createCapability` | `EdgeCapabilitiesController` |
| `GET` | `/api/v1/edge/capabilities/:id` | `getCapability` | `EdgeCapabilitiesController` |
| `POST` | `/api/v1/edge/capabilities/:id/dependencies` | `createDependency` | `EdgeCapabilitiesController` |
| `GET` | `/api/v1/edge/backends` | `listBackends` | `EdgeBackendsController` |
| `POST` | `/api/v1/edge/backends` | `createBackend` | `EdgeBackendsController` |
| `GET` | `/api/v1/edge/backends/:id` | `getBackend` | `EdgeBackendsController` |
| `GET` | `/api/v1/edge/integration-contracts` | `listContracts` | `EdgeIntegrationContractsController` |
| `POST` | `/api/v1/edge/integration-contracts` | `createContract` | `EdgeIntegrationContractsController` |
| `GET` | `/api/v1/edge/integration-contracts/:id` | `getContract` | `EdgeIntegrationContractsController` |
| `GET` | `/api/v1/edge/readiness-evaluations` | `listEvaluations` | `EdgeReadinessEvaluationsController` |

### `certification.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/certification/packages` | `listPackages` | `EdgeCertificationController` |
| `GET` | `/api/v1/edge/certification/packages/:id` | `getPackage` | `EdgeCertificationController` |
| `POST` | `/api/v1/edge/certification/packages` | `createPackageEndpoint` | `EdgeCertificationController` |
| `POST` | `/api/v1/edge/certification/packages/:id/assemble` | `evidence` | `EdgeCertificationController` |
| `POST` | `/api/v1/edge/certification/packages/:id/certify` | `certifyEndpoint` | `EdgeCertificationController` |
| `POST` | `/api/v1/edge/certification/packages/:id/revoke` | `revokeEndpoint` | `EdgeCertificationController` |
| `POST` | `/api/v1/edge/certification/packages/:id/evidence` | `attachEvidenceEndpoint` | `EdgeCertificationController` |
| `GET` | `/api/v1/edge/certification/packages/:id/evidence` | `listPackageEvidence` | `EdgeCertificationController` |
| `GET` | `/api/v1/edge/certification/packages/:id/evidence-items` | `listEvidenceItems` | `EdgeCertificationController` |
| `GET` | `/api/v1/edge/certification/packages/:id/runs` | `listRuns` | `EdgeCertificationController` |
| `GET` | `/api/v1/edge/certification/history` | `listHistory` | `EdgeCertificationController` |

### `commercial.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/commercial/markets` | `markets` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/markets` | `createMarketEndpoint` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/icps` | `icps` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/icps` | `createIcpEndpoint` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/packages` | `packages` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/packages/:id` | `getPackageEndpoint` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/packages` | `createPackageEndpoint` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/packages/:id/capabilities` | `addPackageCap` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/plans` | `plans` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/plans/:id` | `getPlanEndpoint` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/plans` | `createPlanEndpoint` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/plans/:id/capabilities` | `addPlanCap` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/plans/:id/readiness` | `evaluatePlan` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/plans/:id/publish` | `publishPlanEndpoint` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/addons` | `addons` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/addons/:id` | `getAddonEndpoint` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/addons` | `createAddonEndpoint` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/addons/:id/plans` | `linkAddonEndpoint` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/addons/:id/capabilities` | `addAddonCap` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/price-books` | `priceBooks` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/price-books` | `createPriceBookEndpoint` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/price-books/:id/entries` | `listEntries` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/price-books/:id/entries` | `addEntry` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/pricing-units` | `pricingUnits` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/pricing-units` | `createUnit` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/pricing/preview` | `preview` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/catalog` | `catalog` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/publication-snapshots` | `snapshots` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/packages/:id/publish` | `publishPackageEndpoint` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/price-books/:id/publish` | `publishPriceBookEndpoint` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/offers/:offerType/:id/readiness` | `evaluateOfferEndpoint` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/addons/:id/publish` | `publishAddonEndpoint` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/enterprise-templates/:id/publish` | `publishEnterpriseEndpoint` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/offers/configure` | `configure` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/offers/wizard` | `runWizard` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/pricing/geographic-rules` | `listGeoPricing` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/discounts/evaluate-approval` | `evaluateDiscount` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/personas` | `personas` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/personas` | `createPersonaEndpoint` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/value-propositions` | `valueProps` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/value-propositions` | `createValuePropEndpoint` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/discount-policies` | `discounts` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/discount-policies` | `createDiscountEndpoint` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/research-projects` | `researchProjects` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/research-projects` | `createResearchEndpoint` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/research-projects/:id/sources` | `addSource` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/research-projects/:id/complete` | `completeResearchEndpoint` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/markets/:id/assessments` | `marketAssessments` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/markets/:id/assessments` | `createAssessment` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/segment-intelligence` | `segmentIntel` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/segment-intelligence` | `upsertSegment` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/segment-intelligence/:segmentId/score` | `scoreSegmentEndpoint` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/pricing-models` | `pricingModels` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/pricing-models` | `createPricingModelEndpoint` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/usage-metrics` | `usageMetrics` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/usage-metrics` | `createUsageMetricEndpoint` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/buying-committees` | `buyingCommittees` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/buying-committees` | `createBuyingCommitteeEndpoint` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/decision-journeys` | `decisionJourneys` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/decision-journeys` | `createJourney` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/enterprise-templates` | `enterpriseTemplates` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/enterprise-templates` | `createEnterpriseEndpoint` | `EdgeCommercialController` |
| `GET` | `/api/v1/edge/commercial/eligibility-policies` | `eligibilityPolicies` | `EdgeCommercialController` |
| `POST` | `/api/v1/edge/commercial/eligibility-policies` | `createEligibilityEndpoint` | `EdgeCommercialController` |

### `configuration.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/configuration/schemas` | `listSchemas` | `EdgeConfigurationController` |
| `GET` | `/api/v1/edge/configuration/schemas/:id` | `getSchema` | `EdgeConfigurationController` |
| `POST` | `/api/v1/edge/configuration/schemas` | `createSchemaEndpoint` | `EdgeConfigurationController` |
| `GET` | `/api/v1/edge/configuration/templates` | `listTemplates` | `EdgeConfigurationController` |
| `GET` | `/api/v1/edge/configuration/templates/:id` | `getTemplate` | `EdgeConfigurationController` |
| `POST` | `/api/v1/edge/configuration/templates` | `createTemplateEndpoint` | `EdgeConfigurationController` |
| `POST` | `/api/v1/edge/configuration/templates/:id/publish` | `publishTemplateEndpoint` | `EdgeConfigurationController` |
| `GET` | `/api/v1/edge/configuration/bundles` | `listBundles` | `EdgeConfigurationController` |
| `GET` | `/api/v1/edge/configuration/bundles/:id` | `getBundle` | `EdgeConfigurationController` |
| `POST` | `/api/v1/edge/configuration/bundles` | `createBundleEndpoint` | `EdgeConfigurationController` |
| `POST` | `/api/v1/edge/configuration/bundles/:id/publish` | `publishBundleEndpoint` | `EdgeConfigurationController` |
| `GET` | `/api/v1/edge/configuration/assignments` | `listAssignments` | `EdgeConfigurationController` |
| `GET` | `/api/v1/edge/configuration/assignments/:id` | `getAssignment` | `EdgeConfigurationController` |
| `POST` | `/api/v1/edge/configuration/assignments` | `tenant` | `EdgeConfigurationController` |
| `POST` | `/api/v1/edge/configuration/assignments/:id/deploy` | `deployEndpoint` | `EdgeConfigurationController` |
| `POST` | `/api/v1/edge/configuration/assignments/:id/rollback` | `rollbackEndpoint` | `EdgeConfigurationController` |
| `GET` | `/api/v1/edge/configuration/assignments/:id/runs` | `listRuns` | `EdgeConfigurationController` |
| `GET` | `/api/v1/edge/configuration/assignments/:id/evidence` | `listEvidence` | `EdgeConfigurationController` |
| `GET` | `/api/v1/edge/entitlements/assignments/:assignmentId` | `listEntitlements` | `EdgeConfigurationController` |
| `POST` | `/api/v1/edge/entitlements/assignments/:assignmentId/reconcile` | `reconcileEntitlements` | `EdgeConfigurationController` |

### `connectivity-agent.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/agents` | `listAgents` | `EdgeConnectivityAgentController` |
| `GET` | `/api/v1/edge/agent-history` | `listHistory` | `EdgeConnectivityAgentController` |
| `GET` | `/api/v1/edge/agents/:id` | `getAgent` | `EdgeConnectivityAgentController` |
| `POST` | `/api/v1/edge/agents` | `agent` | `EdgeConnectivityAgentController` |
| `POST` | `/api/v1/edge/agents/:id/register` | `registerEndpoint` | `EdgeConnectivityAgentController` |
| `POST` | `/api/v1/edge/agents/:id/command` | `required` | `EdgeConnectivityAgentController` |
| `POST` | `/api/v1/edge/agents/:id/revoke` | `REVOKED` | `EdgeConnectivityAgentController` |
| `GET` | `/api/v1/edge/agents/:id/commands` | `listCommands` | `EdgeConnectivityAgentController` |
| `GET` | `/api/v1/edge/agents/:id/evidence` | `listEvidence` | `EdgeConnectivityAgentController` |

### `customer-success.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/cs/aha-moments` | `listAhaMoments` | `EdgeCustomerSuccessController` |
| `POST` | `/api/v1/edge/cs/health-score` | `computeHealth` | `EdgeCustomerSuccessController` |
| `POST` | `/api/v1/edge/cs/adoption-events` | `ingestAdoptionEvent` | `EdgeCustomerSuccessController` |
| `GET` | `/api/v1/edge/cs/adoption-events` | `listAdoptionEvents` | `EdgeCustomerSuccessController` |
| `POST` | `/api/v1/edge/cs/expansion-signals` | `evaluateExpansion` | `EdgeCustomerSuccessController` |
| `POST` | `/api/v1/edge/cs/churn-risk` | `computeChurn` | `EdgeCustomerSuccessController` |

### `experience.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/experience/profiles` | `listProfiles` | `EdgeExperienceController` |
| `GET` | `/api/v1/edge/experience/profiles/:id` | `getProfile` | `EdgeExperienceController` |
| `POST` | `/api/v1/edge/experience/profiles` | `createProfileEndpoint` | `EdgeExperienceController` |
| `POST` | `/api/v1/edge/experience/profiles/:id/publish` | `publishProfileEndpoint` | `EdgeExperienceController` |
| `GET` | `/api/v1/edge/experience/applications` | `listApplications` | `EdgeExperienceController` |
| `GET` | `/api/v1/edge/experience/applications/:id` | `getApplication` | `EdgeExperienceController` |
| `POST` | `/api/v1/edge/experience/applications` | `createApplicationEndpoint` | `EdgeExperienceController` |
| `POST` | `/api/v1/edge/experience/applications/:id/publish` | `publishApplicationEndpoint` | `EdgeExperienceController` |
| `GET` | `/api/v1/edge/experience/assignments` | `listAssignments` | `EdgeExperienceController` |
| `GET` | `/api/v1/edge/experience/assignments/:id` | `getAssignment` | `EdgeExperienceController` |
| `POST` | `/api/v1/edge/experience/assignments` | `experience` | `EdgeExperienceController` |
| `POST` | `/api/v1/edge/experience/assignments/:id/provision` | `provisionEndpoint` | `EdgeExperienceController` |
| `POST` | `/api/v1/edge/experience/assignments/:id/deactivate` | `deactivateEndpoint` | `EdgeExperienceController` |
| `GET` | `/api/v1/edge/experience/assignments/:id/runs` | `listRuns` | `EdgeExperienceController` |
| `GET` | `/api/v1/edge/experience/assignments/:id/evidence` | `listEvidence` | `EdgeExperienceController` |
| `GET` | `/api/v1/edge/experience/assignments/:id/domains` | `listDomains` | `EdgeExperienceController` |
| `POST` | `/api/v1/edge/experience/domains` | `bindDomainEndpoint` | `EdgeExperienceController` |

### `infrastructure.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/infrastructure/providers` | `listProviders` | `EdgeInfrastructureController` |
| `GET` | `/api/v1/edge/infrastructure/providers/:id` | `getProvider` | `EdgeInfrastructureController` |
| `GET` | `/api/v1/edge/infrastructure/resources` | `listResources` | `EdgeInfrastructureController` |
| `GET` | `/api/v1/edge/infrastructure/resources/:id` | `getResource` | `EdgeInfrastructureController` |
| `POST` | `/api/v1/edge/infrastructure/resources/:id/reconcile` | `reconcileResource` | `EdgeInfrastructureController` |
| `POST` | `/api/v1/edge/infrastructure/resource-plans` | `createResourcePlan` | `EdgeInfrastructureController` |
| `GET` | `/api/v1/edge/infrastructure/resource-plans` | `listPlans` | `EdgeInfrastructureController` |
| `GET` | `/api/v1/edge/infrastructure/resource-plans/:id` | `getPlan` | `EdgeInfrastructureController` |
| `POST` | `/api/v1/edge/infrastructure/resource-plans/:id/validate` | `validateResourcePlan` | `EdgeInfrastructureController` |
| `GET` | `/api/v1/edge/databases/resources` | `listDatabases` | `EdgeInfrastructureController` |
| `GET` | `/api/v1/edge/databases/resources/:id` | `getDatabase` | `EdgeInfrastructureController` |
| `POST` | `/api/v1/edge/databases/resources/:id/verify` | `verifyDatabase` | `EdgeInfrastructureController` |
| `POST` | `/api/v1/edge/databases/resources/:id/rotate-credentials` | `rotateDatabaseCredentials` | `EdgeInfrastructureController` |
| `GET` | `/api/v1/edge/resources/:id/history` | `history` | `EdgeInfrastructureController` |
| `GET` | `/api/v1/edge/resources/:id/backups` | `listBackups` | `EdgeInfrastructureController` |
| `POST` | `/api/v1/edge/resources/:id/backups` | `createBackup` | `EdgeInfrastructureController` |
| `POST` | `/api/v1/edge/resources/:id/deprovision` | `deprovisionResource` | `EdgeInfrastructureController` |

### `keycloak.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/keycloak/providers` | `listProviders` | `EdgeKeycloakController` |
| `GET` | `/api/v1/edge/keycloak/providers/:id` | `getProvider` | `EdgeKeycloakController` |
| `GET` | `/api/v1/edge/keycloak/servers` | `listServers` | `EdgeKeycloakController` |
| `GET` | `/api/v1/edge/keycloak/servers/:id` | `getServer` | `EdgeKeycloakController` |
| `POST` | `/api/v1/edge/keycloak/servers` | `registerServer` | `EdgeKeycloakController` |
| `POST` | `/api/v1/edge/keycloak/servers/:id/capabilities` | `discoverCapabilities` | `EdgeKeycloakController` |
| `GET` | `/api/v1/edge/keycloak/servers/:id/capabilities` | `getCapabilities` | `EdgeKeycloakController` |
| `GET` | `/api/v1/edge/keycloak/topologies` | `listTopologies` | `EdgeKeycloakController` |
| `GET` | `/api/v1/edge/keycloak/topologies/:id` | `getTopology` | `EdgeKeycloakController` |
| `POST` | `/api/v1/edge/keycloak/topologies` | `workflow` | `EdgeKeycloakController` |
| `POST` | `/api/v1/edge/keycloak/topologies/:id/reconcile` | `requestReconciliation` | `EdgeKeycloakController` |
| `POST` | `/api/v1/edge/keycloak/topologies/:id/deprovision` | `deprovision` | `EdgeKeycloakController` |
| `GET` | `/api/v1/edge/keycloak/topologies/:id/evidence` | `listEvidence` | `EdgeKeycloakController` |
| `GET` | `/api/v1/edge/keycloak/topologies/:id/history` | `listHistory` | `EdgeKeycloakController` |
| `GET` | `/api/v1/edge/keycloak/topologies/:id/reconciliations` | `listReconciliations` | `EdgeKeycloakController` |
| `POST` | `/api/v1/edge/keycloak/clients` | `state` | `EdgeKeycloakController` |

### `lifecycle.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/lifecycle/records` | `listRecords` | `EdgeLifecycleController` |
| `GET` | `/api/v1/edge/lifecycle/records/:id` | `getRecord` | `EdgeLifecycleController` |
| `POST` | `/api/v1/edge/lifecycle/records` | `Record` | `EdgeLifecycleController` |
| `POST` | `/api/v1/edge/lifecycle/records/:id/suspend` | `suspendEndpoint` | `EdgeLifecycleController` |
| `POST` | `/api/v1/edge/lifecycle/records/:id/resume` | `resumeEndpoint` | `EdgeLifecycleController` |
| `POST` | `/api/v1/edge/lifecycle/records/:id/deprovision` | `deprovisionEndpoint` | `EdgeLifecycleController` |
| `GET` | `/api/v1/edge/lifecycle/records/:id/runs` | `listRuns` | `EdgeLifecycleController` |
| `GET` | `/api/v1/edge/lifecycle/records/:id/evidence` | `listEvidence` | `EdgeLifecycleController` |

### `live-complete.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/live-complete/status` | `complete` | `EdgeLiveCompleteController` |

### `marketing.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/marketing/strategies` | `strategies` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/strategies` | `createStrategyEndpoint` | `EdgeMarketingController` |
| `GET` | `/api/v1/edge/marketing/audiences` | `audiences` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/audiences` | `createAudienceEndpoint` | `EdgeMarketingController` |
| `GET` | `/api/v1/edge/marketing/campaigns` | `campaigns` | `EdgeMarketingController` |
| `GET` | `/api/v1/edge/marketing/campaigns/:id` | `campaign` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/campaigns` | `createCampaignEndpoint` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/campaigns/:id/transition` | `transition` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/campaigns/:id/approvals` | `approve` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/campaigns/:id/publish` | `publish` | `EdgeMarketingController` |
| `GET` | `/api/v1/edge/marketing/forms` | `forms` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/forms` | `createFormEndpoint` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/forms/:id/publish` | `publishFormEndpoint` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/forms/public/:slug/submissions` | `publicSubmit` | `EdgeMarketingController` |
| `GET` | `/api/v1/edge/marketing/leads` | `leads` | `EdgeMarketingController` |
| `GET` | `/api/v1/edge/marketing/leads/:id` | `lead` | `EdgeMarketingController` |
| `PATCH` | `/api/v1/edge/marketing/leads/:id/consents/withdraw` | `withdrawConsent` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/leads/:id/score` | `score` | `EdgeMarketingController` |
| `GET` | `/api/v1/edge/marketing/budgets` | `budgets` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/budgets` | `createBudgetEndpoint` | `EdgeMarketingController` |
| `GET` | `/api/v1/edge/marketing/contents` | `contents` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/contents` | `createContentEndpoint` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/contents/:id/approve` | `approveContentEndpoint` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/contents/:id/publish` | `publishContentEndpoint` | `EdgeMarketingController` |
| `PUT` | `/api/v1/edge/marketing/contents/:id/studio` | `updateContentStudioEndpoint` | `EdgeMarketingController` |
| `GET` | `/api/v1/edge/marketing/landing-pages` | `landingPages` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/landing-pages` | `createLandingEndpoint` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/landing-pages/:id/publish` | `publishLandingEndpoint` | `EdgeMarketingController` |
| `PUT` | `/api/v1/edge/marketing/landing-pages/:id/studio` | `updateLandingStudioEndpoint` | `EdgeMarketingController` |
| `GET` | `/api/v1/edge/marketing/channels` | `channels` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/channels` | `upsertChannelEndpoint` | `EdgeMarketingController` |
| `GET` | `/api/v1/edge/marketing/templates` | `templates` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/templates` | `createTemplateEndpoint` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/deliveries/request` | `requestDeliveryEndpoint` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/deliveries/receipts` | `ingestReceiptEndpoint` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/deliveries/webhooks/resend` | `resendWebhookEndpoint` | `EdgeMarketingController` |
| `GET` | `/api/v1/edge/marketing/deliveries/webhooks/whatsapp` | `whatsappWebhookVerify` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/deliveries/webhooks/whatsapp` | `whatsappWebhookEndpoint` | `EdgeMarketingController` |
| `GET` | `/api/v1/edge/marketing/journeys` | `journeys` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/journeys` | `createJourneyEndpoint` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/journeys/:id/activate` | `activateJourneyEndpoint` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/journeys/:id/executions` | `startJourneyEndpoint` | `EdgeMarketingController` |
| `GET` | `/api/v1/edge/marketing/attribution/models` | `attributionModels` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/attribution/calculate` | `calculateAttributionEndpoint` | `EdgeMarketingController` |
| `GET` | `/api/v1/edge/marketing/analytics/snapshots` | `analyticsSnapshots` | `EdgeMarketingController` |
| `GET` | `/api/v1/edge/marketing/analytics/summary` | `analyticsSummary` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/analytics/snapshots` | `createAnalyticsSnapshotEndpoint` | `EdgeMarketingController` |
| `GET` | `/api/v1/edge/marketing/suppressions` | `suppressions` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/suppressions` | `createSuppressionEndpoint` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/journeys/waits/resume` | `resumeWaitsEndpoint` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/leads/:id/assign` | `assignLeadEndpoint` | `EdgeMarketingController` |
| `POST` | `/api/v1/edge/marketing/leads/merge` | `mergeLeadsEndpoint` | `EdgeMarketingController` |

### `onboarding.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/onboarding/templates` | `listTemplates` | `EdgeOnboardingController` |
| `GET` | `/api/v1/edge/onboarding/templates/:id` | `getTemplate` | `EdgeOnboardingController` |
| `POST` | `/api/v1/edge/onboarding/templates` | `createTemplateEndpoint` | `EdgeOnboardingController` |
| `POST` | `/api/v1/edge/onboarding/templates/:id/publish` | `publishTemplateEndpoint` | `EdgeOnboardingController` |
| `GET` | `/api/v1/edge/onboarding/journeys` | `listJourneys` | `EdgeOnboardingController` |
| `GET` | `/api/v1/edge/onboarding/journeys/:id` | `getJourney` | `EdgeOnboardingController` |
| `POST` | `/api/v1/edge/onboarding/journeys` | `Record` | `EdgeOnboardingController` |
| `POST` | `/api/v1/edge/onboarding/journeys/:id/start` | `startEndpoint` | `EdgeOnboardingController` |
| `POST` | `/api/v1/edge/onboarding/journeys/:id/advance` | `advanceEndpoint` | `EdgeOnboardingController` |
| `POST` | `/api/v1/edge/onboarding/journeys/:id/close` | `closeEndpoint` | `EdgeOnboardingController` |
| `POST` | `/api/v1/edge/onboarding/journeys/:journeyId/tasks/:taskId/decide` | `first` | `EdgeOnboardingController` |
| `GET` | `/api/v1/edge/onboarding/journeys/:id/runs` | `listRuns` | `EdgeOnboardingController` |
| `GET` | `/api/v1/edge/onboarding/journeys/:id/evidence` | `listEvidence` | `EdgeOnboardingController` |

### `p5-provisioning-integration.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `POST` | `/api/v1/edge/integrations/p5/provisioning/revocations` | `ingestRevocation` | `EdgeP5ProvisioningIntegrationController` |

### `partner-opportunity.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `POST` | `/api/v1/edge/partners/opportunities` | `register` | `EdgePartnerOpportunityController` |
| `GET` | `/api/v1/edge/partners/opportunities` | `list` | `EdgePartnerOpportunityController` |
| `POST` | `/api/v1/edge/partners/opportunities/:id/transition` | `transition` | `EdgePartnerOpportunityController` |

### `placement.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/placement/requests` | `listRequests` | `EdgePlacementController` |
| `POST` | `/api/v1/edge/placement/requests` | `createPlacementRequest` | `EdgePlacementController` |
| `GET` | `/api/v1/edge/placement/requests/:id` | `getRequest` | `EdgePlacementController` |
| `POST` | `/api/v1/edge/placement/requests/:id/evaluate` | `evaluateRequest` | `EdgePlacementController` |
| `POST` | `/api/v1/edge/placement/requests/:id/confirm` | `confirmRequest` | `EdgePlacementController` |
| `POST` | `/api/v1/edge/placement/requests/:id/cancel` | `cancelRequest` | `EdgePlacementController` |
| `POST` | `/api/v1/edge/placement/requests/:id/re-evaluate` | `reEvaluateRequest` | `EdgePlacementController` |
| `GET` | `/api/v1/edge/placement/decisions/:id` | `getDecision` | `EdgePlacementController` |
| `GET` | `/api/v1/edge/placement/decisions/:id/candidates` | `listCandidates` | `EdgePlacementController` |
| `GET` | `/api/v1/edge/placement/history` | `listHistory` | `EdgePlacementController` |
| `GET` | `/api/v1/edge/placement/policies` | `listPolicies` | `EdgePlacementController` |
| `POST` | `/api/v1/edge/placement/policies` | `createPlacementPolicy` | `EdgePlacementController` |
| `PATCH` | `/api/v1/edge/placement/policies/:id` | `patchPlacementPolicy` | `EdgePlacementController` |
| `GET` | `/api/v1/edge/capacity/inventory` | `listInventory` | `EdgeCapacityController` |
| `POST` | `/api/v1/edge/capacity/inventory` | `upsert` | `EdgeCapacityController` |
| `PATCH` | `/api/v1/edge/capacity/inventory/:id` | `patch` | `EdgeCapacityController` |
| `GET` | `/api/v1/edge/capacity/reservations` | `listReservations` | `EdgeCapacityController` |
| `GET` | `/api/v1/edge/capacity/reservations/:id` | `getReservation` | `EdgeCapacityController` |
| `POST` | `/api/v1/edge/capacity/reservations/:id/release` | `releaseReservation` | `EdgeCapacityController` |
| `POST` | `/api/v1/edge/capacity/reservations/:id/expire` | `expireReservation` | `EdgeCapacityController` |

### `platform-operations.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/operations/services` | `searchServices` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/services` | `createService` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/services/:id` | `getServiceById` | `EdgePlatformOperationsController` |
| `PATCH` | `/api/v1/edge/operations/services/:id` | `patchService` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/services/:id/dependencies` | `postDependency` | `EdgePlatformOperationsController` |
| `DELETE` | `/api/v1/edge/operations/services/:id/dependencies` | `deleteDependency` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/overview` | `operationsOverview` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/health` | `operationsHealth` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/analytics` | `operationsAnalytics` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/health/snapshots` | `postHealthSnapshot` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/alerts` | `getAlerts` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/alerts` | `postAlert` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/alerts/:id/acknowledge` | `postAckAlert` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/alerts/:id/resolve` | `postResolveAlert` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/incidents` | `getIncidents` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/major-incidents` | `getMajorIncidents` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/incidents` | `postIncident` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/incidents/:id` | `getIncidentById` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/incidents/:id/transition` | `postIncidentTransition` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/incidents/:id/major` | `postMajorIncident` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/problems` | `getProblems` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/problems` | `postProblem` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/problems/:id/root-cause` | `postRootCause` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/problems/:id/incidents` | `postProblemIncidentLink` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/changes` | `getChanges` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/releases` | `getReleases` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/releases` | `postRelease` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/releases/:id/transition` | `postTransitionRelease` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/changes` | `postChange` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/changes/:id/submit` | `postSubmitChange` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/changes/:id/approve` | `postApproveChange` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/changes/:id/reject` | `postRejectChange` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/maintenance` | `getMaintenance` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/maintenance` | `postMaintenance` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/requests` | `getRequests` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/requests` | `postRequest` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/tasks` | `getTasks` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/tasks` | `postTask` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/on-call/rotations` | `getOnCallRotations` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/on-call/rotations` | `postOnCallRotation` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/slo` | `getSlos` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/slo` | `postSlo` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/slo/measurements` | `postSloMeasurement` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/capacity` | `getCapacity` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/capacity` | `postCapacity` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/recovery` | `getRecovery` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/recovery` | `postRecovery` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/recovery/:id/verify` | `postVerifyRecovery` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/runbooks` | `getRunbooks` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/runbooks` | `postRunbook` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/status/components` | `getStatusComponents` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/status-pages` | `getStatusPages` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/status/publications` | `postStatusPublication` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/status/publications/:id/approve` | `postApproveStatus` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/risks` | `getRisks` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/risks` | `postRisk` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/exceptions` | `getExceptions` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/exceptions` | `postException` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/exceptions/flag-expired` | `postFlagExpiredExceptions` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/automation` | `getAutomations` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/automation` | `postAutomation` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/automation/executions` | `postAutomationExecution` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/automation/executions/:id/approve` | `postApproveAutomationExecution` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/automation/executions/:id/execute` | `postExecuteAutomation` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/notifications` | `getNotifications` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/notifications` | `postNotification` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/notifications/:id/status` | `postNotificationStatus` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/monitoring/sources` | `postMonitoringSource` | `EdgePlatformOperationsController` |
| `POST` | `/api/v1/edge/operations/monitoring/probes` | `postMonitoringProbe` | `EdgePlatformOperationsController` |
| `GET` | `/api/v1/edge/operations/monitoring/probes` | `getMonitoringProbes` | `EdgePlatformOperationsController` |

### `product-control.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/product-controls/endpoints` | `listEndpoints` | `EdgeProductControlController` |
| `GET` | `/api/v1/edge/product-controls/endpoints/:id` | `getEndpoint` | `EdgeProductControlController` |
| `POST` | `/api/v1/edge/product-controls/endpoints` | `createEndpoint` | `EdgeProductControlController` |
| `POST` | `/api/v1/edge/product-controls/endpoints/:id/validate` | `validate` | `EdgeProductControlController` |
| `POST` | `/api/v1/edge/product-controls/endpoints/:id/handshake` | `runHandshake` | `EdgeProductControlController` |
| `POST` | `/api/v1/edge/product-controls/endpoints/:id/discover-contract` | `runDiscoverContract` | `EdgeProductControlController` |
| `POST` | `/api/v1/edge/product-controls/endpoints/:id/discover-capabilities` | `runDiscoverCapabilities` | `EdgeProductControlController` |
| `POST` | `/api/v1/edge/product-controls/endpoints/:id/health-check` | `runHealthCheck` | `EdgeProductControlController` |
| `POST` | `/api/v1/edge/product-controls/endpoints/:id/quarantine` | `quarantineEndpoint` | `EdgeProductControlController` |
| `GET` | `/api/v1/edge/product-controls/endpoints/:id/contracts` | `listEndpointContracts` | `EdgeProductControlController` |
| `GET` | `/api/v1/edge/product-controls/endpoints/:id/health-checks` | `listEndpointHealthChecks` | `EdgeProductControlController` |
| `GET` | `/api/v1/edge/product-controls/endpoints/:id/history` | `listEndpointHistory` | `EdgeProductControlController` |
| `GET` | `/api/v1/edge/product-controls/endpoints/:id/exchanges` | `listEndpointExchanges` | `EdgeProductControlController` |
| `GET` | `/api/v1/edge/product-controls/endpoints/:id/capabilities` | `listCapabilities` | `EdgeProductControlController` |
| `GET` | `/api/v1/edge/product-controls/exchanges` | `listExchanges` | `EdgeProductControlController` |
| `GET` | `/api/v1/edge/product-controls/credentials` | `bindings` | `EdgeProductControlController` |
| `GET` | `/api/v1/edge/product-controls/exchanges/:id` | `getExchange` | `EdgeProductControlController` |
| `POST` | `/api/v1/edge/product-controls/exchanges/:id/reconcile` | `reconcileExchange` | `EdgeProductControlController` |
| `POST` | `/api/v1/edge/product-controls/callbacks/:endpointId` | `callback` | `EdgeProductControlController` |

### `products.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/products` | `list` | `EdgeProductsController` |
| `POST` | `/api/v1/edge/products` | `create` | `EdgeProductsController` |
| `GET` | `/api/v1/edge/products/:id` | `get` | `EdgeProductsController` |
| `PATCH` | `/api/v1/edge/products/:id` | `patch` | `EdgeProductsController` |
| `POST` | `/api/v1/edge/products/:id/lifecycle` | `lifecycle` | `EdgeProductsController` |
| `GET` | `/api/v1/edge/products/:id/versions` | `versions` | `EdgeProductsController` |
| `POST` | `/api/v1/edge/products/:id/versions` | `createProductVersion` | `EdgeProductsController` |
| `GET` | `/api/v1/edge/products/:id/versions/:versionId` | `getProductVersion` | `EdgeProductsController` |
| `PATCH` | `/api/v1/edge/products/:id/versions/:versionId` | `patchVersion` | `EdgeProductsController` |
| `POST` | `/api/v1/edge/products/:id/versions/:versionId/publish` | `publishProductVersion` | `EdgeProductsController` |
| `GET` | `/api/v1/edge/products/:id/compatibilities` | `compatibilities` | `EdgeProductsController` |
| `PUT` | `/api/v1/edge/products/:id/compatibilities` | `putCompatibility` | `EdgeProductsController` |
| `GET` | `/api/v1/edge/products/:id/capabilities` | `capabilities` | `EdgeProductsController` |
| `PUT` | `/api/v1/edge/products/:id/capabilities` | `putCapability` | `EdgeProductsController` |
| `GET` | `/api/v1/edge/products/:id/bindings` | `bindings` | `EdgeProductsController` |
| `POST` | `/api/v1/edge/products/:id/bindings` | `createProductBinding` | `EdgeProductsController` |
| `POST` | `/api/v1/edge/products/:id/readiness` | `readiness` | `EdgeProductsController` |
| `POST` | `/api/v1/edge/products/:id/publish` | `publish` | `EdgeProductsController` |

### `provisioning-jobs.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `POST` | `/api/v1/edge/provisioning-jobs/process` | `process` | `EdgeProvisioningJobsController` |
| `GET` | `/api/v1/edge/provisioning-jobs/by-subscription/:subscriptionId` | `listBySubscription` | `EdgeProvisioningJobsController` |

### `provisioning.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/provisioning-requests/stats` | `stats` | `EdgeProvisioningController` |
| `GET` | `/api/v1/edge/provisioning-requests/event-compatibility` | `eventCompatibility` | `EdgeProvisioningController` |
| `GET` | `/api/v1/edge/provisioning-requests` | `list` | `EdgeProvisioningController` |
| `GET` | `/api/v1/edge/provisioning-requests/:id` | `get` | `EdgeProvisioningController` |
| `GET` | `/api/v1/edge/provisioning-requests/:id/history` | `history` | `EdgeProvisioningController` |
| `GET` | `/api/v1/edge/provisioning-requests/:id/authorization` | `authorization` | `EdgeProvisioningController` |
| `POST` | `/api/v1/edge/provisioning-requests/:id/cancel` | `cancel` | `EdgeProvisioningController` |

### `reconciliation.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/reconciliation/policies` | `listPolicies` | `EdgeReconciliationController` |
| `GET` | `/api/v1/edge/reconciliation/policies/:id` | `getPolicy` | `EdgeReconciliationController` |
| `POST` | `/api/v1/edge/reconciliation/policies` | `createPolicyEndpoint` | `EdgeReconciliationController` |
| `GET` | `/api/v1/edge/reconciliation/runs` | `listRuns` | `EdgeReconciliationController` |
| `GET` | `/api/v1/edge/reconciliation/runs/:id` | `getRun` | `EdgeReconciliationController` |
| `POST` | `/api/v1/edge/reconciliation/runs` | `run` | `EdgeReconciliationController` |
| `POST` | `/api/v1/edge/reconciliation/runs/:id/observe` | `UNKNOWN` | `EdgeReconciliationController` |
| `POST` | `/api/v1/edge/reconciliation/runs/:id/remediate` | `remediateEndpoint` | `EdgeReconciliationController` |
| `POST` | `/api/v1/edge/reconciliation/runs/:runId/remediations/:remediationId/decide` | `decideRemediationEndpoint` | `EdgeReconciliationController` |
| `GET` | `/api/v1/edge/reconciliation/findings` | `listFindings` | `EdgeReconciliationController` |
| `POST` | `/api/v1/edge/reconciliation/findings/:id/quarantine` | `quarantineEndpoint` | `EdgeReconciliationController` |
| `POST` | `/api/v1/edge/reconciliation/waivers` | `createWaiverEndpoint` | `EdgeReconciliationController` |
| `GET` | `/api/v1/edge/reconciliation/waivers` | `listWaivers` | `EdgeReconciliationController` |
| `GET` | `/api/v1/edge/reconciliation/runs/:id/evidence` | `listEvidence` | `EdgeReconciliationController` |
| `GET` | `/api/v1/edge/reconciliation/history` | `listHistory` | `EdgeReconciliationController` |

### `registry.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/registry/products` | `listProducts` | `EdgeRegistryController` |
| `GET` | `/api/v1/edge/registry/products/:id` | `getProduct` | `EdgeRegistryController` |
| `POST` | `/api/v1/edge/registry/products` | `createProduct` | `EdgeRegistryController` |
| `PATCH` | `/api/v1/edge/registry/products/:id` | `patchProduct` | `EdgeRegistryController` |
| `POST` | `/api/v1/edge/registry/products/:id/transition` | `transitionProductStatus` | `EdgeRegistryController` |
| `GET` | `/api/v1/edge/registry/products/:id/versions` | `listVersions` | `EdgeRegistryController` |
| `POST` | `/api/v1/edge/registry/products/:id/versions` | `createProductVersion` | `EdgeRegistryController` |
| `GET` | `/api/v1/edge/registry/versions/:id` | `getVersion` | `EdgeRegistryController` |
| `PATCH` | `/api/v1/edge/registry/versions/:id` | `patchVersion` | `EdgeRegistryController` |
| `POST` | `/api/v1/edge/registry/versions/:id/transition` | `transitionVersionStatus` | `EdgeRegistryController` |
| `GET` | `/api/v1/edge/registry/platforms` | `listPlatforms` | `EdgeRegistryController` |
| `GET` | `/api/v1/edge/registry/platforms/:id` | `getPlatform` | `EdgeRegistryController` |
| `POST` | `/api/v1/edge/registry/platforms` | `createPlatform` | `EdgeRegistryController` |
| `PATCH` | `/api/v1/edge/registry/platforms/:id` | `patchPlatform` | `EdgeRegistryController` |
| `POST` | `/api/v1/edge/registry/platforms/:id/transition` | `transitionPlatformStatus` | `EdgeRegistryController` |
| `GET` | `/api/v1/edge/registry/environments` | `listEnvironments` | `EdgeRegistryController` |
| `GET` | `/api/v1/edge/registry/environments/:id` | `getEnvironment` | `EdgeRegistryController` |
| `POST` | `/api/v1/edge/registry/environments` | `createEnvironment` | `EdgeRegistryController` |
| `PATCH` | `/api/v1/edge/registry/environments/:id` | `patchEnvironment` | `EdgeRegistryController` |
| `POST` | `/api/v1/edge/registry/environments/:id/transition` | `transitionEnvironmentStatus` | `EdgeRegistryController` |
| `GET` | `/api/v1/edge/registry/deployment-profiles` | `listProfiles` | `EdgeRegistryController` |
| `GET` | `/api/v1/edge/registry/deployment-profiles/:id` | `getProfile` | `EdgeRegistryController` |
| `PATCH` | `/api/v1/edge/registry/deployment-profiles/:id` | `patchProfile` | `EdgeRegistryController` |
| `POST` | `/api/v1/edge/registry/deployment-profiles/:id/transition` | `transitionProfileStatus` | `EdgeRegistryController` |
| `GET` | `/api/v1/edge/registry/control-contracts` | `listContracts` | `EdgeRegistryController` |
| `GET` | `/api/v1/edge/registry/control-contracts/:id` | `getContract` | `EdgeRegistryController` |
| `POST` | `/api/v1/edge/registry/control-contracts` | `createControlContract` | `EdgeRegistryController` |
| `PATCH` | `/api/v1/edge/registry/control-contracts/:id` | `patchContract` | `EdgeRegistryController` |
| `POST` | `/api/v1/edge/registry/control-contracts/:id/transition` | `transitionContractStatus` | `EdgeRegistryController` |
| `POST` | `/api/v1/edge/registry/compatibility/evaluate` | `evaluate` | `EdgeRegistryController` |
| `GET` | `/api/v1/edge/registry/compatibility/evaluations` | `listEvaluations` | `EdgeRegistryController` |
| `GET` | `/api/v1/edge/registry/compatibility/evaluations/:id` | `getEvaluation` | `EdgeRegistryController` |
| `GET` | `/api/v1/edge/registry/history` | `listHistory` | `EdgeRegistryController` |

### `revenue-operations.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/revenue/metrics/definitions` | `listMetricDefinitions` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/revenue/metrics/definitions` | `registerMetricDefinition` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/revenue/metrics/definitions/:id/publish` | `publishMetricDefinition` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/revenue/metrics/snapshots` | `recordMetricSnapshot` | `EdgeRevenueOperationsController` |
| `GET` | `/api/v1/edge/revenue/overview` | `only` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/revenue/mrr/compute` | `stub` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/revenue/cash/compute` | `refs` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/revenue/churn/compute` | `SUBSCRIPTION_CHURN` | `EdgeRevenueOperationsController` |
| `GET` | `/api/v1/edge/revenue/retention` | `retentionOverview` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/revenue/retention/snapshots` | `recordRetentionSnapshot` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/revenue/unit-economics/snapshots` | `snapshot` | `EdgeRevenueOperationsController` |
| `GET` | `/api/v1/edge/revenue/renewals/intelligence` | `scores` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/revenue/product-profitability/snapshots` | `profitability` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/revenue/forecasts` | `createRevenueForecast` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/revenue/forecasts/:id/scenarios` | `createForecastScenario` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/revenue/forecasts/named-scenarios` | `actuals` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/revenue/leakage-cases` | `createLeakageCase` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/revenue/leakage-cases/:id/transition` | `transitionLeakageCase` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/revenue/assurance/scan` | `scan` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/revenue/commission/plans` | `postCommissionPlan` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/revenue/commission/calculations` | `postCommissionCalculation` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/commission/calculations/:id/approve` | `approveCommissionCalculation` | `EdgeRevenueOperationsController` |
| `GET` | `/api/v1/edge/revenue/commission/plans` | `commissionReadPlaceholder` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/business/alerts/policies` | `createBusinessAlertPolicy` | `EdgeRevenueOperationsController` |
| `GET` | `/api/v1/edge/business/alerts` | `listBusinessAlerts` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/business/alerts/:id/acknowledge` | `acknowledgeBusinessAlert` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/business/alerts/evaluate` | `evaluateBusinessAlert` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/business/targets` | `createBusinessTarget` | `EdgeRevenueOperationsController` |
| `GET` | `/api/v1/edge/business/targets` | `listBusinessTargets` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/business/decisions` | `createBusinessDecision` | `EdgeRevenueOperationsController` |
| `GET` | `/api/v1/edge/business/reports` | `listBusinessReports` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/business/reports/generate` | `generateBusinessReport` | `EdgeRevenueOperationsController` |
| `GET` | `/api/v1/edge/business/audit` | `listBusinessAudit` | `EdgeRevenueOperationsController` |
| `POST` | `/api/v1/edge/business/audit` | `postBusinessAudit` | `EdgeRevenueOperationsController` |
| `GET` | `/api/v1/edge/business/overview` | `businessOverview` | `EdgeRevenueOperationsController` |

### `sales-platform.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/sales/search` | `getSearch` | `EdgeSalesPlatformController` |
| `GET` | `/api/v1/edge/sales/accounts/:id/hierarchy` | `getHierarchy` | `EdgeSalesPlatformController` |
| `POST` | `/api/v1/edge/sales/accounts/:id/relationships` | `postRelationship` | `EdgeSalesPlatformController` |
| `GET` | `/api/v1/edge/sales/contacts/:id/roles` | `getContactRoles` | `EdgeSalesPlatformController` |
| `POST` | `/api/v1/edge/sales/contacts/:id/roles` | `postContactRole` | `EdgeSalesPlatformController` |
| `GET` | `/api/v1/edge/sales/questionnaires` | `getQuestionnaires` | `EdgeSalesPlatformController` |
| `POST` | `/api/v1/edge/sales/questionnaires` | `postQuestionnaire` | `EdgeSalesPlatformController` |
| `POST` | `/api/v1/edge/sales/assessments/:id/solution-fit` | `postSolutionFit` | `EdgeSalesPlatformController` |
| `GET` | `/api/v1/edge/sales/contracts/:id/amendments` | `getAmendments` | `EdgeSalesPlatformController` |
| `POST` | `/api/v1/edge/sales/contracts/:id/amendments` | `postAmendment` | `EdgeSalesPlatformController` |
| `POST` | `/api/v1/edge/sales/amendments/:id/execute` | `postExecuteAmendment` | `EdgeSalesPlatformController` |
| `GET` | `/api/v1/edge/sales/orders/:id/lines` | `getOrderLines` | `EdgeSalesPlatformController` |
| `POST` | `/api/v1/edge/sales/orders/:id/lines` | `postOrderLines` | `EdgeSalesPlatformController` |
| `GET` | `/api/v1/edge/sales/views` | `getViews` | `EdgeSalesPlatformController` |
| `POST` | `/api/v1/edge/sales/views` | `postView` | `EdgeSalesPlatformController` |
| `DELETE` | `/api/v1/edge/sales/views/:id` | `deleteViewRoute` | `EdgeSalesPlatformController` |
| `POST` | `/api/v1/edge/sales/exports` | `postExport` | `EdgeSalesPlatformController` |
| `GET` | `/api/v1/edge/sales/exports` | `getExports` | `EdgeSalesPlatformController` |
| `POST` | `/api/v1/edge/sales/visibility/grants` | `postVisibilityGrant` | `EdgeSalesPlatformController` |
| `GET` | `/api/v1/edge/sales/visibility/grants` | `getVisibilityGrants` | `EdgeSalesPlatformController` |
| `POST` | `/api/v1/edge/sales/visibility/assert` | `postAssertVisibility` | `EdgeSalesPlatformController` |
| `POST` | `/api/v1/edge/sales/proposals/:id/document` | `postProposalDocument` | `EdgeSalesPlatformController` |
| `POST` | `/api/v1/edge/sales/activities/:id/calendar-sync` | `postCalendarSync` | `EdgeSalesPlatformController` |
| `POST` | `/api/v1/edge/sales/forecast/snapshots` | `postForecastSnapshot` | `EdgeSalesPlatformController` |
| `GET` | `/api/v1/edge/sales/forecast/snapshots` | `getForecastSnapshots` | `EdgeSalesPlatformController` |

### `sales.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/sales/overview` | `getOverview` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/engine/beachhead` | `salesEngineBeachhead` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/engine/lead-score` | `leadScore` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/engine/bant` | `evaluateBant` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/teams` | `getTeams` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/teams` | `postTeam` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/teams/:id/members` | `postTeamMember` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/territories` | `getTerritories` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/territories` | `postTerritory` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/accounts` | `getAccounts` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/accounts` | `postAccount` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/accounts/:id` | `getAccountById` | `EdgeSalesController` |
| `PUT` | `/api/v1/edge/sales/accounts/:id` | `putAccount` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/accounts/duplicates` | `postDuplicates` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/accounts/merge` | `postMerge` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/accounts/:id/timeline` | `getTimeline` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/contacts` | `getContacts` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/contacts` | `postContact` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/contacts/:id` | `getContactById` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/leads` | `getLeads` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/leads/receive` | `postReceiveLead` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/leads/:id` | `getLeadById` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/leads/:id/acceptance` | `postAcceptLead` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/leads/:id/rejection` | `postRejectLead` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/leads/:id/qualification` | `postQualifyLead` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/leads/:id/assignment` | `postAssignLead` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/notes` | `postNote` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/tasks` | `getTasks` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/tasks` | `postTask` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/tasks/:id/complete` | `postCompleteTask` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/pipelines` | `getPipelines` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/pipeline/board` | `getPipelineBoard` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/opportunities` | `getOpportunities` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/opportunities` | `postOpportunity` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/opportunities/:id` | `getOpportunityById` | `EdgeSalesController` |
| `PUT` | `/api/v1/edge/sales/opportunities/:id` | `putOpportunity` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/opportunities/:id/stages` | `postOpportunityStage` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/opportunities/:id/close` | `postOpportunityClose` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/opportunities/:id/reopen` | `postOpportunityReopen` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/opportunities/:id/risks` | `postOpportunityRisk` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/opportunities/:id/competitors` | `postOpportunityCompetitor` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/opportunities/:id/contacts` | `postOpportunityContact` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/activities` | `getActivities` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/activities` | `postActivity` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/activities/:id/complete` | `postCompleteActivity` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/opportunities/:id/assessments` | `getAssessments` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/opportunities/:id/assessments` | `postAssessment` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/assessments/:id/complete` | `postCompleteAssessment` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/opportunities/:id/offers` | `getOffers` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/opportunities/:id/offers` | `postOffer` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/quotes` | `getQuotes` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/quotes` | `postQuote` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/quotes/:id` | `getQuoteById` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/quotes/:id/transition` | `postQuoteTransition` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/quotes/:id/revisions` | `postQuoteRevision` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/proposals` | `getProposals` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/proposals` | `postProposal` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/proposals/:id/issue` | `postIssueProposal` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/discount-requests` | `getDiscountRequests` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/discount-requests` | `postDiscountRequest` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/discount-requests/:id/decision` | `postDiscountDecision` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/approvals` | `getApprovals` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/approvals/:id/decision` | `postApprovalDecision` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/contracts` | `getContracts` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/contracts` | `postContract` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/contracts/:id/transition` | `postContractTransition` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/orders` | `getOrders` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/orders` | `postOrder` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/orders/:id/transition` | `postOrderTransition` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/handoffs` | `getHandoffs` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/orders/:id/handoff` | `postHandoff` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/handoffs/:id/accept` | `postAcceptHandoff` | `EdgeSalesController` |
| `POST` | `/api/v1/edge/sales/handoffs/:id/provisioning-status` | `postProvisioningStatus` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/forecast` | `getForecastApi` | `EdgeSalesController` |
| `GET` | `/api/v1/edge/sales/analytics/performance` | `getPerformanceApi` | `EdgeSalesController` |

### `security.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/security/sessions` | `sessions` | `EdgeSecurityController` |
| `POST` | `/api/v1/edge/security/sessions/:id/revoke` | `revokeOne` | `EdgeSecurityController` |
| `POST` | `/api/v1/edge/security/sessions/revoke-all` | `revokeAll` | `EdgeSecurityController` |
| `GET` | `/api/v1/edge/security/events` | `events` | `EdgeSecurityController` |
| `GET` | `/api/v1/edge/security/mfa` | `mfa` | `EdgeSecurityController` |
| `POST` | `/api/v1/edge/security/emergency-access` | `request` | `EdgeSecurityController` |
| `POST` | `/api/v1/edge/security/emergency-access/:id/approve` | `approve` | `EdgeSecurityController` |
| `POST` | `/api/v1/edge/security/emergency-access/:id/revoke` | `revokeEmergencyGrant` | `EdgeSecurityController` |
| `GET` | `/api/v1/edge/security/delegations` | `delegations` | `EdgeSecurityController` |
| `POST` | `/api/v1/edge/security/delegations` | `createDelegationEndpoint` | `EdgeSecurityController` |
| `POST` | `/api/v1/edge/security/delegations/:id/revoke` | `revokeDelegationEndpoint` | `EdgeSecurityController` |

### `subscription.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/subscriptions/overview` | `overviewDashboard` | `EdgeSubscriptionController` |
| `GET` | `/api/v1/edge/subscriptions/analytics` | `analyticsDashboard` | `EdgeSubscriptionController` |
| `GET` | `/api/v1/edge/subscriptions/policies` | `policies` | `EdgeSubscriptionController` |
| `PUT` | `/api/v1/edge/subscriptions/policies/:code` | `putPolicy` | `EdgeSubscriptionController` |
| `GET` | `/api/v1/edge/subscriptions/approvals` | `approvals` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/scheduled-changes/process-due` | `processDueScheduledChanges` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/entitlements/drift-scan` | `driftScan` | `EdgeSubscriptionController` |
| `GET` | `/api/v1/edge/subscriptions/trials` | `trials` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/trials` | `createTrial` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/trials/:id/convert` | `trialConvert` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/trials/:id/expire` | `trialExpire` | `EdgeSubscriptionController` |
| `GET` | `/api/v1/edge/subscriptions` | `list` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions` | `create` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/from-handoff` | `fromHandoff` | `EdgeSubscriptionController` |
| `GET` | `/api/v1/edge/subscriptions/:id` | `get` | `EdgeSubscriptionController` |
| `GET` | `/api/v1/edge/subscriptions/:id/workspace` | `workspace` | `EdgeSubscriptionController` |
| `GET` | `/api/v1/edge/subscriptions/:id/history` | `subscriptionHistory` | `EdgeSubscriptionController` |
| `PATCH` | `/api/v1/edge/subscriptions/:id` | `patchSub` | `EdgeSubscriptionController` |
| `GET` | `/api/v1/edge/subscriptions/:id/suspensions` | `suspensions` | `EdgeSubscriptionController` |
| `GET` | `/api/v1/edge/subscriptions/:id/cancellations` | `cancellations` | `EdgeSubscriptionController` |
| `GET` | `/api/v1/edge/subscriptions/:id/billing-coordination` | `billingCoordinationList` | `EdgeSubscriptionController` |
| `GET` | `/api/v1/edge/subscriptions/:id/provisioning` | `provisioningList` | `EdgeSubscriptionController` |
| `GET` | `/api/v1/edge/subscriptions/:id/publications` | `publications` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/submit` | `submitSub` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/approve` | `approveSub` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/activate-request` | `activationRequest` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/activate` | `activateSub` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/suspend` | `suspendSub` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/reactivate` | `reactivateSub` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/cancel` | `cancelSub` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/terminate` | `terminateSub` | `EdgeSubscriptionController` |
| `GET` | `/api/v1/edge/subscriptions/:id/items` | `items` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/items` | `addSubscriptionItem` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/entitlements/calculate` | `calcEntitlements` | `EdgeSubscriptionController` |
| `GET` | `/api/v1/edge/subscriptions/:id/entitlements` | `entitlements` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/entitlements/publish` | `publish` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/entitlements/reconcile` | `reconcile` | `EdgeSubscriptionController` |
| `GET` | `/api/v1/edge/subscriptions/:id/associations` | `listTenantAssociations` | `EdgeSubscriptionController` |
| `GET` | `/api/v1/edge/subscriptions/:id/associations/active` | `getActiveTenantAssociation` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/associations/bind` | `bindTenantAssociation` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/associations/close` | `closeTenantAssociation` | `EdgeSubscriptionController` |
| `GET` | `/api/v1/edge/subscriptions/:id/changes` | `changes` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/changes` | `newChange` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/changes/:changeId/approve` | `approveChangeReq` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/changes/:changeId/reject` | `rejectChangeReq` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/changes/:changeId/schedule` | `scheduleChangeReq` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/changes/:changeId/execute` | `runChange` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/renewals` | `createRenewal` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/renewals/confirm` | `confirmRenewal` | `EdgeSubscriptionController` |
| `GET` | `/api/v1/edge/subscriptions/:id/renewals` | `renewals` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/billing-coordination` | `billingCoordination` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/billing-coordination/:coordId/confirm` | `confirmBillingCoordination` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/provisioning` | `provisioning` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/provisioning/:reqId/complete` | `completeProvisioning` | `EdgeSubscriptionController` |
| `POST` | `/api/v1/edge/subscriptions/:id/provisioning/advance-after-paid` | `advanceAfterPaid` | `EdgeSubscriptionController` |

### `tenant-management.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/tenants` | `searchTenants` | `EdgeTenantManagementController` |
| `GET` | `/api/v1/edge/tenants/export` | `exportTenantRegistry` | `EdgeTenantManagementController` |
| `GET` | `/api/v1/edge/tenants/analytics/portfolio` | `portfolioUnderTenants` | `EdgeTenantManagementController` |
| `GET` | `/api/v1/edge/tenant-management/analytics/portfolio` | `portfolioUnderManagement` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenants` | `register` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenants/sync-from-p7` | `syncP7` | `EdgeTenantManagementController` |
| `GET` | `/api/v1/edge/tenant-management/lifecycle-requests` | `listGlobalLifecycleRequests` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenant-management/lifecycle-requests/:id/approve` | `approveLifecycleRequest` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenant-management/lifecycle-requests/:id/reject` | `rejectLifecycleRequest` | `EdgeTenantManagementController` |
| `GET` | `/api/v1/edge/tenant-management/exceptions` | `listGlobalExceptions` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenant-management/exceptions` | `createException` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenant-management/exceptions/:id/approve` | `approveExceptionEndpoint` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenant-management/exceptions/:id/revoke` | `revokeExceptionEndpoint` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenant-management/exceptions/expire-due` | `expireDueExceptions` | `EdgeTenantManagementController` |
| `GET` | `/api/v1/edge/tenant-management/migrations` | `listGlobalMigrations` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenant-management/migrations` | `createMigration` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenant-management/migrations/:id/approve` | `approveMigrationEndpoint` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenant-management/migrations/:id/reject` | `rejectMigrationEndpoint` | `EdgeTenantManagementController` |
| `GET` | `/api/v1/edge/tenant-management/recoveries` | `listGlobalRecoveries` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenant-management/recoveries` | `createRecovery` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenant-management/recoveries/:id/approve` | `approveRecoveryEndpoint` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenant-management/recoveries/:id/reject` | `rejectRecoveryEndpoint` | `EdgeTenantManagementController` |
| `GET` | `/api/v1/edge/tenant-management/terminations` | `listGlobalTerminations` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenant-management/terminations` | `createTermination` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenant-management/terminations/:id/approve` | `approveTerminationEndpoint` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenant-management/terminations/:id/reject` | `rejectTerminationEndpoint` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenant-management/reconciliation/runs` | `reconciliationRun` | `EdgeTenantManagementController` |
| `GET` | `/api/v1/edge/tenant-management/reconciliation/findings` | `reconciliationFindings` | `EdgeTenantManagementController` |
| `GET` | `/api/v1/edge/tenant-management/reconciliation/runs` | `reconciliationRuns` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenant-management/reconciliation/findings/:id/acknowledge` | `acknowledgeReconciliationFinding` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenant-management/bulk/preview` | `bulkPreview` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenant-management/bulk/:id/execute` | `bulkExecute` | `EdgeTenantManagementController` |
| `GET` | `/api/v1/edge/tenant-management/bulk` | `listBulkOps` | `EdgeTenantManagementController` |
| `GET` | `/api/v1/edge/tenants/:id` | `getTenantById` | `EdgeTenantManagementController` |
| `GET` | `/api/v1/edge/tenants/:id/360` | `getTenant360ById` | `EdgeTenantManagementController` |
| `PATCH` | `/api/v1/edge/tenants/:id` | `patchTenant` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenants/:id/owner` | `assignTenantOwner` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenants/:id/tags` | `addTag` | `EdgeTenantManagementController` |
| `DELETE` | `/api/v1/edge/tenants/:id/tags` | `removeTag` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenants/:id/notes` | `addTenantNote` | `EdgeTenantManagementController` |
| `GET` | `/api/v1/edge/tenants/:id/activity` | `tenantActivity` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenants/:id/health-snapshots` | `postHealthSnapshot` | `EdgeTenantManagementController` |
| `GET` | `/api/v1/edge/tenants/:id/health-snapshots` | `getHealthSnapshots` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenants/:id/risk-assessments` | `postRiskAssessment` | `EdgeTenantManagementController` |
| `GET` | `/api/v1/edge/tenants/:id/risk-assessments` | `getRiskAssessments` | `EdgeTenantManagementController` |
| `PATCH` | `/api/v1/edge/tenants/:id/policies` | `patchTenantPolicies` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenants/:id/deprovision-authorization` | `postTenantDeprovisionAuthorization` | `EdgeTenantManagementController` |
| `GET` | `/api/v1/edge/tenant-management/legal-hold-requests` | `listLegalHoldRequests` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenant-management/legal-hold-requests/:id/approve` | `approveLegalHoldRequest` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenant-management/legal-hold-requests/:id/reject` | `rejectLegalHoldRequest` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenants/:id/legal-hold-requests` | `postTenantLegalHoldRequest` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenants/:id/legal-hold` | `postTenantLegalHold` | `EdgeTenantManagementController` |
| `POST` | `/api/v1/edge/tenants/:id/lifecycle-requests` | `tenantLifecycleRequest` | `EdgeTenantManagementController` |

### `verticals.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/verticals` | `listVerticals` | `EdgeVerticalsController` |
| `POST` | `/api/v1/edge/verticals` | `createVertical` | `EdgeVerticalsController` |
| `GET` | `/api/v1/edge/verticals/:id` | `getVertical` | `EdgeVerticalsController` |
| `PATCH` | `/api/v1/edge/verticals/:id` | `patchVertical` | `EdgeVerticalsController` |
| `GET` | `/api/v1/edge/verticals/:id/readiness` | `readinessCheck` | `EdgeVerticalsController` |
| `POST` | `/api/v1/edge/verticals/:id/activate` | `activateVertical` | `EdgeVerticalsController` |
| `POST` | `/api/v1/edge/verticals/:id/suspend` | `suspendVertical` | `EdgeVerticalsController` |
| `POST` | `/api/v1/edge/verticals/:id/reinstate` | `reinstateVertical` | `EdgeVerticalsController` |
| `POST` | `/api/v1/edge/verticals/:id/deactivate` | `deactivateVertical` | `EdgeVerticalsController` |
| `POST` | `/api/v1/edge/verticals/:id/deprecate` | `deprecateVertical` | `EdgeVerticalsController` |
| `POST` | `/api/v1/edge/verticals/:id/retire` | `retireVertical` | `EdgeVerticalsController` |
| `POST` | `/api/v1/edge/verticals/:id/archive` | `archiveVertical` | `EdgeVerticalsController` |
| `GET` | `/api/v1/edge/verticals/:id/history` | `verticalHistory` | `EdgeVerticalsController` |
| `GET` | `/api/v1/edge/verticals/:id/lifecycle-events` | `verticalLifecycleEvents` | `EdgeVerticalsController` |
| `GET` | `/api/v1/edge/verticals/:id/memberships` | `memberships` | `EdgeVerticalsController` |
| `POST` | `/api/v1/edge/verticals/:id/memberships/invite` | `inviteMember` | `EdgeVerticalsController` |
| `GET` | `/api/v1/edge/verticals/:id/configuration` | `configuration` | `EdgeVerticalsController` |
| `PUT` | `/api/v1/edge/verticals/:id/configuration/draft` | `updateConfigurationDraft` | `EdgeVerticalsController` |
| `POST` | `/api/v1/edge/verticals/:id/configuration/validate` | `validateConfiguration` | `EdgeVerticalsController` |
| `POST` | `/api/v1/edge/verticals/:id/configuration/activate` | `activateConfiguration` | `EdgeVerticalsController` |
| `GET` | `/api/v1/edge/verticals/:id/configuration/history` | `configurationHistory` | `EdgeVerticalsController` |
| `POST` | `/api/v1/edge/memberships/:id/activate` | `activateMembership` | `EdgeMembershipsController` |
| `POST` | `/api/v1/edge/memberships/:id/suspend` | `suspendMembership` | `EdgeMembershipsController` |
| `POST` | `/api/v1/edge/memberships/:id/reinstate` | `reinstateMembership` | `EdgeMembershipsController` |
| `POST` | `/api/v1/edge/memberships/:id/revoke` | `revokeMembership` | `EdgeMembershipsController` |

### `workflow-worker.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/workflow-workers` | `listWorkers` | `EdgeWorkflowWorkerController` |
| `POST` | `/api/v1/edge/workflow-workers/heartbeat` | `beat` | `EdgeWorkflowWorkerController` |
| `POST` | `/api/v1/edge/workflow-workers/claim` | `claimStep` | `EdgeWorkflowWorkerController` |
| `POST` | `/api/v1/edge/workflow-workers/steps/:stepId/renew` | `renewLease` | `EdgeWorkflowWorkerController` |
| `POST` | `/api/v1/edge/workflow-workers/steps/:stepId/complete` | `completeStep` | `EdgeWorkflowWorkerController` |
| `POST` | `/api/v1/edge/workflow-workers/steps/:stepId/fail` | `failStep` | `EdgeWorkflowWorkerController` |

### `workflow.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/workflows/definitions` | `listDefinitions` | `EdgeWorkflowController` |
| `GET` | `/api/v1/edge/workflows/definitions/:id` | `getDefinition` | `EdgeWorkflowController` |
| `POST` | `/api/v1/edge/workflows/definitions` | `createDef` | `EdgeWorkflowController` |
| `POST` | `/api/v1/edge/workflows/definitions/:id/validate` | `validateDef` | `EdgeWorkflowController` |
| `POST` | `/api/v1/edge/workflows/definitions/:id/publish` | `publishDef` | `EdgeWorkflowController` |
| `POST` | `/api/v1/edge/workflows/definitions/:id/deprecate` | `deprecateDef` | `EdgeWorkflowController` |
| `GET` | `/api/v1/edge/workflows/dead-letters` | `listDeadLetters` | `EdgeWorkflowController` |
| `GET` | `/api/v1/edge/workflows` | `list` | `EdgeWorkflowController` |
| `POST` | `/api/v1/edge/workflows` | `create` | `EdgeWorkflowController` |
| `GET` | `/api/v1/edge/workflows/:id` | `get` | `EdgeWorkflowController` |
| `GET` | `/api/v1/edge/workflows/:id/history` | `history` | `EdgeWorkflowController` |
| `GET` | `/api/v1/edge/workflows/:id/steps` | `steps` | `EdgeWorkflowController` |
| `GET` | `/api/v1/edge/workflows/:id/attempts` | `attempts` | `EdgeWorkflowController` |
| `GET` | `/api/v1/edge/workflows/:id/checkpoints` | `checkpoints` | `EdgeWorkflowController` |
| `GET` | `/api/v1/edge/workflows/:id/compensations` | `compensations` | `EdgeWorkflowController` |
| `POST` | `/api/v1/edge/workflows/:id/start` | `startWorkflow` | `EdgeWorkflowController` |
| `POST` | `/api/v1/edge/workflows/:id/pause` | `pauseWorkflow` | `EdgeWorkflowController` |
| `POST` | `/api/v1/edge/workflows/:id/resume` | `resumeWorkflow` | `EdgeWorkflowController` |
| `POST` | `/api/v1/edge/workflows/:id/cancel` | `cancelWorkflow` | `EdgeWorkflowController` |
| `POST` | `/api/v1/edge/workflows/:id/retry` | `retryWorkflow` | `EdgeWorkflowController` |
| `POST` | `/api/v1/edge/workflows/:id/reconcile` | `reconcileWorkflow` | `EdgeWorkflowController` |
| `POST` | `/api/v1/edge/workflows/:id/compensation/start` | `startComp` | `EdgeWorkflowController` |
| `POST` | `/api/v1/edge/workflows/:id/compensation/complete` | `completeComp` | `EdgeWorkflowController` |
| `GET` | `/api/v1/edge/workflow-tasks` | `list` | `EdgeWorkflowTasksController` |
| `GET` | `/api/v1/edge/workflow-tasks/:id` | `get` | `EdgeWorkflowTasksController` |
| `POST` | `/api/v1/edge/workflow-tasks/:id/assign` | `assignTask` | `EdgeWorkflowTasksController` |
| `POST` | `/api/v1/edge/workflow-tasks/:id/approve` | `approveTask` | `EdgeWorkflowTasksController` |
| `POST` | `/api/v1/edge/workflow-tasks/:id/reject` | `rejectTask` | `EdgeWorkflowTasksController` |
| `POST` | `/api/v1/edge/workflow-tasks/:id/complete` | `completeTask` | `EdgeWorkflowTasksController` |

### `workspaces.controller.ts`

| Method | Runtime (`/api/v1/...`) | Handler | Class |
|---|---|---|---|
| `GET` | `/api/v1/edge/workspaces` | `list` | `EdgeWorkspacesController` |
| `POST` | `/api/v1/edge/workspaces/switch` | `getOrThrow` | `EdgeWorkspacesController` |
| `POST` | `/api/v1/edge/workspaces/bootstrap` | `bootstrapWorkspace` | `EdgeWorkspacesController` |
| `GET` | `/api/v1/edge/workspaces/active` | `active` | `EdgeWorkspacesController` |
| `POST` | `/api/v1/edge/workspaces/renew` | `renewSession` | `EdgeWorkspacesController` |
| `POST` | `/api/v1/edge/workspaces/revoke` | `revokeSession` | `EdgeWorkspacesController` |
| `POST` | `/api/v1/edge/workspaces/revoke-all` | `revokeAllSessions` | `EdgeWorkspacesController` |

## Notes

1. Contrôleurs `@Controller()` vides (ops, acquisition, tenants, revenue, provisioning depth) placent le path complet sur `@Get('edge/...')`.
2. Auth : la plupart des routes Edge utilisent `EdgeAuthGuard` + `EdgePermissionGuard` + permissions `platform:*`.
3. Hors console : `workflow-worker`, integrations M2M P5, certaines routes lab.
4. Acquisition publique : `acquisition-public.controller` (sans session admin).
