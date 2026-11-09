import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  CreateProductParams,
  ProductRepositoryPort,
  UpdateProductParams,
} from '../../domain/ports/product-repository.port.js';
import {
  CommercialAvailability,
  ProductLifecycleStatus,
  type EdgeProduct,
} from '../../domain/product/product.entity.js';

interface Row {
  id: string;
  code: string;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  vertical_id: string;
  product_type: string | null;
  lifecycle_status: ProductLifecycleStatus;
  technical_status: string | null;
  commercial_availability: CommercialAvailability;
  default_version_id: string | null;
  icon_ref: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
  row_version: number;
}

@Injectable()
export class PgProductRepository implements ProductRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async findById(id: string): Promise<EdgeProduct | null> {
    const result = await this.pool.query<Row>(`SELECT * FROM edge_products WHERE id = $1`, [id]);
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async findByCode(code: string): Promise<EdgeProduct | null> {
    const result = await this.pool.query<Row>(`SELECT * FROM edge_products WHERE code = $1`, [
      code,
    ]);
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async list(params: {
    page: number;
    limit: number;
    verticalId?: string;
    status?: ProductLifecycleStatus;
  }): Promise<{ items: readonly EdgeProduct[]; total: number }> {
    const offset = (params.page - 1) * params.limit;
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (params.verticalId) {
      values.push(params.verticalId);
      clauses.push(`vertical_id = $${values.length}`);
    }
    if (params.status) {
      values.push(params.status);
      clauses.push(`lifecycle_status = $${values.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const count = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM edge_products ${where}`,
      values,
    );
    values.push(params.limit, offset);
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_products ${where}
       ORDER BY created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return {
      items: result.rows.map((r) => this.map(r)),
      total: Number(count.rows[0]?.count ?? 0),
    };
  }

  async create(params: CreateProductParams): Promise<EdgeProduct> {
    const id = randomUUID();
    const result = await this.pool.query<Row>(
      `INSERT INTO edge_products (
         id, code, slug, name, short_description, description, vertical_id, product_type,
         lifecycle_status, technical_status, commercial_availability, icon_ref, metadata,
         created_by, updated_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'DRAFT',$9,$10,$11,$12::jsonb,$13,$13)
       RETURNING *`,
      [
        id,
        params.code,
        params.slug,
        params.name,
        params.shortDescription ?? null,
        params.description ?? null,
        params.verticalId,
        params.productType ?? null,
        params.technicalStatus ?? null,
        params.commercialAvailability ?? CommercialAvailability.UNAVAILABLE,
        params.iconRef ?? null,
        JSON.stringify(params.metadata ?? {}),
        params.createdBy ?? null,
      ],
    );
    return this.map(result.rows[0]);
  }

  async update(id: string, params: UpdateProductParams): Promise<EdgeProduct> {
    const current = await this.findById(id);
    if (!current) throw new Error(`Product not found: ${id}`);
    const result = await this.pool.query<Row>(
      `UPDATE edge_products SET
         name = $2,
         short_description = $3,
         description = $4,
         product_type = $5,
         technical_status = $6,
         commercial_availability = $7,
         default_version_id = $8,
         icon_ref = $9,
         metadata = $10::jsonb,
         updated_by = $11,
         row_version = row_version + 1,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        params.name ?? current.name,
        params.shortDescription !== undefined
          ? params.shortDescription
          : current.shortDescription,
        params.description !== undefined ? params.description : current.description,
        params.productType !== undefined ? params.productType : current.productType,
        params.technicalStatus !== undefined ? params.technicalStatus : current.technicalStatus,
        params.commercialAvailability ?? current.commercialAvailability,
        params.defaultVersionId !== undefined
          ? params.defaultVersionId
          : current.defaultVersionId,
        params.iconRef !== undefined ? params.iconRef : current.iconRef,
        JSON.stringify(params.metadata ?? current.metadata),
        params.updatedBy ?? current.updatedBy,
      ],
    );
    return this.map(result.rows[0]);
  }

  async updateLifecycle(
    id: string,
    status: ProductLifecycleStatus,
    extras?: { updatedBy?: string | null; defaultVersionId?: string | null },
  ): Promise<EdgeProduct> {
    const current = await this.findById(id);
    if (!current) throw new Error(`Product not found: ${id}`);
    const result = await this.pool.query<Row>(
      `UPDATE edge_products SET
         lifecycle_status = $2,
         default_version_id = $3,
         updated_by = $4,
         row_version = row_version + 1,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        status,
        extras?.defaultVersionId !== undefined
          ? extras.defaultVersionId
          : current.defaultVersionId,
        extras?.updatedBy !== undefined ? extras.updatedBy : current.updatedBy,
      ],
    );
    return this.map(result.rows[0]);
  }

  private map(row: Row): EdgeProduct {
    return {
      id: row.id,
      code: row.code,
      slug: row.slug,
      name: row.name,
      shortDescription: row.short_description,
      description: row.description,
      verticalId: row.vertical_id,
      productType: row.product_type,
      lifecycleStatus: row.lifecycle_status,
      technicalStatus: row.technical_status,
      commercialAvailability: row.commercial_availability,
      defaultVersionId: row.default_version_id,
      iconRef: row.icon_ref,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      rowVersion: row.row_version,
    };
  }
}
