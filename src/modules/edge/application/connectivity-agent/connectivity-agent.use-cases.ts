import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import { EDGE_P7_OUTBOX_TENANT } from '../../domain/provisioning/provisioning.events.js';
import {
  canIssueCommand,
  canRegisterAgent,
  canRevokeAgent,
} from '../../domain/connectivity-agent/connectivity-agent-policy.js';
import type { ConnectivityAgentRepositoryPort } from '../../domain/connectivity-agent/connectivity-agent-repository.port.js';
import {
  AgentCommandStatus,
  AgentStatus,
  ConnectivityAgentErrorCode,
} from '../../domain/connectivity-agent/connectivity-agent.types.js';
import type { WorkflowAuthorizationPort } from '../../domain/workflow/workflow-authorization.port.js';
import type { WorkflowRepositoryPort } from '../../domain/workflow/workflow-repository.port.js';
import { WorkflowDefinitionStatus } from '../../domain/workflow/workflow.types.js';
import { validateDefinition } from '../../domain/workflow/workflow-definition.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

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
  const details: Record<string, unknown> = { ...input.details };
  const actorId = isUuid(input.actorId) ? input.actorId : null;
  if (actorId === null && input.actorId) details.actorRef = input.actorId;
  const subjectId = isUuid(input.subjectId) ? input.subjectId : null;
  if (subjectId === null && input.subjectId) details.subjectRef = input.subjectId;
  try {
    await audit.create({ ...input, actorId, subjectId, details }, client);
  } catch (err) {
    throw new DomainError(
      ErrorCode.DEPENDENCY_UNAVAILABLE,
      'Durable audit required for connectivity agent mutation',
      [{ eventType: input.eventType }],
      err instanceof Error ? err : undefined,
    );
  }
}

// ---------------------------------------------------------------------------
// Workflow definitions (P7.14)
// ---------------------------------------------------------------------------

