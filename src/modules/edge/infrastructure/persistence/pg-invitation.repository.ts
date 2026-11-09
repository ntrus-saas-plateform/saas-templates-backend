import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  CreateEdgeInvitationParams,
  InvitationRepositoryPort,
} from '../../domain/ports/invitation-repository.port.js';
import {
  EdgeInvitationStatus,
  type EdgeInvitation,
} from '../../domain/invitation/edge-invitation.entity.js';

interface Row {
  id: string;
  email: string;
  invited_by: string;
  token_hash: string;
  status: EdgeInvitationStatus;
  expires_at: Date;
  accepted_at: Date | null;
  vertical_ids: unknown;
  role_codes: unknown;
  workflow_state: string | null;
  delivery_status: string | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class PgInvitationRepository implements InvitationRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async findById(id: string): Promise<EdgeInvitation | null> {
    const result = await this.pool.query<Row>(`SELECT * FROM edge_invitations WHERE id = $1`, [
      id,
    ]);
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<EdgeInvitation | null> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_invitations WHERE token_hash = $1`,
      [tokenHash],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async listPendingByEmail(email: string): Promise<readonly EdgeInvitation[]> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_invitations
       WHERE lower(email) = lower($1) AND status = 'PENDING'
       ORDER BY created_at DESC`,
      [email],
    );
    return result.rows.map((r) => this.map(r));
  }

  async create(params: CreateEdgeInvitationParams): Promise<EdgeInvitation> {
    const id = randomUUID();
    const result = await this.pool.query<Row>(
      `INSERT INTO edge_invitations (
         id, email, invited_by, token_hash, status, expires_at, vertical_ids, role_codes,
         workflow_state, delivery_status
       ) VALUES ($1,$2,$3,$4,'PENDING',$5,$6::jsonb,$7::jsonb,$8,$9)
       RETURNING *`,
      [
        id,
        params.email.toLowerCase(),
        params.invitedBy,
        params.tokenHash,
        params.expiresAt,
        JSON.stringify(params.verticalIds),
        JSON.stringify(params.roleCodes),
        params.workflowState ?? null,
        params.deliveryStatus ?? null,
      ],
    );
    return this.map(result.rows[0]);
  }

  async updateStatus(
    id: string,
    status: EdgeInvitationStatus,
    extras?: {
      acceptedAt?: Date | null;
      deliveryStatus?: string | null;
      workflowState?: string | null;
    },
  ): Promise<EdgeInvitation> {
    const current = await this.findById(id);
    if (!current) throw new Error(`Invitation not found: ${id}`);
    const result = await this.pool.query<Row>(
      `UPDATE edge_invitations SET
         status = $2,
         accepted_at = $3,
         delivery_status = $4,
         workflow_state = $5,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        status,
        extras?.acceptedAt !== undefined ? extras.acceptedAt : current.acceptedAt,
        extras?.deliveryStatus !== undefined ? extras.deliveryStatus : current.deliveryStatus,
        extras?.workflowState !== undefined ? extras.workflowState : current.workflowState,
      ],
    );
    return this.map(result.rows[0]);
  }

  private map(row: Row): EdgeInvitation {
    return {
      id: row.id,
      email: row.email,
      invitedBy: row.invited_by,
      tokenHash: row.token_hash,
      status: row.status,
      expiresAt: row.expires_at,
      acceptedAt: row.accepted_at,
      verticalIds: this.asStringArray(row.vertical_ids),
      roleCodes: this.asStringArray(row.role_codes),
      workflowState: row.workflow_state,
      deliveryStatus: row.delivery_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private asStringArray(value: unknown): readonly string[] {
    if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown;
        return Array.isArray(parsed)
          ? parsed.filter((v): v is string => typeof v === 'string')
          : [];
      } catch {
        return [];
      }
    }
    return [];
  }
}
