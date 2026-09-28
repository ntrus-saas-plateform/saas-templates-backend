import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GetMyIdentityOverviewUseCase,
  UnlinkMyIdentityUseCase,
  RequestMyPasswordResetUseCase,
  RequestMyEmailVerificationUseCase,
  ListIdentityProvidersUseCase,
} from './identity.use-cases.js';

describe('identity use cases', () => {
  const keycloak = {
    isAvailable: vi.fn(),
    getAccountUrls: vi.fn(),
    getUser: vi.fn(),
    getUserMfaStatus: vi.fn(),
    listUserCredentials: vi.fn(),
    listFederatedIdentities: vi.fn(),
    removeFederatedIdentity: vi.fn(),
    sendExecuteActionsEmail: vi.fn(),
    listIdentityProviders: vi.fn(),
    getIdentityProvider: vi.fn(),
    createIdentityProvider: vi.fn(),
    updateIdentityProvider: vi.fn(),
    deleteIdentityProvider: vi.fn(),
  };
  const preferences = {
    getSettings: vi.fn(),
  };

  const ctx = {
    tenantId: 't1',
    subjectId: 'sub-1',
    username: 'alice',
    organizationId: null,
    correlationId: 'c1',
    traceId: null,
    permissions: ['users:read'],
  };

  const urls = {
    accountConsoleUrl: 'http://kc/account',
    passwordUrl: 'http://kc/password',
    enrollTotpUrl: 'http://kc/totp',
    enrollWebauthnUrl: 'http://kc/webauthn',
    linkedAccountsUrl: 'http://kc/linked',
    recoveryCodesUrl: 'http://kc/recovery',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    keycloak.isAvailable.mockResolvedValue(true);
    keycloak.getAccountUrls.mockResolvedValue(urls);
    keycloak.getUser.mockResolvedValue({
      id: 'sub-1',
      enabled: true,
      email: 'a@x.com',
      username: 'alice',
      emailVerified: true,
    });
    keycloak.getUserMfaStatus.mockResolvedValue({ enabled: true, methods: ['otp'] });
    keycloak.listUserCredentials.mockResolvedValue([
      { id: 'c1', type: 'password' },
      { id: 'c2', type: 'otp' },
    ]);
    keycloak.listFederatedIdentities.mockResolvedValue([
      { identityProvider: 'google', userId: 'g-1', userName: 'a@x.com' },
    ]);
    preferences.getSettings.mockResolvedValue({
      'verification.phoneVerified': true,
      'verification.phoneE164': '+243970000000',
    });
    keycloak.sendExecuteActionsEmail.mockResolvedValue(undefined);
  });

  it('builds identity overview with local + federated links and phone KYC', async () => {
    const uc = new GetMyIdentityOverviewUseCase(
      keycloak as never,
      preferences as never,
    );
    const data = await uc.execute({ ctx });
    expect(data.keycloakAvailable).toBe(true);
    expect(data.verification.emailVerified).toBe(true);
    expect(data.verification.phoneVerified).toBe(true);
    expect(data.verification.phoneE164).toBe('+243970000000');
    expect(data.linkedIdentities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: 'local', primary: true }),
        expect.objectContaining({ provider: 'google', providerUserId: 'g-1' }),
      ]),
    );
  });

  it('refuses unlinking local', async () => {
    const uc = new UnlinkMyIdentityUseCase(keycloak as never);
    await expect(uc.execute({ ctx, provider: 'local' })).rejects.toMatchObject({
      message: 'Cannot unlink local identity',
    });
  });

  it('unlinks federated provider', async () => {
    const uc = new UnlinkMyIdentityUseCase(keycloak as never);
    const result = await uc.execute({ ctx, provider: 'google' });
    expect(result).toEqual({ unlinked: true, provider: 'google' });
    expect(keycloak.removeFederatedIdentity).toHaveBeenCalledWith('sub-1', 'google');
  });

  it('sends UPDATE_PASSWORD execute-actions email', async () => {
    const uc = new RequestMyPasswordResetUseCase(keycloak as never);
    await expect(uc.execute({ ctx })).resolves.toEqual({ sent: true });
    expect(keycloak.sendExecuteActionsEmail).toHaveBeenCalledWith('sub-1', [
      'UPDATE_PASSWORD',
    ]);
  });

  it('sends VERIFY_EMAIL execute-actions email', async () => {
    const uc = new RequestMyEmailVerificationUseCase(keycloak as never);
    await expect(uc.execute({ ctx })).resolves.toEqual({ sent: true });
    expect(keycloak.sendExecuteActionsEmail).toHaveBeenCalledWith('sub-1', [
      'VERIFY_EMAIL',
    ]);
  });

  it('lists realm identity providers', async () => {
    keycloak.listIdentityProviders.mockResolvedValue([
      {
        alias: 'google',
        providerId: 'google',
        enabled: true,
        displayName: 'Google',
        linkOnly: false,
      },
    ]);
    const uc = new ListIdentityProvidersUseCase(keycloak as never);
    const result = await uc.execute({ ctx });
    expect(result.keycloakAvailable).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.alias).toBe('google');
  });

  it('returns empty IdP list when Keycloak unavailable', async () => {
    keycloak.isAvailable.mockResolvedValue(false);
    const uc = new ListIdentityProvidersUseCase(keycloak as never);
    await expect(uc.execute({ ctx })).resolves.toEqual({
      data: [],
      keycloakAvailable: false,
    });
    expect(keycloak.listIdentityProviders).not.toHaveBeenCalled();
  });
});
