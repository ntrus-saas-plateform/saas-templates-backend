import {
  ActivationRecordStatus,
  ReadinessCheckStatus,
  ReadinessEvaluationStatus,
  type ReadinessCheckRecord,
} from './activation.types.js';

export type AggregateReadinessResult = {
  evaluationStatus: ReadinessEvaluationStatus;
  activationStatus: ActivationRecordStatus | null;
  overallScore: number;
  blockingCodes: string[];
  requiredPassed: number;
  requiredTotal: number;
  ready: boolean;
};

/**
 * Aggregate required readiness checks into evaluation + activation readiness.
 * All required checks must be PASSED for READY; otherwise NOT_READY.
 * READY_FOR_ACTIVATION is only proposed when evaluation is READY.
 */
export function aggregateReadinessChecks(
  checks: ReadonlyArray<Pick<ReadinessCheckRecord, 'checkCode' | 'checkStatus' | 'required'>>,
): AggregateReadinessResult {
  const required = checks.filter((c) => c.required);
  const blockingCodes: string[] = [];
  let requiredPassed = 0;

  for (const check of required) {
    if (check.checkStatus === ReadinessCheckStatus.PASSED) {
      requiredPassed += 1;
    } else if (
      check.checkStatus === ReadinessCheckStatus.FAILED ||
      check.checkStatus === ReadinessCheckStatus.BLOCKED ||
      check.checkStatus === ReadinessCheckStatus.ERROR ||
      check.checkStatus === ReadinessCheckStatus.PENDING
    ) {
      blockingCodes.push(check.checkCode);
    } else if (check.checkStatus === ReadinessCheckStatus.SKIPPED) {
      // Skipped required checks still block readiness (fail-closed).
      blockingCodes.push(check.checkCode);
    } else {
      blockingCodes.push(check.checkCode);
    }
  }

  const requiredTotal = required.length;
  const overallScore =
    requiredTotal === 0 ? 0 : Math.round((requiredPassed / requiredTotal) * 10000) / 100;
  const ready = requiredTotal > 0 && blockingCodes.length === 0 && requiredPassed === requiredTotal;

  return {
    evaluationStatus: ready
      ? ReadinessEvaluationStatus.READY
      : ReadinessEvaluationStatus.NOT_READY,
    activationStatus: ready ? ActivationRecordStatus.READY_FOR_ACTIVATION : null,
    overallScore,
    blockingCodes,
    requiredPassed,
    requiredTotal,
    ready,
  };
}

export function mapCheckCodeToPhase(checkCode: string): string {
  switch (checkCode) {
    case 'auth.p71_revalidated':
      return 'P71_AUTH';
    case 'infra.resources_ready':
      return 'P76_INFRA';
    case 'keycloak.topology_verified':
      return 'P77_KEYCLOAK';
    case 'configuration.deployed':
      return 'P78_CONFIGURATION';
    case 'entitlements.deployed':
      return 'P78_ENTITLEMENTS';
    case 'experience.ready':
      return 'P79_EXPERIENCE';
    case 'product_control.reachable':
      return 'P75_PRODUCT_CONTROL';
    case 'aggregate.ready':
      return 'AGGREGATE';
    default:
      return 'OTHER';
  }
}
