import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { ConfigurationRepositoryPort } from '../../domain/configuration-entitlement/configuration-repository.port.js';
import {
  AssignmentStatus,
  EntitlementDeploymentStatus,
} from '../../domain/configuration-entitlement/configuration.types.js';
import type { ExperienceRepositoryPort } from '../../domain/product-experience/experience-repository.port.js';
import { ExperienceAssignmentStatus } from '../../domain/product-experience/experience.types.js';
import type { InfrastructureRepositoryPort } from '../../domain/infrastructure-provisioning/infrastructure-repository.port.js';
import {
  ResourcePlanStatus,
  ResourceStatus,
} from '../../domain/infrastructure-provisioning/infrastructure.types.js';
import type { KeycloakRepositoryPort } from '../../domain/keycloak-topology/keycloak-repository.port.js';
import { KeycloakTopologyStatus } from '../../domain/keycloak-topology/keycloak.types.js';
import type { ProductControlRepositoryPort } from '../../domain/product-control/product-control-repository.port.js';
import { ProductControlEndpointStatus } from '../../domain/product-control/product-control.types.js';
import type { SubscriptionRepositoryPort } from '../../domain/ports/subscription-repository.port.js';
import {
  createProvisioningCompletedEvent,
  EDGE_SUBSCRIPTION_OUTBOX_TENANT,
} from '../../domain/subscription/subscription.events.js';
import type { ActivationLiveExecutor } from '../../domain/readiness-activation/activation-handlers.js';
import {
  aggregateReadinessChecks,
  mapCheckCodeToPhase,
} from '../../domain/readiness-activation/activation-policy.js';
import type { ActivationRepositoryPort } from '../../domain/readiness-activation/activation-repository.port.js';
import {
  ActivationErrorCode,
  ActivationRecordStatus,
  ReadinessCheckStatus,
  ReadinessEvaluationStatus,
  type ActivationAllHandlerKey,
  type ActivationRecordRecord,
  type TenantReadinessEvaluationRecord,
} from '../../domain/readiness-activation/activation.types.js';
import type {
  WorkflowAuthorizationPort,
  WorkflowReadyAuthorizationView,
} from '../../domain/workflow/workflow-authorization.port.js';
import type {
  LeaseValidationResult,
  WorkflowLeasePort,
} from '../../domain/workflow/workflow-lease.port.js';
import type {
  WorkflowHandlerInput,
  WorkflowHandlerOutcome,
} from '../../domain/workflow/workflow-handler.port.js';

const AUTHORIZATION_TIMEOUT_MS = 5_000;

type InfraPort = Pick<InfrastructureRepositoryPort, 'listPlans' | 'listInfrastructureResources'> | {
  listPlans: InfrastructureRepositoryPort['listPlans'];
  listResources?: InfrastructureRepositoryPort['listInfrastructureResources'];
  listInfrastructureResources?: InfrastructureRepositoryPort['listInfrastructureResources'];
};

