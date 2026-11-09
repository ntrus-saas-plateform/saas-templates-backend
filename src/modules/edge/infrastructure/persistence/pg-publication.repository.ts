import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  CreatePublicationSnapshotParams,
  PublicationRepositoryPort,
} from '../../domain/ports/publication-repository.port.js';
import type { PublicationSnapshot } from '../../domain/publication/publication.entity.js';

interface Row {
  id: string;
  product_id: string;
  product_version_id: string;
  snapshot: Record<string, unknown>;
  published_by: string | null;
  published_at: Date;
  approval_refs: unknown[];
}

@Injectable()
export class PgPublicationRepository implements PublicationRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async create(params: CreatePublicationSnapshotParams): Promise<PublicationSnapshot> {
    const id = randomUUID();
    const result = await this.pool.query<Row>(
      `INSERT INTO edge_publication_snapshots (
         id, product_id, product_version_id, snapshot, published_by, approval_refs
       ) VALUES ($1,$2,$3,$4::jsonb,$5,$6::jsonb)
       RETURNING *`,
      [
        id,
        params.productId,
        params.productVersionId,
        JSON.stringify(params.snapshot),
        params.publishedBy ?? null,
        JSON.stringify(params.approvalRefs ?? []),
      ],
    );
    return this.map(result.rows[0]);
  }

  async listByProduct(productId: string): Promise<readonly PublicationSnapshot[]> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_publication_snapshots WHERE product_id = $1 ORDER BY published_at DESC`,
      [productId],
    );
    return result.rows.map((r) => this.map(r));
  }

  private map(row: Row): PublicationSnapshot {
    return {
      id: row.id,
      productId: row.product_id,
      productVersionId: row.product_version_id,
      snapshot: row.snapshot,
      publishedBy: row.published_by,
      publishedAt: row.published_at,
      approvalRefs: row.approval_refs ?? [],
    };
  }
}
