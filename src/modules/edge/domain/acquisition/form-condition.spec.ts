import {
  evaluateCondition,
  evaluateConditionRules,
  parseCondition,
  type ConditionNode,
} from './form-condition.js';

describe('P10 form-condition', () => {
  const answers = {
    companySize: 50,
    country: 'FR',
    plan: 'pro',
    nested: { role: 'admin' },
  };

  it('parses valid condition trees and rejects invalid ones', () => {
    const node: ConditionNode = {
      op: 'AND',
      args: [
        { op: 'EQ', field: 'country', value: 'FR' },
        { op: 'IN', field: 'plan', values: ['pro', 'enterprise'] },
      ],
    };
    expect(parseCondition(node)).toEqual(node);
    expect(parseCondition({ op: 'UNKNOWN' })).toBeNull();
    expect(parseCondition({ op: 'EQ' })).toBeNull();
  });

  it('evaluates EQ / NEQ / IN / EXISTS', () => {
    expect(evaluateCondition({ op: 'EQ', field: 'country', value: 'FR' }, answers).ok).toBe(true);
    expect(evaluateCondition({ op: 'EQ', field: 'country', value: 'US' }, answers).ok).toBe(false);
    expect(evaluateCondition({ op: 'NEQ', field: 'country', value: 'US' }, answers).ok).toBe(true);
    expect(
      evaluateCondition({ op: 'IN', field: 'plan', values: ['starter', 'pro'] }, answers).ok,
    ).toBe(true);
    expect(evaluateCondition({ op: 'EXISTS', field: 'companySize' }, answers).ok).toBe(true);
    expect(evaluateCondition({ op: 'EXISTS', field: 'missing' }, answers).ok).toBe(false);
  });

  it('evaluates AND / OR and nested fields', () => {
    expect(
      evaluateCondition(
        {
          op: 'AND',
          args: [
            { op: 'EQ', field: 'country', value: 'FR' },
            { op: 'EQ', field: 'nested.role', value: 'admin' },
          ],
        },
        answers,
      ).ok,
    ).toBe(true);

    expect(
      evaluateCondition(
        {
          op: 'OR',
          args: [
            { op: 'EQ', field: 'country', value: 'US' },
            { op: 'EQ', field: 'plan', value: 'pro' },
          ],
        },
        answers,
      ).ok,
    ).toBe(true);
  });

  it('evaluates condition rule arrays as AND', () => {
    expect(
      evaluateConditionRules(
        [
          { op: 'EQ', field: 'country', value: 'FR' },
          { op: 'IN', field: 'plan', values: ['pro'] },
        ],
        answers,
      ).ok,
    ).toBe(true);

    expect(
      evaluateConditionRules([{ op: 'EQ', field: 'country', value: 'DE' }], answers).ok,
    ).toBe(false);

    expect(evaluateConditionRules(null, answers).ok).toBe(true);
    expect(evaluateConditionRules({ op: 'BAD' }, answers).ok).toBe(false);
  });

  it('blocks prototype pollution paths', () => {
    expect(
      evaluateCondition({ op: 'EXISTS', field: '__proto__.polluted' }, answers).ok,
    ).toBe(false);
  });
});
