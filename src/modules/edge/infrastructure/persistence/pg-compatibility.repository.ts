import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  CompatibilityRepositoryPort,
  UpsertCompatibilityParams,
} from '../../domain/ports/compatibility-repository.port.js';
import {
  CompatibilityStatus,
  CompatibilityTargetType,
  type ProductCompatibility,
} from '../../domain/product/product-compatibility.entity.js';

interface Row {
  id: string;
  product_id: string;
  product_version_id: string | null;
  target_type: CompatibilityTargetType;
  target_id: string;
  status: CompatibilityStatus;
  justification: string | null;
  restrictions: Record<string, unknown>;
  evidence: Record<string, unknown>;
  validated_by: string | null;
  validated_at: Date | null;
  created_at: Date;
}

@Injectable()
export class PgCompatibilityRepository implements CompatibilityRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async listByProduct(productId: string): Promise<readonly ProductCompatibility[]> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_product_compatibilities WHERE product_id = $1 ORDER BY created_at DESC`,
      [productId],
    );
    return result.rows.map((r) => this.map(r));
  }

  async upsert(params: UpsertCompatibilityParams): Promise<ProductCompatibility> {
    const id = randomUUID();
    const result = await this.pool.query<Row>(
      `INSERT INTO edge_product_compatibilities (
         id, product_id, product_version_id, target_type, target_id, status,
         justification, restrictions, evidence, validated_by, validated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11)
       ON CONFLICT (product_id, product_version_id, target_type, target_id)
       DO UPDATE SET
         status = EXCLUDED.status,
         justification = EXCLUDED.justification,
         restrictions = EXCLUDED.restrictions,
         evidence = EXCLUDED.evidence,
         validated_by = EXCLUDED.validated_by,
         validated_at = EXCLUDED.validated_at
       RETURNING *`,
      [
        id,
        params.productId,
        params.productVersionId ?? null,
        params.targetType,
        params.targetId,
        params.status,
        params.justification ?? null,
        JSON.stringify(params.restrictions ?? {}),
        JSON.stringify(params.evidence ?? {}),
        params.validatedBy ?? null,
        params.validatedAt ?? null,
      ],
    );
    return this.map(result.rows[0]);
  }

  private map(row: Row): ProductCompatibility {
    return {
      id: row.id,
      productId: row.product_id,
      productVersionId: row.product_version_id,
      targetType: row.target_type,
      targetId: row.target_id,
      status: row.status,
      justification: row.justification,
      restrictions: row.restrictions ?? {},
      evidence: row.evidence ?? {},
      validatedBy: row.validated_by,
      validatedAt: row.validated_at,
      createdAt: row.created_at,
    };
  }
}
