import type { EdgeDelegation } from '../delegation/edge-delegation.entity.js';

export interface CreateDelegationParams {
  grantorId: string;
  granteeId: string;
  scope: Readonly<Record<string, unknown>>;
  permittedOperations: readonly string[];
  startsAt: Date;
  expiresAt: Date;
  justification?: string | null;
}

export interface DelegationRepositoryPort {
  findById(id: string): Promise<EdgeDelegation | null>;
  listForAdministrator(administratorId: string): Promise<readonly EdgeDelegation[]>;
  create(params: CreateDelegationParams): Promise<EdgeDelegation>;
  revoke(id: string, revokedAt?: Date): Promise<EdgeDelegation>;
}

export const DELEGATION_REPOSITORY_PORT = Symbol('EDGE_DELEGATION_REPOSITORY_PORT');
