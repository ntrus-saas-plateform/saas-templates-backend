import type { Vertical, VerticalStatus } from '../vertical/vertical.entity.js';

export interface CreateVerticalParams {
  code: string;
  slug: string;
  displayName: string;
  description?: string | null;
  iconRef?: string | null;
  visualIdentityRef?: string | null;
  keycloakOrganizationId?: string | null;
  createdBy?: string | null;
}

export interface UpdateVerticalParams {
  displayName?: string;
  description?: string | null;
  iconRef?: string | null;
  visualIdentityRef?: string | null;
  keycloakOrganizationId?: string | null;
  configurationVersion?: number;
  updatedBy?: string | null;
}

export interface VerticalRepositoryPort {
  findById(id: string): Promise<Vertical | null>;
  findByCode(code: string): Promise<Vertical | null>;
  findBySlug(slug: string): Promise<Vertical | null>;
  list(params: {
    page: number;
    limit: number;
    status?: VerticalStatus;
    search?: string;
  }): Promise<{ items: readonly Vertical[]; total: number }>;
  create(params: CreateVerticalParams): Promise<Vertical>;
  update(id: string, params: UpdateVerticalParams): Promise<Vertical>;
  updateStatus(
    id: string,
    status: VerticalStatus,
    extras?: {
      suspensionReason?: string | null;
      activatedAt?: Date | null;
      suspendedAt?: Date | null;
      deactivatedAt?: Date | null;
      updatedBy?: string | null;
      configurationVersion?: number;
    },
  ): Promise<Vertical>;
}

export const VERTICAL_REPOSITORY_PORT = Symbol('VERTICAL_REPOSITORY_PORT');
