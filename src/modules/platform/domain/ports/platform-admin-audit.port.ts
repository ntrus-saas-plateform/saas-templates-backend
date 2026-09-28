export interface PlatformAdminAuditRecord {
  actorIdentityId?: string;
  actorClientId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  tenantId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  result: 'success' | 'failure';
  metadata?: Record<string, unknown>;
}

export interface PlatformAdminAuditPort {
  record(entry: PlatformAdminAuditRecord): Promise<void>;
}

export const PLATFORM_ADMIN_AUDIT_PORT = Symbol('PLATFORM_ADMIN_AUDIT_PORT');
