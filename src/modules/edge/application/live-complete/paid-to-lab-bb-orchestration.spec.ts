/**
 * E2/E3 orchestration: sandbox settle path → RequestProvisioning → lab_bb → BB ready.
 * Not a docker E2E — proves the wired control-plane chain without Unavailable* adapters.
 */
import { describe, expect, it, vi } from 'vitest';
import { InvoiceStatus } from '../../domain/billing/billing.entity.js';
import { SandboxPaymentProviderAdapter } from '../../infrastructure/billing/sandbox-payment.adapter.js';
import { LabBbProvisioningAdapter } from '../../infrastructure/provisioning/lab-bb-provisioning.adapter.js';
import type { ControlV1BusinessBackendClient } from '../../infrastructure/product-control/control-v1-business-backend.client.js';
import { MarkInvoicePaidIfSettledUseCase } from '../billing/billing.use-cases.js';
import { RequestProvisioningUseCase } from '../subscription/subscription.use-cases.js';
import { GetCustomerPortalSnapshotUseCase } from '../acquisition/acquisition.use-cases.js';
import type { TenantRuntimeStatusPort } from '../../domain/acquisition/tenant-runtime-status.port.js';

describe('live-complete orchestration PAID → lab_bb → portal ready', () => {
  it('sandbox intent confirms, PAID triggers provisioning, portal flips when BB ready', async () => {
    const payments = new SandboxPaymentProviderAdapter();
    const created = await payments.createPaymentIntent({
      billingAccountId: 'ba-1',
      amount: '100.00',
      currency: 'USD',
      correlationId: 'corr-orch-1',
    });
    expect(created.outcome).toBe('REQUESTED');
    if (created.outcome !== 'REQUESTED' && created.outcome !== 'SUCCEEDED') {
      throw new Error('unexpected create outcome');
    }
    const confirmed = await payments.confirmPaymentIntent({
      provider: 'sandbox',
      providerIntentRef: created.providerIntentRef,
      correlationId: 'corr-orch-1',
    });
    expect(confirmed.outcome).toBe('SUCCEEDED');

    const provision = vi.fn(async () => ({
      ok: true,
      status: 201,
      body: { status: 'provisioned' },
      text: '',
    }));
    const getTenantReady = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: { ready: true },
      text: '',
    }));
    const bb = {
      isConfigured: () => true,
      provision,
      getTenantReady,
      getTenantState: vi.fn(),
    } as unknown as ControlV1BusinessBackendClient;
    const labBb = new LabBbProvisioningAdapter(bb);

    const sub = {
      id: 'sub-1',
      subscriptionNumber: 'SUB-1',
      accountId: 'acc-1',
      productId: 'prod-pharmacy',
      metadata: {},
    };
    const createProvisioningRequest = vi.fn(async (input: Record<string, unknown>) => ({
      id: 'pr-1',
      ...input,
    }));
    const subscriptions = {
      getById: vi.fn(async () => sub),
      createProvisioningRequest,
      listProvisioningRequests: vi.fn(async () => []),
    };
    const requestProvisioning = new RequestProvisioningUseCase(
      subscriptions as never,
      labBb,
    );

    const invoice = {
      id: 'inv-1',
      billingAccountId: 'ba-1',
      currency: 'USD',
      amountDue: '0.00',
      amountPaid: '100.00',
      status: InvoiceStatus.ISSUED,
      subscriptionId: 'sub-1',
    };
    const billing = {
      getInvoice: vi
        .fn()
        .mockResolvedValueOnce(invoice)
        .mockResolvedValue({ ...invoice, status: InvoiceStatus.PAID }),
      updateInvoice: vi.fn(async () => undefined),
      appendInvoiceStatusHistory: vi.fn(async () => undefined),
    };

    const markPaid = new MarkInvoicePaidIfSettledUseCase(
      billing as never,
      undefined,
      undefined,
      requestProvisioning,
    );
    const settled = await markPaid.execute({
      actorId: 'ops-1',
      invoiceId: 'inv-1',
      subscriptionId: 'sub-1',
    });
    expect(settled.settled).toBe(true);
    expect(createProvisioningRequest).toHaveBeenCalled();
    expect(provision).toHaveBeenCalled();

    const complete = await labBb.completeProvisioning({
      requestId: 'pr-1',
      subscriptionId: 'sub-1',
      tenantRef: 'tenant-from-lab',
      externalRef: 'tenant-from-lab',
    });
    expect(complete.outcome).toBe('COMPLETE');

    const runtime: TenantRuntimeStatusPort = {
      isTenantReady: async () => ({ ready: true, source: 'CONTROL_V1' }),
    };
    const repo = {
      getProspect: vi.fn(async () => ({
        id: 'pros-1',
        email: 'a@b.c',
        status: 'ACTIVE',
      })),
      listApplications: vi.fn(async () => ({ items: [], total: 0 })),
      listCheckoutSessions: vi.fn(async () => ({ items: [], total: 0 })),
      listSubscriptionHandoffs: vi.fn(async () => ({
        items: [
          {
            id: 'h-1',
            status: 'COMPLETED',
            metadata: { tenantId: 'tenant-from-lab' },
          },
        ],
        total: 1,
      })),
    };
    const portal = new GetCustomerPortalSnapshotUseCase(repo as never, runtime);
    const snap = await portal.execute({ prospectId: 'pros-1' });
    expect(snap.provisioningComplete).toBe(true);
  });

  it('does not invent portal complete when runtime UNAVAILABLE', async () => {
    const runtime: TenantRuntimeStatusPort = {
      isTenantReady: async () => ({ ready: false, source: 'UNAVAILABLE' }),
    };
    const repo = {
      getProspect: vi.fn(async () => ({ id: 'pros-2', email: 'a@b.c', status: 'ACTIVE' })),
      listApplications: vi.fn(async () => ({ items: [], total: 0 })),
      listCheckoutSessions: vi.fn(async () => ({ items: [], total: 0 })),
      listSubscriptionHandoffs: vi.fn(async () => ({
        items: [{ id: 'h-2', status: 'COMPLETED', metadata: { tenantId: 't-x' } }],
        total: 1,
      })),
    };
    const portal = new GetCustomerPortalSnapshotUseCase(repo as never, runtime);
    const snap = await portal.execute({ prospectId: 'pros-2' });
    expect(snap.provisioningComplete).toBe(false);
  });
});
