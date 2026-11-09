import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  CreateMembershipParams,
  MembershipRepositoryPort,
} from '../../domain/ports/membership-repository.port.js';
import {
  MembershipStatus,
  type VerticalMembership,
} from '../../domain/membership/vertical-membership.entity.js';

interface Row {
  id: string;
  administrator_id: string;
  vertical_id: string;
  status: MembershipStatus;
  invitation_id: string | null;
  invited_by: string | null;
  activated_at: Date | null;
  suspended_at: Date | null;
  revoked_at: Date | null;
  reason: string | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class PgMembershipRepository implements MembershipRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async findById(id: string): Promise<VerticalMembership | null> {
    const result = await this.pool.query<Row>(`SELECT * FROM edge_memberships WHERE id = $1`, [
      id,
    ]);
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async findByAdminAndVertical(
    administratorId: string,
    verticalId: string,
  ): Promise<VerticalMembership | null> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_memberships WHERE administrator_id = $1 AND vertical_id = $2`,
      [administratorId, verticalId],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async listByVertical(verticalId: string): Promise<readonly VerticalMembership[]> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_memberships WHERE vertical_id = $1 ORDER BY created_at DESC`,
      [verticalId],
    );
    return result.rows.map((r) => this.map(r));
  }

  async listByAdministrator(administratorId: string): Promise<readonly VerticalMembership[]> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_memberships WHERE administrator_id = $1 ORDER BY created_at DESC`,
      [administratorId],
    );
    return result.rows.map((r) => this.map(r));
  }

  async create(params: CreateMembershipParams): Promise<VerticalMembership> {
    const id = randomUUID();
    const result = await this.pool.query<Row>(
      `INSERT INTO edge_memberships (
         id, administrator_id, vertical_id, status, invitation_id, invited_by, reason
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        id,
        params.administratorId,
        params.verticalId,
        params.status,
        params.invitationId ?? null,
        params.invitedBy ?? null,
        params.reason ?? null,
      ],
    );
    return this.map(result.rows[0]);
  }

  async updateStatus(
    id: string,
    status: MembershipStatus,
    extras?: {
      reason?: string | null;
      activatedAt?: Date | null;
      suspendedAt?: Date | null;
      revokedAt?: Date | null;
    },
  ): Promise<VerticalMembership> {
    const current = await this.findById(id);
    if (!current) throw new Error(`Membership not found: ${id}`);
    const result = await this.pool.query<Row>(
      `UPDATE edge_memberships SET
         status = $2,
         reason = $3,
         activated_at = $4,
         suspended_at = $5,
         revoked_at = $6,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        status,
        extras?.reason !== undefined ? extras.reason : current.reason,
        extras?.activatedAt !== undefined ? extras.activatedAt : current.activatedAt,
        extras?.suspendedAt !== undefined ? extras.suspendedAt : current.suspendedAt,
        extras?.revokedAt !== undefined ? extras.revokedAt : current.revokedAt,
      ],
    );
    return this.map(result.rows[0]);
  }

  private map(row: Row): VerticalMembership {
    return {
      id: row.id,
      administratorId: row.administrator_id,
      verticalId: row.vertical_id,
      status: row.status,
      invitationId: row.invitation_id,
      invitedBy: row.invited_by,
      activatedAt: row.activated_at,
      suspendedAt: row.suspended_at,
      revokedAt: row.revoked_at,
      reason: row.reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
