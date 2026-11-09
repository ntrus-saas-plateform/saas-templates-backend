import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import {
  ProcessMetaWhatsAppMarketingWebhookUseCase,
  VerifyMetaWhatsAppWebhookSubscriptionUseCase,
} from './whatsapp-webhook.use-case.js';

describe('VerifyMetaWhatsAppWebhookSubscriptionUseCase', () => {
  it('echoes challenge when token matches', () => {
    const uc = new VerifyMetaWhatsAppWebhookSubscriptionUseCase('verify-me');
    expect(
      uc.execute({ mode: 'subscribe', token: 'verify-me', challenge: '12345' }),
    ).toBe('12345');
  });

  it('rejects bad token', () => {
    const uc = new VerifyMetaWhatsAppWebhookSubscriptionUseCase('verify-me');
    expect(() =>
      uc.execute({ mode: 'subscribe', token: 'nope', challenge: '12345' }),
    ).toThrow(DomainError);
  });
});

describe('ProcessMetaWhatsAppMarketingWebhookUseCase', () => {
  const appSecret = 'meta-app-secret';

  it('rejects invalid signature', async () => {
    const uc = new ProcessMetaWhatsAppMarketingWebhookUseCase(
      {} as never,
      { execute: vi.fn() } as never,
      appSecret,
    );
    await expect(
      uc.execute({ rawBody: '{}', signatureHeader: 'sha256=bad' }),
    ).rejects.toThrow(/signature invalid/i);
  });

  it('ingests delivered status by provider message id', async () => {
    const rawBody = JSON.stringify({
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [{ id: 'wamid.abc', status: 'delivered' }],
              },
            },
          ],
        },
      ],
    });
    const signatureHeader = `sha256=${createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex')}`;
    const ingest = vi.fn(async () => ({ receiptId: 'r1', duplicate: false }));
    const marketing = {
      findDeliveryByProviderMessageId: vi.fn(async () => ({
        id: 'attempt-wa-1',
        status: 'SUBMITTED',
      })),
    };
    const uc = new ProcessMetaWhatsAppMarketingWebhookUseCase(
      marketing as never,
      { execute: ingest } as never,
      appSecret,
    );

    const result = await uc.execute({ rawBody, signatureHeader });
    expect(result.processed).toBe(1);
    expect(ingest).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryAttemptId: 'attempt-wa-1',
        receiptStatus: 'DELIVERED',
        providerEventId: 'wamid.abc:delivered',
        signatureValid: true,
      }),
    );
  });
});
