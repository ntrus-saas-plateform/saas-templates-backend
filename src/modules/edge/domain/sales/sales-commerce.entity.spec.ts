import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import {
  ApprovalLevel,
  assertActivityHasCommercialContext,
  assertApprovalCannotBeBypassed,
  assertApprovalNotSelfServed,
  assertContractExecutable,
  assertContractStatusTransition,
  assertForecastIsNotRecognizedRevenue,
  assertHandoffPackageComplete,
  assertNoUnauthorizedCapabilityPromise,
  assertProvisioningNotFaked,
  assertQuoteMutable,
  assertQuoteStatusTransition,
  assertSalesOrderStatusTransition,
  assertUncoveredNeedsExplicit,
  computeDiscountPercent,
  ContractStatus,
  QuoteStatus,
  resolveRequiredDiscountApprovalLevel,
  SalesOrderStatus,
} from './sales-commerce.entity.js';

describe('sales activities & needs', () => {
  it('requires commercial context', () => {
    expect(() => assertActivityHasCommercialContext({})).toThrow(DomainError);
    expect(() =>
      assertActivityHasCommercialContext({ opportunityId: 'o1' }),
    ).not.toThrow();
  });

  it('forces uncovered needs on partial/no fit', () => {
    expect(() =>
      assertUncoveredNeedsExplicit({ fitDecision: 'PARTIAL_FIT', uncoveredNeeds: [] }),
    ).toThrow(DomainError);
    expect(() =>
      assertUncoveredNeedsExplicit({
        fitDecision: 'PARTIAL_FIT',
        uncoveredNeeds: ['offline mode'],
      }),
    ).not.toThrow();
  });

  it('blocks unauthorized capability promises', () => {
    expect(() =>
      assertNoUnauthorizedCapabilityPromise({
        promisedCapabilities: ['magic'],
        commerciallyAuthorizedCapabilities: ['pos'],
      }),
    ).toThrow(DomainError);
  });
});

describe('quotes', () => {
  it('allows draft → in_review → approved → issued → accepted', () => {
    expect(() =>
      assertQuoteStatusTransition(QuoteStatus.DRAFT, QuoteStatus.IN_REVIEW),
    ).not.toThrow();
    expect(() =>
      assertQuoteStatusTransition(QuoteStatus.APPROVED, QuoteStatus.ISSUED),
    ).not.toThrow();
    expect(() =>
      assertQuoteStatusTransition(QuoteStatus.ISSUED, QuoteStatus.ACCEPTED),
    ).not.toThrow();
  });

  it('forbids direct mutation of issued quotes', () => {
    expect(() => assertQuoteMutable(QuoteStatus.ISSUED)).toThrow(DomainError);
    expect(() => assertQuoteMutable(QuoteStatus.DRAFT)).not.toThrow();
  });
});

describe('deal desk approvals', () => {
  it('resolves approval level from matrix deterministically', () => {
    const matrix = [
      { maxPercent: 5, level: ApprovalLevel.STANDARD },
      { maxPercent: 15, level: ApprovalLevel.MANAGER },
      { maxPercent: 30, level: ApprovalLevel.EXECUTIVE },
    ];
    expect(resolveRequiredDiscountApprovalLevel({ discountPercent: 3, matrix })).toBe(
      ApprovalLevel.STANDARD,
    );
    expect(resolveRequiredDiscountApprovalLevel({ discountPercent: 10, matrix })).toBe(
      ApprovalLevel.MANAGER,
    );
    expect(resolveRequiredDiscountApprovalLevel({ discountPercent: 25, matrix })).toBe(
      ApprovalLevel.EXECUTIVE,
    );
    expect(() =>
      resolveRequiredDiscountApprovalLevel({ discountPercent: 50, matrix }),
    ).toThrow(DomainError);
  });

  it('blocks self-approval and approval bypass', () => {
    expect(() =>
      assertApprovalNotSelfServed({ requesterId: 'a', decisionBy: 'a' }),
    ).toThrow(DomainError);
    expect(() =>
      assertApprovalCannotBeBypassed({ required: true, approved: false }),
    ).toThrow(DomainError);
  });

  it('computes discount percent', () => {
    expect(computeDiscountPercent(1000, 850)).toBe(15);
  });
});

describe('contracts & orders & handoff', () => {
  it('requires provider confirmation for EXECUTED', () => {
    expect(() =>
      assertContractExecutable({
        toStatus: ContractStatus.EXECUTED,
        signatureProviderConfirmed: false,
      }),
    ).toThrow(DomainError);
    expect(() =>
      assertContractExecutable({
        toStatus: ContractStatus.EXECUTED,
        signatureProviderConfirmed: true,
      }),
    ).not.toThrow();
  });

  it('governs contract and order transitions', () => {
    expect(() =>
      assertContractStatusTransition(
        ContractStatus.APPROVED,
        ContractStatus.SENT_FOR_SIGNATURE,
      ),
    ).not.toThrow();
    expect(() =>
      assertContractStatusTransition(ContractStatus.DRAFT, ContractStatus.EXECUTED),
    ).toThrow(DomainError);
    expect(() =>
      assertSalesOrderStatusTransition(
        SalesOrderStatus.CONFIRMED,
        SalesOrderStatus.HANDOFF_PENDING,
      ),
    ).not.toThrow();
  });

  it('validates handoff package and forbids fake provisioning', () => {
    expect(() =>
      assertHandoffPackageComplete({
        accountId: 'a',
        productId: 'p',
        commercialTermsPresent: true,
        requireContract: true,
        contractExecutedWhenRequired: false,
      }),
    ).toThrow(DomainError);
    expect(() =>
      assertProvisioningNotFaked({
        claimedFulfilled: true,
        provisioningConfirmed: false,
      }),
    ).toThrow(DomainError);
    expect(() =>
      assertForecastIsNotRecognizedRevenue({ labelAsRecognizedRevenue: true }),
    ).toThrow(DomainError);
  });
});
