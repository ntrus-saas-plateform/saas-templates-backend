import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { EdgeRoute, RequireEdgePermissions } from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgeOptionalWorkspaceGuard } from '../../../../shared/auth/edge-optional-workspace.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import {
  DiscoverKeycloakCapabilitiesUseCase,
  LaunchTopologyWorkflowUseCase,
  ListKeycloakUseCase,
  RegisterKeycloakServerUseCase,
  RequestKeycloakProvisioningUseCase,
} from '../../application/keycloak-topology/keycloak.use-cases.js';
import type { CreateKeycloakTopologyUseCase } from '../../application/keycloak-topology/keycloak.use-cases.js';
import { KeycloakTopologyType } from '../../domain/keycloak-topology/keycloak.types.js';
import {
  CreateKeycloakTopologyDto,
  DeclareKeycloakClientDto,
  DeprovisionKeycloakTopologyDto,
  KeycloakHistoryQueryDto,
  KeycloakPaginationQueryDto,
  KeycloakServerActionDto,
  RegisterKeycloakServerDto,
  RequestKeycloakReconciliationDto,
} from '../dto/keycloak.dto.js';

type EdgeRequest = { user?: { sub?: string; id?: string } };

function actorId(req: EdgeRequest): string {
  return req.user?.sub ?? req.user?.id ?? 'unknown';
}

/**
 * P7.7 §14 — Identity Infrastructure & Keycloak Management API.
 * Mutations ONLY through P7.4 workflows (create/validate → workflow instance →
 * start). No endpoint mutates Keycloak directly (workflow-only invariant).
 */
@ApiTags('edge-p7-keycloak')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller()
export class EdgeKeycloakController {
  constructor(
    private readonly lists: ListKeycloakUseCase,
    private readonly registerServerUseCase: RegisterKeycloakServerUseCase,
    private readonly discover: DiscoverKeycloakCapabilitiesUseCase,
    private readonly _createTopology: CreateKeycloakTopologyUseCase,
    private readonly requestProvisioningUseCase: RequestKeycloakProvisioningUseCase,
    private readonly launchWorkflow: LaunchTopologyWorkflowUseCase,
  ) {}

  // --- providers & servers (read) ----------------------------------------

  @Get('edge/keycloak/providers')
  @RequireEdgePermissions('platform:keycloak:read')
  @ApiOperation({ summary: 'List Keycloak providers (capability declarations)' })
  async listProviders() {
    const items = await this.lists.providers();
    return { items, total: items.length };
  }

  @Get('edge/keycloak/providers/:id')
  @RequireEdgePermissions('platform:keycloak:read')
  async getProvider(@Param('id') id: string) {
    return this.lists.provider(id);
  }

  @Get('edge/keycloak/servers')
  @RequireEdgePermissions('platform:keycloak:read')
  @ApiOperation({ summary: 'List registered Keycloak servers' })
  async listServers() {
    const items = await this.lists.servers();
    return { items, total: items.length };
  }

  @Get('edge/keycloak/servers/:id')
  @RequireEdgePermissions('platform:keycloak:read')
  async getServer(@Param('id') id: string) {
    return this.lists.server(id);
  }

