import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  CreateSegmentParams,
  SegmentRepositoryPort,
  UpdateSegmentParams,
} from '../../domain/ports/segment-repository.port.js';
import type { MarketSegment } from '../../domain/market/market-segment.entity.js';

interface Row {
  id: string;
  code: string;
  name: string;
  description: string | null;
  vertical_id: string;
  parent_segment_id: string | null;
  status: string;
  version: number;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class PgSegmentRepository implements SegmentRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async findById(id: string): Promise<MarketSegment | null> {
    const result = await this.pool.query<Row>(`SELECT * FROM edge_market_segments WHERE id = $1`, [
      id,
    ]);
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async findByCode(code: string): Promise<MarketSegment | null> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_market_segments WHERE code = $1`,
      [code],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async listByVertical(verticalId: string): Promise<readonly MarketSegment[]> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_market_segments WHERE vertical_id = $1 ORDER BY code`,
      [verticalId],
    );
    return result.rows.map((r) => this.map(r));
  }

  async create(params: CreateSegmentParams): Promise<MarketSegment> {
    const id = randomUUID();
    const result = await this.pool.query<Row>(
      `INSERT INTO edge_market_segments (
         id, code, name, description, vertical_id, parent_segment_id, status, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       RETURNING *`,
      [
        id,
        params.code,
        params.name,
        params.description ?? null,
        params.verticalId,
        params.parentSegmentId ?? null,
        params.status ?? 'ACTIVE',
        JSON.stringify(params.metadata ?? {}),
      ],
    );
    return this.map(result.rows[0]);
  }

  async update(id: string, params: UpdateSegmentParams): Promise<MarketSegment> {
    const current = await this.findById(id);
    if (!current) throw new Error(`Segment not found: ${id}`);
    const result = await this.pool.query<Row>(
      `UPDATE edge_market_segments SET
         name = $2,
         description = $3,
         parent_segment_id = $4,
         status = $5,
         metadata = $6::jsonb,
         version = version + 1,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        params.name ?? current.name,
        params.description !== undefined ? params.description : current.description,
        params.parentSegmentId !== undefined ? params.parentSegmentId : current.parentSegmentId,
        params.status ?? current.status,
        JSON.stringify(params.metadata ?? current.metadata),
      ],
    );
    return this.map(result.rows[0]);
  }

  private map(row: Row): MarketSegment {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      verticalId: row.vertical_id,
      parentSegmentId: row.parent_segment_id,
      status: row.status,
      version: row.version,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
