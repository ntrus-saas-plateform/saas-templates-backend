import { Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import { computeAvailable, validateQuantities } from '../../domain/placement/capacity.js';
import type {
  PlacementRepositoryPort,
  PlacementListFilter,
  ReserveCapacityInput,
} from '../../domain/placement/placement-repository.port.js';
import {
  CapacityInventoryStatus,
  CapacityMeasurementSource,
  CapacityReservationStatus,
  PlacementDecisionStatus,
  PlacementHistoryResourceType,
  PlacementPolicyStatus,
  PlacementRequestStatus,
  type CapacityInventoryRecord,
  type CapacityReservationRecord,
  type PlacementCandidateEvaluation,
  type PlacementDecisionRecord,
  type PlacementHistoryEntry,
  type PlacementPolicyRecord,
  type PlacementRequestRecord,
} from '../../domain/placement/placement.types.js';

type Row = Record<string, unknown>;

function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
}

function asDate(v: unknown): Date {
  if (v instanceof Date) return v;
  return new Date(String(v));
}

@Injectable()
export class PgPlacementRepository implements PlacementRepositoryPort {
  constructor(private readonly cpDb: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.cpDb.getPool();
  }

  private async q<T extends Row = Row>(sql: string, params: unknown[] = [], client?: unknown) {
    const executor = client ? (client as PoolClient) : this.pool;
    const res = await executor.query(sql, params);
    return res.rows as T[];
  }

  // ---------------------------------------------------------------------------
  // Mappers
  // ---------------------------------------------------------------------------

  private mapRequest(r: Row): PlacementRequestRecord {
    return {
      id: String(r.id),
      idempotencyKey: String(r.idempotency_key),
      correlationId: String(r.correlation_id),
      causationId: r.causation_id == null ? null : String(r.causation_id),
      provisioningRequestId: String(r.provisioning_request_id),
      authorizationRowId: String(r.authorization_row_id),
      authorizationId: String(r.authorization_id),
      authorizationVersion: num(r.authorization_version),
      accountId: String(r.account_id),
      subscriptionId: String(r.subscription_id),
      productId: String(r.product_id),
      productTenantId: r.product_tenant_id == null ? null : String(r.product_tenant_id),
      productRegistryId: String(r.product_registry_id),
      technicalVersionId: String(r.technical_version_id),
      platformId: r.platform_id == null ? null : String(r.platform_id),
      contractId: String(r.contract_id),
      deploymentProfileId: String(r.deployment_profile_id),
      requestedEnvironmentType: String(r.requested_environment_type),
      requestedDeploymentModel: String(r.requested_deployment_model),
      requestedRegion: r.requested_region == null ? null : String(r.requested_region),
      dataResidencyConstraints: asJson(r.data_residency_constraints, {}),
      securityClassification:
        r.security_classification == null ? null : String(r.security_classification),
      availabilityRequirements: asJson(r.availability_requirements, {}),
      recoveryRequirements: asJson(r.recovery_requirements, {}),
      capacityRequirements: asJson(r.capacity_requirements, {}),
      requestStatus: String(r.request_status) as PlacementRequestStatus,
      actorId: r.actor_id == null ? null : String(r.actor_id),
      createdBy: r.created_by == null ? null : String(r.created_by),
      updatedBy: r.updated_by == null ? null : String(r.updated_by),
      version: num(r.version),
      metadata: asJson(r.metadata, {}),
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
    };
  }

  private mapDecision(r: Row): PlacementDecisionRecord {
    return {
      id: String(r.id),
      placementRequestId: String(r.placement_request_id),
      decisionStatus: String(r.decision_status) as PlacementDecisionStatus,
      selectedPlatformId: r.selected_platform_id == null ? null : String(r.selected_platform_id),
      selectedEnvironmentId:
        r.selected_environment_id == null ? null : String(r.selected_environment_id),
      selectedProfileId: r.selected_profile_id == null ? null : String(r.selected_profile_id),
      selectedRegion: r.selected_region == null ? null : String(r.selected_region),
      selectedTechnicalVersionId:
        r.selected_technical_version_id == null ? null : String(r.selected_technical_version_id),
      selectedContractId: r.selected_contract_id == null ? null : String(r.selected_contract_id),
      selectedContractVersion:
        r.selected_contract_version == null ? null : String(r.selected_contract_version),
      capacityReservationId:
        r.capacity_reservation_id == null ? null : String(r.capacity_reservation_id),
      algorithmName: String(r.algorithm_name),
      algorithmVersion: String(r.algorithm_version),
      policyId: r.policy_id == null ? null : String(r.policy_id),
      policyVersion: r.policy_version == null ? null : num(r.policy_version),
      evaluationSnapshot: asJson(r.evaluation_snapshot, {}),
      scoringBreakdown: asJson(r.scoring_breakdown, {}),
      policyEvaluationSnapshot: asJson(r.policy_evaluation_snapshot, {}),
      rejectionSummary: r.rejection_summary == null ? null : String(r.rejection_summary),
      decidedAt: r.decided_at == null ? null : asDate(r.decided_at),
      expiresAt: r.expires_at == null ? null : asDate(r.expires_at),
      actorId: r.actor_id == null ? null : String(r.actor_id),
      correlationId: String(r.correlation_id),
      idempotencyKey: r.idempotency_key == null ? null : String(r.idempotency_key),
      version: num(r.version),
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
    };
  }

