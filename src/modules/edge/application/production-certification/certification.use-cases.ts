import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { AuditEventRepositoryPort } from '../../domain/ports/audit-event-repository.port.js';
import { EDGE_P7_OUTBOX_TENANT } from '../../domain/provisioning/provisioning.events.js';
import {
  canAssemble,
  canAttachEvidence,
  canCertify,
  canCreatePackage,
  canRevoke,
  defaultEvidenceKeySpecs,
} from '../../domain/production-certification/certification-policy.js';
import type { CertificationRepositoryPort } from '../../domain/production-certification/certification-repository.port.js';
import {
  CertificationErrorCode,
  CertificationEvidenceItemStatus,
  CertificationPackageStatus,
  CertificationRunOperation,
  CertificationRunOutcome,
} from '../../domain/production-certification/certification.types.js';
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
      'Durable audit required for certification mutation',
      [{ eventType: input.eventType }],
      err instanceof Error ? err : undefined,
    );
  }
}

// ---------------------------------------------------------------------------
// Workflow definitions (P7.15)
// ---------------------------------------------------------------------------

export const CERTIFICATION_WORKFLOW_DEFINITIONS = {
  assemble: {
    code: 'p715.certification.assemble',
    name: 'P7.15 Certification Assemble',
    description:
      'Revalidate auth, assemble default evidence manifest, collect/seed items, evaluate gates, verify',
    snapshot: {
      steps: [
        {
          key: 'revalidate_auth',
          type: 'HANDLER',
          handlerKey: 'certification.revalidate_auth',
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'assemble_manifest',
          type: 'HANDLER',
          handlerKey: 'certification.assemble_manifest',
          dependsOn: ['revalidate_auth'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'collect_evidence',
          type: 'HANDLER',
          handlerKey: 'certification.collect_evidence',
          dependsOn: ['assemble_manifest'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'evaluate_gates',
          type: 'HANDLER',
          handlerKey: 'certification.evaluate_gates',
          dependsOn: ['collect_evidence'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'verify',
          type: 'HANDLER',
          handlerKey: 'certification.verify',
          dependsOn: ['evaluate_gates'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
      ],
    },
  },
  certify: {
    code: 'p715.certification.certify',
    name: 'P7.15 Certification Certify',
    description:
      'Revalidate auth, evaluate gates (fail-closed on required MISSING/FAILED), apply CERTIFIED, verify',
    snapshot: {
      steps: [
        {
          key: 'revalidate_auth',
          type: 'HANDLER',
          handlerKey: 'certification.revalidate_auth',
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'evaluate_gates',
          type: 'HANDLER',
          handlerKey: 'certification.evaluate_gates',
          dependsOn: ['revalidate_auth'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'apply_certify',
          type: 'HANDLER',
          handlerKey: 'certification.apply_certify',
          dependsOn: ['evaluate_gates'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'verify',
          type: 'HANDLER',
          handlerKey: 'certification.verify',
          dependsOn: ['apply_certify'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
      ],
    },
  },
  revoke: {
    code: 'p715.certification.revoke',
    name: 'P7.15 Certification Revoke',
    description: 'Revalidate auth, clear CERTIFIED → REVOKED, verify',
    snapshot: {
      steps: [
        {
          key: 'revalidate_auth',
          type: 'HANDLER',
          handlerKey: 'certification.revalidate_auth',
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
        {
          key: 'apply_revoke',
          type: 'HANDLER',
          handlerKey: 'certification.apply_revoke',
          dependsOn: ['revalidate_auth'],
          maxAttempts: 1,
          timeoutMs: 60_000,
        },
        {
          key: 'verify',
          type: 'HANDLER',
          handlerKey: 'certification.verify',
          dependsOn: ['apply_revoke'],
          maxAttempts: 3,
          timeoutMs: 60_000,
        },
      ],
    },
  },
} as const;

export type CertificationWorkflowKind = keyof typeof CERTIFICATION_WORKFLOW_DEFINITIONS;

const WORKFLOW_RETRY_DEFAULTS = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 15_000,
  multiplier: 2,
  jitterRatio: 0.2,
};

export async function ensureCertificationDefinition(
  repo: WorkflowRepositoryPort,
  outbox: ControlPlaneOutboxTransactionService,
  _audit: AuditEventRepositoryPort,
  actorId: string,
  kind: CertificationWorkflowKind = 'assemble',
): Promise<{ id: string }> {
  const def = CERTIFICATION_WORKFLOW_DEFINITIONS[kind];
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
        domain: 'certification',
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

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export class ListCertificationUseCase {
  constructor(private readonly repo: CertificationRepositoryPort) {}

  packages(filter: {
    status?: string;
    productId?: string;
    deploymentProfileCode?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listPackages(filter);
  }
  package(id: string) {
    return this.repo.getPackage(id);
  }
  evidenceItems(packageId: string) {
    return this.repo.listEvidenceItems({ packageId, limit: 200 });
  }
  runs(filter: {
    packageId?: string;
    operation?: string;
    outcome?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.listRuns(filter);
  }
  evidence(filter: { packageId?: string; workflowId?: string; limit?: number }) {
    return this.repo.listEvidence(filter);
  }
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

async function revalidateCertificationAuth(
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
        'Certification package has no bound P7.1 authorization (fail-closed)',
        [{ code: CertificationErrorCode.AUTHORIZATION_FAILED }],
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
        'P7.1 authorization not valid for certification operation',
        [{ code: CertificationErrorCode.AUTHORIZATION_FAILED }],
      );
    }
    return revalidated;
  }
  return null;
}

export class CreateCertificationPackageUseCase {
  constructor(
    private readonly repo: CertificationRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name: string;
    description?: string | null;
    productId?: string | null;
    deploymentProfileCode?: string | null;
    scope?: Record<string, unknown>;
    provisioningRequestId?: string | null;
    authorizationRowId?: string | null;
    authorizationVersion?: number | null;
    metadata?: Record<string, unknown>;
  }) {
    const code = input.code.trim().toLowerCase();
    const guard = canCreatePackage(code);
    if (!guard.allowed) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, guard.reason, [{ code: guard.code }]);
    }
    const existing = await this.repo.getPackageByCode(code);
    if (existing) {
      throw new DomainError(ErrorCode.CONFLICT, 'Certification package code already exists', [
        { code: CertificationErrorCode.CONFLICT },
      ]);
    }

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const created = await this.repo.createPackage(
        {
          code,
          name: input.name.trim(),
          description: input.description ?? null,
          productId: input.productId ?? null,
          deploymentProfileCode: input.deploymentProfileCode ?? null,
          packageStatus: CertificationPackageStatus.DRAFT,
          scope: input.scope ?? {},
          gateResults: {},
          evidenceManifest: [],
          certifiedAt: null,
          revokedAt: null,
          revocationReason: null,
          workflowId: null,
          provisioningRequestId: input.provisioningRequestId ?? null,
          authorizationRowId: input.authorizationRowId ?? null,
          authorizationVersion: input.authorizationVersion ?? null,
          metadata: {
            ...(input.metadata ?? {}),
            note: 'P7.15 — cannot CERTIFY if required evidence MISSING/FAILED; revoke clears CERTIFIED',
          },
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
        client,
      );
      await this.repo.appendHistory(
        {
          resourceType: 'CERTIFICATION_PACKAGE',
          resourceId: created.id,
          action: 'CREATE',
          actorId: input.actorId,
          toStatus: created.packageStatus,
          details: { code: created.code },
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.certification.package.created',
          actorId: input.actorId,
          subjectType: 'CERTIFICATION_PACKAGE',
          subjectId: created.id,
          details: { code: created.code },
        },
        client,
      );
      return created;
    });
  }
}

export class AttachCertificationEvidenceUseCase {
  constructor(
    private readonly repo: CertificationRepositoryPort,
    private readonly outbox: ControlPlaneOutboxTransactionService,
    private readonly audit: AuditEventRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    packageId: string;
    evidenceKey: string;
    phaseCode?: string;
    required?: boolean;
    itemStatus?: string;
    sourceRef?: string | null;
    checksum?: string | null;
    details?: Record<string, unknown>;
  }) {
    const pkg = await this.repo.getPackage(input.packageId);
    if (!pkg) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Certification package not found');
    }
    const guard = canAttachEvidence({ packageStatus: String(pkg.packageStatus) });
    if (!guard.allowed) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, guard.reason, [{ code: guard.code }]);
    }

    const status =
      input.itemStatus ??
      (input.sourceRef
        ? CertificationEvidenceItemStatus.ATTACHED
        : CertificationEvidenceItemStatus.MISSING);

    return this.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
      const item = await this.repo.upsertEvidenceItem(
        {
          packageId: pkg.id,
          evidenceKey: input.evidenceKey.trim(),
          phaseCode: input.phaseCode ?? input.evidenceKey.trim().toUpperCase(),
          required: input.required ?? true,
          itemStatus: status,
          sourceRef: input.sourceRef ?? null,
          checksum: input.checksum ?? null,
          details: input.details ?? {},
          attachedAt: status === CertificationEvidenceItemStatus.MISSING ? null : new Date(),
        },
        client,
      );
      await requireAudit(
        this.audit,
        {
          eventType: 'p7.certification.evidence.attached',
          actorId: input.actorId,
          subjectType: 'CERTIFICATION_EVIDENCE_ITEM',
          subjectId: item.id,
          details: { packageId: pkg.id, evidenceKey: item.evidenceKey, itemStatus: item.itemStatus },
        },
        client,
      );
      return item;
    });
  }
}

