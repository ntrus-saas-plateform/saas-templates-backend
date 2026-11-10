import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { EDGE_PERMISSIONS_KEY } from '../../../../shared/auth/decorators.js';
import {
  EdgeWorkflowController,
  EdgeWorkflowTasksController,
} from './workflow.controller.js';
import { EdgeWorkflowWorkerController } from './workflow-worker.controller.js';

describe('EdgeWorkflowController authz', () => {
  const cases: Array<{ method: keyof EdgeWorkflowController; permission: string }> = [
    { method: 'listDefinitions', permission: 'platform:workflow_definition:read' },
    { method: 'getDefinition', permission: 'platform:workflow_definition:read' },
    { method: 'createDef', permission: 'platform:workflow_definition:manage' },
    { method: 'validateDef', permission: 'platform:workflow_definition:publish' },
    { method: 'publishDef', permission: 'platform:workflow_definition:publish' },
    { method: 'deprecateDef', permission: 'platform:workflow_definition:publish' },
    { method: 'listDeadLetters', permission: 'platform:workflow:read' },
    { method: 'list', permission: 'platform:workflow:read' },
    { method: 'create', permission: 'platform:workflow:manage' },
    { method: 'get', permission: 'platform:workflow:read' },
    { method: 'history', permission: 'platform:workflow:read' },
    { method: 'steps', permission: 'platform:workflow:read' },
    { method: 'attempts', permission: 'platform:workflow:read' },
    { method: 'checkpoints', permission: 'platform:workflow:read' },
    { method: 'compensations', permission: 'platform:workflow:read' },
    { method: 'startWorkflow', permission: 'platform:workflow:manage' },
    { method: 'pauseWorkflow', permission: 'platform:workflow:pause' },
    { method: 'resumeWorkflow', permission: 'platform:workflow:resume' },
    { method: 'cancelWorkflow', permission: 'platform:workflow:cancel' },
    { method: 'retryWorkflow', permission: 'platform:workflow:retry' },
    { method: 'reconcileWorkflow', permission: 'platform:workflow:reconcile' },
  ];

  it.each(cases)('$method requires $permission', ({ method, permission }) => {
    const meta = Reflect.getMetadata(
      EDGE_PERMISSIONS_KEY,
      EdgeWorkflowController.prototype[method],
    ) as string[] | undefined;
    expect(meta).toEqual([permission]);
  });
});

describe('EdgeWorkflowTasksController authz', () => {
  const cases: Array<{ method: keyof EdgeWorkflowTasksController; permission: string }> = [
    { method: 'list', permission: 'platform:workflow_task:read' },
    { method: 'get', permission: 'platform:workflow_task:read' },
    { method: 'assignTask', permission: 'platform:workflow_task:assign' },
    { method: 'approveTask', permission: 'platform:workflow_task:approve' },
    { method: 'rejectTask', permission: 'platform:workflow_task:reject' },
    { method: 'completeTask', permission: 'platform:workflow_task:approve' },
  ];

  it.each(cases)('$method requires $permission', ({ method, permission }) => {
    const meta = Reflect.getMetadata(
      EDGE_PERMISSIONS_KEY,
      EdgeWorkflowTasksController.prototype[method],
    ) as string[] | undefined;
    expect(meta).toEqual([permission]);
  });
});

describe('EdgeWorkflowWorkerController authz', () => {
  const cases: Array<{ method: keyof EdgeWorkflowWorkerController; permission: string }> = [
    { method: 'listWorkers', permission: 'platform:workflow:read' },
    { method: 'beat', permission: 'platform:workflow:worker' },
    { method: 'claimStep', permission: 'platform:workflow:worker' },
    { method: 'renewLease', permission: 'platform:workflow:worker' },
    { method: 'completeStep', permission: 'platform:workflow:worker' },
    { method: 'failStep', permission: 'platform:workflow:worker' },
  ];

  it.each(cases)('$method requires $permission', ({ method, permission }) => {
    const meta = Reflect.getMetadata(
      EDGE_PERMISSIONS_KEY,
      EdgeWorkflowWorkerController.prototype[method],
    ) as string[] | undefined;
    expect(meta).toEqual([permission]);
  });
});
