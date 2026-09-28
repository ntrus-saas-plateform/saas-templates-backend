export type AuditActorType = 'user' | 'system' | 'service';

export type AuditStatus = 'success' | 'failure';

export interface AuditEvent {
  readonly id: string;
  readonly tenantId: string;
  readonly organizationId: string | null;
  readonly actorId: string;
  readonly actorType: AuditActorType;
  readonly action: string;
  readonly resource: string;
  readonly resourceId: string | null;
  readonly status: AuditStatus;
  readonly timestamp: Date;
  readonly correlationId: string;
  readonly requestId: string;
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly before: Record<string, unknown> | null;
  readonly after: Record<string, unknown> | null;
  readonly metadata: Record<string, unknown>;
}
