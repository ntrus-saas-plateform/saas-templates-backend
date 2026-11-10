export const WORKFLOW_PLACEMENT_PORT = Symbol('WORKFLOW_PLACEMENT_PORT');

/**
 * Confirmed placement + COMMITTED reservation view for provisioning workflow start.
 * Fail-closed: null when decision is not PLACED, reservation not COMMITTED,
 * expired/superseded, or registry refs incomplete.
 */
export type WorkflowReadyPlacementView = {
  decisionId: string;
  placementRequestId: string;
  decisionStatus: 'PLACED';
  decisionVersion: number;
  reservationId: string;
  reservationStatus: 'COMMITTED';
  selectedPlatformId: string;
  selectedEnvironmentId: string;
  selectedProfileId: string;
  selectedTechnicalVersionId: string;
  selectedContractId: string;
  selectedContractVersion: string | null;
  expiresAt: Date | null;
  correlationId: string;
};

export type WorkflowPlacementRejectReason =
  | 'DECISION_NOT_FOUND'
  | 'DECISION_NOT_PLACED'
  | 'DECISION_EXPIRED'
  | 'DECISION_SUPERSEDED'
  | 'VERSION_MISMATCH'
  | 'RESERVATION_MISSING'
  | 'RESERVATION_NOT_COMMITTED'
  | 'REGISTRY_REFS_INCOMPLETE'
  | 'CORRELATION_MISMATCH';

export type WorkflowPlacementValidationResult =
  | { ok: true; view: WorkflowReadyPlacementView }
  | { ok: false; reason: WorkflowPlacementRejectReason };

/**
 * Fail-closed validation of confirmed P7.3 placement + COMMITTED reservation.
 * No capacity mutation and no infrastructure side effects.
 */
export interface WorkflowPlacementPort {
  getWorkflowReadyPlacement(decisionId: string): Promise<WorkflowReadyPlacementView | null>;

  validateConfirmedPlacement(params: {
    decisionId: string;
    expectedVersion?: number;
    expectedCorrelationId?: string;
  }): Promise<WorkflowPlacementValidationResult>;
}
