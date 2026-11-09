import type { OperatingModel } from '../market/operating-model.entity.js';

export interface CreateOperatingModelParams {
  code: string;
  name: string;
  description?: string | null;
  dimension?: string | null;
  verticalId?: string | null;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface OperatingModelRepositoryPort {
  findById(id: string): Promise<OperatingModel | null>;
  findByCode(code: string): Promise<OperatingModel | null>;
  list(params?: { verticalId?: string }): Promise<readonly OperatingModel[]>;
  create(params: CreateOperatingModelParams): Promise<OperatingModel>;
}

export const OPERATING_MODEL_REPOSITORY_PORT = Symbol('OPERATING_MODEL_REPOSITORY_PORT');
