import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  evaluateProductReadiness,
  type ReadinessEvaluation,
} from '../../domain/readiness/readiness.entity.js';
import { CapabilityMappingClassification } from '../../domain/capability/technical-capability.entity.js';
import { BackendBindingType } from '../../domain/backend/business-backend.entity.js';
import { assertProductVerticalAccess } from '../../domain/product/product-vertical-access.js';
import type { ProductRepositoryPort } from '../../domain/ports/product-repository.port.js';
import type { ProductVersionRepositoryPort } from '../../domain/ports/product-version-repository.port.js';
import type { CapabilityRepositoryPort } from '../../domain/ports/capability-repository.port.js';
import type { BackendRepositoryPort } from '../../domain/ports/backend-repository.port.js';
import type { ReadinessRepositoryPort } from '../../domain/ports/readiness-repository.port.js';

export class EvaluateProductReadinessUseCase {
  constructor(
    private readonly products: ProductRepositoryPort,
    private readonly versions: ProductVersionRepositoryPort,
    private readonly capabilities: CapabilityRepositoryPort,
    private readonly backends: BackendRepositoryPort,
    private readonly readiness: ReadinessRepositoryPort,
  ) {}

  async execute(input: {
    productId: string;
    productVersionId: string;
    actorId: string;
    scopeVerticalId?: string | null;
    profileId?: string | null;
    profileCode?: string | null;
  }): Promise<ReadinessEvaluation> {
    const product = await this.products.findById(input.productId);
    if (!product) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');
    assertProductVerticalAccess({
      scopeVerticalId: input.scopeVerticalId,
      productVerticalId: product.verticalId,
      action: 'evaluate_readiness',
    });
    const version = await this.versions.findById(input.productVersionId);
    if (!version || version.productId !== input.productId) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product version not found');
    }

    let profile = input.profileId
      ? await this.readiness.findProfileById(input.profileId)
      : null;
    if (!profile && input.profileCode) {
      profile = await this.readiness.findProfileByCode(input.profileCode);
    }

    const rules = profile?.rules ?? {};
    const requirePrimaryBinding = Boolean(rules.requirePrimaryBackend);

    const mappings = await this.capabilities.listMappingsByProduct(product.id);
    const requiredCapabilityIds = mappings
      .filter((m) => m.classification === CapabilityMappingClassification.REQUIRED)
      .map((m) => m.capabilityId);
    const validatedCapabilityIds = mappings
      .filter(
        (m) =>
          m.classification === CapabilityMappingClassification.REQUIRED &&
          (m.technicalStatus === 'VALIDATED' || m.technicalStatus === 'READY'),
      )
      .map((m) => m.capabilityId);

    const bindings = await this.backends.listBindingsByProduct(product.id);
    const hasPrimaryBinding = bindings.some((b) => b.bindingType === BackendBindingType.PRIMARY);

    const evaluated = evaluateProductReadiness({
      productId: product.id,
      verticalId: product.verticalId,
      hasVersion: true,
      requiredCapabilityIds,
      validatedCapabilityIds,
      requirePrimaryBinding,
      hasPrimaryBinding,
      rules,
    });

    return this.readiness.createEvaluation({
      productId: product.id,
      productVersionId: version.id,
      profileId: profile?.id ?? null,
      result: evaluated.result,
      checks: evaluated.checks,
      blockers: evaluated.blockers,
      warnings: evaluated.warnings,
      triggeredBy: input.actorId,
    });
  }
}

export class ListReadinessEvaluationsUseCase {
  constructor(private readonly readiness: ReadinessRepositoryPort) {}

  async execute(input: { page: number; limit: number; productId?: string }) {
    return this.readiness.listEvaluations(input);
  }
}
