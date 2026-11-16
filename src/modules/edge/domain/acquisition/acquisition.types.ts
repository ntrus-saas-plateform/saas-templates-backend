/** P10.0 SaaS Customer Experience & Subscription Acquisition — domain types. */

export const EDGE_P10_OUTBOX_TENANT = 'edge-p10-acquisition';

export type PresentationStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'DEPRECATED' | 'ARCHIVED';

export type ContentVersionStatus = 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED' | 'ARCHIVED';

export type SegmentPresentationStatus = 'DRAFT' | 'PUBLISHED' | 'DEPRECATED' | 'ARCHIVED';

export type PriceDisplayMode =
  | 'AUTHORITATIVE'
  | 'INDICATIVE'
  | 'QUOTE_REQUIRED'
  | 'ENTERPRISE_CUSTOM';

export type ProspectStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'ENGAGED'
  | 'QUALIFYING'
  | 'QUALIFIED'
  | 'APPLICATION_IN_PROGRESS'
  | 'CHECKOUT_PENDING'
  | 'HANDED_OFF'
  | 'CONVERTED'
  | 'DISQUALIFIED'
  | 'ARCHIVED';

export type LeadStatus =
  | 'CAPTURED'
  | 'VERIFIED'
  | 'SCORED'
  | 'PROMOTED'
  | 'MERGED'
  | 'REJECTED'
  | 'EXPIRED';

export type LeadSourceType =
  | 'FORM'
  | 'PUBLIC_LANDING'
  | 'MARKETING_SIGNAL'
  | 'MANUAL'
  | 'API'
  | 'PARTNER'
  | 'OTHER';

export type FormSchemaStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'ARCHIVED';

export type FormVersionStatus = 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED' | 'ARCHIVED';

export type FormPublicationChannel = 'PUBLIC_WEB' | 'PARTNER' | 'INTERNAL' | 'EMBED' | 'API';

export type FormPublicationStatus = 'ACTIVE' | 'SUSPENDED' | 'RETIRED';

export type DocumentRequirementStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  /** Legacy review status — alias of UNDER_REVIEW */
  | 'IN_REVIEW'
  | 'UNDER_REVIEW'
  /** Legacy info-request status — alias of INFORMATION_REQUIRED */
  | 'DOCUMENTS_PENDING'
  | 'INFORMATION_REQUIRED'
  | 'INFORMATION_RECEIVED'
  | 'QUALIFICATION_PENDING'
  | 'QUALIFIED'
  | 'DISQUALIFIED'
  | 'QUOTATION_PENDING'
  | 'QUOTATION_ISSUED'
  /** Legacy approval status — alias of QUALIFIED / ACCEPTED paths */
  | 'APPROVED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'EXPIRED'
  /** Legacy checkout status — alias of CHECKOUT_PENDING */
  | 'CHECKOUT_READY'
  | 'CHECKOUT_PENDING'
  /** Legacy completion status — alias of CONVERTED */
  | 'COMPLETED'
  | 'CONVERTED';

export type DocumentReferenceStatus =
  | 'UPLOADED'
  | 'PENDING_REVIEW'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'WITHDRAWN';

export type DocumentReviewDecision = 'ACCEPTED' | 'REJECTED' | 'NEEDS_RESUBMIT';

export type QualificationStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'APPROVED'
  | 'REJECTED'
  | 'CONDITIONAL'
  | 'WITHDRAWN';

export type ReviewAssignmentRole = 'REVIEWER' | 'APPROVER' | 'DOCUMENT_REVIEWER' | 'QUALIFIER';

export type ReviewAssignmentStatus =
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REASSIGNED'
  | 'CANCELLED';

export type QuoteRequestStatus =
  | 'REQUESTED'
  | 'IN_PROGRESS'
  | 'QUOTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';

export type QuoteReferenceStatus = 'ACTIVE' | 'SUPERSEDED' | 'EXPIRED' | 'VOID';

export type CheckoutSessionStatus =
  | 'CREATED'
  | 'AWAITING_PAYMENT'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'HANDOFF_READY'
  | 'COMPLETED';

export type SubscriptionHandoffStatus =
  | 'REQUESTED'
  | 'SUBMITTED'
  | 'ACKNOWLEDGED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type JourneyDefinitionStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'ARCHIVED';

export type JourneyInstanceStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type CommunicationChannel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'WEBHOOK' | 'OTHER';

