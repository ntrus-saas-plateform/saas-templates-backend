import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../../../../core/domain/errors/domain-error.js';
import { EntitlementCapabilityKind } from '../../domain/subscription/subscription.entity.js';
import { PublishEntitlementsUseCase } from './subscription.use-cases.js';
import type { ControlV1BusinessBackendClient } from '../../infrastructure/product-control/control-v1-business-backend.client.js';

describe('PublishEntitlementsUseCase', () => {
  it('rejects empty snapshot projection', async () => {
    const subscriptions = {
      getById: vi.fn(async () => ({
        id: 'sub-1',
        metadata: { tenantId: 't1' },
      })),
      getLatestSnapshot: vi.fn(async () => ({
        id: 'snap-1',
        version: 1,
        entitlements: { resolved: [] },
      })),
      listSnapshots: vi.fn(),
      createPublication: vi.fn(),
      updatePublication: vi.fn(),
      listProvisioningRequests: vi.fn(),
    };
    const uc = new PublishEntitlementsUseCase(subscriptions as never);
    await expect(
      uc.execute({ actorId: 'a1', subscriptionId: 'sub-1' }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('PUTs entitlements to BB when configured', async () => {
    const putEntitlements = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: { status: 'applied' },
      text: '',
    }));
    const bb = {
      isConfigured: () => true,
      putEntitlements,
    } as unknown as ControlV1BusinessBackendClient;

    const subscriptions = {
      getById: vi.fn(async () => ({
        id: 'sub-1',
        metadata: { tenantId: 'tenant-bb-1' },
      })),
      getLatestSnapshot: vi.fn(async () => ({
        id: 'snap-1',
        version: 3,
        entitlements: {
          resolved: [
            {
              capabilityCode: 'pos',
              kind: EntitlementCapabilityKind.FEATURE_FLAG,
              enabled: true,
              numericLimit: null,
              sources: ['PLAN:x'],
              conflictResolution: 'BOOLEAN_OR',
            },
          ],
        },
      })),
      createPublication: vi.fn(async (input: Record<string, unknown>) => ({
        id: 'pub-1',
        ...input,
      })),
      updatePublication: vi.fn(async (id: string, patch: Record<string, unknown>) => ({
        id,
        ...patch,
      })),
      listProvisioningRequests: vi.fn(async () => []),
    };

    const uc = new PublishEntitlementsUseCase(subscriptions as never, undefined, bb);
    const result = await uc.execute({ actorId: 'a1', subscriptionId: 'sub-1' });
    expect(putEntitlements).toHaveBeenCalledOnce();
    const call = putEntitlements.mock.calls[0] as unknown as
      | [string, Record<string, unknown>, string]
      | undefined;
    expect(call?.[0]).toBe('tenant-bb-1');
    expect(call?.[1].entitlement_version).toBe(3);
    expect((call?.[1].entitlements as { modules: Record<string, boolean> }).modules.pos).toBe(
      true,
    );
    expect(result).toMatchObject({ status: 'PUBLISHED' });
  });
});
