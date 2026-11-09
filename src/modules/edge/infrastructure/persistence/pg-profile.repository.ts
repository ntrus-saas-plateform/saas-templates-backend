import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  CreateProfileParams,
  ProfileRepositoryPort,
} from '../../domain/ports/profile-repository.port.js';
import type { BusinessProfileTemplate } from '../../domain/market/business-profile.entity.js';

interface Row {
  id: string;
  code: string;
  name: string;
  description: string | null;
  vertical_id: string;
  segment_id: string | null;
  status: string;
  version: number;
  attributes_schema: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class PgProfileRepository implements ProfileRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async findById(id: string): Promise<BusinessProfileTemplate | null> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_business_profile_templates WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async findByCode(code: string): Promise<BusinessProfileTemplate | null> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_business_profile_templates WHERE code = $1`,
      [code],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async list(params?: { verticalId?: string }): Promise<readonly BusinessProfileTemplate[]> {
    if (params?.verticalId) {
      const result = await this.pool.query<Row>(
        `SELECT * FROM edge_business_profile_templates WHERE vertical_id = $1 ORDER BY code`,
        [params.verticalId],
      );
      return result.rows.map((r) => this.map(r));
    }
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_business_profile_templates ORDER BY code`,
    );
    return result.rows.map((r) => this.map(r));
  }

  async create(params: CreateProfileParams): Promise<BusinessProfileTemplate> {
    const id = randomUUID();
    const result = await this.pool.query<Row>(
      `INSERT INTO edge_business_profile_templates (
         id, code, name, description, vertical_id, segment_id, status, attributes_schema, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)
       RETURNING *`,
      [
        id,
        params.code,
        params.name,
        params.description ?? null,
        params.verticalId,
        params.segmentId ?? null,
        params.status ?? 'ACTIVE',
        JSON.stringify(params.attributesSchema ?? {}),
        JSON.stringify(params.metadata ?? {}),
      ],
    );
    return this.map(result.rows[0]);
  }

  private map(row: Row): BusinessProfileTemplate {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      verticalId: row.vertical_id,
      segmentId: row.segment_id,
      status: row.status,
      version: row.version,
      attributesSchema: row.attributes_schema ?? {},
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