  private mapCandidate(r: Row): PlacementCandidateEvaluation {
    return {
      id: String(r.id),
      decisionId: String(r.decision_id),
      placementRequestId: String(r.placement_request_id),
      platformId: String(r.platform_id),
      environmentId: String(r.environment_id),
      profileId: String(r.profile_id),
      rank: r.rank == null ? null : num(r.rank),
      passedHardConstraints: Boolean(r.passed_hard_constraints),
      hardConstraintFailures: asJson(r.hard_constraint_failures, []),
      compatibilityResult: r.compatibility_result == null ? null : String(r.compatibility_result),
      score: r.score == null ? null : num(r.score),
      scoringBreakdown: asJson(r.scoring_breakdown, {}),
      capacitySnapshot: asJson(r.capacity_snapshot, {}),
      excluded: Boolean(r.excluded),
      exclusionReason: r.exclusion_reason == null ? null : String(r.exclusion_reason),
      createdAt: asDate(r.created_at),
    };
  }

  private mapInventory(r: Row): CapacityInventoryRecord {
    const total = num(r.total_capacity);
    const unavailable = num(r.unavailable_capacity);
    const reserved = num(r.reserved_capacity);
    const allocated = num(r.allocated_capacity);
    return {
      id: String(r.id),
      platformId: String(r.platform_id),
      environmentId: String(r.environment_id),
      resourceType: String(r.resource_type),
      unit: String(r.unit),
      totalCapacity: total,
      unavailableCapacity: unavailable,
      reservedCapacity: reserved,
      allocatedCapacity: allocated,
      availableCapacity:
        r.available_capacity == null
          ? computeAvailable({
              totalCapacity: total,
              unavailableCapacity: unavailable,
              reservedCapacity: reserved,
              allocatedCapacity: allocated,
            })
          : num(r.available_capacity),
      measurementSource: String(r.measurement_source) as CapacityMeasurementSource,
      measuredAt: asDate(r.measured_at),
      validUntil: asDate(r.valid_until),
      capacityStatus: String(r.capacity_status) as CapacityInventoryStatus,
      version: num(r.version),
      metadata: asJson(r.metadata, {}),
      createdBy: r.created_by == null ? null : String(r.created_by),
      updatedBy: r.updated_by == null ? null : String(r.updated_by),
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
    };
  }

  private mapReservation(r: Row): CapacityReservationRecord {
    return {
      id: String(r.id),
      placementRequestId: String(r.placement_request_id),
      placementDecisionId:
        r.placement_decision_id == null ? null : String(r.placement_decision_id),
      platformId: String(r.platform_id),
      environmentId: String(r.environment_id),
      resourceQuantities: asJson(r.resource_quantities, {}),
      reservationStatus: String(r.reservation_status) as CapacityReservationStatus,
      idempotencyKey: String(r.idempotency_key),
      expiresAt: asDate(r.expires_at),
      releasedAt: r.released_at == null ? null : asDate(r.released_at),
      releaseReason: r.release_reason == null ? null : String(r.release_reason),
      version: num(r.version),
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
      createdBy: r.created_by == null ? null : String(r.created_by),
    };
  }

  private mapPolicy(r: Row): PlacementPolicyRecord {
    return {
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      description: r.description == null ? null : String(r.description),
      policyVersion: num(r.policy_version),
      scope: asJson(r.scope, {}),
      hardConstraints: asJson(r.hard_constraints, {}),
      scoringWeights: asJson(r.scoring_weights, {}),
      algorithmVersion: String(r.algorithm_version),
      policyStatus: String(r.policy_status) as PlacementPolicyStatus,
      version: num(r.version),
      createdBy: r.created_by == null ? null : String(r.created_by),
      updatedBy: r.updated_by == null ? null : String(r.updated_by),
      createdAt: asDate(r.created_at),
      updatedAt: asDate(r.updated_at),
    };
  }

  private mapHistory(r: Row): PlacementHistoryEntry {
    return {
      id: String(r.id),
      resourceType: String(r.resource_type) as PlacementHistoryResourceType,
      resourceId: String(r.resource_id),
      fromStatus: r.from_status == null ? null : String(r.from_status),
      toStatus: r.to_status == null ? null : String(r.to_status),
      action: String(r.action),
      reason: r.reason == null ? null : String(r.reason),
      actorId: String(r.actor_id),
      details: asJson(r.details, {}),
      createdAt: asDate(r.created_at),
    };
  }

  private page(filter: PlacementListFilter) {
    const limit = Math.min(Math.max(filter.limit ?? 20, 1), 100);
    const offset = Math.max(filter.offset ?? 0, 0);
    return { limit, offset };
  }

