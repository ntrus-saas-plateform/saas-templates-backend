import type {
  WorkspaceSession,
  WorkspaceSessionStatus,
} from '../session/workspace-session.entity.js';

export interface CreateWorkspaceSessionParams {
  administratorId: string;
  membershipId: string;
  verticalId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface WorkspaceSessionRepositoryPort {
  findById(id: string): Promise<WorkspaceSession | null>;
  findByTokenHash(tokenHash: string): Promise<WorkspaceSession | null>;
  listByAdministrator(administratorId: string): Promise<readonly WorkspaceSession[]>;
  create(params: CreateWorkspaceSessionParams): Promise<WorkspaceSession>;
  renew(id: string, expiresAt: Date, lastRenewedAt?: Date): Promise<WorkspaceSession>;
  updateStatus(
    id: string,
    status: WorkspaceSessionStatus,
    extras?: { revokedAt?: Date | null; revocationReason?: string | null },
  ): Promise<WorkspaceSession>;
  revokeAllForAdministrator(
    administratorId: string,
    reason: string,
    revokedAt?: Date,
  ): Promise<number>;
  revokeAllForMembership(
    membershipId: string,
    reason: string,
    revokedAt?: Date,
  ): Promise<number>;
}

export const WORKSPACE_SESSION_REPOSITORY_PORT = Symbol('WORKSPACE_SESSION_REPOSITORY_PORT');
