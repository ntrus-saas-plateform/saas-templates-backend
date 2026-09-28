import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationGuard } from './organization.guard.js';
import { DomainError, ErrorCode } from '../../core/domain/errors/domain-error.js';
import { ACCESS_DENIED_MESSAGE } from '../../core/domain/errors/access-denied.js';
import { OrganizationStatus } from '../../modules/identity/domain/organization/organization.entity.js';

describe('OrganizationGuard', () => {
  const reflector = { getAllAndOverride: vi.fn() } as unknown as Reflector;
  const tenantContext = { get: vi.fn() };
  const organizationRepository = {
    findById: vi.fn(),
    findByUserMembership: vi.fn(),
  };

  let guard: OrganizationGuard;

  const createContext = () =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as never;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new OrganizationGuard(
      reflector,
      tenantContext as never,
      organizationRepository as never,
    );
  });

  it('skips when no organization in context and not required', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
    tenantContext.get.mockReturnValue({ tenantId: 't1', organizationId: null });

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  it('denies with generic message when organization not found', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
    tenantContext.get.mockReturnValue({
      tenantId: 't1',
      organizationId: 'org-x',
      subjectId: 'sub-1',
    });
    organizationRepository.findById.mockResolvedValue(null);

    await expect(guard.canActivate(createContext())).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
      message: ACCESS_DENIED_MESSAGE,
    });
  });

  it('denies when user is not org member', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
    tenantContext.get.mockReturnValue({
      tenantId: 't1',
      organizationId: 'org-1',
      subjectId: 'sub-1',
    });
    organizationRepository.findById.mockResolvedValue({
      id: 'org-1',
      tenantId: 't1',
      status: OrganizationStatus.ACTIVE,
    });
    organizationRepository.findByUserMembership.mockResolvedValue([]);

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(DomainError);
  });

  it('allows member of active organization', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
    tenantContext.get.mockReturnValue({
      tenantId: 't1',
      organizationId: 'org-1',
      subjectId: 'sub-1',
    });
    organizationRepository.findById.mockResolvedValue({
      id: 'org-1',
      tenantId: 't1',
      status: OrganizationStatus.ACTIVE,
    });
    organizationRepository.findByUserMembership.mockResolvedValue([{ id: 'org-1' }]);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  it('requires organization when decorator set', async () => {
    vi.mocked(reflector.getAllAndOverride).mockImplementation((key) => {
      if (key === 'requireOrganization') return true;
      return false;
    });
    tenantContext.get.mockReturnValue({ tenantId: 't1', organizationId: null });

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(ForbiddenException);
  });
});
