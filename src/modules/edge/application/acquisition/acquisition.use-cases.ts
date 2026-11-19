import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { ControlPlaneOutboxTransactionService } from '../../../../shared/messaging/control-plane-outbox-transaction.service.js';
import type { AcquisitionRepositoryPort } from '../../domain/acquisition/acquisition-repository.port.js';
import type { AcquisitionNotificationPort } from '../../domain/acquisition/acquisition-notification.port.js';
import {
  assertApplicationTransition,
  assertCheckoutAllowedForPriceMode,
  assertCheckoutTransition,
  assertDocumentTransition,
  assertFormVersionMutable,
  assertFormVersionPublishable,
  assertHandoffCompletable,
  assertNoPaymentCredentials,
  assertPriceDisplayRef,
  assertProspectTransition,
  assertQualificationTransition,
} from '../../domain/acquisition/acquisition-policy.js';
import {
  AcquisitionEventTypes,
  buildAcquisitionOutboxEvent,
  EDGE_P10_OUTBOX_TENANT,
} from '../../domain/acquisition/acquisition.events.js';
import type {
  AcquisitionListFilter,
  ApplicationAnswer,
  FormSchemaDefinition,
} from '../../domain/acquisition/acquisition.types.js';
import {
  issueChallenge,
  verifyChallenge,
} from '../../domain/acquisition/acquisition-public-challenge.js';
import type { AcquisitionDocumentStoragePort } from '../../domain/acquisition/document-storage.port.js';
import {
  assertFormAnswersValid,
  assertFormSchemaDefinitionPublishable,
} from '../../domain/acquisition/form-validation.js';
import {
  getProductAcquisitionContract,
} from '../../domain/acquisition/product-acquisition-contracts.js';
import type { TenantRuntimeStatusPort } from '../../domain/acquisition/tenant-runtime-status.port.js';
import {
  parseRequiredConsents,
  validateSubmittedConsents,
  type SubmittedConsent,
} from '../../domain/marketing/marketing-consent.js';
import type { CommercialRepositoryPort } from '../../domain/ports/commercial-repository.port.js';
import type { ProductRepositoryPort } from '../../domain/ports/product-repository.port.js';
import { CommercialAvailability } from '../../domain/product/product.entity.js';
import { CreatePaymentIntentUseCase } from '../billing/billing.use-cases.js';

/** Commercial availability values that may appear on a public product presentation. */
const PRESENTABLE_COMMERCIAL_AVAILABILITY = new Set<string>([
  CommercialAvailability.AVAILABLE,
  CommercialAvailability.BETA,
  CommercialAvailability.CONTROLLED_ROLLOUT,
  // Forward-compatible aliases referenced by acquisition CX docs
  'BY_REQUEST',
  'ENTERPRISE',
]);

const AUTHORITATIVE_P6_PAYMENT_STATUSES = new Set([
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
  'AWAITING_PAYMENT',
]);

const SENSITIVE_ANALYTICS_KEYS = [
  'password',
  'card',
  'cardnumber',
  'card_number',
  'cvv',
  'cvc',
  'pan',
  'document',
  'documentcontent',
  'document_content',
  'secret',
  'clientsecret',
  'client_secret',
];

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isNonEmptyBotTrap(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Reject honeypot / too-fast public lead submissions (anti-automation). */
function assertLeadAntiAutomation(input: {
  honeypot?: unknown;
  submittedAtMs?: number | null;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): void {
  if (
    isNonEmptyBotTrap(input.honeypot) ||
    isNonEmptyBotTrap(input.metadata?.honeypot) ||
    isNonEmptyBotTrap(input.payload?.website)
  ) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Lead submission rejected');
  }
  if (
    typeof input.submittedAtMs === 'number' &&
    Number.isFinite(input.submittedAtMs) &&
    Date.now() - input.submittedAtMs < 800
  ) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Lead submission rejected');
  }
}

/** Public lead path must present a valid signed math challenge. */
function assertLeadPublicChallenge(input: {
  challengeId?: string | null;
  challengeToken?: string | null;
  challengeAnswer?: string | null;
  bypassPublicChallenge?: boolean;
}): void {
  if (input.bypassPublicChallenge) return;
  const ok = verifyChallenge(
    input.challengeId ?? '',
    input.challengeToken ?? '',
    input.challengeAnswer,
  );
  if (!ok) {
    throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Lead challenge rejected');
  }
}

function isCommerciallyPresentable(availability: string | null | undefined): boolean {
  if (!availability) return false;
  return PRESENTABLE_COMMERCIAL_AVAILABILITY.has(availability);
}

async function addAuditEvent(
  repo: AcquisitionRepositoryPort,
  input: {
    aggregateType: string;
    aggregateId: string;
    action: string;
    actorId?: string | null;
    beforeState?: Record<string, unknown> | null;
    afterState?: Record<string, unknown> | null;
    correlationId?: string | null;
    metadata?: Record<string, unknown>;
  },
  client?: unknown,
): Promise<void> {
  await repo.appendAuditEvent(
    {
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      action: input.action,
      actorId: input.actorId ?? null,
      beforeState: input.beforeState ?? null,
      afterState: input.afterState ?? null,
      correlationId: input.correlationId ?? null,
      metadata: input.metadata ?? {},
    },
    client,
  );
}

function extractSchemaRequiredConsents(
  schemaDefinition: FormSchemaDefinition | null | undefined,
): ReturnType<typeof parseRequiredConsents> | null {
  const raw = schemaDefinition?.requiredConsents;
  if (raw == null) return null;
  if (!Array.isArray(raw)) {
    throw new DomainError(
      ErrorCode.VALIDATION_ERROR,
      'schemaDefinition.requiredConsents must be an array',
    );
  }
  if (raw.length === 0) return null;
  return parseRequiredConsents(raw);
}

function decisionFromConsentState(state: unknown): SubmittedConsent['decision'] {
  if (state === 'GRANTED') return 'GRANTED';
  if (state === 'DENIED') return 'DENIED';
  if (state === 'WITHDRAWN') return 'WITHDRAWN';
  return 'NOT_PROVIDED';
}

function resolveSubmittedConsents(input: {
  consents?: SubmittedConsent[];
  metadata?: Record<string, unknown>;
  answers?: Record<string, unknown> | Array<{ fieldKey: string; value: unknown }>;
}): SubmittedConsent[] | undefined {
  if (input.consents) return input.consents;
  const fromMeta = input.metadata?.consents;
  if (Array.isArray(fromMeta)) return fromMeta as SubmittedConsent[];
  if (Array.isArray(input.answers)) {
    const row = input.answers.find((a) => a.fieldKey === 'consents' || a.fieldKey === '__consents');
    if (Array.isArray(row?.value)) return row!.value as SubmittedConsent[];
  } else if (input.answers && typeof input.answers === 'object') {
    const value = input.answers.consents ?? input.answers.__consents;
    if (Array.isArray(value)) return value as SubmittedConsent[];
  }
  const evidence = input.metadata?.consentEvidence;
  if (Array.isArray(evidence) && evidence.length > 0) {
    return evidence.map((raw) => {
      const e = raw as Record<string, unknown>;
      const proof = (e.proof as Record<string, unknown> | undefined) ?? undefined;
      return {
        purpose: String(e.purpose ?? ''),
        channel: String(e.channel ?? ''),
        textVersion: String(e.consentTextVersion ?? e.textVersion ?? ''),
        decision: decisionFromConsentState(e.state),
        locale: typeof e.locale === 'string' ? e.locale : undefined,
        decidedAt: typeof e.decidedAt === 'string' ? e.decidedAt : undefined,
        consentRef:
          typeof proof?.consentRef === 'string'
            ? proof.consentRef
            : typeof e.consentRef === 'string'
              ? e.consentRef
              : undefined,
      } satisfies SubmittedConsent;
    });
  }
  return undefined;
}

function validateAndMapApplicationConsents(input: {
  schemaDefinition: FormSchemaDefinition;
  formSchemaId: string;
  formVersionNumber: number;
  formSlug?: string | null;
  consents?: SubmittedConsent[];
  metadata?: Record<string, unknown>;
  answers?: Record<string, unknown> | Array<{ fieldKey: string; value: unknown }>;
  /** When true, missing requiredConsents is an error. When false, only validate if consents provided. */
  requireIfDeclared: boolean;
}): unknown[] | null {
  const required = extractSchemaRequiredConsents(input.schemaDefinition);
  if (!required) return null;
  const submitted = resolveSubmittedConsents(input);
  if (!input.requireIfDeclared && (submitted == null || submitted.length === 0)) {
    return null;
  }
  const { records } = validateSubmittedConsents({
    required,
    submitted,
    formId: input.formSchemaId,
    formVersion: input.formVersionNumber,
    formSlug: input.formSlug ?? input.formSchemaId,
  });
  return records.map((r) => ({
    purpose: r.purpose,
    channel: r.channel,
    state: r.state,
    consentTextVersion: r.consentTextVersion,
    locale: r.locale,
    decidedAt: r.decidedAt,
    proof: r.proof,
  }));
}

function stripSensitiveProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties ?? {})) {
    const lower = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (SENSITIVE_ANALYTICS_KEYS.some((s) => lower.includes(s))) {
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = stripSensitiveProperties(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

type OutboxEnqueue = (event: ReturnType<typeof buildAcquisitionOutboxEvent>) => Promise<unknown>;

async function withOutbox<T>(
  outbox: ControlPlaneOutboxTransactionService | undefined,
  fn: (client: unknown, enqueue: OutboxEnqueue) => Promise<T>,
): Promise<T> {
  if (!outbox) {
    const noopEnqueue: OutboxEnqueue = async () => undefined;
    return fn(undefined, noopEnqueue);
  }
  return outbox.runWithOutbox(EDGE_P10_OUTBOX_TENANT, async (client, enqueue) =>
    fn(client, enqueue as OutboxEnqueue),
  );
}

// ---------------------------------------------------------------------------
// P10.1 Presentations
// ---------------------------------------------------------------------------

export class CreateProductPresentationUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    productId: string;
    code: string;
    slug: string;
    title: string;
    summary?: string | null;
    locale?: string;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    if (!input.productId?.trim() || !input.code?.trim() || !input.slug?.trim() || !input.title?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'productId, code, slug, title required');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const row = await this.repo.createProductPresentation(
        {
          productId: input.productId,
          code: input.code.trim(),
          slug: input.slug.trim(),
          title: input.title.trim(),
          summary: input.summary ?? null,
          status: 'DRAFT',
          locale: input.locale?.trim() || 'en',
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.PRODUCT_PRESENTATION_CREATED,
          aggregateId: row.id,
          aggregateType: 'product_presentation',
          correlationId,
          actorId: input.actorId,
          payload: { productId: row.productId, slug: row.slug, status: row.status },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'product_presentation',
          aggregateId: row.id,
          action: AcquisitionEventTypes.PRODUCT_PRESENTATION_CREATED,
          actorId: input.actorId,
          afterState: { productId: row.productId, slug: row.slug },
          correlationId,
        },
        client,
      );
      return row;
    });
  }
}

export class CreateProductContentVersionUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    presentationId: string;
    content: Record<string, unknown>;
    versionNumber?: number;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    const presentation = await this.repo.getProductPresentation(input.presentationId);
    if (!presentation) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product presentation not found');
    }
    if (!input.content || typeof input.content !== 'object') {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'content required');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const draft = await this.repo.createProductContentVersion(
        {
          presentationId: input.presentationId,
          versionNumber: input.versionNumber ?? 1,
          content: input.content,
          immutableAfterPublish: true,
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
          status: 'DRAFT',
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.PRODUCT_PRESENTATION_CREATED,
          aggregateId: draft.id,
          aggregateType: 'product_content_version',
          correlationId,
          actorId: input.actorId,
          payload: {
            presentationId: draft.presentationId,
            versionNumber: draft.versionNumber,
            status: draft.status,
          },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'product_content_version',
          aggregateId: draft.id,
          action: 'edge.p10.product_content.draft_created',
          actorId: input.actorId,
          afterState: { presentationId: draft.presentationId, status: draft.status },
          correlationId,
        },
        client,
      );
      return draft;
    });
  }
}

