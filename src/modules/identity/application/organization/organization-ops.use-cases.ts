import type { UseCase } from '../common/use-case.js';
import type { ExecutionContext } from '../common/execution-context.js';
import { requireSubject } from '../common/access-control.js';
import type { OrganizationRepositoryPort } from '../../domain/ports/organization-repository.port.js';
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
} from '../../domain/organization-ops/organization-ops.types.js';
import { accessDeniedError } from '../../../../core/domain/errors/access-denied.js';

async function assertOrganizationExists(
  organizationRepository: OrganizationRepositoryPort,
  tenantId: string,
  organizationId: string,
): Promise<void> {
  const org = await organizationRepository.findById(tenantId, organizationId);
  if (!org) throw accessDeniedError();
}

export class ListFacilitiesUseCase
  implements UseCase<{ ctx: ExecutionContext; organizationId: string }, readonly Facility[]>
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    organizationId: string;
  }): Promise<readonly Facility[]> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    return this.organizationOps.listFacilities(ctx.tenantId, input.organizationId);
  }
}

export class CreateFacilityUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; organizationId: string } & Omit<CreateFacilityParams, 'organizationId'>,
      Facility
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(
    input: { ctx: ExecutionContext; organizationId: string } & Omit<
      CreateFacilityParams,
      'organizationId'
    >,
  ): Promise<Facility> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    const { ctx: _ctx, organizationId, ...params } = input;
    return this.organizationOps.createFacility(ctx.tenantId, { organizationId, ...params });
  }
}

export class UpdateFacilityUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        organizationId: string;
        facilityId: string;
      } & UpdateFacilityParams,
      Facility
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(
    input: {
      ctx: ExecutionContext;
      organizationId: string;
      facilityId: string;
    } & UpdateFacilityParams,
  ): Promise<Facility> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    const { ctx: _ctx, organizationId, facilityId, ...params } = input;
    const updated = await this.organizationOps.updateFacility(
      ctx.tenantId,
      organizationId,
      facilityId,
      params,
    );
    if (!updated) throw accessDeniedError();
    return updated;
  }
}

export class DeleteFacilityUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; organizationId: string; facilityId: string },
      { deleted: boolean }
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    organizationId: string;
    facilityId: string;
  }): Promise<{ deleted: boolean }> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    const deleted = await this.organizationOps.deleteFacility(
      ctx.tenantId,
      input.organizationId,
      input.facilityId,
    );
    if (!deleted) throw accessDeniedError();
    return { deleted: true };
  }
}

export class ListLocationTypesUseCase
  implements UseCase<{ ctx: ExecutionContext; organizationId: string }, readonly LocationTypeCode[]>
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    organizationId: string;
  }): Promise<readonly LocationTypeCode[]> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    return this.organizationOps.listLocationTypes(ctx.tenantId);
  }
}

export class ListWarehousesUseCase
  implements UseCase<{ ctx: ExecutionContext; organizationId: string }, readonly Warehouse[]>
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    organizationId: string;
  }): Promise<readonly Warehouse[]> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    return this.organizationOps.listWarehouses(ctx.tenantId, input.organizationId);
  }
}

export class CreateWarehouseUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; organizationId: string } & Omit<CreateWarehouseParams, 'organizationId'>,
      Warehouse
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(
    input: { ctx: ExecutionContext; organizationId: string } & Omit<
      CreateWarehouseParams,
      'organizationId'
    >,
  ): Promise<Warehouse> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    const { ctx: _ctx, organizationId, ...params } = input;
    return this.organizationOps.createWarehouse(ctx.tenantId, { organizationId, ...params });
  }
}

export class UpdateWarehouseUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        organizationId: string;
        warehouseId: string;
      } & UpdateWarehouseParams,
      Warehouse
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(
    input: {
      ctx: ExecutionContext;
      organizationId: string;
      warehouseId: string;
    } & UpdateWarehouseParams,
  ): Promise<Warehouse> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    const { ctx: _ctx, organizationId, warehouseId, ...params } = input;
    const updated = await this.organizationOps.updateWarehouse(
      ctx.tenantId,
      organizationId,
      warehouseId,
      params,
    );
    if (!updated) throw accessDeniedError();
    return updated;
  }
}

export class DeleteWarehouseUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; organizationId: string; warehouseId: string },
      { deleted: boolean }
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    organizationId: string;
    warehouseId: string;
  }): Promise<{ deleted: boolean }> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    const deleted = await this.organizationOps.deleteWarehouse(
      ctx.tenantId,
      input.organizationId,
      input.warehouseId,
    );
    if (!deleted) throw accessDeniedError();
    return { deleted: true };
  }
}

export class ListWarehouseZonesUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; organizationId: string; warehouseId: string },
      readonly WarehouseZone[]
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    organizationId: string;
    warehouseId: string;
  }): Promise<readonly WarehouseZone[]> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    return this.organizationOps.listZones(ctx.tenantId, input.organizationId, input.warehouseId);
  }
}

