import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  ConfigurationRepositoryPort,
  CreateConfigurationVersionParams,
} from '../../domain/ports/configuration-repository.port.js';
import {
  ConfigurationVersionStatus,
  type WorkspaceConfigurationVersion,
} from '../../domain/configuration/workspace-configuration.entity.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

interface Row {
  id: string;
  vertical_id: string;
  version: number;
  config: Record<string, unknown>;
  status: ConfigurationVersionStatus;
  editor_id: string | null;
  change_reason: string | null;
  activated_at: Date | null;
  created_at: Date;
}

@Injectable()
export class PgConfigurationRepository implements ConfigurationRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async findById(id: string): Promise<WorkspaceConfigurationVersion | null> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_configuration_versions WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async findActiveByVertical(verticalId: string): Promise<WorkspaceConfigurationVersion | null> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_configuration_versions
       WHERE vertical_id = $1 AND status = 'ACTIVE'
       ORDER BY version DESC
       LIMIT 1`,
      [verticalId],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async findLatestDraft(verticalId: string): Promise<WorkspaceConfigurationVersion | null> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_configuration_versions
       WHERE vertical_id = $1 AND status IN ('DRAFT', 'VALIDATED')
       ORDER BY version DESC
       LIMIT 1`,
      [verticalId],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async listByVertical(verticalId: string): Promise<readonly WorkspaceConfigurationVersion[]> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_configuration_versions
       WHERE vertical_id = $1
       ORDER BY version DESC`,
      [verticalId],
    );
    return result.rows.map((r) => this.map(r));
  }

  async create(params: CreateConfigurationVersionParams): Promise<WorkspaceConfigurationVersion> {
    const id = randomUUID();
    const result = await this.pool.query<Row>(
      `INSERT INTO edge_configuration_versions (
         id, vertical_id, version, config, status, editor_id, change_reason
       ) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7)
       RETURNING *`,
      [
        id,
        params.verticalId,
        params.version,
        JSON.stringify(params.config),
        params.status,
        params.editorId ?? null,
        params.changeReason ?? null,
      ],
    );
    return this.map(result.rows[0]);
  }

  async updateConfig(
    id: string,
    config: Readonly<Record<string, unknown>>,
    extras?: { editorId?: string | null; changeReason?: string | null },
  ): Promise<WorkspaceConfigurationVersion> {
    const current = await this.findById(id);
    if (!current) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Configuration version not found');
    }
    const result = await this.pool.query<Row>(
      `UPDATE edge_configuration_versions SET
         config = $2::jsonb,
         editor_id = $3,
         change_reason = $4,
         status = 'DRAFT'
       WHERE id = $1
       RETURNING *`,
      [
        id,
        JSON.stringify(config),
        extras?.editorId !== undefined ? extras.editorId : current.editorId,
        extras?.changeReason !== undefined ? extras.changeReason : current.changeReason,
      ],
    );
    return this.map(result.rows[0]);
  }

  async updateStatus(
    id: string,
    status: ConfigurationVersionStatus,
    extras?: { activatedAt?: Date | null; editorId?: string | null },
  ): Promise<WorkspaceConfigurationVersion> {
    const current = await this.findById(id);
    if (!current) {
      throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Configuration version not found');
    }
    const result = await this.pool.query<Row>(
      `UPDATE edge_configuration_versions SET
         status = $2,
         activated_at = $3,
         editor_id = $4
       WHERE id = $1
       RETURNING *`,
      [
        id,
        status,
        extras?.activatedAt !== undefined ? extras.activatedAt : current.activatedAt,
        extras?.editorId !== undefined ? extras.editorId : current.editorId,
      ],
    );
    return this.map(result.rows[0]);
  }

  async markPreviousActiveRolledBack(verticalId: string, exceptId: string): Promise<void> {
    await this.pool.query(
      `UPDATE edge_configuration_versions
       SET status = 'ROLLED_BACK'
       WHERE vertical_id = $1 AND status = 'ACTIVE' AND id <> $2`,
      [verticalId, exceptId],
    );
  }

  private map(row: Row): WorkspaceConfigurationVersion {
    return {
      id: row.id,
      verticalId: row.vertical_id,
      version: row.version,
      config: row.config ?? {},
      status: row.status,
      editorId: row.editor_id,
      changeReason: row.change_reason,
      activatedAt: row.activated_at,
      createdAt: row.created_at,
    };
  }
}