export class PublishProductContentUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    presentationId: string;
    content?: Record<string, unknown>;
    contentVersionId?: string;
    versionNumber?: number;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    const presentation = await this.repo.getProductPresentation(input.presentationId);
    if (!presentation) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product presentation not found');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      let versionId = input.contentVersionId;
      if (!versionId) {
        if (!input.content) {
          throw new DomainError(
            ErrorCode.VALIDATION_ERROR,
            'content or contentVersionId required to publish',
          );
        }
        const draft = await this.repo.createProductContentVersion(
          {
            presentationId: input.presentationId,
            versionNumber: input.versionNumber ?? 1,
            content: input.content,
            immutableAfterPublish: true,
            metadata: input.metadata ?? {},
            createdBy: input.actorId,
            status: 'DRAFT',
          },
          client,
        );
        versionId = draft.id;
      }
      const published = await this.repo.publishProductContentVersion(
        versionId,
        input.actorId,
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.PRODUCT_CONTENT_PUBLISHED,
          aggregateId: published.id,
          aggregateType: 'product_content_version',
          correlationId,
          actorId: input.actorId,
          payload: {
            presentationId: published.presentationId,
            versionNumber: published.versionNumber,
          },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'product_content_version',
          aggregateId: published.id,
          action: AcquisitionEventTypes.PRODUCT_CONTENT_PUBLISHED,
          actorId: input.actorId,
          afterState: { presentationId: published.presentationId, status: published.status },
          correlationId,
        },
        client,
      );
      return published;
    });
  }
}

export class ListPublicProductDiscoveryUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly products: ProductRepositoryPort,
  ) {}

  async execute(filter?: AcquisitionListFilter) {
    const listed = await this.repo.listProductPresentations({
      ...filter,
      status: 'PUBLISHED',
    });
    const items = [];
    for (const presentation of listed.items) {
      if (presentation.status !== 'PUBLISHED') continue;
      const product = await this.products.findById(presentation.productId);
      if (!product || !isCommerciallyPresentable(product.commercialAvailability)) {
        continue;
      }
      items.push(presentation);
    }
    return { items, total: items.length };
  }
}

export class GetPublicProductPageUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly products: ProductRepositoryPort,
  ) {}

  async execute(input: { slug: string } | { presentationId: string }) {
    const presentation =
      'slug' in input
        ? await this.repo.getProductPresentationBySlug(input.slug)
        : await this.repo.getProductPresentation(input.presentationId);
    if (!presentation) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product presentation not found');
    }
    if (presentation.status !== 'PUBLISHED') {
      throw new DomainError(ErrorCode.FORBIDDEN, 'Product presentation is not published', [
        { code: 'PRESENTATION_NOT_PUBLISHED', status: presentation.status },
      ]);
    }
    const product = await this.products.findById(presentation.productId);
    if (!product || !isCommerciallyPresentable(product.commercialAvailability)) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        'Product is not commercially presentable for public discovery',
        [
          {
            code: 'PRODUCT_NOT_COMMERCIALLY_PRESENTABLE',
            commercialAvailability: product?.commercialAvailability ?? null,
          },
        ],
      );
    }
    const meta = (presentation.metadata ?? {}) as Record<string, unknown>;
    const configuredSlug =
      (typeof meta.defaultFormSlug === 'string' && meta.defaultFormSlug.trim()) ||
      (typeof meta.publicFormSlug === 'string' && meta.publicFormSlug.trim()) ||
      null;
    let defaultFormSlug = configuredSlug;
    if (!defaultFormSlug) {
      const forms = await this.repo.listFormSchemas({
        productId: presentation.productId,
        limit: 5,
      });
      for (const schema of forms.items) {
        const pubs = await this.repo.listFormPublications({
          formSchemaId: schema.id,
          status: 'ACTIVE',
        });
        const slug = pubs.find((p) => p.publicSlug?.trim())?.publicSlug?.trim();
        if (slug) {
          defaultFormSlug = slug;
          break;
        }
      }
    }
    return { presentation, product, defaultFormSlug };
  }
}

export class CreateSegmentPresentationUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name: string;
    description?: string | null;
    productPresentationId?: string | null;
    targetingRules?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    if (!input.code?.trim() || !input.name?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'code and name required');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const row = await this.repo.createSegmentPresentation(
        {
          code: input.code.trim(),
          name: input.name.trim(),
          description: input.description ?? null,
          productPresentationId: input.productPresentationId ?? null,
          status: 'DRAFT',
          targetingRules: input.targetingRules ?? {},
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.PRODUCT_PRESENTATION_CREATED,
          aggregateId: row.id,
          aggregateType: 'segment_presentation',
          correlationId,
          actorId: input.actorId,
          payload: { code: row.code, status: row.status },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'segment_presentation',
          aggregateId: row.id,
          action: 'edge.p10.segment_presentation.created',
          actorId: input.actorId,
          afterState: { code: row.code },
          correlationId,
        },
        client,
      );
      return row;
    });
  }
}

export class CreatePlanPresentationUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    commercialPlanId: string;
    productPresentationId?: string | null;
    code: string;
    title: string;
    summary?: string | null;
    priceDisplayMode: string;
    priceDisplayRef?: string | null;
    currencyHint?: string | null;
    featuresDisplay?: unknown[];
    ctaLabel?: string | null;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    if (!input.commercialPlanId?.trim() || !input.code?.trim() || !input.title?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'commercialPlanId, code, title required');
    }
    assertPriceDisplayRef(input.priceDisplayMode, input.priceDisplayRef);
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const row = await this.repo.createPlanPresentation(
        {
          commercialPlanId: input.commercialPlanId,
          productPresentationId: input.productPresentationId ?? null,
          code: input.code.trim(),
          title: input.title.trim(),
          summary: input.summary ?? null,
          status: 'DRAFT',
          priceDisplayMode: input.priceDisplayMode,
          priceDisplayRef: input.priceDisplayRef ?? null,
          currencyHint: input.currencyHint ?? null,
          featuresDisplay: input.featuresDisplay ?? [],
          ctaLabel: input.ctaLabel ?? null,
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.PLAN_PRESENTATION_CREATED,
          aggregateId: row.id,
          aggregateType: 'plan_presentation',
          correlationId,
          actorId: input.actorId,
          payload: {
            commercialPlanId: row.commercialPlanId,
            priceDisplayMode: row.priceDisplayMode,
          },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'plan_presentation',
          aggregateId: row.id,
          action: AcquisitionEventTypes.PLAN_PRESENTATION_CREATED,
          actorId: input.actorId,
          afterState: { commercialPlanId: row.commercialPlanId, code: row.code },
          correlationId,
        },
        client,
      );
      return row;
    });
  }
}

export class ListPlanPresentationsUseCase {
  constructor(private readonly repo: AcquisitionRepositoryPort) {}

  execute(filter?: AcquisitionListFilter) {
    return this.repo.listPlanPresentations(filter);
  }
}

export class ListProductPresentationsUseCase {
  constructor(private readonly repo: AcquisitionRepositoryPort) {}

  execute(filter?: AcquisitionListFilter) {
    return this.repo.listProductPresentations(filter);
  }
}

export class ListSegmentPresentationsUseCase {
  constructor(private readonly repo: AcquisitionRepositoryPort) {}

  execute(filter?: AcquisitionListFilter) {
    return this.repo.listSegmentPresentations(filter);
  }
}

export class ListLeadsUseCase {
  constructor(private readonly repo: AcquisitionRepositoryPort) {}

  execute(filter?: AcquisitionListFilter & { emailNormalized?: string }) {
    return this.repo.listLeads(filter);
  }
}

export class ListFormSchemasUseCase {
  constructor(private readonly repo: AcquisitionRepositoryPort) {}

  execute(filter?: AcquisitionListFilter) {
    return this.repo.listFormSchemas(filter);
  }
}

export class ListApplicationsUseCase {
  constructor(private readonly repo: AcquisitionRepositoryPort) {}

  execute(filter?: AcquisitionListFilter) {
    return this.repo.listApplications(filter);
  }
}

export class GetJourneyByApplicationUseCase {
  constructor(private readonly repo: AcquisitionRepositoryPort) {}

  async execute(input: { applicationId: string }) {
    if (!input.applicationId?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'applicationId required');
    }
    const journey = await this.repo.findJourneyInstance({
      applicationId: input.applicationId,
    });
    if (!journey) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Journey instance not found');
    }
    return journey;
  }
}

export class GetPublicFormBySlugUseCase {
  constructor(private readonly repo: AcquisitionRepositoryPort) {}

  async execute(input: { publicSlug: string }) {
    if (!input.publicSlug?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'publicSlug required');
    }
    const publication = await this.repo.getFormPublicationBySlug(input.publicSlug.trim());
    if (!publication || publication.status !== 'ACTIVE') {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Published form not found');
    }
    const version = await this.repo.getFormVersion(publication.formVersionId);
    if (!version || version.status !== 'PUBLISHED') {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Published form version not found');
    }
    const schema = await this.repo.getFormSchema(publication.formSchemaId);
    return { publication, formVersion: version, schema };
  }
}

// ---------------------------------------------------------------------------
// P10.2 Prospects / leads
// ---------------------------------------------------------------------------

export class CreateProspectUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId?: string | null;
    email: string;
    displayName?: string | null;
    companyName?: string | null;
    productId?: string | null;
    commercialPlanId?: string | null;
    planPresentationId?: string | null;
    commercialAccountId?: string | null;
    locale?: string | null;
    country?: string | null;
    sourceChannel?: string | null;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
    allowDuplicate?: boolean;
  }) {
    if (!input.email?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'email required');
    }
    const emailNormalized = normalizeEmail(input.email);
    const existing = await this.repo.listProspects({ emailNormalized, limit: 1 });
    if (existing.items.length > 0 && !input.allowDuplicate) {
      throw new DomainError(ErrorCode.CONFLICT, 'Prospect already exists for this email', [
        { code: 'PROSPECT_DUPLICATE_EMAIL', emailNormalized, prospectId: existing.items[0]!.id },
      ]);
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const row = await this.repo.createProspect(
        {
          emailNormalized,
          displayName: input.displayName ?? null,
          companyName: input.companyName ?? null,
          status: 'NEW',
          commercialAccountId: input.commercialAccountId ?? null,
          productId: input.productId ?? null,
          commercialPlanId: input.commercialPlanId ?? null,
          planPresentationId: input.planPresentationId ?? null,
          locale: input.locale ?? null,
          country: input.country ?? null,
          sourceChannel: input.sourceChannel ?? null,
          metadata: input.metadata ?? {},
          createdBy: input.actorId ?? null,
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.PROSPECT_CREATED,
          aggregateId: row.id,
          aggregateType: 'prospect',
          correlationId,
          actorId: input.actorId,
          payload: { emailNormalized: row.emailNormalized, status: row.status },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'prospect',
          aggregateId: row.id,
          action: AcquisitionEventTypes.PROSPECT_CREATED,
          actorId: input.actorId,
          afterState: { emailNormalized: row.emailNormalized },
          correlationId,
        },
        client,
      );
      return row;
    });
  }
}

export class TransitionProspectUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId?: string | null;
    prospectId: string;
    toStatus: string;
    patch?: Record<string, unknown>;
    expectedVersion?: number;
    correlationId?: string | null;
  }) {
    const prospect = await this.repo.getProspect(input.prospectId);
    if (!prospect) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Prospect not found');
    assertProspectTransition(String(prospect.status), input.toStatus);
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const updated = await this.repo.transitionProspect(
        input.prospectId,
        input.toStatus,
        {
          ...(input.patch as object),
          expectedVersion: input.expectedVersion,
          updatedBy: input.actorId ?? null,
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.PROSPECT_TRANSITIONED,
          aggregateId: updated.id,
          aggregateType: 'prospect',
          correlationId,
          actorId: input.actorId,
          payload: { fromStatus: prospect.status, toStatus: updated.status },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'prospect',
          aggregateId: updated.id,
          action: AcquisitionEventTypes.PROSPECT_TRANSITIONED,
          actorId: input.actorId,
          beforeState: { status: prospect.status },
          afterState: { status: updated.status },
          correlationId,
        },
        client,
      );
      return updated;
    });
  }
}

