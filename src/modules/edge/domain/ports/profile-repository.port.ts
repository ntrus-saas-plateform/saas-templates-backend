import type { BusinessProfileTemplate } from '../market/business-profile.entity.js';

export interface CreateProfileParams {
  code: string;
  name: string;
  description?: string | null;
  verticalId: string;
  segmentId?: string | null;
  status?: string;
  attributesSchema?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ProfileRepositoryPort {
  findById(id: string): Promise<BusinessProfileTemplate | null>;
  findByCode(code: string): Promise<BusinessProfileTemplate | null>;
  list(params?: { verticalId?: string }): Promise<readonly BusinessProfileTemplate[]>;
  create(params: CreateProfileParams): Promise<BusinessProfileTemplate>;
}

export const PROFILE_REPOSITORY_PORT = Symbol('PROFILE_REPOSITORY_PORT');
