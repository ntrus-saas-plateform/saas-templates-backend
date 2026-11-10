import { DurableSubscriptionProvisioningAdapter } from './durable-provisioning.adapter.js';
import type { AcceptProvisioningAuthorizationUseCase } from '../../application/provisioning/provisioning.use-cases.js';

describe('DurableSubscriptionProvisioningAdapter', () => {
  it('refuses when canonical authorization is missing (fail-closed)', async () => {
    const accept = {
      execute: vi.fn(),
    } as unknown as AcceptProvisioningAuthorizationUseCase;
    const adapter = new DurableSubscriptionProvisioningAdapter(accept);
    const result = await adapter.requestProvisioning({
      subscriptionId: 's',
      subscriptionNumber: 'SN',
      accountId: 'a',
      productId: 'p',
      correlationId: 'c',
      payload: {},
    });
    expect(result.outcome).toBe('UNAVAILABLE');
    if (result.outcome === 'UNAVAILABLE') {
      expect(result.failureCode).toBe('CANONICAL_AUTHORIZATION_REQUIRED');
    }
    expect(accept.execute).not.toHaveBeenCalled();
  });

  it('never completes technical provisioning', async () => {
    const accept = { execute: vi.fn() } as unknown as AcceptProvisioningAuthorizationUseCase;
    const adapter = new DurableSubscriptionProvisioningAdapter(accept);
    const result = await adapter.completeProvisioning({
      requestId: 'r',
      subscriptionId: 's',
    });
    expect(result.outcome).toBe('UNAVAILABLE');
    if (result.outcome === 'UNAVAILABLE') {
      expect(result.failureCode).toBe('P7_1_NO_TECHNICAL_COMPLETION');
    }
  });
});
