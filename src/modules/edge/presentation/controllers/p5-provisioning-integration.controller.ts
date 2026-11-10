import {
  Body,
  Controller,
  Headers,
  Inject,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { decodeJwt } from 'jose';
import { APP_CONFIG } from '../../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';
import { Public } from '../../../../shared/auth/decorators.js';
import { EdgeJwtValidationService } from '../../../../shared/auth/edge-jwt-validation.service.js';
import { DomainError, ErrorCode } from '../../../../core/domain/errors/domain-error.js';
import { HandleAuthorizationRevocationUseCase } from '../../application/provisioning/provisioning.use-cases.js';
import {
  type CanonicalRevocationEvent,
  verifyRevocationEventIntegrity,
} from '../../domain/provisioning/revocation-event.js';
import { loadProvisioningTrustMaterial } from '../../infrastructure/provisioning/trust-material.js';

/**
 * P5 → P7 S2S integration boundary (not operator RBAC).
 * Auth: Edge Keycloak JWT (JWKS). azp must match EDGE_P5_INBOUND_S2S_CLIENT_ID
 * (P5 service identity) — never EDGE_P5_S2S_CLIENT_ID (outbound Edge→P5).
 */
@Public()
@Controller('edge/integrations/p5/provisioning')
export class EdgeP5ProvisioningIntegrationController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly handleRevocation: HandleAuthorizationRevocationUseCase,
    private readonly edgeJwt: EdgeJwtValidationService,
  ) {}

  @Post('revocations')
  async ingestRevocation(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() body: CanonicalRevocationEvent,
  ) {
    const service = await this.assertP5InboundServiceJwt(authorizationHeader);

    if (!body || typeof body !== 'object') {
      throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Revocation event body required');
    }

    const trust = loadProvisioningTrustMaterial(this.config);
    const integrity = verifyRevocationEventIntegrity({
      event: body,
      keys: trust.keys,
      allowedIssuers: trust.allowedIssuers,
    });
    if (!integrity.ok) {
      throw new DomainError(
        ErrorCode.FORBIDDEN,
        `Revocation event rejected: ${integrity.reasonCode ?? 'INTEGRITY_FAILED'}`,
        [{ reasonCode: integrity.reasonCode }],
      );
    }

    return this.handleRevocation.execute({
      actorId: `s2s:p5-inbound:${service.clientId ?? body.issuer}`,
      eventId: body.event_id,
      eventName: body.event_name,
      authorizationId: body.authorization_id,
      revocationVersion: body.revocation_version,
      revokedAt: body.revoked_at,
      reasonCode: body.revocation_reason_code ?? null,
      reference: body.revocation_reference ?? null,
      payload: { ...body, signature: '[REDACTED]' },
      integrityVerified: true,
    });
  }

  private async assertP5InboundServiceJwt(authorizationHeader: string | undefined) {
    if (!authorizationHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('P5→Edge S2S Bearer token required');
    }
    const inboundClient = this.config.EDGE_P5_INBOUND_S2S_CLIENT_ID?.trim();
    if (!inboundClient) {
      throw new UnauthorizedException('EDGE_P5_INBOUND_S2S_CLIENT_ID is not configured');
    }
    const outboundClient = this.config.EDGE_P5_S2S_CLIENT_ID?.trim();
    if (outboundClient && outboundClient === inboundClient) {
      throw new UnauthorizedException(
        'S2S identity collision: inbound P5 client must differ from Edge→P5 outbound client',
      );
    }

    const token = authorizationHeader.slice('Bearer '.length).trim();
    let user;
    try {
      // EdgeJwtValidationService enforces EDGE_KEYCLOAK_ISSUER + EDGE_KEYCLOAK_AUDIENCE + JWKS signature
      user = await this.edgeJwt.validateToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or unauthenticated P5→Edge S2S token');
    }
    if (!user.clientId || user.clientId !== inboundClient) {
      throw new UnauthorizedException(
        'S2S token azp is not the authorized P5→Edge inbound service client',
      );
    }

    const requiredScopes = (this.config.EDGE_P5_INBOUND_S2S_REQUIRED_SCOPES ?? '')
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (requiredScopes.length > 0) {
      const claims = decodeJwt(token);
      const scopeClaim = typeof claims.scope === 'string' ? claims.scope : '';
      const tokenScopes = new Set(scopeClaim.split(/[\s,]+/).filter(Boolean));
      const hasAll = requiredScopes.every((s) => tokenScopes.has(s));
      if (!hasAll) {
        throw new UnauthorizedException('P5→Edge S2S token missing required scopes');
      }
    }

    return user;
  }
}
