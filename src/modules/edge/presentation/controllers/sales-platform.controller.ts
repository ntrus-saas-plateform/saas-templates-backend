import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  EdgeRoute,
  RequireEdgePermissions,
} from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import { EdgeOptionalWorkspaceGuard } from '../../../../shared/auth/edge-optional-workspace.guard.js';
import { EdgeContextService } from '../../../../shared/auth/edge-context.service.js';
import {
  AddAccountRelationshipUseCase,
  AddContactRoleUseCase,
  AssertSalesSubjectAccessUseCase,
  CreateContractAmendmentUseCase,
  CreateSalesSavedViewUseCase,
  DeleteSalesSavedViewUseCase,
  ExecuteContractAmendmentUseCase,
  ExportSalesEntitiesUseCase,
  GenerateProposalDocumentUseCase,
  GetAccountHierarchyUseCase,
  GlobalSalesSearchUseCase,
  GrantSalesVisibilityUseCase,
  ListContactRolesUseCase,
  ListContractAmendmentsUseCase,
  ListDiscoveryQuestionnairesUseCase,
  ListSalesExportJobsUseCase,
  ListSalesForecastSnapshotsUseCase,
  ListSalesOrderLinesUseCase,
  ListSalesSavedViewsUseCase,
  ListSalesVisibilityGrantsUseCase,
  PersistSalesForecastSnapshotUseCase,
  ResolveSalesIdempotencyUseCase,
  SetSalesOrderLinesUseCase,
  SyncSalesActivityCalendarUseCase,
  UpsertDiscoveryQuestionnaireUseCase,
  ValidateSolutionFitUseCase,
} from '../../application/sales/sales-platform.use-cases.js';

@ApiTags('edge-sales-platform')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller('edge/sales')
export class EdgeSalesPlatformController {
  constructor(
    private readonly edgeContext: EdgeContextService,
    private readonly addRelationship: AddAccountRelationshipUseCase,
    private readonly hierarchy: GetAccountHierarchyUseCase,
    private readonly addContactRole: AddContactRoleUseCase,
    private readonly listContactRoles: ListContactRolesUseCase,
    private readonly upsertQuestionnaire: UpsertDiscoveryQuestionnaireUseCase,
    private readonly listQuestionnaires: ListDiscoveryQuestionnairesUseCase,
    private readonly createAmendment: CreateContractAmendmentUseCase,
    private readonly listAmendments: ListContractAmendmentsUseCase,
    private readonly executeAmendment: ExecuteContractAmendmentUseCase,
    private readonly setOrderLines: SetSalesOrderLinesUseCase,
    private readonly listOrderLines: ListSalesOrderLinesUseCase,
    private readonly persistForecast: PersistSalesForecastSnapshotUseCase,
    private readonly listForecastSnapshots: ListSalesForecastSnapshotsUseCase,
    private readonly search: GlobalSalesSearchUseCase,
    private readonly createView: CreateSalesSavedViewUseCase,
    private readonly listViews: ListSalesSavedViewsUseCase,
    private readonly deleteView: DeleteSalesSavedViewUseCase,
    private readonly exportEntities: ExportSalesEntitiesUseCase,
    private readonly listExports: ListSalesExportJobsUseCase,
    private readonly grantVisibility: GrantSalesVisibilityUseCase,
    private readonly listVisibility: ListSalesVisibilityGrantsUseCase,
    private readonly assertAccess: AssertSalesSubjectAccessUseCase,
    private readonly generateDoc: GenerateProposalDocumentUseCase,
    private readonly syncCalendar: SyncSalesActivityCalendarUseCase,
    private readonly validateFit: ValidateSolutionFitUseCase,
    private readonly idempotency: ResolveSalesIdempotencyUseCase,
  ) {}

  private actorId(): string {
    return this.edgeContext.getOrThrow().administratorId!;
  }

  @Get('search')
  @RequireEdgePermissions('platform:sales:accounts:read')
  getSearch(
    @Query('q') q: string,
    @Query('visibilityMode') visibilityMode?: 'OWNED' | 'TEAM' | 'ALL',
    @Query('limit') limit?: string,
  ) {
    return this.search.execute({
      q: q ?? '',
      actorId: this.actorId(),
      visibilityMode,
      limit: limit ? Number(limit) : 40,
    });
  }

