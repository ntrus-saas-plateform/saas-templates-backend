import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import { evaluateRegistryCompatibility } from '../../domain/registry/compatibility-engine.js';
import type { RegistryRepositoryPort } from '../../domain/registry/registry-repository.port.js';
import { validateQuantities } from '../../domain/placement/capacity.js';
import type { PlacementAuthorizationViewPort } from '../../domain/placement/placement-authorization-view.port.js';
import { evaluatePlacement } from '../../domain/placement/placement-engine.js';
import type { PlacementRepositoryPort } from '../../domain/placement/placement-repository.port.js';
import {
  createCapacityInventoryUpdatedEvent,
  createCapacityReservationCommittedEvent,
  createCapacityReservationExpiredEvent,
  createCapacityReservationHeldEvent,
  createCapacityReservationReleasedEvent,
  createPlacementDecisionConfirmedEvent,
  createPlacementDecisionEvaluatedEvent,
  createPlacementDecisionSupersededEvent,
  createPlacementPolicyUpdatedEvent,
  createPlacementRequestCancelledEvent,
  createPlacementRequestCreatedEvent,
} from '../../domain/placement/placement.events.js';
import {
  CapacityInventoryStatus,
  CapacityMeasurementSource,
  CapacityReservationStatus,
  PlacementDecisionStatus,
  PlacementHistoryResourceType,
  PlacementPolicyStatus,
  PlacementRequestStatus,
  type CapacityRequirements,
  type PlacementRequestRecord,
} from '../../domain/placement/placement.types.js';
import { EDGE_P7_OUTBOX_TENANT } from '../../domain/provisioning/provisioning.events.js';

const DEFAULT_HOLD_TTL_MS = 30 * 60 * 1000;

async function requireAudit(
  audit: AuditEventRepositoryPort,
  input: {
    eventType: string;
    actorId: string;
    subjectType: string;
    subjectId: string;
    details: Record<string, unknown>;
  },
  client: unknown,
): Promise<void> {
  try {
    await audit.create(input, client);
  } catch (err) {
    throw new DomainError(
      ErrorCode.DEPENDENCY_UNAVAILABLE,
      'Durable audit required for placement mutation',
      [{ eventType: input.eventType }],
      err instanceof Error ? err : undefined,
    );
  }
}

