import { Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  BillingAccount,
  BillingAnalytics,
  BillingDispute,
  BillingOverview,
  BillingParty,
  BillingPeriod,
  BillingPolicy,
  BillingProfile,
  BillingRepositoryPort,
  BillingSchedule,
  CollectionCase,
  CreditNote,
  DunningAttempt,
  FinancialExportBatch,
  FxRate,
  Invoice,
  InvoiceDocument,
  InvoiceLine,
  InvoiceTaxLine,
  JournalEntry,
  PaymentAllocation,
  PaymentAttempt,
  PaymentIntent,
  PaymentMethodRecord,
  PaymentWebhookEvent,
  ProviderTransaction,
  ReconciliationException,
  ReconciliationRun,
  Refund,
  RevenuePolicy,
  SettlementBatch,
  TaxJurisdiction,
  TaxRate,
} from '../../domain/ports/billing-repository.port.js';
import { computeRecognizedRevenue } from '../../domain/billing/revenue-recognition.js';
import type { RevenueRecognitionMethod } from '../../domain/billing/revenue-recognition.js';

@Injectable()
export class PgBillingRepository implements BillingRepositoryPort {
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

  private num(v: unknown): string {
    return v == null ? '0' : String(v);
  }

  private mapAccount(r: Record<string, unknown>): BillingAccount {
    return {
      id: String(r.id),
      accountNumber: String(r.account_number),
      commercialAccountId: String(r.commercial_account_id),
      status: String(r.status),
      currency: String(r.currency),
      paymentTermsDays: Number(r.payment_terms_days),
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
      createdBy: (r.created_by as string | null) ?? null,
    };
  }

  private mapInvoice(r: Record<string, unknown>): Invoice {
    return {
      id: String(r.id),
      invoiceNumber: String(r.invoice_number),
      billingAccountId: String(r.billing_account_id),
      subscriptionId: (r.subscription_id as string | null) ?? null,
      periodId: (r.period_id as string | null) ?? null,
      status: String(r.status),
      currency: String(r.currency),
      issueAt: r.issue_at ? new Date(String(r.issue_at)) : null,
      dueAt: r.due_at ? new Date(String(r.due_at)) : null,
      subtotal: this.num(r.subtotal),
      discountTotal: this.num(r.discount_total),
      taxTotal: this.num(r.tax_total),
      total: this.num(r.total),
      amountPaid: this.num(r.amount_paid),
      amountDue: this.num(r.amount_due),
      profileSnapshot: (r.profile_snapshot as Record<string, unknown>) ?? {},
      commercialSnapshot: (r.commercial_snapshot as Record<string, unknown>) ?? {},
      taxSnapshot: (r.tax_snapshot as Record<string, unknown>) ?? {},
      issuedDocumentRef: (r.issued_document_ref as string | null) ?? null,
      correlationId: (r.correlation_id as string | null) ?? null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
      createdBy: (r.created_by as string | null) ?? null,
    };
  }

