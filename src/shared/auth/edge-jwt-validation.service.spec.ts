import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EdgeJwtValidationService } from './edge-jwt-validation.service.js';

const mockVerify = vi.fn();

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => 'jwks'),
  jwtVerify: (...args: unknown[]) => mockVerify(...args),
}));

const config = {
  EDGE_KEYCLOAK_ISSUER: 'http://localhost:8181/realms/edge-admin',
  EDGE_KEYCLOAK_JWKS_URI:
    'http://localhost:8181/realms/edge-admin/protocol/openid-connect/certs',
  EDGE_KEYCLOAK_AUDIENCE: 'edge-admin-api',
  EDGE_KEYCLOAK_ADMIN_CLIENT_ID: 'edge-admin-api',
};

describe('EdgeJwtValidationService', () => {
  let service: EdgeJwtValidationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EdgeJwtValidationService(config as never);
  });

  it('rejects wrong issuer via jose verify options', async () => {
    mockVerify.mockRejectedValue(new Error('unexpected "iss" claim value'));
    await expect(service.validateToken('token')).rejects.toThrow(/iss/i);
    expect(mockVerify).toHaveBeenCalledWith(
      'token',
      'jwks',
      expect.objectContaining({
        issuer: config.EDGE_KEYCLOAK_ISSUER,
        audience: config.EDGE_KEYCLOAK_AUDIENCE,
      }),
    );
  });

  it('accepts tokens without tenant_id', async () => {
    mockVerify.mockResolvedValue({
      payload: {
        sub: 'edge-user-1',
        email: 'edge@example.com',
        preferred_username: 'edge-user',
        iat: 1_700_000_000,
        azp: 'edge-admin-web',
      },
    });

    const user = await service.validateToken('valid-edge-token');
    expect(user.subjectId).toBe('edge-user-1');
    expect(user.email).toBe('edge@example.com');
    expect(user.tokenIssuedAt).toBe(1_700_000_000);
  });

  it('rejects missing subject', async () => {
    mockVerify.mockResolvedValue({ payload: { iat: 1_700_000_000 } });
    await expect(service.validateToken('token')).rejects.toThrow(/missing subject/i);
  });
});
