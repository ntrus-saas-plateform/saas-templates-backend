/**
 * Pure monotonic revocation merge used to document / unit-test the SQL upsert policy.
 * A REVOKED authorization must never resurrect to ACTIVE / NOT_REVOKED.
 */
export type AuthorizationRevocationSlice = {
  authorizationStatus: string;
  revocationStatus: string;
  revocationVersion: number | null;
  verificationStatus: string;
  revokedAt: Date | null;
  revocationReasonCode: string | null;
  revocationReference: string | null;
};

export function mergeMonotonicAuthorizationState(
  existing: AuthorizationRevocationSlice | null,
  incoming: AuthorizationRevocationSlice,
): AuthorizationRevocationSlice {
  if (!existing) return { ...incoming };

  const existingRevoked =
    existing.revocationStatus === 'REVOKED' || existing.authorizationStatus === 'REVOKED';
  const incomingRevoked =
    incoming.revocationStatus === 'REVOKED' || incoming.authorizationStatus === 'REVOKED';
  const revoked = existingRevoked || incomingRevoked;

  return {
    authorizationStatus: revoked ? 'REVOKED' : incoming.authorizationStatus,
    revocationStatus: revoked ? 'REVOKED' : incoming.revocationStatus,
    verificationStatus: revoked ? 'REVOKED' : incoming.verificationStatus,
    revocationVersion: Math.max(existing.revocationVersion ?? 0, incoming.revocationVersion ?? 0),
    revokedAt: existing.revokedAt ?? incoming.revokedAt,
    revocationReasonCode: existing.revocationReasonCode ?? incoming.revocationReasonCode,
    revocationReference: existing.revocationReference ?? incoming.revocationReference,
  };
}

/** Whether a candidate revocation version should apply over current state. */
export function shouldApplyRevocationVersion(
  currentVersion: number | null | undefined,
  currentStatus: string | null | undefined,
  candidateVersion: number,
): boolean {
  if (currentVersion == null) return true;
  if (candidateVersion > currentVersion) return true;
  if (candidateVersion === currentVersion && currentStatus !== 'REVOKED') return true;
  return false;
}