export const CONNECTIVITY_AGENT_WORKFLOW_DEFINITIONS = {
  register: {
    code: 'p714.agent.register',
    name: 'P7.14 Connectivity Agent Register',
    description:
      'Revalidate auth, enforce outbound_only + vault public_key_ref, persist registration, activate, verify',
    snapshot: {
      steps: [
        {
          key: 'revalidate_auth',
          type: 'HANDLER',
          handlerKey: 'agent.revalidate_auth',
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'validate_outbound',
          type: 'HANDLER',
          handlerKey: 'agent.validate_outbound',
          dependsOn: ['revalidate_auth'],
          maxAttempts: 1,
          timeoutMs: 30_000,
        },
        {
          key: 'validate_public_key_ref',
          type: 'HANDLER',
          handlerKey: 'agent.validate_public_key_ref',
          dependsOn: ['validate_outbound'],
          maxAttempts: 1,
          timeoutMs: 30_000,
        },
        {
          key: 'persist_registration',
          type: 'HANDLER',
          handlerKey: 'agent.persist_registration',
          dependsOn: ['validate_public_key_ref'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'activate',
          type: 'HANDLER',
          handlerKey: 'agent.activate',
          dependsOn: ['persist_registration'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'verify',
          type: 'HANDLER',
          handlerKey: 'agent.verify',
          dependsOn: ['activate'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
      ],
    },
  },
  command: {
    code: 'p714.agent.command',
    name: 'P7.14 Connectivity Agent Command',
    description:
      'Revalidate auth, validate unique nonce (anti-replay), enqueue signed command, spool outbound-only, verify',
    snapshot: {
      steps: [
        {
          key: 'revalidate_auth',
          type: 'HANDLER',
          handlerKey: 'agent.revalidate_auth',
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'validate_nonce',
          type: 'HANDLER',
          handlerKey: 'agent.validate_nonce',
          dependsOn: ['revalidate_auth'],
          maxAttempts: 1,
          timeoutMs: 30_000,
        },
        {
          key: 'enqueue_command',
          type: 'HANDLER',
          handlerKey: 'agent.enqueue_command',
          dependsOn: ['validate_nonce'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'spool_command',
          type: 'HANDLER',
          handlerKey: 'agent.spool_command',
          dependsOn: ['enqueue_command'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'verify',
          type: 'HANDLER',
          handlerKey: 'agent.verify',
          dependsOn: ['spool_command'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
      ],
    },
  },
  revoke: {
    code: 'p714.agent.revoke',
    name: 'P7.14 Connectivity Agent Revoke',
    description:
      'Revalidate auth, mark REVOKING, clear active commands to REVOKED (fail-closed), revoke agent, verify',
    snapshot: {
      steps: [
        {
          key: 'revalidate_auth',
          type: 'HANDLER',
          handlerKey: 'agent.revalidate_auth',
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'mark_revoking',
          type: 'HANDLER',
          handlerKey: 'agent.mark_revoking',
          dependsOn: ['revalidate_auth'],
          maxAttempts: 1,
          timeoutMs: 30_000,
        },
        {
          key: 'revoke_pending_commands',
          type: 'HANDLER',
          handlerKey: 'agent.revoke_pending_commands',
          dependsOn: ['mark_revoking'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'revoke_agent',
          type: 'HANDLER',
          handlerKey: 'agent.revoke_agent',
          dependsOn: ['revoke_pending_commands'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'verify',
          type: 'HANDLER',
          handlerKey: 'agent.verify',
          dependsOn: ['revoke_agent'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
      ],
    },
  },
} as const;

export type ConnectivityAgentWorkflowKind =
  keyof typeof CONNECTIVITY_AGENT_WORKFLOW_DEFINITIONS;

const WORKFLOW_RETRY_DEFAULTS = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 15_000,
  multiplier: 2,
  jitterRatio: 0.2,
};

export async function ensureConnectivityAgentDefinition(
  repo: WorkflowRepositoryPort,
  outbox: ControlPlaneOutboxTransactionService,
  _audit: AuditEventRepositoryPort,
  actorId: string,
  kind: ConnectivityAgentWorkflowKind = 'register',
): Promise<{ id: string }> {
  const def = CONNECTIVITY_AGENT_WORKFLOW_DEFINITIONS[kind];
  const code = def.code;
  const existing = await repo.getDefinitionByCode(code);
  if (existing && existing.definitionStatus === WorkflowDefinitionStatus.PUBLISHED) {
    return existing;
  }
  const snapshot = {
    steps: def.snapshot.steps.map((step) => ({
      ...step,
      dependsOn:
        'dependsOn' in step && step.dependsOn
          ? [...(step.dependsOn as readonly string[])]
          : undefined,
    })),
    retryDefaults: WORKFLOW_RETRY_DEFAULTS,
    timeoutDefaultsMs: 600_000,
  };
  validateDefinition(snapshot);

  return outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
    const publishExisting = async (d: {
      id: string;
      version: number;
      definitionStatus: string;
    }) => {
      if (d.definitionStatus === WorkflowDefinitionStatus.PUBLISHED) return d;
      const latest = await repo.getLatestDefinitionVersion(d.id);
      if (!latest) {
        throw new DomainError(ErrorCode.DEPENDENCY_UNAVAILABLE, 'Workflow definition version missing');
      }
      let currentVersion = d.version;
      if (d.definitionStatus === WorkflowDefinitionStatus.DRAFT) {
        const validated = await repo.setDefinitionStatus(
          d.id,
          WorkflowDefinitionStatus.VALIDATED,
          currentVersion,
          {},
          client,
        );
        currentVersion = validated.version;
      }
      if (d.definitionStatus !== WorkflowDefinitionStatus.VALIDATED) {
        const latestNow = await repo.getLatestDefinitionVersion(d.id);
        await repo.publishDefinitionVersion(
          d.id,
          latestNow?.versionNumber ?? latest.versionNumber,
          latest.snapshot,
          client,
        );
      }
      return repo.setDefinitionStatus(
        d.id,
        WorkflowDefinitionStatus.PUBLISHED,
        currentVersion,
        { approvedBy: actorId, publishedAt: new Date() },
        client,
      );
    };

    const again = await repo.getDefinitionByCode(code);
    if (again) return publishExisting(again);

    const created = await repo.createDefinition(
      {
        code,
        name: def.name,
        description: def.description,
        domain: 'connectivity-agent',
        definitionStatus: WorkflowDefinitionStatus.DRAFT,
        securityClassification: 'INTERNAL',
        createdBy: actorId,
        approvedBy: null,
        publishedAt: null,
        draftSnapshot: snapshot,
      },
      client,
    );
    const version = created.version;
    await repo.publishDefinitionVersion(
      created.definition.id,
      version.versionNumber,
      version.snapshot,
      client,
    );
    await repo.setDefinitionStatus(
      created.definition.id,
      WorkflowDefinitionStatus.VALIDATED,
      created.definition.version,
      {},
      client,
    );
    return repo.setDefinitionStatus(
      created.definition.id,
      WorkflowDefinitionStatus.PUBLISHED,
      created.definition.version + 1,
      { approvedBy: actorId, publishedAt: new Date() },
      client,
    );
  });
}

type WorkflowCreateStart = {
  execute(input: {
    actorId: string;
    idempotencyKey: string;
    definitionId: string;
    workflowType: string;
    inputSnapshot?: Record<string, unknown>;
    provisioningRequestId?: string | null;
    businessReference?: string | null;
  }): Promise<{ id: string; state: string }>;
};

type WorkflowStart = {
  execute(input: { actorId: string; workflowId: string }): Promise<{ id: string; state: string }>;
};

async function revalidateAgentAuth(
  auth: WorkflowAuthorizationPort,
  record: {
    authorizationRowId: string | null;
    authorizationVersion: number | null;
    provisioningRequestId: string | null;
  },
  provisioningRequestId: string | null,
) {
  const boundProv = provisioningRequestId ?? record.provisioningRequestId ?? null;
  if (boundProv) {
    if (!record.authorizationRowId || record.authorizationVersion == null) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'Connectivity agent operation has no bound P7.1 authorization (fail-closed)',
        [{ code: ConnectivityAgentErrorCode.AUTHORIZATION_FAILED }],
      );
    }
    const revalidated = await auth.revalidateBoundAuthorization({
      authorizationRowId: record.authorizationRowId,
      authorizationVersion: record.authorizationVersion,
      provisioningRequestId: boundProv,
    });
    if (!revalidated) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'P7.1 authorization not valid for connectivity agent operation',
        [{ code: ConnectivityAgentErrorCode.AUTHORIZATION_FAILED }],
      );
    }
    return revalidated;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export class ListConnectivityAgentsUseCase {
  constructor(private readonly repo: ConnectivityAgentRepositoryPort) {}

  agents(filter: {
    status?: string;
    tenantId?: string;
    productId?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listAgents(filter);
  }
  agent(id: string) {
    return this.repo.getAgent(id);
  }
  commands(filter: {
    agentId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listCommands(filter);
  }
  command(id: string) {
    return this.repo.getCommand(id);
  }
  evidence(filter: { agentId?: string; commandId?: string; limit?: number }) {
    return this.repo.listEvidence(filter);
  }
  history(filter: { resourceId?: string; resourceType?: string; limit?: number }) {
    return this.repo.listHistory(filter);
  }
  spool(filter: { agentId?: string; status?: string; limit?: number }) {
    return this.repo.listSpool(filter);
  }
}

// ---------------------------------------------------------------------------
// Create agent (pending) — register workflow activates
// ---------------------------------------------------------------------------

export class CreateConnectivityAgentUseCase {
  constructor(
    private readonly repo: ConnectivityAgentRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    agentCode: string;
    displayName: string;
    publicKeyRef: string;
    tenantId?: string | null;
    productId?: string | null;
    deploymentProfileCode?: string | null;
    certificateRef?: string | null;
    outboundOnly?: boolean;
    provisioningRequestId?: string | null;
    authorizationRowId?: string | null;
    authorizationVersion?: number | null;
    metadata?: Record<string, unknown>;
  }) {
    const agentCode = input.agentCode.trim().toLowerCase();
    if (!agentCode) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'agentCode is required', [
        { code: ConnectivityAgentErrorCode.VALIDATION },
      ]);
    }
    // Always force outbound_only=true — never trust client false
    const outboundOnly = true;
    const guard = canRegisterAgent({
      outboundOnly,
      publicKeyRef: input.publicKeyRef,
    });
    if (!guard.allowed) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, guard.reason, [{ code: guard.code }]);
    }
    if (input.outboundOnly === false) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'outbound_only must be true — inbound connectivity forbidden',
        [{ code: ConnectivityAgentErrorCode.OUTBOUND_ONLY_REQUIRED }],
      );
    }

    const existing = await this.repo.getAgentByCode(agentCode);
    if (existing) {
      throw new DomainError(ErrorCode.CONFLICT, 'Agent code already exists', [
        { code: ConnectivityAgentErrorCode.CONFLICT },
      ]);
    }

    await revalidateAgentAuth(
      this.auth,
      {
        authorizationRowId: input.authorizationRowId ?? null,
        authorizationVersion: input.authorizationVersion ?? null,
        provisioningRequestId: input.provisioningRequestId ?? null,
      },
      input.provisioningRequestId ?? null,
    );

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const created = await this.repo.createAgent(
        {
          agentCode,
          displayName: input.displayName.trim(),
          tenantId: input.tenantId ?? null,
          productId: input.productId ?? null,
          deploymentProfileCode: input.deploymentProfileCode ?? null,
          agentStatus: AgentStatus.PENDING,
          publicKeyRef: input.publicKeyRef.trim(),
          certificateRef: input.certificateRef ?? null,
          outboundOnly: true,
          lastSeenAt: null,
          revokedAt: null,
          revocationReason: null,
          metadata: {
            ...(input.metadata ?? {}),
            authorizationRowId: input.authorizationRowId ?? null,
            authorizationVersion: input.authorizationVersion ?? null,
            provisioningRequestId: input.provisioningRequestId ?? null,
            note: 'P7.14 — outbound_only; vault public_key_ref; register via P7.4',
          },
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'CONNECTIVITY_AGENT',
          resourceId: created.id,
          tenantId: created.tenantId,
          action: 'CREATE',
          actorId: input.actorId,
          toStatus: String(created.agentStatus),
          details: { agentCode: created.agentCode, outboundOnly: true },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.agent.created',
          actorId: input.actorId,
          subjectType: 'CONNECTIVITY_AGENT',
          subjectId: created.id,
          details: { agentCode: created.agentCode },
        },
        client,
      );
      return created;
    });
  }
}