function requireIdempotencyKey(key: string | undefined | null): string {
  const trimmed = key?.trim();
  if (!trimmed) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Idempotency-Key is required');
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// Create placement request
// ---------------------------------------------------------------------------

export class CreatePlacementRequestUseCase {
  constructor(
    private readonly repo: PlacementRepositoryPort,
    private readonly authView: PlacementAuthorizationViewPort,
    private readonly registry: RegistryRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    idempotencyKey: string;
    provisioningRequestId: string;
    productRegistryId: string;
    technicalVersionId: string;
    contractId: string;
    deploymentProfileId: string;
    requestedEnvironmentType: string;
    requestedDeploymentModel: string;
    platformId?: string | null;
    requestedRegion?: string | null;
    dataResidencyConstraints?: Record<string, unknown>;
    securityClassification?: string | null;
    availabilityRequirements?: Record<string, unknown>;
    recoveryRequirements?: Record<string, unknown>;
    capacityRequirements?: CapacityRequirements;
    causationId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
    const existing = await this.repo.getRequestByIdempotencyKey(idempotencyKey);
    if (existing) return existing;

    const auth = await this.authView.getPlacementReadyRequest(input.provisioningRequestId);
    if (!auth) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'Provisioning request is not placement-ready (ACCEPTED+ALLOW+VERIFIED+NOT_REVOKED+unexpired required)',
        [{ provisioningRequestId: input.provisioningRequestId }],
      );
    }

    const product = await this.registry.getProductRegistry(input.productRegistryId);
    if (!product) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'productRegistryId not found');
    }
    const version = await this.registry.getTechnicalVersion(input.technicalVersionId);
    if (!version || version.productRegistryId !== product.id) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'technicalVersionId invalid for product');
    }
    const contract = await this.registry.getContract(input.contractId);
    if (!contract) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'contractId not found');
    }
    const profile = await this.registry.getProfile(input.deploymentProfileId);
    if (!profile) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'deploymentProfileId not found');
    }
    if (input.platformId) {
      const platform = await this.registry.getPlatform(input.platformId);
      if (!platform) {
        throw new DomainError(ErrorCode.VALIDATION_ERROR, 'platformId not found');
      }
    }

    const capacityRequirements = validateQuantities(input.capacityRequirements ?? {});
    const correlationId = auth.correlationId || randomUUID();

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      const again = await this.repo.getRequestByIdempotencyKey(idempotencyKey);
      if (again) return again;

      const record = await this.repo.createRequest(
        {
          idempotencyKey,
          correlationId,
          causationId: input.causationId ?? null,
          // Commercial identity copied from auth view — never trust FE claims
          provisioningRequestId: auth.requestId,
          authorizationRowId: auth.authorizationRowId,
          authorizationId: auth.authorizationId,
          authorizationVersion: auth.authorizationVersion,
          accountId: auth.accountId,
          subscriptionId: auth.subscriptionId,
          productId: auth.productId,
          productTenantId: auth.productTenantId,
          productRegistryId: product.id,
          technicalVersionId: version.id,
          platformId: input.platformId ?? null,
          contractId: contract.id,
          deploymentProfileId: profile.id,
          requestedEnvironmentType: input.requestedEnvironmentType,
          requestedDeploymentModel: input.requestedDeploymentModel,
          requestedRegion: input.requestedRegion ?? null,
          dataResidencyConstraints: input.dataResidencyConstraints ?? {},
          securityClassification: input.securityClassification ?? null,
          availabilityRequirements: input.availabilityRequirements ?? {},
          recoveryRequirements: input.recoveryRequirements ?? {},
          capacityRequirements,
          requestStatus: PlacementRequestStatus.PENDING,
          actorId: input.actorId,
          createdBy: input.actorId,
          updatedBy: input.actorId,
          metadata: input.metadata ?? {},
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: PlacementHistoryResourceType.PLACEMENT_REQUEST,
          resourceId: record.id,
          fromStatus: null,
          toStatus: record.requestStatus,
          action: 'CREATE',
          reason: null,
          actorId: input.actorId,
          details: { provisioningRequestId: auth.requestId },
        },
        client,
      );
      await enqueue(
        createPlacementRequestCreatedEvent({
          actorId: input.actorId,
          correlationId,
          placementRequestId: record.id,
          provisioningRequestId: auth.requestId,
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'placement.request.created',
          actorId: input.actorId,
          subjectType: 'PLACEMENT_REQUEST',
          subjectId: record.id,
          details: { provisioningRequestId: auth.requestId },
        },
        client,
      );
      return record;
    });
  }
}

// ---------------------------------------------------------------------------
// Evaluate
// ---------------------------------------------------------------------------