export class ListProspectsUseCase {
  constructor(private readonly repo: AcquisitionRepositoryPort) {}

  execute(filter?: AcquisitionListFilter & { emailNormalized?: string }) {
    return this.repo.listProspects(filter);
  }
}

export class IssueAcquisitionChallengeUseCase {
  execute(opts?: { ttlMs?: number }) {
    return issueChallenge(opts);
  }
}

export class CaptureAcquisitionLeadUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId?: string | null;
    email: string;
    sourceType: string;
    sourceRef?: string | null;
    formPublicationId?: string | null;
    marketingLeadSoftRef?: string | null;
    prospectId?: string | null;
    score?: number | null;
    scoreBand?: string | null;
    attribution?: Record<string, unknown>;
    payload?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    /** Consent decisions — validated when publication.metadata.requiredConsents is set. */
    consents?: SubmittedConsent[];
    /** Bot-trap field — any non-empty value rejects the lead. */
    honeypot?: string | null;
    /** Client form-render timestamp (ms). Submissions under 800ms are rejected. */
    submittedAtMs?: number | null;
    /** Signed public challenge id (required unless bypassPublicChallenge). */
    challengeId?: string | null;
    challengeToken?: string | null;
    /** Must equal String(operandA + operandB) from issued challenge. */
    challengeAnswer?: string | null;
    /** Authenticated operator capture may skip public CAPTCHA. */
    bypassPublicChallenge?: boolean;
    correlationId?: string | null;
  }) {
    if (!input.email?.trim() || !input.sourceType?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'email and sourceType required');
    }
    assertLeadAntiAutomation(input);
    assertLeadPublicChallenge(input);
    assertNoPaymentCredentials(input.payload);
    assertNoPaymentCredentials(input.metadata);

    const consentEvidence = await this.validatePublicationConsents(input);

    const emailNormalized = normalizeEmail(input.email);
    const correlationId = input.correlationId?.trim() || randomUUID();
    const metadata: Record<string, unknown> = {
      ...(input.metadata ?? {}),
      ...(consentEvidence ? { consentEvidence } : {}),
    };
    return withOutbox(this.outbox, async (client, enqueue) => {
      const lead = await this.repo.createLead(
        {
          prospectId: input.prospectId ?? null,
          emailNormalized,
          status: 'CAPTURED',
          sourceType: input.sourceType,
          sourceRef: input.sourceRef ?? null,
          formPublicationId: input.formPublicationId ?? null,
          marketingLeadSoftRef: input.marketingLeadSoftRef ?? null,
          score: input.score ?? null,
          scoreBand: input.scoreBand ?? null,
          attribution: input.attribution ?? {},
          payload: input.payload ?? {},
          metadata,
        },
        client,
      );
      await this.repo.addLeadEvent(
        {
          leadId: lead.id,
          eventType: AcquisitionEventTypes.LEAD_CAPTURED,
          body: { sourceType: lead.sourceType },
          actorId: input.actorId ?? null,
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.LEAD_CAPTURED,
          aggregateId: lead.id,
          aggregateType: 'acquisition_lead',
          correlationId,
          actorId: input.actorId,
          payload: { emailNormalized: lead.emailNormalized, sourceType: lead.sourceType },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'acquisition_lead',
          aggregateId: lead.id,
          action: AcquisitionEventTypes.LEAD_CAPTURED,
          actorId: input.actorId,
          afterState: { emailNormalized: lead.emailNormalized },
          correlationId,
        },
        client,
      );
      return lead;
    });
  }

  /**
   * When a form publication declares metadata.requiredConsents, validate the
   * submitted consent array the same way marketing public forms do.
   * Applications Save/Submit already enforce required schema fields via assertFormAnswersValid.
   */
  private async validatePublicationConsents(input: {
    formPublicationId?: string | null;
    consents?: SubmittedConsent[];
    payload?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<unknown[] | null> {
    if (!input.formPublicationId?.trim()) return null;
    const publication = await this.repo.getFormPublication(input.formPublicationId.trim());
    if (!publication) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Form publication not found');
    }
    const rawRequired = publication.metadata?.requiredConsents;
    if (rawRequired == null) return null;
    if (!Array.isArray(rawRequired)) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'publication.metadata.requiredConsents must be an array',
      );
    }
    if (rawRequired.length === 0) return null;

    const required = parseRequiredConsents(rawRequired);
    const submittedFromPayload = Array.isArray(input.payload?.consents)
      ? (input.payload!.consents as SubmittedConsent[])
      : undefined;
    const submitted = input.consents ?? submittedFromPayload;
    const version = await this.repo.getFormVersion(publication.formVersionId);
    const { records } = validateSubmittedConsents({
      required,
      submitted,
      formId: publication.formSchemaId,
      formVersion: version?.versionNumber ?? 0,
      formSlug: publication.publicSlug ?? publication.id,
    });
    return records.map((r) => ({
      purpose: r.purpose,
      channel: r.channel,
      state: r.state,
      consentTextVersion: r.consentTextVersion,
      locale: r.locale,
      decidedAt: r.decidedAt,
      proof: r.proof,
    }));
  }
}

export class PromoteLeadUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId?: string | null;
    leadId: string;
    prospectId?: string;
    createProspectIfMissing?: boolean;
    correlationId?: string | null;
  }) {
    const lead = await this.repo.getLead(input.leadId);
    if (!lead) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Lead not found');
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      let prospectId = input.prospectId ?? lead.prospectId ?? undefined;
      if (!prospectId) {
        if (input.createProspectIfMissing === false) {
          throw new DomainError(ErrorCode.VALIDATION_ERROR, 'prospectId required to promote lead');
        }
        const created = await this.repo.createProspect(
          {
            emailNormalized: lead.emailNormalized,
            displayName: null,
            companyName: null,
            status: 'NEW',
            commercialAccountId: null,
            productId: null,
            commercialPlanId: null,
            planPresentationId: null,
            locale: null,
            country: null,
            sourceChannel: String(lead.sourceType),
            metadata: { promotedFromLeadId: lead.id },
            createdBy: input.actorId ?? null,
          },
          client,
        );
        prospectId = created.id;
      }
      const promoted = await this.repo.promoteLeadToProspect(input.leadId, prospectId, client);
      const updated = await this.repo.updateLead(
        promoted.id,
        { status: 'PROMOTED', prospectId },
        client,
      );
      await this.repo.addLeadEvent(
        {
          leadId: updated.id,
          eventType: AcquisitionEventTypes.LEAD_PROMOTED,
          body: { prospectId },
          actorId: input.actorId ?? null,
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.LEAD_PROMOTED,
          aggregateId: updated.id,
          aggregateType: 'acquisition_lead',
          correlationId,
          actorId: input.actorId,
          payload: { prospectId, status: updated.status },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'acquisition_lead',
          aggregateId: updated.id,
          action: AcquisitionEventTypes.LEAD_PROMOTED,
          actorId: input.actorId,
          afterState: { prospectId, status: updated.status },
          correlationId,
        },
        client,
      );
      return { lead: updated, prospectId };
    });
  }
}

// ---------------------------------------------------------------------------
// P10.3 Forms
// ---------------------------------------------------------------------------

export class InstantiateProductAcquisitionFormUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
    private readonly products?: ProductRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    productId: string;
    contractCode: string;
    code: string;
    name: string;
    description?: string | null;
    correlationId?: string | null;
  }) {
    if (!input.actorId?.trim() || !input.productId?.trim() || !input.contractCode?.trim()) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'actorId, productId and contractCode required',
      );
    }
    if (!input.code?.trim() || !input.name?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'code and name required');
    }
    const contract = getProductAcquisitionContract(input.contractCode);
    if (!contract) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Unknown product acquisition contractCode', [
        { code: 'UNKNOWN_ACQUISITION_CONTRACT', contractCode: input.contractCode.trim() },
      ]);
    }
    if (!this.products) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Product repository is required');
    }
    const product = await this.products.findById(input.productId.trim());
    if (!product) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'productId does not reference an existing product',
      );
    }

    assertFormSchemaDefinitionPublishable(contract.schemaDefinition, contract.conditionRules);

    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const formSchema = await this.repo.createFormSchema(
        {
          code: input.code.trim(),
          name: input.name.trim(),
          description: input.description ?? contract.description,
          status: 'DRAFT',
          productId: input.productId.trim(),
          commercialPlanId: null,
          metadata: {
            contractCode: contract.contractCode,
            productOwnedAcquisitionContract: true,
            requiredDocumentTypes: contract.requiredDocumentTypes,
          },
          createdBy: input.actorId,
        },
        client,
      );

      const formVersion = await this.repo.createFormVersion(
        {
          formSchemaId: formSchema.id,
          versionNumber: 1,
          schemaDefinition: {
            ...contract.schemaDefinition,
            requiredConsents: contract.requiredConsents,
            requiredDocumentTypes: contract.requiredDocumentTypes,
            contractCode: contract.contractCode,
          },
          conditionRules: contract.conditionRules,
          immutableAfterPublish: true,
          metadata: {
            contractCode: contract.contractCode,
            instantiatedFromTemplate: true,
          },
          createdBy: input.actorId,
          status: 'DRAFT',
        },
        client,
      );

      const documentRequirements = [];
      for (const doc of contract.requiredDocumentTypes) {
        documentRequirements.push(
          await this.repo.createDocumentRequirement(
            {
              code: `${formSchema.code}.${doc.code}`,
              name: doc.name,
              description: doc.description ?? null,
              formSchemaId: formSchema.id,
              documentType: doc.documentType,
              required: doc.required !== false,
              conditionRules: [],
              status: 'ACTIVE',
              metadata: {
                contractCode: contract.contractCode,
                templateDocumentCode: doc.code,
              },
            },
            client,
          ),
        );
      }

      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.FORM_SCHEMA_CREATED,
          aggregateId: formSchema.id,
          aggregateType: 'form_schema',
          correlationId,
          actorId: input.actorId,
          payload: {
            code: formSchema.code,
            productId: formSchema.productId,
            contractCode: contract.contractCode,
            formVersionId: formVersion.id,
            published: false,
          },
        }),
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.FORM_VERSION_CREATED,
          aggregateId: formVersion.id,
          aggregateType: 'form_version',
          correlationId,
          actorId: input.actorId,
          payload: {
            formSchemaId: formVersion.formSchemaId,
            versionNumber: formVersion.versionNumber,
            contractCode: contract.contractCode,
            status: formVersion.status,
          },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'form_schema',
          aggregateId: formSchema.id,
          action: 'edge.p10.form_schema.instantiated_from_contract',
          actorId: input.actorId,
          afterState: {
            code: formSchema.code,
            contractCode: contract.contractCode,
            formVersionId: formVersion.id,
            status: formSchema.status,
            versionStatus: formVersion.status,
          },
          correlationId,
        },
        client,
      );

      return {
        formSchema,
        formVersion,
        documentRequirements,
        contractCode: contract.contractCode,
      };
    });
  }
}

