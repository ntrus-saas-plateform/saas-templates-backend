import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RevokeSessionUseCase } from '../../src/modules/identity/application/security/security.use-cases.js';
import { DomainError, ErrorCode } from '../../src/core/domain/errors/domain-error.js';
import { ACCESS_DENIED_MESSAGE } from '../../src/core/domain/errors/access-denied.js';

describe('Security: Session revoke IDOR', () => {
  const keycloakAdmin = {
    isAvailable: vi.fn(),
    listUserSessions: vi.fn(),
    revokeSession: vi.fn(),
  };
  const tokenRevocation = {
    revokeTokenByJti: vi.fn(),
    revokeAllTokensForSubject: vi.fn(),
    isRevoked: vi.fn(),
  };

  let useCase: RevokeSessionUseCase;

  const ctx = {
    tenantId: 'tenant-1',
    subjectId: 'user-a',
    username: 'user-a',
    organizationId: 'org-1',
    permissions: [],
    roles: [],
    correlationId: 'corr',
    traceId: 'trace',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    keycloakAdmin.isAvailable.mockResolvedValue(true);
    keycloakAdmin.listUserSessions.mockResolvedValue([
      { id: 'session-owned', username: 'user-a', ipAddress: '', started: '', lastAccess: '', clients: [] },
    ]);
    useCase = new RevokeSessionUseCase(keycloakAdmin as never, tokenRevocation as never);
  });

  it('revokes session when sessionId belongs to caller', async () => {
    const result = await useCase.execute({
      ctx,
      sessionId: 'session-owned',
    });

    expect(result.revoked).toBe(true);
    expect(keycloakAdmin.revokeSession).toHaveBeenCalledWith('session-owned');
  });

  it('rejects revoke when sessionId does not belong to caller', async () => {
    await expect(
      useCase.execute({ ctx, sessionId: 'session-other-user' }),
    ).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
      message: ACCESS_DENIED_MESSAGE,
    });
    expect(keycloakAdmin.revokeSession).not.toHaveBeenCalled();
  });

  it('requires authenticated subject', async () => {
    const unauthenticatedCtx = { ...ctx, subjectId: undefined as unknown as string };
    await expect(
      useCase.execute({ ctx: unauthenticatedCtx, sessionId: 'session-owned' }),
    ).rejects.toBeInstanceOf(DomainError);
    await expect(
      useCase.execute({ ctx: unauthenticatedCtx, sessionId: 'session-owned' }),
    ).rejects.toMatchObject({ code: ErrorCode.UNAUTHORIZED });
  });
});
