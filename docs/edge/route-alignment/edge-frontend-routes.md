# Edge Frontend — Inventaire pages & clients API

> Généré par `saas-templates-backend/scripts/extract-edge-routes.py`.
>
> Surface console : `app/(edge-console)/edge/**`
> Acquisition publique : `app/(acquisition-public)/**`
> BFF : `app/api/edge-auth/**`, `edge-bootstrap`, `edge-backend/[...path]`
> Client : `lib/api/edge.ts` → `edgeApi.*`

**Pages console :** 59
**Pages acquisition publique :** 5
**Routes BFF :** 6
**Méthodes `edgeApi` :** 908

## Nav shell (groupes accordion)

| Groupe | Entrées typiques |
|---|---|
| Platform | Portfolio, Catalog, Commercial, Marketing, Sales, Acquisition, Revenue, Subscriptions, Billing |
| Tenants | Operations, Tenant Management, Provisioning Ops |
| Provisioning | Registry → Evidence (+ Keycloak) |
| Governance | Markets, Readiness, Verticals, Backends, Admins, Security, Audit |
| Workspace | Overview / Configuration / Administration (si vertical actif) |

## Pages console Edge

| URL | Fichier |
|---|---|
| `/edge/acquisition` | `app/(edge-console)/edge/acquisition/page.tsx` |
| `/edge/administrators/[id]` | `app/(edge-console)/edge/administrators/[id]/page.tsx` |
| `/edge/administrators` | `app/(edge-console)/edge/administrators/page.tsx` |
| `/edge/audit` | `app/(edge-console)/edge/audit/page.tsx` |
| `/edge/backends` | `app/(edge-console)/edge/backends/page.tsx` |
| `/edge/billing` | `app/(edge-console)/edge/billing/page.tsx` |
| `/edge/billing/portal` | `app/(edge-console)/edge/billing/portal/page.tsx` |
| `/edge/catalog/[productId]` | `app/(edge-console)/edge/catalog/[productId]/page.tsx` |
| `/edge/catalog/new` | `app/(edge-console)/edge/catalog/new/page.tsx` |
| `/edge/catalog` | `app/(edge-console)/edge/catalog/page.tsx` |
| `/edge/commercial` | `app/(edge-console)/edge/commercial/page.tsx` |
| `/edge/commercial/plans/[id]` | `app/(edge-console)/edge/commercial/plans/[id]/page.tsx` |
| `/edge/login` | `app/(edge-console)/edge/login/page.tsx` |
| `/edge/marketing` | `app/(edge-console)/edge/marketing/page.tsx` |
| `/edge/markets` | `app/(edge-console)/edge/markets/page.tsx` |
| `/edge/operations` | `app/(edge-console)/edge/operations/page.tsx` |
| `/edge` | `app/(edge-console)/edge/page.tsx` |
| `/edge/provisioning/agents` | `app/(edge-console)/edge/provisioning/agents/page.tsx` |
| `/edge/provisioning/capacity/decisions/[id]` | `app/(edge-console)/edge/provisioning/capacity/decisions/[id]/page.tsx` |
| `/edge/provisioning/capacity` | `app/(edge-console)/edge/provisioning/capacity/page.tsx` |
| `/edge/provisioning/capacity/requests/[id]` | `app/(edge-console)/edge/provisioning/capacity/requests/[id]/page.tsx` |
| `/edge/provisioning/certification` | `app/(edge-console)/edge/provisioning/certification/page.tsx` |
| `/edge/provisioning/configuration` | `app/(edge-console)/edge/provisioning/configuration/page.tsx` |
| `/edge/provisioning/evidence` | `app/(edge-console)/edge/provisioning/evidence/page.tsx` |
| `/edge/provisioning/experience` | `app/(edge-console)/edge/provisioning/experience/page.tsx` |
| `/edge/provisioning/infrastructure/databases/[id]` | `app/(edge-console)/edge/provisioning/infrastructure/databases/[id]/page.tsx` |
| `/edge/provisioning/infrastructure` | `app/(edge-console)/edge/provisioning/infrastructure/page.tsx` |
| `/edge/provisioning/infrastructure/resources/[id]` | `app/(edge-console)/edge/provisioning/infrastructure/resources/[id]/page.tsx` |
| `/edge/provisioning/keycloak` | `app/(edge-console)/edge/provisioning/keycloak/page.tsx` |
| `/edge/provisioning/lifecycle` | `app/(edge-console)/edge/provisioning/lifecycle/page.tsx` |
| `/edge/provisioning/onboarding` | `app/(edge-console)/edge/provisioning/onboarding/page.tsx` |
| `/edge/provisioning/product-controls/endpoints/[id]` | `app/(edge-console)/edge/provisioning/product-controls/endpoints/[id]/page.tsx` |
| `/edge/provisioning/product-controls/exchanges/[id]` | `app/(edge-console)/edge/provisioning/product-controls/exchanges/[id]/page.tsx` |
| `/edge/provisioning/product-controls` | `app/(edge-console)/edge/provisioning/product-controls/page.tsx` |
| `/edge/provisioning/readiness` | `app/(edge-console)/edge/provisioning/readiness/page.tsx` |
| `/edge/provisioning/reconciliation` | `app/(edge-console)/edge/provisioning/reconciliation/page.tsx` |
| `/edge/provisioning/registry/[section]/[id]` | `app/(edge-console)/edge/provisioning/registry/[section]/[id]/page.tsx` |
| `/edge/provisioning/registry` | `app/(edge-console)/edge/provisioning/registry/page.tsx` |
| `/edge/provisioning/workflows/[id]` | `app/(edge-console)/edge/provisioning/workflows/[id]/page.tsx` |
| `/edge/provisioning/workflows/definitions/[id]` | `app/(edge-console)/edge/provisioning/workflows/definitions/[id]/page.tsx` |
| `/edge/provisioning/workflows` | `app/(edge-console)/edge/provisioning/workflows/page.tsx` |
| `/edge/provisioning/workflows/tasks/[id]` | `app/(edge-console)/edge/provisioning/workflows/tasks/[id]/page.tsx` |
| `/edge/provisioning-requests/[id]` | `app/(edge-console)/edge/provisioning-requests/[id]/page.tsx` |
| `/edge/provisioning-requests` | `app/(edge-console)/edge/provisioning-requests/page.tsx` |
| `/edge/readiness` | `app/(edge-console)/edge/readiness/page.tsx` |
| `/edge/revenue` | `app/(edge-console)/edge/revenue/page.tsx` |
| `/edge/sales/opportunities/[id]` | `app/(edge-console)/edge/sales/opportunities/[id]/page.tsx` |
| `/edge/sales` | `app/(edge-console)/edge/sales/page.tsx` |
| `/edge/security` | `app/(edge-console)/edge/security/page.tsx` |
| `/edge/subscriptions/[id]` | `app/(edge-console)/edge/subscriptions/[id]/page.tsx` |
| `/edge/subscriptions` | `app/(edge-console)/edge/subscriptions/page.tsx` |
| `/edge/tenants/[id]` | `app/(edge-console)/edge/tenants/[id]/page.tsx` |
| `/edge/tenants` | `app/(edge-console)/edge/tenants/page.tsx` |
| `/edge/verticals/[id]` | `app/(edge-console)/edge/verticals/[id]/page.tsx` |
| `/edge/verticals/[id]/products` | `app/(edge-console)/edge/verticals/[id]/products/page.tsx` |
| `/edge/verticals` | `app/(edge-console)/edge/verticals/page.tsx` |
| `/edge/workspace/administration` | `app/(edge-console)/edge/workspace/administration/page.tsx` |
| `/edge/workspace/configuration` | `app/(edge-console)/edge/workspace/configuration/page.tsx` |
| `/edge/workspace` | `app/(edge-console)/edge/workspace/page.tsx` |

## Pages acquisition publique

| URL | Fichier |
|---|---|
| `/acquire/[slug]/apply` | `app/(acquisition-public)/acquire/[slug]/apply/page.tsx` |
| `/acquire/[slug]` | `app/(acquisition-public)/acquire/[slug]/page.tsx` |
| `/acquire/checkout/[sessionId]` | `app/(acquisition-public)/acquire/checkout/[sessionId]/page.tsx` |
| `/acquire` | `app/(acquisition-public)/acquire/page.tsx` |
| `/acquire/portal` | `app/(acquisition-public)/acquire/portal/page.tsx` |

## BFF Next.js

| URL | Fichier | Rôle |
|---|---|---|
| `/api/edge-auth/login` | callback OAuth start | PKCE login |
| `/api/edge-auth/callback` | code exchange | session iron |
| `/api/edge-auth/session` | session JSON | bootstrap auth |
| `/api/edge-auth/logout` | destroy session | |
| `/api/edge-bootstrap` | me + workspaces + permissions | |
| `/api/edge-backend/*` | proxy → Nest `/api/v1/*` | |

## Client `edgeApi` (extrait méthodes)

| Méthode FE | HTTP | Path(s) |
|---|---|---|
| `bootstrap` | `GET` | `/api/edge-bootstrap` |
| `session` | `GET` | `/api/edge-auth/session` |
| `logout` | `POST` | — |
| `me` | `GET` | `/api/edge-backend/administrators/me` |
| `listWorkspaces` | `GET` | `/api/edge-backend/workspaces` |
| `switchWorkspace` | `POST` | `/api/edge-backend/workspaces/switch` |
| `bootstrapWorkspace` | `POST` | `/api/edge-backend/workspaces/bootstrap` |
| `activeWorkspace` | `GET` | `/api/edge-backend/workspaces/active` |
| `renewWorkspaceSession` | `POST` | `/api/edge-backend/workspaces/renew` |
| `revokeWorkspaceSession` | `POST` | `/api/edge-backend/workspaces/revoke` |
| `revokeAllWorkspaceSessions` | `POST` | `/api/edge-backend/workspaces/revoke-all` |
| `listVerticals` | `GET` | `/api/edge-backend/verticals${query ? "?" + query : ""}` |
| `getVertical` | `GET` | `/api/edge-backend/verticals/${id}` |
| `createVertical` | `POST` | `/api/edge-backend/verticals` |
| `updateVertical` | `PATCH` | `/api/edge-backend/verticals/${id}` |
| `getVerticalReadiness` | `GET` | `/api/edge-backend/verticals/${id}/readiness` |
| `activateVertical` | `POST` | `/api/edge-backend/verticals/${id}/activate` |
| `suspendVertical` | `POST` | `/api/edge-backend/verticals/${id}/suspend` |
| `reinstateVertical` | `POST` | `/api/edge-backend/verticals/${id}/reinstate` |
| `deactivateVertical` | `POST` | `/api/edge-backend/verticals/${id}/deactivate` |
| `deprecateVertical` | `POST` | `/api/edge-backend/verticals/${id}/deprecate` |
| `retireVertical` | `POST` | `/api/edge-backend/verticals/${id}/retire` |
| `archiveVertical` | `POST` | `/api/edge-backend/verticals/${id}/archive` |
| `listVerticalLifecycleEvents` | `GET` | `/api/edge-backend/verticals/${id}/lifecycle-events?${query}` |
| `listVerticalHistory` | `GET` | `/api/edge-backend/verticals/${id}/history?${query}` |
| `listAdministrators` | `GET` | `/api/edge-backend/administrators?${query}` |
| `getAdministrator` | `GET` | `/api/edge-backend/administrators/${id}` |
| `inviteAdministrator` | `POST` | `/api/edge-backend/administrators/invite` |
| `updateAdministrator` | `PATCH` | `/api/edge-backend/administrators/${id}` |
| `suspendAdministrator` | `POST` | `/api/edge-backend/administrators/${id}/suspend` |
| `reinstateAdministrator` | `POST` | `/api/edge-backend/administrators/${id}/reinstate` |
| `deactivateAdministrator` | `POST` | `/api/edge-backend/administrators/${id}/deactivate` |
| `listAdministratorMemberships` | `GET` | `/api/edge-backend/administrators/${id}/memberships` |
| `getAdministratorEffectivePermissions` | `GET` | `/api/edge-backend/administrators/${id}/effective-permissions${toQuery({
        verticalId,
      })}` |
| `acceptInvitation` | `POST` | `/api/edge-backend/invitations/accept` |
| `listEdgeRoles` | `GET` | `/api/edge-backend/roles${toQuery({ scope })}` |
| `createEdgeRole` | `POST` | `/api/edge-backend/roles` |
| `updateEdgeRole` | `PATCH` | `/api/edge-backend/roles/${id}` |
| `listEdgePermissionsCatalog` | `GET` | `/api/edge-backend/permissions` |
| `assignEdgeRole` | `POST` | `/api/edge-backend/role-assignments` |
| `revokeEdgeRoleAssignment` | `DELETE` | `/api/edge-backend/role-assignments/${id}` |
| `listSecuritySessions` | `GET` | `/api/edge-backend/security/sessions${toQuery({ administratorId })}` |
| `revokeSecuritySession` | `POST` | `/api/edge-backend/security/sessions/${sessionId}/revoke` |
| `revokeAllSecuritySessions` | `POST` | `/api/edge-backend/security/sessions/revoke-all` |
| `getSecurityMfaState` | `GET` | `/api/edge-backend/security/mfa` |
| `requestEmergencyAccess` | `POST` | `/api/edge-backend/security/emergency-access` |
| `approveEmergencyAccess` | `POST` | `/api/edge-backend/security/emergency-access/${id}/approve` |
| `revokeEmergencyAccess` | `POST` | `/api/edge-backend/security/emergency-access/${id}/revoke` |
| `listSecurityDelegations` | `GET` | `/api/edge-backend/security/delegations` |
| `createSecurityDelegation` | `POST` | `/api/edge-backend/security/delegations` |
| `revokeSecurityDelegation` | `POST` | `/api/edge-backend/security/delegations/${id}/revoke` |
| `listAuditEvents` | `GET` | `/api/edge-backend/security/events?${query}` |
| `getWorkspaceConfiguration` | `GET` | `/api/edge-backend/verticals/${verticalId}/configuration` |
| `updateWorkspaceConfigurationDraft` | `PUT` | `/api/edge-backend/verticals/${verticalId}/configuration/draft` |
| `validateWorkspaceConfiguration` | `POST` | `/api/edge-backend/verticals/${verticalId}/configuration/validate` |
| `activateWorkspaceConfiguration` | `POST` | `/api/edge-backend/verticals/${verticalId}/configuration/activate` |
| `listWorkspaceConfigurationHistory` | `GET` | `/api/edge-backend/verticals/${verticalId}/configuration/history` |
| `listVerticalMemberships` | `GET` | `/api/edge-backend/verticals/${verticalId}/memberships` |
| `inviteVerticalMembership` | `POST` | `/api/edge-backend/verticals/${verticalId}/memberships/invite` |
| `activateMembership` | `POST` | `/api/edge-backend/memberships/${membershipId}/activate` |
| `suspendMembership` | `POST` | `/api/edge-backend/memberships/${membershipId}/suspend` |
| `reinstateMembership` | `POST` | `/api/edge-backend/memberships/${membershipId}/reinstate` |
| `revokeMembership` | `POST` | `/api/edge-backend/memberships/${membershipId}/revoke` |
| `listProducts` | `GET` | `/api/edge-backend/products${toQuery({
        page: opts?.page ?? 1,
        limit: opts?.limit ?? 50,
        verticalId: opts?.verticalId,
        status: opts?.status,
      })}` |