export class CreateFormSchemaUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
    private readonly products?: ProductRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    code: string;
    name: string;
    description?: string | null;
    productId?: string | null;
    commercialPlanId?: string | null;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    if (!input.code?.trim() || !input.name?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'code and name required');
    }
    if (input.productId?.trim() && this.products) {
      const product = await this.products.findById(input.productId.trim());
      if (!product) {
        throw new DomainError(ErrorCode.VALIDATION_ERROR, 'productId does not reference an existing product');
      }
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const row = await this.repo.createFormSchema(
        {
          code: input.code.trim(),
          name: input.name.trim(),
          description: input.description ?? null,
          status: 'DRAFT',
          productId: input.productId ?? null,
          commercialPlanId: input.commercialPlanId ?? null,
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.FORM_SCHEMA_CREATED,
          aggregateId: row.id,
          aggregateType: 'form_schema',
          correlationId,
          actorId: input.actorId,
          payload: { code: row.code, productId: row.productId },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'form_schema',
          aggregateId: row.id,
          action: AcquisitionEventTypes.FORM_SCHEMA_CREATED,
          actorId: input.actorId,
          afterState: { code: row.code },
          correlationId,
        },
        client,
      );
      return row;
    });
  }
}

export class CreateFormVersionUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    formSchemaId: string;
    versionNumber: number;
    schemaDefinition: FormSchemaDefinition;
    conditionRules?: unknown[];
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    const schema = await this.repo.getFormSchema(input.formSchemaId);
    if (!schema) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Form schema not found');
    if (!input.schemaDefinition || typeof input.schemaDefinition !== 'object') {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'schemaDefinition required');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const row = await this.repo.createFormVersion(
        {
          formSchemaId: input.formSchemaId,
          versionNumber: input.versionNumber,
          schemaDefinition: input.schemaDefinition,
          conditionRules: input.conditionRules ?? [],
          immutableAfterPublish: true,
          metadata: input.metadata ?? {},
          createdBy: input.actorId,
          status: 'DRAFT',
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.FORM_VERSION_CREATED,
          aggregateId: row.id,
          aggregateType: 'form_version',
          correlationId,
          actorId: input.actorId,
          payload: { formSchemaId: row.formSchemaId, versionNumber: row.versionNumber },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'form_version',
          aggregateId: row.id,
          action: AcquisitionEventTypes.FORM_VERSION_CREATED,
          actorId: input.actorId,
          afterState: { formSchemaId: row.formSchemaId, versionNumber: row.versionNumber },
          correlationId,
        },
        client,
      );
      return row;
    });
  }
}

export class PublishFormVersionUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
    private readonly products?: ProductRepositoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    formVersionId: string;
    channel?: string;
    publicSlug?: string | null;
    expiresAt?: Date | null;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    const version = await this.repo.getFormVersion(input.formVersionId);
    if (!version) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Form version not found');
    assertFormVersionPublishable(String(version.status));
    assertFormVersionMutable(String(version.status), version.immutableAfterPublish);
    assertFormSchemaDefinitionPublishable(version.schemaDefinition, version.conditionRules);
    const formSchema = await this.repo.getFormSchema(version.formSchemaId);
    if (!formSchema) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Form schema not found');
    if (formSchema.productId?.trim() && this.products) {
      const product = await this.products.findById(formSchema.productId.trim());
      if (!product) {
        throw new DomainError(ErrorCode.VALIDATION_ERROR, 'productId does not reference an existing product');
      }
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const published = await this.repo.publishFormVersion(
        input.formVersionId,
        input.actorId,
        client,
      );
      // Published versions are immutable thereafter (enforced by assertFormVersionMutable on mutate paths).
      if (published.status !== 'PUBLISHED' || published.immutableAfterPublish === false) {
        throw new DomainError(
          ErrorCode.CONFLICT,
          'Form version publish did not produce an immutable PUBLISHED version',
          [{ code: 'FORM_VERSION_PUBLISH_INVARIANT' }],
        );
      }
      let publication = null;
      if (input.channel) {
        publication = await this.repo.createFormPublication(
          {
            formSchemaId: published.formSchemaId,
            formVersionId: published.id,
            channel: input.channel,
            publicSlug: input.publicSlug ?? null,
            status: 'ACTIVE',
            publishedBy: input.actorId,
            expiresAt: input.expiresAt ?? null,
            metadata: input.metadata ?? {},
          },
          client,
        );
        await enqueue(
          buildAcquisitionOutboxEvent({
            eventType: AcquisitionEventTypes.FORM_PUBLICATION_CREATED,
            aggregateId: publication.id,
            aggregateType: 'form_publication',
            correlationId,
            actorId: input.actorId,
            payload: { formVersionId: published.id, channel: publication.channel },
          }),
        );
      }
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.FORM_VERSION_PUBLISHED,
          aggregateId: published.id,
          aggregateType: 'form_version',
          correlationId,
          actorId: input.actorId,
          payload: {
            formSchemaId: published.formSchemaId,
            versionNumber: published.versionNumber,
            immutableAfterPublish: published.immutableAfterPublish,
          },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'form_version',
          aggregateId: published.id,
          action: AcquisitionEventTypes.FORM_VERSION_PUBLISHED,
          actorId: input.actorId,
          afterState: { status: published.status, immutableAfterPublish: true },
          correlationId,
        },
        client,
      );
      return { formVersion: published, publication };
    });
  }
}

export class GetPublishedFormForProductUseCase {
  constructor(private readonly repo: AcquisitionRepositoryPort) {}

  async execute(input: {
    productId?: string | null;
    vertical?: string | null;
    segment?: string | null;
    channel?: string;
  }) {
    const schemas = await this.repo.listFormSchemas({ limit: 200 });
    const matched = schemas.items.filter((s) => {
      if (input.productId && s.productId !== input.productId) return false;
      const meta = s.metadata ?? {};
      if (input.vertical && meta.vertical !== input.vertical && meta.verticalId !== input.vertical) {
        return false;
      }
      if (input.segment && meta.segment !== input.segment && meta.segmentId !== input.segment) {
        return false;
      }
      return s.status === 'ACTIVE' || s.currentPublishedVersionId != null;
    });
    if (matched.length === 0) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'No published form for product criteria');
    }
    const schema = matched[0]!;
    if (!schema.currentPublishedVersionId) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Form schema has no published version');
    }
    const version = await this.repo.getFormVersion(schema.currentPublishedVersionId);
    if (!version || version.status !== 'PUBLISHED') {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Published form version not found');
    }
    const publications = await this.repo.listFormPublications({
      formSchemaId: schema.id,
      channel: input.channel,
      status: 'ACTIVE',
    });
    return { schema, formVersion: version, publications };
  }
}

// ---------------------------------------------------------------------------
// P10.4 Documents
// ---------------------------------------------------------------------------

export class CreateDocumentRequirementUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId?: string | null;
    code: string;
    name: string;
    description?: string | null;
    formSchemaId?: string | null;
    documentType: string;
    required?: boolean;
    conditionRules?: unknown[];
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    if (!input.code?.trim() || !input.name?.trim() || !input.documentType?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'code, name, documentType required');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client) => {
      const row = await this.repo.createDocumentRequirement(
        {
          code: input.code.trim(),
          name: input.name.trim(),
          description: input.description ?? null,
          formSchemaId: input.formSchemaId ?? null,
          documentType: input.documentType.trim(),
          required: input.required ?? true,
          conditionRules: input.conditionRules ?? [],
          status: 'ACTIVE',
          metadata: input.metadata ?? {},
        },
        client,
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'document_requirement',
          aggregateId: row.id,
          action: 'edge.p10.document_requirement.created',
          actorId: input.actorId,
          afterState: { code: row.code, documentType: row.documentType },
          correlationId,
        },
        client,
      );
      return row;
    });
  }
}

export class RegisterDocumentUploadUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
    private readonly storage?: AcquisitionDocumentStoragePort,
  ) {}

  async execute(input: {
    actorId?: string | null;
    applicationId: string;
    requirementId?: string | null;
    documentType: string;
    /** Private storage key only — never a public URL. */
    storageKey: string;
    /** Opaque private locator — defaults to storageKey. Never a public URL. */
    privateLocator?: string | null;
    fileName?: string | null;
    contentType?: string | null;
    checksumSha256?: string | null;
    byteSize?: number | null;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    if (!input.applicationId?.trim() || !input.documentType?.trim() || !input.storageKey?.trim()) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'applicationId, documentType, storageKey required',
      );
    }
    if (/^https?:\/\//i.test(input.storageKey)) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Document storageKey must be a private key, not a public URL',
        [{ code: 'STORAGE_KEY_MUST_BE_PRIVATE' }],
      );
    }
    assertNoPaymentCredentials(input.metadata);
    const application = await this.repo.getApplication(input.applicationId);
    if (!application) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Application not found');

    const privateLocator = (input.privateLocator?.trim() || input.storageKey.trim());
    const contentType = input.contentType?.trim() || null;
    const byteSize =
      input.byteSize ??
      (typeof input.metadata?.byteSize === 'number' ? input.metadata.byteSize : null);

    let scanStatus: string = 'SCAN_UNAVAILABLE';
    if (this.storage) {
      if (!contentType || byteSize == null) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'contentType and byteSize required when document storage port is bound',
        );
      }
      try {
        await this.storage.registerPrivateObject({
          storageKey: input.storageKey.trim(),
          contentType,
          byteSize,
          checksumSha256: input.checksumSha256 ?? null,
          privateLocator,
        });
      } catch (err) {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          err instanceof Error ? err.message : 'Document storage registration failed',
        );
      }
      const scan = await this.storage.requestMalwareScan(input.storageKey.trim());
      scanStatus = scan.status;
    }

    const correlationId = input.correlationId?.trim() || randomUUID();
    const quarantined = scanStatus === 'INFECTED' || scanStatus === 'QUARANTINED';
    const initialStatus = quarantined ? 'WITHDRAWN' : 'UPLOADED';

    return withOutbox(this.outbox, async (client, enqueue) => {
      const row = await this.repo.createDocumentReference(
        {
          applicationId: input.applicationId,
          requirementId: input.requirementId ?? null,
          documentType: input.documentType.trim(),
          storageRef: input.storageKey.trim(),
          fileName: input.fileName ?? null,
          contentType,
          checksumSha256: input.checksumSha256 ?? null,
          status: initialStatus,
          metadata: {
            ...(input.metadata ?? {}),
            storageVisibility: 'private',
            malwareScanStatus: scanStatus,
            ...(quarantined ? { quarantined: true, quarantineReason: scanStatus } : {}),
            ...(byteSize != null ? { byteSize } : {}),
          },
          uploadedBy: input.actorId ?? null,
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.DOCUMENT_UPLOADED,
          aggregateId: row.id,
          aggregateType: 'document_reference',
          correlationId,
          actorId: input.actorId,
          payload: {
            applicationId: row.applicationId,
            documentType: row.documentType,
            // Never include storage key/URL in outbox payload
            hasStorageRef: Boolean(row.storageRef),
            malwareScanStatus: scanStatus,
            quarantined,
          },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'document_reference',
          aggregateId: row.id,
          action: AcquisitionEventTypes.DOCUMENT_UPLOADED,
          actorId: input.actorId,
          afterState: {
            applicationId: row.applicationId,
            documentType: row.documentType,
            status: row.status,
            malwareScanStatus: scanStatus,
          },
          correlationId,
        },
        client,
      );
      return row;
    });
  }
}

export class ListDocumentReferencesUseCase {
  constructor(private readonly repo: AcquisitionRepositoryPort) {}

  execute(filter?: AcquisitionListFilter) {
    return this.repo.listDocumentReferences(filter);
  }
}

export class ListQuoteRequestsUseCase {
  constructor(private readonly repo: AcquisitionRepositoryPort) {}

  execute(filter?: AcquisitionListFilter) {
    return this.repo.listQuoteRequests(filter);
  }
}

