import type {
  AcquisitionAuditEvent,
  AcquisitionCommunication,
  AcquisitionIdempotencyKey,
  AcquisitionLead,
  AcquisitionLeadEvent,
  AcquisitionListFilter,
  AnalyticsEvent,
  Application,
  ApplicationAnswer,
  ApplicationEvent,
  AttributionRecord,
  CheckoutEvent,
  CheckoutSession,
  DocumentReference,
  DocumentRequirement,
  DocumentReview,
  FormPublication,
  FormSchema,
  FormVersion,
  JourneyDefinition,
  JourneyEvent,
  JourneyInstance,
  PlanPresentation,
  ProductContentVersion,
  ProductPresentation,
  Prospect,
  QualificationRecord,
  QuoteReference,
  QuoteRequest,
  ReviewAssignment,
  SegmentPresentation,
  SubscriptionHandoff,
} from './acquisition.types.js';

export const ACQUISITION_REPOSITORY_PORT = Symbol('ACQUISITION_REPOSITORY_PORT');

export interface AcquisitionRepositoryPort {
  // --- Presentations ---
  createProductPresentation(
    input: Omit<
      ProductPresentation,
      'id' | 'createdAt' | 'updatedAt' | 'version' | 'currentPublishedVersionId' | 'updatedBy'
    > & {
      id?: string;
      currentPublishedVersionId?: string | null;
      updatedBy?: string | null;
      version?: number;
    },
    client?: unknown,
  ): Promise<ProductPresentation>;

  getProductPresentation(id: string): Promise<ProductPresentation | null>;

  getProductPresentationBySlug(slug: string): Promise<ProductPresentation | null>;

  listProductPresentations(
    filter?: AcquisitionListFilter,
  ): Promise<{ items: ProductPresentation[]; total: number }>;

  createProductContentVersion(
    input: Omit<
      ProductContentVersion,
      'id' | 'createdAt' | 'publishedAt' | 'publishedBy' | 'status'
    > & {
      id?: string;
      status?: string;
      publishedAt?: Date | null;
      publishedBy?: string | null;
    },
    client?: unknown,
  ): Promise<ProductContentVersion>;

  publishProductContentVersion(
    id: string,
    publishedBy: string,
    client?: unknown,
  ): Promise<ProductContentVersion>;

  createSegmentPresentation(
    input: Omit<SegmentPresentation, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'updatedBy'> & {
      id?: string;
      updatedBy?: string | null;
      version?: number;
    },
    client?: unknown,
  ): Promise<SegmentPresentation>;

  listSegmentPresentations(
    filter?: AcquisitionListFilter,
  ): Promise<{ items: SegmentPresentation[]; total: number }>;

  createPlanPresentation(
    input: Omit<PlanPresentation, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'updatedBy'> & {
      id?: string;
      updatedBy?: string | null;
      version?: number;
    },
    client?: unknown,
  ): Promise<PlanPresentation>;

  getPlanPresentation(id: string): Promise<PlanPresentation | null>;

  listPlanPresentations(
    filter?: AcquisitionListFilter,
  ): Promise<{ items: PlanPresentation[]; total: number }>;

  // --- Prospects / leads ---
  createProspect(
    input: Omit<
      Prospect,
      'id' | 'createdAt' | 'updatedAt' | 'version' | 'updatedBy' | 'status'
    > & {
      id?: string;
      status?: string;
      updatedBy?: string | null;
      version?: number;
    },
    client?: unknown,
  ): Promise<Prospect>;

  getProspect(id: string): Promise<Prospect | null>;

  listProspects(
    filter?: AcquisitionListFilter & { emailNormalized?: string },
  ): Promise<{ items: Prospect[]; total: number }>;

  transitionProspect(
    id: string,
    toStatus: string,
    patch?: Partial<Prospect> & { expectedVersion?: number },
    client?: unknown,
  ): Promise<Prospect>;

