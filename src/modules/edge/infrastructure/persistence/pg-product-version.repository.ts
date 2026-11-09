import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  CreateProductVersionParams,
  ProductVersionRepositoryPort,
  UpdateProductVersionParams,
} from '../../domain/ports/product-version-repository.port.js';
import {
  ProductReleaseType,
  ProductVersionStatus,
  type EdgeProductVersion,
} from '../../domain/product/product-version.entity.js';

interface Row {
  id: string;
  product_id: string;
  version: string;
  release_name: string | null;
  description: string | null;
  status: ProductVersionStatus;
  release_type: ProductReleaseType;
  api_compatibility: string | null;
  event_compatibility: string | null;
  minimum_backend_version: string | null;
  release_date: Date | null;
  effective_from: Date | null;
  deprecated_at: Date | null;
  retired_at: Date | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  created_by: string | null;
}

@Injectable()
export class PgProductVersionRepository implements ProductVersionRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async findById(id: string): Promise<EdgeProductVersion | null> {
    const result = await this.pool.query<Row>(`SELECT * FROM edge_product_versions WHERE id = $1`, [
      id,
    ]);
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async listByProduct(productId: string): Promise<readonly EdgeProductVersion[]> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_product_versions WHERE product_id = $1 ORDER BY created_at DESC`,
      [productId],
    );
    return result.rows.map((r) => this.map(r));
  }

  async create(params: CreateProductVersionParams): Promise<EdgeProductVersion> {
    const id = randomUUID();
    const result = await this.pool.query<Row>(
      `INSERT INTO edge_product_versions (
         id, product_id, version, release_name, description, status, release_type,
         api_compatibility, event_compatibility, minimum_backend_version, metadata, created_by
       ) VALUES ($1,$2,$3,$4,$5,'DRAFT',$6,$7,$8,$9,$10::jsonb,$11)
       RETURNING *`,
      [
        id,
        params.productId,
        params.version,
        params.releaseName ?? null,
        params.description ?? null,
        params.releaseType,
        params.apiCompatibility ?? null,
        params.eventCompatibility ?? null,
        params.minimumBackendVersion ?? null,
        JSON.stringify(params.metadata ?? {}),
        params.createdBy ?? null,
      ],
    );
    return this.map(result.rows[0]);
  }

  async update(id: string, params: UpdateProductVersionParams): Promise<EdgeProductVersion> {
    const current = await this.findById(id);
    if (!current) throw new Error(`Product version not found: ${id}`);
    const result = await this.pool.query<Row>(
      `UPDATE edge_product_versions SET
         release_name = $2,
         description = $3,
         api_compatibility = $4,
         event_compatibility = $5,
         minimum_backend_version = $6,
         metadata = $7::jsonb
       WHERE id = $1
       RETURNING *`,
      [
        id,
        params.releaseName !== undefined ? params.releaseName : current.releaseName,
        params.description !== undefined ? params.description : current.description,
        params.apiCompatibility !== undefined
          ? params.apiCompatibility
          : current.apiCompatibility,
        params.eventCompatibility !== undefined
          ? params.eventCompatibility
          : current.eventCompatibility,
        params.minimumBackendVersion !== undefined
          ? params.minimumBackendVersion
          : current.minimumBackendVersion,
        JSON.stringify(params.metadata ?? current.metadata),
      ],
    );
    return this.map(result.rows[0]);
  }

  async updateStatus(
    id: string,
    status: ProductVersionStatus,
    extras?: {
      releaseDate?: Date | null;
      effectiveFrom?: Date | null;
      deprecatedAt?: Date | null;
      retiredAt?: Date | null;
    },
  ): Promise<EdgeProductVersion> {
    const current = await this.findById(id);
    if (!current) throw new Error(`Product version not found: ${id}`);
    const result = await this.pool.query<Row>(
      `UPDATE edge_product_versions SET
         status = $2,
         release_date = $3,
         effective_from = $4,
         deprecated_at = $5,
         retired_at = $6
       WHERE id = $1
       RETURNING *`,
      [
        id,
        status,
        extras?.releaseDate !== undefined ? extras.releaseDate : current.releaseDate,
        extras?.effectiveFrom !== undefined ? extras.effectiveFrom : current.effectiveFrom,
        extras?.deprecatedAt !== undefined ? extras.deprecatedAt : current.deprecatedAt,
        extras?.retiredAt !== undefined ? extras.retiredAt : current.retiredAt,
      ],
    );
    return this.map(result.rows[0]);
  }

  private map(row: Row): EdgeProductVersion {
    return {
      id: row.id,
      productId: row.product_id,
      version: row.version,
      releaseName: row.release_name,
      description: row.description,
      status: row.status,
      releaseType: row.release_type,
      apiCompatibility: row.api_compatibility,
      eventCompatibility: row.event_compatibility,
      minimumBackendVersion: row.minimum_backend_version,
      releaseDate: row.release_date,
      effectiveFrom: row.effective_from,
      deprecatedAt: row.deprecated_at,
      retiredAt: row.retired_at,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      createdBy: row.created_by,
    };
  }
}
