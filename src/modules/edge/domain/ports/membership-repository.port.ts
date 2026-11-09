import type { MembershipStatus, VerticalMembership } from '../membership/vertical-membership.entity.js';

export interface CreateMembershipParams {
  administratorId: string;
  verticalId: string;
  status: MembershipStatus;
  invitationId?: string | null;
  invitedBy?: string | null;
  reason?: string | null;
}

export interface MembershipRepositoryPort {
  findById(id: string): Promise<VerticalMembership | null>;
  findByAdminAndVertical(
    administratorId: string,
    verticalId: string,
  ): Promise<VerticalMembership | null>;
  listByVertical(verticalId: string): Promise<readonly VerticalMembership[]>;
  listByAdministrator(administratorId: string): Promise<readonly VerticalMembership[]>;
  create(params: CreateMembershipParams): Promise<VerticalMembership>;
  updateStatus(
    id: string,
    status: MembershipStatus,
    extras?: {
      reason?: string | null;
      activatedAt?: Date | null;
      suspendedAt?: Date | null;
      revokedAt?: Date | null;
    },
  ): Promise<VerticalMembership>;
}

export const MEMBERSHIP_REPOSITORY_PORT = Symbol('EDGE_MEMBERSHIP_REPOSITORY_PORT');
