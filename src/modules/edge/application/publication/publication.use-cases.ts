import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import {
  assertPublicationAllowed,
  buildPublicationSnapshotPayload,
  type PublicationSnapshot,
} from '../../domain/publication/publication.entity.js';
import {
  assertProductLifecycleTransition,
  ProductLifecycleStatus,
  type EdgeProduct,
} from '../../domain/product/product.entity.js';
import {
  assertProductVersionTransition,
  ProductVersionStatus,
} from '../../domain/product/product-version.entity.js';
import type { ProductRepositoryPort } from '../../domain/ports/product-repository.port.js';
import type { ProductVersionRepositoryPort } from '../../domain/ports/product-version-repository.port.js';
import type { CapabilityRepositoryPort } from '../../domain/ports/capability-repository.port.js';
import type { BackendRepositoryPort } from '../../domain/ports/backend-repository.port.js';
import type { PublicationRepositoryPort } from '../../domain/ports/publication-repository.port.js';
import { assertProductVerticalAccess } from '../../domain/product/product-vertical-access.js';
import { EvaluateProductReadinessUseCase } from '../readiness/readiness.use-cases.js';

export class PublishProductUseCase {
  constructor(
    private readonly products: ProductRepositoryPort,
    private readonly versions: ProductVersionRepositoryPort,
    private readonly capabilities: CapabilityRepositoryPort,
    private readonly backends: BackendRepositoryPort,
    private readonly publications: PublicationRepositoryPort,
    private readonly evaluateReadiness: EvaluateProductReadinessUseCase,
  ) {}

  async execute(input: {
    productId: string;
    productVersionId: string;
    actorId: string;
    scopeVerticalId?: string | null;
    approvalRefs?: readonly unknown[];
    profileId?: string | null;
  }): Promise<{ product: EdgeProduct; snapshot: PublicationSnapshot }> {
    const product = await this.products.findById(input.productId);
    if (!product) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product not found');
    assertProductVerticalAccess({
      scopeVerticalId: input.scopeVerticalId,
      productVerticalId: product.verticalId,
      action: 'publish',
    });
    const version = await this.versions.findById(input.productVersionId);
    if (!version || version.productId !== input.productId) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product version not found');
    }

    const evaluation = await this.evaluateReadiness.execute({
      productId: product.id,
      productVersionId: version.id,
      actorId: input.actorId,
      scopeVerticalId: input.scopeVerticalId,
      profileId: input.profileId,
    });

    assertPublicationAllowed({
      readinessResult: evaluation.result,
      versionStatus: version.status,
      productStatus: product.lifecycleStatus,
    });

    let publishedVersion = version;
    if (version.status === ProductVersionStatus.VALIDATED) {
      assertProductVersionTransition(version.status, ProductVersionStatus.PUBLISHED);
      publishedVersion = await this.versions.updateStatus(
        version.id,
        ProductVersionStatus.PUBLISHED,
        { releaseDate: new Date(), effectiveFrom: new Date() },
      );
    }

    const mappings = await this.capabilities.listMappingsByProduct(product.id);
    const bindings = await this.backends.listBindingsByProduct(product.id);

    const snapshot = await this.publications.create({
      productId: product.id,
      productVersionId: publishedVersion.id,
      snapshot: buildPublicationSnapshotPayload({
        product: { ...product },
        version: { ...publishedVersion },
        capabilities: mappings,
        bindings,
        readiness: {
          result: evaluation.result,
          checks: evaluation.checks,
          blockers: evaluation.blockers,
          warnings: evaluation.warnings,
          evaluationId: evaluation.id,
        },
      }),
      publishedBy: input.actorId,
      approvalRefs: input.approvalRefs,
    });

    if (product.lifecycleStatus !== ProductLifecycleStatus.PUBLISHED) {
      if (product.lifecycleStatus !== ProductLifecycleStatus.READY_FOR_PUBLICATION) {
        throw new DomainError(
          ErrorCode.INVALID_STATE_TRANSITION,
          'Product must be READY_FOR_PUBLICATION before publish',
          [{ status: product.lifecycleStatus }],
        );
      }
      assertProductLifecycleTransition(
        product.lifecycleStatus,
        ProductLifecycleStatus.PUBLISHED,
      );
    }

    const publishedProduct = await this.products.updateLifecycle(
      product.id,
      ProductLifecycleStatus.PUBLISHED,
      {
        updatedBy: input.actorId,
        defaultVersionId: publishedVersion.id,
      },
    );

    return { product: publishedProduct, snapshot };
  }
}
