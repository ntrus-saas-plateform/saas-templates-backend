export interface UserTenantMembershipPort {
  isMember(userId: string, tenantId: string): Promise<boolean>;
  ensureMember(userId: string, tenantId: string, client?: unknown): Promise<void>;
  listActiveMemberIdentityIds(tenantId: string): Promise<readonly string[]>;
}

export const USER_TENANT_MEMBERSHIP_PORT = Symbol('USER_TENANT_MEMBERSHIP_PORT');
