import { describe, expect, it } from 'vitest';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { evaluateExpression, validateDefinition } from './workflow-definition.js';
import type { WorkflowDefinitionSnapshot } from './workflow.types.js';

const base = (): WorkflowDefinitionSnapshot => ({
  steps: [
    { key: 'a', type: 'HANDLER', handlerKey: 'noop:checkpoint' },
    { key: 'b', type: 'HANDLER', handlerKey: 'noop:approve', dependsOn: ['a'] },
  ],
});

describe('validateDefinition', () => {
  it('accepts a valid linear definition', () => {
    expect(() => validateDefinition(base())).not.toThrow();
  });

  it('rejects cycles', () => {
    const snap: WorkflowDefinitionSnapshot = {
      steps: [
        { key: 'a', type: 'HANDLER', handlerKey: 'noop:checkpoint', dependsOn: ['b'] },
        { key: 'b', type: 'HANDLER', handlerKey: 'noop:checkpoint', dependsOn: ['a'] },
      ],
    };
    expect(() => validateDefinition(snap)).toThrow(DomainError);
  });

  it('rejects missing step references', () => {
    expect(() =>
      validateDefinition({
        steps: [
          {
            key: 'a',
            type: 'HANDLER',
            handlerKey: 'noop:checkpoint',
            dependsOn: ['missing'],
          },
        ],
      }),
    ).toThrow(DomainError);
  });

  it('rejects unknown handlers', () => {
    const snap: WorkflowDefinitionSnapshot = {
      steps: [{ key: 'a', type: 'HANDLER', handlerKey: 'live:provision' }],
    };
    try {
      validateDefinition(snap);
      expect.fail('expected throw');
    } catch (e) {
      expect((e as DomainError).code).toBe(ErrorCode.VALIDATION_ERROR);
    }
  });

  it('rejects unknown compensation handlers', () => {
    expect(() =>
      validateDefinition({
        steps: [
          {
            key: 'a',
            type: 'HANDLER',
            handlerKey: 'noop:checkpoint',
            compensationHandlerKey: 'comp.missing',
          },
        ],
      }),
    ).toThrow(DomainError);
  });

  it('rejects invalid timeouts and retry limits', () => {
    expect(() =>
      validateDefinition({
        ...base(),
        retryDefaults: { maxAttempts: 0 },
      }),
    ).toThrow(DomainError);
    expect(() =>
      validateDefinition({
        ...base(),
        timeoutDefaultsMs: 0,
      }),
    ).toThrow(DomainError);
  });

  it('rejects unsupported expression operators', () => {
    const snap: WorkflowDefinitionSnapshot = {
      steps: [
        {
          key: 'a',
          type: 'HANDLER',
          handlerKey: 'noop:checkpoint',
          skipIf: { op: 'regex' as never, path: 'x' },
        },
      ],
    };
    expect(() => validateDefinition(snap)).toThrow(DomainError);
  });

  it('allows registered future unavailable provisioning handlers', () => {
    expect(() =>
      validateDefinition({
        steps: [
          {
            key: 'provision',
            type: 'HANDLER',
            handlerKey: 'p7.5.product_control.provision',
          },
        ],
      }),
    ).not.toThrow();
  });
});

describe('evaluateExpression', () => {
  it('supports eq/neq/exists/in only', () => {
    const ctx = { env: 'prod', tags: ['a'], nested: { n: 1 } };
    expect(evaluateExpression({ op: 'eq', path: 'env', value: 'prod' }, ctx)).toBe(true);
    expect(evaluateExpression({ op: 'neq', path: 'env', value: 'dev' }, ctx)).toBe(true);
    expect(evaluateExpression({ op: 'exists', path: 'nested.n' }, ctx)).toBe(true);
    expect(evaluateExpression({ op: 'exists', path: 'missing' }, ctx)).toBe(false);
    expect(evaluateExpression({ op: 'in', path: 'env', value: ['prod', 'stage'] }, ctx)).toBe(
      true,
    );
  });
});
