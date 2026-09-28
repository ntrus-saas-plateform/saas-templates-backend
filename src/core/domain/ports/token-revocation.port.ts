export interface TokenRevocationPort {
  revokeAllTokensForSubject(subjectId: string): Promise<void>;
  revokeTokenByJti(jti: string, ttlSeconds?: number): Promise<void>;
  isRevoked(subjectId: string, issuedAt: number, jti?: string | null): Promise<boolean>;
}

export const TOKEN_REVOCATION_PORT = Symbol('TOKEN_REVOCATION_PORT');