async function launchCertificationWorkflow(input: {
  kind: CertificationWorkflowKind;
  operation: CertificationRunOperation;
  actorId: string;
  correlationId: string;
  idempotencyKey: string;
  packageId: string;
  provisioningRequestId?: string | null;
  reason?: string | null;
  repo: CertificationRepositoryPort;
  wfRepo: WorkflowRepositoryPort;
  auth: WorkflowAuthorizationPort;
  outbox: ControlPlaneOutboxTransactionService;
  audit: AuditEventRepositoryPort;
  createInstance: WorkflowCreateStart;
  startWorkflow: WorkflowStart;
  extraSnapshot?: Record<string, unknown>;
}) {
  const wfExisting = await input.wfRepo.getInstanceByIdempotencyKey(input.idempotencyKey);
  if (wfExisting) {
    return { workflow: wfExisting, package: await input.repo.getPackage(input.packageId) };
  }

  const pkg = await input.repo.getPackage(input.packageId);
  if (!pkg) {
    throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Certification package not found');
  }

  const provisioningRequestId =
    input.provisioningRequestId ?? pkg.provisioningRequestId ?? null;
  await revalidateCertificationAuth(input.auth, pkg, provisioningRequestId);

  const definition = await ensureCertificationDefinition(
    input.wfRepo,
    input.outbox,
    input.audit,
    input.actorId,
    input.kind,
  );

  const instance = await input.createInstance.execute({
    actorId: input.actorId,
    idempotencyKey: input.idempotencyKey,
    definitionId: definition.id,
    workflowType: `certification.${input.kind}`,
    provisioningRequestId,
    businessReference: pkg.id,
    inputSnapshot: {
      packageId: pkg.id,
      authorizationRowId: pkg.authorizationRowId,
      authorizationVersion: pkg.authorizationVersion,
      provisioningRequestId,
      actorId: input.actorId,
      correlationId: input.correlationId,
      reason: input.reason ?? null,
      operation: input.operation,
      ...(input.extraSnapshot ?? {}),
    },
  });

  await input.outbox.runWithOutbox(EDGE_P7_OUTBOX_TENANT, async (client) => {
    const run = await input.repo.createRun(
      {
        packageId: pkg.id,
        operation: input.operation,
        workflowId: instance.id,
        outcome: CertificationRunOutcome.PENDING,
        errorCode: null,
        errorMessage: null,
        observedState: {},
        evidence: {},
        startedAt: new Date(),
        finishedAt: null,
        performedBy: input.actorId,
        correlationId: input.correlationId,
      },
      client,
    );
    const nextStatus =
      input.kind === 'assemble'
        ? CertificationPackageStatus.ASSEMBLING
        : pkg.packageStatus;
    await input.repo.updatePackage(
      pkg.id,
      {
        workflowId: instance.id,
        packageStatus: nextStatus,
      },
      pkg.version,
      input.actorId,
      client,
    );
    await input.repo.appendHistory(
      {
        resourceType: 'CERTIFICATION_PACKAGE',
        resourceId: pkg.id,
        fromStatus: String(pkg.packageStatus),
        toStatus: String(nextStatus),
        action: `LAUNCH_${input.operation}`,
        reason: input.reason ?? null,
        actorId: input.actorId,
        details: { workflowId: instance.id, runId: run.id },
      },
      client,
    );
    await requireAudit(
      input.audit,
      {
        eventType: `p7.certification.${input.kind}.requested`,
        actorId: input.actorId,
        subjectType: 'CERTIFICATION_PACKAGE',
        subjectId: pkg.id,
        details: { workflowId: instance.id, runId: run.id },
      },
      client,
    );
  });

  const started = await input.startWorkflow.execute({
    actorId: input.actorId,
    workflowId: instance.id,
  });
  return { workflow: started, package: await input.repo.getPackage(pkg.id) };
}

