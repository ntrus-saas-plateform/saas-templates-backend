export const WORKFLOW_AUTHORIZATION_PORT = Symbol('WORKFLOW_AUTHORIZATION_PORT');

/**
 * Provisioning-ready projection of P7.1 ACCEPTED request + verified authorization.
 * Returned non-null only when commercial/trust gates pass (fail-closed).
 */
export type WorkflowReadyAuthorizationView = {
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
  expiresAt: Date | null;
  revocationStatus: 'NOT_REVOKED' | string;
  verificationStatus: 'VERIFIED' | string;
  decision: 'ALLOW' | string;
};

/**
 * Fail-closed view of P7.1 authorization readiness for workflow create/protected boundaries.
 * Does not reimplement P7.1 signature/verification — adapters delegate to provisioning ports.
 */
export interface WorkflowAuthorizationPort {
  getWorkflowReadyRequest(requestId: string): Promise<WorkflowReadyAuthorizationView | null>;

  /** @deprecated prefer revalidateBoundAuthorization */
  isAuthorizationStillValid(params: {
    authorizationRowId: string;
    expectedVersion?: number | null;
  }): Promise<boolean>;

  /**
   * Revalidate a previously bound authorization row + version at protected boundaries.
   * Returns null when revoked, expired, superseded, or uncertain.
   */
  revalidateBoundAuthorization(params: {
    authorizationRowId: string;
    authorizationVersion: number;
    provisioningRequestId?: string | null;
  }): Promise<WorkflowReadyAuthorizationView | null>;
}
