import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  CreateEmergencyAccessParams,
  EmergencyAccessRepositoryPort,
} from '../../domain/ports/emergency-access-repository.port.js';
import {
  EmergencyAccessStatus,
  type EdgeEmergencyAccess,
} from '../../domain/emergency/edge-emergency-access.entity.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

interface Row {
  id: string;
  requester_id: string;
  approver_id: string | null;
  scope: Record<string, unknown>;
  justification: string;
  status: EmergencyAccessStatus;
  starts_at: Date | null;
  expires_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}

@Injectable()
export class PgEmergencyAccessRepository implements EmergencyAccessRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async findById(id: string): Promise<EdgeEmergencyAccess | null> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_emergency_access_grants WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async list(params?: {
    requesterId?: string;
    status?: EmergencyAccessStatus;
  }): Promise<readonly EdgeEmergencyAccess[]> {
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (params?.requesterId) {
      values.push(params.requesterId);
      clauses.push(`requester_id = $${values.length}`);
    }
    if (params?.status) {
      values.push(params.status);
      clauses.push(`status = $${values.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_emergency_access_grants ${where} ORDER BY created_at DESC`,
      values,
    );
    return result.rows.map((r) => this.map(r));
  }

  async create(params: CreateEmergencyAccessParams): Promise<EdgeEmergencyAccess> {
    const id = randomUUID();
    const result = await this.pool.query<Row>(
      `INSERT INTO edge_emergency_access_grants (
         id, requester_id, scope, justification, status
       ) VALUES ($1,$2,$3::jsonb,$4,'REQUESTED')
       RETURNING *`,
      [id, params.requesterId, JSON.stringify(params.scope), params.justification],
    );
    return this.map(result.rows[0]);
  }

  async updateStatus(
    id: string,
    status: EmergencyAccessStatus,
    extras?: {
      approverId?: string | null;
      startsAt?: Date | null;
      expiresAt?: Date | null;
      revokedAt?: Date | null;
    },
  ): Promise<EdgeEmergencyAccess> {
    const current = await this.findById(id);
    if (!current) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Emergency access grant not found');
    }
    const result = await this.pool.query<Row>(
      `UPDATE edge_emergency_access_grants SET
         status = $2,
         approver_id = $3,
         starts_at = $4,
         expires_at = $5,
         revoked_at = $6
       WHERE id = $1
       RETURNING *`,
      [
        id,
        status,
        extras?.approverId !== undefined ? extras.approverId : current.approverId,
        extras?.startsAt !== undefined ? extras.startsAt : current.startsAt,
        extras?.expiresAt !== undefined ? extras.expiresAt : current.expiresAt,
        extras?.revokedAt !== undefined ? extras.revokedAt : current.revokedAt,
      ],
    );
    return this.map(result.rows[0]);
  }

  private map(row: Row): EdgeEmergencyAccess {
    return {
      id: row.id,
      requesterId: row.requester_id,
      approverId: row.approver_id,
      scope: row.scope ?? {},
      justification: row.justification,
      status: row.status,
      startsAt: row.starts_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      createdAt: row.created_at,
    };
  }
}