export class RequestConnectivityAgentRegisterUseCase {
  constructor(
    private readonly repo: ConnectivityAgentRepositoryPort,
    private readonly wfRepo: WorkflowRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
    private readonly createInstance: WorkflowCreateStart,
    private readonly startWorkflow: WorkflowStart,
  ) {}

  async execute(input: {
    actorId: string;
    correlationId: string;
    idempotencyKey: string;
    agentId: string;
    provisioningRequestId?: string | null;
    reason?: string | null;
  }) {
    const wfExisting = await this.wfRepo.getInstanceByIdempotencyKey(input.idempotencyKey);
    if (wfExisting) {
      return { workflow: wfExisting, agent: await this.repo.getAgent(input.agentId) };
    }

    const agent = await this.repo.getAgent(input.agentId);
    if (!agent) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Connectivity agent not found');
    }

    const guard = canRegisterAgent({
      agentStatus: String(agent.agentStatus),
      outboundOnly: true,
      publicKeyRef: agent.publicKeyRef,
    });
    if (!guard.allowed) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, guard.reason, [{ code: guard.code }]);
    }

    const meta = agent.metadata ?? {};
    const authorizationRowId =
      typeof meta.authorizationRowId === 'string' ? meta.authorizationRowId : null;
    const authorizationVersion =
      typeof meta.authorizationVersion === 'number' ? meta.authorizationVersion : null;
    const provisioningRequestId =
      input.provisioningRequestId ??
      (typeof meta.provisioningRequestId === 'string' ? meta.provisioningRequestId : null);

    await revalidateAgentAuth(
      this.auth,
      { authorizationRowId, authorizationVersion, provisioningRequestId },
      provisioningRequestId,
    );

    const definition = await ensureConnectivityAgentDefinition(
      this.wfRepo,
      this.outbox,
      this.audit,
      input.actorId,
      'register',
    );

    const instance = await this.createInstance.execute({
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      definitionId: definition.id,
      workflowType: 'agent.register',
      provisioningRequestId,
      businessReference: agent.id,
      inputSnapshot: {
        agentId: agent.id,
        agentCode: agent.agentCode,
        tenantId: agent.tenantId,
        productId: agent.productId,
        publicKeyRef: agent.publicKeyRef,
        outboundOnly: true,
        authorizationRowId,
        authorizationVersion,
        provisioningRequestId,
        actorId: input.actorId,
        correlationId: input.correlationId,
        reason: input.reason ?? null,
        operation: 'REGISTER',
      },
    });

    await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      await this.repo.updateAgent(
        agent.id,
        {
          agentStatus: AgentStatus.REGISTERING,
          outboundOnly: true,
          metadata: { ...agent.metadata, registrationWorkflowId: instance.id },
        },
        agent.version,
        input.actorId,
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'CONNECTIVITY_AGENT',
          resourceId: agent.id,
          tenantId: agent.tenantId,
          fromStatus: String(agent.agentStatus),
          toStatus: AgentStatus.REGISTERING,
          action: 'LAUNCH_REGISTER',
          reason: input.reason ?? null,
          actorId: input.actorId,
          details: { workflowId: instance.id },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.agent.register.requested',
          actorId: input.actorId,
          subjectType: 'CONNECTIVITY_AGENT',
          subjectId: agent.id,
          details: { workflowId: instance.id },
        },
        client,
      );
    });

    const started = await this.startWorkflow.execute({
      actorId: input.actorId,
      workflowId: instance.id,
    });
    return { workflow: started, agent: await this.repo.getAgent(agent.id) };
  }
}