  private mapIntent(r: Record<string, unknown>): PaymentIntent {
    return {
      id: String(r.id),
      billingAccountId: String(r.billing_account_id),
      invoiceId: (r.invoice_id as string | null) ?? null,
      amount: this.num(r.amount),
      currency: String(r.currency),
      status: String(r.status),
      provider: String(r.provider),
      providerIntentRef: (r.provider_intent_ref as string | null) ?? null,
      correlationId: (r.correlation_id as string | null) ?? null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  async allocateAccountNumber(): Promise<string> {
    const rows = await this.q<{ n: string }>(
      `SELECT nextval('edge_billing_account_number_seq')::text AS n`,
    );
    return `BA-${rows[0].n}`;
  }

  async allocateInvoiceNumber(): Promise<string> {
    const rows = await this.q<{ n: string }>(
      `SELECT nextval('edge_invoice_number_seq')::text AS n`,
    );
    return `INV-${rows[0].n}`;
  }

  async createBillingAccount(input: {
    commercialAccountId: string;
    currency?: string;
    paymentTermsDays?: number;
    metadata?: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<BillingAccount> {
    const accountNumber = await this.allocateAccountNumber();
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_billing_accounts
        (account_number, commercial_account_id, currency, payment_terms_days, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       RETURNING *`,
      [
        accountNumber,
        input.commercialAccountId,
        input.currency ?? 'USD',
        input.paymentTermsDays ?? 30,
        JSON.stringify(input.metadata ?? {}),
        input.createdBy ?? null,
      ],
    );
    return this.mapAccount(rows[0]);
  }

  async listBillingAccounts(input?: {
    commercialAccountId?: string;
    limit?: number;
  }): Promise<BillingAccount[]> {
    const limit = input?.limit ?? 50;
    if (input?.commercialAccountId) {
      const rows = await this.q<Record<string, unknown>>(
        `SELECT * FROM edge_billing_accounts WHERE commercial_account_id = $1
         ORDER BY created_at DESC LIMIT $2`,
        [input.commercialAccountId, limit],
      );
      return rows.map((r) => this.mapAccount(r));
    }
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_billing_accounts ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return rows.map((r) => this.mapAccount(r));
  }

  async getBillingAccount(id: string): Promise<BillingAccount | null> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_billing_accounts WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.mapAccount(rows[0]) : null;
  }

  async findBillingAccountByCommercial(commercialAccountId: string): Promise<BillingAccount | null> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_billing_accounts WHERE commercial_account_id = $1 AND status = 'ACTIVE'
       ORDER BY created_at DESC LIMIT 1`,
      [commercialAccountId],
    );
    return rows[0] ? this.mapAccount(rows[0]) : null;
  }

  async updateBillingAccount(
    id: string,
    patch: Partial<Pick<BillingAccount, 'status' | 'paymentTermsDays' | 'metadata'>>,
  ): Promise<BillingAccount> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;
    if (patch.status != null) {
      sets.push(`status = $${idx++}`);
      params.push(patch.status);
    }
    if (patch.paymentTermsDays != null) {
      sets.push(`payment_terms_days = $${idx++}`);
      params.push(patch.paymentTermsDays);
    }
    if (patch.metadata != null) {
      sets.push(`metadata = $${idx++}::jsonb`);
      params.push(JSON.stringify(patch.metadata));
    }
    params.push(id);
    const rows = await this.q<Record<string, unknown>>(
      `UPDATE edge_billing_accounts SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return this.mapAccount(rows[0]);
  }

  async upsertBillingProfile(input: {
    billingAccountId: string;
    legalName: string;
    tradeName?: string | null;
    country?: string | null;
    currency: string;
    paymentTermsDays: number;
    snapshot?: Record<string, unknown>;
  }): Promise<BillingProfile> {
    await this.pool.query(
      `UPDATE edge_billing_profiles SET is_current = FALSE WHERE billing_account_id = $1`,
      [input.billingAccountId],
    );
    const verRows = await this.q<{ v: number }>(
      `SELECT COALESCE(MAX(version), 0) + 1 AS v FROM edge_billing_profiles WHERE billing_account_id = $1`,
      [input.billingAccountId],
    );
    const version = verRows[0].v;
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_billing_profiles
        (billing_account_id, version, legal_name, trade_name, country, currency, payment_terms_days,
         is_current, snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8::jsonb)
       RETURNING *`,
      [
        input.billingAccountId,
        version,
        input.legalName,
        input.tradeName ?? null,
        input.country ?? null,
        input.currency,
        input.paymentTermsDays,
        JSON.stringify(input.snapshot ?? {}),
      ],
    );
    const r = rows[0];
    return {
      id: String(r.id),
      billingAccountId: String(r.billing_account_id),
      version: Number(r.version),
      legalName: String(r.legal_name),
      tradeName: (r.trade_name as string | null) ?? null,
      country: (r.country as string | null) ?? null,
      currency: String(r.currency),
      paymentTermsDays: Number(r.payment_terms_days),
      isCurrent: Boolean(r.is_current),
      snapshot: (r.snapshot as Record<string, unknown>) ?? {},
      validFrom: new Date(String(r.valid_from)),
      createdAt: new Date(String(r.created_at)),
    };
  }

  async getCurrentBillingProfile(billingAccountId: string): Promise<BillingProfile | null> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_billing_profiles WHERE billing_account_id = $1 AND is_current = TRUE LIMIT 1`,
      [billingAccountId],
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: String(r.id),
      billingAccountId: String(r.billing_account_id),
      version: Number(r.version),
      legalName: String(r.legal_name),
      tradeName: (r.trade_name as string | null) ?? null,
      country: (r.country as string | null) ?? null,
      currency: String(r.currency),
      paymentTermsDays: Number(r.payment_terms_days),
      isCurrent: Boolean(r.is_current),
      snapshot: (r.snapshot as Record<string, unknown>) ?? {},
      validFrom: new Date(String(r.valid_from)),
      createdAt: new Date(String(r.created_at)),
    };
  }

  async linkSubscriptionToBillingAccount(input: {
    billingAccountId: string;
    subscriptionId: string;
  }): Promise<{ id: string; subscriptionId: string; billingAccountId: string; status: string }> {
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_billing_account_subscriptions (billing_account_id, subscription_id)
       VALUES ($1, $2)
       ON CONFLICT (subscription_id) DO UPDATE SET billing_account_id = EXCLUDED.billing_account_id, status = 'ACTIVE'
       RETURNING *`,
      [input.billingAccountId, input.subscriptionId],
    );
    const r = rows[0];
    return {
      id: String(r.id),
      subscriptionId: String(r.subscription_id),
      billingAccountId: String(r.billing_account_id),
      status: String(r.status),
    };
  }

  async getBillingAccountForSubscription(subscriptionId: string): Promise<BillingAccount | null> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT a.* FROM edge_billing_accounts a
       INNER JOIN edge_billing_account_subscriptions s ON s.billing_account_id = a.id
       WHERE s.subscription_id = $1 LIMIT 1`,
      [subscriptionId],
    );
    return rows[0] ? this.mapAccount(rows[0]) : null;
  }

  async createBillingSchedule(input: {
    subscriptionId: string;
    billingAccountId: string;
    frequency: string;
    nextBillAt?: Date | null;
    metadata?: Record<string, unknown>;
  }): Promise<BillingSchedule> {
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_billing_schedules
        (subscription_id, billing_account_id, frequency, next_bill_at, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING *`,
      [
        input.subscriptionId,
        input.billingAccountId,
        input.frequency,
        input.nextBillAt ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    const r = rows[0];
    return {
      id: String(r.id),
      subscriptionId: String(r.subscription_id),
      billingAccountId: String(r.billing_account_id),
      frequency: String(r.frequency),
      nextBillAt: r.next_bill_at ? new Date(String(r.next_bill_at)) : null,
      status: String(r.status),
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  async listBillingSchedules(subscriptionId: string): Promise<BillingSchedule[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_billing_schedules WHERE subscription_id = $1 ORDER BY created_at DESC`,
      [subscriptionId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      subscriptionId: String(r.subscription_id),
      billingAccountId: String(r.billing_account_id),
      frequency: String(r.frequency),
      nextBillAt: r.next_bill_at ? new Date(String(r.next_bill_at)) : null,
      status: String(r.status),
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    }));
  }

  async allocateNextPeriodNumber(subscriptionId: string): Promise<number> {
    const rows = await this.q<{ n: string }>(
      `SELECT COALESCE(MAX(period_number), 0) + 1 AS n FROM edge_billing_periods WHERE subscription_id = $1`,
      [subscriptionId],
    );
    return Number(rows[0]?.n ?? 1);
  }

  async createBillingPeriod(input: {
    subscriptionId: string;
    billingAccountId: string;
    periodNumber: number;
    startsAt: Date;
    endsAt: Date;
    billAt?: Date | null;
    dueAt?: Date | null;
    currency: string;
    snapshot?: Record<string, unknown>;
  }): Promise<BillingPeriod> {
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_billing_periods
        (subscription_id, billing_account_id, period_number, starts_at, ends_at, bill_at, due_at, currency, snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       RETURNING *`,
      [
        input.subscriptionId,
        input.billingAccountId,
        input.periodNumber,
        input.startsAt,
        input.endsAt,
        input.billAt ?? null,
        input.dueAt ?? null,
        input.currency,
        JSON.stringify(input.snapshot ?? {}),
      ],
    );
    const r = rows[0];
    return {
      id: String(r.id),
      subscriptionId: String(r.subscription_id),
      billingAccountId: String(r.billing_account_id),
      periodNumber: Number(r.period_number),
      startsAt: new Date(String(r.starts_at)),
      endsAt: new Date(String(r.ends_at)),
      billAt: r.bill_at ? new Date(String(r.bill_at)) : null,
      dueAt: r.due_at ? new Date(String(r.due_at)) : null,
      currency: String(r.currency),
      status: String(r.status),
      snapshot: (r.snapshot as Record<string, unknown>) ?? {},
    };
  }

  async createInvoice(input: {
    billingAccountId: string;
    subscriptionId?: string | null;
    periodId?: string | null;
    currency: string;
    dueAt?: Date | null;
    profileSnapshot?: Record<string, unknown>;
    commercialSnapshot?: Record<string, unknown>;
    taxSnapshot?: Record<string, unknown>;
    correlationId?: string | null;
    createdBy?: string | null;
    status?: string;
  }): Promise<Invoice> {
    const invoiceNumber = await this.allocateInvoiceNumber();
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_invoices
        (invoice_number, billing_account_id, subscription_id, period_id, status, currency,
         due_at, profile_snapshot, commercial_snapshot, tax_snapshot, correlation_id, created_by,
         amount_due)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11, $12, 0)
       RETURNING *`,
      [
        invoiceNumber,
        input.billingAccountId,
        input.subscriptionId ?? null,
        input.periodId ?? null,
        input.status ?? 'DRAFT',
        input.currency,
        input.dueAt ?? null,
        JSON.stringify(input.profileSnapshot ?? {}),
        JSON.stringify(input.commercialSnapshot ?? {}),
        JSON.stringify(input.taxSnapshot ?? {}),
        input.correlationId ?? null,
        input.createdBy ?? null,
      ],
    );
    return this.mapInvoice(rows[0]);
  }

  async addInvoiceLines(
    invoiceId: string,
    lines: readonly Omit<InvoiceLine, 'id' | 'invoiceId'>[],
  ): Promise<InvoiceLine[]> {
    const out: InvoiceLine[] = [];
    for (const line of lines) {
      const rows = await this.q<Record<string, unknown>>(
        `INSERT INTO edge_invoice_lines
          (invoice_id, line_number, description, quantity, unit_price, discount_amount,
           taxable_amount, tax_rate, tax_amount, line_total, product_ref, plan_ref, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
         RETURNING *`,
        [
          invoiceId,
          line.lineNumber,
          line.description,
          line.quantity,
          line.unitPrice,
          line.discountAmount,
          line.taxableAmount,
          line.taxRate ?? null,
          line.taxAmount,
          line.lineTotal,
          line.productRef ?? null,
          line.planRef ?? null,
          JSON.stringify(line.metadata ?? {}),
        ],
      );
      const r = rows[0];
      out.push({
        id: String(r.id),
        invoiceId,
        lineNumber: Number(r.line_number),
        description: String(r.description),
        quantity: this.num(r.quantity),
        unitPrice: this.num(r.unit_price),
        discountAmount: this.num(r.discount_amount),
        taxableAmount: this.num(r.taxable_amount),
        taxRate: r.tax_rate == null ? null : this.num(r.tax_rate),
        taxAmount: this.num(r.tax_amount),
        lineTotal: this.num(r.line_total),
        productRef: (r.product_ref as string | null) ?? null,
        planRef: (r.plan_ref as string | null) ?? null,
        metadata: (r.metadata as Record<string, unknown>) ?? {},
      });
    }
    return out;
  }

  async getInvoice(id: string): Promise<Invoice | null> {
    const rows = await this.q<Record<string, unknown>>(`SELECT * FROM edge_invoices WHERE id = $1`, [
      id,
    ]);
    return rows[0] ? this.mapInvoice(rows[0]) : null;
  }

  async listOverdueCandidates(asOf = new Date(), limit = 200): Promise<Invoice[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_invoices
       WHERE status IN ('ISSUED','PARTIALLY_PAID')
         AND due_at IS NOT NULL
         AND due_at < $1
       ORDER BY due_at ASC
       LIMIT $2`,
      [asOf.toISOString(), limit],
    );
    return rows.map((r) => this.mapInvoice(r));
  }

  async listInvoices(input?: {
    billingAccountId?: string;
    status?: string;
    limit?: number;
  }): Promise<Invoice[]> {
    const limit = input?.limit ?? 50;
    const params: unknown[] = [];
    const where: string[] = [];
    if (input?.billingAccountId) {
      params.push(input.billingAccountId);
      where.push(`billing_account_id = $${params.length}`);
    }
    if (input?.status) {
      params.push(input.status);
      where.push(`status = $${params.length}`);
    }
    params.push(limit);
    const sql = `SELECT * FROM edge_invoices ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY created_at DESC LIMIT $${params.length}`;
    const rows = await this.q<Record<string, unknown>>(sql, params);
    return rows.map((r) => this.mapInvoice(r));
  }

  async updateInvoice(
    id: string,
    patch: Partial<
      Pick<
        Invoice,
        | 'status'
        | 'subtotal'
        | 'discountTotal'
        | 'taxTotal'
        | 'total'
        | 'amountPaid'
        | 'amountDue'
        | 'issueAt'
        | 'dueAt'
        | 'issuedDocumentRef'
        | 'taxSnapshot'
        | 'metadata'
      >
    >,
  ): Promise<Invoice> {
    const map: Record<string, string> = {
      status: 'status',
      subtotal: 'subtotal',
      discountTotal: 'discount_total',
      taxTotal: 'tax_total',
      total: 'total',
      amountPaid: 'amount_paid',
      amountDue: 'amount_due',
      issueAt: 'issue_at',
      dueAt: 'due_at',
      issuedDocumentRef: 'issued_document_ref',
      taxSnapshot: 'tax_snapshot',
      metadata: 'metadata',
    };
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;
    for (const [k, col] of Object.entries(map)) {
      const v = (patch as Record<string, unknown>)[k];
      if (v === undefined) continue;
      if (k === 'metadata' || k === 'taxSnapshot') {
        sets.push(`${col} = $${idx++}::jsonb`);
        params.push(JSON.stringify(v));
      } else {
        sets.push(`${col} = $${idx++}`);
        params.push(v);
      }
    }
    params.push(id);
    const rows = await this.q<Record<string, unknown>>(
      `UPDATE edge_invoices SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return this.mapInvoice(rows[0]);
  }

  async appendInvoiceStatusHistory(input: {
    invoiceId: string;
    fromStatus?: string | null;
    toStatus: string;
    reason?: string | null;
    actorId?: string | null;
    correlationId?: string | null;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO edge_invoice_status_history
        (invoice_id, from_status, to_status, reason, actor_id, correlation_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.invoiceId,
        input.fromStatus ?? null,
        input.toStatus,
        input.reason ?? null,
        input.actorId ?? null,
        input.correlationId ?? null,
      ],
    );
  }

  async createPaymentIntent(input: {
    billingAccountId: string;
    invoiceId?: string | null;
    amount: string;
    currency: string;
    provider: string;
    providerIntentRef?: string | null;
    correlationId?: string | null;
    status?: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentIntent> {
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_payment_intents
        (billing_account_id, invoice_id, amount, currency, status, provider, provider_intent_ref,
         correlation_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
       RETURNING *`,
      [
        input.billingAccountId,
        input.invoiceId ?? null,
        input.amount,
        input.currency,
        input.status ?? 'CREATED',
        input.provider,
        input.providerIntentRef ?? null,
        input.correlationId ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return this.mapIntent(rows[0]);
  }

  async getPaymentIntent(id: string): Promise<PaymentIntent | null> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_payment_intents WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.mapIntent(rows[0]) : null;
  }

  async updatePaymentIntent(
    id: string,
    patch: Partial<Pick<PaymentIntent, 'status' | 'providerIntentRef' | 'metadata'>>,
  ): Promise<PaymentIntent> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;
    if (patch.status != null) {
      sets.push(`status = $${idx++}`);
      params.push(patch.status);
    }
    if (patch.providerIntentRef !== undefined) {
      sets.push(`provider_intent_ref = $${idx++}`);
      params.push(patch.providerIntentRef);
    }
    if (patch.metadata != null) {
      sets.push(`metadata = $${idx++}::jsonb`);
      params.push(JSON.stringify(patch.metadata));
    }
    params.push(id);
    const rows = await this.q<Record<string, unknown>>(
      `UPDATE edge_payment_intents SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return this.mapIntent(rows[0]);
  }

  async createPaymentAttempt(input: {
    intentId: string;
    attemptNumber: number;
    status: string;
    providerRef?: string | null;
    failureCode?: string | null;
    failureMessage?: string | null;
    rawResponse?: Record<string, unknown>;
  }): Promise<PaymentAttempt> {
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_payment_attempts
        (intent_id, attempt_number, status, provider_ref, failure_code, failure_message, raw_response)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       RETURNING *`,
      [
        input.intentId,
        input.attemptNumber,
        input.status,
        input.providerRef ?? null,
        input.failureCode ?? null,
        input.failureMessage ?? null,
        JSON.stringify(input.rawResponse ?? {}),
      ],
    );
    const r = rows[0];
    return {
      id: String(r.id),
      intentId: String(r.intent_id),
      attemptNumber: Number(r.attempt_number),
      status: String(r.status),
      providerRef: (r.provider_ref as string | null) ?? null,
      failureCode: (r.failure_code as string | null) ?? null,
      failureMessage: (r.failure_message as string | null) ?? null,
      rawResponse: (r.raw_response as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
    };
  }

  async createPaymentAllocation(input: {
    paymentIntentId: string;
    invoiceId: string;
    amount: string;
    currency: string;
  }): Promise<PaymentAllocation> {
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_payment_allocations (payment_intent_id, invoice_id, amount, currency)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [input.paymentIntentId, input.invoiceId, input.amount, input.currency],
    );
    const r = rows[0];
    return {
      id: String(r.id),
      paymentIntentId: String(r.payment_intent_id),
      invoiceId: String(r.invoice_id),
      amount: this.num(r.amount),
      currency: String(r.currency),
      allocatedAt: new Date(String(r.allocated_at)),
    };
  }

  async listPaymentAllocationsForIntent(paymentIntentId: string): Promise<PaymentAllocation[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_payment_allocations WHERE payment_intent_id = $1`,
      [paymentIntentId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      paymentIntentId: String(r.payment_intent_id),
      invoiceId: String(r.invoice_id),
      amount: this.num(r.amount),
      currency: String(r.currency),
      allocatedAt: new Date(String(r.allocated_at)),
    }));
  }

  async createRefund(input: {
    paymentIntentId: string;
    invoiceId?: string | null;
    amount: string;
    currency: string;
    reason?: string | null;
    correlationId?: string | null;
    status?: string;
  }): Promise<Refund> {
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_refunds
        (payment_intent_id, invoice_id, amount, currency, status, reason, correlation_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        input.paymentIntentId,
        input.invoiceId ?? null,
        input.amount,
        input.currency,
        input.status ?? 'REQUESTED',
        input.reason ?? null,
        input.correlationId ?? null,
      ],
    );
    const r = rows[0];
    return {
      id: String(r.id),
      paymentIntentId: String(r.payment_intent_id),
      invoiceId: (r.invoice_id as string | null) ?? null,
      amount: this.num(r.amount),
      currency: String(r.currency),
      status: String(r.status),
      reason: (r.reason as string | null) ?? null,
      providerRef: (r.provider_ref as string | null) ?? null,
      approvedBy: (r.approved_by as string | null) ?? null,
      correlationId: (r.correlation_id as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  async getRefund(id: string): Promise<Refund | null> {
    const rows = await this.q<Record<string, unknown>>(`SELECT * FROM edge_refunds WHERE id = $1`, [
      id,
    ]);
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: String(r.id),
      paymentIntentId: String(r.payment_intent_id),
      invoiceId: (r.invoice_id as string | null) ?? null,
      amount: this.num(r.amount),
      currency: String(r.currency),
      status: String(r.status),
      reason: (r.reason as string | null) ?? null,
      providerRef: (r.provider_ref as string | null) ?? null,
      approvedBy: (r.approved_by as string | null) ?? null,
      correlationId: (r.correlation_id as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  async updateRefund(
    id: string,
    patch: Partial<Pick<Refund, 'status' | 'providerRef' | 'approvedBy'>>,
  ): Promise<Refund> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;
    if (patch.status != null) {
      sets.push(`status = $${idx++}`);
      params.push(patch.status);
    }
    if (patch.providerRef !== undefined) {
      sets.push(`provider_ref = $${idx++}`);
      params.push(patch.providerRef);
    }
    if (patch.approvedBy !== undefined) {
      sets.push(`approved_by = $${idx++}`);
      params.push(patch.approvedBy);
    }
    params.push(id);
    const rows = await this.q<Record<string, unknown>>(
      `UPDATE edge_refunds SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    const r = rows[0];
    return {
      id: String(r.id),
      paymentIntentId: String(r.payment_intent_id),
      invoiceId: (r.invoice_id as string | null) ?? null,
      amount: this.num(r.amount),
      currency: String(r.currency),
      status: String(r.status),
      reason: (r.reason as string | null) ?? null,
      providerRef: (r.provider_ref as string | null) ?? null,
      approvedBy: (r.approved_by as string | null) ?? null,
      correlationId: (r.correlation_id as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  async openCollectionCase(input: {
    billingAccountId: string;
    invoiceId: string;
    policyCode?: string | null;
    overdueSince?: Date | null;
  }): Promise<CollectionCase> {
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_collection_cases
        (billing_account_id, invoice_id, policy_code, overdue_since)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [input.billingAccountId, input.invoiceId, input.policyCode ?? 'DUNNING_DEFAULT', input.overdueSince ?? null],
    );
    const r = rows[0];
    return {
      id: String(r.id),
      billingAccountId: String(r.billing_account_id),
      invoiceId: String(r.invoice_id),
      status: String(r.status),
      overdueSince: r.overdue_since ? new Date(String(r.overdue_since)) : null,
      nextActionAt: r.next_action_at ? new Date(String(r.next_action_at)) : null,
      policyCode: (r.policy_code as string | null) ?? null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  async recordDunningAttempt(input: {
    caseId: string;
    channel: string;
    templateRef?: string | null;
    status?: string;
  }): Promise<DunningAttempt> {
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_dunning_attempts (case_id, channel, template_ref, status)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [input.caseId, input.channel, input.templateRef ?? null, input.status ?? 'SENT'],
    );
    const r = rows[0];
    return {
      id: String(r.id),
      caseId: String(r.case_id),
      channel: String(r.channel),
      templateRef: (r.template_ref as string | null) ?? null,
      status: String(r.status),
      createdAt: new Date(String(r.created_at)),
    };
  }

  async appendJournalEntry(input: Omit<JournalEntry, 'id' | 'createdAt'>): Promise<JournalEntry> {
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_financial_journal_entries
        (entry_type, reference_type, reference_id, billing_account_id, currency, amount, direction,
         description, correlation_id, actor_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        input.entryType,
        input.referenceType,
        input.referenceId,
        input.billingAccountId,
        input.currency,
        input.amount,
        input.direction,
        input.description ?? null,
        input.correlationId ?? null,
        input.actorId ?? null,
      ],
    );
    const r = rows[0];
    return {
      id: String(r.id),
      entryType: String(r.entry_type),
      referenceType: String(r.reference_type),
      referenceId: String(r.reference_id),
      billingAccountId: String(r.billing_account_id),
      currency: String(r.currency),
      amount: this.num(r.amount),
      direction: r.direction as 'DEBIT' | 'CREDIT',
      description: (r.description as string | null) ?? null,
      correlationId: (r.correlation_id as string | null) ?? null,
      actorId: (r.actor_id as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
    };
  }

  async listJournalEntries(billingAccountId: string, limit = 100): Promise<JournalEntry[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_financial_journal_entries WHERE billing_account_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [billingAccountId, limit],
    );
    return rows.map((r) => ({
      id: String(r.id),
      entryType: String(r.entry_type),
      referenceType: String(r.reference_type),
      referenceId: String(r.reference_id),
      billingAccountId: String(r.billing_account_id),
      currency: String(r.currency),
      amount: this.num(r.amount),
      direction: r.direction as 'DEBIT' | 'CREDIT',
      description: (r.description as string | null) ?? null,
      correlationId: (r.correlation_id as string | null) ?? null,
      actorId: (r.actor_id as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
    }));
  }

  async ingestWebhookEvent(input: {
    provider: string;
    providerEventId: string;
    signatureValid: boolean;
    payload: Record<string, unknown>;
    correlationId?: string | null;
  }): Promise<PaymentWebhookEvent> {
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_payment_webhook_events
        (provider, provider_event_id, signature_valid, payload, correlation_id)
       VALUES ($1,$2,$3,$4::jsonb,$5)
       ON CONFLICT (provider_event_id) DO UPDATE SET received_at = edge_payment_webhook_events.received_at
       RETURNING *`,
      [
        input.provider,
        input.providerEventId,
        input.signatureValid,
        JSON.stringify(input.payload),
        input.correlationId ?? null,
      ],
    );
    const r = rows[0];
    return {
      id: String(r.id),
      provider: String(r.provider),
      providerEventId: String(r.provider_event_id),
      signatureValid: Boolean(r.signature_valid),
      payload: (r.payload as Record<string, unknown>) ?? {},
      processingStatus: String(r.processing_status),
      correlationId: (r.correlation_id as string | null) ?? null,
      receivedAt: new Date(String(r.received_at)),
      processedAt: r.processed_at ? new Date(String(r.processed_at)) : null,
    };
  }

  async getWebhookEventByProviderId(providerEventId: string): Promise<PaymentWebhookEvent | null> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_payment_webhook_events WHERE provider_event_id = $1`,
      [providerEventId],
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: String(r.id),
      provider: String(r.provider),
      providerEventId: String(r.provider_event_id),
      signatureValid: Boolean(r.signature_valid),
      payload: (r.payload as Record<string, unknown>) ?? {},
      processingStatus: String(r.processing_status),
      correlationId: (r.correlation_id as string | null) ?? null,
      receivedAt: new Date(String(r.received_at)),
      processedAt: r.processed_at ? new Date(String(r.processed_at)) : null,
    };
  }

  async updateWebhookEvent(
    id: string,
    patch: Partial<Pick<PaymentWebhookEvent, 'processingStatus' | 'processedAt'>>,
  ): Promise<PaymentWebhookEvent> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (patch.processingStatus != null) {
      sets.push(`processing_status = $${idx++}`);
      params.push(patch.processingStatus);
    }
    if (patch.processedAt !== undefined) {
      sets.push(`processed_at = $${idx++}`);
      params.push(patch.processedAt);
    }
    params.push(id);
    const rows = await this.q<Record<string, unknown>>(
      `UPDATE edge_payment_webhook_events SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    const r = rows[0];
    return {
      id: String(r.id),
      provider: String(r.provider),
      providerEventId: String(r.provider_event_id),
      signatureValid: Boolean(r.signature_valid),
      payload: (r.payload as Record<string, unknown>) ?? {},
      processingStatus: String(r.processing_status),
      correlationId: (r.correlation_id as string | null) ?? null,
      receivedAt: new Date(String(r.received_at)),
      processedAt: r.processed_at ? new Date(String(r.processed_at)) : null,
    };
  }

  async getBillingOverview(): Promise<BillingOverview> {
    const [accounts, openInvoices, issuedUnpaid, collected, refunded, policy] = await Promise.all([
      this.q<{ c: string }>(`SELECT COUNT(*)::text AS c FROM edge_billing_accounts WHERE status = 'ACTIVE'`),
      this.q<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM edge_invoices WHERE status IN ('ISSUED','PARTIALLY_PAID','OVERDUE')`,
      ),
      this.q<{ t: string }>(
        `SELECT COALESCE(SUM(amount_due),0)::text AS t FROM edge_invoices
         WHERE status IN ('ISSUED','PARTIALLY_PAID','OVERDUE')`,
      ),
      this.q<{ t: string }>(
        `SELECT COALESCE(SUM(amount),0)::text AS t FROM edge_payment_intents WHERE status = 'SUCCEEDED'`,
      ),
      this.sumSucceededRefunds(),
      this.getActiveRevenuePolicy(),
    ]);
    const method = (policy?.method ?? 'DEFERRED_MANUAL') as RevenueRecognitionMethod;
    const recognition = computeRecognizedRevenue({
      method,
      billedTotal: issuedUnpaid[0]?.t ?? '0',
      collectedTotal: collected[0]?.t ?? '0',
      refundedTotal: refunded,
      currency: 'USD',
    });
    return {
      accounts: Number(accounts[0]?.c ?? 0),
      openInvoices: Number(openInvoices[0]?.c ?? 0),
      issuedUnpaidTotal: issuedUnpaid[0]?.t ?? '0',
      collectedTotal: collected[0]?.t ?? '0',
      refundedTotal: refunded,
      recognizedRevenue: recognition.recognizedRevenue,
      recognitionMethod: recognition.method,
      disclaimer: recognition.disclaimer,
    };
  }