  // ---------------------------------------------------------------------------
  // Requests
  // ---------------------------------------------------------------------------

  async createRequest(
    input: Omit<PlacementRequestRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      version?: number;
    },
    client?: unknown,
  ): Promise<PlacementRequestRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_placement_requests (
         idempotency_key, correlation_id, causation_id, provisioning_request_id,
         authorization_row_id, authorization_id, authorization_version,
         account_id, subscription_id, product_id, product_tenant_id,
         product_registry_id, technical_version_id, platform_id, contract_id,
         deployment_profile_id, requested_environment_type, requested_deployment_model,
         requested_region, data_residency_constraints, security_classification,
         availability_requirements, recovery_requirements, capacity_requirements,
         request_status, actor_id, created_by, updated_by, metadata
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
         $20::jsonb,$21,$22::jsonb,$23::jsonb,$24::jsonb,$25,$26,$27,$27,$28::jsonb
       ) RETURNING *`,
      [
        input.idempotencyKey,
        input.correlationId,
        input.causationId,
        input.provisioningRequestId,
        input.authorizationRowId,
        input.authorizationId,
        input.authorizationVersion,
        input.accountId,
        input.subscriptionId,
        input.productId,
        input.productTenantId,
        input.productRegistryId,
        input.technicalVersionId,
        input.platformId,
        input.contractId,
        input.deploymentProfileId,
        input.requestedEnvironmentType,
        input.requestedDeploymentModel,
        input.requestedRegion,
        JSON.stringify(input.dataResidencyConstraints ?? {}),
        input.securityClassification,
        JSON.stringify(input.availabilityRequirements ?? {}),
        JSON.stringify(input.recoveryRequirements ?? {}),
        JSON.stringify(input.capacityRequirements ?? {}),
        input.requestStatus,
        input.actorId,
        input.createdBy,
        JSON.stringify(input.metadata ?? {}),
      ],
      client,
    );
    return this.mapRequest(rows[0]!);
  }

  async updateRequest(
    id: string,
    patch: Partial<PlacementRequestRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<PlacementRequestRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_placement_requests SET
         request_status = COALESCE($3, request_status),
         platform_id = COALESCE($4, platform_id),
         capacity_requirements = COALESCE($5::jsonb, capacity_requirements),
         metadata = COALESCE($6::jsonb, metadata),
         updated_by = COALESCE($7, updated_by),
         actor_id = COALESCE($8, actor_id),
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.requestStatus ?? null,
        patch.platformId === undefined ? null : patch.platformId,
        patch.capacityRequirements ? JSON.stringify(patch.capacityRequirements) : null,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        patch.updatedBy ?? null,
        patch.actorId ?? null,
      ],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.CONFLICT, 'Placement request version conflict or not found');
    }
    return this.mapRequest(rows[0]);
  }

  async getRequest(id: string): Promise<PlacementRequestRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_placement_requests WHERE id = $1`, [id]);
    return rows[0] ? this.mapRequest(rows[0]) : null;
  }

  async getRequestByIdempotencyKey(key: string): Promise<PlacementRequestRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_placement_requests WHERE idempotency_key = $1`,
      [key],
    );
    return rows[0] ? this.mapRequest(rows[0]) : null;
  }

  async listRequests(
    filter: PlacementListFilter,
  ): Promise<{ items: PlacementRequestRecord[]; total: number }> {
    const { limit, offset } = this.page(filter);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`request_status = $${params.length}`);
    }
    if (filter.q) {
      params.push(`%${filter.q}%`);
      where.push(`(CAST(id AS text) ILIKE $${params.length} OR CAST(correlation_id AS text) ILIKE $${params.length})`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count = await this.q<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_p7_placement_requests ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_placement_requests ${clause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapRequest(r)), total: Number(count[0]?.c ?? 0) };
  }

  // ---------------------------------------------------------------------------
  // Decisions
  // ---------------------------------------------------------------------------

  async createDecision(
    input: Omit<PlacementDecisionRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      version?: number;
    },
    client?: unknown,
  ): Promise<PlacementDecisionRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_placement_decisions (
         placement_request_id, decision_status, selected_platform_id, selected_environment_id,
         selected_profile_id, selected_region, selected_technical_version_id, selected_contract_id,
         selected_contract_version, capacity_reservation_id, algorithm_name, algorithm_version,
         policy_id, policy_version, evaluation_snapshot, scoring_breakdown,
         policy_evaluation_snapshot, rejection_summary, decided_at, expires_at,
         actor_id, correlation_id, idempotency_key
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17::jsonb,
         $18,$19,$20,$21,$22,$23
       ) RETURNING *`,
      [
        input.placementRequestId,
        input.decisionStatus,
        input.selectedPlatformId,
        input.selectedEnvironmentId,
        input.selectedProfileId,
        input.selectedRegion,
        input.selectedTechnicalVersionId,
        input.selectedContractId,
        input.selectedContractVersion,
        input.capacityReservationId,
        input.algorithmName,
        input.algorithmVersion,
        input.policyId,
        input.policyVersion,
        JSON.stringify(input.evaluationSnapshot ?? {}),
        JSON.stringify(input.scoringBreakdown ?? {}),
        JSON.stringify(input.policyEvaluationSnapshot ?? {}),
        input.rejectionSummary,
        input.decidedAt,
        input.expiresAt,
        input.actorId,
        input.correlationId,
        input.idempotencyKey,
      ],
      client,
    );
    return this.mapDecision(rows[0]!);
  }

  async updateDecision(
    id: string,
    patch: Partial<PlacementDecisionRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<PlacementDecisionRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_placement_decisions SET
         decision_status = COALESCE($3, decision_status),
         capacity_reservation_id = COALESCE($4, capacity_reservation_id),
         rejection_summary = COALESCE($5, rejection_summary),
         decided_at = COALESCE($6, decided_at),
         expires_at = COALESCE($7, expires_at),
         actor_id = COALESCE($8, actor_id),
         evaluation_snapshot = COALESCE($9::jsonb, evaluation_snapshot),
         scoring_breakdown = COALESCE($10::jsonb, scoring_breakdown),
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.decisionStatus ?? null,
        patch.capacityReservationId === undefined ? null : patch.capacityReservationId,
        patch.rejectionSummary ?? null,
        patch.decidedAt ?? null,
        patch.expiresAt ?? null,
        patch.actorId ?? null,
        patch.evaluationSnapshot ? JSON.stringify(patch.evaluationSnapshot) : null,
        patch.scoringBreakdown ? JSON.stringify(patch.scoringBreakdown) : null,
      ],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.CONFLICT, 'Placement decision version conflict or not found');
    }
    return this.mapDecision(rows[0]);
  }

  async getDecision(id: string): Promise<PlacementDecisionRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_placement_decisions WHERE id = $1`, [id]);
    return rows[0] ? this.mapDecision(rows[0]) : null;
  }

  async getDecisionByIdempotencyKey(key: string): Promise<PlacementDecisionRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_placement_decisions WHERE idempotency_key = $1`,
      [key],
    );
    return rows[0] ? this.mapDecision(rows[0]) : null;
  }

  async listDecisions(
    filter: PlacementListFilter & { placementRequestId?: string },
  ): Promise<{ items: PlacementDecisionRecord[]; total: number }> {
    const { limit, offset } = this.page(filter);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`decision_status = $${params.length}`);
    }
    if (filter.placementRequestId) {
      params.push(filter.placementRequestId);
      where.push(`placement_request_id = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count = await this.q<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_p7_placement_decisions ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_placement_decisions ${clause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapDecision(r)), total: Number(count[0]?.c ?? 0) };
  }

  async saveCandidates(
    rows: Array<
      Omit<PlacementCandidateEvaluation, 'id' | 'createdAt'> & { id?: string; createdAt?: Date }
    >,
    client?: unknown,
  ): Promise<PlacementCandidateEvaluation[]> {
    const out: PlacementCandidateEvaluation[] = [];
    for (const row of rows) {
      const inserted = await this.q(
        `INSERT INTO edge_p7_placement_candidate_evaluations (
           decision_id, placement_request_id, platform_id, environment_id, profile_id,
           rank, passed_hard_constraints, hard_constraint_failures, compatibility_result,
           score, scoring_breakdown, capacity_snapshot, excluded, exclusion_reason
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11::jsonb,$12::jsonb,$13,$14
         ) RETURNING *`,
        [
          row.decisionId,
          row.placementRequestId,
          row.platformId,
          row.environmentId,
          row.profileId,
          row.rank,
          row.passedHardConstraints,
          JSON.stringify(row.hardConstraintFailures ?? []),
          row.compatibilityResult,
          row.score,
          JSON.stringify(row.scoringBreakdown ?? {}),
          JSON.stringify(row.capacitySnapshot ?? {}),
          row.excluded,
          row.exclusionReason,
        ],
        client,
      );
      out.push(this.mapCandidate(inserted[0]!));
    }
    return out;
  }

  async listCandidates(decisionId: string): Promise<PlacementCandidateEvaluation[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_placement_candidate_evaluations
       WHERE decision_id = $1
       ORDER BY rank ASC NULLS LAST, created_at ASC`,
      [decisionId],
    );
    return rows.map((r) => this.mapCandidate(r));
  }

  // ---------------------------------------------------------------------------
  // Inventory
  // ---------------------------------------------------------------------------

  async createInventory(
    input: Omit<
      CapacityInventoryRecord,
      'id' | 'createdAt' | 'updatedAt' | 'version' | 'availableCapacity'
    > & { version?: number },
    client?: unknown,
  ): Promise<CapacityInventoryRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_capacity_inventory (
         platform_id, environment_id, resource_type, unit, total_capacity,
         unavailable_capacity, reserved_capacity, allocated_capacity,
         measurement_source, measured_at, valid_until, capacity_status,
         metadata, created_by, updated_by
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$14
       ) RETURNING *`,
      [
        input.platformId,
        input.environmentId,
        input.resourceType,
        input.unit,
        input.totalCapacity,
        input.unavailableCapacity,
        input.reservedCapacity,
        input.allocatedCapacity,
        input.measurementSource,
        input.measuredAt,
        input.validUntil,
        input.capacityStatus,
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
      client,
    );
    return this.mapInventory(rows[0]!);
  }

  async updateInventory(
    id: string,
    patch: Partial<CapacityInventoryRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<CapacityInventoryRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_capacity_inventory SET
         total_capacity = COALESCE($3, total_capacity),
         unavailable_capacity = COALESCE($4, unavailable_capacity),
         reserved_capacity = COALESCE($5, reserved_capacity),
         allocated_capacity = COALESCE($6, allocated_capacity),
         unit = COALESCE($7, unit),
         measured_at = COALESCE($8, measured_at),
         valid_until = COALESCE($9, valid_until),
         capacity_status = COALESCE($10, capacity_status),
         metadata = COALESCE($11::jsonb, metadata),
         updated_by = COALESCE($12, updated_by),
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.totalCapacity ?? null,
        patch.unavailableCapacity ?? null,
        patch.reservedCapacity ?? null,
        patch.allocatedCapacity ?? null,
        patch.unit ?? null,
        patch.measuredAt ?? null,
        patch.validUntil ?? null,
        patch.capacityStatus ?? null,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
        patch.updatedBy ?? null,
      ],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.CONFLICT, 'Capacity inventory version conflict or not found');
    }
    return this.mapInventory(rows[0]);
  }

  async getInventory(id: string): Promise<CapacityInventoryRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_capacity_inventory WHERE id = $1`, [id]);
    return rows[0] ? this.mapInventory(rows[0]) : null;
  }

  async listInventory(
    filter: PlacementListFilter & {
      platformId?: string;
      environmentId?: string;
      resourceType?: string;
    },
  ): Promise<{ items: CapacityInventoryRecord[]; total: number }> {
    const { limit, offset } = this.page(filter);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`capacity_status = $${params.length}`);
    }
    if (filter.platformId) {
      params.push(filter.platformId);
      where.push(`platform_id = $${params.length}`);
    }
    if (filter.environmentId) {
      params.push(filter.environmentId);
      where.push(`environment_id = $${params.length}`);
    }
    if (filter.resourceType) {
      params.push(filter.resourceType);
      where.push(`resource_type = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count = await this.q<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_p7_capacity_inventory ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_capacity_inventory ${clause}
       ORDER BY updated_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapInventory(r)), total: Number(count[0]?.c ?? 0) };
  }

  // ---------------------------------------------------------------------------
  // Reservations — atomic lock path
  // ---------------------------------------------------------------------------

  /**
   * Outer TX already open (client required for correctness under concurrency).
   * SELECT inventory FOR UPDATE by environment + resource types, verify headroom,
   * bump reserved_capacity with version check, INSERT HELD reservation.
   */
  async reserveCapacityWithLock(
    input: ReserveCapacityInput,
    client?: unknown,
  ): Promise<CapacityReservationRecord> {
    if (!client) {
      throw new DomainError(
        ErrorCode.INTERNAL_ERROR,
        'reserveCapacityWithLock requires an outer TX client',
      );
    }

    const existingRows = await this.q(
      `SELECT * FROM edge_p7_capacity_reservations WHERE idempotency_key = $1`,
      [input.idempotencyKey],
      client,
    );
    if (existingRows[0]) {
      return this.mapReservation(existingRows[0]);
    }

    const quantities = validateQuantities(input.resourceQuantities);
    const resourceTypes = Object.keys(quantities);
    if (resourceTypes.length === 0) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'resourceQuantities must not be empty');
    }

    const locked = await this.q(
      `SELECT * FROM edge_p7_capacity_inventory
       WHERE environment_id = $1
         AND resource_type = ANY($2::text[])
         AND capacity_status = 'ACTIVE'
       FOR UPDATE`,
      [input.environmentId, resourceTypes],
      client,
    );

    const byType = new Map<string, Row>();
    for (const row of locked) {
      const key = String(row.resource_type);
      // Prefer DECLARED over OBSERVED when both exist
      const prev = byType.get(key);
      if (!prev || String(row.measurement_source) === CapacityMeasurementSource.DECLARED) {
        byType.set(key, row);
      }
    }

    for (const [resourceType, qty] of Object.entries(quantities)) {
      const row = byType.get(resourceType);
      if (!row) {
        throw new DomainError(
          ErrorCode.CONFLICT,
          `Insufficient capacity: missing inventory for ${resourceType}`,
          [{ resourceType, required: qty }],
        );
      }
      const inv = this.mapInventory(row);
      if (inv.availableCapacity < (qty as number)) {
        throw new DomainError(
          ErrorCode.CONFLICT,
          `Insufficient capacity for ${resourceType}`,
          [
            {
              resourceType,
              required: qty,
              available: inv.availableCapacity,
            },
          ],
        );
      }
      if (input.expectedInventoryVersions?.[resourceType] != null) {
        if (inv.version !== input.expectedInventoryVersions[resourceType]) {
          throw new DomainError(ErrorCode.CONFLICT, `Inventory version conflict for ${resourceType}`);
        }
      }
      const updated = await this.q(
        `UPDATE edge_p7_capacity_inventory SET
           reserved_capacity = reserved_capacity + $3,
           version = version + 1,
           updated_at = NOW()
         WHERE id = $1 AND version = $2
         RETURNING *`,
        [inv.id, inv.version, qty],
        client,
      );
      if (!updated[0]) {
        throw new DomainError(
          ErrorCode.CONFLICT,
          `Concurrent capacity update for ${resourceType}`,
        );
      }
    }

    const rows = await this.q(
      `INSERT INTO edge_p7_capacity_reservations (
         placement_request_id, placement_decision_id, platform_id, environment_id,
         resource_quantities, reservation_status, idempotency_key, expires_at, created_by
       ) VALUES ($1,$2,$3,$4,$5::jsonb,'HELD',$6,$7,$8)
       RETURNING *`,
      [
        input.placementRequestId,
        input.placementDecisionId,
        input.platformId,
        input.environmentId,
        JSON.stringify(quantities),
        input.idempotencyKey,
        input.expiresAt,
        input.createdBy ?? null,
      ],
      client,
    );
    return this.mapReservation(rows[0]!);
  }

  private async adjustInventoryForQuantities(
    environmentId: string,
    quantities: Record<string, number>,
    mode: 'release' | 'commit',
    client: unknown,
  ): Promise<void> {
    const types = Object.keys(quantities);
    const locked = await this.q(
      `SELECT * FROM edge_p7_capacity_inventory
       WHERE environment_id = $1 AND resource_type = ANY($2::text[])
       FOR UPDATE`,
      [environmentId, types],
      client,
    );
    const byType = new Map<string, Row>();
    for (const row of locked) {
      const key = String(row.resource_type);
      const prev = byType.get(key);
      if (!prev || String(row.measurement_source) === CapacityMeasurementSource.DECLARED) {
        byType.set(key, row);
      }
    }
    for (const [resourceType, qty] of Object.entries(quantities)) {
      const row = byType.get(resourceType);
      if (!row) continue;
      const inv = this.mapInventory(row);
      let sql: string;
      if (mode === 'release') {
        sql = `UPDATE edge_p7_capacity_inventory SET
                 reserved_capacity = GREATEST(reserved_capacity - $3, 0),
                 version = version + 1, updated_at = NOW()
               WHERE id = $1 AND version = $2 RETURNING *`;
      } else {
        sql = `UPDATE edge_p7_capacity_inventory SET
                 reserved_capacity = GREATEST(reserved_capacity - $3, 0),
                 allocated_capacity = allocated_capacity + $3,
                 version = version + 1, updated_at = NOW()
               WHERE id = $1 AND version = $2 RETURNING *`;
      }
      const updated = await this.q(sql, [inv.id, inv.version, qty], client);
      if (!updated[0]) {
        throw new DomainError(ErrorCode.CONFLICT, `Inventory version conflict releasing ${resourceType}`);
      }
    }
  }

  async releaseReservation(
    id: string,
    reason: string,
    expectedVersion: number,
    client?: unknown,
  ): Promise<CapacityReservationRecord> {
    if (!client) {
      throw new DomainError(ErrorCode.INTERNAL_ERROR, 'releaseReservation requires TX client');
    }
    const locked = await this.q(
      `SELECT * FROM edge_p7_capacity_reservations WHERE id = $1 FOR UPDATE`,
      [id],
      client,
    );
    if (!locked[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Reservation not found');
    }
    const current = this.mapReservation(locked[0]);
    if (current.version !== expectedVersion) {
      throw new DomainError(ErrorCode.CONFLICT, 'Reservation version conflict');
    }
    if (
      current.reservationStatus !== CapacityReservationStatus.HELD &&
      current.reservationStatus !== CapacityReservationStatus.COMMITTED
    ) {
      return current;
    }
    const quantities = validateQuantities(current.resourceQuantities);
    if (current.reservationStatus === CapacityReservationStatus.HELD) {
      await this.adjustInventoryForQuantities(current.environmentId, quantities as Record<string, number>, 'release', client);
    } else {
      // COMMITTED: free allocated
      const types = Object.keys(quantities);
      const invRows = await this.q(
        `SELECT * FROM edge_p7_capacity_inventory
         WHERE environment_id = $1 AND resource_type = ANY($2::text[]) FOR UPDATE`,
        [current.environmentId, types],
        client,
      );
      for (const [resourceType, qty] of Object.entries(quantities)) {
        const row = invRows.find((r) => String(r.resource_type) === resourceType);
        if (!row) continue;
        const inv = this.mapInventory(row);
        const updated = await this.q(
          `UPDATE edge_p7_capacity_inventory SET
             allocated_capacity = GREATEST(allocated_capacity - $3, 0),
             version = version + 1, updated_at = NOW()
           WHERE id = $1 AND version = $2 RETURNING *`,
          [inv.id, inv.version, qty],
          client,
        );
        if (!updated[0]) {
          throw new DomainError(ErrorCode.CONFLICT, `Inventory conflict releasing allocated ${resourceType}`);
        }
      }
    }
    const rows = await this.q(
      `UPDATE edge_p7_capacity_reservations SET
         reservation_status = 'RELEASED',
         released_at = NOW(),
         release_reason = $3,
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [id, expectedVersion, reason],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.CONFLICT, 'Reservation release conflict');
    }
    return this.mapReservation(rows[0]);
  }

  async commitReservation(
    id: string,
    expectedVersion: number,
    client?: unknown,
  ): Promise<CapacityReservationRecord> {
    if (!client) {
      throw new DomainError(ErrorCode.INTERNAL_ERROR, 'commitReservation requires TX client');
    }
    const locked = await this.q(
      `SELECT * FROM edge_p7_capacity_reservations WHERE id = $1 FOR UPDATE`,
      [id],
      client,
    );
    if (!locked[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Reservation not found');
    }
    const current = this.mapReservation(locked[0]);
    if (current.version !== expectedVersion) {
      throw new DomainError(ErrorCode.CONFLICT, 'Reservation version conflict');
    }
    if (current.reservationStatus === CapacityReservationStatus.COMMITTED) {
      return current;
    }
    if (current.reservationStatus !== CapacityReservationStatus.HELD) {
      throw new DomainError(
        ErrorCode.INVALID_STATE_TRANSITION,
        `Cannot commit reservation in status ${current.reservationStatus}`,
      );
    }
    const quantities = validateQuantities(current.resourceQuantities);
    await this.adjustInventoryForQuantities(
      current.environmentId,
      quantities as Record<string, number>,
      'commit',
      client,
    );
    const rows = await this.q(
      `UPDATE edge_p7_capacity_reservations SET
         reservation_status = 'COMMITTED',
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [id, expectedVersion],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.CONFLICT, 'Reservation commit conflict');
    }
    return this.mapReservation(rows[0]);
  }

  async expireReservation(
    id: string,
    expectedVersion: number,
    client?: unknown,
  ): Promise<CapacityReservationRecord> {
    if (!client) {
      throw new DomainError(ErrorCode.INTERNAL_ERROR, 'expireReservation requires TX client');
    }
    const locked = await this.q(
      `SELECT * FROM edge_p7_capacity_reservations WHERE id = $1 FOR UPDATE`,
      [id],
      client,
    );
    if (!locked[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Reservation not found');
    }
    const current = this.mapReservation(locked[0]);
    if (current.version !== expectedVersion) {
      throw new DomainError(ErrorCode.CONFLICT, 'Reservation version conflict');
    }
    if (current.reservationStatus !== CapacityReservationStatus.HELD) {
      return current;
    }
    const quantities = validateQuantities(current.resourceQuantities);
    await this.adjustInventoryForQuantities(
      current.environmentId,
      quantities as Record<string, number>,
      'release',
      client,
    );
    const rows = await this.q(
      `UPDATE edge_p7_capacity_reservations SET
         reservation_status = 'EXPIRED',
         released_at = NOW(),
         release_reason = 'EXPIRED',
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [id, expectedVersion],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.CONFLICT, 'Reservation expire conflict');
    }
    return this.mapReservation(rows[0]);
  }

  async getReservation(id: string): Promise<CapacityReservationRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_capacity_reservations WHERE id = $1`, [id]);
    return rows[0] ? this.mapReservation(rows[0]) : null;
  }

  async getReservationByIdempotencyKey(key: string): Promise<CapacityReservationRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p7_capacity_reservations WHERE idempotency_key = $1`,
      [key],
    );
    return rows[0] ? this.mapReservation(rows[0]) : null;
  }

  async listReservations(
    filter: PlacementListFilter & {
      placementRequestId?: string;
      environmentId?: string;
      status?: string;
    },
  ): Promise<{ items: CapacityReservationRecord[]; total: number }> {
    const { limit, offset } = this.page(filter);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`reservation_status = $${params.length}`);
    }
    if (filter.placementRequestId) {
      params.push(filter.placementRequestId);
      where.push(`placement_request_id = $${params.length}`);
    }
    if (filter.environmentId) {
      params.push(filter.environmentId);
      where.push(`environment_id = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count = await this.q<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_p7_capacity_reservations ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_capacity_reservations ${clause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapReservation(r)), total: Number(count[0]?.c ?? 0) };
  }

  // ---------------------------------------------------------------------------
  // Policies
  // ---------------------------------------------------------------------------

  async createPolicy(
    input: Omit<PlacementPolicyRecord, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      version?: number;
    },
    client?: unknown,
  ): Promise<PlacementPolicyRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p7_placement_policies (
         code, name, description, policy_version, scope, hard_constraints,
         scoring_weights, algorithm_version, policy_status, created_by, updated_by
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10,$10)
       RETURNING *`,
      [
        input.code,
        input.name,
        input.description,
        input.policyVersion,
        JSON.stringify(input.scope ?? {}),
        JSON.stringify(input.hardConstraints ?? {}),
        JSON.stringify(input.scoringWeights ?? {}),
        input.algorithmVersion,
        input.policyStatus,
        input.createdBy,
      ],
      client,
    );
    return this.mapPolicy(rows[0]!);
  }

  async updatePolicy(
    id: string,
    patch: Partial<PlacementPolicyRecord>,
    expectedVersion: number,
    client?: unknown,
  ): Promise<PlacementPolicyRecord> {
    const rows = await this.q(
      `UPDATE edge_p7_placement_policies SET
         name = COALESCE($3, name),
         description = COALESCE($4, description),
         scope = COALESCE($5::jsonb, scope),
         hard_constraints = COALESCE($6::jsonb, hard_constraints),
         scoring_weights = COALESCE($7::jsonb, scoring_weights),
         algorithm_version = COALESCE($8, algorithm_version),
         policy_status = COALESCE($9, policy_status),
         policy_version = COALESCE($10, policy_version),
         updated_by = COALESCE($11, updated_by),
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1 AND version = $2
       RETURNING *`,
      [
        id,
        expectedVersion,
        patch.name ?? null,
        patch.description ?? null,
        patch.scope ? JSON.stringify(patch.scope) : null,
        patch.hardConstraints ? JSON.stringify(patch.hardConstraints) : null,
        patch.scoringWeights ? JSON.stringify(patch.scoringWeights) : null,
        patch.algorithmVersion ?? null,
        patch.policyStatus ?? null,
        patch.policyVersion ?? null,
        patch.updatedBy ?? null,
      ],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.CONFLICT, 'Placement policy version conflict or not found');
    }
    return this.mapPolicy(rows[0]);
  }

  async getPolicy(id: string): Promise<PlacementPolicyRecord | null> {
    const rows = await this.q(`SELECT * FROM edge_p7_placement_policies WHERE id = $1`, [id]);
    return rows[0] ? this.mapPolicy(rows[0]) : null;
  }

  async getActivePolicy(code?: string): Promise<PlacementPolicyRecord | null> {
    if (code) {
      const rows = await this.q(
        `SELECT * FROM edge_p7_placement_policies
         WHERE code = $1 AND policy_status = 'ACTIVE'
         ORDER BY policy_version DESC LIMIT 1`,
        [code],
      );
      return rows[0] ? this.mapPolicy(rows[0]) : null;
    }
    const rows = await this.q(
      `SELECT * FROM edge_p7_placement_policies
       WHERE policy_status = 'ACTIVE'
       ORDER BY policy_version DESC, updated_at DESC LIMIT 1`,
    );
    return rows[0] ? this.mapPolicy(rows[0]) : null;
  }

  async listPolicies(
    filter: PlacementListFilter,
  ): Promise<{ items: PlacementPolicyRecord[]; total: number }> {
    const { limit, offset } = this.page(filter);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.status) {
      params.push(filter.status);
      where.push(`policy_status = $${params.length}`);
    }
    if (filter.q) {
      params.push(`%${filter.q}%`);
      where.push(`(code ILIKE $${params.length} OR name ILIKE $${params.length})`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count = await this.q<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_p7_placement_policies ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_placement_policies ${clause}
       ORDER BY updated_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapPolicy(r)), total: Number(count[0]?.c ?? 0) };
  }

  // ---------------------------------------------------------------------------
  // History
  // ---------------------------------------------------------------------------

  async appendHistory(
    entry: Omit<PlacementHistoryEntry, 'id' | 'createdAt'>,
    client?: unknown,
  ): Promise<PlacementHistoryEntry> {
    const rows = await this.q(
      `INSERT INTO edge_p7_placement_history (
         resource_type, resource_id, from_status, to_status, action, reason, actor_id, details
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       RETURNING *`,
      [
        entry.resourceType,
        entry.resourceId,
        entry.fromStatus,
        entry.toStatus,
        entry.action,
        entry.reason,
        entry.actorId,
        JSON.stringify(entry.details ?? {}),
      ],
      client,
    );
    return this.mapHistory(rows[0]!);
  }

  async listHistory(
    filter: PlacementListFilter & { resourceType?: string; resourceId?: string },
  ): Promise<{ items: PlacementHistoryEntry[]; total: number }> {
    const { limit, offset } = this.page(filter);
    const params: unknown[] = [];
    const where: string[] = [];
    if (filter.resourceType) {
      params.push(filter.resourceType);
      where.push(`resource_type = $${params.length}`);
    }
    if (filter.resourceId) {
      params.push(filter.resourceId);
      where.push(`resource_id = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count = await this.q<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_p7_placement_history ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p7_placement_history ${clause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapHistory(r)), total: Number(count[0]?.c ?? 0) };
  }
}
