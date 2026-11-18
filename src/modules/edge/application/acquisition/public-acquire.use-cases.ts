import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import type { AcquisitionRepositoryPort } from '../../domain/acquisition/acquisition-repository.port.js';
import type { SubmittedConsent } from '../../domain/marketing/marketing-consent.js';
import {
  CaptureAcquisitionLeadUseCase,
  CreateApplicationDraftUseCase,
  CreateCheckoutSessionUseCase,
  GetPublicFormBySlugUseCase,
  PromoteLeadUseCase,
  SaveApplicationAnswersUseCase,
  SubmitApplicationUseCase,
} from './acquisition.use-cases.js';

/**
 * Public self-serve façade: lead → prospect → application draft/answers/submit
 * with signed challenge (same anti-abuse as CaptureAcquisitionLead).
 */
export class PublicSubmitApplicationUseCase {
  constructor(
    private readonly getPublicForm: GetPublicFormBySlugUseCase,
    private readonly captureLead: CaptureAcquisitionLeadUseCase,
    private readonly promoteLead: PromoteLeadUseCase,
    private readonly createDraft: CreateApplicationDraftUseCase,
    private readonly saveAnswers: SaveApplicationAnswersUseCase,
    private readonly submitApplication: SubmitApplicationUseCase,
  ) {}

  async execute(input: {
    publicFormSlug: string;
    email: string;
    answers?: Record<string, unknown> | Array<{ fieldKey: string; value: unknown }>;
    displayName?: string | null;
    companyName?: string | null;
    productId?: string | null;
    commercialPlanId?: string | null;
    planPresentationId?: string | null;
    consents?: SubmittedConsent[];
    honeypot?: string | null;
    submittedAtMs?: number | null;
    challengeId?: string | null;
    challengeToken?: string | null;
    challengeAnswer?: string | null;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
    submit?: boolean;
  }) {
    const form = await this.getPublicForm.execute({ publicSlug: input.publicFormSlug });
    const lead = await this.captureLead.execute({
      actorId: 'public-acquisition',
      email: input.email,
      sourceType: 'PUBLIC_APPLICATION',
      sourceRef: input.publicFormSlug,
      formPublicationId: form.publication.id,
      consents: input.consents,
      honeypot: input.honeypot,
      submittedAtMs: input.submittedAtMs,
      challengeId: input.challengeId,
      challengeToken: input.challengeToken,
      challengeAnswer: input.challengeAnswer,
      metadata: {
        ...(input.metadata ?? {}),
        displayName: input.displayName ?? null,
        companyName: input.companyName ?? null,
      },
      correlationId: input.correlationId,
    });

    const promoted = await this.promoteLead.execute({
      actorId: 'public-acquisition',
      leadId: lead.id,
      createProspectIfMissing: true,
      correlationId: input.correlationId,
    });

    const prospectId = promoted.prospectId ?? lead.prospectId;
    if (!prospectId) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Prospect missing after lead promotion');
    }

    const draft = await this.createDraft.execute({
      actorId: 'public-acquisition',
      prospectId,
      formVersionId: form.formVersion.id,
      formSchemaId: form.publication.formSchemaId,
      formPublicationId: form.publication.id,
      leadId: lead.id,
      productId: input.productId ?? null,
      commercialPlanId: input.commercialPlanId ?? null,
      planPresentationId: input.planPresentationId ?? null,
      consents: input.consents,
      metadata: input.metadata,
      correlationId: input.correlationId,
    });

    if (input.answers) {
      await this.saveAnswers.execute({
        actorId: 'public-acquisition',
        applicationId: draft.id,
        answers: input.answers,
        correlationId: input.correlationId,
      });
    }

    let submitted = null as Awaited<ReturnType<SubmitApplicationUseCase['execute']>> | null;
    if (input.submit !== false) {
      submitted = await this.submitApplication.execute({
        actorId: 'public-acquisition',
        applicationId: draft.id,
        consents: input.consents,
        correlationId: input.correlationId,
      });
    }

    return {
      lead,
      prospectId,
      application: submitted ?? draft,
      formPublicationId: form.publication.id,
      status: submitted ? 'SUBMITTED' : 'DRAFT',
    };
  }
}

/**
 * Public checkout session creation — no payment credentials; plan must be published presentation.
 */
export class PublicCreateCheckoutUseCase {
  constructor(
    private readonly repo: AcquisitionRepositoryPort,
    private readonly createCheckout: CreateCheckoutSessionUseCase,
    private readonly captureLead?: CaptureAcquisitionLeadUseCase,
    private readonly promoteLead?: PromoteLeadUseCase,
  ) {}

  async execute(input: {
    email: string;
    idempotencyKey: string;
    planPresentationId?: string | null;
    commercialPlanId?: string | null;
    applicationId?: string | null;
    prospectId?: string | null;
    quoteReferenceId?: string | null;
    honeypot?: string | null;
    submittedAtMs?: number | null;
    challengeId?: string | null;
    challengeToken?: string | null;
    challengeAnswer?: string | null;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  }) {
    let prospectId = input.prospectId?.trim() || null;

    if (!prospectId) {
      if (!this.captureLead || !this.promoteLead) {
        throw new DomainError(ErrorCode.VALIDATION_ERROR, 'prospectId required without lead capture');
      }
      const lead = await this.captureLead.execute({
        actorId: 'public-acquisition',
        email: input.email,
        sourceType: 'PUBLIC_CHECKOUT',
        honeypot: input.honeypot,
        submittedAtMs: input.submittedAtMs,
        challengeId: input.challengeId,
        challengeToken: input.challengeToken,
        challengeAnswer: input.challengeAnswer,
        metadata: input.metadata,
        correlationId: input.correlationId,
      });
      const promoted = await this.promoteLead.execute({
        actorId: 'public-acquisition',
        leadId: lead.id,
        createProspectIfMissing: true,
        correlationId: input.correlationId,
      });
      prospectId = promoted.prospectId ?? lead.prospectId;
    }

    if (!prospectId) {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'prospectId unresolved for checkout');
    }

    if (input.planPresentationId) {
      const plan = await this.repo.getPlanPresentation(input.planPresentationId);
      if (!plan || plan.status !== 'PUBLISHED') {
        throw new DomainError(
          ErrorCode.VALIDATION_ERROR,
          'planPresentationId must reference a PUBLISHED plan presentation',
        );
      }
    }

    return this.createCheckout.execute({
      actorId: 'public-acquisition',
      prospectId,
      idempotencyKey: input.idempotencyKey.trim() || randomUUID(),
      applicationId: input.applicationId,
      planPresentationId: input.planPresentationId,
      commercialPlanId: input.commercialPlanId,
      quoteReferenceId: input.quoteReferenceId,
      metadata: { ...(input.metadata ?? {}), source: 'public_checkout' },
      correlationId: input.correlationId,
    });
  }
}

export class ListPublicSegmentPresentationsUseCase {
  constructor(private readonly repo: AcquisitionRepositoryPort) {}

  execute(filter?: { productId?: string; limit?: number; offset?: number }) {
    return this.repo.listSegmentPresentations({
      status: 'PUBLISHED',
      productId: filter?.productId,
      limit: filter?.limit ?? 50,
      offset: filter?.offset ?? 0,
    });
  }
}
