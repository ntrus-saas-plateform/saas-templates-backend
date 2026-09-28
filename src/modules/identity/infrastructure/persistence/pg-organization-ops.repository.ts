import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { TenantDatabaseManager } from '../../../../shared/database/tenant-database.manager.js';
import type { OrganizationOpsPort } from '../../domain/ports/organization-ops.port.js';
import type {
  CashRegister,
  CreateCashRegisterParams,
  CreateFacilityParams,
  CreatePosTerminalParams,
  CreateWarehouseLocationParams,
  CreateWarehouseParams,
  CreateWarehouseZoneParams,
  CreateWorkflowParams,
  Facility,
  LocationTypeCode,
  OpsEntityStatus,
  PosTerminal,
  UpdateCashRegisterParams,
  UpdateFacilityParams,
  UpdatePosTerminalParams,
  UpdateWarehouseLocationParams,
  UpdateWarehouseParams,
  UpdateWarehouseZoneParams,
  UpdateWorkflowParams,
  Warehouse,
  WarehouseLocation,
  WarehouseZone,
  Workflow,
  WorkflowKind,
  WorkflowStep,
  WorkflowStepInput,
} from '../../domain/organization-ops/organization-ops.types.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';

interface FacilityRow {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  facility_type: string;
  address: Record<string, unknown>;
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface LocationTypeCodeRow {
  code: string;
  label: string;
  is_system: boolean;
  active: boolean;
}

interface WarehouseRow {
  id: string;
  organization_id: string;
  facility_id: string | null;
  code: string;
  name: string;
  status: OpsEntityStatus;
  is_default: boolean;
  address: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface ZoneRow {
  id: string;
  warehouse_id: string;
  code: string;
  name: string;
  kind: string;
  location_type: string;
  temperature_profile: string | null;
  min_temperature: string | null;
  max_temperature: string | null;
  allowed_product_types: unknown;
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface LocationRow {
  id: string;
  zone_id: string;
  warehouse_id: string;
  parent_id: string | null;
  hierarchy_level: 'AISLE' | 'RACK' | 'SHELF' | 'BIN' | 'OTHER';
  code: string;
  name: string;
  location_type: string;
  capacity: string | null;
  min_temperature: string | null;
  max_temperature: string | null;
  security_level: string;
  barcode: string | null;
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface PosTerminalRow {
  id: string;
  organization_id: string;
  warehouse_id: string | null;
  code: string;
  name: string;
  status: OpsEntityStatus;
  is_default: boolean;
  offline_enabled: boolean;
  receipt_template: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface CashRegisterRow {
  id: string;
  organization_id: string;
  pos_terminal_id: string | null;
  code: string;
  name: string;
  status: OpsEntityStatus;
  is_default: boolean;
  opening_balance: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface WorkflowRow {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  kind: WorkflowKind;
  status: OpsEntityStatus;
  conditions: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface WorkflowStepRow {
  id: string;
  workflow_id: string;
  step_index: number;
  name: string;
  approver_roles: string[];
  approver_user_ids: string[];
  threshold: Record<string, unknown>;
  escalation: Record<string, unknown>;
  sla_hours: number | null;
  created_at: Date;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

@Injectable()
export class PgOrganizationOpsRepository implements OrganizationOpsPort {
  constructor(private readonly dbManager: TenantDatabaseManager) {}

  private async pool(tenantId: string): Promise<Pool> {
    return this.dbManager.getPool(tenantId);
  }

  async listFacilities(tenantId: string, organizationId: string): Promise<readonly Facility[]> {
    const pool = await this.pool(tenantId);
    const result = await pool.query<FacilityRow>(
      `SELECT id, organization_id, code, name, facility_type, address, active, metadata,
              created_at, updated_at
       FROM org_facilities
       WHERE organization_id = $1
       ORDER BY code ASC`,
      [organizationId],
    );
    return result.rows.map((row) => this.mapFacility(row));
  }

  async createFacility(tenantId: string, params: CreateFacilityParams): Promise<Facility> {
    const pool = await this.pool(tenantId);
    const id = randomUUID();
    try {
      const result = await pool.query<FacilityRow>(
        `INSERT INTO org_facilities (
           id, organization_id, code, name, facility_type, address, active, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb)
         RETURNING id, organization_id, code, name, facility_type, address, active, metadata,
                   created_at, updated_at`,
        [
          id,
          params.organizationId,
          params.code,
          params.name,
          params.facilityType ?? 'OFFICE',
          JSON.stringify(params.address ?? {}),
          params.active ?? true,
          JSON.stringify(params.metadata ?? {}),
        ],
      );
      return this.mapFacility(result.rows[0]);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError(ErrorCode.CONFLICT, 'Facility code already exists for organization');
      }
      throw error;
    }
  }

  async updateFacility(
    tenantId: string,
    organizationId: string,
    facilityId: string,
    params: UpdateFacilityParams,
  ): Promise<Facility | null> {
    const pool = await this.pool(tenantId);
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const push = (column: string, value: unknown, cast?: string) => {
      sets.push(`${column} = $${idx}${cast ?? ''}`);
      values.push(value);
      idx += 1;
    };

    if (params.code !== undefined) push('code', params.code);
    if (params.name !== undefined) push('name', params.name);
    if (params.facilityType !== undefined) push('facility_type', params.facilityType);
    if (params.address !== undefined) push('address', JSON.stringify(params.address), '::jsonb');
    if (params.active !== undefined) push('active', params.active);
    if (params.metadata !== undefined) push('metadata', JSON.stringify(params.metadata), '::jsonb');

    if (sets.length === 0) {
      const existing = await pool.query<FacilityRow>(
        `SELECT id, organization_id, code, name, facility_type, address, active, metadata,
                created_at, updated_at
         FROM org_facilities WHERE organization_id = $1 AND id = $2`,
        [organizationId, facilityId],
      );
      return existing.rows[0] ? this.mapFacility(existing.rows[0]) : null;
    }

    sets.push('updated_at = NOW()');
    values.push(organizationId, facilityId);

    try {
      const result = await pool.query<FacilityRow>(
        `UPDATE org_facilities SET ${sets.join(', ')}
         WHERE organization_id = $${idx} AND id = $${idx + 1}
         RETURNING id, organization_id, code, name, facility_type, address, active, metadata,
                   created_at, updated_at`,
        values,
      );
      return result.rows[0] ? this.mapFacility(result.rows[0]) : null;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError(ErrorCode.CONFLICT, 'Facility code already exists for organization');
      }
      throw error;
    }
  }

  async deleteFacility(
    tenantId: string,
    organizationId: string,
    facilityId: string,
  ): Promise<boolean> {
    const pool = await this.pool(tenantId);
    const result = await pool.query(
      `DELETE FROM org_facilities WHERE organization_id = $1 AND id = $2`,
      [organizationId, facilityId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listWarehouses(tenantId: string, organizationId: string): Promise<readonly Warehouse[]> {
    const pool = await this.pool(tenantId);
    const result = await pool.query<WarehouseRow>(
      `SELECT id, organization_id, facility_id, code, name, status, is_default, address, metadata,
              created_at, updated_at
       FROM org_warehouses
       WHERE organization_id = $1
       ORDER BY is_default DESC, code ASC`,
      [organizationId],
    );
    return result.rows.map((row) => this.mapWarehouse(row));
  }

  async createWarehouse(tenantId: string, params: CreateWarehouseParams): Promise<Warehouse> {
    const pool = await this.pool(tenantId);
    const id = randomUUID();
    try {
      const result = await pool.query<WarehouseRow>(
        `INSERT INTO org_warehouses (
           id, organization_id, facility_id, code, name, status, is_default, address, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
         RETURNING id, organization_id, facility_id, code, name, status, is_default, address, metadata,
                   created_at, updated_at`,
        [
          id,
          params.organizationId,
          params.facilityId ?? null,
          params.code,
          params.name,
          params.status ?? 'ACTIVE',
          params.isDefault ?? false,
          JSON.stringify(params.address ?? {}),
          JSON.stringify(params.metadata ?? {}),
        ],
      );
      return this.mapWarehouse(result.rows[0]);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError(ErrorCode.CONFLICT, 'Warehouse code already exists for organization');
      }
      throw error;
    }
  }

  async updateWarehouse(
    tenantId: string,
    organizationId: string,
    warehouseId: string,
    params: UpdateWarehouseParams,
  ): Promise<Warehouse | null> {
    const pool = await this.pool(tenantId);
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const push = (column: string, value: unknown, cast?: string) => {
      sets.push(`${column} = $${idx}${cast ?? ''}`);
      values.push(value);
      idx += 1;
    };

    if (params.facilityId !== undefined) push('facility_id', params.facilityId);
    if (params.code !== undefined) push('code', params.code);
    if (params.name !== undefined) push('name', params.name);
    if (params.status !== undefined) push('status', params.status);
    if (params.isDefault !== undefined) push('is_default', params.isDefault);
    if (params.address !== undefined) push('address', JSON.stringify(params.address), '::jsonb');
    if (params.metadata !== undefined) push('metadata', JSON.stringify(params.metadata), '::jsonb');

    if (sets.length === 0) {
      const existing = await pool.query<WarehouseRow>(
        `SELECT id, organization_id, facility_id, code, name, status, is_default, address, metadata,
                created_at, updated_at
         FROM org_warehouses WHERE organization_id = $1 AND id = $2`,
        [organizationId, warehouseId],
      );
      return existing.rows[0] ? this.mapWarehouse(existing.rows[0]) : null;
    }

    sets.push('updated_at = NOW()');
    values.push(organizationId, warehouseId);

    try {
      const result = await pool.query<WarehouseRow>(
        `UPDATE org_warehouses SET ${sets.join(', ')}
         WHERE organization_id = $${idx} AND id = $${idx + 1}
         RETURNING id, organization_id, facility_id, code, name, status, is_default, address, metadata,
                   created_at, updated_at`,
        values,
      );
      return result.rows[0] ? this.mapWarehouse(result.rows[0]) : null;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError(ErrorCode.CONFLICT, 'Warehouse code already exists for organization');
      }
      throw error;
    }
  }

  async deleteWarehouse(
    tenantId: string,
    organizationId: string,
    warehouseId: string,
  ): Promise<boolean> {
    const pool = await this.pool(tenantId);
    const result = await pool.query(
      `DELETE FROM org_warehouses WHERE organization_id = $1 AND id = $2`,
      [organizationId, warehouseId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private async assertWarehouseOwned(
    pool: Pool,
    organizationId: string,
    warehouseId: string,
  ): Promise<void> {
    const result = await pool.query(
      `SELECT 1 FROM org_warehouses WHERE organization_id = $1 AND id = $2`,
      [organizationId, warehouseId],
    );
    if (!result.rows[0]) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Warehouse not found');
  }

  async listZones(
    tenantId: string,
    organizationId: string,
    warehouseId: string,
  ): Promise<readonly WarehouseZone[]> {
    const pool = await this.pool(tenantId);
    await this.assertWarehouseOwned(pool, organizationId, warehouseId);
    const result = await pool.query<ZoneRow>(
      `SELECT id, warehouse_id, code, name, kind,
              COALESCE(location_type, 'AVAILABLE') AS location_type,
              temperature_profile, min_temperature, max_temperature,
              COALESCE(allowed_product_types, '[]'::jsonb) AS allowed_product_types,
              COALESCE(active, true) AS active,
              COALESCE(metadata, '{}'::jsonb) AS metadata,
              created_at, COALESCE(updated_at, created_at) AS updated_at
       FROM org_warehouse_zones
       WHERE warehouse_id = $1
       ORDER BY code ASC`,
      [warehouseId],
    );
    return result.rows.map((row) => this.mapZone(row));
  }

  async createZone(
    tenantId: string,
    organizationId: string,
    params: CreateWarehouseZoneParams,
  ): Promise<WarehouseZone> {
    const pool = await this.pool(tenantId);
    await this.assertWarehouseOwned(pool, organizationId, params.warehouseId);
    const id = randomUUID();
    try {
      const result = await pool.query<ZoneRow>(
        `INSERT INTO org_warehouse_zones (
           id, warehouse_id, code, name, kind, location_type, temperature_profile,
           min_temperature, max_temperature, allowed_product_types, active, metadata
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12::jsonb)
         RETURNING id, warehouse_id, code, name, kind, location_type, temperature_profile,
                   min_temperature, max_temperature, allowed_product_types, active, metadata,
                   created_at, updated_at`,
        [
          id,
          params.warehouseId,
          params.code,
          params.name,
          params.kind ?? 'GENERAL',
          params.locationType ?? 'AVAILABLE',
          params.temperatureProfile ?? null,
          params.minTemperature ?? null,
          params.maxTemperature ?? null,
          JSON.stringify(params.allowedProductTypes ?? []),
          params.active ?? true,
          JSON.stringify(params.metadata ?? {}),
        ],
      );
      return this.mapZone(result.rows[0]);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError(ErrorCode.CONFLICT, 'Zone code already exists for warehouse');
      }
      throw error;
    }
  }

  async updateZone(
    tenantId: string,
    organizationId: string,
    warehouseId: string,
    zoneId: string,
    params: UpdateWarehouseZoneParams,
  ): Promise<WarehouseZone | null> {
    const pool = await this.pool(tenantId);
    await this.assertWarehouseOwned(pool, organizationId, warehouseId);
    const existing = await pool.query<ZoneRow>(
      `SELECT id, warehouse_id, code, name, kind,
              COALESCE(location_type, 'AVAILABLE') AS location_type,
              temperature_profile, min_temperature, max_temperature,
              COALESCE(allowed_product_types, '[]'::jsonb) AS allowed_product_types,
              COALESCE(active, true) AS active,
              COALESCE(metadata, '{}'::jsonb) AS metadata,
              created_at, COALESCE(updated_at, created_at) AS updated_at
       FROM org_warehouse_zones WHERE warehouse_id = $1 AND id = $2`,
      [warehouseId, zoneId],
    );
    if (!existing.rows[0]) return null;
    const cur = existing.rows[0];
    try {
      const result = await pool.query<ZoneRow>(
        `UPDATE org_warehouse_zones SET
           code = $3, name = $4, kind = $5, location_type = $6,
           temperature_profile = $7, min_temperature = $8, max_temperature = $9,
           allowed_product_types = $10::jsonb, active = $11, metadata = $12::jsonb,
           updated_at = NOW()
         WHERE warehouse_id = $1 AND id = $2
         RETURNING id, warehouse_id, code, name, kind, location_type, temperature_profile,
                   min_temperature, max_temperature, allowed_product_types, active, metadata,
                   created_at, updated_at`,
        [
          warehouseId,
          zoneId,
          params.code ?? cur.code,
          params.name ?? cur.name,
          params.kind ?? cur.kind,
          params.locationType ?? cur.location_type,
          params.temperatureProfile !== undefined
            ? params.temperatureProfile
            : cur.temperature_profile,
          params.minTemperature !== undefined ? params.minTemperature : cur.min_temperature,
          params.maxTemperature !== undefined ? params.maxTemperature : cur.max_temperature,
          JSON.stringify(
            params.allowedProductTypes ??
              (Array.isArray(cur.allowed_product_types) ? cur.allowed_product_types : []),
          ),
          params.active ?? cur.active,
          JSON.stringify(params.metadata ?? cur.metadata ?? {}),
        ],
      );
      return result.rows[0] ? this.mapZone(result.rows[0]) : null;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError(ErrorCode.CONFLICT, 'Zone code already exists for warehouse');
      }
      throw error;
    }
  }

  async deleteZone(
    tenantId: string,
    organizationId: string,
    warehouseId: string,
    zoneId: string,
  ): Promise<boolean> {
    const pool = await this.pool(tenantId);
    await this.assertWarehouseOwned(pool, organizationId, warehouseId);
    const result = await pool.query(
      `DELETE FROM org_warehouse_zones WHERE warehouse_id = $1 AND id = $2`,
      [warehouseId, zoneId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listLocations(
    tenantId: string,
    organizationId: string,
    warehouseId: string,
  ): Promise<readonly WarehouseLocation[]> {
    const pool = await this.pool(tenantId);
    await this.assertWarehouseOwned(pool, organizationId, warehouseId);
    const result = await pool.query<LocationRow>(
      `SELECT l.id, l.zone_id, z.warehouse_id, l.parent_id,
              COALESCE(l.hierarchy_level, 'BIN') AS hierarchy_level,
              l.code, l.name,
              COALESCE(l.location_type, 'AVAILABLE') AS location_type,
              l.capacity, l.min_temperature, l.max_temperature,
              COALESCE(l.security_level, 'STANDARD') AS security_level,
              l.barcode, COALESCE(l.active, true) AS active,
              COALESCE(l.metadata, '{}'::jsonb) AS metadata,
              l.created_at, COALESCE(l.updated_at, l.created_at) AS updated_at
       FROM org_warehouse_locations l
       INNER JOIN org_warehouse_zones z ON z.id = l.zone_id
       WHERE z.warehouse_id = $1
       ORDER BY l.code ASC`,
      [warehouseId],
    );
    return result.rows.map((row) => this.mapLocation(row));
  }

  async createLocation(
    tenantId: string,
    organizationId: string,
    warehouseId: string,
    params: CreateWarehouseLocationParams,
  ): Promise<WarehouseLocation> {
    const pool = await this.pool(tenantId);
    await this.assertWarehouseOwned(pool, organizationId, warehouseId);
    const zone = await pool.query<{ id: string }>(
      `SELECT id FROM org_warehouse_zones WHERE warehouse_id = $1 AND id = $2`,
      [warehouseId, params.zoneId],
    );
    if (!zone.rows[0]) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Zone not found');
    const id = randomUUID();
    try {
      const result = await pool.query<LocationRow>(
        `INSERT INTO org_warehouse_locations (
           id, zone_id, parent_id, hierarchy_level, code, name, location_type, capacity,
           min_temperature, max_temperature, security_level, barcode, active, metadata
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
         RETURNING id, zone_id, $15::uuid AS warehouse_id, parent_id, hierarchy_level, code, name,
                   location_type, capacity, min_temperature, max_temperature, security_level,
                   barcode, active, metadata, created_at, updated_at`,
        [
          id,
          params.zoneId,
          params.parentId ?? null,
          params.hierarchyLevel ?? 'BIN',
          params.code,
          params.name,
          params.locationType ?? 'AVAILABLE',
          params.capacity ?? null,
          params.minTemperature ?? null,
          params.maxTemperature ?? null,
          params.securityLevel ?? 'STANDARD',
          params.barcode ?? null,
          params.active ?? true,
          JSON.stringify(params.metadata ?? {}),
          warehouseId,
        ],
      );
      return this.mapLocation(result.rows[0]);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError(ErrorCode.CONFLICT, 'Location code already exists for zone');
      }
      throw error;
    }
  }

  async updateLocation(
    tenantId: string,
    organizationId: string,
    warehouseId: string,
    locationId: string,
    params: UpdateWarehouseLocationParams,
  ): Promise<WarehouseLocation | null> {
    const pool = await this.pool(tenantId);
    await this.assertWarehouseOwned(pool, organizationId, warehouseId);
    const existing = await pool.query<LocationRow>(
      `SELECT l.id, l.zone_id, z.warehouse_id, l.parent_id,
              COALESCE(l.hierarchy_level, 'BIN') AS hierarchy_level,
              l.code, l.name,
              COALESCE(l.location_type, 'AVAILABLE') AS location_type,
              l.capacity, l.min_temperature, l.max_temperature,
              COALESCE(l.security_level, 'STANDARD') AS security_level,
              l.barcode, COALESCE(l.active, true) AS active,
              COALESCE(l.metadata, '{}'::jsonb) AS metadata,
              l.created_at, COALESCE(l.updated_at, l.created_at) AS updated_at
       FROM org_warehouse_locations l
       INNER JOIN org_warehouse_zones z ON z.id = l.zone_id
       WHERE z.warehouse_id = $1 AND l.id = $2`,
      [warehouseId, locationId],
    );
    if (!existing.rows[0]) return null;
    const cur = existing.rows[0];
    try {
      const result = await pool.query<LocationRow>(
        `UPDATE org_warehouse_locations l SET
           parent_id = $3, hierarchy_level = $4, code = $5, name = $6, location_type = $7,
           capacity = $8, min_temperature = $9, max_temperature = $10, security_level = $11,
           barcode = $12, active = $13, metadata = $14::jsonb, updated_at = NOW()
         FROM org_warehouse_zones z
         WHERE l.zone_id = z.id AND z.warehouse_id = $1 AND l.id = $2
         RETURNING l.id, l.zone_id, z.warehouse_id, l.parent_id, l.hierarchy_level, l.code, l.name,
                   l.location_type, l.capacity, l.min_temperature, l.max_temperature,
                   l.security_level, l.barcode, l.active, l.metadata, l.created_at, l.updated_at`,
        [
          warehouseId,
          locationId,
          params.parentId !== undefined ? params.parentId : cur.parent_id,
          params.hierarchyLevel ?? cur.hierarchy_level,
          params.code ?? cur.code,
          params.name ?? cur.name,
          params.locationType ?? cur.location_type,
          params.capacity !== undefined ? params.capacity : cur.capacity,
          params.minTemperature !== undefined ? params.minTemperature : cur.min_temperature,
          params.maxTemperature !== undefined ? params.maxTemperature : cur.max_temperature,
          params.securityLevel ?? cur.security_level,
          params.barcode !== undefined ? params.barcode : cur.barcode,
          params.active ?? cur.active,
          JSON.stringify(params.metadata ?? cur.metadata ?? {}),
        ],
      );
      return result.rows[0] ? this.mapLocation(result.rows[0]) : null;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError(ErrorCode.CONFLICT, 'Location code already exists for zone');
      }
      throw error;
    }
  }

  async deleteLocation(
    tenantId: string,
    organizationId: string,
    warehouseId: string,
    locationId: string,
  ): Promise<boolean> {
    const pool = await this.pool(tenantId);
    await this.assertWarehouseOwned(pool, organizationId, warehouseId);
    const result = await pool.query(
      `DELETE FROM org_warehouse_locations l
       USING org_warehouse_zones z
       WHERE l.zone_id = z.id AND z.warehouse_id = $1 AND l.id = $2`,
      [warehouseId, locationId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listLocationTypes(tenantId: string): Promise<readonly LocationTypeCode[]> {
    const pool = await this.pool(tenantId);
    const result = await pool.query<LocationTypeCodeRow>(
      `SELECT code, label, is_system, active
       FROM location_type_codes
       WHERE active = true
       ORDER BY code ASC`,
    );
    return result.rows.map((row) => ({
      code: row.code,
      label: row.label,
      isSystem: row.is_system,
      active: row.active,
    }));
  }

  async listPosTerminals(tenantId: string, organizationId: string): Promise<readonly PosTerminal[]> {
    const pool = await this.pool(tenantId);
    const result = await pool.query<PosTerminalRow>(
      `SELECT id, organization_id, warehouse_id, code, name, status, is_default,
              offline_enabled, receipt_template, metadata, created_at, updated_at
       FROM org_pos_terminals
       WHERE organization_id = $1
       ORDER BY is_default DESC, code ASC`,
      [organizationId],
    );
    return result.rows.map((row) => this.mapPosTerminal(row));
  }

  async createPosTerminal(tenantId: string, params: CreatePosTerminalParams): Promise<PosTerminal> {
    const pool = await this.pool(tenantId);
    const id = randomUUID();
    try {
      const result = await pool.query<PosTerminalRow>(
        `INSERT INTO org_pos_terminals (
           id, organization_id, warehouse_id, code, name, status, is_default,
           offline_enabled, receipt_template, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
         RETURNING id, organization_id, warehouse_id, code, name, status, is_default,
                   offline_enabled, receipt_template, metadata, created_at, updated_at`,
        [
          id,
          params.organizationId,
          params.warehouseId ?? null,
          params.code,
          params.name,
          params.status ?? 'ACTIVE',
          params.isDefault ?? false,
          params.offlineEnabled ?? false,
          params.receiptTemplate ?? null,
          JSON.stringify(params.metadata ?? {}),
        ],
      );
      return this.mapPosTerminal(result.rows[0]);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError(ErrorCode.CONFLICT, 'POS terminal code already exists for organization');
      }
      throw error;
    }
  }

  async updatePosTerminal(
    tenantId: string,
    organizationId: string,
    terminalId: string,
    params: UpdatePosTerminalParams,
  ): Promise<PosTerminal | null> {
    const pool = await this.pool(tenantId);
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const push = (column: string, value: unknown, cast?: string) => {
      sets.push(`${column} = $${idx}${cast ?? ''}`);
      values.push(value);
      idx += 1;
    };

    if (params.warehouseId !== undefined) push('warehouse_id', params.warehouseId);
    if (params.code !== undefined) push('code', params.code);
    if (params.name !== undefined) push('name', params.name);
    if (params.status !== undefined) push('status', params.status);
    if (params.isDefault !== undefined) push('is_default', params.isDefault);
    if (params.offlineEnabled !== undefined) push('offline_enabled', params.offlineEnabled);
    if (params.receiptTemplate !== undefined) push('receipt_template', params.receiptTemplate);
    if (params.metadata !== undefined) push('metadata', JSON.stringify(params.metadata), '::jsonb');

    if (sets.length === 0) {
      const existing = await pool.query<PosTerminalRow>(
        `SELECT id, organization_id, warehouse_id, code, name, status, is_default,
                offline_enabled, receipt_template, metadata, created_at, updated_at
         FROM org_pos_terminals WHERE organization_id = $1 AND id = $2`,
        [organizationId, terminalId],
      );
      return existing.rows[0] ? this.mapPosTerminal(existing.rows[0]) : null;
    }

    sets.push('updated_at = NOW()');
    values.push(organizationId, terminalId);

    try {
      const result = await pool.query<PosTerminalRow>(
        `UPDATE org_pos_terminals SET ${sets.join(', ')}
         WHERE organization_id = $${idx} AND id = $${idx + 1}
         RETURNING id, organization_id, warehouse_id, code, name, status, is_default,
                   offline_enabled, receipt_template, metadata, created_at, updated_at`,
        values,
      );
      return result.rows[0] ? this.mapPosTerminal(result.rows[0]) : null;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError(ErrorCode.CONFLICT, 'POS terminal code already exists for organization');
      }
      throw error;
    }
  }

  async deletePosTerminal(
    tenantId: string,
    organizationId: string,
    terminalId: string,
  ): Promise<boolean> {
    const pool = await this.pool(tenantId);
    const result = await pool.query(
      `DELETE FROM org_pos_terminals WHERE organization_id = $1 AND id = $2`,
      [organizationId, terminalId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listCashRegisters(
    tenantId: string,
    organizationId: string,
  ): Promise<readonly CashRegister[]> {
    const pool = await this.pool(tenantId);
    const result = await pool.query<CashRegisterRow>(
      `SELECT id, organization_id, pos_terminal_id, code, name, status, is_default,
              opening_balance, metadata, created_at, updated_at
       FROM org_cash_registers
       WHERE organization_id = $1
       ORDER BY is_default DESC, code ASC`,
      [organizationId],
    );
    return result.rows.map((row) => this.mapCashRegister(row));
  }

  async createCashRegister(
    tenantId: string,
    params: CreateCashRegisterParams,
  ): Promise<CashRegister> {
    const pool = await this.pool(tenantId);
    const id = randomUUID();
    try {
      const result = await pool.query<CashRegisterRow>(
        `INSERT INTO org_cash_registers (
           id, organization_id, pos_terminal_id, code, name, status, is_default,
           opening_balance, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
         RETURNING id, organization_id, pos_terminal_id, code, name, status, is_default,
                   opening_balance, metadata, created_at, updated_at`,
        [
          id,
          params.organizationId,
          params.posTerminalId ?? null,
          params.code,
          params.name,
          params.status ?? 'ACTIVE',
          params.isDefault ?? false,
          params.openingBalance ?? 0,
          JSON.stringify(params.metadata ?? {}),
        ],
      );
      return this.mapCashRegister(result.rows[0]);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError(
          ErrorCode.CONFLICT,
          'Cash register code already exists for organization',
        );
      }
      throw error;
    }
  }

  async updateCashRegister(
    tenantId: string,
    organizationId: string,
    registerId: string,
    params: UpdateCashRegisterParams,
  ): Promise<CashRegister | null> {
    const pool = await this.pool(tenantId);
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const push = (column: string, value: unknown, cast?: string) => {
      sets.push(`${column} = $${idx}${cast ?? ''}`);
      values.push(value);
      idx += 1;
    };

    if (params.posTerminalId !== undefined) push('pos_terminal_id', params.posTerminalId);
    if (params.code !== undefined) push('code', params.code);
    if (params.name !== undefined) push('name', params.name);
    if (params.status !== undefined) push('status', params.status);
    if (params.isDefault !== undefined) push('is_default', params.isDefault);
    if (params.openingBalance !== undefined) push('opening_balance', params.openingBalance);
    if (params.metadata !== undefined) push('metadata', JSON.stringify(params.metadata), '::jsonb');

    if (sets.length === 0) {
      const existing = await pool.query<CashRegisterRow>(
        `SELECT id, organization_id, pos_terminal_id, code, name, status, is_default,
                opening_balance, metadata, created_at, updated_at
         FROM org_cash_registers WHERE organization_id = $1 AND id = $2`,
        [organizationId, registerId],
      );
      return existing.rows[0] ? this.mapCashRegister(existing.rows[0]) : null;
    }

    sets.push('updated_at = NOW()');
    values.push(organizationId, registerId);

    try {
      const result = await pool.query<CashRegisterRow>(
        `UPDATE org_cash_registers SET ${sets.join(', ')}
         WHERE organization_id = $${idx} AND id = $${idx + 1}
         RETURNING id, organization_id, pos_terminal_id, code, name, status, is_default,
                   opening_balance, metadata, created_at, updated_at`,
        values,
      );
      return result.rows[0] ? this.mapCashRegister(result.rows[0]) : null;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError(
          ErrorCode.CONFLICT,
          'Cash register code already exists for organization',
        );
      }
      throw error;
    }
  }

  async deleteCashRegister(
    tenantId: string,
    organizationId: string,
    registerId: string,
  ): Promise<boolean> {
    const pool = await this.pool(tenantId);
    const result = await pool.query(
      `DELETE FROM org_cash_registers WHERE organization_id = $1 AND id = $2`,
      [organizationId, registerId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listWorkflows(tenantId: string, organizationId: string): Promise<readonly Workflow[]> {
    const pool = await this.pool(tenantId);
    const result = await pool.query<WorkflowRow>(
      `SELECT id, organization_id, code, name, kind, status, conditions, metadata,
              created_at, updated_at
       FROM org_workflows
       WHERE organization_id = $1
       ORDER BY code ASC`,
      [organizationId],
    );
    if (result.rows.length === 0) return [];

    const workflowIds = result.rows.map((row) => row.id);
    const stepsResult = await pool.query<WorkflowStepRow>(
      `SELECT id, workflow_id, step_index, name, approver_roles, approver_user_ids,
              threshold, escalation, sla_hours, created_at
       FROM org_workflow_steps
       WHERE workflow_id = ANY($1::uuid[])
       ORDER BY workflow_id, step_index ASC`,
      [workflowIds],
    );

    const stepsByWorkflow = new Map<string, WorkflowStep[]>();
    for (const row of stepsResult.rows) {
      const list = stepsByWorkflow.get(row.workflow_id) ?? [];
      list.push(this.mapWorkflowStep(row));
      stepsByWorkflow.set(row.workflow_id, list);
    }

    return result.rows.map((row) =>
      this.mapWorkflow(row, stepsByWorkflow.get(row.id) ?? []),
    );
  }

  async createWorkflow(tenantId: string, params: CreateWorkflowParams): Promise<Workflow> {
    const pool = await this.pool(tenantId);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const id = randomUUID();
      let workflowRow: WorkflowRow;
      try {
        const result = await client.query<WorkflowRow>(
          `INSERT INTO org_workflows (
             id, organization_id, code, name, kind, status, conditions, metadata
           ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
           RETURNING id, organization_id, code, name, kind, status, conditions, metadata,
                     created_at, updated_at`,
          [
            id,
            params.organizationId,
            params.code,
            params.name,
            params.kind,
            params.status ?? 'ACTIVE',
            JSON.stringify(params.conditions ?? {}),
            JSON.stringify(params.metadata ?? {}),
          ],
        );
        workflowRow = result.rows[0];
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new DomainError(ErrorCode.CONFLICT, 'Workflow code already exists for organization');
        }
        throw error;
      }

      const steps = await this.replaceWorkflowSteps(client, id, params.steps ?? []);
      await client.query('COMMIT');
      return this.mapWorkflow(workflowRow, steps);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateWorkflow(
    tenantId: string,
    organizationId: string,
    workflowId: string,
    params: UpdateWorkflowParams,
  ): Promise<Workflow | null> {
    const pool = await this.pool(tenantId);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const sets: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      const push = (column: string, value: unknown, cast?: string) => {
        sets.push(`${column} = $${idx}${cast ?? ''}`);
        values.push(value);
        idx += 1;
      };

      if (params.code !== undefined) push('code', params.code);
      if (params.name !== undefined) push('name', params.name);
      if (params.kind !== undefined) push('kind', params.kind);
      if (params.status !== undefined) push('status', params.status);
      if (params.conditions !== undefined) {
        push('conditions', JSON.stringify(params.conditions), '::jsonb');
      }
      if (params.metadata !== undefined) {
        push('metadata', JSON.stringify(params.metadata), '::jsonb');
      }

      let workflowRow: WorkflowRow | undefined;

      if (sets.length === 0) {
        const existing = await client.query<WorkflowRow>(
          `SELECT id, organization_id, code, name, kind, status, conditions, metadata,
                  created_at, updated_at
           FROM org_workflows WHERE organization_id = $1 AND id = $2`,
          [organizationId, workflowId],
        );
        workflowRow = existing.rows[0];
      } else {
        sets.push('updated_at = NOW()');
        values.push(organizationId, workflowId);
        try {
          const result = await client.query<WorkflowRow>(
            `UPDATE org_workflows SET ${sets.join(', ')}
             WHERE organization_id = $${idx} AND id = $${idx + 1}
             RETURNING id, organization_id, code, name, kind, status, conditions, metadata,
                       created_at, updated_at`,
            values,
          );
          workflowRow = result.rows[0];
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new DomainError(
              ErrorCode.CONFLICT,
              'Workflow code already exists for organization',
            );
          }
          throw error;
        }
      }

      if (!workflowRow) {
        await client.query('ROLLBACK');
        return null;
      }

      let steps: WorkflowStep[];
      if (params.steps !== undefined) {
        steps = await this.replaceWorkflowSteps(client, workflowId, params.steps);
      } else {
        const stepsResult = await client.query<WorkflowStepRow>(
          `SELECT id, workflow_id, step_index, name, approver_roles, approver_user_ids,
                  threshold, escalation, sla_hours, created_at
           FROM org_workflow_steps
           WHERE workflow_id = $1
           ORDER BY step_index ASC`,
          [workflowId],
        );
        steps = stepsResult.rows.map((row) => this.mapWorkflowStep(row));
      }

      await client.query('COMMIT');
      return this.mapWorkflow(workflowRow, steps);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteWorkflow(
    tenantId: string,
    organizationId: string,
    workflowId: string,
  ): Promise<boolean> {
    const pool = await this.pool(tenantId);
    const result = await pool.query(
      `DELETE FROM org_workflows WHERE organization_id = $1 AND id = $2`,
      [organizationId, workflowId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private async replaceWorkflowSteps(
    client: PoolClient,
    workflowId: string,
    steps: WorkflowStepInput[],
  ): Promise<WorkflowStep[]> {
    await client.query(`DELETE FROM org_workflow_steps WHERE workflow_id = $1`, [workflowId]);
    const created: WorkflowStep[] = [];
    for (const step of steps) {
      const id = randomUUID();
      const result = await client.query<WorkflowStepRow>(
        `INSERT INTO org_workflow_steps (
           id, workflow_id, step_index, name, approver_roles, approver_user_ids,
           threshold, escalation, sla_hours
         ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9)
         RETURNING id, workflow_id, step_index, name, approver_roles, approver_user_ids,
                   threshold, escalation, sla_hours, created_at`,
        [
          id,
          workflowId,
          step.stepIndex,
          step.name,
          JSON.stringify(step.approverRoles ?? []),
          JSON.stringify(step.approverUserIds ?? []),
          JSON.stringify(step.threshold ?? {}),
          JSON.stringify(step.escalation ?? {}),
          step.slaHours ?? null,
        ],
      );
      created.push(this.mapWorkflowStep(result.rows[0]));
    }
    return created;
  }

  private mapFacility(row: FacilityRow): Facility {
    return {
      id: row.id,
      organizationId: row.organization_id,
      code: row.code,
      name: row.name,
      facilityType: row.facility_type,
      address: row.address ?? {},
      active: row.active,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapWarehouse(row: WarehouseRow): Warehouse {
    return {
      id: row.id,
      organizationId: row.organization_id,
      facilityId: row.facility_id ?? null,
      code: row.code,
      name: row.name,
      status: row.status,
      isDefault: row.is_default,
      address: row.address ?? {},
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapZone(row: ZoneRow): WarehouseZone {
    const types = row.allowed_product_types;
    return {
      id: row.id,
      warehouseId: row.warehouse_id,
      code: row.code,
      name: row.name,
      kind: row.kind,
      locationType: row.location_type,
      temperatureProfile: row.temperature_profile,
      minTemperature: row.min_temperature != null ? Number(row.min_temperature) : null,
      maxTemperature: row.max_temperature != null ? Number(row.max_temperature) : null,
      allowedProductTypes: Array.isArray(types) ? (types as string[]) : [],
      active: row.active,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapLocation(row: LocationRow): WarehouseLocation {
    return {
      id: row.id,
      zoneId: row.zone_id,
      warehouseId: row.warehouse_id,
      parentId: row.parent_id ?? null,
      hierarchyLevel: row.hierarchy_level ?? 'BIN',
      code: row.code,
      name: row.name,
      locationType: row.location_type,
      capacity: row.capacity != null ? Number(row.capacity) : null,
      minTemperature: row.min_temperature != null ? Number(row.min_temperature) : null,
      maxTemperature: row.max_temperature != null ? Number(row.max_temperature) : null,
      securityLevel: row.security_level,
      barcode: row.barcode,
      active: row.active,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapPosTerminal(row: PosTerminalRow): PosTerminal {
    return {
      id: row.id,
      organizationId: row.organization_id,
      warehouseId: row.warehouse_id,
      code: row.code,
      name: row.name,
      status: row.status,
      isDefault: row.is_default,
      offlineEnabled: row.offline_enabled,
      receiptTemplate: row.receipt_template,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapCashRegister(row: CashRegisterRow): CashRegister {
    return {
      id: row.id,
      organizationId: row.organization_id,
      posTerminalId: row.pos_terminal_id,
      code: row.code,
      name: row.name,
      status: row.status,
      isDefault: row.is_default,
      openingBalance: Number(row.opening_balance),
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapWorkflowStep(row: WorkflowStepRow): WorkflowStep {
    return {
      id: row.id,
      workflowId: row.workflow_id,
      stepIndex: row.step_index,
      name: row.name,
      approverRoles: row.approver_roles ?? [],
      approverUserIds: row.approver_user_ids ?? [],
      threshold: row.threshold ?? {},
      escalation: row.escalation ?? {},
      slaHours: row.sla_hours,
      createdAt: row.created_at,
    };
  }

  private mapWorkflow(row: WorkflowRow, steps: WorkflowStep[]): Workflow {
    return {
      id: row.id,
      organizationId: row.organization_id,
      code: row.code,
      name: row.name,
      kind: row.kind,
      status: row.status,
      conditions: row.conditions ?? {},
      metadata: row.metadata ?? {},
      steps,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