export type CommunicationStatus =
  | 'QUEUED'
  | 'SENT'
  | 'ACCEPTED'
  | 'DELIVERED'
  | 'FAILED'
  | 'CANCELLED';

export type IdempotencyKeyStatus = 'STARTED' | 'COMPLETED' | 'FAILED';

export type ProductPresentation = {
  id: string;
  productId: string;
  code: string;
  slug: string;
  title: string;
  summary: string | null;
  status: PresentationStatus | string;
  locale: string;
  currentPublishedVersionId: string | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type ProductContentVersion = {
  id: string;
  presentationId: string;
  versionNumber: number;
  content: Record<string, unknown>;
  status: ContentVersionStatus | string;
  publishedAt: Date | null;
  publishedBy: string | null;
  immutableAfterPublish: boolean;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
};

export type SegmentPresentation = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  productPresentationId: string | null;
  status: SegmentPresentationStatus | string;
  targetingRules: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type PlanPresentation = {
  id: string;
  commercialPlanId: string;
  productPresentationId: string | null;
  code: string;
  title: string;
  summary: string | null;
  status: PresentationStatus | string;
  priceDisplayMode: PriceDisplayMode | string;
  priceDisplayRef: string | null;
  currencyHint: string | null;
  featuresDisplay: unknown[];
  ctaLabel: string | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type Prospect = {
  id: string;
  emailNormalized: string;
  displayName: string | null;
  companyName: string | null;
  status: ProspectStatus | string;
  commercialAccountId: string | null;
  productId: string | null;
  commercialPlanId: string | null;
  planPresentationId: string | null;
  locale: string | null;
  country: string | null;
  sourceChannel: string | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type AcquisitionLead = {
  id: string;
  prospectId: string | null;
  emailNormalized: string;
  status: LeadStatus | string;
  sourceType: LeadSourceType | string;
  sourceRef: string | null;
  formPublicationId: string | null;
  marketingLeadSoftRef: string | null;
  score: number | null;
  scoreBand: string | null;
  attribution: Record<string, unknown>;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type AcquisitionLeadEvent = {
  id: string;
  leadId: string;
  eventType: string;
  body: Record<string, unknown>;
  actorId: string | null;
  createdAt: Date;
};

export type FormSchema = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: FormSchemaStatus | string;
  productId: string | null;
  commercialPlanId: string | null;
  currentPublishedVersionId: string | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type FormFieldDefinition = {
  key: string;
  type: string;
  label?: string;
  required?: boolean;
  options?: unknown[];
  min?: number;
  max?: number;
  pattern?: string;
  condition?: unknown;
};

export type FormSchemaSection = {
  key: string;
  title?: string;
  fields?: FormFieldDefinition[];
};

export type FormSchemaRequiredConsent = {
  purpose: string;
  channel: string;
  textVersion: string;
  locale?: string;
  mandatory?: boolean;
  consentRef?: string;
};

export type FormSchemaDefinition = {
  fields?: FormFieldDefinition[];
  sections?: FormSchemaSection[];
  requiredConsents?: FormSchemaRequiredConsent[];
  requiredDocumentTypes?: unknown[];
  [key: string]: unknown;
};

export type FormVersion = {
  id: string;
  formSchemaId: string;
  versionNumber: number;
  schemaDefinition: FormSchemaDefinition;
  conditionRules: unknown[];
  status: FormVersionStatus | string;
  publishedAt: Date | null;
  publishedBy: string | null;
  immutableAfterPublish: boolean;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
};

export type FormPublication = {
  id: string;
  formSchemaId: string;
  formVersionId: string;
  channel: FormPublicationChannel | string;
  publicSlug: string | null;
  status: FormPublicationStatus | string;
  publishedAt: Date;
  publishedBy: string;
  expiresAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type DocumentRequirement = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  formSchemaId: string | null;
  documentType: string;
  required: boolean;
  conditionRules: unknown[];
  status: DocumentRequirementStatus | string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type Application = {
  id: string;
  applicationNumber: string;
  prospectId: string;
  leadId: string | null;
  formSchemaId: string;
  formVersionId: string;
  formPublicationId: string | null;
  productId: string | null;
  commercialPlanId: string | null;
  planPresentationId: string | null;
  status: ApplicationStatus | string;
  submittedAt: Date | null;
  decidedAt: Date | null;
  decidedBy: string | null;
  decisionReason: string | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type ApplicationAnswer = {
  id: string;
  applicationId: string;
  fieldKey: string;
  value: unknown;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type ApplicationEvent = {
  id: string;
  applicationId: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  body: Record<string, unknown>;
  actorId: string | null;
  createdAt: Date;
};

export type DocumentReference = {
  id: string;
  applicationId: string;
  requirementId: string | null;
  documentType: string;
  storageRef: string;
  fileName: string | null;
  contentType: string | null;
  checksumSha256: string | null;
  status: DocumentReferenceStatus | string;
  metadata: Record<string, unknown>;
  uploadedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type DocumentReview = {
  id: string;
  documentReferenceId: string;
  decision: DocumentReviewDecision | string;
  reviewerId: string;
  comments: string | null;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type QualificationRecord = {
  id: string;
  applicationId: string;
  status: QualificationStatus | string;
  outcomeSummary: string | null;
  reviewerId: string | null;
  approvedBy: string | null;
  decidedAt: Date | null;
  criteria: Record<string, unknown>;
  evidence: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type ReviewAssignment = {
  id: string;
  applicationId: string;
  assigneeId: string;
  roleHint: ReviewAssignmentRole | string;
  status: ReviewAssignmentStatus | string;
  assignedBy: string;
  dueAt: Date | null;
  completedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type QuoteRequest = {
  id: string;
  applicationId: string | null;
  prospectId: string;
  commercialPlanId: string | null;
  planPresentationId: string | null;
  status: QuoteRequestStatus | string;
  requestedBy: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type QuoteReference = {
  id: string;
  quoteRequestId: string;
  externalQuoteRef: string;
  commercialSource: string;
  status: QuoteReferenceStatus | string;
  validUntil: Date | null;
  displaySummary: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type CheckoutSession = {
  id: string;
  applicationId: string | null;
  prospectId: string;
  planPresentationId: string | null;
  commercialPlanId: string | null;
  quoteReferenceId: string | null;
  status: CheckoutSessionStatus | string;
  billingSessionRef: string | null;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type CheckoutEvent = {
  id: string;
  checkoutSessionId: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  externalRef: string | null;
  body: Record<string, unknown>;
  actorId: string | null;
  createdAt: Date;
};

export type SubscriptionHandoff = {
  id: string;
  checkoutSessionId: string | null;
  applicationId: string | null;
  prospectId: string;
  commercialAccountId: string | null;
  commercialPlanId: string | null;
  status: SubscriptionHandoffStatus | string;
  subscriptionRef: string | null;
  externalEvidenceRef: string | null;
  failureReason: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type JourneyDefinition = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: JourneyDefinitionStatus | string;
  definition: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type JourneyInstance = {
  id: string;
  journeyDefinitionId: string;
  prospectId: string | null;
  applicationId: string | null;
  status: JourneyInstanceStatus | string;
  currentStepKey: string | null;
  context: Record<string, unknown>;
  metadata: Record<string, unknown>;
  startedAt: Date;
  completedAt: Date | null;
  updatedAt: Date;
  version: number;
};

export type JourneyEvent = {
  id: string;
  journeyInstanceId: string;
  eventType: string;
  stepKey: string | null;
  body: Record<string, unknown>;
  actorId: string | null;
  createdAt: Date;
};

export type AcquisitionCommunication = {
  id: string;
  prospectId: string | null;
  applicationId: string | null;
  journeyInstanceId: string | null;
  channel: CommunicationChannel | string;
  templateRef: string | null;
  status: CommunicationStatus | string;
  providerRef: string | null;
  subject: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type AnalyticsEvent = {
  id: string;
  eventName: string;
  prospectId: string | null;
  leadId: string | null;
  applicationId: string | null;
  sessionKey: string | null;
  properties: Record<string, unknown>;
  occurredAt: Date;
  createdAt: Date;
};

export type AttributionRecord = {
  id: string;
  prospectId: string | null;
  leadId: string | null;
  channel: string | null;
  campaignRef: string | null;
  marketingSoftRef: string | null;
  utm: Record<string, unknown>;
  firstTouchAt: Date | null;
  lastTouchAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type AcquisitionAuditEvent = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  action: string;
  actorId: string | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  correlationId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type AcquisitionIdempotencyKey = {
  id: string;
  scope: string;
  idempotencyKey: string;
  requestHash: string | null;
  responseRef: string | null;
  status: IdempotencyKeyStatus | string;
  expiresAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type AcquisitionListFilter = {
  status?: string;
  prospectId?: string;
  applicationId?: string;
  productId?: string;
  productPresentationId?: string;
  q?: string;
  limit?: number;
  offset?: number;
};
