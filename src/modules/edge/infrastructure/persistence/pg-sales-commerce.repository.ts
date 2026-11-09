import { Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  DiscountPolicy,
  DiscountRequest,
  NeedsAssessment,
  OfferConfiguration,
  SalesActivity,
  SalesApproval,
  SalesCommerceRepositoryPort,
  SalesContract,
  SalesHandoff,
  SalesOrder,
  SalesProposal,
  SalesQuote,
} from '../../domain/ports/sales-commerce-repository.port.js';

@Injectable()
export class PgSalesCommerceRepository implements SalesCommerceRepositoryPort {
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

  private mapActivity(r: Record<string, unknown>): SalesActivity {
    return {
      id: String(r.id),
      activityType: String(r.activity_type),
      subject: String(r.subject),
      description: (r.description as string | null) ?? null,
      status: String(r.status),
      accountId: (r.account_id as string | null) ?? null,
      contactId: (r.contact_id as string | null) ?? null,
      salesLeadId: (r.sales_lead_id as string | null) ?? null,
      opportunityId: (r.opportunity_id as string | null) ?? null,
      ownerAdministratorId: (r.owner_administrator_id as string | null) ?? null,
      scheduledStartAt: r.scheduled_start_at ? new Date(String(r.scheduled_start_at)) : null,
      scheduledEndAt: r.scheduled_end_at ? new Date(String(r.scheduled_end_at)) : null,
      completedAt: r.completed_at ? new Date(String(r.completed_at)) : null,
      outcomeSummary: (r.outcome_summary as string | null) ?? null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
    };
  }

