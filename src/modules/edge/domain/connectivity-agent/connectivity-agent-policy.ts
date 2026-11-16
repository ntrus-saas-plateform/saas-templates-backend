import {
  AgentCommandStatus,
  AgentStatus,
  ConnectivityAgentErrorCode,
  type AgentCommandRecord,
  type ConnectivityAgentRecord,
} from './connectivity-agent.types.js';

export type ConnectivityAgentDecision =
  | { allowed: true }
  | { allowed: false; code: ConnectivityAgentErrorCode; reason: string };

/** Vault-only refs: vault:… or sec_… — never PEM / raw key material. */
export function isVaultPublicKeyRef(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (/BEGIN\s+(RSA\s+)?PUBLIC\s+KEY/i.test(v)) return false;
  if (v.includes('\n') || v.includes('-----')) return false;
  return /^sec_[A-Za-z0-9_-]+$/.test(v) || v.startsWith('vault:');
}

export function assertPublicKeyRefVaultOnly(
  publicKeyRef: string,
): ConnectivityAgentDecision {
  if (isVaultPublicKeyRef(publicKeyRef)) return { allowed: true };
  return {
    allowed: false,
    code: ConnectivityAgentErrorCode.PLAINTEXT_KEY_FORBIDDEN,
    reason:
      'public_key_ref must be a vault reference (vault:… or sec_…) — plaintext keys forbidden',
  };
}

/**
 * CRITICAL: Connectivity agents are outbound-only.
 * inbound / reverse tunnels are never permitted by policy.
 */
export function assertOutboundOnly(
  agent: Pick<ConnectivityAgentRecord, 'outboundOnly'> | { outboundOnly: boolean },
): ConnectivityAgentDecision {
  if (agent.outboundOnly === true) return { allowed: true };
  return {
    allowed: false,
    code: ConnectivityAgentErrorCode.OUTBOUND_ONLY_REQUIRED,
    reason: 'outbound_only must be true — inbound connectivity is forbidden',
  };
}

export function assertNonceFormat(nonce: string): ConnectivityAgentDecision {
  const n = nonce.trim();
  if (!/^[A-Fa-f0-9]{64}$/.test(n)) {
    return {
      allowed: false,
      code: ConnectivityAgentErrorCode.VALIDATION,
      reason: 'nonce must be a 64-char hex string (anti-replay)',
    };
  }
  return { allowed: true };
}

/** Anti-replay: nonce must be unique per agent. */
export function assertNonceUnused(
  existing: AgentCommandRecord | null,
): ConnectivityAgentDecision {
  if (!existing) return { allowed: true };
  return {
    allowed: false,
    code: ConnectivityAgentErrorCode.NONCE_REPLAY,
    reason: `Nonce already used for command ${existing.id} (anti-replay)`,
  };
}

export function canRegisterAgent(input: {
  agentStatus?: string | null;
  outboundOnly: boolean;
  publicKeyRef: string;
}): ConnectivityAgentDecision {
  const outbound = assertOutboundOnly({ outboundOnly: input.outboundOnly });
  if (!outbound.allowed) return outbound;
  const key = assertPublicKeyRefVaultOnly(input.publicKeyRef);
  if (!key.allowed) return key;
  if (input.agentStatus && String(input.agentStatus) === AgentStatus.REVOKED) {
    return {
      allowed: false,
      code: ConnectivityAgentErrorCode.AGENT_REVOKED,
      reason: 'Cannot re-register a REVOKED agent — create a new agent_code',
    };
  }
  return { allowed: true };
}

export function canIssueCommand(input: {
  agentStatus: string;
  outboundOnly: boolean;
  nonce: string;
  existingNonceCommand: AgentCommandRecord | null;
}): ConnectivityAgentDecision {
  const outbound = assertOutboundOnly({ outboundOnly: input.outboundOnly });
  if (!outbound.allowed) return outbound;
  if (String(input.agentStatus) === AgentStatus.REVOKED) {
    return {
      allowed: false,
      code: ConnectivityAgentErrorCode.AGENT_REVOKED,
      reason: 'Cannot issue commands to a REVOKED agent (fail-closed)',
    };
  }
  if (String(input.agentStatus) !== AgentStatus.ACTIVE) {
    return {
      allowed: false,
      code: ConnectivityAgentErrorCode.AGENT_NOT_ACTIVE,
      reason: `Command requires ACTIVE agent; current=${input.agentStatus}`,
    };
  }
  const nonceFmt = assertNonceFormat(input.nonce);
  if (!nonceFmt.allowed) return nonceFmt;
  return assertNonceUnused(input.existingNonceCommand);
}

/**
 * Revoke is fail-closed: only PENDING→ACTIVE/DEGRADED/REGISTERING/REVOKING may revoke.
 * Already REVOKED is a conflict (idempotent callers should short-circuit earlier).
 */
export function canRevokeAgent(agentStatus: string): ConnectivityAgentDecision {
  if (String(agentStatus) === AgentStatus.REVOKED) {
    return {
      allowed: false,
      code: ConnectivityAgentErrorCode.CONFLICT,
      reason: 'Agent already REVOKED',
    };
  }
  if (String(agentStatus) === AgentStatus.FAILED) {
    return {
      allowed: false,
      code: ConnectivityAgentErrorCode.VALIDATION,
      reason: 'FAILED agents cannot be revoked — quarantine / recreate',
    };
  }
  return { allowed: true };
}

/** Active (non-terminal) commands cleared to REVOKED on agent revoke. */
export function isActiveCommandStatus(status: string): boolean {
  return [
    AgentCommandStatus.PENDING,
    AgentCommandStatus.QUEUED,
    AgentCommandStatus.DISPATCHED,
    AgentCommandStatus.ACKED,
  ].includes(status as AgentCommandStatus);
}
