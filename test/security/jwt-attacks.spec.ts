import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JwtValidationService } from '../../src/shared/auth/jwt-validation.service.js';

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

describe('Security: JWT validation', () => {
  let service: JwtValidationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new JwtValidationService(config as never);
  });

  it('rejects token without tenant_id', async () => {
    mockVerify.mockResolvedValue({ payload: { sub: 'user-1', iat: 1_700_000_000 } });
    await expect(service.validateToken('token')).rejects.toThrow('missing tenant_id');
  });

  it('rejects organization_id not in authorized list', async () => {
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

  it('uses sub as stable userId', async () => {
    mockVerify.mockResolvedValue({
      payload: {
        sub: 'stable-sub-id',
        preferred_username: 'display-name',
        tenant_id: 'tenant-1',
        iat: 1_700_000_000,
      },
    });

    const user = await service.validateToken('token');
    expect(user.userId).toBe('stable-sub-id');
    expect(user.subjectId).toBe('stable-sub-id');
    expect(user.username).toBe('display-name');
  });

  it('propagates jose verification failures', async () => {
    mockVerify.mockRejectedValue(new Error('signature verification failed'));
    await expect(service.validateToken('bad-token')).rejects.toThrow(
      'signature verification failed',
    );
  });
});