export class CreateWarehouseZoneUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        organizationId: string;
        warehouseId: string;
      } & Omit<CreateWarehouseZoneParams, 'warehouseId'>,
      WarehouseZone
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(
    input: {
      ctx: ExecutionContext;
      organizationId: string;
      warehouseId: string;
    } & Omit<CreateWarehouseZoneParams, 'warehouseId'>,
  ): Promise<WarehouseZone> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    const { ctx: _ctx, organizationId, warehouseId, ...params } = input;
    return this.organizationOps.createZone(ctx.tenantId, organizationId, {
      warehouseId,
      ...params,
    });
  }
}

export class UpdateWarehouseZoneUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        organizationId: string;
        warehouseId: string;
        zoneId: string;
      } & UpdateWarehouseZoneParams,
      WarehouseZone
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(
    input: {
      ctx: ExecutionContext;
      organizationId: string;
      warehouseId: string;
      zoneId: string;
    } & UpdateWarehouseZoneParams,
  ): Promise<WarehouseZone> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    const { ctx: _ctx, organizationId, warehouseId, zoneId, ...params } = input;
    const updated = await this.organizationOps.updateZone(
      ctx.tenantId,
      organizationId,
      warehouseId,
      zoneId,
      params,
    );
    if (!updated) throw accessDeniedError();
    return updated;
  }
}

export class DeleteWarehouseZoneUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; organizationId: string; warehouseId: string; zoneId: string },
      { deleted: boolean }
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    organizationId: string;
    warehouseId: string;
    zoneId: string;
  }): Promise<{ deleted: boolean }> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    const deleted = await this.organizationOps.deleteZone(
      ctx.tenantId,
      input.organizationId,
      input.warehouseId,
      input.zoneId,
    );
    if (!deleted) throw accessDeniedError();
    return { deleted: true };
  }
}

export class ListWarehouseLocationsUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; organizationId: string; warehouseId: string },
      readonly WarehouseLocation[]
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    organizationId: string;
    warehouseId: string;
  }): Promise<readonly WarehouseLocation[]> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    return this.organizationOps.listLocations(ctx.tenantId, input.organizationId, input.warehouseId);
  }
}

export class CreateWarehouseLocationUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        organizationId: string;
        warehouseId: string;
        zoneId: string;
      } & Omit<CreateWarehouseLocationParams, 'zoneId'>,
      WarehouseLocation
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(
    input: {
      ctx: ExecutionContext;
      organizationId: string;
      warehouseId: string;
      zoneId: string;
    } & Omit<CreateWarehouseLocationParams, 'zoneId'>,
  ): Promise<WarehouseLocation> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    const { ctx: _ctx, organizationId, warehouseId, zoneId, ...params } = input;
    return this.organizationOps.createLocation(ctx.tenantId, organizationId, warehouseId, {
      zoneId,
      ...params,
    });
  }
}

export class UpdateWarehouseLocationUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        organizationId: string;
        warehouseId: string;
        locationId: string;
      } & UpdateWarehouseLocationParams,
      WarehouseLocation
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(
    input: {
      ctx: ExecutionContext;
      organizationId: string;
      warehouseId: string;
      locationId: string;
    } & UpdateWarehouseLocationParams,
  ): Promise<WarehouseLocation> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    const { ctx: _ctx, organizationId, warehouseId, locationId, ...params } = input;
    const updated = await this.organizationOps.updateLocation(
      ctx.tenantId,
      organizationId,
      warehouseId,
      locationId,
      params,
    );
    if (!updated) throw accessDeniedError();
    return updated;
  }
}

export class DeleteWarehouseLocationUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; organizationId: string; warehouseId: string; locationId: string },
      { deleted: boolean }
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    organizationId: string;
    warehouseId: string;
    locationId: string;
  }): Promise<{ deleted: boolean }> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    const deleted = await this.organizationOps.deleteLocation(
      ctx.tenantId,
      input.organizationId,
      input.warehouseId,
      input.locationId,
    );
    if (!deleted) throw accessDeniedError();
    return { deleted: true };
  }
}

export class ListPosTerminalsUseCase
  implements UseCase<{ ctx: ExecutionContext; organizationId: string }, readonly PosTerminal[]>
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    organizationId: string;
  }): Promise<readonly PosTerminal[]> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    return this.organizationOps.listPosTerminals(ctx.tenantId, input.organizationId);
  }
}

export class CreatePosTerminalUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        organizationId: string;
      } & Omit<CreatePosTerminalParams, 'organizationId'>,
      PosTerminal
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(
    input: {
      ctx: ExecutionContext;
      organizationId: string;
    } & Omit<CreatePosTerminalParams, 'organizationId'>,
  ): Promise<PosTerminal> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    const { ctx: _ctx, organizationId, ...params } = input;
    return this.organizationOps.createPosTerminal(ctx.tenantId, { organizationId, ...params });
  }
}