export class RequestConnectivityAgentCommandUseCase {
  constructor(
    private readonly repo: ConnectivityAgentRepositoryPort,
    private readonly wfRepo: WorkflowRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
    private readonly createInstance: WorkflowCreateStart,
    private readonly startWorkflow: WorkflowStart,
  ) {}

  async execute(input: {
    actorId: string;
    correlationId: string;
    idempotencyKey: string;
    agentId: string;
    commandType: string;
    nonce: string;
    payloadRef?: string | null;
    signatureRef?: string | null;
    expiresAt?: Date | null;
    provisioningRequestId?: string | null;
    authorizationRowId?: string | null;
    authorizationVersion?: number | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const wfExisting = await this.wfRepo.getInstanceByIdempotencyKey(input.idempotencyKey);
    if (wfExisting) {
      return { workflow: wfExisting, agent: await this.repo.getAgent(input.agentId) };
    }

    const agent = await this.repo.getAgent(input.agentId);
    if (!agent) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Connectivity agent not found');
    }

    const existingNonce = await this.repo.getCommandByNonce(agent.id, input.nonce);
    const guard = canIssueCommand({
      agentStatus: String(agent.agentStatus),
      outboundOnly: agent.outboundOnly,
      nonce: input.nonce,
      existingNonceCommand: existingNonce,
    });
    if (!guard.allowed) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, guard.reason, [{ code: guard.code }]);
    }

    const meta = agent.metadata ?? {};
    const authorizationRowId =
      input.authorizationRowId ??
      (typeof meta.authorizationRowId === 'string' ? meta.authorizationRowId : null);
    const authorizationVersion =
      input.authorizationVersion ??
      (typeof meta.authorizationVersion === 'number' ? meta.authorizationVersion : null);
    const provisioningRequestId =
      input.provisioningRequestId ??
      (typeof meta.provisioningRequestId === 'string' ? meta.provisioningRequestId : null);

    await revalidateAgentAuth(
      this.auth,
      { authorizationRowId, authorizationVersion, provisioningRequestId },
      provisioningRequestId,
    );

    const command = await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const created = await this.repo.createCommand(
        {
          agentId: agent.id,
          commandType: input.commandType.trim(),
          commandStatus: AgentCommandStatus.PENDING,
          nonce: input.nonce.trim().toLowerCase(),
          payloadRef: input.payloadRef ?? null,
          signatureRef: input.signatureRef ?? null,
          provisioningRequestId,
          authorizationRowId,
          authorizationVersion,
          workflowId: null,
          expiresAt: input.expiresAt ?? null,
          ackedAt: null,
          finishedAt: null,
          errorCode: null,
          errorMessage: null,
          metadata: {
            ...(input.metadata ?? {}),
            outboundOnly: true,
            note: 'P7.14 — nonce anti-replay; signed command via P7.4',
          },
          createdBy: input.actorId,
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'AGENT_COMMAND',
          resourceId: created.id,
          tenantId: agent.tenantId,
          action: 'CREATE',
          actorId: input.actorId,
          toStatus: String(created.commandStatus),
          details: { agentId: agent.id, nonce: created.nonce },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.agent.command.created',
          actorId: input.actorId,
          subjectType: 'AGENT_COMMAND',
          subjectId: created.id,
          details: { agentId: agent.id, commandType: created.commandType },
        },
        client,
      );
      return created;
    });

    const definition = await ensureConnectivityAgentDefinition(
      this.wfRepo,
      this.outbox,
      this.audit,
      input.actorId,
      'command',
    );

    const instance = await this.createInstance.execute({
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      definitionId: definition.id,
      workflowType: 'agent.command',
      provisioningRequestId,
      businessReference: command.id,
      inputSnapshot: {
        agentId: agent.id,
        commandId: command.id,
        commandType: command.commandType,
        nonce: command.nonce,
        payloadRef: command.payloadRef,
        signatureRef: command.signatureRef,
        outboundOnly: true,
        tenantId: agent.tenantId,
        productId: agent.productId,
        authorizationRowId,
        authorizationVersion,
        provisioningRequestId,
        actorId: input.actorId,
        correlationId: input.correlationId,
        reason: input.reason ?? null,
        operation: 'COMMAND',
      },
    });

    await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      await this.repo.updateCommand(command.id, { workflowId: instance.id }, client);
      await this.repo.appendHistory(
        {
          resourceType: 'AGENT_COMMAND',
          resourceId: command.id,
          tenantId: agent.tenantId,
          action: 'LAUNCH_COMMAND',
          reason: input.reason ?? null,
          actorId: input.actorId,
          details: { workflowId: instance.id },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.agent.command.requested',
          actorId: input.actorId,
          subjectType: 'AGENT_COMMAND',
          subjectId: command.id,
          details: { workflowId: instance.id, agentId: agent.id },
        },
        client,
      );
    });

    const started = await this.startWorkflow.execute({
      actorId: input.actorId,
      workflowId: instance.id,
    });
    return {
      workflow: started,
      agent: await this.repo.getAgent(agent.id),
      command: await this.repo.getCommand(command.id),
    };
  }
}

