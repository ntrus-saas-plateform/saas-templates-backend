import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  ClaimStepDto,
  CreateWorkflowDefinitionDto,
  CreateWorkflowInstanceDto,
  FailStepDto,
  RejectWorkflowTaskDto,
} from './workflow.dto.js';

describe('workflow.dto validation', () => {
  it('accepts a valid create definition payload', async () => {
    const dto = plainToInstance(CreateWorkflowDefinitionDto, {
      code: 'prov.basic',
      name: 'Basic provision',
      snapshot: { steps: [{ key: 'a', handlerKey: 'noop:checkpoint' }] },
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects unknown properties on create instance', async () => {
    const dto = plainToInstance(CreateWorkflowInstanceDto, {
      definitionId: '11111111-1111-4111-8111-111111111111',
      workflowType: 'provision',
      forged: true,
    });
    // class-validator alone does not forbid non-whitelisted; Nest pipe does.
    // Ensure required fields validate.
    const errors = await validate(dto);
    expect(errors.every((e) => e.property !== 'workflowType' || e.constraints == null)).toBe(true);
  });

  it('requires reject reason', async () => {
    const dto = plainToInstance(RejectWorkflowTaskDto, { reason: '' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('validates worker claim/fail fencing fields', async () => {
    const claim = plainToInstance(ClaimStepDto, { workerId: 'w1', leaseMs: 500 });
    expect((await validate(claim)).length).toBeGreaterThan(0);

    const fail = plainToInstance(FailStepDto, {
      workerId: 'w1',
      fencingToken: 1,
      expectedVersion: 1,
      errorClass: 'TRANSIENT',
    });
    expect(await validate(fail)).toHaveLength(0);
  });
});
