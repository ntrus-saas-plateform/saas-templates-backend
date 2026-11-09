import type {
  EdgeInvitation,
  EdgeInvitationStatus,
} from '../invitation/edge-invitation.entity.js';

export interface CreateEdgeInvitationParams {
  email: string;
  invitedBy: string;
  tokenHash: string;
  expiresAt: Date;
  verticalIds: readonly string[];
  roleCodes: readonly string[];
  workflowState?: string | null;
  deliveryStatus?: string | null;
}

export interface InvitationRepositoryPort {
  findById(id: string): Promise<EdgeInvitation | null>;
  findByTokenHash(tokenHash: string): Promise<EdgeInvitation | null>;
  listPendingByEmail(email: string): Promise<readonly EdgeInvitation[]>;
  create(params: CreateEdgeInvitationParams): Promise<EdgeInvitation>;
  updateStatus(
    id: string,
    status: EdgeInvitationStatus,
    extras?: {
      acceptedAt?: Date | null;
      deliveryStatus?: string | null;
      workflowState?: string | null;
    },
  ): Promise<EdgeInvitation>;
}

export const INVITATION_REPOSITORY_PORT = Symbol('EDGE_INVITATION_REPOSITORY_PORT');