export class RequestConnectivityAgentRevokeUseCase {
  constructor(
    private readonly repo: ConnectivityAgentRepositoryPort,
    private readonly wfRepo: WorkflowRepositoryPort,
    private readonly auth: WorkflowAuthorizationPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
    private readonly createInstance: WorkflowCreateStart,
    private readonly startWorkflow: WorkflowStart,
  ) {}

  async execute(input: {
    actorId: string;
    correlationId: string;
    idempotencyKey: string;
    agentId: string;
    reason?: string | null;
    provisioningRequestId?: string | null;
  }) {
    const wfExisting = await this.wfRepo.getInstanceByIdempotencyKey(input.idempotencyKey);
    if (wfExisting) {
      return { workflow: wfExisting, agent: await this.repo.getAgent(input.agentId) };
    }

    const agent = await this.repo.getAgent(input.agentId);
    if (!agent) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Connectivity agent not found');
    }

    const guard = canRevokeAgent(String(agent.agentStatus));
    if (!guard.allowed) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, guard.reason, [{ code: guard.code }]);
    }

    const meta = agent.metadata ?? {};
    const authorizationRowId =
      typeof meta.authorizationRowId === 'string' ? meta.authorizationRowId : null;
    const authorizationVersion =
      typeof meta.authorizationVersion === 'number' ? meta.authorizationVersion : null;
    const provisioningRequestId =
      input.provisioningRequestId ??
      (typeof meta.provisioningRequestId === 'string' ? meta.provisioningRequestId : null);

    await revalidateAgentAuth(
      this.auth,
      { authorizationRowId, authorizationVersion, provisioningRequestId },
      provisioningRequestId,
    );

    const definition = await ensureConnectivityAgentDefinition(
      this.wfRepo,
      this.outbox,
      this.audit,
      input.actorId,
      'revoke',
    );

    const instance = await this.createInstance.execute({
      actorId: input.actorId,
      idempotencyKey: input.idempotencyKey,
      definitionId: definition.id,
      workflowType: 'agent.revoke',
      provisioningRequestId,
      businessReference: agent.id,
      inputSnapshot: {
        agentId: agent.id,
        agentCode: agent.agentCode,
        tenantId: agent.tenantId,
        productId: agent.productId,
        outboundOnly: true,
        authorizationRowId,
        authorizationVersion,
        provisioningRequestId,
        actorId: input.actorId,
        correlationId: input.correlationId,
        reason: input.reason ?? 'REVOKED',
        revocationReason: input.reason ?? 'REVOKED',
        operation: 'REVOKE',
      },
    });

    await this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      await this.repo.appendHistory(
        {
          resourceType: 'CONNECTIVITY_AGENT',
          resourceId: agent.id,
          tenantId: agent.tenantId,
          fromStatus: String(agent.agentStatus),
          toStatus: AgentStatus.REVOKING,
          action: 'LAUNCH_REVOKE',
          reason: input.reason ?? null,
          actorId: input.actorId,
          details: { workflowId: instance.id, failClosed: true },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.agent.revoke.requested',
          actorId: input.actorId,
          subjectType: 'CONNECTIVITY_AGENT',
          subjectId: agent.id,
          details: { workflowId: instance.id },
        },
        client,
      );
    });

    const started = await this.startWorkflow.execute({
      actorId: input.actorId,
      workflowId: instance.id,
    });
    return { workflow: started, agent: await this.repo.getAgent(agent.id) };
  }
}
