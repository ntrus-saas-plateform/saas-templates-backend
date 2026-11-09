import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

export enum CommercialInclusionType {
  INCLUDED = 'INCLUDED',
  OPTIONAL = 'OPTIONAL',
  ADD_ON_REQUIRED = 'ADD_ON_REQUIRED',
  NOT_INCLUDED = 'NOT_INCLUDED',
  RESTRICTED = 'RESTRICTED',
  ENTERPRISE_NEGOTIATED = 'ENTERPRISE_NEGOTIATED',
}

export enum CommercialOfferStatus {
  DRAFT = 'DRAFT',
  CONFIGURING = 'CONFIGURING',
  REVIEW = 'REVIEW',
  APPROVED = 'APPROVED',
  PUBLISHED = 'PUBLISHED',
  SUSPENDED = 'SUSPENDED',
  DEPRECATED = 'DEPRECATED',
  RETIRED = 'RETIRED',
  ARCHIVED = 'ARCHIVED',
}

export enum PlanTier {
  LITE = 'LITE',
  PROFESSIONAL = 'PROFESSIONAL',
  BUSINESS = 'BUSINESS',
  ENTERPRISE = 'ENTERPRISE',
  CUSTOM = 'CUSTOM',
}

export enum CommercialReadinessResult {
  NOT_READY = 'NOT_READY',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
  READY = 'READY',
  BLOCKED = 'BLOCKED',
}

export type CommercialCapabilityRef = {
  readonly capabilityId: string;
  readonly technicalStatus: string | null;
  readonly commercialAvailability: string | null;
};

export function assertSameProductOwnership(input: {
  productId: string;
  otherProductId: string;
  context: string;
}): void {
  if (input.productId !== input.otherProductId) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      `Cross-product commercial association forbidden (${input.context})`,
      [{ productId: input.productId, otherProductId: input.otherProductId }],
    );
  }
}

/** P1 commercial availability gate — never promise unvalidated/unavailable capabilities. */
export function assertCapabilityCommerciallyIncludable(
  cap: CommercialCapabilityRef,
  inclusion: CommercialInclusionType,
): void {
  if (
    inclusion === CommercialInclusionType.NOT_INCLUDED ||
    inclusion === CommercialInclusionType.RESTRICTED
  ) {
    return;
  }
  const tech = (cap.technicalStatus ?? '').toUpperCase();
  if (tech === 'PLANNED' || tech === 'IN_PROGRESS' || tech === 'BLOCKED') {
    throw new DomainError(
      ErrorCode.CONFLICT,
      'Cannot commercially include a capability that is not technically ready',
      [{ capabilityId: cap.capabilityId, technicalStatus: cap.technicalStatus }],
    );
  }
  const avail = (cap.commercialAvailability ?? '').toUpperCase();
  if (avail === 'UNAVAILABLE') {
    throw new DomainError(
      ErrorCode.CONFLICT,
      'Cannot commercially include a capability marked UNAVAILABLE in P1',
      [{ capabilityId: cap.capabilityId, commercialAvailability: cap.commercialAvailability }],
    );
  }
}

export type CommercialReadinessInput = {
  readonly productLifecycleStatus: string;
  readonly hasPlanTier: boolean;
  readonly capabilityRefs: readonly CommercialCapabilityRef[];
  readonly inclusions: readonly { capabilityId: string; inclusionType: CommercialInclusionType }[];
  readonly priceBookCurrency?: string | null;
  readonly requireCurrencyOnPriceBook?: boolean;
  readonly requireProductPublished?: boolean;
  readonly forbidUnvalidatedCapabilities?: boolean;
  /** When false, plan-tier check is skipped (packages/addons/enterprise templates). */
  readonly requirePlanTier?: boolean;
  readonly requireDeploymentProfile?: boolean;
  readonly hasDeploymentProfile?: boolean;
};

export function evaluateCommercialReadiness(input: CommercialReadinessInput): {
  result: CommercialReadinessResult;
  checks: { code: string; passed: boolean; message: string }[];
  blockers: string[];
  warnings: string[];
} {
  const checks: { code: string; passed: boolean; message: string }[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  const requirePublished = input.requireProductPublished !== false;
  const productPublished = input.productLifecycleStatus === 'PUBLISHED';
  checks.push({
    code: 'product.published',
    passed: !requirePublished || productPublished,
    message: productPublished
      ? 'Product is published'
      : 'Product is not published (commercial readiness blocked)',
  });
  if (requirePublished && !productPublished) blockers.push('product_not_published');

  if (input.requirePlanTier !== false) {
    checks.push({
      code: 'plan.has_tier',
      passed: input.hasPlanTier,
      message: input.hasPlanTier ? 'Plan tier present' : 'Plan tier missing',
    });
    if (!input.hasPlanTier) blockers.push('plan_tier_missing');
  }

  if (input.requireDeploymentProfile) {
    const ok = Boolean(input.hasDeploymentProfile);
    checks.push({
      code: 'enterprise.deployment_profile',
      passed: ok,
      message: ok
        ? 'Deployment profile present'
        : 'Enterprise template requires a deployment profile',
    });
    if (!ok) blockers.push('deployment_profile_missing');
  }

  if (input.requireCurrencyOnPriceBook) {
    const ok = Boolean(input.priceBookCurrency?.trim());
    checks.push({
      code: 'pricing.currency',
      passed: ok,
      message: ok ? 'Price book currency present' : 'Price book currency required',
    });
    if (!ok) blockers.push('price_book_currency_missing');
  }

  if (input.forbidUnvalidatedCapabilities !== false) {
    const capMap = new Map(input.capabilityRefs.map((c) => [c.capabilityId, c]));
    for (const inc of input.inclusions) {
      if (
        inc.inclusionType === CommercialInclusionType.NOT_INCLUDED ||
        inc.inclusionType === CommercialInclusionType.RESTRICTED
      ) {
        continue;
      }
      const cap = capMap.get(inc.capabilityId);
      if (!cap) {
        blockers.push(`missing_capability:${inc.capabilityId}`);
        checks.push({
          code: 'capability.exists',
          passed: false,
          message: `Capability ${inc.capabilityId} not found in P1`,
        });
        continue;
      }
      try {
        assertCapabilityCommerciallyIncludable(cap, inc.inclusionType);
        checks.push({
          code: `capability.includable.${cap.capabilityId}`,
          passed: true,
          message: 'Capability includable',
        });
      } catch (err) {
        blockers.push(`capability_not_includable:${cap.capabilityId}`);
        checks.push({
          code: `capability.includable.${cap.capabilityId}`,
          passed: false,
          message: err instanceof Error ? err.message : 'Capability not includable',
        });
      }
    }
  }

  let result: CommercialReadinessResult;
  if (blockers.length > 0) result = CommercialReadinessResult.BLOCKED;
  else if (warnings.length > 0) result = CommercialReadinessResult.NEEDS_REVIEW;
  else result = CommercialReadinessResult.READY;

  return { result, checks, blockers, warnings };
}

export function assertPublicationAllowed(result: CommercialReadinessResult): void {
  if (
    result === CommercialReadinessResult.BLOCKED ||
    result === CommercialReadinessResult.NOT_READY
  ) {
    throw new DomainError(
      ErrorCode.CONFLICT,
      `Commercial publication blocked by readiness: ${result}`,
      [{ result }],
    );
  }
}
