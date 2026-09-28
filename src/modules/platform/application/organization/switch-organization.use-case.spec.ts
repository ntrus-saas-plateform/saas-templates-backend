import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SwitchOrganizationUseCase } from './switch-organization.use-case.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

describe('SwitchOrganizationUseCase', () => {
  const organizationRepository = {
    findById: vi.fn(),
    findByUserMembership: vi.fn(),
  };
  const keycloakAdmin = { setUserActiveOrganization: vi.fn() };
  const eventPublisher = { publish: vi.fn() };
  const tokenRevocation = { revokeAllTokensForSubject: vi.fn() };

  let useCase: SwitchOrganizationUseCase;

  const ctx = {
    tenantId: 'tenant-1',
    subjectId: 'sub-a',
    username: 'user-a',
    organizationId: 'org-1',
    correlationId: 'corr-1',
    traceId: 'trace-1',
    permissions: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new SwitchOrganizationUseCase(
      organizationRepository as never,
      keycloakAdmin as never,
      eventPublisher as never,
      tokenRevocation as never,
    );
  });

  it('updates Keycloak and emits event on switch', async () => {
    organizationRepository.findById.mockResolvedValue({
      id: 'org-2',
      tenantId: 'tenant-1',
      keycloakOrganizationId: 'kc-org-2',
      slug: 'org-b',
    });
    organizationRepository.findByUserMembership.mockResolvedValue([
      { id: 'org-1' },
      { id: 'org-2' },
    ]);

    const result = await useCase.execute({ ctx, organizationId: 'org-2' });

    expect(result.organizationId).toBe('org-2');
    expect(result.requiresTokenRefresh).toBe(true);
    expect(result.tokenRefreshScope).toBe('organization:org-b');
    expect(keycloakAdmin.setUserActiveOrganization).toHaveBeenCalledWith('sub-a', 'kc-org-2');
    expect(tokenRevocation.revokeAllTokensForSubject).toHaveBeenCalledWith('sub-a');
    expect(eventPublisher.publish).toHaveBeenCalledOnce();
  });

  it('rejects switch when user is not org member', async () => {
    organizationRepository.findById.mockResolvedValue({
      id: 'org-2',
      tenantId: 'tenant-1',
      keycloakOrganizationId: 'kc-org-2',
      slug: 'org-b',
    });
    organizationRepository.findByUserMembership.mockResolvedValue([{ id: 'org-1' }]);

    await expect(useCase.execute({ ctx, organizationId: 'org-2' })).rejects.toBeInstanceOf(
      DomainError,
    );
    await expect(useCase.execute({ ctx, organizationId: 'org-2' })).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
  });
});
