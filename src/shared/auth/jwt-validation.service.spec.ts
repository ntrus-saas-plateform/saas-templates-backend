import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JwtValidationService } from './jwt-validation.service.js';

const mockVerify = vi.fn();

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => 'jwks'),
  jwtVerify: (...args: unknown[]) => mockVerify(...args),
}));

const config = {
  KEYCLOAK_ISSUER: 'http://localhost:8080/realms/platform',
  KEYCLOAK_JWKS_URI: 'http://localhost:8080/realms/platform/protocol/openid-connect/certs',
  KEYCLOAK_AUDIENCE: 'platform-api',
  KEYCLOAK_CLIENT_ID: 'platform-api',
};

describe('JwtValidationService', () => {
  let service: JwtValidationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new JwtValidationService(config as never);
  });

  it('rejects token without tenant_id', async () => {
    mockVerify.mockResolvedValue({ payload: { sub: 'user-1', iat: 1_700_000_000 } });
    await expect(service.validateToken('token')).rejects.toThrow('missing tenant_id');
  });

  it('rejects token without iat', async () => {
    mockVerify.mockResolvedValue({ payload: { sub: 'user-1', tenant_id: 'tenant-1' } });
    await expect(service.validateToken('token')).rejects.toThrow('missing iat');
  });

  it('rejects active organization not in authorized list', async () => {
    mockVerify.mockResolvedValue({
      payload: {
        sub: 'user-1',
        tenant_id: 'tenant-1',
        iat: 1_700_000_000,
        organization_id: 'org-b',
        organization: ['org-a'],
      },
    });
    await expect(service.validateToken('token')).rejects.toThrow(
      'active organization not in authorized organizations',
    );
  });

  it('returns authenticated user for legacy string organization claims', async () => {
    mockVerify.mockResolvedValue({
      payload: {
        sub: 'sub-1',
        preferred_username: 'user-a',
        email: 'user-a@tenant-a.example.com',
        tenant_id: 'tenant-1',
        iat: 1_700_000_000,
        organization_id: 'org-a',
        organization: ['org-a', 'org-b'],
        permissions: ['platform:read'],
        locale: 'fr',
        timezone: 'Europe/Paris',
      },
    });

    const user = await service.validateToken('valid-token');
    expect(user.tenantId).toBe('tenant-1');
    expect(user.userId).toBe('sub-1');
    expect(user.subjectId).toBe('sub-1');
    expect(user.username).toBe('user-a');
    expect(user.email).toBe('user-a@tenant-a.example.com');
    expect(user.jwtActiveOrganizationRef).toBe('org-a');
    expect(user.keycloakOrganizationAliases).toEqual(['org-a', 'org-b']);
    expect(user.permissions).toEqual(['platform:read']);
    expect(user.tokenIssuedAt).toBe(1_700_000_000);
  });

  it('parses Keycloak Organizations object claim', async () => {
    mockVerify.mockResolvedValue({
      payload: {
        sub: 'sub-1',
        tenant_id: 'tenant-1',
        iat: 1_700_000_000,
        organization: {
          'org-a': { id: 'kc-org-a' },
          'org-b': { id: 'kc-org-b' },
        },
      },
    });

    const user = await service.validateToken('valid-token');
    expect(user.keycloakOrganizationIds).toEqual(['kc-org-a', 'kc-org-b']);
    expect(user.keycloakOrganizationAliases).toEqual(['org-a', 'org-b']);
    expect(user.jwtActiveOrganizationRef).toBeNull();
  });

  it('sets active organization when user belongs to a single Keycloak organization', async () => {
    mockVerify.mockResolvedValue({
      payload: {
        sub: 'sub-1',
        tenant_id: 'tenant-1',
        iat: 1_700_000_000,
        organization: {
          'org-a': { id: 'kc-org-a' },
        },
      },
    });

    const user = await service.validateToken('valid-token');
    expect(user.jwtActiveOrganizationRef).toBe('kc-org-a');
  });

  it('rejects token without subject', async () => {
    mockVerify.mockResolvedValue({ payload: { tenant_id: 'tenant-1', iat: 1_700_000_000 } });
    await expect(service.validateToken('token')).rejects.toThrow('missing subject');
  });

  it('propagates jose verification failures', async () => {
    mockVerify.mockRejectedValue(new Error('signature verification failed'));
    await expect(service.validateToken('bad-token')).rejects.toThrow(
      'signature verification failed',
    );
  });

  it('§57 rejects expired token (jose exp)', async () => {
    mockVerify.mockRejectedValue(new Error('"exp" claim timestamp check failed'));
    await expect(service.validateToken('expired')).rejects.toThrow(/exp/i);
  });

  it('§57 rejects wrong issuer', async () => {
    mockVerify.mockRejectedValue(new Error('unexpected "iss" claim value'));
    await expect(service.validateToken('wrong-iss')).rejects.toThrow(/iss/i);
  });

  it('§57 rejects wrong audience', async () => {
    mockVerify.mockRejectedValue(new Error('unexpected "aud" claim value'));
    await expect(service.validateToken('wrong-aud')).rejects.toThrow(/aud/i);
  });

  it('§57 passes issuer+audience+clockTolerance to jwtVerify', async () => {
    mockVerify.mockResolvedValue({
      payload: {
        sub: 'u1',
        tenant_id: 't1',
        iat: 1_700_000_000,
        organization: ['org-a'],
        organization_id: 'org-a',
      },
    });
    await service.validateToken('tok');
    expect(mockVerify).toHaveBeenCalledWith(
      'tok',
      'jwks',
      expect.objectContaining({
        issuer: config.KEYCLOAK_ISSUER,
        audience: config.KEYCLOAK_AUDIENCE,
        clockTolerance: 60,
        algorithms: ['RS256'],
      }),
    );
  });
});
