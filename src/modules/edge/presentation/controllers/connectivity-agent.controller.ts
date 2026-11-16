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
  CreateConnectivityAgentUseCase,
  ListConnectivityAgentsUseCase,
  RequestConnectivityAgentCommandUseCase,
  RequestConnectivityAgentRegisterUseCase,
  RequestConnectivityAgentRevokeUseCase,
} from '../../application/connectivity-agent/connectivity-agent.use-cases.js';
import {
  ConnectivityAgentPaginationQueryDto,
  CreateConnectivityAgentDto,
  RequestConnectivityAgentCommandDto,
  RequestConnectivityAgentRegisterDto,
  RequestConnectivityAgentRevokeDto,
} from '../dto/connectivity-agent.dto.js';

type EdgeRequest = { user?: { sub?: string; id?: string } };

function actorId(req: EdgeRequest): string {
  return req.user?.sub ?? req.user?.id ?? 'unknown';
}

/**
 * P7.14 — Connectivity Agent & Edge Agent Registry API.
 * Mutative register/command/revoke ONLY through P7.4 workflows.
 * outbound_only=true always; nonce anti-replay; vault public_key_ref only.
 * Revoke clears active commands → REVOKED (fail-closed). P7.1 when auth bound.
 */
@ApiTags('edge-p7-connectivity-agent')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller()
export class EdgeConnectivityAgentController {
  constructor(
    private readonly lists: ListConnectivityAgentsUseCase,
    private readonly createAgent: CreateConnectivityAgentUseCase,
    private readonly requestRegister: RequestConnectivityAgentRegisterUseCase,
    private readonly requestCommand: RequestConnectivityAgentCommandUseCase,
    private readonly requestRevoke: RequestConnectivityAgentRevokeUseCase,
  ) {}

  @Get('edge/agents')
  @RequireEdgePermissions('platform:agents:read')
  @ApiOperation({ summary: 'List connectivity agents' })
  async listAgents(@Query() query: ConnectivityAgentPaginationQueryDto) {
    return this.lists.agents({
      status: query.status,
      tenantId: query.tenantId,
      productId: query.productId,
      q: query.q,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get('edge/agent-history')
  @RequireEdgePermissions('platform:agents:history:read')
  @ApiOperation({ summary: 'List agent history events' })
  async listHistory(@Query() query: ConnectivityAgentPaginationQueryDto) {
    return this.lists.history({
      resourceId: query.agentId,
      limit: query.limit,
    });
  }

  @Get('edge/agents/:id')
  @RequireEdgePermissions('platform:agents:read')
  @ApiOperation({ summary: 'Get connectivity agent detail (+ recent commands)' })
  async getAgent(@Param('id') id: string) {
    const agent = await this.lists.agent(id);
    if (!agent) return null;
    const [commands, evidence, spool] = await Promise.all([
      this.lists.commands({ agentId: id, limit: 50 }),
      this.lists.evidence({ agentId: id, limit: 50 }),
      this.lists.spool({ agentId: id, limit: 50 }),
    ]);
    return { agent, commands: commands.items, evidence, spool };
  }

  @Post('edge/agents')
  @RequireEdgePermissions('platform:agents:manage')
  @ApiOperation({
    summary: 'Create pending agent (outbound_only=true; vault public_key_ref)',
  })
  async createAgentEndpoint(
    @Body() body: CreateConnectivityAgentDto,
    @Req() req: EdgeRequest,
  ) {
    return this.createAgent.execute({
      actorId: actorId(req),
      agentCode: body.agentCode,
      displayName: body.displayName,
      publicKeyRef: body.publicKeyRef,
      tenantId: body.tenantId,
      productId: body.productId,
      deploymentProfileCode: body.deploymentProfileCode,
      certificateRef: body.certificateRef,
      outboundOnly: body.outboundOnly,
      provisioningRequestId: body.provisioningRequestId,
      authorizationRowId: body.authorizationRowId,
      authorizationVersion: body.authorizationVersion,
      metadata: body.metadata,
    });
  }

  @Post('edge/agents/:id/register')
  @RequireEdgePermissions('platform:agents:manage')
  @ApiOperation({ summary: 'Launch p714.agent.register' })
  async registerEndpoint(
    @Param('id') id: string,
    @Body() body: RequestConnectivityAgentRegisterDto,
    @Req() req: EdgeRequest,
  ) {
    return this.requestRegister.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `p714-register-${id}-${Date.now()}`,
      agentId: id,
      provisioningRequestId: body.provisioningRequestId ?? null,
      reason: body.reason ?? null,
    });
  }

  @Post('edge/agents/:id/command')
  @RequireEdgePermissions('platform:agents:command')
  @ApiOperation({
    summary: 'Launch p714.agent.command — unique nonce required (anti-replay)',
  })
  async commandEndpoint(
    @Param('id') id: string,
    @Body() body: RequestConnectivityAgentCommandDto,
    @Req() req: EdgeRequest,
  ) {
    return this.requestCommand.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `p714-command-${id}-${Date.now()}`,
      agentId: id,
      commandType: body.commandType,
      nonce: body.nonce,
      payloadRef: body.payloadRef ?? null,
      signatureRef: body.signatureRef ?? null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      provisioningRequestId: body.provisioningRequestId ?? null,
      authorizationRowId: body.authorizationRowId ?? null,
      authorizationVersion: body.authorizationVersion ?? null,
      reason: body.reason ?? null,
      metadata: body.metadata,
    });
  }

  @Post('edge/agents/:id/revoke')
  @RequireEdgePermissions('platform:agents:revoke')
  @ApiOperation({
    summary:
      'Launch p714.agent.revoke — clears active commands to REVOKED (fail-closed)',
  })
  async revokeEndpoint(
    @Param('id') id: string,
    @Body() body: RequestConnectivityAgentRevokeDto,
    @Req() req: EdgeRequest,
  ) {
    return this.requestRevoke.execute({
      actorId: actorId(req),
      correlationId: body.correlationId?.trim() || randomUUID(),
      idempotencyKey: body.idempotencyKey ?? `p714-revoke-${id}-${Date.now()}`,
      agentId: id,
      provisioningRequestId: body.provisioningRequestId ?? null,
      reason: body.reason ?? null,
    });
  }

  @Get('edge/agents/:id/commands')
  @RequireEdgePermissions('platform:agents:read')
  @ApiOperation({ summary: 'List commands for an agent' })
  async listCommands(
    @Param('id') id: string,
    @Query() query: ConnectivityAgentPaginationQueryDto,
  ) {
    return this.lists.commands({
      agentId: id,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get('edge/agents/:id/evidence')
  @RequireEdgePermissions('platform:agents:history:read')
  @ApiOperation({ summary: 'List agent evidence' })
  async listEvidence(
    @Param('id') id: string,
    @Query() query: ConnectivityAgentPaginationQueryDto,
  ) {
    return this.lists.evidence({ agentId: id, limit: query.limit });
  }
}
