import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { EdgeRoute, RequireEdgePermissions } from '../../../../shared/auth/decorators.js';
import { EdgeAuthGuard } from '../../../../shared/auth/edge-auth.guard.js';
import { EdgeOptionalWorkspaceGuard } from '../../../../shared/auth/edge-optional-workspace.guard.js';
import { EdgePermissionGuard } from '../../../../shared/auth/edge-permission.guard.js';
import {
  DiscoverProductControlCapabilitiesUseCase,
  DiscoverProductControlContractUseCase,
  HandshakeProductControlEndpointUseCase,
  HealthCheckProductControlEndpointUseCase,
  ListProductControlResourcesUseCase,
  QuarantineProductControlEndpointUseCase,
  ReceiveProductControlCallbackUseCase,
  ReconcileProductControlExchangeUseCase,
  RegisterProductControlEndpointUseCase,
  ValidateProductControlEndpointUseCase,
} from '../../application/product-control/product-control.use-cases.js';
import {
  ProductControlEndpointStatus,
  type ControlExchangeStatus,
} from '../../domain/product-control/product-control.types.js';
import {
  ProductControlActionDto,
  ProductControlPaginationQueryDto,
  QuarantineProductControlEndpointDto,
  ReceiveProductControlCallbackDto,
  ReconcileProductControlExchangeDto,
  RegisterProductControlEndpointDto,
} from '../dto/product-control.dto.js';

type EdgeRequest = { user?: { sub?: string; id?: string } };

function actorId(req: EdgeRequest): string {
  return req.user?.sub ?? req.user?.id ?? 'unknown';
}

function correlationOf(body?: { correlationId?: string }): string {
  return body?.correlationId?.trim() || randomUUID();
}

@ApiTags('edge-p7-product-control')
@ApiBearerAuth()
@EdgeRoute()
@UseGuards(EdgeAuthGuard, EdgeOptionalWorkspaceGuard, EdgePermissionGuard)
@Controller('edge/product-controls')
export class EdgeProductControlController {
  constructor(
    private readonly lists: ListProductControlResourcesUseCase,
    private readonly registerEndpoint: RegisterProductControlEndpointUseCase,
    private readonly validateEndpoint: ValidateProductControlEndpointUseCase,
    private readonly handshake: HandshakeProductControlEndpointUseCase,
    private readonly discoverContract: DiscoverProductControlContractUseCase,
    private readonly discoverCapabilities: DiscoverProductControlCapabilitiesUseCase,
    private readonly healthCheck: HealthCheckProductControlEndpointUseCase,
    private readonly quarantine: QuarantineProductControlEndpointUseCase,
    private readonly reconcile: ReconcileProductControlExchangeUseCase,
    private readonly receiveCallback: ReceiveProductControlCallbackUseCase,
  ) {}

  @Get('endpoints')
  @RequireEdgePermissions('platform:product_control:read')
  @ApiOperation({ summary: 'List Product Control endpoints' })
  listEndpoints(@Query() query: ProductControlPaginationQueryDto) {
    return this.lists.listEndpoints({
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      productId: query.productId,
      platformId: query.platformId,
      status: query.status as ProductControlEndpointStatus | undefined,
    });
  }

  @Get('endpoints/:id')
  @RequireEdgePermissions('platform:product_control:read')
  async getEndpoint(@Param('id') id: string) {
    const item = await this.lists.getEndpoint(id);
    if (!item) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Endpoint not found');
    return item;
  }

  @Post('endpoints')
  @RequireEdgePermissions('platform:product_control:manage')
  @ApiOperation({ summary: 'Register a Product Control endpoint (credential_ref opaque only)' })
  @ApiBody({ type: RegisterProductControlEndpointDto })
  createEndpoint(@Req() req: EdgeRequest, @Body() body: RegisterProductControlEndpointDto) {
    return this.registerEndpoint.execute({
      actorId: actorId(req),
      correlationId: correlationOf(body),
      productRegistryId: body.productRegistryId,
      productId: body.productId,
      platformId: body.platformId,
      environmentId: body.environmentId,
      code: body.code,
      baseUrl: body.baseUrl,
      contractVersion: body.contractVersion,
      authProfile: body.authProfile,
      credentialRef: body.credentialRef,
      allowedScopes: body.allowedScopes,
    });
  }

  @Post('endpoints/:id/validate')
  @RequireEdgePermissions('platform:product_control:validate')
  @ApiBody({ type: ProductControlActionDto })
  validate(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: ProductControlActionDto,
  ) {
    return this.validateEndpoint.execute({
      actorId: actorId(req),
      correlationId: correlationOf(body),
      endpointId: id,
    });
  }

