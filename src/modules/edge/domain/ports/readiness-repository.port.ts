import type {
  ReadinessCheck,
  ReadinessEvaluation,
  ReadinessProfile,
  ReadinessResult,
} from '../readiness/readiness.entity.js';

export interface CreateReadinessEvaluationParams {
  productId: string;
  productVersionId: string;
  profileId?: string | null;
  result: ReadinessResult;
  checks: readonly ReadinessCheck[];
  blockers: readonly string[];
  warnings: readonly string[];
  triggeredBy?: string | null;
}

export interface ReadinessRepositoryPort {
  findProfileByCode(code: string): Promise<ReadinessProfile | null>;
  findProfileById(id: string): Promise<ReadinessProfile | null>;
  createEvaluation(params: CreateReadinessEvaluationParams): Promise<ReadinessEvaluation>;
  listEvaluations(params: {
    page: number;
    limit: number;
    productId?: string;
  }): Promise<{ items: readonly ReadinessEvaluation[]; total: number }>;
}

export const READINESS_REPOSITORY_PORT = Symbol('READINESS_REPOSITORY_PORT');
