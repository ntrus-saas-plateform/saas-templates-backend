import type { CompatibilityResult } from '../registry/registry.types.js';
import type { ProvisioningEnvironmentSlot } from '../provisioning/provisioning.types.js';

export enum PlacementRequestStatus {
  PENDING = 'PENDING',
  EVALUATING = 'EVALUATING',
  PLACED = 'PLACED',
  REQUIRES_REVIEW = 'REQUIRES_REVIEW',
  NO_CAPACITY = 'NO_CAPACITY',
  NO_COMPATIBLE_TARGET = 'NO_COMPATIBLE_TARGET',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  SUPERSEDED = 'SUPERSEDED',
}

/** Decision status reuses the same vocabulary as request status. */
export enum PlacementDecisionStatus {
  PENDING = 'PENDING',
  EVALUATING = 'EVALUATING',
  PLACED = 'PLACED',
  REQUIRES_REVIEW = 'REQUIRES_REVIEW',
  NO_CAPACITY = 'NO_CAPACITY',
  NO_COMPATIBLE_TARGET = 'NO_COMPATIBLE_TARGET',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  SUPERSEDED = 'SUPERSEDED',
}

export enum CapacityResourceType {
  CPU = 'CPU',
  MEMORY = 'MEMORY',
  STORAGE = 'STORAGE',
  DATABASE = 'DATABASE',
  CONNECTION = 'CONNECTION',
  TENANT_SLOT = 'TENANT_SLOT',
  RUNTIME_INSTANCE = 'RUNTIME_INSTANCE',
  BANDWIDTH = 'BANDWIDTH',
}

export enum CapacityMeasurementSource {
  DECLARED = 'DECLARED',
  OBSERVED = 'OBSERVED',
}

export enum CapacityInventoryStatus {
  ACTIVE = 'ACTIVE',
  STALE = 'STALE',
  SUSPENDED = 'SUSPENDED',
  RETIRED = 'RETIRED',
}

export enum CapacityReservationStatus {
  HELD = 'HELD',
  COMMITTED = 'COMMITTED',
  RELEASED = 'RELEASED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

export enum PlacementPolicyStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  DEPRECATED = 'DEPRECATED',
  RETIRED = 'RETIRED',
}

export enum PlacementHistoryResourceType {
  PLACEMENT_REQUEST = 'PLACEMENT_REQUEST',
  PLACEMENT_DECISION = 'PLACEMENT_DECISION',
  CAPACITY_INVENTORY = 'CAPACITY_INVENTORY',
  CAPACITY_RESERVATION = 'CAPACITY_RESERVATION',
  PLACEMENT_POLICY = 'PLACEMENT_POLICY',
  CANDIDATE_EVALUATION = 'CANDIDATE_EVALUATION',
}

/** Map resourceType → quantity (positive number). */
export type CapacityRequirements = Partial<Record<CapacityResourceType | string, number>>;

export type PlacementRequestRecord = {
  id: string;
  idempotencyKey: string;
  correlationId: string;
  causationId: string | null;
  provisioningRequestId: string;
  authorizationRowId: string;
  authorizationId: string;
  authorizationVersion: number;
  accountId: string;
  subscriptionId: string;
  productId: string;
  productTenantId: string | null;
  productRegistryId: string;
  technicalVersionId: string;
  platformId: string | null;
  contractId: string;
  deploymentProfileId: string;
  requestedEnvironmentType: string;
  requestedDeploymentModel: string;
  requestedRegion: string | null;
  dataResidencyConstraints: Record<string, unknown>;
  securityClassification: string | null;
  availabilityRequirements: Record<string, unknown>;
  recoveryRequirements: Record<string, unknown>;
  capacityRequirements: CapacityRequirements;
  requestStatus: PlacementRequestStatus;
  actorId: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  version: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type PlacementDecisionRecord = {
  id: string;
  placementRequestId: string;
  decisionStatus: PlacementDecisionStatus;
  selectedPlatformId: string | null;
  selectedEnvironmentId: string | null;
  selectedProfileId: string | null;
  selectedRegion: string | null;
  selectedTechnicalVersionId: string | null;
  selectedContractId: string | null;
  selectedContractVersion: string | null;
  capacityReservationId: string | null;
  algorithmName: string;
  algorithmVersion: string;
  policyId: string | null;
  policyVersion: number | null;
  evaluationSnapshot: Record<string, unknown>;
  scoringBreakdown: Record<string, unknown>;
  policyEvaluationSnapshot: Record<string, unknown>;
  rejectionSummary: string | null;
  decidedAt: Date | null;
  expiresAt: Date | null;
  actorId: string | null;
  correlationId: string;
  idempotencyKey: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PlacementCandidateEvaluation = {
  id: string;
  decisionId: string;
  placementRequestId: string;
  platformId: string;
  environmentId: string;
  profileId: string;
  rank: number | null;
  passedHardConstraints: boolean;
  hardConstraintFailures: string[];
  compatibilityResult: CompatibilityResult | string | null;
  score: number | null;
  scoringBreakdown: Record<string, unknown>;
  capacitySnapshot: Record<string, unknown>;
  excluded: boolean;
  exclusionReason: string | null;
  createdAt: Date;
};

export type CapacityInventoryRecord = {
  id: string;
  platformId: string;
  environmentId: string;
  resourceType: CapacityResourceType | string;
  unit: string;
  totalCapacity: number;
  unavailableCapacity: number;
  reservedCapacity: number;
  allocatedCapacity: number;
  availableCapacity: number;
  measurementSource: CapacityMeasurementSource | string;
  measuredAt: Date;
  validUntil: Date;
  capacityStatus: CapacityInventoryStatus | string;
  version: number;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CapacityReservationRecord = {
  id: string;
  placementRequestId: string;
  placementDecisionId: string | null;
  platformId: string;
  environmentId: string;
  resourceQuantities: CapacityRequirements;
  reservationStatus: CapacityReservationStatus;
  idempotencyKey: string;
  expiresAt: Date;
  releasedAt: Date | null;
  releaseReason: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
};

export type PlacementPolicyRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  policyVersion: number;
  scope: Record<string, unknown>;
  hardConstraints: Record<string, unknown>;
  scoringWeights: Record<string, unknown>;
  algorithmVersion: string;
  policyStatus: PlacementPolicyStatus;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PlacementHistoryEntry = {
  id: string;
  resourceType: PlacementHistoryResourceType | string;
  resourceId: string;
  fromStatus: string | null;
  toStatus: string | null;
  action: string;
  reason: string | null;
  actorId: string;
  details: Record<string, unknown>;
  createdAt: Date;
};

/** Re-export for authorization view consumers. */
export type { ProvisioningEnvironmentSlot };
