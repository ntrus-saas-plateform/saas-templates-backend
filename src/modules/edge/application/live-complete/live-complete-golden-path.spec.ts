/**
 * Live-complete Phase 5 — E2/E3 golden-path **contracts** (honest label).
 *
 * NOT live docker / console E2E. Covers sandbox payment, BB control/v1 client,
 * portal provisioningComplete flag, ResolvingPaymentProviderAdapter fail-closed,
 * and DEPENDENCY_UNAVAILABLE when EDGE_BB_CONTROL_BASE_URL is missing.
 *
 * Lab scenarios 1–10: docs/edge/live-complete/05-e2e-golden-path.md
 */
import { describe, expect, it, vi } from 'vitest';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { AcquisitionRepositoryPort } from '../../domain/acquisition/acquisition-repository.port.js';
import type { TenantRuntimeStatusPort } from '../../domain/acquisition/tenant-runtime-status.port.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';
import { SandboxPaymentProviderAdapter } from '../../infrastructure/billing/sandbox-payment.adapter.js';
import { UnavailablePaymentProviderAdapter } from '../../infrastructure/billing/unavailable-payment.adapter.js';
import { ResolvingPaymentProviderAdapter } from '../../infrastructure/billing/resolving-payment.adapter.js';
import type { HttpWebhookPaymentProviderAdapter } from '../../infrastructure/billing/http-webhook-payment.adapter.js';
import { ControlV1BusinessBackendClient } from '../../infrastructure/product-control/control-v1-business-backend.client.js';
import { GetCustomerPortalSnapshotUseCase } from '../acquisition/acquisition.use-cases.js';

function portalRepo(overrides?: {
  handoffs?: Array<Record<string, unknown>>;
}): AcquisitionRepositoryPort {
  const prospect = {
    id: 'prospect-live-1',
    status: 'QUALIFIED',
    metadata: {},
  };
  const handoffs = overrides?.handoffs ?? [];
  return {
    getProspect: async () => prospect as never,
    listApplications: async () => ({ items: [], total: 0 }),
    listCheckoutSessions: async () => ({ items: [], total: 0 }),
    listSubscriptionHandoffs: async () => ({ items: handoffs, total: handoffs.length }),
  } as unknown as AcquisitionRepositoryPort;
}