  private mapAssessment(r: Record<string, unknown>): NeedsAssessment {
    return {
      id: String(r.id),
      opportunityId: String(r.opportunity_id),
      accountId: String(r.account_id),
      status: String(r.status),
      templateCode: (r.template_code as string | null) ?? null,
      fitDecision: (r.fit_decision as string | null) ?? null,
      uncoveredNeeds: (r.uncovered_needs as unknown[]) ?? [],
      gapAnalysis: (r.gap_analysis as unknown[]) ?? [],
      functionalRequirements: (r.functional_requirements as unknown[]) ?? [],
      technicalRequirements: (r.technical_requirements as unknown[]) ?? [],
      recommendations: (r.recommendations as string | null) ?? null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapOffer(r: Record<string, unknown>): OfferConfiguration {
    return {
      id: String(r.id),
      opportunityId: String(r.opportunity_id),
      accountId: String(r.account_id),
      version: Number(r.version),
      status: String(r.status),
      productId: String(r.product_id),
      planId: (r.plan_id as string | null) ?? null,
      solutionPackageId: (r.solution_package_id as string | null) ?? null,
      addonIds: (r.addon_ids as unknown[]) ?? [],
      currency: String(r.currency),
      listAmount: r.list_amount != null ? String(r.list_amount) : null,
      netAmount: r.net_amount != null ? String(r.net_amount) : null,
      eligibilityDecision: (r.eligibility_decision as string | null) ?? null,
      p2Snapshot: (r.p2_snapshot as Record<string, unknown>) ?? {},
      configuratorResult: (r.configurator_result as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
    };
  }

  private mapQuote(r: Record<string, unknown>): SalesQuote {
    return {
      id: String(r.id),
      quoteNumber: String(r.quote_number),
      accountId: String(r.account_id),
      opportunityId: String(r.opportunity_id),
      contactId: (r.contact_id as string | null) ?? null,
      offerConfigurationId: (r.offer_configuration_id as string | null) ?? null,
      status: String(r.status),
      currentVersion: Number(r.current_version),
      currency: String(r.currency),
      subtotalAmount: String(r.subtotal_amount),
      discountAmount: String(r.discount_amount),
      taxAmount: String(r.tax_amount),
      totalAmount: String(r.total_amount),
      validUntil: r.valid_until != null ? String(r.valid_until) : null,
      commercialTerms: (r.commercial_terms as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapProposal(r: Record<string, unknown>): SalesProposal {
    return {
      id: String(r.id),
      proposalNumber: String(r.proposal_number),
      accountId: String(r.account_id),
      opportunityId: String(r.opportunity_id),
      quoteId: (r.quote_id as string | null) ?? null,
      status: String(r.status),
      currentVersion: Number(r.current_version),
      language: String(r.language),
      title: String(r.title),
      sections: (r.sections as unknown[]) ?? [],
      createdAt: new Date(String(r.created_at)),
    };
  }

  private mapDiscountRequest(r: Record<string, unknown>): DiscountRequest {
    return {
      id: String(r.id),
      opportunityId: String(r.opportunity_id),
      quoteId: (r.quote_id as string | null) ?? null,
      accountId: String(r.account_id),
      policyId: (r.policy_id as string | null) ?? null,
      discountType: String(r.discount_type),
      status: String(r.status),
      listAmount: String(r.list_amount),
      requestedAmount: String(r.requested_amount),
      discountPercent: r.discount_percent != null ? String(r.discount_percent) : null,
      currency: String(r.currency),
      justification: String(r.justification),
      requiredApprovalLevel: String(r.required_approval_level),
      requestedBy: String(r.requested_by),
      decidedBy: (r.decided_by as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
    };
  }

  private mapApproval(r: Record<string, unknown>): SalesApproval {
    return {
      id: String(r.id),
      subjectType: String(r.subject_type),
      subjectId: String(r.subject_id),
      approvalType: String(r.approval_type),
      status: String(r.status),
      requiredLevel: String(r.required_level),
      requesterId: String(r.requester_id),
      assigneeId: (r.assignee_id as string | null) ?? null,
      decisionBy: (r.decision_by as string | null) ?? null,
      cannotSelfApprove: Boolean(r.cannot_self_approve),
      createdAt: new Date(String(r.created_at)),
    };
  }

  private mapContract(r: Record<string, unknown>): SalesContract {
    return {
      id: String(r.id),
      contractNumber: String(r.contract_number),
      accountId: String(r.account_id),
      opportunityId: (r.opportunity_id as string | null) ?? null,
      quoteId: (r.quote_id as string | null) ?? null,
      contractType: String(r.contract_type),
      status: String(r.status),
      currentVersion: Number(r.current_version),
      productId: (r.product_id as string | null) ?? null,
      currency: String(r.currency),
      contractValue: r.contract_value != null ? String(r.contract_value) : null,
      commercialTermsSnapshot:
        (r.commercial_terms_snapshot as Record<string, unknown>) ?? {},
      signatureProvider: (r.signature_provider as string | null) ?? null,
      signatureConfirmedAt: r.signature_confirmed_at
        ? new Date(String(r.signature_confirmed_at))
        : null,
      executedAt: r.executed_at ? new Date(String(r.executed_at)) : null,
      createdAt: new Date(String(r.created_at)),
    };
  }

  private mapOrder(r: Record<string, unknown>): SalesOrder {
    return {
      id: String(r.id),
      orderNumber: String(r.order_number),
      accountId: String(r.account_id),
      contractId: (r.contract_id as string | null) ?? null,
      opportunityId: (r.opportunity_id as string | null) ?? null,
      quoteId: (r.quote_id as string | null) ?? null,
      status: String(r.status),
      productId: (r.product_id as string | null) ?? null,
      currency: String(r.currency),
      totalAmount: String(r.total_amount),
      commercialTerms: (r.commercial_terms as Record<string, unknown>) ?? {},
      offerConfiguration: (r.offer_configuration as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
    };
  }

  private mapHandoff(r: Record<string, unknown>): SalesHandoff {
    return {
      id: String(r.id),
      salesOrderId: String(r.sales_order_id),
      accountId: String(r.account_id),
      opportunityId: (r.opportunity_id as string | null) ?? null,
      contractId: (r.contract_id as string | null) ?? null,
      status: String(r.status),
      correlationId: String(r.correlation_id),
      packagePayload: (r.package_payload as Record<string, unknown>) ?? {},
      provisioningConfirmedAt: r.provisioning_confirmed_at
        ? new Date(String(r.provisioning_confirmed_at))
        : null,
      createdAt: new Date(String(r.created_at)),
    };
  }

  async createActivity(input: {
    activityType: string;
    subject: string;
    description?: string | null;
    accountId?: string | null;
    contactId?: string | null;
    salesLeadId?: string | null;
    opportunityId?: string | null;
    ownerAdministratorId?: string | null;
    scheduledStartAt?: string | null;
    scheduledEndAt?: string | null;
    createdBy?: string | null;
  }): Promise<SalesActivity> {
    const rows = await this.q(
      `INSERT INTO edge_sales_activities (
         activity_type, subject, description, account_id, contact_id, sales_lead_id,
         opportunity_id, owner_administrator_id, scheduled_start_at, scheduled_end_at, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        input.activityType,
        input.subject,
        input.description ?? null,
        input.accountId ?? null,
        input.contactId ?? null,
        input.salesLeadId ?? null,
        input.opportunityId ?? null,
        input.ownerAdministratorId ?? null,
        input.scheduledStartAt ?? null,
        input.scheduledEndAt ?? null,
        input.createdBy ?? null,
      ],
    );
    return this.mapActivity(rows[0]!);
  }

  async listActivities(opts?: {
    accountId?: string;
    opportunityId?: string;
    status?: string;
    limit?: number;
  }): Promise<SalesActivity[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_activities
       WHERE ($1::uuid IS NULL OR account_id = $1)
         AND ($2::uuid IS NULL OR opportunity_id = $2)
         AND ($3::text IS NULL OR status = $3)
       ORDER BY COALESCE(scheduled_start_at, created_at) DESC
       LIMIT $4`,
      [opts?.accountId ?? null, opts?.opportunityId ?? null, opts?.status ?? null, opts?.limit ?? 100],
    );
    return rows.map((r) => this.mapActivity(r));
  }

  async completeActivity(id: string, outcomeSummary?: string | null): Promise<SalesActivity> {
    const rows = await this.q(
      `UPDATE edge_sales_activities
       SET status = 'COMPLETED', completed_at = NOW(), outcome_summary = COALESCE($2, outcome_summary),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, outcomeSummary ?? null],
    );
    if (!rows[0]) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Activity not found');
    return this.mapActivity(rows[0]);
  }

  async createNeedsAssessment(input: {
    opportunityId: string;
    accountId: string;
    templateCode?: string | null;
    verticalId?: string | null;
    currentSituation?: string | null;
    objectives?: string | null;
    functionalRequirements?: unknown[];
    technicalRequirements?: unknown[];
    createdBy?: string | null;
  }): Promise<NeedsAssessment> {
    const rows = await this.q(
      `INSERT INTO edge_sales_needs_assessments (
         opportunity_id, account_id, template_code, vertical_id, current_situation, objectives,
         functional_requirements, technical_requirements, created_by, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,'IN_PROGRESS')
       RETURNING *`,
      [
        input.opportunityId,
        input.accountId,
        input.templateCode ?? null,
        input.verticalId ?? null,
        input.currentSituation ?? null,
        input.objectives ?? null,
        JSON.stringify(input.functionalRequirements ?? []),
        JSON.stringify(input.technicalRequirements ?? []),
        input.createdBy ?? null,
      ],
    );
    return this.mapAssessment(rows[0]!);
  }

  async getNeedsAssessment(id: string): Promise<NeedsAssessment | null> {
    const rows = await this.q(`SELECT * FROM edge_sales_needs_assessments WHERE id = $1`, [id]);
    return rows[0] ? this.mapAssessment(rows[0]) : null;
  }

  async listNeedsAssessments(opportunityId: string): Promise<NeedsAssessment[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_needs_assessments WHERE opportunity_id = $1 ORDER BY created_at DESC`,
      [opportunityId],
    );
    return rows.map((r) => this.mapAssessment(r));
  }

  async completeNeedsAssessment(input: {
    id: string;
    fitDecision: string;
    uncoveredNeeds: unknown[];
    gapAnalysis?: unknown[];
    recommendations?: string | null;
  }): Promise<NeedsAssessment> {
    const rows = await this.q(
      `UPDATE edge_sales_needs_assessments
       SET status = 'COMPLETED', fit_decision = $2, uncovered_needs = $3::jsonb,
           gap_analysis = COALESCE($4::jsonb, gap_analysis), recommendations = $5,
           completed_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        input.id,
        input.fitDecision,
        JSON.stringify(input.uncoveredNeeds),
        input.gapAnalysis ? JSON.stringify(input.gapAnalysis) : null,
        input.recommendations ?? null,
      ],
    );
    if (!rows[0]) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Needs assessment not found');
    return this.mapAssessment(rows[0]);
  }

  async createOfferConfiguration(input: {
    opportunityId: string;
    accountId: string;
    version: number;
    productId: string;
    planId?: string | null;
    solutionPackageId?: string | null;
    addonIds?: unknown[];
    currency?: string;
    listAmount?: number | null;
    netAmount?: number | null;
    eligibilityDecision?: string | null;
    p2Snapshot?: Record<string, unknown>;
    configuratorResult?: Record<string, unknown>;
    commercialTerms?: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<OfferConfiguration> {
    const rows = await this.q(
      `INSERT INTO edge_sales_offer_configurations (
         opportunity_id, account_id, version, product_id, plan_id, solution_package_id, addon_ids,
         currency, list_amount, net_amount, eligibility_decision, p2_snapshot, configurator_result,
         commercial_terms, created_by, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15,'VALIDATED')
       RETURNING *`,
      [
        input.opportunityId,
        input.accountId,
        input.version,
        input.productId,
        input.planId ?? null,
        input.solutionPackageId ?? null,
        JSON.stringify(input.addonIds ?? []),
        input.currency ?? 'USD',
        input.listAmount ?? null,
        input.netAmount ?? null,
        input.eligibilityDecision ?? null,
        JSON.stringify(input.p2Snapshot ?? {}),
        JSON.stringify(input.configuratorResult ?? {}),
        JSON.stringify(input.commercialTerms ?? {}),
        input.createdBy ?? null,
      ],
    );
    return this.mapOffer(rows[0]!);
  }

  async listOfferConfigurations(opportunityId: string): Promise<OfferConfiguration[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_offer_configurations WHERE opportunity_id = $1 ORDER BY version DESC`,
      [opportunityId],
    );
    return rows.map((r) => this.mapOffer(r));
  }

  async getOfferConfiguration(id: string): Promise<OfferConfiguration | null> {
    const rows = await this.q(`SELECT * FROM edge_sales_offer_configurations WHERE id = $1`, [id]);
    return rows[0] ? this.mapOffer(rows[0]) : null;
  }

  async nextQuoteNumber(): Promise<string> {
    const rows = await this.q<{ n: string }>(
      `SELECT nextval('edge_sales_quote_number_seq')::text AS n`,
    );
    return `Q-${rows[0]!.n}`;
  }

  async createQuote(input: {
    quoteNumber: string;
    accountId: string;
    opportunityId: string;
    contactId?: string | null;
    offerConfigurationId?: string | null;
    currency?: string;
    subtotalAmount?: number;
    discountAmount?: number;
    taxAmount?: number;
    totalAmount?: number;
    validUntil?: string | null;
    commercialTerms?: Record<string, unknown>;
    lines?: Array<{
      lineNumber: number;
      lineType?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      discountPercent?: number;
      discountAmount?: number;
      lineTotal: number;
      productId?: string | null;
      planId?: string | null;
      packageId?: string | null;
      addonId?: string | null;
      pricingModel?: string | null;
      p2Refs?: Record<string, unknown>;
    }>;
    ownerAdministratorId?: string | null;
    createdBy?: string | null;
  }): Promise<SalesQuote> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const quoteRes = await client.query(
        `INSERT INTO edge_sales_quotes (
           quote_number, account_id, opportunity_id, contact_id, offer_configuration_id,
           currency, subtotal_amount, discount_amount, tax_amount, total_amount, valid_until,
           commercial_terms, owner_administrator_id, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14)
         RETURNING *`,
        [
          input.quoteNumber,
          input.accountId,
          input.opportunityId,
          input.contactId ?? null,
          input.offerConfigurationId ?? null,
          input.currency ?? 'USD',
          input.subtotalAmount ?? 0,
          input.discountAmount ?? 0,
          input.taxAmount ?? 0,
          input.totalAmount ?? 0,
          input.validUntil ?? null,
          JSON.stringify(input.commercialTerms ?? {}),
          input.ownerAdministratorId ?? null,
          input.createdBy ?? null,
        ],
      );
      const quote = quoteRes.rows[0]!;
      await client.query(
        `INSERT INTO edge_sales_quote_versions (
           quote_id, version, status_snapshot, currency, subtotal_amount, discount_amount,
           tax_amount, total_amount, lines, commercial_terms, created_by
         ) VALUES ($1,1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10)`,
        [
          quote.id,
          quote.status,
          quote.currency,
          quote.subtotal_amount,
          quote.discount_amount,
          quote.tax_amount,
          quote.total_amount,
          JSON.stringify(input.lines ?? []),
          JSON.stringify(input.commercialTerms ?? {}),
          input.createdBy ?? null,
        ],
      );
      for (const line of input.lines ?? []) {
        await client.query(
          `INSERT INTO edge_sales_quote_lines (
             quote_id, version, line_number, line_type, product_id, plan_id, package_id, addon_id,
             description, quantity, unit_price, discount_percent, discount_amount, line_total,
             pricing_model, p2_refs
           ) VALUES ($1,1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)`,
          [
            quote.id,
            line.lineNumber,
            line.lineType ?? 'PLAN',
            line.productId ?? null,
            line.planId ?? null,
            line.packageId ?? null,
            line.addonId ?? null,
            line.description,
            line.quantity,
            line.unitPrice,
            line.discountPercent ?? 0,
            line.discountAmount ?? 0,
            line.lineTotal,
            line.pricingModel ?? null,
            JSON.stringify(line.p2Refs ?? {}),
          ],
        );
      }
      await client.query('COMMIT');
      return this.mapQuote(quote);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async getQuote(id: string): Promise<SalesQuote | null> {
    const rows = await this.q(`SELECT * FROM edge_sales_quotes WHERE id = $1`, [id]);
    return rows[0] ? this.mapQuote(rows[0]) : null;
  }

  async listQuotes(opts?: {
    opportunityId?: string;
    accountId?: string;
    status?: string;
    limit?: number;
  }): Promise<SalesQuote[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_quotes
       WHERE ($1::uuid IS NULL OR opportunity_id = $1)
         AND ($2::uuid IS NULL OR account_id = $2)
         AND ($3::text IS NULL OR status = $3)
       ORDER BY created_at DESC
       LIMIT $4`,
      [
        opts?.opportunityId ?? null,
        opts?.accountId ?? null,
        opts?.status ?? null,
        opts?.limit ?? 100,
      ],
    );
    return rows.map((r) => this.mapQuote(r));
  }

  async transitionQuoteStatus(id: string, status: string): Promise<SalesQuote> {
    const rows = await this.q(
      `UPDATE edge_sales_quotes
       SET status = $2,
           issued_at = CASE WHEN $2 = 'ISSUED' THEN NOW() ELSE issued_at END,
           accepted_at = CASE WHEN $2 = 'ACCEPTED' THEN NOW() ELSE accepted_at END,
           rejected_at = CASE WHEN $2 = 'REJECTED' THEN NOW() ELSE rejected_at END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status],
    );
    if (!rows[0]) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Quote not found');
    return this.mapQuote(rows[0]);
  }

  async reviseQuote(input: {
    quoteId: string;
    changeReason: string;
    subtotalAmount: number;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
    commercialTerms?: Record<string, unknown>;
    lines: Array<{
      lineNumber: number;
      lineType?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      discountPercent?: number;
      discountAmount?: number;
      lineTotal: number;
      productId?: string | null;
      planId?: string | null;
      packageId?: string | null;
      addonId?: string | null;
      pricingModel?: string | null;
      p2Refs?: Record<string, unknown>;
    }>;
    createdBy?: string | null;
  }): Promise<SalesQuote> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        `SELECT * FROM edge_sales_quotes WHERE id = $1 FOR UPDATE`,
        [input.quoteId],
      );
      if (!current.rows[0]) {
        throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Quote not found');
      }
      const nextVersion = Number(current.rows[0].current_version) + 1;
      const updated = await client.query(
        `UPDATE edge_sales_quotes
         SET current_version = $2, status = 'DRAFT',
             subtotal_amount = $3, discount_amount = $4, tax_amount = $5, total_amount = $6,
             commercial_terms = COALESCE($7::jsonb, commercial_terms),
             issued_at = NULL, accepted_at = NULL, rejected_at = NULL, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          input.quoteId,
          nextVersion,
          input.subtotalAmount,
          input.discountAmount,
          input.taxAmount,
          input.totalAmount,
          input.commercialTerms ? JSON.stringify(input.commercialTerms) : null,
        ],
      );
      await client.query(
        `INSERT INTO edge_sales_quote_versions (
           quote_id, version, status_snapshot, currency, subtotal_amount, discount_amount,
           tax_amount, total_amount, lines, commercial_terms, change_reason, created_by
         ) VALUES ($1,$2,'DRAFT',$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11)`,
        [
          input.quoteId,
          nextVersion,
          updated.rows[0].currency,
          input.subtotalAmount,
          input.discountAmount,
          input.taxAmount,
          input.totalAmount,
          JSON.stringify(input.lines),
          JSON.stringify(input.commercialTerms ?? updated.rows[0].commercial_terms ?? {}),
          input.changeReason,
          input.createdBy ?? null,
        ],
      );
      for (const line of input.lines) {
        await client.query(
          `INSERT INTO edge_sales_quote_lines (
             quote_id, version, line_number, line_type, product_id, plan_id, package_id, addon_id,
             description, quantity, unit_price, discount_percent, discount_amount, line_total,
             pricing_model, p2_refs
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)`,
          [
            input.quoteId,
            nextVersion,
            line.lineNumber,
            line.lineType ?? 'PLAN',
            line.productId ?? null,
            line.planId ?? null,
            line.packageId ?? null,
            line.addonId ?? null,
            line.description,
            line.quantity,
            line.unitPrice,
            line.discountPercent ?? 0,
            line.discountAmount ?? 0,
            line.lineTotal,
            line.pricingModel ?? null,
            JSON.stringify(line.p2Refs ?? {}),
          ],
        );
      }
      await client.query('COMMIT');
      return this.mapQuote(updated.rows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async hasAcceptedQuoteForOpportunity(opportunityId: string): Promise<boolean> {
    const rows = await this.q<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_sales_quotes
       WHERE opportunity_id = $1 AND status = 'ACCEPTED'`,
      [opportunityId],
    );
    return Number(rows[0]?.c ?? 0) > 0;
  }

  async nextProposalNumber(): Promise<string> {
    const rows = await this.q<{ n: string }>(
      `SELECT nextval('edge_sales_proposal_number_seq')::text AS n`,
    );
    return `P-${rows[0]!.n}`;
  }

  async createProposal(input: {
    proposalNumber: string;
    accountId: string;
    opportunityId: string;
    quoteId?: string | null;
    title: string;
    language?: string;
    templateCode?: string | null;
    sections?: unknown[];
    createdBy?: string | null;
  }): Promise<SalesProposal> {
    const rows = await this.q(
      `INSERT INTO edge_sales_proposals (
         proposal_number, account_id, opportunity_id, quote_id, title, language, template_code,
         sections, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
       RETURNING *`,
      [
        input.proposalNumber,
        input.accountId,
        input.opportunityId,
        input.quoteId ?? null,
        input.title,
        input.language ?? 'fr',
        input.templateCode ?? null,
        JSON.stringify(input.sections ?? []),
        input.createdBy ?? null,
      ],
    );
    await this.q(
      `INSERT INTO edge_sales_proposal_versions (proposal_id, version, title, sections, created_by)
       VALUES ($1,1,$2,$3::jsonb,$4)`,
      [rows[0]!.id, input.title, JSON.stringify(input.sections ?? []), input.createdBy ?? null],
    );
    return this.mapProposal(rows[0]!);
  }

  async listProposals(opportunityId?: string): Promise<SalesProposal[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_proposals
       WHERE ($1::uuid IS NULL OR opportunity_id = $1)
       ORDER BY created_at DESC`,
      [opportunityId ?? null],
    );
    return rows.map((r) => this.mapProposal(r));
  }

  async getProposal(id: string): Promise<SalesProposal | null> {
    const rows = await this.q(`SELECT * FROM edge_sales_proposals WHERE id = $1`, [id]);
    return rows[0] ? this.mapProposal(rows[0]) : null;
  }

  async issueProposal(id: string): Promise<SalesProposal> {
    const rows = await this.q(
      `UPDATE edge_sales_proposals
       SET status = 'ISSUED', issued_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id],
    );
    if (!rows[0]) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Proposal not found');
    return this.mapProposal(rows[0]);
  }

  async getActiveDiscountPolicy(code?: string): Promise<DiscountPolicy | null> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_discount_policies
       WHERE status = 'ACTIVE' AND ($1::text IS NULL OR code = $1)
       ORDER BY CASE WHEN code = 'DEFAULT_PERCENT' THEN 0 ELSE 1 END
       LIMIT 1`,
      [code ?? null],
    );
    if (!rows[0]) return null;
    return {
      id: String(rows[0].id),
      code: String(rows[0].code),
      name: String(rows[0].name),
      discountType: String(rows[0].discount_type),
      approvalMatrix: (rows[0].approval_matrix as unknown[]) ?? [],
      status: String(rows[0].status),
    };
  }

  async createDiscountRequest(input: {
    opportunityId: string;
    accountId: string;
    quoteId?: string | null;
    policyId?: string | null;
    discountType: string;
    listAmount: number;
    requestedAmount: number;
    discountPercent: number;
    discountAmount: number;
    currency?: string;
    justification: string;
    requiredApprovalLevel: string;
    status: string;
    requestedBy: string;
  }): Promise<DiscountRequest> {
    const rows = await this.q(
      `INSERT INTO edge_sales_discount_requests (
         opportunity_id, account_id, quote_id, policy_id, discount_type, status,
         list_amount, requested_amount, discount_percent, discount_amount, currency,
         justification, required_approval_level, requested_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        input.opportunityId,
        input.accountId,
        input.quoteId ?? null,
        input.policyId ?? null,
        input.discountType,
        input.status,
        input.listAmount,
        input.requestedAmount,
        input.discountPercent,
        input.discountAmount,
        input.currency ?? 'USD',
        input.justification,
        input.requiredApprovalLevel,
        input.requestedBy,
      ],
    );
    return this.mapDiscountRequest(rows[0]!);
  }

