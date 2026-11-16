/** P7.14 — Connectivity Agent & Edge Agent Registry domain vocabulary. */

export enum AgentStatus {
  PENDING = 'PENDING',
  REGISTERING = 'REGISTERING',
  ACTIVE = 'ACTIVE',
  DEGRADED = 'DEGRADED',
  REVOKING = 'REVOKING',
  REVOKED = 'REVOKED',
  FAILED = 'FAILED',
}

export enum AgentCommandStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  DISPATCHED = 'DISPATCHED',
  ACKED = 'ACKED',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

export enum AgentSpoolStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
}

export enum ConnectivityAgentErrorCode {
  VALIDATION = 'VALIDATION',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  OUTBOUND_ONLY_REQUIRED = 'OUTBOUND_ONLY_REQUIRED',
  PLAINTEXT_KEY_FORBIDDEN = 'PLAINTEXT_KEY_FORBIDDEN',
  NONCE_REPLAY = 'NONCE_REPLAY',
  AGENT_NOT_ACTIVE = 'AGENT_NOT_ACTIVE',
  AGENT_REVOKED = 'AGENT_REVOKED',
  CONFLICT = 'CONFLICT',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
}

export type ConnectivityAgentRecord = {
  id: string;
  agentCode: string;
  displayName: string;
  tenantId: string | null;
  productId: string | null;
  deploymentProfileCode: string | null;
  agentStatus: AgentStatus | string;
  publicKeyRef: string;
  certificateRef: string | null;
  outboundOnly: boolean;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
  revocationReason: string | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type AgentCommandRecord = {
  id: string;
  agentId: string;
  commandType: string;
  commandStatus: AgentCommandStatus | string;
  nonce: string;
  payloadRef: string | null;
  signatureRef: string | null;
  provisioningRequestId: string | null;
  authorizationRowId: string | null;
  authorizationVersion: number | null;
  workflowId: string | null;
  expiresAt: Date | null;
  ackedAt: Date | null;
  finishedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AgentSpoolRecord = {
  id: string;
  agentId: string;
  commandId: string | null;
  spoolStatus: AgentSpoolStatus | string;
  payloadRef: string;
  attempts: number;
  nextAttemptAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AgentEvidenceRecord = {
  id: string;
  agentId: string | null;
  commandId: string | null;
  tenantId: string | null;
  workflowId: string | null;
  stepKey: string | null;
  operation: string;
  outcome: string;
  evidence: Record<string, unknown>;
  errorCode: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  performedBy: string | null;
  createdAt: Date;
};

export const CONNECTIVITY_AGENT_HANDLER_KEYS = [
  'agent.revalidate_auth',
  'agent.validate_outbound',
  'agent.validate_public_key_ref',
  'agent.persist_registration',
  'agent.activate',
  'agent.validate_nonce',
  'agent.enqueue_command',
  'agent.spool_command',
  'agent.mark_revoking',
  'agent.revoke_pending_commands',
  'agent.revoke_agent',
  'agent.verify',
] as const;

export type ConnectivityAgentHandlerKey =
  (typeof CONNECTIVITY_AGENT_HANDLER_KEYS)[number];
