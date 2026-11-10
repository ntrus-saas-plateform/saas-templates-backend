import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  InfrastructureErrorCode,
  ResourceStatus,
  type DatabaseResourceRecord,
  type InfrastructureResourceRecord,
} from './infrastructure.types.js';

export type CompensationAssessment = {
  safe: boolean;
  reason: string;
  code?: InfrastructureErrorCode;
  requireIntervention: boolean;
};

/**
 * Compensation must never auto-delete when outcome is ambiguous or data may exist.
 */
export function assessCompensationSafety(args: {
  resource: Pick<
    InfrastructureResourceRecord,
    'status' | 'deletionProtection' | 'driftStatus' | 'evidence'
  >;
  database?: Pick<
    DatabaseResourceRecord,
    'status' | 'isolationVerified' | 'connectivityVerified' | 'evidence'
  > | null;
  referencedByActiveResources?: boolean;
  unresolvedReconciliation?: boolean;
  deprovisionAuthorized?: boolean;
}): CompensationAssessment {
  if (!args.deprovisionAuthorized) {
    return {
      safe: false,
      requireIntervention: true,
      code: InfrastructureErrorCode.DEPROVISION_FORBIDDEN,
      reason: 'Deprovision authorization missing',
    };
  }
  if (args.resource.deletionProtection) {
    return {
      safe: false,
      requireIntervention: true,
      code: InfrastructureErrorCode.UNSAFE_COMPENSATION,
      reason: 'Deletion protection enabled',
    };
  }
  if (
    args.resource.status === ResourceStatus.UNKNOWN ||
    args.resource.status === ResourceStatus.RECONCILIATION_REQUIRED ||
    args.resource.status === ResourceStatus.PROVISIONING
  ) {
    return {
      safe: false,
      requireIntervention: true,
      code: InfrastructureErrorCode.UNKNOWN_OUTCOME,
      reason: `Resource state ${args.resource.status} is ambiguous`,
    };
  }
  if (args.unresolvedReconciliation) {
    return {
      safe: false,
      requireIntervention: true,
      code: InfrastructureErrorCode.DRIFT_DETECTED,
      reason: 'Unresolved reconciliation blocks compensation',
    };
  }
  if (args.referencedByActiveResources) {
    return {
      safe: false,
      requireIntervention: true,
      code: InfrastructureErrorCode.UNSAFE_COMPENSATION,
      reason: 'Resource is referenced by other active resources',
    };
  }
  const mayContainData =
    args.database?.connectivityVerified === true ||
    args.resource.status === ResourceStatus.READY ||
    Boolean((args.database?.evidence as { dataWritten?: boolean } | undefined)?.dataWritten);
  if (mayContainData) {
    return {
      safe: false,
      requireIntervention: true,
      code: InfrastructureErrorCode.UNSAFE_COMPENSATION,
      reason: 'Resource may contain tenant data; suspend saga for controlled intervention',
    };
  }
  return {
    safe: true,
    requireIntervention: false,
    reason: 'Compensation assessed as safe',
  };
}

export function assertCompensationSafe(assessment: CompensationAssessment): void {
  if (!assessment.safe) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      assessment.reason,
      [{ code: assessment.code ?? InfrastructureErrorCode.UNSAFE_COMPENSATION }],
    );
  }
}
