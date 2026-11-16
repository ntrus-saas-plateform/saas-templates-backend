import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ConnectivityAgentLiveExecutor } from '../../domain/connectivity-agent/connectivity-agent-handlers.js';
import {
  assertOutboundOnly,
  assertPublicKeyRefVaultOnly,
  canIssueCommand,
  canRevokeAgent,
} from '../../domain/connectivity-agent/connectivity-agent-policy.js';
import type { ConnectivityAgentRepositoryPort } from '../../domain/connectivity-agent/connectivity-agent-repository.port.js';
import {
  AgentCommandStatus,
  AgentSpoolStatus,
  AgentStatus,
  ConnectivityAgentErrorCode,
  type ConnectivityAgentHandlerKey,
  type ConnectivityAgentRecord,
} from '../../domain/connectivity-agent/connectivity-agent.types.js';
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
  code: ConnectivityAgentErrorCode | string,
  message: string,
  retryable = false,
): WorkflowHandlerOutcome {
  return {
    status: 'FAILED',
    errorClass: code,
    message,
    retryable,
    diagnostics: { handler: 'p7.14', message },
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

/**
 * Bridges P7.4 workflow handlers → P7.14 connectivity agent registry.
 *
 * CRITICAL:
 * - outbound_only=true always
 * - public_key_ref vault-only (no plaintext)
 * - nonce unique anti-replay
 * - revoke clears active commands → REVOKED (fail-closed)
 * - P7.1 fail-closed when provisioningRequestId bound
 */
export function createLiveConnectivityAgentExecutor(deps: {
  repo: ConnectivityAgentRepositoryPort;
  authorization: WorkflowAuthorizationPort;
  lease?: WorkflowLeasePort | null;
}): ConnectivityAgentLiveExecutor {
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

    // AUD-P0-05: never allow UNBOUND mutations — fail-closed without bound auth.
    if (!rowId || version == null || !provisioningRequestId) {
      return { allowed: false, reason: 'TRUST_MATERIAL_MISSING', rowId, version };
    }

    let view: WorkflowReadyAuthorizationView | null;
    try {
      view = await withTimeout(
        deps.authorization.revalidateBoundAuthorization({
          authorizationRowId: rowId!,
          authorizationVersion: version!,
          provisioningRequestId: provisioningRequestId!,
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
    return { allowed: true, view, rowId: rowId!, version: version! };
  };

  const recordEvidence = async (
    ctx: { agentId?: string | null; commandId?: string | null; tenantId: string | null },
    input: WorkflowHandlerInput,
    operation: string,
    outcome: 'SUCCEEDED' | 'FAILED' | 'SKIPPED' | 'PARTIAL' | 'WAITING_APPROVAL',
    evidence: Record<string, unknown>,
    startedAt: number,
    error?: { code: string; message: string },
  ) => {
    try {
      await deps.repo.createEvidence({
        agentId: ctx.agentId ?? null,
        commandId: ctx.commandId ?? null,
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
        'Connectivity agent evidence could not be persisted',
        [{ operation }],
        err instanceof Error ? err : undefined,
      );
    }
  };

  const loadAgent = async (s: Record<string, unknown>): Promise<ConnectivityAgentRecord | null> => {
    const id = str(s.agentId) ?? str(s.recordId);
    if (id) return deps.repo.getAgent(id);
    const code = str(s.agentCode);
    if (code) return deps.repo.getAgentByCode(code);
    return null;
  };

  return async (input, key: ConnectivityAgentHandlerKey): Promise<WorkflowHandlerOutcome> => {
    const s = snap(input);
    const startedAt = Date.now();
    const actorId = str(s.actorId) ?? input.workerId ?? 'workflow-worker';

    try {
      {
        const leaseCheck = await validateLease(input);
        if (leaseCheck && !leaseCheck.valid) {
          return fail(
            ConnectivityAgentErrorCode.AUTHORIZATION_FAILED,
            `Lease validation failed: ${leaseCheck.reason}`,
          );
        }
      }

      switch (key) {
        case 'agent.revalidate_auth': {
          const agent = await loadAgent(s);
          const bound = {
            authorizationRowId: str(s.authorizationRowId) ?? null,
            authorizationVersion: intOf(s.authorizationVersion),
            provisioningRequestId: str(s.provisioningRequestId) ?? null,
          };
          const decision = await revalidateAuthorization(s, bound);
          await recordEvidence(
            { agentId: agent?.id ?? null, tenantId: agent?.tenantId ?? str(s.tenantId) ?? null },
            input,
            'agent.revalidate_auth',
            decision.allowed ? 'SUCCEEDED' : 'FAILED',
            {
              p71AuthorizationDecision: decision.allowed ? 'ALLOW' : 'DENY',
              p71AuthorizationReason: decision.allowed ? 'REVALIDATED' : decision.reason,
              bound,
            },
            startedAt,
            decision.allowed
              ? undefined
              : {
                  code: ConnectivityAgentErrorCode.AUTHORIZATION_FAILED,
                  message: decision.reason,
                },
          );
          if (!decision.allowed) {
            return fail(
              ConnectivityAgentErrorCode.AUTHORIZATION_FAILED,
              `P7.1 authorization denied: ${decision.reason}`,
            );
          }
          return ok({
            authorizationRowId: decision.rowId,
            authorizationVersion: decision.version,
          });
        }

        case 'agent.validate_outbound': {
          const outboundOnly = s.outboundOnly !== false;
          const decision = assertOutboundOnly({ outboundOnly: outboundOnly === true });
          await recordEvidence(
            { agentId: str(s.agentId) ?? null, tenantId: str(s.tenantId) ?? null },
            input,
            'agent.validate_outbound',
            decision.allowed ? 'SUCCEEDED' : 'FAILED',
            { outboundOnly },
            startedAt,
            decision.allowed ? undefined : { code: decision.code, message: decision.reason },
          );
          if (!decision.allowed) {
            return fail(decision.code, decision.reason);
          }
          return ok({ outboundOnly: true });
        }

        case 'agent.validate_public_key_ref': {
          const publicKeyRef = str(s.publicKeyRef) ?? '';
          const decision = assertPublicKeyRefVaultOnly(publicKeyRef);
          await recordEvidence(
            { agentId: str(s.agentId) ?? null, tenantId: str(s.tenantId) ?? null },
            input,
            'agent.validate_public_key_ref',
            decision.allowed ? 'SUCCEEDED' : 'FAILED',
            { publicKeyRefPresent: Boolean(publicKeyRef), vaultOnly: decision.allowed },
            startedAt,
            decision.allowed ? undefined : { code: decision.code, message: decision.reason },
          );
          if (!decision.allowed) {
            return fail(decision.code, decision.reason);
          }
          return ok({ publicKeyRef });
        }

        case 'agent.persist_registration': {
          const agentId = str(s.agentId);
          if (!agentId) {
            return fail(ConnectivityAgentErrorCode.VALIDATION, 'agentId required');
          }
          const agent = await deps.repo.getAgent(agentId);
          if (!agent) {
            return fail(ConnectivityAgentErrorCode.VALIDATION, 'Agent not found');
          }
          const updated = await deps.repo.updateAgent(
            agent.id,
            {
              agentStatus: AgentStatus.REGISTERING,
              outboundOnly: true,
              metadata: {
                ...agent.metadata,
                registrationWorkflowId: input.workflowId ?? null,
              },
            },
            agent.version,
            actorId,
          );
          await recordEvidence(
            { agentId: agent.id, tenantId: agent.tenantId },
            input,
            'agent.persist_registration',
            'SUCCEEDED',
            { agentStatus: updated.agentStatus, outboundOnly: updated.outboundOnly },
            startedAt,
          );
          return ok({ agentId: updated.id, agentStatus: updated.agentStatus });
        }

        case 'agent.activate': {
          const agent = await loadAgent(s);
          if (!agent) {
            return fail(ConnectivityAgentErrorCode.VALIDATION, 'Agent not found');
          }
          const updated = await deps.repo.updateAgent(
            agent.id,
            {
              agentStatus: AgentStatus.ACTIVE,
              outboundOnly: true,
              lastSeenAt: new Date(),
            },
            agent.version,
            actorId,
          );
          await deps.repo.appendHistory({
            resourceType: 'CONNECTIVITY_AGENT',
            resourceId: agent.id,
            tenantId: agent.tenantId,
            fromStatus: String(agent.agentStatus),
            toStatus: AgentStatus.ACTIVE,
            action: 'ACTIVATE',
            actorId,
          });
          await recordEvidence(
            { agentId: agent.id, tenantId: agent.tenantId },
            input,
            'agent.activate',
            'SUCCEEDED',
            { agentStatus: updated.agentStatus },
            startedAt,
          );
          return ok({ agentId: updated.id, agentStatus: updated.agentStatus });
        }

        case 'agent.validate_nonce': {
          const agent = await loadAgent(s);
          if (!agent) {
            return fail(ConnectivityAgentErrorCode.VALIDATION, 'Agent not found');
          }
          const nonce = str(s.nonce) ?? '';
          const existing = await deps.repo.getCommandByNonce(agent.id, nonce);
          const decision = canIssueCommand({
            agentStatus: String(agent.agentStatus),
            outboundOnly: agent.outboundOnly,
            nonce,
            existingNonceCommand: existing,
          });
          await recordEvidence(
            { agentId: agent.id, tenantId: agent.tenantId },
            input,
            'agent.validate_nonce',
            decision.allowed ? 'SUCCEEDED' : 'FAILED',
            { noncePresent: Boolean(nonce), replay: !decision.allowed },
            startedAt,
            decision.allowed ? undefined : { code: decision.code, message: decision.reason },
          );
          if (!decision.allowed) {
            return fail(decision.code, decision.reason);
          }
          return ok({ nonce, agentId: agent.id });
        }

        case 'agent.enqueue_command': {
          const agent = await loadAgent(s);
          if (!agent) {
            return fail(ConnectivityAgentErrorCode.VALIDATION, 'Agent not found');
          }
          const commandId = str(s.commandId);
          if (!commandId) {
            return fail(ConnectivityAgentErrorCode.VALIDATION, 'commandId required');
          }
          const updated = await deps.repo.updateCommand(commandId, {
            commandStatus: AgentCommandStatus.QUEUED,
            workflowId: input.workflowId ?? null,
            signatureRef: str(s.signatureRef) ?? `vault:agent-cmd-sig/${commandId}`,
          });
          await recordEvidence(
            { agentId: agent.id, commandId, tenantId: agent.tenantId },
            input,
            'agent.enqueue_command',
            'SUCCEEDED',
            { commandStatus: updated.commandStatus, nonce: updated.nonce },
            startedAt,
          );
          return ok({ commandId: updated.id, commandStatus: updated.commandStatus });
        }

        case 'agent.spool_command': {
          const agent = await loadAgent(s);
          if (!agent) {
            return fail(ConnectivityAgentErrorCode.VALIDATION, 'Agent not found');
          }
          const commandId = str(s.commandId);
          if (!commandId) {
            return fail(ConnectivityAgentErrorCode.VALIDATION, 'commandId required');
          }
          const cmd = await deps.repo.getCommand(commandId);
          if (!cmd) {
            return fail(ConnectivityAgentErrorCode.VALIDATION, 'Command not found');
          }
          const payloadRef = cmd.payloadRef ?? `vault:agent-cmd-payload/${commandId}`;
          const spool = await deps.repo.createSpool({
            agentId: agent.id,
            commandId,
            spoolStatus: AgentSpoolStatus.PENDING,
            payloadRef,
            attempts: 0,
            nextAttemptAt: new Date(),
          });
          await deps.repo.updateCommand(commandId, {
            commandStatus: AgentCommandStatus.DISPATCHED,
            payloadRef,
          });
          await recordEvidence(
            { agentId: agent.id, commandId, tenantId: agent.tenantId },
            input,
            'agent.spool_command',
            'SUCCEEDED',
            { spoolId: spool.id, outboundOnly: true },
            startedAt,
          );
          return ok({ spoolId: spool.id, commandStatus: AgentCommandStatus.DISPATCHED });
        }

        case 'agent.mark_revoking': {
          const agent = await loadAgent(s);
          if (!agent) {
            return fail(ConnectivityAgentErrorCode.VALIDATION, 'Agent not found');
          }
          const decision = canRevokeAgent(String(agent.agentStatus));
          if (!decision.allowed) {
            await recordEvidence(
              { agentId: agent.id, tenantId: agent.tenantId },
              input,
              'agent.mark_revoking',
              'FAILED',
              { agentStatus: agent.agentStatus },
              startedAt,
              { code: decision.code, message: decision.reason },
            );
            return fail(decision.code, decision.reason);
          }
          const updated = await deps.repo.updateAgent(
            agent.id,
            { agentStatus: AgentStatus.REVOKING },
            agent.version,
            actorId,
          );
          await recordEvidence(
            { agentId: agent.id, tenantId: agent.tenantId },
            input,
            'agent.mark_revoking',
            'SUCCEEDED',
            { agentStatus: updated.agentStatus },
            startedAt,
          );
          return ok({ agentId: updated.id, agentStatus: updated.agentStatus });
        }

        case 'agent.revoke_pending_commands': {
          const agent = await loadAgent(s);
          if (!agent) {
            return fail(ConnectivityAgentErrorCode.VALIDATION, 'Agent not found');
          }
          const result = await deps.repo.revokeActiveCommands(agent.id);
          await recordEvidence(
            { agentId: agent.id, tenantId: agent.tenantId },
            input,
            'agent.revoke_pending_commands',
            'SUCCEEDED',
            { revokedCount: result.revokedCount, failClosed: true },
            startedAt,
          );
          return ok({ revokedCount: result.revokedCount });
        }

        case 'agent.revoke_agent': {
          const agent = await loadAgent(s);
          if (!agent) {
            return fail(ConnectivityAgentErrorCode.VALIDATION, 'Agent not found');
          }
          const reason = str(s.reason) ?? str(s.revocationReason) ?? 'REVOKED';
          const updated = await deps.repo.updateAgent(
            agent.id,
            {
              agentStatus: AgentStatus.REVOKED,
              revokedAt: new Date(),
              revocationReason: reason,
              outboundOnly: true,
            },
            agent.version,
            actorId,
          );
          await deps.repo.appendHistory({
            resourceType: 'CONNECTIVITY_AGENT',
            resourceId: agent.id,
            tenantId: agent.tenantId,
            fromStatus: String(agent.agentStatus),
            toStatus: AgentStatus.REVOKED,
            action: 'REVOKE',
            reason,
            actorId,
          });
          await recordEvidence(
            { agentId: agent.id, tenantId: agent.tenantId },
            input,
            'agent.revoke_agent',
            'SUCCEEDED',
            { agentStatus: updated.agentStatus, reason },
            startedAt,
          );
          return ok({ agentId: updated.id, agentStatus: updated.agentStatus });
        }

        case 'agent.verify': {
          const agent = await loadAgent(s);
          const commandId = str(s.commandId);
          const operation = str(s.operation) ?? 'VERIFY';
          await recordEvidence(
            {
              agentId: agent?.id ?? str(s.agentId) ?? null,
              commandId: commandId ?? null,
              tenantId: agent?.tenantId ?? str(s.tenantId) ?? null,
            },
            input,
            'agent.verify',
            'SUCCEEDED',
            {
              operation,
              agentStatus: agent?.agentStatus ?? null,
              outboundOnly: agent?.outboundOnly ?? true,
              workflowId: input.workflowId ?? null,
            },
            startedAt,
          );
          return ok({
            verified: true,
            agentId: agent?.id ?? null,
            agentStatus: agent?.agentStatus ?? null,
          });
        }

        default:
          return fail(
            ConnectivityAgentErrorCode.VALIDATION,
            `Unknown connectivity agent handler key: ${key as string}`,
          );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(ConnectivityAgentErrorCode.PROVIDER_UNAVAILABLE, message);
    }
  };
}
