import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { JwtValidationService } from '../../src/shared/auth/jwt-validation.service.js';
import { createTestJwtEnvironment } from '../helpers/test-jwt.js';
import { TENANT_A_ID, ORG_A1_ID, USER_A_ID } from '../helpers/test-constants.js';

import { runTestcontainers } from '../helpers/testcontainers-env.js';

describe.skipIf(!runTestcontainers)('JWT Local JWKS Integration', () => {
  let jwtEnv: Awaited<ReturnType<typeof createTestJwtEnvironment>>;
  let service: JwtValidationService;

  beforeAll(async () => {
    jwtEnv = await createTestJwtEnvironment();
    service = new JwtValidationService({
      KEYCLOAK_ISSUER: jwtEnv.issuer,
      KEYCLOAK_JWKS_URI: jwtEnv.jwksUri,
      KEYCLOAK_AUDIENCE: jwtEnv.audience,
      KEYCLOAK_CLIENT_ID: 'platform-api',
    } as never);
  }, 30_000);

  afterAll(async () => {
    await jwtEnv?.stop();
  });

  it('validates a real signed JWT against local JWKS', async () => {
    const token = await jwtEnv.signToken({
      sub: 'sub-a',
      preferred_username: USER_A_ID,
      tenant_id: TENANT_A_ID,
      organization_id: ORG_A1_ID,
      organization: [ORG_A1_ID],
    });

    const user = await service.validateToken(token);
    expect(user.tenantId).toBe(TENANT_A_ID);
    expect(user.userId).toBe(USER_A_ID);
  });

  it('rejects token with wrong audience', async () => {
    const token = await jwtEnv.signToken(
      {
        sub: 'sub-a',
        tenant_id: TENANT_A_ID,
      },
      { audience: 'wrong-audience' },
    );

    await expect(service.validateToken(token)).rejects.toThrow();
  });
});
