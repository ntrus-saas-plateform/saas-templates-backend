import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuditAction, RequirePermissions } from '../../../../shared/auth/decorators.js';
import { TenantContextService } from '../../../../shared/tenancy/tenant-context.service.js';
import { SwaggerTags } from '../../../../shared/swagger/swagger.constants.js';
import {
  ApiCreatedDataResponse,
  ApiJsonBody,
  ApiOkDataResponse,
} from '../../../../shared/swagger/api-decorators.js';
import { toExecutionContext } from '../execution-context.mapper.js';
import {
  CreateCashRegisterUseCase,
  CreateFacilityUseCase,
  CreatePosTerminalUseCase,
  CreateWarehouseLocationUseCase,
  CreateWarehouseUseCase,
  CreateWarehouseZoneUseCase,
  CreateWorkflowUseCase,
  DeleteCashRegisterUseCase,
  DeleteFacilityUseCase,
  DeletePosTerminalUseCase,
  DeleteWarehouseLocationUseCase,
  DeleteWarehouseUseCase,
  DeleteWarehouseZoneUseCase,
  DeleteWorkflowUseCase,
  ListCashRegistersUseCase,
  ListFacilitiesUseCase,
  ListLocationTypesUseCase,
  ListPosTerminalsUseCase,
  ListWarehouseLocationsUseCase,
  ListWarehousesUseCase,
  ListWarehouseZonesUseCase,
  ListWorkflowsUseCase,
  UpdateCashRegisterUseCase,
  UpdateFacilityUseCase,
  UpdatePosTerminalUseCase,
  UpdateWarehouseLocationUseCase,
  UpdateWarehouseUseCase,
  UpdateWarehouseZoneUseCase,
  UpdateWorkflowUseCase,
} from '../../application/organization/organization-ops.use-cases.js';
import {
  CreateCashRegisterDto,
  CreateFacilityDto,
  CreatePosTerminalDto,
  CreateWarehouseDto,
  CreateWarehouseLocationDto,
  CreateWarehouseZoneDto,
  CreateWorkflowDto,
  UpdateCashRegisterDto,
  UpdateFacilityDto,
  UpdatePosTerminalDto,
  UpdateWarehouseDto,
  UpdateWarehouseLocationDto,
  UpdateWarehouseZoneDto,
  UpdateWorkflowDto,
} from '../dto/organization-ops.dto.js';