  async getBillingAnalytics(currency = 'USD'): Promise<BillingAnalytics> {
    const [billed, collected, refunded, policy] = await Promise.all([
      this.q<{ t: string }>(
        `SELECT COALESCE(SUM(total),0)::text AS t FROM edge_invoices
         WHERE status IN ('ISSUED','PARTIALLY_PAID','PAID','OVERDUE') AND currency = $1`,
        [currency],
      ),
      this.q<{ t: string }>(
        `SELECT COALESCE(SUM(amount),0)::text AS t FROM edge_payment_intents
         WHERE status = 'SUCCEEDED' AND currency = $1`,
        [currency],
      ),
      this.sumSucceededRefunds(currency),
      this.getActiveRevenuePolicy(),
    ]);
    const method = (policy?.method ?? 'DEFERRED_MANUAL') as RevenueRecognitionMethod;
    const recognition = computeRecognizedRevenue({
      method,
      billedTotal: billed[0]?.t ?? '0',
      collectedTotal: collected[0]?.t ?? '0',
      refundedTotal: refunded,
      currency,
    });
    return {
      billedTotal: billed[0]?.t ?? '0',
      collectedTotal: collected[0]?.t ?? '0',
      refundedTotal: refunded,
      recognizedRevenue: recognition.recognizedRevenue,
      recognitionMethod: recognition.method,
      currency,
      disclaimer: recognition.disclaimer,
    };
  }