  @Post('endpoints/:id/handshake')
  @RequireEdgePermissions('platform:product_control:handshake')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiBody({ type: ProductControlActionDto })
  runHandshake(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: ProductControlActionDto,
    @Headers('idempotency-key') idemHeader?: string,
  ) {
    return this.handshake.execute({
      actorId: actorId(req),
      correlationId: correlationOf(body),
      endpointId: id,
      idempotencyKey: idemHeader?.trim() || body.idempotencyKey,
    });
  }

  @Post('endpoints/:id/discover-contract')
  @RequireEdgePermissions('platform:product_control:discover')
  @ApiBody({ type: ProductControlActionDto })
  runDiscoverContract(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: ProductControlActionDto,
    @Headers('idempotency-key') idemHeader?: string,
  ) {
    return this.discoverContract.execute({
      actorId: actorId(req),
      correlationId: correlationOf(body),
      endpointId: id,
      idempotencyKey: idemHeader?.trim() || body.idempotencyKey,
    });
  }

  @Post('endpoints/:id/discover-capabilities')
  @RequireEdgePermissions('platform:product_control:discover')
  @ApiBody({ type: ProductControlActionDto })
  runDiscoverCapabilities(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: ProductControlActionDto,
    @Headers('idempotency-key') idemHeader?: string,
  ) {
    return this.discoverCapabilities.execute({
      actorId: actorId(req),
      correlationId: correlationOf(body),
      endpointId: id,
      idempotencyKey: idemHeader?.trim() || body.idempotencyKey,
    });
  }

  @Post('endpoints/:id/health-check')
  @RequireEdgePermissions('platform:product_control:health')
  @ApiBody({ type: ProductControlActionDto })
  runHealthCheck(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: ProductControlActionDto,
    @Headers('idempotency-key') idemHeader?: string,
  ) {
    return this.healthCheck.execute({
      actorId: actorId(req),
      correlationId: correlationOf(body),
      endpointId: id,
      idempotencyKey: idemHeader?.trim() || body.idempotencyKey,
    });
  }

  @Post('endpoints/:id/quarantine')
  @RequireEdgePermissions('platform:product_control:quarantine')
  @ApiBody({ type: QuarantineProductControlEndpointDto })
  quarantineEndpoint(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: QuarantineProductControlEndpointDto,
  ) {
    return this.quarantine.execute({
      actorId: actorId(req),
      correlationId: correlationOf(body),
      endpointId: id,
      reason: body.reason,
    });
  }

  @Get('endpoints/:id/exchanges')
  @RequireEdgePermissions('platform:product_control:read')
  listEndpointExchanges(
    @Param('id') id: string,
    @Query() query: ProductControlPaginationQueryDto,
  ) {
    return this.lists.listExchanges({
      endpointId: id,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      status: query.status as ControlExchangeStatus | undefined,
    });
  }

  @Get('endpoints/:id/capabilities')
  @RequireEdgePermissions('platform:product_control:read')
  listCapabilities(@Param('id') id: string) {
    return this.lists.listCapabilities(id);
  }

  @Get('exchanges/:id')
  @RequireEdgePermissions('platform:product_control:read')
  async getExchange(@Param('id') id: string) {
    const item = await this.lists.getExchange(id);
    if (!item) throw new DomainError(ErrorCode.RESOURCE_NOT_FOUND, 'Exchange not found');
    return item;
  }

  @Post('exchanges/:id/reconcile')
  @RequireEdgePermissions('platform:product_control:reconcile')
  @ApiBody({ type: ReconcileProductControlExchangeDto })
  reconcileExchange(
    @Req() req: EdgeRequest,
    @Param('id') id: string,
    @Body() body: ReconcileProductControlExchangeDto,
  ) {
    return this.reconcile.execute({
      actorId: actorId(req),
      correlationId: correlationOf(body),
      exchangeId: id,
      outcome: body.outcome,
      notes: body.notes,
    });
  }

  @Post('callbacks/:endpointId')
  @RequireEdgePermissions('platform:product_control:manage')
  @ApiOperation({
    summary: 'Ingest Product Control callback (signature verified, inbox dedup)',
  })
  @ApiBody({ type: ReceiveProductControlCallbackDto })
  ingestCallback(
    @Req() req: EdgeRequest,
    @Param('endpointId') endpointId: string,
    @Body() body: ReceiveProductControlCallbackDto,
  ) {
    return this.receiveCallback.execute({
      actorId: actorId(req),
      correlationId: correlationOf(body),
      endpointId,
      callbackId: body.callbackId,
      idempotencyKey: body.idempotencyKey,
      payload: body.payload,
      signature: body.signature,
      signatureAlg: body.signatureAlg,
      issuedAt: body.issuedAt,
      requestId: body.requestId,
      exchangeId: body.exchangeId,
    });
  }
}
