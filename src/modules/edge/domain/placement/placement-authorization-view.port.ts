import type { ProvisioningEnvironmentSlot } from '../provisioning/provisioning.types.js';

export const PLACEMENT_AUTHORIZATION_VIEW_PORT = Symbol('PLACEMENT_AUTHORIZATION_VIEW_PORT');

/**
 * Placement-ready projection of a P7.1 ACCEPTED request + verified authorization.
 * Returned non-null only when commercial/trust gates pass (fail-closed).
 */
export type PlacementReadyAuthorizationView = {
  requestId: string;
  requestNumber: string;
  requestStatus: 'ACCEPTED';
  authorizationRowId: string;
  authorizationId: string;
  authorizationVersion: number;
  accountId: string;
  productId: string;
  subscriptionId: string;
  productTenantId: string | null;
  correlationId: string;
  environmentSlot: ProvisioningEnvironmentSlot;
  entitlementSnapshotReference: string;
  entitlementVersion: string | null;
  payloadDigest: string | null;
  expiresAt: Date | null;
  revocationStatus: string;
  verificationStatus: string;
  decision: string;
};

export interface PlacementAuthorizationViewPort {
  /**
   * Returns the view only if request is ACCEPTED, authorization decision=ALLOW,
   * verificationStatus=VERIFIED, revocationStatus=NOT_REVOKED, and not expired.
   * Otherwise null (fail-closed — never invent eligibility).
   */
  getPlacementReadyRequest(
    requestId: string,
  ): Promise<PlacementReadyAuthorizationView | null>;
}
