import type { Invitation, InvitationStatus } from '../invitation/invitation.entity.js';

export interface CreateInvitationParams {
  tenantId: string;
  organizationId: string;
  email: string;
  invitedBy: string;
  roles: readonly string[];
  permissions: readonly string[];
  tokenHash: string;
  expiresAt: Date;
}

export interface InvitationRepositoryPort {
  findById(tenantId: string, id: string): Promise<Invitation | null>;
  findByTokenHash(tokenHash: string): Promise<Invitation | null>;
  create(params: CreateInvitationParams, client?: unknown): Promise<Invitation>;
  updateStatus(
    tenantId: string,
    id: string,
    status: InvitationStatus,
    acceptedAt?: Date | null,
    client?: unknown,
  ): Promise<Invitation>;
  listByTenantPage(
    tenantId: string,
    page: number,
    limit: number,
    organizationId?: string,
    filters?: { status?: InvitationStatus; search?: string },
  ): Promise<{ items: readonly Invitation[]; total: number }>;
}

export const INVITATION_REPOSITORY_PORT = Symbol('INVITATION_REPOSITORY_PORT');