| `getProduct` | `GET` | `/api/edge-backend/products/${id}` |
| `createProduct` | `POST` | `/api/edge-backend/products` |
| `updateProduct` | `PATCH` | `/api/edge-backend/products/${id}` |
| `transitionProductLifecycle` | `POST` | `/api/edge-backend/products/${id}/lifecycle` |
| `publishProduct` | `POST` | `/api/edge-backend/products/${id}/publish` |
| `listProductVersions` | `GET` | `/api/edge-backend/products/${productId}/versions` |
| `createProductVersion` | `POST` | `/api/edge-backend/products/${productId}/versions` |
| `getProductVersion` | `GET` | `/api/edge-backend/products/${productId}/versions/${versionId}` |
| `updateProductVersion` | `PATCH` | `/api/edge-backend/products/${productId}/versions/${versionId}` |
| `publishProductVersion` | `POST` | `/api/edge-backend/products/${productId}/versions/${versionId}/publish` |
| `listCompatibilities` | `GET` | `/api/edge-backend/products/${productId}/compatibilities` |
| `upsertCompatibility` | `PUT` | `/api/edge-backend/products/${productId}/compatibilities` |
| `listProductCapabilityMappings` | `GET` | `/api/edge-backend/products/${productId}/capabilities` |
| `upsertProductCapabilityMapping` | `PUT` | `/api/edge-backend/products/${productId}/capabilities` |
| `listProductBackendBindings` | `GET` | `/api/edge-backend/products/${productId}/bindings` |
| `createProductBackendBinding` | `POST` | `/api/edge-backend/products/${productId}/bindings` |
| `listMarketSegments` | `GET` | `/api/edge-backend/market-segments${toQuery({ verticalId })}` |
| `createMarketSegment` | `POST` | `/api/edge-backend/market-segments` |
| `getMarketSegment` | `GET` | `/api/edge-backend/market-segments/${id}` |
| `updateMarketSegment` | `PATCH` | `/api/edge-backend/market-segments/${id}` |
| `listBusinessProfiles` | `GET` | `/api/edge-backend/business-profiles${toQuery({ verticalId })}` |
| `getBusinessProfile` | `GET` | `/api/edge-backend/business-profiles/${id}` |
| `createBusinessProfile` | `POST` | `/api/edge-backend/business-profiles` |
| `listOperatingModels` | `GET` | `/api/edge-backend/operating-models${toQuery({ verticalId })}` |
| `getOperatingModel` | `GET` | `/api/edge-backend/operating-models/${id}` |
| `createOperatingModel` | `POST` | `/api/edge-backend/operating-models` |
| `listCapabilities` | `GET` | `/api/edge-backend/capabilities` |
| `getCapability` | `GET` | `/api/edge-backend/capabilities/${id}` |
| `createCapability` | `POST` | `/api/edge-backend/capabilities` |
| `addCapabilityDependency` | `POST` | `/api/edge-backend/capabilities/${id}/dependencies` |
| `listIntegrationContracts` | `GET` | `/api/edge-backend/integration-contracts` |
| `getIntegrationContract` | `GET` | `/api/edge-backend/integration-contracts/${id}` |
| `createIntegrationContract` | `POST` | `/api/edge-backend/integration-contracts` |
| `listBackends` | `GET` | `/api/edge-backend/backends` |
| `getBackend` | `GET` | `/api/edge-backend/backends/${id}` |
| `createBackend` | `POST` | `/api/edge-backend/backends` |
| `evaluateReadiness` | `POST` | `/api/edge-backend/products/${productId}/readiness` |
| `listReadinessEvaluations` | `GET` | `/api/edge-backend/readiness-evaluations${toQuery({
        page: opts?.page ?? 1,
        limit: opts?.limit ?? 50,
        productId: opts?.productId,
      })}` |
| `listCommercialMarkets` | `GET` | `/api/edge-backend/commercial/markets${toQuery({
        page: opts?.page ?? 1,
        limit: opts?.limit ?? 50,
        verticalId: opts?.verticalId,
      })}` |
| `createCommercialMarket` | `POST` | `/api/edge-backend/commercial/markets` |
| `listCommercialIcps` | `GET` | `/api/edge-backend/commercial/icps${toQuery({ productId })}` |
| `createCommercialIcp` | `POST` | `/api/edge-backend/commercial/icps` |
| `listSolutionPackages` | `GET` | `/api/edge-backend/commercial/packages${toQuery({ productId })}` |
| `createSolutionPackage` | `POST` | `/api/edge-backend/commercial/packages` |
| `listCommercialPlans` | `GET` | `/api/edge-backend/commercial/plans${toQuery({ productId })}` |
| `getCommercialPlan` | `GET` | `/api/edge-backend/commercial/plans/${planId}` |
| `listPriceBookEntries` | `GET` | `/api/edge-backend/commercial/price-books/${priceBookId}/entries` |
| `createCommercialPlan` | `POST` | `/api/edge-backend/commercial/plans` |
| `evaluateCommercialPlanReadiness` | `POST` | `/api/edge-backend/commercial/plans/${planId}/readiness` |
| `publishCommercialPlan` | `POST` | `/api/edge-backend/commercial/plans/${planId}/publish` |
| `listCommercialAddons` | `GET` | `/api/edge-backend/commercial/addons${toQuery({ productId })}` |
| `createCommercialAddon` | `POST` | `/api/edge-backend/commercial/addons` |
| `listPriceBooks` | `GET` | `/api/edge-backend/commercial/price-books${toQuery({ productId })}` |
| `createPriceBook` | `POST` | `/api/edge-backend/commercial/price-books` |
| `addPriceBookEntry` | `POST` | `/api/edge-backend/commercial/price-books/${priceBookId}/entries` |
| `listPricingUnits` | `GET` | `/api/edge-backend/commercial/pricing-units` |
| `previewCommercialPrice` | `POST` | `/api/edge-backend/commercial/pricing/preview` |
| `runCommercialOfferWizard` | `POST` | `/api/edge-backend/commercial/offers/wizard` |
| `listGeographicPricingRules` | `GET` | `/api/edge-backend/commercial/pricing/geographic-rules${toQuery({ country })}` |
| `evaluateDiscountApproval` | `POST` | `/api/edge-backend/commercial/discounts/evaluate-approval` |
| `getSalesEngineBeachhead` | `GET` | `/api/edge-backend/sales/engine/beachhead` |
| `scoreSalesLead` | `POST` | `/api/edge-backend/sales/engine/lead-score` |
| `evaluateSalesBant` | `POST` | `/api/edge-backend/sales/engine/bant` |
| `configureCommercialOffer` | `POST` | `/api/edge-backend/commercial/offers/configure` |
| `getCommercialCatalog` | `GET` | `/api/edge-backend/commercial/catalog${toQuery({
        view: opts?.view ?? "GLOBAL",
        productId: opts?.productId,
        verticalId: opts?.verticalId,
      })}` |
| `listPublicationSnapshots` | `GET` | `/api/edge-backend/commercial/publication-snapshots${toQuery({
        offerType: opts?.offerType,
        offerId: opts?.offerId,
        productId: opts?.productId,
      })}` |
| `listResearchProjects` | `GET` | `/api/edge-backend/commercial/research-projects${toQuery({ marketId })}` |
| `createCommercialResearchProject` | `POST` | `/api/edge-backend/commercial/research-projects` |
| `upsertCommercialSegmentIntelligence` | `POST` | `/api/edge-backend/commercial/segment-intelligence` |
| `listSegmentIntelligence` | `GET` | `/api/edge-backend/commercial/segment-intelligence${toQuery({
        segmentId,
      })}` |
| `listEnterpriseTemplates` | `GET` | `/api/edge-backend/commercial/enterprise-templates${toQuery({
        productId,
      })}` |
| `createEnterpriseTemplate` | `POST` | `/api/edge-backend/commercial/enterprise-templates` |
| `listPersonas` | `GET` | `/api/edge-backend/commercial/personas${toQuery({ productId })}` |
| `listValuePropositions` | `GET` | `/api/edge-backend/commercial/value-propositions${toQuery({
        productId,
      })}` |
| `listEligibilityPolicies` | `GET` | `/api/edge-backend/commercial/eligibility-policies${toQuery({
        productId,
      })}` |
| `listCommercialDiscountPolicies` | `GET` | `/api/edge-backend/commercial/discount-policies${toQuery({ productId })}` |
| `createCommercialDiscountPolicy` | `POST` | `/api/edge-backend/commercial/discount-policies` |
| `listCommercialPricingModels` | `GET` | `/api/edge-backend/commercial/pricing-models${toQuery({ productId })}` |
| `createCommercialPricingModel` | `POST` | `/api/edge-backend/commercial/pricing-models` |
| `listCommercialUsageMetrics` | `GET` | `/api/edge-backend/commercial/usage-metrics` |
| `createCommercialUsageMetric` | `POST` | `/api/edge-backend/commercial/usage-metrics` |
| `listBuyingCommittees` | `GET` | `/api/edge-backend/commercial/buying-committees${toQuery({ productId })}` |
| `createBuyingCommittee` | `POST` | `/api/edge-backend/commercial/buying-committees` |
| `listDecisionJourneys` | `GET` | `/api/edge-backend/commercial/decision-journeys${toQuery({ productId })}` |
| `createDecisionJourney` | `POST` | `/api/edge-backend/commercial/decision-journeys` |
| `publishSolutionPackage` | `POST` | `/api/edge-backend/commercial/packages/${packageId}/publish` |
| `publishPriceBook` | `POST` | `/api/edge-backend/commercial/price-books/${priceBookId}/publish` |
| `publishCommercialAddon` | `POST` | `/api/edge-backend/commercial/addons/${addonId}/publish` |
| `getSolutionPackage` | `GET` | `/api/edge-backend/commercial/packages/${id}` |
| `addSolutionPackageCapability` | `POST` | `/api/edge-backend/commercial/packages/${packageId}/capabilities` |
| `addCommercialPlanCapability` | `POST` | `/api/edge-backend/commercial/plans/${planId}/capabilities` |
| `linkCommercialAddonPlan` | `POST` | `/api/edge-backend/commercial/addons/${addonId}/plans` |
| `addCommercialAddonCapability` | `POST` | `/api/edge-backend/commercial/addons/${addonId}/capabilities` |
| `listCommercialMarketAssessments` | `GET` | `/api/edge-backend/commercial/markets/${marketId}/assessments` |
| `createCommercialMarketAssessment` | `POST` | `/api/edge-backend/commercial/markets/${marketId}/assessments` |
| `addCommercialResearchSource` | `POST` | `/api/edge-backend/commercial/research-projects/${projectId}/sources` |
| `completeCommercialResearchProject` | `POST` | `/api/edge-backend/commercial/research-projects/${projectId}/complete` |
| `scoreCommercialSegmentIntelligence` | `POST` | `/api/edge-backend/commercial/segment-intelligence/${segmentId}/score` |
| `publishEnterpriseTemplate` | `POST` | `/api/edge-backend/commercial/enterprise-templates/${templateId}/publish` |
| `evaluateOfferReadiness` | `POST` | `/api/edge-backend/commercial/offers/${offerType}/${offerId}/readiness` |
| `listMarketingStrategies` | `GET` | `/api/edge-backend/marketing/strategies${toQuery({
        productId: opts?.productId,
        verticalId: opts?.verticalId,
      })}` |
| `createMarketingStrategy` | `POST` | `/api/edge-backend/marketing/strategies` |
| `listMarketingAudiences` | `GET` | `/api/edge-backend/marketing/audiences${toQuery({ productId })}` |
| `createMarketingAudience` | `POST` | `/api/edge-backend/marketing/audiences` |
| `listMarketingCampaigns` | `GET` | `/api/edge-backend/marketing/campaigns${toQuery({
        productId: opts?.productId,
        status: opts?.status,
      })}` |
| `getMarketingCampaign` | `GET` | `/api/edge-backend/marketing/campaigns/${id}` |
| `createMarketingCampaign` | `POST` | `/api/edge-backend/marketing/campaigns` |
| `transitionMarketingCampaign` | `POST` | `/api/edge-backend/marketing/campaigns/${id}/transition` |
| `approveMarketingCampaign` | `POST` | `/api/edge-backend/marketing/campaigns/${id}/approvals` |
| `publishMarketingCampaign` | `POST` | `/api/edge-backend/marketing/campaigns/${id}/publish` |
| `listMarketingForms` | `GET` | `/api/edge-backend/marketing/forms${toQuery({ productId })}` |
| `createMarketingForm` | `POST` | `/api/edge-backend/marketing/forms` |
| `publishMarketingForm` | `POST` | `/api/edge-backend/marketing/forms/${id}/publish` |
| `submitMarketingFormPublic` | `POST` | `/api/edge-backend/marketing/forms/public/${slug}/submissions` |
| `listMarketingLeads` | `GET` | `/api/edge-backend/marketing/leads${toQuery({
        status: opts?.status,
        productId: opts?.productId,
      })}` |
| `getMarketingLead` | `GET` | `/api/edge-backend/marketing/leads/${id}` |
| `withdrawMarketingLeadConsent` | `PATCH` | `/api/edge-backend/marketing/leads/${id}/consents/withdraw` |
| `scoreMarketingLead` | `POST` | `/api/edge-backend/marketing/leads/${id}/score` |
| `listMarketingBudgets` | `GET` | `/api/edge-backend/marketing/budgets` |
| `createMarketingBudget` | `POST` | `/api/edge-backend/marketing/budgets` |
| `listMarketingContents` | `GET` | `/api/edge-backend/marketing/contents${toQuery({ productId })}` |
| `createMarketingContent` | `POST` | `/api/edge-backend/marketing/contents` |
| `approveMarketingContent` | `POST` | `/api/edge-backend/marketing/contents/${id}/approve` |
| `publishMarketingContent` | `POST` | `/api/edge-backend/marketing/contents/${id}/publish` |
| `updateMarketingContentStudio` | `PUT` | `/api/edge-backend/marketing/contents/${id}/studio` |
| `listMarketingLandingPages` | `GET` | `/api/edge-backend/marketing/landing-pages${toQuery({ productId })}` |
| `createMarketingLandingPage` | `POST` | `/api/edge-backend/marketing/landing-pages` |
| `publishMarketingLandingPage` | `POST` | `/api/edge-backend/marketing/landing-pages/${id}/publish` |
| `updateMarketingLandingStudio` | `PUT` | `/api/edge-backend/marketing/landing-pages/${id}/studio` |
| `listMarketingChannels` | `GET` | `/api/edge-backend/marketing/channels` |
| `upsertMarketingChannel` | `POST` | `/api/edge-backend/marketing/channels` |
| `listMarketingTemplates` | `GET` | `/api/edge-backend/marketing/templates` |
| `createMarketingTemplate` | `POST` | `/api/edge-backend/marketing/templates` |
| `requestMarketingDelivery` | `POST` | `/api/edge-backend/marketing/deliveries/request` |
| `listMarketingSuppressions` | `GET` | `/api/edge-backend/marketing/suppressions${toQuery({
        activeOnly:
          opts?.activeOnly === undefined
            ? undefined
            : opts.activeOnly
              ? "true"
              : "false",
      })}` |