export class EvaluatePlacementUseCase {
  constructor(
    private readonly repo: PlacementRepositoryPort,
    private readonly registry: RegistryRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    placementRequestId: string;
    policyCode?: string;
    idempotencyKey?: string;
    holdTtlMs?: number;
  }) {
    const request = await this.repo.getRequest(input.placementRequestId);
    if (!request) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Placement request not found');
    }
    if (
      request.requestStatus === PlacementRequestStatus.CANCELLED ||
      request.requestStatus === PlacementRequestStatus.EXPIRED ||
      request.requestStatus === PlacementRequestStatus.SUPERSEDED
    ) {
      throw new DomainError(
        ErrorCode.INVALID_STATE_TRANSITION,
        `Cannot evaluate placement in status ${request.requestStatus}`,
      );
    }

    const idempotencyKey = input.idempotencyKey?.trim()
      ? input.idempotencyKey.trim()
      : `eval:${request.id}:${request.version}`;
    const existingDecision = await this.repo.getDecisionByIdempotencyKey(idempotencyKey);
    if (existingDecision) return { decision: existingDecision, candidates: await this.repo.listCandidates(existingDecision.id) };

    const product = await this.registry.getProductRegistry(request.productRegistryId);
    const version = await this.registry.getTechnicalVersion(request.technicalVersionId);
    const profile = await this.registry.getProfile(request.deploymentProfileId);
    const contract = await this.registry.getContract(request.contractId);
    if (!product || !version || !profile || !contract) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Registry references missing for placement');
    }

    const platforms = request.platformId
      ? [await this.registry.getPlatform(request.platformId)].filter(Boolean)
      : (await this.registry.listPlatforms({ limit: 100, offset: 0 })).items;
    const environments: Awaited<ReturnType<RegistryRepositoryPort['listEnvironments']>>['items'] = [];
    for (const p of platforms) {
      if (!p) continue;
      const envs = await this.registry.listEnvironments({
        platformId: p.id,
        limit: 100,
        offset: 0,
      });
      environments.push(...envs.items);
    }
    const profiles = [profile];
    const contracts = [contract];
    const capacity = await this.repo.listInventory({ limit: 500, offset: 0, status: 'ACTIVE' });
    const policy = await this.repo.getActivePolicy(input.policyCode);

    const now = new Date();
    const engineResult = evaluatePlacement({
      request,
      product,
      version,
      platforms: platforms.filter((p): p is NonNullable<typeof p> => !!p),
      environments,
      profiles,
      contracts,
      capacityRows: capacity.items,
      policy,
      now,
      compatibility: ({ platform, environment, profile: prof, contract: ctr }) =>
        evaluateRegistryCompatibility({
          product,
          technicalVersion: version,
          platform,
          environment,
          profile: prof,
          contract: ctr,
          evaluatedBy: input.actorId,
          correlationId: request.correlationId,
          now,
        }).result,
    });

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      const again = await this.repo.getDecisionByIdempotencyKey(idempotencyKey);
      if (again) {
        return { decision: again, candidates: await this.repo.listCandidates(again.id) };
      }

      let requestVersion = request.version;
      await this.repo.updateRequest(
        request.id,
        {
          requestStatus: PlacementRequestStatus.EVALUATING,
          updatedBy: input.actorId,
          actorId: input.actorId,
        },
        requestVersion,
        client,
      );
      requestVersion += 1;

      let reservationId: string | null = null;
      if (
        engineResult.decisionStatus === PlacementDecisionStatus.PLACED &&
        engineResult.selected
      ) {
        const holdMs = input.holdTtlMs ?? DEFAULT_HOLD_TTL_MS;
        const reservation = await this.repo.reserveCapacityWithLock(
          {
            placementRequestId: request.id,
            placementDecisionId: null,
            platformId: engineResult.selected.platformId,
            environmentId: engineResult.selected.environmentId,
            resourceQuantities: request.capacityRequirements,
            idempotencyKey: `reserve:${idempotencyKey}`,
            expiresAt: new Date(now.getTime() + holdMs),
            createdBy: input.actorId,
          },
          client,
        );
        reservationId = reservation.id;
        await enqueue(
          createCapacityReservationHeldEvent({
            actorId: input.actorId,
            correlationId: request.correlationId,
            reservationId: reservation.id,
            environmentId: reservation.environmentId,
            placementRequestId: request.id,
          }),
        );
      }

      const decision = await this.repo.createDecision(
        {
          placementRequestId: request.id,
          decisionStatus: engineResult.decisionStatus,
          selectedPlatformId: engineResult.selected?.platformId ?? null,
          selectedEnvironmentId: engineResult.selected?.environmentId ?? null,
          selectedProfileId: engineResult.selected?.profileId ?? null,
          selectedRegion: engineResult.selected?.region ?? null,
          selectedTechnicalVersionId: engineResult.selected?.technicalVersionId ?? null,
          selectedContractId: engineResult.selected?.contractId ?? null,
          selectedContractVersion: engineResult.selected?.contractVersion ?? null,
          capacityReservationId: reservationId,
          algorithmName: engineResult.algorithmName,
          algorithmVersion: engineResult.algorithmVersion,
          policyId: engineResult.policyId,
          policyVersion: engineResult.policyVersion,
          evaluationSnapshot: engineResult.evaluationSnapshot,
          scoringBreakdown: engineResult.scoringBreakdown,
          policyEvaluationSnapshot: engineResult.policyEvaluationSnapshot,
          rejectionSummary: engineResult.rejectionSummary,
          decidedAt: now,
          expiresAt: reservationId
            ? new Date(now.getTime() + (input.holdTtlMs ?? DEFAULT_HOLD_TTL_MS))
            : null,
          actorId: input.actorId,
          correlationId: request.correlationId,
          idempotencyKey,
        },
        client,
      );

      if (reservationId) {
        // Link reservation → decision (best-effort via decision already holding id)
        await this.repo.updateDecision(
          decision.id,
          { capacityReservationId: reservationId },
          decision.version,
          client,
        );
      }

      const candidates = await this.repo.saveCandidates(
        engineResult.candidates.map((c, idx) => ({
          decisionId: decision.id,
          placementRequestId: request.id,
          platformId: c.platformId,
          environmentId: c.environmentId,
          profileId: c.profileId,
          rank: c.rank ?? idx + 1,
          passedHardConstraints: c.passedHardConstraints,
          hardConstraintFailures: c.hardConstraintFailures,
          compatibilityResult: c.compatibilityResult,
          score: c.score,
          scoringBreakdown: c.scoringBreakdown,
          capacitySnapshot: c.capacitySnapshot,
          excluded: c.excluded,
          exclusionReason: c.exclusionReason,
        })),
        client,
      );

      const nextStatus =
        engineResult.decisionStatus === PlacementDecisionStatus.PLACED
          ? PlacementRequestStatus.PLACED
          : engineResult.decisionStatus === PlacementDecisionStatus.REQUIRES_REVIEW
            ? PlacementRequestStatus.REQUIRES_REVIEW
            : engineResult.decisionStatus === PlacementDecisionStatus.NO_CAPACITY
              ? PlacementRequestStatus.NO_CAPACITY
              : PlacementRequestStatus.NO_COMPATIBLE_TARGET;

      await this.repo.updateRequest(
        request.id,
        {
          requestStatus: nextStatus,
          updatedBy: input.actorId,
          actorId: input.actorId,
        },
        requestVersion,
        client,
      );

      await this.repo.appendHistory(
        {
          resourceType: PlacementHistoryResourceType.PLACEMENT_DECISION,
          resourceId: decision.id,
          fromStatus: null,
          toStatus: decision.decisionStatus,
          action: 'EVALUATE',
          reason: engineResult.rejectionSummary,
          actorId: input.actorId,
          details: {
            placementRequestId: request.id,
            reservationId,
            candidateCount: candidates.length,
          },
        },
        client,
      );
      await enqueue(
        createPlacementDecisionEvaluatedEvent({
          actorId: input.actorId,
          correlationId: request.correlationId,
          decisionId: decision.id,
          placementRequestId: request.id,
          decisionStatus: decision.decisionStatus,
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'placement.decision.evaluated',
          actorId: input.actorId,
          subjectType: 'PLACEMENT_DECISION',
          subjectId: decision.id,
          details: {
            placementRequestId: request.id,
            decisionStatus: decision.decisionStatus,
            reservationId,
          },
        },
        client,
      );

      const finalDecision = await this.repo.getDecision(decision.id);
      return { decision: finalDecision ?? decision, candidates };
    });
  }
}

