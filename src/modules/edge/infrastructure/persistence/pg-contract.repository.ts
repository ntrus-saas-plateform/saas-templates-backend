import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  ContractRepositoryPort,
  CreateContractParams,
} from '../../domain/ports/contract-repository.port.js';
import type { IntegrationContract } from '../../domain/contract/integration-contract.entity.js';

interface Row {
  id: string;
  code: string;
  name: string;
  contract_type: string | null;
  version: string;
  owner_ref: string | null;
  description: string | null;
  schema_ref: string | null;
  compatibility_policy: string | null;
  status: string;
  effective_from: Date | null;
  deprecated_at: Date | null;
  documentation_ref: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class PgContractRepository implements ContractRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async findById(id: string): Promise<IntegrationContract | null> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_integration_contracts WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async findByCode(code: string): Promise<IntegrationContract | null> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_integration_contracts WHERE code = $1`,
      [code],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async list(): Promise<readonly IntegrationContract[]> {
    const result = await this.pool.query<Row>(
      `SELECT * FROM edge_integration_contracts ORDER BY code`,
    );
    return result.rows.map((r) => this.map(r));
  }

  async create(params: CreateContractParams): Promise<IntegrationContract> {
    const id = randomUUID();
    const result = await this.pool.query<Row>(
      `INSERT INTO edge_integration_contracts (
         id, code, name, contract_type, version, owner_ref, description,
         schema_ref, compatibility_policy, status, effective_from, documentation_ref, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
       RETURNING *`,
      [
        id,
        params.code,
        params.name,
        params.contractType ?? null,
        params.version,
        params.ownerRef ?? null,
        params.description ?? null,
        params.schemaRef ?? null,
        params.compatibilityPolicy ?? null,
        params.status ?? 'ACTIVE',
        params.effectiveFrom ?? null,
        params.documentationRef ?? null,
        JSON.stringify(params.metadata ?? {}),
      ],
    );
    return this.map(result.rows[0]);
  }

  private map(row: Row): IntegrationContract {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      contractType: row.contract_type,
      version: row.version,
      ownerRef: row.owner_ref,
      description: row.description,
      schemaRef: row.schema_ref,
      compatibilityPolicy: row.compatibility_policy,
      status: row.status,
      effectiveFrom: row.effective_from,
      deprecatedAt: row.deprecated_at,
      documentationRef: row.documentation_ref,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