export class ReviewDocumentUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    documentReferenceId: string;
    decision: 'ACCEPTED' | 'REJECTED' | 'NEEDS_RESUBMIT';
    comments?: string | null;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    const doc = await this.repo.getDocumentReference(input.documentReferenceId);
    if (!doc) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Document reference not found');
    const toStatus =
      input.decision === 'ACCEPTED'
        ? 'ACCEPTED'
        : input.decision === 'REJECTED'
          ? 'REJECTED'
          : 'UPLOADED';
    if (doc.status === 'UPLOADED') {
      assertDocumentTransition(String(doc.status), 'PENDING_REVIEW');
    }
    const fromForDecision = doc.status === 'UPLOADED' ? 'PENDING_REVIEW' : String(doc.status);
    if (input.decision !== 'NEEDS_RESUBMIT') {
      assertDocumentTransition(fromForDecision, toStatus);
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      let current = doc;
      if (current.status === 'UPLOADED') {
        current = await this.repo.transitionDocumentReference(
          current.id,
          'PENDING_REVIEW',
          undefined,
          client,
        );
      }
      const review = await this.repo.createDocumentReview(
        {
          documentReferenceId: current.id,
          decision: input.decision,
          reviewerId: input.actorId,
          comments: input.comments ?? null,
          metadata: input.metadata ?? {},
        },
        client,
      );
      const updated = await this.repo.transitionDocumentReference(
        current.id,
        toStatus,
        undefined,
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.DOCUMENT_REVIEWED,
          aggregateId: updated.id,
          aggregateType: 'document_reference',
          correlationId,
          actorId: input.actorId,
          payload: { decision: input.decision, status: updated.status },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'document_reference',
          aggregateId: updated.id,
          action: AcquisitionEventTypes.DOCUMENT_REVIEWED,
          actorId: input.actorId,
          beforeState: { status: doc.status },
          afterState: { status: updated.status, decision: input.decision },
          correlationId,
        },
        client,
      );
      return { document: updated, review };
    });
  }
}

// ---------------------------------------------------------------------------
// P10.5 Qualification / quotes
// ---------------------------------------------------------------------------

export class StartQualificationUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId?: string | null;
    applicationId: string;
    criteria?: Record<string, unknown>;
    evidence?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    const application = await this.repo.getApplication(input.applicationId);
    if (!application) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Application not found');
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const existing = await this.repo.getQualificationByApplication(input.applicationId);
      let record;
      if (existing) {
        assertQualificationTransition(String(existing.status), 'IN_PROGRESS');
        record = await this.repo.transitionQualification(
          existing.id,
          'IN_PROGRESS',
          { reviewerId: input.actorId ?? null },
          client,
        );
      } else {
        record = await this.repo.upsertQualification(
          {
            applicationId: input.applicationId,
            status: 'IN_PROGRESS',
            outcomeSummary: null,
            reviewerId: input.actorId ?? null,
            criteria: input.criteria ?? {},
            evidence: input.evidence ?? {},
            metadata: input.metadata ?? {},
          },
          client,
        );
      }
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.QUALIFICATION_UPDATED,
          aggregateId: record.id,
          aggregateType: 'qualification',
          correlationId,
          actorId: input.actorId,
          payload: { applicationId: record.applicationId, status: record.status },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'qualification',
          aggregateId: record.id,
          action: AcquisitionEventTypes.QUALIFICATION_UPDATED,
          actorId: input.actorId,
          afterState: { status: record.status },
          correlationId,
        },
        client,
      );
      return record;
    });
  }
}

export class DecideQualificationUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    applicationId: string;
    decision: 'APPROVED' | 'REJECTED' | 'CONDITIONAL';
    outcomeSummary?: string | null;
    evidence?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    const record = await this.repo.getQualificationByApplication(input.applicationId);
    if (!record) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Qualification not found');
    assertQualificationTransition(String(record.status), input.decision);
    const correlationId = input.correlationId?.trim() || randomUUID();
    const eventType =
      input.decision === 'APPROVED'
        ? AcquisitionEventTypes.QUALIFICATION_APPROVED
        : input.decision === 'REJECTED'
          ? AcquisitionEventTypes.QUALIFICATION_REJECTED
          : AcquisitionEventTypes.QUALIFICATION_UPDATED;
    return withOutbox(this.outbox, async (client, enqueue) => {
      const updated = await this.repo.transitionQualification(
        record.id,
        input.decision,
        {
          outcomeSummary: input.outcomeSummary ?? null,
          approvedBy: input.decision === 'APPROVED' ? input.actorId : null,
          decidedAt: new Date(),
          evidence: input.evidence ?? record.evidence,
          reviewerId: input.actorId,
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType,
          aggregateId: updated.id,
          aggregateType: 'qualification',
          correlationId,
          actorId: input.actorId,
          payload: { applicationId: updated.applicationId, status: updated.status },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'qualification',
          aggregateId: updated.id,
          action: eventType,
          actorId: input.actorId,
          beforeState: { status: record.status },
          afterState: { status: updated.status },
          correlationId,
        },
        client,
      );
      return updated;
    });
  }
}

export class CreateQuoteRequestUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId?: string | null;
    prospectId: string;
    applicationId?: string | null;
    commercialPlanId?: string | null;
    planPresentationId?: string | null;
    notes?: string | null;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    if (!input.prospectId?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'prospectId required');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const row = await this.repo.createQuoteRequest(
        {
          applicationId: input.applicationId ?? null,
          prospectId: input.prospectId,
          commercialPlanId: input.commercialPlanId ?? null,
          planPresentationId: input.planPresentationId ?? null,
          status: 'REQUESTED',
          requestedBy: input.actorId ?? null,
          notes: input.notes ?? null,
          metadata: input.metadata ?? {},
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.QUOTE_REQUESTED,
          aggregateId: row.id,
          aggregateType: 'quote_request',
          correlationId,
          actorId: input.actorId,
          payload: { prospectId: row.prospectId, status: row.status },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'quote_request',
          aggregateId: row.id,
          action: AcquisitionEventTypes.QUOTE_REQUESTED,
          actorId: input.actorId,
          afterState: { prospectId: row.prospectId },
          correlationId,
        },
        client,
      );
      return row;
    });
  }
}

export class AttachQuoteReferenceUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId?: string | null;
    quoteRequestId: string;
    externalQuoteRef: string;
    commercialSource: string;
    validUntil?: Date | null;
    displaySummary?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    if (!input.externalQuoteRef?.trim() || !input.commercialSource?.trim()) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'externalQuoteRef and commercialSource required',
      );
    }
    assertNoPaymentCredentials(input.displaySummary);
    const quoteRequest = await this.repo.getQuoteRequest(input.quoteRequestId);
    if (!quoteRequest) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Quote request not found');
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const ref = await this.repo.attachQuoteReference(
        {
          quoteRequestId: input.quoteRequestId,
          externalQuoteRef: input.externalQuoteRef.trim(),
          commercialSource: input.commercialSource.trim(),
          status: 'ACTIVE',
          validUntil: input.validUntil ?? null,
          displaySummary: input.displaySummary ?? {},
          metadata: input.metadata ?? {},
        },
        client,
      );
      await this.repo.transitionQuoteRequest(input.quoteRequestId, 'QUOTED', undefined, client);
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.QUOTE_REFERENCE_ATTACHED,
          aggregateId: ref.id,
          aggregateType: 'quote_reference',
          correlationId,
          actorId: input.actorId,
          payload: {
            quoteRequestId: ref.quoteRequestId,
            externalQuoteRef: ref.externalQuoteRef,
          },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'quote_reference',
          aggregateId: ref.id,
          action: AcquisitionEventTypes.QUOTE_REFERENCE_ATTACHED,
          actorId: input.actorId,
          afterState: { quoteRequestId: ref.quoteRequestId },
          correlationId,
        },
        client,
      );
      return ref;
    });
  }
}

export class AcceptQuoteUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId?: string | null;
    quoteRequestId: string;
    correlationId?: string | null;
  }) {
    const quoteRequest = await this.repo.getQuoteRequest(input.quoteRequestId);
    if (!quoteRequest) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Quote request not found');
    if (quoteRequest.status !== 'QUOTED' && quoteRequest.status !== 'IN_PROGRESS') {
      throw new DomainError(
        ErrorCode.CONFLICT,
        `Quote request status ${quoteRequest.status} cannot be accepted`,
        [{ code: 'QUOTE_ACCEPT_FORBIDDEN', status: quoteRequest.status }],
      );
    }
    const active = await this.repo.getActiveQuoteReference(input.quoteRequestId);
    if (!active) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Active quote reference required to accept');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const updated = await this.repo.transitionQuoteRequest(
        input.quoteRequestId,
        'ACCEPTED',
        undefined,
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.QUOTE_REFERENCE_ATTACHED,
          aggregateId: updated.id,
          aggregateType: 'quote_request',
          correlationId,
          actorId: input.actorId,
          payload: { status: updated.status, quoteReferenceId: active.id },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'quote_request',
          aggregateId: updated.id,
          action: 'edge.p10.quote.accepted',
          actorId: input.actorId,
          beforeState: { status: quoteRequest.status },
          afterState: { status: updated.status },
          correlationId,
        },
        client,
      );
      return { quoteRequest: updated, quoteReference: active };
    });
  }
}

// ---------------------------------------------------------------------------
// P10.6 Applications
// ---------------------------------------------------------------------------

export class CreateApplicationDraftUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId?: string | null;
    prospectId: string;
    formVersionId: string;
    formSchemaId?: string;
    formPublicationId?: string | null;
    leadId?: string | null;
    productId?: string | null;
    commercialPlanId?: string | null;
    planPresentationId?: string | null;
    metadata?: Record<string, unknown>;
    /** Optional consent evidence — validated when schemaDefinition.requiredConsents is set. */
    consents?: SubmittedConsent[];
    correlationId?: string | null;
  }) {
    const formVersion = await this.repo.getFormVersion(input.formVersionId);
    if (!formVersion) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Form version not found');
    if (formVersion.status !== 'PUBLISHED') {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Application draft must bind a published form version snapshot',
        [{ code: 'FORM_VERSION_NOT_PUBLISHED', status: formVersion.status }],
      );
    }
    const formSchemaId = input.formSchemaId ?? formVersion.formSchemaId;
    const prospect = await this.repo.getProspect(input.prospectId);
    if (!prospect) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Prospect not found');

    const consentEvidence = validateAndMapApplicationConsents({
      schemaDefinition: formVersion.schemaDefinition,
      formSchemaId,
      formVersionNumber: formVersion.versionNumber,
      formSlug: formSchemaId,
      consents: input.consents,
      metadata: input.metadata,
      requireIfDeclared: false,
    });

    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const row = await this.repo.createApplication(
        {
          prospectId: input.prospectId,
          leadId: input.leadId ?? null,
          formSchemaId,
          formVersionId: formVersion.id,
          formPublicationId: input.formPublicationId ?? null,
          productId: input.productId ?? null,
          commercialPlanId: input.commercialPlanId ?? null,
          planPresentationId: input.planPresentationId ?? null,
          status: 'DRAFT',
          metadata: {
            ...(input.metadata ?? {}),
            boundFormVersionNumber: formVersion.versionNumber,
            boundFormSchemaSnapshot: true,
            ...(consentEvidence ? { consentEvidence } : {}),
            ...(input.consents ? { consents: input.consents } : {}),
          },
          createdBy: input.actorId ?? null,
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.APPLICATION_CREATED,
          aggregateId: row.id,
          aggregateType: 'application',
          correlationId,
          actorId: input.actorId,
          payload: {
            prospectId: row.prospectId,
            formVersionId: row.formVersionId,
            status: row.status,
          },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'application',
          aggregateId: row.id,
          action: AcquisitionEventTypes.APPLICATION_CREATED,
          actorId: input.actorId,
          afterState: { formVersionId: row.formVersionId, status: row.status },
          correlationId,
        },
        client,
      );
      return row;
    });
  }
}