| `createMarketingSuppression` | `POST` | `/api/edge-backend/marketing/suppressions` |
| `listMarketingJourneys` | `GET` | `/api/edge-backend/marketing/journeys` |
| `createMarketingJourney` | `POST` | `/api/edge-backend/marketing/journeys` |
| `activateMarketingJourney` | `POST` | `/api/edge-backend/marketing/journeys/${id}/activate` |
| `startMarketingJourneyExecution` | `POST` | `/api/edge-backend/marketing/journeys/${id}/executions` |
| `listMarketingAttributionModels` | `GET` | `/api/edge-backend/marketing/attribution/models` |
| `calculateMarketingAttribution` | `POST` | `/api/edge-backend/marketing/attribution/calculate` |
| `ingestMarketingDeliveryReceipt` | `POST` | `/api/edge-backend/marketing/deliveries/receipts` |
| `listMarketingAnalyticsSnapshots` | `GET` | `/api/edge-backend/marketing/analytics/snapshots${toQuery({ scopeType })}` |
| `getMarketingAnalyticsSummary` | `GET` | `/api/edge-backend/marketing/analytics/summary${toQuery({ scopeType })}` |
| `createMarketingAnalyticsSnapshot` | `POST` | `/api/edge-backend/marketing/analytics/snapshots` |
| `resumeMarketingJourneyWaits` | `POST` | `/api/edge-backend/marketing/journeys/waits/resume` |
| `assignMarketingLead` | `POST` | `/api/edge-backend/marketing/leads/${id}/assign` |
| `mergeMarketingLeads` | `POST` | `/api/edge-backend/marketing/leads/merge` |
| `getSalesOverview` | `GET` | `/api/edge-backend/sales/overview` |
| `listSalesAccounts` | `GET` | `/api/edge-backend/sales/accounts${toQuery({
        status: opts?.status,
        q: opts?.q,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `createSalesAccount` | `POST` | `/api/edge-backend/sales/accounts` |
| `getSalesAccount` | `GET` | `/api/edge-backend/sales/accounts/${id}` |
| `getSalesAccountTimeline` | `GET` | `/api/edge-backend/sales/accounts/${id}/timeline` |
| `listSalesContacts` | `GET` | `/api/edge-backend/sales/contacts${toQuery({
        accountId: opts?.accountId,
        q: opts?.q,
      })}` |
| `createSalesContact` | `POST` | `/api/edge-backend/sales/contacts` |
| `listSalesLeads` | `GET` | `/api/edge-backend/sales/leads${toQuery({
        status: opts?.status,
        limit: opts?.limit,
      })}` |
| `receiveSalesLead` | `POST` | `/api/edge-backend/sales/leads/receive` |
| `acceptSalesLead` | `POST` | `/api/edge-backend/sales/leads/${id}/acceptance` |
| `rejectSalesLead` | `POST` | `/api/edge-backend/sales/leads/${id}/rejection` |
| `qualifySalesLead` | `POST` | `/api/edge-backend/sales/leads/${id}/qualification` |
| `listSalesTeams` | `GET` | `/api/edge-backend/sales/teams` |
| `createSalesTeam` | `POST` | `/api/edge-backend/sales/teams` |
| `listSalesTerritories` | `GET` | `/api/edge-backend/sales/territories` |
| `createSalesTerritory` | `POST` | `/api/edge-backend/sales/territories` |
| `createSalesNote` | `POST` | `/api/edge-backend/sales/notes` |
| `listSalesTasks` | `GET` | `/api/edge-backend/sales/tasks${toQuery({
        accountId: opts?.accountId,
        status: opts?.status,
      })}` |
| `createSalesTask` | `POST` | `/api/edge-backend/sales/tasks` |
| `completeSalesTask` | `POST` | `/api/edge-backend/sales/tasks/${id}/complete` |
| `listSalesPipelines` | `GET` | `/api/edge-backend/sales/pipelines` |
| `getSalesPipelineBoard` | `GET` | `/api/edge-backend/sales/pipeline/board${toQuery({ pipelineId })}` |
| `listSalesOpportunities` | `GET` | `/api/edge-backend/sales/opportunities${toQuery({
        status: opts?.status,
        accountId: opts?.accountId,
        limit: opts?.limit,
      })}` |
| `createSalesOpportunity` | `POST` | `/api/edge-backend/sales/opportunities` |
| `getSalesOpportunity` | `GET` | `/api/edge-backend/sales/opportunities/${id}` |
| `transitionSalesOpportunityStage` | `POST` | `/api/edge-backend/sales/opportunities/${id}/stages` |
| `reopenSalesOpportunity` | `POST` | `/api/edge-backend/sales/opportunities/${id}/reopen` |
| `listSalesActivities` | `GET` | `/api/edge-backend/sales/activities${toQuery({
        accountId: opts?.accountId,
        opportunityId: opts?.opportunityId,
        status: opts?.status,
      })}` |
| `createSalesActivity` | `POST` | `/api/edge-backend/sales/activities` |
| `listSalesQuotes` | `GET` | `/api/edge-backend/sales/quotes${toQuery({
        opportunityId: opts?.opportunityId,
        status: opts?.status,
      })}` |
| `createSalesQuote` | `POST` | `/api/edge-backend/sales/quotes` |
| `transitionSalesQuote` | `POST` | `/api/edge-backend/sales/quotes/${id}/transition` |
| `listSalesDiscountRequests` | `GET` | `/api/edge-backend/sales/discount-requests${toQuery({
        status: opts?.status,
      })}` |
| `createSalesDiscountRequest` | `POST` | `/api/edge-backend/sales/discount-requests` |
| `decideSalesDiscountRequest` | `POST` | `/api/edge-backend/sales/discount-requests/${id}/decision` |
| `listSalesContracts` | `GET` | `/api/edge-backend/sales/contracts${toQuery({
        opportunityId: opts?.opportunityId,
        status: opts?.status,
      })}` |
| `createSalesContract` | `POST` | `/api/edge-backend/sales/contracts` |
| `transitionSalesContract` | `POST` | `/api/edge-backend/sales/contracts/${id}/transition` |
| `listSalesOrders` | `GET` | `/api/edge-backend/sales/orders${toQuery({ status: opts?.status })}` |
| `createSalesOrder` | `POST` | `/api/edge-backend/sales/orders` |
| `requestSalesHandoff` | `POST` | `/api/edge-backend/sales/orders/${orderId}/handoff` |
| `getSalesForecast` | `GET` | `/api/edge-backend/sales/forecast${toQuery({
        model: opts?.model,
        productId: opts?.productId,
      })}` |
| `getSalesPerformance` | `GET` | `/api/edge-backend/sales/analytics/performance` |
| `listSalesProposals` | `GET` | `/api/edge-backend/sales/proposals${toQuery({ opportunityId })}` |
| `createSalesProposal` | `POST` | `/api/edge-backend/sales/proposals` |
| `issueSalesProposal` | `POST` | `/api/edge-backend/sales/proposals/${id}/issue` |
| `listOpportunityAssessments` | `GET` | `/api/edge-backend/sales/opportunities/${opportunityId}/assessments` |
| `createOpportunityAssessment` | `POST` | `/api/edge-backend/sales/opportunities/${opportunityId}/assessments` |
| `completeSalesAssessment` | `POST` | `/api/edge-backend/sales/assessments/${assessmentId}/complete` |
| `validateSalesAssessmentSolutionFit` | `POST` | `/api/edge-backend/sales/assessments/${assessmentId}/solution-fit` |
| `executeSalesAmendment` | `POST` | `/api/edge-backend/sales/amendments/${amendmentId}/execute` |
| `grantSalesVisibility` | `POST` | `/api/edge-backend/sales/visibility/grants` |
| `listSalesVisibilityGrants` | `GET` | `/api/edge-backend/sales/visibility/grants${toQuery({
        subjectType,
        subjectId,
      })}` |
| `assertSalesVisibility` | `POST` | `/api/edge-backend/sales/visibility/assert` |
| `listSalesHandoffs` | `GET` | `/api/edge-backend/sales/handoffs${toQuery({ status: opts?.status })}` |
| `acceptSalesHandoff` | `POST` | `/api/edge-backend/sales/handoffs/${id}/accept` |
| `receiveSalesProvisioningStatus` | `POST` | `/api/edge-backend/sales/handoffs/${id}/provisioning-status` |
| `searchSales` | `GET` | `/api/edge-backend/sales/search${toQuery({
        q: opts.q,
        visibilityMode: opts.visibilityMode,
        limit: opts.limit,
      })}` |
| `getSalesAccountHierarchy` | `GET` | `/api/edge-backend/sales/accounts/${id}/hierarchy` |
| `listSalesQuestionnaires` | `GET` | `/api/edge-backend/sales/questionnaires` |
| `createSalesQuestionnaire` | `POST` | `/api/edge-backend/sales/questionnaires` |
| `listSalesSavedViews` | `GET` | `/api/edge-backend/sales/views${toQuery({ entityType })}` |
| `createSalesSavedView` | `POST` | `/api/edge-backend/sales/views` |
| `exportSalesEntities` | `POST` | `/api/edge-backend/sales/exports` |
| `generateSalesProposalDocument` | `POST` | `/api/edge-backend/sales/proposals/${id}/document` |
| `listSalesApprovals` | `GET` | `/api/edge-backend/sales/approvals${toQuery({
        status: opts?.status,
        subjectType: opts?.subjectType,
      })}` |
| `decideSalesApproval` | `POST` | `/api/edge-backend/sales/approvals/${id}/decision` |
| `persistSalesForecastSnapshot` | `POST` | `/api/edge-backend/sales/forecast/snapshots` |
| `addSalesAccountRelationship` | `POST` | `/api/edge-backend/sales/accounts/${accountId}/relationships` |
| `findSalesAccountDuplicates` | `POST` | `/api/edge-backend/sales/accounts/duplicates` |
| `mergeSalesAccounts` | `POST` | `/api/edge-backend/sales/accounts/merge` |
| `syncSalesActivityCalendar` | `POST` | `/api/edge-backend/sales/activities/${activityId}/calendar-sync` |
| `completeSalesActivity` | `POST` | `/api/edge-backend/sales/activities/${id}/complete` |
| `getSalesContact` | `GET` | `/api/edge-backend/sales/contacts/${id}` |
| `listSalesContactRoles` | `GET` | `/api/edge-backend/sales/contacts/${contactId}/roles` |
| `addSalesContactRole` | `POST` | `/api/edge-backend/sales/contacts/${contactId}/roles` |
| `listSalesContractAmendments` | `GET` | `/api/edge-backend/sales/contracts/${contractId}/amendments` |
| `createSalesContractAmendment` | `POST` | `/api/edge-backend/sales/contracts/${contractId}/amendments` |
| `getSalesLead` | `GET` | `/api/edge-backend/sales/leads/${id}` |
| `assignSalesLead` | `POST` | `/api/edge-backend/sales/leads/${id}/assignment` |
| `closeSalesOpportunity` | `POST` | `/api/edge-backend/sales/opportunities/${id}/close` |
| `addSalesOpportunityRisk` | `POST` | `/api/edge-backend/sales/opportunities/${opportunityId}/risks` |
| `addSalesOpportunityCompetitor` | `POST` | `/api/edge-backend/sales/opportunities/${opportunityId}/competitors` |
| `addSalesOpportunityContact` | `POST` | `/api/edge-backend/sales/opportunities/${opportunityId}/contacts` |
| `listSalesOpportunityOffers` | `GET` | `/api/edge-backend/sales/opportunities/${opportunityId}/offers` |
| `createSalesOpportunityOffer` | `POST` | `/api/edge-backend/sales/opportunities/${opportunityId}/offers` |
| `listSalesOrderLines` | `GET` | `/api/edge-backend/sales/orders/${orderId}/lines` |
| `setSalesOrderLines` | `POST` | `/api/edge-backend/sales/orders/${orderId}/lines` |
| `transitionSalesOrder` | `POST` | `/api/edge-backend/sales/orders/${orderId}/transition` |
| `getSalesQuote` | `GET` | `/api/edge-backend/sales/quotes/${id}` |
| `createSalesQuoteRevision` | `POST` | `/api/edge-backend/sales/quotes/${quoteId}/revisions` |
| `addSalesTeamMember` | `POST` | `/api/edge-backend/sales/teams/${teamId}/members` |
| `deleteSalesSavedView` | `DELETE` | `/api/edge-backend/sales/views/${id}` |
| `getSubscriptionOverview` | `GET` | `/api/edge-backend/subscriptions/overview` |
| `getSubscriptionAnalytics` | `GET` | `/api/edge-backend/subscriptions/analytics` |
| `listSubscriptions` | `GET` | `/api/edge-backend/subscriptions${toQuery({
        accountId: opts?.accountId,
        productId: opts?.productId,
        status: opts?.status,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `getSubscription` | `GET` | `/api/edge-backend/subscriptions/${id}` |
| `getSubscriptionWorkspace` | `GET` | `/api/edge-backend/subscriptions/${id}/workspace` |
| `getSubscriptionHistory` | `GET` | `/api/edge-backend/subscriptions/${id}/history` |
| `createSubscription` | `POST` | `/api/edge-backend/subscriptions` |
| `createSubscriptionFromHandoff` | `POST` | `/api/edge-backend/subscriptions/from-handoff` |
| `submitSubscription` | `POST` | `/api/edge-backend/subscriptions/${id}/submit` |
| `approveSubscription` | `POST` | `/api/edge-backend/subscriptions/${id}/approve` |
| `requestSubscriptionActivation` | `POST` | `/api/edge-backend/subscriptions/${id}/activate-request` |
| `activateSubscription` | `POST` | `/api/edge-backend/subscriptions/${id}/activate` |
| `suspendSubscription` | `POST` | `/api/edge-backend/subscriptions/${id}/suspend` |
| `reactivateSubscription` | `POST` | `/api/edge-backend/subscriptions/${id}/reactivate` |
| `cancelSubscription` | `POST` | `/api/edge-backend/subscriptions/${id}/cancel` |
| `terminateSubscription` | `POST` | `/api/edge-backend/subscriptions/${id}/terminate` |
| `listSubscriptionItems` | `GET` | `/api/edge-backend/subscriptions/${id}/items` |
| `addSubscriptionItem` | `POST` | `/api/edge-backend/subscriptions/${id}/items` |
| `listSubscriptionEntitlements` | `GET` | `/api/edge-backend/subscriptions/${id}/entitlements` |
| `calculateSubscriptionEntitlements` | `POST` | `/api/edge-backend/subscriptions/${id}/entitlements/calculate` |
| `publishSubscriptionEntitlements` | `POST` | `/api/edge-backend/subscriptions/${id}/entitlements/publish` |
| `listSubscriptionChanges` | `GET` | `/api/edge-backend/subscriptions/${id}/changes` |
| `createSubscriptionChange` | `POST` | `/api/edge-backend/subscriptions/${id}/changes` |
| `executeSubscriptionChange` | `POST` | `/api/edge-backend/subscriptions/${id}/changes/${changeId}/execute` |
| `listSubscriptionRenewals` | `GET` | `/api/edge-backend/subscriptions/${id}/renewals` |
| `createSubscriptionRenewal` | `POST` | `/api/edge-backend/subscriptions/${id}/renewals` |
| `confirmSubscriptionRenewal` | `POST` | `/api/edge-backend/subscriptions/${id}/renewals/confirm` |
| `listSubscriptionTrials` | `GET` | `/api/edge-backend/subscriptions/trials${toQuery({
        accountId: opts?.accountId,
        subscriptionId: opts?.subscriptionId,
        status: opts?.status,
      })}` |
| `startSubscriptionTrial` | `POST` | `/api/edge-backend/subscriptions/trials` |
| `convertSubscriptionTrial` | `POST` | `/api/edge-backend/subscriptions/trials/${trialId}/convert` |
| `expireSubscriptionTrial` | `POST` | `/api/edge-backend/subscriptions/trials/${trialId}/expire` |
| `requestSubscriptionBillingCoordination` | `POST` | `/api/edge-backend/subscriptions/${id}/billing-coordination` |
| `confirmSubscriptionBillingCoordination` | `POST` | `/api/edge-backend/subscriptions/${id}/billing-coordination/${coordId}/confirm` |
| `requestSubscriptionProvisioning` | `POST` | `/api/edge-backend/subscriptions/${id}/provisioning` |
| `completeSubscriptionProvisioning` | `POST` | `/api/edge-backend/subscriptions/${id}/provisioning/${reqId}/complete` |
| `advanceSubscriptionProvisioningAfterPaid` | `POST` | `/api/edge-backend/subscriptions/${id}/provisioning/advance-after-paid` |
| `processProvisioningJobs` | `POST` | `/api/edge-backend/provisioning-jobs/process` |
| `listProvisioningJobsBySubscription` | `GET` | `/api/edge-backend/provisioning-jobs/by-subscription/${subscriptionId}` |
| `listSubscriptionBillingCoordination` | `GET` | `/api/edge-backend/subscriptions/${id}/billing-coordination` |
| `listSubscriptionProvisioning` | `GET` | `/api/edge-backend/subscriptions/${id}/provisioning` |
| `listSubscriptionSuspensions` | `GET` | `/api/edge-backend/subscriptions/${id}/suspensions` |
| `listSubscriptionCancellations` | `GET` | `/api/edge-backend/subscriptions/${id}/cancellations` |
| `approveSubscriptionChange` | `POST` | `/api/edge-backend/subscriptions/${id}/changes/${changeId}/approve` |
| `rejectSubscriptionChange` | `POST` | `/api/edge-backend/subscriptions/${id}/changes/${changeId}/reject` |
| `scheduleSubscriptionChange` | `POST` | `/api/edge-backend/subscriptions/${id}/changes/${changeId}/schedule` |
| `processDueScheduledSubscriptionChanges` | `POST` | `/api/edge-backend/subscriptions/scheduled-changes/process-due` |
| `listSubscriptionPublications` | `GET` | `/api/edge-backend/subscriptions/${id}/publications` |
| `reconcileSubscriptionEntitlements` | `POST` | `/api/edge-backend/subscriptions/${id}/entitlements/reconcile` |
| `scanSubscriptionEntitlementDrift` | `POST` | `/api/edge-backend/subscriptions/entitlements/drift-scan` |
| `listSubscriptionTenantAssociations` | `GET` | `/api/edge-backend/subscriptions/${id}/associations` |
| `getActiveSubscriptionTenantAssociation` | `GET` | `/api/edge-backend/subscriptions/${id}/associations/active` |
| `bindSubscriptionTenantAssociation` | `POST` | `/api/edge-backend/subscriptions/${id}/associations/bind` |
| `closeSubscriptionTenantAssociation` | `POST` | `/api/edge-backend/subscriptions/${id}/associations/close` |
| `patchSubscription` | `PATCH` | `/api/edge-backend/subscriptions/${id}` |
| `getSubscriptionPolicies` | `GET` | `/api/edge-backend/subscriptions/policies` |
| `putSubscriptionPolicy` | `PUT` | `/api/edge-backend/subscriptions/policies/${code}` |
| `listSubscriptionApprovals` | `GET` | `/api/edge-backend/subscriptions/approvals${toQuery({ limit })}` |
| `getBillingOverview` | `GET` | `/api/edge-backend/billing/overview` |
| `getBillingAnalytics` | `GET` | `/api/edge-backend/billing/analytics` |
| `listBillingAccounts` | `GET` | `/api/edge-backend/billing/accounts` |
| `getBillingAccount` | `GET` | `/api/edge-backend/billing/accounts/${id}` |
| `createBillingAccount` | `POST` | `/api/edge-backend/billing/accounts` |
| `createDraftInvoiceFromSubscription` | `POST` | `/api/edge-backend/billing/invoices/draft-from-subscription` |
| `previewBillingInvoice` | `POST` | `/api/edge-backend/billing/invoices/preview` |
| `markOverdueBillingInvoices` | `POST` | `/api/edge-backend/billing/invoices/mark-overdue` |
| `approveBillingInvoice` | `POST` | `/api/edge-backend/billing/invoices/${id}/approve` |
| `issueBillingInvoice` | `POST` | `/api/edge-backend/billing/invoices/${id}/issue` |
| `voidBillingInvoice` | `POST` | `/api/edge-backend/billing/invoices/${id}/void` |
| `createBillingPaymentIntent` | `POST` | `/api/edge-backend/billing/payments/intents` |
| `confirmBillingPaymentIntent` | `POST` | `/api/edge-backend/billing/payments/intents/${id}/confirm` |
| `approveBillingRefund` | `POST` | `/api/edge-backend/billing/refunds/${id}/approve` |
| `listBillingInvoices` | `GET` | `/api/edge-backend/billing/invoices${toQuery({
        billingAccountId: params?.billingAccountId,
        status: params?.status,
        limit: params?.limit,
      })}` |
| `getBillingInvoice` | `GET` | `/api/edge-backend/billing/invoices/${id}` |
| `upsertBillingProfile` | `POST` | `/api/edge-backend/billing/accounts/${accountId}/profiles` |
| `applyBillingTax` | `POST` | `/api/edge-backend/billing/invoices/${invoiceId}/apply-tax` |
| `createBillingRefund` | `POST` | `/api/edge-backend/billing/refunds` |
| `listBillingPayments` | `GET` | `/api/edge-backend/billing/payments${toQuery({
        billingAccountId: params?.billingAccountId,
        status: params?.status,
        limit: params?.limit,
      })}` |
| `listCollectionCases` | `GET` | `/api/edge-backend/billing/collections${toQuery({
        billingAccountId: params?.billingAccountId,
        status: params?.status,
      })}` |
| `openCollectionCase` | `POST` | `/api/edge-backend/billing/collections` |
| `escalateCollectionCase` | `POST` | `/api/edge-backend/billing/collections/${id}/escalate` |
| `resolveCollectionCase` | `POST` | `/api/edge-backend/billing/collections/${id}/resolve` |
| `applyCollectionDunningPolicy` | `POST` | `/api/edge-backend/billing/collections/${id}/apply-policy` |
| `processDunningScan` | `POST` | `/api/edge-backend/billing/collections/dunning-scan` |
| `dispatchDunningNotification` | `POST` | `/api/edge-backend/billing/collections/${id}/notify` |
| `getBillingCashTruth` | `GET` | `/api/edge-backend/billing/cash-truth${toQuery({
        currency: params?.currency,
        periodStart: params?.periodStart,
        periodEnd: params?.periodEnd,
      })}` |
| `configureBillingCadence` | `POST` | `/api/edge-backend/billing/cadence` |
| `listGeoPaymentMethods` | `GET` | `/api/edge-backend/billing/geo-payment-methods${toQuery({
        country: params?.country,
        currency: params?.currency,
        methodType: params?.methodType,
      })}` |
| `registerBillingPaymentMethod` | `POST` | `/api/edge-backend/billing/accounts/${billingAccountId}/payment-methods` |
| `listBillingRefunds` | `GET` | `/api/edge-backend/billing/refunds${toQuery({
        paymentIntentId: params?.paymentIntentId,
        limit: params?.limit,
      })}` |
| `createBillingCreditNote` | `POST` | `/api/edge-backend/billing/invoices/${invoiceId}/credit-notes` |
| `listBillingCreditNotes` | `GET` | `/api/edge-backend/billing/credit-notes${toQuery({
        billingAccountId: params?.billingAccountId,
        invoiceId: params?.invoiceId,
      })}` |
| `runBillingReconciliation` | `POST` | `/api/edge-backend/billing/reconciliation/runs` |
| `listBillingReconciliationRuns` | `GET` | `/api/edge-backend/billing/reconciliation/runs` |
| `listReconciliationExceptions` | `GET` | `/api/edge-backend/billing/reconciliation/exceptions${toQuery({
        runId: params?.runId,
        status: params?.status,
      })}` |
| `resolveReconciliationException` | `POST` | `/api/edge-backend/billing/reconciliation/exceptions/${id}/resolve` |
| `listBillingPolicies` | `GET` | `/api/edge-backend/billing/policies${toQuery({ policyType })}` |
| `upsertBillingPolicy` | `POST` | `/api/edge-backend/billing/policies` |
| `listTaxJurisdictions` | `GET` | `/api/edge-backend/billing/tax/jurisdictions` |
| `listBillingFxRates` | `GET` | `/api/edge-backend/billing/fx/rates` |
| `convertBillingFx` | `POST` | `/api/edge-backend/billing/fx/convert` |
| `ingestProviderTransaction` | `POST` | `/api/edge-backend/billing/provider-transactions` |
| `listBillingSettlements` | `GET` | `/api/edge-backend/billing/settlements` |
| `listBillingDisputes` | `GET` | `/api/edge-backend/billing/disputes` |
| `getBillingPortal` | `GET` | `/api/edge-backend/billing/portal/${billingAccountId}` |
| `processDueBillingSchedules` | `POST` | `/api/edge-backend/billing/schedules/process-due` |
| `generateBillingExport` | `POST` | `/api/edge-backend/billing/exports` |
| `listBillingExports` | `GET` | `/api/edge-backend/billing/exports` |
| `getBillingExport` | `GET` | `/api/edge-backend/billing/exports/${id}` |
| `listBillingAccountJournal` | `GET` | `/api/edge-backend/billing/accounts/${accountId}/journal${toQuery({
        limit,
      })}` |
| `listBillingAccountParties` | `GET` | `/api/edge-backend/billing/accounts/${accountId}/parties` |
| `listBillingAccountPaymentMethods` | `GET` | `/api/edge-backend/billing/accounts/${accountId}/payment-methods` |
| `revokeBillingPaymentMethod` | `DELETE` | `/api/edge-backend/billing/accounts/${accountId}/payment-methods/${methodId}` |
| `getBillingAccountCurrentProfile` | `GET` | `/api/edge-backend/billing/accounts/${accountId}/profiles/current` |
| `linkBillingAccountSubscription` | `POST` | `/api/edge-backend/billing/accounts/${accountId}/subscriptions` |
| `getBillingCollectionCase` | `GET` | `/api/edge-backend/billing/collections/${id}` |
| `recordBillingCollectionDunning` | `POST` | `/api/edge-backend/billing/collections/${id}/dunning` |
| `resolveBillingDispute` | `PATCH` | `/api/edge-backend/billing/disputes/${id}` |
| `listBillingSchedules` | `GET` | `/api/edge-backend/billing/schedules${toQuery({ subscriptionId })}` |
| `createBillingSchedule` | `POST` | `/api/edge-backend/billing/schedules` |
| `createBillingDispute` | `POST` | `/api/edge-backend/billing/disputes` |
| `upsertBillingAccountParty` | `POST` | `/api/edge-backend/billing/accounts/${accountId}/parties` |
| `listRevenuePolicies` | `GET` | `/api/edge-backend/billing/revenue-policies` |
| `getProvisioningRequestStats` | `GET` | `/api/edge-backend/provisioning-requests/stats` |
| `listProvisioningRequests` | `GET` | `/api/edge-backend/provisioning-requests${toQuery({
        status: opts?.status,
        accountId: opts?.accountId,
        productId: opts?.productId,
        subscriptionId: opts?.subscriptionId,
        environmentSlot: opts?.environmentSlot,
        from: opts?.from,
        to: opts?.to,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `getProvisioningRequest` | `GET` | `/api/edge-backend/provisioning-requests/${id}` |
| `getProvisioningRequestHistory` | `GET` | `/api/edge-backend/provisioning-requests/${id}/history` |
| `getProvisioningRequestAuthorization` | `GET` | `/api/edge-backend/provisioning-requests/${id}/authorization` |
| `cancelProvisioningRequest` | `POST` | `/api/edge-backend/provisioning-requests/${id}/cancel` |
| `getProvisioningEventCompatibility` | `GET` | `/api/edge-backend/provisioning-requests/event-compatibility` |
| `listRegistryProducts` | `GET` | `/api/edge-backend/registry/products${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
      })}` |
| `getRegistryProduct` | `GET` | `/api/edge-backend/registry/products/${id}` |
| `createRegistryProduct` | `POST` | `/api/edge-backend/registry/products` |
| `updateRegistryProduct` | `PATCH` | `/api/edge-backend/registry/products/${id}` |
| `transitionRegistryProduct` | `POST` | `/api/edge-backend/registry/products/${id}/transition` |
| `listRegistryProductVersions` | `GET` | `/api/edge-backend/registry/products/${productRegistryId}/versions${toQuery(
        {
          limit: opts?.limit,
          offset: opts?.offset,
          status: opts?.status,
          q: opts?.q,
        },
      )}` |
| `createRegistryProductVersion` | `POST` | `/api/edge-backend/registry/products/${productRegistryId}/versions` |
| `transitionRegistryVersion` | `POST` | `/api/edge-backend/registry/versions/${id}/transition` |
| `getRegistryVersion` | `GET` | `/api/edge-backend/registry/versions/${id}` |
| `listRegistryPlatforms` | `GET` | `/api/edge-backend/registry/platforms${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
      })}` |
| `getRegistryPlatform` | `GET` | `/api/edge-backend/registry/platforms/${id}` |
| `createRegistryPlatform` | `POST` | `/api/edge-backend/registry/platforms` |
| `updateRegistryPlatform` | `PATCH` | `/api/edge-backend/registry/platforms/${id}` |
| `transitionRegistryPlatform` | `POST` | `/api/edge-backend/registry/platforms/${id}/transition` |
| `listRegistryEnvironments` | `GET` | `/api/edge-backend/registry/environments${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
        platformId: opts?.platformId,
      })}` |
| `getRegistryEnvironment` | `GET` | `/api/edge-backend/registry/environments/${id}` |
| `createRegistryEnvironment` | `POST` | `/api/edge-backend/registry/environments` |
| `updateRegistryEnvironment` | `PATCH` | `/api/edge-backend/registry/environments/${id}` |
| `transitionRegistryEnvironment` | `POST` | `/api/edge-backend/registry/environments/${id}/transition` |
| `listRegistryDeploymentProfiles` | `GET` | `/api/edge-backend/registry/deployment-profiles${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
      })}` |
| `getRegistryDeploymentProfile` | `GET` | `/api/edge-backend/registry/deployment-profiles/${id}` |
| `updateRegistryDeploymentProfile` | `PATCH` | `/api/edge-backend/registry/deployment-profiles/${id}` |
| `transitionRegistryDeploymentProfile` | `POST` | `/api/edge-backend/registry/deployment-profiles/${id}/transition` |
| `listRegistryControlContracts` | `GET` | `/api/edge-backend/registry/control-contracts${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
        productId: opts?.productId,
        platformId: opts?.platformId,
      })}` |
| `getRegistryControlContract` | `GET` | `/api/edge-backend/registry/control-contracts/${id}` |
| `createRegistryControlContract` | `POST` | `/api/edge-backend/registry/control-contracts` |
| `updateRegistryControlContract` | `PATCH` | `/api/edge-backend/registry/control-contracts/${id}` |
| `transitionRegistryControlContract` | `POST` | `/api/edge-backend/registry/control-contracts/${id}/transition` |
| `evaluateRegistryCompatibility` | `POST` | `/api/edge-backend/registry/compatibility/evaluate` |
| `listRegistryCompatibilityEvaluations` | `GET` | `/api/edge-backend/registry/compatibility/evaluations${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
      })}` |
| `getRegistryCompatibilityEvaluation` | `GET` | `/api/edge-backend/registry/compatibility/evaluations/${id}` |
| `listRegistryHistory` | `GET` | `/api/edge-backend/registry/history${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
        resourceType: opts?.resourceType,
        resourceId: opts?.resourceId,
      })}` |
| `listPlacementRequests` | `GET` | `/api/edge-backend/placement/requests${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
      })}` |
| `getPlacementRequest` | `GET` | `/api/edge-backend/placement/requests/${id}` |
| `createPlacementRequest` | `POST` | `/api/edge-backend/placement/requests` |
| `evaluatePlacementRequest` | `POST` | `/api/edge-backend/placement/requests/${id}/evaluate` |
| `confirmPlacementRequest` | `POST` | `/api/edge-backend/placement/requests/${id}/confirm` |
| `cancelPlacementRequest` | `POST` | `/api/edge-backend/placement/requests/${id}/cancel` |
| `reEvaluatePlacementRequest` | `POST` | `/api/edge-backend/placement/requests/${id}/re-evaluate` |
| `getPlacementDecision` | `GET` | `/api/edge-backend/placement/decisions/${id}` |
| `listPlacementDecisionCandidates` | `GET` | `/api/edge-backend/placement/decisions/${decisionId}/candidates` |
| `listPlacementHistory` | `GET` | `/api/edge-backend/placement/history${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
        resourceType: opts?.resourceType,
        resourceId: opts?.resourceId,
      })}` |
| `listCapacityInventory` | `GET` | `/api/edge-backend/capacity/inventory${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
        platformId: opts?.platformId,
        environmentId: opts?.environmentId,
        resourceType: opts?.resourceType,
      })}` |
| `upsertCapacityInventory` | `POST` | `/api/edge-backend/capacity/inventory` |
| `patchCapacityInventory` | `PATCH` | `/api/edge-backend/capacity/inventory/${id}` |
| `listCapacityReservations` | `GET` | `/api/edge-backend/capacity/reservations${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
        placementRequestId: opts?.placementRequestId,
        environmentId: opts?.environmentId,
      })}` |
| `getCapacityReservation` | `GET` | `/api/edge-backend/capacity/reservations/${id}` |
| `releaseCapacityReservation` | `POST` | `/api/edge-backend/capacity/reservations/${id}/release` |
| `expireCapacityReservation` | `POST` | `/api/edge-backend/capacity/reservations/${id}/expire` |
| `listPlacementPolicies` | `GET` | `/api/edge-backend/placement/policies${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
      })}` |
| `createPlacementPolicy` | `POST` | `/api/edge-backend/placement/policies` |
| `patchPlacementPolicy` | `PATCH` | `/api/edge-backend/placement/policies/${id}` |
| `listWorkflowDefinitions` | `GET` | `/api/edge-backend/workflows/definitions${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
      })}` |
| `getWorkflowDefinition` | `GET` | `/api/edge-backend/workflows/definitions/${id}` |
| `createWorkflowDefinition` | `POST` | `/api/edge-backend/workflows/definitions` |
| `validateWorkflowDefinition` | `POST` | `/api/edge-backend/workflows/definitions/${id}/validate` |
| `publishWorkflowDefinition` | `POST` | `/api/edge-backend/workflows/definitions/${id}/publish` |
| `deprecateWorkflowDefinition` | `POST` | `/api/edge-backend/workflows/definitions/${id}/deprecate` |
| `listWorkflowInstances` | `GET` | `/api/edge-backend/workflows${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
      })}` |
| `getWorkflowInstance` | `GET` | `/api/edge-backend/workflows/${id}` |
| `createWorkflowInstance` | `POST` | `/api/edge-backend/workflows` |
| `listWorkflowHistory` | `GET` | `/api/edge-backend/workflows/${id}/history${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
      })}` |
| `listWorkflowSteps` | `GET` | `/api/edge-backend/workflows/${id}/steps` |
| `listWorkflowAttempts` | `GET` | `/api/edge-backend/workflows/${id}/attempts` |
| `listWorkflowCheckpoints` | `GET` | `/api/edge-backend/workflows/${id}/checkpoints` |
| `listWorkflowCompensations` | `GET` | `/api/edge-backend/workflows/${id}/compensations` |
| `startWorkflow` | `POST` | `/api/edge-backend/workflows/${id}/start` |
| `pauseWorkflow` | `POST` | `/api/edge-backend/workflows/${id}/pause` |
| `resumeWorkflow` | `POST` | `/api/edge-backend/workflows/${id}/resume` |
| `cancelWorkflow` | `POST` | `/api/edge-backend/workflows/${id}/cancel` |
| `retryWorkflow` | `POST` | `/api/edge-backend/workflows/${id}/retry` |
| `reconcileWorkflow` | `POST` | `/api/edge-backend/workflows/${id}/reconcile` |
| `listWorkflowTasks` | `GET` | `/api/edge-backend/workflow-tasks${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
        workflowId: opts?.workflowId,
      })}` |
| `getWorkflowTask` | `GET` | `/api/edge-backend/workflow-tasks/${id}` |
| `assignWorkflowTask` | `POST` | `/api/edge-backend/workflow-tasks/${id}/assign` |
| `approveWorkflowTask` | `POST` | `/api/edge-backend/workflow-tasks/${id}/approve` |
| `rejectWorkflowTask` | `POST` | `/api/edge-backend/workflow-tasks/${id}/reject` |
| `completeWorkflowTask` | `POST` | `/api/edge-backend/workflow-tasks/${id}/complete` |
| `startWorkflowCompensation` | `POST` | `/api/edge-backend/workflows/${workflowId}/compensation/start` |
| `completeWorkflowCompensation` | `POST` | `/api/edge-backend/workflows/${workflowId}/compensation/complete` |
| `listWorkflowWorkers` | `GET` | `/api/edge-backend/workflow-workers${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
      })}` |
| `listWorkflowDeadLetters` | `GET` | `/api/edge-backend/workflows/dead-letters${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
      })}` |
| `listProductControlEndpoints` | `GET` | `/api/edge-backend/product-controls/endpoints${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
        productId: opts?.productId,
        platformId: opts?.platformId,
      })}` |
| `getProductControlEndpoint` | `GET` | `/api/edge-backend/product-controls/endpoints/${id}` |
| `createProductControlEndpoint` | `POST` | `/api/edge-backend/product-controls/endpoints` |
| `patchProductControlEndpoint` | `PATCH` | `/api/edge-backend/product-controls/endpoints/${id}` |
| `validateProductControlEndpoint` | `POST` | `/api/edge-backend/product-controls/endpoints/${id}/validate` |
| `handshakeProductControlEndpoint` | `POST` | `/api/edge-backend/product-controls/endpoints/${id}/handshake` |
| `discoverProductControlContract` | `POST` | `/api/edge-backend/product-controls/endpoints/${id}/discover-contract` |
| `discoverProductControlCapabilities` | `POST` | `/api/edge-backend/product-controls/endpoints/${id}/discover-capabilities` |
| `healthCheckProductControlEndpoint` | `POST` | `/api/edge-backend/product-controls/endpoints/${id}/health-check` |
| `quarantineProductControlEndpoint` | `POST` | `/api/edge-backend/product-controls/endpoints/${id}/quarantine` |
| `listProductControlEndpointExchanges` | `GET` | `/api/edge-backend/product-controls/endpoints/${id}/exchanges${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
      })}` |
| `listProductControlEndpointContracts` | `GET` | `/api/edge-backend/product-controls/endpoints/${id}/contracts` |
| `listProductControlEndpointCapabilities` | `GET` | `/api/edge-backend/product-controls/endpoints/${id}/capabilities` |
| `listProductControlEndpointHealthChecks` | `GET` | `/api/edge-backend/product-controls/endpoints/${id}/health-checks${toQuery(
        {
          limit: opts?.limit,
          offset: opts?.offset,
        },
      )}` |
| `listProductControlEndpointHistory` | `GET` | `/api/edge-backend/product-controls/endpoints/${id}/history${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `listProductControlExchanges` | `GET` | `/api/edge-backend/product-controls/exchanges${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
        endpointId: opts?.endpointId,
      })}` |
| `getProductControlExchange` | `GET` | `/api/edge-backend/product-controls/exchanges/${id}` |
| `reconcileProductControlExchange` | `POST` | `/api/edge-backend/product-controls/exchanges/${id}/reconcile` |
| `listProductControlCredentials` | `GET` | `/api/edge-backend/product-controls/credentials${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
        endpointId: opts?.endpointId,
      })}` |
| `listInfrastructureProviders` | `GET` | `/api/edge-backend/infrastructure/providers` |
| `getInfrastructureProvider` | `GET` | `/api/edge-backend/infrastructure/providers/${id}` |
| `listInfrastructureResources` | `GET` | `/api/edge-backend/infrastructure/resources${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        tenantId: opts?.tenantId,
        resourceType: opts?.resourceType,
      })}` |
| `getInfrastructureResource` | `GET` | `/api/edge-backend/infrastructure/resources/${id}` |
| `reconcileInfrastructureResource` | `POST` | `/api/edge-backend/infrastructure/resources/${id}/reconcile` |
| `listResourcePlans` | `GET` | `/api/edge-backend/infrastructure/resource-plans${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        tenantId: opts?.tenantId,
        productId: opts?.productId,
      })}` |
| `getResourcePlan` | `GET` | `/api/edge-backend/infrastructure/resource-plans/${id}` |
| `createResourcePlan` | `POST` | `/api/edge-backend/infrastructure/resource-plans` |
| `validateResourcePlan` | `POST` | `/api/edge-backend/infrastructure/resource-plans/${id}/validate` |
| `listDatabaseResources` | `GET` | `/api/edge-backend/databases/resources${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        tenantId: opts?.tenantId,
        engine: opts?.engine,
      })}` |
| `getDatabaseResource` | `GET` | `/api/edge-backend/databases/resources/${id}` |
| `verifyDatabaseResource` | `POST` | `/api/edge-backend/databases/resources/${id}/verify` |
| `rotateDatabaseCredentials` | `POST` | `/api/edge-backend/databases/resources/${id}/rotate-credentials` |
| `listResourceHistory` | `GET` | `/api/edge-backend/resources/${id}/history${toQuery({ limit: opts?.limit })}` |
| `listResourceBackups` | `GET` | `/api/edge-backend/resources/${id}/backups` |
| `createResourceBackup` | `POST` | `/api/edge-backend/resources/${id}/backups` |
| `restoreResourceBackup` | `POST` | `/api/edge-backend/resources/${id}/restore` |
| `deprovisionResource` | `POST` | `/api/edge-backend/resources/${id}/deprovision` |
| `listKeycloakProviders` | `GET` | `/api/edge-backend/keycloak/providers` |
| `getKeycloakProvider` | `GET` | `/api/edge-backend/keycloak/providers/${id}` |
| `listKeycloakServers` | `GET` | `/api/edge-backend/keycloak/servers` |
| `getKeycloakServer` | `GET` | `/api/edge-backend/keycloak/servers/${id}` |
| `registerKeycloakServer` | `POST` | `/api/edge-backend/keycloak/servers` |
| `discoverKeycloakCapabilities` | `POST` | `/api/edge-backend/keycloak/servers/${serverId}/capabilities` |
| `getKeycloakCapabilities` | `GET` | `/api/edge-backend/keycloak/servers/${serverId}/capabilities` |
| `listKeycloakTopologies` | `GET` | `/api/edge-backend/keycloak/topologies${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        tenantId: opts?.tenantId,
        productId: opts?.productId,
        status: opts?.status,
        topologyType: opts?.topologyType,
        serverId: opts?.serverId,
      })}` |
| `getKeycloakTopology` | `GET` | `/api/edge-backend/keycloak/topologies/${id}` |
| `createKeycloakTopology` | `POST` | `/api/edge-backend/keycloak/topologies` |
| `reconcileKeycloakTopology` | `POST` | `/api/edge-backend/keycloak/topologies/${id}/reconcile` |
| `deprovisionKeycloakTopology` | `POST` | `/api/edge-backend/keycloak/topologies/${id}/deprovision` |
| `declareKeycloakClient` | `POST` | `/api/edge-backend/keycloak/clients` |
| `listKeycloakEvidence` | `GET` | `/api/edge-backend/keycloak/topologies/${topologyId}/evidence${toQuery({
        limit: opts?.limit,
      })}` |
| `listKeycloakHistory` | `GET` | `/api/edge-backend/keycloak/topologies/${topologyId}/history${toQuery({
        limit: opts?.limit,
      })}` |
| `listKeycloakReconciliations` | `GET` | `/api/edge-backend/keycloak/topologies/${topologyId}/reconciliations${toQuery({
        limit: opts?.limit,
      })}` |
| `listConfigurationSchemas` | `GET` | `/api/edge-backend/configuration/schemas${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
      })}` |
| `createConfigurationSchema` | `POST` | `/api/edge-backend/configuration/schemas` |
| `getConfigurationSchema` | `GET` | `/api/edge-backend/configuration/schemas/${id}` |
| `listConfigurationTemplates` | `GET` | `/api/edge-backend/configuration/templates${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
      })}` |
| `createConfigurationTemplate` | `POST` | `/api/edge-backend/configuration/templates` |
| `publishConfigurationTemplate` | `POST` | `/api/edge-backend/configuration/templates/${id}/publish` |
| `getConfigurationTemplate` | `GET` | `/api/edge-backend/configuration/templates/${id}` |
| `listConfigurationBundles` | `GET` | `/api/edge-backend/configuration/bundles${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
      })}` |
| `createConfigurationBundle` | `POST` | `/api/edge-backend/configuration/bundles` |
| `publishConfigurationBundle` | `POST` | `/api/edge-backend/configuration/bundles/${id}/publish` |
| `getConfigurationBundle` | `GET` | `/api/edge-backend/configuration/bundles/${id}` |
| `listTenantConfigurationAssignments` | `GET` | `/api/edge-backend/configuration/assignments${toQuery({
        tenantId: opts?.tenantId,
        productId: opts?.productId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `getTenantConfigurationAssignment` | `GET` | `/api/edge-backend/configuration/assignments/${id}` |
| `assignTenantConfiguration` | `POST` | `/api/edge-backend/configuration/assignments` |
| `deployTenantConfiguration` | `POST` | `/api/edge-backend/configuration/assignments/${id}/deploy` |
| `rollbackTenantConfiguration` | `POST` | `/api/edge-backend/configuration/assignments/${id}/rollback` |
| `listConfigurationDeploymentRuns` | `GET` | `/api/edge-backend/configuration/assignments/${assignmentId}/runs` |
| `listConfigurationEvidence` | `GET` | `/api/edge-backend/configuration/assignments/${assignmentId}/evidence` |
| `listEntitlementDeployments` | `GET` | `/api/edge-backend/entitlements/assignments/${assignmentId}` |
| `reconcileTenantEntitlements` | `POST` | `/api/edge-backend/entitlements/assignments/${assignmentId}/reconcile` |
| `listExperienceProfiles` | `GET` | `/api/edge-backend/experience/profiles${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
        productId: opts?.productId,
      })}` |
| `createExperienceProfile` | `POST` | `/api/edge-backend/experience/profiles` |
| `publishExperienceProfile` | `POST` | `/api/edge-backend/experience/profiles/${id}/publish` |
| `getExperienceProfile` | `GET` | `/api/edge-backend/experience/profiles/${id}` |
| `listExperienceApplications` | `GET` | `/api/edge-backend/experience/applications${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
        status: opts?.status,
        q: opts?.q,
        productId: opts?.productId,
        experienceProfileId: opts?.experienceProfileId,
      })}` |
| `createExperienceApplication` | `POST` | `/api/edge-backend/experience/applications` |
| `publishExperienceApplication` | `POST` | `/api/edge-backend/experience/applications/${id}/publish` |
| `getExperienceApplication` | `GET` | `/api/edge-backend/experience/applications/${id}` |
| `listTenantExperienceAssignments` | `GET` | `/api/edge-backend/experience/assignments${toQuery({
        tenantId: opts?.tenantId,
        productId: opts?.productId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `getTenantExperienceAssignment` | `GET` | `/api/edge-backend/experience/assignments/${id}` |
| `assignTenantExperience` | `POST` | `/api/edge-backend/experience/assignments` |
| `provisionTenantExperience` | `POST` | `/api/edge-backend/experience/assignments/${id}/provision` |
| `deactivateTenantExperience` | `POST` | `/api/edge-backend/experience/assignments/${id}/deactivate` |
| `listExperienceDeploymentRuns` | `GET` | `/api/edge-backend/experience/assignments/${assignmentId}/runs` |
| `listExperienceEvidence` | `GET` | `/api/edge-backend/experience/assignments/${assignmentId}/evidence` |
| `listExperienceDomains` | `GET` | `/api/edge-backend/experience/assignments/${assignmentId}/domains` |
| `createExperienceDomain` | `POST` | `/api/edge-backend/experience/domains` |
| `listActivationEvaluations` | `GET` | `/api/edge-backend/activation/evaluations${toQuery({
        tenantId: opts?.tenantId,
        productId: opts?.productId,
        status: opts?.status,
        provisioningRequestId: opts?.provisioningRequestId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `getActivationEvaluation` | `GET` | `/api/edge-backend/activation/evaluations/${id}` |
| `createActivationEvaluation` | `POST` | `/api/edge-backend/activation/evaluations` |
| `evaluateActivationEvaluation` | `POST` | `/api/edge-backend/activation/evaluations/${id}/evaluate` |
| `listActivationRecords` | `GET` | `/api/edge-backend/activation/records${toQuery({
        tenantId: opts?.tenantId,
        productId: opts?.productId,
        status: opts?.status,
        provisioningRequestId: opts?.provisioningRequestId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `getActivationRecord` | `GET` | `/api/edge-backend/activation/records/${id}` |
| `createActivationRecord` | `POST` | `/api/edge-backend/activation/records` |
| `evaluateActivationRecord` | `POST` | `/api/edge-backend/activation/records/${id}/evaluate` |
| `activateActivationRecord` | `POST` | `/api/edge-backend/activation/records/${id}/activate` |
| `listActivationRuns` | `GET` | `/api/edge-backend/activation/records/${recordId}/runs` |
| `listActivationEvidence` | `GET` | `/api/edge-backend/activation/records/${recordId}/evidence` |
| `listLifecycleRecords` | `GET` | `/api/edge-backend/lifecycle/records${toQuery({
        tenantId: opts?.tenantId,
        productId: opts?.productId,
        status: opts?.status,
        activationRecordId: opts?.activationRecordId,
        provisioningRequestId: opts?.provisioningRequestId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `getLifecycleRecord` | `GET` | `/api/edge-backend/lifecycle/records/${id}` |
| `createLifecycleRecord` | `POST` | `/api/edge-backend/lifecycle/records` |
| `suspendLifecycleRecord` | `POST` | `/api/edge-backend/lifecycle/records/${id}/suspend` |
| `resumeLifecycleRecord` | `POST` | `/api/edge-backend/lifecycle/records/${id}/resume` |
| `deprovisionLifecycleRecord` | `POST` | `/api/edge-backend/lifecycle/records/${id}/deprovision` |
| `listLifecycleRuns` | `GET` | `/api/edge-backend/lifecycle/records/${recordId}/runs` |
| `listLifecycleEvidence` | `GET` | `/api/edge-backend/lifecycle/records/${recordId}/evidence` |
| `registerPartnerOpportunity` | `POST` | `/api/edge-backend/partners/opportunities` |
| `listPartnerOpportunities` | `GET` | `/api/edge-backend/partners/opportunities${toQuery({
        partnerCode: params?.partnerCode,
        status: params?.status,
        limit: params?.limit,
      })}` |
| `transitionPartnerOpportunity` | `POST` | `/api/edge-backend/partners/opportunities/${encodeURIComponent(id)}/transition` |
| `listAhaMoments` | `GET` | `/api/edge-backend/cs/aha-moments${toQuery({ segment })}` |
| `computeCustomerHealthScore` | `POST` | `/api/edge-backend/cs/health-score` |
| `ingestAdoptionEvent` | `POST` | `/api/edge-backend/cs/adoption-events` |
| `listAdoptionEvents` | `GET` | `/api/edge-backend/cs/adoption-events${toQuery({
        subscriptionId: params.subscriptionId,
        segment: params.segment,
        limit: params.limit,
      })}` |
| `evaluateExpansionSignals` | `POST` | `/api/edge-backend/cs/expansion-signals` |
| `computeChurnRisk` | `POST` | `/api/edge-backend/cs/churn-risk` |
| `listOnboardingTemplates` | `GET` | `/api/edge-backend/onboarding/templates${toQuery({
        status: opts?.status,
        productId: opts?.productId,
        q: opts?.q,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `getOnboardingTemplate` | `GET` | `/api/edge-backend/onboarding/templates/${id}` |
| `createOnboardingTemplate` | `POST` | `/api/edge-backend/onboarding/templates` |
| `publishOnboardingTemplate` | `POST` | `/api/edge-backend/onboarding/templates/${id}/publish` |
| `listOnboardingJourneys` | `GET` | `/api/edge-backend/onboarding/journeys${toQuery({
        tenantId: opts?.tenantId,
        productId: opts?.productId,
        status: opts?.status,
        activationRecordId: opts?.activationRecordId,
        templateId: opts?.templateId,
        provisioningRequestId: opts?.provisioningRequestId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `getOnboardingJourney` | `GET` | `/api/edge-backend/onboarding/journeys/${id}` |
| `createOnboardingJourney` | `POST` | `/api/edge-backend/onboarding/journeys` |
| `startOnboardingJourney` | `POST` | `/api/edge-backend/onboarding/journeys/${id}/start` |
| `advanceOnboardingJourney` | `POST` | `/api/edge-backend/onboarding/journeys/${id}/advance` |
| `closeOnboardingJourney` | `POST` | `/api/edge-backend/onboarding/journeys/${id}/close` |
| `decideOnboardingTask` | `POST` | `/api/edge-backend/onboarding/journeys/${journeyId}/tasks/${taskId}/decide` |
| `listOnboardingRuns` | `GET` | `/api/edge-backend/onboarding/journeys/${journeyId}/runs` |
| `listOnboardingEvidence` | `GET` | `/api/edge-backend/onboarding/journeys/${journeyId}/evidence` |
| `listReconciliationPolicies` | `GET` | `/api/edge-backend/reconciliation/policies${toQuery({
        status: opts?.status,
        scope: opts?.scope,
        q: opts?.q,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `getReconciliationPolicy` | `GET` | `/api/edge-backend/reconciliation/policies/${id}` |
| `createReconciliationPolicy` | `POST` | `/api/edge-backend/reconciliation/policies` |
| `listReconciliationRuns` | `GET` | `/api/edge-backend/reconciliation/runs${toQuery({
        tenantId: opts?.tenantId,
        productId: opts?.productId,
        status: opts?.status,
        policyId: opts?.policyId,
        providerCode: opts?.providerCode,
        provisioningRequestId: opts?.provisioningRequestId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `getReconciliationRun` | `GET` | `/api/edge-backend/reconciliation/runs/${id}` |
| `createReconciliationRun` | `POST` | `/api/edge-backend/reconciliation/runs` |
| `observeReconciliationRun` | `POST` | `/api/edge-backend/reconciliation/runs/${id}/observe` |
| `remediateReconciliationRun` | `POST` | `/api/edge-backend/reconciliation/runs/${id}/remediate` |
| `decideReconciliationRemediation` | `POST` | `/api/edge-backend/reconciliation/runs/${runId}/remediations/${remediationId}/decide` |
| `listReconciliationFindings` | `GET` | `/api/edge-backend/reconciliation/findings${toQuery({
        runId: opts?.runId,
        tenantId: opts?.tenantId,
        status: opts?.status,
        observationClass: opts?.observationClass,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `quarantineReconciliationFinding` | `POST` | `/api/edge-backend/reconciliation/findings/${id}/quarantine` |
| `createReconciliationWaiver` | `POST` | `/api/edge-backend/reconciliation/waivers` |
| `listReconciliationWaivers` | `GET` | `/api/edge-backend/reconciliation/waivers${toQuery({
        findingId: opts?.findingId,
        tenantId: opts?.tenantId,
        status: opts?.status,
        limit: opts?.limit,
      })}` |
| `listReconciliationEvidence` | `GET` | `/api/edge-backend/reconciliation/runs/${runId}/evidence${toQuery({
        limit: opts?.limit,
      })}` |
| `listReconciliationHistory` | `GET` | `/api/edge-backend/reconciliation/history${toQuery({
        runId: opts?.runId,
        findingId: opts?.findingId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `listConnectivityAgents` | `GET` | `/api/edge-backend/agents${toQuery({
        status: opts?.status,
        tenantId: opts?.tenantId,
        productId: opts?.productId,
        q: opts?.q,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `listConnectivityAgentHistory` | `GET` | `/api/edge-backend/agent-history${toQuery({
        agentId: opts?.agentId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `getConnectivityAgent` | `GET` | `/api/edge-backend/agents/${id}` |
| `createConnectivityAgent` | `POST` | `/api/edge-backend/agents` |
| `registerConnectivityAgent` | `POST` | `/api/edge-backend/agents/${id}/register` |
| `commandConnectivityAgent` | `POST` | `/api/edge-backend/agents/${id}/command` |
| `revokeConnectivityAgent` | `POST` | `/api/edge-backend/agents/${id}/revoke` |
| `listConnectivityAgentCommands` | `GET` | `/api/edge-backend/agents/${id}/commands${toQuery({
        status: opts?.status,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `listConnectivityAgentEvidence` | `GET` | `/api/edge-backend/agents/${id}/evidence${toQuery({
        limit: opts?.limit,
      })}` |
| `listCertificationPackages` | `GET` | `/api/edge-backend/certification/packages${toQuery({
        status: opts?.status,
        productId: opts?.productId,
        deploymentProfileCode: opts?.deploymentProfileCode,
        q: opts?.q,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `getCertificationPackage` | `GET` | `/api/edge-backend/certification/packages/${id}` |
| `createCertificationPackage` | `POST` | `/api/edge-backend/certification/packages` |
| `assembleCertificationPackage` | `POST` | `/api/edge-backend/certification/packages/${id}/assemble` |
| `certifyCertificationPackage` | `POST` | `/api/edge-backend/certification/packages/${id}/certify` |
| `revokeCertificationPackage` | `POST` | `/api/edge-backend/certification/packages/${id}/revoke` |
| `attachCertificationEvidence` | `POST` | `/api/edge-backend/certification/packages/${id}/evidence` |
| `listCertificationEvidenceItems` | `GET` | `/api/edge-backend/certification/packages/${id}/evidence-items` |
| `listCertificationRuns` | `GET` | `/api/edge-backend/certification/packages/${id}/runs${toQuery({
        operation: opts?.operation,
        outcome: opts?.outcome,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `listCertificationEvidence` | `GET` | `/api/edge-backend/certification/packages/${id}/evidence${toQuery({
        limit: opts?.limit,
      })}` |
| `listCertificationHistory` | `GET` | `/api/edge-backend/certification/history${toQuery({
        packageId: opts?.packageId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `listTenants` | `GET` | `/api/edge-backend/tenants${toQuery({
        q: opts?.q,
        productId: opts?.productId,
        accountId: opts?.accountId,
        subscriptionId: opts?.subscriptionId,
        region: opts?.region,
        classification: opts?.classification,
        administrativeStatus: opts?.administrativeStatus,
        technicalStatus: opts?.technicalStatus,
        governanceStatus: opts?.governanceStatus,
        healthStatus: opts?.healthStatus,
        riskLevel: opts?.riskLevel,
        tagKey: opts?.tagKey,
        tagValue: opts?.tagValue,
        sortBy: opts?.sortBy,
        sortDir: opts?.sortDir,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `getTenant` | `GET` | `/api/edge-backend/tenants/${id}` |
| `getTenant360` | `GET` | `/api/edge-backend/tenants/${id}/360` |
| `getTenantPortfolioAnalytics` | `GET` | `/api/edge-backend/tenant-management/analytics/portfolio` |
| `getTenantsAnalyticsPortfolio` | `GET` | `/api/edge-backend/tenants/analytics/portfolio` |
| `registerTenant` | `POST` | `/api/edge-backend/tenants` |
| `syncTenantsFromP7` | `POST` | `/api/edge-backend/tenants/sync-from-p7` |
| `updateTenantMetadata` | `PATCH` | `/api/edge-backend/tenants/${id}` |
| `assignTenantOwner` | `POST` | `/api/edge-backend/tenants/${id}/owner` |
| `addTenantTag` | `POST` | `/api/edge-backend/tenants/${id}/tags` |
| `removeTenantTag` | `DELETE` | `/api/edge-backend/tenants/${id}/tags${toQuery({ tagKey, tagValue })}` |
| `addTenantNote` | `POST` | `/api/edge-backend/tenants/${id}/notes` |
| `listTenantActivity` | `GET` | `/api/edge-backend/tenants/${id}/activity${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `requestTenantLifecycle` | `POST` | `/api/edge-backend/tenants/${id}/lifecycle-requests` |
| `listTenantLifecycleRequests` | `GET` | `/api/edge-backend/tenant-management/lifecycle-requests${toQuery({
        tenantRegistryId: opts?.tenantRegistryId,
        status: opts?.status,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `approveTenantLifecycleRequest` | `POST` | `/api/edge-backend/tenant-management/lifecycle-requests/${id}/approve` |
| `rejectTenantLifecycleRequest` | `POST` | `/api/edge-backend/tenant-management/lifecycle-requests/${id}/reject` |
| `listTenantExceptions` | `GET` | `/api/edge-backend/tenant-management/exceptions${toQuery({
        tenantRegistryId: opts?.tenantRegistryId,
        status: opts?.status,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `requestTenantException` | `POST` | `/api/edge-backend/tenant-management/exceptions` |
| `approveTenantException` | `POST` | `/api/edge-backend/tenant-management/exceptions/${id}/approve` |
| `revokeTenantException` | `POST` | `/api/edge-backend/tenant-management/exceptions/${id}/revoke` |
| `expireTenantExceptions` | `POST` | `/api/edge-backend/tenant-management/exceptions/expire-due` |
| `runTenantReconciliation` | `POST` | `/api/edge-backend/tenant-management/reconciliation/runs` |
| `listTenantReconciliationFindings` | `GET` | `/api/edge-backend/tenant-management/reconciliation/findings${toQuery({
        tenantRegistryId: opts?.tenantRegistryId,
        status: opts?.status,
        runId: opts?.runId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `listTenantReconciliationRuns` | `GET` | `/api/edge-backend/tenant-management/reconciliation/runs${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `acknowledgeTenantFinding` | `POST` | `/api/edge-backend/tenant-management/reconciliation/findings/${id}/acknowledge` |
| `listTenantMigrations` | `GET` | `/api/edge-backend/tenant-management/migrations${toQuery({
        tenantRegistryId: opts?.tenantRegistryId,
        status: opts?.status,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `requestTenantMigration` | `POST` | `/api/edge-backend/tenant-management/migrations` |
| `approveTenantMigration` | `POST` | `/api/edge-backend/tenant-management/migrations/${id}/approve` |
| `rejectTenantMigration` | `POST` | `/api/edge-backend/tenant-management/migrations/${id}/reject` |
| `listTenantRecoveries` | `GET` | `/api/edge-backend/tenant-management/recoveries${toQuery({
        tenantRegistryId: opts?.tenantRegistryId,
        status: opts?.status,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `requestTenantRecovery` | `POST` | `/api/edge-backend/tenant-management/recoveries` |
| `approveTenantRecovery` | `POST` | `/api/edge-backend/tenant-management/recoveries/${id}/approve` |
| `rejectTenantRecovery` | `POST` | `/api/edge-backend/tenant-management/recoveries/${id}/reject` |
| `listTenantTerminations` | `GET` | `/api/edge-backend/tenant-management/terminations${toQuery({
        tenantRegistryId: opts?.tenantRegistryId,
        status: opts?.status,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `requestTenantTermination` | `POST` | `/api/edge-backend/tenant-management/terminations` |
| `approveTenantTermination` | `POST` | `/api/edge-backend/tenant-management/terminations/${id}/approve` |
| `rejectTenantTermination` | `POST` | `/api/edge-backend/tenant-management/terminations/${id}/reject` |
| `exportTenants` | `GET` | `/api/edge-backend/tenants/export${toQuery({
        q: opts?.q,
        productId: opts?.productId,
        accountId: opts?.accountId,
        subscriptionId: opts?.subscriptionId,
        region: opts?.region,
        classification: opts?.classification,
        administrativeStatus: opts?.administrativeStatus,
        technicalStatus: opts?.technicalStatus,
        governanceStatus: opts?.governanceStatus,
        healthStatus: opts?.healthStatus,
        riskLevel: opts?.riskLevel,
        tagKey: opts?.tagKey,
        tagValue: opts?.tagValue,
        sortBy: opts?.sortBy,
        sortDir: opts?.sortDir,
        format: opts?.format,
      })}` |
| `previewBulkTenantOperation` | `POST` | `/api/edge-backend/tenant-management/bulk/preview` |
| `executeBulkTenantOperation` | `POST` | `/api/edge-backend/tenant-management/bulk/${id}/execute` |
| `listBulkTenantOperations` | `GET` | `/api/edge-backend/tenant-management/bulk${toQuery({
        status: opts?.status,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `recordTenantHealthSnapshot` | `POST` | `/api/edge-backend/tenants/${tenantId}/health-snapshots` |
| `listTenantHealthSnapshots` | `GET` | `/api/edge-backend/tenants/${tenantId}/health-snapshots${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `evaluateTenantRisk` | `POST` | `/api/edge-backend/tenants/${tenantId}/risk-assessments` |
| `listTenantRiskAssessments` | `GET` | `/api/edge-backend/tenants/${tenantId}/risk-assessments${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `updateTenantPolicies` | `PATCH` | `/api/edge-backend/tenants/${tenantId}/policies` |
| `updateTenantLegalHold` | `POST` | `/api/edge-backend/tenants/${tenantId}/legal-hold` |
| `authorizeTenantDeprovision` | `POST` | `/api/edge-backend/tenants/${tenantId}/deprovision-authorization` |
| `requestTenantLegalHoldChange` | `POST` | `/api/edge-backend/tenants/${tenantId}/legal-hold-requests` |
| `listTenantLegalHoldChangeRequests` | `GET` | `/api/edge-backend/tenant-management/legal-hold-requests${toQuery({
        tenantRegistryId: opts?.tenantRegistryId,
        status: opts?.status,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `approveTenantLegalHoldChangeRequest` | `POST` | `/api/edge-backend/tenant-management/legal-hold-requests/${requestId}/approve` |
| `rejectTenantLegalHoldChangeRequest` | `POST` | `/api/edge-backend/tenant-management/legal-hold-requests/${requestId}/reject` |
| `listPlatformServices` | `GET` | `/api/edge-backend/operations/services${toQuery({
        q: opts?.q,
        category: opts?.category,
        environment: opts?.environment,
        observationStatus: opts?.observationStatus,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `getPlatformService` | `GET` | `/api/edge-backend/operations/services/${id}` |
| `registerPlatformService` | `POST` | `/api/edge-backend/operations/services` |
| `updatePlatformService` | `PATCH` | `/api/edge-backend/operations/services/${id}` |
| `addPlatformServiceDependency` | `POST` | `/api/edge-backend/operations/services/${id}/dependencies` |
| `removePlatformServiceDependency` | `DELETE` | `/api/edge-backend/operations/services/${id}/dependencies${toQuery({
        dependsOnServiceId: opts.dependsOnServiceId,
        dependencyType: opts.dependencyType,
      })}` |
| `getOperationsOverview` | `GET` | `/api/edge-backend/operations/overview` |
| `getOperationsHealth` | `GET` | `/api/edge-backend/operations/health` |
| `recordServiceHealthSnapshot` | `POST` | `/api/edge-backend/operations/health/snapshots` |
| `listOperationalAlerts` | `GET` | `/api/edge-backend/operations/alerts${toQuery({
        status: opts?.status,
        serviceId: opts?.serviceId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `ingestOperationalAlert` | `POST` | `/api/edge-backend/operations/alerts` |
| `acknowledgeOperationalAlert` | `POST` | `/api/edge-backend/operations/alerts/${id}/acknowledge` |
| `resolveOperationalAlert` | `POST` | `/api/edge-backend/operations/alerts/${id}/resolve` |
| `listIncidents` | `GET` | `/api/edge-backend/operations/incidents${toQuery({
        status: opts?.status,
        serviceId: opts?.serviceId,
        limit: opts?.limit,
        offset: opts?.offset,
        isMajor: opts?.isMajor === undefined ? undefined : opts.isMajor ? 1 : 0,
      })}` |
| `listMajorIncidents` | `GET` | `/api/edge-backend/operations/major-incidents${toQuery({
        status: opts?.status,
        serviceId: opts?.serviceId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `getIncident` | `GET` | `/api/edge-backend/operations/incidents/${id}` |
| `createIncident` | `POST` | `/api/edge-backend/operations/incidents` |
| `transitionIncident` | `POST` | `/api/edge-backend/operations/incidents/${id}/transition` |
| `declareMajorIncident` | `POST` | `/api/edge-backend/operations/incidents/${id}/major` |
| `listProblems` | `GET` | `/api/edge-backend/operations/problems${toQuery({
        status: opts?.status,
        serviceId: opts?.serviceId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `createProblem` | `POST` | `/api/edge-backend/operations/problems` |
| `confirmProblemRootCause` | `POST` | `/api/edge-backend/operations/problems/${id}/root-cause` |
| `linkProblemIncident` | `POST` | `/api/edge-backend/operations/problems/${id}/incidents` |
| `listChanges` | `GET` | `/api/edge-backend/operations/changes${toQuery({
        status: opts?.status,
        serviceId: opts?.serviceId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `listReleases` | `GET` | `/api/edge-backend/operations/releases${toQuery({
        status: opts?.status,
        serviceId: opts?.serviceId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `createRelease` | `POST` | `/api/edge-backend/operations/releases` |
| `transitionRelease` | `POST` | `/api/edge-backend/operations/releases/${id}/transition` |
| `createChange` | `POST` | `/api/edge-backend/operations/changes` |
| `submitChange` | `POST` | `/api/edge-backend/operations/changes/${id}/submit` |
| `approveChange` | `POST` | `/api/edge-backend/operations/changes/${id}/approve` |
| `rejectChange` | `POST` | `/api/edge-backend/operations/changes/${id}/reject` |
| `listMaintenanceWindows` | `GET` | `/api/edge-backend/operations/maintenance${toQuery({
        status: opts?.status,
        serviceId: opts?.serviceId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `createMaintenanceWindow` | `POST` | `/api/edge-backend/operations/maintenance` |
| `listServiceRequests` | `GET` | `/api/edge-backend/operations/requests${toQuery({
        status: opts?.status,
        serviceId: opts?.serviceId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `createServiceRequest` | `POST` | `/api/edge-backend/operations/requests` |
| `listOperationalTasks` | `GET` | `/api/edge-backend/operations/tasks${toQuery({
        status: opts?.status,
        serviceId: opts?.serviceId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `createOperationalTask` | `POST` | `/api/edge-backend/operations/tasks` |
| `listOnCallRotations` | `GET` | `/api/edge-backend/operations/on-call/rotations${toQuery({
        teamId: opts?.teamId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `createOnCallRotation` | `POST` | `/api/edge-backend/operations/on-call/rotations` |
| `listSloDefinitions` | `GET` | `/api/edge-backend/operations/slo${toQuery({
        serviceId: opts?.serviceId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `createSloDefinition` | `POST` | `/api/edge-backend/operations/slo` |
| `recordSloMeasurement` | `POST` | `/api/edge-backend/operations/slo/measurements` |
| `listCapacityMeasurements` | `GET` | `/api/edge-backend/operations/capacity${toQuery({
        serviceId: opts?.serviceId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `recordCapacityMeasurement` | `POST` | `/api/edge-backend/operations/capacity` |
| `listRecoveryOperations` | `GET` | `/api/edge-backend/operations/recovery${toQuery({
        status: opts?.status,
        serviceId: opts?.serviceId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `requestRecoveryOperation` | `POST` | `/api/edge-backend/operations/recovery` |
| `verifyRecoveryOperation` | `POST` | `/api/edge-backend/operations/recovery/${id}/verify` |
| `listNotificationDeliveries` | `GET` | `/api/edge-backend/operations/notifications${toQuery({
        status: opts?.status,
        serviceId: opts?.serviceId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `recordNotificationDelivery` | `POST` | `/api/edge-backend/operations/notifications` |
| `updateNotificationDeliveryStatus` | `POST` | `/api/edge-backend/operations/notifications/${id}/status` |
| `connectMonitoringSource` | `POST` | `/api/edge-backend/operations/monitoring/sources` |
| `recordMonitoringProbe` | `POST` | `/api/edge-backend/operations/monitoring/probes` |
| `listMonitoringProbes` | `GET` | `/api/edge-backend/operations/monitoring/probes${toQuery({
        sourceId: opts?.sourceId,
        limit: opts?.limit,
      })}` |
| `listRunbooks` | `GET` | `/api/edge-backend/operations/runbooks${toQuery({
        serviceId: opts?.serviceId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `createRunbook` | `POST` | `/api/edge-backend/operations/runbooks` |
| `listStatusComponents` | `GET` | `/api/edge-backend/operations/status/components${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `listStatusPages` | `GET` | `/api/edge-backend/operations/status-pages${toQuery({
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `publishStatusUpdate` | `POST` | `/api/edge-backend/operations/status/publications` |
| `approveStatusPublication` | `POST` | `/api/edge-backend/operations/status/publications/${id}/approve` |
| `listOperationalRisks` | `GET` | `/api/edge-backend/operations/risks${toQuery({
        status: opts?.status,
        serviceId: opts?.serviceId,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `createOperationalRisk` | `POST` | `/api/edge-backend/operations/risks` |
| `listOperationalExceptions` | `GET` | `/api/edge-backend/operations/exceptions${toQuery({
        status: opts?.status,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `createOperationalException` | `POST` | `/api/edge-backend/operations/exceptions` |
| `flagExpiredOperationalExceptions` | `POST` | `/api/edge-backend/operations/exceptions/flag-expired` |
| `listAutomations` | `GET` | `/api/edge-backend/operations/automation${toQuery({
        status: opts?.status,
        limit: opts?.limit,
        offset: opts?.offset,
      })}` |
| `createAutomation` | `POST` | `/api/edge-backend/operations/automation` |
| `requestAutomationExecution` | `POST` | `/api/edge-backend/operations/automation/executions` |
| `approveAutomationExecution` | `POST` | `/api/edge-backend/operations/automation/executions/${id}/approve` |
| `executeAutomation` | `POST` | `/api/edge-backend/operations/automation/executions/${id}/execute` |
| `getOperationsAnalytics` | `GET` | `/api/edge-backend/operations/analytics` |
| `getAcquisitionOverview` | `GET` | `/api/edge-backend/acquisition/overview` |
| `listAcquisitionProducts` | `GET` | `/api/edge-backend/acquisition/products${toQuery({
        status: params?.status,
        productId: params?.productId,
        limit: params?.limit,
        offset: params?.offset,
      })}` |
| `createAcquisitionProduct` | `POST` | `/api/edge-backend/acquisition/products` |
| `createAcquisitionProductContent` | `POST` | `/api/edge-backend/acquisition/products/${presentationId}/content` |
| `publishAcquisitionProductContent` | `POST` | `/api/edge-backend/acquisition/products/${presentationId}/content/${versionId}/publish` |
| `listAcquisitionPlans` | `GET` | `/api/edge-backend/acquisition/plans${toQuery({
        status: params?.status,
        productPresentationId: params?.productPresentationId,
        limit: params?.limit,
        offset: params?.offset,
      })}` |
| `createAcquisitionPlan` | `POST` | `/api/edge-backend/acquisition/plans` |
| `listAcquisitionSegments` | `GET` | `/api/edge-backend/acquisition/segments${toQuery({
        status: params?.status,
        productPresentationId: params?.productPresentationId,
        limit: params?.limit,
        offset: params?.offset,
      })}` |
| `createAcquisitionSegment` | `POST` | `/api/edge-backend/acquisition/segments` |
| `listAcquisitionProspects` | `GET` | `/api/edge-backend/acquisition/prospects${toQuery({
        status: params?.status,
        productId: params?.productId,
        limit: params?.limit,
        offset: params?.offset,
      })}` |
| `createAcquisitionProspect` | `POST` | `/api/edge-backend/acquisition/prospects` |
| `transitionAcquisitionProspect` | `POST` | `/api/edge-backend/acquisition/prospects/${id}/transition` |
| `listAcquisitionLeads` | `GET` | `/api/edge-backend/acquisition/leads${toQuery({
        status: params?.status,
        prospectId: params?.prospectId,
        limit: params?.limit,
        offset: params?.offset,
      })}` |
| `captureAcquisitionLead` | `POST` | `/api/edge-backend/acquisition/leads` |
| `promoteAcquisitionLead` | `POST` | `/api/edge-backend/acquisition/leads/${id}/promote` |
| `listAcquisitionForms` | `GET` | `/api/edge-backend/acquisition/forms${toQuery({
        status: params?.status,
        productId: params?.productId,
        limit: params?.limit,
        offset: params?.offset,
      })}` |
| `createAcquisitionForm` | `POST` | `/api/edge-backend/acquisition/forms` |
| `createAcquisitionFormFromContract` | `POST` | `/api/edge-backend/acquisition/forms/from-contract` |
| `createAcquisitionFormVersion` | `POST` | `/api/edge-backend/acquisition/forms/${formSchemaId}/versions` |
| `publishAcquisitionFormVersion` | `POST` | `/api/edge-backend/acquisition/forms/versions/${versionId}/publish` |
| `listAcquisitionCheckouts` | `GET` | `/api/edge-backend/acquisition/checkout${toQuery({
        status: params?.status,
        prospectId: params?.prospectId,
        limit: params?.limit,
        offset: params?.offset,
      })}` |
| `getAcquisitionCheckout` | `GET` | `/api/edge-backend/acquisition/checkout/${encodeURIComponent(id)}` |
| `listAcquisitionHandoffs` | `GET` | `/api/edge-backend/acquisition/handoffs${toQuery({
        status: params?.status,
        prospectId: params?.prospectId,
        limit: params?.limit,
        offset: params?.offset,
      })}` |
| `listAcquisitionApplications` | `GET` | `/api/edge-backend/acquisition/applications${toQuery({
        status: params?.status,
        prospectId: params?.prospectId,
        productId: params?.productId,
        limit: params?.limit,
        offset: params?.offset,
      })}` |
| `createAcquisitionApplication` | `POST` | `/api/edge-backend/acquisition/applications` |
| `saveAcquisitionApplicationAnswers` | `POST` | `/api/edge-backend/acquisition/applications/${id}/answers` |
| `submitAcquisitionApplication` | `POST` | `/api/edge-backend/acquisition/applications/${id}/submit` |
| `transitionAcquisitionApplication` | `POST` | `/api/edge-backend/acquisition/applications/${id}/transition` |
| `requestAcquisitionApplicationInformation` | `POST` | `/api/edge-backend/acquisition/applications/${id}/request-information` |
| `listAcquisitionDocuments` | `GET` | `/api/edge-backend/acquisition/documents${toQuery({
        status: params?.status,
        applicationId: params?.applicationId,
        limit: params?.limit,
        offset: params?.offset,
      })}` |
| `registerAcquisitionDocument` | `POST` | `/api/edge-backend/acquisition/documents` |
| `reviewAcquisitionDocument` | `POST` | `/api/edge-backend/acquisition/documents/${id}/review` |
| `createAcquisitionDocumentRequirement` | `POST` | `/api/edge-backend/acquisition/document-requirements` |
| `startAcquisitionQualification` | `POST` | `/api/edge-backend/acquisition/qualification/start` |
| `decideAcquisitionQualification` | `POST` | `/api/edge-backend/acquisition/qualification/${applicationId}/decide` |
| `listAcquisitionQuotations` | `GET` | `/api/edge-backend/acquisition/quotations${toQuery({
        status: params?.status,
        prospectId: params?.prospectId,
        applicationId: params?.applicationId,
        limit: params?.limit,
        offset: params?.offset,
      })}` |
| `createAcquisitionQuotation` | `POST` | `/api/edge-backend/acquisition/quotations` |
| `attachAcquisitionQuoteReference` | `POST` | `/api/edge-backend/acquisition/quotations/${quoteRequestId}/references` |
| `acceptAcquisitionQuote` | `POST` | `/api/edge-backend/acquisition/quotations/${quoteRequestId}/accept` |
| `createAcquisitionCheckout` | `POST` | `/api/edge-backend/acquisition/checkout` |
| `attachAcquisitionPaymentReference` | `POST` | `/api/edge-backend/acquisition/checkout/${checkoutSessionId}/payment-reference` |
| `initiateAcquisitionPayment` | `POST` | `/api/edge-backend/acquisition/checkout/${encodeURIComponent(checkoutSessionId)}/initiate-payment` |
| `recordAcquisitionPaymentResult` | `POST` | `/api/edge-backend/acquisition/checkout/${checkoutSessionId}/payment-result` |
| `revalidateAcquisitionPlanBeforeCheckout` | `POST` | `/api/edge-backend/acquisition/checkout/revalidate-plan` |
| `requestAcquisitionHandoff` | `POST` | `/api/edge-backend/acquisition/handoffs` |
| `completeAcquisitionHandoff` | `POST` | `/api/edge-backend/acquisition/handoffs/${id}/complete` |
| `getAcquisitionJourneyByApplication` | `GET` | `/api/edge-backend/acquisition/journeys/${applicationId}` |
| `advanceAcquisitionJourney` | `POST` | `/api/edge-backend/acquisition/journeys/${id}/advance` |
| `getAcquisitionCustomerPortal` | `GET` | `/api/edge-backend/acquisition/customer-portal/${prospectId}` |
| `queueAcquisitionCommunication` | `POST` | `/api/edge-backend/acquisition/communications` |
| `updateAcquisitionCommunicationStatus` | `PATCH` | `/api/edge-backend/acquisition/communications/${id}/status` |
| `recordAcquisitionAnalyticsEvent` | `POST` | `/api/edge-backend/acquisition/analytics/events` |
| `getAcquisitionConversionFunnel` | `GET` | `/api/edge-backend/acquisition/analytics/funnel${toQuery({
        prospectId: params?.prospectId,
        limit: params?.limit,
      })}` |
| `getPublicAcquisitionProducts` | `GET` | `/api/acquisition-public/products${toQuery({
        limit: params?.limit,
        offset: params?.offset,
      })}` |
| `getPublicAcquisitionProduct` | `GET` | `/api/acquisition-public/products/${encodeURIComponent(slug)}` |
| `getPublicAcquisitionPlans` | `GET` | `/api/acquisition-public/plans${toQuery({
        productPresentationId: params?.productPresentationId,
        limit: params?.limit,
        offset: params?.offset,
      })}` |
| `getPublicAcquisitionForm` | `GET` | `/api/acquisition-public/forms/${encodeURIComponent(publicSlug)}` |
| `getPublicAcquisitionCheckout` | `GET` | `/api/acquisition-public/checkout/${encodeURIComponent(id)}` |
| `getPublicAcquisitionChallenge` | `GET` | `/api/acquisition-public/challenge` |
| `getPublicAcquisitionSegments` | `GET` | `/api/acquisition-public/segments${toQuery({
        productId: params?.productId,
        limit: params?.limit,
        offset: params?.offset,
      })}` |
| `getPublicAcquisitionCatalog` | `GET` | `/api/acquisition-public/catalog${toQuery({
        productId: params?.productId,
        verticalId: params?.verticalId,
      })}` |
| `postPublicAcquisitionApplication` | `POST` | `/api/acquisition-public/applications` |
| `postPublicAcquisitionCheckout` | `POST` | `/api/acquisition-public/checkout` |
| `postPublicAcquisitionLead` | `POST` | `/api/acquisition-public/leads` |
| `postPublicAcquisitionAnalytics` | `POST` | `/api/acquisition-public/analytics/events` |
| `getRevenueOverview` | `GET` | `/api/edge-backend/revenue/overview${toQuery({
        businessUnitId: params?.businessUnitId,
        asOf: params?.asOf,
      })}` |
| `getBusinessOverview` | `GET` | `/api/edge-backend/business/overview${toQuery({
        businessUnitId: params?.businessUnitId,
        asOf: params?.asOf,
      })}` |
| `getLiveCompleteLabStatus` | `GET` | `/api/edge-backend/live-complete/status` |
| `listRevenueMetricDefinitions` | `GET` | `/api/edge-backend/revenue/metrics/definitions${toQuery({
        status: params?.status,
        limit: params?.limit,
        offset: params?.offset,
      })}` |
| `registerRevenueMetricDefinition` | `POST` | `/api/edge-backend/revenue/metrics/definitions` |
| `publishRevenueMetricDefinition` | `POST` | `/api/edge-backend/revenue/metrics/definitions/${encodeURIComponent(definitionId)}/publish` |
| `recordRevenueMetricSnapshot` | `POST` | `/api/edge-backend/revenue/metrics/snapshots` |
| `computeRevenueMrrMovement` | `POST` | `/api/edge-backend/revenue/mrr/compute` |
| `computeRevenueCash` | `POST` | `/api/edge-backend/revenue/cash/compute` |
| `getRevenueRetentionOverview` | `GET` | `/api/edge-backend/revenue/retention${toQuery({
        businessUnitId: params?.businessUnitId,
        cohortId: params?.cohortId,
        asOf: params?.asOf,
      })}` |
| `getRenewalIntelligence` | `GET` | `/api/edge-backend/revenue/renewals/intelligence${toQuery({
        withinDays: params?.withinDays,
        limit: params?.limit,
      })}` |
| `listBusinessAlerts` | `GET` | `/api/edge-backend/business/alerts${toQuery({
        status: params?.status,
        limit: params?.limit,
        offset: params?.offset,
      })}` |
| `acknowledgeBusinessAlert` | `POST` | `/api/edge-backend/business/alerts/${encodeURIComponent(alertId)}/acknowledge` |
| `createBusinessAlertPolicy` | `POST` | `/api/edge-backend/business/alerts/policies` |
| `evaluateBusinessAlert` | `POST` | `/api/edge-backend/business/alerts/evaluate` |
| `recordRevenueRetentionSnapshot` | `POST` | `/api/edge-backend/revenue/retention/snapshots` |
| `listBusinessTargets` | `GET` | `/api/edge-backend/business/targets${toQuery({
        limit: params?.limit,
        offset: params?.offset,
      })}` |
| `listBusinessReports` | `GET` | `/api/edge-backend/business/reports${toQuery({
        limit: params?.limit,
        offset: params?.offset,
      })}` |
| `generateBusinessReport` | `POST` | `/api/edge-backend/business/reports/generate` |
| `runRevenueAssuranceScan` | `POST` | `/api/edge-backend/revenue/assurance/scan` |
| `createRevenueForecast` | `POST` | `/api/edge-backend/revenue/forecasts` |
| `createRevenueForecastScenario` | `POST` | `/api/edge-backend/revenue/forecasts/${encodeURIComponent(forecastId)}/scenarios` |
| `buildNamedForecastScenarios` | `POST` | `/api/edge-backend/revenue/forecasts/named-scenarios` |
| `createRevenueLeakageCase` | `POST` | `/api/edge-backend/revenue/leakage-cases` |
| `transitionRevenueLeakageCase` | `POST` | `/api/edge-backend/revenue/leakage-cases/${encodeURIComponent(caseId)}/transition` |
| `createCommissionPlan` | `POST` | `/api/edge-backend/revenue/commission/plans` |
| `createCommissionPlanAlias` | `POST` | `/api/edge-backend/commission/plans` |
| `calculateCommission` | `POST` | `/api/edge-backend/revenue/commission/calculations` |
| `calculateCommissionAlias` | `POST` | `/api/edge-backend/commission/calculations` |
| `listCommissionPlans` | `GET` | `/api/edge-backend/revenue/commission/plans` |
| `listCommissionPlansAlias` | `GET` | `/api/edge-backend/commission/plans` |
| `listBusinessAudit` | `GET` | `/api/edge-backend/business/audit${toQuery({
        aggregateType: params?.aggregateType,
        aggregateId: params?.aggregateId,
        eventType: params?.eventType,
        limit: params?.limit,
        offset: params?.offset,
      })}` |
| `appendBusinessAudit` | `POST` | `/api/edge-backend/business/audit` |
| `computeRevenueChurnRates` | `POST` | `/api/edge-backend/revenue/churn/compute` |
| `recordRevenueUnitEconomicsSnapshot` | `POST` | `/api/edge-backend/revenue/unit-economics/snapshots` |
| `recordRevenueProductProfitabilitySnapshot` | `POST` | `/api/edge-backend/revenue/product-profitability/snapshots` |
| `createBusinessDecision` | `POST` | `/api/edge-backend/business/decisions` |

## Notes

1. Le FE ne parle presque jamais à Nest en direct : tout passe par le BFF cookie-session.
2. Paths FE `/api/edge-backend/edge/...` correspondent à Nest `/api/v1/edge/...` (selon rewrite proxy).
3. Une page peut être « présente » mais MVP (peu d’actions branchées).
