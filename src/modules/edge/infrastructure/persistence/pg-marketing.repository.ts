import { Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  MarketingAudience,
  MarketingAudienceRule,
  MarketingBudget,
  MarketingCampaign,
  MarketingFormDefinition,
  MarketingFormSubmission,
  MarketingLead,
  MarketingRepositoryPort,
  MarketingScoringModel,
  MarketingStrategy,
} from '../../domain/ports/marketing-repository.port.js';

@Injectable()
export class PgMarketingRepository implements MarketingRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  private async q<T extends Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const result = await this.pool.query<T>(sql, params);
    return result.rows;
  }

  private mapStrategy(r: Record<string, unknown>): MarketingStrategy {
    return {
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      description: (r.description as string | null) ?? null,
      scopeType: String(r.scope_type),
      productId: (r.product_id as string | null) ?? null,
      verticalId: (r.vertical_id as string | null) ?? null,
      marketId: (r.market_id as string | null) ?? null,
      status: String(r.status),
      version: Number(r.version),
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapAudience(r: Record<string, unknown>): MarketingAudience {
    return {
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      description: (r.description as string | null) ?? null,
      audienceKind: String(r.audience_kind),
      productId: (r.product_id as string | null) ?? null,
      verticalId: (r.vertical_id as string | null) ?? null,
      status: String(r.status),
      version: Number(r.version),
      estimatedSize: r.estimated_size == null ? null : Number(r.estimated_size),
      estimatedSizeSource: String(r.estimated_size_source),
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapCampaign(r: Record<string, unknown>): MarketingCampaign {
    return {
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      description: (r.description as string | null) ?? null,
      campaignType: String(r.campaign_type),
      objective: (r.objective as string | null) ?? null,
      productId: String(r.product_id),
      verticalId: (r.vertical_id as string | null) ?? null,
      marketId: (r.market_id as string | null) ?? null,
      segmentId: (r.segment_id as string | null) ?? null,
      icpId: (r.icp_id as string | null) ?? null,
      personaId: (r.persona_id as string | null) ?? null,
      offerType: (r.offer_type as string | null) ?? null,
      offerId: (r.offer_id as string | null) ?? null,
      audienceId: (r.audience_id as string | null) ?? null,
      strategyId: (r.strategy_id as string | null) ?? null,
      status: String(r.status),
      version: Number(r.version),
      budgetAmount: r.budget_amount == null ? null : String(r.budget_amount),
      budgetCurrency: (r.budget_currency as string | null) ?? null,
      startsAt: r.starts_at ? new Date(String(r.starts_at)) : null,
      endsAt: r.ends_at ? new Date(String(r.ends_at)) : null,
      channels: (r.channels as unknown[]) ?? [],
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapForm(r: Record<string, unknown>): MarketingFormDefinition {
    return {
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      formType: String(r.form_type),
      slug: String(r.slug),
      productId: (r.product_id as string | null) ?? null,
      campaignId: (r.campaign_id as string | null) ?? null,
      status: String(r.status),
      version: Number(r.version),
      fields: (r.fields as unknown[]) ?? [],
      requiredConsents: (r.required_consents as unknown[]) ?? [],
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapSubmission(r: Record<string, unknown>): MarketingFormSubmission {
    return {
      id: String(r.id),
      formId: String(r.form_id),
      formVersion: Number(r.form_version),
      idempotencyKey: (r.idempotency_key as string | null) ?? null,
      leadId: (r.lead_id as string | null) ?? null,
      payload: (r.payload as Record<string, unknown>) ?? {},
      utm: (r.utm as Record<string, unknown>) ?? {},
      sourceUrl: (r.source_url as string | null) ?? null,
      campaignId: (r.campaign_id as string | null) ?? null,
      productId: (r.product_id as string | null) ?? null,
      status: String(r.status),
      rejectionReason: (r.rejection_reason as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
    };
  }

  private mapLead(r: Record<string, unknown>): MarketingLead {
    return {
      id: String(r.id),
      status: String(r.status),
      emailNormalized: (r.email_normalized as string | null) ?? null,
      primaryProductId: (r.primary_product_id as string | null) ?? null,
      verticalId: (r.vertical_id as string | null) ?? null,
      organizationId: (r.organization_id as string | null) ?? null,
      sourceType: (r.source_type as string | null) ?? null,
      sourceCampaignId: (r.source_campaign_id as string | null) ?? null,
      sourceFormId: (r.source_form_id as string | null) ?? null,
      duplicateOfLeadId: (r.duplicate_of_lead_id as string | null) ?? null,
      assignedTo: (r.assigned_to as string | null) ?? null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  async createStrategy(input: {
    code: string;
    name: string;
    description?: string | null;
    scopeType: string;
    productId?: string | null;
    verticalId?: string | null;
    marketId?: string | null;
    createdBy?: string | null;
  }): Promise<MarketingStrategy> {
    const rows = await this.q(
      `INSERT INTO edge_marketing_strategies (
         code, name, description, scope_type, product_id, vertical_id, market_id, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        input.code,
        input.name,
        input.description ?? null,
        input.scopeType,
        input.productId ?? null,
        input.verticalId ?? null,
        input.marketId ?? null,
        input.createdBy ?? null,
      ],
    );
    return this.mapStrategy(rows[0]);
  }

  async listStrategies(opts?: {
    productId?: string;
    verticalId?: string;
  }): Promise<MarketingStrategy[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (opts?.productId) {
      params.push(opts.productId);
      clauses.push(`product_id = $${params.length}`);
    }
    if (opts?.verticalId) {
      params.push(opts.verticalId);
      clauses.push(`vertical_id = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await this.q(
      `SELECT * FROM edge_marketing_strategies ${where} ORDER BY created_at DESC`,
      params,
    );
    return rows.map((r) => this.mapStrategy(r));
  }

  async createAudience(input: {
    code: string;
    name: string;
    description?: string | null;
    audienceKind?: string;
    productId?: string | null;
    verticalId?: string | null;
    createdBy?: string | null;
  }): Promise<MarketingAudience> {
    const rows = await this.q(
      `INSERT INTO edge_marketing_audiences (
         code, name, description, audience_kind, product_id, vertical_id, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        input.code,
        input.name,
        input.description ?? null,
        input.audienceKind ?? 'DYNAMIC',
        input.productId ?? null,
        input.verticalId ?? null,
        input.createdBy ?? null,
      ],
    );
    return this.mapAudience(rows[0]);
  }

  async listAudiences(opts?: { productId?: string }): Promise<MarketingAudience[]> {
    const params: unknown[] = [];
    let where = '';
    if (opts?.productId) {
      params.push(opts.productId);
      where = `WHERE product_id = $1`;
    }
    const rows = await this.q(
      `SELECT * FROM edge_marketing_audiences ${where} ORDER BY created_at DESC`,
      params,
    );
    return rows.map((r) => this.mapAudience(r));
  }

  async addAudienceRule(input: {
    audienceId: string;
    ruleType: string;
    criterionType: string;
    criterionRef?: string | null;
    criterionValue?: Record<string, unknown>;
    position?: number;
  }): Promise<MarketingAudienceRule> {
    const rows = await this.q(
      `INSERT INTO edge_marketing_audience_rules (
         audience_id, rule_type, criterion_type, criterion_ref, criterion_value, position
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6) RETURNING *`,
      [
        input.audienceId,
        input.ruleType,
        input.criterionType,
        input.criterionRef ?? null,
        JSON.stringify(input.criterionValue ?? {}),
        input.position ?? 0,
      ],
    );
    const r = rows[0];
    return {
      id: String(r.id),
      audienceId: String(r.audience_id),
      ruleType: String(r.rule_type),
      criterionType: String(r.criterion_type),
      criterionRef: (r.criterion_ref as string | null) ?? null,
      criterionValue: (r.criterion_value as Record<string, unknown>) ?? {},
      position: Number(r.position),
    };
  }

  async listAudienceRules(audienceId: string): Promise<MarketingAudienceRule[]> {
    const rows = await this.q(
      `SELECT * FROM edge_marketing_audience_rules WHERE audience_id = $1 ORDER BY position`,
      [audienceId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      audienceId: String(r.audience_id),
      ruleType: String(r.rule_type),
      criterionType: String(r.criterion_type),
      criterionRef: (r.criterion_ref as string | null) ?? null,
      criterionValue: (r.criterion_value as Record<string, unknown>) ?? {},
      position: Number(r.position),
    }));
  }

  async createCampaign(input: {
    code: string;
    name: string;
    description?: string | null;
    campaignType: string;
    objective?: string | null;
    productId: string;
    verticalId?: string | null;
    marketId?: string | null;
    segmentId?: string | null;
    icpId?: string | null;
    personaId?: string | null;
    offerType?: string | null;
    offerId?: string | null;
    audienceId?: string | null;
    strategyId?: string | null;
    budgetAmount?: string | null;
    budgetCurrency?: string | null;
    channels?: unknown[];
    createdBy?: string | null;
  }): Promise<MarketingCampaign> {
    const rows = await this.q(
      `INSERT INTO edge_marketing_campaigns (
         code, name, description, campaign_type, objective, product_id, vertical_id,
         market_id, segment_id, icp_id, persona_id, offer_type, offer_id, audience_id,
         strategy_id, budget_amount, budget_currency, channels, created_by
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19
       ) RETURNING *`,
      [
        input.code,
        input.name,
        input.description ?? null,
        input.campaignType,
        input.objective ?? null,
        input.productId,
        input.verticalId ?? null,
        input.marketId ?? null,
        input.segmentId ?? null,
        input.icpId ?? null,
        input.personaId ?? null,
        input.offerType ?? null,
        input.offerId ?? null,
        input.audienceId ?? null,
        input.strategyId ?? null,
        input.budgetAmount ?? null,
        input.budgetCurrency ?? null,
        JSON.stringify(input.channels ?? []),
        input.createdBy ?? null,
      ],
    );
    return this.mapCampaign(rows[0]);
  }

  async getCampaign(id: string): Promise<MarketingCampaign | null> {
    const rows = await this.q(`SELECT * FROM edge_marketing_campaigns WHERE id = $1`, [id]);
    return rows[0] ? this.mapCampaign(rows[0]) : null;
  }

  async listCampaigns(opts?: {
    productId?: string;
    status?: string;
  }): Promise<MarketingCampaign[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (opts?.productId) {
      params.push(opts.productId);
      clauses.push(`product_id = $${params.length}`);
    }
    if (opts?.status) {
      params.push(opts.status);
      clauses.push(`status = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await this.q(
      `SELECT * FROM edge_marketing_campaigns ${where} ORDER BY created_at DESC`,
      params,
    );
    return rows.map((r) => this.mapCampaign(r));
  }

  async updateCampaignStatus(
    id: string,
    status: string,
    bumpVersion = false,
  ): Promise<MarketingCampaign> {
    const rows = await this.q(
      `UPDATE edge_marketing_campaigns
       SET status = $2,
           version = CASE WHEN $3 THEN version + 1 ELSE version END,
           updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, status, bumpVersion],
    );
    return this.mapCampaign(rows[0]);
  }

  async createCampaignApproval(input: {
    campaignId: string;
    campaignVersion: number;
    approvalType: string;
    decision: string;
    decidedBy?: string | null;
    notes?: string | null;
  }) {
    const rows = await this.q(
      `INSERT INTO edge_marketing_campaign_approvals (
         campaign_id, campaign_version, approval_type, decision, decided_by, decided_at, notes
       ) VALUES ($1,$2,$3,$4,$5, CASE WHEN $4 = 'PENDING' THEN NULL ELSE NOW() END, $6)
       RETURNING id, decision, approval_type`,
      [
        input.campaignId,
        input.campaignVersion,
        input.approvalType,
        input.decision,
        input.decidedBy ?? null,
        input.notes ?? null,
      ],
    );
    return {
      id: String(rows[0].id),
      decision: String(rows[0].decision),
      approvalType: String(rows[0].approval_type),
    };
  }

  async getLatestFinalApproval(campaignId: string) {
    const rows = await this.q(
      `SELECT decision FROM edge_marketing_campaign_approvals
       WHERE campaign_id = $1 AND approval_type = 'FINAL'
       ORDER BY created_at DESC LIMIT 1`,
      [campaignId],
    );
    return rows[0] ? { decision: String(rows[0].decision) } : null;
  }

  async createForm(input: {
    code: string;
    name: string;
    formType: string;
    slug: string;
    productId?: string | null;
    campaignId?: string | null;
    fields?: unknown[];
    requiredConsents?: unknown[];
    createdBy?: string | null;
  }): Promise<MarketingFormDefinition> {
    const rows = await this.q(
      `INSERT INTO edge_marketing_form_definitions (
         code, name, form_type, slug, product_id, campaign_id, fields, required_consents, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9) RETURNING *`,
      [
        input.code,
        input.name,
        input.formType,
        input.slug,
        input.productId ?? null,
        input.campaignId ?? null,
        JSON.stringify(input.fields ?? []),
        JSON.stringify(input.requiredConsents ?? []),
        input.createdBy ?? null,
      ],
    );
    return this.mapForm(rows[0]);
  }

  async getFormBySlug(slug: string): Promise<MarketingFormDefinition | null> {
    const rows = await this.q(
      `SELECT * FROM edge_marketing_form_definitions WHERE slug = $1`,
      [slug],
    );
    return rows[0] ? this.mapForm(rows[0]) : null;
  }

  async getForm(id: string): Promise<MarketingFormDefinition | null> {
    const rows = await this.q(
      `SELECT * FROM edge_marketing_form_definitions WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.mapForm(rows[0]) : null;
  }

  async listForms(opts?: { productId?: string }): Promise<MarketingFormDefinition[]> {
    const params: unknown[] = [];
    let where = '';
    if (opts?.productId) {
      params.push(opts.productId);
      where = `WHERE product_id = $1`;
    }
    const rows = await this.q(
      `SELECT * FROM edge_marketing_form_definitions ${where} ORDER BY created_at DESC`,
      params,
    );
    return rows.map((r) => this.mapForm(r));
  }

  async publishForm(id: string): Promise<MarketingFormDefinition> {
    const rows = await this.q(
      `UPDATE edge_marketing_form_definitions
       SET status = 'PUBLISHED', version = version + 1, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id],
    );
    return this.mapForm(rows[0]);
  }

  async findSubmissionByIdempotency(formId: string, idempotencyKey: string) {
    const rows = await this.q(
      `SELECT * FROM edge_marketing_form_submissions
       WHERE form_id = $1 AND idempotency_key = $2`,
      [formId, idempotencyKey],
    );
    return rows[0] ? this.mapSubmission(rows[0]) : null;
  }

  async createSubmission(input: {
    formId: string;
    formVersion: number;
    idempotencyKey?: string | null;
    leadId?: string | null;
    payload: Record<string, unknown>;
    utm?: Record<string, unknown>;
    sourceUrl?: string | null;
    campaignId?: string | null;
    productId?: string | null;
    status?: string;
    rejectionReason?: string | null;
  }): Promise<MarketingFormSubmission> {
    const rows = await this.q(
      `INSERT INTO edge_marketing_form_submissions (
         form_id, form_version, idempotency_key, lead_id, payload, utm, source_url,
         campaign_id, product_id, status, rejection_reason
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11) RETURNING *`,
      [
        input.formId,
        input.formVersion,
        input.idempotencyKey ?? null,
        input.leadId ?? null,
        JSON.stringify(input.payload),
        JSON.stringify(input.utm ?? {}),
        input.sourceUrl ?? null,
        input.campaignId ?? null,
        input.productId ?? null,
        input.status ?? 'RECEIVED',
        input.rejectionReason ?? null,
      ],
    );
    return this.mapSubmission(rows[0]);
  }

  async findLeadByEmail(emailNormalized: string): Promise<MarketingLead | null> {
    const rows = await this.q(
      `SELECT * FROM edge_marketing_leads
       WHERE email_normalized = $1 AND duplicate_of_lead_id IS NULL
       ORDER BY created_at ASC LIMIT 1`,
      [emailNormalized],
    );
    return rows[0] ? this.mapLead(rows[0]) : null;
  }

  async createLead(input: {
    emailNormalized?: string | null;
    primaryProductId?: string | null;
    verticalId?: string | null;
    sourceType?: string | null;
    sourceCampaignId?: string | null;
    sourceFormId?: string | null;
    status?: string;
    metadata?: Record<string, unknown>;
  }): Promise<MarketingLead> {
    const rows = await this.q(
      `INSERT INTO edge_marketing_leads (
         email_normalized, primary_product_id, vertical_id, source_type,
         source_campaign_id, source_form_id, status, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING *`,
      [
        input.emailNormalized ?? null,
        input.primaryProductId ?? null,
        input.verticalId ?? null,
        input.sourceType ?? null,
        input.sourceCampaignId ?? null,
        input.sourceFormId ?? null,
        input.status ?? 'NEW',
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return this.mapLead(rows[0]);
  }

  async getLead(id: string): Promise<MarketingLead | null> {
    const rows = await this.q(`SELECT * FROM edge_marketing_leads WHERE id = $1`, [id]);
    return rows[0] ? this.mapLead(rows[0]) : null;
  }

  async listLeads(opts?: {
    status?: string;
    productId?: string;
    limit?: number;
  }): Promise<MarketingLead[]> {
    const clauses: string[] = ['duplicate_of_lead_id IS NULL'];
    const params: unknown[] = [];
    if (opts?.status) {
      params.push(opts.status);
      clauses.push(`status = $${params.length}`);
    }
    if (opts?.productId) {
      params.push(opts.productId);
      clauses.push(`primary_product_id = $${params.length}`);
    }
    params.push(opts?.limit ?? 100);
    const rows = await this.q(
      `SELECT * FROM edge_marketing_leads
       WHERE ${clauses.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return rows.map((r) => this.mapLead(r));
  }

  async updateLeadStatus(id: string, status: string): Promise<MarketingLead> {
    const rows = await this.q(
      `UPDATE edge_marketing_leads SET status = $2, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, status],
    );
    return this.mapLead(rows[0]);
  }

  async markLeadDuplicate(id: string, duplicateOfLeadId: string): Promise<MarketingLead> {
    const rows = await this.q(
      `UPDATE edge_marketing_leads
       SET duplicate_of_lead_id = $2, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, duplicateOfLeadId],
    );
    return this.mapLead(rows[0]);
  }

  async createLeadContact(input: {
    leadId: string;
    fullName?: string | null;
    jobTitle?: string | null;
    email?: string | null;
    emailNormalized?: string | null;
    phone?: string | null;
    preferredChannel?: string | null;
  }) {
    const rows = await this.q(
      `INSERT INTO edge_marketing_lead_contacts (
         lead_id, full_name, job_title, email, email_normalized, phone, preferred_channel
       ) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        input.leadId,
        input.fullName ?? null,
        input.jobTitle ?? null,
        input.email ?? null,
        input.emailNormalized ?? null,
        input.phone ?? null,
        input.preferredChannel ?? null,
      ],
    );
    return { id: String(rows[0].id) };
  }

  async createLeadActivity(input: {
    leadId: string;
    activityType: string;
    campaignId?: string | null;
    formSubmissionId?: string | null;
    payload?: Record<string, unknown>;
  }) {
    const rows = await this.q(
      `INSERT INTO edge_marketing_lead_activities (
         lead_id, activity_type, campaign_id, form_submission_id, payload
       ) VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING id`,
      [
        input.leadId,
        input.activityType,
        input.campaignId ?? null,
        input.formSubmissionId ?? null,
        JSON.stringify(input.payload ?? {}),
      ],
    );
    return { id: String(rows[0].id) };
  }

  async createLeadConsent(input: {
    leadId: string;
    purpose: string;
    channel: string;
    state: string;
    source: string;
    consentTextVersion: string;
    proofRef?: string | null;
  }) {
    const rows = await this.q(
      `INSERT INTO edge_marketing_lead_consents (
         lead_id, purpose, channel, state, granted_at, withdrawn_at, source,
         consent_text_version, proof_ref
       ) VALUES (
         $1,$2,$3,$4,
         CASE WHEN $4 = 'GRANTED' THEN NOW() ELSE NULL END,
         CASE WHEN $4 = 'WITHDRAWN' THEN NOW() ELSE NULL END,
         $5,$6,$7
       ) RETURNING id`,
      [
        input.leadId,
        input.purpose,
        input.channel,
        input.state,
        input.source,
        input.consentTextVersion,
        input.proofRef ?? null,
      ],
    );
    return { id: String(rows[0].id) };
  }

  async listLeadConsents(leadId: string) {
    const rows = await this.q(
      `SELECT purpose, channel, state, withdrawn_at
       FROM edge_marketing_lead_consents WHERE lead_id = $1
       ORDER BY created_at DESC`,
      [leadId],
    );
    return rows.map((r) => ({
      purpose: String(r.purpose),
      channel: String(r.channel),
      state: String(r.state),
      withdrawnAt: r.withdrawn_at ? new Date(String(r.withdrawn_at)) : null,
    }));
  }

  async getActiveScoringModel(code = 'DEFAULT_MQL'): Promise<MarketingScoringModel | null> {
    const rows = await this.q(
      `SELECT * FROM edge_marketing_scoring_models
       WHERE code = $1 AND status = 'ACTIVE'
       ORDER BY version DESC LIMIT 1`,
      [code],
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      version: Number(r.version),
      status: String(r.status),
      weights: (r.weights as Record<string, unknown>) ?? {},
    };
  }

  async createLeadScore(input: {
    leadId: string;
    modelId: string;
    modelVersion: number;
    score: string;
    explanation: Record<string, unknown>;
    missingSignals: unknown[];
  }) {
    const rows = await this.q(
      `INSERT INTO edge_marketing_lead_scores (
         lead_id, model_id, model_version, score, explanation, missing_signals
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb) RETURNING id, score`,
      [
        input.leadId,
        input.modelId,
        input.modelVersion,
        input.score,
        JSON.stringify(input.explanation),
        JSON.stringify(input.missingSignals),
      ],
    );
    return { id: String(rows[0].id), score: String(rows[0].score) };
  }

  async createBudget(input: {
    code: string;
    name: string;
    scopeType: string;
    currency: string;
    plannedAmount: string;
    productId?: string | null;
    verticalId?: string | null;
    campaignId?: string | null;
  }): Promise<MarketingBudget> {
    const rows = await this.q(
      `INSERT INTO edge_marketing_budgets (
         code, name, scope_type, currency, planned_amount, product_id, vertical_id, campaign_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        input.code,
        input.name,
        input.scopeType,
        input.currency,
        input.plannedAmount,
        input.productId ?? null,
        input.verticalId ?? null,
        input.campaignId ?? null,
      ],
    );
    const r = rows[0];
    return {
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      scopeType: String(r.scope_type),
      currency: String(r.currency),
      plannedAmount: String(r.planned_amount),
      committedAmount: String(r.committed_amount),
      spentAmount: String(r.spent_amount),
      spentSource: String(r.spent_source),
      status: String(r.status),
    };
  }

  async listBudgets(): Promise<MarketingBudget[]> {
    const rows = await this.q(
      `SELECT * FROM edge_marketing_budgets ORDER BY created_at DESC`,
    );
    return rows.map((r) => ({
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      scopeType: String(r.scope_type),
      currency: String(r.currency),
      plannedAmount: String(r.planned_amount),
      committedAmount: String(r.committed_amount),
      spentAmount: String(r.spent_amount),
      spentSource: String(r.spent_source),
      status: String(r.status),
    }));
  }

  async createAttributionTouchpoint(input: {
    leadId?: string | null;
    campaignId?: string | null;
    touchType: string;
    channel?: string | null;
    utm?: Record<string, unknown>;
    referrer?: string | null;
    dataQuality?: string;
  }) {
    const rows = await this.q(
      `INSERT INTO edge_marketing_attribution_touchpoints (
         lead_id, campaign_id, touch_type, channel, utm, referrer, data_quality
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7) RETURNING id`,
      [
        input.leadId ?? null,
        input.campaignId ?? null,
        input.touchType,
        input.channel ?? null,
        JSON.stringify(input.utm ?? {}),
        input.referrer ?? null,
        input.dataQuality ?? 'MEASURED',
      ],
    );
    return { id: String(rows[0].id) };
  }

  async createContent(input: {
    code: string;
    name: string;
    contentType: string;
    productId?: string | null;
    verticalId?: string | null;
    locale?: string;
    body?: Record<string, unknown>;
    createdBy?: string | null;
  }) {
    const rows = await this.q(
      `INSERT INTO edge_marketing_contents (
         code, name, content_type, product_id, vertical_id, locale, body, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) RETURNING *`,
      [
        input.code,
        input.name,
        input.contentType,
        input.productId ?? null,
        input.verticalId ?? null,
        input.locale ?? 'en',
        JSON.stringify(input.body ?? {}),
        input.createdBy ?? null,
      ],
    );
    return this.mapContent(rows[0]);
  }

  async listContents(opts?: { productId?: string }) {
    const params: unknown[] = [];
    let where = '';
    if (opts?.productId) {
      params.push(opts.productId);
      where = 'WHERE product_id = $1';
    }
    const rows = await this.q(
      `SELECT * FROM edge_marketing_contents ${where} ORDER BY created_at DESC`,
      params,
    );
    return rows.map((r) => this.mapContent(r));
  }

  async getContent(id: string) {
    const rows = await this.q(`SELECT * FROM edge_marketing_contents WHERE id = $1`, [id]);
    return rows[0] ? this.mapContent(rows[0]) : null;
  }

  async updateContentStatus(id: string, status: string) {
    const rows = await this.q(
      `UPDATE edge_marketing_contents
       SET status = $2, version = version + 1, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, status],
    );
    return this.mapContent(rows[0]);
  }

  async updateContentBody(id: string, body: Record<string, unknown>) {
    const rows = await this.q(
      `UPDATE edge_marketing_contents
       SET body = $2::jsonb, version = version + 1, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, JSON.stringify(body)],
    );
    return this.mapContent(rows[0]);
  }

  private mapContent(r: Record<string, unknown>) {
    return {
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      contentType: String(r.content_type),
      productId: (r.product_id as string | null) ?? null,
      verticalId: (r.vertical_id as string | null) ?? null,
      locale: String(r.locale),
      status: String(r.status),
      version: Number(r.version),
      body: (r.body as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  async createLandingPage(input: {
    code: string;
    name: string;
    pageType: string;
    slug: string;
    productId?: string | null;
    campaignId?: string | null;
    formId?: string | null;
    locale?: string;
    layout?: Record<string, unknown>;
    seo?: Record<string, unknown>;
    cta?: Record<string, unknown>;
    createdBy?: string | null;
  }) {
    const rows = await this.q(
      `INSERT INTO edge_marketing_landing_pages (
         code, name, page_type, slug, product_id, campaign_id, form_id, locale,
         layout, seo, cta, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12)
       RETURNING *`,
      [
        input.code,
        input.name,
        input.pageType,
        input.slug,
        input.productId ?? null,
        input.campaignId ?? null,
        input.formId ?? null,
        input.locale ?? 'en',
        JSON.stringify(input.layout ?? {}),
        JSON.stringify(input.seo ?? {}),
        JSON.stringify(input.cta ?? {}),
        input.createdBy ?? null,
      ],
    );
    return this.mapLanding(rows[0]);
  }

  async listLandingPages(opts?: { productId?: string }) {
    const params: unknown[] = [];
    let where = '';
    if (opts?.productId) {
      params.push(opts.productId);
      where = 'WHERE product_id = $1';
    }
    const rows = await this.q(
      `SELECT * FROM edge_marketing_landing_pages ${where} ORDER BY created_at DESC`,
      params,
    );
    return rows.map((r) => this.mapLanding(r));
  }

  async getLandingPage(id: string) {
    const rows = await this.q(`SELECT * FROM edge_marketing_landing_pages WHERE id = $1`, [id]);
    return rows[0] ? this.mapLanding(rows[0]) : null;
  }

  async getLandingPageBySlug(slug: string) {
    const rows = await this.q(
      `SELECT * FROM edge_marketing_landing_pages WHERE slug = $1`,
      [slug],
    );
    return rows[0] ? this.mapLanding(rows[0]) : null;
  }

  async updateLandingPageStatus(id: string, status: string, publishedAt?: Date | null) {
    const rows = await this.q(
      `UPDATE edge_marketing_landing_pages
       SET status = $2,
           published_at = COALESCE($3, published_at),
           version = version + 1,
           updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, status, publishedAt ?? null],
    );
    return this.mapLanding(rows[0]);
  }

  async updateLandingPageLayout(id: string, layout: Record<string, unknown>) {
    const rows = await this.q(
      `UPDATE edge_marketing_landing_pages
       SET layout = $2::jsonb, version = version + 1, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, JSON.stringify(layout)],
    );
    return this.mapLanding(rows[0]);
  }

  async getLeadPrimaryPhone(leadId: string) {
    const rows = await this.q(
      `SELECT phone FROM edge_marketing_lead_contacts
       WHERE lead_id = $1 AND phone IS NOT NULL AND phone <> ''
       ORDER BY created_at ASC
       LIMIT 1`,
      [leadId],
    );
    return rows[0]?.phone ? String(rows[0].phone) : null;
  }

  private mapLanding(r: Record<string, unknown>) {
    return {
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      pageType: String(r.page_type),
      slug: String(r.slug),
      productId: (r.product_id as string | null) ?? null,
      campaignId: (r.campaign_id as string | null) ?? null,
      formId: (r.form_id as string | null) ?? null,
      locale: String(r.locale),
      status: String(r.status),
      version: Number(r.version),
      layout: (r.layout as Record<string, unknown>) ?? {},
      seo: (r.seo as Record<string, unknown>) ?? {},
      cta: (r.cta as Record<string, unknown>) ?? {},
      publishedAt: r.published_at ? new Date(String(r.published_at)) : null,
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  async listChannelConfigs() {
    const rows = await this.q(
      `SELECT * FROM edge_marketing_channel_configs ORDER BY created_at DESC`,
    );
    return rows.map((r) => this.mapChannel(r));
  }

  async upsertChannelConfig(input: {
    code: string;
    channelType: string;
    displayName: string;
    status?: string;
    providerRef?: string | null;
    secretRef?: string | null;
    settings?: Record<string, unknown>;
  }) {
    const rows = await this.q(
      `INSERT INTO edge_marketing_channel_configs (
         code, channel_type, display_name, status, provider_ref, secret_ref, settings
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       ON CONFLICT (code) DO UPDATE SET
         channel_type = EXCLUDED.channel_type,
         display_name = EXCLUDED.display_name,
         status = EXCLUDED.status,
         provider_ref = EXCLUDED.provider_ref,
         secret_ref = EXCLUDED.secret_ref,
         settings = EXCLUDED.settings,
         updated_at = NOW()
       RETURNING *`,
      [
        input.code,
        input.channelType,
        input.displayName,
        input.status ?? 'DISABLED',
        input.providerRef ?? null,
        input.secretRef ?? null,
        JSON.stringify(input.settings ?? {}),
      ],
    );
    return this.mapChannel(rows[0]);
  }

  async getChannelConfig(id: string) {
    const rows = await this.q(
      `SELECT * FROM edge_marketing_channel_configs WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.mapChannel(rows[0]) : null;
  }

  private mapChannel(r: Record<string, unknown>) {
    return {
      id: String(r.id),
      code: String(r.code),
      channelType: String(r.channel_type),
      displayName: String(r.display_name),
      status: String(r.status),
      providerRef: (r.provider_ref as string | null) ?? null,
      secretRef: (r.secret_ref as string | null) ?? null,
      settings: (r.settings as Record<string, unknown>) ?? {},
    };
  }

  async createMessageTemplate(input: {
    code: string;
    name: string;
    channelType: string;
    locale?: string;
    subject?: string | null;
    body?: Record<string, unknown>;
    createdBy?: string | null;
  }) {
    const rows = await this.q(
      `INSERT INTO edge_marketing_message_templates (
         code, name, channel_type, locale, subject, body, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7) RETURNING *`,
      [
        input.code,
        input.name,
        input.channelType,
        input.locale ?? 'en',
        input.subject ?? null,
        JSON.stringify(input.body ?? {}),
        input.createdBy ?? null,
      ],
    );
    return this.mapMessageTemplate(rows[0]);
  }

  async listMessageTemplates() {
    const rows = await this.q(
      `SELECT * FROM edge_marketing_message_templates ORDER BY created_at DESC`,
    );
    return rows.map((r) => this.mapMessageTemplate(r));
  }

  async getMessageTemplate(id: string) {
    const rows = await this.q(
      `SELECT * FROM edge_marketing_message_templates WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.mapMessageTemplate(rows[0]) : null;
  }

  private mapMessageTemplate(r: Record<string, unknown>) {
    return {
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      channelType: String(r.channel_type),
      locale: String(r.locale),
      subject: (r.subject as string | null) ?? null,
      body: (r.body as Record<string, unknown>) ?? {},
      status: String(r.status),
      version: Number(r.version),
    };
  }

  async createDeliveryAttempt(input: {
    channelConfigId?: string | null;
    templateId?: string | null;
    campaignId?: string | null;
    leadId?: string | null;
    journeyExecutionId?: string | null;
    status?: string;
    idempotencyKey?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const rows = await this.q(
      `INSERT INTO edge_marketing_delivery_attempts (
         channel_config_id, template_id, campaign_id, lead_id, journey_execution_id,
         status, idempotency_key, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING *`,
      [
        input.channelConfigId ?? null,
        input.templateId ?? null,
        input.campaignId ?? null,
        input.leadId ?? null,
        input.journeyExecutionId ?? null,
        input.status ?? 'REQUESTED',
        input.idempotencyKey ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return this.mapDelivery(rows[0]);
  }

  async findDeliveryByIdempotency(key: string) {
    const rows = await this.q(
      `SELECT * FROM edge_marketing_delivery_attempts WHERE idempotency_key = $1`,
      [key],
    );
    return rows[0] ? this.mapDelivery(rows[0]) : null;
  }

  async findDeliveryByProviderMessageId(providerMessageId: string) {
    const rows = await this.q(
      `SELECT * FROM edge_marketing_delivery_attempts
       WHERE provider_message_id = $1
       ORDER BY requested_at DESC
       LIMIT 1`,
      [providerMessageId],
    );
    return rows[0] ? this.mapDelivery(rows[0]) : null;
  }

  async getDeliveryAttempt(id: string) {
    const rows = await this.q(
      `SELECT * FROM edge_marketing_delivery_attempts WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.mapDelivery(rows[0]) : null;
  }

  async updateDeliveryAttemptStatus(input: {
    id: string;
    status: string;
    providerMessageId?: string | null;
    failureCode?: string | null;
    failureMessage?: string | null;
    submittedAt?: Date | null;
    terminalAt?: Date | null;
  }) {
    const rows = await this.q(
      `UPDATE edge_marketing_delivery_attempts SET
         status = $2,
         provider_message_id = COALESCE($3, provider_message_id),
         failure_code = COALESCE($4, failure_code),
         failure_message = COALESCE($5, failure_message),
         submitted_at = COALESCE($6, submitted_at),
         terminal_at = COALESCE($7, terminal_at)
       WHERE id = $1 RETURNING *`,
      [
        input.id,
        input.status,
        input.providerMessageId ?? null,
        input.failureCode ?? null,
        input.failureMessage ?? null,
        input.submittedAt ?? null,
        input.terminalAt ?? null,
      ],
    );
    return this.mapDelivery(rows[0]);
  }

  private mapDelivery(r: Record<string, unknown>) {
    return {
      id: String(r.id),
      channelConfigId: (r.channel_config_id as string | null) ?? null,
      templateId: (r.template_id as string | null) ?? null,
      campaignId: (r.campaign_id as string | null) ?? null,
      leadId: (r.lead_id as string | null) ?? null,
      journeyExecutionId: (r.journey_execution_id as string | null) ?? null,
      status: String(r.status),
      providerMessageId: (r.provider_message_id as string | null) ?? null,
      idempotencyKey: (r.idempotency_key as string | null) ?? null,
      requestedAt: new Date(String(r.requested_at)),
    };
  }

  async createDeliveryReceipt(input: {
    deliveryAttemptId: string;
    providerEventId?: string | null;
    receiptStatus: string;
    rawPayload?: Record<string, unknown>;
    signatureValid: boolean;
  }) {
    const rows = await this.q(
      `INSERT INTO edge_marketing_delivery_receipts (
         delivery_attempt_id, provider_event_id, receipt_status, raw_payload, signature_valid
       ) VALUES ($1,$2,$3,$4::jsonb,$5) RETURNING id`,
      [
        input.deliveryAttemptId,
        input.providerEventId ?? null,
        input.receiptStatus,
        JSON.stringify(input.rawPayload ?? {}),
        input.signatureValid,
      ],
    );
    return { id: String(rows[0].id) };
  }

  async findDeliveryReceiptByProviderEventId(providerEventId: string) {
    const rows = await this.q(
      `SELECT id, delivery_attempt_id, receipt_status
       FROM edge_marketing_delivery_receipts
       WHERE provider_event_id = $1
       LIMIT 1`,
      [providerEventId],
    );
    if (!rows[0]) return null;
    return {
      id: String(rows[0].id),
      deliveryAttemptId: String(rows[0].delivery_attempt_id),
      receiptStatus: String(rows[0].receipt_status),
    };
  }

  async isSuppressed(emailNormalized: string | null, channel: string) {
    if (!emailNormalized) return false;
    const rows = await this.q(
      `SELECT 1 FROM edge_marketing_suppressions
       WHERE active = TRUE AND email_normalized = $1 AND channel = $2 LIMIT 1`,
      [emailNormalized, channel],
    );
    return rows.length > 0;
  }

  async createSuppression(input: {
    emailNormalized?: string | null;
    leadId?: string | null;
    channel: string;
    reason: string;
  }) {
    const rows = await this.q(
      `INSERT INTO edge_marketing_suppressions (
         email_normalized, lead_id, channel, reason
       ) VALUES ($1,$2,$3,$4) RETURNING id`,
      [input.emailNormalized ?? null, input.leadId ?? null, input.channel, input.reason],
    );
    return { id: String(rows[0].id) };
  }

  async createJourney(input: {
    code: string;
    name: string;
    description?: string | null;
    productId?: string | null;
    triggerType: string;
    definition: Record<string, unknown>;
    createdBy?: string | null;
  }) {
    const rows = await this.q(
      `INSERT INTO edge_marketing_journeys (
         code, name, description, product_id, trigger_type, definition, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7) RETURNING *`,
      [
        input.code,
        input.name,
        input.description ?? null,
        input.productId ?? null,
        input.triggerType,
        JSON.stringify(input.definition),
        input.createdBy ?? null,
      ],
    );
    return this.mapJourney(rows[0]);
  }

  async listJourneys() {
    const rows = await this.q(`SELECT * FROM edge_marketing_journeys ORDER BY created_at DESC`);
    return rows.map((r) => this.mapJourney(r));
  }

  async getJourney(id: string) {
    const rows = await this.q(`SELECT * FROM edge_marketing_journeys WHERE id = $1`, [id]);
    return rows[0] ? this.mapJourney(rows[0]) : null;
  }

  async updateJourneyStatus(id: string, status: string) {
    const rows = await this.q(
      `UPDATE edge_marketing_journeys
       SET status = $2, version = version + 1, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, status],
    );
    return this.mapJourney(rows[0]);
  }

  private mapJourney(r: Record<string, unknown>) {
    return {
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      description: (r.description as string | null) ?? null,
      productId: (r.product_id as string | null) ?? null,
      triggerType: String(r.trigger_type),
      status: String(r.status),
      version: Number(r.version),
      definition: (r.definition as Record<string, unknown>) ?? { steps: [] },
    };
  }

  async createJourneyExecution(input: {
    journeyId: string;
    journeyVersion: number;
    leadId: string;
    idempotencyKey: string;
    currentStepKey?: string | null;
    status?: string;
  }) {
    const rows = await this.q(
      `INSERT INTO edge_marketing_journey_executions (
         journey_id, journey_version, lead_id, idempotency_key, current_step_key, status
       ) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        input.journeyId,
        input.journeyVersion,
        input.leadId,
        input.idempotencyKey,
        input.currentStepKey ?? null,
        input.status ?? 'RUNNING',
      ],
    );
    return this.mapJourneyExecution(rows[0]);
  }

  async findJourneyExecutionByIdempotency(key: string) {
    const rows = await this.q(
      `SELECT * FROM edge_marketing_journey_executions WHERE idempotency_key = $1`,
      [key],
    );
    return rows[0] ? this.mapJourneyExecution(rows[0]) : null;
  }

  async updateJourneyExecution(input: {
    id: string;
    status: string;
    currentStepKey?: string | null;
    completedAt?: Date | null;
  }) {
    const rows = await this.q(
      `UPDATE edge_marketing_journey_executions SET
         status = $2,
         current_step_key = COALESCE($3, current_step_key),
         completed_at = COALESCE($4, completed_at)
       WHERE id = $1 RETURNING *`,
      [input.id, input.status, input.currentStepKey ?? null, input.completedAt ?? null],
    );
    return this.mapJourneyExecution(rows[0]);
  }

  private mapJourneyExecution(r: Record<string, unknown>) {
    return {
      id: String(r.id),
      journeyId: String(r.journey_id),
      journeyVersion: Number(r.journey_version),
      leadId: String(r.lead_id),
      status: String(r.status),
      currentStepKey: (r.current_step_key as string | null) ?? null,
      idempotencyKey: String(r.idempotency_key),
      startedAt: new Date(String(r.started_at)),
      completedAt: r.completed_at ? new Date(String(r.completed_at)) : null,
    };
  }

  async recordJourneyStep(input: {
    executionId: string;
    stepKey: string;
    stepType: string;
    status: string;
    result?: Record<string, unknown>;
  }) {
    const rows = await this.q(
      `INSERT INTO edge_marketing_journey_execution_steps (
         execution_id, step_key, step_type, status, result, executed_at
       ) VALUES ($1,$2,$3,$4,$5::jsonb, NOW())
       ON CONFLICT (execution_id, step_key) DO UPDATE SET
         status = EXCLUDED.status,
         result = EXCLUDED.result,
         executed_at = NOW()
       RETURNING id`,
      [
        input.executionId,
        input.stepKey,
        input.stepType,
        input.status,
        JSON.stringify(input.result ?? {}),
      ],
    );
    return { id: String(rows[0].id) };
  }

  async listTouchpointsForLead(leadId: string) {
    const rows = await this.q(
      `SELECT id, campaign_id, channel, occurred_at
       FROM edge_marketing_attribution_touchpoints
       WHERE lead_id = $1 ORDER BY occurred_at ASC`,
      [leadId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      campaignId: (r.campaign_id as string | null) ?? null,
      channel: (r.channel as string | null) ?? null,
      occurredAt: new Date(String(r.occurred_at)),
    }));
  }

  async getAttributionModel(code: string) {
    const rows = await this.q(
      `SELECT * FROM edge_marketing_attribution_models
       WHERE code = $1 AND status = 'ACTIVE' ORDER BY version DESC LIMIT 1`,
      [code],
    );
    return rows[0] ? this.mapAttrModel(rows[0]) : null;
  }

  async listAttributionModels() {
    const rows = await this.q(
      `SELECT * FROM edge_marketing_attribution_models ORDER BY code, version DESC`,
    );
    return rows.map((r) => this.mapAttrModel(r));
  }

  private mapAttrModel(r: Record<string, unknown>) {
    return {
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      modelType: String(r.model_type),
      version: Number(r.version),
      status: String(r.status),
      parameters: (r.parameters as Record<string, unknown>) ?? {},
    };
  }

  async saveAttributionResult(input: {
    modelId: string;
    modelVersion: number;
    leadId: string;
    conversionKey: string;
    credits: unknown[];
    dataQuality: string;
  }) {
    const rows = await this.q(
      `INSERT INTO edge_marketing_attribution_results (
         model_id, model_version, lead_id, conversion_key, credits, data_quality
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6)
       ON CONFLICT (model_id, model_version, lead_id, conversion_key) DO UPDATE SET
         credits = EXCLUDED.credits,
         data_quality = EXCLUDED.data_quality,
         calculated_at = NOW()
       RETURNING id`,
      [
        input.modelId,
        input.modelVersion,
        input.leadId,
        input.conversionKey,
        JSON.stringify(input.credits),
        input.dataQuality,
      ],
    );
    return { id: String(rows[0].id) };
  }

  async createPerformanceSnapshot(input: {
    scopeType: string;
    scopeId?: string | null;
    periodStart: string;
    periodEnd: string;
    metrics: Record<string, unknown>;
    metricQuality: Record<string, unknown>;
  }) {
    const rows = await this.q(
      `INSERT INTO edge_marketing_performance_snapshots (
         scope_type, scope_id, period_start, period_end, metrics, metric_quality
       ) VALUES ($1,$2,$3::date,$4::date,$5::jsonb,$6::jsonb) RETURNING id`,
      [
        input.scopeType,
        input.scopeId ?? null,
        input.periodStart,
        input.periodEnd,
        JSON.stringify(input.metrics),
        JSON.stringify(input.metricQuality),
      ],
    );
    return { id: String(rows[0].id) };
  }

  async listPerformanceSnapshots(opts?: { scopeType?: string }) {
    const params: unknown[] = [];
    let where = '';
    if (opts?.scopeType) {
      params.push(opts.scopeType);
      where = 'WHERE scope_type = $1';
    }
    const rows = await this.q(
      `SELECT id, scope_type, period_start, period_end, metrics, metric_quality
       FROM edge_marketing_performance_snapshots ${where}
       ORDER BY created_at DESC LIMIT 100`,
      params,
    );
    return rows.map((r) => ({
      id: String(r.id),
      scopeType: String(r.scope_type),
      periodStart: String(r.period_start).slice(0, 10),
      periodEnd: String(r.period_end).slice(0, 10),
      metrics: (r.metrics as Record<string, unknown>) ?? {},
      metricQuality: (r.metric_quality as Record<string, unknown>) ?? {},
    }));
  }

  async getFrequencyPolicy(channel: string) {
    const rows = await this.q(
      `SELECT channel, max_per_day, max_per_week
       FROM edge_marketing_frequency_policies
       WHERE channel = $1 AND status = 'ACTIVE' LIMIT 1`,
      [channel],
    );
    if (!rows[0]) return null;
    return {
      channel: String(rows[0].channel),
      maxPerDay: Number(rows[0].max_per_day),
      maxPerWeek: Number(rows[0].max_per_week),
    };
  }

  async getFrequencyCounters(
    leadId: string,
    channel: string,
    dayStart: string,
    weekStart: string,
  ) {
    const day = await this.q(
      `SELECT send_count FROM edge_marketing_frequency_counters
       WHERE lead_id = $1 AND channel = $2 AND window_type = 'DAY' AND window_start = $3::date`,
      [leadId, channel, dayStart],
    );
    const week = await this.q(
      `SELECT send_count FROM edge_marketing_frequency_counters
       WHERE lead_id = $1 AND channel = $2 AND window_type = 'WEEK' AND window_start = $3::date`,
      [leadId, channel, weekStart],
    );
    return {
      dayCount: day[0] ? Number(day[0].send_count) : 0,
      weekCount: week[0] ? Number(week[0].send_count) : 0,
    };
  }

  async incrementFrequencyCounter(
    leadId: string,
    channel: string,
    windowType: 'DAY' | 'WEEK',
    windowStart: string,
  ) {
    await this.q(
      `INSERT INTO edge_marketing_frequency_counters (
         lead_id, channel, window_type, window_start, send_count
       ) VALUES ($1,$2,$3,$4::date,1)
       ON CONFLICT (lead_id, channel, window_type, window_start)
       DO UPDATE SET send_count = edge_marketing_frequency_counters.send_count + 1,
                     updated_at = NOW()`,
      [leadId, channel, windowType, windowStart],
    );
  }

  async scheduleJourneyWait(input: {
    executionId: string;
    stepKey: string;
    resumeAt: Date;
  }) {
    const rows = await this.q(
      `INSERT INTO edge_marketing_journey_wait_schedules (
         execution_id, step_key, resume_at
       ) VALUES ($1,$2,$3)
       ON CONFLICT (execution_id, step_key) DO UPDATE SET
         resume_at = EXCLUDED.resume_at,
         status = 'PENDING',
         resumed_at = NULL
       RETURNING id`,
      [input.executionId, input.stepKey, input.resumeAt.toISOString()],
    );
    return { id: String(rows[0].id) };
  }

  async listDueJourneyWaits(now: Date, limit = 50) {
    const rows = await this.q(
      `SELECT id, execution_id, step_key, resume_at
       FROM edge_marketing_journey_wait_schedules
       WHERE status = 'PENDING' AND resume_at <= $1
       ORDER BY resume_at ASC
       LIMIT $2`,
      [now.toISOString(), limit],
    );
    return rows.map((r) => ({
      id: String(r.id),
      executionId: String(r.execution_id),
      stepKey: String(r.step_key),
      resumeAt: new Date(String(r.resume_at)),
    }));
  }

  async markJourneyWaitResumed(id: string) {
    await this.q(
      `UPDATE edge_marketing_journey_wait_schedules
       SET status = 'RESUMED', resumed_at = NOW()
       WHERE id = $1`,
      [id],
    );
  }

  async getJourneyExecution(id: string) {
    const rows = await this.q(
      `SELECT * FROM edge_marketing_journey_executions WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.mapJourneyExecution(rows[0]) : null;
  }

  async assignLead(leadId: string, assignedTo: string) {
    const rows = await this.q(
      `UPDATE edge_marketing_leads
       SET assigned_to = $2, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [leadId, assignedTo],
    );
    return this.mapLead(rows[0]);
  }

  async mergeLeadDuplicate(input: {
    keepLeadId: string;
    duplicateLeadId: string;
  }) {
    if (input.keepLeadId === input.duplicateLeadId) {
      const keep = await this.getLead(input.keepLeadId);
      if (!keep) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Lead not found');
      return keep;
    }
    await this.q(
      `UPDATE edge_marketing_lead_activities SET lead_id = $1 WHERE lead_id = $2`,
      [input.keepLeadId, input.duplicateLeadId],
    );
    await this.q(
      `UPDATE edge_marketing_lead_consents SET lead_id = $1 WHERE lead_id = $2`,
      [input.keepLeadId, input.duplicateLeadId],
    );
    await this.q(
      `UPDATE edge_marketing_form_submissions SET lead_id = $1 WHERE lead_id = $2`,
      [input.keepLeadId, input.duplicateLeadId],
    );
    await this.q(
      `UPDATE edge_marketing_attribution_touchpoints SET lead_id = $1 WHERE lead_id = $2`,
      [input.keepLeadId, input.duplicateLeadId],
    );
    return this.markLeadDuplicate(input.duplicateLeadId, input.keepLeadId);
  }
}
