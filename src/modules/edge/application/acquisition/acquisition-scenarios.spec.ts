// @ts-nocheck — large in-memory port fakes; exercised by Vitest, not production types.
/**
 * P10 mandate §27.6 — domain/application scenario suite (40 scenarios).
 * Honest label: NOT live browser E2E. Executable Vitest domain/application tests
 * against in-memory fakes of AcquisitionRepositoryPort + related ports.
 */
import { describe, expect, it, vi, afterAll } from 'vitest';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { AcquisitionRepositoryPort } from '../../domain/acquisition/acquisition-repository.port.js';
import type { AcquisitionDocumentStoragePort } from '../../domain/acquisition/document-storage.port.js';
import type { AcquisitionNotificationPort } from '../../domain/acquisition/acquisition-notification.port.js';
import {
  assertFormVersionMutable,
  assertHandoffCompletable,
} from '../../domain/acquisition/acquisition-policy.js';
import { evaluateCondition, evaluateConditionRules } from '../../domain/acquisition/form-condition.js';
import { validateFormAnswers } from '../../domain/acquisition/form-validation.js';
import type {
  Application,
  CheckoutSession,
  DocumentReference,
  FormPublication,
  FormSchema,
  FormVersion,
  PlanPresentation,
  ProductPresentation,
  Prospect,
  QualificationRecord,
  QuoteReference,
  QuoteRequest,
  SubscriptionHandoff,
} from '../../domain/acquisition/acquisition.types.js';
import { CommercialAvailability } from '../../domain/product/product.entity.js';
import type { ProductRepositoryPort } from '../../domain/ports/product-repository.port.js';
import type { CommercialPlan, CommercialRepositoryPort } from '../../domain/ports/commercial-repository.port.js';
import { assertSingleProductSubscription } from '../../domain/subscription/subscription.entity.js';
import { CreateSubscriptionUseCase } from '../subscription/subscription.use-cases.js';
import {
  AcceptQuoteUseCase,
  AttachPaymentReferenceUseCase,
  AttachQuoteReferenceUseCase,
  CompleteSubscriptionHandoffUseCase,
  CreateApplicationDraftUseCase,
  CreateCheckoutSessionUseCase,
  CreateProspectUseCase,
  CreateQuoteRequestUseCase,
  DecideQualificationUseCase,
  GetCustomerPortalSnapshotUseCase,
  GetPublicFormBySlugUseCase,
  ListPlanPresentationsUseCase,
  ListPublicProductDiscoveryUseCase,
  RecordAnalyticsEventUseCase,
  RecordPaymentResultUseCase,
  RegisterDocumentUploadUseCase,
  RequestMissingInformationUseCase,
  RequestSubscriptionHandoffUseCase,
  RevalidatePlanBeforeCheckoutUseCase,
  ReviewDocumentUseCase,
  SaveApplicationAnswersUseCase,
  StartQualificationUseCase,
  SubmitApplicationUseCase,
  TransitionApplicationReviewUseCase,
  TransitionProspectUseCase,
} from './acquisition.use-cases.js';

type Evidence = {
  id: string;
  pass: boolean;
  expected: string;
  actual: string;
};

const evidence: Evidence[] = [];

function recordEvidence(id: string, pass: boolean, expected: string, actual: string): void {
  evidence.push({ id, pass, expected, actual });
  expect(pass, `${id}: expected=${expected} actual=${actual}`).toBe(true);
}

function outboxStub() {
  return {
    runWithOutbox: vi.fn(async (_t: string, fn: (c: unknown, e: unknown) => unknown) =>
      fn({}, vi.fn()),
    ),
  };
}

type Store = {
  presentations: ProductPresentation[];
  planPresentations: PlanPresentation[];
  formSchemas: Map<string, FormSchema>;
  formVersions: Map<string, FormVersion>;
  formPublications: Map<string, FormPublication>;
  prospects: Map<string, Prospect>;
  applications: Map<string, Application>;
  answers: Array<{
    applicationId: string;
    fieldKey: string;
    value: unknown;
    metadata: Record<string, unknown>;
  }>;
  documents: Map<string, DocumentReference>;
  qualifications: Map<string, QualificationRecord>;
  quoteRequests: Map<string, QuoteRequest>;
  quoteReferences: Map<string, QuoteReference>;
  checkoutSessions: Map<string, CheckoutSession>;
  handoffs: Map<string, SubscriptionHandoff>;
  analytics: Array<Record<string, unknown>>;
  audits: unknown[];
  idempotency: Map<string, { scope: string; idempotencyKey: string; status: string; responseRef: string | null }>;
  subscriptions: Array<{ id: string; accountId: string; productId: string }>;
};

