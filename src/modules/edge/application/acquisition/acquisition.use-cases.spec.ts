import { describe, expect, it, vi } from 'vitest';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { AcquisitionRepositoryPort } from '../../domain/acquisition/acquisition-repository.port.js';
import { assertFormVersionMutable } from '../../domain/acquisition/acquisition-policy.js';
import type {
  Application,
  FormSchema,
  FormVersion,
  ProductPresentation,
} from '../../domain/acquisition/acquisition.types.js';
import { CommercialAvailability } from '../../domain/product/product.entity.js';
import type { ProductRepositoryPort } from '../../domain/ports/product-repository.port.js';
import {
  AttachPaymentReferenceUseCase,
  CaptureAcquisitionLeadUseCase,
  CreateApplicationDraftUseCase,
  CreateFormSchemaUseCase,
  InitiateAcquisitionPaymentUseCase,
  InstantiateProductAcquisitionFormUseCase,
  ListPublicProductDiscoveryUseCase,
  PublishFormVersionUseCase,
  SaveApplicationAnswersUseCase,
  SubmitApplicationUseCase,
} from './acquisition.use-cases.js';

function outboxStub() {
  return {
    runWithOutbox: vi.fn(async (_t: string, fn: (c: unknown, e: unknown) => unknown) =>
      fn({}, vi.fn()),
    ),
  };
}

type Store = {
  presentations: ProductPresentation[];
  formSchemas: Map<string, FormSchema>;
  formVersions: Map<string, FormVersion>;
  applications: Map<string, Application>;
  answers: Array<{ applicationId: string; fieldKey: string; value: unknown; metadata: Record<string, unknown> }>;
  audits: unknown[];
  checkoutSessions: Map<string, Record<string, unknown>>;
  documentRequirements?: Array<Record<string, unknown>>;
};

