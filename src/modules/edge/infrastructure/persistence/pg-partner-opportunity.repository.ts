import { Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  PartnerOpportunityRegistration,
  PartnerOpportunityStatus,
} from '../../domain/partners/opportunity-registration.js';
import type { PartnerOpportunityRepositoryPort } from '../../domain/ports/partner-opportunity-repository.port.js';

@Injectable()
export class PgPartnerOpportunityRepository implements PartnerOpportunityRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  private map(r: Record<string, unknown>): PartnerOpportunityRegistration {
    return {
      id: String(r.id),
      partnerCode: String(r.partner_code),
      accountName: String(r.account_name),
      territoryCode: (r.territory_code as string | null) ?? null,
      productSegment: (r.product_segment as string | null) ?? null,
      estimatedMrr: r.estimated_mrr != null ? Number(r.estimated_mrr) : null,
      status: String(r.status) as PartnerOpportunityStatus,
      registeredAt: new Date(String(r.registered_at)),
      conflictWindowDays: Number(r.conflict_window_days),
      conflictExpiresAt: new Date(String(r.conflict_expires_at)),
      notes: (r.notes as string | null) ?? null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdBy: (r.created_by as string | null) ?? null,
      createdAt: new Date(String(r.created_at)),
      updatedAt: new Date(String(r.updated_at)),
    };
  }

  async register(
    input: Parameters<PartnerOpportunityRepositoryPort['register']>[0],
  ): Promise<PartnerOpportunityRegistration> {
    const result = await this.pool.query(
      `INSERT INTO edge_partner_opportunity_registrations (
         partner_code, account_name, territory_code, product_segment,
         estimated_mrr, status, registered_at, conflict_window_days,
         conflict_expires_at, notes, metadata, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)
       RETURNING *`,
      [
        input.partnerCode,
        input.accountName,
        input.territoryCode ?? null,
        input.productSegment ?? null,
        input.estimatedMrr,
        input.status,
        input.registeredAt.toISOString(),
        input.conflictWindowDays,
        input.conflictExpiresAt.toISOString(),
        input.notes ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.createdBy ?? null,
      ],
    );
    return this.map(result.rows[0] as Record<string, unknown>);
  }

  async getById(id: string): Promise<PartnerOpportunityRegistration | null> {
    const result = await this.pool.query(
      `SELECT * FROM edge_partner_opportunity_registrations WHERE id = $1`,
      [id],
    );
    if (!result.rows[0]) return null;
    return this.map(result.rows[0] as Record<string, unknown>);
  }

  async list(input?: {
    partnerCode?: string;
    status?: PartnerOpportunityStatus;
    limit?: number;
  }): Promise<PartnerOpportunityRegistration[]> {
    const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200);
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (input?.partnerCode) {
      params.push(input.partnerCode);
      clauses.push(`partner_code = $${params.length}`);
    }
    if (input?.status) {
      params.push(input.status);
      clauses.push(`status = $${params.length}`);
    }
    params.push(limit);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await this.pool.query(
      `SELECT * FROM edge_partner_opportunity_registrations
       ${where}
       ORDER BY registered_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return (result.rows as Record<string, unknown>[]).map((r) => this.map(r));
  }

  async updateStatus(input: {
    id: string;
    status: PartnerOpportunityStatus;
  }): Promise<PartnerOpportunityRegistration> {
    const result = await this.pool.query(
      `UPDATE edge_partner_opportunity_registrations
       SET status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [input.id, input.status],
    );
    return this.map(result.rows[0] as Record<string, unknown>);
  }
}