// ---------------------------------------------------------------------------
// Confirm (no P7.4)
// ---------------------------------------------------------------------------

export class ConfirmPlacementUseCase {
  constructor(
    private readonly repo: PlacementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; placementRequestId: string; decisionId?: string }) {
    const request = await this.repo.getRequest(input.placementRequestId);
    if (!request) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Placement request not found');
    }
    if (request.requestStatus !== PlacementRequestStatus.PLACED) {
      throw new DomainError(
        ErrorCode.INVALID_STATE_TRANSITION,
        'Only PLACED requests can be confirmed',
      );
    }

    const decisions = await this.repo.listDecisions({
      placementRequestId: request.id,
      status: PlacementDecisionStatus.PLACED,
      limit: 10,
      offset: 0,
    });
    const decision =
      (input.decisionId
        ? decisions.items.find((d) => d.id === input.decisionId)
        : decisions.items[0]) ?? null;
    if (!decision) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'PLACED decision not found');
    }
    if (!decision.capacityReservationId) {
      throw new DomainError(ErrorCode.INVALID_STATE_TRANSITION, 'Decision has no reservation to commit');
    }

    const reservation = await this.repo.getReservation(decision.capacityReservationId);
    if (!reservation) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Reservation not found');
    }

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      const committed = await this.repo.commitReservation(
        reservation.id,
        reservation.version,
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: PlacementHistoryResourceType.CAPACITY_RESERVATION,
          resourceId: committed.id,
          fromStatus: CapacityReservationStatus.HELD,
          toStatus: CapacityReservationStatus.COMMITTED,
          action: 'CONFIRM',
          reason: null,
          actorId: input.actorId,
          details: { decisionId: decision.id, placementRequestId: request.id },
        },
        client,
      );
      await enqueue(
        createCapacityReservationCommittedEvent({
          actorId: input.actorId,
          correlationId: request.correlationId,
          reservationId: committed.id,
        }),
      );
      await enqueue(
        createPlacementDecisionConfirmedEvent({
          actorId: input.actorId,
          correlationId: request.correlationId,
          decisionId: decision.id,
          placementRequestId: request.id,
          reservationId: committed.id,
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'placement.decision.confirmed',
          actorId: input.actorId,
          subjectType: 'PLACEMENT_DECISION',
          subjectId: decision.id,
          details: { reservationId: committed.id },
        },
        client,
      );
      // Explicit: no P7.4 workflow side effects here.
      return { decision, reservation: committed, request };
    });
  }
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