function snap(input: WorkflowHandlerInput): Record<string, unknown> {
  return { ...input.workflowInput, ...input.inputSnapshot, ...(input.executionContext ?? {}) };
}
function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined;
}
function intOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isInteger(Number(value))) {
    return Number(value);
  }
  return null;
}
function ok(output: Record<string, unknown> = {}): WorkflowHandlerOutcome {
  return { status: 'SUCCEEDED', outputSnapshot: output };
}
function fail(
  code: ActivationErrorCode | string,
  message: string,
  retryable = false,
): WorkflowHandlerOutcome {
  return {
    status: 'FAILED',
    errorClass: code,
    message,
    retryable,
    diagnostics: { handler: 'p7.10', message },
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

type AuthorizationDecision =
  | { allowed: true; view: WorkflowReadyAuthorizationView; rowId: string; version: number }
  | { allowed: false; reason: string; rowId?: string | null; version?: number | null };

function authorizationEvidence(
  decision: AuthorizationDecision,
  context: { tenantId: string; productId: string; provisioningRequestId: string | null },
): Record<string, unknown> {
  return {
    p71AuthorizationDecision: decision.allowed ? 'ALLOW' : 'DENY',
    p71AuthorizationReason: decision.allowed ? 'REVALIDATED' : decision.reason,
    p71AuthorizationRowId: decision.rowId ?? null,
    p71AuthorizationVersion: decision.version ?? null,
    p71ProvisioningRequestId: context.provisioningRequestId,
    tenantId: context.tenantId,
    productId: context.productId,
    decidedAt: new Date().toISOString(),
  };
}

type CheckWrite = {
  checkCode: string;
  status: ReadinessCheckStatus;
  message: string;
  details?: Record<string, unknown>;
  required?: boolean;
};

/**
 * Bridges P7.4 workflow handlers → P7.10 readiness / technical activation.
 *
 * Security invariants:
 *  - P7.1 authorization REVALIDATED fail-closed before every mutation.
 *  - TRUST_MATERIAL_MISSING / AUTHORIZATION_FAILED never best-effort activate.
 *  - Never set Subscription commercial ACTIVE; only provisioningConfirmed + outbox signal.
 *  - Missing prior-phase ports ⇒ required check FAILED.
 */
export function createLiveActivationExecutor(deps: {
  repo: ActivationRepositoryPort;
  authorization: WorkflowAuthorizationPort;
  lease?: WorkflowLeasePort | null;
  infrastructure?: InfraPort | null;
  keycloak?: KeycloakRepositoryPort | null;
  configuration?: ConfigurationRepositoryPort | null;
  experience?: ExperienceRepositoryPort | null;
  productControl?: ProductControlRepositoryPort | null;
  subscriptions?: SubscriptionRepositoryPort | null;
  outbox?: ControlPlaneOutboxTransactionService | null;
}): ActivationLiveExecutor {
  const validateLease = async (
    input: WorkflowHandlerInput,
  ): Promise<LeaseValidationResult | null> => {
    // AUD-P1-04: lease is mandatory — missing port fails closed.
    if (!deps.lease) {
      return { valid: false, reason: 'DEPENDENCY_UNAVAILABLE', detail: 'lease port not wired' };
    }
    if (!Number.isInteger(input.fencingToken) || input.fencingToken < 1) {
      return {
        valid: false,
        reason: 'MISSING_TOKEN',
        detail: 'fencingToken must be a positive integer issued by the engine',
      };
    }
    if (!input.workflowId || !input.stepId || !input.workerId) {
      return { valid: false, reason: 'STEP_NOT_FOUND', detail: 'claim identity incomplete' };
    }
    return deps.lease.validateLease({
      workflowId: input.workflowId,
      stepId: input.stepId,
      workerId: input.workerId,
      fencingToken: input.fencingToken,
    });
  };

  const revalidateAuthorization = async (
    s: Record<string, unknown>,
    bound: {
      authorizationRowId: string | null;
      authorizationVersion: number | null;
      provisioningRequestId: string | null;
    },
  ): Promise<AuthorizationDecision> => {
    if (!deps.authorization) {
      return { allowed: false, reason: 'AUTHORIZATION_PORT_MISSING' };
    }
    const rowId =
      str(s.authorizationRowId) ?? str(s.authorizationId) ?? bound.authorizationRowId ?? null;
    const version = intOf(s.authorizationVersion) ?? bound.authorizationVersion ?? null;
    const provisioningRequestId =
      str(s.provisioningRequestId) ?? bound.provisioningRequestId ?? null;

    if (!rowId || version == null) {
      return { allowed: false, reason: 'TRUST_MATERIAL_MISSING', rowId, version };
    }

    let view: WorkflowReadyAuthorizationView | null;
    try {
      view = await withTimeout(
        deps.authorization.revalidateBoundAuthorization({
          authorizationRowId: rowId,
          authorizationVersion: version,
          provisioningRequestId,
        }),
        AUTHORIZATION_TIMEOUT_MS,
        'P7.1 authorization revalidation',
      );
    } catch {
      return { allowed: false, reason: 'AUTHORIZATION_TIMEOUT', rowId, version };
    }
    if (!view) {
      return { allowed: false, reason: 'AUTHORIZATION_INVALID', rowId, version };
    }
    if (view.authorizationRowId !== rowId || view.authorizationVersion !== version) {
      return { allowed: false, reason: 'AUTHORIZATION_IDENTITY_MISMATCH', rowId, version };
    }
    return { allowed: true, view, rowId, version };
  };

  const recordEvidence = async (
    ctx: {
      activationRecordId?: string | null;
      evaluationId?: string | null;
      tenantId: string;
    },
    input: WorkflowHandlerInput,
    operation: string,
    outcome: 'SUCCEEDED' | 'FAILED' | 'SKIPPED' | 'PARTIAL' | 'BLOCKED',
    evidence: Record<string, unknown>,
    startedAt: number,
    error?: { code: string; message: string },
  ) => {
    try {
      await deps.repo.createEvidence({
        activationRecordId: ctx.activationRecordId ?? null,
        evaluationId: ctx.evaluationId ?? null,
        tenantId: ctx.tenantId,
        workflowId: input.workflowId ?? null,
        stepKey: input.stepKey ?? null,
        operation,
        outcome,
        evidence,
        errorCode: error?.code ?? null,
        errorMessage: error?.message ?? null,
        durationMs: Date.now() - startedAt,
        performedBy: input.workerId ?? null,
      });
    } catch (err) {
      throw new DomainError(
        ErrorCode.DEPENDENCY_UNAVAILABLE,
        'Activation operation evidence could not be persisted',
        [{ operation }],
        err instanceof Error ? err : undefined,
      );
    }
  };

  const gateMutation = async (
    input: WorkflowHandlerInput,
    bound: {
      tenantId: string;
      productId: string;
      authorizationRowId: string | null;
      authorizationVersion: number | null;
      provisioningRequestId: string | null;
      activationRecordId?: string | null;
      evaluationId?: string | null;
    },
    operation: string,
  ): Promise<{ denied: WorkflowHandlerOutcome | null; decision: AuthorizationDecision }> => {
    const startedAt = Date.now();
    const s = snap(input);

    {
      const leaseCheck = await validateLease(input);
      if (leaseCheck && !leaseCheck.valid) {
        await recordEvidence(
          {
            activationRecordId: bound.activationRecordId,
            evaluationId: bound.evaluationId,
            tenantId: bound.tenantId,
          },
          input,
          `${operation}:lease_check`,
          'FAILED',
          { leaseReason: leaseCheck.reason, detail: leaseCheck.detail ?? null },
          startedAt,
          { code: ActivationErrorCode.AUTHORIZATION_FAILED, message: leaseCheck.reason },
        );
        return {
          denied: fail(
            ActivationErrorCode.AUTHORIZATION_FAILED,
            `Lease validation failed: ${leaseCheck.reason}`,
          ),
          decision: { allowed: false, reason: leaseCheck.reason },
        };
      }
    }

    const decision = await revalidateAuthorization(s, bound);
    const evidence = authorizationEvidence(decision, {
      tenantId: bound.tenantId,
      productId: bound.productId,
      provisioningRequestId: bound.provisioningRequestId,
    });
    const errorCode =
      decision.allowed
        ? undefined
        : decision.reason === 'TRUST_MATERIAL_MISSING'
          ? ActivationErrorCode.TRUST_MATERIAL_MISSING
          : ActivationErrorCode.AUTHORIZATION_FAILED;
    await recordEvidence(
      {
        activationRecordId: bound.activationRecordId,
        evaluationId: bound.evaluationId,
        tenantId: bound.tenantId,
      },
      input,
      `${operation}:authorization_check`,
      decision.allowed ? 'SUCCEEDED' : 'FAILED',
      evidence,
      startedAt,
      decision.allowed || !errorCode
        ? undefined
        : { code: errorCode, message: decision.reason },
    );
    if (!decision.allowed) {
      return {
        denied: fail(
          errorCode ?? ActivationErrorCode.AUTHORIZATION_FAILED,
          `P7.1 authorization denied: ${decision.reason}`,
        ),
        decision,
      };
    }
    return { denied: null, decision };
  };

  const writeCheck = async (
    evaluation: TenantReadinessEvaluationRecord,
    check: CheckWrite,
  ) => {
    return deps.repo.upsertCheck({
      evaluationId: evaluation.id,
      tenantId: evaluation.tenantId,
      checkCode: check.checkCode,
      checkPhase: mapCheckCodeToPhase(check.checkCode),
      checkStatus: check.status,
      required: check.required ?? true,
      message: check.message,
      evidenceRef: null,
      details: check.details ?? {},
      checkedAt: new Date(),
    });
  };

  const loadEvaluation = async (
    s: Record<string, unknown>,
  ): Promise<TenantReadinessEvaluationRecord | null> => {
    const evaluationId = str(s.evaluationId) ?? str(s.readinessEvaluationId);
    if (!evaluationId) return null;
    return deps.repo.getEvaluation(evaluationId);
  };

  const loadActivation = async (
    s: Record<string, unknown>,
  ): Promise<ActivationRecordRecord | null> => {
    const id = str(s.activationRecordId) ?? str(s.recordId);
    if (!id) return null;
    return deps.repo.getActivationRecord(id);
  };

  const listInfraResources = async (tenantId: string, productId: string) => {
    const infra = deps.infrastructure;
    if (!infra) return null;
    const listFn =
      'listInfrastructureResources' in infra && infra.listInfrastructureResources
        ? infra.listInfrastructureResources.bind(infra)
        : 'listResources' in infra && typeof infra.listResources === 'function'
          ? infra.listResources.bind(infra)
          : null;
    if (!listFn) return null;
    return listFn({ tenantId, productId, limit: 100 });
  };

  return async (input, key: ActivationAllHandlerKey): Promise<WorkflowHandlerOutcome> => {
    const s = snap(input);
    const startedAt = Date.now();
    const actorId = str(s.actorId) ?? input.workerId ?? 'workflow-worker';

    try {
      switch (key) {
        case 'readiness.validate_auth': {
          const evaluation = await loadEvaluation(s);
          if (!evaluation) {
            return fail(ActivationErrorCode.VALIDATION, 'evaluationId required');
          }
          const { denied, decision } = await gateMutation(
            input,
            {
              tenantId: evaluation.tenantId,
              productId: evaluation.productId,
              authorizationRowId: evaluation.authorizationRowId,
              authorizationVersion: evaluation.authorizationVersion,
              provisioningRequestId: evaluation.provisioningRequestId,
              evaluationId: evaluation.id,
            },
            key,
          );
          if (denied) {
            await writeCheck(evaluation, {
              checkCode: 'auth.p71_revalidated',
              status: ReadinessCheckStatus.FAILED,
              message: decision.allowed ? 'denied' : decision.reason,
              details: { reason: decision.allowed ? null : decision.reason },
            });
            await deps.repo.updateEvaluation(
              evaluation.id,
              { evaluationStatus: ReadinessEvaluationStatus.FAILED },
              evaluation.version,
              actorId,
            );
            return denied;
          }
          await writeCheck(evaluation, {
            checkCode: 'auth.p71_revalidated',
            status: ReadinessCheckStatus.PASSED,
            message: 'P7.1 authorization revalidated',
          });
          await deps.repo.updateEvaluation(
            evaluation.id,
            { evaluationStatus: ReadinessEvaluationStatus.EVALUATING },
            evaluation.version,
            actorId,
          );
          return ok({ evaluationId: evaluation.id, auth: 'REVALIDATED' });
        }

        case 'readiness.check_infra': {
          const evaluation = await loadEvaluation(s);
          if (!evaluation) return fail(ActivationErrorCode.VALIDATION, 'evaluationId required');
          const { denied } = await gateMutation(
            input,
            {
              tenantId: evaluation.tenantId,
              productId: evaluation.productId,
              authorizationRowId: evaluation.authorizationRowId,
              authorizationVersion: evaluation.authorizationVersion,
              provisioningRequestId: evaluation.provisioningRequestId,
              evaluationId: evaluation.id,
            },
            key,
          );
          if (denied) return denied;

          if (!deps.infrastructure) {
            await writeCheck(evaluation, {
              checkCode: 'infra.resources_ready',
              status: ReadinessCheckStatus.FAILED,
              message: 'Infrastructure repository port missing (fail-closed)',
              details: { reason: 'INFRA_PORT_MISSING' },
            });
            return ok({ check: 'FAILED', reason: 'INFRA_PORT_MISSING' });
          }

          const [plans, resources] = await Promise.all([
            deps.infrastructure.listPlans({
              tenantId: evaluation.tenantId,
              productId: evaluation.productId,
              limit: 100,
            }),
            listInfraResources(evaluation.tenantId, evaluation.productId),
          ]);

          const readyResources =
            resources?.items.filter((r) => r.status === ResourceStatus.READY) ?? [];
          const readyPlans = plans.items.filter(
            (p) =>
              p.status === ResourcePlanStatus.COMMITTED ||
              p.status === ResourcePlanStatus.VALIDATED ||
              String(p.status) === 'READY',
          );
          const passed = readyResources.length > 0 || readyPlans.length > 0;
          await writeCheck(evaluation, {
            checkCode: 'infra.resources_ready',
            status: passed ? ReadinessCheckStatus.PASSED : ReadinessCheckStatus.FAILED,
            message: passed
              ? 'Infrastructure READY evidence found'
              : 'No READY/DEPLOYED infrastructure resource or plan',
            details: {
              readyResourceCount: readyResources.length,
              readyPlanCount: readyPlans.length,
            },
          });
          return ok({ check: passed ? 'PASSED' : 'FAILED' });
        }

        case 'readiness.check_keycloak': {
          const evaluation = await loadEvaluation(s);
          if (!evaluation) return fail(ActivationErrorCode.VALIDATION, 'evaluationId required');
          const { denied } = await gateMutation(
            input,
            {
              tenantId: evaluation.tenantId,
              productId: evaluation.productId,
              authorizationRowId: evaluation.authorizationRowId,
              authorizationVersion: evaluation.authorizationVersion,
              provisioningRequestId: evaluation.provisioningRequestId,
              evaluationId: evaluation.id,
            },
            key,
          );
          if (denied) return denied;

          if (!deps.keycloak) {
            await writeCheck(evaluation, {
              checkCode: 'keycloak.topology_verified',
              status: ReadinessCheckStatus.FAILED,
              message: 'Keycloak repository port missing (fail-closed)',
              details: { reason: 'KEYCLOAK_PORT_MISSING' },
            });
            return ok({ check: 'FAILED', reason: 'KEYCLOAK_PORT_MISSING' });
          }

          const topologies = await deps.keycloak.listTopologies({
            tenantId: evaluation.tenantId,
            productId: evaluation.productId,
            limit: 50,
          });
          const verified = topologies.filter(
            (t) =>
              t.status === KeycloakTopologyStatus.READY ||
              String(t.status) === 'ACTIVE' ||
              String(t.status) === 'VERIFIED',
          );
          const passed = verified.length > 0;
          await writeCheck(evaluation, {
            checkCode: 'keycloak.topology_verified',
            status: passed ? ReadinessCheckStatus.PASSED : ReadinessCheckStatus.FAILED,
            message: passed
              ? 'Keycloak topology READY/verified'
              : 'No verified/active Keycloak topology for tenant+product',
            details: { topologyCount: topologies.length, verifiedCount: verified.length },
          });
          return ok({ check: passed ? 'PASSED' : 'FAILED' });
        }

        case 'readiness.check_configuration': {
          const evaluation = await loadEvaluation(s);
          if (!evaluation) return fail(ActivationErrorCode.VALIDATION, 'evaluationId required');
          const { denied } = await gateMutation(
            input,
            {
              tenantId: evaluation.tenantId,
              productId: evaluation.productId,
              authorizationRowId: evaluation.authorizationRowId,
              authorizationVersion: evaluation.authorizationVersion,
              provisioningRequestId: evaluation.provisioningRequestId,
              evaluationId: evaluation.id,
            },
            key,
          );
          if (denied) return denied;

          if (!deps.configuration) {
            await writeCheck(evaluation, {
              checkCode: 'configuration.deployed',
              status: ReadinessCheckStatus.FAILED,
              message: 'Configuration repository port missing (fail-closed)',
              details: { reason: 'CONFIGURATION_PORT_MISSING' },
            });
            return ok({ check: 'FAILED', reason: 'CONFIGURATION_PORT_MISSING' });
          }

          const assignment = await deps.configuration.getActiveAssignment(
            evaluation.tenantId,
            evaluation.productId,
          );
          const passed = !!assignment && assignment.assignmentStatus === AssignmentStatus.DEPLOYED;
          await writeCheck(evaluation, {
            checkCode: 'configuration.deployed',
            status: passed ? ReadinessCheckStatus.PASSED : ReadinessCheckStatus.FAILED,
            message: passed
              ? 'Configuration assignment DEPLOYED'
              : 'No DEPLOYED configuration assignment',
            details: {
              assignmentId: assignment?.id ?? null,
              assignmentStatus: assignment?.assignmentStatus ?? null,
            },
          });
          return ok({ check: passed ? 'PASSED' : 'FAILED' });
        }

        case 'readiness.check_entitlements': {
          const evaluation = await loadEvaluation(s);
          if (!evaluation) return fail(ActivationErrorCode.VALIDATION, 'evaluationId required');
          const { denied } = await gateMutation(
            input,
            {
              tenantId: evaluation.tenantId,
              productId: evaluation.productId,
              authorizationRowId: evaluation.authorizationRowId,
              authorizationVersion: evaluation.authorizationVersion,
              provisioningRequestId: evaluation.provisioningRequestId,
              evaluationId: evaluation.id,
            },
            key,
          );
          if (denied) return denied;

          if (!deps.configuration) {
            await writeCheck(evaluation, {
              checkCode: 'entitlements.deployed',
              status: ReadinessCheckStatus.FAILED,
              message: 'Configuration/entitlement repository port missing (fail-closed)',
              details: { reason: 'CONFIGURATION_PORT_MISSING' },
            });
            return ok({ check: 'FAILED', reason: 'CONFIGURATION_PORT_MISSING' });
          }

          const assignment = await deps.configuration.getActiveAssignment(
            evaluation.tenantId,
            evaluation.productId,
          );
          if (!assignment) {
            await writeCheck(evaluation, {
              checkCode: 'entitlements.deployed',
              status: ReadinessCheckStatus.FAILED,
              message: 'No configuration assignment for entitlement check',
            });
            return ok({ check: 'FAILED' });
          }
          const entitlements = await deps.configuration.listEntitlementDeployments(
            assignment.id,
            50,
          );
          const deployed = entitlements.filter(
            (e) => e.deploymentStatus === EntitlementDeploymentStatus.DEPLOYED,
          );
          const passed = deployed.length > 0;
          await writeCheck(evaluation, {
            checkCode: 'entitlements.deployed',
            status: passed ? ReadinessCheckStatus.PASSED : ReadinessCheckStatus.FAILED,
            message: passed
              ? 'Entitlement deployment DEPLOYED'
              : 'No DEPLOYED entitlement deployment',
            details: { entitlementCount: entitlements.length, deployedCount: deployed.length },
          });
          return ok({ check: passed ? 'PASSED' : 'FAILED' });
        }

        case 'readiness.check_experience': {
          const evaluation = await loadEvaluation(s);
          if (!evaluation) return fail(ActivationErrorCode.VALIDATION, 'evaluationId required');
          const { denied } = await gateMutation(
            input,
            {
              tenantId: evaluation.tenantId,
              productId: evaluation.productId,
              authorizationRowId: evaluation.authorizationRowId,
              authorizationVersion: evaluation.authorizationVersion,
              provisioningRequestId: evaluation.provisioningRequestId,
              evaluationId: evaluation.id,
            },
            key,
          );
          if (denied) return denied;

          if (!deps.experience) {
            await writeCheck(evaluation, {
              checkCode: 'experience.ready',
              status: ReadinessCheckStatus.FAILED,
              message: 'Experience repository port missing (fail-closed)',
              details: { reason: 'EXPERIENCE_PORT_MISSING' },
            });
            return ok({ check: 'FAILED', reason: 'EXPERIENCE_PORT_MISSING' });
          }

          const assignment = await deps.experience.getActiveAssignment(
            evaluation.tenantId,
            evaluation.productId,
          );
          const passed =
            !!assignment && assignment.assignmentStatus === ExperienceAssignmentStatus.READY;
          await writeCheck(evaluation, {
            checkCode: 'experience.ready',
            status: passed ? ReadinessCheckStatus.PASSED : ReadinessCheckStatus.FAILED,
            message: passed
              ? 'Experience assignment READY'
              : 'No READY experience assignment',
            details: {
              assignmentId: assignment?.id ?? null,
              assignmentStatus: assignment?.assignmentStatus ?? null,
            },
          });
          return ok({ check: passed ? 'PASSED' : 'FAILED' });
        }

        case 'readiness.check_product_control': {
          const evaluation = await loadEvaluation(s);
          if (!evaluation) return fail(ActivationErrorCode.VALIDATION, 'evaluationId required');
          const { denied } = await gateMutation(
            input,
            {
              tenantId: evaluation.tenantId,
              productId: evaluation.productId,
              authorizationRowId: evaluation.authorizationRowId,
              authorizationVersion: evaluation.authorizationVersion,
              provisioningRequestId: evaluation.provisioningRequestId,
              evaluationId: evaluation.id,
            },
            key,
          );
          if (denied) return denied;

          if (!deps.productControl) {
            await writeCheck(evaluation, {
              checkCode: 'product_control.reachable',
              status: ReadinessCheckStatus.FAILED,
              message: 'Product control repository port missing (fail-closed)',
              details: { reason: 'PRODUCT_CONTROL_PORT_MISSING' },
            });
            return ok({ check: 'FAILED', reason: 'PRODUCT_CONTROL_PORT_MISSING' });
          }

          const endpoints = await deps.productControl.listEndpoints({
            productId: evaluation.productId,
            status: ProductControlEndpointStatus.ACTIVE,
            limit: 50,
          });
          const passed = endpoints.length > 0;
          await writeCheck(evaluation, {
            checkCode: 'product_control.reachable',
            status: passed ? ReadinessCheckStatus.PASSED : ReadinessCheckStatus.FAILED,
            message: passed
              ? 'Product control ACTIVE endpoint reachable'
              : 'No ACTIVE product control endpoint for product',
            details: { endpointCount: endpoints.length },
          });
          return ok({ check: passed ? 'PASSED' : 'FAILED' });
        }

        case 'readiness.aggregate': {
          const evaluation = await loadEvaluation(s);
          if (!evaluation) return fail(ActivationErrorCode.VALIDATION, 'evaluationId required');
          const { denied } = await gateMutation(
            input,
            {
              tenantId: evaluation.tenantId,
              productId: evaluation.productId,
              authorizationRowId: evaluation.authorizationRowId,
              authorizationVersion: evaluation.authorizationVersion,
              provisioningRequestId: evaluation.provisioningRequestId,
              evaluationId: evaluation.id,
            },
            key,
          );
          if (denied) return denied;

          const checks = await deps.repo.listChecks(evaluation.id);
          const nonAggregate = checks.filter((c) => c.checkCode !== 'aggregate.ready');
          const agg = aggregateReadinessChecks(nonAggregate);

          await writeCheck(evaluation, {
            checkCode: 'aggregate.ready',
            status: agg.ready ? ReadinessCheckStatus.PASSED : ReadinessCheckStatus.FAILED,
            message: agg.ready
              ? 'All required readiness checks PASSED'
              : `Blocking checks: ${agg.blockingCodes.join(', ') || 'none'}`,
            details: {
              overallScore: agg.overallScore,
              blockingCodes: agg.blockingCodes,
              requiredPassed: agg.requiredPassed,
              requiredTotal: agg.requiredTotal,
            },
          });

          const fresh = await deps.repo.getEvaluation(evaluation.id);
          if (!fresh) return fail(ActivationErrorCode.VALIDATION, 'Evaluation disappeared');

          await deps.repo.updateEvaluation(
            fresh.id,
            {
              evaluationStatus: agg.evaluationStatus,
              overallScore: agg.overallScore,
              blockingCodes: agg.blockingCodes,
              evaluatedAt: new Date(),
              summary: {
                requiredPassed: agg.requiredPassed,
                requiredTotal: agg.requiredTotal,
                ready: agg.ready,
              },
            },
            fresh.version,
            actorId,
          );

          const activationRecordId = str(s.activationRecordId);
          if (activationRecordId && agg.ready) {
            const record = await deps.repo.getActivationRecord(activationRecordId);
            if (record) {
              await deps.repo.updateActivationRecord(
                record.id,
                {
                  activationStatus: ActivationRecordStatus.READY_FOR_ACTIVATION,
                  readinessEvaluationId: evaluation.id,
                },
                record.version,
                actorId,
              );
            }
          }

          await recordEvidence(
            { evaluationId: evaluation.id, tenantId: evaluation.tenantId },
            input,
            key,
            agg.ready ? 'SUCCEEDED' : 'FAILED',
            { ...agg },
            startedAt,
            agg.ready
              ? undefined
              : {
                  code: ActivationErrorCode.READINESS_NOT_READY,
                  message: 'Aggregate readiness NOT_READY',
                },
          );

          return ok({
            evaluationStatus: agg.evaluationStatus,
            ready: agg.ready,
            blockingCodes: agg.blockingCodes,
            overallScore: agg.overallScore,
          });
        }

        case 'activation.revalidate_auth': {
          const record = await loadActivation(s);
          if (!record) {
            return fail(ActivationErrorCode.VALIDATION, 'activationRecordId required');
          }
          const { denied, decision } = await gateMutation(
            input,
            {
              tenantId: record.tenantId,
              productId: record.productId,
              authorizationRowId: record.authorizationRowId,
              authorizationVersion: record.authorizationVersion,
              provisioningRequestId: record.provisioningRequestId,
              activationRecordId: record.id,
              evaluationId: record.readinessEvaluationId,
            },
            key,
          );
          if (denied) {
            const denyReason = decision.allowed ? 'denied' : decision.reason;
            await deps.repo.updateActivationRecord(
              record.id,
              {
                activationStatus: ActivationRecordStatus.FAILED,
                failureCode:
                  denyReason === 'TRUST_MATERIAL_MISSING'
                    ? ActivationErrorCode.TRUST_MATERIAL_MISSING
                    : ActivationErrorCode.AUTHORIZATION_FAILED,
                failureMessage: denyReason,
              },
              record.version,
              actorId,
            );
            return denied;
          }
          await deps.repo.updateActivationRecord(
            record.id,
            { activationStatus: ActivationRecordStatus.ACTIVATING },
            record.version,
            actorId,
          );
          return ok({ activationRecordId: record.id, auth: 'REVALIDATED' });
        }

        case 'activation.require_ready_evidence': {
          const record = await loadActivation(s);
          if (!record) {
            return fail(ActivationErrorCode.VALIDATION, 'activationRecordId required');
          }
          const { denied } = await gateMutation(
            input,
            {
              tenantId: record.tenantId,
              productId: record.productId,
              authorizationRowId: record.authorizationRowId,
              authorizationVersion: record.authorizationVersion,
              provisioningRequestId: record.provisioningRequestId,
              activationRecordId: record.id,
              evaluationId: record.readinessEvaluationId,
            },
            key,
          );
          if (denied) return denied;

          const evaluationId =
            str(s.evaluationId) ?? record.readinessEvaluationId ?? null;
          if (!evaluationId) {
            return fail(
              ActivationErrorCode.EVIDENCE_MISSING,
              'No readiness evaluation bound to activation record',
            );
          }
          const evaluation = await deps.repo.getEvaluation(evaluationId);
          if (!evaluation || evaluation.evaluationStatus !== ReadinessEvaluationStatus.READY) {
            await deps.repo.updateActivationRecord(
              record.id,
              {
                activationStatus: ActivationRecordStatus.FAILED,
                failureCode: ActivationErrorCode.READINESS_NOT_READY,
                failureMessage: 'Evaluation is not READY',
              },
              record.version,
              actorId,
            );
            return fail(
              ActivationErrorCode.READINESS_NOT_READY,
              'Technical readiness evaluation is not READY (fail-closed)',
            );
          }
          return ok({ evaluationId, evaluationStatus: evaluation.evaluationStatus });
        }

        case 'activation.mark_active': {
          const record = await loadActivation(s);
          if (!record) {
            return fail(ActivationErrorCode.VALIDATION, 'activationRecordId required');
          }
          const { denied } = await gateMutation(
            input,
            {
              tenantId: record.tenantId,
              productId: record.productId,
              authorizationRowId: record.authorizationRowId,
              authorizationVersion: record.authorizationVersion,
              provisioningRequestId: record.provisioningRequestId,
              activationRecordId: record.id,
              evaluationId: record.readinessEvaluationId,
            },
            key,
          );
          if (denied) return denied;

          const evaluationId = record.readinessEvaluationId;
          if (!evaluationId) {
            return fail(ActivationErrorCode.READINESS_NOT_READY, 'Evaluation binding missing');
          }
          const evaluation = await deps.repo.getEvaluation(evaluationId);
          if (!evaluation || evaluation.evaluationStatus !== ReadinessEvaluationStatus.READY) {
            return fail(
              ActivationErrorCode.READINESS_NOT_READY,
              'Cannot mark ACTIVE without READY evaluation',
            );
          }

          const fresh = await deps.repo.getActivationRecord(record.id);
          if (!fresh) return fail(ActivationErrorCode.VALIDATION, 'Activation record missing');
          const activatedAt = new Date();
          await deps.repo.updateActivationRecord(
            fresh.id,
            {
              activationStatus: ActivationRecordStatus.ACTIVE,
              activatedAt,
              failureCode: null,
              failureMessage: null,
            },
            fresh.version,
            actorId,
          );
          await deps.repo.appendHistory({
            resourceType: 'ACTIVATION_RECORD',
            resourceId: fresh.id,
            tenantId: fresh.tenantId,
            fromStatus: String(fresh.activationStatus),
            toStatus: ActivationRecordStatus.ACTIVE,
            action: 'MARK_ACTIVE',
            actorId,
            details: { evaluationId },
          });
          await recordEvidence(
            {
              activationRecordId: fresh.id,
              evaluationId,
              tenantId: fresh.tenantId,
            },
            input,
            key,
            'SUCCEEDED',
            { activatedAt: activatedAt.toISOString() },
            startedAt,
          );
          return ok({ activationStatus: ActivationRecordStatus.ACTIVE, activatedAt });
        }

        case 'activation.emit_provisioning_completed': {
          const record = await loadActivation(s);
          if (!record) {
            return fail(ActivationErrorCode.VALIDATION, 'activationRecordId required');
          }
          const { denied } = await gateMutation(
            input,
            {
              tenantId: record.tenantId,
              productId: record.productId,
              authorizationRowId: record.authorizationRowId,
              authorizationVersion: record.authorizationVersion,
              provisioningRequestId: record.provisioningRequestId,
              activationRecordId: record.id,
              evaluationId: record.readinessEvaluationId,
            },
            key,
          );
          if (denied) return denied;

          const subscriptionId = record.subscriptionId ?? str(s.subscriptionId) ?? null;
          if (!subscriptionId) {
            await recordEvidence(
              {
                activationRecordId: record.id,
                evaluationId: record.readinessEvaluationId,
                tenantId: record.tenantId,
              },
              input,
              key,
              'SKIPPED',
              { reason: 'NO_SUBSCRIPTION_ID', note: 'P5 signal skipped — no subscription bound' },
              startedAt,
            );
            return ok({ signal: 'SKIPPED', reason: 'NO_SUBSCRIPTION_ID' });
          }

          if (!deps.subscriptions || !deps.outbox) {
            await recordEvidence(
              {
                activationRecordId: record.id,
                evaluationId: record.readinessEvaluationId,
                tenantId: record.tenantId,
              },
              input,
              key,
              'FAILED',
              { reason: 'SUBSCRIPTION_OR_OUTBOX_MISSING' },
              startedAt,
              {
                code: ActivationErrorCode.P5_SIGNAL_FAILED,
                message: 'Subscription/outbox port missing for P5 signal',
              },
            );
            return fail(
              ActivationErrorCode.P5_SIGNAL_FAILED,
              'Cannot emit provisioning completed without subscription+outbox ports',
            );
          }

          // Never set commercial Subscription.ACTIVE — only provisioningConfirmed.
          await deps.subscriptions.updateSubscription(subscriptionId, {
            provisioningConfirmed: true,
          });

          const correlationId = str(s.correlationId) ?? input.correlationId ?? randomUUID();
          const event = createProvisioningCompletedEvent({
            actorId,
            correlationId,
            subscriptionId,
            requestId: record.provisioningRequestId,
          });
          let eventId: string | null = null;
          await deps.outbox.runWithOutbox(EDGE_SUBSCRIPTION_OUTBOX_TENANT, async (_c, enqueue) => {
            eventId = await enqueue(event);
          });

          const emittedAt = new Date();
          const fresh = await deps.repo.getActivationRecord(record.id);
          if (!fresh) return fail(ActivationErrorCode.VALIDATION, 'Activation record missing');
          await deps.repo.updateActivationRecord(
            fresh.id,
            {
              p5SignalEmittedAt: emittedAt,
              p5SignalEventId: eventId,
            },
            fresh.version,
            actorId,
          );
          await recordEvidence(
            {
              activationRecordId: fresh.id,
              evaluationId: fresh.readinessEvaluationId,
              tenantId: fresh.tenantId,
            },
            input,
            key,
            'SUCCEEDED',
            {
              subscriptionId,
              eventId,
              eventType: 'subscription.provisioning.completed.v1',
              provisioningConfirmed: true,
              commercialStatusUntouched: true,
            },
            startedAt,
          );
          return ok({
            signal: 'EMITTED',
            eventId,
            subscriptionId,
            provisioningConfirmed: true,
          });
        }

        case 'activation.verify': {
          const record = await loadActivation(s);
          if (!record) {
            return fail(ActivationErrorCode.VALIDATION, 'activationRecordId required');
          }
          const { denied } = await gateMutation(
            input,
            {
              tenantId: record.tenantId,
              productId: record.productId,
              authorizationRowId: record.authorizationRowId,
              authorizationVersion: record.authorizationVersion,
              provisioningRequestId: record.provisioningRequestId,
              activationRecordId: record.id,
              evaluationId: record.readinessEvaluationId,
            },
            key,
          );
          if (denied) return denied;

          const fresh = await deps.repo.getActivationRecord(record.id);
          if (!fresh) return fail(ActivationErrorCode.VALIDATION, 'Activation record missing');
          if (fresh.activationStatus !== ActivationRecordStatus.ACTIVE) {
            return fail(
              ActivationErrorCode.ACTIVATION_FORBIDDEN,
              `Activation status is ${fresh.activationStatus}, expected ACTIVE`,
            );
          }

          const hasSubscription = !!fresh.subscriptionId;
          const signalOk =
            !!fresh.p5SignalEmittedAt ||
            (!hasSubscription &&
              (await deps.repo.listEvidence({ activationRecordId: fresh.id, limit: 50 })).some(
                (e) =>
                  e.operation === 'activation.emit_provisioning_completed' &&
                  e.outcome === 'SKIPPED',
              ));

          if (!signalOk) {
            return fail(
              ActivationErrorCode.P5_SIGNAL_FAILED,
              'P5 provisioning-completed signal missing (fail-closed)',
            );
          }

          await recordEvidence(
            {
              activationRecordId: fresh.id,
              evaluationId: fresh.readinessEvaluationId,
              tenantId: fresh.tenantId,
            },
            input,
            key,
            'SUCCEEDED',
            {
              activationStatus: fresh.activationStatus,
              p5SignalEmittedAt: fresh.p5SignalEmittedAt?.toISOString() ?? null,
              signalSkipped: !hasSubscription,
            },
            startedAt,
          );
          return ok({
            verified: true,
            activationStatus: fresh.activationStatus,
            p5SignalEmitted: !!fresh.p5SignalEmittedAt,
          });
        }

        default:
          return fail(ActivationErrorCode.VALIDATION, `Unknown handler key: ${String(key)}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(ActivationErrorCode.PROVIDER_UNAVAILABLE, message, true);
    }
  };
}
