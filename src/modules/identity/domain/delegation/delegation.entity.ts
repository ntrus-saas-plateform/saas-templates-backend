export interface Delegation {
  readonly id: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly grantorIdentityId: string;
  readonly granteeIdentityId: string;
  readonly permissions: readonly string[];
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly revokedAt: Date | null;
}

export function isDelegationActive(delegation: Delegation): boolean {
  return delegation.revokedAt === null && delegation.expiresAt > new Date();
}