function createFakeRepo(store: Store): AcquisitionRepositoryPort {
  const now = () => new Date();
  return {
    listProductPresentations: async (filter: { status?: string } | undefined) => {
      let items = store.presentations;
      if (filter?.status) items = items.filter((p) => p.status === filter.status);
      return { items, total: items.length };
    },
    getFormVersion: async (id: string) => store.formVersions.get(id) ?? null,
    publishFormVersion: async (id: string, publishedBy: string) => {
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
      const schema = store.formSchemas.get(published.formSchemaId);
      if (schema) {
        store.formSchemas.set(schema.id, {
          ...schema,
          currentPublishedVersionId: published.id,
          status: 'ACTIVE',
        });
      }
      return published;
    },
    createFormPublication: async (input: {
      formSchemaId: string;
      formVersionId: string;
      channel: string;
      publicSlug?: string | null;
      status: string;
      publishedBy: string;
      expiresAt?: Date | null;
      metadata?: Record<string, unknown>;
    }) => ({
      id: `pub-${Math.random().toString(16).slice(2)}`,
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
    }),
    createApplication: async (input: {
      prospectId: string;
      leadId?: string | null;
      formSchemaId: string;
      formVersionId: string;
      formPublicationId?: string | null;
      productId?: string | null;
      commercialPlanId?: string | null;
      planPresentationId?: string | null;
      status?: string;
      metadata?: Record<string, unknown>;
      createdBy?: string | null;
    }) => {
      const app: Application = {
        id: `app-${Math.random().toString(16).slice(2)}`,
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
        submittedAt: null,
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
    getApplication: async (id: string) => store.applications.get(id) ?? null,
    getProspect: async () =>
      ({
        id: 'prospect-1',
        emailNormalized: 'a@b.com',
        displayName: null,
        companyName: null,
        status: 'NEW',
        commercialAccountId: null,
        productId: null,
        commercialPlanId: null,
        planPresentationId: null,
        locale: null,
        country: null,
        sourceChannel: null,
        metadata: {},
        createdBy: null,
        updatedBy: null,
        createdAt: now(),
        updatedAt: now(),
        version: 1,
      }) as never,
    upsertApplicationAnswer: async (input: {
      applicationId: string;
      fieldKey: string;
      value: unknown;
      metadata?: Record<string, unknown>;
    }) => {
      store.answers.push({
        applicationId: input.applicationId,
        fieldKey: input.fieldKey,
        value: input.value,
        metadata: input.metadata ?? {},
      });
      return {
        id: `ans-${store.answers.length}`,
        applicationId: input.applicationId,
        fieldKey: input.fieldKey,
        value: input.value,
        metadata: input.metadata ?? {},
        createdAt: now(),
        updatedAt: now(),
      };
    },
    listApplicationAnswers: async (applicationId: string) =>
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
    getFormSchema: async (id: string) => store.formSchemas.get(id) ?? null,
    createFormSchema: async (input: {
      code: string;
      name: string;
      description?: string | null;
      status?: string;
      productId?: string | null;
      commercialPlanId?: string | null;
      metadata?: Record<string, unknown>;
      createdBy?: string | null;
    }) => {
      const row: FormSchema = {
        id: `fs-${Math.random().toString(16).slice(2)}`,
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        status: input.status ?? 'DRAFT',
        productId: input.productId ?? null,
        commercialPlanId: input.commercialPlanId ?? null,
        currentPublishedVersionId: null,
        metadata: input.metadata ?? {},
        createdBy: input.createdBy ?? 'system',
        updatedBy: null,
        createdAt: now(),
        updatedAt: now(),
        version: 1,
      };
      store.formSchemas.set(row.id, row);
      return row;
    },
    createFormVersion: async (input: {
      formSchemaId: string;
      versionNumber: number;
      schemaDefinition: FormVersion['schemaDefinition'];
      conditionRules?: unknown[];
      immutableAfterPublish?: boolean;
      metadata?: Record<string, unknown>;
      createdBy?: string | null;
      status?: string;
    }) => {
      const row: FormVersion = {
        id: `fv-${Math.random().toString(16).slice(2)}`,
        formSchemaId: input.formSchemaId,
        versionNumber: input.versionNumber,
        schemaDefinition: input.schemaDefinition,
        conditionRules: input.conditionRules ?? [],
        status: input.status ?? 'DRAFT',
        publishedAt: null,
        publishedBy: null,
        immutableAfterPublish: input.immutableAfterPublish ?? true,
        metadata: input.metadata ?? {},
        createdBy: input.createdBy ?? 'system',
        createdAt: now(),
      };
      store.formVersions.set(row.id, row);
      return row;
    },
    createDocumentRequirement: async (input: Record<string, unknown>) => {
      if (!store.documentRequirements) store.documentRequirements = [];
      const row = {
        id: `dr-${Math.random().toString(16).slice(2)}`,
        ...input,
        createdAt: now(),
        updatedAt: now(),
      };
      store.documentRequirements.push(row);
      return row as never;
    },
    transitionApplication: async (
      id: string,
      toStatus: string,
      patch?: Record<string, unknown>,
    ) => {
      const app = store.applications.get(id);
      if (!app) throw new Error('missing');
      const updated: Application = {
        ...app,
        status: toStatus,
        submittedAt: (patch?.submittedAt as Date | undefined) ?? app.submittedAt,
        metadata: (patch?.metadata as Record<string, unknown> | undefined) ?? app.metadata,
        updatedBy: (patch?.updatedBy as string | null | undefined) ?? app.updatedBy,
        updatedAt: now(),
        version: app.version + 1,
      };
      store.applications.set(id, updated);
      return updated;
    },
    addApplicationEvent: async (input: Record<string, unknown>) => ({
      id: 'ae1',
      ...input,
      createdAt: now(),
    }),
    createLead: async (input: Record<string, unknown>) => ({
      id: `lead-${Math.random().toString(16).slice(2)}`,
      ...input,
      createdAt: now(),
      updatedAt: now(),
      version: 1,
    }),
    getFormPublication: async (id: string) => {
      const pubs = (store as Store & { publications?: Map<string, Record<string, unknown>> })
        .publications;
      return (pubs?.get(id) as never) ?? null;
    },
    addLeadEvent: async (input: Record<string, unknown>) => ({
      id: 'le1',
      ...input,
      createdAt: now(),
    }),
    touchApplication: async (id: string, expectedVersion?: number) => {
      const app = store.applications.get(id);
      if (!app) throw new Error('missing');
      if (expectedVersion != null && app.version !== expectedVersion) {
        throw new DomainError(ErrorCode.CONFLICT, 'Application version conflict');
      }
      const updated = { ...app, version: app.version + 1, updatedAt: now() };
      store.applications.set(id, updated);
      return updated;
    },
    getCheckoutSession: async (id: string) => (store.checkoutSessions.get(id) as never) ?? null,
    transitionCheckoutSession: async (
      id: string,
      toStatus: string,
      patch?: Record<string, unknown>,
    ) => {
      const session = store.checkoutSessions.get(id);
      if (!session) throw new Error('missing');
      const updated = { ...session, ...patch, status: toStatus, version: Number(session.version) + 1 };
      store.checkoutSessions.set(id, updated);
      return updated as never;
    },
    addCheckoutEvent: async (input: Record<string, unknown>) => ({
      id: 'ce1',
      ...input,
      createdAt: now(),
    }),
    appendAuditEvent: async (input: Record<string, unknown>) => {
      store.audits.push(input);
      return { id: `audit-${store.audits.length}`, createdAt: now(), ...input };
    },
  } as unknown as AcquisitionRepositoryPort;
}

describe('P10 acquisition use-cases', () => {
  it('PublishFormVersionUseCase validates schema then makes version immutable', async () => {
    const store: Store = {
      presentations: [],
      formSchemas: new Map(),
      formVersions: new Map(),
      applications: new Map(),
      answers: [],
      audits: [],
      checkoutSessions: new Map(),
    };
    const schema: FormSchema = {
      id: 'fs1',
      code: 'acq',
      name: 'Acquisition',
      description: null,
      status: 'DRAFT',
      productId: 'prod-1',
      commercialPlanId: null,
      currentPublishedVersionId: null,
      metadata: {},
      createdBy: 'actor',
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };
    store.formSchemas.set(schema.id, schema);
    const version: FormVersion = {
      id: 'fv1',
      formSchemaId: schema.id,
      versionNumber: 1,
      schemaDefinition: {
        fields: [{ key: 'email', type: 'email', required: true }],
      },
      conditionRules: [],
      status: 'DRAFT',
      publishedAt: null,
      publishedBy: null,
      immutableAfterPublish: true,
      metadata: {},
      createdBy: 'actor',
      createdAt: new Date(),
    };
    store.formVersions.set(version.id, version);

    const repo = createFakeRepo(store);
    const uc = new PublishFormVersionUseCase(repo, outboxStub() as never);
    const result = await uc.execute({
      actorId: 'actor-1',
      formVersionId: 'fv1',
      channel: 'PUBLIC_WEB',
      publicSlug: 'join',
    });
    expect(result.formVersion.status).toBe('PUBLISHED');
    expect(result.formVersion.immutableAfterPublish).toBe(true);

    await expect(
      repo.publishFormVersion('fv1', 'actor-1'),
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
  });

  it('SaveApplicationAnswersUseCase preserves bound form version snapshot', async () => {
    const store: Store = {
      presentations: [],
      formSchemas: new Map(),
      formVersions: new Map(),
      applications: new Map(),
      answers: [],
      audits: [],
      checkoutSessions: new Map(),
    };
    const v1: FormVersion = {
      id: 'fv-bound',
      formSchemaId: 'fs1',
      versionNumber: 1,
      schemaDefinition: {
        fields: [{ key: 'company', type: 'string', required: true }],
      },
      conditionRules: [],
      status: 'PUBLISHED',
      publishedAt: new Date(),
      publishedBy: 'actor',
      immutableAfterPublish: true,
      metadata: {},
      createdBy: 'actor',
      createdAt: new Date(),
    };
    const v2: FormVersion = {
      ...v1,
      id: 'fv-latest',
      versionNumber: 2,
      schemaDefinition: {
        fields: [
          { key: 'company', type: 'string', required: true },
          { key: 'employees', type: 'integer', required: true },
        ],
      },
    };
    store.formVersions.set(v1.id, v1);
    store.formVersions.set(v2.id, v2);

    const repo = createFakeRepo(store);
    const draftUc = new CreateApplicationDraftUseCase(repo, outboxStub() as never);
    const app = await draftUc.execute({
      actorId: 'actor',
      prospectId: 'prospect-1',
      formVersionId: 'fv-bound',
    });
    expect(app.formVersionId).toBe('fv-bound');

    const saveUc = new SaveApplicationAnswersUseCase(repo, outboxStub() as never);
    const saved = await saveUc.execute({
      actorId: 'actor',
      applicationId: app.id,
      answers: { company: 'Acme' },
    });
    expect(saved.formVersionId).toBe('fv-bound');
    expect(saved.formVersionNumber).toBe(1);
    expect(saved.answers[0]?.metadata.formVersionId).toBe('fv-bound');

    // Answers valid for bound v1 must not be rejected just because v2 added required fields
    await expect(
      saveUc.execute({
        actorId: 'actor',
        applicationId: app.id,
        answers: { company: 'Acme Corp' },
      }),
    ).resolves.toMatchObject({ formVersionId: 'fv-bound' });
  });

  it('AttachPaymentReferenceUseCase rejects payment credentials', async () => {
    const store: Store = {
      presentations: [],
      formSchemas: new Map(),
      formVersions: new Map(),
      applications: new Map(),
      answers: [],
      audits: [],
      checkoutSessions: new Map([
        [
          'co1',
          {
            id: 'co1',
            applicationId: null,
            prospectId: 'p1',
            planPresentationId: null,
            commercialPlanId: null,
            quoteReferenceId: null,
            status: 'CREATED',
            billingSessionRef: null,
            idempotencyKey: 'idem-1',
            metadata: {},
            createdBy: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1,
          },
        ],
      ]),
    };
    const repo = createFakeRepo(store);
    const uc = new AttachPaymentReferenceUseCase(repo, outboxStub() as never);

    await expect(
      uc.execute({
        actorId: 'actor',
        checkoutSessionId: 'co1',
        paymentIntentRef: 'pi_ok_123',
        metadata: { cardNumber: '4111111111111111' },
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });

    await expect(
      uc.execute({
        actorId: 'actor',
        checkoutSessionId: 'co1',
        paymentIntentRef: 'pi_ok_123',
        metadata: { cvv: '123' },
      }),
    ).rejects.toBeInstanceOf(DomainError);

    const ok = await uc.execute({
      actorId: 'actor',
      checkoutSessionId: 'co1',
      paymentIntentRef: 'pi_ok_123',
    });
    expect(ok.status).toBe('AWAITING_PAYMENT');
    expect(ok.billingSessionRef).toBe('pi_ok_123');
  });

  it('ListPublicProductDiscoveryUseCase returns only PUBLISHED + commercially presentable', async () => {
    const store: Store = {
      presentations: [
        {
          id: 'pp-pub-ok',
          productId: 'prod-available',
          code: 'a',
          slug: 'a',
          title: 'Available',
          summary: null,
          status: 'PUBLISHED',
          locale: 'en',
          currentPublishedVersionId: 'cv1',
          metadata: {},
          createdBy: 'x',
          updatedBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        },
        {
          id: 'pp-draft',
          productId: 'prod-available',
          code: 'b',
          slug: 'b',
          title: 'Draft',
          summary: null,
          status: 'DRAFT',
          locale: 'en',
          currentPublishedVersionId: null,
          metadata: {},
          createdBy: 'x',
          updatedBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        },
        {
          id: 'pp-pub-blocked',
          productId: 'prod-unavailable',
          code: 'c',
          slug: 'c',
          title: 'Blocked',
          summary: null,
          status: 'PUBLISHED',
          locale: 'en',
          currentPublishedVersionId: 'cv2',
          metadata: {},
          createdBy: 'x',
          updatedBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        },
      ],
      formSchemas: new Map(),
      formVersions: new Map(),
      applications: new Map(),
      answers: [],
      audits: [],
      checkoutSessions: new Map(),
    };
    const repo = createFakeRepo(store);
    const products = {
      findById: vi.fn(async (id: string) => {
        if (id === 'prod-available') {
          return { id, commercialAvailability: CommercialAvailability.AVAILABLE };
        }
        if (id === 'prod-unavailable') {
          return { id, commercialAvailability: CommercialAvailability.UNAVAILABLE };
        }
        return null;
      }),
    } as unknown as ProductRepositoryPort;

    const uc = new ListPublicProductDiscoveryUseCase(repo, products);
    const result = await uc.execute();
    expect(result.items.map((i) => i.id)).toEqual(['pp-pub-ok']);
    expect(result.total).toBe(1);
    expect(products.findById).toHaveBeenCalled();
  });

  it('InitiateAcquisitionPaymentUseCase creates intent then attaches ref (never marks paid on SUCCEEDED)', async () => {
    const store: Store = {
      presentations: [],
      formSchemas: new Map(),
      formVersions: new Map(),
      applications: new Map(),
      answers: [],
      audits: [],
      checkoutSessions: new Map([
        [
          'co-pay',
          {
            id: 'co-pay',
            applicationId: null,
            prospectId: 'p1',
            planPresentationId: null,
            commercialPlanId: null,
            quoteReferenceId: null,
            status: 'CREATED',
            billingSessionRef: null,
            idempotencyKey: 'idem-pay',
            metadata: {},
            createdBy: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1,
          },
        ],
      ]),
    };
    const repo = createFakeRepo(store);
    const createPaymentIntent = {
      execute: vi.fn().mockResolvedValue({
        intent: { id: 'pi_local_1', providerIntentRef: 'pi_prov_1', status: 'SUCCEEDED' },
        providerResult: { outcome: 'SUCCEEDED', providerIntentRef: 'pi_prov_1' },
      }),
    };
    const attachPayment = {
      execute: vi.fn().mockImplementation(async (input: { paymentIntentRef: string }) => {
        const session = store.checkoutSessions.get('co-pay')!;
        const updated = {
          ...session,
          status: 'AWAITING_PAYMENT',
          billingSessionRef: input.paymentIntentRef,
          version: Number(session.version) + 1,
        };
        store.checkoutSessions.set('co-pay', updated);
        return updated;
      }),
    };

    const uc = new InitiateAcquisitionPaymentUseCase(
      repo,
      createPaymentIntent as never,
      attachPayment as never,
      outboxStub() as never,
    );
    const result = await uc.execute({
      actorId: 'actor',
      checkoutSessionId: 'co-pay',
      billingAccountId: '11111111-1111-1111-1111-111111111111',
      amount: '49.00',
      currency: 'EUR',
      termsConfirmed: true,
    });

    expect(createPaymentIntent.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        billingAccountId: '11111111-1111-1111-1111-111111111111',
        amount: '49.00',
        currency: 'EUR',
      }),
    );
    expect(attachPayment.execute).toHaveBeenCalledWith(
      expect.objectContaining({ paymentIntentRef: 'pi_local_1' }),
    );
    expect(result.checkout.status).toBe('AWAITING_PAYMENT');
    expect(result.checkout.status).not.toBe('CAPTURED');
    expect(result.providerResult.outcome).toBe('SUCCEEDED');
  });

  it('CaptureAcquisitionLeadUseCase rejects honeypot / too-fast / missing challenge', async () => {
    const store: Store = {
      presentations: [],
      formSchemas: new Map(),
      formVersions: new Map(),
      applications: new Map(),
      answers: [],
      audits: [],
      checkoutSessions: new Map(),
    };
    const repo = createFakeRepo(store);
    const uc = new CaptureAcquisitionLeadUseCase(repo, outboxStub() as never);
    const { issueChallenge } = await import(
      '../../domain/acquisition/acquisition-public-challenge.js'
    );
    const challenge = issueChallenge();
    const challengeFields = {
      challengeId: challenge.challengeId,
      challengeToken: challenge.challengeToken,
      challengeAnswer: String(challenge.operandA + challenge.operandB),
    };

    await expect(
      uc.execute({
        email: 'bot@example.com',
        sourceType: 'WEB',
        honeypot: 'filled-by-bot',
        ...challengeFields,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });

    await expect(
      uc.execute({
        email: 'bot@example.com',
        sourceType: 'WEB',
        payload: { website: 'http://spam.example' },
        ...challengeFields,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });

    await expect(
      uc.execute({
        email: 'bot@example.com',
        sourceType: 'WEB',
        submittedAtMs: Date.now() - 100,
        ...challengeFields,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });

    await expect(
      uc.execute({
        email: 'bot@example.com',
        sourceType: 'WEB',
        honeypot: '',
        submittedAtMs: Date.now() - 2_000,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });

    await expect(
      uc.execute({
        email: 'bot@example.com',
        sourceType: 'WEB',
        honeypot: '',
        submittedAtMs: Date.now() - 2_000,
        challengeId: challenge.challengeId,
        challengeToken: challenge.challengeToken,
        challengeAnswer: '0',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });

    const ok = await uc.execute({
      email: 'human@example.com',
      sourceType: 'WEB',
      honeypot: '',
      submittedAtMs: Date.now() - 2_000,
      ...challengeFields,
    });
    expect(ok.emailNormalized).toBe('human@example.com');
  });

  it('CaptureAcquisitionLeadUseCase validates requiredConsents from form publication metadata', async () => {
    const store: Store & { publications: Map<string, Record<string, unknown>> } = {
      presentations: [],
      formSchemas: new Map(),
      formVersions: new Map(),
      applications: new Map(),
      answers: [],
      audits: [],
      checkoutSessions: new Map(),
      publications: new Map(),
    };
    store.formVersions.set('fv1', {
      id: 'fv1',
      formSchemaId: 'fs1',
      versionNumber: 1,
      schemaDefinition: { fields: [] },
      conditionRules: [],
      status: 'PUBLISHED',
      publishedAt: new Date(),
      publishedBy: 'actor',
      immutableAfterPublish: true,
      metadata: {},
      createdBy: 'actor',
      createdAt: new Date(),
    });
    store.publications.set('pub-1', {
      id: 'pub-1',
      formSchemaId: 'fs1',
      formVersionId: 'fv1',
      channel: 'PUBLIC_WEB',
      publicSlug: 'demo-form',
      status: 'ACTIVE',
      publishedAt: new Date(),
      publishedBy: 'actor',
      expiresAt: null,
      metadata: {
        requiredConsents: [
          {
            purpose: 'MARKETING',
            channel: 'EMAIL',
            textVersion: 'v1',
          },
        ],
      },
      createdAt: new Date(),
    });
    const repo = createFakeRepo(store);
    const uc = new CaptureAcquisitionLeadUseCase(repo, outboxStub() as never);
    const { issueChallenge } = await import(
      '../../domain/acquisition/acquisition-public-challenge.js'
    );
    const challenge = issueChallenge();
    const challengeFields = {
      challengeId: challenge.challengeId,
      challengeToken: challenge.challengeToken,
      challengeAnswer: String(challenge.operandA + challenge.operandB),
      honeypot: '',
      submittedAtMs: Date.now() - 2_000,
    };

    await expect(
      uc.execute({
        email: 'consent@example.com',
        sourceType: 'WEB',
        formPublicationId: 'pub-1',
        ...challengeFields,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });

    const lead = await uc.execute({
      email: 'consent@example.com',
      sourceType: 'WEB',
      formPublicationId: 'pub-1',
      consents: [
        {
          purpose: 'MARKETING',
          channel: 'EMAIL',
          textVersion: 'v1',
          decision: 'GRANTED',
        },
      ],
      ...challengeFields,
    });
    expect(lead.metadata).toMatchObject({
      consentEvidence: [
        expect.objectContaining({
          purpose: 'MARKETING',
          channel: 'EMAIL',
          state: 'GRANTED',
        }),
      ],
    });
  });

  it('SaveApplicationAnswersUseCase rejects expectedVersion conflict', async () => {
    const store: Store = {
      presentations: [],
      formSchemas: new Map(),
      formVersions: new Map(),
      applications: new Map(),
      answers: [],
      audits: [],
      checkoutSessions: new Map(),
    };
    const v1: FormVersion = {
      id: 'fv-bound',
      formSchemaId: 'fs1',
      versionNumber: 1,
      schemaDefinition: {
        fields: [{ key: 'company', type: 'string', required: true }],
      },
      conditionRules: [],
      status: 'PUBLISHED',
      publishedAt: new Date(),
      publishedBy: 'actor',
      immutableAfterPublish: true,
      metadata: {},
      createdBy: 'actor',
      createdAt: new Date(),
    };
    store.formVersions.set(v1.id, v1);
    const repo = createFakeRepo(store);
    const draftUc = new CreateApplicationDraftUseCase(repo, outboxStub() as never);
    const app = await draftUc.execute({
      actorId: 'actor',
      prospectId: 'prospect-1',
      formVersionId: 'fv-bound',
    });
    expect(app.version).toBe(1);

    const saveUc = new SaveApplicationAnswersUseCase(repo, outboxStub() as never);
    await expect(
      saveUc.execute({
        actorId: 'actor',
        applicationId: app.id,
        answers: { company: 'Acme' },
        expectedVersion: 99,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT });

    const saved = await saveUc.execute({
      actorId: 'actor',
      applicationId: app.id,
      answers: { company: 'Acme' },
      expectedVersion: 1,
    });
    expect(saved.application.version).toBe(2);
  });

  it('CreateFormSchemaUseCase rejects missing productId', async () => {
    const store: Store = {
      presentations: [],
      formSchemas: new Map(),
      formVersions: new Map(),
      applications: new Map(),
      answers: [],
      audits: [],
      checkoutSessions: new Map(),
    };
    const repo = createFakeRepo(store);
    const products = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as ProductRepositoryPort;
    const uc = new CreateFormSchemaUseCase(repo, outboxStub() as never, products);

    await expect(
      uc.execute({
        actorId: 'actor',
        code: 'f1',
        name: 'Form',
        productId: 'missing-prod',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    expect(products.findById).toHaveBeenCalledWith('missing-prod');
  });

  it('PublishFormVersionUseCase rejects when form schema product is missing', async () => {
    const store: Store = {
      presentations: [],
      formSchemas: new Map(),
      formVersions: new Map(),
      applications: new Map(),
      answers: [],
      audits: [],
      checkoutSessions: new Map(),
    };
    const schema: FormSchema = {
      id: 'fs1',
      code: 'acq',
      name: 'Acquisition',
      description: null,
      status: 'DRAFT',
      productId: 'missing-prod',
      commercialPlanId: null,
      currentPublishedVersionId: null,
      metadata: {},
      createdBy: 'actor',
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };
    store.formSchemas.set(schema.id, schema);
    store.formVersions.set('fv1', {
      id: 'fv1',
      formSchemaId: schema.id,
      versionNumber: 1,
      schemaDefinition: {
        fields: [{ key: 'email', type: 'email', required: true }],
      },
      conditionRules: [],
      status: 'DRAFT',
      publishedAt: null,
      publishedBy: null,
      immutableAfterPublish: true,
      metadata: {},
      createdBy: 'actor',
      createdAt: new Date(),
    });
    const repo = createFakeRepo(store);
    const products = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as ProductRepositoryPort;
    const uc = new PublishFormVersionUseCase(repo, outboxStub() as never, products);

    await expect(
      uc.execute({ actorId: 'actor-1', formVersionId: 'fv1' }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
  });

  it('InstantiateProductAcquisitionFormUseCase creates draft schema+version from contract', async () => {
    const store: Store = {
      presentations: [],
      formSchemas: new Map(),
      formVersions: new Map(),
      applications: new Map(),
      answers: [],
      audits: [],
      checkoutSessions: new Map(),
      documentRequirements: [],
    };
    const repo = createFakeRepo(store);
    const products = {
      findById: vi.fn().mockResolvedValue({ id: 'prod-1', code: 'pharmacy' }),
    } as unknown as ProductRepositoryPort;
    const uc = new InstantiateProductAcquisitionFormUseCase(
      repo,
      outboxStub() as never,
      products,
    );

    const result = await uc.execute({
      actorId: 'actor-1',
      productId: 'prod-1',
      contractCode: 'pharmacy.retail.v1',
      code: 'pharma-acq-1',
      name: 'Pharmacy acquisition',
    });

    expect(result.contractCode).toBe('pharmacy.retail.v1');
    expect(result.formSchema.status).toBe('DRAFT');
    expect(result.formSchema.productId).toBe('prod-1');
    expect(result.formSchema.metadata.contractCode).toBe('pharmacy.retail.v1');
    expect(result.formVersion.status).toBe('DRAFT');
    expect(result.formVersion.publishedAt).toBeNull();
    expect(result.formVersion.schemaDefinition.requiredConsents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ purpose: 'acquisition_processing' }),
      ]),
    );
    expect(result.documentRequirements.length).toBeGreaterThan(0);
    expect(store.formVersions.get(result.formVersion.id)?.status).toBe('DRAFT');
  });

  it('InstantiateProductAcquisitionFormUseCase rejects unknown contract and missing product', async () => {
    const store: Store = {
      presentations: [],
      formSchemas: new Map(),
      formVersions: new Map(),
      applications: new Map(),
      answers: [],
      audits: [],
      checkoutSessions: new Map(),
      documentRequirements: [],
    };
    const repo = createFakeRepo(store);
    const products = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as ProductRepositoryPort;
    const uc = new InstantiateProductAcquisitionFormUseCase(
      repo,
      outboxStub() as never,
      products,
    );

    await expect(
      uc.execute({
        actorId: 'actor',
        productId: 'prod-1',
        contractCode: 'not.a.contract',
        code: 'x',
        name: 'X',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });

    await expect(
      uc.execute({
        actorId: 'actor',
        productId: 'missing',
        contractCode: 'retail.commerce.v1',
        code: 'x',
        name: 'X',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
  });

  it('SubmitApplicationUseCase validates requiredConsents from schemaDefinition', async () => {
    const store: Store = {
      presentations: [],
      formSchemas: new Map(),
      formVersions: new Map(),
      applications: new Map(),
      answers: [],
      audits: [],
      checkoutSessions: new Map(),
      documentRequirements: [],
    };
    const schema: FormSchema = {
      id: 'fs-consent',
      code: 'consent-form',
      name: 'Consent form',
      description: null,
      status: 'ACTIVE',
      productId: 'prod-1',
      commercialPlanId: null,
      currentPublishedVersionId: 'fv-consent',
      metadata: {},
      createdBy: 'actor',
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };
    store.formSchemas.set(schema.id, schema);
    store.formVersions.set('fv-consent', {
      id: 'fv-consent',
      formSchemaId: schema.id,
      versionNumber: 1,
      schemaDefinition: {
        fields: [{ key: 'email', type: 'email', required: true }],
        requiredConsents: [
          {
            purpose: 'acquisition_processing',
            channel: 'WEB',
            textVersion: 'v1',
            mandatory: true,
          },
        ],
      },
      conditionRules: [],
      status: 'PUBLISHED',
      publishedAt: new Date(),
      publishedBy: 'actor',
      immutableAfterPublish: true,
      metadata: {},
      createdBy: 'actor',
      createdAt: new Date(),
    });
    const app: Application = {
      id: 'app-consent',
      applicationNumber: 'A-1',
      prospectId: 'prospect-1',
      leadId: null,
      formSchemaId: schema.id,
      formVersionId: 'fv-consent',
      formPublicationId: null,
      productId: null,
      commercialPlanId: null,
      planPresentationId: null,
      status: 'DRAFT',
      submittedAt: null,
      decidedAt: null,
      decidedBy: null,
      decisionReason: null,
      metadata: {},
      createdBy: 'actor',
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };
    store.applications.set(app.id, app);
    store.answers.push({
      applicationId: app.id,
      fieldKey: 'email',
      value: 'a@b.co',
      metadata: {},
    });
    const repo = createFakeRepo(store);
    const uc = new SubmitApplicationUseCase(repo, outboxStub() as never);

    await expect(uc.execute({ applicationId: app.id })).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
    });

    const submitted = await uc.execute({
      applicationId: app.id,
      consents: [
        {
          purpose: 'acquisition_processing',
          channel: 'WEB',
          textVersion: 'v1',
          decision: 'GRANTED',
        },
      ],
    });
    expect(submitted.status).toBe('SUBMITTED');
    expect(submitted.metadata.consentEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ purpose: 'acquisition_processing', state: 'GRANTED' }),
      ]),
    );
  });
});
