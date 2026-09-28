export type OpsEntityStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export type WorkflowKind =
  | 'PURCHASE_APPROVAL'
  | 'DISCOUNT_APPROVAL'
  | 'STOCK_ADJUSTMENT_APPROVAL'
  | 'REFUND_APPROVAL'
  | 'EXPENSE_APPROVAL'
  | 'LEAVE_APPROVAL'
  | 'CUSTOM';

export type Warehouse = {
  id: string;
  organizationId: string;
  facilityId: string | null;
  code: string;
  name: string;
  status: OpsEntityStatus;
  isDefault: boolean;
  address: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type Facility = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  facilityType: string;
  address: Record<string, unknown>;
  active: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type LocationTypeCode = {
  code: string;
  label: string;
  isSystem: boolean;
  active: boolean;
};

export type WarehouseZone = {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  kind: string;
  locationType: string;
  temperatureProfile: string | null;
  minTemperature: number | null;
  maxTemperature: number | null;
  allowedProductTypes: string[];
  active: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type WarehouseLocation = {
  id: string;
  zoneId: string;
  warehouseId: string;
  parentId: string | null;
  hierarchyLevel: 'AISLE' | 'RACK' | 'SHELF' | 'BIN' | 'OTHER';
  code: string;
  name: string;
  locationType: string;
  capacity: number | null;
  minTemperature: number | null;
  maxTemperature: number | null;
  securityLevel: string;
  barcode: string | null;
  active: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type PosTerminal = {
  id: string;
  organizationId: string;
  warehouseId: string | null;
  code: string;
  name: string;
  status: OpsEntityStatus;
  isDefault: boolean;
  offlineEnabled: boolean;
  receiptTemplate: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type CashRegister = {
  id: string;
  organizationId: string;
  posTerminalId: string | null;
  code: string;
  name: string;
  status: OpsEntityStatus;
  isDefault: boolean;
  openingBalance: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkflowStep = {
  id: string;
  workflowId: string;
  stepIndex: number;
  name: string;
  approverRoles: string[];
  approverUserIds: string[];
  threshold: Record<string, unknown>;
  escalation: Record<string, unknown>;
  slaHours: number | null;
  createdAt: Date;
};

export type Workflow = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  kind: WorkflowKind;
  status: OpsEntityStatus;
  conditions: Record<string, unknown>;
  metadata: Record<string, unknown>;
  steps: WorkflowStep[];
  createdAt: Date;
  updatedAt: Date;
};

export type CreateWarehouseParams = {
  organizationId: string;
  facilityId?: string | null;
  code: string;
  name: string;
  status?: OpsEntityStatus;
  isDefault?: boolean;
  address?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type UpdateWarehouseParams = {
  facilityId?: string | null;
  code?: string;
  name?: string;
  status?: OpsEntityStatus;
  isDefault?: boolean;
  address?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type CreateFacilityParams = {
  organizationId: string;
  code: string;
  name: string;
  facilityType?: string;
  address?: Record<string, unknown>;
  active?: boolean;
  metadata?: Record<string, unknown>;
};

export type UpdateFacilityParams = {
  code?: string;
  name?: string;
  facilityType?: string;
  address?: Record<string, unknown>;
  active?: boolean;
  metadata?: Record<string, unknown>;
};

export type CreateWarehouseZoneParams = {
  warehouseId: string;
  code: string;
  name: string;
  kind?: string;
  locationType?: string;
  temperatureProfile?: string | null;
  minTemperature?: number | null;
  maxTemperature?: number | null;
  allowedProductTypes?: string[];
  active?: boolean;
  metadata?: Record<string, unknown>;
};

export type UpdateWarehouseZoneParams = {
  code?: string;
  name?: string;
  kind?: string;
  locationType?: string;
  temperatureProfile?: string | null;
  minTemperature?: number | null;
  maxTemperature?: number | null;
  allowedProductTypes?: string[];
  active?: boolean;
  metadata?: Record<string, unknown>;
};

export type CreateWarehouseLocationParams = {
  zoneId: string;
  parentId?: string | null;
  hierarchyLevel?: 'AISLE' | 'RACK' | 'SHELF' | 'BIN' | 'OTHER';
  code: string;
  name: string;
  locationType?: string;
  capacity?: number | null;
  minTemperature?: number | null;
  maxTemperature?: number | null;
  securityLevel?: string;
  barcode?: string | null;
  active?: boolean;
  metadata?: Record<string, unknown>;
};

export type UpdateWarehouseLocationParams = {
  parentId?: string | null;
  hierarchyLevel?: 'AISLE' | 'RACK' | 'SHELF' | 'BIN' | 'OTHER';
  code?: string;
  name?: string;
  locationType?: string;
  capacity?: number | null;
  minTemperature?: number | null;
  maxTemperature?: number | null;
  securityLevel?: string;
  barcode?: string | null;
  active?: boolean;
  metadata?: Record<string, unknown>;
};

export type CreatePosTerminalParams = {
  organizationId: string;
  warehouseId?: string | null;
  code: string;
  name: string;
  status?: OpsEntityStatus;
  isDefault?: boolean;
  offlineEnabled?: boolean;
  receiptTemplate?: string | null;
  metadata?: Record<string, unknown>;
};

export type UpdatePosTerminalParams = {
  warehouseId?: string | null;
  code?: string;
  name?: string;
  status?: OpsEntityStatus;
  isDefault?: boolean;
  offlineEnabled?: boolean;
  receiptTemplate?: string | null;
  metadata?: Record<string, unknown>;
};

export type CreateCashRegisterParams = {
  organizationId: string;
  posTerminalId?: string | null;
  code: string;
  name: string;
  status?: OpsEntityStatus;
  isDefault?: boolean;
  openingBalance?: number;
  metadata?: Record<string, unknown>;
};

export type UpdateCashRegisterParams = {
  posTerminalId?: string | null;
  code?: string;
  name?: string;
  status?: OpsEntityStatus;
  isDefault?: boolean;
  openingBalance?: number;
  metadata?: Record<string, unknown>;
};

export type WorkflowStepInput = {
  stepIndex: number;
  name: string;
  approverRoles?: string[];
  approverUserIds?: string[];
  threshold?: Record<string, unknown>;
  escalation?: Record<string, unknown>;
  slaHours?: number | null;
};

export type CreateWorkflowParams = {
  organizationId: string;
  code: string;
  name: string;
  kind: WorkflowKind;
  status?: OpsEntityStatus;
  conditions?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  steps?: WorkflowStepInput[];
};

export type UpdateWorkflowParams = {
  code?: string;
  name?: string;
  kind?: WorkflowKind;
  status?: OpsEntityStatus;
  conditions?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  steps?: WorkflowStepInput[];
};
