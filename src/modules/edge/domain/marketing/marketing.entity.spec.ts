import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import {
  assertCampaignCanPromoteProduct,
  assertCampaignPublishable,
  assertCampaignStatusTransition,
  assertConsentAllowsChannel,
  assertFormDoesNotProvisionTenant,
  assertMetricNotInvented,
  assertOfferPromotable,
  calculateExplainableLeadScore,
  CampaignStatus,
  ConsentState,
  DataQuality,
  normalizeLeadEmail,
} from './marketing.entity.js';

describe('marketing campaign lifecycle', () => {
  it('allows draft → in_review → approved → active', () => {
    expect(() =>
      assertCampaignStatusTransition(CampaignStatus.DRAFT, CampaignStatus.IN_REVIEW),
    ).not.toThrow();
    expect(() =>
      assertCampaignStatusTransition(CampaignStatus.IN_REVIEW, CampaignStatus.APPROVED),
    ).not.toThrow();
    expect(() =>
      assertCampaignStatusTransition(CampaignStatus.APPROVED, CampaignStatus.ACTIVE),
    ).not.toThrow();
  });

  it('blocks draft → active', () => {
    expect(() =>
      assertCampaignStatusTransition(CampaignStatus.DRAFT, CampaignStatus.ACTIVE),
    ).toThrow(DomainError);
  });

  it('requires approval before publish', () => {
    expect(() =>
      assertCampaignPublishable({
        status: CampaignStatus.DRAFT,
        finalApprovalDecision: null,
      }),
    ).toThrow(DomainError);
    expect(() =>
      assertCampaignPublishable({
        status: CampaignStatus.APPROVED,
        finalApprovalDecision: null,
      }),
    ).toThrow(DomainError);
    expect(() =>
      assertCampaignPublishable({
        status: CampaignStatus.APPROVED,
        finalApprovalDecision: 'APPROVED',
      }),
    ).not.toThrow();
  });
});

describe('marketing commercial gates', () => {
  it('blocks unavailable product promotion', () => {
    expect(() =>
      assertCampaignCanPromoteProduct({
        productLifecycleStatus: 'PUBLISHED',
        commercialAvailability: 'UNAVAILABLE',
      }),
    ).toThrow(DomainError);
  });

  it('blocks unpublished offer', () => {
    expect(() => assertOfferPromotable({ offerStatus: 'DRAFT' })).toThrow(DomainError);
  });
});

describe('consent & scoring', () => {
  it('normalizes email for dedup', () => {
    expect(normalizeLeadEmail('  Ada@Okapi.IO ')).toBe('ada@okapi.io');
  });

  it('blocks channel without granted consent', () => {
    expect(() =>
      assertConsentAllowsChannel({
        consents: [
          {
            purpose: 'marketing_email',
            channel: 'EMAIL',
            state: ConsentState.WITHDRAWN,
          },
        ],
        purpose: 'marketing_email',
        channel: 'EMAIL',
      }),
    ).toThrow(DomainError);
  });

  it('computes explainable score deterministically', () => {
    const a = calculateExplainableLeadScore({
      modelVersion: 1,
      weights: {
        icpMatch: 25,
        demoRequest: 30,
        profileCompleteness: 10,
      },
      signals: {
        icpMatch: true,
        demoRequest: true,
        profileCompletenessRatio: 0.5,
      },
    });
    const b = calculateExplainableLeadScore({
      modelVersion: 1,
      weights: {
        icpMatch: 25,
        demoRequest: 30,
        profileCompleteness: 10,
      },
      signals: {
        icpMatch: true,
        demoRequest: true,
        profileCompletenessRatio: 0.5,
      },
    });
    expect(a.score).toBe(60);
    expect(a.score).toBe(b.score);
    expect(a.applied.map((x) => x.criterion)).toEqual([
      'icp_match',
      'demo_request',
      'profile_completeness',
    ]);
  });
});

describe('public form + metric honesty', () => {
  it('form types never provision tenants (invariant marker)', () => {
    expect(() => assertFormDoesNotProvisionTenant('TRIAL_REQUEST')).not.toThrow();
    expect(() => assertFormDoesNotProvisionTenant('DEMO_REQUEST')).not.toThrow();
    expect(() => assertFormDoesNotProvisionTenant('NEWSLETTER')).not.toThrow();
  });

  it('rejects unknown metric quality labels', () => {
    expect(() => assertMetricNotInvented('GUESSED')).toThrow(DomainError);
    expect(() => assertMetricNotInvented(DataQuality.MEASURED)).not.toThrow();
    expect(() => assertMetricNotInvented(DataQuality.UNAVAILABLE)).not.toThrow();
  });
});
