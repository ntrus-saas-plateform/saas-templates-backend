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
} from '../organization-ops/organization-ops.types.js';

export interface OrganizationOpsPort {
  listFacilities(tenantId: string, organizationId: string): Promise<readonly Facility[]>;
  createFacility(tenantId: string, params: CreateFacilityParams): Promise<Facility>;
  updateFacility(
    tenantId: string,
    organizationId: string,
    facilityId: string,
    params: UpdateFacilityParams,
  ): Promise<Facility | null>;
  deleteFacility(
    tenantId: string,
    organizationId: string,
    facilityId: string,
  ): Promise<boolean>;

  listWarehouses(tenantId: string, organizationId: string): Promise<readonly Warehouse[]>;
  createWarehouse(tenantId: string, params: CreateWarehouseParams): Promise<Warehouse>;
  updateWarehouse(
    tenantId: string,
    organizationId: string,
    warehouseId: string,
    params: UpdateWarehouseParams,
  ): Promise<Warehouse | null>;
  deleteWarehouse(
    tenantId: string,
    organizationId: string,
    warehouseId: string,
  ): Promise<boolean>;

  listZones(tenantId: string, organizationId: string, warehouseId: string): Promise<readonly WarehouseZone[]>;
  createZone(tenantId: string, organizationId: string, params: CreateWarehouseZoneParams): Promise<WarehouseZone>;
  updateZone(
    tenantId: string,
    organizationId: string,
    warehouseId: string,
    zoneId: string,
    params: UpdateWarehouseZoneParams,
  ): Promise<WarehouseZone | null>;
  deleteZone(
    tenantId: string,
    organizationId: string,
    warehouseId: string,
    zoneId: string,
  ): Promise<boolean>;

  listLocations(
    tenantId: string,
    organizationId: string,
    warehouseId: string,
  ): Promise<readonly WarehouseLocation[]>;
  createLocation(
    tenantId: string,
    organizationId: string,
    warehouseId: string,
    params: CreateWarehouseLocationParams,
  ): Promise<WarehouseLocation>;
  updateLocation(
    tenantId: string,
    organizationId: string,
    warehouseId: string,
    locationId: string,
    params: UpdateWarehouseLocationParams,
  ): Promise<WarehouseLocation | null>;
  deleteLocation(
    tenantId: string,
    organizationId: string,
    warehouseId: string,
    locationId: string,
  ): Promise<boolean>;

  listLocationTypes(tenantId: string): Promise<readonly LocationTypeCode[]>;

  listPosTerminals(tenantId: string, organizationId: string): Promise<readonly PosTerminal[]>;
  createPosTerminal(tenantId: string, params: CreatePosTerminalParams): Promise<PosTerminal>;
  updatePosTerminal(
    tenantId: string,
    organizationId: string,
    terminalId: string,
    params: UpdatePosTerminalParams,
  ): Promise<PosTerminal | null>;
  deletePosTerminal(
    tenantId: string,
    organizationId: string,
    terminalId: string,
  ): Promise<boolean>;

  listCashRegisters(tenantId: string, organizationId: string): Promise<readonly CashRegister[]>;
  createCashRegister(tenantId: string, params: CreateCashRegisterParams): Promise<CashRegister>;
  updateCashRegister(
    tenantId: string,
    organizationId: string,
    registerId: string,
    params: UpdateCashRegisterParams,
  ): Promise<CashRegister | null>;
  deleteCashRegister(
    tenantId: string,
    organizationId: string,
    registerId: string,
  ): Promise<boolean>;

  listWorkflows(tenantId: string, organizationId: string): Promise<readonly Workflow[]>;
  createWorkflow(tenantId: string, params: CreateWorkflowParams): Promise<Workflow>;
  updateWorkflow(
    tenantId: string,
    organizationId: string,
    workflowId: string,
    params: UpdateWorkflowParams,
  ): Promise<Workflow | null>;
  deleteWorkflow(
    tenantId: string,
    organizationId: string,
    workflowId: string,
  ): Promise<boolean>;
}

export const ORGANIZATION_OPS_PORT = Symbol('ORGANIZATION_OPS_PORT');