  @Get('accounts/:id/hierarchy')
  @RequireEdgePermissions('platform:sales:accounts:read')
  getHierarchy(@Param('id', ParseUUIDPipe) id: string) {
    return this.hierarchy.execute(id);
  }

  @Post('accounts/:id/relationships')
  @RequireEdgePermissions('platform:sales:accounts:update')
  postRelationship(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body()
    body: {
      toAccountId: string;
      relationshipType: string;
      notes?: string | null;
    },
  ) {
    return this.idempotency.execute({
      idempotencyKey,
      routeKey: `accounts/${id}/relationships`,
      actorId: this.actorId(),
      run: async () =>
        (await this.addRelationship.execute({
          actorId: this.actorId(),
          fromAccountId: id,
          ...body,
        })) as unknown as Record<string, unknown>,
    });
  }

  @Get('contacts/:id/roles')
  @RequireEdgePermissions('platform:sales:contacts:read')
  getContactRoles(@Param('id', ParseUUIDPipe) id: string) {
    return this.listContactRoles.execute(id);
  }

  @Post('contacts/:id/roles')
  @RequireEdgePermissions('platform:sales:contacts:manage')
  postContactRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      accountId: string;
      roleType: string;
      isPrimary?: boolean;
      effectiveUntil?: string | null;
    },
  ) {
    return this.addContactRole.execute({ contactId: id, ...body });
  }

  @Get('questionnaires')
  @RequireEdgePermissions('platform:sales:assessments:manage')
  getQuestionnaires(
    @Query('verticalId') verticalId?: string,
    @Query('productId') productId?: string,
  ) {
    return this.listQuestionnaires.execute({ verticalId, productId });
  }

  @Post('questionnaires')
  @RequireEdgePermissions('platform:sales:assessments:manage')
  postQuestionnaire(
    @Body()
    body: {
      code: string;
      name: string;
      verticalId?: string | null;
      productId?: string | null;
      questions: unknown[];
      status?: string;
    },
  ) {
    return this.upsertQuestionnaire.execute(body);
  }

  @Post('assessments/:id/solution-fit')
  @RequireEdgePermissions('platform:sales:assessments:manage')
  postSolutionFit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { commerciallyAuthorizedCapabilities?: string[] },
  ) {
    return this.validateFit.execute({
      actorId: this.actorId(),
      assessmentId: id,
      commerciallyAuthorizedCapabilities:
        body.commerciallyAuthorizedCapabilities ?? [],
    });
  }

  @Get('contracts/:id/amendments')
  @RequireEdgePermissions('platform:sales:contracts:read')
  getAmendments(@Param('id', ParseUUIDPipe) id: string) {
    return this.listAmendments.execute(id);
  }

  @Post('contracts/:id/amendments')
  @RequireEdgePermissions('platform:sales:contracts:manage')
  postAmendment(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: { summary: string; changes?: Record<string, unknown> },
  ) {
    return this.idempotency.execute({
      idempotencyKey,
      routeKey: `contracts/${id}/amendments`,
      actorId: this.actorId(),
      run: async () =>
        (await this.createAmendment.execute({
          actorId: this.actorId(),
          contractId: id,
          ...body,
        })) as unknown as Record<string, unknown>,
    });
  }

  @Post('amendments/:id/execute')
  @RequireEdgePermissions('platform:sales:contracts:approve')
  postExecuteAmendment(@Param('id', ParseUUIDPipe) id: string) {
    return this.executeAmendment.execute(id);
  }

  @Get('orders/:id/lines')
  @RequireEdgePermissions('platform:sales:orders:manage')
  getOrderLines(@Param('id', ParseUUIDPipe) id: string) {
    return this.listOrderLines.execute(id);
  }

  @Post('orders/:id/lines')
  @RequireEdgePermissions('platform:sales:orders:manage')
  postOrderLines(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      lines: Array<{
        lineNumber: number;
        description: string;
        quantity: number;
        unitPrice: number;
        productId?: string | null;
        planId?: string | null;
        packageId?: string | null;
        addonId?: string | null;
        p2Refs?: Record<string, unknown>;
      }>;
    },
  ) {
    return this.setOrderLines.execute({ orderId: id, lines: body.lines });
  }

  @Get('views')
  @RequireEdgePermissions('platform:sales:accounts:read')
  getViews(@Query('entityType') entityType?: string) {
    return this.listViews.execute({
      actorId: this.actorId(),
      entityType,
    });
  }

  @Post('views')
  @RequireEdgePermissions('platform:sales:accounts:read')
  postView(
    @Body()
    body: {
      name: string;
      scope: string;
      entityType: string;
      teamId?: string | null;
      filters?: Record<string, unknown>;
      columns?: unknown[];
      sortSpec?: unknown[];
      isDefault?: boolean;
    },
  ) {
    return this.createView.execute({ actorId: this.actorId(), ...body });
  }

  @Delete('views/:id')
  @RequireEdgePermissions('platform:sales:accounts:read')
  deleteViewRoute(@Param('id', ParseUUIDPipe) id: string) {
    return this.deleteView.execute(id, this.actorId());
  }

  @Post('exports')
  @RequireEdgePermissions('platform:sales:analytics:read')
  postExport(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body()
    body: {
      entityType: string;
      format?: 'JSON' | 'CSV';
      filters?: Record<string, unknown>;
    },
  ) {
    const permissions = this.edgeContext.getOrThrow().permissions ?? [];
    const hasExportPermission = permissions.some(
      (p) =>
        p === 'platform:sales:analytics:read' ||
        p === 'platform:sales:accounts:read' ||
        p.startsWith('platform:sales:'),
    );
    return this.idempotency.execute({
      idempotencyKey,
      routeKey: `exports/${body.entityType}`,
      actorId: this.actorId(),
      run: async () =>
        (await this.exportEntities.execute({
          actorId: this.actorId(),
          entityType: body.entityType,
          format: body.format,
          filters: body.filters,
          hasExportPermission,
        })) as unknown as Record<string, unknown>,
    });
  }

  @Get('exports')
  @RequireEdgePermissions('platform:sales:analytics:read')
  getExports() {
    return this.listExports.execute(this.actorId());
  }

  @Post('visibility/grants')
  @RequireEdgePermissions('platform:sales:governance:manage')
  postVisibilityGrant(
    @Body()
    body: {
      subjectType: string;
      subjectId: string;
      granteeAdministratorId?: string | null;
      granteeTeamId?: string | null;
      accessLevel?: string;
    },
  ) {
    return this.grantVisibility.execute({ actorId: this.actorId(), ...body });
  }

  @Get('visibility/grants')
  @RequireEdgePermissions('platform:sales:governance:manage')
  getVisibilityGrants(
    @Query('subjectType') subjectType: string,
    @Query('subjectId') subjectId: string,
  ) {
    return this.listVisibility.execute(subjectType, subjectId);
  }

  @Post('visibility/assert')
  @RequireEdgePermissions('platform:sales:accounts:read')
  postAssertVisibility(
    @Body()
    body: {
      subjectType: string;
      subjectId: string;
      ownerAdministratorId?: string | null;
      teamIds?: string[];
      isElevated?: boolean;
    },
  ) {
    return this.assertAccess.execute({
      actorId: this.actorId(),
      ...body,
    });
  }

  @Post('proposals/:id/document')
  @RequireEdgePermissions('platform:sales:proposals:manage')
  postProposalDocument(@Param('id', ParseUUIDPipe) id: string) {
    return this.generateDoc.execute({
      actorId: this.actorId(),
      proposalId: id,
    });
  }

  @Post('activities/:id/calendar-sync')
  @RequireEdgePermissions('platform:sales:activities:manage')
  postCalendarSync(@Param('id', ParseUUIDPipe) id: string) {
    return this.syncCalendar.execute({ activityId: id });
  }

  @Post('forecast/snapshots')
  @RequireEdgePermissions('platform:sales:forecast:read')
  postForecastSnapshot(
    @Body()
    body: {
      periodType: string;
      periodKey: string;
      model?: 'PIPELINE' | 'WEIGHTED' | 'BEST_CASE' | 'COMMIT' | 'MOST_LIKELY';
      scopeType?: string;
      scopeId?: string | null;
    },
  ) {
    return this.persistForecast.execute({
      actorId: this.actorId(),
      ...body,
    });
  }

  @Get('forecast/snapshots')
  @RequireEdgePermissions('platform:sales:forecast:read')
  getForecastSnapshots(
    @Query('periodType') periodType?: string,
    @Query('periodKey') periodKey?: string,
    @Query('model') model?: string,
  ) {
    return this.listForecastSnapshots.execute({ periodType, periodKey, model });
  }
}
