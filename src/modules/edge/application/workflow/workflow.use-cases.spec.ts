import { describe, expect, it, vi } from 'vitest';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { assertFencingToken } from '../../domain/workflow/fencing.js';
import { WorkflowHandlerRegistry } from '../../infrastructure/workflow/workflow-handler.registry.js';
import { CreateWorkflowDefinitionUseCase } from './workflow.use-cases.js';

describe('workflow application', () => {
  it('registers noop + product_control foundation + unimplemented mutative handlers', async () => {
    const registry = new WorkflowHandlerRegistry();
    expect(registry.has('noop:approve')).toBe(true);
    expect(registry.has('noop:checkpoint')).toBe(true);
    expect(registry.has('product_control.handshake')).toBe(true);
    expect(registry.has('unavailable:p75')).toBe(true);
    expect(registry.has('unavailable:p76')).toBe(true);
    expect(registry.has('unavailable:p77')).toBe(true);
    const outcome = await registry.get('unavailable:p75')!.execute({
      workflowId: 'w',
      stepId: 's',
      stepKey: 'x',
      handlerKey: 'unavailable:p75',
      fencingToken: 1,
      attemptNumber: 1,
      inputSnapshot: {},
      workflowInput: {},
      correlationId: 'c',
      workerId: 'worker',
    });
    expect(outcome.status).toBe('FAILED');
    if (outcome.status === 'FAILED') {
      expect(outcome.errorClass).toBe('OPERATION_NOT_IMPLEMENTED');
    }
  });

  it('rejects stale fencing tokens', () => {
    expect(() => assertFencingToken(2, 1)).toThrow(DomainError);
  });

  it('create definition validates snapshot before persist', async () => {
    const repo = {
      getDefinitionByCode: vi.fn().mockResolvedValue(null),
      createDefinition: vi.fn(),
      appendHistory: vi.fn(),
    };
    const outbox = {
      runWithOutbox: vi.fn(async (_t: string, fn: (c: unknown, e: unknown) => Promise<unknown>) =>
        fn({}, vi.fn()),
      ),
    };
    const audit = { create: vi.fn().mockResolvedValue(undefined) };
    const uc = new CreateWorkflowDefinitionUseCase(repo as never, outbox as never, audit as never);
    await expect(
      uc.execute({
        actorId: 'a',
        code: 'bad',
        name: 'Bad',
        snapshot: { steps: [{ key: 'a', type: 'H', handlerKey: 'live:bb' }] },
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    expect(repo.createDefinition).not.toHaveBeenCalled();
  });
});
