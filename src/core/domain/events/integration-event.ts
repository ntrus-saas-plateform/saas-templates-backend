export interface EventActor {
  readonly type: 'user' | 'system' | 'service';
  readonly id: string;
}

export interface IntegrationEvent<T = unknown> {
  readonly eventId: string;
  readonly eventType: string;
  /** Event schema version (req 30/31 — prefer .vN in eventType + numeric version). */
  readonly version: number;
  readonly occurredAt: string;
  readonly tenantId: string;
  readonly organizationId: string | null;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly traceId: string | null;
  readonly actor: EventActor;
  /** Producer service / bounded context (req 30 `producer`). */
  readonly source: string;
  readonly aggregateType?: string | null;
  readonly aggregateId?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly payload: T;
}
