import { Inject, Injectable } from '@nestjs/common';
import {
  WORKFLOW_PLACEMENT_PORT,
  type WorkflowPlacementPort,
  type WorkflowPlacementValidationResult,
  type WorkflowReadyPlacementView,
} from '../../domain/workflow/workflow-placement.port.js';
import {
  PLACEMENT_REPOSITORY_PORT,
  type PlacementRepositoryPort,
} from '../../domain/placement/placement-repository.port.js';
import {
  CapacityReservationStatus,
  PlacementDecisionStatus,
} from '../../domain/placement/placement.types.js';

@Injectable()
export class PgWorkflowPlacementAdapter implements WorkflowPlacementPort {
  constructor(
    @Inject(PLACEMENT_REPOSITORY_PORT)
    private readonly placement: PlacementRepositoryPort,
  ) {}

  async getWorkflowReadyPlacement(
    decisionId: string,
  ): Promise<WorkflowReadyPlacementView | null> {
    const decision = await this.placement.getDecision(decisionId);
    if (!decision) return null;
    if (decision.decisionStatus !== PlacementDecisionStatus.PLACED) return null;
    if (decision.expiresAt && decision.expiresAt.getTime() <= Date.now()) return null;
    if (!decision.capacityReservationId) return null;
    if (
      !decision.selectedPlatformId ||
      !decision.selectedEnvironmentId ||
      !decision.selectedProfileId ||
      !decision.selectedTechnicalVersionId ||
      !decision.selectedContractId
    ) {
      return null;
    }

    const reservation = await this.placement.getReservation(decision.capacityReservationId);
    if (!reservation) return null;
    // Provisioning workflow start requires COMMITTED reservation (fail-closed).
    if (reservation.reservationStatus !== CapacityReservationStatus.COMMITTED) {
      return null;
    }

    return {
      decisionId: decision.id,
      placementRequestId: decision.placementRequestId,
      decisionStatus: 'PLACED',
      decisionVersion: decision.version,
      reservationId: reservation.id,
      reservationStatus: 'COMMITTED',
      selectedPlatformId: decision.selectedPlatformId,
      selectedEnvironmentId: decision.selectedEnvironmentId,
      selectedProfileId: decision.selectedProfileId,
      selectedTechnicalVersionId: decision.selectedTechnicalVersionId,
      selectedContractId: decision.selectedContractId,
      selectedContractVersion: decision.selectedContractVersion,
      expiresAt: decision.expiresAt,
      correlationId: decision.correlationId,
    };
  }

  async validateConfirmedPlacement(params: {
    decisionId: string;
    expectedVersion?: number;
    expectedCorrelationId?: string;
  }): Promise<WorkflowPlacementValidationResult> {
    const view = await this.getWorkflowReadyPlacement(params.decisionId);
    if (!view) {
      const decision = await this.placement.getDecision(params.decisionId);
      if (!decision) return { ok: false, reason: 'DECISION_NOT_FOUND' };
      if (decision.decisionStatus !== PlacementDecisionStatus.PLACED) {
        return { ok: false, reason: 'DECISION_NOT_PLACED' };
      }
      if (decision.expiresAt && decision.expiresAt.getTime() <= Date.now()) {
        return { ok: false, reason: 'DECISION_EXPIRED' };
      }
      if (!decision.capacityReservationId) {
        return { ok: false, reason: 'RESERVATION_MISSING' };
      }
      const reservation = await this.placement.getReservation(decision.capacityReservationId);
      if (!reservation || reservation.reservationStatus !== CapacityReservationStatus.COMMITTED) {
        return { ok: false, reason: 'RESERVATION_NOT_COMMITTED' };
      }
      return { ok: false, reason: 'REGISTRY_REFS_INCOMPLETE' };
    }
    if (
      params.expectedVersion != null &&
      params.expectedVersion !== view.decisionVersion
    ) {
      return { ok: false, reason: 'VERSION_MISMATCH' };
    }
    if (
      params.expectedCorrelationId &&
      params.expectedCorrelationId !== view.correlationId
    ) {
      return { ok: false, reason: 'CORRELATION_MISMATCH' };
    }
    return { ok: true, view };
  }
}

export { WORKFLOW_PLACEMENT_PORT };