  async resolveIdempotency(
    idempotencyKey: string,
  ): Promise<{
    resourceType: string;
    resourceId?: string | null;
    responseSnapshot: Record<string, unknown>;
  } | null> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_billing_idempotency_keys WHERE idempotency_key = $1`,
      [idempotencyKey],
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      resourceType: String(r.resource_type),
      resourceId: (r.resource_id as string | null) ?? null,
      responseSnapshot: (r.response_snapshot as Record<string, unknown>) ?? {},
    };
  }

  async storeIdempotency(input: {
    idempotencyKey: string;
    operation: string;
    resourceType: string;
    resourceId?: string | null;
    responseSnapshot?: Record<string, unknown>;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO edge_billing_idempotency_keys
        (idempotency_key, operation, resource_type, resource_id, response_snapshot)
       VALUES ($1,$2,$3,$4,$5::jsonb)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        input.idempotencyKey,
        input.operation,
        input.resourceType,
        input.resourceId ?? null,
        JSON.stringify(input.responseSnapshot ?? {}),
      ],
    );
  }

  async upsertBillingParty(input: {
    billingAccountId: string;
    partyRole: string;
    legalName: string;
    taxId?: string | null;
    country?: string | null;
    address?: Record<string, unknown>;
    email?: string | null;
  }): Promise<BillingParty> {
    const existing = await this.q<Record<string, unknown>>(
      `SELECT id FROM edge_billing_parties
       WHERE billing_account_id = $1 AND party_role = $2 AND status = 'ACTIVE' LIMIT 1`,
      [input.billingAccountId, input.partyRole],
    );
    if (existing[0]) {
      const rows = await this.q<Record<string, unknown>>(
        `UPDATE edge_billing_parties SET
           legal_name = $2, tax_id = $3, country = $4, address = $5::jsonb, email = $6, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [
          existing[0].id,
          input.legalName,
          input.taxId ?? null,
          input.country ?? null,
          JSON.stringify(input.address ?? {}),
          input.email ?? null,
        ],
      );
      return this.mapParty(rows[0]);
    }
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_billing_parties
        (billing_account_id, party_role, legal_name, tax_id, country, address, email)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7) RETURNING *`,
      [
        input.billingAccountId,
        input.partyRole,
        input.legalName,
        input.taxId ?? null,
        input.country ?? null,
        JSON.stringify(input.address ?? {}),
        input.email ?? null,
      ],
    );
    return this.mapParty(rows[0]);
  }

  async listBillingParties(billingAccountId: string): Promise<BillingParty[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_billing_parties WHERE billing_account_id = $1 ORDER BY party_role`,
      [billingAccountId],
    );
    return rows.map((r) => this.mapParty(r));
  }

  async listBillingProfiles(billingAccountId: string): Promise<BillingProfile[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_billing_profiles WHERE billing_account_id = $1 ORDER BY version DESC`,
      [billingAccountId],
    );
    return rows.map((r) => this.mapProfile(r));
  }

  async listInvoiceLines(invoiceId: string): Promise<InvoiceLine[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_invoice_lines WHERE invoice_id = $1 ORDER BY line_number`,
      [invoiceId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      invoiceId: String(r.invoice_id),
      lineNumber: Number(r.line_number),
      description: String(r.description),
      quantity: this.num(r.quantity),
      unitPrice: this.num(r.unit_price),
      discountAmount: this.num(r.discount_amount),
      taxableAmount: this.num(r.taxable_amount),
      taxRate: r.tax_rate == null ? null : this.num(r.tax_rate),
      taxAmount: this.num(r.tax_amount),
      lineTotal: this.num(r.line_total),
      productRef: (r.product_ref as string | null) ?? null,
      planRef: (r.plan_ref as string | null) ?? null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
    }));
  }

  async replaceInvoiceTaxLines(
    invoiceId: string,
    lines: readonly Omit<InvoiceTaxLine, 'id' | 'invoiceId'>[],
  ): Promise<InvoiceTaxLine[]> {
    await this.pool.query(`DELETE FROM edge_invoice_tax_lines WHERE invoice_id = $1`, [invoiceId]);
    const out: InvoiceTaxLine[] = [];
    for (const line of lines) {
      const rows = await this.q<Record<string, unknown>>(
        `INSERT INTO edge_invoice_tax_lines
          (invoice_id, jurisdiction_code, category, rate, taxable_amount, tax_amount)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [
          invoiceId,
          line.jurisdictionCode,
          line.category,
          line.rate,
          line.taxableAmount,
          line.taxAmount,
        ],
      );
      const r = rows[0];
      out.push({
        id: String(r.id),
        invoiceId: String(r.invoice_id),
        jurisdictionCode: String(r.jurisdiction_code),
        category: String(r.category),
        rate: this.num(r.rate),
        taxableAmount: this.num(r.taxable_amount),
        taxAmount: this.num(r.tax_amount),
      });
    }
    return out;
  }

  async listInvoiceTaxLines(invoiceId: string): Promise<InvoiceTaxLine[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_invoice_tax_lines WHERE invoice_id = $1`,
      [invoiceId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      invoiceId: String(r.invoice_id),
      jurisdictionCode: String(r.jurisdiction_code),
      category: String(r.category),
      rate: this.num(r.rate),
      taxableAmount: this.num(r.taxable_amount),
      taxAmount: this.num(r.tax_amount),
    }));
  }

  async storeInvoiceDocument(input: {
    invoiceId: string;
    documentType?: string;
    storageRef: string;
    contentSha256?: string | null;
  }): Promise<InvoiceDocument> {
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_invoice_documents
        (invoice_id, document_type, storage_ref, content_sha256)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [
        input.invoiceId,
        input.documentType ?? 'PDF',
        input.storageRef,
        input.contentSha256 ?? null,
      ],
    );
    return this.mapDocument(rows[0]);
  }

  async listInvoiceDocuments(invoiceId: string): Promise<InvoiceDocument[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_invoice_documents WHERE invoice_id = $1 ORDER BY issued_at DESC`,
      [invoiceId],
    );
    return rows.map((r) => this.mapDocument(r));
  }

  async listTaxJurisdictions(): Promise<TaxJurisdiction[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_billing_tax_jurisdictions WHERE status = 'ACTIVE' ORDER BY code`,
    );
    return rows.map((r) => ({
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      country: (r.country as string | null) ?? null,
      rules: (r.rules as Record<string, unknown>) ?? {},
      status: String(r.status),
    }));
  }

  async resolveTaxRate(input: {
    country?: string | null;
    category?: string;
    at?: Date;
  }): Promise<(TaxRate & { jurisdictionCode: string }) | null> {
    const at = input.at ?? new Date();
    const category = input.category ?? 'STANDARD';
    const rows = await this.q<Record<string, unknown>>(
      `SELECT r.*, j.code AS jurisdiction_code
       FROM edge_billing_tax_rates r
       INNER JOIN edge_billing_tax_jurisdictions j ON j.id = r.jurisdiction_id
       WHERE j.status = 'ACTIVE'
         AND r.category = $1
         AND r.valid_from <= $2
         AND (r.valid_until IS NULL OR r.valid_until > $2)
         AND ($3::text IS NULL OR j.country = $3 OR j.code = 'ZZ_INTERNAL')
       ORDER BY CASE WHEN j.country = $3 THEN 0 ELSE 1 END, r.version DESC
       LIMIT 1`,
      [category, at.toISOString(), input.country ?? null],
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: String(r.id),
      jurisdictionId: String(r.jurisdiction_id),
      jurisdictionCode: String(r.jurisdiction_code),
      category: String(r.category),
      rate: this.num(r.rate),
      validFrom: new Date(String(r.valid_from)),
      validUntil: r.valid_until ? new Date(String(r.valid_until)) : null,
      version: Number(r.version),
    };
  }

  async allocateCreditNoteNumber(): Promise<string> {
    const rows = await this.q<{ n: string }>(
      `SELECT nextval('edge_credit_note_number_seq')::text AS n`,
    );
    return `CN-${rows[0].n}`;
  }

  async createCreditNote(input: {
    invoiceId?: string | null;
    billingAccountId: string;
    currency: string;
    total: string;
    reason?: string | null;
    snapshot?: Record<string, unknown>;
    status?: string;
  }): Promise<CreditNote> {
    const number = await this.allocateCreditNoteNumber();
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_credit_notes
        (credit_note_number, invoice_id, billing_account_id, status, currency, total, reason, snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING *`,
      [
        number,
        input.invoiceId ?? null,
        input.billingAccountId,
        input.status ?? 'DRAFT',
        input.currency,
        input.total,
        input.reason ?? null,
        JSON.stringify(input.snapshot ?? {}),
      ],
    );
    return this.mapCreditNote(rows[0]);
  }

  async listCreditNotes(input?: {
    billingAccountId?: string;
    invoiceId?: string;
  }): Promise<CreditNote[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (input?.billingAccountId) {
      params.push(input.billingAccountId);
      clauses.push(`billing_account_id = $${params.length}`);
    }
    if (input?.invoiceId) {
      params.push(input.invoiceId);
      clauses.push(`invoice_id = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_credit_notes ${where} ORDER BY created_at DESC LIMIT 100`,
      params,
    );
    return rows.map((r) => this.mapCreditNote(r));
  }

  async issueCreditNote(id: string): Promise<CreditNote> {
    const rows = await this.q<Record<string, unknown>>(
      `UPDATE edge_credit_notes SET status = 'ISSUED', updated_at = NOW()
       WHERE id = $1 AND status = 'DRAFT' RETURNING *`,
      [id],
    );
    if (!rows[0]) throw new Error('Credit note not found or not DRAFT');
    return this.mapCreditNote(rows[0]);
  }

  async listCollectionCases(input?: {
    billingAccountId?: string;
    status?: string;
    limit?: number;
  }): Promise<CollectionCase[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (input?.billingAccountId) {
      params.push(input.billingAccountId);
      clauses.push(`billing_account_id = $${params.length}`);
    }
    if (input?.status) {
      params.push(input.status);
      clauses.push(`status = $${params.length}`);
    }
    params.push(input?.limit ?? 100);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_collection_cases ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
    );
    return rows.map((r) => this.mapCollection(r));
  }

  async getCollectionCase(id: string): Promise<CollectionCase | null> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_collection_cases WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.mapCollection(rows[0]) : null;
  }

  async updateCollectionCase(
    id: string,
    patch: Partial<Pick<CollectionCase, 'status' | 'nextActionAt' | 'policyCode' | 'metadata'>>,
  ): Promise<CollectionCase> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;
    if (patch.status !== undefined) {
      sets.push(`status = $${idx++}`);
      params.push(patch.status);
    }
    if (patch.nextActionAt !== undefined) {
      sets.push(`next_action_at = $${idx++}`);
      params.push(patch.nextActionAt);
    }
    if (patch.policyCode !== undefined) {
      sets.push(`policy_code = $${idx++}`);
      params.push(patch.policyCode);
    }
    if (patch.metadata !== undefined) {
      sets.push(`metadata = $${idx++}::jsonb`);
      params.push(JSON.stringify(patch.metadata));
    }
    params.push(id);
    const rows = await this.q<Record<string, unknown>>(
      `UPDATE edge_collection_cases SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return this.mapCollection(rows[0]);
  }

  async listDunningAttempts(caseId: string): Promise<DunningAttempt[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_dunning_attempts WHERE case_id = $1 ORDER BY created_at DESC`,
      [caseId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      caseId: String(r.case_id),
      channel: String(r.channel),
      templateRef: (r.template_ref as string | null) ?? null,
      status: String(r.status),
      createdAt: new Date(String(r.created_at)),
    }));
  }

  async listBillingPolicies(policyType?: string): Promise<BillingPolicy[]> {
    const rows = policyType
      ? await this.q<Record<string, unknown>>(
          `SELECT * FROM edge_billing_policies WHERE policy_type = $1 ORDER BY code`,
          [policyType],
        )
      : await this.q<Record<string, unknown>>(
          `SELECT * FROM edge_billing_policies ORDER BY code`,
        );
    return rows.map((r) => this.mapPolicy(r));
  }

  async getBillingPolicyByCode(code: string): Promise<BillingPolicy | null> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_billing_policies WHERE code = $1`,
      [code],
    );
    return rows[0] ? this.mapPolicy(rows[0]) : null;
  }

  async upsertBillingPolicy(input: {
    code: string;
    policyType: string;
    rules: Record<string, unknown>;
    status?: string;
  }): Promise<BillingPolicy> {
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_billing_policies (code, policy_type, rules, status)
       VALUES ($1,$2,$3::jsonb,$4)
       ON CONFLICT (code) DO UPDATE SET
         policy_type = EXCLUDED.policy_type,
         rules = EXCLUDED.rules,
         status = EXCLUDED.status,
         updated_at = NOW()
       RETURNING *`,
      [input.code, input.policyType, JSON.stringify(input.rules), input.status ?? 'ACTIVE'],
    );
    return this.mapPolicy(rows[0]);
  }

  async listPaymentMethods(billingAccountId: string): Promise<PaymentMethodRecord[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_payment_methods WHERE billing_account_id = $1 ORDER BY is_default DESC, created_at DESC`,
      [billingAccountId],
    );
    return rows.map((r) => this.mapPaymentMethod(r));
  }

  async registerPaymentMethod(input: {
    billingAccountId: string;
    provider: string;
    providerMethodRef: string;
    methodType: string;
    brand?: string | null;
    last4?: string | null;
    isDefault?: boolean;
  }): Promise<PaymentMethodRecord> {
    if (input.isDefault) {
      await this.pool.query(
        `UPDATE edge_payment_methods SET is_default = FALSE WHERE billing_account_id = $1`,
        [input.billingAccountId],
      );
    }
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_payment_methods
        (billing_account_id, provider, provider_method_ref, method_type, brand, last4, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (provider, provider_method_ref) DO UPDATE SET
         status = 'ACTIVE', updated_at = NOW()
       RETURNING *`,
      [
        input.billingAccountId,
        input.provider,
        input.providerMethodRef,
        input.methodType,
        input.brand ?? null,
        input.last4 ?? null,
        input.isDefault ?? false,
      ],
    );
    return this.mapPaymentMethod(rows[0]);
  }

  async revokePaymentMethod(id: string): Promise<PaymentMethodRecord> {
    const rows = await this.q<Record<string, unknown>>(
      `UPDATE edge_payment_methods SET status = 'REVOKED', is_default = FALSE, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id],
    );
    return this.mapPaymentMethod(rows[0]);
  }

  async createReconciliationRun(input: {
    provider: string;
    summary?: Record<string, unknown>;
  }): Promise<ReconciliationRun> {
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_reconciliation_runs (provider, summary) VALUES ($1,$2::jsonb) RETURNING *`,
      [input.provider, JSON.stringify(input.summary ?? {})],
    );
    return this.mapReconRun(rows[0]);
  }

  async completeReconciliationRun(
    id: string,
    summary: Record<string, unknown>,
    status: 'COMPLETED' | 'FAILED' = 'COMPLETED',
  ): Promise<ReconciliationRun> {
    const rows = await this.q<Record<string, unknown>>(
      `UPDATE edge_reconciliation_runs
       SET status = $2, summary = $3::jsonb, completed_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, status, JSON.stringify(summary)],
    );
    return this.mapReconRun(rows[0]);
  }

  async listReconciliationRuns(limit = 50): Promise<ReconciliationRun[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_reconciliation_runs ORDER BY started_at DESC LIMIT $1`,
      [limit],
    );
    return rows.map((r) => this.mapReconRun(r));
  }

  async getReconciliationRun(id: string): Promise<ReconciliationRun | null> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_reconciliation_runs WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.mapReconRun(rows[0]) : null;
  }

  async createReconciliationException(input: {
    runId: string;
    exceptionType: string;
    internalRef?: string | null;
    providerRef?: string | null;
    details?: Record<string, unknown>;
  }): Promise<ReconciliationException> {
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_reconciliation_exceptions
        (run_id, exception_type, internal_ref, provider_ref, details)
       VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING *`,
      [
        input.runId,
        input.exceptionType,
        input.internalRef ?? null,
        input.providerRef ?? null,
        JSON.stringify(input.details ?? {}),
      ],
    );
    return this.mapReconException(rows[0]);
  }

  async listReconciliationExceptions(input?: {
    runId?: string;
    status?: string;
  }): Promise<ReconciliationException[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (input?.runId) {
      params.push(input.runId);
      clauses.push(`run_id = $${params.length}`);
    }
    if (input?.status) {
      params.push(input.status);
      clauses.push(`status = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_reconciliation_exceptions ${where} ORDER BY created_at DESC LIMIT 200`,
      params,
    );
    return rows.map((r) => this.mapReconException(r));
  }

  async resolveReconciliationException(id: string): Promise<ReconciliationException> {
    const rows = await this.q<Record<string, unknown>>(
      `UPDATE edge_reconciliation_exceptions
       SET status = 'RESOLVED', resolved_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    return this.mapReconException(rows[0]);
  }

  async upsertProviderTransaction(input: {
    provider: string;
    providerTxnId: string;
    paymentIntentId?: string | null;
    amount: string;
    currency: string;
    status?: string;
    fees?: string;
    raw?: Record<string, unknown>;
    occurredAt?: Date;
  }): Promise<ProviderTransaction> {
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_provider_transactions
        (provider, provider_txn_id, payment_intent_id, amount, currency, status, fees, raw, occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
       ON CONFLICT (provider, provider_txn_id) DO UPDATE SET
         payment_intent_id = COALESCE(EXCLUDED.payment_intent_id, edge_provider_transactions.payment_intent_id),
         status = EXCLUDED.status,
         fees = EXCLUDED.fees,
         raw = EXCLUDED.raw
       RETURNING *`,
      [
        input.provider,
        input.providerTxnId,
        input.paymentIntentId ?? null,
        input.amount,
        input.currency,
        input.status ?? 'SETTLED',
        input.fees ?? '0',
        JSON.stringify(input.raw ?? {}),
        (input.occurredAt ?? new Date()).toISOString(),
      ],
    );
    return this.mapProviderTxn(rows[0]);
  }

  async listProviderTransactions(provider?: string, limit = 100): Promise<ProviderTransaction[]> {
    const rows = provider
      ? await this.q<Record<string, unknown>>(
          `SELECT * FROM edge_provider_transactions WHERE provider = $1 ORDER BY occurred_at DESC LIMIT $2`,
          [provider, limit],
        )
      : await this.q<Record<string, unknown>>(
          `SELECT * FROM edge_provider_transactions ORDER BY occurred_at DESC LIMIT $1`,
          [limit],
        );
    return rows.map((r) => this.mapProviderTxn(r));
  }

  async listSucceededPaymentIntentsWithoutProviderTxn(provider: string): Promise<PaymentIntent[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT i.* FROM edge_payment_intents i
       LEFT JOIN edge_provider_transactions t
         ON t.payment_intent_id = i.id AND t.provider = $1
       WHERE i.status = 'SUCCEEDED' AND t.id IS NULL
       ORDER BY i.created_at DESC LIMIT 200`,
      [provider],
    );
    return rows.map((r) => this.mapIntent(r));
  }

  async createSettlementBatch(input: {
    provider: string;
    merchantAccount?: string | null;
    settlementDate: string;
    grossAmount: string;
    fees?: string;
    refunds?: string;
    chargebacks?: string;
    netAmount: string;
    currency: string;
    bankReference?: string | null;
  }): Promise<SettlementBatch> {
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_settlement_batches
        (provider, merchant_account, settlement_date, gross_amount, fees, refunds, chargebacks, net_amount, currency, bank_reference)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        input.provider,
        input.merchantAccount ?? null,
        input.settlementDate,
        input.grossAmount,
        input.fees ?? '0',
        input.refunds ?? '0',
        input.chargebacks ?? '0',
        input.netAmount,
        input.currency,
        input.bankReference ?? null,
      ],
    );
    return this.mapSettlement(rows[0]);
  }

  async listSettlementBatches(limit = 50): Promise<SettlementBatch[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_settlement_batches ORDER BY settlement_date DESC LIMIT $1`,
      [limit],
    );
    return rows.map((r) => this.mapSettlement(r));
  }

  async createDispute(input: {
    billingAccountId: string;
    paymentIntentId?: string | null;
    invoiceId?: string | null;
    provider: string;
    providerDisputeId?: string | null;
    disputeType?: string;
    amount: string;
    currency: string;
    dueAt?: Date | null;
  }): Promise<BillingDispute> {
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_billing_disputes
        (billing_account_id, payment_intent_id, invoice_id, provider, provider_dispute_id,
         dispute_type, amount, currency, due_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        input.billingAccountId,
        input.paymentIntentId ?? null,
        input.invoiceId ?? null,
        input.provider,
        input.providerDisputeId ?? null,
        input.disputeType ?? 'CHARGEBACK',
        input.amount,
        input.currency,
        input.dueAt?.toISOString() ?? null,
      ],
    );
    return this.mapDispute(rows[0]);
  }

  async listDisputes(input?: {
    billingAccountId?: string;
    status?: string;
  }): Promise<BillingDispute[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (input?.billingAccountId) {
      params.push(input.billingAccountId);
      clauses.push(`billing_account_id = $${params.length}`);
    }
    if (input?.status) {
      params.push(input.status);
      clauses.push(`status = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_billing_disputes ${where} ORDER BY created_at DESC LIMIT 100`,
      params,
    );
    return rows.map((r) => this.mapDispute(r));
  }

  async updateDisputeStatus(
    id: string,
    status: string,
    resolution?: Record<string, unknown>,
  ): Promise<BillingDispute> {
    const rows = await this.q<Record<string, unknown>>(
      `UPDATE edge_billing_disputes
       SET status = $2, resolution = COALESCE($3::jsonb, resolution), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, status, resolution ? JSON.stringify(resolution) : null],
    );
    return this.mapDispute(rows[0]);
  }

  async listFxRates(baseCurrency?: string): Promise<FxRate[]> {
    const rows = baseCurrency
      ? await this.q<Record<string, unknown>>(
          `SELECT * FROM edge_billing_fx_rates WHERE base_currency = $1 ORDER BY effective_at DESC`,
          [baseCurrency],
        )
      : await this.q<Record<string, unknown>>(
          `SELECT * FROM edge_billing_fx_rates ORDER BY effective_at DESC LIMIT 200`,
        );
    return rows.map((r) => this.mapFx(r));
  }

  async getLatestFxRate(baseCurrency: string, quoteCurrency: string): Promise<FxRate | null> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_billing_fx_rates
       WHERE base_currency = $1 AND quote_currency = $2
       ORDER BY version DESC, effective_at DESC LIMIT 1`,
      [baseCurrency, quoteCurrency],
    );
    return rows[0] ? this.mapFx(rows[0]) : null;
  }

  async createFxRate(input: {
    baseCurrency: string;
    quoteCurrency: string;
    rate: string;
    source?: string;
  }): Promise<FxRate> {
    const ver = await this.q<{ v: string }>(
      `SELECT COALESCE(MAX(version),0)+1 AS v FROM edge_billing_fx_rates
       WHERE base_currency = $1 AND quote_currency = $2`,
      [input.baseCurrency, input.quoteCurrency],
    );
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_billing_fx_rates (base_currency, quote_currency, rate, source, version)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        input.baseCurrency,
        input.quoteCurrency,
        input.rate,
        input.source ?? 'MANUAL',
        Number(ver[0]?.v ?? 1),
      ],
    );
    return this.mapFx(rows[0]);
  }

  async listPaymentIntents(input?: {
    billingAccountId?: string;
    status?: string;
    limit?: number;
  }): Promise<PaymentIntent[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (input?.billingAccountId) {
      params.push(input.billingAccountId);
      clauses.push(`billing_account_id = $${params.length}`);
    }
    if (input?.status) {
      params.push(input.status);
      clauses.push(`status = $${params.length}`);
    }
    params.push(input?.limit ?? 100);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_payment_intents ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
    );
    return rows.map((r) => this.mapIntent(r));
  }

  async listRefunds(input?: { paymentIntentId?: string; limit?: number }): Promise<Refund[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (input?.paymentIntentId) {
      params.push(input.paymentIntentId);
      clauses.push(`payment_intent_id = $${params.length}`);
    }
    params.push(input?.limit ?? 100);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_refunds ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
    );
    return rows.map((r) => this.mapRefund(r));
  }

  async getActiveRevenuePolicy(): Promise<RevenuePolicy | null> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_billing_revenue_policies WHERE status = 'ACTIVE' ORDER BY version DESC LIMIT 1`,
    );
    return rows[0] ? this.mapRevenuePolicy(rows[0]) : null;
  }

  async listRevenuePolicies(): Promise<RevenuePolicy[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_billing_revenue_policies ORDER BY code`,
    );
    return rows.map((r) => this.mapRevenuePolicy(r));
  }

  async upsertRevenuePolicy(input: {
    code: string;
    method: string;
    rules?: Record<string, unknown>;
    status?: string;
  }): Promise<RevenuePolicy> {
    if (input.status !== 'INACTIVE') {
      await this.pool.query(
        `UPDATE edge_billing_revenue_policies SET status = 'INACTIVE', updated_at = NOW()
         WHERE status = 'ACTIVE' AND code <> $1`,
        [input.code],
      );
    }
    const ver = await this.q<{ v: string }>(
      `SELECT COALESCE(MAX(version),0)+1 AS v FROM edge_billing_revenue_policies WHERE code = $1`,
      [input.code],
    );
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_billing_revenue_policies (code, method, rules, status, version)
       VALUES ($1,$2,$3::jsonb,$4,$5)
       ON CONFLICT (code) DO UPDATE SET
         method = EXCLUDED.method,
         rules = EXCLUDED.rules,
         status = EXCLUDED.status,
         version = EXCLUDED.version,
         updated_at = NOW()
       RETURNING *`,
      [
        input.code,
        input.method,
        JSON.stringify(input.rules ?? {}),
        input.status ?? 'ACTIVE',
        Number(ver[0]?.v ?? 1),
      ],
    );
    return this.mapRevenuePolicy(rows[0]);
  }

  async sumSucceededRefunds(currency?: string): Promise<string> {
    const rows = currency
      ? await this.q<{ t: string }>(
          `SELECT COALESCE(SUM(amount),0)::text AS t FROM edge_refunds
           WHERE status = 'SUCCEEDED' AND currency = $1`,
          [currency],
        )
      : await this.q<{ t: string }>(
          `SELECT COALESCE(SUM(amount),0)::text AS t FROM edge_refunds WHERE status = 'SUCCEEDED'`,
        );
    return rows[0]?.t ?? '0';
  }

  async listDueBillingSchedules(asOf = new Date(), limit = 100): Promise<BillingSchedule[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_billing_schedules
       WHERE status = 'ACTIVE' AND next_bill_at IS NOT NULL AND next_bill_at <= $1
       ORDER BY next_bill_at ASC LIMIT $2`,
      [asOf.toISOString(), limit],
    );
    return rows.map((r) => this.mapSchedule(r));
  }

  async advanceBillingSchedule(id: string, nextBillAt: Date | null): Promise<BillingSchedule> {
    const rows = await this.q<Record<string, unknown>>(
      `UPDATE edge_billing_schedules
       SET next_bill_at = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, nextBillAt?.toISOString() ?? null],
    );
    return this.mapSchedule(rows[0]);
  }

  async createExportBatch(input: {
    exportType: string;
    currency?: string | null;
    periodStart?: Date | null;
    periodEnd?: Date | null;
    itemCount: number;
    checksumSha256?: string | null;
    artifactRef?: string | null;
    summary?: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<FinancialExportBatch> {
    const rows = await this.q<Record<string, unknown>>(
      `INSERT INTO edge_financial_export_batches
        (export_type, currency, period_start, period_end, item_count, checksum_sha256, artifact_ref, summary, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) RETURNING *`,
      [
        input.exportType,
        input.currency ?? null,
        input.periodStart?.toISOString() ?? null,
        input.periodEnd?.toISOString() ?? null,
        input.itemCount,
        input.checksumSha256 ?? null,
        input.artifactRef ?? null,
        JSON.stringify(input.summary ?? {}),
        input.createdBy ?? null,
      ],
    );
    return this.mapExportBatch(rows[0]);
  }

  async addExportItems(
    batchId: string,
    items: readonly { entityType: string; entityId: string; payload: Record<string, unknown> }[],
  ): Promise<number> {
    let n = 0;
    for (const item of items) {
      await this.pool.query(
        `INSERT INTO edge_financial_export_items (batch_id, entity_type, entity_id, payload)
         VALUES ($1,$2,$3,$4::jsonb)
         ON CONFLICT (batch_id, entity_type, entity_id) DO NOTHING`,
        [batchId, item.entityType, item.entityId, JSON.stringify(item.payload)],
      );
      n += 1;
    }
    return n;
  }

  async listExportBatches(limit = 50): Promise<FinancialExportBatch[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_financial_export_batches ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return rows.map((r) => this.mapExportBatch(r));
  }

  async getExportBatch(id: string): Promise<FinancialExportBatch | null> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_financial_export_batches WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.mapExportBatch(rows[0]) : null;
  }

  async listExportItems(
    batchId: string,
  ): Promise<{ id: string; entityType: string; entityId: string; payload: Record<string, unknown> }[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_financial_export_items WHERE batch_id = $1 ORDER BY created_at`,
      [batchId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      entityType: String(r.entity_type),
      entityId: String(r.entity_id),
      payload: (r.payload as Record<string, unknown>) ?? {},
    }));
  }

  async listInvoicesForExport(input: {
    currency?: string;
    periodStart?: Date | null;
    periodEnd?: Date | null;
  }): Promise<Invoice[]> {
    const clauses = [`status IN ('ISSUED','PARTIALLY_PAID','PAID','OVERDUE','VOIDED')`];
    const params: unknown[] = [];
    if (input.currency) {
      params.push(input.currency);
      clauses.push(`currency = $${params.length}`);
    }
    if (input.periodStart) {
      params.push(input.periodStart.toISOString());
      clauses.push(`COALESCE(issue_at, created_at) >= $${params.length}`);
    }
    if (input.periodEnd) {
      params.push(input.periodEnd.toISOString());
      clauses.push(`COALESCE(issue_at, created_at) < $${params.length}`);
    }
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_invoices WHERE ${clauses.join(' AND ')} ORDER BY created_at LIMIT 5000`,
      params,
    );
    return rows.map((r) => this.mapInvoice(r));
  }

  async listPaymentIntentsForExport(input: {
    currency?: string;
    periodStart?: Date | null;
    periodEnd?: Date | null;
  }): Promise<PaymentIntent[]> {
    const clauses = [`status = 'SUCCEEDED'`];
    const params: unknown[] = [];
    if (input.currency) {
      params.push(input.currency);
      clauses.push(`currency = $${params.length}`);
    }
    if (input.periodStart) {
      params.push(input.periodStart.toISOString());
      clauses.push(`created_at >= $${params.length}`);
    }
    if (input.periodEnd) {
      params.push(input.periodEnd.toISOString());
      clauses.push(`created_at < $${params.length}`);
    }
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM edge_payment_intents WHERE ${clauses.join(' AND ')} ORDER BY created_at LIMIT 5000`,
      params,
    );
    return rows.map((r) => this.mapIntent(r));
  }

  private mapSchedule(r: Record<string, unknown>): BillingSchedule {
    return {
      id: String(r.id),
      subscriptionId: String(r.subscription_id),
      billingAccountId: String(r.billing_account_id),
      frequency: String(r.frequency),
      nextBillAt: r.next_bill_at ? new Date(String(r.next_bill_at)) : null,
      status: String(r.status),
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapRevenuePolicy(r: Record<string, unknown>): RevenuePolicy {
    return {
      id: String(r.id),
      code: String(r.code),
      method: String(r.method),
      rules: (r.rules as Record<string, unknown>) ?? {},
      status: String(r.status),
      version: Number(r.version),
    };
  }

  private mapExportBatch(r: Record<string, unknown>): FinancialExportBatch {
    return {
      id: String(r.id),
      exportType: String(r.export_type),
      status: String(r.status),
      currency: (r.currency as string | null) ?? null,
      periodStart: r.period_start ? new Date(String(r.period_start)) : null,
      periodEnd: r.period_end ? new Date(String(r.period_end)) : null,
      itemCount: Number(r.item_count),
      checksumSha256: (r.checksum_sha256 as string | null) ?? null,
      artifactRef: (r.artifact_ref as string | null) ?? null,
      summary: (r.summary as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
    };
  }

  private mapParty(r: Record<string, unknown>): BillingParty {
    return {
      id: String(r.id),
      billingAccountId: String(r.billing_account_id),
      partyRole: String(r.party_role),
      legalName: String(r.legal_name),
      taxId: (r.tax_id as string | null) ?? null,
      country: (r.country as string | null) ?? null,
      address: (r.address as Record<string, unknown>) ?? {},
      email: (r.email as string | null) ?? null,
      status: String(r.status),
      createdAt: new Date(String(r.created_at)),
    };
  }

  private mapProfile(r: Record<string, unknown>): BillingProfile {
    return {
      id: String(r.id),
      billingAccountId: String(r.billing_account_id),
      version: Number(r.version),
      legalName: String(r.legal_name),
      tradeName: (r.trade_name as string | null) ?? null,
      country: (r.country as string | null) ?? null,
      currency: String(r.currency),
      paymentTermsDays: Number(r.payment_terms_days),
      isCurrent: Boolean(r.is_current),
      snapshot: (r.snapshot as Record<string, unknown>) ?? {},
      validFrom: new Date(String(r.valid_from)),
      createdAt: new Date(String(r.created_at)),
    };
  }

  private mapDocument(r: Record<string, unknown>): InvoiceDocument {
    return {
      id: String(r.id),
      invoiceId: String(r.invoice_id),
      documentType: String(r.document_type),
      storageRef: String(r.storage_ref),
      contentSha256: (r.content_sha256 as string | null) ?? null,
      issuedAt: new Date(String(r.issued_at)),
      immutable: Boolean(r.immutable),
    };
  }

  private mapCreditNote(r: Record<string, unknown>): CreditNote {
    return {
      id: String(r.id),
      creditNoteNumber: String(r.credit_note_number),
      invoiceId: (r.invoice_id as string | null) ?? null,
      billingAccountId: String(r.billing_account_id),
      status: String(r.status),
      currency: String(r.currency),
      total: this.num(r.total),
      reason: (r.reason as string | null) ?? null,
      snapshot: (r.snapshot as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
    };
  }

  private mapCollection(r: Record<string, unknown>): CollectionCase {
    return {
      id: String(r.id),
      billingAccountId: String(r.billing_account_id),
      invoiceId: String(r.invoice_id),
      status: String(r.status),
      overdueSince: r.overdue_since ? new Date(String(r.overdue_since)) : null,
      nextActionAt: r.next_action_at ? new Date(String(r.next_action_at)) : null,
      policyCode: (r.policy_code as string | null) ?? null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapPolicy(r: Record<string, unknown>): BillingPolicy {
    return {
      id: String(r.id),
      code: String(r.code),
      policyType: String(r.policy_type),
      rules: (r.rules as Record<string, unknown>) ?? {},
      status: String(r.status),
    };
  }

  private mapPaymentMethod(r: Record<string, unknown>): PaymentMethodRecord {
    return {
      id: String(r.id),
      billingAccountId: String(r.billing_account_id),
      provider: String(r.provider),
      providerMethodRef: String(r.provider_method_ref),
      methodType: String(r.method_type),
      brand: (r.brand as string | null) ?? null,
      last4: (r.last4 as string | null) ?? null,
      status: String(r.status),
      isDefault: Boolean(r.is_default),
      createdAt: new Date(String(r.created_at)),
    };
  }

  private mapReconRun(r: Record<string, unknown>): ReconciliationRun {
    return {
      id: String(r.id),
      provider: String(r.provider),
      status: String(r.status),
      startedAt: new Date(String(r.started_at)),
      completedAt: r.completed_at ? new Date(String(r.completed_at)) : null,
      summary: (r.summary as Record<string, unknown>) ?? {},
    };
  }

  private mapReconException(r: Record<string, unknown>): ReconciliationException {
    return {
      id: String(r.id),
      runId: String(r.run_id),
      status: String(r.status),
      exceptionType: String(r.exception_type),
      internalRef: (r.internal_ref as string | null) ?? null,
      providerRef: (r.provider_ref as string | null) ?? null,
      details: (r.details as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      resolvedAt: r.resolved_at ? new Date(String(r.resolved_at)) : null,
    };
  }

  private mapProviderTxn(r: Record<string, unknown>): ProviderTransaction {
    return {
      id: String(r.id),
      provider: String(r.provider),
      providerTxnId: String(r.provider_txn_id),
      paymentIntentId: (r.payment_intent_id as string | null) ?? null,
      amount: this.num(r.amount),
      currency: String(r.currency),
      status: String(r.status),
      fees: this.num(r.fees),
      occurredAt: new Date(String(r.occurred_at)),
    };
  }

  private mapSettlement(r: Record<string, unknown>): SettlementBatch {
    return {
      id: String(r.id),
      provider: String(r.provider),
      merchantAccount: (r.merchant_account as string | null) ?? null,
      settlementDate: String(r.settlement_date).slice(0, 10),
      grossAmount: this.num(r.gross_amount),
      fees: this.num(r.fees),
      refunds: this.num(r.refunds),
      chargebacks: this.num(r.chargebacks),
      netAmount: this.num(r.net_amount),
      currency: String(r.currency),
      bankReference: (r.bank_reference as string | null) ?? null,
      status: String(r.status),
    };
  }

  private mapDispute(r: Record<string, unknown>): BillingDispute {
    return {
      id: String(r.id),
      paymentIntentId: (r.payment_intent_id as string | null) ?? null,
      invoiceId: (r.invoice_id as string | null) ?? null,
      billingAccountId: String(r.billing_account_id),
      provider: String(r.provider),
      providerDisputeId: (r.provider_dispute_id as string | null) ?? null,
      disputeType: String(r.dispute_type),
      amount: this.num(r.amount),
      currency: String(r.currency),
      status: String(r.status),
      dueAt: r.due_at ? new Date(String(r.due_at)) : null,
      createdAt: new Date(String(r.created_at)),
    };
  }

  private mapFx(r: Record<string, unknown>): FxRate {
    return {
      id: String(r.id),
      baseCurrency: String(r.base_currency),
      quoteCurrency: String(r.quote_currency),
      rate: this.num(r.rate),
      source: String(r.source),
      effectiveAt: new Date(String(r.effective_at)),
      version: Number(r.version),
    };
  }

  private mapRefund(r: Record<string, unknown>): Refund {
    return {
      id: String(r.id),
      paymentIntentId: String(r.payment_intent_id),
      invoiceId: (r.invoice_id as string | null) ?? null,
      amount: this.num(r.amount),
      currency: String(r.currency),
      status: String(r.status),
      reason: (r.reason as string | null) ?? null,
      providerRef: (r.provider_ref as string | null) ?? null,
      approvedBy: (r.approved_by as string | null) ?? null,
      correlationId: (r.correlation_id as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }
}
