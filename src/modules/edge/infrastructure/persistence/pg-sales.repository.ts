import { Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  CommercialAccount,
  DuplicateAccountCandidate,
  SalesContact,
  SalesLead,
  SalesNote,
  SalesOpportunity,
  SalesOpportunityCompetitor,
  SalesOpportunityRisk,
  SalesOpportunityStageHistory,
  SalesPipeline,
  SalesPipelineStage,
  SalesRepositoryPort,
  SalesTask,
  SalesTeam,
  SalesTerritory,
  SalesTimelineEvent,
} from '../../domain/ports/sales-repository.port.js';

@Injectable()
export class PgSalesRepository implements SalesRepositoryPort {
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

  private mapTeam(r: Record<string, unknown>): SalesTeam {
    return {
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      description: (r.description as string | null) ?? null,
      managerAdministratorId: (r.manager_administrator_id as string | null) ?? null,
      status: String(r.status),
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapTerritory(r: Record<string, unknown>): SalesTerritory {
    return {
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      territoryType: String(r.territory_type),
      country: (r.country as string | null) ?? null,
      region: (r.region as string | null) ?? null,
      productId: (r.product_id as string | null) ?? null,
      verticalId: (r.vertical_id as string | null) ?? null,
      marketId: (r.market_id as string | null) ?? null,
      status: String(r.status),
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapAccount(r: Record<string, unknown>): CommercialAccount {
    return {
      id: String(r.id),
      accountNumber: String(r.account_number),
      legalName: String(r.legal_name),
      tradeName: (r.trade_name as string | null) ?? null,
      accountType: String(r.account_type),
      status: String(r.status),
      country: (r.country as string | null) ?? null,
      region: (r.region as string | null) ?? null,
      city: (r.city as string | null) ?? null,
      addressLine1: (r.address_line1 as string | null) ?? null,
      industry: (r.industry as string | null) ?? null,
      companySize: (r.company_size as string | null) ?? null,
      website: (r.website as string | null) ?? null,
      legalIdentifier: (r.legal_identifier as string | null) ?? null,
      legalIdentifierType: (r.legal_identifier_type as string | null) ?? null,
      emailDomainNormalized: (r.email_domain_normalized as string | null) ?? null,
      phoneNormalized: (r.phone_normalized as string | null) ?? null,
      parentAccountId: (r.parent_account_id as string | null) ?? null,
      ownerAdministratorId: (r.owner_administrator_id as string | null) ?? null,
      teamId: (r.team_id as string | null) ?? null,
      primaryProductId: (r.primary_product_id as string | null) ?? null,
      verticalId: (r.vertical_id as string | null) ?? null,
      mergedIntoAccountId: (r.merged_into_account_id as string | null) ?? null,
      nameNormalized: String(r.name_normalized),
      billingInfo: (r.billing_info as Record<string, unknown>) ?? {},
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapContact(r: Record<string, unknown>): SalesContact {
    return {
      id: String(r.id),
      accountId: String(r.account_id),
      firstName: String(r.first_name),
      lastName: String(r.last_name),
      emailNormalized: (r.email_normalized as string | null) ?? null,
      phoneNormalized: (r.phone_normalized as string | null) ?? null,
      jobTitle: (r.job_title as string | null) ?? null,
      department: (r.department as string | null) ?? null,
      stakeholderType: String(r.stakeholder_type),
      influenceLevel: String(r.influence_level),
      communicationPreference: (r.communication_preference as string | null) ?? null,
      status: String(r.status),
      ownerAdministratorId: (r.owner_administrator_id as string | null) ?? null,
      marketingLeadId: (r.marketing_lead_id as string | null) ?? null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapLead(r: Record<string, unknown>): SalesLead {
    return {
      id: String(r.id),
      marketingLeadId: String(r.marketing_lead_id),
      status: String(r.status),
      accountId: (r.account_id as string | null) ?? null,
      contactId: (r.contact_id as string | null) ?? null,
      ownerAdministratorId: (r.owner_administrator_id as string | null) ?? null,
      teamId: (r.team_id as string | null) ?? null,
      productId: (r.product_id as string | null) ?? null,
      verticalId: (r.vertical_id as string | null) ?? null,
      marketingScore: r.marketing_score == null ? null : String(r.marketing_score),
      salesPriority: String(r.sales_priority),
      rejectionReasonCode: (r.rejection_reason_code as string | null) ?? null,
      rejectionReasonText: (r.rejection_reason_text as string | null) ?? null,
      qualification: (r.qualification as Record<string, unknown>) ?? {},
      provenance: (r.provenance as Record<string, unknown>) ?? {},
      receivedAt: new Date(String(r.received_at)),
      reviewedAt: r.reviewed_at ? new Date(String(r.reviewed_at)) : null,
      acceptedAt: r.accepted_at ? new Date(String(r.accepted_at)) : null,
      qualifiedAt: r.qualified_at ? new Date(String(r.qualified_at)) : null,
      slaDueAt: r.sla_due_at ? new Date(String(r.sla_due_at)) : null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  private mapNote(r: Record<string, unknown>): SalesNote {
    return {
      id: String(r.id),
      accountId: (r.account_id as string | null) ?? null,
      contactId: (r.contact_id as string | null) ?? null,
      salesLeadId: (r.sales_lead_id as string | null) ?? null,
      body: String(r.body),
      visibility: String(r.visibility),
      authorId: (r.author_id as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
    };
  }

  private mapTimeline(r: Record<string, unknown>): SalesTimelineEvent {
    return {
      id: String(r.id),
      accountId: (r.account_id as string | null) ?? null,
      contactId: (r.contact_id as string | null) ?? null,
      salesLeadId: (r.sales_lead_id as string | null) ?? null,
      eventType: String(r.event_type),
      provenance: String(r.provenance),
      title: String(r.title),
      body: (r.body as string | null) ?? null,
      actorId: (r.actor_id as string | null) ?? null,
      occurredAt: new Date(String(r.occurred_at)),
      metadata: (r.metadata as Record<string, unknown>) ?? {},
    };
  }

  private mapTask(r: Record<string, unknown>): SalesTask {
    return {
      id: String(r.id),
      accountId: (r.account_id as string | null) ?? null,
      contactId: (r.contact_id as string | null) ?? null,
      salesLeadId: (r.sales_lead_id as string | null) ?? null,
      title: String(r.title),
      description: (r.description as string | null) ?? null,
      status: String(r.status),
      priority: String(r.priority),
      dueAt: r.due_at ? new Date(String(r.due_at)) : null,
      assigneeId: (r.assignee_id as string | null) ?? null,
      createdBy: (r.created_by as string | null) ?? null,
      completedAt: r.completed_at ? new Date(String(r.completed_at)) : null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  async createTeam(input: {
    code: string;
    name: string;
    description?: string | null;
    managerAdministratorId?: string | null;
    createdBy?: string | null;
  }): Promise<SalesTeam> {
    const rows = await this.q(
      `INSERT INTO edge_sales_teams (code, name, description, manager_administrator_id, created_by)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [
        input.code,
        input.name,
        input.description ?? null,
        input.managerAdministratorId ?? null,
        input.createdBy ?? null,
      ],
    );
    return this.mapTeam(rows[0]!);
  }

  async listTeams(): Promise<SalesTeam[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_teams ORDER BY name ASC`,
    );
    return rows.map((r) => this.mapTeam(r));
  }

  async getTeam(id: string): Promise<SalesTeam | null> {
    const rows = await this.q(`SELECT * FROM edge_sales_teams WHERE id = $1`, [id]);
    return rows[0] ? this.mapTeam(rows[0]) : null;
  }

  async addTeamMember(input: {
    teamId: string;
    administratorId: string;
    memberRole?: string;
    territoryId?: string | null;
  }): Promise<void> {
    await this.q(
      `INSERT INTO edge_sales_team_members (team_id, administrator_id, member_role, territory_id)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (team_id, administrator_id) DO UPDATE
       SET member_role = EXCLUDED.member_role,
           territory_id = EXCLUDED.territory_id,
           active = TRUE`,
      [
        input.teamId,
        input.administratorId,
        input.memberRole ?? 'REPRESENTATIVE',
        input.territoryId ?? null,
      ],
    );
  }

  async createTerritory(input: {
    code: string;
    name: string;
    territoryType?: string;
    country?: string | null;
    region?: string | null;
    productId?: string | null;
    verticalId?: string | null;
    marketId?: string | null;
  }): Promise<SalesTerritory> {
    const rows = await this.q(
      `INSERT INTO edge_sales_territories
         (code, name, territory_type, country, region, product_id, vertical_id, market_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        input.code,
        input.name,
        input.territoryType ?? 'GEOGRAPHIC',
        input.country ?? null,
        input.region ?? null,
        input.productId ?? null,
        input.verticalId ?? null,
        input.marketId ?? null,
      ],
    );
    return this.mapTerritory(rows[0]!);
  }

  async listTerritories(): Promise<SalesTerritory[]> {
    const rows = await this.q(`SELECT * FROM edge_sales_territories ORDER BY name ASC`);
    return rows.map((r) => this.mapTerritory(r));
  }

  async nextAccountNumber(): Promise<string> {
    const rows = await this.q<{ n: string }>(
      `SELECT nextval('edge_sales_account_number_seq')::text AS n`,
    );
    return `CA-${rows[0]!.n.padStart(6, '0')}`;
  }

  async createAccount(input: {
    accountNumber: string;
    legalName: string;
    tradeName?: string | null;
    accountType?: string;
    country?: string | null;
    region?: string | null;
    city?: string | null;
    addressLine1?: string | null;
    industry?: string | null;
    companySize?: string | null;
    website?: string | null;
    legalIdentifier?: string | null;
    legalIdentifierType?: string | null;
    emailDomainNormalized?: string | null;
    phoneNormalized?: string | null;
    parentAccountId?: string | null;
    ownerAdministratorId?: string | null;
    teamId?: string | null;
    primaryProductId?: string | null;
    verticalId?: string | null;
    nameNormalized: string;
    billingInfo?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<CommercialAccount> {
    const rows = await this.q(
      `INSERT INTO edge_sales_commercial_accounts (
         account_number, legal_name, trade_name, account_type, country, region, city,
         address_line1, industry, company_size, website, legal_identifier, legal_identifier_type,
         email_domain_normalized, phone_normalized, parent_account_id, owner_administrator_id,
         team_id, primary_product_id, vertical_id, name_normalized, billing_info, metadata, created_by
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb,$23::jsonb,$24
       ) RETURNING *`,
      [
        input.accountNumber,
        input.legalName,
        input.tradeName ?? null,
        input.accountType ?? 'PROSPECT_ORGANIZATION',
        input.country ?? null,
        input.region ?? null,
        input.city ?? null,
        input.addressLine1 ?? null,
        input.industry ?? null,
        input.companySize ?? null,
        input.website ?? null,
        input.legalIdentifier ?? null,
        input.legalIdentifierType ?? null,
        input.emailDomainNormalized ?? null,
        input.phoneNormalized ?? null,
        input.parentAccountId ?? null,
        input.ownerAdministratorId ?? null,
        input.teamId ?? null,
        input.primaryProductId ?? null,
        input.verticalId ?? null,
        input.nameNormalized,
        JSON.stringify(input.billingInfo ?? {}),
        JSON.stringify(input.metadata ?? {}),
        input.createdBy ?? null,
      ],
    );
    return this.mapAccount(rows[0]!);
  }

  async updateAccount(
    id: string,
    patch: Partial<{
      legalName: string;
      tradeName: string | null;
      accountType: string;
      status: string;
      country: string | null;
      region: string | null;
      city: string | null;
      addressLine1: string | null;
      industry: string | null;
      companySize: string | null;
      website: string | null;
      legalIdentifier: string | null;
      legalIdentifierType: string | null;
      emailDomainNormalized: string | null;
      phoneNormalized: string | null;
      parentAccountId: string | null;
      ownerAdministratorId: string | null;
      teamId: string | null;
      primaryProductId: string | null;
      verticalId: string | null;
      nameNormalized: string;
      billingInfo: Record<string, unknown>;
      metadata: Record<string, unknown>;
    }>,
  ): Promise<CommercialAccount> {
    const current = await this.getAccount(id);
    if (!current) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, `Commercial account ${id} not found`);
    }
    const rows = await this.q(
      `UPDATE edge_sales_commercial_accounts SET
         legal_name = COALESCE($2, legal_name),
         trade_name = COALESCE($3, trade_name),
         account_type = COALESCE($4, account_type),
         status = COALESCE($5, status),
         country = COALESCE($6, country),
         region = COALESCE($7, region),
         city = COALESCE($8, city),
         address_line1 = COALESCE($9, address_line1),
         industry = COALESCE($10, industry),
         company_size = COALESCE($11, company_size),
         website = COALESCE($12, website),
         legal_identifier = COALESCE($13, legal_identifier),
         legal_identifier_type = COALESCE($14, legal_identifier_type),
         email_domain_normalized = COALESCE($15, email_domain_normalized),
         phone_normalized = COALESCE($16, phone_normalized),
         parent_account_id = COALESCE($17, parent_account_id),
         owner_administrator_id = COALESCE($18, owner_administrator_id),
         team_id = COALESCE($19, team_id),
         primary_product_id = COALESCE($20, primary_product_id),
         vertical_id = COALESCE($21, vertical_id),
         name_normalized = COALESCE($22, name_normalized),
         billing_info = COALESCE($23::jsonb, billing_info),
         metadata = COALESCE($24::jsonb, metadata),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.legalName ?? null,
        patch.tradeName === undefined ? null : patch.tradeName,
        patch.accountType ?? null,
        patch.status ?? null,
        patch.country === undefined ? null : patch.country,
        patch.region === undefined ? null : patch.region,
        patch.city === undefined ? null : patch.city,
        patch.addressLine1 === undefined ? null : patch.addressLine1,
        patch.industry === undefined ? null : patch.industry,
        patch.companySize === undefined ? null : patch.companySize,
        patch.website === undefined ? null : patch.website,
        patch.legalIdentifier === undefined ? null : patch.legalIdentifier,
        patch.legalIdentifierType === undefined ? null : patch.legalIdentifierType,
        patch.emailDomainNormalized === undefined ? null : patch.emailDomainNormalized,
        patch.phoneNormalized === undefined ? null : patch.phoneNormalized,
        patch.parentAccountId === undefined ? null : patch.parentAccountId,
        patch.ownerAdministratorId === undefined ? null : patch.ownerAdministratorId,
        patch.teamId === undefined ? null : patch.teamId,
        patch.primaryProductId === undefined ? null : patch.primaryProductId,
        patch.verticalId === undefined ? null : patch.verticalId,
        patch.nameNormalized ?? null,
        patch.billingInfo ? JSON.stringify(patch.billingInfo) : null,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
      ],
    );
    return this.mapAccount(rows[0]!);
  }

  async getAccount(id: string): Promise<CommercialAccount | null> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_commercial_accounts WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.mapAccount(rows[0]) : null;
  }

  async listAccounts(opts?: {
    status?: string;
    q?: string;
    ownerAdministratorId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: CommercialAccount[]; total: number }> {
    const limit = Math.min(opts?.limit ?? 50, 200);
    const offset = opts?.offset ?? 0;
    const params: unknown[] = [];
    const where: string[] = [`status <> 'MERGED'`];
    if (opts?.status) {
      params.push(opts.status);
      where.push(`status = $${params.length}`);
    }
    if (opts?.ownerAdministratorId) {
      params.push(opts.ownerAdministratorId);
      where.push(`owner_administrator_id = $${params.length}`);
    }
    if (opts?.q) {
      params.push(`%${opts.q.toLowerCase()}%`);
      where.push(
        `(lower(legal_name) LIKE $${params.length} OR lower(coalesce(trade_name,'')) LIKE $${params.length} OR account_number ILIKE $${params.length} OR coalesce(email_domain_normalized,'') LIKE $${params.length})`,
      );
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q<{ c: string }>(
      `SELECT count(*)::text AS c FROM edge_sales_commercial_accounts ${whereSql}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_sales_commercial_accounts ${whereSql}
       ORDER BY updated_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapAccount(r)), total: Number(countRows[0]?.c ?? 0) };
  }

  async findDuplicateCandidates(input: {
    nameNormalized: string;
    legalIdentifier?: string | null;
    emailDomainNormalized?: string | null;
    phoneNormalized?: string | null;
    country?: string | null;
    excludeAccountId?: string | null;
  }): Promise<DuplicateAccountCandidate[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_commercial_accounts
       WHERE status <> 'MERGED'
         AND ($5::uuid IS NULL OR id <> $5)
         AND (
           ($1 <> '' AND name_normalized = $1)
           OR ($2 IS NOT NULL AND legal_identifier = $2 AND ($3 IS NULL OR country = $3 OR country IS NULL))
           OR ($4 IS NOT NULL AND email_domain_normalized = $4)
           OR ($6 IS NOT NULL AND phone_normalized = $6)
         )
       LIMIT 25`,
      [
        input.nameNormalized,
        input.legalIdentifier ?? null,
        input.country ?? null,
        input.emailDomainNormalized ?? null,
        input.excludeAccountId ?? null,
        input.phoneNormalized ?? null,
      ],
    );
    return rows.map((r) => {
      const account = this.mapAccount(r);
      const matchReasons: string[] = [];
      if (account.nameNormalized === input.nameNormalized) matchReasons.push('NAME_NORMALIZED');
      if (
        input.legalIdentifier &&
        account.legalIdentifier === input.legalIdentifier
      ) {
        matchReasons.push('LEGAL_IDENTIFIER');
      }
      if (
        input.emailDomainNormalized &&
        account.emailDomainNormalized === input.emailDomainNormalized
      ) {
        matchReasons.push('EMAIL_DOMAIN');
      }
      if (
        input.phoneNormalized &&
        account.phoneNormalized === input.phoneNormalized
      ) {
        matchReasons.push('PHONE');
      }
      return { account, matchReasons };
    });
  }

  async mergeAccounts(input: {
    survivingAccountId: string;
    mergedAccountId: string;
    reason: string;
    actorId?: string | null;
    correlationId?: string | null;
  }): Promise<CommercialAccount> {
    const surviving = await this.getAccount(input.survivingAccountId);
    const merged = await this.getAccount(input.mergedAccountId);
    if (!surviving || !merged) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Merge accounts not found');
    }
    if (surviving.status === 'MERGED' || merged.status === 'MERGED') {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Cannot merge already-merged accounts');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE edge_sales_contacts SET account_id = $1, updated_at = NOW() WHERE account_id = $2`,
        [input.survivingAccountId, input.mergedAccountId],
      );
      await client.query(
        `UPDATE edge_sales_leads SET account_id = $1, updated_at = NOW()
         WHERE account_id = $2`,
        [input.survivingAccountId, input.mergedAccountId],
      );
      await client.query(
        `UPDATE edge_sales_notes SET account_id = $1 WHERE account_id = $2`,
        [input.survivingAccountId, input.mergedAccountId],
      );
      await client.query(
        `UPDATE edge_sales_timeline_events SET account_id = $1 WHERE account_id = $2`,
        [input.survivingAccountId, input.mergedAccountId],
      );
      await client.query(
        `UPDATE edge_sales_tasks SET account_id = $1 WHERE account_id = $2`,
        [input.survivingAccountId, input.mergedAccountId],
      );
      await client.query(
        `UPDATE edge_sales_commercial_accounts
         SET status = 'MERGED', merged_into_account_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [input.survivingAccountId, input.mergedAccountId],
      );
      await client.query(
        `INSERT INTO edge_sales_account_merge_events
           (surviving_account_id, merged_account_id, reason, actor_id, correlation_id, snapshot)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
        [
          input.survivingAccountId,
          input.mergedAccountId,
          input.reason,
          input.actorId ?? null,
          input.correlationId ?? null,
          JSON.stringify({ surviving, merged }),
        ],
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    return (await this.getAccount(input.survivingAccountId))!;
  }

  async addAccountRelationship(input: {
    fromAccountId: string;
    toAccountId: string;
    relationshipType: string;
    notes?: string | null;
    createdBy?: string | null;
  }): Promise<void> {
    await this.q(
      `INSERT INTO edge_sales_account_relationships
         (from_account_id, to_account_id, relationship_type, notes, created_by)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT DO NOTHING`,
      [
        input.fromAccountId,
        input.toAccountId,
        input.relationshipType,
        input.notes ?? null,
        input.createdBy ?? null,
      ],
    );
  }

  async createContact(input: {
    accountId: string;
    firstName: string;
    lastName: string;
    emailNormalized?: string | null;
    phoneNormalized?: string | null;
    jobTitle?: string | null;
    department?: string | null;
    stakeholderType?: string;
    influenceLevel?: string;
    communicationPreference?: string | null;
    ownerAdministratorId?: string | null;
    marketingLeadId?: string | null;
    metadata?: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<SalesContact> {
    const rows = await this.q(
      `INSERT INTO edge_sales_contacts (
         account_id, first_name, last_name, email_normalized, phone_normalized,
         job_title, department, stakeholder_type, influence_level, communication_preference,
         owner_administrator_id, marketing_lead_id, metadata, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14)
       RETURNING *`,
      [
        input.accountId,
        input.firstName,
        input.lastName,
        input.emailNormalized ?? null,
        input.phoneNormalized ?? null,
        input.jobTitle ?? null,
        input.department ?? null,
        input.stakeholderType ?? 'PRIMARY_CONTACT',
        input.influenceLevel ?? 'MEDIUM',
        input.communicationPreference ?? null,
        input.ownerAdministratorId ?? null,
        input.marketingLeadId ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.createdBy ?? null,
      ],
    );
    return this.mapContact(rows[0]!);
  }

  async updateContact(
    id: string,
    patch: Partial<{
      firstName: string;
      lastName: string;
      emailNormalized: string | null;
      phoneNormalized: string | null;
      jobTitle: string | null;
      department: string | null;
      stakeholderType: string;
      influenceLevel: string;
      communicationPreference: string | null;
      status: string;
      ownerAdministratorId: string | null;
      metadata: Record<string, unknown>;
    }>,
  ): Promise<SalesContact> {
    const rows = await this.q(
      `UPDATE edge_sales_contacts SET
         first_name = COALESCE($2, first_name),
         last_name = COALESCE($3, last_name),
         email_normalized = COALESCE($4, email_normalized),
         phone_normalized = COALESCE($5, phone_normalized),
         job_title = COALESCE($6, job_title),
         department = COALESCE($7, department),
         stakeholder_type = COALESCE($8, stakeholder_type),
         influence_level = COALESCE($9, influence_level),
         communication_preference = COALESCE($10, communication_preference),
         status = COALESCE($11, status),
         owner_administrator_id = COALESCE($12, owner_administrator_id),
         metadata = COALESCE($13::jsonb, metadata),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.firstName ?? null,
        patch.lastName ?? null,
        patch.emailNormalized === undefined ? null : patch.emailNormalized,
        patch.phoneNormalized === undefined ? null : patch.phoneNormalized,
        patch.jobTitle === undefined ? null : patch.jobTitle,
        patch.department === undefined ? null : patch.department,
        patch.stakeholderType ?? null,
        patch.influenceLevel ?? null,
        patch.communicationPreference === undefined
          ? null
          : patch.communicationPreference,
        patch.status ?? null,
        patch.ownerAdministratorId === undefined ? null : patch.ownerAdministratorId,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
      ],
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, `Sales contact ${id} not found`);
    }
    return this.mapContact(rows[0]);
  }

  async getContact(id: string): Promise<SalesContact | null> {
    const rows = await this.q(`SELECT * FROM edge_sales_contacts WHERE id = $1`, [id]);
    return rows[0] ? this.mapContact(rows[0]) : null;
  }

  async listContacts(opts?: {
    accountId?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: SalesContact[]; total: number }> {
    const limit = Math.min(opts?.limit ?? 50, 200);
    const offset = opts?.offset ?? 0;
    const params: unknown[] = [];
    const where: string[] = [`status <> 'ARCHIVED'`];
    if (opts?.accountId) {
      params.push(opts.accountId);
      where.push(`account_id = $${params.length}`);
    }
    if (opts?.q) {
      params.push(`%${opts.q.toLowerCase()}%`);
      where.push(
        `(lower(first_name || ' ' || last_name) LIKE $${params.length} OR coalesce(email_normalized,'') LIKE $${params.length})`,
      );
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const countRows = await this.q<{ c: string }>(
      `SELECT count(*)::text AS c FROM edge_sales_contacts ${whereSql}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_sales_contacts ${whereSql}
       ORDER BY updated_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapContact(r)), total: Number(countRows[0]?.c ?? 0) };
  }

  async receiveSalesLead(input: {
    marketingLeadId: string;
    productId?: string | null;
    verticalId?: string | null;
    marketingScore?: number | null;
    provenance?: Record<string, unknown>;
    ownerAdministratorId?: string | null;
    teamId?: string | null;
    salesPriority?: string;
    slaDueAt?: Date | null;
    createdBy?: string | null;
  }): Promise<{ lead: SalesLead; created: boolean }> {
    const existing = await this.getSalesLeadByMarketingId(input.marketingLeadId);
    if (existing) {
      return { lead: existing, created: false };
    }
    const rows = await this.q(
      `INSERT INTO edge_sales_leads (
         marketing_lead_id, status, product_id, vertical_id, marketing_score,
         provenance, owner_administrator_id, team_id, sales_priority, sla_due_at, created_by
       ) VALUES ($1,'RECEIVED',$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)
       ON CONFLICT (marketing_lead_id) DO NOTHING
       RETURNING *`,
      [
        input.marketingLeadId,
        input.productId ?? null,
        input.verticalId ?? null,
        input.marketingScore ?? null,
        JSON.stringify(input.provenance ?? {}),
        input.ownerAdministratorId ?? null,
        input.teamId ?? null,
        input.salesPriority ?? 'MEDIUM',
        input.slaDueAt ?? null,
        input.createdBy ?? null,
      ],
    );
    if (rows[0]) {
      return { lead: this.mapLead(rows[0]), created: true };
    }
    const raced = await this.getSalesLeadByMarketingId(input.marketingLeadId);
    if (!raced) {
      throw new DomainError(ErrorCode.CONFLICT, 'Failed to receive sales lead');
    }
    return { lead: raced, created: false };
  }

  async getSalesLead(id: string): Promise<SalesLead | null> {
    const rows = await this.q(`SELECT * FROM edge_sales_leads WHERE id = $1`, [id]);
    return rows[0] ? this.mapLead(rows[0]) : null;
  }

  async getSalesLeadByMarketingId(marketingLeadId: string): Promise<SalesLead | null> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_leads WHERE marketing_lead_id = $1`,
      [marketingLeadId],
    );
    return rows[0] ? this.mapLead(rows[0]) : null;
  }

  async listSalesLeads(opts?: {
    status?: string;
    ownerAdministratorId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: SalesLead[]; total: number }> {
    const limit = Math.min(opts?.limit ?? 50, 200);
    const offset = opts?.offset ?? 0;
    const params: unknown[] = [];
    const where: string[] = [];
    if (opts?.status) {
      params.push(opts.status);
      where.push(`status = $${params.length}`);
    }
    if (opts?.ownerAdministratorId) {
      params.push(opts.ownerAdministratorId);
      where.push(`owner_administrator_id = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q<{ c: string }>(
      `SELECT count(*)::text AS c FROM edge_sales_leads ${whereSql}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_sales_leads ${whereSql}
       ORDER BY received_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: rows.map((r) => this.mapLead(r)), total: Number(countRows[0]?.c ?? 0) };
  }

  async transitionSalesLead(input: {
    id: string;
    toStatus: string;
    decisionType: string;
    reasonCode?: string | null;
    reasonText?: string | null;
    actorId?: string | null;
    correlationId?: string | null;
    accountId?: string | null;
    contactId?: string | null;
    ownerAdministratorId?: string | null;
    teamId?: string | null;
    qualification?: Record<string, unknown>;
    payload?: Record<string, unknown>;
  }): Promise<SalesLead> {
    const current = await this.getSalesLead(input.id);
    if (!current) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, `Sales lead ${input.id} not found`);
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE edge_sales_leads SET
           status = $2,
           rejection_reason_code = COALESCE($3, rejection_reason_code),
           rejection_reason_text = COALESCE($4, rejection_reason_text),
           account_id = COALESCE($5, account_id),
           contact_id = COALESCE($6, contact_id),
           owner_administrator_id = COALESCE($7, owner_administrator_id),
           team_id = COALESCE($8, team_id),
           qualification = CASE WHEN $9::jsonb IS NULL THEN qualification ELSE $9::jsonb END,
           reviewed_at = CASE WHEN reviewed_at IS NULL THEN NOW() ELSE reviewed_at END,
           accepted_at = CASE WHEN $2 = 'ACCEPTED' THEN NOW() ELSE accepted_at END,
           qualified_at = CASE WHEN $2 = 'SALES_QUALIFIED' THEN NOW() ELSE qualified_at END,
           updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          input.id,
          input.toStatus,
          input.reasonCode ?? null,
          input.reasonText ?? null,
          input.accountId ?? null,
          input.contactId ?? null,
          input.ownerAdministratorId ?? null,
          input.teamId ?? null,
          input.qualification ? JSON.stringify(input.qualification) : null,
        ],
      );
      await client.query(
        `INSERT INTO edge_sales_lead_decisions
           (sales_lead_id, decision_type, from_status, to_status, reason_code, reason_text,
            actor_id, correlation_id, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
        [
          input.id,
          input.decisionType,
          current.status,
          input.toStatus,
          input.reasonCode ?? null,
          input.reasonText ?? null,
          input.actorId ?? null,
          input.correlationId ?? null,
          JSON.stringify(input.payload ?? {}),
        ],
      );
      if (input.toStatus === 'ACCEPTED') {
        await client.query(
          `UPDATE edge_marketing_leads SET status = 'SALES_ACCEPTED', updated_at = NOW()
           WHERE id = $1 AND status IN ('MARKETING_QUALIFIED','ENGAGED','IDENTIFIED','NEW','SALES_ACCEPTED')`,
          [current.marketingLeadId],
        );
      }
      if (input.toStatus === 'REJECTED' || input.toStatus === 'RECYCLED') {
        await client.query(
          `UPDATE edge_marketing_leads SET status = CASE
             WHEN $2 = 'RECYCLED' THEN 'RECYCLED'
             ELSE 'DISQUALIFIED'
           END, updated_at = NOW()
           WHERE id = $1`,
          [current.marketingLeadId, input.toStatus],
        );
      }
      await client.query('COMMIT');
      return this.mapLead(result.rows[0]!);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async createNote(input: {
    accountId?: string | null;
    contactId?: string | null;
    salesLeadId?: string | null;
    body: string;
    visibility?: string;
    authorId?: string | null;
  }): Promise<SalesNote> {
    const rows = await this.q(
      `INSERT INTO edge_sales_notes
         (account_id, contact_id, sales_lead_id, body, visibility, author_id)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        input.accountId ?? null,
        input.contactId ?? null,
        input.salesLeadId ?? null,
        input.body,
        input.visibility ?? 'TEAM',
        input.authorId ?? null,
      ],
    );
    return this.mapNote(rows[0]!);
  }

  async listNotes(opts: {
    accountId?: string;
    contactId?: string;
    salesLeadId?: string;
  }): Promise<SalesNote[]> {
    const params: unknown[] = [];
    const where: string[] = [];
    if (opts.accountId) {
      params.push(opts.accountId);
      where.push(`account_id = $${params.length}`);
    }
    if (opts.contactId) {
      params.push(opts.contactId);
      where.push(`contact_id = $${params.length}`);
    }
    if (opts.salesLeadId) {
      params.push(opts.salesLeadId);
      where.push(`sales_lead_id = $${params.length}`);
    }
    if (!where.length) return [];
    const rows = await this.q(
      `SELECT * FROM edge_sales_notes WHERE ${where.join(' AND ')} ORDER BY created_at DESC`,
      params,
    );
    return rows.map((r) => this.mapNote(r));
  }

  async appendTimelineEvent(input: {
    accountId?: string | null;
    contactId?: string | null;
    salesLeadId?: string | null;
    eventType: string;
    provenance?: string;
    title: string;
    body?: string | null;
    actorId?: string | null;
    occurredAt?: Date;
    metadata?: Record<string, unknown>;
  }): Promise<SalesTimelineEvent> {
    const rows = await this.q(
      `INSERT INTO edge_sales_timeline_events
         (account_id, contact_id, sales_lead_id, event_type, provenance, title, body, actor_id, occurred_at, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9, NOW()),$10::jsonb)
       RETURNING *`,
      [
        input.accountId ?? null,
        input.contactId ?? null,
        input.salesLeadId ?? null,
        input.eventType,
        input.provenance ?? 'SALES',
        input.title,
        input.body ?? null,
        input.actorId ?? null,
        input.occurredAt ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return this.mapTimeline(rows[0]!);
  }

  async listTimeline(opts: {
    accountId: string;
    limit?: number;
  }): Promise<SalesTimelineEvent[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_timeline_events
       WHERE account_id = $1
       ORDER BY occurred_at DESC
       LIMIT $2`,
      [opts.accountId, Math.min(opts.limit ?? 100, 500)],
    );
    return rows.map((r) => this.mapTimeline(r));
  }

  async createTask(input: {
    accountId?: string | null;
    contactId?: string | null;
    salesLeadId?: string | null;
    title: string;
    description?: string | null;
    priority?: string;
    dueAt?: Date | null;
    assigneeId?: string | null;
    createdBy?: string | null;
  }): Promise<SalesTask> {
    const rows = await this.q(
      `INSERT INTO edge_sales_tasks
         (account_id, contact_id, sales_lead_id, title, description, priority, due_at, assignee_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        input.accountId ?? null,
        input.contactId ?? null,
        input.salesLeadId ?? null,
        input.title,
        input.description ?? null,
        input.priority ?? 'MEDIUM',
        input.dueAt ?? null,
        input.assigneeId ?? null,
        input.createdBy ?? null,
      ],
    );
    return this.mapTask(rows[0]!);
  }

  async listTasks(opts?: {
    accountId?: string;
    assigneeId?: string;
    status?: string;
  }): Promise<SalesTask[]> {
    const params: unknown[] = [];
    const where: string[] = [];
    if (opts?.accountId) {
      params.push(opts.accountId);
      where.push(`account_id = $${params.length}`);
    }
    if (opts?.assigneeId) {
      params.push(opts.assigneeId);
      where.push(`assignee_id = $${params.length}`);
    }
    if (opts?.status) {
      params.push(opts.status);
      where.push(`status = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.q(
      `SELECT * FROM edge_sales_tasks ${whereSql} ORDER BY due_at NULLS LAST, created_at DESC LIMIT 200`,
      params,
    );
    return rows.map((r) => this.mapTask(r));
  }

  async completeTask(id: string): Promise<SalesTask> {
    const rows = await this.q(
      `UPDATE edge_sales_tasks
       SET status = 'DONE', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id],
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, `Sales task ${id} not found`);
    }
    return this.mapTask(rows[0]);
  }

  async getMarketingLeadSnapshot(marketingLeadId: string): Promise<{
    id: string;
    status: string;
    emailNormalized: string | null;
    primaryProductId: string | null;
    verticalId: string | null;
    sourceCampaignId: string | null;
    organizationId: string | null;
    metadata: Record<string, unknown>;
  } | null> {
    const rows = await this.q(
      `SELECT id, status, email_normalized, primary_product_id, vertical_id,
              source_campaign_id, organization_id, metadata
       FROM edge_marketing_leads WHERE id = $1`,
      [marketingLeadId],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: String(r.id),
      status: String(r.status),
      emailNormalized: (r.email_normalized as string | null) ?? null,
      primaryProductId: (r.primary_product_id as string | null) ?? null,
      verticalId: (r.vertical_id as string | null) ?? null,
      sourceCampaignId: (r.source_campaign_id as string | null) ?? null,
      organizationId: (r.organization_id as string | null) ?? null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
    };
  }

  private mapPipeline(r: Record<string, unknown>): SalesPipeline {
    return {
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      scopeType: String(r.scope_type),
      productId: (r.product_id as string | null) ?? null,
      verticalId: (r.vertical_id as string | null) ?? null,
      teamId: (r.team_id as string | null) ?? null,
      marketId: (r.market_id as string | null) ?? null,
      status: String(r.status),
      isDefault: Boolean(r.is_default),
      version: Number(r.version),
      metadata: (r.metadata as Record<string, unknown>) ?? {},
    };
  }

  private mapStage(r: Record<string, unknown>): SalesPipelineStage {
    return {
      id: String(r.id),
      pipelineId: String(r.pipeline_id),
      code: String(r.code),
      name: String(r.name),
      position: Number(r.position),
      stageKind: String(r.stage_kind),
      requiredFields: (r.required_fields as unknown[]) ?? [],
      referenceProbability: String(r.reference_probability),
      targetDurationDays:
        r.target_duration_days == null ? null : Number(r.target_duration_days),
    };
  }

  private mapOpportunity(r: Record<string, unknown>): SalesOpportunity {
    return {
      id: String(r.id),
      opportunityNumber: String(r.opportunity_number),
      name: String(r.name),
      accountId: String(r.account_id),
      salesLeadId: (r.sales_lead_id as string | null) ?? null,
      pipelineId: String(r.pipeline_id),
      stageId: String(r.stage_id),
      status: String(r.status),
      ownerAdministratorId: (r.owner_administrator_id as string | null) ?? null,
      teamId: (r.team_id as string | null) ?? null,
      productId: (r.product_id as string | null) ?? null,
      verticalId: (r.vertical_id as string | null) ?? null,
      marketId: (r.market_id as string | null) ?? null,
      needSummary: (r.need_summary as string | null) ?? null,
      scopeSummary: (r.scope_summary as string | null) ?? null,
      estimatedValue: r.estimated_value == null ? null : String(r.estimated_value),
      currency: String(r.currency),
      probability: r.probability == null ? null : String(r.probability),
      expectedCloseDate: r.expected_close_date
        ? String(r.expected_close_date).slice(0, 10)
        : null,
      source: (r.source as string | null) ?? null,
      lossReasonCode: (r.loss_reason_code as string | null) ?? null,
      lossReasonText: (r.loss_reason_text as string | null) ?? null,
      forecastCategory: String(r.forecast_category),
      reopenCount: Number(r.reopen_count ?? 0),
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  async getDefaultPipeline(): Promise<SalesPipeline | null> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_pipelines
       WHERE is_default = TRUE AND status = 'ACTIVE'
       ORDER BY created_at ASC LIMIT 1`,
    );
    return rows[0] ? this.mapPipeline(rows[0]) : null;
  }

  async listPipelines(): Promise<SalesPipeline[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_pipelines WHERE status <> 'ARCHIVED' ORDER BY name`,
    );
    return rows.map((r) => this.mapPipeline(r));
  }

  async listPipelineStages(pipelineId: string): Promise<SalesPipelineStage[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_pipeline_stages WHERE pipeline_id = $1 ORDER BY position`,
      [pipelineId],
    );
    return rows.map((r) => this.mapStage(r));
  }

  async getPipelineStage(stageId: string): Promise<SalesPipelineStage | null> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_pipeline_stages WHERE id = $1`,
      [stageId],
    );
    return rows[0] ? this.mapStage(rows[0]) : null;
  }

  async listAllowedTransitionTargets(
    pipelineId: string,
    fromStageId: string,
  ): Promise<string[]> {
    const rows = await this.q<{ to_stage_id: string }>(
      `SELECT to_stage_id FROM edge_sales_pipeline_transitions
       WHERE pipeline_id = $1 AND from_stage_id = $2`,
      [pipelineId, fromStageId],
    );
    return rows.map((r) => String(r.to_stage_id));
  }

  async nextOpportunityNumber(): Promise<string> {
    const rows = await this.q<{ n: string }>(
      `SELECT nextval('edge_sales_opportunity_number_seq')::text AS n`,
    );
    return `OPP-${rows[0]!.n.padStart(6, '0')}`;
  }

  async createOpportunity(input: {
    opportunityNumber: string;
    name: string;
    accountId: string;
    salesLeadId?: string | null;
    pipelineId: string;
    stageId: string;
    ownerAdministratorId?: string | null;
    teamId?: string | null;
    productId?: string | null;
    verticalId?: string | null;
    marketId?: string | null;
    needSummary?: string | null;
    scopeSummary?: string | null;
    estimatedValue?: number | null;
    currency?: string;
    probability?: number | null;
    expectedCloseDate?: string | null;
    source?: string | null;
    forecastCategory?: string;
    metadata?: Record<string, unknown>;
    createdBy?: string | null;
  }): Promise<SalesOpportunity> {
    const rows = await this.q(
      `INSERT INTO edge_sales_opportunities (
         opportunity_number, name, account_id, sales_lead_id, pipeline_id, stage_id,
         owner_administrator_id, team_id, product_id, vertical_id, market_id,
         need_summary, scope_summary, estimated_value, currency, probability,
         expected_close_date, source, forecast_category, metadata, created_by
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21
       ) RETURNING *`,
      [
        input.opportunityNumber,
        input.name,
        input.accountId,
        input.salesLeadId ?? null,
        input.pipelineId,
        input.stageId,
        input.ownerAdministratorId ?? null,
        input.teamId ?? null,
        input.productId ?? null,
        input.verticalId ?? null,
        input.marketId ?? null,
        input.needSummary ?? null,
        input.scopeSummary ?? null,
        input.estimatedValue ?? null,
        input.currency ?? 'USD',
        input.probability ?? null,
        input.expectedCloseDate ?? null,
        input.source ?? null,
        input.forecastCategory ?? 'PIPELINE',
        JSON.stringify(input.metadata ?? {}),
        input.createdBy ?? null,
      ],
    );
    return this.mapOpportunity(rows[0]!);
  }

  async getOpportunity(id: string): Promise<SalesOpportunity | null> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_opportunities WHERE id = $1`,
      [id],
    );
    return rows[0] ? this.mapOpportunity(rows[0]) : null;
  }

  async listOpportunities(opts?: {
    status?: string;
    accountId?: string;
    pipelineId?: string;
    stageId?: string;
    ownerAdministratorId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: SalesOpportunity[]; total: number }> {
    const limit = Math.min(opts?.limit ?? 50, 200);
    const offset = opts?.offset ?? 0;
    const params: unknown[] = [];
    const where: string[] = [];
    if (opts?.status) {
      params.push(opts.status);
      where.push(`status = $${params.length}`);
    }
    if (opts?.accountId) {
      params.push(opts.accountId);
      where.push(`account_id = $${params.length}`);
    }
    if (opts?.pipelineId) {
      params.push(opts.pipelineId);
      where.push(`pipeline_id = $${params.length}`);
    }
    if (opts?.stageId) {
      params.push(opts.stageId);
      where.push(`stage_id = $${params.length}`);
    }
    if (opts?.ownerAdministratorId) {
      params.push(opts.ownerAdministratorId);
      where.push(`owner_administrator_id = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await this.q<{ c: string }>(
      `SELECT count(*)::text AS c FROM edge_sales_opportunities ${whereSql}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.q(
      `SELECT * FROM edge_sales_opportunities ${whereSql}
       ORDER BY updated_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return {
      items: rows.map((r) => this.mapOpportunity(r)),
      total: Number(countRows[0]?.c ?? 0),
    };
  }

  async updateOpportunity(
    id: string,
    patch: Partial<{
      name: string;
      ownerAdministratorId: string | null;
      teamId: string | null;
      productId: string | null;
      verticalId: string | null;
      needSummary: string | null;
      scopeSummary: string | null;
      estimatedValue: number | null;
      currency: string;
      probability: number | null;
      expectedCloseDate: string | null;
      forecastCategory: string;
      metadata: Record<string, unknown>;
    }>,
  ): Promise<SalesOpportunity> {
    const rows = await this.q(
      `UPDATE edge_sales_opportunities SET
         name = COALESCE($2, name),
         owner_administrator_id = COALESCE($3, owner_administrator_id),
         team_id = COALESCE($4, team_id),
         product_id = COALESCE($5, product_id),
         vertical_id = COALESCE($6, vertical_id),
         need_summary = COALESCE($7, need_summary),
         scope_summary = COALESCE($8, scope_summary),
         estimated_value = COALESCE($9, estimated_value),
         currency = COALESCE($10, currency),
         probability = COALESCE($11, probability),
         expected_close_date = COALESCE($12, expected_close_date),
         forecast_category = COALESCE($13, forecast_category),
         metadata = COALESCE($14::jsonb, metadata),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.name ?? null,
        patch.ownerAdministratorId === undefined ? null : patch.ownerAdministratorId,
        patch.teamId === undefined ? null : patch.teamId,
        patch.productId === undefined ? null : patch.productId,
        patch.verticalId === undefined ? null : patch.verticalId,
        patch.needSummary === undefined ? null : patch.needSummary,
        patch.scopeSummary === undefined ? null : patch.scopeSummary,
        patch.estimatedValue === undefined ? null : patch.estimatedValue,
        patch.currency ?? null,
        patch.probability === undefined ? null : patch.probability,
        patch.expectedCloseDate === undefined ? null : patch.expectedCloseDate,
        patch.forecastCategory ?? null,
        patch.metadata ? JSON.stringify(patch.metadata) : null,
      ],
    );
    if (!rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Opportunity not found');
    }
    return this.mapOpportunity(rows[0]);
  }

  async transitionOpportunityStage(input: {
    opportunityId: string;
    toStageId: string;
    toStatus: string;
    reasonCode?: string | null;
    reasonText?: string | null;
    actorId?: string | null;
    correlationId?: string | null;
    probability?: number | null;
  }): Promise<SalesOpportunity> {
    const current = await this.getOpportunity(input.opportunityId);
    if (!current) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Opportunity not found');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE edge_sales_opportunities SET
           stage_id = $2,
           status = $3,
           probability = COALESCE($4, probability),
           loss_reason_code = COALESCE($5, loss_reason_code),
           loss_reason_text = COALESCE($6, loss_reason_text),
           won_at = CASE WHEN $3 = 'WON' THEN NOW() ELSE won_at END,
           lost_at = CASE WHEN $3 = 'LOST' THEN NOW() ELSE lost_at END,
           closed_at = CASE WHEN $3 IN ('WON','LOST') THEN NOW() ELSE closed_at END,
           updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          input.opportunityId,
          input.toStageId,
          input.toStatus,
          input.probability ?? null,
          input.reasonCode ?? null,
          input.reasonText ?? null,
        ],
      );
      await client.query(
        `INSERT INTO edge_sales_opportunity_stage_history
           (opportunity_id, from_stage_id, to_stage_id, from_status, to_status,
            reason_code, reason_text, actor_id, correlation_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          input.opportunityId,
          current.stageId,
          input.toStageId,
          current.status,
          input.toStatus,
          input.reasonCode ?? null,
          input.reasonText ?? null,
          input.actorId ?? null,
          input.correlationId ?? null,
        ],
      );
      await client.query('COMMIT');
      return this.mapOpportunity(result.rows[0]!);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async reopenOpportunity(input: {
    opportunityId: string;
    stageId: string;
    reason: string;
    actorId?: string | null;
  }): Promise<SalesOpportunity> {
    const current = await this.getOpportunity(input.opportunityId);
    if (!current) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Opportunity not found');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE edge_sales_opportunities SET
           status = 'REOPENED',
           stage_id = $2,
           won_at = NULL,
           lost_at = NULL,
           closed_at = NULL,
           loss_reason_code = NULL,
           loss_reason_text = NULL,
           reopen_count = reopen_count + 1,
           updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [input.opportunityId, input.stageId],
      );
      await client.query(
        `INSERT INTO edge_sales_opportunity_stage_history
           (opportunity_id, from_stage_id, to_stage_id, from_status, to_status,
            reason_text, actor_id)
         VALUES ($1,$2,$3,$4,'REOPENED',$5,$6)`,
        [
          input.opportunityId,
          current.stageId,
          input.stageId,
          current.status,
          input.reason,
          input.actorId ?? null,
        ],
      );
      await client.query('COMMIT');
      return this.mapOpportunity(result.rows[0]!);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async addOpportunityContact(input: {
    opportunityId: string;
    contactId: string;
    roleOnOpportunity?: string;
    isPrimary?: boolean;
  }): Promise<void> {
    await this.q(
      `INSERT INTO edge_sales_opportunity_contacts
         (opportunity_id, contact_id, role_on_opportunity, is_primary)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (opportunity_id, contact_id) DO UPDATE
       SET role_on_opportunity = EXCLUDED.role_on_opportunity,
           is_primary = EXCLUDED.is_primary`,
      [
        input.opportunityId,
        input.contactId,
        input.roleOnOpportunity ?? 'INFLUENCER',
        input.isPrimary ?? false,
      ],
    );
  }

  async addOpportunityRisk(input: {
    opportunityId: string;
    code: string;
    title: string;
    severity?: string;
    description?: string | null;
  }): Promise<SalesOpportunityRisk> {
    const rows = await this.q(
      `INSERT INTO edge_sales_opportunity_risks
         (opportunity_id, code, title, severity, description)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [
        input.opportunityId,
        input.code,
        input.title,
        input.severity ?? 'MEDIUM',
        input.description ?? null,
      ],
    );
    const r = rows[0]!;
    return {
      id: String(r.id),
      opportunityId: String(r.opportunity_id),
      code: String(r.code),
      title: String(r.title),
      severity: String(r.severity),
      status: String(r.status),
      description: (r.description as string | null) ?? null,
    };
  }

  async listOpportunityRisks(opportunityId: string): Promise<SalesOpportunityRisk[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_opportunity_risks WHERE opportunity_id = $1 ORDER BY created_at DESC`,
      [opportunityId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      opportunityId: String(r.opportunity_id),
      code: String(r.code),
      title: String(r.title),
      severity: String(r.severity),
      status: String(r.status),
      description: (r.description as string | null) ?? null,
    }));
  }

  async addOpportunityCompetitor(input: {
    opportunityId: string;
    competitorName: string;
    threatLevel?: string;
    notes?: string | null;
  }): Promise<SalesOpportunityCompetitor> {
    const rows = await this.q(
      `INSERT INTO edge_sales_opportunity_competitors
         (opportunity_id, competitor_name, threat_level, notes)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [
        input.opportunityId,
        input.competitorName,
        input.threatLevel ?? 'MEDIUM',
        input.notes ?? null,
      ],
    );
    const r = rows[0]!;
    return {
      id: String(r.id),
      opportunityId: String(r.opportunity_id),
      competitorName: String(r.competitor_name),
      threatLevel: String(r.threat_level),
      notes: (r.notes as string | null) ?? null,
    };
  }

  async listOpportunityCompetitors(
    opportunityId: string,
  ): Promise<SalesOpportunityCompetitor[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_opportunity_competitors WHERE opportunity_id = $1 ORDER BY created_at DESC`,
      [opportunityId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      opportunityId: String(r.opportunity_id),
      competitorName: String(r.competitor_name),
      threatLevel: String(r.threat_level),
      notes: (r.notes as string | null) ?? null,
    }));
  }

  async listOpportunityStageHistory(
    opportunityId: string,
  ): Promise<SalesOpportunityStageHistory[]> {
    const rows = await this.q(
      `SELECT * FROM edge_sales_opportunity_stage_history
       WHERE opportunity_id = $1 ORDER BY created_at DESC`,
      [opportunityId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      opportunityId: String(r.opportunity_id),
      fromStageId: (r.from_stage_id as string | null) ?? null,
      toStageId: String(r.to_stage_id),
      fromStatus: (r.from_status as string | null) ?? null,
      toStatus: (r.to_status as string | null) ?? null,
      reasonCode: (r.reason_code as string | null) ?? null,
      reasonText: (r.reason_text as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
    }));
  }

  async pipelineBoard(pipelineId: string): Promise<
    { stage: SalesPipelineStage; opportunities: SalesOpportunity[] }[]
  > {
    const stages = await this.listPipelineStages(pipelineId);
    const result: { stage: SalesPipelineStage; opportunities: SalesOpportunity[] }[] =
      [];
    for (const stage of stages) {
      if (stage.stageKind !== 'OPEN' && stage.code !== 'CLOSED_WON' && stage.code !== 'CLOSED_LOST') {
        // include all stages
      }
      const { items } = await this.listOpportunities({
        pipelineId,
        stageId: stage.id,
        limit: 100,
      });
      result.push({ stage, opportunities: items });
    }
    return result;
  }
}
