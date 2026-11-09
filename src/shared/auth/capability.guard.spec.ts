import { describe, expect, it, vi } from 'vitest';
import { CapabilityGuard } from './capability.guard.js';
import { REQUIRE_CAPABILITY_KEY } from './decorators.js';

function mockReflector(meta: Record<string, unknown>) {
  return {
    getAllAndOverride: vi.fn((key: string) => meta[key]),
  };
}

describe('CapabilityGuard', () => {
  it('allows when no capability metadata', () => {
    const guard = new CapabilityGuard(mockReflector({}) as never);
    expect(
      guard.canActivate({ getHandler: () => ({}), getClass: () => ({}) } as never),
    ).toBe(true);
  });

  it('does not block on a leftover capability marker', () => {
    const guard = new CapabilityGuard(
      mockReflector({ [REQUIRE_CAPABILITY_KEY]: 'FEFO' }) as never,
    );
    expect(
      guard.canActivate({ getHandler: () => ({}), getClass: () => ({}) } as never),
    ).toBe(true);
  });
});
