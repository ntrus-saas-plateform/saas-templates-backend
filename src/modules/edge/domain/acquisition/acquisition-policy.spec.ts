import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  assertApplicationTransition,
  assertCheckoutAllowedForPriceMode,
  assertCheckoutTransition,
  assertContentVersionMutable,
  assertDocumentTransition,
  assertFormVersionMutable,
  assertFormVersionPublishable,
  assertHandoffCompletable,
  assertNoPaymentCredentials,
  assertPriceDisplayRef,
  assertProspectTransition,
  assertQualificationTransition,
  assertSeparationOfDuties,
} from './acquisition-policy.js';

describe('P10 acquisition-policy', () => {
  it('allows valid prospect transitions and rejects illegal ones', () => {
    expect(() => assertProspectTransition('NEW', 'CONTACTED')).not.toThrow();
    expect(() => assertProspectTransition('QUALIFIED', 'CHECKOUT_PENDING')).not.toThrow();
    expect(() => assertProspectTransition('CONVERTED', 'NEW')).toThrow(
      expect.objectContaining({ code: ErrorCode.CONFLICT }),
    );
    expect(() => assertProspectTransition('ARCHIVED', 'NEW')).toThrow(DomainError);
  });

  it('allows valid application transitions and rejects illegal ones', () => {
    expect(() => assertApplicationTransition('DRAFT', 'SUBMITTED')).not.toThrow();
    expect(() => assertApplicationTransition('SUBMITTED', 'IN_REVIEW')).not.toThrow();
    expect(() => assertApplicationTransition('APPROVED', 'CHECKOUT_READY')).not.toThrow();
    expect(() => assertApplicationTransition('REJECTED', 'APPROVED')).toThrow(DomainError);
    expect(() => assertApplicationTransition('COMPLETED', 'DRAFT')).toThrow(
      expect.objectContaining({ code: ErrorCode.CONFLICT }),
    );
  });

  it('allows valid document and qualification transitions', () => {
    expect(() => assertDocumentTransition('UPLOADED', 'PENDING_REVIEW')).not.toThrow();
    expect(() => assertDocumentTransition('PENDING_REVIEW', 'ACCEPTED')).not.toThrow();
    expect(() => assertDocumentTransition('ACCEPTED', 'REJECTED')).toThrow(DomainError);

    expect(() => assertQualificationTransition('PENDING', 'IN_PROGRESS')).not.toThrow();
    expect(() => assertQualificationTransition('IN_PROGRESS', 'APPROVED')).not.toThrow();
    expect(() => assertQualificationTransition('APPROVED', 'REJECTED')).toThrow(DomainError);
  });

  it('allows valid checkout transitions', () => {
    expect(() => assertCheckoutTransition('CREATED', 'AWAITING_PAYMENT')).not.toThrow();
    expect(() => assertCheckoutTransition('CAPTURED', 'HANDOFF_READY')).not.toThrow();
    expect(() => assertCheckoutTransition('COMPLETED', 'CREATED')).toThrow(DomainError);
  });

  it('enforces form version publishability and immutability after publish', () => {
    expect(() => assertFormVersionPublishable('DRAFT')).not.toThrow();
    expect(() => assertFormVersionPublishable('PUBLISHED')).toThrow(
      expect.objectContaining({ code: ErrorCode.CONFLICT }),
    );
    expect(() => assertFormVersionPublishable('SUPERSEDED')).toThrow(DomainError);

    expect(() => assertFormVersionMutable('DRAFT')).not.toThrow();
    expect(() => assertFormVersionMutable('PUBLISHED', true)).toThrow(
      expect.objectContaining({
        code: ErrorCode.CONFLICT,
        details: expect.arrayContaining([
          expect.objectContaining({ code: 'FORM_VERSION_IMMUTABLE' }),
        ]),
      }),
    );
    expect(() => assertFormVersionMutable('PUBLISHED', false)).not.toThrow();
    expect(() => assertFormVersionMutable('SUPERSEDED')).toThrow(DomainError);
    expect(() => assertFormVersionMutable('ARCHIVED')).toThrow(DomainError);
  });

  it('enforces content version immutability after publish', () => {
    expect(() => assertContentVersionMutable('DRAFT')).not.toThrow();
    expect(() => assertContentVersionMutable('PUBLISHED', true)).toThrow(
      expect.objectContaining({ code: ErrorCode.CONFLICT }),
    );
    expect(() => assertContentVersionMutable('PUBLISHED', false)).not.toThrow();
  });

  it('enforces SoD and price/checkout guards', () => {
    expect(() => assertSeparationOfDuties('alice', 'bob')).not.toThrow();
    expect(() => assertSeparationOfDuties('alice', 'Alice')).toThrow(
      expect.objectContaining({ code: ErrorCode.FORBIDDEN }),
    );

    expect(() => assertPriceDisplayRef('AUTHORITATIVE', 'plan-price-ref-1')).not.toThrow();
    expect(() => assertPriceDisplayRef('AUTHORITATIVE', '')).toThrow(
      expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }),
    );
    expect(() => assertPriceDisplayRef('INDICATIVE', null)).not.toThrow();

    expect(() =>
      assertCheckoutAllowedForPriceMode('QUOTE_REQUIRED', 'quote-ref-1'),
    ).not.toThrow();
    expect(() => assertCheckoutAllowedForPriceMode('QUOTE_REQUIRED', null)).toThrow(
      DomainError,
    );
    expect(() => assertCheckoutAllowedForPriceMode('INDICATIVE', null)).not.toThrow();
  });

  it('requires handoff evidence and blocks payment credentials in metadata', () => {
    expect(() =>
      assertHandoffCompletable('COMPLETED', 'evidence-abcd', 'sub-1'),
    ).not.toThrow();
    expect(() => assertHandoffCompletable('COMPLETED', 'ab', 'sub-1')).toThrow(DomainError);
    expect(() => assertHandoffCompletable('REQUESTED', null, null)).not.toThrow();

    expect(() => assertNoPaymentCredentials({ note: 'ok' })).not.toThrow();
    expect(() => assertNoPaymentCredentials({ cardNumber: '4111' })).toThrow(
      expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }),
    );
  });
});