describe('Live-complete golden-path contracts (E2/E3 — not live docker E2E)', () => {
  it('S1 payment happy path: sandbox createCustomer → intent → confirm → fetch SUCCEEDED', async () => {
    const adapter = new SandboxPaymentProviderAdapter();

    const customer = await adapter.createCustomer({
      billingAccountId: 'acc-live-1',
      correlationId: 'corr-pay-cus',
    });
    expect(customer.outcome).toBe('SUCCEEDED');
    if (customer.outcome !== 'SUCCEEDED') return;
    expect(customer.providerCustomerRef).toMatch(/^sandbox_cus_/);

    const created = await adapter.createPaymentIntent({
      billingAccountId: 'acc-live-1',
      amount: '99.00',
      currency: 'USD',
      correlationId: 'corr-pay-pi',
    });
    expect(created.outcome).toBe('REQUESTED');
    if (created.outcome !== 'REQUESTED') return;

    const confirmed = await adapter.confirmPaymentIntent({
      provider: 'sandbox',
      providerIntentRef: created.providerIntentRef,
      correlationId: 'corr-pay-confirm',
    });
    expect(confirmed.outcome).toBe('SUCCEEDED');

    const status = await adapter.fetchPaymentStatus({
      provider: 'sandbox',
      providerIntentRef: created.providerIntentRef,
    });
    expect(status.outcome).toBe('SUCCEEDED');
    if (status.outcome === 'SUCCEEDED') {
      expect(status.status).toBe('paid');
      expect(status.provider).toBe('sandbox');
    }
  });

  it('BB control/v1: provision 201 + ready 200 ready:true (mock fetch)', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith('/control/v1/provision') && init?.method === 'POST') {
        return new Response(JSON.stringify({ status: 'accepted', tenant_id: 'tenant-bb-1' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (String(url).includes('/control/v1/tenants/') && String(url).endsWith('/ready')) {
        return new Response(JSON.stringify({ ready: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('unexpected', { status: 500 });
    });

    const client = new ControlV1BusinessBackendClient({
      baseUrl: 'http://bb.lab:3100',
      token: 'lab-edge-control-token',
      allowInsecureHttp: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const provisioned = await client.provision(
      { tenant_id: 'tenant-bb-1', product_id: 'pharmacy' },
      'idem-live-provision-1',
    );
    expect(provisioned.ok).toBe(true);
    expect(provisioned.status).toBe(201);
    expect(provisioned.body.status).toBe('accepted');

    const ready = await client.getTenantReady('tenant-bb-1');
    expect(ready.ok).toBe(true);
    expect(ready.status).toBe(200);
    expect(ready.body.ready).toBe(true);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('portal provisioningComplete true only when TenantRuntimeStatusPort ready=true', async () => {
    const repo = portalRepo({
      handoffs: [
        {
          id: 'h-live-1',
          status: 'COMPLETED',
          subscriptionRef: 'sub-live-1',
          metadata: { tenantRef: 'tenant-lab-portal' },
        },
      ],
    });

    const withoutPort = await new GetCustomerPortalSnapshotUseCase(repo).execute({
      prospectId: 'prospect-live-1',
    });
    expect(withoutPort.provisioningComplete).toBe(false);

    const status: TenantRuntimeStatusPort = {
      isTenantReady: vi.fn(async () => ({ ready: true, source: 'CONTROL_V1' })),
    };
    const withReady = await new GetCustomerPortalSnapshotUseCase(repo, status).execute({
      prospectId: 'prospect-live-1',
    });
    expect(withReady.provisioningComplete).toBe(true);
    expect(status.isTenantReady).toHaveBeenCalledWith('tenant-lab-portal');
  });

  it('ResolvingPaymentProviderAdapter never calls sandbox when adapter mode is unavailable', async () => {
    const config = {
      BILLING_PAYMENT_ADAPTER: 'unavailable',
    } as EnvironmentConfig;

    const sandbox = new SandboxPaymentProviderAdapter();
    const createCustomer = vi.spyOn(sandbox, 'createCustomer');
    const createPaymentIntent = vi.spyOn(sandbox, 'createPaymentIntent');
    const confirmPaymentIntent = vi.spyOn(sandbox, 'confirmPaymentIntent');
    const fetchPaymentStatus = vi.spyOn(sandbox, 'fetchPaymentStatus');

    const httpWebhook = {
      createCustomer: vi.fn(),
      createPaymentIntent: vi.fn(),
      confirmPaymentIntent: vi.fn(),
      fetchPaymentStatus: vi.fn(),
    } as unknown as HttpWebhookPaymentProviderAdapter;

    const resolving = new ResolvingPaymentProviderAdapter(
      config,
      new UnavailablePaymentProviderAdapter(),
      httpWebhook,
      sandbox,
      {} as never, // hyperswitch — jamais appelé en mode 'unavailable'
    );

    const customer = await resolving.createCustomer({
      billingAccountId: 'acc-1',
      correlationId: 'c-unavail',
    });
    expect(customer.outcome).toBe('UNAVAILABLE');

    const intent = await resolving.createPaymentIntent({
      billingAccountId: 'acc-1',
      amount: '10.00',
      currency: 'USD',
      correlationId: 'pi-unavail',
    });
    expect(intent.outcome).toBe('UNAVAILABLE');

    expect(createCustomer).not.toHaveBeenCalled();
    expect(createPaymentIntent).not.toHaveBeenCalled();
    expect(confirmPaymentIntent).not.toHaveBeenCalled();
    expect(fetchPaymentStatus).not.toHaveBeenCalled();
  });

  it('provision fails DEPENDENCY_UNAVAILABLE when BB base URL is missing', async () => {
    const client = new ControlV1BusinessBackendClient({});
    expect(client.isConfigured()).toBe(false);

    await expect(
      client.provision({ tenant_id: 't1' }, 'idem-missing-url'),
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe(ErrorCode.DEPENDENCY_UNAVAILABLE);
      expect((err as DomainError).message).toMatch(/EDGE_BB_CONTROL_BASE_URL/);
      return true;
    });
  });
});
