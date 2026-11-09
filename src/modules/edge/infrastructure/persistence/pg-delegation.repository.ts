import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  CreateDelegationParams,
  DelegationRepositoryPort,
} from '../../domain/ports/delegation-repository.port.js';
import type { EdgeDelegation } from '../../domain/delegation/edge-delegation.entity.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

interface Row {
  id: string;
  grantor_id: string;
  grantee_id: string;
  scope: Record<string, unknown>;
  permitted_operations: unknown;
  starts_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  justification: string | null;
  created_at: Date;
}

@Injectable()
export class PgDelegationRepository implements DelegationRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async findById(id: string): Promise<EdgeDelegation | null> {
    const result = await this.pool.query<Row>(`SELECT * FROM edge_delegations WHERE id = $1`, [
      id,
    ]);
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async listForAdministrator(administratorId: string): Promise<readonly EdgeDelegation[]> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_delegations
       WHERE grantor_id = $1 OR grantee_id = $1
       ORDER BY created_at DESC`,
      [administratorId],
    );
    return result.rows.map((r) => this.map(r));
  }

  async create(params: CreateDelegationParams): Promise<EdgeDelegation> {
    const id = randomUUID();
    const result = await this.pool.query<Row>(
      `INSERT INTO edge_delegations (
         id, grantor_id, grantee_id, scope, permitted_operations, starts_at, expires_at, justification
       ) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8)
       RETURNING *`,
      [
        id,
        params.grantorId,
        params.granteeId,
        JSON.stringify(params.scope),
        JSON.stringify(params.permittedOperations),
        params.startsAt,
        params.expiresAt,
        params.justification ?? null,
      ],
    );
    return this.map(result.rows[0]);
  }

  async revoke(id: string, revokedAt = new Date()): Promise<EdgeDelegation> {
    const result = await this.pool.query<Row>(
      `UPDATE edge_delegations SET revoked_at = $2 WHERE id = $1 RETURNING *`,
      [id, revokedAt],
    );
    if (!result.rows[0]) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Delegation not found');
    }
    return this.map(result.rows[0]);
  }

  private map(row: Row): EdgeDelegation {
    const ops = Array.isArray(row.permitted_operations)
      ? row.permitted_operations.filter((v): v is string => typeof v === 'string')
      : [];
    return {
      id: row.id,
      grantorId: row.grantor_id,
      granteeId: row.grantee_id,
      scope: row.scope ?? {},
      permittedOperations: ops,
      startsAt: row.starts_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      justification: row.justification,
      createdAt: row.created_at,
    };
  }
}