export class CancelPlacementUseCase {
  constructor(
    private readonly repo: PlacementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    placementRequestId: string;
    reason?: string | null;
  }) {
    const request = await this.repo.getRequest(input.placementRequestId);
    if (!request) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Placement request not found');
    }
    if (
      request.requestStatus === PlacementRequestStatus.CANCELLED ||
      request.requestStatus === PlacementRequestStatus.SUPERSEDED
    ) {
      return request;
    }

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      const reservations = await this.repo.listReservations({
        placementRequestId: request.id,
        status: CapacityReservationStatus.HELD,
        limit: 50,
        offset: 0,
      });
      for (const reservation of reservations.items) {
        await this.repo.releaseReservation(
          reservation.id,
          input.reason ?? 'CANCELLED',
          reservation.version,
          client,
        );
        await enqueue(
          createCapacityReservationReleasedEvent({
            actorId: input.actorId,
            correlationId: request.correlationId,
            reservationId: reservation.id,
            reason: input.reason ?? 'CANCELLED',
          }),
        );
      }

      const updated = await this.repo.updateRequest(
        request.id,
        {
          requestStatus: PlacementRequestStatus.CANCELLED,
          updatedBy: input.actorId,
          actorId: input.actorId,
        },
        request.version,
        client,
      );

      const decisions = await this.repo.listDecisions({
        placementRequestId: request.id,
        limit: 20,
        offset: 0,
      });
      for (const d of decisions.items) {
        if (
          d.decisionStatus === PlacementDecisionStatus.SUPERSEDED ||
          d.decisionStatus === PlacementDecisionStatus.CANCELLED
        ) {
          continue;
        }
        await this.repo.updateDecision(
          d.id,
          { decisionStatus: PlacementDecisionStatus.CANCELLED, actorId: input.actorId },
          d.version,
          client,
        );
      }

      await this.repo.appendHistory(
        {
          resourceType: PlacementHistoryResourceType.PLACEMENT_REQUEST,
          resourceId: request.id,
          fromStatus: request.requestStatus,
          toStatus: PlacementRequestStatus.CANCELLED,
          action: 'CANCEL',
          reason: input.reason ?? null,
          actorId: input.actorId,
          details: {},
        },
        client,
      );
      await enqueue(
        createPlacementRequestCancelledEvent({
          actorId: input.actorId,
          correlationId: request.correlationId,
          placementRequestId: request.id,
          reason: input.reason ?? null,
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'placement.request.cancelled',
          actorId: input.actorId,
          subjectType: 'PLACEMENT_REQUEST',
          subjectId: request.id,
          details: { reason: input.reason ?? null },
        },
        client,
      );
      return updated;
    });
  }
}

// ---------------------------------------------------------------------------
// Release / Expire reservation
// ---------------------------------------------------------------------------

export class ReleaseReservationUseCase {
  constructor(
    private readonly repo: PlacementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    reservationId: string;
    reason?: string;
    expectedVersion: number;
  }) {
    const reservation = await this.repo.getReservation(input.reservationId);
    if (!reservation) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Reservation not found');
    }
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      const released = await this.repo.releaseReservation(
        reservation.id,
        input.reason ?? 'RELEASED',
        input.expectedVersion,
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: PlacementHistoryResourceType.CAPACITY_RESERVATION,
          resourceId: released.id,
          fromStatus: reservation.reservationStatus,
          toStatus: released.reservationStatus,
          action: 'RELEASE',
          reason: input.reason ?? 'RELEASED',
          actorId: input.actorId,
          details: {},
        },
        client,
      );
      await enqueue(
        createCapacityReservationReleasedEvent({
          actorId: input.actorId,
          correlationId: randomUUID(),
          reservationId: released.id,
          reason: input.reason ?? 'RELEASED',
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'capacity.reservation.released',
          actorId: input.actorId,
          subjectType: 'CAPACITY_RESERVATION',
          subjectId: released.id,
          details: { reason: input.reason ?? 'RELEASED' },
        },
        client,
      );
      return released;
    });
  }
}

