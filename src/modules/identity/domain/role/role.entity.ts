export interface Permission {
  readonly id: string;
  readonly resource: string;
  readonly action: string;
  readonly description: string | null;
}

export function formatPermissionKey(permission: Pick<Permission, 'resource' | 'action'>): string {
  return `${permission.resource}:${permission.action}`;
}

export interface Role {
  readonly id: string;
  readonly tenantId: string | null;
  readonly scope: 'platform' | 'tenant' | 'organization';
  readonly name: string;
  readonly isSystem: boolean;
  readonly description: string | null;
  readonly createdAt: Date;
  /** Catalog keys (`resource:action`) attached to this role. */
  readonly permissions?: readonly string[];
}
