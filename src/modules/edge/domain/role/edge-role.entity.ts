export enum EdgeRoleScope {
  GLOBAL = 'GLOBAL',
  VERTICAL = 'VERTICAL',
}

export interface EdgePermission {
  readonly id: string;
  readonly code: string;
  readonly description: string | null;
  readonly createdAt: Date;
}

export interface EdgeRole {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly scope: EdgeRoleScope;
  readonly isSystem: boolean;
  readonly isActive: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface EdgeRoleAssignment {
  readonly id: string;
  readonly membershipId: string | null;
  readonly administratorId: string;
  readonly roleId: string;
  readonly scopeVerticalId: string | null;
  readonly expiresAt: Date | null;
  readonly revokedAt: Date | null;
  readonly assignedBy: string | null;
  readonly createdAt: Date;
}

export function isRoleAssignmentActive(assignment: EdgeRoleAssignment, now = new Date()): boolean {
  if (assignment.revokedAt) return false;
  if (assignment.expiresAt && assignment.expiresAt <= now) return false;
  return true;
}