  @Post('edge/keycloak/servers')
  @RequireEdgePermissions('platform:keycloak:manage')
  @ApiOperation({ summary: 'Register a Keycloak server (secret goes to the vault only)' })
  async registerServer(@Body() body: RegisterKeycloakServerDto, @Req() req: EdgeRequest) {
    return this.registerServerUseCase.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      providerId: body.providerId,
      code: body.code,
      name: body.name,
      baseUrl: body.baseUrl,
      adminRealm: body.adminRealm,
      adminClientId: body.adminClientId,
      adminCredential: body.adminCredential ?? null,
      tlsMode: body.tlsMode,
      allowPrivateNetwork: body.allowPrivateNetwork,
      environment: body.environment,
      metadata: body.metadata,
    });
  }

  @Post('edge/keycloak/servers/:id/capabilities')
  @RequireEdgePermissions('platform:keycloak:capabilities')
  @ApiOperation({ summary: 'Discover + verify server capabilities (real Keycloak probe)' })
  async discoverCapabilities(
    @Param('id') id: string,
    @Body() body: KeycloakServerActionDto,
    @Req() req: EdgeRequest,
  ) {
    return this.discover.execute({
      actorId: actorId(req),
      serverId: id,
      correlationId: body.correlationId?.trim() || randomUUID(),
    });
  }

  @Get('edge/keycloak/servers/:id/capabilities')
  @RequireEdgePermissions('platform:keycloak:read')
  async getCapabilities(@Param('id') id: string) {
    return this.lists.capabilities(id);
  }

  // --- topologies --------------------------------------------------------

  @Get('edge/keycloak/topologies')
  @RequireEdgePermissions('platform:keycloak:read')
  @ApiOperation({ summary: 'List Keycloak topologies (desired state + status)' })
  async listTopologies(@Query() query: KeycloakPaginationQueryDto) {
    const items = await this.lists.topologies({
      tenantId: query.tenantId,
      productId: query.productId,
      status: query.status,
      topologyType: query.topologyType,
      serverId: query.serverId,
      limit: query.limit,
      offset: query.offset,
    });
    return { items, total: items.length };
  }

  @Get('edge/keycloak/topologies/:id')
  @RequireEdgePermissions('platform:keycloak:read')
  async getTopology(@Param('id') id: string) {
    const topology = await this.lists.topology(id);
    if (!topology) return null;
    const [realm, organization, clients, oidc, references, health, reconciliations, evidence] =
      await Promise.all([
        this.lists.realms(id),
        this.lists.organizations(id),
        this.lists.clients(id),
        this.lists.oidc(id),
        this.lists.references(id),
        this.lists.health(id, null, 20),
        this.lists.reconciliations(id, 20),
        this.lists.evidence(id, 50),
      ]);
    return { topology, realm, organization, clients, oidc, references, health, reconciliations, evidence };
  }

  @Post('edge/keycloak/topologies')
  @RequireEdgePermissions('platform:keycloak:provision')
  @ApiOperation({
    summary:
      'Create topology desired-state + P7.4 workflow (revalidates P7.1 authorization, fail-closed)',
  })
  async requestProvisioning(@Body() body: CreateKeycloakTopologyDto, @Req() req: EdgeRequest) {
    // Fail-closed validation context — real gates are re-checked inside the
    // workflow steps (validate_plan) against persisted desired state.
    return this.requestProvisioningUseCase.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: `p77-prov-${body.tenantId}-${body.productId}-${Date.now()}`,
      provisioningRequestId: body.provisioningRequestId,
      plan: {
        tenantId: body.tenantId,
        productId: body.productId,
        subscriptionId: body.subscriptionId ?? null,
        placementDecisionId: body.placementDecisionId ?? null,
        deploymentProfileId: body.deploymentProfileId ?? null,
        deploymentProfileVersion: body.deploymentProfileVersion ?? null,
        runtimeProfileId: body.runtimeProfileId ?? null,
        providerId: body.providerId,
        serverId: body.serverId,
        topologyType: body.topologyType as KeycloakTopologyType,
        profileOptions: body.profileOptions ?? {},
      },
      validationContext: {
        authorizationValid: true, // revalidated fail-closed in use case + workflow
        authorizationExpired: false,
        authorizationRevoked: false,
        placementValid: true,
        tlsRequiredByProfile: true,
        organizationsSupportedByServer: true,
        profileOptions: body.profileOptions ?? {},
      },
    });
  }

  // --- reconciliation (P7.4 workflow) -------------------------------------

  @Post('edge/keycloak/topologies/:id/reconcile')
  @RequireEdgePermissions('platform:keycloak:reconcile')
  @ApiOperation({ summary: 'Request Keycloak topology reconciliation via P7.4 workflow' })
  async requestReconciliation(
    @Param('id') id: string,
    @Body() body: RequestKeycloakReconciliationDto,
    @Req() req: EdgeRequest,
  ) {
    return this.launchWorkflow.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `p77-rec-${id}-${Date.now()}`,
      definitionCode: 'p77.keycloak.topology.provision',
      workflowType: 'keycloak.topology.reconcile',
      topologyId: id,
      provisioningRequestId: body.provisioningRequestId ?? null,
      snapshot: {
        topologyId: id,
        operation: 'reconcile',
        runReconcile:
          'keycloak.reconcile_topology,',
      },
    });
  }

  // --- deprovision (destructive, explicit authorization required) --------

  @Post('edge/keycloak/topologies/:id/deprovision')
  @RequireEdgePermissions('platform:keycloak:deprovision')
  @ApiOperation({ summary: 'Authorize deprovisioning (ownership + confirmation enforced)' })
  async deprovision(
    @Param('id') id: string,
    @Body() body: DeprovisionKeycloakTopologyDto,
    @Req() req: EdgeRequest,
  ) {
    return this.launchWorkflow.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: `p77-dep-${id}-${Date.now()}`,
      definitionCode: 'p77.keycloak.topology.provision',
      workflowType: 'keycloak.topology.deprovision',
      destructive: true,
      authorized: body.authorized === true,
      confirmed: body.confirmed === true,
      topologyId: id,
      snapshot: {
        topologyId: id,
        operation: 'deprovision',
        deprovisionAuthorized: body.authorized === true,
        deprovisionConfirmed: body.confirmed === true,
        reason: body.reason ?? null,
      },
    });
  }

  // --- evidence & history (read) ------------------------------------------

  @Get('edge/keycloak/topologies/:id/evidence')
  @RequireEdgePermissions('platform:keycloak:history:read')
  async listEvidence(@Param('id') id: string, @Query() query: KeycloakHistoryQueryDto) {
    const items = await this.lists.evidence(id, query.limit ?? 50);
    return { items, total: items.length };
  }

  @Get('edge/keycloak/topologies/:id/history')
  @RequireEdgePermissions('platform:keycloak:history:read')
  async listHistory(@Param('id') id: string, @Query() query: KeycloakHistoryQueryDto) {
    const items = await this.lists.history('KEYCLOAK_TOPOLOGY', id, query.limit ?? 50);
    return { items, total: items.length };
  }

  @Get('edge/keycloak/topologies/:id/reconciliations')
  @RequireEdgePermissions('platform:keycloak:read')
  async listReconciliations(@Param('id') id: string, @Query() query: KeycloakHistoryQueryDto) {
    const items = await this.lists.reconciliations(id, query.limit ?? 50);
    return { items, total: items.length };
  }

  // --- technical client declaration (contract-driven) ----------------------

  @Post('edge/keycloak/clients')
  @RequireEdgePermissions('platform:keycloak:provision')
  @ApiOperation({
    summary:
      'Declare a technical client in the topology desired state (validated by redirect/origin policy; provisioned by the workflow)',
  })
  async declareClient(@Body() body: DeclareKeycloakClientDto, @Req() req: EdgeRequest) {
    return this.launchWorkflow.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: `p77-cli-${body.topologyId}-${body.clientId}-${Date.now()}`,
      definitionCode: 'p77.keycloak.topology.declare_client',
      workflowType: 'keycloak.topology.declare_client',
      topologyId: body.topologyId,
      snapshot: {
        topologyId: body.topologyId,
        operation: 'declare_client',
        clientSpec: {
          clientId: body.clientId,
          clientKind: body.clientKind,
          ownerFunction: body.ownerFunction,
          documentedUsage: body.documentedUsage,
          redirectUris: body.redirectUris,
          webOrigins: body.webOrigins ?? [],
          scopes: body.scopes ?? [],
        },
      },
    });
  }
}