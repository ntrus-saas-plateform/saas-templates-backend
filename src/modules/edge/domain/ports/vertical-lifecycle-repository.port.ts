import type { VerticalLifecycleEvent, VerticalStatus } from '../vertical/vertical.entity.js';

export interface RecordVerticalLifecycleEventParams {
  verticalId: string;
  fromStatus: VerticalStatus;
  toStatus: VerticalStatus;
  reason?: string | null;
  actorId?: string | null;
}

export interface VerticalLifecycleRepositoryPort {
  record(params: RecordVerticalLifecycleEventParams): Promise<VerticalLifecycleEvent>;
  listByVertical(
    verticalId: string,
    page?: number,
    limit?: number,
  ): Promise<{ items: readonly VerticalLifecycleEvent[]; total: number }>;
}

export const VERTICAL_LIFECYCLE_REPOSITORY_PORT = Symbol('VERTICAL_LIFECYCLE_REPOSITORY_PORT');
