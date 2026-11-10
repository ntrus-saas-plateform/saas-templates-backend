import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { runTestcontainers } from '../helpers/testcontainers-env.js';
import { applyControlPlaneMigrations } from '../helpers/control-plane-migrate.js';
import { DomainError, ErrorCode } from '../../src/core/domain/errors/domain-error.js';
import type { ControlPlaneTransactionManagerPort } from '../../src/core/domain/ports/control-plane-transaction-manager.port.js';
import type { ControlPlaneOutboxStorePort } from '../../src/core/domain/ports/control-plane-outbox.port.js';
import { ControlPlaneOutboxTransactionService } from '../../src/shared/messaging/control-plane-outbox-transaction.service.js';
import { PgControlPlaneOutboxStore } from '../../src/shared/messaging/pg-control-plane-outbox.store.js';
import { PgAuditEventRepository } from '../../src/modules/edge/infrastructure/persistence/pg-audit-event.repository.js';
import { PgWorkflowRepository } from '../../src/modules/edge/infrastructure/workflow/pg-workflow.repository.js';
import {
  ApproveHumanTaskUseCase,
  ClaimStepUseCase,
  CompleteStepUseCase,
  CreateWorkflowDefinitionUseCase,
  CreateWorkflowInstanceUseCase,
  PublishWorkflowDefinitionUseCase,
  StartCompensationUseCase,
  StartWorkflowUseCase,
  ValidateWorkflowDefinitionUseCase,
} from '../../src/modules/edge/application/workflow/workflow.use-cases.js';
import { EDGE_P7_OUTBOX_TENANT } from '../../src/modules/edge/domain/provisioning/provisioning.events.js';
import {
  HumanTaskStatus,
  HumanTaskType,
  WorkflowDefinitionStatus,
  WorkflowInstanceState,
  WorkflowStepStatus,
} from '../../src/modules/edge/domain/workflow/workflow.types.js';
import { assertFencingToken } from '../../src/modules/edge/domain/workflow/fencing.js';
import { compensationOrder } from '../../src/modules/edge/domain/workflow/saga-coordinator.js';

