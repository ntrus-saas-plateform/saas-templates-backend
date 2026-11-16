import { describe, expect, it, vi } from 'vitest';
import { InvoiceStatus } from '../../domain/billing/billing.entity.js';
import type { BillingRepositoryPort } from '../../domain/ports/billing-repository.port.js';
import type { RequestProvisioningUseCase } from '../subscription/subscription.use-cases.js';
import { MarkInvoicePaidIfSettledUseCase } from './billing.use-cases.js';

describe('MarkInvoicePaidIfSettledUseCase — auto-request provision on PAID', () => {
  const invoiceBase = {
    id: 'inv-1',
    invoiceNumber: 'INV-1',
    billingAccountId: 'ba-1',
    subscriptionId: 'sub-1',
    status: InvoiceStatus.ISSUED,
    currency: 'USD',
    subtotal: '10.00',
    discountTotal: '0.00',
    taxTotal: '0.00',
    total: '10.00',
    amountPaid: '10.00',
    amountDue: '0.00',
    profileSnapshot: {},
    commercialSnapshot: {},
    taxSnapshot: {},
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function billingRepo(invoice = invoiceBase): BillingRepositoryPort {
    return {
      getInvoice: vi.fn(async () => ({ ...invoice })),
      updateInvoice: vi.fn(async (_id, patch) => ({ ...invoice, ...patch })),
      appendInvoiceStatusHistory: vi.fn(async () => undefined),
    } as unknown as BillingRepositoryPort;
  }

  it('calls requestProvisioning when nextStatus is PAID and subscriptionId present', async () => {
    const billing = billingRepo();
    const requestProvisioning = {
      execute: vi.fn(async () => ({ id: 'prov-req-1' })),
    } as unknown as RequestProvisioningUseCase;

    const useCase = new MarkInvoicePaidIfSettledUseCase(
      billing,
      undefined,
      undefined,
      requestProvisioning,
    );

    const result = await useCase.execute({
      actorId: 'actor-1',
      invoiceId: 'inv-1',
      subscriptionId: 'sub-1',
    });

    expect(result.settled).toBe(true);
    expect(requestProvisioning.execute).toHaveBeenCalledWith({
      actorId: 'actor-1',
      subscriptionId: 'sub-1',
    });
  });

  it('uses invoice.subscriptionId when input omits it', async () => {
    const billing = billingRepo();
    const requestProvisioning = {
      execute: vi.fn(async () => ({ id: 'prov-req-1' })),
    } as unknown as RequestProvisioningUseCase;

    const useCase = new MarkInvoicePaidIfSettledUseCase(
      billing,
      undefined,
      undefined,
      requestProvisioning,
    );

    await useCase.execute({
      actorId: 'actor-1',
      invoiceId: 'inv-1',
    });

    expect(requestProvisioning.execute).toHaveBeenCalledWith({
      actorId: 'actor-1',
      subscriptionId: 'sub-1',
    });
  });

  it('keeps PAID when requestProvisioning throws', async () => {
    const billing = billingRepo();
    const requestProvisioning = {
      execute: vi.fn(async () => {
        throw new Error('BB down');
      }),
    } as unknown as RequestProvisioningUseCase;

    const useCase = new MarkInvoicePaidIfSettledUseCase(
      billing,
      undefined,
      undefined,
      requestProvisioning,
    );

    const result = await useCase.execute({
      actorId: 'actor-1',
      invoiceId: 'inv-1',
      subscriptionId: 'sub-1',
    });

    expect(result.settled).toBe(true);
    expect(billing.updateInvoice).toHaveBeenCalledWith('inv-1', {
      status: InvoiceStatus.PAID,
    });
  });

  it('does not request provisioning when not fully settled', async () => {
    const billing = billingRepo({
      ...invoiceBase,
      amountPaid: '2.00',
      amountDue: '8.00',
    });
    const requestProvisioning = {
      execute: vi.fn(async () => ({ id: 'prov-req-1' })),
    } as unknown as RequestProvisioningUseCase;

    const useCase = new MarkInvoicePaidIfSettledUseCase(
      billing,
      undefined,
      undefined,
      requestProvisioning,
    );

    const result = await useCase.execute({
      actorId: 'actor-1',
      invoiceId: 'inv-1',
      subscriptionId: 'sub-1',
    });

    expect(result.settled).toBe(false);
    expect(requestProvisioning.execute).not.toHaveBeenCalled();
  });
});
