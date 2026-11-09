import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { ControlPlaneDatabaseService } from '../../../../shared/database/control-plane-database.service.js';
import type {
  AddDependencyParams,
  CapabilityRepositoryPort,
  CreateCapabilityParams,
  UpsertCapabilityMappingParams,
} from '../../domain/ports/capability-repository.port.js';
import {
  CapabilityDependencyKind,
  CapabilityMappingClassification,
  type CapabilityDependency,
  type ProductCapabilityMapping,
  type TechnicalCapability,
} from '../../domain/capability/technical-capability.entity.js';

interface CapRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  technical_status: string | null;
  commercial_availability: string | null;
  owner_ref: string | null;
  version: number;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface DepRow {
  id: string;
  capability_id: string;
  depends_on_capability_id: string;
  dependency_kind: CapabilityDependencyKind;
  min_version: string | null;
  created_at: Date;
}

interface MapRow {
  id: string;
  product_id: string;
  product_version_id: string | null;
  capability_id: string;
  classification: CapabilityMappingClassification;
  technical_status: string | null;
  commercial_availability: string | null;
  restrictions: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class PgCapabilityRepository implements CapabilityRepositoryPort {
  constructor(private readonly controlPlaneDatabase: ControlPlaneDatabaseService) {}

  private get pool(): Pool {
    return this.controlPlaneDatabase.getPool();
  }

  async findById(id: string): Promise<TechnicalCapability | null> {
    const result = await this.pool.query<CapRow>(
      `SELECT * FROM edge_technical_capabilities WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? this.mapCap(result.rows[0]) : null;
  }

  async findByCode(code: string): Promise<TechnicalCapability | null> {
    const result = await this.pool.query<CapRow>(
      `SELECT * FROM edge_technical_capabilities WHERE code = $1`,
      [code],
    );
    return result.rows[0] ? this.mapCap(result.rows[0]) : null;
  }

  async list(): Promise<readonly TechnicalCapability[]> {
    const result = await this.pool.query<CapRow>(
      `SELECT * FROM edge_technical_capabilities ORDER BY code`,
    );
    return result.rows.map((r) => this.mapCap(r));
  }

  async create(params: CreateCapabilityParams): Promise<TechnicalCapability> {
    const id = randomUUID();
    const result = await this.pool.query<CapRow>(
      `INSERT INTO edge_technical_capabilities (
         id, code, name, description, category, technical_status,
         commercial_availability, owner_ref, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
       RETURNING *`,
      [
        id,
        params.code,
        params.name,
        params.description ?? null,
        params.category ?? null,
        params.technicalStatus ?? null,
        params.commercialAvailability ?? null,
        params.ownerRef ?? null,
        JSON.stringify(params.metadata ?? {}),
      ],
    );
    return this.mapCap(result.rows[0]);
  }

  async listDependencies(capabilityId?: string): Promise<readonly CapabilityDependency[]> {
    if (capabilityId) {
      const result = await this.pool.query<DepRow>(
        `SELECT * FROM edge_capability_dependencies WHERE capability_id = $1`,
        [capabilityId],
      );
      return result.rows.map((r) => this.mapDep(r));
    }
    const result = await this.pool.query<DepRow>(`SELECT * FROM edge_capability_dependencies`);
    return result.rows.map((r) => this.mapDep(r));
  }

  async addDependency(params: AddDependencyParams): Promise<CapabilityDependency> {
    const id = randomUUID();
    const result = await this.pool.query<DepRow>(
      `INSERT INTO edge_capability_dependencies (
         id, capability_id, depends_on_capability_id, dependency_kind, min_version
       ) VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [
        id,
        params.capabilityId,
        params.dependsOnCapabilityId,
        params.dependencyKind,
        params.minVersion ?? null,
      ],
    );
    return this.mapDep(result.rows[0]);
  }

  async listMappingsByProduct(productId: string): Promise<readonly ProductCapabilityMapping[]> {
    const result = await this.pool.query<MapRow>(
      `SELECT * FROM edge_product_capability_mappings WHERE product_id = $1`,
      [productId],
    );
    return result.rows.map((r) => this.mapMapping(r));
  }

  async upsertMapping(params: UpsertCapabilityMappingParams): Promise<ProductCapabilityMapping> {
    const id = randomUUID();
    const result = await this.pool.query<MapRow>(
      `INSERT INTO edge_product_capability_mappings (
         id, product_id, product_version_id, capability_id, classification,
         technical_status, commercial_availability, restrictions
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       ON CONFLICT (product_id, product_version_id, capability_id)
       DO UPDATE SET
         classification = EXCLUDED.classification,
         technical_status = EXCLUDED.technical_status,
         commercial_availability = EXCLUDED.commercial_availability,
         restrictions = EXCLUDED.restrictions,
         updated_at = NOW()
       RETURNING *`,
      [
        id,
        params.productId,
        params.productVersionId ?? null,
        params.capabilityId,
        params.classification,
        params.technicalStatus ?? null,
        params.commercialAvailability ?? null,
        JSON.stringify(params.restrictions ?? {}),
      ],
    );
    return this.mapMapping(result.rows[0]);
  }

  private mapCap(row: CapRow): TechnicalCapability {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      category: row.category,
      technicalStatus: row.technical_status,
      commercialAvailability: row.commercial_availability,
      ownerRef: row.owner_ref,
      version: row.version,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapDep(row: DepRow): CapabilityDependency {
    return {
      id: row.id,
      capabilityId: row.capability_id,
      dependsOnCapabilityId: row.depends_on_capability_id,
      dependencyKind: row.dependency_kind,
      minVersion: row.min_version,
      createdAt: row.created_at,
    };
  }

  private mapMapping(row: MapRow): ProductCapabilityMapping {
    return {
      id: row.id,
      productId: row.product_id,
      productVersionId: row.product_version_id,
      capabilityId: row.capability_id,
      classification: row.classification,
      technicalStatus: row.technical_status,
      commercialAvailability: row.commercial_availability,
      restrictions: row.restrictions ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