export class SaveApplicationAnswersUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId?: string | null;
    applicationId: string;
    answers: Record<string, unknown> | Array<{ fieldKey: string; value: unknown }>;
    /** Optimistic concurrency — must match application.version when provided. */
    expectedVersion?: number;
    correlationId?: string | null;
  }) {
    const application = await this.repo.getApplication(input.applicationId);
    if (!application) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Application not found');
    const editableStatuses = new Set([
      'DRAFT',
      'DOCUMENTS_PENDING',
      'INFORMATION_REQUIRED',
      'INFORMATION_RECEIVED',
    ]);
    if (!editableStatuses.has(String(application.status))) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        `Cannot save answers when application status is ${application.status}`,
      );
    }
    if (input.expectedVersion != null && application.version !== input.expectedVersion) {
      throw new DomainError(ErrorCode.CONFLICT, 'Application version conflict');
    }
    // Always validate against the bound form version snapshot — never the latest schema.
    const boundVersion = await this.repo.getFormVersion(application.formVersionId);
    if (!boundVersion) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Bound form version not found');
    }
    assertFormAnswersValid(boundVersion.schemaDefinition, input.answers, {
      conditionRules: boundVersion.conditionRules,
    });
    const correlationId = input.correlationId?.trim() || randomUUID();
    const answerEntries = Array.isArray(input.answers)
      ? input.answers
      : Object.entries(input.answers).map(([fieldKey, value]) => ({ fieldKey, value }));
    return withOutbox(this.outbox, async (client, enqueue) => {
      const saved: ApplicationAnswer[] = [];
      for (const entry of answerEntries) {
        saved.push(
          await this.repo.upsertApplicationAnswer(
            {
              applicationId: application.id,
              fieldKey: entry.fieldKey,
              value: entry.value,
              metadata: {
                formVersionId: application.formVersionId,
                formVersionNumber: boundVersion.versionNumber,
              },
            },
            client,
          ),
        );
      }
      let updatedApplication = application;
      if (input.expectedVersion != null) {
        // Same-status transition is not allowed by policy — bump version via touch.
        updatedApplication = await this.repo.touchApplication(
          application.id,
          input.expectedVersion,
          client,
        );
      }
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.APPLICATION_TRANSITIONED,
          aggregateId: application.id,
          aggregateType: 'application',
          correlationId,
          actorId: input.actorId,
          payload: {
            action: 'answers_saved',
            formVersionId: application.formVersionId,
            formVersionNumber: boundVersion.versionNumber,
            answerCount: saved.length,
            version: updatedApplication.version,
          },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'application',
          aggregateId: application.id,
          action: 'edge.p10.application.answers_saved',
          actorId: input.actorId,
          afterState: {
            formVersionId: application.formVersionId,
            formVersionNumber: boundVersion.versionNumber,
            answerCount: saved.length,
            version: updatedApplication.version,
          },
          correlationId,
        },
        client,
      );
      return {
        application: updatedApplication,
        formVersionId: application.formVersionId,
        formVersionNumber: boundVersion.versionNumber,
        answers: saved,
      };
    });
  }
}

export class SubmitApplicationUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId?: string | null;
    applicationId: string;
    /** Consent evidence — required when schemaDefinition.requiredConsents is set. */
    consents?: SubmittedConsent[];
    correlationId?: string | null;
  }) {
    const application = await this.repo.getApplication(input.applicationId);
    if (!application) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Application not found');
    assertApplicationTransition(String(application.status), 'SUBMITTED');
    const boundVersion = await this.repo.getFormVersion(application.formVersionId);
    if (!boundVersion) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Bound form version not found');
    }
    const answers = await this.repo.listApplicationAnswers(application.id);
    assertFormAnswersValid(
      boundVersion.schemaDefinition,
      answers.map((a) => ({ fieldKey: a.fieldKey, value: a.value })),
      { conditionRules: boundVersion.conditionRules },
    );

    const consentEvidence = validateAndMapApplicationConsents({
      schemaDefinition: boundVersion.schemaDefinition,
      formSchemaId: application.formSchemaId,
      formVersionNumber: boundVersion.versionNumber,
      formSlug: application.formSchemaId,
      consents: input.consents,
      metadata: application.metadata,
      answers: answers.map((a) => ({ fieldKey: a.fieldKey, value: a.value })),
      requireIfDeclared: true,
    });

    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const updated = await this.repo.transitionApplication(
        application.id,
        'SUBMITTED',
        {
          submittedAt: new Date(),
          updatedBy: input.actorId ?? null,
          ...(consentEvidence
            ? {
                metadata: {
                  ...application.metadata,
                  consentEvidence,
                  ...(input.consents ? { consents: input.consents } : {}),
                },
              }
            : {}),
        },
        input.actorId ?? null,
        client,
      );
      await this.repo.addApplicationEvent(
        {
          applicationId: updated.id,
          eventType: AcquisitionEventTypes.APPLICATION_SUBMITTED,
          fromStatus: String(application.status),
          toStatus: updated.status,
          body: { formVersionId: updated.formVersionId },
          actorId: input.actorId ?? null,
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.APPLICATION_SUBMITTED,
          aggregateId: updated.id,
          aggregateType: 'application',
          correlationId,
          actorId: input.actorId,
          payload: { fromStatus: application.status, toStatus: updated.status },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'application',
          aggregateId: updated.id,
          action: AcquisitionEventTypes.APPLICATION_SUBMITTED,
          actorId: input.actorId,
          beforeState: { status: application.status },
          afterState: { status: updated.status },
          correlationId,
        },
        client,
      );
      return updated;
    });
  }
}

export class TransitionApplicationReviewUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    applicationId: string;
    toStatus: string;
    decisionReason?: string | null;
    expectedVersion?: number;
    correlationId?: string | null;
  }) {
    const application = await this.repo.getApplication(input.applicationId);
    if (!application) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Application not found');
    assertApplicationTransition(String(application.status), input.toStatus);
    const correlationId = input.correlationId?.trim() || randomUUID();
    const decided =
      input.toStatus === 'APPROVED' || input.toStatus === 'REJECTED'
        ? { decidedAt: new Date(), decidedBy: input.actorId, decisionReason: input.decisionReason ?? null }
        : {};
    return withOutbox(this.outbox, async (client, enqueue) => {
      const updated = await this.repo.transitionApplication(
        application.id,
        input.toStatus,
        {
          ...decided,
          expectedVersion: input.expectedVersion,
          updatedBy: input.actorId,
        },
        input.actorId,
        client,
      );
      await this.repo.addApplicationEvent(
        {
          applicationId: updated.id,
          eventType: AcquisitionEventTypes.APPLICATION_TRANSITIONED,
          fromStatus: String(application.status),
          toStatus: updated.status,
          body: { decisionReason: input.decisionReason ?? null },
          actorId: input.actorId,
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.APPLICATION_TRANSITIONED,
          aggregateId: updated.id,
          aggregateType: 'application',
          correlationId,
          actorId: input.actorId,
          payload: { fromStatus: application.status, toStatus: updated.status },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'application',
          aggregateId: updated.id,
          action: AcquisitionEventTypes.APPLICATION_TRANSITIONED,
          actorId: input.actorId,
          beforeState: { status: application.status },
          afterState: { status: updated.status },
          correlationId,
        },
        client,
      );
      return updated;
    });
  }
}

export class RequestMissingInformationUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    applicationId: string;
    reason?: string | null;
    missingFields?: string[];
    correlationId?: string | null;
  }) {
    return new TransitionApplicationReviewUseCase(this.repo, this.outbox).execute({
      actorId: input.actorId,
      applicationId: input.applicationId,
      toStatus: 'DOCUMENTS_PENDING',
      decisionReason: input.reason ?? 'Missing information requested',
      correlationId: input.correlationId,
    });
  }
}

// ---------------------------------------------------------------------------
// P10.7 Checkout / handoff
// ---------------------------------------------------------------------------

export class CreateCheckoutSessionUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId?: string | null;
    prospectId: string;
    idempotencyKey: string;
    applicationId?: string | null;
    planPresentationId?: string | null;
    commercialPlanId?: string | null;
    quoteReferenceId?: string | null;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    if (!input.prospectId?.trim() || !input.idempotencyKey?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'prospectId and idempotencyKey required');
    }
    assertNoPaymentCredentials(input.metadata);
    const existing = await this.repo.getCheckoutSessionByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;

    if (input.planPresentationId) {
      const planPresentation = await this.repo.getPlanPresentation(input.planPresentationId);
      if (planPresentation) {
        assertCheckoutAllowedForPriceMode(
          planPresentation.priceDisplayMode,
          input.quoteReferenceId,
        );
      }
    }

    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      await this.repo.beginIdempotency(
        {
          scope: 'checkout_session',
          idempotencyKey: input.idempotencyKey,
          metadata: {},
        },
        client,
      );
      try {
        const row = await this.repo.createCheckoutSession(
          {
            applicationId: input.applicationId ?? null,
            prospectId: input.prospectId,
            planPresentationId: input.planPresentationId ?? null,
            commercialPlanId: input.commercialPlanId ?? null,
            quoteReferenceId: input.quoteReferenceId ?? null,
            status: 'CREATED',
            billingSessionRef: null,
            idempotencyKey: input.idempotencyKey,
            metadata: input.metadata ?? {},
            createdBy: input.actorId ?? null,
          },
          client,
        );
        await this.repo.completeIdempotency(
          'checkout_session',
          input.idempotencyKey,
          row.id,
          'COMPLETED',
          client,
        );
        await enqueue(
          buildAcquisitionOutboxEvent({
            eventType: AcquisitionEventTypes.CHECKOUT_SESSION_CREATED,
            aggregateId: row.id,
            aggregateType: 'checkout_session',
            correlationId,
            actorId: input.actorId,
            payload: { prospectId: row.prospectId, idempotencyKey: row.idempotencyKey },
          }),
        );
        await addAuditEvent(
          this.repo,
          {
            aggregateType: 'checkout_session',
            aggregateId: row.id,
            action: AcquisitionEventTypes.CHECKOUT_SESSION_CREATED,
            actorId: input.actorId,
            afterState: { status: row.status, idempotencyKey: row.idempotencyKey },
            correlationId,
          },
          client,
        );
        return row;
      } catch (err) {
        await this.repo.completeIdempotency(
          'checkout_session',
          input.idempotencyKey,
          null,
          'FAILED',
          client,
        );
        throw err;
      }
    });
  }
}

/**
 * P10 → P6 orchestration: create a billing payment intent then attach its reference
 * to the checkout session. NEVER treat provider SUCCEEDED as paid — only attach the
 * intent ref; authoritative paid/captured transitions go through RecordPaymentResultUseCase.
 */
export class InitiateAcquisitionPaymentUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly createPaymentIntent: CreatePaymentIntentUseCase,
    private readonly attachPayment: AttachPaymentReferenceUseCase,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId: string;
    checkoutSessionId: string;
    billingAccountId: string;
    /** Authoritative amount from revalidated commercial terms — never frontend-invented without revalidate. */
    amount: string;
    currency: string;
    termsConfirmed?: boolean;
    correlationId?: string | null;
  }) {
    if (!input.billingAccountId?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'billingAccountId required');
    }
    if (!input.amount?.trim() || !input.currency?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'amount and currency required');
    }
    if (input.termsConfirmed === false) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'termsConfirmed required');
    }
    const session = await this.repo.getCheckoutSession(input.checkoutSessionId);
    if (!session) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Checkout session not found');
    assertNoPaymentCredentials(session.metadata);
    assertNoPaymentCredentials({
      billingAccountId: input.billingAccountId,
      amount: input.amount,
      currency: input.currency,
    });

    const { intent, providerResult } = await this.createPaymentIntent.execute({
      actorId: input.actorId,
      billingAccountId: input.billingAccountId.trim(),
      amount: input.amount.trim(),
      currency: input.currency.trim(),
    });

    const paymentIntentRef =
      intent.id?.trim() ||
      intent.providerIntentRef?.trim() ||
      ('providerIntentRef' in providerResult && typeof providerResult.providerIntentRef === 'string'
        ? providerResult.providerIntentRef.trim()
        : '');
    if (!paymentIntentRef) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Payment intent reference missing from P6 result');
    }

    // Even if providerResult.outcome === 'SUCCEEDED', only attach the ref — never mark paid here.
    // Authoritative P6 status → checkout paid/captured must go through RecordPaymentResultUseCase.
    const checkout = await this.attachPayment.execute({
      actorId: input.actorId,
      checkoutSessionId: session.id,
      paymentIntentRef,
      metadata: {
        billingAccountId: input.billingAccountId.trim(),
        amount: input.amount.trim(),
        currency: input.currency.trim(),
        p6IntentStatus: intent.status,
        providerOutcome:
          providerResult && typeof providerResult === 'object' && 'outcome' in providerResult
            ? String((providerResult as { outcome: string }).outcome)
            : null,
      },
      correlationId: input.correlationId,
    });

    return { checkout, paymentIntent: intent, providerResult };
  }
}

