export interface EmergencyAccessGrant {
  readonly id: string;
  readonly tenantId: string;
  readonly organizationId: string | null;
  readonly operatorIdentityId: string;
  readonly approvedByIdentityId: string;
  readonly reason: string;
  readonly scope: Readonly<Record<string, unknown>>;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly revokedAt: Date | null;
}

export function isEmergencyGrantActive(grant: EmergencyAccessGrant): boolean {
  return grant.revokedAt === null && grant.expiresAt > new Date();
}
