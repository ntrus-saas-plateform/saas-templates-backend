import type {
  CapacityInventoryRecord,
  CapacityRequirements,
  CapacityReservationRecord,
  PlacementCandidateEvaluation,
  PlacementDecisionRecord,
  PlacementHistoryEntry,
  PlacementPolicyRecord,
  PlacementRequestRecord,
} from './placement.types.js';

export const PLACEMENT_REPOSITORY_PORT = Symbol('PLACEMENT_REPOSITORY_PORT');

export type PlacementListFilter = {
  limit?: number;
  offset?: number;
  status?: string;
  q?: string;
};

export type ReserveCapacityInput = {
  placementRequestId: string;
  placementDecisionId: string | null;
  platformId: string;
  environmentId: string;
  resourceQuantities: CapacityRequirements;
  idempotencyKey: string;
  expiresAt: Date;
  createdBy?: string | null;
  expectedInventoryVersions?: Record<string, number>;
};

export interface PlacementRepositoryPort {
  // --- Requests ---
  createRequest(
    input: Omit<PlacementRequestRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      version?: number;
    },
    client?: unknown,
  ): Promise<PlacementRequestRecord>;
  updateRequest(
    id: string,
    patch: Partial<PlacementRequestRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<PlacementRequestRecord>;
  getRequest(id: string): Promise<PlacementRequestRecord | null>;
  getRequestByIdempotencyKey(key: string): Promise<PlacementRequestRecord | null>;
  listRequests(
    filter: PlacementListFilter,
  ): Promise<{ items: PlacementRequestRecord[]; total: number }>;

  // --- Decisions ---
  createDecision(
    input: Omit<PlacementDecisionRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      version?: number;
    },
    client?: unknown,
  ): Promise<PlacementDecisionRecord>;
  updateDecision(
    id: string,
    patch: Partial<PlacementDecisionRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<PlacementDecisionRecord>;
  getDecision(id: string): Promise<PlacementDecisionRecord | null>;
  getDecisionByIdempotencyKey(key: string): Promise<PlacementDecisionRecord | null>;
  listDecisions(
    filter: PlacementListFilter & { placementRequestId?: string },
  ): Promise<{ items: PlacementDecisionRecord[]; total: number }>;

  saveCandidates(
    rows: Array<
      Omit<PlacementCandidateEvaluation, 'id' | 'createdAt'> & { id?: string; createdAt?: Date }
    >,
    client?: unknown,
  ): Promise<PlacementCandidateEvaluation[]>;
  listCandidates(
    decisionId: string,
  ): Promise<PlacementCandidateEvaluation[]>;

  // --- Capacity inventory ---
  createInventory(
    input: Omit<
      CapacityInventoryRecord,
      'id' | 'createdAt' | 'updatedAt' | 'version' | 'availableCapacity'
    > & { version?: number },
    client?: unknown,
  ): Promise<CapacityInventoryRecord>;
  updateInventory(
    id: string,
    patch: Partial<CapacityInventoryRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<CapacityInventoryRecord>;
  getInventory(id: string): Promise<CapacityInventoryRecord | null>;
  listInventory(
    filter: PlacementListFilter & {
      platformId?: string;
      environmentId?: string;
      resourceType?: string;
    },
  ): Promise<{ items: CapacityInventoryRecord[]; total: number }>;

  // --- Reservations (atomic lock path) ---
  /**
   * Atomically lock inventory rows (FOR UPDATE), verify available capacity,
   * increment reserved_capacity, and insert a HELD reservation.
   * Must run inside an outer TX client. Fail-closed on insufficient capacity.
   */
  reserveCapacityWithLock(
    input: ReserveCapacityInput,
    client?: unknown,
  ): Promise<CapacityReservationRecord>;
  releaseReservation(
    id: string,
    reason: string,
    expectedVersion: number,
    client?: unknown,
  ): Promise<CapacityReservationRecord>;
  /** HELD → COMMITTED: move reserved_capacity into allocated_capacity. */
  commitReservation(
    id: string,
    expectedVersion: number,
    client?: unknown,
  ): Promise<CapacityReservationRecord>;
  expireReservation(
    id: string,
    expectedVersion: number,
    client?: unknown,
  ): Promise<CapacityReservationRecord>;
  getReservation(id: string): Promise<CapacityReservationRecord | null>;
  getReservationByIdempotencyKey(key: string): Promise<CapacityReservationRecord | null>;
  listReservations(
    filter: PlacementListFilter & {
      placementRequestId?: string;
      environmentId?: string;
      status?: string;
    },
  ): Promise<{ items: CapacityReservationRecord[]; total: number }>;

  // --- Policies ---
  createPolicy(
    input: Omit<PlacementPolicyRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      version?: number;
    },
    client?: unknown,
  ): Promise<PlacementPolicyRecord>;
  updatePolicy(
    id: string,
    patch: Partial<PlacementPolicyRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<PlacementPolicyRecord>;
  getPolicy(id: string): Promise<PlacementPolicyRecord | null>;
  getActivePolicy(code?: string): Promise<PlacementPolicyRecord | null>;
  listPolicies(
    filter: PlacementListFilter,
  ): Promise<{ items: PlacementPolicyRecord[]; total: number }>;

  // --- History ---
  appendHistory(
    entry: Omit<PlacementHistoryEntry, 'id' | 'createdAt'>,
    client?: unknown,
  ): Promise<PlacementHistoryEntry>;
  listHistory(
    filter: PlacementListFilter & { resourceType?: string; resourceId?: string },
  ): Promise<{ items: PlacementHistoryEntry[]; total: number }>;
}
