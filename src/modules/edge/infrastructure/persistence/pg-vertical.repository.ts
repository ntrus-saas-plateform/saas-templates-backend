import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  CreateVerticalParams,
  UpdateVerticalParams,
  VerticalRepositoryPort,
} from '../../domain/ports/vertical-repository.port.js';
import { VerticalStatus, type Vertical } from '../../domain/vertical/vertical.entity.js';

interface Row {
  id: string;
  code: string;
  slug: string;
  display_name: string;
  description: string | null;
  status: VerticalStatus;
  icon_ref: string | null;
  visual_identity_ref: string | null;
  keycloak_organization_id: string | null;
  configuration_version: number;
  activated_at: Date | null;
  suspended_at: Date | null;
  deactivated_at: Date | null;
  suspension_reason: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

@Injectable()
export class PgVerticalRepository implements VerticalRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async findById(id: string): Promise<Vertical | null> {
    const result = await this.pool.query<Row>(`SELECT * FROM edge_verticals WHERE id = $1`, [id]);
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async findByCode(code: string): Promise<Vertical | null> {
    const result = await this.pool.query<Row>(`SELECT * FROM edge_verticals WHERE code = $1`, [
      code,
    ]);
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async findBySlug(slug: string): Promise<Vertical | null> {
    const result = await this.pool.query<Row>(`SELECT * FROM edge_verticals WHERE slug = $1`, [
      slug,
    ]);
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async list(params: {
    page: number;
    limit: number;
    status?: VerticalStatus;
    search?: string;
  }): Promise<{ items: readonly Vertical[]; total: number }> {
    const offset = (params.page - 1) * params.limit;
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (params.status) {
      values.push(params.status);
      clauses.push(`status = $${values.length}`);
    }
    if (params.search?.trim()) {
      values.push(`%${params.search.trim()}%`);
      clauses.push(
        `(code ILIKE $${values.length} OR slug ILIKE $${values.length} OR display_name ILIKE $${values.length})`,
      );
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const count = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM edge_verticals ${where}`,
      values,
    );
    values.push(params.limit, offset);
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_verticals ${where}
       ORDER BY created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return {
      items: result.rows.map((r) => this.map(r)),
      total: Number(count.rows[0]?.count ?? 0),
    };
  }

  async create(params: CreateVerticalParams): Promise<Vertical> {
    const id = randomUUID();
    const result = await this.pool.query<Row>(
      `INSERT INTO edge_verticals (
         id, code, slug, display_name, description, status, icon_ref, visual_identity_ref,
         keycloak_organization_id, created_by, updated_by
       ) VALUES ($1,$2,$3,$4,$5,'DRAFT',$6,$7,$8,$9,$9)
       RETURNING *`,
      [
        id,
        params.code,
        params.slug,
        params.displayName,
        params.description ?? null,
        params.iconRef ?? null,
        params.visualIdentityRef ?? null,
        params.keycloakOrganizationId ?? null,
        params.createdBy ?? null,
      ],
    );
    return this.map(result.rows[0]);
  }

  async update(id: string, params: UpdateVerticalParams): Promise<Vertical> {
    const current = await this.findById(id);
    if (!current) throw new Error(`Vertical not found: ${id}`);
    const result = await this.pool.query<Row>(
      `UPDATE edge_verticals SET
         display_name = $2,
         description = $3,
         icon_ref = $4,
         visual_identity_ref = $5,
         keycloak_organization_id = $6,
         configuration_version = $7,
         updated_by = $8,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        params.displayName ?? current.displayName,
        params.description !== undefined ? params.description : current.description,
        params.iconRef !== undefined ? params.iconRef : current.iconRef,
        params.visualIdentityRef !== undefined
          ? params.visualIdentityRef
          : current.visualIdentityRef,
        params.keycloakOrganizationId !== undefined
          ? params.keycloakOrganizationId
          : current.keycloakOrganizationId,
        params.configurationVersion ?? current.configurationVersion,
        params.updatedBy ?? current.updatedBy,
      ],
    );
    return this.map(result.rows[0]);
  }

  async updateStatus(
    id: string,
    status: VerticalStatus,
    extras?: {
      suspensionReason?: string | null;
      activatedAt?: Date | null;
      suspendedAt?: Date | null;
      deactivatedAt?: Date | null;
      updatedBy?: string | null;
      configurationVersion?: number;
    },
  ): Promise<Vertical> {
    const current = await this.findById(id);
    if (!current) throw new Error(`Vertical not found: ${id}`);
    const result = await this.pool.query<Row>(
      `UPDATE edge_verticals SET
         status = $2,
         suspension_reason = $3,
         activated_at = $4,
         suspended_at = $5,
         deactivated_at = $6,
         updated_by = $7,
         configuration_version = $8,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        status,
        extras?.suspensionReason !== undefined
          ? extras.suspensionReason
          : current.suspensionReason,
        extras?.activatedAt !== undefined ? extras.activatedAt : current.activatedAt,
        extras?.suspendedAt !== undefined ? extras.suspendedAt : current.suspendedAt,
        extras?.deactivatedAt !== undefined ? extras.deactivatedAt : current.deactivatedAt,
        extras?.updatedBy !== undefined ? extras.updatedBy : current.updatedBy,
        extras?.configurationVersion ?? current.configurationVersion,
      ],
    );
    return this.map(result.rows[0]);
  }

  private map(row: Row): Vertical {
    return {
      id: row.id,
      code: row.code,
      slug: row.slug,
      displayName: row.display_name,
      description: row.description,
      status: row.status,
      iconRef: row.icon_ref,
      visualIdentityRef: row.visual_identity_ref,
      keycloakOrganizationId: row.keycloak_organization_id,
      configurationVersion: row.configuration_version,
      activatedAt: row.activated_at,
      suspendedAt: row.suspended_at,
      deactivatedAt: row.deactivated_at,
      suspensionReason: row.suspension_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
    };
  }
}
