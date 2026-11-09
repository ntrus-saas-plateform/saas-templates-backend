import type {
  EdgeEmergencyAccess,
  EmergencyAccessStatus,
} from '../emergency/edge-emergency-access.entity.js';

export interface CreateEmergencyAccessParams {
  requesterId: string;
  scope: Readonly<Record<string, unknown>>;
  justification: string;
}

export interface EmergencyAccessRepositoryPort {
  findById(id: string): Promise<EdgeEmergencyAccess | null>;
  list(params?: { requesterId?: string; status?: EmergencyAccessStatus }): Promise<
    readonly EdgeEmergencyAccess[]
  >;
  create(params: CreateEmergencyAccessParams): Promise<EdgeEmergencyAccess>;
  updateStatus(
    id: string,
    status: EmergencyAccessStatus,
    extras?: {
      approverId?: string | null;
      startsAt?: Date | null;
      expiresAt?: Date | null;
      revokedAt?: Date | null;
    },
  ): Promise<EdgeEmergencyAccess>;
}

export const EMERGENCY_ACCESS_REPOSITORY_PORT = Symbol('EDGE_EMERGENCY_ACCESS_REPOSITORY_PORT');