export class RequestCertificationAssembleUseCase {
  constructor(
    private readonly repo: CertificationRepositoryPort,
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
    packageId: string;
    provisioningRequestId?: string | null;
    reason?: string | null;
    includeOptionalAgents?: boolean;
  }) {
    const pkg = await this.repo.getPackage(input.packageId);
    if (!pkg) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Certification package not found');
    }
    const guard = canAssemble(String(pkg.packageStatus));
    if (!guard.allowed) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, guard.reason, [{ code: guard.code }]);
    }
    return launchCertificationWorkflow({
      kind: 'assemble',
      operation: CertificationRunOperation.ASSEMBLE,
      actorId: input.actorId,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
      packageId: input.packageId,
      provisioningRequestId: input.provisioningRequestId,
      reason: input.reason,
      repo: this.repo,
      wfRepo: this.wfRepo,
      auth: this.auth,
      outbox: this.outbox,
      audit: this.audit,
      createInstance: this.createInstance,
      startWorkflow: this.startWorkflow,
      extraSnapshot: {
        evidenceSpecs: defaultEvidenceKeySpecs({
          includeOptionalAgents: input.includeOptionalAgents === true,
        }),
      },
    });
  }
}

export class RequestCertificationCertifyUseCase {
  constructor(
    private readonly repo: CertificationRepositoryPort,
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
    packageId: string;
    provisioningRequestId?: string | null;
    reason?: string | null;
  }) {
    const pkg = await this.repo.getPackage(input.packageId);
    if (!pkg) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Certification package not found');
    }
    const items = await this.repo.listEvidenceItems({ packageId: pkg.id, limit: 200 });
    const guard = canCertify({
      packageStatus: String(pkg.packageStatus),
      evidenceItems: items,
    });
    if (!guard.allowed) {
      throw new DomainError(
        guard.code === CertificationErrorCode.EVIDENCE_MISSING ||
          guard.code === CertificationErrorCode.EVIDENCE_FAILED
          ? ErrorCode.VALIDATION_ERROR
          : ErrorCode.VALIDATION_ERROR,
        guard.reason,
        [{ code: guard.code }],
      );
    }
    return launchCertificationWorkflow({
      kind: 'certify',
      operation: CertificationRunOperation.CERTIFY,
      actorId: input.actorId,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
      packageId: input.packageId,
      provisioningRequestId: input.provisioningRequestId,
      reason: input.reason,
      repo: this.repo,
      wfRepo: this.wfRepo,
      auth: this.auth,
      outbox: this.outbox,
      audit: this.audit,
      createInstance: this.createInstance,
      startWorkflow: this.startWorkflow,
    });
  }
}

export class RequestCertificationRevokeUseCase {
  constructor(
    private readonly repo: CertificationRepositoryPort,
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
    packageId: string;
    provisioningRequestId?: string | null;
    reason?: string | null;
  }) {
    const pkg = await this.repo.getPackage(input.packageId);
    if (!pkg) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Certification package not found');
    }
    const guard = canRevoke(String(pkg.packageStatus));
    if (!guard.allowed) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, guard.reason, [{ code: guard.code }]);
    }
    return launchCertificationWorkflow({
      kind: 'revoke',
      operation: CertificationRunOperation.REVOKE,
      actorId: input.actorId,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
      packageId: input.packageId,
      provisioningRequestId: input.provisioningRequestId,
      reason: input.reason,
      repo: this.repo,
      wfRepo: this.wfRepo,
      auth: this.auth,
      outbox: this.outbox,
      audit: this.audit,
      createInstance: this.createInstance,
      startWorkflow: this.startWorkflow,
      extraSnapshot: { revocationReason: input.reason ?? null },
    });
  }
}
