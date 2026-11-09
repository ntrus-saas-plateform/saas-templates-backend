export enum ReadinessResult {
  NOT_READY = 'NOT_READY',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
  READY = 'READY',
  BLOCKED = 'BLOCKED',
}

export interface ReadinessProfile {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly productType: string | null;
  readonly deploymentMode: string | null;
  readonly releaseType: string | null;
  readonly rules: Record<string, unknown>;
  readonly version: number;
  readonly status: string;
  readonly createdAt: Date;
}

export interface ReadinessEvaluation {
  readonly id: string;
  readonly productId: string;
  readonly productVersionId: string;
  readonly profileId: string | null;
  readonly result: ReadinessResult;
  readonly checks: readonly ReadinessCheck[];
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly triggeredBy: string | null;
  readonly createdAt: Date;
}

export interface ReadinessCheck {
  readonly code: string;
  readonly passed: boolean;
  readonly message: string;
}

export interface ReadinessEvaluationInput {
  readonly productId: string;
  readonly verticalId: string | null;
  readonly hasVersion: boolean;
  readonly requiredCapabilityIds: readonly string[];
  readonly validatedCapabilityIds: readonly string[];
  readonly requirePrimaryBinding: boolean;
  readonly hasPrimaryBinding: boolean;
  readonly rules?: Record<string, unknown>;
}

export function evaluateProductReadiness(
  input: ReadinessEvaluationInput,
): {
  result: ReadinessResult;
  checks: ReadinessCheck[];
  blockers: string[];
  warnings: string[];
} {
  const checks: ReadinessCheck[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  const hasVertical = Boolean(input.verticalId?.trim());
  checks.push({
    code: 'product.has_vertical',
    passed: hasVertical,
    message: hasVertical ? 'Product is linked to a vertical' : 'Product has no vertical',
  });
  if (!hasVertical) blockers.push('missing_vertical');

  checks.push({
    code: 'product.has_version',
    passed: input.hasVersion,
    message: input.hasVersion ? 'Product has a version' : 'Product has no version',
  });
  if (!input.hasVersion) blockers.push('missing_version');

  const missingRequired = input.requiredCapabilityIds.filter(
    (id) => !input.validatedCapabilityIds.includes(id),
  );
  const capsOk = missingRequired.length === 0;
  checks.push({
    code: 'product.required_capabilities_validated',
    passed: capsOk,
    message: capsOk
      ? 'Required capabilities are validated'
      : `Missing validated required capabilities: ${missingRequired.join(', ')}`,
  });
  if (!capsOk) blockers.push('required_capabilities_unvalidated');

  if (input.requirePrimaryBinding) {
    checks.push({
      code: 'product.has_primary_binding',
      passed: input.hasPrimaryBinding,
      message: input.hasPrimaryBinding
        ? 'PRIMARY backend binding present'
        : 'PRIMARY backend binding required but missing',
    });
    if (!input.hasPrimaryBinding) blockers.push('missing_primary_binding');
  } else {
    checks.push({
      code: 'product.has_primary_binding',
      passed: true,
      message: 'PRIMARY backend binding not required by profile',
    });
  }

  const requireBackend = Boolean(input.rules?.requirePrimaryBackend);
  if (requireBackend && !input.hasPrimaryBinding) {
    warnings.push('profile_requires_primary_backend');
  }

  let result: ReadinessResult;
  if (blockers.length > 0) {
    result = ReadinessResult.BLOCKED;
  } else if (warnings.length > 0) {
    result = ReadinessResult.NEEDS_REVIEW;
  } else {
    result = ReadinessResult.READY;
  }

  return { result, checks, blockers, warnings };
}
