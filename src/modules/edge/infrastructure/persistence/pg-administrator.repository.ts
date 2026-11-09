import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  AdministratorRepositoryPort,
  CreateAdministratorParams,
  UpdateAdministratorProfileParams,
} from '../../domain/ports/administrator-repository.port.js';
import {
  PlatformAdministratorStatus,
  type PlatformAdministrator,
} from '../../domain/administrator/platform-administrator.entity.js';

interface Row {
  id: string;
  external_identity_id: string;
  email: string;
  display_name: string;
  preferred_language: string;
  timezone: string;
  profile_picture_ref: string | null;
  status: PlatformAdministratorStatus;
  email_verified: boolean;
  mfa_enrolled: boolean;
  last_successful_access_at: Date | null;
  suspended_at: Date | null;
  deactivated_at: Date | null;
  suspension_reason: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

@Injectable()
export class PgAdministratorRepository implements AdministratorRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async findById(id: string): Promise<PlatformAdministrator | null> {
    const result = await this.pool.query<Row>(`SELECT * FROM edge_administrators WHERE id = $1`, [
      id,
    ]);
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async findByEmail(email: string): Promise<PlatformAdministrator | null> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_administrators WHERE lower(email) = lower($1)`,
      [email],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async findByExternalIdentityId(
    externalIdentityId: string,
  ): Promise<PlatformAdministrator | null> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_administrators WHERE external_identity_id = $1`,
      [externalIdentityId],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async list(params: {
    page: number;
    limit: number;
    status?: PlatformAdministratorStatus;
    search?: string;
  }): Promise<{ items: readonly PlatformAdministrator[]; total: number }> {
    const offset = (params.page - 1) * params.limit;
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (params.status) {
      values.push(params.status);
      clauses.push(`status = $${values.length}`);
    }
    if (params.search?.trim()) {
      values.push(`%${params.search.trim()}%`);
      clauses.push(`(email ILIKE $${values.length} OR display_name ILIKE $${values.length})`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const count = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM edge_administrators ${where}`,
      values,
    );
    values.push(params.limit, offset);
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_administrators ${where}
       ORDER BY created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return {
      items: result.rows.map((r) => this.map(r)),
      total: Number(count.rows[0]?.count ?? 0),
    };
  }

  async create(params: CreateAdministratorParams): Promise<PlatformAdministrator> {
    const id = randomUUID();
    const result = await this.pool.query<Row>(
      `INSERT INTO edge_administrators (
         id, external_identity_id, email, display_name, preferred_language, timezone,
         status, email_verified, mfa_enrolled, created_by, updated_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
       RETURNING *`,
      [
        id,
        params.externalIdentityId,
        params.email.toLowerCase(),
        params.displayName,
        params.preferredLanguage ?? 'en',
        params.timezone ?? 'UTC',
        params.status,
        params.emailVerified ?? false,
        params.mfaEnrolled ?? false,
        params.createdBy ?? null,
      ],
    );
    return this.map(result.rows[0]);
  }

  async updateProfile(
    id: string,
    params: UpdateAdministratorProfileParams,
  ): Promise<PlatformAdministrator> {
    const current = await this.findById(id);
    if (!current) throw new Error(`Administrator not found: ${id}`);
    const result = await this.pool.query<Row>(
      `UPDATE edge_administrators SET
         display_name = $2,
         preferred_language = $3,
         timezone = $4,
         profile_picture_ref = $5,
         updated_by = $6,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        params.displayName ?? current.displayName,
        params.preferredLanguage ?? current.preferredLanguage,
        params.timezone ?? current.timezone,
        params.profilePictureRef === undefined
          ? current.profilePictureRef
          : params.profilePictureRef,
        params.updatedBy ?? current.updatedBy,
      ],
    );
    return this.map(result.rows[0]);
  }

  async updateStatus(
    id: string,
    status: PlatformAdministratorStatus,
    extras?: {
      suspensionReason?: string | null;
      suspendedAt?: Date | null;
      deactivatedAt?: Date | null;
      updatedBy?: string | null;
      lastSuccessfulAccessAt?: Date | null;
      emailVerified?: boolean;
      mfaEnrolled?: boolean;
      externalIdentityId?: string;
    },
  ): Promise<PlatformAdministrator> {
    const current = await this.findById(id);
    if (!current) throw new Error(`Administrator not found: ${id}`);
    const result = await this.pool.query<Row>(
      `UPDATE edge_administrators SET
         status = $2,
         suspension_reason = $3,
         suspended_at = $4,
         deactivated_at = $5,
         updated_by = $6,
         last_successful_access_at = $7,
         email_verified = $8,
         mfa_enrolled = $9,
         external_identity_id = $10,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        status,
        extras?.suspensionReason !== undefined
          ? extras.suspensionReason
          : current.suspensionReason,
        extras?.suspendedAt !== undefined ? extras.suspendedAt : current.suspendedAt,
        extras?.deactivatedAt !== undefined ? extras.deactivatedAt : current.deactivatedAt,
        extras?.updatedBy !== undefined ? extras.updatedBy : current.updatedBy,
        extras?.lastSuccessfulAccessAt !== undefined
          ? extras.lastSuccessfulAccessAt
          : current.lastSuccessfulAccessAt,
        extras?.emailVerified !== undefined ? extras.emailVerified : current.emailVerified,
        extras?.mfaEnrolled !== undefined ? extras.mfaEnrolled : current.mfaEnrolled,
        extras?.externalIdentityId !== undefined
          ? extras.externalIdentityId
          : current.externalIdentityId,
      ],
    );
    return this.map(result.rows[0]);
  }

  private map(row: Row): PlatformAdministrator {
    return {
      id: row.id,
      externalIdentityId: row.external_identity_id,
      email: row.email,
      displayName: row.display_name,
      preferredLanguage: row.preferred_language,
      timezone: row.timezone,
      profilePictureRef: row.profile_picture_ref,
      status: row.status,
      emailVerified: row.email_verified,
      mfaEnrolled: row.mfa_enrolled,
      lastSuccessfulAccessAt: row.last_successful_access_at,
      suspendedAt: row.suspended_at,
      deactivatedAt: row.deactivated_at,
      suspensionReason: row.suspension_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
    };
  }
}
