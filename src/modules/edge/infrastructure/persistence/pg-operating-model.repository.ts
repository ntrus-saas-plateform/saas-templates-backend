import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  CreateOperatingModelParams,
  OperatingModelRepositoryPort,
} from '../../domain/ports/operating-model-repository.port.js';
import type { OperatingModel } from '../../domain/market/operating-model.entity.js';

interface Row {
  id: string;
  code: string;
  name: string;
  description: string | null;
  dimension: string | null;
  vertical_id: string | null;
  status: string;
  version: number;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class PgOperatingModelRepository implements OperatingModelRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async findById(id: string): Promise<OperatingModel | null> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_operating_models WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async findByCode(code: string): Promise<OperatingModel | null> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_operating_models WHERE code = $1`,
      [code],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async list(params?: { verticalId?: string }): Promise<readonly OperatingModel[]> {
    if (params?.verticalId) {
      const result = await this.pool.query<Row>(
        `SELECT * FROM edge_operating_models WHERE vertical_id = $1 ORDER BY code`,
        [params.verticalId],
      );
      return result.rows.map((r) => this.map(r));
    }
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_operating_models ORDER BY code`,
    );
    return result.rows.map((r) => this.map(r));
  }

  async create(params: CreateOperatingModelParams): Promise<OperatingModel> {
    const id = randomUUID();
    const result = await this.pool.query<Row>(
      `INSERT INTO edge_operating_models (
         id, code, name, description, dimension, vertical_id, status, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       RETURNING *`,
      [
        id,
        params.code,
        params.name,
        params.description ?? null,
        params.dimension ?? null,
        params.verticalId ?? null,
        params.status ?? 'ACTIVE',
        JSON.stringify(params.metadata ?? {}),
      ],
    );
    return this.map(result.rows[0]);
  }

  private map(row: Row): OperatingModel {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      dimension: row.dimension,
      verticalId: row.vertical_id,
      status: row.status,
      version: row.version,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
