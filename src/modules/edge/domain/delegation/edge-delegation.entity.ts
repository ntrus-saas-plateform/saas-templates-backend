export interface EdgeDelegation {
  readonly id: string;
  readonly grantorId: string;
  readonly granteeId: string;
  readonly scope: Readonly<Record<string, unknown>>;
  readonly permittedOperations: readonly string[];
  readonly startsAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly justification: string | null;
  readonly createdAt: Date;
}

export function isDelegationActive(delegation: EdgeDelegation, now = new Date()): boolean {
  if (delegation.revokedAt) return false;
  if (delegation.startsAt > now) return false;
  return delegation.expiresAt > now;
}
