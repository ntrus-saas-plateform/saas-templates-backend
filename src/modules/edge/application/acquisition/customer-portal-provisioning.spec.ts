import { describe, expect, it, vi } from 'vitest';
import type { AcquisitionRepositoryPort } from '../../domain/acquisition/acquisition-repository.port.js';
import type { TenantRuntimeStatusPort } from '../../domain/acquisition/tenant-runtime-status.port.js';
import { GetCustomerPortalSnapshotUseCase } from './acquisition.use-cases.js';

function portalRepo(overrides?: {
  handoffs?: Array<Record<string, unknown>>;
}): AcquisitionRepositoryPort {
  const prospect = {
    id: 'prospect-1',
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

describe('GetCustomerPortalSnapshotUseCase provisioningComplete', () => {
  it('stays false without TenantRuntimeStatusPort', async () => {
    const repo = portalRepo({
      handoffs: [
        {
          id: 'h1',
          status: 'COMPLETED',
          subscriptionRef: 'sub-1',
          metadata: { tenantRef: 'tenant-lab-1' },
        },
      ],
    });
    const portal = await new GetCustomerPortalSnapshotUseCase(repo).execute({
      prospectId: 'prospect-1',
    });
    expect(portal.provisioningComplete).toBe(false);
  });

  it('stays false when ready check returns not ready', async () => {
    const repo = portalRepo({
      handoffs: [
        {
          id: 'h1',
          status: 'COMPLETED',
          subscriptionRef: 'sub-1',
          metadata: { tenantRef: 'tenant-lab-1' },
        },
      ],
    });
    const status: TenantRuntimeStatusPort = {
      isTenantReady: vi.fn(async () => ({ ready: false, source: 'CONTROL_V1' })),
    };
    const portal = await new GetCustomerPortalSnapshotUseCase(repo, status).execute({
      prospectId: 'prospect-1',
    });
    expect(portal.provisioningComplete).toBe(false);
    expect(status.isTenantReady).toHaveBeenCalledWith('tenant-lab-1');
  });

  it('becomes true only when mock ready returns ready=true', async () => {
    const repo = portalRepo({
      handoffs: [
        {
          id: 'h1',
          status: 'COMPLETED',
          subscriptionRef: 'sub-1',
          metadata: { tenantRef: 'tenant-lab-1' },
        },
      ],
    });
    const status: TenantRuntimeStatusPort = {
      isTenantReady: vi.fn(async () => ({ ready: true, source: 'CONTROL_V1' })),
    };
    const portal = await new GetCustomerPortalSnapshotUseCase(repo, status).execute({
      prospectId: 'prospect-1',
    });
    expect(portal.provisioningComplete).toBe(true);
    expect(portal.note).toContain('authoritative ready');
  });

  it('stays false when completed handoff has no tenantRef', async () => {
    const repo = portalRepo({
      handoffs: [
        {
          id: 'h1',
          status: 'COMPLETED',
          subscriptionRef: 'sub-1',
          metadata: {},
        },
      ],
    });
    const status: TenantRuntimeStatusPort = {
      isTenantReady: vi.fn(async () => ({ ready: true, source: 'CONTROL_V1' })),
    };
    const portal = await new GetCustomerPortalSnapshotUseCase(repo, status).execute({
      prospectId: 'prospect-1',
    });
    expect(portal.provisioningComplete).toBe(false);
    expect(status.isTenantReady).not.toHaveBeenCalled();
  });
});
