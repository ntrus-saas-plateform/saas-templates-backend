import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ModuleGuard } from './module.guard.js';
import { DomainError, ErrorCode } from '../../core/domain/errors/domain-error.js';

describe('ModuleGuard', () => {
  const reflector = { getAllAndOverride: vi.fn() } as unknown as Reflector;
  const tenantContext = { get: vi.fn() };
  const capabilityResolver = {
    assertModuleEnabled: vi.fn(),
  };

  let guard: ModuleGuard;

  const createContext = () =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as never;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new ModuleGuard(
      reflector,
      tenantContext as never,
      capabilityResolver as never,
    );
  });

  it('allows public routes', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValueOnce(true);
    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(capabilityResolver.assertModuleEnabled).not.toHaveBeenCalled();
  });

  it('allows when no @RequireModule metadata', async () => {
    vi.mocked(reflector.getAllAndOverride)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(undefined);
    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(capabilityResolver.assertModuleEnabled).not.toHaveBeenCalled();
  });

  it('asserts module when metadata present', async () => {
    vi.mocked(reflector.getAllAndOverride)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce('commerce');
    tenantContext.get.mockReturnValue({ tenantId: 't1' });
    capabilityResolver.assertModuleEnabled.mockResolvedValue(undefined);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(capabilityResolver.assertModuleEnabled).toHaveBeenCalledWith('t1', 'commerce');
  });

  it('propagates DomainError when module disabled', async () => {
    vi.mocked(reflector.getAllAndOverride)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce('pharmacy');
    tenantContext.get.mockReturnValue({ tenantId: 't1' });
    capabilityResolver.assertModuleEnabled.mockRejectedValue(
      new DomainError(ErrorCode.FORBIDDEN, "Module 'pharmacy' is not enabled for this tenant"),
    );

    await expect(guard.canActivate(createContext())).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
  });
});
