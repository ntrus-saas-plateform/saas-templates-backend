import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import {
  assertAccountIsNotTenant,
  assertAccountStatusTransition,
  assertControlledMerge,
  assertQualificationDecision,
  assertRejectionRequiresReason,
  assertSalesDecisionIndependentOfMarketingScore,
  assertSalesLeadStatusTransition,
  assertClosedWonGates,
  assertOpportunityMutable,
  assertPipelineTransitionAllowed,
  assertValidLossReason,
  computeWeightedPipelineValue,
  CommercialAccountStatus,
  normalizeAccountName,
  normalizeEmailDomain,
  OpportunityStatus,
  PipelineStageKind,
  SalesLeadStatus,
} from './sales.entity.js';

describe('commercial account lifecycle', () => {
  it('allows prospect → qualified → active_customer', () => {
    expect(() =>
      assertAccountStatusTransition(
        CommercialAccountStatus.PROSPECT,
        CommercialAccountStatus.QUALIFIED,
      ),
    ).not.toThrow();
    expect(() =>
      assertAccountStatusTransition(
        CommercialAccountStatus.QUALIFIED,
        CommercialAccountStatus.ACTIVE_CUSTOMER,
      ),
    ).not.toThrow();
  });

  it('blocks merged → any', () => {
    expect(() =>
      assertAccountStatusTransition(
        CommercialAccountStatus.MERGED,
        CommercialAccountStatus.PROSPECT,
      ),
    ).toThrow(DomainError);
  });

  it('forbids tenant binding on account create', () => {
    expect(() => assertAccountIsNotTenant({ tenantId: 't-1' })).toThrow(DomainError);
    expect(() => assertAccountIsNotTenant({ createsTenant: true })).toThrow(DomainError);
    expect(() => assertAccountIsNotTenant({})).not.toThrow();
  });
});

describe('account merge controls', () => {
  it('requires explicit reason and forbids auto name merge', () => {
    expect(() =>
      assertControlledMerge({
        survivingAccountId: 'a',
        mergedAccountId: 'b',
        reason: null,
      }),
    ).toThrow(DomainError);
    expect(() =>
      assertControlledMerge({
        survivingAccountId: 'a',
        mergedAccountId: 'b',
        reason: 'same legal id',
        autoMergeByNameSimilarity: true,
      }),
    ).toThrow(DomainError);
    expect(() =>
      assertControlledMerge({
        survivingAccountId: 'a',
        mergedAccountId: 'b',
        reason: 'same legal id verified',
      }),
    ).not.toThrow();
  });
});

describe('sales lead transitions', () => {
  it('allows received → accepted → sales_qualified', () => {
    expect(() =>
      assertSalesLeadStatusTransition(SalesLeadStatus.RECEIVED, SalesLeadStatus.ACCEPTED),
    ).not.toThrow();
    expect(() =>
      assertSalesLeadStatusTransition(
        SalesLeadStatus.ACCEPTED,
        SalesLeadStatus.SALES_QUALIFIED,
      ),
    ).not.toThrow();
  });

  it('blocks received → converted', () => {
    expect(() =>
      assertSalesLeadStatusTransition(
        SalesLeadStatus.RECEIVED,
        SalesLeadStatus.CONVERTED_TO_OPPORTUNITY,
      ),
    ).toThrow(DomainError);
  });

  it('requires rejection reason', () => {
    expect(() =>
      assertRejectionRequiresReason({
        toStatus: SalesLeadStatus.REJECTED,
      }),
    ).toThrow(DomainError);
    expect(() =>
      assertRejectionRequiresReason({
        toStatus: SalesLeadStatus.REJECTED,
        reasonCode: 'NO_BUDGET',
      }),
    ).not.toThrow();
  });

  it('requires sales qualification criteria', () => {
    expect(() =>
      assertQualificationDecision({
        needConfirmed: true,
        productFit: true,
        decisionCapacity: false,
      }),
    ).toThrow(DomainError);
  });

  it('forbids deciding solely on marketing score', () => {
    expect(() =>
      assertSalesDecisionIndependentOfMarketingScore({
        marketingScore: 92,
        salesDecisionBasedOnlyOnMarketingScore: true,
      }),
    ).toThrow(DomainError);
  });
});

describe('normalization helpers', () => {
  it('normalizes account names', () => {
    expect(normalizeAccountName('  Okapi  S.A. ')).toBe('okapi s a');
  });

  it('extracts email domains', () => {
    expect(normalizeEmailDomain('a@Okapi.IO')).toBe('okapi.io');
    expect(normalizeEmailDomain('okapi.io')).toBe('okapi.io');
  });
});

describe('opportunity pipeline controls', () => {
  it('rejects illegal stage jumps', () => {
    expect(() =>
      assertPipelineTransitionAllowed({
        allowedToStageIds: ['a'],
        toStageId: 'b',
      }),
    ).toThrow(DomainError);
  });

  it('blocks closed won without product/value', () => {
    expect(() =>
      assertClosedWonGates({
        toStageKind: PipelineStageKind.WON,
        accountId: 'acc',
        estimatedValue: 0,
        productId: 'p',
      }),
    ).toThrow(DomainError);
  });

  it('requires loss reason on closed lost', () => {
    expect(() => assertValidLossReason({})).toThrow(DomainError);
    expect(() => assertValidLossReason({ reasonCode: 'PRICE' })).not.toThrow();
  });

  it('blocks silent edits on closed opportunities', () => {
    expect(() => assertOpportunityMutable(OpportunityStatus.WON)).toThrow(
      DomainError,
    );
  });

  it('computes weighted pipeline without claiming revenue', () => {
    expect(computeWeightedPipelineValue(10000, 0.5)).toBe(5000);
  });
});
