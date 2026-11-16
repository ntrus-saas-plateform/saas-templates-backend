import { describe, expect, it, vi } from 'vitest';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ConsentState } from '../../domain/marketing/marketing.entity.js';
import {
  SubmitMarketingFormPublicUseCase,
  WithdrawMarketingLeadConsentUseCase,
} from './marketing.use-cases.js';

function publishedForm(overrides?: Record<string, unknown>) {
  return {
    id: 'form-1',
    code: 'demo',
    name: 'Demo',
    formType: 'DEMO_REQUEST',
    slug: 'demo-request',
    productId: null,
    campaignId: null,
    status: 'PUBLISHED',
    version: 2,
    fields: [],
    requiredConsents: [
      {
        purpose: 'marketing',
        channel: 'EMAIL',
        textVersion: 'v1',
        consentRef: 'c-email',
      },
    ],
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function marketingRepo(overrides?: Record<string, unknown>) {
  const createLeadConsent = vi.fn(async () => ({ id: 'consent-1' }));
  return {
    getFormBySlug: vi.fn(async () => publishedForm()),
    findSubmissionByIdempotency: vi.fn(async () => null),
    findLeadByEmail: vi.fn(async () => null),
    createLead: vi.fn(async () => ({
      id: 'lead-1',
      emailNormalized: 'ada@okapi.io',
      status: 'NEW',
    })),
    createLeadContact: vi.fn(async () => ({ id: 'contact-1' })),
    createLeadConsent,
    createSubmission: vi.fn(async () => ({
      id: 'sub-1',
      formId: 'form-1',
      formVersion: 2,
      leadId: 'lead-1',
    })),
    createLeadActivity: vi.fn(async () => ({ id: 'act-1' })),
    createAttributionTouchpoint: vi.fn(async () => ({ id: 'tp-1' })),
    getLead: vi.fn(async () => ({ id: 'lead-1', emailNormalized: 'ada@okapi.io' })),
    listLeadConsents: vi.fn(async () => [
      {
        purpose: 'marketing',
        channel: 'EMAIL',
        state: ConsentState.GRANTED,
        consentTextVersion: 'v1',
        withdrawnAt: null,
      },
    ]),
    ...overrides,
    _createLeadConsent: createLeadConsent,
  };
}

describe('SubmitMarketingFormPublicUseCase consent gate', () => {
  it('persists validated GRANTED with proof evidence', async () => {
    const repo = marketingRepo();
    const uc = new SubmitMarketingFormPublicUseCase(repo as never);
    const result = await uc.execute({
      slug: 'demo-request',
      payload: { email: 'Ada@Okapi.IO', fullName: 'Ada' },
      consents: [
        {
          purpose: 'marketing',
          channel: 'EMAIL',
          textVersion: 'v1',
          decision: 'GRANTED',
          consentRef: 'c-email',
          locale: 'fr-FR',
          decidedAt: '2026-03-01T12:00:00.000Z',
        },
      ],
    });

    expect(result.duplicate).toBe(false);
    expect(repo._createLeadConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: 'lead-1',
        purpose: 'marketing',
        channel: 'EMAIL',
        state: ConsentState.GRANTED,
        consentTextVersion: 'v1',
        proofRef: expect.stringContaining('"formSlug":"demo-request"'),
      }),
    );
    const proof = JSON.parse(repo._createLeadConsent.mock.calls[0][0].proofRef);
    expect(proof).toMatchObject({
      formId: 'form-1',
      formVersion: 2,
      formSlug: 'demo-request',
      locale: 'fr-FR',
      decidedAt: '2026-03-01T12:00:00.000Z',
      textVersion: 'v1',
    });
  });

  it('rejects missing mandatory consent before lead write', async () => {
    const repo = marketingRepo();
    const uc = new SubmitMarketingFormPublicUseCase(repo as never);
    await expect(
      uc.execute({
        slug: 'demo-request',
        payload: { email: 'ada@okapi.io' },
        consents: [],
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    expect(repo.createLead).not.toHaveBeenCalled();
    expect(repo._createLeadConsent).not.toHaveBeenCalled();
  });

  it('rejects incorrect purpose / channel / textVersion / forged consentRef', async () => {
    const repo = marketingRepo();
    const uc = new SubmitMarketingFormPublicUseCase(repo as never);

    await expect(
      uc.execute({
        slug: 'demo-request',
        payload: { email: 'ada@okapi.io' },
        consents: [
          {
            purpose: 'wrong',
            channel: 'EMAIL',
            textVersion: 'v1',
            decision: 'GRANTED',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(DomainError);

    await expect(
      uc.execute({
        slug: 'demo-request',
        payload: { email: 'ada@okapi.io' },
        consents: [
          {
            purpose: 'marketing',
            channel: 'SMS',
            textVersion: 'v1',
            decision: 'GRANTED',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(DomainError);

    await expect(
      uc.execute({
        slug: 'demo-request',
        payload: { email: 'ada@okapi.io' },
        consents: [
          {
            purpose: 'marketing',
            channel: 'EMAIL',
            textVersion: 'old',
            decision: 'GRANTED',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(DomainError);

    await expect(
      uc.execute({
        slug: 'demo-request',
        payload: { email: 'ada@okapi.io' },
        consents: [
          {
            purpose: 'marketing',
            channel: 'EMAIL',
            textVersion: 'v1',
            decision: 'GRANTED',
            consentRef: 'forged',
          },
        ],
      }),
    ).rejects.toThrow(/Forged consentRef/i);
  });

  it('rejects DENIED and NOT_PROVIDED for mandatory', async () => {
    const repo = marketingRepo();
    const uc = new SubmitMarketingFormPublicUseCase(repo as never);

    await expect(
      uc.execute({
        slug: 'demo-request',
        payload: { email: 'ada@okapi.io' },
        consents: [
          {
            purpose: 'marketing',
            channel: 'EMAIL',
            textVersion: 'v1',
            decision: 'DENIED',
            consentRef: 'c-email',
          },
        ],
      }),
    ).rejects.toThrow(/must be GRANTED/i);

    await expect(
      uc.execute({
        slug: 'demo-request',
        payload: { email: 'ada@okapi.io' },
        consents: [
          {
            purpose: 'marketing',
            channel: 'EMAIL',
            textVersion: 'v1',
            decision: 'NOT_PROVIDED',
            consentRef: 'c-email',
          },
        ],
      }),
    ).rejects.toThrow(/must be GRANTED/i);
  });

  it('rejects duplicate purpose+channel', async () => {
    const repo = marketingRepo();
    const uc = new SubmitMarketingFormPublicUseCase(repo as never);
    await expect(
      uc.execute({
        slug: 'demo-request',
        payload: { email: 'ada@okapi.io' },
        consents: [
          {
            purpose: 'marketing',
            channel: 'EMAIL',
            textVersion: 'v1',
            decision: 'GRANTED',
            consentRef: 'c-email',
          },
          {
            purpose: 'marketing',
            channel: 'EMAIL',
            textVersion: 'v1',
            decision: 'GRANTED',
            consentRef: 'c-email',
          },
        ],
      }),
    ).rejects.toThrow(/Duplicate consent/i);
  });

  it('allows omitting optional non-mandatory consent', async () => {
    const repo = marketingRepo({
      getFormBySlug: vi.fn(async () =>
        publishedForm({
          requiredConsents: [
            {
              purpose: 'marketing',
              channel: 'EMAIL',
              textVersion: 'v1',
              consentRef: 'c-email',
            },
            {
              purpose: 'marketing',
              channel: 'SMS',
              textVersion: 'v1',
              mandatory: false,
            },
          ],
        }),
      ),
    });
    const uc = new SubmitMarketingFormPublicUseCase(repo as never);
    await uc.execute({
      slug: 'demo-request',
      payload: { email: 'ada@okapi.io' },
      consents: [
        {
          purpose: 'marketing',
          channel: 'EMAIL',
          textVersion: 'v1',
          decision: 'GRANTED',
          consentRef: 'c-email',
        },
      ],
    });
    expect(repo._createLeadConsent).toHaveBeenCalledTimes(1);
    expect(repo._createLeadConsent.mock.calls[0][0].channel).toBe('EMAIL');
  });
});

describe('WithdrawMarketingLeadConsentUseCase', () => {
  it('inserts WITHDRAWN row preserving history', async () => {
    const createLeadConsent = vi.fn(async () => ({ id: 'consent-w' }));
    const repo = marketingRepo({ createLeadConsent });
    const uc = new WithdrawMarketingLeadConsentUseCase(repo as never);
    const result = await uc.execute({
      leadId: 'lead-1',
      purpose: 'marketing',
      channel: 'EMAIL',
      actorId: 'admin-1',
      locale: 'fr-FR',
    });

    expect(result.state).toBe(ConsentState.WITHDRAWN);
    expect(createLeadConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: 'lead-1',
        purpose: 'marketing',
        channel: 'EMAIL',
        state: ConsentState.WITHDRAWN,
        consentTextVersion: 'v1',
        source: 'withdraw:admin-1',
      }),
    );
    const proof = JSON.parse(createLeadConsent.mock.calls[0][0].proofRef);
    expect(proof.action).toBe('WITHDRAW');
    expect(proof.locale).toBe('fr-FR');
  });

  it('fails when lead is missing', async () => {
    const repo = marketingRepo({
      getLead: vi.fn(async () => null),
    });
    const uc = new WithdrawMarketingLeadConsentUseCase(repo as never);
    await expect(
      uc.execute({
        leadId: 'missing',
        purpose: 'marketing',
        channel: 'EMAIL',
        actorId: 'admin-1',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.RESOURCE_NOT_FOUND });
  });
});
