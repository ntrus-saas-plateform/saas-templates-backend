import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  CreateWorkspaceSessionParams,
  WorkspaceSessionRepositoryPort,
} from '../../domain/ports/workspace-session-repository.port.js';
import {
  WorkspaceSessionStatus,
  type WorkspaceSession,
} from '../../domain/session/workspace-session.entity.js';

interface Row {
  id: string;
  administrator_id: string;
  membership_id: string;
  vertical_id: string;
  token_hash: string;
  status: WorkspaceSessionStatus;
  expires_at: Date;
  last_renewed_at: Date | null;
  revoked_at: Date | null;
  revocation_reason: string | null;
  created_at: Date;
}

@Injectable()
export class PgWorkspaceSessionRepository implements WorkspaceSessionRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async findById(id: string): Promise<WorkspaceSession | null> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_workspace_sessions WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<WorkspaceSession | null> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_workspace_sessions WHERE token_hash = $1`,
      [tokenHash],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async listByAdministrator(administratorId: string): Promise<readonly WorkspaceSession[]> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_workspace_sessions
       WHERE administrator_id = $1
       ORDER BY created_at DESC`,
      [administratorId],
    );
    return result.rows.map((r) => this.map(r));
  }

  async create(params: CreateWorkspaceSessionParams): Promise<WorkspaceSession> {
    const id = randomUUID();
    const result = await this.pool.query<Row>(
      `INSERT INTO edge_workspace_sessions (
         id, administrator_id, membership_id, vertical_id, token_hash, status, expires_at
       ) VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6)
       RETURNING *`,
      [
        id,
        params.administratorId,
        params.membershipId,
        params.verticalId,
        params.tokenHash,
        params.expiresAt,
      ],
    );
    return this.map(result.rows[0]);
  }

  async renew(id: string, expiresAt: Date, lastRenewedAt = new Date()): Promise<WorkspaceSession> {
    const result = await this.pool.query<Row>(
      `UPDATE edge_workspace_sessions
       SET expires_at = $2, last_renewed_at = $3
       WHERE id = $1
       RETURNING *`,
      [id, expiresAt, lastRenewedAt],
    );
    return this.map(result.rows[0]);
  }

  async updateStatus(
    id: string,
    status: WorkspaceSessionStatus,
    extras?: { revokedAt?: Date | null; revocationReason?: string | null },
  ): Promise<WorkspaceSession> {
    const current = await this.findById(id);
    if (!current) throw new Error(`Workspace session not found: ${id}`);
    const result = await this.pool.query<Row>(
      `UPDATE edge_workspace_sessions SET
         status = $2,
         revoked_at = $3,
         revocation_reason = $4
       WHERE id = $1
       RETURNING *`,
      [
        id,
        status,
        extras?.revokedAt !== undefined ? extras.revokedAt : current.revokedAt,
        extras?.revocationReason !== undefined
          ? extras.revocationReason
          : current.revocationReason,
      ],
    );
    return this.map(result.rows[0]);
  }

  async revokeAllForAdministrator(
    administratorId: string,
    reason: string,
    revokedAt = new Date(),
  ): Promise<number> {
    const result = await this.pool.query(
      `UPDATE edge_workspace_sessions
       SET status = 'REVOKED', revoked_at = $2, revocation_reason = $3
       WHERE administrator_id = $1 AND status = 'ACTIVE'`,
      [administratorId, revokedAt, reason],
    );
    return result.rowCount ?? 0;
  }

  async revokeAllForMembership(
    membershipId: string,
    reason: string,
    revokedAt = new Date(),
  ): Promise<number> {
    const result = await this.pool.query(
      `UPDATE edge_workspace_sessions
       SET status = 'REVOKED', revoked_at = $2, revocation_reason = $3
       WHERE membership_id = $1 AND status = 'ACTIVE'`,
      [membershipId, revokedAt, reason],
    );
    return result.rowCount ?? 0;
  }

  private map(row: Row): WorkspaceSession {
    return {
      id: row.id,
      administratorId: row.administrator_id,
      membershipId: row.membership_id,
      verticalId: row.vertical_id,
      tokenHash: row.token_hash,
      status: row.status,
      expiresAt: row.expires_at,
      lastRenewedAt: row.last_renewed_at,
      revokedAt: row.revoked_at,
      revocationReason: row.revocation_reason,
      createdAt: row.created_at,
    };
  }
}