  createLead(
    input: Omit<AcquisitionLead, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'status'> & {
      id?: string;
      status?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<AcquisitionLead>;

  getLead(id: string): Promise<AcquisitionLead | null>;

  listLeads(
    filter?: AcquisitionListFilter & { emailNormalized?: string },
  ): Promise<{ items: AcquisitionLead[]; total: number }>;

  addLeadEvent(
    input: Omit<AcquisitionLeadEvent, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<AcquisitionLeadEvent>;

  promoteLeadToProspect(
    leadId: string,
    prospectId: string,
    client?: unknown,
  ): Promise<AcquisitionLead>;

  updateLead(
    id: string,
    patch: Partial<AcquisitionLead> & { expectedVersion?: number },
    client?: unknown,
  ): Promise<AcquisitionLead>;

  // --- Forms ---
  createFormSchema(
    input: Omit<
      FormSchema,
      'id' | 'createdAt' | 'updatedAt' | 'version' | 'currentPublishedVersionId' | 'updatedBy'
    > & {
      id?: string;
      currentPublishedVersionId?: string | null;
      updatedBy?: string | null;
      version?: number;
    },
    client?: unknown,
  ): Promise<FormSchema>;

  getFormSchema(id: string): Promise<FormSchema | null>;

  listFormSchemas(
    filter?: AcquisitionListFilter,
  ): Promise<{ items: FormSchema[]; total: number }>;

  createFormVersion(
    input: Omit<
      FormVersion,
      'id' | 'createdAt' | 'publishedAt' | 'publishedBy' | 'status'
    > & {
      id?: string;
      status?: string;
      publishedAt?: Date | null;
      publishedBy?: string | null;
    },
    client?: unknown,
  ): Promise<FormVersion>;

  getFormVersion(id: string): Promise<FormVersion | null>;

  publishFormVersion(
    id: string,
    publishedBy: string,
    client?: unknown,
  ): Promise<FormVersion>;

  createFormPublication(
    input: Omit<FormPublication, 'id' | 'createdAt' | 'publishedAt'> & {
      id?: string;
      publishedAt?: Date;
    },
    client?: unknown,
  ): Promise<FormPublication>;

  getFormPublicationBySlug(publicSlug: string): Promise<FormPublication | null>;

  getFormPublication(id: string): Promise<FormPublication | null>;

  listFormPublications(filter?: {
    formSchemaId?: string;
    channel?: string;
    status?: string;
  }): Promise<FormPublication[]>;

  createDocumentRequirement(
    input: Omit<DocumentRequirement, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<DocumentRequirement>;

  listDocumentRequirements(formSchemaId?: string): Promise<DocumentRequirement[]>;

  // --- Applications ---
  createApplication(
    input: Omit<
      Application,
      | 'id'
      | 'applicationNumber'
      | 'createdAt'
      | 'updatedAt'
      | 'version'
      | 'submittedAt'
      | 'decidedAt'
      | 'decidedBy'
      | 'decisionReason'
      | 'updatedBy'
      | 'status'
    > & {
      id?: string;
      applicationNumber?: string;
      status?: string;
      submittedAt?: Date | null;
      version?: number;
    },
    client?: unknown,
  ): Promise<Application>;

  getApplication(id: string): Promise<Application | null>;

  listApplications(
    filter?: AcquisitionListFilter,
  ): Promise<{ items: Application[]; total: number }>;

  transitionApplication(
    id: string,
    toStatus: string,
    patch?: Partial<Application> & { expectedVersion?: number },
    actorId?: string | null,
    client?: unknown,
  ): Promise<Application>;

  /**
   * Bump application version (and updated_at) without a status transition.
   * Used for optimistic concurrency when saving answers (same-status not allowed by policy).
   */
  touchApplication(
    id: string,
    expectedVersion?: number,
    client?: unknown,
  ): Promise<Application>;

  upsertApplicationAnswer(
    input: Omit<ApplicationAnswer, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<ApplicationAnswer>;

  listApplicationAnswers(applicationId: string): Promise<ApplicationAnswer[]>;

  addApplicationEvent(
    input: Omit<ApplicationEvent, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ApplicationEvent>;

  // --- Documents / qualification / reviews ---
  getDocumentReference(id: string): Promise<DocumentReference | null>;

  listDocumentReferences(
    filter?: AcquisitionListFilter,
  ): Promise<{ items: DocumentReference[]; total: number }>;

  createDocumentReference(
    input: Omit<DocumentReference, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'status'> & {
      id?: string;
      status?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<DocumentReference>;

  transitionDocumentReference(
    id: string,
    toStatus: string,
    patch?: Partial<DocumentReference> & { expectedVersion?: number },
    client?: unknown,
  ): Promise<DocumentReference>;

  createDocumentReview(
    input: Omit<DocumentReview, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<DocumentReview>;

  upsertQualification(
    input: Omit<
      QualificationRecord,
      'id' | 'createdAt' | 'updatedAt' | 'version' | 'decidedAt' | 'approvedBy'
    > & {
      id?: string;
      decidedAt?: Date | null;
      approvedBy?: string | null;
      version?: number;
    },
    client?: unknown,
  ): Promise<QualificationRecord>;

  getQualificationByApplication(applicationId: string): Promise<QualificationRecord | null>;

  transitionQualification(
    id: string,
    toStatus: string,
    patch?: Partial<QualificationRecord> & { expectedVersion?: number },
    client?: unknown,
  ): Promise<QualificationRecord>;

  createReviewAssignment(
    input: Omit<ReviewAssignment, 'id' | 'createdAt' | 'updatedAt' | 'completedAt'> & {
      id?: string;
      completedAt?: Date | null;
    },
    client?: unknown,
  ): Promise<ReviewAssignment>;

  listReviewAssignments(applicationId: string): Promise<ReviewAssignment[]>;

  // --- Quotes / checkout / handoff ---
  getQuoteRequest(id: string): Promise<QuoteRequest | null>;

  listQuoteRequests(
    filter?: AcquisitionListFilter,
  ): Promise<{ items: QuoteRequest[]; total: number }>;

  createQuoteRequest(
    input: Omit<QuoteRequest, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'status'> & {
      id?: string;
      status?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<QuoteRequest>;

  attachQuoteReference(
    input: Omit<QuoteReference, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<QuoteReference>;

  getActiveQuoteReference(quoteRequestId: string): Promise<QuoteReference | null>;

  transitionQuoteRequest(
    id: string,
    toStatus: string,
    patch?: Partial<QuoteRequest> & { expectedVersion?: number },
    client?: unknown,
  ): Promise<QuoteRequest>;

  createCheckoutSession(
    input: Omit<CheckoutSession, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'status'> & {
      id?: string;
      status?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<CheckoutSession>;

  getCheckoutSession(id: string): Promise<CheckoutSession | null>;

  getCheckoutSessionByIdempotencyKey(idempotencyKey: string): Promise<CheckoutSession | null>;

  transitionCheckoutSession(
    id: string,
    toStatus: string,
    patch?: Partial<CheckoutSession> & { expectedVersion?: number },
    client?: unknown,
  ): Promise<CheckoutSession>;

  addCheckoutEvent(
    input: Omit<CheckoutEvent, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<CheckoutEvent>;

  createSubscriptionHandoff(
    input: Omit<
      SubscriptionHandoff,
      'id' | 'createdAt' | 'updatedAt' | 'version' | 'status' | 'failureReason'
    > & {
      id?: string;
      status?: string;
      failureReason?: string | null;
      version?: number;
    },
    client?: unknown,
  ): Promise<SubscriptionHandoff>;

  getSubscriptionHandoff(id: string): Promise<SubscriptionHandoff | null>;

  listSubscriptionHandoffs(
    filter?: AcquisitionListFilter,
  ): Promise<{ items: SubscriptionHandoff[]; total: number }>;

  listCheckoutSessions(
    filter?: AcquisitionListFilter,
  ): Promise<{ items: CheckoutSession[]; total: number }>;

  transitionSubscriptionHandoff(
    id: string,
    toStatus: string,
    patch?: Partial<SubscriptionHandoff> & { expectedVersion?: number },
    client?: unknown,
  ): Promise<SubscriptionHandoff>;

  // --- Journeys / communications / analytics ---
  createJourneyDefinition(
    input: Omit<JourneyDefinition, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
      id?: string;
      version?: number;
    },
    client?: unknown,
  ): Promise<JourneyDefinition>;

  startJourneyInstance(
    input: Omit<
      JourneyInstance,
      'id' | 'startedAt' | 'updatedAt' | 'version' | 'completedAt' | 'status'
    > & {
      id?: string;
      status?: string;
      startedAt?: Date;
      completedAt?: Date | null;
      version?: number;
    },
    client?: unknown,
  ): Promise<JourneyInstance>;

  getJourneyInstance(id: string): Promise<JourneyInstance | null>;

  findJourneyInstance(filter: {
    prospectId?: string | null;
    journeyDefinitionId?: string;
    applicationId?: string | null;
    status?: string;
  }): Promise<JourneyInstance | null>;

  updateJourneyInstance(
    id: string,
    patch: Partial<JourneyInstance> & { expectedVersion?: number },
    client?: unknown,
  ): Promise<JourneyInstance>;

  addJourneyEvent(
    input: Omit<JourneyEvent, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<JourneyEvent>;

  createCommunication(
    input: Omit<AcquisitionCommunication, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<AcquisitionCommunication>;

  getCommunication(id: string): Promise<AcquisitionCommunication | null>;

  updateCommunicationStatus(
    id: string,
    status: string,
    patch?: Partial<AcquisitionCommunication>,
    client?: unknown,
  ): Promise<AcquisitionCommunication>;

  recordAnalyticsEvent(
    input: Omit<AnalyticsEvent, 'id' | 'createdAt' | 'occurredAt'> & {
      id?: string;
      occurredAt?: Date;
    },
    client?: unknown,
  ): Promise<AnalyticsEvent>;

  listAnalyticsEvents(filter?: {
    eventName?: string;
    prospectId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: AnalyticsEvent[]; total: number }>;

  getAcquisitionOverviewCounts(): Promise<{
    presentationsPublished: number;
    prospectsActive: number;
    leadsCaptured: number;
    applicationsOpen: number;
    checkoutsPending: number;
    handoffsRequested: number;
  }>;

  upsertAttribution(
    input: Omit<AttributionRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<AttributionRecord>;

  /** Durable acquisition audit (alias used by application layer as addAuditEvent). */
  appendAuditEvent(
    input: Omit<AcquisitionAuditEvent, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<AcquisitionAuditEvent>;


  beginIdempotency(
    input: {
      scope: string;
      idempotencyKey: string;
      requestHash?: string | null;
      expiresAt?: Date | null;
      metadata?: Record<string, unknown>;
    },
    client?: unknown,
  ): Promise<AcquisitionIdempotencyKey>;

  completeIdempotency(
    scope: string,
    idempotencyKey: string,
    responseRef: string | null,
    status: 'COMPLETED' | 'FAILED',
    client?: unknown,
  ): Promise<AcquisitionIdempotencyKey>;

  getIdempotency(
    scope: string,
    idempotencyKey: string,
  ): Promise<AcquisitionIdempotencyKey | null>;
}