export class ExpireReservationUseCase {
  constructor(
    private readonly repo: PlacementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    reservationId: string;
    expectedVersion: number;
  }) {
    const reservation = await this.repo.getReservation(input.reservationId);
    if (!reservation) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Reservation not found');
    }
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      const expired = await this.repo.expireReservation(
        reservation.id,
        input.expectedVersion,
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: PlacementHistoryResourceType.CAPACITY_RESERVATION,
          resourceId: expired.id,
          fromStatus: reservation.reservationStatus,
          toStatus: expired.reservationStatus,
          action: 'EXPIRE',
          reason: 'EXPIRED',
          actorId: input.actorId,
          details: {},
        },
        client,
      );
      await enqueue(
        createCapacityReservationExpiredEvent({
          actorId: input.actorId,
          correlationId: randomUUID(),
          reservationId: expired.id,
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'capacity.reservation.expired',
          actorId: input.actorId,
          subjectType: 'CAPACITY_RESERVATION',
          subjectId: expired.id,
          details: {},
        },
        client,
      );
      return expired;
    });
  }
}

// ---------------------------------------------------------------------------
// Re-evaluate / Supersede
// ---------------------------------------------------------------------------

export class SupersedeDecisionUseCase {
  constructor(
    private readonly repo: PlacementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: { actorId: string; decisionId: string; reason?: string | null }) {
    const decision = await this.repo.getDecision(input.decisionId);
    if (!decision) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Decision not found');
    }
    if (decision.decisionStatus === PlacementDecisionStatus.SUPERSEDED) {
      return decision;
    }
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      if (decision.capacityReservationId) {
        const reservation = await this.repo.getReservation(decision.capacityReservationId);
        if (reservation?.reservationStatus === CapacityReservationStatus.HELD) {
          await this.repo.releaseReservation(
            reservation.id,
            input.reason ?? 'SUPERSEDED',
            reservation.version,
            client,
          );
          await enqueue(
            createCapacityReservationReleasedEvent({
              actorId: input.actorId,
              correlationId: decision.correlationId,
              reservationId: reservation.id,
              reason: input.reason ?? 'SUPERSEDED',
            }),
          );
        }
      }
      const updated = await this.repo.updateDecision(
        decision.id,
        {
          decisionStatus: PlacementDecisionStatus.SUPERSEDED,
          actorId: input.actorId,
          rejectionSummary: input.reason ?? decision.rejectionSummary,
        },
        decision.version,
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: PlacementHistoryResourceType.PLACEMENT_DECISION,
          resourceId: decision.id,
          fromStatus: decision.decisionStatus,
          toStatus: PlacementDecisionStatus.SUPERSEDED,
          action: 'SUPERSEDE',
          reason: input.reason ?? null,
          actorId: input.actorId,
          details: {},
        },
        client,
      );
      await enqueue(
        createPlacementDecisionSupersededEvent({
          actorId: input.actorId,
          correlationId: decision.correlationId,
          decisionId: decision.id,
          placementRequestId: decision.placementRequestId,
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'placement.decision.superseded',
          actorId: input.actorId,
          subjectType: 'PLACEMENT_DECISION',
          subjectId: decision.id,
          details: { reason: input.reason ?? null },
        },
        client,
      );
      return updated;
    });
  }
}

export class ReEvaluatePlacementUseCase {
  constructor(
    private readonly evaluate: EvaluatePlacementUseCase,
    private readonly supersede: SupersedeDecisionUseCase,
    private readonly repo: PlacementRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    placementRequestId: string;
    policyCode?: string;
    idempotencyKey: string;
  }) {
    const decisions = await this.repo.listDecisions({
      placementRequestId: input.placementRequestId,
      limit: 20,
      offset: 0,
    });
    for (const d of decisions.items) {
      if (
        d.decisionStatus !== PlacementDecisionStatus.SUPERSEDED &&
        d.decisionStatus !== PlacementDecisionStatus.CANCELLED
      ) {
        await this.supersede.execute({
          actorId: input.actorId,
          decisionId: d.id,
          reason: 'RE_EVALUATE',
        });
      }
    }
    return this.evaluate.execute({
      actorId: input.actorId,
      placementRequestId: input.placementRequestId,
      policyCode: input.policyCode,
      idempotencyKey: requireIdempotencyKey(input.idempotencyKey),
    });
  }
}

// ---------------------------------------------------------------------------
// Capacity inventory upsert / patch
// ---------------------------------------------------------------------------

