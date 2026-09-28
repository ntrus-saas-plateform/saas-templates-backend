import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard.js';

describe('AuthGuard', () => {
  const reflector = { getAllAndOverride: vi.fn() } as unknown as Reflector;
  const jwtValidation = { validateToken: vi.fn() };
  const activeOrganizationResolver = { resolve: vi.fn() };
  const tenantContext = { set: vi.fn() };
  const identityMetrics = { recordLoginFailure: vi.fn() };

  let guard: AuthGuard;

  const createContext = (authHeader?: string) => {
    const request = { headers: { authorization: authHeader } };
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;
  };

  const tokenIntrospection = { isEnabled: () => false, introspect: vi.fn() };
  const applicationUserRepository = { findByIdentity: vi.fn().mockResolvedValue(null) };
  const tokenRevocation = {
    isRevoked: vi.fn().mockResolvedValue(false),
    revokeAllTokensForSubject: vi.fn(),
    revokeTokenByJti: vi.fn(),
  };
  const mfaEnforcement = {
    assertLoginMfaCompliance: vi.fn(async () => {}),
  };
  const patValidation = {
    isPersonalApiToken: vi.fn((t: string) => t.startsWith('uat_')),
    validate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new AuthGuard(
      reflector,
      jwtValidation as never,
      activeOrganizationResolver as never,
      tenantContext as never,
      identityMetrics as never,
      tokenIntrospection as never,
      mfaEnforcement as never,
      patValidation as never,
      applicationUserRepository as never,
      tokenRevocation as never,
    );
  });

  it('allows public routes', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(true);
    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  it('rejects missing bearer token', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('sets context from JWT and resolved organization', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
    jwtValidation.validateToken.mockResolvedValue({
      subjectId: 'sub-1',
      userId: 'sub-1',
      username: 'user-a',
      tenantId: 't1',
      keycloakOrganizationIds: [],
      keycloakOrganizationAliases: ['org-1'],
      jwtActiveOrganizationRef: 'org-1',
      roles: ['user'],
      permissions: ['platform:read'],
      clientId: 'platform-api',
      locale: 'en',
      timezone: 'UTC',
      authenticationAcr: null,
      authenticationMethods: [],
      tokenIssuedAt: 1_700_000_000,
      tokenId: 'jti-1',
    });
    activeOrganizationResolver.resolve.mockResolvedValue('org-2');

    await guard.canActivate(createContext('Bearer valid-token'));

    expect(tenantContext.set).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectId: 'sub-1',
        userId: 'sub-1',
        username: 'user-a',
        tenantId: 't1',
        organizationId: 'org-2',
      }),
    );
  });

  it('authenticates personal API tokens without JWT', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
    patValidation.validate.mockResolvedValue({
      subjectId: 'sub-pat',
      userId: 'sub-pat',
      username: 'pat-user',
      tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      organizationId: 'org-1',
      scopes: ['users:read'],
      tokenId: 'tok-1',
    });

    await guard.canActivate(
      createContext(
        'Bearer uat_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.secretvalue123456',
      ),
    );

    expect(jwtValidation.validateToken).not.toHaveBeenCalled();
    expect(tenantContext.set).toHaveBeenCalledWith(
      expect.objectContaining({
        authKind: 'pat',
        subjectId: 'sub-pat',
        permissions: ['users:read'],
        clientId: 'personal-api-token',
      }),
    );
  });

  it('rejects invalid token', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
    jwtValidation.validateToken.mockRejectedValue(new Error('invalid'));

    await expect(guard.canActivate(createContext('Bearer bad'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