export class AttachPaymentReferenceUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId?: string | null;
    checkoutSessionId: string;
    /** P6 payment intent / billing session reference only — never card data. */
    paymentIntentRef: string;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    if (!input.paymentIntentRef?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'paymentIntentRef required');
    }
    assertNoPaymentCredentials({ paymentIntentRef: input.paymentIntentRef });
    assertNoPaymentCredentials(input.metadata);
    const session = await this.repo.getCheckoutSession(input.checkoutSessionId);
    if (!session) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Checkout session not found');
    assertCheckoutTransition(String(session.status), 'AWAITING_PAYMENT');
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const updated = await this.repo.transitionCheckoutSession(
        session.id,
        'AWAITING_PAYMENT',
        {
          billingSessionRef: input.paymentIntentRef.trim(),
          metadata: {
            ...(session.metadata ?? {}),
            ...(input.metadata ?? {}),
            paymentIntentRef: input.paymentIntentRef.trim(),
          },
        },
        client,
      );
      await this.repo.addCheckoutEvent(
        {
          checkoutSessionId: updated.id,
          eventType: AcquisitionEventTypes.CHECKOUT_TRANSITIONED,
          fromStatus: String(session.status),
          toStatus: updated.status,
          externalRef: input.paymentIntentRef.trim(),
          body: { paymentIntentRefAttached: true },
          actorId: input.actorId ?? null,
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.CHECKOUT_TRANSITIONED,
          aggregateId: updated.id,
          aggregateType: 'checkout_session',
          correlationId,
          actorId: input.actorId,
          payload: {
            fromStatus: session.status,
            toStatus: updated.status,
            hasPaymentIntentRef: true,
          },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'checkout_session',
          aggregateId: updated.id,
          action: AcquisitionEventTypes.CHECKOUT_TRANSITIONED,
          actorId: input.actorId,
          beforeState: { status: session.status },
          afterState: { status: updated.status, hasPaymentIntentRef: true },
          correlationId,
        },
        client,
      );
      return updated;
    });
  }
}

export class RecordPaymentResultUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId?: string | null;
    checkoutSessionId: string;
    /** Authoritative P6 payment status string only. */
    p6Status: string;
    externalRef?: string | null;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    const status = input.p6Status?.trim().toUpperCase();
    if (!status || !AUTHORITATIVE_P6_PAYMENT_STATUSES.has(status)) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Only authoritative P6 payment status strings are accepted',
        [{ code: 'P6_STATUS_REQUIRED', p6Status: input.p6Status }],
      );
    }
    assertNoPaymentCredentials(input.metadata);
    const session = await this.repo.getCheckoutSession(input.checkoutSessionId);
    if (!session) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Checkout session not found');
    assertCheckoutTransition(String(session.status), status);
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const updated = await this.repo.transitionCheckoutSession(
        session.id,
        status,
        { metadata: { ...(session.metadata ?? {}), ...(input.metadata ?? {}), lastP6Status: status } },
        client,
      );
      await this.repo.addCheckoutEvent(
        {
          checkoutSessionId: updated.id,
          eventType: AcquisitionEventTypes.CHECKOUT_TRANSITIONED,
          fromStatus: String(session.status),
          toStatus: updated.status,
          externalRef: input.externalRef ?? null,
          body: { p6Status: status },
          actorId: input.actorId ?? null,
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.CHECKOUT_TRANSITIONED,
          aggregateId: updated.id,
          aggregateType: 'checkout_session',
          correlationId,
          actorId: input.actorId,
          payload: { fromStatus: session.status, toStatus: updated.status, p6Status: status },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'checkout_session',
          aggregateId: updated.id,
          action: AcquisitionEventTypes.CHECKOUT_TRANSITIONED,
          actorId: input.actorId,
          beforeState: { status: session.status },
          afterState: { status: updated.status, p6Status: status },
          correlationId,
        },
        client,
      );
      return updated;
    });
  }
}

/**
 * Creates an edge_p10_subscription_handoffs row (REQUESTED) and enqueues
 * edge.p10.subscription.handoff.requested. Does NOT create P5 subscription rows.
 * Complete via CompleteSubscriptionHandoffUseCase once the P5 subscription id is known.
 * Optional orchestration: inject CreateSubscriptionFromHandoffUseCase / CreateSubscriptionUseCase
 * at the Nest wiring layer — never invent subscription rows in the acquisition repository.
 */
export class RequestSubscriptionHandoffUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId?: string | null;
    prospectId: string;
    checkoutSessionId?: string | null;
    applicationId?: string | null;
    commercialAccountId?: string | null;
    commercialPlanId?: string | null;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    if (!input.prospectId?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'prospectId required');
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const handoff = await this.repo.createSubscriptionHandoff(
        {
          checkoutSessionId: input.checkoutSessionId ?? null,
          applicationId: input.applicationId ?? null,
          prospectId: input.prospectId,
          commercialAccountId: input.commercialAccountId ?? null,
          commercialPlanId: input.commercialPlanId ?? null,
          status: 'REQUESTED',
          subscriptionRef: null,
          externalEvidenceRef: null,
          metadata: input.metadata ?? {},
        },
        client,
      );
      if (input.checkoutSessionId) {
        const session = await this.repo.getCheckoutSession(input.checkoutSessionId);
        if (session && (session.status === 'CAPTURED' || session.status === 'HANDOFF_READY')) {
          if (session.status === 'CAPTURED') {
            assertCheckoutTransition(String(session.status), 'HANDOFF_READY');
            await this.repo.transitionCheckoutSession(
              session.id,
              'HANDOFF_READY',
              undefined,
              client,
            );
          }
        }
      }
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.SUBSCRIPTION_HANDOFF_REQUESTED,
          aggregateId: handoff.id,
          aggregateType: 'subscription_handoff',
          correlationId,
          actorId: input.actorId,
          payload: {
            prospectId: handoff.prospectId,
            checkoutSessionId: handoff.checkoutSessionId,
            status: handoff.status,
          },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'subscription_handoff',
          aggregateId: handoff.id,
          action: AcquisitionEventTypes.SUBSCRIPTION_HANDOFF_REQUESTED,
          actorId: input.actorId,
          afterState: { status: handoff.status, prospectId: handoff.prospectId },
          correlationId,
        },
        client,
      );
      return handoff;
    });
  }
}

export class CompleteSubscriptionHandoffUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId?: string | null;
    handoffId: string;
    /** Subscription id from P5 — never invented in P10. */
    subscriptionId: string;
    externalEvidenceRef: string;
    correlationId?: string | null;
  }) {
    if (!input.subscriptionId?.trim() || !input.externalEvidenceRef?.trim()) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'subscriptionId (P5) and externalEvidenceRef required',
      );
    }
    const handoff = await this.repo.getSubscriptionHandoff(input.handoffId);
    if (!handoff) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Subscription handoff not found');
    assertHandoffCompletable('COMPLETED', input.externalEvidenceRef, input.subscriptionId);
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const updated = await this.repo.transitionSubscriptionHandoff(
        handoff.id,
        'COMPLETED',
        {
          subscriptionRef: input.subscriptionId.trim(),
          externalEvidenceRef: input.externalEvidenceRef.trim(),
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.SUBSCRIPTION_HANDOFF_COMPLETED,
          aggregateId: updated.id,
          aggregateType: 'subscription_handoff',
          correlationId,
          actorId: input.actorId,
          payload: {
            subscriptionRef: updated.subscriptionRef,
            status: updated.status,
          },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'subscription_handoff',
          aggregateId: updated.id,
          action: AcquisitionEventTypes.SUBSCRIPTION_HANDOFF_COMPLETED,
          actorId: input.actorId,
          beforeState: { status: handoff.status },
          afterState: {
            status: updated.status,
            subscriptionRef: updated.subscriptionRef,
          },
          correlationId,
        },
        client,
      );
      return updated;
    });
  }
}

export class RevalidatePlanBeforeCheckoutUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly commercial: CommercialRepositoryPort,
  ) {}

  async execute(input: {
    planPresentationId: string;
    /** Previously observed commercial plan version / price version. */
    expectedCommercialPlanVersion?: number | null;
    /** When plan unpublished or price version changed, caller must set true. */
    confirmationAccepted?: boolean;
  }) {
    const presentation = await this.repo.getPlanPresentation(input.planPresentationId);
    if (!presentation) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Plan presentation not found');
    }
    const plan = await this.commercial.getPlan(presentation.commercialPlanId);
    if (!plan) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Commercial plan not found');
    }
    const unpublished = String(plan.status) !== 'PUBLISHED';
    const priceVersionChanged =
      input.expectedCommercialPlanVersion != null &&
      plan.version !== input.expectedCommercialPlanVersion;
    const requiresConfirmation = unpublished || priceVersionChanged;
    if (requiresConfirmation && !input.confirmationAccepted) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        'Plan revalidation requires confirmation: unpublished or price version changed',
        [
          {
            code: 'PLAN_REVALIDATION_CONFIRMATION_REQUIRED',
            unpublished,
            priceVersionChanged,
            commercialPlanStatus: plan.status,
            commercialPlanVersion: plan.version,
            expectedCommercialPlanVersion: input.expectedCommercialPlanVersion ?? null,
            priceDisplayRef: presentation.priceDisplayRef,
          },
        ],
      );
    }
    return {
      presentation,
      plan,
      requiresConfirmation,
      unpublished,
      priceVersionChanged,
      confirmed: Boolean(input.confirmationAccepted),
    };
  }
}

// ---------------------------------------------------------------------------
// P10.8 Journey / portal
// ---------------------------------------------------------------------------

export class GetOrCreateJourneyInstanceUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId?: string | null;
    journeyDefinitionId: string;
    prospectId?: string | null;
    applicationId?: string | null;
    currentStepKey?: string | null;
    context?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    const existing = await this.repo.findJourneyInstance({
      journeyDefinitionId: input.journeyDefinitionId,
      prospectId: input.prospectId,
      applicationId: input.applicationId,
      status: 'ACTIVE',
    });
    if (existing) return existing;
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const instance = await this.repo.startJourneyInstance(
        {
          journeyDefinitionId: input.journeyDefinitionId,
          prospectId: input.prospectId ?? null,
          applicationId: input.applicationId ?? null,
          status: 'ACTIVE',
          currentStepKey: input.currentStepKey ?? null,
          context: input.context ?? {},
          metadata: input.metadata ?? {},
        },
        client,
      );
      await this.repo.addJourneyEvent(
        {
          journeyInstanceId: instance.id,
          eventType: AcquisitionEventTypes.JOURNEY_STARTED,
          stepKey: instance.currentStepKey,
          body: {},
          actorId: input.actorId ?? null,
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.JOURNEY_STARTED,
          aggregateId: instance.id,
          aggregateType: 'journey_instance',
          correlationId,
          actorId: input.actorId,
          payload: {
            journeyDefinitionId: instance.journeyDefinitionId,
            currentStepKey: instance.currentStepKey,
          },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'journey_instance',
          aggregateId: instance.id,
          action: AcquisitionEventTypes.JOURNEY_STARTED,
          actorId: input.actorId,
          afterState: { status: instance.status },
          correlationId,
        },
        client,
      );
      return instance;
    });
  }
}

