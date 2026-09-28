import { describe, it, expect } from 'vitest';
import { TenantContextService } from './tenant-context.service.js';

describe('TenantContextService', () => {
  const service = new TenantContextService();

  it('should isolate context per async scope', async () => {
    const results: string[] = [];

    await Promise.all([
      service.runAsync({ ...baseContext(), tenantId: 'tenant-a' }, async () => {
        await delay(10);
        results.push(service.get().tenantId);
      }),
      service.runAsync({ ...baseContext(), tenantId: 'tenant-b' }, async () => {
        await delay(5);
        results.push(service.get().tenantId);
      }),
    ]);

    expect(results).toContain('tenant-a');
    expect(results).toContain('tenant-b');
  });

  it('should return empty context outside scope', () => {
    expect(service.get().tenantId).toBe('');
  });

  it('should throw when getOrThrow called outside scope', () => {
    expect(() => service.getOrThrow()).toThrow('Tenant context is not available');
  });

  it('should allow partial updates within scope', () => {
    service.run({ ...baseContext(), tenantId: 'tenant-a', organizationId: null }, () => {
      service.set({ organizationId: 'org-1' });
      expect(service.get().organizationId).toBe('org-1');
      expect(service.get().tenantId).toBe('tenant-a');
    });
  });
});

function baseContext() {
  return {
    tenantId: '',
    organizationId: null as string | null,
    userId: null as string | null,
    subjectId: 'sub-1',
    username: null as string | null,
    roles: [] as readonly string[],
    permissions: [] as readonly string[],
    clientId: null as string | null,
    correlationId: 'corr-1',
    requestId: 'req-1',
    traceId: null as string | null,
    locale: 'en',
    timezone: 'UTC',
    authenticationAcr: null,
    authenticationMethods: [],
    tokenIssuedAt: null as number | null,
    tokenId: null as string | null,
    authKind: 'staff' as const,
    globalCustomerId: null as string | null,
    tenantCustomerId: null as string | null,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