@ApiTags(SwaggerTags.ORGANIZATIONS)
@ApiBearerAuth()
@Controller('organizations/:organizationId')
export class OrganizationOpsController {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly listFacilitiesUseCase: ListFacilitiesUseCase,
    private readonly createFacilityUseCase: CreateFacilityUseCase,
    private readonly updateFacilityUseCase: UpdateFacilityUseCase,
    private readonly deleteFacilityUseCase: DeleteFacilityUseCase,
    private readonly listLocationTypesUseCase: ListLocationTypesUseCase,
    private readonly listWarehousesUseCase: ListWarehousesUseCase,
    private readonly createWarehouseUseCase: CreateWarehouseUseCase,
    private readonly updateWarehouseUseCase: UpdateWarehouseUseCase,
    private readonly deleteWarehouseUseCase: DeleteWarehouseUseCase,
    private readonly listWarehouseZonesUseCase: ListWarehouseZonesUseCase,
    private readonly createWarehouseZoneUseCase: CreateWarehouseZoneUseCase,
    private readonly updateWarehouseZoneUseCase: UpdateWarehouseZoneUseCase,
    private readonly deleteWarehouseZoneUseCase: DeleteWarehouseZoneUseCase,
    private readonly listWarehouseLocationsUseCase: ListWarehouseLocationsUseCase,
    private readonly createWarehouseLocationUseCase: CreateWarehouseLocationUseCase,
    private readonly updateWarehouseLocationUseCase: UpdateWarehouseLocationUseCase,
    private readonly deleteWarehouseLocationUseCase: DeleteWarehouseLocationUseCase,
    private readonly listPosTerminalsUseCase: ListPosTerminalsUseCase,
    private readonly createPosTerminalUseCase: CreatePosTerminalUseCase,
    private readonly updatePosTerminalUseCase: UpdatePosTerminalUseCase,
    private readonly deletePosTerminalUseCase: DeletePosTerminalUseCase,
    private readonly listCashRegistersUseCase: ListCashRegistersUseCase,
    private readonly createCashRegisterUseCase: CreateCashRegisterUseCase,
    private readonly updateCashRegisterUseCase: UpdateCashRegisterUseCase,
    private readonly deleteCashRegisterUseCase: DeleteCashRegisterUseCase,
    private readonly listWorkflowsUseCase: ListWorkflowsUseCase,
    private readonly createWorkflowUseCase: CreateWorkflowUseCase,
    private readonly updateWorkflowUseCase: UpdateWorkflowUseCase,
    private readonly deleteWorkflowUseCase: DeleteWorkflowUseCase,
  ) {}

  @Get('facilities')
  @RequirePermissions('organizations:read')
  @ApiOperation({ summary: 'List organization facilities' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiOkDataResponse(Object, true)
  async listFacilities(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    const data = await this.listFacilitiesUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
    });
    return { data };
  }

  @Post('facilities')
  @RequirePermissions('organizations:update')
  @AuditAction('organization.facility.create', 'facility')
  @ApiOperation({ summary: 'Create organization facility' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiJsonBody(CreateFacilityDto)
  @ApiCreatedDataResponse(Object)
  async createFacility(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateFacilityDto,
  ) {
    const data = await this.createFacilityUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      ...dto,
    });
    return { data };
  }

  @Patch('facilities/:facilityId')
  @RequirePermissions('organizations:update')
  @AuditAction('organization.facility.update', 'facility')
  @ApiOperation({ summary: 'Update organization facility' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'facilityId', format: 'uuid' })
  @ApiJsonBody(UpdateFacilityDto)
  @ApiOkDataResponse(Object)
  async updateFacility(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('facilityId', ParseUUIDPipe) facilityId: string,
    @Body() dto: UpdateFacilityDto,
  ) {
    const data = await this.updateFacilityUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      facilityId,
      ...dto,
    });
    return { data };
  }

  @Delete('facilities/:facilityId')
  @RequirePermissions('organizations:update')
  @AuditAction('organization.facility.delete', 'facility')
  @ApiOperation({ summary: 'Delete organization facility' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'facilityId', format: 'uuid' })
  @ApiOkDataResponse(Object)
  async deleteFacility(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('facilityId', ParseUUIDPipe) facilityId: string,
  ) {
    const data = await this.deleteFacilityUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      facilityId,
    });
    return { data };
  }

  @Get('location-types')
  @RequirePermissions('organizations:read')
  @ApiOperation({ summary: 'List location type codes' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiOkDataResponse(Object, true)
  async listLocationTypes(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    const data = await this.listLocationTypesUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
    });
    return { data };
  }

  @Get('warehouses')
  @RequirePermissions('organizations:read')
  @ApiOperation({ summary: 'List organization warehouses' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiOkDataResponse(Object, true)
  async listWarehouses(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    const data = await this.listWarehousesUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
    });
    return { data };
  }

  @Post('warehouses')
  @RequirePermissions('organizations:update')
  @AuditAction('organization.warehouse.create', 'warehouse')
  @ApiOperation({ summary: 'Create organization warehouse' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiJsonBody(CreateWarehouseDto)
  @ApiCreatedDataResponse(Object)
  async createWarehouse(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateWarehouseDto,
  ) {
    const data = await this.createWarehouseUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      ...dto,
    });
    return { data };
  }

  @Patch('warehouses/:warehouseId')
  @RequirePermissions('organizations:update')
  @AuditAction('organization.warehouse.update', 'warehouse')
  @ApiOperation({ summary: 'Update organization warehouse' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'warehouseId', format: 'uuid' })
  @ApiJsonBody(UpdateWarehouseDto)
  @ApiOkDataResponse(Object)
  async updateWarehouse(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    const data = await this.updateWarehouseUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      warehouseId,
      ...dto,
    });
    return { data };
  }

  @Delete('warehouses/:warehouseId')
  @RequirePermissions('organizations:update')
  @AuditAction('organization.warehouse.delete', 'warehouse')
  @ApiOperation({ summary: 'Delete organization warehouse' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'warehouseId', format: 'uuid' })
  @ApiOkDataResponse(Object)
  async deleteWarehouse(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
  ) {
    const data = await this.deleteWarehouseUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      warehouseId,
    });
    return { data };
  }

  @Get('warehouses/:warehouseId/zones')
  @RequirePermissions('organizations:read')
  @ApiOperation({ summary: 'List warehouse zones' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'warehouseId', format: 'uuid' })
  @ApiOkDataResponse(Object, true)
  async listZones(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
  ) {
    const data = await this.listWarehouseZonesUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      warehouseId,
    });
    return { data };
  }

  @Post('warehouses/:warehouseId/zones')
  @RequirePermissions('organizations:update')
  @AuditAction('organization.warehouse_zone.create', 'warehouse_zone')
  @ApiOperation({ summary: 'Create warehouse zone' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'warehouseId', format: 'uuid' })
  @ApiJsonBody(CreateWarehouseZoneDto)
  @ApiCreatedDataResponse(Object)
  async createZone(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Body() dto: CreateWarehouseZoneDto,
  ) {
    const data = await this.createWarehouseZoneUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      warehouseId,
      ...dto,
    });
    return { data };
  }

  @Patch('warehouses/:warehouseId/zones/:zoneId')
  @RequirePermissions('organizations:update')
  @AuditAction('organization.warehouse_zone.update', 'warehouse_zone')
  @ApiOperation({ summary: 'Update warehouse zone' })
  @ApiJsonBody(UpdateWarehouseZoneDto)
  @ApiOkDataResponse(Object)
  async updateZone(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
    @Body() dto: UpdateWarehouseZoneDto,
  ) {
    const data = await this.updateWarehouseZoneUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      warehouseId,
      zoneId,
      ...dto,
    });
    return { data };
  }

  @Delete('warehouses/:warehouseId/zones/:zoneId')
  @RequirePermissions('organizations:update')
  @AuditAction('organization.warehouse_zone.delete', 'warehouse_zone')
  @ApiOperation({ summary: 'Delete warehouse zone' })
  @ApiOkDataResponse(Object)
  async deleteZone(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
  ) {
    const data = await this.deleteWarehouseZoneUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      warehouseId,
      zoneId,
    });
    return { data };
  }

  @Get('warehouses/:warehouseId/locations')
  @RequirePermissions('organizations:read')
  @ApiOperation({ summary: 'List warehouse locations (bins)' })
  @ApiOkDataResponse(Object, true)
  async listLocations(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
  ) {
    const data = await this.listWarehouseLocationsUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      warehouseId,
    });
    return { data };
  }

  @Post('warehouses/:warehouseId/zones/:zoneId/locations')
  @RequirePermissions('organizations:update')
  @AuditAction('organization.warehouse_location.create', 'warehouse_location')
  @ApiOperation({ summary: 'Create warehouse location' })
  @ApiJsonBody(CreateWarehouseLocationDto)
  @ApiCreatedDataResponse(Object)
  async createLocation(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
    @Body() dto: CreateWarehouseLocationDto,
  ) {
    const data = await this.createWarehouseLocationUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      warehouseId,
      zoneId,
      ...dto,
    });
    return { data };
  }

  @Patch('warehouses/:warehouseId/locations/:locationId')
  @RequirePermissions('organizations:update')
  @AuditAction('organization.warehouse_location.update', 'warehouse_location')
  @ApiOperation({ summary: 'Update warehouse location' })
  @ApiJsonBody(UpdateWarehouseLocationDto)
  @ApiOkDataResponse(Object)
  async updateLocation(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body() dto: UpdateWarehouseLocationDto,
  ) {
    const data = await this.updateWarehouseLocationUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      warehouseId,
      locationId,
      ...dto,
    });
    return { data };
  }

  @Delete('warehouses/:warehouseId/locations/:locationId')
  @RequirePermissions('organizations:update')
  @AuditAction('organization.warehouse_location.delete', 'warehouse_location')
  @ApiOperation({ summary: 'Delete warehouse location' })
  @ApiOkDataResponse(Object)
  async deleteLocation(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('warehouseId', ParseUUIDPipe) warehouseId: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
  ) {
    const data = await this.deleteWarehouseLocationUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      warehouseId,
      locationId,
    });
    return { data };
  }

  @Get('pos-terminals')
  @RequirePermissions('organizations:read')
  @ApiOperation({ summary: 'List organization POS terminals' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiOkDataResponse(Object, true)
  async listPosTerminals(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    const data = await this.listPosTerminalsUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
    });
    return { data };
  }

  @Post('pos-terminals')
  @RequirePermissions('organizations:update')
  @AuditAction('organization.pos_terminal.create', 'pos_terminal')
  @ApiOperation({ summary: 'Create organization POS terminal' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiJsonBody(CreatePosTerminalDto)
  @ApiCreatedDataResponse(Object)
  async createPosTerminal(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreatePosTerminalDto,
  ) {
    const data = await this.createPosTerminalUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      ...dto,
    });
    return { data };
  }

  @Patch('pos-terminals/:terminalId')
  @RequirePermissions('organizations:update')
  @AuditAction('organization.pos_terminal.update', 'pos_terminal')
  @ApiOperation({ summary: 'Update organization POS terminal' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'terminalId', format: 'uuid' })
  @ApiJsonBody(UpdatePosTerminalDto)
  @ApiOkDataResponse(Object)
  async updatePosTerminal(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('terminalId', ParseUUIDPipe) terminalId: string,
    @Body() dto: UpdatePosTerminalDto,
  ) {
    const data = await this.updatePosTerminalUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      terminalId,
      ...dto,
    });
    return { data };
  }

  @Delete('pos-terminals/:terminalId')
  @RequirePermissions('organizations:update')
  @AuditAction('organization.pos_terminal.delete', 'pos_terminal')
  @ApiOperation({ summary: 'Delete organization POS terminal' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'terminalId', format: 'uuid' })
  @ApiOkDataResponse(Object)
  async deletePosTerminal(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('terminalId', ParseUUIDPipe) terminalId: string,
  ) {
    const data = await this.deletePosTerminalUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      terminalId,
    });
    return { data };
  }

  @Get('cash-registers')
  @RequirePermissions('organizations:read')
  @ApiOperation({ summary: 'List organization cash registers' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiOkDataResponse(Object, true)
  async listCashRegisters(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    const data = await this.listCashRegistersUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
    });
    return { data };
  }

  @Post('cash-registers')
  @RequirePermissions('organizations:update')
  @AuditAction('organization.cash_register.create', 'cash_register')
  @ApiOperation({ summary: 'Create organization cash register' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiJsonBody(CreateCashRegisterDto)
  @ApiCreatedDataResponse(Object)
  async createCashRegister(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateCashRegisterDto,
  ) {
    const data = await this.createCashRegisterUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      ...dto,
    });
    return { data };
  }

  @Patch('cash-registers/:registerId')
  @RequirePermissions('organizations:update')
  @AuditAction('organization.cash_register.update', 'cash_register')
  @ApiOperation({ summary: 'Update organization cash register' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'registerId', format: 'uuid' })
  @ApiJsonBody(UpdateCashRegisterDto)
  @ApiOkDataResponse(Object)
  async updateCashRegister(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('registerId', ParseUUIDPipe) registerId: string,
    @Body() dto: UpdateCashRegisterDto,
  ) {
    const data = await this.updateCashRegisterUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      registerId,
      ...dto,
    });
    return { data };
  }

  @Delete('cash-registers/:registerId')
  @RequirePermissions('organizations:update')
  @AuditAction('organization.cash_register.delete', 'cash_register')
  @ApiOperation({ summary: 'Delete organization cash register' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'registerId', format: 'uuid' })
  @ApiOkDataResponse(Object)
  async deleteCashRegister(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('registerId', ParseUUIDPipe) registerId: string,
  ) {
    const data = await this.deleteCashRegisterUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      registerId,
    });
    return { data };
  }

  @Get('workflows')
  @RequirePermissions('organizations:read')
  @ApiOperation({ summary: 'List organization workflows' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiOkDataResponse(Object, true)
  async listWorkflows(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    const data = await this.listWorkflowsUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
    });
    return { data };
  }

  @Post('workflows')
  @RequirePermissions('organizations:update')
  @AuditAction('organization.workflow.create', 'workflow')
  @ApiOperation({ summary: 'Create organization workflow with steps' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiJsonBody(CreateWorkflowDto)
  @ApiCreatedDataResponse(Object)
  async createWorkflow(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateWorkflowDto,
  ) {
    const data = await this.createWorkflowUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      ...dto,
    });
    return { data };
  }

  @Patch('workflows/:workflowId')
  @RequirePermissions('organizations:update')
  @AuditAction('organization.workflow.update', 'workflow')
  @ApiOperation({ summary: 'Update organization workflow (replace steps when provided)' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'workflowId', format: 'uuid' })
  @ApiJsonBody(UpdateWorkflowDto)
  @ApiOkDataResponse(Object)
  async updateWorkflow(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    const data = await this.updateWorkflowUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      workflowId,
      ...dto,
    });
    return { data };
  }

  @Delete('workflows/:workflowId')
  @RequirePermissions('organizations:update')
  @AuditAction('organization.workflow.delete', 'workflow')
  @ApiOperation({ summary: 'Delete organization workflow' })
  @ApiParam({ name: 'organizationId', format: 'uuid' })
  @ApiParam({ name: 'workflowId', format: 'uuid' })
  @ApiOkDataResponse(Object)
  async deleteWorkflow(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
  ) {
    const data = await this.deleteWorkflowUseCase.execute({
      ctx: toExecutionContext(this.tenantContext.getOrThrow()),
      organizationId,
      workflowId,
    });
    return { data };
  }
}