const ACTOR = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe.skipIf(!runTestcontainers)('P7.4 workflow transactional atomicity (Testcontainers)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: pg.Pool;
  let seq = 0;

  const cpDb = { getPool: () => pool };

  function buildTxManager(): ControlPlaneTransactionManagerPort {
    return {
      async runInTransaction<T>(fn: (client: unknown) => Promise<T>): Promise<T> {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await fn(client);
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      },
    };
  }

  function buildOutbox() {
    const store = new PgControlPlaneOutboxStore({
      getControlPlanePool: () => pool,
    } as never);
    return new ControlPlaneOutboxTransactionService(buildTxManager(), store as ControlPlaneOutboxStorePort);
  }

  function buildRepo() {
    return new PgWorkflowRepository(cpDb as never);
  }

  function buildAudit() {
    return new PgAuditEventRepository(cpDb as never);
  }

  async function counts() {
    const [instances, history, audit, outbox, steps] = await Promise.all([
      pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM edge_p7_workflow_instances`),
      pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM edge_p7_workflow_history`),
      pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM edge_audit_events`),
      pool.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM control_plane_outbox_events WHERE tenant_id = $1`,
        [EDGE_P7_OUTBOX_TENANT],
      ),
      pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM edge_p7_workflow_steps`),
    ]);
    return {
      instances: Number(instances.rows[0]?.c ?? 0),
      history: Number(history.rows[0]?.c ?? 0),
      audit: Number(audit.rows[0]?.c ?? 0),
      outbox: Number(outbox.rows[0]?.c ?? 0),
      steps: Number(steps.rows[0]?.c ?? 0),
    };
  }

  const authPort = {
    getWorkflowReadyRequest: async () => null,
    isAuthorizationStillValid: async () => true,
    revalidateBoundAuthorization: async () => null,
  };

  const placementPort = {
    getWorkflowReadyPlacement: async () => null,
    validateConfirmedPlacement: async () =>
      ({ ok: false as const, reason: 'DECISION_NOT_FOUND' as const }),
  };

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    pool = new pg.Pool({ connectionString: container.getConnectionUri() });
    await applyControlPlaneMigrations(pool);
    // Edge control-plane outbox tenants are logical strings (edge-control-plane),
    // while migration 021 typed tenant_id as UUID FK. Loosen for TX proof only.
    await pool.query(`
      ALTER TABLE control_plane_outbox_events
        DROP CONSTRAINT IF EXISTS control_plane_outbox_events_tenant_id_fkey;
      ALTER TABLE control_plane_outbox_events
        ALTER COLUMN tenant_id TYPE TEXT USING tenant_id::text;
    `);
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  beforeEach(async () => {
    await pool.query(`
      TRUNCATE edge_p7_workflow_attempts, edge_p7_workflow_checkpoints, edge_p7_workflow_compensations,
               edge_p7_workflow_human_tasks, edge_p7_workflow_dead_letters, edge_p7_workflow_history,
               edge_p7_workflow_steps, edge_p7_workflow_instances, edge_p7_workflow_definition_versions,
               edge_p7_workflow_definitions, edge_p7_workflow_worker_registry,
               edge_audit_events, control_plane_outbox_events
      RESTART IDENTITY CASCADE
    `);
  });

  async function publishDefinition() {
    seq += 1;
    const repo = buildRepo();
    const outbox = buildOutbox();
    const audit = buildAudit();
    const create = new CreateWorkflowDefinitionUseCase(repo, outbox, audit);
    const validate = new ValidateWorkflowDefinitionUseCase(repo, outbox, audit);
    const publish = new PublishWorkflowDefinitionUseCase(repo, outbox, audit);
    const created = await create.execute({
      actorId: ACTOR,
      code: `wf-${seq}`,
      name: `Workflow ${seq}`,
      snapshot: {
        steps: [
          {
            key: 'checkpoint',
            type: 'HANDLER',
            handlerKey: 'noop:checkpoint',
            compensationHandlerKey: 'noop:checkpoint',
          },
          {
            key: 'approve',
            type: 'HANDLER',
            handlerKey: 'noop:approve',
            dependsOn: ['checkpoint'],
            compensationHandlerKey: 'noop:checkpoint',
          },
        ],
      },
    });
    await validate.execute({ actorId: ACTOR, definitionId: created.definition.id });
    const published = await publish.execute({
      actorId: ACTOR,
      definitionId: created.definition.id,
    });
    return published.definition;
  }

  it('atomically creates a workflow instance with steps/history/audit/outbox', async () => {
    const def = await publishDefinition();
    const before = await counts();
    const create = new CreateWorkflowInstanceUseCase(
      buildRepo(),
      authPort,
      placementPort,
      buildOutbox(),
      buildAudit(),
    );
    const instance = await create.execute({
      actorId: ACTOR,
      idempotencyKey: `idem-${seq}`,
      definitionId: def.id,
      workflowType: 'test.provision',
    });
    expect(instance.state).toBe(WorkflowInstanceState.CREATED);
    const after = await counts();
    expect(after.instances).toBe(before.instances + 1);
    expect(after.steps).toBe(before.steps + 2);
    expect(after.history).toBeGreaterThan(before.history);
    expect(after.audit).toBeGreaterThan(before.audit);
    expect(after.outbox).toBeGreaterThan(before.outbox);
  });

  it('rolls back instance when audit fails', async () => {
    const def = await publishDefinition();
    const before = await counts();
    const failingAudit = {
      create: async () => {
        throw new Error('audit down');
      },
    };
    const create = new CreateWorkflowInstanceUseCase(
      buildRepo(),
      authPort,
      placementPort,
      buildOutbox(),
      failingAudit as never,
    );
    await expect(
      create.execute({
        actorId: ACTOR,
        idempotencyKey: `idem-fail-${seq}`,
        definitionId: def.id,
        workflowType: 'test.provision',
      }),
    ).rejects.toBeInstanceOf(DomainError);
    const after = await counts();
    expect(after.instances).toBe(before.instances);
    expect(after.outbox).toBe(before.outbox);
  });

  it('two workers claim same step — exactly one wins', async () => {
    const def = await publishDefinition();
    const repo = buildRepo();
    const outbox = buildOutbox();
    const audit = buildAudit();
    const create = new CreateWorkflowInstanceUseCase(
      repo,
      authPort,
      placementPort,
      outbox,
      audit,
    );
    const instance = await create.execute({
      actorId: ACTOR,
      idempotencyKey: `idem-claim-${seq}`,
      definitionId: def.id,
      workflowType: 'test.provision',
    });
    await new StartWorkflowUseCase(
      repo,
      authPort,
      placementPort,
      outbox,
      audit,
    ).execute({ actorId: ACTOR, workflowId: instance.id });

    const workerA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
    const workerB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
    const claim = new ClaimStepUseCase(repo, outbox, audit);
    const [a, b] = await Promise.all([
      claim.execute({ workerId: workerA, leaseMs: 30_000 }),
      claim.execute({ workerId: workerB, leaseMs: 30_000 }),
    ]);
    const wins = [a, b].filter(Boolean);
    expect(wins).toHaveLength(1);
    expect(wins[0]!.step.status).toBe(WorkflowStepStatus.CLAIMED);
    expect(wins[0]!.step.fencingToken).toBe(1);
  });

  it('rejects stale fencing on complete', async () => {
    const def = await publishDefinition();
    const repo = buildRepo();
    const outbox = buildOutbox();
    const audit = buildAudit();
    const create = new CreateWorkflowInstanceUseCase(
      repo,
      authPort,
      placementPort,
      outbox,
      audit,
    );
    const instance = await create.execute({
      actorId: ACTOR,
      idempotencyKey: `idem-fence-${seq}`,
      definitionId: def.id,
      workflowType: 'test.provision',
    });
    await new StartWorkflowUseCase(
      repo,
      authPort,
      placementPort,
      outbox,
      audit,
    ).execute({ actorId: ACTOR, workflowId: instance.id });

    const workerA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
    const claimed = await new ClaimStepUseCase(repo, outbox, audit).execute({
      workerId: workerA,
      leaseMs: 30_000,
    });
    expect(claimed).toBeTruthy();
    expect(() => assertFencingToken(claimed!.step.fencingToken, claimed!.step.fencingToken - 1)).toThrow(
      DomainError,
    );
    await expect(
      new CompleteStepUseCase(repo, outbox, audit).execute({
        actorId: workerA,
        stepId: claimed!.step.id,
        workerId: workerA,
        fencingToken: claimed!.step.fencingToken - 1,
        expectedVersion: claimed!.step.version,
        outputSnapshot: {},
      }),
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
  });

  it('compensation order is reverse dependency', async () => {
    const order = compensationOrder(
      [
        { key: 'a', type: 'H', handlerKey: 'noop:checkpoint', compensationHandlerKey: 'noop:checkpoint' },
        {
          key: 'b',
          type: 'H',
          handlerKey: 'noop:checkpoint',
          dependsOn: ['a'],
          compensationHandlerKey: 'noop:checkpoint',
        },
        {
          key: 'c',
          type: 'H',
          handlerKey: 'noop:checkpoint',
          dependsOn: ['b'],
          compensationHandlerKey: 'noop:checkpoint',
        },
      ],
      ['a', 'b', 'c'],
    );
    expect(order).toEqual(['c', 'b', 'a']);

    const def = await publishDefinition();
    const repo = buildRepo();
    const outbox = buildOutbox();
    const audit = buildAudit();
    const create = new CreateWorkflowInstanceUseCase(
      repo,
      authPort,
      placementPort,
      outbox,
      audit,
    );
    const instance = await create.execute({
      actorId: ACTOR,
      idempotencyKey: `idem-comp-${seq}`,
      definitionId: def.id,
      workflowType: 'test.provision',
    });
    await new StartWorkflowUseCase(repo, authPort, placementPort, outbox, audit).execute({
      actorId: ACTOR,
      workflowId: instance.id,
    });
    const running = await repo.getInstance(instance.id);
    expect(running?.state).toBe(WorkflowInstanceState.RUNNING);
    const steps = await repo.listSteps(instance.id);
    for (const step of steps) {
      const current = await repo.getStep(step.id);
      await repo.updateStep(
        step.id,
        { status: WorkflowStepStatus.SUCCEEDED },
        current!.version,
      );
    }
    await repo.updateInstanceState(
      instance.id,
      { state: WorkflowInstanceState.FAILED, failureDetails: { reason: 'forced' } },
      running!.version,
    );
    const started = await new StartCompensationUseCase(repo, outbox, audit).execute({
      actorId: ACTOR,
      workflowId: instance.id,
    });
    expect(started.order[0]).toBe('approve');
    expect(started.order[1]).toBe('checkpoint');
  });

  it('human approval is atomic with history/audit/outbox', async () => {
    const repo = buildRepo();
    const outbox = buildOutbox();
    const audit = buildAudit();
    const def = await publishDefinition();
    const instance = await new CreateWorkflowInstanceUseCase(
      repo,
      authPort,
      placementPort,
      outbox,
      audit,
    ).execute({
      actorId: ACTOR,
      idempotencyKey: `idem-human-${seq}`,
      definitionId: def.id,
      workflowType: 'test.provision',
    });
    const steps = await repo.listSteps(instance.id);
    const approveStep = steps.find((s) => s.stepKey === 'approve')!;
    await repo.updateStep(
      approveStep.id,
      { status: WorkflowStepStatus.WAITING_APPROVAL },
      approveStep.version,
    );
    const task = await repo.createHumanTask({
      workflowId: instance.id,
      stepId: approveStep.id,
      taskType: HumanTaskType.APPROVAL,
      requiredPermission: 'platform:workflow_task:approve',
      assignee: null,
      dueAt: null,
      contextSnapshot: {},
      instructions: 'approve',
      decision: null,
      decisionReason: null,
      actorId: null,
      status: HumanTaskStatus.OPEN,
    });
    await repo.updateHumanTask(
      task.id,
      { status: HumanTaskStatus.ASSIGNED, assignee: ACTOR },
      task.version,
    );
    const before = await counts();
    const updated = await new ApproveHumanTaskUseCase(repo, outbox, audit).execute({
      actorId: ACTOR,
      taskId: task.id,
      reason: 'ok',
    });
    expect(updated.status).toBe(HumanTaskStatus.APPROVED);
    const after = await counts();
    expect(after.history).toBeGreaterThan(before.history);
    expect(after.audit).toBeGreaterThan(before.audit);
    expect(after.outbox).toBeGreaterThan(before.outbox);
  });
});
