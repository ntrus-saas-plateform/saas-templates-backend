import type { MarketSegment } from '../market/market-segment.entity.js';

export interface CreateSegmentParams {
  code: string;
  name: string;
  description?: string | null;
  verticalId: string;
  parentSegmentId?: string | null;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateSegmentParams {
  name?: string;
  description?: string | null;
  parentSegmentId?: string | null;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface SegmentRepositoryPort {
  findById(id: string): Promise<MarketSegment | null>;
  findByCode(code: string): Promise<MarketSegment | null>;
  listByVertical(verticalId: string): Promise<readonly MarketSegment[]>;
  create(params: CreateSegmentParams): Promise<MarketSegment>;
  update(id: string, params: UpdateSegmentParams): Promise<MarketSegment>;
}

export const SEGMENT_REPOSITORY_PORT = Symbol('SEGMENT_REPOSITORY_PORT');
