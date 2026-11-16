import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type { AcquisitionRepositoryPort } from '../../domain/acquisition/acquisition-repository.port.js';
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
} from '../../domain/acquisition/acquisition.types.js';

type Row = Record<string, unknown>;

function str(v: unknown): string {
  return v == null ? '' : String(v);
}
function strOrNull(v: unknown): string | null {
  return v == null ? null : String(v);
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
function bool(v: unknown): boolean {
  return v === true || v === 't' || v === 'true' || v === 1 || v === '1';
}
function asDate(v: unknown): Date {
  return v instanceof Date ? v : new Date(String(v));
}
function asDateOrNull(v: unknown): Date | null {
  return v == null ? null : asDate(v);
}
function asJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === 'object') return v as T;
  try {
    return JSON.parse(String(v)) as T;
  } catch {
    return fallback;
  }
}

function numbered(prefix: string): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const suffix = randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${y}${m}${day}-${suffix}`;
}

@Injectable()
export class PgAcquisitionRepository implements AcquisitionRepositoryPort {
  constructor(private readonly db: ControlPlaneDatabaseService) {}

  private async q<T extends Row = Row>(
    sql: string,
    params: unknown[] = [],
    client?: unknown,
  ): Promise<T[]> {
    if (client) {
      const result = await (client as PoolClient).query(sql, params);
      return result.rows as T[];
    }
    const pool = this.db.getPool();
    const result = await pool.query(sql, params);
    return result.rows as T[];
  }

  private bounds(filter?: AcquisitionListFilter): { limit: number; offset: number } {
    return {
      limit: Math.min(Math.max(filter?.limit ?? 50, 1), 200),
      offset: Math.max(filter?.offset ?? 0, 0),
    };
  }

  private async throwTransitionMiss(
    table: string,
    id: string,
    expectedVersion: number | undefined,
    label: string,
    client?: unknown,
  ): Promise<never> {
    const rows = await this.q(`SELECT id FROM ${table} WHERE id = $1`, [id], client);
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, `${label} not found`);
    }
    if (expectedVersion != null) {
      throw new DomainError(ErrorCode.CONFLICT, `${label} version conflict`);
    }
    throw new DomainError(ErrorCode.CONFLICT, `${label} transition conflict`);
  }

  // --- Mappers ---

  private mapProductPresentation(row: Row): ProductPresentation {
    return {
      id: str(row.id),
      productId: str(row.product_id),
      code: str(row.code),
      slug: str(row.slug),
      title: str(row.title),
      summary: strOrNull(row.summary),
      status: str(row.status),
      locale: str(row.locale),
      currentPublishedVersionId: strOrNull(row.current_published_version_id),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapProductContentVersion(row: Row): ProductContentVersion {
    return {
      id: str(row.id),
      presentationId: str(row.presentation_id),
      versionNumber: num(row.version_number),
      content: asJson(row.content, {}),
      status: str(row.status),
      publishedAt: asDateOrNull(row.published_at),
      publishedBy: strOrNull(row.published_by),
      immutableAfterPublish: bool(row.immutable_after_publish),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
    };
  }

  private mapSegmentPresentation(row: Row): SegmentPresentation {
    return {
      id: str(row.id),
      code: str(row.code),
      name: str(row.name),
      description: strOrNull(row.description),
      productPresentationId: strOrNull(row.product_presentation_id),
      status: str(row.status),
      targetingRules: asJson(row.targeting_rules, {}),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapPlanPresentation(row: Row): PlanPresentation {
    return {
      id: str(row.id),
      commercialPlanId: str(row.commercial_plan_id),
      productPresentationId: strOrNull(row.product_presentation_id),
      code: str(row.code),
      title: str(row.title),
      summary: strOrNull(row.summary),
      status: str(row.status),
      priceDisplayMode: str(row.price_display_mode),
      priceDisplayRef: strOrNull(row.price_display_ref),
      currencyHint: strOrNull(row.currency_hint),
      featuresDisplay: asJson(row.features_display, []),
      ctaLabel: strOrNull(row.cta_label),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapProspect(row: Row): Prospect {
    return {
      id: str(row.id),
      emailNormalized: str(row.email_normalized),
      displayName: strOrNull(row.display_name),
      companyName: strOrNull(row.company_name),
      status: str(row.status),
      commercialAccountId: strOrNull(row.commercial_account_id),
      productId: strOrNull(row.product_id),
      commercialPlanId: strOrNull(row.commercial_plan_id),
      planPresentationId: strOrNull(row.plan_presentation_id),
      locale: strOrNull(row.locale),
      country: strOrNull(row.country),
      sourceChannel: strOrNull(row.source_channel),
      metadata: asJson(row.metadata, {}),
      createdBy: strOrNull(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapLead(row: Row): AcquisitionLead {
    return {
      id: str(row.id),
      prospectId: strOrNull(row.prospect_id),
      emailNormalized: str(row.email_normalized),
      status: str(row.status),
      sourceType: str(row.source_type),
      sourceRef: strOrNull(row.source_ref),
      formPublicationId: strOrNull(row.form_publication_id),
      marketingLeadSoftRef: strOrNull(row.marketing_lead_soft_ref),
      score: numOrNull(row.score),
      scoreBand: strOrNull(row.score_band),
      attribution: asJson(row.attribution, {}),
      payload: asJson(row.payload, {}),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapLeadEvent(row: Row): AcquisitionLeadEvent {
    return {
      id: str(row.id),
      leadId: str(row.lead_id),
      eventType: str(row.event_type),
      body: asJson(row.body, {}),
      actorId: strOrNull(row.actor_id),
      createdAt: asDate(row.created_at),
    };
  }

  private mapFormSchema(row: Row): FormSchema {
    return {
      id: str(row.id),
      code: str(row.code),
      name: str(row.name),
      description: strOrNull(row.description),
      status: str(row.status),
      productId: strOrNull(row.product_id),
      commercialPlanId: strOrNull(row.commercial_plan_id),
      currentPublishedVersionId: strOrNull(row.current_published_version_id),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapFormVersion(row: Row): FormVersion {
    return {
      id: str(row.id),
      formSchemaId: str(row.form_schema_id),
      versionNumber: num(row.version_number),
      schemaDefinition: asJson(row.schema_definition, {}),
      conditionRules: asJson(row.condition_rules, []),
      status: str(row.status),
      publishedAt: asDateOrNull(row.published_at),
      publishedBy: strOrNull(row.published_by),
      immutableAfterPublish: bool(row.immutable_after_publish),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
    };
  }

  private mapFormPublication(row: Row): FormPublication {
    return {
      id: str(row.id),
      formSchemaId: str(row.form_schema_id),
      formVersionId: str(row.form_version_id),
      channel: str(row.channel),
      publicSlug: strOrNull(row.public_slug),
      status: str(row.status),
      publishedAt: asDate(row.published_at),
      publishedBy: str(row.published_by),
      expiresAt: asDateOrNull(row.expires_at),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
    };
  }

  private mapDocumentRequirement(row: Row): DocumentRequirement {
    return {
      id: str(row.id),
      code: str(row.code),
      name: str(row.name),
      description: strOrNull(row.description),
      formSchemaId: strOrNull(row.form_schema_id),
      documentType: str(row.document_type),
      required: bool(row.required),
      conditionRules: asJson(row.condition_rules, []),
      status: str(row.status),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  private mapApplication(row: Row): Application {
    return {
      id: str(row.id),
      applicationNumber: str(row.application_number),
      prospectId: str(row.prospect_id),
      leadId: strOrNull(row.lead_id),
      formSchemaId: str(row.form_schema_id),
      formVersionId: str(row.form_version_id),
      formPublicationId: strOrNull(row.form_publication_id),
      productId: strOrNull(row.product_id),
      commercialPlanId: strOrNull(row.commercial_plan_id),
      planPresentationId: strOrNull(row.plan_presentation_id),
      status: str(row.status),
      submittedAt: asDateOrNull(row.submitted_at),
      decidedAt: asDateOrNull(row.decided_at),
      decidedBy: strOrNull(row.decided_by),
      decisionReason: strOrNull(row.decision_reason),
      metadata: asJson(row.metadata, {}),
      createdBy: strOrNull(row.created_by),
      updatedBy: strOrNull(row.updated_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapApplicationAnswer(row: Row): ApplicationAnswer {
    return {
      id: str(row.id),
      applicationId: str(row.application_id),
      fieldKey: str(row.field_key),
      value: asJson(row.value, null),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  private mapApplicationEvent(row: Row): ApplicationEvent {
    return {
      id: str(row.id),
      applicationId: str(row.application_id),
      eventType: str(row.event_type),
      fromStatus: strOrNull(row.from_status),
      toStatus: strOrNull(row.to_status),
      body: asJson(row.body, {}),
      actorId: strOrNull(row.actor_id),
      createdAt: asDate(row.created_at),
    };
  }

  private mapDocumentReference(row: Row): DocumentReference {
    return {
      id: str(row.id),
      applicationId: str(row.application_id),
      requirementId: strOrNull(row.requirement_id),
      documentType: str(row.document_type),
      storageRef: str(row.storage_ref),
      fileName: strOrNull(row.file_name),
      contentType: strOrNull(row.content_type),
      checksumSha256: strOrNull(row.checksum_sha256),
      status: str(row.status),
      metadata: asJson(row.metadata, {}),
      uploadedBy: strOrNull(row.uploaded_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapDocumentReview(row: Row): DocumentReview {
    return {
      id: str(row.id),
      documentReferenceId: str(row.document_reference_id),
      decision: str(row.decision),
      reviewerId: str(row.reviewer_id),
      comments: strOrNull(row.comments),
      createdAt: asDate(row.created_at),
      metadata: asJson(row.metadata, {}),
    };
  }

  private mapQualification(row: Row): QualificationRecord {
    return {
      id: str(row.id),
      applicationId: str(row.application_id),
      status: str(row.status),
      outcomeSummary: strOrNull(row.outcome_summary),
      reviewerId: strOrNull(row.reviewer_id),
      approvedBy: strOrNull(row.approved_by),
      decidedAt: asDateOrNull(row.decided_at),
      criteria: asJson(row.criteria, {}),
      evidence: asJson(row.evidence, {}),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapReviewAssignment(row: Row): ReviewAssignment {
    return {
      id: str(row.id),
      applicationId: str(row.application_id),
      assigneeId: str(row.assignee_id),
      roleHint: str(row.role_hint),
      status: str(row.status),
      assignedBy: str(row.assigned_by),
      dueAt: asDateOrNull(row.due_at),
      completedAt: asDateOrNull(row.completed_at),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  private mapQuoteRequest(row: Row): QuoteRequest {
    return {
      id: str(row.id),
      applicationId: strOrNull(row.application_id),
      prospectId: str(row.prospect_id),
      commercialPlanId: strOrNull(row.commercial_plan_id),
      planPresentationId: strOrNull(row.plan_presentation_id),
      status: str(row.status),
      requestedBy: strOrNull(row.requested_by),
      notes: strOrNull(row.notes),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapQuoteReference(row: Row): QuoteReference {
    return {
      id: str(row.id),
      quoteRequestId: str(row.quote_request_id),
      externalQuoteRef: str(row.external_quote_ref),
      commercialSource: str(row.commercial_source),
      status: str(row.status),
      validUntil: asDateOrNull(row.valid_until),
      displaySummary: asJson(row.display_summary, {}),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
    };
  }

  private mapCheckoutSession(row: Row): CheckoutSession {
    return {
      id: str(row.id),
      applicationId: strOrNull(row.application_id),
      prospectId: str(row.prospect_id),
      planPresentationId: strOrNull(row.plan_presentation_id),
      commercialPlanId: strOrNull(row.commercial_plan_id),
      quoteReferenceId: strOrNull(row.quote_reference_id),
      status: str(row.status),
      billingSessionRef: strOrNull(row.billing_session_ref),
      idempotencyKey: str(row.idempotency_key),
      metadata: asJson(row.metadata, {}),
      createdBy: strOrNull(row.created_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapCheckoutEvent(row: Row): CheckoutEvent {
    return {
      id: str(row.id),
      checkoutSessionId: str(row.checkout_session_id),
      eventType: str(row.event_type),
      fromStatus: strOrNull(row.from_status),
      toStatus: strOrNull(row.to_status),
      externalRef: strOrNull(row.external_ref),
      body: asJson(row.body, {}),
      actorId: strOrNull(row.actor_id),
      createdAt: asDate(row.created_at),
    };
  }

  private mapSubscriptionHandoff(row: Row): SubscriptionHandoff {
    return {
      id: str(row.id),
      checkoutSessionId: strOrNull(row.checkout_session_id),
      applicationId: strOrNull(row.application_id),
      prospectId: str(row.prospect_id),
      commercialAccountId: strOrNull(row.commercial_account_id),
      commercialPlanId: strOrNull(row.commercial_plan_id),
      status: str(row.status),
      subscriptionRef: strOrNull(row.subscription_ref),
      externalEvidenceRef: strOrNull(row.external_evidence_ref),
      failureReason: strOrNull(row.failure_reason),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapJourneyDefinition(row: Row): JourneyDefinition {
    return {
      id: str(row.id),
      code: str(row.code),
      name: str(row.name),
      description: strOrNull(row.description),
      status: str(row.status),
      definition: asJson(row.definition, {}),
      metadata: asJson(row.metadata, {}),
      createdBy: str(row.created_by),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapJourneyInstance(row: Row): JourneyInstance {
    return {
      id: str(row.id),
      journeyDefinitionId: str(row.journey_definition_id),
      prospectId: strOrNull(row.prospect_id),
      applicationId: strOrNull(row.application_id),
      status: str(row.status),
      currentStepKey: strOrNull(row.current_step_key),
      context: asJson(row.context, {}),
      metadata: asJson(row.metadata, {}),
      startedAt: asDate(row.started_at),
      completedAt: asDateOrNull(row.completed_at),
      updatedAt: asDate(row.updated_at),
      version: num(row.version),
    };
  }

  private mapJourneyEvent(row: Row): JourneyEvent {
    return {
      id: str(row.id),
      journeyInstanceId: str(row.journey_instance_id),
      eventType: str(row.event_type),
      stepKey: strOrNull(row.step_key),
      body: asJson(row.body, {}),
      actorId: strOrNull(row.actor_id),
      createdAt: asDate(row.created_at),
    };
  }

  private mapCommunication(row: Row): AcquisitionCommunication {
    return {
      id: str(row.id),
      prospectId: strOrNull(row.prospect_id),
      applicationId: strOrNull(row.application_id),
      journeyInstanceId: strOrNull(row.journey_instance_id),
      channel: str(row.channel),
      templateRef: strOrNull(row.template_ref),
      status: str(row.status),
      providerRef: strOrNull(row.provider_ref),
      subject: strOrNull(row.subject),
      payload: asJson(row.payload, {}),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  private mapAnalyticsEvent(row: Row): AnalyticsEvent {
    return {
      id: str(row.id),
      eventName: str(row.event_name),
      prospectId: strOrNull(row.prospect_id),
      leadId: strOrNull(row.lead_id),
      applicationId: strOrNull(row.application_id),
      sessionKey: strOrNull(row.session_key),
      properties: asJson(row.properties, {}),
      occurredAt: asDate(row.occurred_at),
      createdAt: asDate(row.created_at),
    };
  }

  private mapAttribution(row: Row): AttributionRecord {
    return {
      id: str(row.id),
      prospectId: strOrNull(row.prospect_id),
      leadId: strOrNull(row.lead_id),
      channel: strOrNull(row.channel),
      campaignRef: strOrNull(row.campaign_ref),
      marketingSoftRef: strOrNull(row.marketing_soft_ref),
      utm: asJson(row.utm, {}),
      firstTouchAt: asDateOrNull(row.first_touch_at),
      lastTouchAt: asDateOrNull(row.last_touch_at),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  private mapAuditEvent(row: Row): AcquisitionAuditEvent {
    return {
      id: str(row.id),
      aggregateType: str(row.aggregate_type),
      aggregateId: str(row.aggregate_id),
      action: str(row.action),
      actorId: strOrNull(row.actor_id),
      beforeState: row.before_state == null ? null : asJson(row.before_state, {}),
      afterState: row.after_state == null ? null : asJson(row.after_state, {}),
      correlationId: strOrNull(row.correlation_id),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
    };
  }

  private mapIdempotency(row: Row): AcquisitionIdempotencyKey {
    return {
      id: str(row.id),
      scope: str(row.scope),
      idempotencyKey: str(row.idempotency_key),
      requestHash: strOrNull(row.request_hash),
      responseRef: strOrNull(row.response_ref),
      status: str(row.status),
      expiresAt: asDateOrNull(row.expires_at),
      metadata: asJson(row.metadata, {}),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    };
  }

  // --- Presentations ---

  async createProductPresentation(
    input: Parameters<AcquisitionRepositoryPort['createProductPresentation']>[0],
    client?: unknown,
  ): Promise<ProductPresentation> {
    const rows = await this.q(
      `INSERT INTO edge_p10_product_presentations (
         id, product_id, code, slug, title, summary, status, locale,
         current_published_version_id, metadata, created_by, updated_by, version
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, COALESCE($7, 'DRAFT'), COALESCE($8, 'en'),
         $9::uuid, COALESCE($10::jsonb, '{}'::jsonb), $11, $12, COALESCE($13, 1)
       ) RETURNING *`,
      [
        input.id ?? null,
        input.productId,
        input.code,
        input.slug,
        input.title,
        input.summary ?? null,
        input.status ?? null,
        input.locale ?? null,
        input.currentPublishedVersionId ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
        input.updatedBy ?? null,
        input.version ?? 1,
      ],
      client,
    );
    return this.mapProductPresentation(rows[0]!);
  }

  async getProductPresentation(id: string): Promise<ProductPresentation | null> {
    const rows = await this.q(`SELECT * FROM edge_p10_product_presentations WHERE id = $1`, [id]);
    return rows[0] ? this.mapProductPresentation(rows[0]) : null;
  }

  async getProductPresentationBySlug(slug: string): Promise<ProductPresentation | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p10_product_presentations WHERE slug = $1`,
      [slug],
    );
    return rows[0] ? this.mapProductPresentation(rows[0]) : null;
  }

  async listProductPresentations(
    filter?: AcquisitionListFilter,
  ): Promise<{ items: ProductPresentation[]; total: number }> {
    const { limit, offset } = this.bounds(filter);
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter?.productId) {
      params.push(filter.productId);
      where.push(`product_id = $${params.length}`);
    }
    if (filter?.q?.trim()) {
      params.push(`%${filter.q.trim()}%`);
      where.push(`(title ILIKE $${params.length} OR code ILIKE $${params.length} OR slug ILIKE $${params.length})`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p10_product_presentations ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p10_product_presentations ${clause}
       ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapProductPresentation(r)), total: num(countRows[0]?.c) };
  }

  /** Public catalog: PUBLISHED presentations only (display rows — never invent products). */
  async getPublicDiscoveryCatalog(
    filter?: AcquisitionListFilter,
  ): Promise<{ items: ProductPresentation[]; total: number }> {
    const { limit, offset } = this.bounds(filter);
    const where: string[] = [`p.status = 'PUBLISHED'`, `cv.status = 'PUBLISHED'`];
    const params: unknown[] = [];
    if (filter?.productId) {
      params.push(filter.productId);
      where.push(`p.product_id = $${params.length}`);
    }
    if (filter?.q?.trim()) {
      params.push(`%${filter.q.trim()}%`);
      where.push(
        `(p.title ILIKE $${params.length} OR p.code ILIKE $${params.length} OR p.slug ILIKE $${params.length})`,
      );
    }
    const clause = `WHERE ${where.join(' AND ')}`;
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c
       FROM edge_p10_product_presentations p
       INNER JOIN edge_p10_product_content_versions cv
         ON cv.id = p.current_published_version_id
       ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT p.*
       FROM edge_p10_product_presentations p
       INNER JOIN edge_p10_product_content_versions cv
         ON cv.id = p.current_published_version_id
       ${clause}
       ORDER BY p.title ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapProductPresentation(r)), total: num(countRows[0]?.c) };
  }

  async createProductContentVersion(
    input: Parameters<AcquisitionRepositoryPort['createProductContentVersion']>[0],
    client?: unknown,
  ): Promise<ProductContentVersion> {
    const rows = await this.q(
      `INSERT INTO edge_p10_product_content_versions (
         id, presentation_id, version_number, content, status, published_at, published_by,
         immutable_after_publish, metadata, created_by
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, COALESCE($4::jsonb, '{}'::jsonb),
         COALESCE($5, 'DRAFT'), $6, $7, COALESCE($8, TRUE), COALESCE($9::jsonb, '{}'::jsonb), $10
       ) RETURNING *`,
      [
        input.id ?? null,
        input.presentationId,
        input.versionNumber,
        JSON.stringify(input.content ?? {}),
        input.status ?? null,
        input.publishedAt ?? null,
        input.publishedBy ?? null,
        input.immutableAfterPublish ?? true,
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
      client,
    );
    return this.mapProductContentVersion(rows[0]!);
  }

  async publishProductContentVersion(
    id: string,
    publishedBy: string,
    client?: unknown,
  ): Promise<ProductContentVersion> {
    const existing = await this.q(
      `SELECT * FROM edge_p10_product_content_versions WHERE id = $1`,
      [id],
      client,
    );
    if (!existing[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Product content version not found');
    }
    const current = this.mapProductContentVersion(existing[0]);
    if (current.status !== 'DRAFT') {
      throw new DomainError(
        ErrorCode.CONFLICT,
        `Product content version status ${current.status} cannot be published`,
      );
    }

    await this.q(
      `UPDATE edge_p10_product_content_versions SET status = 'SUPERSEDED'
       WHERE presentation_id = $1 AND status = 'PUBLISHED' AND id <> $2`,
      [current.presentationId, id],
      client,
    );

    const rows = await this.q(
      `UPDATE edge_p10_product_content_versions SET
         status = 'PUBLISHED',
         published_at = NOW(),
         published_by = $2
       WHERE id = $1 AND status = 'DRAFT'
       RETURNING *`,
      [id, publishedBy],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.CONFLICT, 'Product content version publish conflict');
    }

    await this.q(
      `UPDATE edge_p10_product_presentations SET
         current_published_version_id = $2,
         status = CASE WHEN status = 'DRAFT' THEN 'PUBLISHED' ELSE status END,
         updated_at = NOW(),
         version = version + 1
       WHERE id = $1`,
      [current.presentationId, id],
      client,
    );

    return this.mapProductContentVersion(rows[0]);
  }

  async createSegmentPresentation(
    input: Parameters<AcquisitionRepositoryPort['createSegmentPresentation']>[0],
    client?: unknown,
  ): Promise<SegmentPresentation> {
    const rows = await this.q(
      `INSERT INTO edge_p10_segment_presentations (
         id, code, name, description, product_presentation_id, status,
         targeting_rules, metadata, created_by, updated_by, version
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5::uuid, COALESCE($6, 'DRAFT'),
         COALESCE($7::jsonb, '{}'::jsonb), COALESCE($8::jsonb, '{}'::jsonb), $9, $10, COALESCE($11, 1)
       ) RETURNING *`,
      [
        input.id ?? null,
        input.code,
        input.name,
        input.description ?? null,
        input.productPresentationId ?? null,
        input.status ?? null,
        JSON.stringify(input.targetingRules ?? {}),
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
        input.updatedBy ?? null,
        input.version ?? 1,
      ],
      client,
    );
    return this.mapSegmentPresentation(rows[0]!);
  }

  async listSegmentPresentations(
    filter?: AcquisitionListFilter,
  ): Promise<{ items: SegmentPresentation[]; total: number }> {
    const { limit, offset } = this.bounds(filter);
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter?.productPresentationId) {
      params.push(filter.productPresentationId);
      where.push(`product_presentation_id = $${params.length}`);
    }
    if (filter?.q?.trim()) {
      params.push(`%${filter.q.trim()}%`);
      where.push(`(name ILIKE $${params.length} OR code ILIKE $${params.length})`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p10_segment_presentations ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p10_segment_presentations ${clause}
       ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapSegmentPresentation(r)), total: num(countRows[0]?.c) };
  }

  async createPlanPresentation(
    input: Parameters<AcquisitionRepositoryPort['createPlanPresentation']>[0],
    client?: unknown,
  ): Promise<PlanPresentation> {
    const rows = await this.q(
      `INSERT INTO edge_p10_plan_presentations (
         id, commercial_plan_id, product_presentation_id, code, title, summary, status,
         price_display_mode, price_display_ref, currency_hint, features_display, cta_label,
         metadata, created_by, updated_by, version
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3::uuid, $4, $5, $6, COALESCE($7, 'DRAFT'),
         COALESCE($8, 'INDICATIVE'), $9, $10, COALESCE($11::jsonb, '[]'::jsonb), $12,
         COALESCE($13::jsonb, '{}'::jsonb), $14, $15, COALESCE($16, 1)
       ) RETURNING *`,
      [
        input.id ?? null,
        input.commercialPlanId,
        input.productPresentationId ?? null,
        input.code,
        input.title,
        input.summary ?? null,
        input.status ?? null,
        input.priceDisplayMode ?? null,
        input.priceDisplayRef ?? null,
        input.currencyHint ?? null,
        JSON.stringify(input.featuresDisplay ?? []),
        input.ctaLabel ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
        input.updatedBy ?? null,
        input.version ?? 1,
      ],
      client,
    );
    return this.mapPlanPresentation(rows[0]!);
  }

  async getPlanPresentation(id: string): Promise<PlanPresentation | null> {
    const rows = await this.q(`SELECT * FROM edge_p10_plan_presentations WHERE id = $1`, [id]);
    return rows[0] ? this.mapPlanPresentation(rows[0]) : null;
  }

  async listPlanPresentations(
    filter?: AcquisitionListFilter,
  ): Promise<{ items: PlanPresentation[]; total: number }> {
    const { limit, offset } = this.bounds(filter);
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter?.productPresentationId) {
      params.push(filter.productPresentationId);
      where.push(`product_presentation_id = $${params.length}`);
    }
    if (filter?.q?.trim()) {
      params.push(`%${filter.q.trim()}%`);
      where.push(`(title ILIKE $${params.length} OR code ILIKE $${params.length})`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p10_plan_presentations ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p10_plan_presentations ${clause}
       ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapPlanPresentation(r)), total: num(countRows[0]?.c) };
  }

  // --- Prospects / leads ---

  async createProspect(
    input: Parameters<AcquisitionRepositoryPort['createProspect']>[0],
    client?: unknown,
  ): Promise<Prospect> {
    const rows = await this.q(
      `INSERT INTO edge_p10_prospects (
         id, email_normalized, display_name, company_name, status, commercial_account_id,
         product_id, commercial_plan_id, plan_presentation_id, locale, country, source_channel,
         metadata, created_by, updated_by, version
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, COALESCE($5, 'NEW'), $6::uuid,
         $7::uuid, $8::uuid, $9::uuid, $10, $11, $12,
         COALESCE($13::jsonb, '{}'::jsonb), $14, $15, COALESCE($16, 1)
       ) RETURNING *`,
      [
        input.id ?? null,
        input.emailNormalized,
        input.displayName ?? null,
        input.companyName ?? null,
        input.status ?? null,
        input.commercialAccountId ?? null,
        input.productId ?? null,
        input.commercialPlanId ?? null,
        input.planPresentationId ?? null,
        input.locale ?? null,
        input.country ?? null,
        input.sourceChannel ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.createdBy ?? null,
        input.updatedBy ?? null,
        input.version ?? 1,
      ],
      client,
    );
    return this.mapProspect(rows[0]!);
  }

  async getProspect(id: string): Promise<Prospect | null> {
    const rows = await this.q(`SELECT * FROM edge_p10_prospects WHERE id = $1`, [id]);
    return rows[0] ? this.mapProspect(rows[0]) : null;
  }

  async listProspects(
    filter?: AcquisitionListFilter & { emailNormalized?: string },
  ): Promise<{ items: Prospect[]; total: number }> {
    const { limit, offset } = this.bounds(filter);
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter?.productId) {
      params.push(filter.productId);
      where.push(`product_id = $${params.length}`);
    }
    if (filter?.emailNormalized) {
      params.push(filter.emailNormalized);
      where.push(`email_normalized = $${params.length}`);
    }
    if (filter?.q?.trim()) {
      params.push(`%${filter.q.trim()}%`);
      where.push(
        `(email_normalized ILIKE $${params.length} OR display_name ILIKE $${params.length} OR company_name ILIKE $${params.length})`,
      );
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p10_prospects ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p10_prospects ${clause}
       ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapProspect(r)), total: num(countRows[0]?.c) };
  }

  async transitionProspect(
    id: string,
    toStatus: string,
    patch?: Partial<Prospect> & { expectedVersion?: number },
    client?: unknown,
  ): Promise<Prospect> {
    const params: unknown[] = [
      id,
      toStatus,
      patch?.displayName ?? null,
      patch?.companyName ?? null,
      patch?.commercialAccountId ?? null,
      patch?.productId ?? null,
      patch?.commercialPlanId ?? null,
      patch?.planPresentationId ?? null,
      patch?.locale ?? null,
      patch?.country ?? null,
      patch?.sourceChannel ?? null,
      patch?.metadata != null ? JSON.stringify(patch.metadata) : null,
      patch?.updatedBy ?? null,
    ];
    let versionClause = '';
    if (patch?.expectedVersion != null) {
      params.push(patch.expectedVersion);
      versionClause = ` AND version = $${params.length}`;
    }
    const rows = await this.q(
      `UPDATE edge_p10_prospects SET
         status = $2,
         display_name = COALESCE($3, display_name),
         company_name = COALESCE($4, company_name),
         commercial_account_id = COALESCE($5::uuid, commercial_account_id),
         product_id = COALESCE($6::uuid, product_id),
         commercial_plan_id = COALESCE($7::uuid, commercial_plan_id),
         plan_presentation_id = COALESCE($8::uuid, plan_presentation_id),
         locale = COALESCE($9, locale),
         country = COALESCE($10, country),
         source_channel = COALESCE($11, source_channel),
         metadata = COALESCE($12::jsonb, metadata),
         updated_by = COALESCE($13, updated_by),
         updated_at = NOW(),
         version = version + 1
       WHERE id = $1${versionClause}
       RETURNING *`,
      params,
      client,
    );
    if (!rows[0]) {
      return this.throwTransitionMiss(
        'edge_p10_prospects',
        id,
        patch?.expectedVersion,
        'Prospect',
        client,
      );
    }
    return this.mapProspect(rows[0]);
  }

  async createLead(
    input: Parameters<AcquisitionRepositoryPort['createLead']>[0],
    client?: unknown,
  ): Promise<AcquisitionLead> {
    const rows = await this.q(
      `INSERT INTO edge_p10_acquisition_leads (
         id, prospect_id, email_normalized, status, source_type, source_ref,
         form_publication_id, marketing_lead_soft_ref, score, score_band,
         attribution, payload, metadata, version
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3, COALESCE($4, 'CAPTURED'), COALESCE($5, 'FORM'), $6,
         $7::uuid, $8::uuid, $9, $10,
         COALESCE($11::jsonb, '{}'::jsonb), COALESCE($12::jsonb, '{}'::jsonb),
         COALESCE($13::jsonb, '{}'::jsonb), COALESCE($14, 1)
       ) RETURNING *`,
      [
        input.id ?? null,
        input.prospectId ?? null,
        input.emailNormalized,
        input.status ?? null,
        input.sourceType ?? null,
        input.sourceRef ?? null,
        input.formPublicationId ?? null,
        input.marketingLeadSoftRef ?? null,
        input.score ?? null,
        input.scoreBand ?? null,
        JSON.stringify(input.attribution ?? {}),
        JSON.stringify(input.payload ?? {}),
        JSON.stringify(input.metadata ?? {}),
        input.version ?? 1,
      ],
      client,
    );
    return this.mapLead(rows[0]!);
  }

  async getLead(id: string): Promise<AcquisitionLead | null> {
    const rows = await this.q(`SELECT * FROM edge_p10_acquisition_leads WHERE id = $1`, [id]);
    return rows[0] ? this.mapLead(rows[0]) : null;
  }

  async listLeads(
    filter?: AcquisitionListFilter & { emailNormalized?: string },
  ): Promise<{ items: AcquisitionLead[]; total: number }> {
    const { limit, offset } = this.bounds(filter);
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter?.prospectId) {
      params.push(filter.prospectId);
      where.push(`prospect_id = $${params.length}`);
    }
    if (filter?.emailNormalized) {
      params.push(filter.emailNormalized);
      where.push(`email_normalized = $${params.length}`);
    }
    if (filter?.q?.trim()) {
      params.push(`%${filter.q.trim()}%`);
      where.push(`email_normalized ILIKE $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p10_acquisition_leads ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p10_acquisition_leads ${clause}
       ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapLead(r)), total: num(countRows[0]?.c) };
  }

  async addLeadEvent(
    input: Omit<AcquisitionLeadEvent, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<AcquisitionLeadEvent> {
    const rows = await this.q(
      `INSERT INTO edge_p10_acquisition_lead_events (id, lead_id, event_type, body, actor_id)
       VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, COALESCE($4::jsonb, '{}'::jsonb), $5)
       RETURNING *`,
      [
        input.id ?? null,
        input.leadId,
        input.eventType,
        JSON.stringify(input.body ?? {}),
        input.actorId ?? null,
      ],
      client,
    );
    return this.mapLeadEvent(rows[0]!);
  }

  async promoteLeadToProspect(
    leadId: string,
    prospectId: string,
    client?: unknown,
  ): Promise<AcquisitionLead> {
    const rows = await this.q(
      `UPDATE edge_p10_acquisition_leads SET
         prospect_id = $2,
         status = 'PROMOTED',
         updated_at = NOW(),
         version = version + 1
       WHERE id = $1
       RETURNING *`,
      [leadId, prospectId],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Lead not found');
    }
    return this.mapLead(rows[0]);
  }

  async updateLead(
    id: string,
    patch: Partial<AcquisitionLead> & { expectedVersion?: number },
    client?: unknown,
  ): Promise<AcquisitionLead> {
    const params: unknown[] = [
      id,
      patch.status ?? null,
      patch.prospectId ?? null,
      patch.emailNormalized ?? null,
      patch.sourceType ?? null,
      patch.sourceRef ?? null,
      patch.formPublicationId ?? null,
      patch.marketingLeadSoftRef ?? null,
      patch.score ?? null,
      patch.scoreBand ?? null,
      patch.attribution != null ? JSON.stringify(patch.attribution) : null,
      patch.payload != null ? JSON.stringify(patch.payload) : null,
      patch.metadata != null ? JSON.stringify(patch.metadata) : null,
    ];
    let versionClause = '';
    if (patch.expectedVersion != null) {
      params.push(patch.expectedVersion);
      versionClause = ` AND version = $${params.length}`;
    }
    const rows = await this.q(
      `UPDATE edge_p10_acquisition_leads SET
         status = COALESCE($2, status),
         prospect_id = COALESCE($3::uuid, prospect_id),
         email_normalized = COALESCE($4, email_normalized),
         source_type = COALESCE($5, source_type),
         source_ref = COALESCE($6, source_ref),
         form_publication_id = COALESCE($7::uuid, form_publication_id),
         marketing_lead_soft_ref = COALESCE($8::uuid, marketing_lead_soft_ref),
         score = COALESCE($9, score),
         score_band = COALESCE($10, score_band),
         attribution = COALESCE($11::jsonb, attribution),
         payload = COALESCE($12::jsonb, payload),
         metadata = COALESCE($13::jsonb, metadata),
         updated_at = NOW(),
         version = version + 1
       WHERE id = $1${versionClause}
       RETURNING *`,
      params,
      client,
    );
    if (!rows[0]) {
      return this.throwTransitionMiss(
        'edge_p10_acquisition_leads',
        id,
        patch.expectedVersion,
        'Lead',
        client,
      );
    }
    return this.mapLead(rows[0]);
  }

  // --- Forms ---

  async createFormSchema(
    input: Parameters<AcquisitionRepositoryPort['createFormSchema']>[0],
    client?: unknown,
  ): Promise<FormSchema> {
    const rows = await this.q(
      `INSERT INTO edge_p10_form_schemas (
         id, code, name, description, status, product_id, commercial_plan_id,
         current_published_version_id, metadata, created_by, updated_by, version
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, COALESCE($5, 'DRAFT'), $6::uuid, $7::uuid,
         $8::uuid, COALESCE($9::jsonb, '{}'::jsonb), $10, $11, COALESCE($12, 1)
       ) RETURNING *`,
      [
        input.id ?? null,
        input.code,
        input.name,
        input.description ?? null,
        input.status ?? null,
        input.productId ?? null,
        input.commercialPlanId ?? null,
        input.currentPublishedVersionId ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
        input.updatedBy ?? null,
        input.version ?? 1,
      ],
      client,
    );
    return this.mapFormSchema(rows[0]!);
  }

  async getFormSchema(id: string): Promise<FormSchema | null> {
    const rows = await this.q(`SELECT * FROM edge_p10_form_schemas WHERE id = $1`, [id]);
    return rows[0] ? this.mapFormSchema(rows[0]) : null;
  }

  async listFormSchemas(
    filter?: AcquisitionListFilter,
  ): Promise<{ items: FormSchema[]; total: number }> {
    const { limit, offset } = this.bounds(filter);
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter?.productId) {
      params.push(filter.productId);
      where.push(`product_id = $${params.length}`);
    }
    if (filter?.q?.trim()) {
      params.push(`%${filter.q.trim()}%`);
      where.push(`(name ILIKE $${params.length} OR code ILIKE $${params.length})`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p10_form_schemas ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p10_form_schemas ${clause}
       ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapFormSchema(r)), total: num(countRows[0]?.c) };
  }

  async createFormVersion(
    input: Parameters<AcquisitionRepositoryPort['createFormVersion']>[0],
    client?: unknown,
  ): Promise<FormVersion> {
    const rows = await this.q(
      `INSERT INTO edge_p10_form_versions (
         id, form_schema_id, version_number, schema_definition, condition_rules, status,
         published_at, published_by, immutable_after_publish, metadata, created_by
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, COALESCE($4::jsonb, '{}'::jsonb),
         COALESCE($5::jsonb, '[]'::jsonb), COALESCE($6, 'DRAFT'), $7, $8, COALESCE($9, TRUE),
         COALESCE($10::jsonb, '{}'::jsonb), $11
       ) RETURNING *`,
      [
        input.id ?? null,
        input.formSchemaId,
        input.versionNumber,
        JSON.stringify(input.schemaDefinition ?? {}),
        JSON.stringify(input.conditionRules ?? []),
        input.status ?? null,
        input.publishedAt ?? null,
        input.publishedBy ?? null,
        input.immutableAfterPublish ?? true,
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
      ],
      client,
    );
    return this.mapFormVersion(rows[0]!);
  }

  async getFormVersion(id: string): Promise<FormVersion | null> {
    const rows = await this.q(`SELECT * FROM edge_p10_form_versions WHERE id = $1`, [id]);
    return rows[0] ? this.mapFormVersion(rows[0]) : null;
  }

  async publishFormVersion(
    id: string,
    publishedBy: string,
    client?: unknown,
  ): Promise<FormVersion> {
    const existing = await this.q(
      `SELECT * FROM edge_p10_form_versions WHERE id = $1`,
      [id],
      client,
    );
    if (!existing[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Form version not found');
    }
    const current = this.mapFormVersion(existing[0]);
    if (current.status !== 'DRAFT') {
      throw new DomainError(
        ErrorCode.CONFLICT,
        `Form version status ${current.status} cannot be published`,
      );
    }

    await this.q(
      `UPDATE edge_p10_form_versions SET status = 'SUPERSEDED'
       WHERE form_schema_id = $1 AND status = 'PUBLISHED' AND id <> $2`,
      [current.formSchemaId, id],
      client,
    );

    const rows = await this.q(
      `UPDATE edge_p10_form_versions SET
         status = 'PUBLISHED',
         published_at = NOW(),
         published_by = $2
       WHERE id = $1 AND status = 'DRAFT'
       RETURNING *`,
      [id, publishedBy],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.CONFLICT, 'Form version publish conflict');
    }

    await this.q(
      `UPDATE edge_p10_form_schemas SET
         current_published_version_id = $2,
         status = CASE WHEN status = 'DRAFT' THEN 'ACTIVE' ELSE status END,
         updated_at = NOW(),
         version = version + 1
       WHERE id = $1`,
      [current.formSchemaId, id],
      client,
    );

    return this.mapFormVersion(rows[0]);
  }

  async createFormPublication(
    input: Parameters<AcquisitionRepositoryPort['createFormPublication']>[0],
    client?: unknown,
  ): Promise<FormPublication> {
    const rows = await this.q(
      `INSERT INTO edge_p10_form_publications (
         id, form_schema_id, form_version_id, channel, public_slug, status,
         published_at, published_by, expires_at, metadata
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, COALESCE($4, 'PUBLIC_WEB'), $5, COALESCE($6, 'ACTIVE'),
         COALESCE($7, NOW()), $8, $9, COALESCE($10::jsonb, '{}'::jsonb)
       ) RETURNING *`,
      [
        input.id ?? null,
        input.formSchemaId,
        input.formVersionId,
        input.channel ?? null,
        input.publicSlug ?? null,
        input.status ?? null,
        input.publishedAt ?? null,
        input.publishedBy,
        input.expiresAt ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
      client,
    );
    return this.mapFormPublication(rows[0]!);
  }

  async getFormPublicationBySlug(publicSlug: string): Promise<FormPublication | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p10_form_publications WHERE public_slug = $1`,
      [publicSlug],
    );
    return rows[0] ? this.mapFormPublication(rows[0]) : null;
  }

  async getFormPublication(id: string): Promise<FormPublication | null> {
    const rows = await this.q(`SELECT * FROM edge_p10_form_publications WHERE id = $1`, [id]);
    return rows[0] ? this.mapFormPublication(rows[0]) : null;
  }

  async listFormPublications(filter?: {
    formSchemaId?: string;
    channel?: string;
    status?: string;
  }): Promise<FormPublication[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter?.formSchemaId) {
      params.push(filter.formSchemaId);
      where.push(`form_schema_id = $${params.length}`);
    }
    if (filter?.channel) {
      params.push(filter.channel);
      where.push(`channel = $${params.length}`);
    }
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.q(
      `SELECT * FROM edge_p10_form_publications ${clause} ORDER BY published_at DESC LIMIT 200`,
      params,
    );
    return rows.map((r) => this.mapFormPublication(r));
  }

  async createDocumentRequirement(
    input: Omit<DocumentRequirement, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<DocumentRequirement> {
    const rows = await this.q(
      `INSERT INTO edge_p10_document_requirements (
         id, code, name, description, form_schema_id, document_type, required,
         condition_rules, status, metadata
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5::uuid, $6, COALESCE($7, TRUE),
         COALESCE($8::jsonb, '[]'::jsonb), COALESCE($9, 'ACTIVE'), COALESCE($10::jsonb, '{}'::jsonb)
       ) RETURNING *`,
      [
        input.id ?? null,
        input.code,
        input.name,
        input.description ?? null,
        input.formSchemaId ?? null,
        input.documentType,
        input.required,
        JSON.stringify(input.conditionRules ?? []),
        input.status ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
      client,
    );
    return this.mapDocumentRequirement(rows[0]!);
  }

  async listDocumentRequirements(formSchemaId?: string): Promise<DocumentRequirement[]> {
    const rows = formSchemaId
      ? await this.q(
          `SELECT * FROM edge_p10_document_requirements WHERE form_schema_id = $1 ORDER BY code`,
          [formSchemaId],
        )
      : await this.q(`SELECT * FROM edge_p10_document_requirements ORDER BY code LIMIT 200`);
    return rows.map((r) => this.mapDocumentRequirement(r));
  }

  // --- Applications ---

  async createApplication(
    input: Parameters<AcquisitionRepositoryPort['createApplication']>[0],
    client?: unknown,
  ): Promise<Application> {
    const applicationNumber = input.applicationNumber ?? numbered('APP');
    const rows = await this.q(
      `INSERT INTO edge_p10_applications (
         id, application_number, prospect_id, lead_id, form_schema_id, form_version_id,
         form_publication_id, product_id, commercial_plan_id, plan_presentation_id, status,
         submitted_at, metadata, created_by, version
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4::uuid, $5, $6,
         $7::uuid, $8::uuid, $9::uuid, $10::uuid, COALESCE($11, 'DRAFT'),
         $12, COALESCE($13::jsonb, '{}'::jsonb), $14, COALESCE($15, 1)
       ) RETURNING *`,
      [
        input.id ?? null,
        applicationNumber,
        input.prospectId,
        input.leadId ?? null,
        input.formSchemaId,
        input.formVersionId,
        input.formPublicationId ?? null,
        input.productId ?? null,
        input.commercialPlanId ?? null,
        input.planPresentationId ?? null,
        input.status ?? null,
        input.submittedAt ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.createdBy ?? null,
        input.version ?? 1,
      ],
      client,
    );
    return this.mapApplication(rows[0]!);
  }

  async getApplication(id: string): Promise<Application | null> {
    const rows = await this.q(`SELECT * FROM edge_p10_applications WHERE id = $1`, [id]);
    return rows[0] ? this.mapApplication(rows[0]) : null;
  }

  async listApplications(
    filter?: AcquisitionListFilter,
  ): Promise<{ items: Application[]; total: number }> {
    const { limit, offset } = this.bounds(filter);
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter?.prospectId) {
      params.push(filter.prospectId);
      where.push(`prospect_id = $${params.length}`);
    }
    if (filter?.productId) {
      params.push(filter.productId);
      where.push(`product_id = $${params.length}`);
    }
    if (filter?.q?.trim()) {
      params.push(`%${filter.q.trim()}%`);
      where.push(`application_number ILIKE $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p10_applications ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p10_applications ${clause}
       ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapApplication(r)), total: num(countRows[0]?.c) };
  }

  async transitionApplication(
    id: string,
    toStatus: string,
    patch?: Partial<Application> & { expectedVersion?: number },
    actorId?: string | null,
    client?: unknown,
  ): Promise<Application> {
    const params: unknown[] = [
      id,
      toStatus,
      actorId ?? patch?.updatedBy ?? null,
      patch?.decisionReason ?? null,
      patch?.decidedBy ?? null,
      patch?.decidedAt ?? null,
      patch?.submittedAt ?? null,
      patch?.metadata != null ? JSON.stringify(patch.metadata) : null,
      patch?.productId ?? null,
      patch?.commercialPlanId ?? null,
      patch?.planPresentationId ?? null,
    ];
    let versionClause = '';
    if (patch?.expectedVersion != null) {
      params.push(patch.expectedVersion);
      versionClause = ` AND version = $${params.length}`;
    }
    const rows = await this.q(
      `UPDATE edge_p10_applications SET
         status = $2,
         updated_by = COALESCE($3, updated_by),
         decision_reason = COALESCE($4, decision_reason),
         decided_by = CASE
           WHEN $2 IN ('APPROVED','REJECTED') THEN COALESCE($5, $3, decided_by)
           ELSE COALESCE($5, decided_by)
         END,
         decided_at = CASE
           WHEN $2 IN ('APPROVED','REJECTED') THEN COALESCE($6, decided_at, NOW())
           ELSE COALESCE($6, decided_at)
         END,
         submitted_at = CASE
           WHEN $2 = 'SUBMITTED' THEN COALESCE($7, submitted_at, NOW())
           ELSE COALESCE($7, submitted_at)
         END,
         metadata = COALESCE($8::jsonb, metadata),
         product_id = COALESCE($9::uuid, product_id),
         commercial_plan_id = COALESCE($10::uuid, commercial_plan_id),
         plan_presentation_id = COALESCE($11::uuid, plan_presentation_id),
         updated_at = NOW(),
         version = version + 1
       WHERE id = $1${versionClause}
       RETURNING *`,
      params,
      client,
    );
    if (!rows[0]) {
      return this.throwTransitionMiss(
        'edge_p10_applications',
        id,
        patch?.expectedVersion,
        'Application',
        client,
      );
    }
    return this.mapApplication(rows[0]);
  }

  async touchApplication(
    id: string,
    expectedVersion?: number,
    client?: unknown,
  ): Promise<Application> {
    const params: unknown[] = [id];
    let versionClause = '';
    if (expectedVersion != null) {
      params.push(expectedVersion);
      versionClause = ` AND version = $${params.length}`;
    }
    const rows = await this.q(
      `UPDATE edge_p10_applications SET
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1${versionClause}
       RETURNING *`,
      params,
      client,
    );
    if (!rows[0]) {
      return this.throwTransitionMiss(
        'edge_p10_applications',
        id,
        expectedVersion,
        'Application',
        client,
      );
    }
    return this.mapApplication(rows[0]);
  }

  async upsertApplicationAnswer(
    input: Omit<ApplicationAnswer, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<ApplicationAnswer> {
    const rows = await this.q(
      `INSERT INTO edge_p10_application_answers (
         id, application_id, field_key, value, metadata
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, COALESCE($4::jsonb, 'null'::jsonb),
         COALESCE($5::jsonb, '{}'::jsonb)
       )
       ON CONFLICT (application_id, field_key) DO UPDATE SET
         value = EXCLUDED.value,
         metadata = EXCLUDED.metadata,
         updated_at = NOW()
       RETURNING *`,
      [
        input.id ?? null,
        input.applicationId,
        input.fieldKey,
        JSON.stringify(input.value ?? null),
        JSON.stringify(input.metadata ?? {}),
      ],
      client,
    );
    return this.mapApplicationAnswer(rows[0]!);
  }

  async listApplicationAnswers(applicationId: string): Promise<ApplicationAnswer[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p10_application_answers WHERE application_id = $1 ORDER BY field_key`,
      [applicationId],
    );
    return rows.map((r) => this.mapApplicationAnswer(r));
  }

  async addApplicationEvent(
    input: Omit<ApplicationEvent, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<ApplicationEvent> {
    const rows = await this.q(
      `INSERT INTO edge_p10_application_events (
         id, application_id, event_type, from_status, to_status, body, actor_id
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, COALESCE($6::jsonb, '{}'::jsonb), $7
       ) RETURNING *`,
      [
        input.id ?? null,
        input.applicationId,
        input.eventType,
        input.fromStatus ?? null,
        input.toStatus ?? null,
        JSON.stringify(input.body ?? {}),
        input.actorId ?? null,
      ],
      client,
    );
    return this.mapApplicationEvent(rows[0]!);
  }

  // --- Documents / qualification / reviews ---

  async getDocumentReference(id: string): Promise<DocumentReference | null> {
    const rows = await this.q(`SELECT * FROM edge_p10_document_references WHERE id = $1`, [id]);
    return rows[0] ? this.mapDocumentReference(rows[0]) : null;
  }

  async listDocumentReferences(
    filter?: AcquisitionListFilter,
  ): Promise<{ items: DocumentReference[]; total: number }> {
    const { limit, offset } = this.bounds(filter);
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter?.applicationId) {
      params.push(filter.applicationId);
      where.push(`application_id = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p10_document_references ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p10_document_references ${clause}
       ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return {
      items: rows.map((r) => this.mapDocumentReference(r)),
      total: num(countRows[0]?.c),
    };
  }

  async createDocumentReference(
    input: Parameters<AcquisitionRepositoryPort['createDocumentReference']>[0],
    client?: unknown,
  ): Promise<DocumentReference> {
    const rows = await this.q(
      `INSERT INTO edge_p10_document_references (
         id, application_id, requirement_id, document_type, storage_ref, file_name,
         content_type, checksum_sha256, status, metadata, uploaded_by, version
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3::uuid, $4, $5, $6,
         $7, $8, COALESCE($9, 'UPLOADED'), COALESCE($10::jsonb, '{}'::jsonb), $11, COALESCE($12, 1)
       ) RETURNING *`,
      [
        input.id ?? null,
        input.applicationId,
        input.requirementId ?? null,
        input.documentType,
        input.storageRef,
        input.fileName ?? null,
        input.contentType ?? null,
        input.checksumSha256 ?? null,
        input.status ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.uploadedBy ?? null,
        input.version ?? 1,
      ],
      client,
    );
    return this.mapDocumentReference(rows[0]!);
  }

  async transitionDocumentReference(
    id: string,
    toStatus: string,
    patch?: Partial<DocumentReference> & { expectedVersion?: number },
    client?: unknown,
  ): Promise<DocumentReference> {
    const params: unknown[] = [
      id,
      toStatus,
      patch?.metadata != null ? JSON.stringify(patch.metadata) : null,
      patch?.storageRef ?? null,
      patch?.fileName ?? null,
      patch?.contentType ?? null,
      patch?.checksumSha256 ?? null,
    ];
    let versionClause = '';
    if (patch?.expectedVersion != null) {
      params.push(patch.expectedVersion);
      versionClause = ` AND version = $${params.length}`;
    }
    const rows = await this.q(
      `UPDATE edge_p10_document_references SET
         status = $2,
         metadata = COALESCE($3::jsonb, metadata),
         storage_ref = COALESCE($4, storage_ref),
         file_name = COALESCE($5, file_name),
         content_type = COALESCE($6, content_type),
         checksum_sha256 = COALESCE($7, checksum_sha256),
         updated_at = NOW(),
         version = version + 1
       WHERE id = $1${versionClause}
       RETURNING *`,
      params,
      client,
    );
    if (!rows[0]) {
      return this.throwTransitionMiss(
        'edge_p10_document_references',
        id,
        patch?.expectedVersion,
        'Document reference',
        client,
      );
    }
    return this.mapDocumentReference(rows[0]);
  }

  async createDocumentReview(
    input: Omit<DocumentReview, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<DocumentReview> {
    const rows = await this.q(
      `INSERT INTO edge_p10_document_reviews (
         id, document_reference_id, decision, reviewer_id, comments, metadata
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, COALESCE($6::jsonb, '{}'::jsonb)
       ) RETURNING *`,
      [
        input.id ?? null,
        input.documentReferenceId,
        input.decision,
        input.reviewerId,
        input.comments ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
      client,
    );
    return this.mapDocumentReview(rows[0]!);
  }

  async upsertQualification(
    input: Parameters<AcquisitionRepositoryPort['upsertQualification']>[0],
    client?: unknown,
  ): Promise<QualificationRecord> {
    const rows = await this.q(
      `INSERT INTO edge_p10_qualification_records (
         id, application_id, status, outcome_summary, reviewer_id, approved_by, decided_at,
         criteria, evidence, metadata, version
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, COALESCE($3, 'PENDING'), $4, $5, $6, $7,
         COALESCE($8::jsonb, '{}'::jsonb), COALESCE($9::jsonb, '{}'::jsonb),
         COALESCE($10::jsonb, '{}'::jsonb), COALESCE($11, 1)
       )
       ON CONFLICT (application_id) DO UPDATE SET
         status = EXCLUDED.status,
         outcome_summary = COALESCE(EXCLUDED.outcome_summary, edge_p10_qualification_records.outcome_summary),
         reviewer_id = COALESCE(EXCLUDED.reviewer_id, edge_p10_qualification_records.reviewer_id),
         approved_by = COALESCE(EXCLUDED.approved_by, edge_p10_qualification_records.approved_by),
         decided_at = COALESCE(EXCLUDED.decided_at, edge_p10_qualification_records.decided_at),
         criteria = EXCLUDED.criteria,
         evidence = EXCLUDED.evidence,
         metadata = EXCLUDED.metadata,
         updated_at = NOW(),
         version = edge_p10_qualification_records.version + 1
       RETURNING *`,
      [
        input.id ?? null,
        input.applicationId,
        input.status ?? null,
        input.outcomeSummary ?? null,
        input.reviewerId ?? null,
        input.approvedBy ?? null,
        input.decidedAt ?? null,
        JSON.stringify(input.criteria ?? {}),
        JSON.stringify(input.evidence ?? {}),
        JSON.stringify(input.metadata ?? {}),
        input.version ?? 1,
      ],
      client,
    );
    return this.mapQualification(rows[0]!);
  }

  async getQualificationByApplication(applicationId: string): Promise<QualificationRecord | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p10_qualification_records WHERE application_id = $1`,
      [applicationId],
    );
    return rows[0] ? this.mapQualification(rows[0]) : null;
  }

  async transitionQualification(
    id: string,
    toStatus: string,
    patch?: Partial<QualificationRecord> & { expectedVersion?: number },
    client?: unknown,
  ): Promise<QualificationRecord> {
    const params: unknown[] = [
      id,
      toStatus,
      patch?.outcomeSummary ?? null,
      patch?.reviewerId ?? null,
      patch?.approvedBy ?? null,
      patch?.decidedAt ?? null,
      patch?.criteria != null ? JSON.stringify(patch.criteria) : null,
      patch?.evidence != null ? JSON.stringify(patch.evidence) : null,
      patch?.metadata != null ? JSON.stringify(patch.metadata) : null,
    ];
    let versionClause = '';
    if (patch?.expectedVersion != null) {
      params.push(patch.expectedVersion);
      versionClause = ` AND version = $${params.length}`;
    }
    const rows = await this.q(
      `UPDATE edge_p10_qualification_records SET
         status = $2,
         outcome_summary = COALESCE($3, outcome_summary),
         reviewer_id = COALESCE($4, reviewer_id),
         approved_by = CASE
           WHEN $2 IN ('APPROVED','CONDITIONAL') THEN COALESCE($5, approved_by)
           ELSE COALESCE($5, approved_by)
         END,
         decided_at = CASE
           WHEN $2 IN ('APPROVED','REJECTED','CONDITIONAL') THEN COALESCE($6, decided_at, NOW())
           ELSE COALESCE($6, decided_at)
         END,
         criteria = COALESCE($7::jsonb, criteria),
         evidence = COALESCE($8::jsonb, evidence),
         metadata = COALESCE($9::jsonb, metadata),
         updated_at = NOW(),
         version = version + 1
       WHERE id = $1${versionClause}
       RETURNING *`,
      params,
      client,
    );
    if (!rows[0]) {
      return this.throwTransitionMiss(
        'edge_p10_qualification_records',
        id,
        patch?.expectedVersion,
        'Qualification',
        client,
      );
    }
    return this.mapQualification(rows[0]);
  }

  async createReviewAssignment(
    input: Parameters<AcquisitionRepositoryPort['createReviewAssignment']>[0],
    client?: unknown,
  ): Promise<ReviewAssignment> {
    const rows = await this.q(
      `INSERT INTO edge_p10_review_assignments (
         id, application_id, assignee_id, role_hint, status, assigned_by,
         due_at, completed_at, metadata
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, COALESCE($4, 'REVIEWER'), COALESCE($5, 'ASSIGNED'), $6,
         $7, $8, COALESCE($9::jsonb, '{}'::jsonb)
       ) RETURNING *`,
      [
        input.id ?? null,
        input.applicationId,
        input.assigneeId,
        input.roleHint ?? null,
        input.status ?? null,
        input.assignedBy,
        input.dueAt ?? null,
        input.completedAt ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
      client,
    );
    return this.mapReviewAssignment(rows[0]!);
  }

  async listReviewAssignments(applicationId: string): Promise<ReviewAssignment[]> {
    const rows = await this.q(
      `SELECT * FROM edge_p10_review_assignments WHERE application_id = $1 ORDER BY created_at DESC`,
      [applicationId],
    );
    return rows.map((r) => this.mapReviewAssignment(r));
  }

  // --- Quotes / checkout / handoff ---

  async getQuoteRequest(id: string): Promise<QuoteRequest | null> {
    const rows = await this.q(`SELECT * FROM edge_p10_quote_requests WHERE id = $1`, [id]);
    return rows[0] ? this.mapQuoteRequest(rows[0]) : null;
  }

  async listQuoteRequests(
    filter?: AcquisitionListFilter,
  ): Promise<{ items: QuoteRequest[]; total: number }> {
    const { limit, offset } = this.bounds(filter);
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter?.prospectId) {
      params.push(filter.prospectId);
      where.push(`prospect_id = $${params.length}`);
    }
    if (filter?.applicationId) {
      params.push(filter.applicationId);
      where.push(`application_id = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p10_quote_requests ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p10_quote_requests ${clause}
       ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return {
      items: rows.map((r) => this.mapQuoteRequest(r)),
      total: num(countRows[0]?.c),
    };
  }

  async createQuoteRequest(
    input: Parameters<AcquisitionRepositoryPort['createQuoteRequest']>[0],
    client?: unknown,
  ): Promise<QuoteRequest> {
    const rows = await this.q(
      `INSERT INTO edge_p10_quote_requests (
         id, application_id, prospect_id, commercial_plan_id, plan_presentation_id,
         status, requested_by, notes, metadata, version
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3, $4::uuid, $5::uuid,
         COALESCE($6, 'REQUESTED'), $7, $8, COALESCE($9::jsonb, '{}'::jsonb), COALESCE($10, 1)
       ) RETURNING *`,
      [
        input.id ?? null,
        input.applicationId ?? null,
        input.prospectId,
        input.commercialPlanId ?? null,
        input.planPresentationId ?? null,
        input.status ?? null,
        input.requestedBy ?? null,
        input.notes ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.version ?? 1,
      ],
      client,
    );
    return this.mapQuoteRequest(rows[0]!);
  }

  async attachQuoteReference(
    input: Omit<QuoteReference, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<QuoteReference> {
    await this.q(
      `UPDATE edge_p10_quote_references SET status = 'SUPERSEDED'
       WHERE quote_request_id = $1 AND status = 'ACTIVE'`,
      [input.quoteRequestId],
      client,
    );
    const rows = await this.q(
      `INSERT INTO edge_p10_quote_references (
         id, quote_request_id, external_quote_ref, commercial_source, status,
         valid_until, display_summary, metadata
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, COALESCE($4, 'P2_COMMERCIAL'), COALESCE($5, 'ACTIVE'),
         $6, COALESCE($7::jsonb, '{}'::jsonb), COALESCE($8::jsonb, '{}'::jsonb)
       ) RETURNING *`,
      [
        input.id ?? null,
        input.quoteRequestId,
        input.externalQuoteRef,
        input.commercialSource ?? null,
        input.status ?? null,
        input.validUntil ?? null,
        JSON.stringify(input.displaySummary ?? {}),
        JSON.stringify(input.metadata ?? {}),
      ],
      client,
    );
    return this.mapQuoteReference(rows[0]!);
  }

  async getActiveQuoteReference(quoteRequestId: string): Promise<QuoteReference | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p10_quote_references
       WHERE quote_request_id = $1 AND status = 'ACTIVE'
       ORDER BY created_at DESC LIMIT 1`,
      [quoteRequestId],
    );
    return rows[0] ? this.mapQuoteReference(rows[0]) : null;
  }

  async transitionQuoteRequest(
    id: string,
    toStatus: string,
    patch?: Partial<QuoteRequest> & { expectedVersion?: number },
    client?: unknown,
  ): Promise<QuoteRequest> {
    const params: unknown[] = [
      id,
      toStatus,
      patch?.notes ?? null,
      patch?.commercialPlanId ?? null,
      patch?.planPresentationId ?? null,
      patch?.metadata != null ? JSON.stringify(patch.metadata) : null,
    ];
    let versionClause = '';
    if (patch?.expectedVersion != null) {
      params.push(patch.expectedVersion);
      versionClause = ` AND version = $${params.length}`;
    }
    const rows = await this.q(
      `UPDATE edge_p10_quote_requests SET
         status = $2,
         notes = COALESCE($3, notes),
         commercial_plan_id = COALESCE($4::uuid, commercial_plan_id),
         plan_presentation_id = COALESCE($5::uuid, plan_presentation_id),
         metadata = COALESCE($6::jsonb, metadata),
         updated_at = NOW(),
         version = version + 1
       WHERE id = $1${versionClause}
       RETURNING *`,
      params,
      client,
    );
    if (!rows[0]) {
      return this.throwTransitionMiss(
        'edge_p10_quote_requests',
        id,
        patch?.expectedVersion,
        'Quote request',
        client,
      );
    }
    return this.mapQuoteRequest(rows[0]);
  }

  async createCheckoutSession(
    input: Parameters<AcquisitionRepositoryPort['createCheckoutSession']>[0],
    client?: unknown,
  ): Promise<CheckoutSession> {
    const rows = await this.q(
      `INSERT INTO edge_p10_checkout_sessions (
         id, application_id, prospect_id, plan_presentation_id, commercial_plan_id,
         quote_reference_id, status, billing_session_ref, idempotency_key, metadata, created_by, version
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3, $4::uuid, $5::uuid,
         $6::uuid, COALESCE($7, 'CREATED'), $8, $9, COALESCE($10::jsonb, '{}'::jsonb), $11, COALESCE($12, 1)
       ) RETURNING *`,
      [
        input.id ?? null,
        input.applicationId ?? null,
        input.prospectId,
        input.planPresentationId ?? null,
        input.commercialPlanId ?? null,
        input.quoteReferenceId ?? null,
        input.status ?? null,
        input.billingSessionRef ?? null,
        input.idempotencyKey,
        JSON.stringify(input.metadata ?? {}),
        input.createdBy ?? null,
        input.version ?? 1,
      ],
      client,
    );
    return this.mapCheckoutSession(rows[0]!);
  }

  async getCheckoutSession(id: string): Promise<CheckoutSession | null> {
    const rows = await this.q(`SELECT * FROM edge_p10_checkout_sessions WHERE id = $1`, [id]);
    return rows[0] ? this.mapCheckoutSession(rows[0]) : null;
  }

  async getCheckoutSessionByIdempotencyKey(idempotencyKey: string): Promise<CheckoutSession | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p10_checkout_sessions WHERE idempotency_key = $1`,
      [idempotencyKey],
    );
    return rows[0] ? this.mapCheckoutSession(rows[0]) : null;
  }

  async transitionCheckoutSession(
    id: string,
    toStatus: string,
    patch?: Partial<CheckoutSession> & { expectedVersion?: number },
    client?: unknown,
  ): Promise<CheckoutSession> {
    const params: unknown[] = [
      id,
      toStatus,
      patch?.billingSessionRef ?? null,
      patch?.quoteReferenceId ?? null,
      patch?.metadata != null ? JSON.stringify(patch.metadata) : null,
    ];
    let versionClause = '';
    if (patch?.expectedVersion != null) {
      params.push(patch.expectedVersion);
      versionClause = ` AND version = $${params.length}`;
    }
    const rows = await this.q(
      `UPDATE edge_p10_checkout_sessions SET
         status = $2,
         billing_session_ref = COALESCE($3, billing_session_ref),
         quote_reference_id = COALESCE($4::uuid, quote_reference_id),
         metadata = COALESCE($5::jsonb, metadata),
         updated_at = NOW(),
         version = version + 1
       WHERE id = $1${versionClause}
       RETURNING *`,
      params,
      client,
    );
    if (!rows[0]) {
      return this.throwTransitionMiss(
        'edge_p10_checkout_sessions',
        id,
        patch?.expectedVersion,
        'Checkout session',
        client,
      );
    }
    return this.mapCheckoutSession(rows[0]);
  }

  async addCheckoutEvent(
    input: Omit<CheckoutEvent, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<CheckoutEvent> {
    const rows = await this.q(
      `INSERT INTO edge_p10_checkout_events (
         id, checkout_session_id, event_type, from_status, to_status, external_ref, body, actor_id
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, COALESCE($7::jsonb, '{}'::jsonb), $8
       ) RETURNING *`,
      [
        input.id ?? null,
        input.checkoutSessionId,
        input.eventType,
        input.fromStatus ?? null,
        input.toStatus ?? null,
        input.externalRef ?? null,
        JSON.stringify(input.body ?? {}),
        input.actorId ?? null,
      ],
      client,
    );
    return this.mapCheckoutEvent(rows[0]!);
  }

  async getSubscriptionHandoff(id: string): Promise<SubscriptionHandoff | null> {
    const rows = await this.q(`SELECT * FROM edge_p10_subscription_handoffs WHERE id = $1`, [id]);
    return rows[0] ? this.mapSubscriptionHandoff(rows[0]) : null;
  }

  async listSubscriptionHandoffs(
    filter?: AcquisitionListFilter,
  ): Promise<{ items: SubscriptionHandoff[]; total: number }> {
    const { limit, offset } = this.bounds(filter);
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter?.prospectId) {
      params.push(filter.prospectId);
      where.push(`prospect_id = $${params.length}`);
    }
    if (filter?.applicationId) {
      params.push(filter.applicationId);
      where.push(`application_id = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p10_subscription_handoffs ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p10_subscription_handoffs ${clause}
       ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return {
      items: rows.map((r) => this.mapSubscriptionHandoff(r)),
      total: num(countRows[0]?.c),
    };
  }

  async listCheckoutSessions(
    filter?: AcquisitionListFilter,
  ): Promise<{ items: CheckoutSession[]; total: number }> {
    const { limit, offset } = this.bounds(filter);
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (filter?.prospectId) {
      params.push(filter.prospectId);
      where.push(`prospect_id = $${params.length}`);
    }
    if (filter?.applicationId) {
      params.push(filter.applicationId);
      where.push(`application_id = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p10_checkout_sessions ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p10_checkout_sessions ${clause}
       ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return {
      items: rows.map((r) => this.mapCheckoutSession(r)),
      total: num(countRows[0]?.c),
    };
  }

  async createSubscriptionHandoff(
    input: Parameters<AcquisitionRepositoryPort['createSubscriptionHandoff']>[0],
    client?: unknown,
  ): Promise<SubscriptionHandoff> {
    const rows = await this.q(
      `INSERT INTO edge_p10_subscription_handoffs (
         id, checkout_session_id, application_id, prospect_id, commercial_account_id,
         commercial_plan_id, status, subscription_ref, external_evidence_ref, failure_reason,
         metadata, version
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid, $4, $5::uuid,
         $6::uuid, COALESCE($7, 'REQUESTED'), $8, $9, $10,
         COALESCE($11::jsonb, '{}'::jsonb), COALESCE($12, 1)
       ) RETURNING *`,
      [
        input.id ?? null,
        input.checkoutSessionId ?? null,
        input.applicationId ?? null,
        input.prospectId,
        input.commercialAccountId ?? null,
        input.commercialPlanId ?? null,
        input.status ?? null,
        input.subscriptionRef ?? null,
        input.externalEvidenceRef ?? null,
        input.failureReason ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.version ?? 1,
      ],
      client,
    );
    return this.mapSubscriptionHandoff(rows[0]!);
  }

  async transitionSubscriptionHandoff(
    id: string,
    toStatus: string,
    patch?: Partial<SubscriptionHandoff> & { expectedVersion?: number },
    client?: unknown,
  ): Promise<SubscriptionHandoff> {
    const params: unknown[] = [
      id,
      toStatus,
      patch?.subscriptionRef ?? null,
      patch?.externalEvidenceRef ?? null,
      patch?.failureReason ?? null,
      patch?.commercialAccountId ?? null,
      patch?.commercialPlanId ?? null,
      patch?.metadata != null ? JSON.stringify(patch.metadata) : null,
    ];
    let versionClause = '';
    if (patch?.expectedVersion != null) {
      params.push(patch.expectedVersion);
      versionClause = ` AND version = $${params.length}`;
    }
    const rows = await this.q(
      `UPDATE edge_p10_subscription_handoffs SET
         status = $2,
         subscription_ref = COALESCE($3, subscription_ref),
         external_evidence_ref = COALESCE($4, external_evidence_ref),
         failure_reason = COALESCE($5, failure_reason),
         commercial_account_id = COALESCE($6::uuid, commercial_account_id),
         commercial_plan_id = COALESCE($7::uuid, commercial_plan_id),
         metadata = COALESCE($8::jsonb, metadata),
         updated_at = NOW(),
         version = version + 1
       WHERE id = $1${versionClause}
       RETURNING *`,
      params,
      client,
    );
    if (!rows[0]) {
      return this.throwTransitionMiss(
        'edge_p10_subscription_handoffs',
        id,
        patch?.expectedVersion,
        'Subscription handoff',
        client,
      );
    }
    return this.mapSubscriptionHandoff(rows[0]);
  }

  // --- Journeys / communications / analytics ---

  async createJourneyDefinition(
    input: Parameters<AcquisitionRepositoryPort['createJourneyDefinition']>[0],
    client?: unknown,
  ): Promise<JourneyDefinition> {
    const rows = await this.q(
      `INSERT INTO edge_p10_journey_definitions (
         id, code, name, description, status, definition, metadata, created_by, version
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, COALESCE($5, 'DRAFT'),
         COALESCE($6::jsonb, '{}'::jsonb), COALESCE($7::jsonb, '{}'::jsonb), $8, COALESCE($9, 1)
       ) RETURNING *`,
      [
        input.id ?? null,
        input.code,
        input.name,
        input.description ?? null,
        input.status ?? null,
        JSON.stringify(input.definition ?? {}),
        JSON.stringify(input.metadata ?? {}),
        input.createdBy,
        input.version ?? 1,
      ],
      client,
    );
    return this.mapJourneyDefinition(rows[0]!);
  }

  async startJourneyInstance(
    input: Parameters<AcquisitionRepositoryPort['startJourneyInstance']>[0],
    client?: unknown,
  ): Promise<JourneyInstance> {
    const rows = await this.q(
      `INSERT INTO edge_p10_journey_instances (
         id, journey_definition_id, prospect_id, application_id, status, current_step_key,
         context, metadata, started_at, completed_at, version
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3::uuid, $4::uuid, COALESCE($5, 'ACTIVE'), $6,
         COALESCE($7::jsonb, '{}'::jsonb), COALESCE($8::jsonb, '{}'::jsonb),
         COALESCE($9, NOW()), $10, COALESCE($11, 1)
       ) RETURNING *`,
      [
        input.id ?? null,
        input.journeyDefinitionId,
        input.prospectId ?? null,
        input.applicationId ?? null,
        input.status ?? null,
        input.currentStepKey ?? null,
        JSON.stringify(input.context ?? {}),
        JSON.stringify(input.metadata ?? {}),
        input.startedAt ?? null,
        input.completedAt ?? null,
        input.version ?? 1,
      ],
      client,
    );
    return this.mapJourneyInstance(rows[0]!);
  }

  async getJourneyInstance(id: string): Promise<JourneyInstance | null> {
    const rows = await this.q(`SELECT * FROM edge_p10_journey_instances WHERE id = $1`, [id]);
    return rows[0] ? this.mapJourneyInstance(rows[0]) : null;
  }

  async findJourneyInstance(filter: {
    prospectId?: string | null;
    journeyDefinitionId?: string;
    applicationId?: string | null;
    status?: string;
  }): Promise<JourneyInstance | null> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.prospectId != null) {
      params.push(filter.prospectId);
      where.push(`prospect_id = $${params.length}`);
    }
    if (filter.journeyDefinitionId) {
      params.push(filter.journeyDefinitionId);
      where.push(`journey_definition_id = $${params.length}`);
    }
    if (filter.applicationId != null) {
      params.push(filter.applicationId);
      where.push(`application_id = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`status = $${params.length}`);
    }
    if (where.length === 0) return null;
    const rows = await this.q(
      `SELECT * FROM edge_p10_journey_instances WHERE ${where.join(' AND ')}
       ORDER BY started_at DESC LIMIT 1`,
      params,
    );
    return rows[0] ? this.mapJourneyInstance(rows[0]) : null;
  }

  async updateJourneyInstance(
    id: string,
    patch: Partial<JourneyInstance> & { expectedVersion?: number },
    client?: unknown,
  ): Promise<JourneyInstance> {
    const params: unknown[] = [
      id,
      patch.status ?? null,
      patch.currentStepKey ?? null,
      patch.context != null ? JSON.stringify(patch.context) : null,
      patch.metadata != null ? JSON.stringify(patch.metadata) : null,
      patch.completedAt ?? null,
    ];
    let versionClause = '';
    if (patch.expectedVersion != null) {
      params.push(patch.expectedVersion);
      versionClause = ` AND version = $${params.length}`;
    }
    const rows = await this.q(
      `UPDATE edge_p10_journey_instances SET
         status = COALESCE($2, status),
         current_step_key = COALESCE($3, current_step_key),
         context = COALESCE($4::jsonb, context),
         metadata = COALESCE($5::jsonb, metadata),
         completed_at = CASE
           WHEN $2 IN ('COMPLETED','FAILED','CANCELLED') THEN COALESCE($6, completed_at, NOW())
           ELSE COALESCE($6, completed_at)
         END,
         updated_at = NOW(),
         version = version + 1
       WHERE id = $1${versionClause}
       RETURNING *`,
      params,
      client,
    );
    if (!rows[0]) {
      return this.throwTransitionMiss(
        'edge_p10_journey_instances',
        id,
        patch.expectedVersion,
        'Journey instance',
        client,
      );
    }
    return this.mapJourneyInstance(rows[0]);
  }

  async addJourneyEvent(
    input: Omit<JourneyEvent, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<JourneyEvent> {
    const rows = await this.q(
      `INSERT INTO edge_p10_journey_events (
         id, journey_instance_id, event_type, step_key, body, actor_id
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, COALESCE($5::jsonb, '{}'::jsonb), $6
       ) RETURNING *`,
      [
        input.id ?? null,
        input.journeyInstanceId,
        input.eventType,
        input.stepKey ?? null,
        JSON.stringify(input.body ?? {}),
        input.actorId ?? null,
      ],
      client,
    );
    return this.mapJourneyEvent(rows[0]!);
  }

  async createCommunication(
    input: Omit<AcquisitionCommunication, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<AcquisitionCommunication> {
    const rows = await this.q(
      `INSERT INTO edge_p10_communications (
         id, prospect_id, application_id, journey_instance_id, channel, template_ref,
         status, provider_ref, subject, payload, metadata
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid, $4::uuid, $5, $6,
         COALESCE($7, 'QUEUED'), $8, $9, COALESCE($10::jsonb, '{}'::jsonb), COALESCE($11::jsonb, '{}'::jsonb)
       ) RETURNING *`,
      [
        input.id ?? null,
        input.prospectId ?? null,
        input.applicationId ?? null,
        input.journeyInstanceId ?? null,
        input.channel,
        input.templateRef ?? null,
        input.status ?? null,
        input.providerRef ?? null,
        input.subject ?? null,
        JSON.stringify(input.payload ?? {}),
        JSON.stringify(input.metadata ?? {}),
      ],
      client,
    );
    return this.mapCommunication(rows[0]!);
  }

  async getCommunication(id: string): Promise<AcquisitionCommunication | null> {
    const rows = await this.q(`SELECT * FROM edge_p10_communications WHERE id = $1`, [id]);
    return rows[0] ? this.mapCommunication(rows[0]) : null;
  }

  async updateCommunicationStatus(
    id: string,
    status: string,
    patch?: Partial<AcquisitionCommunication>,
    client?: unknown,
  ): Promise<AcquisitionCommunication> {
    const rows = await this.q(
      `UPDATE edge_p10_communications SET
         status = $2,
         provider_ref = COALESCE($3, provider_ref),
         subject = COALESCE($4, subject),
         payload = COALESCE($5::jsonb, payload),
         metadata = COALESCE($6::jsonb, metadata),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        status,
        patch?.providerRef ?? null,
        patch?.subject ?? null,
        patch?.payload != null ? JSON.stringify(patch.payload) : null,
        patch?.metadata != null ? JSON.stringify(patch.metadata) : null,
      ],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Communication not found');
    }
    return this.mapCommunication(rows[0]);
  }

  async recordAnalyticsEvent(
    input: Parameters<AcquisitionRepositoryPort['recordAnalyticsEvent']>[0],
    client?: unknown,
  ): Promise<AnalyticsEvent> {
    const rows = await this.q(
      `INSERT INTO edge_p10_analytics_events (
         id, event_name, prospect_id, lead_id, application_id, session_key, properties, occurred_at
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3::uuid, $4::uuid, $5::uuid, $6,
         COALESCE($7::jsonb, '{}'::jsonb), COALESCE($8, NOW())
       ) RETURNING *`,
      [
        input.id ?? null,
        input.eventName,
        input.prospectId ?? null,
        input.leadId ?? null,
        input.applicationId ?? null,
        input.sessionKey ?? null,
        JSON.stringify(input.properties ?? {}),
        input.occurredAt ?? null,
      ],
      client,
    );
    return this.mapAnalyticsEvent(rows[0]!);
  }

  async listAnalyticsEvents(filter?: {
    eventName?: string;
    prospectId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: AnalyticsEvent[]; total: number }> {
    const limit = Math.min(Math.max(filter?.limit ?? 50, 1), 200);
    const offset = Math.max(filter?.offset ?? 0, 0);
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter?.eventName) {
      params.push(filter.eventName);
      where.push(`event_name = $${params.length}`);
    }
    if (filter?.prospectId) {
      params.push(filter.prospectId);
      where.push(`prospect_id = $${params.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q(
      `SELECT COUNT(*)::int AS c FROM edge_p10_analytics_events ${clause}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_p10_analytics_events ${clause}
       ORDER BY occurred_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapAnalyticsEvent(r)), total: num(countRows[0]?.c) };
  }

  async getAcquisitionOverviewCounts(): Promise<{
    presentationsPublished: number;
    prospectsActive: number;
    leadsCaptured: number;
    applicationsOpen: number;
    checkoutsPending: number;
    handoffsRequested: number;
  }> {
    const [presentations, prospects, leads, applications, checkouts, handoffs] = await Promise.all([
      this.q(
        `SELECT COUNT(*)::int AS c FROM edge_p10_product_presentations WHERE status = 'PUBLISHED'`,
      ),
      this.q(
        `SELECT COUNT(*)::int AS c FROM edge_p10_prospects
         WHERE status NOT IN ('CONVERTED','DISQUALIFIED','ARCHIVED')`,
      ),
      this.q(
        `SELECT COUNT(*)::int AS c FROM edge_p10_acquisition_leads WHERE status = 'CAPTURED'`,
      ),
      this.q(
        `SELECT COUNT(*)::int AS c FROM edge_p10_applications
         WHERE status NOT IN ('REJECTED','WITHDRAWN','EXPIRED','COMPLETED')`,
      ),
      this.q(
        `SELECT COUNT(*)::int AS c FROM edge_p10_checkout_sessions
         WHERE status IN ('CREATED','AWAITING_PAYMENT','AUTHORIZED','CAPTURED','HANDOFF_READY')`,
      ),
      this.q(
        `SELECT COUNT(*)::int AS c FROM edge_p10_subscription_handoffs WHERE status = 'REQUESTED'`,
      ),
    ]);
    return {
      presentationsPublished: num(presentations[0]?.c),
      prospectsActive: num(prospects[0]?.c),
      leadsCaptured: num(leads[0]?.c),
      applicationsOpen: num(applications[0]?.c),
      checkoutsPending: num(checkouts[0]?.c),
      handoffsRequested: num(handoffs[0]?.c),
    };
  }

  async upsertAttribution(
    input: Omit<AttributionRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    client?: unknown,
  ): Promise<AttributionRecord> {
    if (input.id) {
      const updated = await this.q(
        `UPDATE edge_p10_attribution_records SET
           prospect_id = COALESCE($2::uuid, prospect_id),
           lead_id = COALESCE($3::uuid, lead_id),
           channel = COALESCE($4, channel),
           campaign_ref = COALESCE($5, campaign_ref),
           marketing_soft_ref = COALESCE($6::uuid, marketing_soft_ref),
           utm = COALESCE($7::jsonb, utm),
           first_touch_at = COALESCE($8, first_touch_at),
           last_touch_at = COALESCE($9, last_touch_at),
           metadata = COALESCE($10::jsonb, metadata),
           updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          input.id,
          input.prospectId ?? null,
          input.leadId ?? null,
          input.channel ?? null,
          input.campaignRef ?? null,
          input.marketingSoftRef ?? null,
          JSON.stringify(input.utm ?? {}),
          input.firstTouchAt ?? null,
          input.lastTouchAt ?? null,
          JSON.stringify(input.metadata ?? {}),
        ],
        client,
      );
      if (updated[0]) return this.mapAttribution(updated[0]);
    }

    const rows = await this.q(
      `INSERT INTO edge_p10_attribution_records (
         id, prospect_id, lead_id, channel, campaign_ref, marketing_soft_ref,
         utm, first_touch_at, last_touch_at, metadata
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid, $4, $5, $6::uuid,
         COALESCE($7::jsonb, '{}'::jsonb), $8, $9, COALESCE($10::jsonb, '{}'::jsonb)
       ) RETURNING *`,
      [
        input.id ?? null,
        input.prospectId ?? null,
        input.leadId ?? null,
        input.channel ?? null,
        input.campaignRef ?? null,
        input.marketingSoftRef ?? null,
        JSON.stringify(input.utm ?? {}),
        input.firstTouchAt ?? null,
        input.lastTouchAt ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
      client,
    );
    return this.mapAttribution(rows[0]!);
  }

  async appendAuditEvent(
    input: Omit<AcquisitionAuditEvent, 'id' | 'createdAt'> & { id?: string },
    client?: unknown,
  ): Promise<AcquisitionAuditEvent> {
    const rows = await this.q(
      `INSERT INTO edge_p10_audit_events (
         id, aggregate_type, aggregate_id, action, actor_id, before_state, after_state,
         correlation_id, metadata
       ) VALUES (
         COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6::jsonb, $7::jsonb,
         $8::uuid, COALESCE($9::jsonb, '{}'::jsonb)
       ) RETURNING *`,
      [
        input.id ?? null,
        input.aggregateType,
        input.aggregateId,
        input.action,
        input.actorId ?? null,
        input.beforeState != null ? JSON.stringify(input.beforeState) : null,
        input.afterState != null ? JSON.stringify(input.afterState) : null,
        input.correlationId ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
      client,
    );
    return this.mapAuditEvent(rows[0]!);
  }

  async beginIdempotency(
    input: {
      scope: string;
      idempotencyKey: string;
      requestHash?: string | null;
      expiresAt?: Date | null;
      metadata?: Record<string, unknown>;
    },
    client?: unknown,
  ): Promise<AcquisitionIdempotencyKey> {
    const inserted = await this.q(
      `INSERT INTO edge_p10_idempotency_keys (
         scope, idempotency_key, request_hash, status, expires_at, metadata
       ) VALUES (
         $1, $2, $3, 'STARTED', $4, COALESCE($5::jsonb, '{}'::jsonb)
       )
       ON CONFLICT (scope, idempotency_key) DO NOTHING
       RETURNING *`,
      [
        input.scope,
        input.idempotencyKey,
        input.requestHash ?? null,
        input.expiresAt ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
      client,
    );
    if (inserted[0]) return this.mapIdempotency(inserted[0]);

    const existing = await this.q(
      `SELECT * FROM edge_p10_idempotency_keys WHERE scope = $1 AND idempotency_key = $2`,
      [input.scope, input.idempotencyKey],
      client,
    );
    if (!existing[0]) {
      throw new DomainError(ErrorCode.CONFLICT, 'Idempotency key race');
    }
    const row = this.mapIdempotency(existing[0]);
    if (
      input.requestHash != null &&
      row.requestHash != null &&
      input.requestHash !== row.requestHash
    ) {
      throw new DomainError(
        ErrorCode.IDEMPOTENCY_CONFLICT,
        'Idempotency key reused with different request hash',
      );
    }
    return row;
  }

  async completeIdempotency(
    scope: string,
    idempotencyKey: string,
    responseRef: string | null,
    status: 'COMPLETED' | 'FAILED',
    client?: unknown,
  ): Promise<AcquisitionIdempotencyKey> {
    const rows = await this.q(
      `UPDATE edge_p10_idempotency_keys SET
         status = $3,
         response_ref = $4,
         updated_at = NOW()
       WHERE scope = $1 AND idempotency_key = $2
       RETURNING *`,
      [scope, idempotencyKey, status, responseRef],
      client,
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Idempotency key not found');
    }
    return this.mapIdempotency(rows[0]);
  }

  async getIdempotency(
    scope: string,
    idempotencyKey: string,
  ): Promise<AcquisitionIdempotencyKey | null> {
    const rows = await this.q(
      `SELECT * FROM edge_p10_idempotency_keys WHERE scope = $1 AND idempotency_key = $2`,
      [scope, idempotencyKey],
    );
    return rows[0] ? this.mapIdempotency(rows[0]) : null;
  }
}