export class UpdatePosTerminalUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        organizationId: string;
        terminalId: string;
      } & UpdatePosTerminalParams,
      PosTerminal
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(
    input: {
      ctx: ExecutionContext;
      organizationId: string;
      terminalId: string;
    } & UpdatePosTerminalParams,
  ): Promise<PosTerminal> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    const { ctx: _ctx, organizationId, terminalId, ...params } = input;
    const updated = await this.organizationOps.updatePosTerminal(
      ctx.tenantId,
      organizationId,
      terminalId,
      params,
    );
    if (!updated) throw accessDeniedError();
    return updated;
  }
}

export class DeletePosTerminalUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; organizationId: string; terminalId: string },
      { deleted: boolean }
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    organizationId: string;
    terminalId: string;
  }): Promise<{ deleted: boolean }> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    const deleted = await this.organizationOps.deletePosTerminal(
      ctx.tenantId,
      input.organizationId,
      input.terminalId,
    );
    if (!deleted) throw accessDeniedError();
    return { deleted: true };
  }
}

export class ListCashRegistersUseCase
  implements UseCase<{ ctx: ExecutionContext; organizationId: string }, readonly CashRegister[]>
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    organizationId: string;
  }): Promise<readonly CashRegister[]> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    return this.organizationOps.listCashRegisters(ctx.tenantId, input.organizationId);
  }
}

export class CreateCashRegisterUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        organizationId: string;
      } & Omit<CreateCashRegisterParams, 'organizationId'>,
      CashRegister
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(
    input: {
      ctx: ExecutionContext;
      organizationId: string;
    } & Omit<CreateCashRegisterParams, 'organizationId'>,
  ): Promise<CashRegister> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    const { ctx: _ctx, organizationId, ...params } = input;
    return this.organizationOps.createCashRegister(ctx.tenantId, { organizationId, ...params });
  }
}

export class UpdateCashRegisterUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        organizationId: string;
        registerId: string;
      } & UpdateCashRegisterParams,
      CashRegister
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(
    input: {
      ctx: ExecutionContext;
      organizationId: string;
      registerId: string;
    } & UpdateCashRegisterParams,
  ): Promise<CashRegister> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    const { ctx: _ctx, organizationId, registerId, ...params } = input;
    const updated = await this.organizationOps.updateCashRegister(
      ctx.tenantId,
      organizationId,
      registerId,
      params,
    );
    if (!updated) throw accessDeniedError();
    return updated;
  }
}

export class DeleteCashRegisterUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; organizationId: string; registerId: string },
      { deleted: boolean }
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    organizationId: string;
    registerId: string;
  }): Promise<{ deleted: boolean }> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    const deleted = await this.organizationOps.deleteCashRegister(
      ctx.tenantId,
      input.organizationId,
      input.registerId,
    );
    if (!deleted) throw accessDeniedError();
    return { deleted: true };
  }
}

export class ListWorkflowsUseCase
  implements UseCase<{ ctx: ExecutionContext; organizationId: string }, readonly Workflow[]>
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    organizationId: string;
  }): Promise<readonly Workflow[]> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    return this.organizationOps.listWorkflows(ctx.tenantId, input.organizationId);
  }
}

export class CreateWorkflowUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        organizationId: string;
      } & Omit<CreateWorkflowParams, 'organizationId'>,
      Workflow
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(
    input: {
      ctx: ExecutionContext;
      organizationId: string;
    } & Omit<CreateWorkflowParams, 'organizationId'>,
  ): Promise<Workflow> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    const { ctx: _ctx, organizationId, ...params } = input;
    return this.organizationOps.createWorkflow(ctx.tenantId, { organizationId, ...params });
  }
}

export class UpdateWorkflowUseCase
  implements
    UseCase<
      {
        ctx: ExecutionContext;
        organizationId: string;
        workflowId: string;
      } & UpdateWorkflowParams,
      Workflow
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(
    input: {
      ctx: ExecutionContext;
      organizationId: string;
      workflowId: string;
    } & UpdateWorkflowParams,
  ): Promise<Workflow> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    const { ctx: _ctx, organizationId, workflowId, ...params } = input;
    const updated = await this.organizationOps.updateWorkflow(
      ctx.tenantId,
      organizationId,
      workflowId,
      params,
    );
    if (!updated) throw accessDeniedError();
    return updated;
  }
}

export class DeleteWorkflowUseCase
  implements
    UseCase<
      { ctx: ExecutionContext; organizationId: string; workflowId: string },
      { deleted: boolean }
    >
{
  constructor(
    private readonly organizationRepository: OrganizationRepositoryPort,
    private readonly organizationOps: OrganizationOpsPort,
  ) {}

  async execute(input: {
    ctx: ExecutionContext;
    organizationId: string;
    workflowId: string;
  }): Promise<{ deleted: boolean }> {
    const ctx = requireSubject(input.ctx);
    await assertOrganizationExists(this.organizationRepository, ctx.tenantId, input.organizationId);
    const deleted = await this.organizationOps.deleteWorkflow(
      ctx.tenantId,
      input.organizationId,
      input.workflowId,
    );
    if (!deleted) throw accessDeniedError();
    return { deleted: true };
  }
}