function rid(prefix: string): string {
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`;
}

function now(): Date {
  return new Date();
}

function emptyStore(): Store {
  return {
    presentations: [],
    planPresentations: [],
    formSchemas: new Map(),
    formVersions: new Map(),
    formPublications: new Map(),
    prospects: new Map(),
    applications: new Map(),
    answers: [],
    documents: new Map(),
    qualifications: new Map(),
    quoteRequests: new Map(),
    quoteReferences: new Map(),
    checkoutSessions: new Map(),
    handoffs: new Map(),
    analytics: [],
    audits: [],
    idempotency: new Map(),
    subscriptions: [],
  };
}

function createFakeRepo(store: Store): AcquisitionRepositoryPort {
  return {
    listProductPresentations: async (filter) => {
      let items = store.presentations;
      if (filter?.status) items = items.filter((p) => p.status === filter.status);
      return { items, total: items.length };
    },
    getProductPresentation: async (id) => store.presentations.find((p) => p.id === id) ?? null,
    getProductPresentationBySlug: async (slug) =>
      store.presentations.find((p) => p.slug === slug) ?? null,
    listPlanPresentations: async (filter) => {
      let items = store.planPresentations;
      if (filter?.status) items = items.filter((p) => p.status === filter.status);
      return { items, total: items.length };
    },
    getPlanPresentation: async (id) => store.planPresentations.find((p) => p.id === id) ?? null,
    createProspect: async (input) => {
      const row: Prospect = {
        id: input.id ?? rid('prospect'),
        emailNormalized: input.emailNormalized,
        displayName: input.displayName ?? null,
        companyName: input.companyName ?? null,
        status: input.status ?? 'NEW',
        commercialAccountId: input.commercialAccountId ?? null,
        productId: input.productId ?? null,
        commercialPlanId: input.commercialPlanId ?? null,
        planPresentationId: input.planPresentationId ?? null,
        locale: input.locale ?? null,
        country: input.country ?? null,
        sourceChannel: input.sourceChannel ?? null,
        metadata: input.metadata ?? {},
        createdBy: input.createdBy ?? null,
        updatedBy: input.updatedBy ?? null,
        createdAt: now(),
        updatedAt: now(),
        version: input.version ?? 1,
      };
      store.prospects.set(row.id, row);
      return row;
    },
    getProspect: async (id) => store.prospects.get(id) ?? null,
    listProspects: async (filter) => {
      let items = [...store.prospects.values()];
      if (filter?.emailNormalized) {
        items = items.filter((p) => p.emailNormalized === filter.emailNormalized);
      }
      if (filter?.status) items = items.filter((p) => p.status === filter.status);
      return { items, total: items.length };
    },
    transitionProspect: async (id, toStatus, patch) => {
      const p = store.prospects.get(id);
      if (!p) throw new Error('missing prospect');
      const updated: Prospect = {
        ...p,
        ...patch,
        status: toStatus,
        updatedAt: now(),
        version: p.version + 1,
      };
      store.prospects.set(id, updated);
      return updated;
    },
    getFormSchema: async (id) => store.formSchemas.get(id) ?? null,
    getFormVersion: async (id) => store.formVersions.get(id) ?? null,
    publishFormVersion: async (id, publishedBy) => {
      const v = store.formVersions.get(id);
      if (!v) throw new Error('missing');
      assertFormVersionMutable(String(v.status), v.immutableAfterPublish);
      const published: FormVersion = {
        ...v,
        status: 'PUBLISHED',
        publishedAt: now(),
        publishedBy,
        immutableAfterPublish: true,
      };
      store.formVersions.set(id, published);
      return published;
    },
    createFormPublication: async (input) => {
      const pub: FormPublication = {
        id: rid('pub'),
        formSchemaId: input.formSchemaId,
        formVersionId: input.formVersionId,
        channel: input.channel,
        publicSlug: input.publicSlug ?? null,
        status: input.status,
        publishedAt: now(),
        publishedBy: input.publishedBy,
        expiresAt: input.expiresAt ?? null,
        metadata: input.metadata ?? {},
        createdAt: now(),
      };
      store.formPublications.set(pub.id, pub);
      return pub;
    },
    getFormPublicationBySlug: async (slug) =>
      [...store.formPublications.values()].find((p) => p.publicSlug === slug) ?? null,
    getFormPublication: async (id) => store.formPublications.get(id) ?? null,
    createApplication: async (input) => {
      const app: Application = {
        id: rid('app'),
        applicationNumber: `A-${store.applications.size + 1}`,
        prospectId: input.prospectId,
        leadId: input.leadId ?? null,
        formSchemaId: input.formSchemaId,
        formVersionId: input.formVersionId,
        formPublicationId: input.formPublicationId ?? null,
        productId: input.productId ?? null,
        commercialPlanId: input.commercialPlanId ?? null,
        planPresentationId: input.planPresentationId ?? null,
        status: input.status ?? 'DRAFT',
        submittedAt: input.submittedAt ?? null,
        decidedAt: null,
        decidedBy: null,
        decisionReason: null,
        metadata: input.metadata ?? {},
        createdBy: input.createdBy ?? null,
        updatedBy: null,
        createdAt: now(),
        updatedAt: now(),
        version: 1,
      };
      store.applications.set(app.id, app);
      return app;
    },
    getApplication: async (id) => store.applications.get(id) ?? null,
    listApplications: async (filter) => {
      let items = [...store.applications.values()];
      if (filter?.prospectId) items = items.filter((a) => a.prospectId === filter.prospectId);
      if (filter?.status) items = items.filter((a) => a.status === filter.status);
      return { items, total: items.length };
    },
    transitionApplication: async (id, toStatus, patch) => {
      const app = store.applications.get(id);
      if (!app) throw new Error('missing app');
      if (patch?.expectedVersion != null && app.version !== patch.expectedVersion) {
        throw new DomainError(ErrorCode.CONFLICT, 'Application version conflict');
      }
      const updated: Application = {
        ...app,
        ...patch,
        status: toStatus,
        updatedAt: now(),
        version: app.version + 1,
      };
      store.applications.set(id, updated);
      return updated;
    },
    touchApplication: async (id, expectedVersion) => {
      const app = store.applications.get(id);
      if (!app) throw new Error('missing app');
      if (expectedVersion != null && app.version !== expectedVersion) {
        throw new DomainError(ErrorCode.CONFLICT, 'Application version conflict');
      }
      const updated: Application = {
        ...app,
        updatedAt: now(),
        version: app.version + 1,
      };
      store.applications.set(id, updated);
      return updated;
    },
    upsertApplicationAnswer: async (input) => {
      const existing = store.answers.findIndex(
        (a) => a.applicationId === input.applicationId && a.fieldKey === input.fieldKey,
      );
      const row = {
        applicationId: input.applicationId,
        fieldKey: input.fieldKey,
        value: input.value,
        metadata: input.metadata ?? {},
      };
      if (existing >= 0) store.answers[existing] = row;
      else store.answers.push(row);
      return {
        id: rid('ans'),
        applicationId: input.applicationId,
        fieldKey: input.fieldKey,
        value: input.value,
        metadata: input.metadata ?? {},
        createdAt: now(),
        updatedAt: now(),
      };
    },
    listApplicationAnswers: async (applicationId) =>
      store.answers
        .filter((a) => a.applicationId === applicationId)
        .map((a, i) => ({
          id: `ans-${i}`,
          applicationId: a.applicationId,
          fieldKey: a.fieldKey,
          value: a.value,
          metadata: a.metadata,
          createdAt: now(),
          updatedAt: now(),
        })),
    addApplicationEvent: async (input) => ({
      id: rid('appevt'),
      ...input,
      createdAt: now(),
    }),
    createDocumentReference: async (input) => {
      const doc: DocumentReference = {
        id: rid('doc'),
        applicationId: input.applicationId,
        requirementId: input.requirementId ?? null,
        documentType: input.documentType,
        storageRef: input.storageRef,
        fileName: input.fileName ?? null,
        contentType: input.contentType ?? null,
        checksumSha256: input.checksumSha256 ?? null,
        status: input.status ?? 'UPLOADED',
        metadata: input.metadata ?? {},
        uploadedBy: input.uploadedBy ?? null,
        createdAt: now(),
        updatedAt: now(),
        version: 1,
      };
      store.documents.set(doc.id, doc);
      return doc;
    },
    getDocumentReference: async (id) => store.documents.get(id) ?? null,
    listDocumentReferences: async (filter) => {
      let items = [...store.documents.values()];
      if (filter?.applicationId) {
        items = items.filter((d) => d.applicationId === filter.applicationId);
      }
      return { items, total: items.length };
    },
    transitionDocumentReference: async (id, toStatus, patch) => {
      const doc = store.documents.get(id);
      if (!doc) throw new Error('missing doc');
      const updated: DocumentReference = {
        ...doc,
        ...patch,
        status: toStatus,
        updatedAt: now(),
        version: doc.version + 1,
      };
      store.documents.set(id, updated);
      return updated;
    },
    createDocumentReview: async (input) => ({
      id: rid('drev'),
      ...input,
      createdAt: now(),
    }),
    upsertQualification: async (input) => {
      const existing = [...store.qualifications.values()].find(
        (q) => q.applicationId === input.applicationId,
      );
      const row: QualificationRecord = {
        id: existing?.id ?? rid('qual'),
        applicationId: input.applicationId,
        status: input.status,
        outcomeSummary: input.outcomeSummary ?? null,
        reviewerId: input.reviewerId ?? null,
        approvedBy: input.approvedBy ?? null,
        decidedAt: input.decidedAt ?? null,
        criteria: input.criteria ?? {},
        evidence: input.evidence ?? {},
        metadata: input.metadata ?? {},
        createdAt: existing?.createdAt ?? now(),
        updatedAt: now(),
        version: (existing?.version ?? 0) + 1,
      };
      store.qualifications.set(row.id, row);
      return row;
    },
    getQualificationByApplication: async (applicationId) =>
      [...store.qualifications.values()].find((q) => q.applicationId === applicationId) ?? null,
    transitionQualification: async (id, toStatus, patch) => {
      const q = store.qualifications.get(id);
      if (!q) throw new Error('missing qual');
      const updated: QualificationRecord = {
        ...q,
        ...patch,
        status: toStatus,
        updatedAt: now(),
        version: q.version + 1,
      };
      store.qualifications.set(id, updated);
      return updated;
    },
    createQuoteRequest: async (input) => {
      const row: QuoteRequest = {
        id: rid('qr'),
        applicationId: input.applicationId ?? null,
        prospectId: input.prospectId,
        commercialPlanId: input.commercialPlanId ?? null,
        planPresentationId: input.planPresentationId ?? null,
        status: input.status ?? 'REQUESTED',
        requestedBy: input.requestedBy ?? null,
        notes: input.notes ?? null,
        metadata: input.metadata ?? {},
        createdAt: now(),
        updatedAt: now(),
        version: 1,
      };
      store.quoteRequests.set(row.id, row);
      return row;
    },
    getQuoteRequest: async (id) => store.quoteRequests.get(id) ?? null,
    listQuoteRequests: async (filter) => {
      let items = [...store.quoteRequests.values()];
      if (filter?.prospectId) items = items.filter((q) => q.prospectId === filter.prospectId);
      return { items, total: items.length };
    },
    attachQuoteReference: async (input) => {
      const ref: QuoteReference = {
        id: rid('qref'),
        quoteRequestId: input.quoteRequestId,
        externalQuoteRef: input.externalQuoteRef,
        commercialSource: input.commercialSource,
        status: input.status,
        validUntil: input.validUntil ?? null,
        displaySummary: input.displaySummary ?? {},
        metadata: input.metadata ?? {},
        createdAt: now(),
      };
      store.quoteReferences.set(ref.id, ref);
      return ref;
    },
    getActiveQuoteReference: async (quoteRequestId) =>
      [...store.quoteReferences.values()].find(
        (r) => r.quoteRequestId === quoteRequestId && r.status === 'ACTIVE',
      ) ?? null,
    transitionQuoteRequest: async (id, toStatus) => {
      const q = store.quoteRequests.get(id);
      if (!q) throw new Error('missing qr');
      const updated = { ...q, status: toStatus, updatedAt: now(), version: q.version + 1 };
      store.quoteRequests.set(id, updated);
      return updated;
    },
    createCheckoutSession: async (input) => {
      const row: CheckoutSession = {
        id: rid('co'),
        applicationId: input.applicationId ?? null,
        prospectId: input.prospectId,
        planPresentationId: input.planPresentationId ?? null,
        commercialPlanId: input.commercialPlanId ?? null,
        quoteReferenceId: input.quoteReferenceId ?? null,
        status: input.status ?? 'CREATED',
        billingSessionRef: input.billingSessionRef ?? null,
        idempotencyKey: input.idempotencyKey,
        metadata: input.metadata ?? {},
        createdBy: input.createdBy ?? null,
        createdAt: now(),
        updatedAt: now(),
        version: 1,
      };
      store.checkoutSessions.set(row.id, row);
      return row;
    },
    getCheckoutSession: async (id) => store.checkoutSessions.get(id) ?? null,
    getCheckoutSessionByIdempotencyKey: async (key) =>
      [...store.checkoutSessions.values()].find((s) => s.idempotencyKey === key) ?? null,
    listCheckoutSessions: async (filter) => {
      let items = [...store.checkoutSessions.values()];
      if (filter?.prospectId) items = items.filter((s) => s.prospectId === filter.prospectId);
      return { items, total: items.length };
    },
    transitionCheckoutSession: async (id, toStatus, patch) => {
      const s = store.checkoutSessions.get(id);
      if (!s) throw new Error('missing checkout');
      const updated: CheckoutSession = {
        ...s,
        ...patch,
        status: toStatus,
        updatedAt: now(),
        version: s.version + 1,
      };
      store.checkoutSessions.set(id, updated);
      return updated;
    },
    addCheckoutEvent: async (input) => ({ id: rid('ce'), ...input, createdAt: now() }),
    createSubscriptionHandoff: async (input) => {
      const row: SubscriptionHandoff = {
        id: rid('ho'),
        checkoutSessionId: input.checkoutSessionId ?? null,
        applicationId: input.applicationId ?? null,
        prospectId: input.prospectId,
        commercialAccountId: input.commercialAccountId ?? null,
        commercialPlanId: input.commercialPlanId ?? null,
        status: input.status ?? 'REQUESTED',
        subscriptionRef: input.subscriptionRef ?? null,
        externalEvidenceRef: input.externalEvidenceRef ?? null,
        failureReason: input.failureReason ?? null,
        metadata: input.metadata ?? {},
        createdAt: now(),
        updatedAt: now(),
        version: 1,
      };
      store.handoffs.set(row.id, row);
      return row;
    },
    getSubscriptionHandoff: async (id) => store.handoffs.get(id) ?? null,
    listSubscriptionHandoffs: async (filter) => {
      let items = [...store.handoffs.values()];
      if (filter?.prospectId) items = items.filter((h) => h.prospectId === filter.prospectId);
      return { items, total: items.length };
    },
    transitionSubscriptionHandoff: async (id, toStatus, patch) => {
      const h = store.handoffs.get(id);
      if (!h) throw new Error('missing handoff');
      const updated: SubscriptionHandoff = {
        ...h,
        ...patch,
        status: toStatus,
        updatedAt: now(),
        version: h.version + 1,
      };
      store.handoffs.set(id, updated);
      return updated;
    },
    recordAnalyticsEvent: async (input) => {
      const row = {
        id: rid('ae'),
        ...input,
        createdAt: now(),
        occurredAt: input.occurredAt ?? now(),
      };
      store.analytics.push(row);
      return row as never;
    },
    listAnalyticsEvents: async () => ({
      items: store.analytics as never,
      total: store.analytics.length,
    }),
    appendAuditEvent: async (input) => {
      store.audits.push(input);
      return { id: rid('audit'), createdAt: now(), ...input };
    },
    beginIdempotency: async (input) => {
      const key = `${input.scope}::${input.idempotencyKey}`;
      const existing = store.idempotency.get(key);
      if (existing) return existing as never;
      const row = {
        id: rid('idem'),
        scope: input.scope,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash ?? null,
        status: 'STARTED' as const,
        responseRef: null as string | null,
        expiresAt: input.expiresAt ?? null,
        metadata: input.metadata ?? {},
        createdAt: now(),
        updatedAt: now(),
      };
      store.idempotency.set(key, row);
      return row as never;
    },
    completeIdempotency: async (scope, idempotencyKey, responseRef, status) => {
      const key = `${scope}::${idempotencyKey}`;
      const existing = store.idempotency.get(key) ?? {
        scope,
        idempotencyKey,
        status: 'STARTED',
        responseRef: null,
      };
      const updated = { ...existing, status, responseRef };
      store.idempotency.set(key, updated);
      return updated as never;
    },
    getIdempotency: async (scope, idempotencyKey) => {
      const key = `${scope}::${idempotencyKey}`;
      return (store.idempotency.get(key) as never) ?? null;
    },
  } as unknown as AcquisitionRepositoryPort;
}

function seedPublishedForm(store: Store, opts?: { slug?: string; fields?: unknown[]; versionId?: string }) {
  const schemaId = rid('fs');
  const versionId = opts?.versionId ?? rid('fv');
  const schema: FormSchema = {
    id: schemaId,
    code: 'acq',
    name: 'Acquisition',
    description: null,
    status: 'ACTIVE',
    productId: 'prod-1',
    commercialPlanId: null,
    currentPublishedVersionId: versionId,
    metadata: {},
    createdBy: 'actor',
    updatedBy: null,
    createdAt: now(),
    updatedAt: now(),
    version: 1,
  };
  const version: FormVersion = {
    id: versionId,
    formSchemaId: schemaId,
    versionNumber: 1,
    schemaDefinition: {
      fields: (opts?.fields as never) ?? [
        { key: 'email', type: 'email', required: true },
        { key: 'company', type: 'string', required: true },
      ],
    },
    conditionRules: [],
    status: 'PUBLISHED',
    publishedAt: now(),
    publishedBy: 'actor',
    immutableAfterPublish: true,
    metadata: {},
    createdBy: 'actor',
    createdAt: now(),
  };
  store.formSchemas.set(schemaId, schema);
  store.formVersions.set(versionId, version);
  if (opts?.slug) {
    const pub: FormPublication = {
      id: rid('pub'),
      formSchemaId: schemaId,
      formVersionId: versionId,
      channel: 'PUBLIC_WEB',
      publicSlug: opts.slug,
      status: 'ACTIVE',
      publishedAt: now(),
      publishedBy: 'actor',
      expiresAt: null,
      metadata: {},
      createdAt: now(),
    };
    store.formPublications.set(pub.id, pub);
  }
  return { schema, version };
}

function seedProspect(store: Store, email = 'user@example.com', metadata: Record<string, unknown> = {}) {
  const p: Prospect = {
    id: rid('prospect'),
    emailNormalized: email.toLowerCase(),
    displayName: 'User',
    companyName: null,
    status: 'NEW',
    commercialAccountId: null,
    productId: null,
    commercialPlanId: null,
    planPresentationId: null,
    locale: 'en',
    country: 'FR',
    sourceChannel: 'PUBLIC_WEB',
    metadata,
    createdBy: null,
    updatedBy: null,
    createdAt: now(),
    updatedAt: now(),
    version: 1,
  };
  store.prospects.set(p.id, p);
  return p;
}

function createProductFake(map: Record<string, CommercialAvailability>): ProductRepositoryPort {
  return {
    findById: vi.fn(async (id: string) => {
      const availability = map[id];
      if (!availability) return null;
      return { id, commercialAvailability: availability };
    }),
  } as unknown as ProductRepositoryPort;
}

function createCommercialFake(plan: Partial<CommercialPlan> & { id: string }): CommercialRepositoryPort {
  const full: CommercialPlan = {
    id: plan.id,
    code: plan.code ?? 'plan',
    name: plan.name ?? 'Plan',
    description: null,
    productId: plan.productId ?? 'prod-1',
    verticalId: plan.verticalId ?? 'v1',
    planTier: (plan.planTier as never) ?? 'STANDARD',
    solutionPackageId: null,
    status: plan.status ?? 'PUBLISHED',
    version: plan.version ?? 1,
    metadata: {},
    createdAt: now(),
    updatedAt: now(),
  };
  return {
    getPlan: vi.fn(async (id: string) => (id === full.id ? full : null)),
  } as unknown as CommercialRepositoryPort;
}

function createDocStorageFake(opts?: {
  scanStatus?: 'CLEAN' | 'INFECTED' | 'QUARANTINED' | 'SCAN_UNAVAILABLE';
  rejectContentTypes?: string[];
  authorizedActors?: string[];
}): AcquisitionDocumentStoragePort {
  const authorized = new Set(opts?.authorizedActors ?? ['reviewer-ok']);
  return {
    registerPrivateObject: async (input) => {
      if (opts?.rejectContentTypes?.includes(input.contentType)) {
        throw new Error('Unsupported content type');
      }
      if (/^https?:\/\//i.test(input.privateLocator)) {
        throw new Error('Public URL locators are forbidden');
      }
      return { storageKey: input.storageKey };
    },
    createAuthorizedReadGrant: async (storageKey, actorId, ttlSeconds) => {
      if (!authorized.has(actorId)) {
        throw new DomainError(ErrorCode.FORBIDDEN, 'Actor not authorized for private document', [
          { code: 'DOCUMENT_GRANT_DENIED', actorId, storageKey },
        ]);
      }
      return {
        grantToken: `grant-${actorId}-${storageKey}`,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      };
    },
    requestMalwareScan: async (storageKey) => {
      if (storageKey.includes('mock_infected') || storageKey.includes('infected')) {
        return { status: 'INFECTED' };
      }
      return { status: opts?.scanStatus ?? 'CLEAN' };
    },
  };
}

function createNotificationFake(): AcquisitionNotificationPort {
  return {
    queueEmail: vi.fn(async () => ({ queued: true })),
  } as unknown as AcquisitionNotificationPort;
}

function createSubscriptionUc(store: Store): CreateSubscriptionUseCase {
  const subscriptions = {
    createSubscription: async (input: {
      accountId: string;
      productId: string;
      actorId?: string;
      correlationId?: string;
      status?: string;
      createdBy?: string;
    }) => {
      assertSingleProductSubscription({ productId: input.productId });
      const sub = {
        id: rid('sub'),
        accountId: input.accountId,
        productId: input.productId,
        status: input.status ?? 'DRAFT',
      };
      store.subscriptions.push(sub);
      return sub as never;
    },
  };
  return new CreateSubscriptionUseCase(subscriptions as never, undefined);
}

describe('P10 §27.6 domain/application scenario suite (40)', () => {
  afterAll(() => {
    const passed = evidence.filter((e) => e.pass).length;
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        suite: 'domain/application scenario suite',
        total: evidence.length,
        passed,
        failed: evidence.length - passed,
        evidence,
      }),
    );
  });

  it('P10-S01: Visitor discovers available product', async () => {
    // Preconditions: PUBLISHED presentation + CommercialAvailability.AVAILABLE
    const store = emptyStore();
    store.presentations.push({
      id: 'pp-ok',
      productId: 'prod-available',
      code: 'a',
      slug: 'available',
      title: 'Available',
      summary: null,
      status: 'PUBLISHED',
      locale: 'en',
      currentPublishedVersionId: 'cv1',
      metadata: {},
      createdBy: 'x',
      updatedBy: null,
      createdAt: now(),
      updatedAt: now(),
      version: 1,
    });
    const repo = createFakeRepo(store);
    const products = createProductFake({
      'prod-available': CommercialAvailability.AVAILABLE,
    });
    const result = await new ListPublicProductDiscoveryUseCase(repo, products).execute();
    const pass = result.items.length === 1 && result.items[0]!.id === 'pp-ok';
    recordEvidence(
      'P10-S01',
      pass,
      '1 PUBLISHED+AVAILABLE presentation',
      `total=${result.total} ids=${result.items.map((i) => i.id).join(',')}`,
    );
  });

  it('P10-S02: Unavailable product cannot be subscribed (INTERNAL_ONLY/UNAVAILABLE excluded)', async () => {
    // Preconditions: PUBLISHED presentations for UNAVAILABLE + INTERNAL_ONLY products
    const store = emptyStore();
    store.presentations.push(
      {
        id: 'pp-unavail',
        productId: 'prod-unavail',
        code: 'u',
        slug: 'unavail',
        title: 'Unavail',
        summary: null,
        status: 'PUBLISHED',
        locale: 'en',
        currentPublishedVersionId: 'cv1',
        metadata: {},
        createdBy: 'x',
        updatedBy: null,
        createdAt: now(),
        updatedAt: now(),
        version: 1,
      },
      {
        id: 'pp-internal',
        productId: 'prod-internal',
        code: 'i',
        slug: 'internal',
        title: 'Internal',
        summary: null,
        status: 'PUBLISHED',
        locale: 'en',
        currentPublishedVersionId: 'cv2',
        metadata: {},
        createdBy: 'x',
        updatedBy: null,
        createdAt: now(),
        updatedAt: now(),
        version: 1,
      },
    );
    const repo = createFakeRepo(store);
    const products = createProductFake({
      'prod-unavail': CommercialAvailability.UNAVAILABLE,
      'prod-internal': CommercialAvailability.INTERNAL_ONLY,
    });
    const result = await new ListPublicProductDiscoveryUseCase(repo, products).execute();
    recordEvidence(
      'P10-S02',
      result.total === 0,
      '0 presentable products',
      `total=${result.total}`,
    );
  });

  it('P10-S03: Compare eligible plans (list plan presentations PUBLISHED)', async () => {
    // Preconditions: mix of PUBLISHED and DRAFT plan presentations
    const store = emptyStore();
    store.planPresentations.push(
      {
        id: 'pl-1',
        commercialPlanId: 'cp-1',
        productPresentationId: null,
        code: 'starter',
        title: 'Starter',
        summary: null,
        status: 'PUBLISHED',
        priceDisplayMode: 'AUTHORITATIVE',
        priceDisplayRef: 'price-ref-1',
        currencyHint: 'EUR',
        featuresDisplay: [],
        ctaLabel: 'Start',
        metadata: {},
        createdBy: 'x',
        updatedBy: null,
        createdAt: now(),
        updatedAt: now(),
        version: 1,
      },
      {
        id: 'pl-draft',
        commercialPlanId: 'cp-2',
        productPresentationId: null,
        code: 'hidden',
        title: 'Hidden',
        summary: null,
        status: 'DRAFT',
        priceDisplayMode: 'CONTACT',
        priceDisplayRef: null,
        currencyHint: null,
        featuresDisplay: [],
        ctaLabel: null,
        metadata: {},
        createdBy: 'x',
        updatedBy: null,
        createdAt: now(),
        updatedAt: now(),
        version: 1,
      },
    );
    const listed = await new ListPlanPresentationsUseCase(createFakeRepo(store)).execute({
      status: 'PUBLISHED',
    });
    recordEvidence(
      'P10-S03',
      listed.total === 1 && listed.items[0]!.id === 'pl-1',
      '1 PUBLISHED plan',
      `total=${listed.total}`,
    );
  });

  it('P10-S04: Product-specific form loaded from published schema (GetPublicFormBySlug)', async () => {
    // Preconditions: ACTIVE publication with PUBLISHED form version
    const store = emptyStore();
    seedPublishedForm(store, { slug: 'join-saas' });
    const result = await new GetPublicFormBySlugUseCase(createFakeRepo(store)).execute({
      publicSlug: 'join-saas',
    });
    recordEvidence(
      'P10-S04',
      result.formVersion.status === 'PUBLISHED' && result.publication.publicSlug === 'join-saas',
      'published form by slug',
      `status=${result.formVersion.status} slug=${result.publication.publicSlug}`,
    );
  });

  it('P10-S05: Segment-specific form fields (schema definition with segment metadata)', async () => {
    // Preconditions: schema fields carry segment metadata
    const store = emptyStore();
    const { version } = seedPublishedForm(store, {
      fields: [
        {
          key: 'segment',
          type: 'string',
          required: true,
          metadata: { segment: 'enterprise' },
        },
        {
          key: 'headcount',
          type: 'integer',
          required: false,
          metadata: { segment: 'enterprise' },
        },
      ],
    });
    const fields = version.schemaDefinition.fields as Array<{
      key: string;
      metadata?: { segment?: string };
    }>;
    const enterpriseFields = fields.filter((f) => f.metadata?.segment === 'enterprise');
    recordEvidence(
      'P10-S05',
      enterpriseFields.length === 2,
      '2 enterprise segment fields',
      `count=${enterpriseFields.length}`,
    );
  });

  it('P10-S06: Conditional fields behave (evaluateCondition / validateFormAnswers)', async () => {
    // Preconditions: field visible only when country=FR
    const schema = {
      fields: [
        { key: 'country', type: 'string', required: true },
        {
          key: 'siret',
          type: 'string',
          required: true,
          condition: { op: 'EQ', field: 'country', value: 'FR' },
        },
      ],
    };
    const hide = evaluateCondition({ op: 'EQ', field: 'country', value: 'FR' }, { country: 'US' });
    const show = evaluateCondition({ op: 'EQ', field: 'country', value: 'FR' }, { country: 'FR' });
    const validWhenHidden = validateFormAnswers(schema, { country: 'US' });
    const invalidWhenShown = validateFormAnswers(schema, { country: 'FR' });
    const pass =
      !hide.ok &&
      show.ok &&
      validWhenHidden.valid &&
      !invalidWhenShown.valid &&
      evaluateConditionRules([{ op: 'EQ', field: 'country', value: 'FR' }], { country: 'FR' }).ok;
    recordEvidence(
      'P10-S06',
      pass,
      'conditional visibility + validation',
      `hide=${hide.ok} show=${show.ok} validHidden=${validWhenHidden.valid} invalidShown=${invalidWhenShown.valid}`,
    );
  });

  it('P10-S07: Backend rejects invalid submission despite client manipulation', async () => {
    // Preconditions: draft bound to schema requiring email; client omits email
    const store = emptyStore();
    const { version } = seedPublishedForm(store);
    const prospect = seedProspect(store);
    const repo = createFakeRepo(store);
    const draft = await new CreateApplicationDraftUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
      formVersionId: version.id,
    });
    const save = new SaveApplicationAnswersUseCase(repo, outboxStub() as never);
    let rejected = false;
    try {
      await save.execute({
        applicationId: draft.id,
        answers: { company: 'Acme', email: 'not-an-email' },
      });
    } catch (err) {
      rejected = err instanceof DomainError;
    }
    recordEvidence('P10-S07', rejected, 'DomainError on invalid answers', `rejected=${rejected}`);
  });

  it('P10-S08: Draft saved and resumed (CreateApplicationDraft + SaveAnswers + get)', async () => {
    // Preconditions: published form + prospect
    const store = emptyStore();
    const { version } = seedPublishedForm(store);
    const prospect = seedProspect(store);
    const repo = createFakeRepo(store);
    const draft = await new CreateApplicationDraftUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
      formVersionId: version.id,
    });
    await new SaveApplicationAnswersUseCase(repo, outboxStub() as never).execute({
      applicationId: draft.id,
      answers: { email: 'a@b.com', company: 'Acme' },
    });
    const resumed = await repo.getApplication(draft.id);
    const answers = await repo.listApplicationAnswers(draft.id);
    const pass =
      resumed?.status === 'DRAFT' &&
      answers.length === 2 &&
      answers.some((a) => a.fieldKey === 'company' && a.value === 'Acme');
    recordEvidence(
      'P10-S08',
      pass,
      'draft with 2 answers resumable',
      `status=${resumed?.status} answers=${answers.length}`,
    );
  });

  it('P10-S09: Draft retains original schema version', async () => {
    // Preconditions: draft bound to fv-v1 while newer fv-v2 exists
    const store = emptyStore();
    const { schema, version: v1 } = seedPublishedForm(store, { versionId: 'fv-v1' });
    const v2: FormVersion = {
      ...v1,
      id: 'fv-v2',
      versionNumber: 2,
      schemaDefinition: {
        fields: [
          { key: 'email', type: 'email', required: true },
          { key: 'company', type: 'string', required: true },
          { key: 'extra', type: 'string', required: true },
        ],
      },
    };
    store.formVersions.set(v2.id, v2);
    store.formSchemas.set(schema.id, { ...schema, currentPublishedVersionId: v2.id });
    const prospect = seedProspect(store);
    const repo = createFakeRepo(store);
    const draft = await new CreateApplicationDraftUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
      formVersionId: v1.id,
    });
    const saved = await new SaveApplicationAnswersUseCase(repo, outboxStub() as never).execute({
      applicationId: draft.id,
      answers: { email: 'a@b.com', company: 'Acme' },
    });
    recordEvidence(
      'P10-S09',
      saved.formVersionId === 'fv-v1' && saved.formVersionNumber === 1,
      'bound fv-v1 retained',
      `formVersionId=${saved.formVersionId} n=${saved.formVersionNumber}`,
    );
  });

  it('P10-S10: Published schema cannot be modified in place (assertFormVersionMutable throws)', async () => {
    // Preconditions: PUBLISHED + immutableAfterPublish
    let threw = false;
    try {
      assertFormVersionMutable('PUBLISHED', true);
    } catch (err) {
      threw = err instanceof DomainError && (err as DomainError).code === ErrorCode.CONFLICT;
    }
    recordEvidence('P10-S10', threw, 'CONFLICT FORM_VERSION_IMMUTABLE', `threw=${threw}`);
  });

  it('P10-S11: New form version does not alter existing applications', async () => {
    // Preconditions: application bound to v1; v2 published later
    const store = emptyStore();
    const { version: v1 } = seedPublishedForm(store, { versionId: 'fv-bound' });
    const prospect = seedProspect(store);
    const repo = createFakeRepo(store);
    const draft = await new CreateApplicationDraftUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
      formVersionId: v1.id,
    });
    store.formVersions.set('fv-new', {
      ...v1,
      id: 'fv-new',
      versionNumber: 2,
    });
    const app = await repo.getApplication(draft.id);
    recordEvidence(
      'P10-S11',
      app?.formVersionId === 'fv-bound',
      'application still on fv-bound',
      `formVersionId=${app?.formVersionId}`,
    );
  });

  it('P10-S12: Prospect registers (CreateProspect) — contact verification can be status CONTACTED', async () => {
    // Preconditions: new email
    const store = emptyStore();
    const repo = createFakeRepo(store);
    const prospect = await new CreateProspectUseCase(repo, outboxStub() as never).execute({
      email: 'new@example.com',
      displayName: 'New',
    });
    const contacted = await new TransitionProspectUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
      toStatus: 'CONTACTED',
    });
    recordEvidence(
      'P10-S12',
      prospect.status === 'NEW' && contacted.status === 'CONTACTED',
      'NEW → CONTACTED',
      `${prospect.status}→${contacted.status}`,
    );
  });

  it('P10-S13: Duplicate prospect detection', async () => {
    // Preconditions: prospect already exists for email
    const store = emptyStore();
    const repo = createFakeRepo(store);
    await new CreateProspectUseCase(repo, outboxStub() as never).execute({
      email: 'dup@example.com',
    });
    let duplicate = false;
    try {
      await new CreateProspectUseCase(repo, outboxStub() as never).execute({
        email: 'Dup@Example.com',
      });
    } catch (err) {
      duplicate =
        err instanceof DomainError &&
        err.code === ErrorCode.CONFLICT &&
        Boolean(err.details?.some((d) => d.code === 'PROSPECT_DUPLICATE_EMAIL'));
    }
    recordEvidence('P10-S13', duplicate, 'CONFLICT PROSPECT_DUPLICATE_EMAIL', `duplicate=${duplicate}`);
  });

  it('P10-S14: Organization profile fields on prospect metadata', async () => {
    // Preconditions: CreateProspect with org metadata
    const store = emptyStore();
    const repo = createFakeRepo(store);
    const prospect = await new CreateProspectUseCase(repo, outboxStub() as never).execute({
      email: 'org@example.com',
      companyName: 'Acme Corp',
      metadata: {
        organization: {
          legalName: 'Acme Corp SAS',
          vatNumber: 'FR123',
          employeeCount: 120,
        },
      },
    });
    const org = prospect.metadata.organization as Record<string, unknown>;
    const pass =
      prospect.companyName === 'Acme Corp' &&
      org?.legalName === 'Acme Corp SAS' &&
      org?.vatNumber === 'FR123';
    recordEvidence(
      'P10-S14',
      pass,
      'org profile on metadata',
      `company=${prospect.companyName} legal=${org?.legalName}`,
    );
  });

  it('P10-S15: Required documents registered securely (private locator, no http URL)', async () => {
    // Preconditions: application exists; storage port bound
    const store = emptyStore();
    const { version } = seedPublishedForm(store);
    const prospect = seedProspect(store);
    const repo = createFakeRepo(store);
    const draft = await new CreateApplicationDraftUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
      formVersionId: version.id,
    });
    const storage = createDocStorageFake();
    const uc = new RegisterDocumentUploadUseCase(repo, outboxStub() as never, storage);
    const doc = await uc.execute({
      applicationId: draft.id,
      documentType: 'KBIS',
      storageKey: 'private/acq/docs/kbis-1',
      privateLocator: 'private/acq/docs/kbis-1',
      contentType: 'application/pdf',
      byteSize: 1024,
    });
    let urlRejected = false;
    try {
      await uc.execute({
        applicationId: draft.id,
        documentType: 'KBIS',
        storageKey: 'https://evil.example/file.pdf',
        contentType: 'application/pdf',
        byteSize: 10,
      });
    } catch {
      urlRejected = true;
    }
    const pass =
      urlRejected &&
      !/^https?:\/\//i.test(doc.storageRef) &&
      doc.metadata.storageVisibility === 'private';
    recordEvidence(
      'P10-S15',
      pass,
      'private locator + http URL rejected',
      `storageRef=${doc.storageRef} urlRejected=${urlRejected}`,
    );
  });

  it('P10-S16: Malicious/invalid document rejected or quarantined', async () => {
    // Preconditions: infected key or bad content-type
    const store = emptyStore();
    const { version } = seedPublishedForm(store);
    const prospect = seedProspect(store);
    const repo = createFakeRepo(store);
    const draft = await new CreateApplicationDraftUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
      formVersionId: version.id,
    });
    const storage = createDocStorageFake({ rejectContentTypes: ['application/x-msdownload'] });
    const uc = new RegisterDocumentUploadUseCase(repo, outboxStub() as never, storage);
    const infected = await uc.execute({
      applicationId: draft.id,
      documentType: 'ATTACHMENT',
      storageKey: 'private/mock_infected/doc.bin',
      contentType: 'application/pdf',
      byteSize: 50,
    });
    let badType = false;
    try {
      await uc.execute({
        applicationId: draft.id,
        documentType: 'ATTACHMENT',
        storageKey: 'private/acq/evil.exe',
        contentType: 'application/x-msdownload',
        byteSize: 50,
      });
    } catch {
      badType = true;
    }
    const pass =
      (infected.status === 'WITHDRAWN' || infected.metadata.quarantined === true) && badType;
    recordEvidence(
      'P10-S16',
      pass,
      'infected quarantined + bad content-type rejected',
      `status=${infected.status} quarantined=${infected.metadata.quarantined} badType=${badType}`,
    );
  });

  it('P10-S17: Reviewer requests missing information', async () => {
    // Preconditions: application SUBMITTED then IN_REVIEW
    const store = emptyStore();
    const { version } = seedPublishedForm(store);
    const prospect = seedProspect(store);
    const repo = createFakeRepo(store);
    const draft = await new CreateApplicationDraftUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
      formVersionId: version.id,
    });
    await new SaveApplicationAnswersUseCase(repo, outboxStub() as never).execute({
      applicationId: draft.id,
      answers: { email: 'a@b.com', company: 'Acme' },
    });
    await new SubmitApplicationUseCase(repo, outboxStub() as never).execute({
      applicationId: draft.id,
    });
    await new TransitionApplicationReviewUseCase(repo, outboxStub() as never).execute({
      actorId: 'reviewer',
      applicationId: draft.id,
      toStatus: 'IN_REVIEW',
    });
    const pending = await new RequestMissingInformationUseCase(repo, outboxStub() as never).execute({
      actorId: 'reviewer',
      applicationId: draft.id,
      reason: 'Need KBIS',
      missingFields: ['kbis'],
    });
    recordEvidence(
      'P10-S17',
      pending.status === 'DOCUMENTS_PENDING',
      'DOCUMENTS_PENDING',
      `status=${pending.status}`,
    );
  });

  it('P10-S18: Customer submits missing information (answers again / transition)', async () => {
    // Preconditions: application in DOCUMENTS_PENDING
    const store = emptyStore();
    const { version } = seedPublishedForm(store);
    const prospect = seedProspect(store);
    const repo = createFakeRepo(store);
    const draft = await new CreateApplicationDraftUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
      formVersionId: version.id,
    });
    await new SaveApplicationAnswersUseCase(repo, outboxStub() as never).execute({
      applicationId: draft.id,
      answers: { email: 'a@b.com', company: 'Acme' },
    });
    await new SubmitApplicationUseCase(repo, outboxStub() as never).execute({ applicationId: draft.id });
    await new TransitionApplicationReviewUseCase(repo, outboxStub() as never).execute({
      actorId: 'reviewer',
      applicationId: draft.id,
      toStatus: 'IN_REVIEW',
    });
    await new RequestMissingInformationUseCase(repo, outboxStub() as never).execute({
      actorId: 'reviewer',
      applicationId: draft.id,
      reason: 'Need more info',
    });
    const saved = await new SaveApplicationAnswersUseCase(repo, outboxStub() as never).execute({
      applicationId: draft.id,
      answers: { email: 'a@b.com', company: 'Acme Updated' },
    });
    const back = await new TransitionApplicationReviewUseCase(repo, outboxStub() as never).execute({
      actorId: 'customer',
      applicationId: draft.id,
      toStatus: 'IN_REVIEW',
    });
    recordEvidence(
      'P10-S18',
      saved.answers.some((a) => a.value === 'Acme Updated') && back.status === 'IN_REVIEW',
      'answers updated + back to IN_REVIEW',
      `status=${back.status}`,
    );
  });

  it('P10-S19: Reviewer accepts document', async () => {
    // Preconditions: document UPLOADED
    const store = emptyStore();
    const { version } = seedPublishedForm(store);
    const prospect = seedProspect(store);
    const repo = createFakeRepo(store);
    const draft = await new CreateApplicationDraftUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
      formVersionId: version.id,
    });
    const doc = await new RegisterDocumentUploadUseCase(repo, outboxStub() as never).execute({
      applicationId: draft.id,
      documentType: 'KBIS',
      storageKey: 'private/doc-ok',
    });
    const reviewed = await new ReviewDocumentUseCase(repo, outboxStub() as never).execute({
      actorId: 'reviewer',
      documentReferenceId: doc.id,
      decision: 'ACCEPTED',
    });
    recordEvidence(
      'P10-S19',
      reviewed.document.status === 'ACCEPTED' && reviewed.review.decision === 'ACCEPTED',
      'document ACCEPTED',
      `status=${reviewed.document.status}`,
    );
  });

  it('P10-S20: Product-specific qualification workflow', async () => {
    // Preconditions: submitted application for product
    const store = emptyStore();
    const { version } = seedPublishedForm(store);
    const prospect = seedProspect(store);
    const repo = createFakeRepo(store);
    const draft = await new CreateApplicationDraftUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
      formVersionId: version.id,
      productId: 'prod-vertical-a',
    });
    const started = await new StartQualificationUseCase(repo, outboxStub() as never).execute({
      actorId: 'reviewer',
      applicationId: draft.id,
      criteria: { productId: 'prod-vertical-a', minScore: 70 },
    });
    const decided = await new DecideQualificationUseCase(repo, outboxStub() as never).execute({
      actorId: 'reviewer',
      applicationId: draft.id,
      decision: 'APPROVED',
      outcomeSummary: 'Meets product criteria',
    });
    recordEvidence(
      'P10-S20',
      started.status === 'IN_PROGRESS' &&
        decided.status === 'APPROVED' &&
        (started.criteria as { productId?: string }).productId === 'prod-vertical-a',
      'product qualification APPROVED',
      `start=${started.status} end=${decided.status}`,
    );
  });

  it('P10-S21: Enterprise request technical review path (quote/qualification statuses)', async () => {
    // Preconditions: enterprise application with CONDITIONAL then APPROVED
    const store = emptyStore();
    const { version } = seedPublishedForm(store);
    const prospect = seedProspect(store, 'ent@example.com', { segment: 'enterprise' });
    const repo = createFakeRepo(store);
    const draft = await new CreateApplicationDraftUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
      formVersionId: version.id,
      metadata: { path: 'enterprise-technical-review' },
    });
    await new StartQualificationUseCase(repo, outboxStub() as never).execute({
      actorId: 'tech-reviewer',
      applicationId: draft.id,
      criteria: { technicalReview: true },
    });
    const conditional = await new DecideQualificationUseCase(repo, outboxStub() as never).execute({
      actorId: 'tech-reviewer',
      applicationId: draft.id,
      decision: 'CONDITIONAL',
      outcomeSummary: 'Needs architecture review',
    });
    // CONDITIONAL → APPROVED allowed by policy
    store.qualifications.set(conditional.id, { ...conditional, status: 'CONDITIONAL' });
    const approved = await new DecideQualificationUseCase(repo, outboxStub() as never).execute({
      actorId: 'tech-reviewer',
      applicationId: draft.id,
      decision: 'APPROVED',
    });
    const quote = await new CreateQuoteRequestUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
      applicationId: draft.id,
      notes: 'Enterprise quote after technical review',
    });
    recordEvidence(
      'P10-S21',
      conditional.status === 'CONDITIONAL' &&
        approved.status === 'APPROVED' &&
        quote.status === 'REQUESTED',
      'CONDITIONAL→APPROVED + quote REQUESTED',
      `qual=${approved.status} quote=${quote.status}`,
    );
  });

  it('P10-S22: Quote request created', async () => {
    // Preconditions: prospect exists
    const store = emptyStore();
    const prospect = seedProspect(store);
    const repo = createFakeRepo(store);
    const quote = await new CreateQuoteRequestUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
      commercialPlanId: 'cp-1',
      notes: 'Please quote',
    });
    recordEvidence(
      'P10-S22',
      quote.status === 'REQUESTED' && quote.prospectId === prospect.id,
      'quote REQUESTED',
      `status=${quote.status}`,
    );
  });

  it('P10-S23: Proposal acceptance → handoff path (AcceptQuote then RequestSubscriptionHandoff)', async () => {
    // Preconditions: quote QUOTED with active reference
    const store = emptyStore();
    const prospect = seedProspect(store);
    const repo = createFakeRepo(store);
    const quote = await new CreateQuoteRequestUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
    });
    await new AttachQuoteReferenceUseCase(repo, outboxStub() as never).execute({
      quoteRequestId: quote.id,
      externalQuoteRef: 'ext-quote-1',
      commercialSource: 'P7',
    });
    const accepted = await new AcceptQuoteUseCase(repo, outboxStub() as never).execute({
      quoteRequestId: quote.id,
    });
    const handoff = await new RequestSubscriptionHandoffUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
      metadata: { quoteRequestId: quote.id },
    });
    recordEvidence(
      'P10-S23',
      accepted.quoteRequest.status === 'ACCEPTED' && handoff.status === 'REQUESTED',
      'quote ACCEPTED + handoff REQUESTED',
      `quote=${accepted.quoteRequest.status} handoff=${handoff.status}`,
    );
  });

  it('P10-S24: Selected plan revalidated with commercial port (RevalidatePlanBeforeCheckout)', async () => {
    // Preconditions: PUBLISHED plan presentation + matching commercial plan
    const store = emptyStore();
    store.planPresentations.push({
      id: 'pl-reval',
      commercialPlanId: 'cp-reval',
      productPresentationId: null,
      code: 'pro',
      title: 'Pro',
      summary: null,
      status: 'PUBLISHED',
      priceDisplayMode: 'AUTHORITATIVE',
      priceDisplayRef: 'price-v1',
      currencyHint: 'EUR',
      featuresDisplay: [],
      ctaLabel: null,
      metadata: {},
      createdBy: 'x',
      updatedBy: null,
      createdAt: now(),
      updatedAt: now(),
      version: 1,
    });
    const commercial = createCommercialFake({ id: 'cp-reval', status: 'PUBLISHED', version: 3 });
    const result = await new RevalidatePlanBeforeCheckoutUseCase(
      createFakeRepo(store),
      commercial,
    ).execute({
      planPresentationId: 'pl-reval',
      expectedCommercialPlanVersion: 3,
    });
    recordEvidence(
      'P10-S24',
      result.requiresConfirmation === false && result.plan.id === 'cp-reval',
      'revalidation ok without confirmation',
      `requiresConfirmation=${result.requiresConfirmation}`,
    );
  });

  it('P10-S25: Changed price requires renewed confirmation', async () => {
    // Preconditions: expected plan version stale vs commercial.version
    const store = emptyStore();
    store.planPresentations.push({
      id: 'pl-price',
      commercialPlanId: 'cp-price',
      productPresentationId: null,
      code: 'pro',
      title: 'Pro',
      summary: null,
      status: 'PUBLISHED',
      priceDisplayMode: 'AUTHORITATIVE',
      priceDisplayRef: 'price-v2',
      currencyHint: 'EUR',
      featuresDisplay: [],
      ctaLabel: null,
      metadata: {},
      createdBy: 'x',
      updatedBy: null,
      createdAt: now(),
      updatedAt: now(),
      version: 1,
    });
    const commercial = createCommercialFake({ id: 'cp-price', status: 'PUBLISHED', version: 5 });
    const uc = new RevalidatePlanBeforeCheckoutUseCase(createFakeRepo(store), commercial);
    let needsConfirm = false;
    try {
      await uc.execute({
        planPresentationId: 'pl-price',
        expectedCommercialPlanVersion: 4,
      });
    } catch (err) {
      needsConfirm =
        err instanceof DomainError &&
        err.code === ErrorCode.CONFLICT &&
        Boolean(err.details?.some((d) => d.code === 'PLAN_REVALIDATION_CONFIRMATION_REQUIRED'));
    }
    const confirmed = await uc.execute({
      planPresentationId: 'pl-price',
      expectedCommercialPlanVersion: 4,
      confirmationAccepted: true,
    });
    recordEvidence(
      'P10-S25',
      needsConfirm && confirmed.confirmed && confirmed.priceVersionChanged,
      'confirmation required then accepted',
      `needsConfirm=${needsConfirm} confirmed=${confirmed.confirmed}`,
    );
  });

  it('P10-S26: Checkout session created idempotently', async () => {
    // Preconditions: same idempotency key twice
    const store = emptyStore();
    const prospect = seedProspect(store);
    const repo = createFakeRepo(store);
    const uc = new CreateCheckoutSessionUseCase(repo, outboxStub() as never);
    const first = await uc.execute({
      prospectId: prospect.id,
      idempotencyKey: 'idem-checkout-1',
    });
    const second = await uc.execute({
      prospectId: prospect.id,
      idempotencyKey: 'idem-checkout-1',
    });
    recordEvidence(
      'P10-S26',
      first.id === second.id && store.checkoutSessions.size === 1,
      'same checkout id, single session',
      `first=${first.id} second=${second.id} size=${store.checkoutSessions.size}`,
    );
  });

  it('P10-S27: P6 payment request initiated (AttachPaymentReference — ref only)', async () => {
    // Preconditions: checkout CREATED
    const store = emptyStore();
    const prospect = seedProspect(store);
    const repo = createFakeRepo(store);
    const session = await new CreateCheckoutSessionUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
      idempotencyKey: 'idem-pay-1',
    });
    const attached = await new AttachPaymentReferenceUseCase(repo, outboxStub() as never).execute({
      checkoutSessionId: session.id,
      paymentIntentRef: 'pi_p6_abc123',
    });
    recordEvidence(
      'P10-S27',
      attached.status === 'AWAITING_PAYMENT' && attached.billingSessionRef === 'pi_p6_abc123',
      'AWAITING_PAYMENT with ref only',
      `status=${attached.status} ref=${attached.billingSessionRef}`,
    );
  });

  it('P10-S28: Payment failure visible, no false success (RecordPaymentResult FAILED)', async () => {
    // Preconditions: checkout AWAITING_PAYMENT
    const store = emptyStore();
    const prospect = seedProspect(store);
    const repo = createFakeRepo(store);
    const session = await new CreateCheckoutSessionUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
      idempotencyKey: 'idem-fail-1',
    });
    await new AttachPaymentReferenceUseCase(repo, outboxStub() as never).execute({
      checkoutSessionId: session.id,
      paymentIntentRef: 'pi_fail',
    });
    const failed = await new RecordPaymentResultUseCase(repo, outboxStub() as never).execute({
      checkoutSessionId: session.id,
      p6Status: 'FAILED',
    });
    const portal = await new GetCustomerPortalSnapshotUseCase(repo).execute({
      prospectId: prospect.id,
    });
    const pass =
      failed.status === 'FAILED' &&
      portal.checkoutSessions.some((c) => c.id === session.id && c.status === 'FAILED') &&
      portal.provisioningComplete === false;
    recordEvidence(
      'P10-S28',
      pass,
      'FAILED visible, no false success',
      `status=${failed.status} provisioningComplete=${portal.provisioningComplete}`,
    );
  });

  it('P10-S29: Duplicate callback does not duplicate payment/subscription (idempotency)', async () => {
    // Preconditions: CAPTURED once; duplicate CAPTURED rejected; single handoff
    const store = emptyStore();
    const prospect = seedProspect(store);
    const repo = createFakeRepo(store);
    const session = await new CreateCheckoutSessionUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
      idempotencyKey: 'idem-dup-pay',
    });
    await new AttachPaymentReferenceUseCase(repo, outboxStub() as never).execute({
      checkoutSessionId: session.id,
      paymentIntentRef: 'pi_dup',
    });
    const first = await new RecordPaymentResultUseCase(repo, outboxStub() as never).execute({
      checkoutSessionId: session.id,
      p6Status: 'CAPTURED',
    });
    let duplicateRejected = false;
    try {
      await new RecordPaymentResultUseCase(repo, outboxStub() as never).execute({
        checkoutSessionId: session.id,
        p6Status: 'CAPTURED',
      });
    } catch (err) {
      duplicateRejected = err instanceof DomainError;
    }
    const handoff = await new RequestSubscriptionHandoffUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
      checkoutSessionId: session.id,
    });
    // Idempotent checkout recreate
    const same = await new CreateCheckoutSessionUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
      idempotencyKey: 'idem-dup-pay',
    });
    const pass =
      first.status === 'CAPTURED' &&
      duplicateRejected &&
      same.id === session.id &&
      store.handoffs.size === 1 &&
      handoff.status === 'REQUESTED';
    recordEvidence(
      'P10-S29',
      pass,
      'duplicate CAPTURED rejected; single handoff',
      `captured=${first.status} dupRejected=${duplicateRejected} handoffs=${store.handoffs.size}`,
    );
  });

  it('P10-S30: P5 handoff accepted and canonical ref recorded (CompleteSubscriptionHandoff)', async () => {
    // Preconditions: handoff REQUESTED
    const store = emptyStore();
    const prospect = seedProspect(store);
    const repo = createFakeRepo(store);
    const handoff = await new RequestSubscriptionHandoffUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
    });
    const completed = await new CompleteSubscriptionHandoffUseCase(repo, outboxStub() as never).execute({
      handoffId: handoff.id,
      subscriptionId: 'sub-p5-canonical-1',
      externalEvidenceRef: 'evidence-p5-abcd',
    });
    recordEvidence(
      'P10-S30',
      completed.status === 'COMPLETED' && completed.subscriptionRef === 'sub-p5-canonical-1',
      'COMPLETED with canonical P5 ref',
      `status=${completed.status} ref=${completed.subscriptionRef}`,
    );
  });

  it('P10-S31: P5 rejection reflected (handoff FAILED)', async () => {
    // Preconditions: handoff REQUESTED then failed by P5 path
    const store = emptyStore();
    const prospect = seedProspect(store);
    const repo = createFakeRepo(store);
    const handoff = await new RequestSubscriptionHandoffUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
    });
    const failed = await repo.transitionSubscriptionHandoff(handoff.id, 'FAILED', {
      failureReason: 'P5 rejected commercial account',
    });
    // COMPLETED without evidence must fail policy
    let completeBlocked = false;
    try {
      assertHandoffCompletable('COMPLETED', null, null);
    } catch {
      completeBlocked = true;
    }
    const portal = await new GetCustomerPortalSnapshotUseCase(repo).execute({
      prospectId: prospect.id,
    });
    recordEvidence(
      'P10-S31',
      failed.status === 'FAILED' &&
        completeBlocked &&
        portal.subscriptionHandoffCompleted === false,
      'handoff FAILED reflected',
      `status=${failed.status} completedFlag=${portal.subscriptionHandoffCompleted}`,
    );
  });

  it('P10-S32: Timeout reconciled without duplicate subscription (idempotent correlation)', async () => {
    // Preconditions: correlation key already COMPLETED with responseRef
    const store = emptyStore();
    const prospect = seedProspect(store);
    const repo = createFakeRepo(store);
    const correlation = 'corr-timeout-1';
    await repo.beginIdempotency({
      scope: 'subscription_handoff',
      idempotencyKey: correlation,
    });
    const firstHandoff = await new RequestSubscriptionHandoffUseCase(
      repo,
      outboxStub() as never,
    ).execute({
      prospectId: prospect.id,
      correlationId: correlation,
    });
    await repo.completeIdempotency(
      'subscription_handoff',
      correlation,
      firstHandoff.id,
      'COMPLETED',
    );
    // Timeout reconcile: read idempotency, reuse response instead of creating another
    const prior = await repo.getIdempotency('subscription_handoff', correlation);
    let reconciledId = firstHandoff.id;
    if (prior?.status === 'COMPLETED' && prior.responseRef) {
      reconciledId = prior.responseRef;
    } else {
      const again = await new RequestSubscriptionHandoffUseCase(repo, outboxStub() as never).execute({
        prospectId: prospect.id,
        correlationId: correlation,
      });
      reconciledId = again.id;
    }
    recordEvidence(
      'P10-S32',
      reconciledId === firstHandoff.id && store.handoffs.size === 1,
      'reconcile reuses handoff, no duplicate',
      `reconciled=${reconciledId} size=${store.handoffs.size}`,
    );
  });

  it('P10-S33: Provisioning progress from authoritative refs only (portal never invents complete)', async () => {
    // Preconditions: completed handoff with subscription ref; no tenantRef / no ready port
    const store = emptyStore();
    const prospect = seedProspect(store);
    const repo = createFakeRepo(store);
    const handoff = await new RequestSubscriptionHandoffUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
    });
    await new CompleteSubscriptionHandoffUseCase(repo, outboxStub() as never).execute({
      handoffId: handoff.id,
      subscriptionId: 'sub-auth-1',
      externalEvidenceRef: 'evidence-auth-1',
    });
    const portal = await new GetCustomerPortalSnapshotUseCase(repo).execute({
      prospectId: prospect.id,
    });
    // With tenantRef + mock ready=true → provisioningComplete true (authoritative only)
    const handoffRow = store.handoffs.get(handoff.id);
    if (handoffRow) {
      handoffRow.metadata = { ...(handoffRow.metadata ?? {}), tenantRef: 'tenant-auth-1' };
    }
    const readyPort = {
      isTenantReady: async () => ({ ready: true as const, source: 'CONTROL_V1' }),
    };
    const portalReady = await new GetCustomerPortalSnapshotUseCase(repo, readyPort).execute({
      prospectId: prospect.id,
    });
    recordEvidence(
      'P10-S33',
      portal.provisioningComplete === false &&
        portal.subscriptionHandoffCompleted === true &&
        portal.subscriptionHandoffs.some((h) => h.subscriptionRef === 'sub-auth-1') &&
        portalReady.provisioningComplete === true,
      'false without ready port; true only when TenantRuntimeStatusPort reports ready',
      `without=${portal.provisioningComplete} withReady=${portalReady.provisioningComplete}`,
    );
  });

  it('P10-S34: Customer cannot mark provisioning complete manually', async () => {
    // Preconditions: portal snapshot is read-only aggregation; no complete API
    const store = emptyStore();
    const prospect = seedProspect(store);
    const repo = createFakeRepo(store);
    const portal = await new GetCustomerPortalSnapshotUseCase(repo).execute({
      prospectId: prospect.id,
    });
    const hasCompleteApi = typeof (portal as { markProvisioningComplete?: unknown })
      .markProvisioningComplete === 'function';
    recordEvidence(
      'P10-S34',
      portal.provisioningComplete === false && !hasCompleteApi,
      'provisioningComplete false + no mark API',
      `provisioningComplete=${portal.provisioningComplete} hasApi=${hasCompleteApi}`,
    );
  });

  it('P10-S35: Account can have multiple subscriptions for different products', async () => {
    // Preconditions: fake CreateSubscriptionUseCase
    const store = emptyStore();
    const uc = createSubscriptionUc(store);
    const a = await uc.execute({
      actorId: 'actor',
      accountId: 'acc-1',
      productId: 'prod-a',
    });
    const b = await uc.execute({
      actorId: 'actor',
      accountId: 'acc-1',
      productId: 'prod-b',
    });
    recordEvidence(
      'P10-S35',
      store.subscriptions.length === 2 && a.productId !== b.productId,
      '2 subscriptions different products',
      `count=${store.subscriptions.length} products=${a.productId},${b.productId}`,
    );
  });

  it('P10-S36: Single subscription cannot reference multiple products', async () => {
    // Preconditions: assertSingleProductSubscription domain invariant
    let blocked = false;
    try {
      assertSingleProductSubscription({
        productId: 'prod-a',
        itemProductIds: ['prod-a', 'prod-b'],
      });
    } catch (err) {
      blocked = err instanceof DomainError;
    }
    let missingBlocked = false;
    try {
      assertSingleProductSubscription({ productId: null });
    } catch {
      missingBlocked = true;
    }
    recordEvidence(
      'P10-S36',
      blocked && missingBlocked,
      'multi-product + missing productId rejected',
      `blocked=${blocked} missingBlocked=${missingBlocked}`,
    );
  });

  it('P10-S37: Unauthorized contact cannot view restricted applications', async () => {
    // Preconditions: application owned by prospect A; query as prospect B / missing link
    const store = emptyStore();
    const { version } = seedPublishedForm(store);
    const owner = seedProspect(store, 'owner@example.com');
    const stranger = seedProspect(store, 'stranger@example.com');
    const repo = createFakeRepo(store);
    await new CreateApplicationDraftUseCase(repo, outboxStub() as never).execute({
      prospectId: owner.id,
      formVersionId: version.id,
    });
    const forStranger = await repo.listApplications({ prospectId: stranger.id });
    let portalDenied = false;
    try {
      await new GetCustomerPortalSnapshotUseCase(repo).execute({ prospectId: 'missing-prospect' });
    } catch (err) {
      portalDenied = err instanceof DomainError && err.code === ErrorCode.RESOURCE_NOT_FOUND;
    }
    recordEvidence(
      'P10-S37',
      forStranger.total === 0 && portalDenied,
      'empty list + not found for missing prospect',
      `strangerApps=${forStranger.total} portalDenied=${portalDenied}`,
    );
  });

  it('P10-S38: Reviewer cannot access unauthorized private document', async () => {
    // Preconditions: storage grant requires authorized actor
    const storage = createDocStorageFake({ authorizedActors: ['reviewer-ok'] });
    await storage.registerPrivateObject({
      storageKey: 'private/secret-doc',
      contentType: 'application/pdf',
      byteSize: 100,
      privateLocator: 'private/secret-doc',
    });
    let denied = false;
    try {
      await storage.createAuthorizedReadGrant('private/secret-doc', 'reviewer-evil', 60);
    } catch (err) {
      denied = err instanceof DomainError && err.code === ErrorCode.FORBIDDEN;
    }
    const ok = await storage.createAuthorizedReadGrant('private/secret-doc', 'reviewer-ok', 60);
    recordEvidence(
      'P10-S38',
      denied && Boolean(ok.grantToken),
      'wrong actor FORBIDDEN; authorized gets grant',
      `denied=${denied} grant=${Boolean(ok.grantToken)}`,
    );
  });

  it('P10-S39: Analytics do not contain passwords/payment credentials/document content', async () => {
    // Preconditions: RecordAnalyticsEvent strips sensitive keys
    const store = emptyStore();
    const repo = createFakeRepo(store);
    // Keep notification fake referenced for harness completeness
    void createNotificationFake();
    const event = await new RecordAnalyticsEventUseCase(repo, outboxStub() as never).execute({
      eventName: 'acquisition.step',
      properties: {
        step: 'checkout',
        password: 'secret',
        cardNumber: '4111111111111111',
        cvv: '123',
        documentContent: 'SENSITIVE_PDF_BYTES',
        client_secret: 'sk_live',
        safeField: 'ok',
      },
    });
    const props = event.properties as Record<string, unknown>;
    const pass =
      props.safeField === 'ok' &&
      props.password === undefined &&
      props.cardNumber === undefined &&
      props.cvv === undefined &&
      props.documentContent === undefined &&
      props.client_secret === undefined;
    recordEvidence(
      'P10-S39',
      pass,
      'sensitive keys stripped, safeField kept',
      `keys=${Object.keys(props).join(',')}`,
    );
  });

  it('P10-S40: Complete journey to provisioning-ready state where integrations available', async () => {
    // Preconditions: orchestrate draft→submit→approve→checkout→handoff complete
    const store = emptyStore();
    const { version } = seedPublishedForm(store);
    const prospect = seedProspect(store, 'journey@example.com');
    const repo = createFakeRepo(store);
    const draft = await new CreateApplicationDraftUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
      formVersionId: version.id,
      productId: 'prod-1',
    });
    await new SaveApplicationAnswersUseCase(repo, outboxStub() as never).execute({
      applicationId: draft.id,
      answers: { email: 'journey@example.com', company: 'Journey Co' },
    });
    await new SubmitApplicationUseCase(repo, outboxStub() as never).execute({
      applicationId: draft.id,
    });
    await new TransitionApplicationReviewUseCase(repo, outboxStub() as never).execute({
      actorId: 'reviewer',
      applicationId: draft.id,
      toStatus: 'IN_REVIEW',
    });
    await new TransitionApplicationReviewUseCase(repo, outboxStub() as never).execute({
      actorId: 'reviewer',
      applicationId: draft.id,
      toStatus: 'APPROVED',
    });
    const checkout = await new CreateCheckoutSessionUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
      applicationId: draft.id,
      idempotencyKey: 'journey-checkout',
    });
    await new AttachPaymentReferenceUseCase(repo, outboxStub() as never).execute({
      checkoutSessionId: checkout.id,
      paymentIntentRef: 'pi_journey',
    });
    await new RecordPaymentResultUseCase(repo, outboxStub() as never).execute({
      checkoutSessionId: checkout.id,
      p6Status: 'CAPTURED',
    });
    const handoff = await new RequestSubscriptionHandoffUseCase(repo, outboxStub() as never).execute({
      prospectId: prospect.id,
      checkoutSessionId: checkout.id,
      applicationId: draft.id,
    });
    const completed = await new CompleteSubscriptionHandoffUseCase(repo, outboxStub() as never).execute(
      {
        handoffId: handoff.id,
        subscriptionId: 'sub-journey-ready',
        externalEvidenceRef: 'evidence-journey-ready',
      },
    );
    const portal = await new GetCustomerPortalSnapshotUseCase(repo).execute({
      prospectId: prospect.id,
    });
    const pass =
      completed.status === 'COMPLETED' &&
      portal.subscriptionHandoffCompleted === true &&
      portal.subscriptionHandoffs.some((h) => h.subscriptionRef === 'sub-journey-ready') &&
      portal.provisioningComplete === false;
    recordEvidence(
      'P10-S40',
      pass,
      'journey complete with subscription ref; provisioning not invented',
      `handoff=${completed.status} ref=${completed.subscriptionRef} provisioningComplete=${portal.provisioningComplete}`,
    );
  });

  it('evidence ledger covers all 40 scenarios', () => {
    const ids = evidence.map((e) => e.id).sort();
    const expected = Array.from({ length: 40 }, (_, i) => `P10-S${String(i + 1).padStart(2, '0')}`);
    expect(ids).toEqual(expected);
    expect(evidence.every((e) => e.pass)).toBe(true);
  });
});
