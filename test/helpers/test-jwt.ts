import { createServer, type Server } from 'node:http';
import { exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';

const TEST_ISSUER = 'http://localhost:9999/realms/platform-test';
const TEST_AUDIENCE = 'platform-api';

export interface TestJwtEnvironment {
  readonly issuer: string;
  readonly audience: string;
  readonly jwksUri: string;
  signToken(claims: JWTPayload, options?: { audience?: string }): Promise<string>;
  stop(): Promise<void>;
}

export async function createTestJwtEnvironment(): Promise<TestJwtEnvironment> {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  jwk.kid = 'test-key';
  jwk.alg = 'RS256';
  jwk.use = 'sig';

  const jwks = JSON.stringify({ keys: [jwk] });
  let server: Server | null = null;
  const jwksUri = `${TEST_ISSUER}/protocol/openid-connect/certs`;

  await new Promise<void>((resolve) => {
    server = createServer((req, res) => {
      if (req.url?.endsWith('/protocol/openid-connect/certs')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(jwks);
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server!.address();
  const port = typeof address === 'object' && address ? address.port : 9999;
  const issuer = `http://127.0.0.1:${port}/realms/platform-test`;
  const resolvedJwksUri = `${issuer}/protocol/openid-connect/certs`;

  return {
    issuer,
    audience: TEST_AUDIENCE,
    jwksUri: resolvedJwksUri,
    signToken: async (claims: JWTPayload, options?: { audience?: string }) =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(issuer)
        .setAudience(options?.audience ?? TEST_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime('2h')
        .sign(privateKey),
    stop: async () => {
      await new Promise<void>((resolve, reject) => {
        server?.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
