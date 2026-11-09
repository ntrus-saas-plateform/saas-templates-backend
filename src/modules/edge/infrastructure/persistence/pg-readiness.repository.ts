import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  CreateReadinessEvaluationParams,
  ReadinessRepositoryPort,
} from '../../domain/ports/readiness-repository.port.js';
import {
  ReadinessResult,
  type ReadinessCheck,
  type ReadinessEvaluation,
  type ReadinessProfile,
} from '../../domain/readiness/readiness.entity.js';

interface ProfileRow {
  id: string;
  code: string;
  name: string;
  product_type: string | null;
  deployment_mode: string | null;
  release_type: string | null;
  rules: Record<string, unknown>;
  version: number;
  status: string;
  created_at: Date;
}

interface EvalRow {
  id: string;
  product_id: string;
  product_version_id: string;
  profile_id: string | null;
  result: ReadinessResult;
  checks: ReadinessCheck[];
  blockers: string[];
  warnings: string[];
  triggered_by: string | null;
  created_at: Date;
}

@Injectable()
export class PgReadinessRepository implements ReadinessRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async findProfileByCode(code: string): Promise<ReadinessProfile | null> {
    const result = await this.pool.query<ProfileRow>(
      `SELECT * FROM edge_readiness_profiles WHERE code = $1`,
      [code],
    );
    return result.rows[0] ? this.mapProfile(result.rows[0]) : null;
  }

  async findProfileById(id: string): Promise<ReadinessProfile | null> {
    const result = await this.pool.query<ProfileRow>(
      `SELECT * FROM edge_readiness_profiles WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? this.mapProfile(result.rows[0]) : null;
  }

  async createEvaluation(params: CreateReadinessEvaluationParams): Promise<ReadinessEvaluation> {
    const id = randomUUID();
    const result = await this.pool.query<EvalRow>(
      `INSERT INTO edge_readiness_evaluations (
         id, product_id, product_version_id, profile_id, result, checks, blockers, warnings, triggered_by
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9)
       RETURNING *`,
      [
        id,
        params.productId,
        params.productVersionId,
        params.profileId ?? null,
        params.result,
        JSON.stringify(params.checks),
        JSON.stringify(params.blockers),
        JSON.stringify(params.warnings),
        params.triggeredBy ?? null,
      ],
    );
    return this.mapEval(result.rows[0]);
  }

  async listEvaluations(params: {
    page: number;
    limit: number;
    productId?: string;
  }): Promise<{ items: readonly ReadinessEvaluation[]; total: number }> {
    const offset = (params.page - 1) * params.limit;
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (params.productId) {
      values.push(params.productId);
      clauses.push(`product_id = $${values.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const count = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM edge_readiness_evaluations ${where}`,
      values,
    );
    values.push(params.limit, offset);
    const result = await this.pool.query<EvalRow>(
      `SELECT * FROM edge_readiness_evaluations ${where}
       ORDER BY created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return {
      items: result.rows.map((r) => this.mapEval(r)),
      total: Number(count.rows[0]?.count ?? 0),
    };
  }

  private mapProfile(row: ProfileRow): ReadinessProfile {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      productType: row.product_type,
      deploymentMode: row.deployment_mode,
      releaseType: row.release_type,
      rules: row.rules ?? {},
      version: row.version,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  private mapEval(row: EvalRow): ReadinessEvaluation {
    return {
      id: row.id,
      productId: row.product_id,
      productVersionId: row.product_version_id,
      profileId: row.profile_id,
      result: row.result,
      checks: row.checks ?? [],
      blockers: row.blockers ?? [],
      warnings: row.warnings ?? [],
      triggeredBy: row.triggered_by,
      createdAt: row.created_at,
    };
  }
}