export class UpsertCapacityInventoryUseCase {
  constructor(
    private readonly repo: PlacementRepositoryPort,
    private readonly registry: RegistryRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    platformId: string;
    environmentId: string;
    resourceType: string;
    unit: string;
    totalCapacity: number;
    unavailableCapacity?: number;
    measurementSource?: string;
    measuredAt?: Date;
    validUntil: Date;
    capacityStatus?: string;
    metadata?: Record<string, unknown>;
  }) {
    const platform = await this.registry.getPlatform(input.platformId);
    if (!platform) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'platformId not found');
    }
    const environment = await this.registry.getEnvironment(input.environmentId);
    if (!environment || environment.platformId !== input.platformId) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'environmentId invalid for platform');
    }

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      const existing = await this.repo.listInventory({
        platformId: input.platformId,
        environmentId: input.environmentId,
        resourceType: input.resourceType,
        limit: 5,
        offset: 0,
      });
      const match = existing.items.find(
        (i) =>
          i.measurementSource ===
          (input.measurementSource ?? CapacityMeasurementSource.DECLARED),
      );

      let record;
      if (match) {
        record = await this.repo.updateInventory(
          match.id,
          {
            totalCapacity: input.totalCapacity,
            unavailableCapacity: input.unavailableCapacity ?? match.unavailableCapacity,
            unit: input.unit,
            measuredAt: input.measuredAt ?? new Date(),
            validUntil: input.validUntil,
            capacityStatus:
              (input.capacityStatus as CapacityInventoryStatus) ?? match.capacityStatus,
            metadata: input.metadata ?? match.metadata,
            updatedBy: input.actorId,
          },
          match.version,
          client,
        );
      } else {
        record = await this.repo.createInventory(
          {
            platformId: input.platformId,
            environmentId: input.environmentId,
            resourceType: input.resourceType,
            unit: input.unit,
            totalCapacity: input.totalCapacity,
            unavailableCapacity: input.unavailableCapacity ?? 0,
            reservedCapacity: 0,
            allocatedCapacity: 0,
            measurementSource:
              (input.measurementSource as CapacityMeasurementSource) ??
              CapacityMeasurementSource.DECLARED,
            measuredAt: input.measuredAt ?? new Date(),
            validUntil: input.validUntil,
            capacityStatus:
              (input.capacityStatus as CapacityInventoryStatus) ?? CapacityInventoryStatus.ACTIVE,
            metadata: input.metadata ?? {},
            createdBy: input.actorId,
            updatedBy: input.actorId,
          },
          client,
        );
      }

      await this.repo.appendHistory(
        {
          resourceType: PlacementHistoryResourceType.CAPACITY_INVENTORY,
          resourceId: record.id,
          fromStatus: match?.capacityStatus ?? null,
          toStatus: String(record.capacityStatus),
          action: match ? 'UPDATE' : 'CREATE',
          reason: null,
          actorId: input.actorId,
          details: { resourceType: record.resourceType },
        },
        client,
      );
      await enqueue(
        createCapacityInventoryUpdatedEvent({
          actorId: input.actorId,
          correlationId: randomUUID(),
          inventoryId: record.id,
          environmentId: record.environmentId,
          resourceType: String(record.resourceType),
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'capacity.inventory.updated',
          actorId: input.actorId,
          subjectType: 'CAPACITY_INVENTORY',
          subjectId: record.id,
          details: { resourceType: record.resourceType },
        },
        client,
      );
      return record;
    });
  }
}

export class PatchCapacityInventoryUseCase {
  constructor(
    private readonly repo: PlacementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    id: string;
    expectedVersion: number;
    patch: Partial<{
      totalCapacity: number;
      unavailableCapacity: number;
      unit: string;
      measuredAt: Date;
      validUntil: Date;
      capacityStatus: string;
      metadata: Record<string, unknown>;
    }>;
  }) {
    const current = await this.repo.getInventory(input.id);
    if (!current) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Capacity inventory not found');
    }
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      const record = await this.repo.updateInventory(
        input.id,
        {
          ...input.patch,
          capacityStatus: input.patch.capacityStatus as CapacityInventoryStatus | undefined,
          updatedBy: input.actorId,
        },
        input.expectedVersion,
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: PlacementHistoryResourceType.CAPACITY_INVENTORY,
          resourceId: record.id,
          fromStatus: String(current.capacityStatus),
          toStatus: String(record.capacityStatus),
          action: 'PATCH',
          reason: null,
          actorId: input.actorId,
          details: input.patch as Record<string, unknown>,
        },
        client,
      );
      await enqueue(
        createCapacityInventoryUpdatedEvent({
          actorId: input.actorId,
          correlationId: randomUUID(),
          inventoryId: record.id,
          environmentId: record.environmentId,
          resourceType: String(record.resourceType),
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'capacity.inventory.patched',
          actorId: input.actorId,
          subjectType: 'CAPACITY_INVENTORY',
          subjectId: record.id,
          details: {},
        },
        client,
      );
      return record;
    });
  }
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

