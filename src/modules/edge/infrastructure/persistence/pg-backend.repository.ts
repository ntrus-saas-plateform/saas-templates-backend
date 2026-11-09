import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  BackendRepositoryPort,
  CreateBackendParams,
  CreateBindingParams,
} from '../../domain/ports/backend-repository.port.js';
import {
  BackendBindingType,
  type BusinessBackend,
  type ProductBackendBinding,
} from '../../domain/backend/business-backend.entity.js';

interface BackendRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  backend_type: string | null;
  lifecycle_status: string;
  deployment_modes: unknown[];
  supported_protocols: unknown[];
  supported_api_versions: unknown[];
  supported_event_versions: unknown[];
  security_profile: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface BindingRow {
  id: string;
  product_id: string;
  product_version_id: string | null;
  backend_id: string;
  binding_type: BackendBindingType;
  deployment_mode: string | null;
  compatibility_status: string | null;
  effective_from: Date | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

@Injectable()
export class PgBackendRepository implements BackendRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async findById(id: string): Promise<BusinessBackend | null> {
    const result = await this.pool.query<BackendRow>(
      `SELECT * FROM edge_business_backends WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? this.mapBackend(result.rows[0]) : null;
  }

  async findByCode(code: string): Promise<BusinessBackend | null> {
    const result = await this.pool.query<BackendRow>(
      `SELECT * FROM edge_business_backends WHERE code = $1`,
      [code],
    );
    return result.rows[0] ? this.mapBackend(result.rows[0]) : null;
  }

  async list(): Promise<readonly BusinessBackend[]> {
    const result = await this.pool.query<BackendRow>(
      `SELECT * FROM edge_business_backends ORDER BY code`,
    );
    return result.rows.map((r) => this.mapBackend(r));
  }

  async create(params: CreateBackendParams): Promise<BusinessBackend> {
    const id = randomUUID();
    const result = await this.pool.query<BackendRow>(
      `INSERT INTO edge_business_backends (
         id, code, name, description, backend_type, lifecycle_status,
         deployment_modes, supported_protocols, supported_api_versions,
         supported_event_versions, security_profile, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb)
       RETURNING *`,
      [
        id,
        params.code,
        params.name,
        params.description ?? null,
        params.backendType ?? null,
        params.lifecycleStatus ?? 'ACTIVE',
        JSON.stringify(params.deploymentModes ?? []),
        JSON.stringify(params.supportedProtocols ?? []),
        JSON.stringify(params.supportedApiVersions ?? []),
        JSON.stringify(params.supportedEventVersions ?? []),
        JSON.stringify(params.securityProfile ?? {}),
        JSON.stringify(params.metadata ?? {}),
      ],
    );
    return this.mapBackend(result.rows[0]);
  }

  async listBindingsByProduct(productId: string): Promise<readonly ProductBackendBinding[]> {
    const result = await this.pool.query<BindingRow>(
      `SELECT * FROM edge_product_backend_bindings WHERE product_id = $1 ORDER BY created_at DESC`,
      [productId],
    );
    return result.rows.map((r) => this.mapBinding(r));
  }

  async createBinding(params: CreateBindingParams): Promise<ProductBackendBinding> {
    const id = randomUUID();
    const result = await this.pool.query<BindingRow>(
      `INSERT INTO edge_product_backend_bindings (
         id, product_id, product_version_id, backend_id, binding_type,
         deployment_mode, compatibility_status, effective_from, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
       RETURNING *`,
      [
        id,
        params.productId,
        params.productVersionId ?? null,
        params.backendId,
        params.bindingType,
        params.deploymentMode ?? null,
        params.compatibilityStatus ?? null,
        params.effectiveFrom ?? null,
        JSON.stringify(params.metadata ?? {}),
      ],
    );
    return this.mapBinding(result.rows[0]);
  }

  private mapBackend(row: BackendRow): BusinessBackend {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      backendType: row.backend_type,
      lifecycleStatus: row.lifecycle_status,
      deploymentModes: row.deployment_modes ?? [],
      supportedProtocols: row.supported_protocols ?? [],
      supportedApiVersions: row.supported_api_versions ?? [],
      supportedEventVersions: row.supported_event_versions ?? [],
      securityProfile: row.security_profile ?? {},
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapBinding(row: BindingRow): ProductBackendBinding {
    return {
      id: row.id,
      productId: row.product_id,
      productVersionId: row.product_version_id,
      backendId: row.backend_id,
      bindingType: row.binding_type,
      deploymentMode: row.deployment_mode,
      compatibilityStatus: row.compatibility_status,
      effectiveFrom: row.effective_from,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
    };
  }
}
