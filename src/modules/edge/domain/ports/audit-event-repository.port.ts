export interface EdgeAuditEvent {
  readonly id: string;
  readonly eventType: string;
  readonly actorId: string | null;
  readonly subjectType: string | null;
  readonly subjectId: string | null;
  readonly verticalId: string | null;
  readonly details: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
}

export interface CreateAuditEventParams {
  eventType: string;
  actorId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  verticalId?: string | null;
  details?: Readonly<Record<string, unknown>>;
}

export interface AuditEventRepositoryPort {
  create(params: CreateAuditEventParams): Promise<EdgeAuditEvent>;
  list(params: {
    page: number;
    limit: number;
    eventType?: string;
    actorId?: string;
    verticalId?: string;
  }): Promise<{ items: readonly EdgeAuditEvent[]; total: number }>;
}

export const AUDIT_EVENT_REPOSITORY_PORT = Symbol('EDGE_AUDIT_EVENT_REPOSITORY_PORT');
