import { Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  AccountRelationship,
  ContactRole,
  ContractAmendment,
  DiscoveryQuestionnaire,
  GlobalSearchHit,
  SalesExportJob,
  SalesPlatformRepositoryPort,
  SavedView,
} from '../../domain/ports/sales-platform-repository.port.js';

@Injectable()
export class PgSalesPlatformRepository implements SalesPlatformRepositoryPort {
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

  async listAccountRelationships(accountId: string): Promise<AccountRelationship[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_account_relationships
       WHERE from_account_id = $1 OR to_account_id = $1
       ORDER BY created_at DESC`,
      [accountId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      fromAccountId: String(r.from_account_id),
      toAccountId: String(r.to_account_id),
      relationshipType: String(r.relationship_type),
      notes: (r.notes as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
    }));
  }

  async addAccountRelationship(input: {
    fromAccountId: string;
    toAccountId: string;
    relationshipType: string;
    notes?: string | null;
    createdBy?: string | null;
  }): Promise<AccountRelationship> {
    const rows = await this.q(
      `INSERT INTO edge_sales_account_relationships
         (from_account_id, to_account_id, relationship_type, notes, created_by)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (from_account_id, to_account_id, relationship_type) DO UPDATE
         SET notes = EXCLUDED.notes
       RETURNING *`,
      [
        input.fromAccountId,
        input.toAccountId,
        input.relationshipType,
        input.notes ?? null,
        input.createdBy ?? null,
      ],
    );
    const r = rows[0]!;
    return {
      id: String(r.id),
      fromAccountId: String(r.from_account_id),
      toAccountId: String(r.to_account_id),
      relationshipType: String(r.relationship_type),
      notes: (r.notes as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
    };
  }

  async getAccountHierarchy(accountId: string) {
    const account = await this.q(
      `SELECT id, parent_account_id, legal_name FROM edge_sales_commercial_accounts WHERE id = $1`,
      [accountId],
    );
    if (!account[0]) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Account not found');
    const children = await this.q(
      `SELECT id, legal_name, account_type FROM edge_sales_commercial_accounts
       WHERE parent_account_id = $1 AND status <> 'MERGED'
       ORDER BY legal_name`,
      [accountId],
    );
    const relationships = await this.listAccountRelationships(accountId);
    return {
      accountId,
      parentAccountId: (account[0].parent_account_id as string | null) ?? null,
      children: children.map((c) => ({
        id: String(c.id),
        legalName: String(c.legal_name),
        accountType: String(c.account_type),
      })),
      relationships,
    };
  }

  async addContactRole(input: {
    contactId: string;
    accountId: string;
    roleType: string;
    isPrimary?: boolean;
    effectiveUntil?: string | null;
  }): Promise<ContactRole> {
    if (input.isPrimary) {
      await this.q(
        `UPDATE edge_sales_contact_roles SET is_primary = FALSE
         WHERE contact_id = $1 AND account_id = $2`,
        [input.contactId, input.accountId],
      );
    }
    const rows = await this.q(
      `INSERT INTO edge_sales_contact_roles
         (contact_id, account_id, role_type, is_primary, effective_until)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [
        input.contactId,
        input.accountId,
        input.roleType,
        input.isPrimary ?? false,
        input.effectiveUntil ?? null,
      ],
    );
    const r = rows[0]!;
    return {
      id: String(r.id),
      contactId: String(r.contact_id),
      accountId: String(r.account_id),
      roleType: String(r.role_type),
      isPrimary: Boolean(r.is_primary),
      effectiveFrom: new Date(String(r.effective_from)),
      effectiveUntil: r.effective_until ? new Date(String(r.effective_until)) : null,
    };
  }

  async listContactRoles(contactId: string): Promise<ContactRole[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_contact_roles WHERE contact_id = $1 ORDER BY effective_from DESC`,
      [contactId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      contactId: String(r.contact_id),
      accountId: String(r.account_id),
      roleType: String(r.role_type),
      isPrimary: Boolean(r.is_primary),
      effectiveFrom: new Date(String(r.effective_from)),
      effectiveUntil: r.effective_until ? new Date(String(r.effective_until)) : null,
    }));
  }

  async upsertDiscoveryQuestionnaire(input: {
    code: string;
    name: string;
    verticalId?: string | null;
    productId?: string | null;
    questions: unknown[];
    status?: string;
  }): Promise<DiscoveryQuestionnaire> {
    const rows = await this.q(
      `INSERT INTO edge_sales_discovery_questionnaires
         (code, name, vertical_id, product_id, questions, status)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6)
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         vertical_id = EXCLUDED.vertical_id,
         product_id = EXCLUDED.product_id,
         questions = EXCLUDED.questions,
         status = EXCLUDED.status,
         updated_at = NOW()
       RETURNING *`,
      [
        input.code,
        input.name,
        input.verticalId ?? null,
        input.productId ?? null,
        JSON.stringify(input.questions),
        input.status ?? 'ACTIVE',
      ],
    );
    const r = rows[0]!;
    return {
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      verticalId: (r.vertical_id as string | null) ?? null,
      productId: (r.product_id as string | null) ?? null,
      status: String(r.status),
      questions: (r.questions as unknown[]) ?? [],
    };
  }

  async listDiscoveryQuestionnaires(opts?: {
    verticalId?: string;
    productId?: string;
  }): Promise<DiscoveryQuestionnaire[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_discovery_questionnaires
       WHERE status = 'ACTIVE'
         AND ($1::uuid IS NULL OR vertical_id = $1)
         AND ($2::uuid IS NULL OR product_id = $2)
       ORDER BY name`,
      [opts?.verticalId ?? null, opts?.productId ?? null],
    );
    return rows.map((r) => ({
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      verticalId: (r.vertical_id as string | null) ?? null,
      productId: (r.product_id as string | null) ?? null,
      status: String(r.status),
      questions: (r.questions as unknown[]) ?? [],
    }));
  }

  async getDiscoveryQuestionnaire(id: string): Promise<DiscoveryQuestionnaire | null> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_discovery_questionnaires WHERE id = $1`,
      [id],
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      verticalId: (r.vertical_id as string | null) ?? null,
      productId: (r.product_id as string | null) ?? null,
      status: String(r.status),
      questions: (r.questions as unknown[]) ?? [],
    };
  }

  async createContractAmendment(input: {
    contractId: string;
    amendmentNumber: string;
    summary: string;
    changes?: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<ContractAmendment> {
    const rows = await this.q(
      `INSERT INTO edge_sales_contract_amendments
         (contract_id, amendment_number, summary, changes, created_by)
       VALUES ($1,$2,$3,$4::jsonb,$5)
       RETURNING *`,
      [
        input.contractId,
        input.amendmentNumber,
        input.summary,
        JSON.stringify(input.changes ?? {}),
        input.createdBy ?? null,
      ],
    );
    const r = rows[0]!;
    return {
      id: String(r.id),
      contractId: String(r.contract_id),
      amendmentNumber: String(r.amendment_number),
      status: String(r.status),
      summary: String(r.summary),
      changes: (r.changes as Record<string, unknown>) ?? {},
      executedAt: r.executed_at ? new Date(String(r.executed_at)) : null,
      createdAt: new Date(String(r.created_at)),
    };
  }

  async listContractAmendments(contractId: string): Promise<ContractAmendment[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_contract_amendments WHERE contract_id = $1 ORDER BY created_at DESC`,
      [contractId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      contractId: String(r.contract_id),
      amendmentNumber: String(r.amendment_number),
      status: String(r.status),
      summary: String(r.summary),
      changes: (r.changes as Record<string, unknown>) ?? {},
      executedAt: r.executed_at ? new Date(String(r.executed_at)) : null,
      createdAt: new Date(String(r.created_at)),
    }));
  }

  async executeContractAmendment(id: string): Promise<ContractAmendment> {
    const rows = await this.q(
      `UPDATE edge_sales_contract_amendments
       SET status = 'EXECUTED', executed_at = NOW()
       WHERE id = $1 AND status IN ('DRAFT','APPROVED')
       RETURNING *`,
      [id],
    );
    if (!rows[0]) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Amendment not found');
    const r = rows[0];
    return {
      id: String(r.id),
      contractId: String(r.contract_id),
      amendmentNumber: String(r.amendment_number),
      status: String(r.status),
      summary: String(r.summary),
      changes: (r.changes as Record<string, unknown>) ?? {},
      executedAt: r.executed_at ? new Date(String(r.executed_at)) : null,
      createdAt: new Date(String(r.created_at)),
    };
  }

  async replaceOrderLines(
    orderId: string,
    lines: Array<{
      lineNumber: number;
      description: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      productId?: string | null;
      planId?: string | null;
      packageId?: string | null;
      addonId?: string | null;
      p2Refs?: Record<string, unknown>;
    }>,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM edge_sales_order_lines WHERE order_id = $1`, [orderId]);
      for (const line of lines) {
        await client.query(
          `INSERT INTO edge_sales_order_lines
             (order_id, line_number, description, quantity, unit_price, line_total,
              product_id, plan_id, package_id, addon_id, p2_refs)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
          [
            orderId,
            line.lineNumber,
            line.description,
            line.quantity,
            line.unitPrice,
            line.lineTotal,
            line.productId ?? null,
            line.planId ?? null,
            line.packageId ?? null,
            line.addonId ?? null,
            JSON.stringify(line.p2Refs ?? {}),
          ],
        );
      }
      const total = lines.reduce((s, l) => s + l.lineTotal, 0);
      await client.query(
        `UPDATE edge_sales_orders SET total_amount = $2, updated_at = NOW() WHERE id = $1`,
        [orderId, total],
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async listOrderLines(orderId: string) {
    const rows = await this.q(
      `SELECT * FROM edge_sales_order_lines WHERE order_id = $1 ORDER BY line_number`,
      [orderId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      lineNumber: Number(r.line_number),
      description: String(r.description),
      quantity: String(r.quantity),
      unitPrice: String(r.unit_price),
      lineTotal: String(r.line_total),
    }));
  }

  async saveForecastSnapshot(input: {
    periodType: string;
    periodKey: string;
    scopeType: string;
    scopeId?: string | null;
    model: string;
    currency: string;
    amount: number;
    opportunityCount: number;
    assumptions: Record<string, unknown>;
    createdBy?: string | null;
  }) {
    const versionRows = await this.q<{ v: string }>(
      `SELECT COALESCE(MAX(version),0)::text AS v FROM edge_sales_forecast_snapshots
       WHERE period_type = $1 AND period_key = $2 AND scope_type = $3
         AND (($4::uuid IS NULL AND scope_id IS NULL) OR scope_id = $4)
         AND model = $5`,
      [
        input.periodType,
        input.periodKey,
        input.scopeType,
        input.scopeId ?? null,
        input.model,
      ],
    );
    const version = Number(versionRows[0]?.v ?? 0) + 1;
    const rows = await this.q(
      `INSERT INTO edge_sales_forecast_snapshots
         (period_type, period_key, scope_type, scope_id, model, currency, amount,
          opportunity_count, assumptions, version, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
       RETURNING id, version`,
      [
        input.periodType,
        input.periodKey,
        input.scopeType,
        input.scopeId ?? null,
        input.model,
        input.currency,
        input.amount,
        input.opportunityCount,
        JSON.stringify(input.assumptions),
        version,
        input.createdBy ?? null,
      ],
    );
    return { id: String(rows[0]!.id), version: Number(rows[0]!.version) };
  }

  async listForecastSnapshots(opts?: {
    periodType?: string;
    periodKey?: string;
    model?: string;
  }) {
    const rows = await this.q(
      `SELECT * FROM edge_sales_forecast_snapshots
       WHERE ($1::text IS NULL OR period_type = $1)
         AND ($2::text IS NULL OR period_key = $2)
         AND ($3::text IS NULL OR model = $3)
       ORDER BY created_at DESC
       LIMIT 50`,
      [opts?.periodType ?? null, opts?.periodKey ?? null, opts?.model ?? null],
    );
    return rows.map((r) => ({
      id: String(r.id),
      periodType: String(r.period_type),
      periodKey: String(r.period_key),
      model: String(r.model),
      amount: String(r.amount),
      opportunityCount: Number(r.opportunity_count),
      version: Number(r.version),
      assumptions: (r.assumptions as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
    }));
  }

  async createSavedView(input: {
    name: string;
    scope: string;
    entityType: string;
    ownerAdministratorId?: string | null;
    teamId?: string | null;
    filters?: Record<string, unknown>;
    columns?: unknown[];
    sortSpec?: unknown[];
    isDefault?: boolean;
  }): Promise<SavedView> {
    const rows = await this.q(
      `INSERT INTO edge_sales_saved_views
         (name, scope, entity_type, owner_administrator_id, team_id, filters, columns, sort_spec, is_default)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9)
       RETURNING *`,
      [
        input.name,
        input.scope,
        input.entityType,
        input.ownerAdministratorId ?? null,
        input.teamId ?? null,
        JSON.stringify(input.filters ?? {}),
        JSON.stringify(input.columns ?? []),
        JSON.stringify(input.sortSpec ?? []),
        input.isDefault ?? false,
      ],
    );
    const r = rows[0]!;
    return {
      id: String(r.id),
      name: String(r.name),
      scope: String(r.scope),
      entityType: String(r.entity_type),
      ownerAdministratorId: (r.owner_administrator_id as string | null) ?? null,
      teamId: (r.team_id as string | null) ?? null,
      filters: (r.filters as Record<string, unknown>) ?? {},
      columns: (r.columns as unknown[]) ?? [],
      sortSpec: (r.sort_spec as unknown[]) ?? [],
      isDefault: Boolean(r.is_default),
    };
  }

  async listSavedViews(opts: {
    actorId: string;
    entityType?: string;
    teamIds?: string[];
  }): Promise<SavedView[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_saved_views
       WHERE ($1::text IS NULL OR entity_type = $1)
         AND (
           scope = 'GLOBAL'
           OR (scope = 'PERSONAL' AND owner_administrator_id = $2)
           OR (scope = 'TEAM' AND team_id = ANY($3::uuid[]))
           OR scope = 'MANAGERIAL'
         )
       ORDER BY is_default DESC, name`,
      [opts.entityType ?? null, opts.actorId, opts.teamIds ?? []],
    );
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      scope: String(r.scope),
      entityType: String(r.entity_type),
      ownerAdministratorId: (r.owner_administrator_id as string | null) ?? null,
      teamId: (r.team_id as string | null) ?? null,
      filters: (r.filters as Record<string, unknown>) ?? {},
      columns: (r.columns as unknown[]) ?? [],
      sortSpec: (r.sort_spec as unknown[]) ?? [],
      isDefault: Boolean(r.is_default),
    }));
  }

  async deleteSavedView(id: string, actorId: string): Promise<void> {
    const rows = await this.q(
      `DELETE FROM edge_sales_saved_views
       WHERE id = $1 AND (owner_administrator_id = $2 OR scope IN ('GLOBAL','MANAGERIAL'))
       RETURNING id`,
      [id, actorId],
    );
    if (!rows[0]) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Saved view not found');
  }

  async createExportJob(input: {
    entityType: string;
    status: string;
    requestedBy: string;
    filters?: Record<string, unknown>;
    rowCount: number;
    format: string;
    payload: unknown[];
    denialReason?: string | null;
    correlationId?: string | null;
  }): Promise<SalesExportJob> {
    const rows = await this.q(
      `INSERT INTO edge_sales_export_jobs
         (entity_type, status, requested_by, filters, row_count, format, payload, denial_reason, correlation_id)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7::jsonb,$8,$9)
       RETURNING *`,
      [
        input.entityType,
        input.status,
        input.requestedBy,
        JSON.stringify(input.filters ?? {}),
        input.rowCount,
        input.format,
        JSON.stringify(input.payload),
        input.denialReason ?? null,
        input.correlationId ?? null,
      ],
    );
    const r = rows[0]!;
    return {
      id: String(r.id),
      entityType: String(r.entity_type),
      status: String(r.status),
      requestedBy: String(r.requested_by),
      rowCount: Number(r.row_count),
      format: String(r.format),
      payload: (r.payload as unknown[]) ?? [],
      denialReason: (r.denial_reason as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
    };
  }

  async listExportJobs(actorId: string, limit = 20): Promise<SalesExportJob[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_export_jobs WHERE requested_by = $1
       ORDER BY created_at DESC LIMIT $2`,
      [actorId, limit],
    );
    return rows.map((r) => ({
      id: String(r.id),
      entityType: String(r.entity_type),
      status: String(r.status),
      requestedBy: String(r.requested_by),
      rowCount: Number(r.row_count),
      format: String(r.format),
      payload: (r.payload as unknown[]) ?? [],
      denialReason: (r.denial_reason as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
    }));
  }

  async globalSearch(input: {
    q: string;
    limit?: number;
    actorId?: string;
    visibilityMode?: 'OWNED' | 'TEAM' | 'ALL';
    teamIds?: string[];
  }): Promise<GlobalSearchHit[]> {
    const q = `%${input.q.trim().toLowerCase()}%`;
    const limit = input.limit ?? 40;
    const mode = input.visibilityMode ?? 'ALL';
    const actorId = input.actorId ?? null;
    const teamIds = input.teamIds ?? [];

    const accounts = await this.q(
      `SELECT id, legal_name AS title, account_number AS subtitle, status
       FROM edge_sales_commercial_accounts
       WHERE status <> 'MERGED'
         AND (lower(legal_name) LIKE $1 OR lower(COALESCE(trade_name,'')) LIKE $1
              OR lower(account_number) LIKE $1 OR lower(COALESCE(email_domain_normalized,'')) LIKE $1)
         AND (
           $2 = 'ALL'
           OR ($2 = 'OWNED' AND owner_administrator_id = $3)
           OR ($2 = 'TEAM' AND team_id = ANY($4::uuid[]))
         )
       LIMIT $5`,
      [q, mode, actorId, teamIds, limit],
    );
    const contacts = await this.q(
      `SELECT id, (first_name || ' ' || last_name) AS title, email_normalized AS subtitle, status
       FROM edge_sales_contacts
       WHERE lower(first_name || ' ' || last_name) LIKE $1
          OR lower(COALESCE(email_normalized,'')) LIKE $1
       LIMIT $2`,
      [q, Math.ceil(limit / 2)],
    );
    const opps = await this.q(
      `SELECT id, name AS title, opportunity_number AS subtitle, status
       FROM edge_sales_opportunities
       WHERE lower(name) LIKE $1 OR lower(opportunity_number) LIKE $1
         AND (
           $2 = 'ALL'
           OR ($2 = 'OWNED' AND owner_administrator_id = $3)
           OR ($2 = 'TEAM' AND team_id = ANY($4::uuid[]))
         )
       LIMIT $5`,
      [q, mode, actorId, teamIds, Math.ceil(limit / 2)],
    );
    const leads = await this.q(
      `SELECT id, marketing_lead_id::text AS title, status::text AS subtitle, status
       FROM edge_sales_leads
       WHERE marketing_lead_id::text LIKE $1 OR status::text LIKE $1
       LIMIT $2`,
      [q, Math.ceil(limit / 3)],
    );

    const hits: GlobalSearchHit[] = [
      ...accounts.map((r) => ({
        entityType: 'ACCOUNT',
        id: String(r.id),
        title: String(r.title),
        subtitle: (r.subtitle as string | null) ?? null,
        status: (r.status as string | null) ?? null,
      })),
      ...contacts.map((r) => ({
        entityType: 'CONTACT',
        id: String(r.id),
        title: String(r.title),
        subtitle: (r.subtitle as string | null) ?? null,
        status: (r.status as string | null) ?? null,
      })),
      ...opps.map((r) => ({
        entityType: 'OPPORTUNITY',
        id: String(r.id),
        title: String(r.title),
        subtitle: (r.subtitle as string | null) ?? null,
        status: (r.status as string | null) ?? null,
      })),
      ...leads.map((r) => ({
        entityType: 'LEAD',
        id: String(r.id),
        title: String(r.title),
        subtitle: (r.subtitle as string | null) ?? null,
        status: (r.status as string | null) ?? null,
      })),
    ];
    return hits.slice(0, limit);
  }

  async findIdempotentResponse(idempotencyKey: string, routeKey: string) {
    const rows = await this.q(
      `SELECT response_status, response_body FROM edge_sales_idempotency_keys
       WHERE idempotency_key = $1 AND route_key = $2`,
      [idempotencyKey, routeKey],
    );
    if (!rows[0]) return null;
    return {
      responseStatus: Number(rows[0].response_status),
      responseBody: (rows[0].response_body as Record<string, unknown>) ?? {},
    };
  }

  async saveIdempotentResponse(input: {
    idempotencyKey: string;
    routeKey: string;
    actorId?: string | null;
    responseStatus?: number;
    responseBody: Record<string, unknown>;
  }): Promise<void> {
    await this.q(
      `INSERT INTO edge_sales_idempotency_keys
         (idempotency_key, route_key, actor_id, response_status, response_body)
       VALUES ($1,$2,$3,$4,$5::jsonb)
       ON CONFLICT (idempotency_key, route_key) DO NOTHING`,
      [
        input.idempotencyKey,
        input.routeKey,
        input.actorId ?? null,
        input.responseStatus ?? 200,
        JSON.stringify(input.responseBody),
      ],
    );
  }

  async grantVisibility(input: {
    subjectType: string;
    subjectId: string;
    granteeAdministratorId?: string | null;
    granteeTeamId?: string | null;
    accessLevel?: string;
    grantedBy?: string | null;
  }): Promise<void> {
    await this.q(
      `INSERT INTO edge_sales_visibility_grants
         (subject_type, subject_id, grantee_administrator_id, grantee_team_id, access_level, granted_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        input.subjectType,
        input.subjectId,
        input.granteeAdministratorId ?? null,
        input.granteeTeamId ?? null,
        input.accessLevel ?? 'READ',
        input.grantedBy ?? null,
      ],
    );
  }

  async listVisibilityGrants(subjectType: string, subjectId: string) {
    const rows = await this.q(
      `SELECT * FROM edge_sales_visibility_grants
       WHERE subject_type = $1 AND subject_id = $2`,
      [subjectType, subjectId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      granteeAdministratorId: (r.grantee_administrator_id as string | null) ?? null,
      granteeTeamId: (r.grantee_team_id as string | null) ?? null,
      accessLevel: String(r.access_level),
    }));
  }

  async canAccessSubject(input: {
    subjectType: string;
    subjectId: string;
    actorId: string;
    teamIds: string[];
    ownerAdministratorId?: string | null;
    isElevated?: boolean;
  }): Promise<boolean> {
    if (input.isElevated) return true;
    if (input.ownerAdministratorId && input.ownerAdministratorId === input.actorId) {
      return true;
    }
    const rows = await this.q<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_sales_visibility_grants
       WHERE subject_type = $1 AND subject_id = $2
         AND (
           grantee_administrator_id = $3
           OR grantee_team_id = ANY($4::uuid[])
         )`,
      [input.subjectType, input.subjectId, input.actorId, input.teamIds],
    );
    return Number(rows[0]?.c ?? 0) > 0;
  }

  async recordCalendarSyncEvent(input: {
    activityId: string;
    provider: string;
    outcome: string;
    externalRef?: string | null;
    failureMessage?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    await this.q(
      `INSERT INTO edge_sales_calendar_sync_events
         (activity_id, provider, outcome, external_ref, failure_message, payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        input.activityId,
        input.provider,
        input.outcome,
        input.externalRef ?? null,
        input.failureMessage ?? null,
        JSON.stringify(input.payload ?? {}),
      ],
    );
  }

  async updateProposalDocumentRef(proposalId: string, documentRef: string): Promise<void> {
    const rows = await this.q(
      `UPDATE edge_sales_proposals SET pdf_document_ref = $2, updated_at = NOW()
       WHERE id = $1 RETURNING id`,
      [proposalId, documentRef],
    );
    if (!rows[0]) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Proposal not found');
  }
}