export class AdvanceJourneyUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId?: string | null;
    journeyInstanceId: string;
    toStepKey: string;
    contextPatch?: Record<string, unknown>;
    complete?: boolean;
    correlationId?: string | null;
  }) {
    const instance = await this.repo.getJourneyInstance(input.journeyInstanceId);
    if (!instance) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Journey instance not found');
    if (instance.status !== 'ACTIVE' && instance.status !== 'PAUSED') {
      throw new DomainError(
        ErrorCode.CONFLICT,
        `Cannot advance journey in status ${instance.status}`,
      );
    }
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const updated = await this.repo.updateJourneyInstance(
        instance.id,
        {
          currentStepKey: input.toStepKey,
          context: { ...(instance.context ?? {}), ...(input.contextPatch ?? {}) },
          status: input.complete ? 'COMPLETED' : instance.status,
          completedAt: input.complete ? new Date() : instance.completedAt,
        },
        client,
      );
      await this.repo.addJourneyEvent(
        {
          journeyInstanceId: updated.id,
          eventType: AcquisitionEventTypes.JOURNEY_STEP_ADVANCED,
          stepKey: input.toStepKey,
          body: { fromStepKey: instance.currentStepKey },
          actorId: input.actorId ?? null,
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.JOURNEY_STEP_ADVANCED,
          aggregateId: updated.id,
          aggregateType: 'journey_instance',
          correlationId,
          actorId: input.actorId,
          payload: {
            fromStepKey: instance.currentStepKey,
            toStepKey: updated.currentStepKey,
            status: updated.status,
          },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'journey_instance',
          aggregateId: updated.id,
          action: AcquisitionEventTypes.JOURNEY_STEP_ADVANCED,
          actorId: input.actorId,
          beforeState: { currentStepKey: instance.currentStepKey },
          afterState: { currentStepKey: updated.currentStepKey, status: updated.status },
          correlationId,
        },
        client,
      );
      return updated;
    });
  }
}

export class GetCustomerPortalSnapshotUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly tenantRuntimeStatus?: TenantRuntimeStatusPort | null,
  ) {}

  async execute(input: { prospectId: string }) {
    if (!input.prospectId?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'prospectId required');
    }
    const prospect = await this.repo.getProspect(input.prospectId);
    if (!prospect) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Prospect not found');
    const [applications, checkouts, handoffs] = await Promise.all([
      this.repo.listApplications({ prospectId: input.prospectId, limit: 100 }),
      this.repo.listCheckoutSessions({ prospectId: input.prospectId, limit: 100 }),
      this.repo.listSubscriptionHandoffs({ prospectId: input.prospectId, limit: 100 }),
    ]);
    const completedHandoffs = handoffs.items.filter((h) => h.status === 'COMPLETED');
    const tenantRef = extractTenantRefFromCompletedHandoffs(completedHandoffs);

    let provisioningComplete = false;
    let provisioningNote =
      'Portal snapshot aggregates acquisition state only — no fake provisioning complete.';

    if (tenantRef && this.tenantRuntimeStatus) {
      const status = await this.tenantRuntimeStatus.isTenantReady(tenantRef);
      provisioningComplete = status.ready === true;
      provisioningNote = provisioningComplete
        ? `Provisioning complete per authoritative ready (${status.source}) for tenantRef=${tenantRef}.`
        : `Provisioning incomplete — ready check source=${status.source}${
            status.detail ? ` detail=${status.detail}` : ''
          } for tenantRef=${tenantRef}.`;
    } else if (tenantRef && !this.tenantRuntimeStatus) {
      provisioningNote =
        'tenantRef present on handoff but TenantRuntimeStatusPort unavailable — provisioningComplete stays false.';
    } else {
      provisioningNote =
        'No tenantRef on completed handoffs — provisioningComplete stays false (acquisition refs only).';
    }

    return {
      prospect,
      applications: applications.items,
      checkoutSessions: checkouts.items,
      subscriptionHandoffs: handoffs.items,
      provisioningComplete,
      subscriptionHandoffCompleted: completedHandoffs.length > 0,
      note: provisioningNote,
    };
  }
}

/** Prefer metadata tenant refs on COMPLETED handoffs; never invent from subscriptionRef alone. */
function extractTenantRefFromCompletedHandoffs(
  completed: Array<{ metadata: Record<string, unknown>; subscriptionRef: string | null }>,
): string | null {
  for (const handoff of completed) {
    const meta = handoff.metadata ?? {};
    for (const key of ['tenantRef', 'tenant_ref', 'tenantId', 'tenant_id']) {
      const v = meta[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// P10.9 Communications
// ---------------------------------------------------------------------------

export class QueueAcquisitionCommunicationUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
    private readonly notifications?: AcquisitionNotificationPort,
  ) {}

  async execute(input: {
    actorId?: string | null;
    channel: string;
    prospectId?: string | null;
    applicationId?: string | null;
    journeyInstanceId?: string | null;
    templateRef?: string | null;
    subject?: string | null;
    payload?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    if (!input.channel?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'channel required');
    }
    assertNoPaymentCredentials(input.payload);
    const correlationId = input.correlationId?.trim() || randomUUID();
    const row = await withOutbox(this.outbox, async (client, enqueue) => {
      const created = await this.repo.createCommunication(
        {
          prospectId: input.prospectId ?? null,
          applicationId: input.applicationId ?? null,
          journeyInstanceId: input.journeyInstanceId ?? null,
          channel: input.channel,
          templateRef: input.templateRef ?? null,
          status: 'QUEUED',
          providerRef: null,
          subject: input.subject ?? null,
          payload: input.payload ?? {},
          metadata: input.metadata ?? {},
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.COMMUNICATION_QUEUED,
          aggregateId: created.id,
          aggregateType: 'acquisition_communication',
          correlationId,
          actorId: input.actorId,
          payload: { channel: created.channel, status: created.status },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'acquisition_communication',
          aggregateId: created.id,
          action: AcquisitionEventTypes.COMMUNICATION_QUEUED,
          actorId: input.actorId,
          afterState: { channel: created.channel, status: created.status },
          correlationId,
        },
        client,
      );
      return created;
    });

    // Adapter enqueues dispatch only — never marks DELIVERED on queue.
    if (
      this.notifications &&
      String(input.channel).toUpperCase() === 'EMAIL' &&
      input.templateRef?.trim()
    ) {
      const to =
        (typeof input.payload?.to === 'string' && input.payload.to.trim()) ||
        (typeof input.metadata?.to === 'string' && input.metadata.to.trim()) ||
        null;
      if (to) {
        await this.notifications.queueEmail({
          templateCode: input.templateRef.trim(),
          to,
          payload: input.payload ?? {},
          correlationId,
          communicationId: row.id,
          prospectId: input.prospectId ?? null,
          applicationId: input.applicationId ?? null,
        });
      }
    }

    return row;
  }
}

export class MarkCommunicationStatusUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    actorId?: string | null;
    communicationId: string;
    status: string;
    providerRef?: string | null;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    const row = await this.repo.getCommunication(input.communicationId);
    if (!row) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Communication not found');
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const updated = await this.repo.updateCommunicationStatus(
        row.id,
        input.status,
        {
          providerRef: input.providerRef ?? row.providerRef,
          metadata: { ...(row.metadata ?? {}), ...(input.metadata ?? {}) },
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.COMMUNICATION_QUEUED,
          aggregateId: updated.id,
          aggregateType: 'acquisition_communication',
          correlationId,
          actorId: input.actorId,
          payload: { fromStatus: row.status, toStatus: updated.status },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'acquisition_communication',
          aggregateId: updated.id,
          action: 'edge.p10.communication.status_updated',
          actorId: input.actorId,
          beforeState: { status: row.status },
          afterState: { status: updated.status },
          correlationId,
        },
        client,
      );
      return updated;
    });
  }
}

// ---------------------------------------------------------------------------
// P10.10 Analytics + overview
// ---------------------------------------------------------------------------

export class RecordAnalyticsEventUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly outbox?: ControlPlaneOutboxTransactionService,
  ) {}

  async execute(input: {
    eventName: string;
    prospectId?: string | null;
    leadId?: string | null;
    applicationId?: string | null;
    sessionKey?: string | null;
    properties?: Record<string, unknown>;
    occurredAt?: Date;
    actorId?: string | null;
    correlationId?: string | null;
  }) {
    if (!input.eventName?.trim()) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'eventName required');
    }
    const properties = stripSensitiveProperties(input.properties ?? {});
    const correlationId = input.correlationId?.trim() || randomUUID();
    return withOutbox(this.outbox, async (client, enqueue) => {
      const row = await this.repo.recordAnalyticsEvent(
        {
          eventName: input.eventName.trim(),
          prospectId: input.prospectId ?? null,
          leadId: input.leadId ?? null,
          applicationId: input.applicationId ?? null,
          sessionKey: input.sessionKey ?? null,
          properties,
          occurredAt: input.occurredAt ?? new Date(),
        },
        client,
      );
      await enqueue(
        buildAcquisitionOutboxEvent({
          eventType: AcquisitionEventTypes.ANALYTICS_RECORDED,
          aggregateId: row.id,
          aggregateType: 'analytics_event',
          correlationId,
          actorId: input.actorId,
          payload: { eventName: row.eventName },
        }),
      );
      await addAuditEvent(
        this.repo,
        {
          aggregateType: 'analytics_event',
          aggregateId: row.id,
          action: AcquisitionEventTypes.ANALYTICS_RECORDED,
          actorId: input.actorId,
          afterState: { eventName: row.eventName },
          correlationId,
        },
        client,
      );
      return row;
    });
  }
}

export class GetConversionFunnelUseCase {
  constructor(private readonly repo: AcquisitionRepositoryPort) {}

  async execute(input?: { prospectId?: string; verticalId?: string; limit?: number }) {
    const { items } = await this.repo.listAnalyticsEvents({
      prospectId: input?.prospectId,
      verticalId: input?.verticalId,
      limit: input?.limit ?? 5000,
    });
    const counts: Record<string, number> = {};
    for (const event of items) {
      counts[event.eventName] = (counts[event.eventName] ?? 0) + 1;
    }
    return {
      totalEvents: items.length,
      countsByEventName: counts,
      note: 'Honest aggregates from recorded analytics_events only — no estimated conversion.',
    };
  }
}

export class GetAcquisitionOverviewUseCase {
  constructor(private readonly repo: AcquisitionRepositoryPort) {}

  execute(verticalId?: string) {
    return this.repo.getAcquisitionOverviewCounts(verticalId);
  }
}

export class GetCheckoutSessionUseCase {
  constructor(private readonly repo: AcquisitionRepositoryPort) {}

  async execute(input: { id: string }) {
    const session = await this.repo.getCheckoutSession(input.id);
    if (!session) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Checkout session not found');
    }
    return session;
  }
}

/** Public-safe projection — no payment credentials, only status + non-sensitive refs. */
export class GetPublicCheckoutSessionUseCase {
  constructor(private readonly repo: AcquisitionRepositoryPort) {}

  async execute(input: { id: string }) {
    const session = await this.repo.getCheckoutSession(input.id);
    if (!session) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Checkout session not found');
    }
    return {
      id: session.id,
      status: session.status,
      applicationId: session.applicationId,
      prospectId: session.prospectId,
      planPresentationId: session.planPresentationId,
      commercialPlanId: session.commercialPlanId,
      quoteReferenceId: session.quoteReferenceId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      note: 'Status from acquisition orchestration only — P6 payment truth is authoritative when paymentIntentRef is present.',
    };
  }
}

export class ListCheckoutSessionsUseCase {
  constructor(private readonly repo: AcquisitionRepositoryPort) {}

  execute(filter?: AcquisitionListFilter) {
    return this.repo.listCheckoutSessions(filter);
  }
}

export class ListSubscriptionHandoffsUseCase {
  constructor(private readonly repo: AcquisitionRepositoryPort) {}

  execute(filter?: AcquisitionListFilter) {
    return this.repo.listSubscriptionHandoffs(filter);
  }
}
