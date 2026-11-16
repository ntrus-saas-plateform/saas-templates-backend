import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { FormSchemaDefinition } from './acquisition.types.js';
import { assertFormAnswersValid, validateFormAnswers } from './form-validation.js';

const schema: FormSchemaDefinition = {
  fields: [
    { key: 'email', type: 'email', required: true },
    { key: 'companySize', type: 'integer', required: true, min: 1, max: 10000 },
    {
      key: 'plan',
      type: 'select',
      required: true,
      options: ['starter', 'pro'],
    },
    {
      key: 'enterpriseNotes',
      type: 'string',
      required: true,
      condition: { op: 'EQ', field: 'plan', value: 'pro' },
    },
  ],
};

describe('P10 form-validation', () => {
  it('accepts valid answers and skips non-visible conditional fields', () => {
    const result = validateFormAnswers(schema, {
      email: 'a@b.co',
      companySize: 10,
      plan: 'starter',
    });
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('requires conditional fields when visible', () => {
    const result = validateFormAnswers(schema, {
      email: 'a@b.co',
      companySize: 10,
      plan: 'pro',
    });
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'FIELD_REQUIRED', fieldKey: 'enterpriseNotes' }),
      ]),
    );
  });

  it('rejects unknown fields by default and validates types', () => {
    const unknown = validateFormAnswers(schema, {
      email: 'a@b.co',
      companySize: 10,
      plan: 'starter',
      extra: true,
    });
    expect(unknown.valid).toBe(false);
    expect(unknown.issues.some((i) => i.code === 'UNKNOWN_FIELD')).toBe(true);

    const badEmail = validateFormAnswers(schema, {
      email: 'not-an-email',
      companySize: 10,
      plan: 'starter',
    });
    expect(badEmail.issues.some((i) => i.code === 'FIELD_EMAIL')).toBe(true);

    const badInt = validateFormAnswers(schema, {
      email: 'a@b.co',
      companySize: 1.5,
      plan: 'starter',
    });
    expect(badInt.issues.some((i) => i.code === 'FIELD_TYPE_MISMATCH')).toBe(true);
  });

  it('supports answer arrays and assertFormAnswersValid', () => {
    const result = validateFormAnswers(schema, [
      { fieldKey: 'email', value: 'a@b.co' },
      { fieldKey: 'companySize', value: 3 },
      { fieldKey: 'plan', value: 'starter' },
    ]);
    expect(result.valid).toBe(true);

    expect(() =>
      assertFormAnswersValid(schema, {
        email: 'a@b.co',
        companySize: 10,
        plan: 'starter',
      }),
    ).not.toThrow();

    expect(() => assertFormAnswersValid(schema, { email: 'x' })).toThrow(
      expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR }),
    );
    expect(() => assertFormAnswersValid(schema, {})).toThrow(DomainError);
  });

  it('evaluates global conditionRules', () => {
    const result = validateFormAnswers(
      schema,
      {
        email: 'a@b.co',
        companySize: 10,
        plan: 'starter',
      },
      { conditionRules: [{ op: 'EQ', field: 'plan', value: 'enterprise' }] },
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'SCHEMA_CONDITION')).toBe(true);
  });
});
