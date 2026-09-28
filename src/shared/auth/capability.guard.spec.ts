import { describe, expect, it, vi } from 'vitest';
import { CapabilityGuard } from './capability.guard.js';
import { REQUIRE_CAPABILITY_KEY } from './decorators.js';

function mockReflector(meta: Record<string, unknown>) {
  return {
    getAllAndOverride: vi.fn((key: string) => meta[key]),
  };
}

describe('CapabilityGuard', () => {
  it('allows when no capability metadata', async () => {
    const guard = new CapabilityGuard(mockReflector({}) as never);
    await expect(
      guard.canActivate({ getHandler: () => ({}), getClass: () => ({}) } as never),
    ).resolves.toBe(true);
  });

  it('does not block on a leftover capability marker', async () => {
    const guard = new CapabilityGuard(
      mockReflector({ [REQUIRE_CAPABILITY_KEY]: 'FEFO' }) as never,
    );
    await expect(
      guard.canActivate({ getHandler: () => ({}), getClass: () => ({}) } as never),
    ).resolves.toBe(true);
  });
});
