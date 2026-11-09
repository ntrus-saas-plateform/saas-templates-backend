/**
 * P0-H.2 — Token isolation matrix (validator-level).
 * Proves ERP and Edge JWT validators enforce distinct issuer/audience/claim contracts.
 * Live Keycloak JWKS exchange is covered separately in keycloak dual-realm smoke.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { JwtValidationService } from './jwt-validation.service.js';
import { EdgeJwtValidationService } from './edge-jwt-validation.service.js';

const mockVerify = vi.fn();

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => 'jwks'),
  jwtVerify: (...args: unknown[]) => mockVerify(...args),
}));

const erpConfig = {
  KEYCLOAK_ISSUER: 'http://localhost:8080/realms/platform',
  KEYCLOAK_JWKS_URI: 'http://localhost:8080/realms/platform/protocol/openid-connect/certs',
  KEYCLOAK_AUDIENCE: 'platform-api',
  KEYCLOAK_ADMIN_CLIENT_ID: 'platform-api',
};

const edgeConfig = {
  EDGE_KEYCLOAK_ISSUER: 'http://localhost:8080/realms/edge-admin',
  EDGE_KEYCLOAK_JWKS_URI:
    'http://localhost:8080/realms/edge-admin/protocol/openid-connect/certs',
  EDGE_KEYCLOAK_AUDIENCE: 'edge-admin-api',
  EDGE_KEYCLOAK_ADMIN_CLIENT_ID: 'edge-admin-api',
};

describe('P0-H.2 token isolation matrix', () => {
  let erp: JwtValidationService;
  let edge: EdgeJwtValidationService;

  beforeEach(() => {
    vi.clearAllMocks();
    erp = new JwtValidationService(erpConfig as never);
    edge = new EdgeJwtValidationService(edgeConfig as never);
  });

  it('ERP validator requires platform issuer + audience + tenant_id', async () => {
    mockVerify.mockResolvedValue({
      payload: {
        sub: 'erp-user',
        tenant_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        iat: 1_700_000_000,
      },
    });
    const user = await erp.validateToken('erp-token');
    expect(user.tenantId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(mockVerify).toHaveBeenCalledWith(
      'erp-token',
      'jwks',
      expect.objectContaining({
        issuer: erpConfig.KEYCLOAK_ISSUER,
        audience: erpConfig.KEYCLOAK_AUDIENCE,
      }),
    );
  });

  it('ERP rejects JWT without tenant_id', async () => {
    mockVerify.mockResolvedValue({
      payload: { sub: 'erp-user', iat: 1_700_000_000 },
    });
    await expect(erp.validateToken('erp-no-tenant')).rejects.toThrow(/tenant_id/i);
  });

  it('Edge validator accepts JWT without tenant_id', async () => {
    mockVerify.mockResolvedValue({
      payload: {
        sub: 'edge-user',
        email: 'edge@example.com',
        iat: 1_700_000_000,
        azp: 'edge-admin-web',
      },
    });
    const user = await edge.validateToken('edge-token');
    expect(user.subjectId).toBe('edge-user');
    expect(mockVerify).toHaveBeenCalledWith(
      'edge-token',
      'jwks',
      expect.objectContaining({
        issuer: edgeConfig.EDGE_KEYCLOAK_ISSUER,
        audience: edgeConfig.EDGE_KEYCLOAK_AUDIENCE,
      }),
    );
  });

  it('Edge validator uses edge-admin issuer (not platform)', async () => {
    mockVerify.mockRejectedValue(new Error('unexpected "iss" claim value'));
    await expect(edge.validateToken('platform-token')).rejects.toThrow(/iss/i);
    expect(mockVerify).toHaveBeenCalledWith(
      'platform-token',
      'jwks',
      expect.objectContaining({
        issuer: 'http://localhost:8080/realms/edge-admin',
        audience: 'edge-admin-api',
      }),
    );
  });

  it('ERP validator uses platform issuer (not edge-admin)', async () => {
    mockVerify.mockRejectedValue(new Error('unexpected "iss" claim value'));
    await expect(erp.validateToken('edge-token')).rejects.toThrow(/iss/i);
    expect(mockVerify).toHaveBeenCalledWith(
      'edge-token',
      'jwks',
      expect.objectContaining({
        issuer: 'http://localhost:8080/realms/platform',
        audience: 'platform-api',
      }),
    );
  });

  it('Edge rejects missing subject', async () => {
    mockVerify.mockResolvedValue({ payload: { iat: 1_700_000_000 } });
    await expect(edge.validateToken('bad')).rejects.toThrow(/subject/i);
  });

  it('issuers and audiences are distinct across realms', () => {
    expect(erpConfig.KEYCLOAK_ISSUER).not.toBe(edgeConfig.EDGE_KEYCLOAK_ISSUER);
    expect(erpConfig.KEYCLOAK_AUDIENCE).not.toBe(edgeConfig.EDGE_KEYCLOAK_AUDIENCE);
    expect(erpConfig.KEYCLOAK_ISSUER).toContain('/realms/platform');
    expect(edgeConfig.EDGE_KEYCLOAK_ISSUER).toContain('/realms/edge-admin');
  });
});
