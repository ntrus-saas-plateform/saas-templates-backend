import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import {
  EDGE_PERMISSIONS_KEY,
  IS_PUBLIC_KEY,
} from '../../../../shared/auth/decorators.js';
import { AcquisitionController } from './acquisition.controller.js';

describe('AcquisitionController auth matrix', () => {
  const cases: Array<{ method: keyof AcquisitionController; permission: string }> = [
    { method: 'acquisitionOverview', permission: 'platform:acquisition:read' },
    { method: 'getProducts', permission: 'platform:acquisition:read' },
    { method: 'postProduct', permission: 'platform:acquisition:manage' },
    { method: 'postProductContent', permission: 'platform:acquisition:manage' },
    { method: 'postPublishProductContent', permission: 'platform:acquisition:manage' },
    { method: 'getPlans', permission: 'platform:acquisition:read' },
    { method: 'postPlan', permission: 'platform:acquisition:manage' },
    { method: 'getSegments', permission: 'platform:acquisition:read' },
    { method: 'postSegment', permission: 'platform:acquisition:manage' },
    { method: 'getProspects', permission: 'platform:acquisition:read' },
    { method: 'postProspect', permission: 'platform:acquisition:manage' },
    { method: 'postProspectTransition', permission: 'platform:acquisition:manage' },
    { method: 'getLeads', permission: 'platform:acquisition:read' },
    { method: 'postLead', permission: 'platform:acquisition:manage' },
    { method: 'postPromoteLead', permission: 'platform:acquisition:manage' },
    { method: 'getForms', permission: 'platform:acquisition:read' },
    { method: 'postForm', permission: 'platform:acquisition:forms:manage' },
    { method: 'postFormFromContract', permission: 'platform:acquisition:forms:manage' },
    { method: 'postFormVersion', permission: 'platform:acquisition:forms:manage' },
    { method: 'postPublishFormVersion', permission: 'platform:acquisition:forms:publish' },
    { method: 'getApplications', permission: 'platform:acquisition:read' },
    { method: 'postApplication', permission: 'platform:acquisition:manage' },
    { method: 'postApplicationAnswers', permission: 'platform:acquisition:manage' },
    { method: 'postSubmitApplication', permission: 'platform:acquisition:manage' },
    { method: 'postApplicationTransition', permission: 'platform:acquisition:review' },
    { method: 'postRequestInformation', permission: 'platform:acquisition:review' },
    { method: 'getDocuments', permission: 'platform:acquisition:read' },
    { method: 'postDocument', permission: 'platform:acquisition:manage' },
    { method: 'postDocumentReview', permission: 'platform:acquisition:documents:review' },
    { method: 'postDocumentRequirement', permission: 'platform:acquisition:forms:manage' },
    { method: 'postStartQualification', permission: 'platform:acquisition:review' },
    { method: 'postDecideQualification', permission: 'platform:acquisition:approve' },
    { method: 'getQuotations', permission: 'platform:acquisition:read' },
    { method: 'postQuotation', permission: 'platform:acquisition:quotes:manage' },
    { method: 'postQuoteReference', permission: 'platform:acquisition:quotes:manage' },
    { method: 'postAcceptQuote', permission: 'platform:acquisition:quotes:manage' },
    { method: 'getCheckouts', permission: 'platform:acquisition:read' },
    { method: 'getCheckoutById', permission: 'platform:acquisition:read' },
    { method: 'postCheckout', permission: 'platform:acquisition:checkout:operate' },
    { method: 'getHandoffs', permission: 'platform:acquisition:read' },
    { method: 'postPaymentReference', permission: 'platform:acquisition:checkout:operate' },
    { method: 'postInitiatePayment', permission: 'platform:acquisition:checkout:operate' },
    { method: 'postPaymentResult', permission: 'platform:acquisition:checkout:operate' },
    { method: 'postRevalidatePlan', permission: 'platform:acquisition:checkout:operate' },
    { method: 'postHandoff', permission: 'platform:acquisition:checkout:operate' },
    { method: 'postCompleteHandoff', permission: 'platform:acquisition:checkout:operate' },
    { method: 'getJourney', permission: 'platform:acquisition:read' },
    { method: 'postAdvanceJourney', permission: 'platform:acquisition:governance:manage' },
    { method: 'getCustomerPortal', permission: 'platform:acquisition:read' },
    { method: 'postCommunication', permission: 'platform:acquisition:governance:manage' },
    { method: 'patchCommunicationStatus', permission: 'platform:acquisition:governance:manage' },
    { method: 'postAnalyticsEvent', permission: 'platform:acquisition:manage' },
    { method: 'getFunnel', permission: 'platform:acquisition:analytics:read' },
  ];

  for (const { method, permission } of cases) {
    it(`${String(method)} requires ${permission}`, () => {
      const perms = Reflect.getMetadata(
        EDGE_PERMISSIONS_KEY,
        AcquisitionController.prototype[method],
      );
      expect(perms).toContain(permission);
      const isPublic = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        AcquisitionController.prototype[method],
      );
      expect(isPublic).toBeFalsy();
    });
  }
});
