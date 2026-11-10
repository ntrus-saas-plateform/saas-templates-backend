import { Inject, Injectable } from '@nestjs/common';
import {
  PLACEMENT_AUTHORIZATION_VIEW_PORT,
  type PlacementAuthorizationViewPort,
  type PlacementReadyAuthorizationView,
} from '../../domain/placement/placement-authorization-view.port.js';
import {
  PROVISIONING_REPOSITORY_PORT,
  type ProvisioningRepositoryPort,
} from '../../domain/provisioning/provisioning-repository.port.js';
import {
  AuthorizationVerificationStatus,
  ProvisioningDecision,
  ProvisioningEnvironmentSlot,
  ProvisioningRequestStatus,
  RevocationStatus,
} from '../../domain/provisioning/provisioning.types.js';

@Injectable()
export class PgPlacementAuthorizationViewAdapter implements PlacementAuthorizationViewPort {
  constructor(
    @Inject(PROVISIONING_REPOSITORY_PORT)
    private readonly provisioning: ProvisioningRepositoryPort,
  ) {}

  async getPlacementReadyRequest(
    requestId: string,
  ): Promise<PlacementReadyAuthorizationView | null> {
    const request = await this.provisioning.getRequestById(requestId);
    if (!request) return null;
    if (request.requestStatus !== ProvisioningRequestStatus.ACCEPTED) return null;
    if (!request.authorizationRowId) return null;

    const auth = await this.provisioning.getAuthorizationById(request.authorizationRowId);
    if (!auth) return null;

    if (auth.decision !== ProvisioningDecision.ALLOW) return null;
    if (auth.verificationStatus !== AuthorizationVerificationStatus.VERIFIED) return null;
    if (auth.revocationStatus !== RevocationStatus.NOT_REVOKED) return null;

    if (auth.expiresAt && auth.expiresAt.getTime() <= Date.now()) return null;
    if (auth.notBefore && auth.notBefore.getTime() > Date.now()) return null;

    const environmentSlot =
      (Object.values(ProvisioningEnvironmentSlot) as string[]).includes(
        String(auth.environmentSlot),
      )
        ? (auth.environmentSlot as ProvisioningEnvironmentSlot)
        : ProvisioningEnvironmentSlot.PROD;

    return {
      requestId: request.id,
      requestNumber: request.requestNumber,
      requestStatus: 'ACCEPTED',
      authorizationRowId: auth.id,
      authorizationId: auth.authorizationId,
      authorizationVersion: auth.authorizationVersion,
      accountId: auth.accountId,
      productId: auth.productId,
      subscriptionId: auth.subscriptionId,
      productTenantId: auth.productTenantId,
      correlationId: auth.correlationId || request.correlationId,
      environmentSlot,
      entitlementSnapshotReference: auth.entitlementSnapshotReference,
      entitlementVersion: auth.entitlementVersion ?? null,
      payloadDigest: auth.payloadDigest ?? null,
      expiresAt: auth.expiresAt,
      revocationStatus: String(auth.revocationStatus),
      verificationStatus: String(auth.verificationStatus),
      decision: String(auth.decision),
    };
  }
}

export { PLACEMENT_AUTHORIZATION_VIEW_PORT };
