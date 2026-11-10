import { Inject, Injectable } from '@nestjs/common';
import {
  WORKFLOW_AUTHORIZATION_PORT,
  type WorkflowAuthorizationPort,
  type WorkflowReadyAuthorizationView,
} from '../../domain/workflow/workflow-authorization.port.js';
import {
  PROVISIONING_REPOSITORY_PORT,
  type ProvisioningRepositoryPort,
} from '../../domain/provisioning/provisioning-repository.port.js';
import {
  AuthorizationVerificationStatus,
  ProvisioningDecision,
  ProvisioningRequestStatus,
  RevocationStatus,
} from '../../domain/provisioning/provisioning.types.js';

@Injectable()
export class PgWorkflowAuthorizationAdapter implements WorkflowAuthorizationPort {
  constructor(
    @Inject(PROVISIONING_REPOSITORY_PORT)
    private readonly provisioning: ProvisioningRepositoryPort,
  ) {}

  async getWorkflowReadyRequest(
    requestId: string,
  ): Promise<WorkflowReadyAuthorizationView | null> {
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
      expiresAt: auth.expiresAt,
      revocationStatus: String(auth.revocationStatus),
      verificationStatus: String(auth.verificationStatus),
      decision: String(auth.decision),
    };
  }

  async isAuthorizationStillValid(params: {
    authorizationRowId: string;
    expectedVersion?: number | null;
  }): Promise<boolean> {
    const auth = await this.provisioning.getAuthorizationById(params.authorizationRowId);
    if (!auth) return false;
    const version = params.expectedVersion ?? auth.authorizationVersion;
    const view = await this.revalidateBoundAuthorization({
      authorizationRowId: params.authorizationRowId,
      authorizationVersion: version,
    });
    return view != null;
  }

  async revalidateBoundAuthorization(params: {
    authorizationRowId: string;
    authorizationVersion: number;
    provisioningRequestId?: string | null;
  }): Promise<WorkflowReadyAuthorizationView | null> {
    const auth = await this.provisioning.getAuthorizationById(params.authorizationRowId);
    if (!auth) return null;
    if (auth.authorizationVersion !== params.authorizationVersion) return null;
    if (auth.decision !== ProvisioningDecision.ALLOW) return null;
    if (auth.verificationStatus !== AuthorizationVerificationStatus.VERIFIED) return null;
    if (auth.revocationStatus !== RevocationStatus.NOT_REVOKED) return null;
    if (auth.expiresAt && auth.expiresAt.getTime() <= Date.now()) return null;
    if (auth.notBefore && auth.notBefore.getTime() > Date.now()) return null;

    let requestId = params.provisioningRequestId ?? '';
    let requestNumber = '';
    let correlationId = auth.correlationId;
    if (params.provisioningRequestId) {
      const request = await this.provisioning.getRequestById(params.provisioningRequestId);
      if (!request || request.requestStatus !== ProvisioningRequestStatus.ACCEPTED) {
        return null;
      }
      if (request.authorizationRowId !== params.authorizationRowId) return null;
      requestId = request.id;
      requestNumber = request.requestNumber;
      correlationId = auth.correlationId || request.correlationId;
    }

    return {
      requestId,
      requestNumber,
      requestStatus: 'ACCEPTED',
      authorizationRowId: auth.id,
      authorizationId: auth.authorizationId,
      authorizationVersion: auth.authorizationVersion,
      accountId: auth.accountId,
      productId: auth.productId,
      subscriptionId: auth.subscriptionId,
      productTenantId: auth.productTenantId,
      correlationId,
      expiresAt: auth.expiresAt,
      revocationStatus: String(auth.revocationStatus),
      verificationStatus: String(auth.verificationStatus),
      decision: String(auth.decision),
    };
  }
}

export { WORKFLOW_AUTHORIZATION_PORT };