  async getDiscountRequest(id: string): Promise<DiscountRequest | null> {
    const rows = await this.q(`SELECT * FROM edge_sales_discount_requests WHERE id = $1`, [id]);
    return rows[0] ? this.mapDiscountRequest(rows[0]) : null;
  }

  async listDiscountRequests(opts?: {
    status?: string;
    opportunityId?: string;
  }): Promise<DiscountRequest[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_discount_requests
       WHERE ($1::text IS NULL OR status = $1)
         AND ($2::uuid IS NULL OR opportunity_id = $2)
       ORDER BY created_at DESC`,
      [opts?.status ?? null, opts?.opportunityId ?? null],
    );
    return rows.map((r) => this.mapDiscountRequest(r));
  }

  async decideDiscountRequest(input: {
    id: string;
    status: string;
    decidedBy: string;
    decisionNotes?: string | null;
  }): Promise<DiscountRequest> {
    const rows = await this.q(
      `UPDATE edge_sales_discount_requests
       SET status = $2, decided_by = $3, decided_at = NOW(), decision_notes = $4, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [input.id, input.status, input.decidedBy, input.decisionNotes ?? null],
    );
    if (!rows[0]) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Discount request not found');
    return this.mapDiscountRequest(rows[0]);
  }

  async createApproval(input: {
    subjectType: string;
    subjectId: string;
    approvalType?: string;
    requiredLevel: string;
    requesterId: string;
    assigneeId?: string | null;
    cannotSelfApprove?: boolean;
    correlationId?: string | null;
  }): Promise<SalesApproval> {
    const rows = await this.q(
      `INSERT INTO edge_sales_approvals (
         subject_type, subject_id, approval_type, required_level, requester_id, assignee_id,
         cannot_self_approve, correlation_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        input.subjectType,
        input.subjectId,
        input.approvalType ?? 'COMMERCIAL',
        input.requiredLevel,
        input.requesterId,
        input.assigneeId ?? null,
        input.cannotSelfApprove ?? true,
        input.correlationId ?? null,
      ],
    );
    return this.mapApproval(rows[0]!);
  }

  async listApprovals(opts?: {
    status?: string;
    subjectType?: string;
    subjectId?: string;
  }): Promise<SalesApproval[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_approvals
       WHERE ($1::text IS NULL OR status = $1)
         AND ($2::text IS NULL OR subject_type = $2)
         AND ($3::uuid IS NULL OR subject_id = $3)
       ORDER BY created_at DESC`,
      [opts?.status ?? null, opts?.subjectType ?? null, opts?.subjectId ?? null],
    );
    return rows.map((r) => this.mapApproval(r));
  }

  async decideApproval(input: {
    id: string;
    status: string;
    decisionBy: string;
    decisionNotes?: string | null;
  }): Promise<SalesApproval> {
    const rows = await this.q(
      `UPDATE edge_sales_approvals
       SET status = $2, decision_by = $3, decision_at = NOW(), decision_notes = $4, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [input.id, input.status, input.decisionBy, input.decisionNotes ?? null],
    );
    if (!rows[0]) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Approval not found');
    return this.mapApproval(rows[0]);
  }

  async hasApprovedSubject(subjectType: string, subjectId: string): Promise<boolean> {
    const rows = await this.q<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_sales_approvals
       WHERE subject_type = $1 AND subject_id = $2 AND status = 'APPROVED'`,
      [subjectType, subjectId],
    );
    return Number(rows[0]?.c ?? 0) > 0;
  }

  async nextContractNumber(): Promise<string> {
    const rows = await this.q<{ n: string }>(
      `SELECT nextval('edge_sales_contract_number_seq')::text AS n`,
    );
    return `C-${rows[0]!.n}`;
  }

  async createContract(input: {
    contractNumber: string;
    accountId: string;
    opportunityId?: string | null;
    quoteId?: string | null;
    contractType?: string;
    productId?: string | null;
    currency?: string;
    contractValue?: number | null;
    commercialTermsSnapshot?: Record<string, unknown>;
    parties?: unknown[];
    signers?: unknown[];
    createdBy?: string | null;
  }): Promise<SalesContract> {
    const rows = await this.q(
      `INSERT INTO edge_sales_contracts (
         contract_number, account_id, opportunity_id, quote_id, contract_type, product_id,
         currency, contract_value, commercial_terms_snapshot, parties, signers, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12)
       RETURNING *`,
      [
        input.contractNumber,
        input.accountId,
        input.opportunityId ?? null,
        input.quoteId ?? null,
        input.contractType ?? 'SAAS_SUBSCRIPTION',
        input.productId ?? null,
        input.currency ?? 'USD',
        input.contractValue ?? null,
        JSON.stringify(input.commercialTermsSnapshot ?? {}),
        JSON.stringify(input.parties ?? []),
        JSON.stringify(input.signers ?? []),
        input.createdBy ?? null,
      ],
    );
    await this.q(
      `INSERT INTO edge_sales_contract_versions (
         contract_id, version, status_snapshot, commercial_terms_snapshot, created_by
       ) VALUES ($1,1,'DRAFT',$2::jsonb,$3)`,
      [
        rows[0]!.id,
        JSON.stringify(input.commercialTermsSnapshot ?? {}),
        input.createdBy ?? null,
      ],
    );
    return this.mapContract(rows[0]!);
  }

  async getContract(id: string): Promise<SalesContract | null> {
    const rows = await this.q(`SELECT * FROM edge_sales_contracts WHERE id = $1`, [id]);
    return rows[0] ? this.mapContract(rows[0]) : null;
  }

  async listContracts(opts?: {
    accountId?: string;
    opportunityId?: string;
    status?: string;
  }): Promise<SalesContract[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_contracts
       WHERE ($1::uuid IS NULL OR account_id = $1)
         AND ($2::uuid IS NULL OR opportunity_id = $2)
         AND ($3::text IS NULL OR status = $3)
       ORDER BY created_at DESC`,
      [opts?.accountId ?? null, opts?.opportunityId ?? null, opts?.status ?? null],
    );
    return rows.map((r) => this.mapContract(r));
  }

  async transitionContractStatus(input: {
    id: string;
    status: string;
    signatureProvider?: string | null;
    signatureExternalId?: string | null;
    signatureConfirmedAt?: Date | null;
    executedAt?: Date | null;
  }): Promise<SalesContract> {
    const rows = await this.q(
      `UPDATE edge_sales_contracts
       SET status = $2,
           signature_provider = COALESCE($3, signature_provider),
           signature_external_id = COALESCE($4, signature_external_id),
           signature_confirmed_at = COALESCE($5, signature_confirmed_at),
           executed_at = COALESCE($6, executed_at),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        input.id,
        input.status,
        input.signatureProvider ?? null,
        input.signatureExternalId ?? null,
        input.signatureConfirmedAt ?? null,
        input.executedAt ?? null,
      ],
    );
    if (!rows[0]) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Contract not found');
    return this.mapContract(rows[0]);
  }

  async appendSignatureEvent(input: {
    contractId: string;
    eventType: string;
    provider?: string | null;
    providerEventId?: string | null;
    signerEmail?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    await this.q(
      `INSERT INTO edge_sales_signature_events (
         contract_id, event_type, provider, provider_event_id, signer_email, payload
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb)
       ON CONFLICT DO NOTHING`,
      [
        input.contractId,
        input.eventType,
        input.provider ?? null,
        input.providerEventId ?? null,
        input.signerEmail ?? null,
        JSON.stringify(input.payload ?? {}),
      ],
    );
  }

  async hasExecutedContractForOpportunity(opportunityId: string): Promise<boolean> {
    const rows = await this.q<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_sales_contracts
       WHERE opportunity_id = $1 AND status IN ('EXECUTED','ACTIVE')`,
      [opportunityId],
    );
    return Number(rows[0]?.c ?? 0) > 0;
  }

  async nextOrderNumber(): Promise<string> {
    const rows = await this.q<{ n: string }>(
      `SELECT nextval('edge_sales_order_number_seq')::text AS n`,
    );
    return `SO-${rows[0]!.n}`;
  }

  async createOrder(input: {
    orderNumber: string;
    accountId: string;
    contractId?: string | null;
    opportunityId?: string | null;
    quoteId?: string | null;
    productId?: string | null;
    verticalId?: string | null;
    currency?: string;
    totalAmount?: number;
    commercialTerms?: Record<string, unknown>;
    offerConfiguration?: Record<string, unknown>;
    requestedGoLiveDate?: string | null;
    ownerAdministratorId?: string | null;
    createdBy?: string | null;
  }): Promise<SalesOrder> {
    const rows = await this.q(
      `INSERT INTO edge_sales_orders (
         order_number, account_id, contract_id, opportunity_id, quote_id, product_id, vertical_id,
         currency, total_amount, commercial_terms, offer_configuration, requested_go_live_date,
         owner_administrator_id, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14)
       RETURNING *`,
      [
        input.orderNumber,
        input.accountId,
        input.contractId ?? null,
        input.opportunityId ?? null,
        input.quoteId ?? null,
        input.productId ?? null,
        input.verticalId ?? null,
        input.currency ?? 'USD',
        input.totalAmount ?? 0,
        JSON.stringify(input.commercialTerms ?? {}),
        JSON.stringify(input.offerConfiguration ?? {}),
        input.requestedGoLiveDate ?? null,
        input.ownerAdministratorId ?? null,
        input.createdBy ?? null,
      ],
    );
    return this.mapOrder(rows[0]!);
  }

  async getOrder(id: string): Promise<SalesOrder | null> {
    const rows = await this.q(`SELECT * FROM edge_sales_orders WHERE id = $1`, [id]);
    return rows[0] ? this.mapOrder(rows[0]) : null;
  }

  async listOrders(opts?: { accountId?: string; status?: string }): Promise<SalesOrder[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_orders
       WHERE ($1::uuid IS NULL OR account_id = $1)
         AND ($2::text IS NULL OR status = $2)
       ORDER BY created_at DESC`,
      [opts?.accountId ?? null, opts?.status ?? null],
    );
    return rows.map((r) => this.mapOrder(r));
  }

  async transitionOrderStatus(id: string, status: string): Promise<SalesOrder> {
    const rows = await this.q(
      `UPDATE edge_sales_orders SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, status],
    );
    if (!rows[0]) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Sales order not found');
    return this.mapOrder(rows[0]);
  }

  async createHandoff(input: {
    salesOrderId: string;
    accountId: string;
    opportunityId?: string | null;
    contractId?: string | null;
    correlationId: string;
    packagePayload: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<SalesHandoff> {
    const existing = await this.getHandoffByCorrelation(input.correlationId);
    if (existing) return existing;
    const byOrder = await this.getHandoffByOrder(input.salesOrderId);
    if (byOrder && !['REJECTED', 'FAILED', 'CANCELLED'].includes(byOrder.status)) {
      return byOrder;
    }
    const rows = await this.q(
      `INSERT INTO edge_sales_handoffs (
         sales_order_id, account_id, opportunity_id, contract_id, correlation_id,
         package_payload, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
       RETURNING *`,
      [
        input.salesOrderId,
        input.accountId,
        input.opportunityId ?? null,
        input.contractId ?? null,
        input.correlationId,
        JSON.stringify(input.packagePayload),
        input.createdBy ?? null,
      ],
    );
    return this.mapHandoff(rows[0]!);
  }

  async getHandoff(id: string): Promise<SalesHandoff | null> {
    const rows = await this.q(`SELECT * FROM edge_sales_handoffs WHERE id = $1`, [id]);
    return rows[0] ? this.mapHandoff(rows[0]) : null;
  }

  async getHandoffByCorrelation(correlationId: string): Promise<SalesHandoff | null> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_handoffs WHERE correlation_id = $1`,
      [correlationId],
    );
    return rows[0] ? this.mapHandoff(rows[0]) : null;
  }

  async getHandoffByOrder(salesOrderId: string): Promise<SalesHandoff | null> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_handoffs
       WHERE sales_order_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [salesOrderId],
    );
    return rows[0] ? this.mapHandoff(rows[0]) : null;
  }

  async listHandoffs(opts?: { status?: string }): Promise<SalesHandoff[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_handoffs
       WHERE ($1::text IS NULL OR status = $1)
       ORDER BY created_at DESC`,
      [opts?.status ?? null],
    );
    return rows.map((r) => this.mapHandoff(r));
  }

  async updateHandoffStatus(input: {
    id: string;
    status: string;
    lastError?: string | null;
    acceptedAt?: Date | null;
    provisioningConfirmedAt?: Date | null;
    provisioningRefs?: unknown[];
  }): Promise<SalesHandoff> {
    const rows = await this.q(
      `UPDATE edge_sales_handoffs
       SET status = $2,
           last_error = COALESCE($3, last_error),
           accepted_at = COALESCE($4, accepted_at),
           provisioning_confirmed_at = COALESCE($5, provisioning_confirmed_at),
           provisioning_refs = COALESCE($6::jsonb, provisioning_refs),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        input.id,
        input.status,
        input.lastError ?? null,
        input.acceptedAt ?? null,
        input.provisioningConfirmedAt ?? null,
        input.provisioningRefs ? JSON.stringify(input.provisioningRefs) : null,
      ],
    );
    if (!rows[0]) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Handoff not found');
    return this.mapHandoff(rows[0]);
  }

  async recordHandoffAttempt(input: {
    handoffId: string;
    attemptNo: number;
    idempotencyKey: string;
    requestPayload?: Record<string, unknown>;
    responsePayload?: Record<string, unknown>;
    success: boolean;
    errorText?: string | null;
  }): Promise<void> {
    await this.q(
      `INSERT INTO edge_sales_handoff_attempts (
         handoff_id, attempt_no, idempotency_key, request_payload, response_payload, success, error_text
       ) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        input.handoffId,
        input.attemptNo,
        input.idempotencyKey,
        JSON.stringify(input.requestPayload ?? {}),
        JSON.stringify(input.responsePayload ?? {}),
        input.success,
        input.errorText ?? null,
      ],
    );
  }

  async addProvisioningReference(input: {
    handoffId: string;
    accountId: string;
    externalSystem: string;
    externalRef: string;
    refType?: string;
    productId?: string | null;
    confirmed?: boolean;
  }): Promise<void> {
    await this.q(
      `INSERT INTO edge_sales_provisioning_references (
         handoff_id, account_id, external_system, external_ref, ref_type, product_id, confirmed, confirmed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7, CASE WHEN $7 THEN NOW() ELSE NULL END)
       ON CONFLICT (external_system, external_ref) DO UPDATE
         SET confirmed = EXCLUDED.confirmed,
             confirmed_at = CASE WHEN EXCLUDED.confirmed THEN NOW() ELSE edge_sales_provisioning_references.confirmed_at END`,
      [
        input.handoffId,
        input.accountId,
        input.externalSystem,
        input.externalRef,
        input.refType ?? 'TENANT',
        input.productId ?? null,
        input.confirmed ?? false,
      ],
    );
  }

  async computeForecast(input: {
    model: 'PIPELINE' | 'WEIGHTED' | 'BEST_CASE' | 'COMMIT' | 'MOST_LIKELY';
    ownerAdministratorId?: string | null;
    teamId?: string | null;
    productId?: string | null;
  }): Promise<{
    currency: string;
    amount: number;
    opportunityCount: number;
    assumptions: Record<string, unknown>;
  }> {
    const rows = await this.q<{
      currency: string;
      amount: string;
      c: string;
    }>(
      `SELECT
         COALESCE(currency, 'USD') AS currency,
         COALESCE(SUM(
           CASE
             WHEN $1 = 'PIPELINE' THEN estimated_value
             WHEN $1 = 'WEIGHTED' THEN estimated_value * COALESCE(probability, 0)
             WHEN $1 = 'BEST_CASE' AND forecast_category IN ('BEST_CASE','COMMIT','MOST_LIKELY','PIPELINE')
               THEN estimated_value
             WHEN $1 = 'COMMIT' AND forecast_category = 'COMMIT' THEN estimated_value
             WHEN $1 = 'MOST_LIKELY' AND forecast_category IN ('COMMIT','MOST_LIKELY')
               THEN estimated_value
             ELSE 0
           END
         ), 0)::text AS amount,
         COUNT(*)::text AS c
       FROM edge_sales_opportunities
       WHERE status IN ('OPEN','REOPENED')
         AND ($2::uuid IS NULL OR owner_administrator_id = $2)
         AND ($3::uuid IS NULL OR team_id = $3)
         AND ($4::uuid IS NULL OR product_id = $4)
       GROUP BY currency
       ORDER BY amount DESC
       LIMIT 1`,
      [
        input.model,
        input.ownerAdministratorId ?? null,
        input.teamId ?? null,
        input.productId ?? null,
      ],
    );
    return {
      currency: rows[0]?.currency ?? 'USD',
      amount: Number(rows[0]?.amount ?? 0),
      opportunityCount: Number(rows[0]?.c ?? 0),
      assumptions: {
        model: input.model,
        note: 'Projection only — not recognized revenue',
        filters: {
          ownerAdministratorId: input.ownerAdministratorId ?? null,
          teamId: input.teamId ?? null,
          productId: input.productId ?? null,
        },
      },
    };
  }

  async salesPerformanceSummary(): Promise<{
    openOpportunities: number;
    wonOpportunities: number;
    lostOpportunities: number;
    pipelineValue: number;
    weightedPipelineValue: number;
    acceptedQuotes: number;
    executedContracts: number;
    handoffsPending: number;
    handoffsConfirmed: number;
  }> {
    const [opp, quotes, contracts, handoffs] = await Promise.all([
      this.q<{
        open_c: string;
        won_c: string;
        lost_c: string;
        pipeline: string;
        weighted: string;
      }>(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('OPEN','REOPENED'))::text AS open_c,
           COUNT(*) FILTER (WHERE status = 'WON')::text AS won_c,
           COUNT(*) FILTER (WHERE status = 'LOST')::text AS lost_c,
           COALESCE(SUM(estimated_value) FILTER (WHERE status IN ('OPEN','REOPENED')),0)::text AS pipeline,
           COALESCE(SUM(estimated_value * COALESCE(probability,0)) FILTER (WHERE status IN ('OPEN','REOPENED')),0)::text AS weighted
         FROM edge_sales_opportunities`,
      ),
      this.q<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM edge_sales_quotes WHERE status = 'ACCEPTED'`,
      ),
      this.q<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM edge_sales_contracts WHERE status IN ('EXECUTED','ACTIVE')`,
      ),
      this.q<{ pending: string; confirmed: string }>(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('REQUESTED','ACCEPTED','IN_PROGRESS','PROVISIONING_PENDING'))::text AS pending,
           COUNT(*) FILTER (WHERE status = 'PROVISIONING_CONFIRMED')::text AS confirmed
         FROM edge_sales_handoffs`,
      ),
    ]);
    return {
      openOpportunities: Number(opp[0]?.open_c ?? 0),
      wonOpportunities: Number(opp[0]?.won_c ?? 0),
      lostOpportunities: Number(opp[0]?.lost_c ?? 0),
      pipelineValue: Number(opp[0]?.pipeline ?? 0),
      weightedPipelineValue: Number(opp[0]?.weighted ?? 0),
      acceptedQuotes: Number(quotes[0]?.c ?? 0),
      executedContracts: Number(contracts[0]?.c ?? 0),
      handoffsPending: Number(handoffs[0]?.pending ?? 0),
      handoffsConfirmed: Number(handoffs[0]?.confirmed ?? 0),
    };
  }
}
