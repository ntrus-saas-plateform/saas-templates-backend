import { describe, expect, it, vi } from 'vitest';
import { PaymentIntentStatus } from '../../domain/billing/billing.entity.js';
import { ConfirmPaymentIntentUseCase } from './billing.use-cases.js';

describe('ConfirmPaymentIntentUseCase — payment FAILED never activates', () => {
  it('marks FAILED and does not settle invoice / provision', async () => {
    const markInvoicePaidIfSettled = { execute: vi.fn() };
    const billing = {
      getPaymentIntent: vi.fn(async () => ({
        id: 'pi-1',
        status: PaymentIntentStatus.PROCESSING,
        providerIntentRef: 'sandbox-1',
        provider: 'sandbox',
        invoiceId: 'inv-1',
        amount: '10.00',
        currency: 'USD',
      })),
      updatePaymentIntent: vi.fn(async (_id: string, patch: Record<string, unknown>) => ({
        id: 'pi-1',
        status: patch.status,
      })),
      createPaymentAttempt: vi.fn(),
      getInvoice: vi.fn(),
      createPaymentAllocation: vi.fn(),
      updateInvoice: vi.fn(),
    };
    const payments = {
      fetchPaymentStatus: vi.fn(async () => ({
        outcome: 'FAILED' as const,
        providerRef: 'sandbox-1',
      })),
    };

    const uc = new ConfirmPaymentIntentUseCase(
      billing as never,
      payments as never,
      undefined,
      markInvoicePaidIfSettled as never,
    );

    const result = await uc.execute({
      actorId: 'ops-1',
      paymentIntentId: 'pi-1',
    });

    expect(result.confirmed).toBe(false);
    expect(result.intent.status).toBe(PaymentIntentStatus.FAILED);
    expect(markInvoicePaidIfSettled.execute).not.toHaveBeenCalled();
    expect(billing.getInvoice).not.toHaveBeenCalled();
  });
});