export class CreatePlacementPolicyUseCase {
  constructor(
    private readonly repo: PlacementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name: string;
    description?: string | null;
    policyVersion?: number;
    scope?: Record<string, unknown>;
    hardConstraints?: Record<string, unknown>;
    scoringWeights?: Record<string, unknown>;
    algorithmVersion?: string;
    policyStatus?: PlacementPolicyStatus;
  }) {
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      const record = await this.repo.createPolicy(
        {
          code: input.code.trim(),
          name: input.name.trim(),
          description: input.description ?? null,
          policyVersion: input.policyVersion ?? 1,
          scope: input.scope ?? {},
          hardConstraints: input.hardConstraints ?? {},
          scoringWeights: input.scoringWeights ?? {},
          algorithmVersion: input.algorithmVersion ?? '1.0.0',
          policyStatus: input.policyStatus ?? PlacementPolicyStatus.DRAFT,
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: PlacementHistoryResourceType.PLACEMENT_POLICY,
          resourceId: record.id,
          fromStatus: null,
          toStatus: record.policyStatus,
          action: 'CREATE',
          reason: null,
          actorId: input.actorId,
          details: { code: record.code },
        },
        client,
      );
      await enqueue(
        createPlacementPolicyUpdatedEvent({
          actorId: input.actorId,
          correlationId: randomUUID(),
          policyId: record.id,
          code: record.code,
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'placement.policy.created',
          actorId: input.actorId,
          subjectType: 'PLACEMENT_POLICY',
          subjectId: record.id,
          details: { code: record.code },
        },
        client,
      );
      return record;
    });
  }
}

export class PatchPlacementPolicyUseCase {
  constructor(
    private readonly repo: PlacementRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    id: string;
    expectedVersion: number;
    patch: Partial<{
      name: string;
      description: string | null;
      scope: Record<string, unknown>;
      hardConstraints: Record<string, unknown>;
      scoringWeights: Record<string, unknown>;
      algorithmVersion: string;
      policyStatus: PlacementPolicyStatus;
      policyVersion: number;
    }>;
  }) {
    const current = await this.repo.getPolicy(input.id);
    if (!current) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Placement policy not found');
    }
    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client, enqueue) => {
      const record = await this.repo.updatePolicy(
        input.id,
        { ...input.patch, updatedBy: input.actorId },
        input.expectedVersion,
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: PlacementHistoryResourceType.PLACEMENT_POLICY,
          resourceId: record.id,
          fromStatus: current.policyStatus,
          toStatus: record.policyStatus,
          action: 'PATCH',
          reason: null,
          actorId: input.actorId,
          details: {},
        },
        client,
      );
      await enqueue(
        createPlacementPolicyUpdatedEvent({
          actorId: input.actorId,
          correlationId: randomUUID(),
          policyId: record.id,
          code: record.code,
        }),
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'placement.policy.patched',
          actorId: input.actorId,
          subjectType: 'PLACEMENT_POLICY',
          subjectId: record.id,
          details: {},
        },
        client,
      );
      return record;
    });
  }
}

// ---------------------------------------------------------------------------
// List / get helpers
// ---------------------------------------------------------------------------

export class ListPlacementResourcesUseCase {
  constructor(private readonly repo: PlacementRepositoryPort) {}

  listRequests(filter: { limit?: number; offset?: number; status?: string; q?: string }) {
    return this.repo.listRequests(filter);
  }

  getRequest(id: string) {
    return this.repo.getRequest(id);
  }

  getDecision(id: string) {
    return this.repo.getDecision(id);
  }

  listCandidates(decisionId: string) {
    return this.repo.listCandidates(decisionId);
  }

  listHistory(filter: {
    limit?: number;
    offset?: number;
    resourceType?: string;
    resourceId?: string;
  }) {
    return this.repo.listHistory(filter);
  }

  listInventory(filter: {
    limit?: number;
    offset?: number;
    platformId?: string;
    environmentId?: string;
    resourceType?: string;
    status?: string;
  }) {
    return this.repo.listInventory(filter);
  }

  listReservations(filter: {
    limit?: number;
    offset?: number;
    placementRequestId?: string;
    environmentId?: string;
    status?: string;
  }) {
    return this.repo.listReservations(filter);
  }

  getReservation(id: string) {
    return this.repo.getReservation(id);
  }

  listPolicies(filter: { limit?: number; offset?: number; status?: string; q?: string }) {
    return this.repo.listPolicies(filter);
  }

  getPolicy(id: string) {
    return this.repo.getPolicy(id);
  }
}
