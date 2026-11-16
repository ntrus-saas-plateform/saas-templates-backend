import { describe, expect, it } from 'vitest';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ConsentState } from './marketing.entity.js';
import {
  parseRequiredConsents,
  validateSubmittedConsents,
  type RequiredConsentDefinition,
  type SubmittedConsent,
} from './marketing-consent.js';

const formMeta = {
  formId: 'form-1',
  formVersion: 3,
  formSlug: 'demo-request',
};

const mandatoryEmail: RequiredConsentDefinition = {
  purpose: 'marketing',
  channel: 'EMAIL',
  textVersion: 'v1',
  consentRef: 'c-email',
};

const optionalSms: RequiredConsentDefinition = {
  purpose: 'marketing',
  channel: 'SMS',
  textVersion: 'v1',
  mandatory: false,
  consentRef: 'c-sms',
};

function granted(overrides?: Partial<SubmittedConsent>): SubmittedConsent {
  return {
    purpose: 'marketing',
    channel: 'EMAIL',
    textVersion: 'v1',
    decision: 'GRANTED',
    consentRef: 'c-email',
    locale: 'fr-FR',
    ...overrides,
  };
}

describe('parseRequiredConsents', () => {
  it('defaults mandatory to true when omitted', () => {
    const parsed = parseRequiredConsents([
      { purpose: 'marketing', channel: 'EMAIL', textVersion: 'v1' },
    ]);
    expect(parsed[0].mandatory).toBeUndefined();
    expect(parsed[0].purpose).toBe('marketing');
  });

  it('rejects malformed entries', () => {
    expect(() => parseRequiredConsents([{ purpose: 'x' }])).toThrow(DomainError);
  });
});

describe('validateSubmittedConsents', () => {
  it('accepts valid GRANTED with evidence proof', () => {
    const { records } = validateSubmittedConsents({
      required: [mandatoryEmail],
      submitted: [granted({ decidedAt: '2026-01-01T00:00:00.000Z' })],
      ...formMeta,
    });
    expect(records).toHaveLength(1);
    expect(records[0].state).toBe(ConsentState.GRANTED);
    expect(records[0].proof).toEqual({
      formId: 'form-1',
      formVersion: 3,
      formSlug: 'demo-request',
      locale: 'fr-FR',
      decidedAt: '2026-01-01T00:00:00.000Z',
      textVersion: 'v1',
      consentRef: 'c-email',
    });
  });

  it('rejects missing mandatory consent', () => {
    expect(() =>
      validateSubmittedConsents({
        required: [mandatoryEmail],
        submitted: undefined,
        ...formMeta,
      }),
    ).toThrow(DomainError);
    try {
      validateSubmittedConsents({
        required: [mandatoryEmail],
        submitted: [],
        ...formMeta,
      });
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe(ErrorCode.VALIDATION_ERROR);
      expect((e as DomainError).message).toMatch(/Missing mandatory/i);
    }
  });

  it('rejects incorrect purpose', () => {
    expect(() =>
      validateSubmittedConsents({
        required: [mandatoryEmail],
        submitted: [granted({ purpose: 'other' })],
        ...formMeta,
      }),
    ).toThrow(/does not match/i);
  });

  it('rejects incorrect channel', () => {
    expect(() =>
      validateSubmittedConsents({
        required: [mandatoryEmail],
        submitted: [granted({ channel: 'WHATSAPP' })],
        ...formMeta,
      }),
    ).toThrow(/does not match/i);
  });

  it('rejects incorrect text version', () => {
    expect(() =>
      validateSubmittedConsents({
        required: [mandatoryEmail],
        submitted: [granted({ textVersion: 'v999' })],
        ...formMeta,
      }),
    ).toThrow(/does not match/i);
  });

  it('rejects forged consentRef', () => {
    expect(() =>
      validateSubmittedConsents({
        required: [mandatoryEmail],
        submitted: [granted({ consentRef: 'forged-ref' })],
        ...formMeta,
      }),
    ).toThrow(/Forged consentRef/i);
  });

  it('rejects duplicate purpose+channel', () => {
    expect(() =>
      validateSubmittedConsents({
        required: [mandatoryEmail],
        submitted: [granted(), granted({ textVersion: 'v1' })],
        ...formMeta,
      }),
    ).toThrow(/Duplicate consent/i);
  });

  it('rejects DENIED for mandatory', () => {
    expect(() =>
      validateSubmittedConsents({
        required: [mandatoryEmail],
        submitted: [granted({ decision: 'DENIED' })],
        ...formMeta,
      }),
    ).toThrow(/must be GRANTED/i);
  });

  it('rejects NOT_PROVIDED for mandatory', () => {
    expect(() =>
      validateSubmittedConsents({
        required: [mandatoryEmail],
        submitted: [granted({ decision: 'NOT_PROVIDED' })],
        ...formMeta,
      }),
    ).toThrow(/must be GRANTED/i);
  });

  it('rejects WITHDRAWN on initial submit', () => {
    expect(() =>
      validateSubmittedConsents({
        required: [mandatoryEmail],
        submitted: [granted({ decision: 'WITHDRAWN' })],
        ...formMeta,
      }),
    ).toThrow(/WITHDRAWN is not allowed/i);
  });

  it('allows omitting optional non-mandatory consent', () => {
    const { records } = validateSubmittedConsents({
      required: [mandatoryEmail, optionalSms],
      submitted: [granted()],
      ...formMeta,
    });
    expect(records).toHaveLength(1);
    expect(records[0].channel).toBe('EMAIL');
  });

  it('persists optional DENIED without auto-grant', () => {
    const { records } = validateSubmittedConsents({
      required: [mandatoryEmail, optionalSms],
      submitted: [
        granted(),
        {
          purpose: 'marketing',
          channel: 'SMS',
          textVersion: 'v1',
          decision: 'DENIED',
          consentRef: 'c-sms',
        },
      ],
      ...formMeta,
    });
    expect(records).toHaveLength(2);
    expect(records.find((r) => r.channel === 'SMS')?.state).toBe(ConsentState.DENIED);
  });

  it('never invents GRANTED for missing optional', () => {
    const { records } = validateSubmittedConsents({
      required: [optionalSms],
      submitted: [],
      ...formMeta,
    });
    expect(records).toEqual([]);
  });
});
